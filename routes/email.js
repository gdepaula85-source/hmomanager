module.exports = function registerEmailRoutes(ctx) {
  const {
    app, supabaseAdmin, emailLimiter, authLifecycleEmailLimiter, crypto, path, fs,
    appBaseUrl, isUuidString, isSuperadminUser, rootDir,
  } = ctx;

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
    .select('id, role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memErr || !mem) {
    return res.status(403).json({ error: 'Not a member of this organisation' });
  }
  const allowedEmailRoles = ['admin', 'manager', 'owner'];
  if (!allowedEmailRoles.includes(String(mem.role || '').toLowerCase())) {
    return res.status(403).json({ error: 'Insufficient permissions to send emails' });
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
    process.env.MAIL_FROM || 'landlordapp.io <noreply@landlordapp.io>';

  // Optional attachments — Resend accepts up to 40MB total. Each item: {filename, content (base64)}.
  let cleanAttachments;
  if (Array.isArray(body.attachments) && body.attachments.length) {
    if (body.attachments.length > 10) return res.status(400).json({ error: 'Max 10 attachments per email' });
    cleanAttachments = [];
    let totalBytes = 0;
    for (const a of body.attachments) {
      if (!a || typeof a !== 'object') continue;
      const filename = String(a.filename || '').trim();
      const content = String(a.content || '').replace(/\s+/g, ''); // strip whitespace from base64
      if (!filename || !content) continue;
      // Rough byte size from base64 length: every 4 chars → 3 bytes.
      totalBytes += Math.floor((content.length * 3) / 4);
      if (totalBytes > 35 * 1024 * 1024) {
        return res.status(400).json({ error: 'Attachments exceed 35MB total' });
      }
      cleanAttachments.push({ filename, content });
    }
  }

  try {
    const payload = {
      from: mailFrom,
      to,
      subject,
      reply_to: replyTo ? [replyTo] : undefined,
      headers: {
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
    };
    if (text) payload.text = text;
    if (html) payload.html = html;
    if (cleanAttachments && cleanAttachments.length) payload.attachments = cleanAttachments;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + resendKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Resend reject:', data);
      return res.status(502).json({ error: (data && (data.message || data.error)) || 'Email delivery failed' });
    }
    res.status(200).json(data);
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

let cachedPublicEmailTemplates = null;

function readPublicEmailTemplatesFile() {
  const filePath = path.join(rootDir, 'public', 'landlordapp_emails.html');
  return fs.readFileSync(filePath, 'utf8');
}

function extractFirstStyleTag(html) {
  const m = String(html || '').match(/<style>([\s\S]*?)<\/style>/i);
  return m ? m[1] : '';
}

function extractEmailWrapByH1(publicHtml, h1Text) {
  const html = String(publicHtml || '');
  const needle = `<h1>${h1Text}</h1>`;
  const h1Idx = html.indexOf(needle);
  if (h1Idx < 0) return null;

  const wrapStart = html.indexOf('<div class="email-wrap">', h1Idx);
  if (wrapStart < 0) return null;

  const nextMarker = html.indexOf('<!-- ═', wrapStart + 1);
  const end = nextMarker >= 0 ? nextMarker : html.indexOf('</body>', wrapStart + 1);
  if (end < 0) return null;

  const chunk = html.slice(wrapStart, end).trim();
  return chunk || null;
}

function loadPublicEmailTemplatesOnce() {
  if (cachedPublicEmailTemplates) return cachedPublicEmailTemplates;
  try {
    const publicHtml = readPublicEmailTemplatesFile();
    const styleCss = extractFirstStyleTag(publicHtml);
    cachedPublicEmailTemplates = { publicHtml, styleCss };
    return cachedPublicEmailTemplates;
  } catch (e) {
    console.warn('Could not read public/landlordapp_emails.html; using fallback email HTML. Error:', e && e.message ? e.message : e);
    cachedPublicEmailTemplates = { publicHtml: '', styleCss: '' };
    return cachedPublicEmailTemplates;
  }
}

function buildEmailHtmlFromPublicTemplate(h1Text, subjectForTitle) {
  const { publicHtml, styleCss } = loadPublicEmailTemplatesOnce();
  const wrap = extractEmailWrapByH1(publicHtml, h1Text);
  if (!wrap) return null;
  const safeTitle = String(subjectForTitle || '').replace(/</g, '').replace(/>/g, '').slice(0, 200) || 'LandlordApp.io';
  const baseStyles =
    styleCss ||
    // minimal fallback so emails render acceptably even if the public file is unreadable
    '.em{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#F8F9FB}.em-body{background:#fff;padding:36px}';
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    safeTitle +
    '</title><style>' +
    baseStyles +
    '</style></head><body style="margin:0;background:#F8F9FB">' +
    wrap +
    '</body></html>'
  );
}

function authLifecycleTemplatePayload(templateId) {
  const id = String(templateId || '').toLowerCase();

  if (id === 'welcome_signup') {
    return {
      subject: 'Welcome to LandlordApp.io',
      text: 'Hi {{first_name}},\n\nWelcome to LandlordApp.io.\nYour selected plan: {{plan_name}}\nTrial end date: {{trial_end_date}}\n\nYou can now sign in and finish setting up your workspace.',
      html: buildEmailHtmlFromPublicTemplate('Welcome / Sign Up', 'Welcome to LandlordApp.io') || '',
    };
  }
  if (id === 'email_verification') {
    return {
      subject: 'Verify your LandlordApp email',
      text: 'Hi {{first_name}},\n\nPlease verify your email to activate your account:\n{{verify_url}}\n\nIf you did not sign up, ignore this email.',
      html: buildEmailHtmlFromPublicTemplate('Email Verification', 'Verify your LandlordApp email') || '',
    };
  }
  if (id === 'password_reset') {
    return {
      subject: 'Reset your LandlordApp password',
      text: 'Hi {{first_name}},\n\nReset your password using this secure link:\n{{reset_url}}\n\nIf you did not request this, you can ignore this email.',
      html: buildEmailHtmlFromPublicTemplate('Password Reset', 'Reset your LandlordApp password') || '',
    };
  }
  if (id === 'trial_ending_7') {
    return {
      subject: 'Your trial ends in 7 days',
      text: 'Hi {{first_name}},\n\nYour trial ends on {{trial_end_date}}.\nUpgrade now to avoid interruptions.\nPlan: {{plan_name}} ({{plan_price}})',
      html: buildEmailHtmlFromPublicTemplate('Trial Ending — 7 Days Left', 'Your trial ends in 7 days') || '',
    };
  }
  if (id === 'trial_ending_1') {
    return {
      subject: 'Your trial ends tomorrow',
      text: 'Hi {{first_name}},\n\nYour trial ends on {{trial_end_date}} (tomorrow). Add billing now to keep access uninterrupted.',
      html: buildEmailHtmlFromPublicTemplate('Trial Ending — 1 Day Left', 'Your trial ends tomorrow') || '',
    };
  }
  if (id === 'trial_expired') {
    return {
      subject: 'Your trial has ended',
      text: 'Hi {{first_name}},\n\nYour trial ended on {{trial_end_date}}.\nYour data is retained until {{data_expiry_date}}. Upgrade anytime to restore full access.',
      html: buildEmailHtmlFromPublicTemplate('Trial Expired', 'Your trial has ended') || '',
    };
  }
  if (id === 'subscription_confirmed') {
    return {
      subject: 'Subscription confirmed',
      text: 'Hi {{first_name}},\n\nYour subscription is active.\nPlan: {{plan_name}} ({{plan_price}})\nNext billing date: {{next_billing_date}}',
      html: buildEmailHtmlFromPublicTemplate('Subscription Confirmed', 'Subscription confirmed') || '',
    };
  }
  if (id === 'payment_failed') {
    return {
      subject: 'Payment failed — update your card',
      text: 'Hi {{first_name}},\n\nWe could not process your latest payment for {{plan_name}}.\nPlease update your billing method to avoid interruption.',
      html: buildEmailHtmlFromPublicTemplate('Payment Failed', 'Payment failed — update your card') || '',
    };
  }
  if (id === 'payment_successful') {
    return {
      subject: 'Payment successful',
      text: 'Hi {{first_name}},\n\nYour payment was received successfully.\nPlan: {{plan_name}} ({{plan_price}})\nAmount paid: {{payment_amount}}\nPayment date: {{payment_date}}',
      // Template in public file is shared with subscription confirmation.
      html: buildEmailHtmlFromPublicTemplate('Subscription Confirmed', 'Payment successful') || '',
    };
  }
  if (id === 'monthly_portfolio_report') {
    return {
      subject: 'Monthly portfolio report',
      text: 'Hi {{first_name}},\n\nProperties: {{properties}}\nTenants: {{tenants}}\nOccupancy: {{occupancy}}\nGross income: {{gross_income}}\nLandlord costs: {{landlord_costs}}\nNet profit: {{net_profit}}\n{{#if_arrears}}Arrears: {{arrears_total}}\n{{/if_arrears}}{{#if_compliance}}Expiring certificates: {{compliance_items}}\n{{/if_compliance}}',
      html: buildEmailHtmlFromPublicTemplate('Monthly Portfolio Report', 'Monthly portfolio report') || '',
    };
  }

  // ── Activation drip sequence ──────────────────────────────────────────────
  // Sent by /api/email/run-lifecycle-jobs daily. Each templates targets a
  // specific moment in the trial-to-activation funnel.

  if (id === 'activation_day_2') {
    // Sent ~2 days after signup IF the org still has 0 properties. Goal:
    // unblock the friction that's keeping them from the "first property"
    // milestone. Mentions a setup call to lift conversion ~3-5x.
    return {
      subject: 'Stuck? The 3 things every landlord sets up first',
      text: 'Hi {{first_name}},\n\nNoticed you haven\'t added a property yet — completely fine, day 2 is when most people pause and look around.\n\nThe quickest way to get value:\n\n1. Add one property (just a name + room count is enough to start)\n2. Add one tenant linked to that property\n3. Mark their first rent received\n\nThat\'s it — at that point the dashboard, rent tracker, and landlord-payment scheduler all start populating with real data.\n\nIf you\'d rather walk through it together, book a free 15-min setup call: https://landlordapp.io/book-setup\n\nOr just reply to this email with what\'s blocking you and I\'ll help directly.\n\n— The LandlordApp team',
      html:
        '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827">'
        + '<h1 style="font-size:22px;margin:0 0 16px;color:#0B1120">Stuck? The 3 things every landlord sets up first</h1>'
        + '<p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#374151">Hi {{first_name}},</p>'
        + '<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#374151">Noticed you haven\'t added a property yet — completely fine, day 2 is when most people pause and look around. Here\'s the fastest path to first value:</p>'
        + '<ol style="font-size:14px;line-height:1.7;color:#374151;padding-left:20px;margin:0 0 24px">'
        + '<li><strong>Add one property</strong> — just a name + room count is enough to start</li>'
        + '<li><strong>Add one tenant</strong> linked to that property</li>'
        + '<li><strong>Mark their first rent received</strong></li>'
        + '</ol>'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 24px;color:#374151">At that point the dashboard, rent tracker, and landlord-payment scheduler all start populating with real numbers.</p>'
        + '<div style="text-align:center;margin:0 0 24px">'
        + '<a href="https://landlordapp.io/app" style="display:inline-block;padding:11px 22px;background:#00B894;color:#fff;text-decoration:none;border-radius:9px;font-size:14px;font-weight:700;margin-right:8px">Add my first property →</a>'
        + '</div>'
        + '<p style="font-size:13px;line-height:1.55;margin:0 0 8px;color:#6B7280">Rather have a hand?</p>'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 18px;color:#374151"><a href="https://landlordapp.io/book-setup" style="color:#00B894;font-weight:600">Book a free 15-min setup call</a> — or just reply to this email with what\'s blocking you.</p>'
        + '<p style="font-size:12px;color:#6B7280;margin:0">— The LandlordApp team</p>'
        + '</div>',
    };
  }
  if (id === 'activation_day_5') {
    // Sent ~5 days after signup, regardless of activity. Social proof + a
    // tangible "what you save" anchor. Story-led, not feature-listed.
    return {
      subject: 'How a 12-room HMO saves 6 hours a week with LandlordApp',
      text: 'Hi {{first_name}},\n\nQuick story from one of our operators in Manchester (12 rooms across 3 HMOs):\n\nBefore: a Sunday-night ritual — open Excel, cross-reference 12 bank statements, message tenants who hadn\'t paid, copy compliance dates into a calendar.\n\nAfter, with LandlordApp:\n - Rent reconciliation: one tap per payment instead of a spreadsheet\n - Tenant chases: WhatsApp links generated for late-payers in one click\n - Compliance: gas + EICR expiries flagged 30/14/7 days out automatically\n - Landlord payments: monthly schedule auto-generated, mark-as-paid in one tap\n\nTotal time saved: about 6 hours per week.\n\nYou\'re 9 days from this being your setup too. The dashboard you\'ve already got is the same one that runs that 12-room portfolio.\n\nLog in and add your first property: https://landlordapp.io/app\n\n— The LandlordApp team',
      html:
        '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827">'
        + '<h1 style="font-size:22px;margin:0 0 16px;color:#0B1120">How a 12-room HMO saves 6 hours a week</h1>'
        + '<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#374151">Hi {{first_name}},</p>'
        + '<p style="font-size:15px;line-height:1.55;margin:0 0 14px;color:#374151">Quick story from one of our operators in Manchester (12 rooms across 3 HMOs):</p>'
        + '<div style="background:#F9FAFB;border-left:3px solid #00B894;padding:16px 18px;margin:0 0 20px;border-radius:6px">'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 12px;color:#374151"><strong>Before:</strong> Sunday-night ritual. Excel open, cross-referencing 12 bank statements, messaging tenants who hadn\'t paid, copy-pasting compliance dates into a calendar.</p>'
        + '<p style="font-size:14px;line-height:1.55;margin:0;color:#374151"><strong>After (LandlordApp):</strong></p>'
        + '<ul style="font-size:13px;line-height:1.7;color:#374151;padding-left:20px;margin:8px 0 0">'
        + '<li>Rent reconciliation — one tap per payment instead of a spreadsheet</li>'
        + '<li>Tenant chases — WhatsApp links generated for late-payers in one click</li>'
        + '<li>Compliance — gas + EICR expiries flagged 30/14/7 days out</li>'
        + '<li>Landlord payments — monthly schedule auto-generated, mark-as-paid one tap</li>'
        + '</ul>'
        + '</div>'
        + '<p style="font-size:15px;line-height:1.55;margin:0 0 22px;color:#374151"><strong>Total time saved:</strong> about 6 hours per week.</p>'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 22px;color:#374151">You\'re 9 days from this being your setup too — the dashboard you have is the same one that runs that 12-room portfolio.</p>'
        + '<div style="text-align:center;margin:0 0 16px">'
        + '<a href="https://landlordapp.io/app" style="display:inline-block;padding:11px 22px;background:#00B894;color:#fff;text-decoration:none;border-radius:9px;font-size:14px;font-weight:700">Open my dashboard →</a>'
        + '</div>'
        + '<p style="font-size:12px;color:#6B7280;margin:24px 0 0">— The LandlordApp team</p>'
        + '</div>',
    };
  }
  if (id === 'activation_day_10') {
    // Sent ~10 days in. Two flavours depending on activity:
    //   - has_data: loss-aversion ("here\'s what you\'ve built — don\'t lose it")
    //   - no_data:  blocker survey ("what\'s stopping you?")
    // The cron picks the right vars before sending. We render both in one
    // template using {{#if_has_data}}/{{#if_no_data}} blocks; the placeholder
    // engine is mustache-style elsewhere in this file.
    return {
      subject: 'A check-in from LandlordApp',
      text: 'Hi {{first_name}},\n\n{{#if_has_data}}Quick recap of what you\'ve built so far:\n - Properties: {{property_count}}\n - Tenants: {{tenant_count}}\n - Documents uploaded: {{doc_count}}\n\nYour trial has 4 days left. After that the data stays for 30 days but features get capped.\n\nIf this is helping, the upgrade flow is in Settings → Billing.\n\nIf it\'s NOT helping, I\'d genuinely like to know why — just reply.\n\n{{/if_has_data}}{{#if_no_data}}I noticed you haven\'t added a property yet, and your trial has 4 days left.\n\nI\'m not going to push you to upgrade — but I\'d genuinely like to know what stopped you. One-click reply with whichever fits:\n\n a) Too complicated\n b) Not the right tool for me\n c) No time right now\n d) Something else (tell me)\n\nI read every reply.\n\n{{/if_no_data}}— The LandlordApp team',
      html:
        '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827">'
        + '<p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#374151">Hi {{first_name}},</p>'
        + '{{#if_has_data}}'
        + '<h1 style="font-size:20px;margin:0 0 14px;color:#0B1120">Quick recap of what you\'ve built</h1>'
        + '<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px 18px;margin:0 0 20px">'
        + '<div style="font-size:14px;color:#065F46;line-height:1.7"><strong>Properties:</strong> {{property_count}}<br><strong>Tenants:</strong> {{tenant_count}}<br><strong>Documents uploaded:</strong> {{doc_count}}</div>'
        + '</div>'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 16px;color:#374151">Your trial has 4 days left. After that the data stays for 30 days but features get capped — particularly bulk WhatsApp, expiry alerts, and the deal analyser.</p>'
        + '<div style="text-align:center;margin:0 0 18px"><a href="https://landlordapp.io/choose-plan.html" style="display:inline-block;padding:11px 22px;background:#00B894;color:#fff;text-decoration:none;border-radius:9px;font-size:14px;font-weight:700">Pick a plan →</a></div>'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 16px;color:#374151">If this is NOT helping, I\'d genuinely like to know why — just reply.</p>'
        + '{{/if_has_data}}'
        + '{{#if_no_data}}'
        + '<h1 style="font-size:20px;margin:0 0 14px;color:#0B1120">What stopped you?</h1>'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 16px;color:#374151">I noticed you haven\'t added a property yet, and your trial has 4 days left.</p>'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 16px;color:#374151">I\'m not going to push you to upgrade — but I\'d genuinely like to know what stopped you. One-click reply with whichever fits:</p>'
        + '<ul style="font-size:14px;line-height:1.8;color:#374151;padding-left:20px;margin:0 0 18px">'
        + '<li>(a) Too complicated</li>'
        + '<li>(b) Not the right tool for me</li>'
        + '<li>(c) No time right now</li>'
        + '<li>(d) Something else — tell me</li>'
        + '</ul>'
        + '<p style="font-size:14px;line-height:1.55;margin:0 0 18px;color:#374151">I read every reply, no canned bot responses. — Gleydson</p>'
        + '{{/if_no_data}}'
        + '<p style="font-size:12px;color:#6B7280;margin:24px 0 0">— The LandlordApp team</p>'
        + '</div>',
    };
  }
  if (id === 'activation_day_17_winback') {
    // Sent ~17 days in (3 days post-trial-end) IF status is now expired/cancelled.
    // Plain-text styling, single question. The marketer\'s rule: this email
    // should look personal-from-Gleydson, not from a marketing system.
    return {
      subject: 'Did we miss the mark?',
      text: 'Hi {{first_name}},\n\nNoticed your LandlordApp trial wrapped up a few days ago.\n\nNo upsell here — I\'m just curious what stopped you. Reply with a sentence or two and you\'d be doing me a real favour. We use this kind of feedback to fix the funnel.\n\nIf you ever want to come back, your data\'s still here for another 27 days.\n\n— Gleydson, LandlordApp',
      html:
        '<div style="font-family:Georgia,Cambria,Times New Roman,serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1F2937;font-size:15px;line-height:1.6">'
        + '<p style="margin:0 0 16px">Hi {{first_name}},</p>'
        + '<p style="margin:0 0 16px">Noticed your LandlordApp trial wrapped up a few days ago.</p>'
        + '<p style="margin:0 0 16px">No upsell here — I\'m just curious what stopped you. Reply with a sentence or two and you\'d be doing me a real favour. We use this kind of feedback to fix the funnel.</p>'
        + '<p style="margin:0 0 16px">If you ever want to come back, your data\'s still here for another 27 days.</p>'
        + '<p style="margin:24px 0 0">— Gleydson, LandlordApp</p>'
        + '</div>',
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
  // C1 FIX: Require CRON secret OR valid JWT to prevent unauthenticated email sending
  const cronSecret = process.env.LIFECYCLE_EMAIL_CRON_SECRET || '';
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim();
  let authedViaCron = false;
  if (cronSecret && headerSecret) {
    const a = Buffer.from(headerSecret);
    const b = Buffer.from(cronSecret);
    authedViaCron = a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (!authedViaCron) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const body = req.body || {};
  const templateId = String(body.templateId || '').toLowerCase().trim();
  const to = String(body.to || '').trim().toLowerCase();
  const vars = body.vars && typeof body.vars === 'object' ? body.vars : {};

  const ALLOWED_TEMPLATES = new Set([
    'email_verification', 'password_reset', 'welcome_signup',
    'trial_ending_7', 'trial_ending_1', 'trial_expired',
    'subscription_confirmed', 'payment_failed', 'payment_successful',
    'monthly_portfolio_report',
    // Activation drip — fired by /api/email/run-lifecycle-jobs
    'activation_day_2', 'activation_day_5', 'activation_day_10',
    'activation_day_17_winback',
  ]);
  if (!ALLOWED_TEMPLATES.has(templateId)) {
    return res.status(400).json({ error: 'Unknown template: ' + templateId });
  }

  if (!to || !to.includes('@')) return res.status(400).json({ error: 'Valid to email is required' });

  try {
    const out = await sendAuthLifecycleEmail(to, templateId, vars);
    return res.status(200).json(out);
  } catch (e) {
    console.error('Auth lifecycle email send failed:', e);
    return res.status(502).json({ error: 'Email send failed' });
  }
});

app.post('/api/auth/request-password-reset', authLifecycleEmailLimiter, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  const email = String(req.body && req.body.email || '').trim().toLowerCase();
  // C2 FIX: Validate redirectTo against allowed origins to prevent open redirect
  let redirectTo = process.env.WORKER_URL || `${appBaseUrl}/index.html`;
  const rawRedirect = String(req.body && req.body.redirectTo || '').trim();
  if (rawRedirect) {
    try {
      const parsed = new URL(rawRedirect);
      const allowedOrigins = [new URL(appBaseUrl).origin];
      if (process.env.WORKER_URL) allowedOrigins.push(new URL(process.env.WORKER_URL).origin);
      if (allowedOrigins.includes(parsed.origin)) redirectTo = rawRedirect;
    } catch (_) { /* invalid URL, use default */ }
  }
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

// ── Superadmin: look up auth user_id by email ───────────────────────────────
app.post('/api/superadmin/lookup-user-by-email', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  const authHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader);
    if (authErr || !caller) return res.status(401).json({ error: 'Invalid session' });

    if (!(await isSuperadminUser(caller))) {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
  } catch (e) {
    console.error('Auth check failed:', e);
    return res.status(500).json({ error: 'Auth check failed' });
  }

  const email = String(req.body && req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    // H2 FIX: Paginate through all users instead of only fetching first 1000
    let found = null;
    let page = 1;
    while (!found) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return res.status(500).json({ error: 'User lookup failed' });
      found = (users || []).find(u => (u.email || '').toLowerCase() === email);
      if (found) break;
      if (!users || users.length < 1000) break;
      page++;
    }
    if (!found) return res.status(404).json({ error: 'No auth user found with that email' });
    return res.status(200).json({ user_id: found.id, email: found.email });
  } catch (e) {
    console.error('User lookup failed:', e);
    return res.status(500).json({ error: 'User lookup failed' });
  }
});

// ── Superadmin: directly set a user's password ──────────────────────────────
app.post('/api/superadmin/set-user-password', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  // Verify caller is authenticated
  const authHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  // Verify caller is a superadmin by checking the JWT against superadmin_allowlist
  try {
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader);
    if (authErr || !caller) return res.status(401).json({ error: 'Invalid session' });

    if (!(await isSuperadminUser(caller))) {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
  } catch (e) {
    console.error('Auth check failed:', e);
    return res.status(500).json({ error: 'Auth check failed' });
  }

  const userId = String(req.body && req.body.user_id || '').trim();
  const password = String(req.body && req.body.password || '');
  if (!userId) return res.status(400).json({ error: 'user_id is required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUser(userId, { password });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/email/run-lifecycle-jobs', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase service role not configured on server' });
  }
  const cronSecret = process.env.LIFECYCLE_EMAIL_CRON_SECRET || '';
  if (!cronSecret) return res.status(503).json({ error: 'Lifecycle cron secret not configured' });
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim()
    || String((req.headers.authorization || '').replace(/^Bearer\s+/i, '')).trim();
  // H5 FIX: Use timing-safe comparison for secrets
  const secretA = Buffer.from(headerSecret);
  const secretB = Buffer.from(cronSecret);
  if (secretA.length !== secretB.length || !crypto.timingSafeEqual(secretA, secretB)) {
    return res.status(401).json({ error: 'Unauthorized lifecycle job invocation' });
  }

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
        plan_price: org.plan === 'starter' ? '£49/mo' : org.plan === 'professional' ? '£89/mo' : org.plan === 'business' ? '£149/mo' : org.plan === 'enterprise' ? '£299/mo' : '—',
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
      const monthlyKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const orgs = await supabaseAdmin.from('organisations')
        .select('id,name,plan,status,billing_email,owner_email,email_settings')
        .in('status', ['active', 'trial']);
      for (const org of Array.isArray(orgs.data) ? orgs.data : []) {
        try {
          const emailSettings = org.email_settings && typeof org.email_settings === 'object' ? org.email_settings : {};
          const triggers = emailSettings.triggers && typeof emailSettings.triggers === 'object' ? emailSettings.triggers : {};
          if (!triggers.monthly_report) { summary.skipped += 1; continue; }
          const sentMonthly = await supabaseAdmin.from('email_log')
            .select('id')
            .eq('org_id', org.id)
            .eq('template_id', 'monthly_portfolio_report')
            .eq('metadata->>month', monthlyKey)
            .limit(1);
          if (Array.isArray(sentMonthly.data) && sentMonthly.data.length > 0) { summary.skipped += 1; continue; }
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
          const occupancy = totalRooms > 0
            ? `${Math.min(100, Math.max(0, Math.round((occupiedRooms / totalRooms) * 100)))}%`
            : '0%';
          const monthlyRecipient = String(emailSettings.managerEmail || org.billing_email || org.owner_email || '').trim();
          await sendLifecycleForOrg(Object.assign({}, org, { billing_email: monthlyRecipient || org.billing_email }), 'monthly_portfolio_report', {
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
          await supabaseAdmin.from('email_log').insert({
            org_id: org.id,
            recipient_email: monthlyRecipient,
            template_id: 'monthly_portfolio_report',
            status: 'sent',
            metadata: { month: monthlyKey },
          }).catch((e) => console.warn('monthly report email_log insert failed (non-fatal):', e && e.message));
          summary.monthly += 1;
        } catch (_monthlyErr) {
          summary.skipped += 1;
        }
      }
    }

    // ── Activation drip: Day-2 / Day-5 / Day-10 / Day-17 ──────────────────
    // Marketing playbook: get trials to the "first property" milestone before
    // their motivation evaporates. Cron runs daily; for each org we compute
    // days-since-signup and fire the matching template if it hasn't been sent
    // yet (dedup'd via email_log).
    summary.act2 = 0;
    summary.act5 = 0;
    summary.act10 = 0;
    summary.act17 = 0;
    const ACTIVATION_RULES = [
      { days: 2,  templateId: 'activation_day_2',           summaryKey: 'act2',  // Only if 0 properties — friction-buster
        condition: (ctx) => ctx.propertyCount === 0 },
      { days: 5,  templateId: 'activation_day_5',           summaryKey: 'act5',  // Always fire — social proof
        condition: () => true },
      { days: 10, templateId: 'activation_day_10',          summaryKey: 'act10', // Always fire — variants picked at send time
        condition: () => true },
      { days: 17, templateId: 'activation_day_17_winback',  summaryKey: 'act17', // Only if trial expired (not converted)
        condition: (ctx) => ctx.status !== 'active' && ctx.status !== 'trial' },
    ];
    for (const rule of ACTIVATION_RULES) {
      const windowStart = addDays(now, -(rule.days + 1)).toISOString();
      const windowEnd   = addDays(now, -rule.days).toISOString();
      const candidates = await supabaseAdmin.from('organisations')
        .select('id,name,plan,status,trial_ends_at,billing_email,owner_email,created_at')
        .gte('created_at', windowStart)
        .lt('created_at', windowEnd);
      for (const org of Array.isArray(candidates.data) ? candidates.data : []) {
        try {
          // Stats inform both `condition` and the template vars (esp. day-10
          // which has has_data / no_data variants).
          const [propsRes, tenantsRes, docsRes, sentRes] = await Promise.all([
            supabaseAdmin.from('properties').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
            supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
            supabaseAdmin.from('property_docs').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
            // Dedup: have we already sent this template to this org?
            supabaseAdmin.from('email_log').select('id').eq('org_id', org.id).eq('template_id', rule.templateId).limit(1),
          ]);
          const ctx = {
            propertyCount: Number(propsRes.count || 0),
            tenantCount:   Number(tenantsRes.count || 0),
            docCount:      Number(docsRes.count || 0),
            status: String(org.status || ''),
          };
          if (Array.isArray(sentRes.data) && sentRes.data.length > 0) { summary.skipped += 1; continue; }
          if (!rule.condition(ctx)) { summary.skipped += 1; continue; }

          const hasData = ctx.propertyCount > 0 || ctx.tenantCount > 0 || ctx.docCount > 0;
          const vars = {
            property_count: String(ctx.propertyCount),
            tenant_count:   String(ctx.tenantCount),
            doc_count:      String(ctx.docCount),
            // Day-10 variant flags (mustache-style {{#if_has_data}} blocks)
            if_has_data: hasData,
            if_no_data:  !hasData,
          };
          const sendResult = await sendLifecycleForOrg(org, rule.templateId, vars);
          if (sendResult && !sendResult.skipped) {
            summary[rule.summaryKey] = (summary[rule.summaryKey] || 0) + 1;
            // Log so the next cron run dedup-skips this org.
            await supabaseAdmin.from('email_log').insert({
              org_id: org.id,
              recipient_email: org.billing_email || org.owner_email || '',
              template_id: rule.templateId,
              status: 'sent',
              metadata: { day: rule.days, has_data: hasData },
            }).catch((e) => console.warn('email_log insert failed (non-fatal):', e && e.message));
          } else {
            summary.skipped += 1;
          }
        } catch (_actErr) {
          console.warn('Activation send error for org', org.id, ':', _actErr && _actErr.message);
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

// ── Tenant Email Module ───────────────────────────────────────────────────────

// Helper: check if email was already sent today for this tenant + template + due date
async function wasEmailAlreadySent(orgId, tenantId, templateId, dueDate) {
  if (!supabaseAdmin) return false;
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const q = supabaseAdmin.from('email_log')
    .select('id')
    .eq('org_id', orgId)
    .eq('template_id', templateId)
    .gte('created_at', todayStart.toISOString());
  if (tenantId) q.eq('tenant_id', tenantId);
  if (dueDate) q.eq('metadata->>due_date', dueDate);
  const { data } = await q.limit(1);
  return data && data.length > 0;
}

// Helper: log a sent email
async function logEmail(orgId, tenantId, recipientEmail, templateId, subject, status, metadata) {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('email_log').insert({
      org_id: orgId,
      tenant_id: tenantId || null,
      recipient_email: recipientEmail,
      template_id: templateId,
      subject: subject || '',
      status: status || 'sent',
      metadata: metadata || {}
    });
  } catch (e) {
    console.warn('Failed to log email:', e.message);
  }
}

// Tenant rent reminder CRON endpoint (also callable manually by authenticated org admin)
app.post('/api/email/tenant-reminders', emailLimiter, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email not configured' });

  const cronSecret = process.env.LIFECYCLE_EMAIL_CRON_SECRET || '';
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim();
  let authedViaCron = false;
  let callerOrgId = null;

  if (cronSecret && headerSecret) {
    const a = Buffer.from(headerSecret);
    const b = Buffer.from(cronSecret);
    authedViaCron = a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  if (!authedViaCron) {
    // Manual trigger: require JWT + org membership
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });
    const body = req.body || {};
    callerOrgId = body.orgId;
    if (!callerOrgId || !isUuidString(callerOrgId)) return res.status(400).json({ error: 'orgId required' });
    const { data: mem } = await supabaseAdmin.from('org_members').select('id,role').eq('org_id', callerOrgId).eq('user_id', userData.user.id).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'Not a member of this organisation' });
  }

  const dryRun = !!(req.body && req.body.dryRun);
  const summary = { sent: 0, skipped: 0, errors: 0, log: [] };

  try {
    // Get orgs to process
    let orgs;
    if (callerOrgId) {
      const { data } = await supabaseAdmin.from('organisations')
        .select('id,name,billing_email,owner_email').eq('id', callerOrgId);
      orgs = data || [];
    } else {
      const { data } = await supabaseAdmin.from('organisations')
        .select('id,name,billing_email,owner_email').in('status', ['active', 'trial']);
      orgs = data || [];
    }

    const today = new Date(); today.setHours(0,0,0,0);
    const REMINDER_MAP = {
      3: 'rent_reminder_3day',
      0: 'rent_reminder_day',
      '-3': 'rent_overdue_3day',
      '-7': 'rent_overdue_week'
    };

    for (const org of orgs) {
      // Get org email config
      const { data: orgFull } = await supabaseAdmin.from('organisations').select('app_config').eq('id', org.id).maybeSingle();
      const emailCfg = orgFull?.app_config?.config?.email || {};
      const triggers = emailCfg.triggers || {};

      // Get active tenants with emails
      const { data: tenants } = await supabaseAdmin.from('tenants')
        .select('id,name,email,property,room,rent,freq,pay_day,pay_day_of_month,status')
        .eq('org_id', org.id)
        .in('status', ['active', 'notice_given']);

      if (!tenants || tenants.length === 0) continue;

      for (const t of tenants) {
        if (!t.email || !t.email.includes('@')) continue;

        // Calculate next due date based on frequency and pay day
        const dueDate = calculateNextDueDate(t, today);
        if (!dueDate) continue;

        const daysDiff = Math.round((dueDate - today) / 86400000);
        const templateId = REMINDER_MAP[String(daysDiff)];
        if (!templateId || !triggers[templateId]) continue;

        // Dedup check
        const dueDateStr = dueDate.toISOString().split('T')[0];
        const alreadySent = await wasEmailAlreadySent(org.id, t.id, templateId, dueDateStr);
        if (alreadySent) { summary.skipped++; continue; }

        const firstName = (t.name || 'there').trim().split(/\s+/)[0] || 'there';
        const subject = templateId.includes('overdue')
          ? `Rent Payment Overdue - ${t.property || 'Your Property'}`
          : `Rent Payment Reminder - ${t.property || 'Your Property'}`;

        summary.log.push({ tenant: t.name, email: t.email, template: templateId, dueDate: dueDateStr });

        if (!dryRun) {
          try {
            const mailFrom = process.env.MAIL_FROM || 'LandlordApp <noreply@landlordapp.io>';
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: mailFrom,
                to: [t.email],
                subject,
                html: buildRentReminderHtml(templateId, t, org, dueDate),
                reply_to: org.billing_email || org.owner_email || undefined
              })
            });
            await logEmail(org.id, t.id, t.email, templateId, subject, 'sent', { due_date: dueDateStr, property: t.property });
            summary.sent++;
          } catch (emailErr) {
            await logEmail(org.id, t.id, t.email, templateId, subject, 'failed', { due_date: dueDateStr, error: emailErr.message });
            summary.errors++;
          }
        } else {
          summary.sent++;
        }
      }
    }
    return res.status(200).json({ ok: true, dryRun, summary });
  } catch (e) {
    console.error('Tenant reminders failed:', e);
    return res.status(500).json({ error: 'Tenant reminders failed' });
  }
});

