module.exports = function registerTenantPortalRoutes(ctx) {
  const { app, supabaseAdmin, tenantPortalLimiter, crypto, isUuidString } = ctx;

app.post('/api/tenant-docs/upsert', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid or expired session' });
  const userId = userData.user.id;

  const body = req.body || {};
  const orgId = String(body.orgId || '').trim();
  const rows = Array.isArray(body.rows) ? body.rows : null;
  if (!orgId) return res.status(400).json({ error: 'orgId required' });
  if (!rows || !rows.length) return res.status(400).json({ error: 'rows[] required' });
  if (rows.length > 200) return res.status(400).json({ error: 'Too many rows in one batch (max 200)' });

  // Verify caller is actually a member of this org.
  const { data: mem, error: memErr } = await supabaseAdmin
    .from('org_members')
    .select('id, role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memErr || !mem) return res.status(403).json({ error: 'Not a member of this organisation' });

  // Stamp org_id on every row (clients may forget) and reject any row with a foreign org_id.
  const cleanRows = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    if (r.org_id && String(r.org_id) !== orgId) {
      return res.status(400).json({ error: 'Row org_id mismatch' });
    }
    if (!r.id || !r.tenant_id) {
      return res.status(400).json({ error: 'Each row needs id + tenant_id' });
    }
    cleanRows.push(Object.assign({}, r, { org_id: orgId }));
  }
  if (!cleanRows.length) return res.status(400).json({ error: 'No valid rows to upsert' });

  const { error: upErr } = await supabaseAdmin
    .from('tenant_docs')
    .upsert(cleanRows, { onConflict: 'id' });
  if (upErr) {
    console.error('tenant_docs upsert (admin) failed:', upErr);
    return res.status(500).json({ error: upErr.message || 'Upsert failed' });
  }
  res.status(200).json({ ok: true, count: cleanRows.length });
});

// Get email log for an org

