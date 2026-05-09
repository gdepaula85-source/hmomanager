module.exports = function registerPublicApiRoutes(ctx) {
  const { app, supabaseAdmin, emailLimiter, isUuidString, fs, path, rootDir } = ctx;

function normalizePublicListingsWhatsApp(input) {
  return String(input || '').replace(/\D/g, '');
}

/**
 * Public /rooms.html — org name, tagline, WhatsApp visibility (no auth).
 * Requires SUPABASE_SERVICE_ROLE_KEY. Apply db/organisations_public_listings.sql if columns are missing.
 */
app.get('/api/public/listings-brand', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server is not configured for this endpoint' });
  }
  const orgId = String(req.query.org || '').trim();
  if (!isUuidString(orgId)) {
    return res.status(400).json({ error: 'Missing or invalid org' });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('organisations')
      .select('name, public_listings_whatsapp, public_listings_whatsapp_skipped, public_listings_tagline')
      .eq('id', orgId)
      .maybeSingle();
    if (error) {
      const msg = error.message || 'Query failed';
      if (/column/i.test(msg) && /does not exist/i.test(msg)) {
        return res.status(503).json({
          error:
            'Database migration required: run db/organisations_public_listings.sql on your Supabase project.',
        });
      }
      return res.status(500).json({ error: msg });
    }
    if (!data) {
      return res.status(404).json({ error: 'Organisation not found' });
    }
    const digits = normalizePublicListingsWhatsApp(data.public_listings_whatsapp);
    const skipped = !!data.public_listings_whatsapp_skipped;
    const showWhatsappButton = digits.length > 0 && !skipped;
    res.json({
      orgName: data.name || 'Properties',
      tagline: (data.public_listings_tagline || '').trim() || null,
      whatsappDigits: showWhatsappButton ? digits : '',
      showWhatsappButton,
    });
  } catch (e) {
    console.error('listings-brand GET error:', e);
    res.status(500).json({ error: 'Unexpected error' });
  }
});

/**
 * Logged-in org member: should we prompt to connect WhatsApp on first visit to public listings?
 */
app.get('/api/public/listings-brand/admin', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server is not configured for this endpoint' });
  }
  const orgId = String(req.query.org || '').trim();
  if (!isUuidString(orgId)) {
    return res.status(400).json({ error: 'Missing or invalid org' });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { data: userData, error: uerr } = await supabaseAdmin.auth.getUser(token);
    if (uerr || !userData?.user?.id) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    const uid = userData.user.id;
    const { data: mem } = await supabaseAdmin
      .from('org_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', uid)
      .maybeSingle();
    if (!mem) {
      return res.json({ member: false, needsPrompt: false });
    }
    const { data: org, error: oerr } = await supabaseAdmin
      .from('organisations')
      .select('public_listings_whatsapp, public_listings_whatsapp_skipped')
      .eq('id', orgId)
      .maybeSingle();
    if (oerr) {
      return res.status(500).json({ error: oerr.message || 'Query failed' });
    }
    const digits = normalizePublicListingsWhatsApp(org?.public_listings_whatsapp);
    const skipped = !!org?.public_listings_whatsapp_skipped;
    const needsPrompt = !digits && !skipped;
    return res.json({ member: true, needsPrompt });
  } catch (e) {
    console.error('listings-brand admin GET error:', e);
    res.status(500).json({ error: 'Unexpected error' });
  }
});

/**
 * Org members: update public listings WhatsApp / tagline / skip flag.
 * Body: { orgId, whatsapp?: string, whatsappSkipped?: boolean, tagline?: string }
 */
app.patch('/api/public/listings-brand', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server is not configured for this endpoint' });
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }
  const orgId = String(req.body?.orgId || '').trim();
  if (!isUuidString(orgId)) {
    return res.status(400).json({ error: 'Invalid orgId' });
  }
  try {
    const { data: userData, error: uerr } = await supabaseAdmin.auth.getUser(token);
    if (uerr || !userData?.user?.id) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    const uid = userData.user.id;
    const { data: mem } = await supabaseAdmin
      .from('org_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', uid)
      .maybeSingle();
    if (!mem) {
      return res.status(403).json({ error: 'Not a member of this organisation' });
    }

    const body = req.body || {};
    const payload = {};
    if (body.whatsappSkipped === true) {
      payload.public_listings_whatsapp_skipped = true;
      payload.public_listings_whatsapp = null;
    } else {
      if (typeof body.whatsapp === 'string') {
        payload.public_listings_whatsapp = normalizePublicListingsWhatsApp(body.whatsapp) || null;
        payload.public_listings_whatsapp_skipped = false;
      } else if (body.whatsappSkipped === false) {
        payload.public_listings_whatsapp_skipped = false;
      }
    }
    if (typeof body.tagline === 'string') {
      payload.public_listings_tagline = body.tagline.trim() || null;
    }
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { error: upErr } = await supabaseAdmin.from('organisations').update(payload).eq('id', orgId);
    if (upErr) {
      const msg = upErr.message || 'Update failed';
      if (/column/i.test(msg) && /does not exist/i.test(msg)) {
        return res.status(503).json({
          error:
            'Database migration required: run db/organisations_public_listings.sql on your Supabase project.',
        });
      }
      return res.status(500).json({ error: msg });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('listings-brand PATCH error:', e);
    res.status(500).json({ error: 'Unexpected error' });
  }
});

