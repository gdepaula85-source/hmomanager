// ── Backup / Export — multi-CSV portfolio snapshot ───────────────────────────
// Ships a "Backup" tab in Settings. One click downloads a ZIP containing one
// CSV per entity (properties, tenants, landlords, payments, expenses,
// maintenance, landlord_payments, contractors, companies) + a MANIFEST.txt
// with timestamps and row counts.
//
// Also surfaces a "weekly email backup" toggle persisted in state.config.

var _backupJsZipLoaded = false;

function renderBackupTab(org) {
  var cfg = state.config || {};
  var backupCfg = cfg.backup || {};
  var weeklyOn = !!backupCfg.weeklyEmail;
  var emailTo  = backupCfg.weeklyEmailTo || (org && org.owner_email) || '';
  var lastRun  = backupCfg.lastBackupAt ? new Date(backupCfg.lastBackupAt) : null;
  var lastLbl  = lastRun && !isNaN(lastRun.getTime())
    ? lastRun.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' at '+lastRun.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
    : '—';
  var counts = _backupEntityCounts();

  var h = '';
  h += '<div class="settings-section">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;gap:12px;flex-wrap:wrap">';
  h += '<div>';
  h += '<div style="font-size:15px;font-weight:700;margin-bottom:4px">&#x1F4BE; Portfolio Backup</div>';
  h += '<div style="font-size:12px;color:var(--muted);line-height:1.6;max-width:620px">Download a full snapshot of your data as a ZIP of CSV files — one per section. Open them in Excel, Google Sheets, Numbers, or hand them to an accountant. Last manual backup: <strong>'+lastLbl+'</strong>.</div>';
  h += '</div>';
  h += '<button onclick="downloadBackupZip()" style="padding:11px 20px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 2px 8px rgba(0,184,148,.25)">&#x2B07; Download Backup ZIP</button>';
  h += '</div>';

  // Entity summary table
  h += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:18px">';
  h += '<div style="display:grid;grid-template-columns:1fr auto;padding:10px 14px;font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);background:var(--surface)"><span>Included in backup</span><span>Rows</span></div>';
  counts.forEach(function(c){
    h += '<div style="display:grid;grid-template-columns:1fr auto;padding:9px 14px;font-size:13px;color:var(--text);border-bottom:1px solid var(--border);align-items:center">'
      +'<span style="display:flex;align-items:center;gap:8px">'+c.icon+' '+c.label+'<span style="font-size:10px;color:var(--muted);font-weight:400">·  '+c.filename+'</span></span>'
      +'<span style="font-family:monospace;font-weight:700;color:'+(c.count>0?'var(--text)':'var(--dim)')+'">'+c.count+'</span>'
      +'</div>';
  });
  h += '</div>';

  // Weekly email backup toggle
  h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">';
  h += '<div style="flex:1;min-width:240px">';
  h += '<div style="font-size:13px;font-weight:700;margin-bottom:4px">&#x1F4E7; Weekly email backup</div>';
  h += '<div style="font-size:12px;color:var(--muted);line-height:1.55">Auto-email the ZIP to your inbox every Monday at 07:00. Uses the same CSV files as the manual download.</div>';
  h += '</div>';
  h += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none"><input type="checkbox" id="backup-weekly-toggle" '+(weeklyOn?'checked':'')+' onchange="toggleWeeklyBackup(this.checked)" style="width:16px;height:16px;accent-color:var(--accent)"><span style="font-size:12px;font-weight:700;color:'+(weeklyOn?'var(--green)':'var(--muted)')+'">'+(weeklyOn?'On':'Off')+'</span></label>';
  h += '</div>';
  if(weeklyOn){
    h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    h += '<label style="font-size:11px;font-weight:600;color:var(--muted);flex-shrink:0">Send to</label>';
    h += '<input class="inp" id="backup-email-to" type="email" value="'+(emailTo||'').replace(/"/g,'&quot;')+'" placeholder="you@example.com" onchange="setBackupEmailTo(this.value)" style="flex:1;min-width:220px;max-width:360px">';
    h += '<button onclick="sendBackupEmailNow()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Send test now</button>';
    h += '</div>';
    h += '<div style="margin-top:10px;font-size:11px;color:var(--dim);line-height:1.5">The weekly schedule runs server-side — activating this toggle registers your org with the delivery job. You can disable any time.</div>';
  }
  h += '</div>';

  // Safety note
  h += '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:12px 14px;font-size:12px;color:#1E40AF;line-height:1.55">';
  h += '&#x1F512; <strong>Data ownership:</strong> CSVs contain every tenant / payment / landlord record for your org. Keep the ZIP somewhere private (your own Drive / Dropbox / disk). LandlordApp does not retain a copy of manual downloads.';
  h += '</div>';

  // ── Data Maintenance: purge old overdue payments ──
  // Useful for accounts that accumulated stale "overdue" rows from testing /
  // years of historical data. Drops everything dated more than 7 days ago
  // (paid rows are always kept; future-dated rows are always kept).
  var _purgeCounts = _countOldOverduePayments();
  var _purgeTotal = _purgeCounts.payments + _purgeCounts.schedule;
  h += '<div style="margin-top:18px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">';
  h += '<div style="flex:1;min-width:240px">';
  h += '<div style="font-size:13px;font-weight:700;margin-bottom:4px">&#x1F9F9; Purge old overdue payments</div>';
  h += '<div style="font-size:12px;color:var(--muted);line-height:1.55">'
     + 'Removes overdue rent rows + rent-schedule entries dated <strong>more than 7 days ago</strong>. '
     + 'Anything in the last week or in the future is kept. '
     + 'Use this to clean up after testing or to hide ancient arrears that are no longer collectable.</div>';
  if (_purgeTotal > 0) {
    h += '<div style="margin-top:8px;font-size:12px;color:var(--text)">'
       + '<strong>' + _purgeCounts.payments + '</strong> overdue payment row' + (_purgeCounts.payments===1?'':'s')
       + ' &middot; <strong>' + _purgeCounts.schedule + '</strong> schedule entr' + (_purgeCounts.schedule===1?'y':'ies')
       + ' would be removed.</div>';
  } else {
    h += '<div style="margin-top:8px;font-size:12px;color:var(--green)">&#x2714; No old overdue items to clean.</div>';
  }
  h += '</div>';
  h += '<button onclick="purgeOldOverduePayments()" '+ (_purgeTotal > 0 ? '' : 'disabled ')
     + 'style="padding:9px 16px;border-radius:9px;border:1px solid '+(_purgeTotal>0?'var(--red)':'var(--border)')+';background:'+(_purgeTotal>0?'#FEE2E2':'var(--bg)')+';color:'+(_purgeTotal>0?'#991B1B':'var(--dim)')+';font-size:12px;font-weight:700;cursor:'+(_purgeTotal>0?'pointer':'not-allowed')+';font-family:inherit;white-space:nowrap">'
     + (_purgeTotal > 0 ? '🗑 Purge ' + _purgeTotal + ' old item' + (_purgeTotal===1?'':'s') : 'Nothing to purge')
     + '</button>';
  h += '</div></div>';

  // ── Data Maintenance: purge old PENDING landlord payments ──
  // Same 7-day-cutoff philosophy as the overdue-rent purge above. PAID
  // landlord payments are NEVER touched — those are your money-out audit
  // trail and need to survive the cleanup.
  var _llPurgeCount = _countOldPendingLandlordPayments();
  h += '<div style="margin-top:12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">';
  h += '<div style="flex:1;min-width:240px">';
  h += '<div style="font-size:13px;font-weight:700;margin-bottom:4px">&#x1F3E6; Purge old pending landlord payments</div>';
  h += '<div style="font-size:12px;color:var(--muted);line-height:1.55">'
     + 'Removes <strong>pending</strong> landlord-payment rows dated more than 7 days ago. '
     + 'Paid landlord payments are <strong>never</strong> touched (full audit trail of money sent stays intact). '
     + 'Use after testing or to hide stale "should have paid" rows that no longer reflect reality.</div>';
  if (_llPurgeCount > 0) {
    h += '<div style="margin-top:8px;font-size:12px;color:var(--text)">'
       + '<strong>' + _llPurgeCount + '</strong> pending landlord-payment row' + (_llPurgeCount===1?'':'s')
       + ' would be removed.</div>';
  } else {
    h += '<div style="margin-top:8px;font-size:12px;color:var(--green)">&#x2714; No old pending landlord payments to clean.</div>';
  }
  h += '</div>';
  h += '<button onclick="purgeOldPendingLandlordPayments()" '+ (_llPurgeCount > 0 ? '' : 'disabled ')
     + 'style="padding:9px 16px;border-radius:9px;border:1px solid '+(_llPurgeCount>0?'var(--red)':'var(--border)')+';background:'+(_llPurgeCount>0?'#FEE2E2':'var(--bg)')+';color:'+(_llPurgeCount>0?'#991B1B':'var(--dim)')+';font-size:12px;font-weight:700;cursor:'+(_llPurgeCount>0?'pointer':'not-allowed')+';font-family:inherit;white-space:nowrap">'
     + (_llPurgeCount > 0 ? '🗑 Purge ' + _llPurgeCount + ' old row' + (_llPurgeCount===1?'':'s') : 'Nothing to purge')
     + '</button>';
  h += '</div></div>';

  h += '</div>';
  return h;
}

// Counts payments + rent-schedule entries that are NOT paid AND dated > 7 days ago.
// Used both to drive the button label/state and to gate the actual delete pass.
function _countOldOverduePayments() {
  var cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate() - 7);
  function _dueDate(p) {
    if (p && p._dueDateRaw && !isNaN(p._dueDateRaw)) return new Date(p._dueDateRaw);
    if (p && p.dueDate)   return new Date(p.dueDate);
    if (p && p.dueDateRaw && !isNaN(p.dueDateRaw)) return new Date(p.dueDateRaw);
    return null;
  }
  var pays = (state.payments || []).filter(function(p){
    if (!p) return false;
    if (p.status === 'paid' || p.status === 'Paid') return false;
    var d = _dueDate(p);
    return d && d < cutoff;
  });
  var sched = (state.rentSchedule || []).filter(function(s){
    if (!s) return false;
    if (s.status === 'paid') return false;
    var d = _dueDate(s);
    return d && d < cutoff;
  });
  return { payments: pays.length, schedule: sched.length };
}