app.post('/api/users/invite', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase service role not configured on server' });
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!auth) return res.status(401).json({ error: 'Authentication required' });
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(auth);
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

  const { orgId, email, name, role } = req.body || {};
  if (!orgId || !isUuidString(orgId)) return res.status(400).json({ error: 'orgId required' });
  if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'Valid email required' });
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanRole  = String(role || 'viewer').trim().toLowerCase();

  // Caller must be an admin of the org.
  const { data: caller } = await supabaseAdmin
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!caller || caller.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can invite team members' });
  }

  try {
    const appBaseUrl = (process.env.APP_BASE_URL || 'https://landlordapp.io').replace(/\/$/, '');
    // New invitees land on /set-password (forces a password to be chosen so
    // they can log in normally next time, not via magic-link only).
    // Existing users (magic-link fallback) already have a password and skip
    // straight to /app.
    const redirectNewUser     = appBaseUrl + '/set-password.html';
    const redirectExistingUser= appBaseUrl + '/app';
    // Use generateLink — this DOES NOT send the email itself (so we're not stuck
    // with whatever Supabase Site URL / template is configured). It returns an
    // action_link we then dispatch via Resend with our own branded HTML.
    let actionLink = '';
    let inviteUserId = null;
    let isExistingUser = false;
    const gen = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: cleanEmail,
      options: {
        redirectTo: redirectNewUser,
        data: {
          full_name: name || '',
          invited_to_org: orgId,
          invited_role: cleanRole,
        },
      },
    });
    if (gen && gen.error) {
      const msg = String(gen.error.message || '');
      if (/already.*registered|user.*exists|email.*exists|already been registered/i.test(msg)) {
        // User already has a Supabase auth account — generate a magic-link instead so they can
        // sign in once and have org_members + invited_to_org metadata applied.
        isExistingUser = true;
        const magic = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: cleanEmail,
          options: {
            redirectTo: redirectExistingUser,
            data: { invited_to_org: orgId, invited_role: cleanRole },
          },
        });
        if (magic && magic.error) return res.status(502).json({ error: magic.error.message });
        actionLink = magic && magic.data && magic.data.properties && magic.data.properties.action_link;
        if (magic && magic.data && magic.data.user) inviteUserId = magic.data.user.id;
      } else {
        return res.status(502).json({ error: msg || 'Could not generate invite link' });
      }
    } else {
      actionLink = gen && gen.data && gen.data.properties && gen.data.properties.action_link;
      if (gen && gen.data && gen.data.user) inviteUserId = gen.data.user.id;
    }
    if (!actionLink) return res.status(502).json({ error: 'Supabase did not return an action link' });

    // Look up org name for a friendlier email body.
    let orgName = 'your team';
    try {
      const { data: orgRow } = await supabaseAdmin.from('organisations').select('name').eq('id', orgId).maybeSingle();
      if (orgRow && orgRow.name) orgName = orgRow.name;
    } catch (_e) {}

    // Ensure invited_to_org / invited_role are present on user_metadata.
    // generateLink({type:'invite'}) embeds this for NEW users via options.data,
    // but generateLink({type:'magiclink'}) on EXISTING users silently ignores
    // the data param — so an admin re-inviting someone who self-signed up
    // before would never get the metadata stamped, and resolveOrg would land
    // them in their original (often stale empty trial) org. Explicitly merging
    // via updateUserById makes both paths reliable. Belt-and-suspenders for new
    // users too — covers any future Supabase API drift on the invite path.
    if (inviteUserId) {
      try {
        const { data: existing } = await supabaseAdmin.auth.admin.getUserById(inviteUserId);
        const prevMeta = (existing && existing.user && existing.user.user_metadata) || {};
        await supabaseAdmin.auth.admin.updateUserById(inviteUserId, {
          user_metadata: Object.assign({}, prevMeta, {
            invited_to_org:  orgId,
            invited_role:    cleanRole,
            full_name:       prevMeta.full_name || (name || ''),
          }),
        });
      } catch (e) {
        console.warn('Could not stamp invited_to_org metadata for', cleanEmail, '—', (e && e.message) || e);
      }
      // Pre-create the org_members row so they appear in the team list
      // immediately. We also denormalize the invited name + email here so
      // OTHER admins viewing the team list see "Fred Jones" instead of
      // "User f0b212" — the dashboard can't query auth.users client-side.
      // Falls back gracefully on Supabase projects where the
      // org_members_invited_name.sql migration hasn't been run yet.
      const memberRow = {
        org_id:  orgId,
        user_id: inviteUserId,
        role:    cleanRole,
        invited_name:  (name && name.trim()) || cleanEmail.split('@')[0] || '',
        invited_email: cleanEmail,
      };
      let upsertRes = await supabaseAdmin
        .from('org_members')
        .upsert([memberRow], { onConflict: 'org_id,user_id' });
      if (upsertRes && upsertRes.error) {
        const upMsg = String(upsertRes.error.message || '');
        const upCode = String(upsertRes.error.code || '');
        // Migration not run on this project → strip new columns and retry.
        if (upCode === 'PGRST204' || upCode === '42703' || /invited_name|invited_email|column.*not found/i.test(upMsg)) {
          console.warn('[invite] org_members_invited_name.sql not run yet — falling back to minimal row');
          delete memberRow.invited_name;
          delete memberRow.invited_email;
          upsertRes = await supabaseAdmin
            .from('org_members')
            .upsert([memberRow], { onConflict: 'org_id,user_id' });
        }
      }
    }

    // Send the email via Resend with our own template — fully bypasses Supabase's
    // SMTP / Site URL config so the link always points where we say.
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // No email infra configured. Return the link so the admin can copy/paste it.
      return res.status(200).json({ ok: true, userId: inviteUserId, actionLink, warning: 'No RESEND_API_KEY — email not sent. Copy the actionLink and share it manually.' });
    }
    const fromAddr = process.env.LIFECYCLE_MAIL_FROM || 'LandlordApp <admin@landlordapp.io>';
    const subject = isExistingUser
      ? 'You\'ve been added to ' + orgName + ' on LandlordApp'
      : 'You\'re invited to join ' + orgName + ' on LandlordApp';
    const html = '<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">'
      +   '<div style="width:36px;height:36px;border-radius:9px;background:#0B1120;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px">🏠</div>'
      +   '<div style="font-size:18px;font-weight:700">LandlordApp.io</div>'
      + '</div>'
      + '<h2 style="font-size:20px;font-weight:700;margin:0 0 12px">' + (isExistingUser ? 'You\'ve been added to ' + orgName : 'Join ' + orgName) + '</h2>'
      + '<p style="font-size:14px;line-height:1.55;color:#374151;margin:0 0 18px">'
      +   (isExistingUser
            ? 'An admin has added you as a <strong>' + cleanRole + '</strong> on the ' + orgName + ' workspace. Click below to sign in and start using LandlordApp.'
            : 'You\'ve been invited as a <strong>' + cleanRole + '</strong> on the ' + orgName + ' workspace. Click below to set your password and get started.')
      + '</p>'
      + '<a href="' + actionLink + '" style="display:inline-block;padding:12px 24px;background:#14B8A6;color:#fff;font-weight:700;text-decoration:none;border-radius:9px;font-size:14px">'
      +   (isExistingUser ? 'Open LandlordApp' : 'Accept invite')
      + '</a>'
      + '<p style="font-size:12px;color:#6B7280;margin:18px 0 0">If the button doesn\'t work, paste this link: <br><span style="word-break:break-all">' + actionLink + '</span></p>'
      + '<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0">'
      + '<p style="font-size:11px;color:#9CA3AF;margin:0">If you weren\'t expecting this invite, just ignore this email.</p>'
      + '</div>';
    const text = (isExistingUser
        ? 'You\'ve been added to ' + orgName + ' on LandlordApp as a ' + cleanRole + '.\n\nSign in: '
        : 'You\'ve been invited to join ' + orgName + ' on LandlordApp as a ' + cleanRole + '.\n\nAccept the invite: ')
      + actionLink;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + resendKey },
      body: JSON.stringify({ from: fromAddr, to: [cleanEmail], subject, html, text }),
    });
    const rdata = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Resend invite send failed:', rdata);
      return res.status(502).json({ error: 'Email send failed: ' + (rdata.error || rdata.message || 'unknown') });
    }
    res.status(200).json({ ok: true, userId: inviteUserId, emailId: rdata.id || null });
  } catch (e) {
    console.error('User invite error:', e);
    res.status(500).json({ error: e.message || 'Invite failed' });
  }
});