/**
 * Public platform stats — for social proof on the signup/landing pages.
 * Returns aggregated counts ONLY (no per-org or per-user data); safe to expose
 * without auth. Cached in-process for 10 min so page loads don't hammer the DB.
 *
 * Privacy notes:
 *   - Active-tenant count excludes inactive/archived rows.
 *   - Property count excludes archived properties so the "live portfolio under
 *     management" number reflects real activity.
 *   - Monthly rent is rounded to the nearest £100 — prevents anyone reverse-
 *     engineering specific tenancy values from this number.
 */
let _platformStatsCache = { at: 0, payload: null };
const PLATFORM_STATS_TTL_MS = 10 * 60 * 1000;
app.get('/api/public/platform-stats', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server is not configured for this endpoint' });
  }
  const now = Date.now();
  if (_platformStatsCache.payload && (now - _platformStatsCache.at) < PLATFORM_STATS_TTL_MS) {
    return res.json(_platformStatsCache.payload);
  }
  try {
    const [props, tenants, rents] = await Promise.all([
      // Active (non-archived) properties only.
      supabaseAdmin.from('properties').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
      // Active tenants — excludes inactive rows that bloat raw counts.
      supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }).neq('status', 'inactive'),
      // Sum of monthly rent across active tenants. Weekly rent is converted to
      // monthly equivalent on the client to match the dashboard's display.
      supabaseAdmin.from('tenants').select('rent, freq').neq('status', 'inactive'),
    ]);

    const propertyCount = Number(props.count || 0);
    const tenantCount   = Number(tenants.count || 0);
    let monthlyRentTotal = 0;
    (rents.data || []).forEach((t) => {
      const r = Number(t.rent || 0);
      if (!Number.isFinite(r) || r <= 0) return;
      // Match dashboard convention: weekly × 52/12 = monthly equivalent.
      monthlyRentTotal += t.freq === 'weekly' ? r * 52 / 12 : r;
    });
    // Round down to nearest £100 so we never overstate, and don't expose
    // exact rent figures.
    monthlyRentTotal = Math.floor(monthlyRentTotal / 100) * 100;

    const payload = {
      properties: propertyCount,
      tenants:    tenantCount,
      monthlyRentGbp: monthlyRentTotal,
      cachedAt: new Date(now).toISOString(),
    };
    _platformStatsCache = { at: now, payload };
    res.set('Cache-Control', 'public, max-age=600');
    return res.json(payload);
  } catch (e) {
    console.error('platform-stats error:', e);
    return res.status(500).json({ error: 'Unable to load stats' });
  }
});

/**
 * Public lead capture — exit-intent popup + future lead magnets.
 * No auth required (top-of-funnel). Persists to `marketing_leads` and emails
 * the requested asset (e.g. HMO compliance PDF) via Resend.
 *
 * Rate-limit relies on emailLimiter to prevent enumeration / spam. Same-email
 * same-source re-submits are upserts (refreshes created_at) rather than dupes.
 */