// Hard-deletes those old overdue rows from in-memory state AND from Supabase.
// Confirmation before deleting; chunks the Supabase delete to avoid hitting
// the URL/IN-clause limit on large purges.
async function purgeOldOverduePayments() {
  if (typeof requirePerm === 'function' && !requirePerm('canEdit', 'purge old payment records')) return;
  var counts = _countOldOverduePayments();
  if (!counts.payments && !counts.schedule) {
    if (typeof showToast === 'function') showToast('No old overdue items to clean up','success');
    return;
  }
  var msg = 'Delete ' + counts.payments + ' old overdue payment row' + (counts.payments===1?'':'s')
    + ' and ' + counts.schedule + ' rent-schedule entr' + (counts.schedule===1?'y':'ies') + '?\n\n'
    + 'Anything dated within the last 7 days, or in the future, will be kept.\n'
    + 'Paid rows are also always kept.\n\n'
    + 'This cannot be undone.';
  if (!confirm(msg)) return;

  var cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate() - 7);
  function _dueDate(p) {
    if (p && p._dueDateRaw && !isNaN(p._dueDateRaw)) return new Date(p._dueDateRaw);
    if (p && p.dueDate)   return new Date(p.dueDate);
    if (p && p.dueDateRaw && !isNaN(p.dueDateRaw)) return new Date(p.dueDateRaw);
    return null;
  }

  // Drop from state.payments + collect ids for Supabase delete.
  var paymentIdsToDelete = [];
  state.payments = (state.payments || []).filter(function(p){
    if (!p) return false;
    if (p.status === 'paid' || p.status === 'Paid') return true;
    var d = _dueDate(p);
    if (d && d < cutoff) {
      if (p.id) paymentIdsToDelete.push(p.id);
      return false;
    }
    return true;
  });

  // rentSchedule lives in localStorage only — no Supabase delete needed.
  state.rentSchedule = (state.rentSchedule || []).filter(function(s){
    if (!s) return true;
    if (s.status === 'paid') return true;
    var d = _dueDate(s);
    return !(d && d < cutoff);
  });

  // Supabase: delete in chunks of 100 to stay under PostgREST's IN-clause limit.
  if (paymentIdsToDelete.length && typeof supa !== 'undefined' && _currentOrgId) {
    try {
      for (var i = 0; i < paymentIdsToDelete.length; i += 100) {
        var chunk = paymentIdsToDelete.slice(i, i + 100);
        var r = await supa.from('payments').delete().in('id', chunk).eq('org_id', _currentOrgId);
        if (r.error) console.warn('[purgeOldOverdue] chunk', i, 'failed:', r.error.message);
      }
    } catch (e) {
      console.warn('[purgeOldOverdue] delete error:', e && e.message);
    }
  }

  if (typeof saveState === 'function') saveState();
  if (typeof render === 'function') render();
  if (typeof showToast === 'function'){
    showToast('Cleaned up ' + counts.payments + ' overdue payment' + (counts.payments===1?'':'s')
      + (counts.schedule ? ' + ' + counts.schedule + ' schedule entr' + (counts.schedule===1?'y':'ies') : ''),
      'success');
  }
}