// ── Public Tenant Onboarding ──────────────────────────────────────────────────
app.post('/api/tenant-onboard', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const { orgId, name, dob, gender, phone, email, address, notes } = req.body || {};
  if (!orgId || !isUuidString(orgId)) return res.status(400).json({ error: 'Invalid registration link' });
  if (!name || !email || !phone) return res.status(400).json({ error: 'Name, email, and phone are required' });

  try {
    // Verify org exists
    const { data: org, error: orgErr } = await supabaseAdmin.from('organisations').select('id,name').eq('id', orgId).maybeSingle();
    if (orgErr || !org) return res.status(404).json({ error: 'Organisation not found' });

    // Create tenant with pending_review status
    const tenantId = crypto.randomUUID();
    const { error: insertErr } = await supabaseAdmin.from('tenants').insert({
      id: tenantId,
      org_id: orgId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: phone.trim().replace(/\s+/g, '').replace(/^\+/, ''),
      dob: dob || null,
      status: 'pending_review',
      property_name: '',
      room_number: null,
      rent: 0,
      freq: 'weekly',
      method: 'bank',
      notes: (notes || '') + (gender ? '\n👤 Gender: ' + gender : '') + (address ? '\n📍 Address: ' + address : '') + '\n📅 Applied: ' + new Date().toLocaleDateString('en-GB'),
    });
    if (insertErr) {
      console.error('Tenant onboard insert error:', insertErr);
      return res.status(500).json({ error: 'Failed to create application' });
    }
    return res.status(200).json({ ok: true, tenantId: tenantId });
  } catch (e) {
    console.error('Tenant onboard error:', e);
    return res.status(500).json({ error: 'Application failed' });
  }
});

