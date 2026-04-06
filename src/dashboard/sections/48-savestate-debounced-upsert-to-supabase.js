// ── saveState: debounced upsert to Supabase ───────────────
var _saveTimer = null;
function _persistLocalKeys(){
  try {
    var localKeys = ['rentSchedule','roomMedia','vault','voidDates','lateFeeConfig','propDocs','users','companies','config','roles','maintExtras','dealInputs'];
    localKeys.forEach(function(k){
      if(state[k]!==undefined) {
        try { localStorage.setItem('pm_local_'+k, JSON.stringify(state[k])); }
        catch(e) { console.warn('localStorage full for key:', k, e); }
      }
    });
    try { localStorage.setItem('pm_local_page', state.page); } catch(e) {}
  } catch(e) {}
}
function saveState(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function(){ _doSupaSave({}); }, 1500);
  _persistLocalKeys();
}
/** Flush to Supabase now (e.g. archive/restore). Default saveState() waits 1.5s — refresh before then loses changes. */
function saveStateImmediate(opts){
  clearTimeout(_saveTimer);
  _saveTimer = null;
  _persistLocalKeys();
  return _doSupaSave(opts || {});
}
function showToast(msg, type) {
  var el = document.getElementById('pm-toast');
  if(!el) {
    el = document.createElement('div');
    el.id = 'pm-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;transition:opacity .3s;pointer-events:none;font-family:inherit';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type==='error' ? '#FEE2E2' : '#D1FAE5';
  el.style.color = type==='error' ? '#B91C1C' : '#065F46';
  el.style.border = '1px solid ' + (type==='error' ? '#FECDD3' : '#A7F3D0');
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.style.opacity='0'; }, 2000);
}

/** Single-row patch for archive/restore — awaited in UI so refresh always sees DB truth. */
async function persistPropertyArchiveToSupabase(p) {
  if (!_currentOrgId || !p || !p.id) {
    console.warn('persistPropertyArchiveToSupabase: missing org or property id');
    return { error: { message: 'Not signed in or property missing.' } };
  }
  var isArch = p.status === 'archived';
  var archivedAt = isArch && p.archivedDate
    ? String(p.archivedDate).split('T')[0]
    : null;
  var res = await supa
    .from('properties')
    .update({
      status: isArch ? 'archived' : 'active',
      archived_at: archivedAt
    })
    .eq('id', String(p.id))
    .eq('org_id', _currentOrgId)
    .select('id');
  if (res.error) return res;
  if (!res.data || res.data.length === 0) {
    return { error: { message: 'Could not update property (no row updated). Check RLS policies allow update on properties for your org.' } };
  }
  return res;
}

async function _supaUpsert(table, rows, opts) {
  try {
    var r = await supa.from(table).upsert(rows, opts);
    if(r.error) {
      console.warn('Save warning ['+table+']:', r.error.message);
      return r.error;
    }
    return null;
  } catch(e) {
    console.warn('Save error ['+table+']:', e.message);
    return { message: e.message || 'Save failed' };
  }
}

function isPlanOrOrgLockSaveError(err) {
  var msg = String((err && err.message) || '');
  return /Plan limit reached/i.test(msg) || /Organisation is\s+(paused|cancelled)/i.test(msg);
}

/** Avoid spamming toasts when DB rejects every autosave (e.g. over property cap). */
var _lastPlanLimitToastAt = 0;
var PLAN_LIMIT_TOAST_COOLDOWN_MS = 180000;

function friendlyDbSaveError(err){
  var msg = String((err && err.message) || '');
  if (!msg) return 'Could not save changes. Please try again.';
  if (/Plan limit reached:\s*max\s*\d+\s*properties/i.test(msg)) {
    return 'Property limit reached for your current plan. Upgrade plan or archive an unused property.';
  }
  if (/Plan limit reached:\s*max\s*\d+\s*active tenants/i.test(msg)) {
    return 'Active tenant limit reached for your current plan. Upgrade plan or set inactive tenants first.';
  }
  if (/Plan limit reached:\s*max\s*\d+\s*users/i.test(msg)) {
    return 'User seat limit reached for your current plan. Upgrade plan before inviting more users.';
  }
  if (/Organisation is\s+(paused|cancelled)/i.test(msg)) {
    return 'This organisation is not active, so changes are locked. Reactivate billing to continue.';
  }
  return msg.length > 180 ? 'Could not save changes. Please try again.' : msg;
}

async function _doSupaSave(opts){
  opts = opts || {};
  if(!_currentOrgId) { console.warn('_doSupaSave: no org_id — skipping save'); return; }
  // Stamp org_id on every row before saving
  function withOrg(rows){ return rows.map(function(r){ return Object.assign({}, r, {org_id: _currentOrgId}); }); }

  var landlordRows = withOrg(state.landlords.map(landlordToRow));
  var propRows = withOrg(state.properties.map(function(p){
    var r = propToRow(p);
    if (r.archived_at == null || r.archived_at === '') delete r.archived_at;
    return r;
  }));
  var tenantRows = withOrg(state.tenants.map(function(t){
    var r = tenantToRow(t);
    if(!r.portal_username) delete r.portal_username;
    if(!r.portal_password) delete r.portal_password;
    return r;
  }));

  var errors = await Promise.all([
    _supaUpsert('landlords', landlordRows, {onConflict:'id'}),
    _supaUpsert('properties', propRows, {onConflict:'id'}),
    _supaUpsert('tenants', tenantRows, {onConflict:'id'}),
    _supaUpsert('payments', withOrg(state.payments.map(paymentToRow)), {onConflict:'id'}),
    _supaUpsert('expenses', withOrg(state.expenses.map(expenseToRow)), {onConflict:'id'}),
    _supaUpsert('maintenance', withOrg(state.maintenance.map(maintenanceToRow)), {onConflict:'id'}),
    _supaUpsert('contractors', withOrg((state.contractors||[]).map(contractorToRow)), {onConflict:'id'}),
    _supaUpsert('landlord_payments',
      withOrg(state.landlordPayments.filter(function(lp){return lp.propId&&lp.monthKey;}).map(landlordPaymentToRow)),
      {onConflict:'property_id,month_key',ignoreDuplicates:false})
  ]);
  var firstErr = (errors||[]).find(function(e){ return !!e; });
  if(firstErr){
    if (isPlanOrOrgLockSaveError(firstErr)) {
      var now = Date.now();
      if (now - _lastPlanLimitToastAt < PLAN_LIMIT_TOAST_COOLDOWN_MS) {
        return;
      }
      _lastPlanLimitToastAt = now;
    }
    if(typeof showToast === 'function') showToast(friendlyDbSaveError(firstErr), 'error');
    return;
  }
  if(!opts.silentSuccess && typeof showToast === 'function') showToast('✓ Saved', 'success');
}