/** Current row counts per entity — drives the "Included in backup" table. */
function _backupEntityCounts() {
  return [
    {key:'properties',         label:'Properties',          filename:'properties.csv',         icon:'&#x1F3E0;', count: (state.properties||[]).length},
    {key:'tenants',            label:'Tenants',             filename:'tenants.csv',            icon:'&#x1F465;', count: (state.tenants||[]).length},
    {key:'landlords',          label:'Landlords',           filename:'landlords.csv',          icon:'&#x1F3E2;', count: (state.landlords||[]).length},
    {key:'payments',           label:'Rent Payments',       filename:'payments.csv',           icon:'&#x1F4B7;', count: (state.payments||[]).length},
    {key:'landlord_payments',  label:'Landlord Payments',   filename:'landlord_payments.csv',  icon:'&#x1F4B3;', count: (state.landlordPayments||[]).length},
    {key:'expenses',           label:'Expenses',            filename:'expenses.csv',           icon:'&#x1F4B8;', count: (state.expenses||[]).length},
    {key:'maintenance',        label:'Maintenance Jobs',    filename:'maintenance.csv',        icon:'&#x1F527;', count: (state.maintenance||[]).length},
    {key:'contractors',        label:'Contractors',         filename:'contractors.csv',        icon:'&#x1F477;', count: (state.contractors||[]).length},
    {key:'companies',          label:'Companies',           filename:'companies.csv',          icon:'&#x1F3EC;', count: (state.companies||[]).length}
  ];
}

