if (require.main === module) {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const stripePriceByPlan = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || '',
  business: process.env.STRIPE_PRICE_BUSINESS || '',
};
const stripePlanByPrice = Object.fromEntries(
  Object.entries(stripePriceByPlan)
    .filter(([, priceId]) => !!priceId)
    .map(([plan, priceId]) => [priceId, plan])
);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions =
  corsOrigin && corsOrigin !== '*'
    ? { origin: corsOrigin.split(',').map((s) => s.trim()), credentials: true }
    : {};

app.use(cors(corsOptions));

function stripeConfigured() {
  return !!(stripeClient && process.env.STRIPE_WEBHOOK_SECRET);
}

function mapStripeStatusToOrgStatus(subStatus) {
  if (subStatus === 'trialing') return 'trial';
  if (subStatus === 'active') return 'active';
  if (subStatus === 'canceled' || subStatus === 'incomplete_expired') return 'cancelled';
  if (subStatus === 'past_due' || subStatus === 'unpaid' || subStatus === 'incomplete') return 'paused';
  return 'paused';
}

function calculateMrrFromSubscription(subscription) {
  const firstItem = subscription?.items?.data?.[0];
  const amount = firstItem?.price?.unit_amount;
  return Number.isFinite(amount) ? Number((amount / 100).toFixed(2)) : 0;
}

function planFromSubscription(subscription) {
  const firstItem = subscription?.items?.data?.[0];
  const priceId = firstItem?.price?.id || '';
  return stripePlanByPrice[priceId] || null;
}

async function upsertOrgStripeStateFromSubscription(orgId, subscription) {
  if (!supabaseAdmin || !orgId || !subscription) return;
  const resolvedPlan = planFromSubscription(subscription);
  if (!resolvedPlan) {
    const unresolvedPrice = subscription?.items?.data?.[0]?.price?.id || 'unknown';
    console.warn('Stripe webhook plan mapping missing for price ID:', unresolvedPrice, 'org:', orgId);
  }
  const trialEndTs = Number(subscription?.trial_end || 0);
  const trialEndIso = trialEndTs > 0 ? new Date(trialEndTs * 1000).toISOString() : null;
  const updatePayload = {
    status: mapStripeStatusToOrgStatus(subscription.status),
    stripe_subscription_id: subscription.id || null,
    stripe_customer_id: subscription.customer || null,
    mrr: calculateMrrFromSubscription(subscription),
    trial_ends_at: trialEndIso,
  };
  if (resolvedPlan) updatePayload.plan = resolvedPlan;
  await supabaseAdmin
    .from('organisations')
    .update(updatePayload)
    .eq('id', orgId);
}

async function setOrgFreePlan(orgId) {
  if (!supabaseAdmin || !orgId) return;
  await supabaseAdmin
    .from('organisations')
    .update({
      plan: 'free',
      status: 'active',
      stripe_subscription_id: null,
      mrr: 0,
      trial_ends_at: null,
    })
    .eq('id', orgId);
}

