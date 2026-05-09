module.exports = function registerBackupRoutes(ctx) {
  const { app, supabaseAdmin, crypto, isUuidString } = ctx;

function _backupCsvEscape(v) {
  if (v === null || v === undefined) return '';
  var s;
  if (typeof v === 'object') { try { s = JSON.stringify(v); } catch (_e) { s = ''; } }
  else s = String(v);
  s = s.replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return '"' + s + '"';
}
function _backupRowsToCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const keys = {};
  rows.forEach((r) => { if (r && typeof r === 'object') Object.keys(r).forEach((k) => { keys[k] = true; }); });
  const cols = Object.keys(keys);
  const out = [cols.map((k) => _backupCsvEscape(k)).join(',')];
  rows.forEach((r) => { out.push(cols.map((k) => _backupCsvEscape(r ? r[k] : '')).join(',')); });
  return out.join('\n');
}

/** Build a ZIP Buffer of per-entity CSVs for a given org. */
async function buildOrgBackupZip(orgId, orgRow) {
  let archiver;
  try { archiver = require('archiver'); }
  catch (_e) { throw new Error('archiver dependency not installed'); }

  const tables = [
    { name: 'properties.csv',        query: () => supabaseAdmin.from('properties').select('*').eq('org_id', orgId) },
    { name: 'tenants.csv',           query: () => supabaseAdmin.from('tenants').select('*').eq('org_id', orgId) },
    { name: 'landlords.csv',         query: () => supabaseAdmin.from('landlords').select('*').eq('org_id', orgId) },
    { name: 'payments.csv',          query: () => supabaseAdmin.from('payments').select('*').eq('org_id', orgId) },
    { name: 'landlord_payments.csv', query: () => supabaseAdmin.from('landlord_payments').select('*').eq('org_id', orgId) },
    { name: 'expenses.csv',          query: () => supabaseAdmin.from('expenses').select('*').eq('org_id', orgId) },
    { name: 'maintenance.csv',       query: () => supabaseAdmin.from('maintenance').select('*').eq('org_id', orgId) },
    { name: 'contractors.csv',       query: () => supabaseAdmin.from('contractors').select('*').eq('org_id', orgId) },
    { name: 'companies.csv',         query: () => supabaseAdmin.from('companies').select('*').eq('org_id', orgId) },
  ];

  const csvMap = {};
  const counts = {};
  for (const t of tables) {
    try {
      const r = await t.query();
      const rows = Array.isArray(r.data) ? r.data : [];
      csvMap[t.name] = _backupRowsToCsv(rows);
      counts[t.name] = rows.length;
    } catch (err) {
      csvMap[t.name] = '';
      counts[t.name] = 'ERROR: ' + (err && err.message ? err.message : 'unknown');
    }
  }

  // MANIFEST.txt
  const manifest = [
    'LandlordApp.io — Weekly Portfolio Backup',
    '─────────────────────────────────────────',
    `Generated: ${new Date().toISOString()}`,
    `Org: ${orgRow && orgRow.name ? orgRow.name : '—'}`,
    `Owner: ${orgRow && orgRow.owner_email ? orgRow.owner_email : '—'}`,
    '',
    'Files:',
    ...tables.map((t) => `  ${t.name.padEnd(26)} ${String(counts[t.name]).padStart(6)} rows`),
    '',
    'Each CSV is a full snapshot of the matching Supabase table scoped to this',
    'organisation. Columns are raw DB column names (snake_case). To restore, use',
    'Settings → Import in the app, or contact support.',
  ].join('\n');

  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('data', (c) => chunks.push(c));
    archive.on('error', (err) => reject(err));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    Object.keys(csvMap).forEach((name) => { archive.append(csvMap[name] || '', { name }); });
    archive.append(manifest, { name: 'MANIFEST.txt' });
    archive.finalize();
  });
}

async function _sendBackupEmailViaResend(to, zipBuffer, orgName, filename) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error('RESEND_API_KEY not configured');
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const subject = `[${orgName || 'Portfolio'}] Weekly backup — ${dateStr}`;
  const html = [
    '<p>Hi,</p>',
    `<p>Attached is your LandlordApp weekly portfolio backup for <strong>${(orgName || 'your portfolio').replace(/[<>&"]/g, '')}</strong> generated on ${dateStr}.</p>`,
    '<p>The ZIP contains a CSV per section (properties, tenants, landlords, payments, landlord payments, expenses, maintenance, contractors, companies) plus a MANIFEST.txt.</p>',
    '<p style="color:#718096;font-size:12px">You can disable these weekly emails anytime in <em>Settings → Backup</em>.</p>',
    '<p style="color:#94a3b8;font-size:11px">LandlordApp.io</p>',
  ].join('');
  const from =
    process.env.LIFECYCLE_MAIL_FROM ||
    process.env.AUTH_LIFECYCLE_MAIL_FROM ||
    'LandlordApp <backups@landlordapp.io>';
  const payload = {
    from,
    to: [to],
    subject,
    html,
    attachments: [{ filename, content: zipBuffer.toString('base64') }],
    headers: { 'X-Auto-Response-Suppress': 'OOF, AutoReply' },
  };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + resendKey },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.message)) || 'Email send failed');
  return data;
}