/** Flatten a value for CSV output — arrays/objects become JSON, null → '', dates pass through. */
function _backupCsvVal(v) {
  if(v == null) return '';
  if(typeof v === 'object') { try { return JSON.stringify(v); } catch(e) { return ''; } }
  return String(v);
}

/** Build a CSV string from an array of plain objects — headers auto-derived from the union of keys. */
function _backupToCsv(rows) {
  if(!rows || !rows.length) return '';
  var keys = {};
  rows.forEach(function(r){ if(r && typeof r==='object') Object.keys(r).forEach(function(k){ keys[k]=true; }); });
  var cols = Object.keys(keys);
  var out = [cols.join(',')];
  rows.forEach(function(r){
    out.push(cols.map(function(k){
      var v = _backupCsvVal(r ? r[k] : '');
      // RFC4180: wrap in quotes, escape any internal quotes.
      return '"' + v.replace(/"/g,'""').replace(/\r?\n/g,' ') + '"';
    }).join(','));
  });
  return out.join('\n');
}

/** Builds all CSVs in memory and returns {filename → csvString}. */
function buildBackupCsvMap() {
  var csvMap = {};
  var add = function(filename, rows){ csvMap[filename] = _backupToCsv(rows); };
  add('properties.csv',         state.properties || []);
  add('tenants.csv',            state.tenants || []);
  add('landlords.csv',          state.landlords || []);
  add('payments.csv',           state.payments || []);
  add('landlord_payments.csv',  state.landlordPayments || []);
  add('expenses.csv',           state.expenses || []);
  add('maintenance.csv',        state.maintenance || []);
  add('contractors.csv',        state.contractors || []);
  add('companies.csv',          state.companies || []);

  // Manifest
  var org = state._currentOrg; if(org && Array.isArray(org)) org = org[0];
  var lines = [];
  lines.push('LandlordApp.io — Portfolio Backup');
  lines.push('────────────────────────────────────');
  lines.push('Generated: '+new Date().toISOString());
  lines.push('Org: '+((org&&org.name)||'—'));
  lines.push('Owner: '+((org&&org.owner_email)||'—'));
  lines.push('');
  lines.push('Files:');
  _backupEntityCounts().forEach(function(c){
    lines.push('  '+c.filename.padEnd(26)+' '+String(c.count).padStart(6)+' rows');
  });
  lines.push('');
  lines.push('How to restore:');
  lines.push('  Each CSV is a snapshot of the matching Supabase table. Column');
  lines.push('  names use app-side keys (not DB column names). For full restore,');
  lines.push('  use Settings → Import (re-maps to DB columns) or contact support.');
  csvMap['MANIFEST.txt'] = lines.join('\n');
  return csvMap;
}

/** Ensures JSZip is loaded (from CDN on demand). */
function _backupEnsureJsZip() {
  return new Promise(function(resolve, reject){
    if(_backupJsZipLoaded || window.JSZip) { _backupJsZipLoaded = true; return resolve(window.JSZip); }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = function(){ _backupJsZipLoaded = true; resolve(window.JSZip); };
    s.onerror = function(){ reject(new Error('Could not load JSZip from CDN')); };
    document.head.appendChild(s);
  });
}

/** Main entry point — downloads backup.zip to the user's machine. */
async function downloadBackupZip() {
  try {
    if(typeof showToast === 'function') showToast('Building backup…','success');
    var JSZipLib = await _backupEnsureJsZip();
    var zip = new JSZipLib();
    var csvMap = buildBackupCsvMap();
    Object.keys(csvMap).forEach(function(fn){ zip.file(fn, csvMap[fn]); });
    var blob = await zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:6}});
    var org = state._currentOrg; if(org && Array.isArray(org)) org = org[0];
    var orgSlug = ((org&&org.name)||'portfolio').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'portfolio';
    var fname = 'landlordapp-backup-'+orgSlug+'-'+new Date().toISOString().split('T')[0]+'.zip';
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    // Stamp last backup time
    if(!state.config) state.config = {};
    if(!state.config.backup) state.config.backup = {};
    state.config.backup.lastBackupAt = new Date().toISOString();
    if(typeof saveStateImmediate === 'function') saveStateImmediate({silentSuccess:true}); else saveState();
    if(typeof showToast === 'function') showToast('Backup saved · '+fname,'success');
    render();
  } catch(err) {
    console.error('Backup failed:', err);
    if(typeof showToast === 'function') showToast('Backup failed: '+(err.message||'unknown'),'error');
  }
}