async function resolveOrgIdForStripeSubscription(subscription) {
  const metaOrgId = subscription?.metadata?.orgId;
  if (metaOrgId) return metaOrgId;
  if (!supabaseAdmin) return null;
  if (subscription?.id) {
    const bySub = await supabaseAdmin
      .from('organisations')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    if (bySub?.data?.id) return bySub.data.id;
  }
  if (subscription?.customer) {
    const byCustomer = await supabaseAdmin
      .from('organisations')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .maybeSingle();
    if (byCustomer?.data?.id) return byCustomer.data.id;
  }
  return null;
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeConfigured()) {
    return res.status(503).json({ error: 'Stripe webhook not configured on server' });
  }
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }
  let event;
  try {
    event = stripeClient.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error('Stripe webhook signature verification failed:', e.message);
    return res.status(400).json({ error: 'Invalid Stripe signature' });
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        const subscription = await stripeClient.subscriptions.retrieve(session.subscription);
        const orgId = session.metadata?.orgId || (await resolveOrgIdForStripeSubscription(subscription));
        if (orgId) {
          await upsertOrgStripeStateFromSubscription(orgId, subscription);
          try {
            const orgRes = await supabaseAdmin
              .from('organisations')
              .select('id,name,plan,billing_email,owner_email')
              .eq('id', orgId)
              .maybeSingle();
            if (orgRes && orgRes.data) {
              await sendLifecycleForOrg(orgRes.data, 'subscription_confirmed', {
                next_billing_date: formatDate(new Date(Number(subscription.current_period_end || 0) * 1000)),
                plan_name: planFromSubscription(subscription) || orgRes.data.plan || 'starter',
                plan_price:
                  planFromSubscription(subscription) === 'starter'
                    ? '£49/mo'
                    : planFromSubscription(subscription) === 'professional'
                      ? '£89/mo'
                      : planFromSubscription(subscription) === 'business'
                        ? '£149/mo'
                        : '—',
              });
            }
          } catch (emailErr) {
            console.warn('subscription_confirmed lifecycle email failed:', emailErr && emailErr.message ? emailErr.message : emailErr);
          }
        }
      }
    }
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object;
      const orgId = await resolveOrgIdForStripeSubscription(subscription);
      if (orgId) {
        await upsertOrgStripeStateFromSubscription(orgId, subscription);
      }
    }
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const customerId = invoice && invoice.customer ? String(invoice.customer) : '';
      if (customerId) {
        const orgRes = await supabaseAdmin
          .from('organisations')
          .select('id,name,plan,billing_email,owner_email')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        if (orgRes && orgRes.data) {
          try {
            await sendLifecycleForOrg(orgRes.data, 'payment_failed', {
              plan_name: orgRes.data.plan || 'starter',
              plan_price:
                orgRes.data.plan === 'starter'
                  ? '£49/mo'
                  : orgRes.data.plan === 'professional'
                    ? '£89/mo'
                    : orgRes.data.plan === 'business'
                      ? '£149/mo'
                      : '—',
            });
          } catch (emailErr) {
            console.warn('payment_failed lifecycle email failed:', emailErr && emailErr.message ? emailErr.message : emailErr);
          }
        }
      }
    }
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      const customerId = invoice && invoice.customer ? String(invoice.customer) : '';
      if (customerId) {
        const orgRes = await supabaseAdmin
          .from('organisations')
          .select('id,name,plan,billing_email,owner_email')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        if (orgRes && orgRes.data) {
          try {
            const line = invoice && Array.isArray(invoice.lines && invoice.lines.data) ? invoice.lines.data[0] : null;
            const amountMinor = typeof invoice.amount_paid === 'number' ? invoice.amount_paid : (line && typeof line.amount === 'number' ? line.amount : null);
            if (!(typeof amountMinor === 'number' && amountMinor > 0)) {
              // Ignore zero-value invoices (e.g., trial transitions).
            } else {
              const amountPaid = `£${(amountMinor / 100).toFixed(2)}`;
              const paidAt = invoice && invoice.status_transitions && invoice.status_transitions.paid_at
                ? formatDate(new Date(Number(invoice.status_transitions.paid_at) * 1000))
                : formatDate(new Date());
              await sendLifecycleForOrg(orgRes.data, 'payment_successful', {
                plan_name: orgRes.data.plan || 'starter',
                plan_price:
                  orgRes.data.plan === 'starter'
                    ? '£49/mo'
                    : orgRes.data.plan === 'professional'
                      ? '£89/mo'
                      : orgRes.data.plan === 'business'
                        ? '£149/mo'
                        : '—',
                payment_amount: amountPaid || '—',
                payment_date: paidAt || '—',
              });
            }
          } catch (emailErr) {
            console.warn('payment_successful lifecycle email failed:', emailErr && emailErr.message ? emailErr.message : emailErr);
          }
        }
      }
    }
  } catch (e) {
    console.error('Stripe webhook handler failed:', e);
    return res.status(500).json({ error: 'Stripe webhook processing failed' });
  }
  res.status(200).json({ received: true });
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 80),
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.EMAIL_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
});

const authLifecycleEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_EMAIL_RATE_LIMIT_MAX || 25),
  standardHeaders: true,
  legacyHeaders: false,
});

const ALLOWED_ANTHROPIC_MODELS = new Set([
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
]);

app.post('/api/ai/messages', aiLimiter, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Anthropic API not configured on server' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const body = req.body || {};
  const model = body.model;
  if (!model || !ALLOWED_ANTHROPIC_MODELS.has(model)) {
    return res.status(400).json({ error: 'Unsupported or missing model' });
  }
  const maxRaw = Number(body.max_tokens);
  const max_tokens = Math.min(Math.max(Number.isFinite(maxRaw) ? maxRaw : 700, 1), 8192);
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  const anthropicUrl =
    process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';

  try {
    const r = await fetch(anthropicUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages: body.messages,
      }),
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (e) {
    console.error('Anthropic proxy error:', e);
    res.status(502).json({ error: 'Upstream AI request failed' });
  }
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Backend is running correctly.' });
});

/**
 * Tenant-facing / org emails: Resend REST API (same contract as resend npm package).
 * After Resend verifies landlordapp.io, use any From on that domain (no separate "Add sender").
 * Auth: Supabase user JWT. Body: { orgId, to, subject, text, html?, kind?: 'tenant'|'report' }
 */
app.post('/api/email/send', emailLimiter, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(503).json({ error: 'Email sending not configured (RESEND_API_KEY)' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const userId = userData.user.id;

  const body = req.body || {};
  const orgId = body.orgId;
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const text = typeof body.text === 'string' ? body.text : '';
  const html = typeof body.html === 'string' ? body.html : undefined;
  let to = body.to;
  if (typeof to === 'string') to = [to];
  if (!Array.isArray(to) || to.length === 0 || !to.every((x) => typeof x === 'string' && x.includes('@'))) {
    return res.status(400).json({ error: 'Invalid or missing to (email address(es))' });
  }
  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'orgId required' });
  }
  if (!subject || subject.length > 998) {
    return res.status(400).json({ error: 'Invalid or missing subject' });
  }
  if (!text && !html) {
    return res.status(400).json({ error: 'text or html required' });
  }
  if (text.length > 500000 || (html && html.length > 500000)) {
    return res.status(400).json({ error: 'Body too large' });
  }

  const { data: mem, error: memErr } = await supabaseAdmin
    .from('org_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memErr || !mem) {
    return res.status(403).json({ error: 'Not a member of this organisation' });
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organisations')
    .select('billing_email, owner_email, name')
    .eq('id', orgId)
    .maybeSingle();
  if (orgErr || !org) {
    return res.status(404).json({ error: 'Organisation not found' });
  }

  const replyTo =
    (typeof body.replyTo === 'string' && body.replyTo.includes('@') && body.replyTo.trim()) ||
    (org.billing_email && String(org.billing_email).trim()) ||
    (org.owner_email && String(org.owner_email).trim()) ||
    (userData.user.email || '').trim();

  const mailFrom =
    process.env.MAIL_FROM || 'LandlordApp <noreply@landlordapp.io>';

  try {
    const payload = {
      from: mailFrom,
      to,
      subject,
      reply_to: replyTo ? [replyTo] : undefined,
      // Hints direct / transactional handling (Gmail tab placement is still classifier-dependent).
      headers: {
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
    };
    if (text) payload.text = text;
    if (html) payload.html = html;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + resendKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (e) {
    console.error('Resend proxy error:', e);
    res.status(502).json({ error: 'Email send failed' });
  }
});

function escapeHtmlEmail(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function startOfDayTs(dateLike) {
  const d = new Date(dateLike || Date.now());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(dateLike, days) {
  return new Date(new Date(dateLike).getTime() + days * 86400000);
}

function formatDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function templateTruthy(value) {
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '' && value !== '0' && value.toLowerCase() !== 'false';
  return !!value;
}

function renderConditionalBlocks(template, vars) {
  return String(template || '').replace(/\{\{#(if_[a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, blockKey, inner) => {
    return templateTruthy(vars && vars[blockKey]) ? inner : '';
  });
}

function renderHtmlTemplate(template, vars) {
  const withBlocks = renderConditionalBlocks(template, vars);
  return withBlocks.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const raw = Object.prototype.hasOwnProperty.call(vars || {}, key) ? vars[key] : '';
    return escapeHtmlEmail(raw);
  });
}

function renderTextTemplate(template, vars) {
  const withBlocks = renderConditionalBlocks(template, vars);
  return withBlocks.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const raw = Object.prototype.hasOwnProperty.call(vars || {}, key) ? vars[key] : '';
    return String(raw == null ? '' : raw);
  });
}

function firstNameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  const cleaned = local.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  return cleaned ? cleaned.split(/\s+/)[0] : 'there';
}

function authLifecycleTemplatePayload(templateId) {
  const id = String(templateId || '').toLowerCase();

  if (id === 'welcome_signup') {
    return {
      subject: 'Welcome to LandlordApp.io',
      text: 'Hi {{first_name}},\n\nWelcome to LandlordApp.io.\nYour selected plan: {{plan_name}}\nTrial end date: {{trial_end_date}}\n\nYou can now sign in and finish setting up your workspace.',
      html: '<!doctype html><html><body style="margin:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a"><div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:linear-gradient(135deg,#0F172A 0%,#1a1a3e 100%);color:#fff"><div style="font-size:20px;font-weight:800">LandlordApp.io</div></div><div style="padding:28px"><h1 style="margin:0 0 10px;font-size:22px;line-height:1.3">Welcome, {{first_name}}.</h1><p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569">Thanks for creating your account. Your workspace is ready to finish setup.</p><div style="background:#f8f9fb;border:1px solid #e8ecf0;border-radius:10px;padding:14px 16px;margin:0 0 16px"><div style="font-size:13px;color:#64748b;margin:0 0 6px">Plan</div><div style="font-size:15px;font-weight:700;color:#0f172a">{{plan_name}}</div><div style="font-size:13px;color:#64748b;margin:10px 0 6px">Trial end date</div><div style="font-size:15px;font-weight:700;color:#0f172a">{{trial_end_date}}</div></div><p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">Need help? Reply to this email or contact {{support_email}}.</p></div></div></body></html>',
    };
  }
  if (id === 'email_verification') {
    return {
      subject: 'Verify your LandlordApp email',
      text: 'Hi {{first_name}},\n\nPlease verify your email to activate your account:\n{{verify_url}}\n\nIf you did not sign up, ignore this email.',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Verify your email, {{first_name}}</h2><p style="color:#475569;line-height:1.7">Please confirm your address before first login.</p><a href="{{verify_url}}" style="display:inline-block;background:#00B894;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Verify email</a></div></div></body></html>',
    };
  }
  if (id === 'password_reset') {
    return {
      subject: 'Reset your LandlordApp password',
      text: 'Hi {{first_name}},\n\nReset your password using this secure link:\n{{reset_url}}\n\nIf you did not request this, you can ignore this email.',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Password reset request</h2><p style="color:#475569;line-height:1.7">Use the secure link below to set a new password.</p><a href="{{reset_url}}" style="display:inline-block;background:#00B894;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Reset password</a></div></div></body></html>',
    };
  }
  if (id === 'trial_ending_7') {
    return {
      subject: 'Your trial ends in 7 days',
      text: 'Hi {{first_name}},\n\nYour trial ends on {{trial_end_date}}.\nUpgrade now to avoid interruptions.\nPlan: {{plan_name}} ({{plan_price}})',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Your trial ends in 7 days</h2><p style="color:#475569;line-height:1.7">Your free access ends on <strong>{{trial_end_date}}</strong>. Add billing to continue without interruption.</p></div></div></body></html>',
    };
  }
  if (id === 'trial_ending_1') {
    return {
      subject: 'Your trial ends tomorrow',
      text: 'Hi {{first_name}},\n\nYour trial ends on {{trial_end_date}} (tomorrow). Add billing now to keep access uninterrupted.',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Your trial ends tomorrow</h2><p style="color:#475569;line-height:1.7">Your trial expires on <strong>{{trial_end_date}}</strong>. Complete subscription setup to avoid account interruption.</p></div></div></body></html>',
    };
  }
  if (id === 'trial_expired') {
    return {
      subject: 'Your trial has ended',
      text: 'Hi {{first_name}},\n\nYour trial ended on {{trial_end_date}}.\nYour data is retained until {{data_expiry_date}}. Upgrade anytime to restore full access.',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Your trial has ended</h2><p style="color:#475569;line-height:1.7">Your trial ended on <strong>{{trial_end_date}}</strong>. Your data remains available until <strong>{{data_expiry_date}}</strong>.</p></div></div></body></html>',
    };
  }
  if (id === 'subscription_confirmed') {
    return {
      subject: 'Subscription confirmed',
      text: 'Hi {{first_name}},\n\nYour subscription is active.\nPlan: {{plan_name}} ({{plan_price}})\nNext billing date: {{next_billing_date}}',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Subscription confirmed</h2><p style="color:#475569;line-height:1.7">Your plan <strong>{{plan_name}}</strong> is active. Next billing date: <strong>{{next_billing_date}}</strong>.</p></div></div></body></html>',
    };
  }
  if (id === 'payment_failed') {
    return {
      subject: 'Payment failed — update your card',
      text: 'Hi {{first_name}},\n\nWe could not process your latest payment for {{plan_name}}.\nPlease update your billing method to avoid interruption.',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Payment failed</h2><p style="color:#475569;line-height:1.7">We could not process payment for your <strong>{{plan_name}}</strong> subscription. Update your card to keep service active.</p></div></div></body></html>',
    };
  }
  if (id === 'payment_successful') {
    return {
      subject: 'Payment successful',
      text: 'Hi {{first_name}},\n\nYour payment was received successfully.\nPlan: {{plan_name}} ({{plan_price}})\nAmount paid: {{payment_amount}}\nPayment date: {{payment_date}}',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Payment successful</h2><p style="color:#475569;line-height:1.7">We have received your payment for <strong>{{plan_name}}</strong>.</p><p style="color:#475569;line-height:1.7;margin:10px 0 0">Amount paid: <strong>{{payment_amount}}</strong><br>Payment date: <strong>{{payment_date}}</strong></p></div></div></body></html>',
    };
  }
  if (id === 'monthly_portfolio_report') {
    return {
      subject: 'Monthly portfolio report',
      text: 'Hi {{first_name}},\n\nProperties: {{properties}}\nTenants: {{tenants}}\nOccupancy: {{occupancy}}\nGross income: {{gross_income}}\nLandlord costs: {{landlord_costs}}\nNet profit: {{net_profit}}\n{{#if_arrears}}Arrears: {{arrears_total}}\n{{/if_arrears}}{{#if_compliance}}Expiring certificates: {{compliance_items}}\n{{/if_compliance}}',
      html: '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:0"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8ecf0"><div style="padding:24px 28px;background:#0F172A;color:#fff;font-size:20px;font-weight:800">LandlordApp.io</div><div style="padding:28px"><h2 style="margin:0 0 10px">Monthly portfolio report</h2><p style="color:#475569;line-height:1.7;margin:0 0 10px">Properties: <strong>{{properties}}</strong><br>Tenants: <strong>{{tenants}}</strong><br>Occupancy: <strong>{{occupancy}}</strong><br>Gross income: <strong>{{gross_income}}</strong><br>Landlord costs: <strong>{{landlord_costs}}</strong><br>Net profit: <strong>{{net_profit}}</strong></p>{{#if_arrears}}<p style="color:#9a3412;line-height:1.7">Arrears detected: <strong>{{arrears_total}}</strong></p>{{/if_arrears}}{{#if_compliance}}<p style="color:#9a3412;line-height:1.7">Compliance certificates expiring soon: <strong>{{compliance_items}}</strong></p>{{/if_compliance}}</div></div></body></html>',
    };
  }
  return null;
}