app.post('/api/marketing/capture-lead', emailLimiter, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server is not configured for this endpoint' });
  }
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const source = String(body.source || '').trim().slice(0, 80);
  const asset = body.asset ? String(body.asset).trim().slice(0, 80) : null;
  const referrer = body.referrer ? String(body.referrer).trim().slice(0, 500) : null;
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);

  // Basic email sanity. Resist sending to obvious junk; the emailLimiter
  // backstops volume.
  if (!email || !email.includes('@') || email.length > 200) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!source) {
    return res.status(400).json({ error: 'Lead source required' });
  }

  try {
    // Upsert on (email, source) so re-submissions don't pile up duplicates.
    const { error: upErr } = await supabaseAdmin.from('marketing_leads').upsert(
      {
        email,
        source,
        asset,
        referrer,
        user_agent: ua,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email,source' }
    );
    if (upErr) {
      // If the table doesn't exist yet, surface a clear migration hint rather
      // than a generic 500 — same pattern used by the listings-brand endpoint.
      const msg = String(upErr.message || '');
      if (/relation.*marketing_leads.*does not exist/i.test(msg)) {
        return res.status(503).json({
          error: 'Database migration required: run db/marketing_leads.sql on your Supabase project.',
        });
      }
      console.error('marketing_leads upsert error:', upErr);
      return res.status(500).json({ error: 'Could not save lead' });
    }

    // Deliver the requested lead magnet via Resend after the lead is captured.
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && asset === 'hmo_compliance_checklist_2026') {
      const pdfPath = path.join(rootDir, 'public', 'hmo-compliance-checklist-2026.pdf');
      const pdfBase64 = fs.existsSync(pdfPath) ? fs.readFileSync(pdfPath).toString('base64') : null;
      const emailHtml =
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        + '<body style="margin:0;background:#F4F7F6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0B1120">'
        + '<div style="max-width:620px;margin:0 auto;padding:28px 18px">'
        + '<div style="background:#062820;border-radius:18px 18px 0 0;padding:28px 28px 24px;color:#fff">'
        + '<div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#39DDBB;margin-bottom:12px">LandlordApp.io</div>'
        + '<h1 style="font-size:28px;line-height:1.15;margin:0 0 12px">Your HMO Compliance Checklist 2026</h1>'
        + '<p style="font-size:15px;line-height:1.6;margin:0;color:#CFE9E2">The PDF is attached. Use it as a monthly control sheet for certificates, licences, deposits, right-to-rent and operational checks.</p>'
        + '</div>'
        + '<div style="background:#fff;border:1px solid #DCE8E5;border-top:0;border-radius:0 0 18px 18px;padding:28px">'
        + '<p style="font-size:15px;line-height:1.6;margin:0 0 18px;color:#374151">Hi,</p>'
        + '<p style="font-size:15px;line-height:1.6;margin:0 0 18px;color:#374151">Thanks for grabbing the checklist. It covers the items UK HMO operators most often lose track of:</p>'
        + '<ul style="font-size:14px;line-height:1.8;color:#374151;padding-left:20px;margin:0 0 22px">'
        + '<li>Gas Safety, EICR, EPC, fire safety and HMO licence checks</li>'
        + '<li>Deposit protection and prescribed information deadlines</li>'
        + '<li>Right-to-rent re-check dates and tenant document records</li>'
        + '<li>30/14/7-day reminders before certificates expire</li>'
        + '</ul>'
        + '<div style="background:#ECFDF8;border:1px solid #B7F1E1;border-radius:12px;padding:18px;margin:0 0 24px">'
        + '<div style="font-size:15px;font-weight:800;color:#065F46;margin-bottom:8px">Want this tracked automatically?</div>'
        + '<div style="font-size:14px;line-height:1.55;color:#047857;margin-bottom:14px">LandlordApp tracks compliance dates, tenant docs, rent, arrears, landlord statements, PDF reports and e-signatures in one dashboard.</div>'
        + '<a href="https://landlordapp.io/login.html?demo=1" style="display:inline-block;padding:11px 18px;background:#00B894;color:#fff;text-decoration:none;border-radius:9px;font-size:14px;font-weight:800">Try the demo</a>'
        + '</div>'
        + '<p style="font-size:12px;color:#6B7280;margin:0">No spam. One follow-up email a week. Unsubscribe anytime.</p>'
        + '</div></div></body></html>';
      const mailPayload = {
        from: process.env.MARKETING_MAIL_FROM || process.env.MAIL_FROM || 'LandlordApp <hello@landlordapp.io>',
        to: [email],
        subject: 'Your HMO Compliance Checklist 2026 PDF',
        html: emailHtml,
      };
      if (pdfBase64) {
        mailPayload.attachments = [
          {
            filename: 'hmo-compliance-checklist-2026.pdf',
            content: pdfBase64,
          },
        ];
      }
      const mailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + resendKey },
        body: JSON.stringify(mailPayload),
      });
      if (!mailRes.ok) {
        const detail = await mailRes.text().catch(() => '');
        console.error('Lead-magnet email send failed:', detail.slice(0, 500));
        return res.status(502).json({ error: 'Lead saved, but checklist email could not be sent' });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('capture-lead error:', e);
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

/**
 * Tenant-facing / org emails: Resend REST API (same contract as resend npm package).
 * After Resend verifies landlordapp.io, use any From on that domain (no separate "Add sender").
 * Auth: Supabase user JWT. Body: { orgId, to, subject, text, html?, kind?: 'tenant'|'report' }
 */
};
