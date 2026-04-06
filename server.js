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
  if (subStatus === 'active' || subStatus === 'trialing') return 'active';
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
  return stripePlanByPrice[priceId] || 'starter';
}

async function upsertOrgStripeStateFromSubscription(orgId, subscription) {
  if (!supabaseAdmin || !orgId || !subscription) return;
  await supabaseAdmin
    .from('organisations')
    .update({
      plan: planFromSubscription(subscription),
      status: mapStripeStatusToOrgStatus(subscription.status),
      stripe_subscription_id: subscription.id || null,
      stripe_customer_id: subscription.customer || null,
      mrr: calculateMrrFromSubscription(subscription),
      trial_ends_at: null,
    })
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
      payment_method_collection: 'if_required',
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