// ── Tenant portal auth endpoints (C4/C5/C6 FIX: server-side password hashing) ──
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, dk) => {
      if (err) return reject(err);
      resolve(salt + ':' + dk.toString('hex'));
    });
  });
}
async function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, dk) => {
      if (err) return reject(err);
      const a = Buffer.from(hash, 'hex');
      const b = dk;
      resolve(a.length === b.length && crypto.timingSafeEqual(a, b));
    });
  });
}

app.post('/api/tenant-portal/login', tenantPortalLimiter, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const { tenantId, password } = req.body || {};
  if (!tenantId || !password) return res.status(400).json({ error: 'tenantId and password required' });

  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, portal_password, name, property, room, email')
      .eq('id', tenantId)
      .maybeSingle();
    if (error || !tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!tenant.portal_password) return res.status(401).json({ error: 'No password set' });

    // Support both new hashed format (salt:hash) and legacy plaintext/base64
    let valid = false;
    if (tenant.portal_password.includes(':') && tenant.portal_password.length > 50) {
      valid = await verifyPassword(password, tenant.portal_password);
    } else {
      // Legacy: plaintext or base64 comparison — migrate on successful login
      valid = tenant.portal_password === password || tenant.portal_password === Buffer.from(password).toString('base64');
      if (valid) {
        const hashed = await hashPassword(password);
        await supabaseAdmin.from('tenants').update({ portal_password: hashed }).eq('id', tenantId);
      }
    }
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    return res.status(200).json({ ok: true, tenant: { id: tenant.id, name: tenant.name, property: tenant.property, room: tenant.room } });
  } catch (e) {
    console.error('Tenant login error:', e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/tenant-portal/set-password', tenantPortalLimiter, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const { tenantId, password, currentPassword } = req.body || {};
  if (!tenantId || !password) return res.status(400).json({ error: 'tenantId and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, portal_password')
      .eq('id', tenantId)
      .maybeSingle();
    if (error || !tenant) return res.status(404).json({ error: 'Tenant not found' });

    // If tenant already has a password, ALWAYS require the current password
    if (tenant.portal_password) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      let valid = false;
      if (tenant.portal_password.includes(':') && tenant.portal_password.length > 50) {
        valid = await verifyPassword(currentPassword, tenant.portal_password);
      } else {
        valid = tenant.portal_password === currentPassword || tenant.portal_password === Buffer.from(currentPassword).toString('base64');
      }
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = await hashPassword(password);
    const { error: updateErr } = await supabaseAdmin.from('tenants').update({ portal_password: hashed }).eq('id', tenantId);
    if (updateErr) return res.status(500).json({ error: 'Failed to update password' });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Tenant set-password error:', e);
    return res.status(500).json({ error: 'Password update failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Weekly portfolio backup — cron-triggered email with per-entity CSVs zipped.
// ═══════════════════════════════════════════════════════════════════════════
// Opt-in per org via Settings → Backup (writes state.config.backup.weeklyEmail).
// The job reads organisations.app_config->config->backup, filters opted-in orgs,
// queries each portfolio table scoped to that org_id, builds CSVs + a ZIP, and
// delivers via Resend as an attachment.
//
// Schedule: hit this endpoint every Monday 07:00 UTC with header
//   x-cron-secret: <LIFECYCLE_EMAIL_CRON_SECRET>
// Manual test: POST with {"dryRun":true} to list who would receive (no send).
// Force single org: POST with {"orgId":"<uuid>"}.
//
// Trigger options:
//   - Hostinger cron:         wget --header="x-cron-secret: $SECRET" -q -O- https://YOUR_DOMAIN/api/cron/weekly-backup
//   - cron-job.org / others:  same URL + header; free tier is fine for weekly.
//   - Supabase pg_cron:       select net.http_post(...)  (if you prefer DB-level)

};