async function sendAuthLifecycleEmail(to, templateId, vars) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error('Email sending not configured (RESEND_API_KEY)');
  const payload = authLifecycleTemplatePayload(templateId);
  if (!payload) throw new Error('Unsupported auth lifecycle templateId');

  const lifecycleMailFrom =
    process.env.LIFECYCLE_MAIL_FROM ||
    process.env.AUTH_LIFECYCLE_MAIL_FROM ||
    'LandlordApp <admin@landlordapp.io>';
  const replyTo = (typeof vars.reply_to === 'string' && vars.reply_to.includes('@') ? vars.reply_to : null);
  const finalPayload = {
    from: lifecycleMailFrom,
    to: [to],
    subject: renderTextTemplate(payload.subject, vars),
    text: renderTextTemplate(payload.text, vars),
    html: renderHtmlTemplate(payload.html, vars),
    ...(replyTo ? { reply_to: [replyTo] } : {}),
    headers: {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    },
  };

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + resendKey,
    },
    body: JSON.stringify(finalPayload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || 'Email send failed';
    throw new Error(msg);
  }
  return { ok: true, id: data && data.id ? data.id : null };
}

async function sendLifecycleForOrg(org, templateId, vars) {
  const recipient = String((org && (org.billing_email || org.owner_email)) || '').trim().toLowerCase();
  if (!recipient || !recipient.includes('@')) return { skipped: true };
  return sendAuthLifecycleEmail(recipient, templateId, Object.assign({
    first_name: firstNameFromEmail(recipient),
    email: recipient,
    support_email: 'support@landlordapp.io',
    plan_name: org && org.plan ? String(org.plan).replace(/^./, (m) => m.toUpperCase()) : 'Free',
    plan_price: '—',
  }, vars || {}));
}