app.post('/api/cron/weekly-backup', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase service role not configured' });

  // Auth: cron-secret header OR authenticated org admin triggering their own "send test now"
  const cronSecret = process.env.LIFECYCLE_EMAIL_CRON_SECRET || '';
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim()
    || String((req.headers.authorization || '').replace(/^Bearer\s+/i, '')).trim();
  let authedViaCron = false;
  if (cronSecret && headerSecret) {
    const a = Buffer.from(headerSecret);
    const b = Buffer.from(cronSecret);
    authedViaCron = a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const body = req.body || {};
  let targetOrgIds = null;
  if (!authedViaCron) {
    // Manual trigger: require JWT + must be admin of the org they're requesting
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });
    const callerOrgId = body.orgId;
    if (!callerOrgId || !isUuidString(callerOrgId)) return res.status(400).json({ error: 'orgId required' });
    const { data: mem } = await supabaseAdmin.from('org_members').select('role').eq('org_id', callerOrgId).eq('user_id', userData.user.id).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'Not a member of this organisation' });
    targetOrgIds = [callerOrgId];
  }

  const dryRun = !!body.dryRun;
  const summary = { considered: 0, sent: 0, skipped: 0, errors: 0, log: [] };

  try {
    // Load candidate orgs — either the single manual org or all active orgs with weekly toggle
    let orgsQuery = supabaseAdmin.from('organisations').select('id,name,owner_email,status,app_config');
    if (targetOrgIds) orgsQuery = orgsQuery.in('id', targetOrgIds);
    else orgsQuery = orgsQuery.in('status', ['active', 'trial']);
    const { data: orgs, error: orgsErr } = await orgsQuery;
    if (orgsErr) throw orgsErr;

    for (const org of (orgs || [])) {
      summary.considered += 1;
      const cfg = org.app_config && org.app_config.config ? org.app_config.config : {};
      const bkup = cfg.backup || {};
      const to = (bkup.weeklyEmailTo || org.owner_email || '').trim();
      const weeklyOn = !!bkup.weeklyEmail;

      // For cron invocations: must have toggle on + recipient. For manual "send test now": send regardless.
      if (authedViaCron && !weeklyOn) { summary.skipped += 1; summary.log.push({ org: org.id, reason: 'weekly toggle off' }); continue; }
      if (!to || !to.includes('@')) { summary.skipped += 1; summary.log.push({ org: org.id, reason: 'no recipient email' }); continue; }

      if (dryRun) {
        summary.log.push({ org: org.id, name: org.name, to, wouldSend: true });
        continue;
      }

      try {
        const zipBuf = await buildOrgBackupZip(org.id, org);
        if (zipBuf.length > 24 * 1024 * 1024) {
          summary.skipped += 1;
          summary.log.push({ org: org.id, reason: `zip too large (${Math.round(zipBuf.length/1024/1024)} MB)` });
          continue;
        }
        const fname = 'landlordapp-backup-' + new Date().toISOString().split('T')[0] + '.zip';
        await _sendBackupEmailViaResend(to, zipBuf, org.name, fname);
        // Stamp last backup time into app_config
        try {
          const nextCfg = Object.assign({}, org.app_config || {});
          const nextInner = Object.assign({}, nextCfg.config || {});
          const nextBkup = Object.assign({}, nextInner.backup || {});
          nextBkup.lastBackupAt = new Date().toISOString();
          nextInner.backup = nextBkup;
          nextCfg.config = nextInner;
          await supabaseAdmin.from('organisations').update({ app_config: nextCfg }).eq('id', org.id);
        } catch (_e) { /* non-fatal */ }
        summary.sent += 1;
        summary.log.push({ org: org.id, to, sizeKb: Math.round(zipBuf.length / 1024) });
      } catch (err) {
        summary.errors += 1;
        summary.log.push({ org: org.id, error: err.message || String(err) });
      }
    }

    return res.status(200).json(summary);
  } catch (err) {
    console.error('Weekly backup cron failed:', err);
    return res.status(500).json({ error: err.message || 'Weekly backup failed', summary });
  }
});

// Configuration injection for the frontend (no secrets)
};
