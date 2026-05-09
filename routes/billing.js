module.exports = function createBillingRoutes(ctx) {
  const {
    app, express, supabaseAdmin, stripeClient, stripePriceByPlan, stripePlanByPrice,
    appBaseUrl, stripeLimiter: initialStripeLimiter, isUuidString: initialIsUuidString, sendLifecycleForOrg, formatDate,
  } = ctx;

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


  function registerStripeWebhook() {
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
  
  }

  function registerBillingRoutes() {
  const stripeLimiter = ctx.stripeLimiter || initialStripeLimiter;
  const isUuidString = ctx.isUuidString || initialIsUuidString;
  app.post('/api/stripe/create-checkout-session', stripeLimiter, async (req, res) => {
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
    // H1+H3 FIX: Validate orgId as UUID before any branch
    if (!orgId || !isUuidString(orgId)) {
      return res.status(400).json({ error: 'Valid orgId required' });
    }
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
  
  app.post('/api/stripe/create-portal-session', stripeLimiter, async (req, res) => {
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
    if (!orgId || !isUuidString(orgId)) {
      return res.status(400).json({ error: 'Valid orgId required' });
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
      // Surface a code so the client can offer "Upgrade" instead of just throwing an error toast.
      return res.status(400).json({
        error: 'No active subscription on this organisation yet — start a paid plan to access billing.',
        code: 'NO_STRIPE_CUSTOMER'
      });
    }
    try {
      const portalSession = await stripeClient.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${appBaseUrl}/app`,
      });
      res.status(200).json({ url: portalSession.url });
    } catch (e) {
      console.error('Stripe portal error:', e);
      // "No such customer" → the org row is pointing at a stale cus_* (commonly a TEST-mode
      // ID after switching to LIVE keys, or a customer deleted in Stripe). Clear the bad ID
      // and tell the client to start a fresh checkout instead of leaving the user stuck.
      const msg = (e && e.message) ? String(e.message) : 'unknown';
      if (e && (e.code === 'resource_missing' || /No such customer/i.test(msg))) {
        try {
          await supabaseAdmin
            .from('organisations')
            .update({ stripe_customer_id: null })
            .eq('id', orgId);
        } catch (_e) { /* best-effort cleanup */ }
        return res.status(400).json({
          error: 'Your previous billing record was lost (likely a test/live key switch). Start a fresh subscription to fix this.',
          code: 'NO_STRIPE_CUSTOMER'
        });
      }
      res.status(502).json({ error: 'Could not create Stripe portal session: ' + msg });
    }
  });
  }

  return { registerStripeWebhook, registerBillingRoutes };
};