app.post('/api/email/auth-lifecycle', authLifecycleEmailLimiter, async (req, res) => {
  const body = req.body || {};
  const templateId = String(body.templateId || '').toLowerCase().trim();
  const to = String(body.to || '').trim().toLowerCase();
  const vars = body.vars && typeof body.vars === 'object' ? body.vars : {};

  if (!templateId) return res.status(400).json({ error: 'templateId is required' });
  if (!to || !to.includes('@')) return res.status(400).json({ error: 'Valid to email is required' });

  try {
    const out = await sendAuthLifecycleEmail(to, templateId, vars);
    return res.status(200).json(out);
  } catch (e) {
    console.error('Auth lifecycle email send failed:', e);
    return res.status(502).json({ error: e && e.message ? e.message : 'Email send failed' });
  }
});

app.post('/api/auth/request-password-reset', authLifecycleEmailLimiter, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  const email = String(req.body && req.body.email || '').trim().toLowerCase();
  const redirectTo = String(req.body && req.body.redirectTo || '').trim() || process.env.WORKER_URL || `${appBaseUrl}/index.html`;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  try {
    const gen = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    const actionLink = gen && gen.data && gen.data.properties && gen.data.properties.action_link
      ? gen.data.properties.action_link
      : '';
    if (actionLink) {
      await sendAuthLifecycleEmail(email, 'password_reset', {
        first_name: firstNameFromEmail(email),
        email,
        reset_url: actionLink,
        support_email: 'support@landlordapp.io',
      });
    }
  } catch (e) {
    console.error('Password reset lifecycle email failed:', e);
  }
  return res.status(200).json({ ok: true });
});