function toggleWeeklyBackup(enabled) {
  if(!state.config) state.config = {};
  if(!state.config.backup) state.config.backup = {};
  state.config.backup.weeklyEmail = !!enabled;
  if(enabled && !state.config.backup.weeklyEmailTo){
    var o = state._currentOrg; if(o && Array.isArray(o)) o=o[0];
    state.config.backup.weeklyEmailTo = (o && o.owner_email) || '';
  }
  if(typeof saveStateImmediate === 'function') saveStateImmediate({silentSuccess:true}); else saveState();
  if(typeof showToast === 'function') {
    showToast(enabled ? 'Weekly backup enabled' : 'Weekly backup disabled', enabled?'success':'warn');
  }
  render();
}

function setBackupEmailTo(email) {
  if(!state.config) state.config = {};
  if(!state.config.backup) state.config.backup = {};
  state.config.backup.weeklyEmailTo = (email||'').trim();
  if(typeof saveStateImmediate === 'function') saveStateImmediate({silentSuccess:true}); else saveState();
}

/** Sends the same ZIP to the configured inbox via the app's /api/send-email
 *  endpoint. Because the ZIP can be large, we gate on < 10 MB after compression
 *  — bigger portfolios fall back to a "download manually" toast. */
async function sendBackupEmailNow() {
  try {
    var to = (state.config && state.config.backup && state.config.backup.weeklyEmailTo) || '';
    if(!to) { showToast && showToast('Set a recipient email first','error'); return; }
    if(typeof showToast === 'function') showToast('Building and sending backup email…','success');
    var JSZipLib = await _backupEnsureJsZip();
    var zip = new JSZipLib();
    var csvMap = buildBackupCsvMap();
    Object.keys(csvMap).forEach(function(fn){ zip.file(fn, csvMap[fn]); });
    var blob = await zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:6}});
    if(blob.size > 10 * 1024 * 1024) {
      if(typeof showToast === 'function') showToast('Backup is over 10 MB — please download manually for now','warn');
      return;
    }
    var b64 = await _blobToBase64(blob);
    var orgName = (function(){ var o=state._currentOrg; if(o&&Array.isArray(o))o=o[0]; return (o&&o.name)||'Portfolio'; })();
    var dateStr = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    var filename = 'landlordapp-backup-'+new Date().toISOString().split('T')[0]+'.zip';
    var subject = '['+orgName+'] Portfolio backup — '+dateStr;
    var htmlBody = '<p>Hi,</p><p>Attached is your LandlordApp portfolio backup generated on '+dateStr+'.</p>'
      + '<p>The ZIP contains a CSV file per section (properties, tenants, landlords, payments, expenses, maintenance, landlord payments, contractors, companies) plus a MANIFEST.txt.</p>'
      + '<p style="color:#718096;font-size:12px">You can disable these emails anytime in Settings → Backup.</p>';
    if(typeof sendEmail !== 'function') throw new Error('Email delivery not available');
    var res = await sendEmail(to, subject, 'Portfolio backup attached', 'system', {
      html: htmlBody,
      attachments: [{ filename: filename, content: b64, contentType: 'application/zip' }]
    });
    if(res && res.error) throw new Error(res.error.message || 'Email delivery failed');
    if(typeof showToast === 'function') showToast('Backup emailed to '+to,'success');
  } catch(err) {
    console.error('sendBackupEmailNow failed:', err);
    if(typeof showToast === 'function') showToast('Could not send backup email: '+(err.message||'unknown'),'error');
  }
}

