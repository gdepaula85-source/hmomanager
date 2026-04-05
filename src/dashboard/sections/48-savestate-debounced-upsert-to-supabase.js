// ── saveState: debounced upsert to Supabase ───────────────
var _saveTimer = null;
function saveState(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_doSupaSave, 1500);
  // Save local-only state immediately to localStorage
  try {
    var localKeys = ['rentSchedule','roomMedia','vault','voidDates','lateFeeConfig','propDocs','users','companies','config','roles','maintExtras','dealInputs'];
    localKeys.forEach(function(k){
      if(state[k]!==undefined) {
        try { localStorage.setItem('pm_local_'+k, JSON.stringify(state[k])); }
        catch(e) { console.warn('localStorage full for key:', k, e); }
      }
    });
    // Persist current page so refresh returns to same page
    try { localStorage.setItem('pm_local_page', state.page); } catch(e) {}
  } catch(e) {}
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

async function _supaUpsert(table, rows, opts) {
  try {
    var r = await supa.from(table).upsert(rows, opts);
    if(r.error) console.warn('Save warning ['+table+']:', r.error.message);
  } catch(e) { console.warn('Save error ['+table+']:', e.message); }
}

async function _doSupaSave(){
  if(!_currentOrgId) { console.warn('_doSupaSave: no org_id — skipping save'); return; }
  // Stamp org_id on every row before saving
  function withOrg(rows){ return rows.map(function(r){ return Object.assign({}, r, {org_id: _currentOrgId}); }); }

  var landlordRows = withOrg(state.landlords.map(landlordToRow));
  var propRows = withOrg(state.properties.map(function(p){
    var r = propToRow(p);
    delete r.room_list;
    return r;
  }));
  var tenantRows = withOrg(state.tenants.map(function(t){
    var r = tenantToRow(t);
    if(!r.portal_username) delete r.portal_username;
    if(!r.portal_password) delete r.portal_password;
    return r;
  }));

  await Promise.all([
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
  if(typeof showToast === 'function') showToast('✓ Saved', 'success');
}