app.post('/api/email/run-lifecycle-jobs', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  const cronSecret = process.env.LIFECYCLE_EMAIL_CRON_SECRET || '';
  if (!cronSecret) return res.status(503).json({ error: 'Lifecycle cron secret not configured' });
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim()
    || String((req.headers.authorization || '').replace(/^Bearer\s+/i, '')).trim();
  if (headerSecret !== cronSecret) return res.status(401).json({ error: 'Unauthorized lifecycle job invocation' });

  const now = new Date();
  const todayTs = startOfDayTs(now);
  const force = !!(req.body && req.body.force === true);
  const runMonthly = force || now.getDate() === 1;
  const summary = { trial7: 0, trial1: 0, trialExpired: 0, monthly: 0, skipped: 0 };

  try {
    const trials = await supabaseAdmin.from('organisations')
      .select('id,name,plan,status,trial_ends_at,billing_email,owner_email')
      .eq('status', 'trial');
    for (const org of Array.isArray(trials.data) ? trials.data : []) {
      if (!org || !org.trial_ends_at) { summary.skipped += 1; continue; }
      const daysLeft = Math.ceil((startOfDayTs(org.trial_ends_at) - todayTs) / 86400000);
      const vars = {
        trial_end_date: formatDate(org.trial_ends_at),
        data_expiry_date: formatDate(addDays(org.trial_ends_at, 30)),
        plan_name: org.plan || 'trial',
        plan_price: org.plan === 'starter' ? '£49/mo' : org.plan === 'professional' ? '£89/mo' : org.plan === 'business' ? '£149/mo' : '—',
      };
      try {
        if (daysLeft === 7) { await sendLifecycleForOrg(org, 'trial_ending_7', vars); summary.trial7 += 1; }
        else if (daysLeft === 1) { await sendLifecycleForOrg(org, 'trial_ending_1', vars); summary.trial1 += 1; }
        else if (daysLeft <= 0) { await sendLifecycleForOrg(org, 'trial_expired', vars); summary.trialExpired += 1; }
        else summary.skipped += 1;
      } catch (_trialErr) {
        summary.skipped += 1;
      }
    }

    if (runMonthly) {
      const orgs = await supabaseAdmin.from('organisations')
        .select('id,name,plan,status,billing_email,owner_email')
        .in('status', ['active', 'trial']);
      for (const org of Array.isArray(orgs.data) ? orgs.data : []) {
        try {
          const [propsRes, tenantsRes] = await Promise.all([
            supabaseAdmin.from('properties').select('rooms,occupied,rent,landlord_rent').eq('org_id', org.id),
            supabaseAdmin.from('tenants').select('id,status').eq('org_id', org.id),
          ]);
          const props = Array.isArray(propsRes.data) ? propsRes.data : [];
          const tenants = Array.isArray(tenantsRes.data) ? tenantsRes.data : [];
          const totalRooms = props.reduce((sum, p) => sum + Number(p.rooms || 0), 0);
          const occupiedRooms = props.reduce((sum, p) => sum + Number(p.occupied || 0), 0);
          const grossIncomeNum = props.reduce((sum, p) => sum + Number(p.rent || 0), 0);
          const landlordCostsNum = props.reduce((sum, p) => sum + Number(p.landlord_rent || 0), 0);
          const netNum = grossIncomeNum - landlordCostsNum;
          const occupancy = totalRooms > 0 ? `${Math.round((occupiedRooms / totalRooms) * 100)}%` : '0%';
          await sendLifecycleForOrg(org, 'monthly_portfolio_report', {
            properties: String(props.length),
            tenants: String(tenants.filter((t) => (t.status || 'active') !== 'inactive').length),
            occupancy,
            gross_income: `£${grossIncomeNum.toLocaleString('en-GB')}`,
            landlord_costs: `£${landlordCostsNum.toLocaleString('en-GB')}`,
            net_profit: `£${netNum.toLocaleString('en-GB')}`,
            if_arrears: false,
            if_compliance: false,
            arrears_total: '£0',
            compliance_items: '0',
          });
          summary.monthly += 1;
        } catch (_monthlyErr) {
          summary.skipped += 1;
        }
      }
    }
  } catch (e) {
    console.error('Lifecycle jobs failed:', e);
    return res.status(500).json({ error: 'Lifecycle jobs failed' });
  }

  return res.status(200).json({ ok: true, summary, runMonthly });
});

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  if (!stripeClient) {
    return res.status(503).json({ error: 'Stripe is not configured on server' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const userId = userData.user.id;
  const body = req.body || {};
  const orgId = body.orgId;
  const plan = String(body.plan || '').toLowerCase();
  if (plan === 'free') {
    const { data: mem, error: memErr } = await supabaseAdmin
      .from('org_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    if (memErr || !mem) {
      return res.status(403).json({ error: 'Not a member of this organisation' });
    }
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organisations')
      .select('id')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr || !org) {
      return res.status(404).json({ error: 'Organisation not found' });
    }
    await setOrgFreePlan(orgId);
    return res.status(200).json({ ok: true, plan: 'free' });
  }
  const priceId = stripePriceByPlan[plan];
  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'orgId required' });
  }
  if (!priceId) {
    return res.status(400).json({ error: 'Unsupported plan or missing Stripe price mapping' });
  }

  const { data: mem, error: memErr } = await supabaseAdmin
    .from('org_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memErr || !mem) {
    return res.status(403).json({ error: 'Not a member of this organisation' });
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organisations')
    .select('id,name,owner_email,billing_email,stripe_customer_id')
    .eq('id', orgId)
    .maybeSingle();
  if (orgErr || !org) {
    return res.status(404).json({ error: 'Organisation not found' });
  }

  try {
    let customerId = org.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: org.billing_email || org.owner_email || userData.user.email || undefined,
        name: org.name || undefined,
        metadata: { orgId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('organisations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId);
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Require a card up front so Stripe can charge automatically when trial ends.
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      success_url: `${appBaseUrl}/index.html?stripe=success`,
      cancel_url: `${appBaseUrl}/index.html?stripe=cancelled`,
      metadata: { orgId, plan, userId },
      subscription_data: {
        trial_period_days: 14,
        metadata: { orgId, plan, userId },
      },
      client_reference_id: orgId,
    });
    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('Stripe checkout error:', e);
    res.status(502).json({ error: 'Could not create Stripe checkout session' });
  }
});