function _blobToBase64(blob) {
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){
      var dataUrl = reader.result || '';
      var comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.substring(comma+1) : dataUrl);
    };
    reader.onerror = function(){ reject(reader.error); };
    reader.readAsDataURL(blob);
  });
}

// ── Landlord-payment purge ─────────────────────────────────────────────────
// Mirrors the overdue-rent purge pattern: drops pending rows older than 7 days,
// keeps anything paid (history of money sent) and anything in the last week or
// future (still actionable). landlord_payments has both due_date and paid_date
// columns — we filter on dueDate only because a "pending" row by definition
// hasn't been paid yet.
function _countOldPendingLandlordPayments() {
  var cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate() - 7);
  var rows = (state.landlordPayments || []).filter(function(lp){
    if (!lp) return false;
    if (String(lp.status||'').toLowerCase() === 'paid') return false;
    var d = lp.dueDate ? new Date(lp.dueDate) : null;
    return d && !isNaN(d.getTime()) && d < cutoff;
  });
  return rows.length;
}

async function purgeOldPendingLandlordPayments() {
  if (typeof requirePerm === 'function' && !requirePerm('canEdit', 'purge old landlord-payment records')) return;
  var count = _countOldPendingLandlordPayments();
  if (!count) {
    if (typeof showToast === 'function') showToast('No old pending landlord payments to clean up','success');
    return;
  }
  var msg = 'Delete ' + count + ' pending landlord-payment row' + (count===1?'':'s') + ' dated more than 7 days ago?\n\n'
    + 'Paid landlord payments are NEVER deleted (full audit trail kept).\n'
    + 'Pending rows from the last 7 days, or in the future, are also kept.\n\n'
    + 'This cannot be undone.';
  if (!confirm(msg)) return;

  var cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate() - 7);
  var idsToDelete = [];
  state.landlordPayments = (state.landlordPayments || []).filter(function(lp){
    if (!lp) return false;
    if (String(lp.status||'').toLowerCase() === 'paid') return true;
    var d = lp.dueDate ? new Date(lp.dueDate) : null;
    if (d && !isNaN(d.getTime()) && d < cutoff) {
      if (lp.id) idsToDelete.push(lp.id);
      return false;
    }
    return true;
  });
  if (idsToDelete.length && typeof supa !== 'undefined' && _currentOrgId) {
    try {
      for (var i = 0; i < idsToDelete.length; i += 100) {
        var chunk = idsToDelete.slice(i, i + 100);
        var r = await supa.from('landlord_payments').delete().in('id', chunk).eq('org_id', _currentOrgId);
        if (r.error) console.warn('[purgeOldLandlordPayments] chunk', i, 'failed:', r.error.message);
      }
    } catch (e) {
      console.warn('[purgeOldLandlordPayments] delete error:', e && e.message);
    }
  }

  if (typeof saveState === 'function') saveState();
  if (typeof render === 'function') render();
  if (typeof showToast === 'function') showToast('Cleaned up ' + count + ' pending landlord payment' + (count===1?'':'s'),'success');
}

if(typeof window !== 'undefined') {
  window.renderBackupTab     = renderBackupTab;
  window.downloadBackupZip   = downloadBackupZip;
  window.toggleWeeklyBackup  = toggleWeeklyBackup;
  window.setBackupEmailTo    = setBackupEmailTo;
  window.sendBackupEmailNow  = sendBackupEmailNow;
  window.buildBackupCsvMap   = buildBackupCsvMap;
}