// Calculate next due date for a tenant
function calculateNextDueDate(t, today) {
  if (t.freq === 'monthly' && t.pay_day_of_month) {
    const dom = parseInt(t.pay_day_of_month, 10);
    if (isNaN(dom)) return null;
    let d = new Date(today.getFullYear(), today.getMonth(), dom);
    // If day already passed this month, check next month too
    if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate() - 8)) {
      d = new Date(today.getFullYear(), today.getMonth() + 1, dom);
    }
    return d;
  }
  if (t.freq === 'weekly' && t.pay_day) {
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const targetDay = DAYS.indexOf(t.pay_day);
    if (targetDay === -1) return null;
    const todayDay = today.getDay();
    let diff = targetDay - todayDay;
    if (diff < -3) diff += 7; // look ahead to next week if more than 3 days past
    const d = new Date(today);
    d.setDate(d.getDate() + diff);
    return d;
  }
  return null;
}

// Build rent reminder HTML email
function buildRentReminderHtml(templateId, tenant, org, dueDate) {
  const isOverdue = templateId.includes('overdue');
  const accentColor = isOverdue ? '#E8375A' : (templateId === 'rent_reminder_day' ? '#F59E0B' : '#00B894');
  const statusText = isOverdue ? 'OVERDUE' : (templateId === 'rent_reminder_day' ? 'DUE TODAY' : 'UPCOMING');
  const firstName = (tenant.name || 'there').trim().split(/\s+/)[0] || 'there';
  const rentAmount = '£' + (Math.round(Number(tenant.rent) || 0)).toLocaleString('en-GB');
  const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const companyName = org.name || 'Your Property Manager';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border-radius:12px;border:1px solid #e8ecf0;overflow:hidden">
    <div style="height:4px;background:${accentColor}"></div>
    <div style="padding:28px 24px">
      <div style="display:inline-block;padding:4px 12px;border-radius:6px;background:${accentColor}15;color:${accentColor};font-size:11px;font-weight:700;letter-spacing:.05em;margin-bottom:16px">${statusText}</div>
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a">Hi ${firstName},</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.5">
        ${isOverdue
          ? 'Your rent payment is now overdue. Please arrange payment as soon as possible to avoid any further action.'
          : templateId === 'rent_reminder_day'
            ? 'Your rent payment is due today. Please ensure your payment is made.'
            : 'This is a friendly reminder that your rent payment is coming up soon.'}
      </p>
      <div style="background:#f8f9fb;border-radius:10px;padding:16px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;font-size:12px;color:#64748b">Amount</td><td style="padding:6px 0;font-size:14px;font-weight:700;color:#0f172a;text-align:right">${rentAmount}</td></tr>
          <tr><td style="padding:6px 0;font-size:12px;color:#64748b">Due Date</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:${accentColor};text-align:right">${dueDateStr}</td></tr>
          <tr><td style="padding:6px 0;font-size:12px;color:#64748b">Property</td><td style="padding:6px 0;font-size:13px;color:#0f172a;text-align:right">${tenant.property || '—'}</td></tr>
          ${tenant.room ? `<tr><td style="padding:6px 0;font-size:12px;color:#64748b">Room</td><td style="padding:6px 0;font-size:13px;color:#0f172a;text-align:right">${tenant.room}</td></tr>` : ''}
        </table>
      </div>
      <p style="margin:0;font-size:13px;color:#64748b">If you have already made this payment, please disregard this email. For any queries, please contact your property manager.</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e8ecf0;background:#f8f9fb">
      <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center">${companyName} &middot; Sent via LandlordApp</p>
    </div>
  </div>
</div></body></html>`;
}

// Send ad-hoc email to a specific tenant
app.post('/api/email/send-to-tenant', emailLimiter, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email not configured' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

  const body = req.body || {};
  const { orgId, tenantId, templateId, to, subject, html, vars } = body;
  if (!orgId || !isUuidString(orgId)) return res.status(400).json({ error: 'orgId required' });
  if (!to || !to.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  if (!subject) return res.status(400).json({ error: 'Subject required' });

  const { data: mem } = await supabaseAdmin.from('org_members').select('id, role').eq('org_id', orgId).eq('user_id', userData.user.id).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'Not a member of this organisation' });
  if (!['admin', 'manager', 'owner'].includes(String(mem.role || '').toLowerCase())) {
    return res.status(403).json({ error: 'Insufficient permissions to send emails' });
  }

  try {
    const { data: org } = await supabaseAdmin.from('organisations').select('name,billing_email,owner_email').eq('id', orgId).maybeSingle();
    const mailFrom = process.env.MAIL_FROM || 'landlordapp.io <noreply@landlordapp.io>';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: mailFrom,
        to: [to],
        subject,
        html: html || `<p>${subject}</p>`,
        reply_to: org?.billing_email || org?.owner_email || undefined
      })
    });

    await logEmail(orgId, tenantId || null, to, templateId || 'manual', subject, 'sent', vars || {});
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Send to tenant failed:', e);
    await logEmail(orgId, tenantId || null, to, templateId || 'manual', subject, 'failed', { error: e.message });
    return res.status(502).json({ error: 'Email send failed' });
  }
});

// ── Tenant document upsert (server-side, bypasses RLS via service-role) ──────
// The client-side direct upsert occasionally hits a "row level security" failure
// when the user's org_members membership hasn't fully synced (newly invited
// users, or after the v59 invited_to_org override). This endpoint validates the
// caller belongs to the org they claim, then writes via the service role —
// guaranteed to succeed when membership is real.

app.get('/api/email/log', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

  const orgId = req.query.orgId;
  if (!orgId || !isUuidString(orgId)) return res.status(400).json({ error: 'orgId required' });

  const { data: mem } = await supabaseAdmin.from('org_members').select('id').eq('org_id', orgId).eq('user_id', userData.user.id).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'Not a member of this organisation' });

  try {
    const { data, error } = await supabaseAdmin.from('email_log')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: 'Failed to fetch log' });
    return res.status(200).json({ emails: data || [] });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch email log' });
  }
});


  return {
    sendLifecycleForOrg,
    sendAuthLifecycleEmail,
    formatDate,
    renderTextTemplate,
    renderHtmlTemplate,
    buildEmailHtmlFromPublicTemplate,
    logEmail,
  };
};