app.post('/api/stripe/create-portal-session', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  if (!stripeClient) {
    return res.status(503).json({ error: 'Stripe is not configured on server' });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const orgId = req.body?.orgId;
  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'orgId required' });
  }
  const { data: mem, error: memErr } = await supabaseAdmin
    .from('org_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (memErr || !mem) {
    return res.status(403).json({ error: 'Not a member of this organisation' });
  }
  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organisations')
    .select('stripe_customer_id')
    .eq('id', orgId)
    .maybeSingle();
  if (orgErr || !org) {
    return res.status(404).json({ error: 'Organisation not found' });
  }
  if (!org.stripe_customer_id) {
    return res.status(400).json({ error: 'No Stripe customer found for this organisation' });
  }
  try {
    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appBaseUrl}/index.html`,
    });
    res.status(200).json({ url: portalSession.url });
  } catch (e) {
    console.error('Stripe portal error:', e);
    res.status(502).json({ error: 'Could not create Stripe portal session' });
  }
});

// Configuration injection for the frontend (no secrets)
app.get('/config.js', (req, res) => {
  res.type('.js');
  res.send(`
    window.ENV = {
      SUPA_URL: "${process.env.SUPABASE_URL || ''}",
      SUPA_KEY: "${process.env.SUPABASE_ANON_KEY || ''}",
      WORKER_URL: "${process.env.WORKER_URL || ''}"
    };
  `);
});

app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for any frontend routes that are not API routes
app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`PID ${process.pid} — leave this terminal open; press Ctrl+C to stop.`);
  });
  server.on('error', (err) => {
    console.error('Failed to listen on port', PORT, err.message);
    process.exit(1);
  });
}
