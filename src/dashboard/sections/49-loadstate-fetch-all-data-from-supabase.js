// ── loadState: fetch all data from Supabase ───────────────
// Slim tenant columns — explicitly excludes the three heaviest base64 fields
// (signature PNG, landlord-side signature PNG, agreement HTML snapshot) so
// loadState doesn't pull tens of MBs on every dashboard mount.
// _loadTenantHeavyFields lazy-loads them on demand when the agreement viewer /
// "View signature" / signed PDF flow actually needs them. Without this
// slimming, a 140-tenant portfolio with stored signatures was pulling ~14MB
// just for the tenants table — enough to trip Supabase's 8s statement_timeout
// and produce "canceling statement due to timeout" + "Failed to fetch".
// Property/tenant docs are kept full-fat because the doc preview/download UI
// reads dataUrl directly; slimming them needs a separate UI-layer lazy-load.
var TENANT_LIST_COLS = [
  'id','org_id','name','property_id','property_name','room_number','room_type',
  'rent','freq','pay_day','pay_day_of_month','method','status','arrears',
  'deposit','deposit_status','whatsapp','email','move_in','start_date',
  'notice_date','move_out_date','notes','payment_history','portal_username',
  'portal_password','dob','nationality','previous_tenancies',
  // signature meta (the actual base64 PNG is loaded on demand)
  'signature_saved_at','signature_signer_name','signature_token','signature_token_expires_at',
  'signed_agreement_type','signed_landlord_name','signed_landlord_title',
  'signed_landlord_date','signed_ip','signed_user_agent','signed_agreement_pdf_path',
  // archived_at added by the 2026-05 field-fixes migration. Without it the
  // Archived tab can't show the date a tenant was archived.
  'client_id','created_at','archived_at'
].join(',');
// Doc rows omit data_url — lazy-loaded by _loadDocDataUrl when the user
// actually clicks Preview / Download. Modern docs store a Supabase Storage URL
// (small) in data_url; legacy docs may store the full base64 (up to 10MB per
// row). On a portfolio with even a few dozen legacy uploads, eagerly fetching
// data_url is the difference between a 200ms load and a timeout.
//
// Two separate column lists because the schemas don't match — property_docs
// has property_id + expires_at, tenant_docs has tenant_id only. Sharing one
// list 400s with "column does not exist" because PostgREST validates every
// requested column against the table schema.
var PROP_DOC_LIST_COLS   = 'id,org_id,property_id,name,type,size,storage_path,expires_at,uploaded_at';
var TENANT_DOC_LIST_COLS = 'id,org_id,tenant_id,name,type,size,storage_path,uploaded_at';

// Lazy-loads the heavy tenant fields (signature PNG, landlord-side signature
// PNG, agreement HTML snapshot) on demand and patches them onto the
// in-memory tenant object. These are intentionally excluded from loadState
// to keep the boot fetch lean — base64 signatures alone can be ~14MB across
// 140 tenants. Caches via t._heavyLoaded so the second call is a no-op.
// Callers (viewSignedAgreement, _viewTenantSignature, generateDealAnalyzerPDF
// when re-rendering an agreement, etc.) should `await` this before reading
// t.signature / t.signedLandlordSig / t.signedAgreementHtml.
async function _loadTenantHeavyFields(tenantId) {
  var t = (state.tenants||[]).find(function(x){ return String(x.id) === String(tenantId); });
  if (!t) return null;
  if (t._heavyLoaded) return t;
  try {
    var r = await supa.from('tenants')
      .select('signature, signed_landlord_sig, signed_agreement_html')
      .eq('id', tenantId)
      .eq('org_id', _currentOrgId)
      .maybeSingle();
    if (r.error) {
      console.warn('[_loadTenantHeavyFields] fetch failed:', r.error.message);
      return t;
    }
    if (r.data) {
      t.signature           = r.data.signature || null;
      t.signedLandlordSig   = r.data.signed_landlord_sig || null;
      t.signedAgreementHtml = r.data.signed_agreement_html || null;
    }
    t._heavyLoaded = true;
  } catch (e) {
    console.warn('[_loadTenantHeavyFields] error:', e && e.message);
  }
  return t;
}

async function loadState(){
  if(!_currentOrgId){
    // Do not load unscoped data before auth/org resolution.
    console.warn('loadState skipped: org not resolved yet');
    return false;
  }
  // Reset the save-diff cache: state about to be loaded from DB IS the new
  // baseline. Without this, the next saveState() would push every table back
  // up unchanged because the diff cache is empty / stale from a prior org.
  if (typeof _resetSaveSnapshot === 'function') _resetSaveSnapshot();
  setAppBootMessage('Loading your data…');
  // Time each query so a slow table is obvious in DevTools. Logged as
  // [loadState] table=Xms — useful when the user reports another timeout.
  var _loadStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  try{
    var results = await Promise.all([
      supa.from('landlords').select('*').eq('org_id', _currentOrgId),
      supa.from('properties').select('*').eq('org_id', _currentOrgId),
      supa.from('tenants').select(TENANT_LIST_COLS).eq('org_id', _currentOrgId),
      supa.from('payments').select('*').eq('org_id', _currentOrgId),
      supa.from('expenses').select('*').eq('org_id', _currentOrgId),
      supa.from('maintenance').select('*').eq('org_id', _currentOrgId),
      supa.from('landlord_payments').select('*').eq('org_id', _currentOrgId),
      supa.from('contractors').select('*').eq('org_id', _currentOrgId),
      supa.from('organisations').select('billing_email,owner_email,name,plan,status,trial_ends_at,stripe_customer_id,stripe_subscription_id,billing_override,billing_override_note,public_listings_whatsapp,public_listings_whatsapp_skipped,public_listings_tagline,currency,currency_symbol,language,date_format').eq('id', _currentOrgId).maybeSingle(),
      supa.from('companies').select('*').eq('org_id', _currentOrgId),
      supa.from('property_docs').select(PROP_DOC_LIST_COLS).eq('org_id', _currentOrgId),
      supa.from('tenant_docs').select(TENANT_DOC_LIST_COLS).eq('org_id', _currentOrgId),
      supa.from('clients').select('*').eq('org_id', _currentOrgId)
    ]);
    var _loadElapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - _loadStart;
    console.log('[loadState] all tables loaded in ' + Math.round(_loadElapsed) + 'ms');
    // Surface partial load failures — silently empty arrays masked permission /
    // schema issues (e.g. missing `inspections` column made properties look empty).
    var _loadLabels = ['landlords','properties','tenants','payments','expenses','maintenance','landlord_payments','contractors','organisations','companies','property_docs','tenant_docs','clients'];

    // Schema-resilient fallbacks: if our slim column list references a column
    // that doesn't exist on this Supabase project (e.g. user hasn't run a
    // migration yet), PostgREST returns 42703 / 'column ... does not exist'.
    // Retry the failed query with select('*') so the dashboard still loads
    // (we lose the perf win for THAT table only, never the whole boot).
    function _isMissingColErr(e){
      if (!e) return false;
      var msg = String(e.message || '').toLowerCase();
      var code = String(e.code || '');
      return code === '42703' || code === 'PGRST204' || code === 'PGRST116'
          || msg.indexOf('column') >= 0 && msg.indexOf('does not exist') >= 0
          || msg.indexOf('could not find') >= 0;
    }
    async function _retryAllCols(idx, table, idCol, idVal) {
      try {
        var r = (idCol === 'id')
          ? await supa.from(table).select('*').eq(idCol, idVal).maybeSingle()
          : await supa.from(table).select('*').eq(idCol, idVal);
        if (!r.error) {
          console.warn('[loadState] '+table+' fell back to select(*) — column missing on this project, recommend running pending migrations');
          results[idx] = r;
        }
      } catch (e) {
        console.warn('[loadState] '+table+' fallback failed:', e && e.message);
      }
    }
    if (results[2] && results[2].error && _isMissingColErr(results[2].error)) {
      await _retryAllCols(2, 'tenants', 'org_id', _currentOrgId);
    }
    if (results[10] && results[10].error && _isMissingColErr(results[10].error)) {
      await _retryAllCols(10, 'property_docs', 'org_id', _currentOrgId);
    }
    if (results[11] && results[11].error && _isMissingColErr(results[11].error)) {
      await _retryAllCols(11, 'tenant_docs', 'org_id', _currentOrgId);
    }

    var errors = [];
    results.forEach(function(r,i){
      if(r && r.error) errors.push({table:_loadLabels[i], message:r.error.message||String(r.error), code:r.error.code||''});
    });
    if(errors.length){
      console.warn('Supabase load errors:', errors);
      if(typeof showToast === 'function'){
        var names = errors.map(function(e){return e.table;}).join(', ');
        showToast('Some data failed to load ('+names+'). Open DevTools → Console for details.', 'error');
      }
    }
    if (results[8] && results[8].data) {
      state._currentOrg = Object.assign({}, state._currentOrg || {}, results[8].data);
    }
    await mergeOrgEmailSettingsIfAvailable();
    state.landlords        = (results[0].data||[]).map(rowToLandlord);
    state.properties       = (results[1].data||[]).map(rowToProp);
    state.tenants          = (results[2].data||[]).map(rowToTenant);
    // Seed the cross-session persisted-IDs sets with every property + tenant
    // id we just pulled from DB. The autosave's live-IDs check uses this to
    // distinguish "row was once persisted but now gone (deleted elsewhere —
    // strip)" from "row was created locally, never saved yet (keep)".
    if (typeof _setPersistedTenantIds === 'function') {
      _setPersistedTenantIds(state.tenants.map(function(t){ return t.id; }));
    }
    if (typeof _setPersistedPropertyIds === 'function') {
      _setPersistedPropertyIds(state.properties.map(function(p){ return p.id; }));
    }
    state.payments         = (results[3].data||[]).map(rowToPayment);
    state.expenses         = (results[4].data||[]).map(rowToExpense);
    state.maintenance      = (results[5].data||[]).map(rowToMaintenance);
    if(!state.maintExtras) state.maintExtras={};
    state.maintenance.forEach(function(m){
      if(!state.maintExtras[m.id]) state.maintExtras[m.id]={photos:[]};
      var mx=state.maintExtras[m.id];
      if(m.jobCost&&!mx.cost) mx.cost=m.jobCost;
      if(m.invoiceName&&!mx.invoiceName) mx.invoiceName=m.invoiceName;
      if(m.invoiceUrl&&!mx.invoiceUrl) mx.invoiceUrl=m.invoiceUrl;
    });
    state.landlordPayments = (results[6].data||[]).map(rowToLandlordPayment);
    state.contractors      = (results[7].data||[]).map(rowToContractor);
    state.companies        = (results[9].data||[]).map(rowToCompany);

    state.propDocs = {};
    (results[10].data||[]).forEach(function(row){
      var d = rowToDoc(row);
      if(!state.propDocs[d.propertyId]) state.propDocs[d.propertyId] = [];
      state.propDocs[d.propertyId].push(d);
    });

    state.vault = {};
    (results[11].data||[]).forEach(function(row){
      var d = rowToVaultDoc(row);
      if(!state.vault[d.tenantId]) state.vault[d.tenantId] = [];
      state.vault[d.tenantId].push(d);
    });

    // Business / individual clients (parents of multi-tenancy operators).
    // Empty array if the clients migration hasn't run yet — feature degrades
    // gracefully to today's per-tenant behaviour.
    state.clients = ((results[12]||{}).data||[]).map(rowToClient);
    var _ttl = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - _loadStart;
    console.log('[loadState] state populated in ' + Math.round(_ttl) + 'ms — '
      + state.tenants.length + ' tenants, '
      + state.payments.length + ' payments, '
      + state.properties.length + ' properties');
    // Compute t.paid from most recent payment for each tenant
    state.tenants.forEach(function(t){
      var tenantPays = state.payments.filter(function(p){
        return (p.tenantId===t.id||p.tenantName===t.name) && p.status==='paid' && p.paidDate;
      });
      if(tenantPays.length){
        tenantPays.sort(function(a,b){return new Date(b.paidDate)-new Date(a.paidDate);});
        var d = new Date(tenantPays[0].paidDate);
        t.paid = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      }
    });
    // Load plan config from saas_config (superadmin-managed; no org_id scope — public read)
    try {
      var scRes = await supa.from('saas_config').select('key,value').eq('key','plan_config').maybeSingle();
      if(scRes.data && scRes.data.value) {
        if(!state.config) state.config = {};
        state.config.planConfig = JSON.parse(scRes.data.value);
      }
    } catch(e) { /* table may not exist yet */ }

    // Restore local-only state from localStorage (non-critical, fast UI state)
    try {
      var localKeys = ['rentSchedule','roomMedia','voidDates','lateFeeConfig','maintExtras','dealInputs'];
      localKeys.forEach(function(k){
        var storageKey = orgStorageKey('pm_local_' + k);
        var raw = localStorage.getItem(storageKey);
        if(raw) { try{ state[k]=JSON.parse(raw); }catch(e){} }
      });
      // Always boot to Dashboard regardless of last-visited page. Earlier the
      // last-visited page was restored from localStorage which made it confusing
      // (users would land on whatever obscure page they'd last opened).
      state.page = 'dashboard';
    } catch(e) {}
    // Room photos loaded from localStorage cache — full sync runs in background after first render
    // (syncRoomPhotosBackground is called via setTimeout in the render chain)

    // Load property docs from Supabase Storage (refresh signed URLs)
    try {
      if(state.propDocs) {
        Object.keys(state.propDocs).forEach(function(pid){
          (state.propDocs[pid]||[]).forEach(function(doc){
            if(doc.storagePath && !doc.dataUrl) {
              // Refresh expired signed URL silently
              supa.storage.from('property-docs').createSignedUrl(doc.storagePath, 31536000)
                .then(function(r){ if(r.data) { doc.dataUrl=r.data.signedUrl; } })
                .catch(function(){});
            }
          });
        });
      }
      if(state.vault) {
        Object.keys(state.vault).forEach(function(tid){
          (state.vault[tid]||[]).forEach(function(doc){
            if(doc.storagePath && !doc.dataUrl) {
              supa.storage.from('tenant-docs').createSignedUrl(doc.storagePath, 31536000)
                .then(function(r){ if(r.data) { doc.dataUrl=r.data.signedUrl; } })
                .catch(function(){});
            }
          });
        });
      }
    } catch(_de) { console.warn('Doc URL refresh error:', _de); }

    // Migrate roomMedia keys from old numeric ids to new UUID ids
    if(state.roomMedia && Object.keys(state.roomMedia).length > 0) {
      var newMedia = {};
      state.properties.forEach(function(p) {
        // Find old numeric key entries for this property
        Object.keys(state.roomMedia).forEach(function(oldKey) {
          // Check if this is a numeric-id key for this property
          var parts = oldKey.split('_');
          if(parts.length >= 2) {
            var lastNum = parts[parts.length-1];
            var possibleOldId = parts.slice(0,-1).join('_');
            // Try to match by property name (numeric IDs were 1001, 1002 etc)
            var oidNum = parseInt(possibleOldId);
            if(!isNaN(oidNum) && oidNum >= 1000 && oidNum <= 2000) {
              // This looks like an old numeric key - remap to use actual p.id
              // We can't perfectly match but copy under new key too
              var newKey = p.id + '_' + lastNum;
              if(state.roomMedia[oldKey] && state.roomMedia[oldKey].photos && state.roomMedia[oldKey].photos.length > 0) {
                newMedia[newKey] = state.roomMedia[oldKey];
              }
            } else {
              newMedia[oldKey] = state.roomMedia[oldKey];
            }
          }
        });
      });
      if(Object.keys(newMedia).length > 0) state.roomMedia = newMedia;
    }
    // Back-fill propName for landlord payments loaded from Supabase
    state.landlordPayments.forEach(function(lp){
      if((!lp.propName||lp.propName==='') && lp.propId){
        var p = state.properties.find(function(x){return x.id===lp.propId;});
        if(p) lp.propName = p.name;
      }
      if((!lp.landlordName||lp.landlordName==='') && lp.landlordId){
        var ll = state.landlords.find(function(x){return x.id===lp.landlordId;});
        if(ll) lp.landlordName = ll.name;
      }
    });
    console.log('Loaded from Supabase:', state.landlords.length, 'landlords,', state.properties.length, 'props,', state.tenants.length, 'tenants');
    // Load config + roles from Supabase organisations.app_config (authoritative source)
    // We fetch this separately to avoid breaking the main loadState if the column is missing
    try {
      var configRes = await supa.from('organisations').select('app_config').eq('id', _currentOrgId).maybeSingle();
      var orgAppConfig = (configRes && configRes.data && configRes.data.app_config) ? configRes.data.app_config : null;
      
      if (orgAppConfig && typeof orgAppConfig === 'object') {
        if (orgAppConfig.config && typeof orgAppConfig.config === 'object') {
          state.config = Object.assign({}, state.config || {}, orgAppConfig.config);
        }
        if (orgAppConfig.roles && typeof orgAppConfig.roles === 'object') {
          state.roles = Object.assign({}, state.roles || {}, orgAppConfig.roles);
        }
      } else {
        // Fallback: try localStorage if app_config column missing or empty
        ['config','roles'].forEach(function(k) {
          var raw = localStorage.getItem(orgStorageKey('pm_local_' + k));
          if (raw) { try { state[k] = JSON.parse(raw); } catch(e) {} }
        });
      }
    } catch(e2) {
      console.warn('Silent skip: Failed to load app_config from org:', e2);
    }
    // Auto-add new pages (diary) to existing role configs — runs AFTER both branches
    ['admin','manager','maintenance','viewer'].forEach(function(rk){
      if(state.roles[rk] && state.roles[rk].pages && state.roles[rk].pages.indexOf('diary')<0){
        state.roles[rk].pages.push('diary');
      }
    });
    // Apply branding (portfolio name → sidebar sub, site title → tab title, logo)
    if(typeof applyBranding === 'function') applyBranding();
    return true;
  }catch(e){
    console.error('loadState error:', e);
    showToast && showToast('Database error — running in offline mode', 'error');
    return false;
  }
}
async function backfillPaymentDueDates() {
  // Fix existing Supabase payments that have due_date=null by using paid_date as proxy
  // This clears phantom outstanding entries caused by null due_date dedup failure
  var toFix = state.payments.filter(function(p) {
    return !p.dueDate && p.paidDate;
  });
  if(toFix.length === 0) {
    showToast('No payments need fixing ✓', 'success');
    return;
  }
  showToast('Fixing ' + toFix.length + ' payments...', 'success');
  var fixed = 0;
  for(var i = 0; i < toFix.length; i++) {
    var p = toFix[i];
    // Use paid_date as due_date proxy — close enough for weekly dedup
    var paidStr = p.paidDate;
    var parts = String(paidStr).replace(/[^0-9\-]/g,'').split('T')[0];
    var isoDate = null;
    // Parse "21 Mar 2026" (en-GB) or ISO "2026-03-21" format
    var _bmonths = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    if(paidStr) {
      var _bdp = String(paidStr).split(' ');
      if(_bdp.length===3 && _bmonths[_bdp[1]]!==undefined) {
        var _bdt = new Date(+_bdp[2], _bmonths[_bdp[1]], +_bdp[0]);
        isoDate = _bdt.getFullYear()+'-'+String(_bdt.getMonth()+1).padStart(2,'0')+'-'+String(_bdt.getDate()).padStart(2,'0');
      } else if(paidStr.match && paidStr.match(/\d{4}-\d{2}-\d{2}/)) {
        isoDate = paidStr.split('T')[0];
      }
    }
    if(!isoDate) continue;
    p.dueDate = isoDate;
    var pp = paidStr.split('T')[0].split('-');
    p._dueDateRaw = isoDate.split('-').length===3 ? new Date(+isoDate.split('-')[0],+isoDate.split('-')[1]-1,+isoDate.split('-')[2]).getTime() : null;
    // Update Supabase
    try {
      await supa.from('payments').update({due_date: isoDate}).eq('id', p.id);
      fixed++;
    } catch(e) {}
  }
  saveState();
  render();
  showToast('Fixed ' + fixed + ' of ' + toFix.length + ' payments ✓', 'success');
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function doLogOut() {
  try { await supa.auth.signOut(); } catch(e) { console.warn('signOut:', e); }
  localStorage.removeItem(orgStorageKey('pm_local_users'));
  window.location.href = '/';
}

// Pull the latest data from Supabase without forcing the user to sign out and
// back in. Flushes any pending debounced autosave first so unsaved local
// changes aren't lost, then re-runs the same loadState → runAfterSupabaseLoad
// → render sequence the boot path uses. A module-level lock prevents the
// button being tapped twice during the round-trip.
var _refreshInFlight = false;
async function refreshAppData() {
  if (_refreshInFlight) return;
  if (!_currentOrgId) {
    if (typeof showToast === 'function') showToast('Sign in first', 'error');
    return;
  }
  _refreshInFlight = true;
  // Visual feedback — find any refresh button(s) on the page and disable them
  // while in flight. We re-style by attribute so renderNav rerunning during
  // the refresh doesn't lose the spinner.
  var btns = document.querySelectorAll('[data-refresh-btn]');
  btns.forEach(function(b){ b.disabled = true; b.setAttribute('data-refreshing','1'); });
  try {
    // Flush any pending debounced save before reloading — otherwise local
    // edits made in the last 1.5s would be overwritten by DB truth.
    if (typeof saveStateImmediate === 'function') {
      try { await saveStateImmediate({ silentSuccess: true }); } catch(e) { console.warn('refresh: pre-flush failed:', e && e.message); }
    }
    var loaded = await loadState();
    if (!loaded) {
      if (typeof showToast === 'function') showToast('Could not refresh data.', 'error');
      return;
    }
    if (typeof runAfterSupabaseLoad === 'function') runAfterSupabaseLoad();
    if (typeof render === 'function') render();
    if (typeof showToast === 'function') showToast('Data refreshed ✓', 'success');
  } catch (e) {
    console.warn('refreshAppData failed:', e);
    if (typeof showToast === 'function') showToast('Refresh failed: ' + ((e && e.message) || 'unknown'), 'error');
  } finally {
    _refreshInFlight = false;
    document.querySelectorAll('[data-refresh-btn]').forEach(function(b){
      b.disabled = false; b.removeAttribute('data-refreshing');
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE  (company profiles, logo, site config, account)
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════
// EMAIL TRIGGER FRAMEWORK
// ══════════════════════════════════════════════════════════════════════
var EMAIL_TRIGGERS = {
  rent_reminder_3day:{id:'rent_reminder_3day',label:'Rent Due — 3 Days Before',type:'tenant',active:false,template:'Hi {name},\n\nReminder: your rent of £{amount} is due on {date}.\n\nThank you,\n{company}'},
  rent_reminder_day: {id:'rent_reminder_day', label:'Rent Due — Day Of',       type:'tenant',active:false,template:'Hi {name},\n\nYour rent of £{amount} is due today. Please arrange payment.\n\nThank you,\n{company}'},
  rent_overdue_3day: {id:'rent_overdue_3day', label:'Rent Overdue — 3 Days',   type:'tenant',active:false,template:'Hi {name},\n\nYour rent of £{amount} due {date} is unpaid. Please contact us urgently.\n\n{company}'},
  rent_overdue_week: {id:'rent_overdue_week', label:'Rent Overdue — 1 Week',   type:'tenant',active:false,template:'Hi {name},\n\nYour rent of £{amount} is 7 days overdue. Please contact us immediately.\n\n{company}'},
  move_in_welcome:   {id:'move_in_welcome',   label:'Move-in Welcome Email',   type:'tenant',active:false,template:'Hi {name},\n\nWelcome to {property}! Your tenancy begins on {date}.\n\n{company}'},
  notice_confirm:    {id:'notice_confirm',    label:'Notice Confirmation',     type:'tenant',active:false,template:'Hi {name},\n\nThis confirms your notice to vacate {property} on {date}.\n\n{company}'},
  compliance_expiry: {id:'compliance_expiry', label:'Compliance Cert Expiry',  type:'manager',active:false,template:'Alert: {doc_type} for {property} expires {date} ({days} days).'},
  payment_receipt:   {id:'payment_receipt',   label:'Payment Receipt to Tenant',type:'tenant',active:false,template:'Hi {name},\n\nThank you for your payment of £{amount}.\n\n{company}'},
  landlord_payment_notice:{id:'landlord_payment_notice',label:'Payment Notice to Landlord',type:'landlord',active:false,template:'Hi {landlord},\n\nRent of £{amount} collected from {name} at {property}.\n\n{company}'},
  property_doc_share:{id:'property_doc_share',label:'Share Property Doc with Tenant',type:'tenant',active:false,template:'Hi {name},\n\nA property document has been shared with you.\n\n{company}'},
  weekly_report:     {id:'weekly_report',     label:'Weekly Portfolio Report',  type:'manager',active:false,schedule:'Monday 09:00'},
  monthly_report:    {id:'monthly_report',    label:'Monthly P&L Summary',     type:'manager',active:false,schedule:'1st of month 09:00'},
};

function getEmailConfig(){
  var ls = {};
  try {
    ls = JSON.parse(localStorage.getItem(orgStorageKey('pm_email_config'))||'{}');
  } catch(e) {}
  var o = state._currentOrg || {};
  var db = o.email_settings && typeof o.email_settings === 'object' ? o.email_settings : {};
  return {
    triggers: Object.assign({}, ls.triggers || {}, db.triggers || {}),
    managerEmail: db.managerEmail || ls.managerEmail || '',
  };
}

async function persistEmailSettings(cfg){
  if (!_currentOrgId) {
    showToast && showToast('No organisation loaded', 'error');
    return;
  }
  var clean = {
    triggers: cfg.triggers || {},
    managerEmail: cfg.managerEmail || '',
  };
  var { error } = await supa.from('organisations').update({ email_settings: clean }).eq('id', _currentOrgId);
  if (error) {
    var missingCol = String(error.code || '') === '42703' || String(error.message || '').indexOf('email_settings') !== -1;
    var msg = (error.message || 'Could not save email settings') + (missingCol ? ' Apply db/organisations_email_settings.sql on Supabase, then retry.' : '');
    showToast && showToast(msg, 'error');
    return false;
  }
  if (!state._currentOrg) state._currentOrg = {};
  state._currentOrg.email_settings = clean;
  return true;
}

function renderEmailSettings(){
  var cfg=getEmailConfig();
  var org = state._currentOrg || {};
  var replyHint = (org.billing_email || org.owner_email || 'your organisation billing email in Supabase');
  var html='<div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Sending (tenant &amp; manager emails)</div>';
  html+='<p style="font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 12px">Rent reminders and reports are sent via your server using <strong>LandlordApp &lt;noreply@landlordapp.io&gt;</strong> (configure <code style="font-size:11px">RESEND_API_KEY</code> on the host). Tenant replies go to: <strong>'+String(replyHint).replace(/</g,'&lt;')+'</strong> (billing email, or owner email, or your account).</p>';
  html+='<div class="field"><label class="field-label">Manager email (weekly / monthly reports)</label><input class="inp" id="ecfg-mgr" placeholder="manager@yourcompany.com" value="'+(cfg.managerEmail||'').replace(/"/g,'&quot;')+'" onchange="saveEmailField(\'managerEmail\',this.value)"></div>';
  html+='</div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:12px">Triggers</div>';
  Object.values(EMAIL_TRIGGERS).forEach(function(tr){
    var on=!!(cfg.triggers&&cfg.triggers[tr.id]);
    html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">';
    html+='<div><div style="font-size:13px;font-weight:500">'+tr.label+'</div>'+(tr.schedule?'<div style="font-size:11px;color:var(--muted)">📅 '+tr.schedule+'</div>':'')+'</div>';
    html+='<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" '+(on?'checked':'')+' data-trid="'+tr.id+'" onchange="toggleEmailTrigger(this.dataset.trid,this.checked)" style="width:16px;height:16px;accent-color:var(--accent)"><span style="font-size:12px;color:'+(on?'var(--green)':'var(--muted)')+'">'+( on?'On':'Off')+'</span></label></div>';
  });
  html+='</div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Test & Send</div>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:8px">';
  html+='<button onclick="sendTestEmail()" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">✉ Send Test Email</button>';
  html+='<button onclick="runRentReminderEmails(true)" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">🔍 Dry Run</button>';
  html+='<button onclick="runRentReminderEmails(false)" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📨 Send Reminders</button>';
  html+='<button onclick="sendScheduledReport(\'weekly\')" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📊 Weekly Report</button>';
html+='<button onclick="sendScheduledReport(\'monthly\')" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📅 Monthly P&amp;L</button>';
html+='<button onclick="runServerRentReminders(false)" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">🚀 Run CRON Now</button>';
html+='<button onclick="runServerRentReminders(true)" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">🔍 Server Dry Run</button>';
html+='</div><div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:9px;margin-top:10px;font-size:11px;color:var(--muted)">⚠ Requires <code style="font-size:11px">RESEND_API_KEY</code> and verified domain on the Node server (<code style="font-size:11px">POST /api/email/send</code>). Auth &amp; billing emails use Supabase / Stripe separately. Gmail may file messages under <strong>Updates</strong>; drag one message to <strong>Primary</strong> and choose &quot;Yes&quot; so future mail lands in the inbox.</div>';
  html+='</div>';
  // Email log section
html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:14px">';
html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
html+='<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase">Email Log</div>';
html+='<button onclick="loadEmailLog()" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">Refresh</button>';
  html+='</div>';
html+='<div id="email-log-container" style="font-size:12px;color:var(--muted)">Click Refresh to load email history</div>';
  html+='</div></div>';
  return html;
}

function saveEmailField(key,value){
  var cfg=getEmailConfig();
  cfg[key]=value;
  persistEmailSettings(cfg).then(function(ok){
    if(ok) showToast('Saved','success');
  });
}
function toggleEmailTrigger(id,enabled){
  var cfg=getEmailConfig();
  if(!cfg.triggers)cfg.triggers={};
  cfg.triggers[id]=enabled;
  persistEmailSettings(cfg).then(function(ok){
    if(ok){
      showToast((enabled?'Enabled: ':'Disabled: ')+(EMAIL_TRIGGERS[id]||{label:id}).label,enabled?'success':'info');
      if(typeof render==='function') render();
    }else{
      var inp=document.querySelector('input[data-trid="'+id+'"]');
      if(inp) inp.checked=!enabled;
    }
  });
}

function previewEmailForTenant(triggerId,tenantId){
  var t=state.tenants.find(function(x){return x.id===tenantId;});if(!t)return null;
  var tr=EMAIL_TRIGGERS[triggerId];if(!tr)return null;
  var company=(state.companies&&state.companies[0]&&state.companies[0].name)||(state._currentOrg&&state._currentOrg.name)||'Your Property Manager';
  var body=tr.template.replace(/{name}/g,t.name).replace(/{property}/g,t.property||'').replace(/{amount}/g,'£'+(t.rent||0)).replace(/{company}/g,company).replace(/{date}/g,new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}));
  return {to:t.email,subject:tr.label,body:body};
}

function getCompanyEmailContext(){
  var co=(state.companies&&state.companies[0])||{};
  var org=state._currentOrg||{};
  return {
    companyName:co.name||'Your property manager',
    companyPhone:co.phone||co.tel||'',
    companyEmail:co.email||org.billing_email||org.owner_email||(state.currentUser&&state.currentUser.email)||''
  };
}

// ── Server-side rent reminder trigger (CRON + manual) ──
async function runServerRentReminders(dryRun) {
  if (!_currentOrgId) { showToast('No organisation', 'error'); return; }
  var sr = await supa.auth.getSession();
  var session = sr.data.session;
  if (!session) { showToast('Sign in required', 'error'); return; }
  showToast(dryRun ? 'Running server dry run...' : 'Sending reminders via server...', 'success');
  try {
    var resp = await fetch('/api/email/tenant-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ orgId: _currentOrgId, dryRun: !!dryRun })
    });
    var data = await resp.json();
    if (!resp.ok) { showToast(data.error || 'Failed', 'error'); return; }
    var s = data.summary || {};
    showToast((dryRun ? 'Dry run: ' : 'Sent: ') + (s.sent || 0) + ' emails' + (s.skipped ? ' (' + s.skipped + ' deduped)' : '') + (s.errors ? ' (' + s.errors + ' errors)' : ''), 'success');
    if (s.log && s.log.length > 0) {
      console.table(s.log);
    }
  } catch (e) {
    showToast('Server error: ' + e.message, 'error');
  }
}

// ── Email log viewer ──
async function loadEmailLog() {
  if (!_currentOrgId) return;
  var sr = await supa.auth.getSession();
  var session = sr.data.session;
  if (!session) return;
  var container = document.getElementById('email-log-container');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--muted);font-size:12px">Loading...</div>';
  try {
    var resp = await fetch('/api/email/log?orgId=' + _currentOrgId, {
      headers: { Authorization: 'Bearer ' + session.access_token }
    });
    var data = await resp.json();
    if (!resp.ok) { container.innerHTML = '<div style="color:var(--red)">'+escapeHtml(data.error||'Failed')+'</div>'; return; }
    var emails = data.emails || [];
    if (emails.length === 0) { container.innerHTML = '<div style="color:var(--muted)">No emails sent yet</div>'; return; }
    var html = '<div style="max-height:300px;overflow-y:auto">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<tr style="background:var(--surface)"><th style="text-align:left;padding:6px 8px;font-weight:600;border-bottom:1px solid var(--border)">Date</th><th style="text-align:left;padding:6px 8px;font-weight:600;border-bottom:1px solid var(--border)">To</th><th style="text-align:left;padding:6px 8px;font-weight:600;border-bottom:1px solid var(--border)">Template</th><th style="text-align:left;padding:6px 8px;font-weight:600;border-bottom:1px solid var(--border)">Status</th></tr>';
    emails.forEach(function(e) {
      var d = new Date(e.created_at);
      var dateStr = d.toLocaleDateString('en-GB', { day:'2-digit',month:'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit',minute:'2-digit' });
      var statusColor = e.status === 'sent' ? 'var(--green)' : 'var(--red)';
      html += '<tr><td style="padding:5px 8px;border-bottom:1px solid var(--border)">'+escapeHtml(dateStr)+'</td>';
      html += '<td style="padding:5px 8px;border-bottom:1px solid var(--border)">'+escapeHtml(e.recipient_email)+'</td>';
      html += '<td style="padding:5px 8px;border-bottom:1px solid var(--border)">'+escapeHtml((EMAIL_TRIGGERS[e.template_id]||{}).label||e.template_id)+'</td>';
      html += '<td style="padding:5px 8px;border-bottom:1px solid var(--border);color:'+statusColor+';font-weight:600">'+escapeHtml(e.status)+'</td></tr>';
    });
    html += '</table></div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<div style="color:var(--red)">Error loading log</div>';
  }
}

// ── Send payment receipt & landlord notice on mark-paid ──
async function sendPaymentReceiptEmail(tenant, payment) {
  var cfg = getEmailConfig();
  if (!cfg.triggers || !cfg.triggers.payment_receipt) return;
  if (!tenant || !tenant.email) return;
  var cx = getCompanyEmailContext();
  var first = (tenant.name || 'there').trim().split(/\s+/)[0];
  var html = buildPaymentReceiptHtml({
    firstName: first, amount: '£' + Math.round(Number(payment.amount || tenant.rent || 0)),
    paidDate: new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}),
    property: tenant.property || '', room: tenant.room || '',
    companyName: cx.companyName, balance: tenant.arrears || 0
  });
  await sendEmail(tenant.email, 'Payment Receipt - ' + (tenant.property || 'Your Property'), 'Payment received', 'tenant', {
    html: html, templateId: 'payment_receipt', tenant: { firstName: first }
  });
}

async function sendLandlordPaymentNotice(tenant, payment) {
  var cfg = getEmailConfig();
  if (!cfg.triggers || !cfg.triggers.landlord_payment_notice) return;
  // Find landlord for this property
  var prop = state.properties.find(function(p) { return p.name === tenant.property; });
  if (!prop || !prop.landlordEmail) return;
  var cx = getCompanyEmailContext();
  var html = buildLandlordPaymentNoticeHtml({
    landlordName: prop.landlordName || 'Landlord',
    tenantName: tenant.name || 'Tenant',
    amount: '£' + Math.round(Number(payment.amount || tenant.rent || 0)),
    property: tenant.property || '', room: tenant.room || '',
    collectedDate: new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}),
    companyName: cx.companyName
  });
  await sendEmail(prop.landlordEmail, 'Rent Collected - ' + (tenant.property || 'Property'), 'Rent collected', 'landlord', {
    html: html, templateId: 'landlord_payment_notice'
  });
}

// ── Send welcome email on tenant check-in ──
async function sendTenantNoticeConfirmation(tenant) {
  var cfg = getEmailConfig();
  if (!cfg.triggers || !cfg.triggers.notice_confirm) return;
  if (!tenant || !tenant.email) return;
  var cx = getCompanyEmailContext();
  var first = (tenant.name || 'there').trim().split(/\s+/)[0] || 'there';
  var dateLabel = tenant.moveOutDate
    ? new Date(tenant.moveOutDate).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})
    : '';
  var body = 'Hi ' + first + ',\n\nThis confirms your notice to vacate '
    + (tenant.property || 'your property')
    + (dateLabel ? ' on ' + dateLabel : '')
    + '.\n\n' + cx.companyName;
  await sendEmail(tenant.email, 'Notice to vacate confirmed - ' + (tenant.property || 'Your property'), body, 'tenant', {
    templateId: 'notice_confirm',
    tenant: { firstName: first }
  });
}

async function sendWelcomeEmail(tenant) {
  var cfg = getEmailConfig();
  if (!cfg.triggers || !cfg.triggers.move_in_welcome) return;
  if (!tenant || !tenant.email) return;
  var first = (tenant.name || 'there').trim().split(/\s+/)[0];
  var cx = getCompanyEmailContext();
  cx.firstName = first;
  var html = buildTriggerEmailHtml('move_in_welcome', 'Welcome to ' + (tenant.property || 'Your New Home'),
    'Welcome to ' + (tenant.property || 'your new home') + '! We are glad to have you.\n\nIf you need anything during your tenancy, please do not hesitate to reach out.', cx);
  await sendEmail(tenant.email, 'Welcome to ' + (tenant.property || 'Your New Home'), 'Welcome email', 'tenant', {
    html: html, templateId: 'move_in_welcome', tenant: { firstName: first }
  });
}

async function bulkEmailReminders() {
  var cfg = getEmailConfig();
  var tenantsWithEmail = state.tenants.filter(function(t) {
    return t.status === 'active' && t.email;
  });
  if (!tenantsWithEmail.length) { showToast('No tenants with email addresses', 'error'); return; }

  // Show confirmation modal
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:480px">'
    + '<div class="modal-header"><span class="modal-title">&#x2709; Send Email Reminders</span><button class="modal-close" onclick="closeModal()">&#x00D7;</button></div>'
    + '<div class="modal-body">'
    + '<p style="font-size:13px;color:var(--muted);margin-bottom:14px">This will send rent reminder emails to all active tenants with email addresses.</p>'
    + '<div class="kpi-strip" style="grid-template-columns:1fr 1fr;margin-bottom:16px">'
    + '<div class="kpi" style="padding:12px"><div class="kpi-label">Tenants with Email</div><div class="kpi-value" style="font-size:20px;color:var(--accent)">' + tenantsWithEmail.length + '</div></div>'
    + '<div class="kpi" style="padding:12px"><div class="kpi-label">Without Email</div><div class="kpi-value" style="font-size:20px;color:var(--dim)">' + state.tenants.filter(function(t){return t.status==='active'&&!t.email;}).length + '</div></div>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + '<button onclick="closeModal();runServerRentReminders(true)" class="btn btn-secondary" style="width:100%;justify-content:center;padding:12px">&#x1F50D; Dry Run (preview only)</button>'
    + '<button onclick="closeModal();runServerRentReminders(false)" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px">&#x1F4E7; Send Reminders Now</button>'
    + '<button onclick="closeModal();runRentReminderEmails(true)" class="btn btn-secondary" style="width:100%;justify-content:center;padding:12px">&#x1F50D; Client-side Dry Run</button>'
    + '<button onclick="closeModal();runRentReminderEmails(false)" class="btn btn-secondary" style="width:100%;justify-content:center;padding:12px">&#x1F4E8; Client-side Send</button>'
    + '</div>'
    + '</div>'
    + '<div class="modal-footer"><button onclick="closeModal()" class="btn btn-secondary">Cancel</button></div>'
    + '</div></div>';
}

async function sendRentChaseEmail(tenantId) {
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(!t || !t.email) { showToast(t ? 'No email address for '+t.name : 'Tenant not found', 'error'); return; }
  var cfg = getEmailConfig();
  var first = (t.name||'there').trim().split(/\s+/)[0];
  var isOverdue = t.arrears > 0;
  var templateId = isOverdue ? 'rent_overdue_3day' : 'rent_reminder_day';
  var subject = isOverdue ? 'Rent Payment Overdue - ' + (t.property||'Your Property') : 'Rent Payment Reminder - ' + (t.property||'Your Property');
  var body = isOverdue
    ? 'Hi '+first+', your rent of £'+(t.rent||0)+' is overdue. Please arrange payment urgently.'
    : 'Hi '+first+', this is a reminder that your rent of £'+(t.rent||0)+' is due. Please arrange payment.';
  var cx = getCompanyEmailContext();
  cx.firstName = first;
  var html = buildTriggerEmailHtml(templateId, subject, body, cx);
  var ok = await sendEmail(t.email, subject, body, 'tenant', {html:html, templateId:templateId, tenant:{firstName:first}});
  if(ok) showToast('Chase email sent to '+t.name, 'success');
}

async function sendEmail(to,subject,body,kind,extra){
  extra=extra||{};
  if(!_currentOrgId){showToast('No organisation','error');return false;}
  var sr=await supa.auth.getSession();
  var session=sr.data.session;
  if(!session){showToast('Sign in required','error');return false;}
  kind=kind||'tenant';
  var templateId = String(extra.templateId || '').toLowerCase();
  var html=extra.html;
  if(!html){
    if(templateId && typeof buildTriggerEmailHtml === 'function'){
      var cx=getCompanyEmailContext();
      if(extra.tenant){
        if(extra.tenant.firstName)cx.firstName=extra.tenant.firstName;
        if(extra.tenant.companyName)cx.companyName=extra.tenant.companyName;
        if(extra.tenant.companyPhone)cx.companyPhone=extra.tenant.companyPhone;
        if(extra.tenant.companyEmail)cx.companyEmail=extra.tenant.companyEmail;
      }
      html=buildTriggerEmailHtml(templateId, subject, body, {
        companyName: cx.companyName,
        companyPhone: cx.companyPhone,
        companyEmail: cx.companyEmail,
        firstName: extra.firstName || cx.firstName,
        stats: extra.stats || {},
        // Fields used by branded one-off templates (e.g. sign_agreement)
        signLinkUrl: extra.signLinkUrl || '',
        signLinkExpiry: extra.signLinkExpiry || ''
      });
    }else if(kind==='report'){
      html=buildManagerReportHtml(extra.reportType||'weekly',extra.stats||{},subject,body);
    }else if(kind==='tenant'){
      var cx2=getCompanyEmailContext();
      if(extra.tenant){
        if(extra.tenant.firstName)cx2.firstName=extra.tenant.firstName;
        if(extra.tenant.companyName)cx2.companyName=extra.tenant.companyName;
        if(extra.tenant.companyPhone)cx2.companyPhone=extra.tenant.companyPhone;
        if(extra.tenant.companyEmail)cx2.companyEmail=extra.tenant.companyEmail;
      }
      html=buildTenantOutboundHtml(subject,body,cx2);
    }
  }
  var payload={orgId:_currentOrgId,to:to,subject:subject,text:body,kind:kind};
  if(html)payload.html=html;
  try{
    var resp=await fetch('/api/email/send',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify(payload)
    });
    var data=await resp.json().catch(function(){return {};});
    if(resp.ok){showToast('Email sent to '+to,'success');return true;}
    var msg=(data&&data.error)||(data&&data.message)||JSON.stringify(data).slice(0,120);
    if(/suppression/i.test(String(msg))) {
      msg += ' In Resend: Dashboard → Emails (or Email suppressions) → find '+String(to)+' → Remove from suppression list. Addresses are listed after a bounce or spam complaint.';
    }
    showToast('Email failed: '+msg,'error');
    return false;
  }catch(e){showToast('Email error: '+e.message,'error');return false;}
}

async function sendTestEmail(){
  var cfg=getEmailConfig();
  var to=(cfg.managerEmail||'').trim()||(state.currentUser&&state.currentUser.email)||'';
  if(!to){showToast('Set Manager email in Settings (below) or sign in with an account that has an email','error');return;}
  var props=state.properties.filter(function(p){return p.status!=='archived';});
  var rooms=props.reduce(function(s,p){return s+p.rooms;},0);
  var occ=props.reduce(function(s,p){return s+p.occupied;},0);
  var income=props.reduce(function(s,p){return s+p.rent;},0);
  var costs=props.reduce(function(s,p){return s+p.landlord;},0);
  var body='Test from LandlordApp\n\n'+props.length+' properties · '+state.tenants.filter(function(t){return t.status==='active';}).length+' tenants\nSent: '+new Date().toLocaleString('en-GB');
  var shortDate=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  await sendEmail(to,'LandlordApp · connection test ('+shortDate+')',body,'report',{
    templateId:'test',
    reportType:'test',
    stats:{
      propsLen:props.length,
      income:income,
      costs:costs,
      net:income-costs,
      occPct:rooms?Math.min(100,Math.max(0,Math.round(occ/rooms*100))):0,
      maintOpen:state.maintenance.filter(function(m){return m.status!=='resolved';}).length,
      nowLabel:new Date().toLocaleString('en-GB')
    }
  });
}

async function runRentReminderEmails(dryRun){
  var cfg=getEmailConfig();if(!cfg.triggers){showToast('No triggers configured','error');return;}
  var today=new Date();today.setHours(0,0,0,0);
  var sent=0,skipped=0,log=[];
  state.tenants.filter(function(t){return t.status==='active'&&t.email;}).forEach(function(t){
    (state.rentSchedule||[]).filter(function(s){return s.tenantId===t.id&&s.status==='pending';}).forEach(function(s){
      var dueDate=new Date(s.dueDateRaw);dueDate.setHours(0,0,0,0);
      var d=Math.round((dueDate-today)/86400000);
      var tid=null;
      if(d===3&&cfg.triggers.rent_reminder_3day) tid='rent_reminder_3day';
      if(d===0&&cfg.triggers.rent_reminder_day)  tid='rent_reminder_day';
      if(d===-3&&cfg.triggers.rent_overdue_3day) tid='rent_overdue_3day';
      if(d===-7&&cfg.triggers.rent_overdue_week) tid='rent_overdue_week';
      if(!tid)return;
      var preview=previewEmailForTenant(tid,t.id);
      if(!preview||!preview.to){skipped++;return;}
      log.push({name:t.name,to:preview.to,subject:preview.subject});
      if(!dryRun){
        var firstN=(t.name||'there').trim().split(/\s+/)[0]||'there';
        sendEmail(preview.to,preview.subject,preview.body,'tenant',{templateId:tid,tenant:{firstName:firstN}});
      }
      sent++;
    });
  });
  showToast((dryRun?'Dry run: ':'Sent: ')+sent+' emails'+(skipped?' ('+skipped+' skipped)':''),'success');
}

async function sendScheduledReport(type){
  var cfg=getEmailConfig();var to=cfg.managerEmail;
  if(!to){showToast('Set manager email in Settings','error');return;}
  var triggerId = type === 'monthly' ? 'monthly_report' : 'weekly_report';
  if (!cfg.triggers || !cfg.triggers[triggerId]) {
    showToast('Enable ' + ((EMAIL_TRIGGERS[triggerId]||{}).label || triggerId) + ' first', 'error');
    return;
  }
  var props=state.properties.filter(function(p){return p.status!=='archived';});
  var rooms=props.reduce(function(s,p){return s+p.rooms;},0);
  var occ=props.reduce(function(s,p){return s+p.occupied;},0);
  var income=props.reduce(function(s,p){return s+p.rent;},0);
  var costs=props.reduce(function(s,p){return s+p.landlord;},0);
  var now=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  var shortDate=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  var subject=type==='weekly'
    ?'LandlordApp · your portfolio summary ('+shortDate+')'
    :'LandlordApp · your P&L summary ('+shortDate+')';
  var occPct=rooms?Math.min(100,Math.max(0,Math.round(occ/rooms*100))):0;
  var body=type==='weekly'
    ?'Weekly portfolio snapshot\n'+now+'\n\n'+props.length+' properties · '+occPct+'% occupancy\nIncome: £'+income.toLocaleString()+'/mo · Costs: £'+costs.toLocaleString()+'/mo · Net: £'+(income-costs).toLocaleString()+'/mo\nOpen maintenance: '+state.maintenance.filter(function(m){return m.status!=='resolved';}).length
    :'Monthly P&L\n'+now+'\n\nGross Income: £'+income.toLocaleString()+'\nLandlord Costs: £'+costs.toLocaleString()+'\nNet Profit: £'+(income-costs).toLocaleString()+'\nMargin: '+(income?Math.round((income-costs)/income*100):0)+'%\nOccupancy: '+occPct+'%';
  await sendEmail(to,subject,body,'report',{
    templateId:triggerId,
    reportType:type,
    stats:{
      propsLen:props.length,
      rooms:rooms,
      occ:occ,
      income:income,
      costs:costs,
      net:income-costs,
      occPct:occPct,
      maintOpen:state.maintenance.filter(function(m){return m.status!=='resolved';}).length,
      nowLabel:now
    }
  });
}

async function startStripeCheckout(plan){
  var opts = arguments.length > 1 && arguments[1] ? arguments[1] : {};
  if(!_currentOrgId){ showToast && showToast('No organisation loaded', 'error'); return false; }
  var sr = await supa.auth.getSession();
  var session = sr && sr.data ? sr.data.session : null;
  if(!session){ showToast && showToast('Sign in required', 'error'); return false; }
  var normalizedPlan = String(plan || 'starter').toLowerCase();
  // Allowlist of plans the server can map to a Stripe price. Keep in sync with
  // stripePriceByPlan in server.js and isPaidPlanForCheckout in 04-auth-org-provisioning.js.
  var ALLOWED_PLANS = ['starter','professional','business','enterprise','free'];
  if(ALLOWED_PLANS.indexOf(normalizedPlan) === -1){
    showToast && showToast('Unsupported plan selected', 'error');
    return false;
  }
  try{
    var resp = await fetch('/api/stripe/create-checkout-session', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+session.access_token
      },
      body: JSON.stringify({ orgId:_currentOrgId, plan:normalizedPlan })
    });
    var data = await resp.json().catch(function(){ return {}; });
    if(!resp.ok || !data.url){
      showToast && showToast('Checkout failed: '+((data&&data.error)||'Unknown error'), 'error');
      return false;
    }
    if (opts && opts.clearStartCheckoutParam) {
      try {
        var params = new URLSearchParams(window.location.search || '');
        params.delete('startCheckout');
        var next = window.location.pathname + (params.toString() ? ('?' + params.toString()) : '') + (window.location.hash || '');
        window.history.replaceState({}, '', next);
      } catch(_urlErr) {}
    }
    window.location.href = data.url;
    return true;
  }catch(e){
    showToast && showToast('Checkout error: '+e.message, 'error');
    return false;
  }
}

function showStripeCheckoutLoading(message){
  var overlay = document.getElementById('stripe-checkout-loading');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'stripe-checkout-loading';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '100000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(11,13,18,0.96)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.innerHTML = ''
      + '<div style="display:flex;flex-direction:column;align-items:center;gap:14px;color:#fff;font-family:system-ui,sans-serif">'
      + '  <div style="width:38px;height:38px;border-radius:999px;border:3px solid rgba(255,255,255,.2);border-top-color:#00D897;animation:pmStripeSpin 0.8s linear infinite"></div>'
      + '  <div id="stripe-checkout-loading-msg" style="font-size:14px;font-weight:600;color:#D6DBEB">Preparing secure checkout…</div>'
      + '</div>';
    if (!document.getElementById('pm-stripe-spin-style')) {
      var style = document.createElement('style');
      style.id = 'pm-stripe-spin-style';
      style.textContent = '@keyframes pmStripeSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    document.body.appendChild(overlay);
  }
  var msg = document.getElementById('stripe-checkout-loading-msg');
  if (msg) msg.textContent = message || 'Preparing secure checkout…';
  overlay.style.display = 'flex';
}

function hideStripeCheckoutLoading(){
  var overlay = document.getElementById('stripe-checkout-loading');
  if (overlay) overlay.style.display = 'none';
}

async function openStripeBillingPortal(){
  if(!_currentOrgId){ showToast && showToast('No organisation loaded', 'error'); return; }
  var sr = await supa.auth.getSession();
  var session = sr && sr.data ? sr.data.session : null;
  if(!session){ showToast && showToast('Sign in required', 'error'); return; }
  try{
    var resp = await fetch('/api/stripe/create-portal-session', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+session.access_token
      },
      body: JSON.stringify({ orgId:_currentOrgId })
    });
    var data = await resp.json().catch(function(){ return {}; });
    if(!resp.ok || !data.url){
      // NO_STRIPE_CUSTOMER means either the org has never subscribed OR the stripe_customer_id
      // is stale (test→live key switch). In both cases, the answer is "start a fresh subscription".
      // Prefer the org's CURRENT plan if it's a paid one; otherwise default to Starter.
      if (data && data.code === 'NO_STRIPE_CUSTOMER') {
        var curPlan = String((state._currentOrg && state._currentOrg.plan) || 'free').toLowerCase();
        var paidPlans = ['starter','professional','business'];
        var resub = paidPlans.indexOf(curPlan) >= 0 ? curPlan : 'starter';
        var msg = (data && data.error) ? data.error : 'No active subscription on this organisation.';
        var go = confirm(msg + '\n\nStart a fresh ' + resub.charAt(0).toUpperCase()+resub.slice(1) + ' subscription now?');
        if (go && typeof startStripeCheckout === 'function') startStripeCheckout(resub);
        return;
      }
      showToast && showToast('Could not open billing portal: '+((data&&data.error)||'Unknown error'), 'error');
      return;
    }
    window.location.href = data.url;
  }catch(e){
    showToast && showToast('Billing portal error: '+e.message, 'error');
  }
}

function maybeStartCheckoutFromQuery(){
  try{
    var params = new URLSearchParams(window.location.search || '');
    var startCheckoutPlan = String(params.get('startCheckout') || '').toLowerCase();
    if (startCheckoutPlan === 'starter' || startCheckoutPlan === 'professional' || startCheckoutPlan === 'business') {
      var activeSubId = String((state._currentOrg && state._currentOrg.stripe_subscription_id) || '').trim();
      if (!activeSubId) {
        showStripeCheckoutLoading('Preparing secure checkout…');
        startStripeCheckout(startCheckoutPlan, { clearStartCheckoutParam: true }).then(function(ok){
          if (!ok) {
            hideStripeCheckoutLoading();
            showCheckoutRequired(state._currentOrg || { plan: startCheckoutPlan });
          }
        }).catch(function(){
          hideStripeCheckoutLoading();
          showCheckoutRequired(state._currentOrg || { plan: startCheckoutPlan });
        });
        return;
      }
      params.delete('startCheckout');
      var startCheckoutNext = window.location.pathname + (params.toString() ? ('?' + params.toString()) : '') + (window.location.hash || '');
      window.history.replaceState({}, '', startCheckoutNext);
    }
    var stripeResult = String(params.get('stripe') || '').toLowerCase();
    if (stripeResult === 'success') {
      showToast && showToast('Payment confirmed. Finalising your subscription…', 'success');
      params.delete('stripe');
      var successNext = window.location.pathname + (params.toString() ? ('?' + params.toString()) : '') + (window.location.hash || '');
      window.history.replaceState({}, '', successNext);
    } else if (stripeResult === 'cancelled') {
      showToast && showToast('Checkout cancelled. Complete payment to continue.', 'warn');
      params.delete('stripe');
      var cancelNext = window.location.pathname + (params.toString() ? ('?' + params.toString()) : '') + (window.location.hash || '');
      window.history.replaceState({}, '', cancelNext);
    }
  }catch(_e){}
}

function renderSettings() {
  var companies = state.companies || [];
  var cfg = state.config || {};
  var org = state._currentOrg || {};
  if (Array.isArray(org)) org = org[0] || {};

  // Hidden-rooms list removed from Settings (now rendered on Rooms page below
  // a divider — see sections/23-rooms-page.js).

  // ── Plan config ───────────────────────────────────────────────
  var PLANS = {
    free:         { label:'Free',          price:0,   color:'#64748B', bg:'#F8FAFC', border:'#CBD5E1', props:3,  seats:2  },
    trial:        { label:'Free Trial',    price:0,   color:'#F5A623', bg:'#FFFBEB', border:'#FDE68A', props:5,  seats:3  },
    starter:      { label:'Starter',       price:49,  color:'#3B82F6', bg:'#EFF6FF', border:'#BFDBFE', props:15, seats:3  },
    professional: { label:'Professional',  price:89,  color:'#10B981', bg:'#ECFDF5', border:'#A7F3D0', props:25, seats:5  },
    business:     { label:'Business',      price:149, color:'#8B5CF6', bg:'#F5F3FF', border:'#DDD6FE', props:60, seats:15 },
    enterprise:   { label:'Enterprise',    price:299, color:'#F59E0B', bg:'#FFFBEB', border:'#FDE68A', props:'∞', seats:'∞' },
  };
  var planKey  = String((org.plan != null && org.plan !== '') ? org.plan : (cfg.plan || 'free')).trim().toLowerCase() || 'free';
  var status   = String(org.status || 'active').trim().toLowerCase();
  var planCfg  = PLANS[planKey] || PLANS.free;
  if (status === 'trial' && planKey === 'free') planCfg = PLANS.trial;
  // Admin-granted free access → unlimited caps (matches _dmPlanCaps)
  if (String(org.billing_override || '').toLowerCase() === 'free') {
    planCfg = Object.assign({}, planCfg, { props: '∞', seats: '∞' });
  }
  var trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  var daysLeft = trialEnd ? Math.ceil((trialEnd - new Date()) / 86400000) : null;
  var isTrial  = status === 'trial';

  // Usage counts (billing uses active properties only — archived must not count toward caps)
  var propCount   = (state.properties||[]).filter(function(p){return isPropertyActive(p);}).length;
  var tenantCount = state.tenants.filter(function(t){return t.status!=='inactive';}).length;
  var userCount   = (state.users||[]).filter(function(u){return u.status==='active';}).length;

  function usagePct(used, max){ return max ? Math.min(100, Math.round(used/max*100)) : 0; }
  function usageColor(pct){ return pct>=90?'var(--red)':pct>=70?'var(--amber)':'var(--green)'; }
  function usageBar(used, max){
    var pct = usagePct(used, max);
    return '<div style="height:5px;border-radius:3px;background:var(--border);overflow:hidden;margin-top:5px">'
      +'<div style="height:100%;width:'+pct+'%;background:'+usageColor(pct)+';border-radius:3px;transition:width .4s"></div></div>';
  }

  // Plan limit check (same rules as _dmPlanCaps / add-property gate)
  var _planLimit = typeof _dmPlanCaps === 'function' ? _dmPlanCaps(planKey, org).properties : 5;
  var _propCount = propCount;
  var _limitWarn=_propCount>_planLimit
    ?'<div style="background:#FEF3C7;border:1.5px solid #F59E0B;border-radius:12px;padding:14px 18px;margin-bottom:0;display:flex;align-items:center;gap:12px">'
     +'<span style="font-size:22px">⚠️</span>'
     +'<div><div style="font-size:13px;font-weight:700;color:#92400E">Plan Limit Exceeded</div>'
     +'<div style="font-size:12px;color:#78350F">You have <strong>'+_propCount+'</strong> active properties but your <strong>'+planCfg.label+'</strong> plan allows up to <strong>'+_planLimit+'</strong>. Consider upgrading or archiving unused properties.</div></div></div>'
    :'';
  var settingsTab = state.filters.settingsTab || 'general';
  // ── v2 header / hero / stat row ──
  var html = '';
  var trialBadge = (isTrial && daysLeft !== null) ? (daysLeft > 0 ? (' · ' + daysLeft + 'd trial left') : ' · trial expired') : '';
  html += renderScreenHeader({
    title: 'Settings',
    subtitle: (planCfg && planCfg.label ? planCfg.label + ' plan' : 'Workspace settings') + trialBadge + ' · ' + companies.length + ' compan' + (companies.length===1?'y':'ies'),
    rightActions: (function(){
      var acts = [];
      if (isTrial || planKey === 'free') {
        acts.push('<button onclick="startStripeCheckout(\'starter\')" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Upgrade</button>');
      } else {
        acts.push('<button onclick="openStripeBillingPortal()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit">Manage</button>');
      }
      return acts;
    })()
  });
  // Hero — current plan
  var trialWarn = isTrial && daysLeft !== null && daysLeft <= 3;
  html += renderHeroCard({
    variant: trialWarn ? 'warning' : 'default',
    icon: trialWarn ? '⚠' : '\u{1F4B3}',
    label: 'Current Plan',
    value: '<span style="color:#fff">' + (planCfg.label || 'Free') + '</span>',
    subtitle: isTrial ? (daysLeft > 0 ? (daysLeft + ' day' + (daysLeft===1?'':'s') + ' left in trial') : 'Trial expired — upgrade to continue') : (status === 'active' ? '✓ Active subscription' : status)
  });
  // Stat row — usage
  html += renderStatRow([
    { label:'Properties',    value: propCount + ' / ' + planCfg.props,  color: usageColor(usagePct(propCount, planCfg.props)).indexOf('red')>-1?'red':usageColor(usagePct(propCount, planCfg.props)).indexOf('amber')>-1?'amber':'teal' },
    { label:'Active Tenants',value: tenantCount,                        color:'default' },
    { label:'Users',         value: userCount + ' / ' + planCfg.seats,  color: usageColor(usagePct(userCount, planCfg.seats)).indexOf('red')>-1?'red':usageColor(usagePct(userCount, planCfg.seats)).indexOf('amber')>-1?'amber':'teal' }
  ]);
  // Settings navigation tabs (Users moved here from main nav).
  var teamCount = (state.users||[]).filter(function(u){return u.status!=='deleted';}).length;
  html += renderTabs({
    tabs: [
      { id:'general',   label:'General',   icon:'⚙' },
      { id:'users',     label:'Team',      icon:'\u{1F465}', count: teamCount || null },
      { id:'email',     label:'Email',     icon:'\u{1F4E7}' },
      { id:'companies', label:'Companies', icon:'\u{1F3E2}', count: companies.length || null },
      { id:'billing',   label:'Billing',   icon:'\u{1F4B3}' },
      { id:'backup',    label:'Backup',    icon:'\u{1F4BE}' }
    ],
    activeId: settingsTab,
    onChangeTpl: 'state.filters.settingsTab=\'%ID%\';render()'
  });
  if(settingsTab==='backup') {
    html += (typeof renderBackupTab==='function') ? renderBackupTab(org) : '<div class="settings-section">Backup tab not loaded.</div>';
    return html;
  }
  if(settingsTab==='users') {
    // Re-uses the existing renderUsers() output. Strips its own header/hero/stat row
    // since Settings already shows them above.
    if(typeof renderUsers === 'function'){
      var usersHtml = renderUsers();
      // Crude but effective: drop everything before the first `<div class="screen-header__actions">`
      // wrapper closes — i.e. keep from the first user card onwards. Simpler approach:
      // append the users content as-is; the duplicate header is cosmetic, not breaking.
      html += '<div style="margin-top:10px">' + usersHtml + '</div>';
    } else {
      html += '<div class="settings-section">Users tab not loaded.</div>';
    }
    return html;
  }

  // ── Subscription panel — billing tab only (hero above already shows the headline) ──
  if(settingsTab==='billing') {
  html += '<div class="settings-section">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">';
  html += '<div>';
  html += '<div style="font-size:15px;font-weight:700;margin-bottom:4px">&#x1F4B3; Subscription</div>';
  html += '<div style="display:flex;align-items:center;gap:8px">';
  html += '<span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:6px;background:'+planCfg.bg+';color:'+planCfg.color+';border:1px solid '+planCfg.border+'">'+planCfg.label+'</span>';
  if(isTrial && daysLeft !== null) {
    var trialColor = daysLeft <= 3 ? 'var(--red)' : daysLeft <= 7 ? 'var(--amber)' : 'var(--green)';
    html += '<span style="font-size:12px;color:'+trialColor+';font-weight:700">'+
      (daysLeft > 0 ? daysLeft+' days remaining' : 'Trial expired')+
    '</span>';
  } else if(status === 'active') {
    html += '<span style="font-size:12px;color:var(--green);font-weight:600">&#x2713; Active</span>';
  }
  html += '</div></div>';
  // Upgrade / manage button
  if(isTrial) {
    html += '<button onclick="startStripeCheckout(\'starter\')" '
      + 'style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B06; Upgrade Plan</button>';
  } else if (planKey === 'free') {
    html += '<button onclick="startStripeCheckout(\'starter\')" '
      + 'style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B06; Start 14-day paid trial</button>';
  } else {
    html += '<button onclick="openStripeBillingPortal()" '
      + 'style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Manage plan</button>';
  }
  html += '</div>';

  // Plan details row
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">';
  // Properties usage
  html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Properties</div>';
  html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:'+usageColor(usagePct(propCount,planCfg.props))+'">'+propCount+' <span style="font-size:13px;color:var(--muted);font-weight:400">/ '+planCfg.props+'</span></div>';
  html += usageBar(propCount, planCfg.props);
  html += '</div>';
  // Tenants usage
  html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Active Tenants</div>';
  html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:var(--text)">'+tenantCount+'</div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:5px">'+(planKey==='starter'?'Up to 75':(planKey==='trial'||isTrial)?'Up to 30':planKey==='free'?'Up to 15':'Unlimited')+'</div>';
  html += '</div>';
  // Users / seats
  html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Users (seats)</div>';
  html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:'+usageColor(usagePct(userCount,planCfg.seats))+'">'+userCount+' <span style="font-size:13px;color:var(--muted);font-weight:400">/ '+planCfg.seats+'</span></div>';
  html += usageBar(userCount, planCfg.seats);
  html += '</div>';
  html += '</div>';

  // Pricing & upgrade options (shown during trial or on lower plans)
  if(isTrial || planKey === 'free' || planKey === 'starter') {
    html += '<div style="border-top:1px solid var(--border);padding-top:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Available Plans</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
    [['starter','Starter','£49/mo','15 properties · 3 users'],
     ['professional','Professional','£89/mo','25 properties · 5 users'],
     ['business','Business','£149/mo','60 properties · 15 users']].forEach(function(p){
      var isCurrent = p[0] === planKey;
      html += '<div style="border:1.5px solid '+(isCurrent?'var(--accent)':'var(--border)')+';border-radius:9px;padding:12px;background:'+(isCurrent?'var(--accent-light)':'var(--bg)')+'">';
      html += '<div style="font-size:12px;font-weight:700;color:'+(isCurrent?'var(--accent-dark)':'var(--text)')+'">'+p[1]+'</div>';
      html += '<div style="font-size:16px;font-weight:800;font-family:monospace;margin:4px 0">'+p[2]+'</div>';
      html += '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">'+p[3]+'</div>';
      if(!isCurrent) {
        html += '<button onclick="startStripeCheckout(\''+p[0]+'\')" style="display:block;width:100%;text-align:center;padding:6px;border-radius:7px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Upgrade</button>';
      } else {
        html += '<div style="text-align:center;font-size:12px;font-weight:700;color:var(--accent-dark)">&#x2713; Current plan'+(isTrial?' (trial)':'')+'</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  }

  html += '</div>';
  } // end billing/general tab

  // ── Branding (general tab) ─────────────────────────────────────────────────────────────
  if(settingsTab==='general') {
  html += '<div class="settings-section"><div class="settings-section-title">&#x1F3A8; Branding</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  // Logo upload
  html += '<div class="field"><label class="field-label">Company Logo</label>';
  if(cfg.logoUrl) {
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
    html += '<img src="'+cfg.logoUrl+'" style="width:56px;height:56px;border-radius:10px;object-fit:contain;background:var(--bg);border:1px solid var(--border);padding:4px">';
    html += '<button onclick="removeLogo()" style="padding:5px 10px;border-radius:7px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:11px;cursor:pointer;font-family:inherit">Remove</button></div>';
  }
  html += '<label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border:2px dashed var(--border);border-radius:9px;cursor:pointer;background:var(--bg)">';
  html += '<span style="font-size:20px">&#x1F4F7;</span>';
  html += '<span style="font-size:12px;color:var(--muted)">Upload logo (PNG/JPG)</span>';
  html += '<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none" onchange="uploadLogo(this)">';
  html += '</label></div>';
  // Portfolio name
  html += '<div class="field"><label class="field-label">Portfolio Name (sidebar)</label>';
  html += '<input class="inp" id="cfg-portname" value="'+(cfg.portfolioName||'South London HMOs')+'">';
  html += '<div class="field" style="margin-top:10px"><label class="field-label">Site Title (browser tab)</label>';
  html += '<input class="inp" id="cfg-sitetitle" value="'+(cfg.siteTitle||'landlordapp.io')+'"></div>';
  var orgPl = state._currentOrg || {};
  var plTag = String(orgPl.public_listings_tagline == null ? '' : orgPl.public_listings_tagline).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  var plWa = String(orgPl.public_listings_whatsapp == null ? '' : orgPl.public_listings_whatsapp).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  html += '<div class="field" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)"><label class="field-label">Public room listings (/rooms)</label>';
  var plPreviewUrl = '/rooms.html' + (_currentOrgId ? ('?org=' + encodeURIComponent(String(_currentOrgId))) : '');
  html += '<div style="font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.45">Footer text and WhatsApp on your public listings page. Uses your organisation name plus the options below. <a href="'+plPreviewUrl+'" target="_blank" rel="noopener noreferrer" onclick="return openPublicListingsInNewTab(event,'+JSON.stringify(plPreviewUrl)+')" style="font-weight:700;color:var(--accent-dark);text-decoration:underline;white-space:nowrap">Open in new tab</a></div>';
  html += '<label class="field-label" style="margin-top:6px">Listing tagline (optional)</label>';
  html += '<input class="inp" id="cfg-pl-tagline" placeholder="e.g. North London — no agency fees" value="'+plTag+'">';
  html += '<label class="field-label" style="margin-top:10px">WhatsApp for enquiries</label>';
  html += '<input class="inp" id="cfg-pl-wa" type="tel" placeholder="447911000000 (country code, digits only)" value="'+plWa+'">';
  html += '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;cursor:pointer"><input type="checkbox" id="cfg-pl-skipwa" '+(orgPl.public_listings_whatsapp_skipped?'checked':'')+'> Hide WhatsApp on public listings page</label>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  html += '<button onclick="saveBranding()" style="margin-top:14px;padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Branding</button>';
  html += '</div>';

  // ── Authorised Signatory (used on tenancy agreements) ─────────────────────
  var sigName = (cfg.companySignatoryName || '').replace(/"/g,'&quot;');
  var sigTitleVal = (cfg.companySignatoryTitle || '').replace(/"/g,'&quot;');
  var sigImg = cfg.companySignature || '';
  html += '<div class="settings-section"><div class="settings-section-title">&#x270D;&#xFE0F; Authorised Signatory</div>';
  html += '<div style="font-size:12px;color:var(--gray-500);margin-bottom:14px;line-height:1.5">Used on tenancy agreements as the landlord / licensor signature. Signs every new agreement automatically with today\'s date so you don\'t have to manually print and re-sign.</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">';
  html += '<div><label class="field-label">Signatory name</label><input class="inp" id="cfg-sig-name" value="'+sigName+'" placeholder="e.g. Gleydson De Paula"></div>';
  html += '<div><label class="field-label">Title (optional)</label><input class="inp" id="cfg-sig-title" value="'+sigTitleVal+'" placeholder="e.g. Director, '+(cfg.portfolioName||'Capital Properties')+'"></div>';
  html += '</div>';
  // Signature pad
  html += '<label class="field-label">Signature</label>';
  html += '<div id="sig-pad-wrap" style="position:relative;background:#fff;border:1.5px solid var(--gray-200);border-radius:10px;padding:8px;width:100%;max-width:380px">';
  html += '<canvas id="cfg-sig-canvas" width="360" height="120" style="display:block;width:100%;height:120px;border:1px dashed var(--gray-200);border-radius:6px;background:#fff;touch-action:none;cursor:crosshair"></canvas>';
  if (sigImg) html += '<img id="cfg-sig-existing" src="'+sigImg+'" style="position:absolute;inset:8px;width:calc(100% - 16px);height:calc(100% - 16px);object-fit:contain;pointer-events:none">';
  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">';
  html += '<button onclick="signaturePadClear()" style="padding:7px 14px;border-radius:8px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Clear & redraw</button>';
  html += '<label style="padding:7px 14px;border-radius:8px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Upload PNG / JPG<input type="file" accept="image/png,image/jpeg" style="display:none" onchange="signaturePadUpload(this)"></label>';
  if (sigImg) html += '<button onclick="signaturePadRemove()" style="padding:7px 14px;border-radius:8px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Remove signature</button>';
  html += '<button onclick="saveCompanySignature()" style="padding:7px 14px;border-radius:8px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;margin-left:auto">Save signature</button>';
  html += '</div>';
  html += '<div id="sig-pad-status" style="font-size:11px;color:var(--gray-500);margin-top:8px"></div>';
  // Canvas wiring lives in _initCfgSigCanvas (called from render() after innerHTML write)
  // because <script> tags inside innerHTML do NOT execute — that was the previous bug.
  html += '</div>';

  // ── Currency & Language ───────────────────────────────────────────────────
  var orgCl = state._currentOrg || {};
  var curCurrency   = orgCl.currency    || 'GBP';
  var curLanguage   = orgCl.language    || 'en';
  var curDateFmt    = orgCl.date_format || 'DD/MM/YYYY';
  html += '<div class="settings-section"><div class="settings-section-title">&#x1F30D; Currency &amp; Language</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px">';

  // Currency select
  html += '<div class="field"><label class="field-label">Currency</label>';
  html += '<select class="inp" id="cfg-currency">';
  [['GBP','£ GBP — British Pound'],['EUR','€ EUR — Euro'],['USD','$ USD — US Dollar'],
   ['CAD','C$ CAD — Canadian Dollar'],['AUD','A$ AUD — Australian Dollar'],
   ['NGN','₦ NGN — Nigerian Naira'],['GHS','₵ GHS — Ghanaian Cedi'],
   ['ZAR','R ZAR — South African Rand'],['KES','KSh KES — Kenyan Shilling'],
   ['INR','₹ INR — Indian Rupee']
  ].forEach(function(o) {
    html += '<option value="'+o[0]+'"'+(curCurrency===o[0]?' selected':'')+'>'+o[1]+'</option>';
  });
  html += '</select></div>';

  // Language select
  html += '<div class="field"><label class="field-label">Language</label>';
  html += '<select class="inp" id="cfg-language">';
  [['en','English'],['fr','Français'],['es','Español'],['pt','Português'],
   ['de','Deutsch'],['yo','Yorùbá'],['ig','Igbo'],['ha','Hausa']
  ].forEach(function(o) {
    html += '<option value="'+o[0]+'"'+(curLanguage===o[0]?' selected':'')+'>'+o[1]+'</option>';
  });
  html += '</select></div>';

  // Date format select
  html += '<div class="field"><label class="field-label">Date Format</label>';
  html += '<select class="inp" id="cfg-datefmt">';
  [['DD/MM/YYYY','DD/MM/YYYY (UK)'],['MM/DD/YYYY','MM/DD/YYYY (US)'],
   ['YYYY-MM-DD','YYYY-MM-DD (ISO)'],['DD MMM YYYY','DD MMM YYYY (e.g. 15 Jan 2026)'],
   ['DD-MM-YYYY','DD-MM-YYYY']
  ].forEach(function(o) {
    html += '<option value="'+o[0]+'"'+(curDateFmt===o[0]?' selected':'')+'>'+o[1]+'</option>';
  });
  html += '</select></div>';

  html += '</div>'; // end grid
  html += '<div style="font-size:11px;color:var(--muted);margin-bottom:12px">Currency symbol updates all money values across the app instantly on save. Language affects WhatsApp &amp; email message templates.</div>';
  html += '<button onclick="saveCurrencyLanguage()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Preferences</button>';
  html += '</div>';

  // ── Late Fees ─────────────────────────────────────────────────────────────
  // Mirrors openLateFeeSettings() but inline so the user doesn't have to dig
  // into a modal from the rent page. Uses cfg-lf-* IDs to avoid colliding
  // with the modal's lf-* IDs if both are open.
  if (!state.lateFeeConfig) state.lateFeeConfig = { enabled: false, feeType: 'fixed', feeAmount: 25, graceDays: 3 };
  var lf = state.lateFeeConfig;
  html += '<div class="settings-section"><div class="settings-section-title">&#x23F0; Late Fees</div>';
  html += '<div style="font-size:12px;color:var(--gray-500);margin-bottom:14px;line-height:1.5">Charge a fee when rent is more than the grace period overdue. Toggle off to never apply late fees automatically.</div>';
  html += '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;background:var(--gray-50);border-radius:8px;margin-bottom:14px"><input type="checkbox" id="cfg-lf-enabled" ' + (lf.enabled ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--teal-500)"><span style="font-size:13px;font-weight:600;color:var(--gray-900)">Enable automatic late fees</span></label>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">';
  html += '<div><label class="field-label">Grace period</label><div style="display:flex;align-items:center;gap:6px"><input class="inp" id="cfg-lf-grace" type="number" min="0" max="60" value="' + (lf.graceDays || 3) + '" style="text-align:center"><span style="font-size:12px;color:var(--gray-500)">days</span></div></div>';
  html += '<div><label class="field-label">Fee type</label><select class="inp" id="cfg-lf-type" onchange="var p=document.getElementById(\'cfg-lf-pfx\');if(p)p.textContent=this.value===\'percent\'?\'%\':\'£\';"><option value="fixed" ' + (lf.feeType === 'fixed' ? 'selected' : '') + '>Fixed (£)</option><option value="percent" ' + (lf.feeType === 'percent' ? 'selected' : '') + '>% of rent</option></select></div>';
  html += '<div><label class="field-label">Amount</label><div style="display:flex;align-items:center;gap:6px"><span style="font-size:13px;color:var(--gray-500);font-weight:600" id="cfg-lf-pfx">' + (lf.feeType === 'percent' ? '%' : '£') + '</span><input class="inp" id="cfg-lf-amount" type="number" min="0" value="' + (lf.feeAmount || 25) + '" style="text-align:center"></div></div>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--gray-500);margin-bottom:12px">Example: a £25 fixed fee with 3 days grace adds £25 once a payment is more than 3 days late. % of rent applies the percentage to that period\'s rent.</div>';
  html += '<button onclick="saveLateFeesFromSettings()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save late fee settings</button>';
  html += '</div>';

  // ── Company Profiles ─────────────────────────────────────────────────────
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  html += '<div style="font-size:15px;font-weight:700">&#x1F3E2; Company Profiles</div>';
  html += '<button onclick="openAddCompanyModal()" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add Company</button>';
  html += '</div>';

  if(companies.length === 0) {
    html += '<div style="background:var(--surface);border:2px dashed var(--border);border-radius:14px;padding:36px;text-align:center;color:var(--dim);margin-bottom:20px">'
      + '<div style="font-size:36px;margin-bottom:10px">&#x1F3E2;</div>'
      + '<div style="font-size:14px;font-weight:700;margin-bottom:6px">No companies yet</div>'
      + '<div style="font-size:12px">Add your limited company profiles. Then assign properties to each one via the Properties page.</div>'
      + '</div>';
  } else {
    companies.forEach(function(co) {
      var props = state.properties.filter(function(p){return p.companyId===co.id;});
      var tenants = state.tenants.filter(function(t){
        return t.status!=='inactive' && props.some(function(p){return p.name===t.property;});
      });
      var mo = Math.round(tenants.reduce(function(s,t){return s+(t.freq==='monthly'?t.rent:t.rent*52/12);},0));
      var ll = props.reduce(function(s,p){return s+(p.landlord||0);},0);
      var net = mo-ll;
      html += '<div style="background:var(--surface);border:2px solid '+(co.color||'#6366F1')+';border-radius:14px;padding:18px;margin-bottom:12px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
      html += '<div>'
        +'<div style="font-size:16px;font-weight:800;margin-bottom:3px">&#x1F3E2; '+co.name+'</div>'
        +'<div style="font-size:12px;color:var(--muted)">Co No: '+(co.companyNo||'&mdash;')+' &nbsp;&middot;&nbsp; VAT: '+(co.vatNo||'&mdash;')+'</div>'
        +'<div style="font-size:12px;color:var(--muted)">Director: '+(co.director||'&mdash;')+'</div>'
        +(co.address?'<div style="font-size:12px;color:var(--muted)">&#x1F4CD; '+co.address+'</div>':'')
        +(co.email||co.phone?'<div style="font-size:12px;color:var(--muted)">'+(co.email?'&#x2709; '+co.email:'')+(co.phone?' &middot; &#x1F4DE; '+co.phone:'')+(co.whatsapp?' &middot; &#x1F4AC; '+co.whatsapp:'')+'</div>':'')
        +'</div>';
      html += '<button data-coid="'+co.id+'" onclick="openEditCompanyModal(this.dataset.coid)" '
        +'style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">&#x270F; Edit</button>';
      html += '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:10px">';
      ['Properties:'+props.length+':var(--muted)',
       'Tenants:'+tenants.length+':var(--muted)',
       'Income/mo:&pound;'+mo.toLocaleString()+':var(--green)',
       'LL Cost/mo:&pound;'+ll.toLocaleString()+':var(--amber)',
       'Net/mo:&pound;'+net.toLocaleString()+':'+(net>=0?'var(--green)':'var(--red)')
      ].forEach(function(s){
        var p=s.split(':');
        html+='<div style="background:var(--bg);border-radius:8px;padding:8px 10px">'
          +'<div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:3px">'+p[0]+'</div>'
          +'<div style="font-size:18px;font-weight:800;color:'+p[2]+'">'+p[1]+'</div></div>';
      });
      html += '</div>';
      if(props.length){
        html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:5px">Assigned Properties</div>';
        html+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
        props.forEach(function(p){html+='<span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 8px">'+p.name+'</span>';});
        html+='</div>';
      } else {
        html+='<div style="font-size:11px;color:var(--dim);font-style:italic">No properties assigned — edit a property and select this company.</div>';
      }
      html+='</div>';
    });
  }

  // ── Account ───────────────────────────────────────────────────────────────
  html += '<div style="font-size:15px;font-weight:700;margin-bottom:12px;margin-top:8px">&#x1F464; Account</div>';
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">';
  html += '<div style="font-size:13px;color:var(--muted);margin-bottom:14px">Logged in as <strong>'+state.currentUser.name+'</strong>';
  if(state.currentUser.email) html += ' ('+state.currentUser.email+')';
  html += '</div>';
  html += '<button onclick="doLogOut()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">&rarr; Log Out</button>';
  html += '</div>';

  // Marked-Unavailable rooms block was removed from Settings — it lives
  // naturally on the Rooms page now (available section + divider + unavailable).
  // Duplicating it here was confusing because toggles in two places updated the
  // same flag but the Settings copy wasn't tied to filters / photos.
  } // end general tab (branding only)

    if(_limitWarn && (settingsTab==='general'||settingsTab==='billing')) html += '<div style="margin-bottom:16px">'+_limitWarn+'</div>';

  // Import/Export (general tab)
  if(settingsTab==='general') {
  html += '<div class="settings-section" style="display:flex;align-items:center;justify-content:space-between">';
  html += '<div><div class="settings-section-title" style="margin-bottom:4px">&#x21C5; Import &amp; Export</div><div style="font-size:12px;color:var(--muted)">Upload CSV/XLSX or export all data</div></div>';
  html += '<button onclick="openDataModal(\'properties\')" class="btn btn-primary" style="font-size:12px">Open Data Manager</button></div>';
  } // end general tab

  // Email & Notifications (email tab)
  if(settingsTab==='email') {
  html += '<div class="settings-section"><div class="settings-section-title">&#x1F4E7; Email &amp; Notifications</div>'+renderEmailSettings()+'</div>';
  } // end email tab

  // Companies (companies tab)
  if(settingsTab==='companies') {
  html += '<div class="settings-section"><div class="settings-section-title">&#x1F3E2; Operating Companies</div>';
  html += '<div style="margin-bottom:14px"><button onclick="openAddCompanyModal()" class="btn btn-primary" style="font-size:12px">&#x2795; Add Company</button></div>';
  if(!companies.length) {
    html += '<div class="empty">No companies yet. Add your first operating company.</div>';
  } else {
    companies.forEach(function(co){
      html += '<div class="card" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">';
      html += '<div><div style="font-size:14px;font-weight:700">'+co.name+'</div>';
      html += '<div style="font-size:12px;color:var(--dim);margin-top:2px">'+(co.phone||'')+(co.email?' &middot; '+co.email:'')+'</div></div>';
      html += '<div style="display:flex;gap:6px">';
      html += '<button onclick="openEditCompanyModal(\''+co.id+'\')" class="btn btn-secondary" style="font-size:11px;padding:6px 12px">Edit</button>';
      html += '<button onclick="deleteCompany(\''+co.id+'\')" class="btn" style="font-size:11px;padding:6px 12px;background:var(--red-light);color:var(--red)">Delete</button>';
      html += '</div></div>';
    });
  }
  html += '</div>';
  } // end companies tab

return html;
}

function uploadLogo(input) {
  if (!requirePerm('canManageUsers', 'change workspace settings')) return;
  var file = input.files[0];
  if(!file) return;
  if(file.size > 500*1024){ showToast('Logo must be under 500KB','error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    if(!state.config) state.config={};
    state.config.logoUrl = e.target.result;
    saveState(); render();
    // Also update topbar logo immediately
    showToast('Logo saved ✓','success');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  if (!requirePerm('canManageUsers', 'change workspace settings')) return;
  if(!state.config) return;
  state.config.logoUrl = '';
  saveState(); render();
}

// ── Authorised signatory pad helpers ─────────────────────────────────────────
// Canvas wiring. Called from render() after the settings page is written into
// the DOM — inline <script> tags inside innerHTML do NOT execute, which was
// the original bug. Idempotent via the dataset.bound guard.
function _initCfgSigCanvas(){
  var c = document.getElementById('cfg-sig-canvas');
  if (!c || c.dataset.bound) return;
  c.dataset.bound = '1';
  var ctx = c.getContext('2d');
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0F172A';
  var drawing = false, last = null;
  function pos(e){
    var r = c.getBoundingClientRect();
    var cx = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    var cy = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return { x:(cx - r.left) * c.width / r.width, y:(cy - r.top) * c.height / r.height };
  }
  function start(e){
    e.preventDefault();
    drawing = true;
    last = pos(e);
    var existing = document.getElementById('cfg-sig-existing');
    if (existing) existing.remove();
    window._sigDrawn = true;
  }
  function move(e){
    if (!drawing) return;
    e.preventDefault();
    var p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  }
  function end(){ drawing = false; }
  c.addEventListener('mousedown',  start);
  c.addEventListener('mousemove',  move);
  window.addEventListener('mouseup', end);
  c.addEventListener('mouseleave', end);
  c.addEventListener('touchstart', start, { passive:false });
  c.addEventListener('touchmove',  move,  { passive:false });
  c.addEventListener('touchend',   end);
  c.addEventListener('pointerdown', start);
  c.addEventListener('pointermove', move);
  c.addEventListener('pointerup',   end);
}

function signaturePadClear() {
  var c = document.getElementById('cfg-sig-canvas');
  if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
  var existing = document.getElementById('cfg-sig-existing');
  if (existing) existing.remove();
  window._sigDrawn = true; // user explicitly cleared — counts as a fresh draw
  var status = document.getElementById('sig-pad-status');
  if (status) status.textContent = '';
}
function signaturePadUpload(inputEl) {
  var f = inputEl && inputEl.files && inputEl.files[0];
  if (!f) return;
  if (f.size > 1 * 1024 * 1024) {
    if (typeof showToast === 'function') showToast('Signature image too large (max 1MB)', 'error');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var c = document.getElementById('cfg-sig-canvas');
    if (!c) return;
    var ctx = c.getContext('2d');
    var img = new Image();
    img.onload = function() {
      ctx.clearRect(0, 0, c.width, c.height);
      // Letterbox-fit to canvas so it doesn't get squashed.
      var rW = c.width / img.naturalWidth, rH = c.height / img.naturalHeight;
      var r = Math.min(rW, rH);
      var dW = img.naturalWidth * r, dH = img.naturalHeight * r;
      ctx.drawImage(img, (c.width - dW) / 2, (c.height - dH) / 2, dW, dH);
      var existing = document.getElementById('cfg-sig-existing');
      if (existing) existing.remove();
      window._sigDrawn = true;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(f);
  inputEl.value = '';
}
function signaturePadRemove() {
  if (!requirePerm('canManageUsers', 'change workspace settings')) return;
  if (!confirm('Remove saved signature? Future agreements will print blank for the landlord signature.')) return;
  if (!state.config) state.config = {};
  state.config.companySignature = '';
  signaturePadClear();
  saveStateImmediate({ silentSuccess: true });
  if (typeof showToast === 'function') showToast('Signature removed', 'success');
  render();
}
function saveCompanySignature() {
  if (!requirePerm('canManageUsers', 'change workspace settings')) return;
  if (!state.config) state.config = {};
  var nameEl = document.getElementById('cfg-sig-name');
  var titleEl = document.getElementById('cfg-sig-title');
  var c = document.getElementById('cfg-sig-canvas');
  if (nameEl) state.config.companySignatoryName = (nameEl.value || '').trim();
  if (titleEl) state.config.companySignatoryTitle = (titleEl.value || '').trim();
  // Only overwrite the saved data URL if the user actually touched the canvas this session.
  if (c && window._sigDrawn) {
    // Detect blank canvas — every pixel transparent → don't save anything.
    try {
      var px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      var hasInk = false;
      for (var i = 3; i < px.length; i += 4) { if (px[i] !== 0) { hasInk = true; break; } }
      if (hasInk) {
        state.config.companySignature = c.toDataURL('image/png');
      } else {
        state.config.companySignature = '';
      }
    } catch (_e) { /* canvas tainted — skip */ }
  }
  window._sigDrawn = false;
  saveStateImmediate({ silentSuccess: true });
  if (typeof showToast === 'function') showToast('Signature saved ✓', 'success');
  render();
}

async function saveBranding() {
  if (!requirePerm('canManageUsers', 'change workspace settings')) return;
  if(!state.config) state.config={};
  var pn = document.getElementById('cfg-portname');
  var st = document.getElementById('cfg-sitetitle');
  if(pn) state.config.portfolioName = pn.value.trim();
  if(st) state.config.siteTitle     = st.value.trim();
  // Update live
  var sbSub = document.getElementById('sb-sub-txt');
  if(sbSub && state.config.portfolioName) sbSub.textContent = state.config.portfolioName;
  if(state.config.siteTitle) document.title = state.config.siteTitle;
  saveState();

  var tagEl = document.getElementById('cfg-pl-tagline');
  var waEl = document.getElementById('cfg-pl-wa');
  var skipEl = document.getElementById('cfg-pl-skipwa');
  if (tagEl && waEl && skipEl && _currentOrgId) {
    var hideWa = !!skipEl.checked;
    var tagline = tagEl.value.trim() || null;
    var waDigits = hideWa ? null : (waEl.value.replace(/\D/g, '') || null);
    var up = {
      public_listings_tagline: tagline,
      public_listings_whatsapp: waDigits,
      public_listings_whatsapp_skipped: hideWa,
    };
    var plRes = await supa.from('organisations').update(up).eq('id', _currentOrgId);
    if (plRes.error) {
      var m = plRes.error.message || 'Could not save public listings settings';
      if (/column/i.test(m) && /does not exist/i.test(m)) {
        m += ' Apply db/organisations_public_listings.sql on Supabase, then retry.';
      }
      showToast(m, 'error');
      return;
    }
    state._currentOrg = Object.assign({}, state._currentOrg || {}, up);
  }

  showToast('Branding saved ✓','success');
}

// Persist late-fee settings edited inline from the Settings → General tab.
// Mirrors the modal version (saveLateFeeSettings) but reads the cfg-lf-* IDs.
function saveLateFeesFromSettings() {
  if (!requirePerm('canManageUsers', 'change workspace settings')) return;
  if (!state.lateFeeConfig) state.lateFeeConfig = { enabled: false, feeType: 'fixed', feeAmount: 25, graceDays: 3 };
  var enabledEl = document.getElementById('cfg-lf-enabled');
  var typeEl    = document.getElementById('cfg-lf-type');
  var amtEl     = document.getElementById('cfg-lf-amount');
  var graceEl   = document.getElementById('cfg-lf-grace');
  if (!enabledEl) { if (typeof showToast === 'function') showToast('Form not found', 'error'); return; }
  state.lateFeeConfig.enabled   = !!enabledEl.checked;
  state.lateFeeConfig.feeType   = typeEl ? typeEl.value : (state.lateFeeConfig.feeType || 'fixed');
  state.lateFeeConfig.feeAmount = amtEl ? (+amtEl.value || 0) : (state.lateFeeConfig.feeAmount || 0);
  state.lateFeeConfig.graceDays = graceEl ? Math.max(0, +graceEl.value || 0) : (state.lateFeeConfig.graceDays || 0);
  if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
  if (typeof showToast === 'function') showToast('Late fee settings saved ✓', 'success');
  render();
}

async function saveCurrencyLanguage() {
  if (!requirePerm('canManageUsers', 'change workspace settings')) return;
  var currEl   = document.getElementById('cfg-currency');
  var langEl   = document.getElementById('cfg-language');
  var dateFmtEl = document.getElementById('cfg-datefmt');
  if (!currEl) { showToast('Form not found','error'); return; }
  if (!_currentOrgId) { showToast('Not logged in','error'); return; }

  var SYMBOLS = {
    GBP:'£', EUR:'€', USD:'$', CAD:'C$', AUD:'A$',
    NGN:'₦', GHS:'₵', ZAR:'R', KES:'KSh', INR:'₹'
  };
  var currency        = currEl.value    || 'GBP';
  var currency_symbol = SYMBOLS[currency] || currency;
  var language        = (langEl && langEl.value)   || 'en';
  var date_format     = (dateFmtEl && dateFmtEl.value) || 'DD/MM/YYYY';

  var up = { currency: currency, currency_symbol: currency_symbol, language: language, date_format: date_format };
  var res = await supa.from('organisations').update(up).eq('id', _currentOrgId);
  if (res.error) {
    var m = res.error.message || 'Save failed';
    if (/column/i.test(m) && /does not exist/i.test(m)) {
      m += ' — apply db/organisations_currency_language.sql on Supabase first.';
    }
    showToast(m, 'error');
    return;
  }
  state._currentOrg = Object.assign({}, state._currentOrg || {}, up);
  showToast('Currency & language saved ✓', 'success');
  render(); // re-render so all fmt() calls reflect new symbol immediately
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY CRUD
// ─────────────────────────────────────────────────────────────────────────────
function openAddCompanyModal() {
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:460px">'
    +'<div class="modal-header"><span class="modal-title">&#x1F3E2; New Company</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label class="field-label">Company Name *</label><input class="inp" id="co-name" placeholder="e.g. Urban Nest Property Ltd"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Company Number</label><input class="inp" id="co-regno" placeholder="12345678"></div>'
    +'<div class="field"><label class="field-label">VAT Number</label><input class="inp" id="co-vat" placeholder="GB123456789"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">Director / Partner</label><input class="inp" id="co-director" placeholder="e.g. Alex Morgan"></div>'
    +'<div class="field"><label class="field-label">Registered Address</label><input class="inp" id="co-address" placeholder="123 High Street, London, SW1A 1AA"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="co-email" type="email" placeholder="info@company.co.uk"></div>'
    +'<div class="field"><label class="field-label">Phone</label><input class="inp" id="co-phone" type="tel" placeholder="07911 000000"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">WhatsApp Number <span style="font-size:11px;color:var(--muted)">(used on Tenant Portal contact button)</span></label><input class="inp" id="co-wa" type="tel" placeholder="447911000000 (include country code)"></div>'
    +'<div class="field"><label class="field-label">Brand Colour</label><input class="inp" id="co-color" type="color" value="#6366F1" style="height:40px;padding:4px 8px;cursor:pointer"></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button onclick="saveNewCompany()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Company</button>'
    +'</div></div></div>';
}

function openEditCompanyModal(cid) {
  var co=(state.companies||[]).find(function(c){return c.id===cid;});
  if(!co) return;
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:460px">'
    +'<div class="modal-header"><span class="modal-title">&#x270F; Edit Company</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<input type="hidden" id="co-edit-id" value="'+co.id+'">'
    +'<div class="field"><label class="field-label">Company Name *</label><input class="inp" id="co-name" value="'+co.name+'"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Company Number</label><input class="inp" id="co-regno" value="'+(co.companyNo||co.regNo||'')+'"></div>'
    +'<div class="field"><label class="field-label">VAT Number</label><input class="inp" id="co-vat" value="'+(co.vatNo||'')+'"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">Director / Partner</label><input class="inp" id="co-director" value="'+(co.director||'')+'"></div>'
    +'<div class="field"><label class="field-label">Registered Address</label><input class="inp" id="co-address" value="'+(co.address||'')+'"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="co-email" value="'+(co.email||'')+'"></div>'
    +'<div class="field"><label class="field-label">Phone</label><input class="inp" id="co-phone" value="'+(co.phone||'')+'"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">WhatsApp Number <span style="font-size:11px;color:var(--muted)">(used on Tenant Portal contact button)</span></label><input class="inp" id="co-wa" type="tel" value="'+(co.whatsapp||co.phone||'')+'" placeholder="447911000000"></div>'
    +'<div class="field"><label class="field-label">Brand Colour</label><input class="inp" id="co-color" type="color" value="'+(co.color||'#6366F1')+'" style="height:40px;padding:4px 8px;cursor:pointer"></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button data-dcoid="'+co.id+'" onclick="deleteCompany(this.dataset.dcoid)" style="padding:9px 18px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Delete</button>'
    +'<button onclick="saveEditCompany()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Changes</button>'
    +'</div></div></div>';
}

function saveNewCompany() {
  if (!requirePerm('canEdit', 'manage companies')) return;
  var name=(document.getElementById('co-name').value||'').trim();
  if(!name){showToast('Company name required','error');return;}
  if(!_currentOrgId){showToast('Not signed in','error');return;}
  if(!state.companies) state.companies=[];
  state.companies.push({
    id:crypto.randomUUID(), name:name,
    companyNo:(document.getElementById('co-regno').value||'').trim(),
    vatNo:    (document.getElementById('co-vat').value||'').trim(),
    director: (document.getElementById('co-director').value||'').trim(),
    address:  (document.getElementById('co-address').value||'').trim(),
    email:    (document.getElementById('co-email').value||'').trim(),
    phone:    (document.getElementById('co-phone').value||'').trim(),
    whatsapp: (document.getElementById('co-wa').value||'').trim().replace(/\D/g,''),
    color:    document.getElementById('co-color').value
  });
  saveState(); closeModal(); render();
  showToast('Company saved ✓','success');
}

function saveEditCompany() {
  if (!requirePerm('canEdit', 'manage companies')) return;
  var cid=document.getElementById('co-edit-id').value;
  var co=(state.companies||[]).find(function(c){return c.id===cid;});
  if(!co) return;
  co.name      =(document.getElementById('co-name').value||'').trim();
  co.companyNo =(document.getElementById('co-regno').value||'').trim();
  co.vatNo     =(document.getElementById('co-vat').value||'').trim();
  co.director  =(document.getElementById('co-director').value||'').trim();
  co.address   =(document.getElementById('co-address').value||'').trim();
  co.email     =(document.getElementById('co-email').value||'').trim();
  co.phone     =(document.getElementById('co-phone').value||'').trim();
  co.whatsapp  =(document.getElementById('co-wa').value||'').trim().replace(/\D/g,'');
  co.color     =document.getElementById('co-color').value;
  saveState(); closeModal(); render();
  showToast('Company updated ✓','success');
}

function deleteCompany(cid) {
  if (!requirePerm('canDelete', 'delete a company')) return;
  if(!confirm('Delete this company? Properties will become unassigned.')) return;
  state.companies=(state.companies||[]).filter(function(c){return c.id!==cid;});
  state.properties.forEach(function(p){if(p.companyId===cid) p.companyId='';});
  supaDelete('companies', cid);
  saveState(); closeModal(); render();
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS — invite, edit, delete
// ─────────────────────────────────────────────────────────────────────────────
function openInviteUserModal() {
  if (!requirePerm('canManageUsers', 'invite users')) return;
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:440px"><div class="modal-header">'
    +'<span class="modal-title">&#x2709; Invite User</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<div style="background:var(--accent-light);border:1px solid var(--accent);border-radius:9px;padding:11px 13px;margin-bottom:14px;font-size:12px;color:var(--accent-dark)">'
    +'&#x2139;&#xFE0F; An invite email is sent. The user clicks the link and is logged in automatically.'
    +'</div>'
    +'<div class="field"><label class="field-label">Email Address *</label>'
    +'<input class="inp" id="inv-email" type="email" placeholder="fred@reservationsdirect.co.uk"></div>'
    +'<div class="field"><label class="field-label">Full Name</label>'
    +'<input class="inp" id="inv-name" placeholder="Fred Mensah"></div>'
    +'<div class="field"><label class="field-label">Role</label>'
    +'<select class="inp" id="inv-role">'
    +'<option value="viewer">&#x1F441;&#xFE0F; Viewer</option>'
    +'<option value="maintenance">&#x1F527; Maintenance</option>'
    +'<option value="manager">&#x1F4BC; Manager</option>'
    +'<option value="admin">&#x1F451; Admin</option>'
    +'</select></div>'
    +'<div id="inv-status" style="display:none;padding:10px 12px;border-radius:9px;font-size:13px;font-weight:600;margin-top:8px"></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button id="inv-btn" onclick="sendInvite()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Send Invite</button>'
    +'</div></div></div>';
}

async function sendInvite() {
  var email=(document.getElementById('inv-email').value||'').trim();
  var name =(document.getElementById('inv-name').value||'').trim();
  var role = document.getElementById('inv-role').value;
  var statusEl=document.getElementById('inv-status');
  var btn=document.getElementById('inv-btn');
  if(!email){showToast('Email required','error');return;}
  if(!_currentOrgId){showToast('No organisation loaded','error');return;}
  btn.disabled=true; btn.textContent='Sending…';
  statusEl.style.display='none';
  try {
    // Server endpoint adds the user to org_members of the CURRENT org and
    // sends a Supabase invite email. Without this, signInWithOtp creates a fresh
    // org for the invitee instead of adding them as internal staff.
    var sr = await supa.auth.getSession();
    var session = sr && sr.data ? sr.data.session : null;
    if(!session) throw new Error('Sign in required');
    var resp = await fetch('/api/users/invite', {
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body: JSON.stringify({orgId:_currentOrgId, email:email, name:name, role:role})
    });
    var data = await resp.json().catch(function(){return {};});
    if(!resp.ok) throw new Error((data && data.error) || ('Server returned '+resp.status));
    var initials=name?name.split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2):email.slice(0,2).toUpperCase();
    if(!state.users.find(function(u){return u.email===email;})){
      state.users.push({id:crypto.randomUUID(),name:name||email,initials:initials,email:email,phone:'',role:role,status:'pending',lastLogin:'Never'});
      saveState();
    }
    statusEl.style.cssText='display:block;background:#D1FAE5;border:1px solid #A7F3D0;color:#065F46;padding:10px 12px;border-radius:9px;font-size:13px';
    statusEl.innerHTML='&#x2713; Invite sent to '+email+' — they\'ll be added to your team when they accept.';
    btn.textContent='Sent ✓'; btn.style.background='var(--green)';
    setTimeout(function(){closeModal();render();},2000);
  } catch(e){
    statusEl.style.cssText='display:block;background:#FEE2E2;border:1px solid #FECDD3;color:#B91C1C;padding:10px 12px;border-radius:9px;font-size:13px';
    statusEl.textContent='Error: '+(e.message||'Could not send invite');
    btn.disabled=false; btn.textContent='Send Invite';
  }
}

function editUserModal(uid) {
  if (!requirePerm('canManageUsers', 'edit users')) return;
  var u=state.users.find(function(x){return String(x.id)===String(uid);});
  if(!u) return;
  var allRoles=Object.keys(state.roles);
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:420px"><div class="modal-header">'
    +'<span class="modal-title">&#x270F; Edit User</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<input type="hidden" id="edit-uid" value="'+u.id+'">'
    +'<div class="field"><label class="field-label">Full Name</label>'
    +'<input class="inp" id="edit-name" value="'+u.name+'"></div>'
    +'<div class="field"><label class="field-label">Email</label>'
    +'<input class="inp" id="edit-email" type="email" value="'+(u.email||'')+'"></div>'
    +'<div class="field"><label class="field-label">Phone</label>'
    +'<input class="inp" id="edit-phone" value="'+(u.phone||'')+'"></div>'
    +'<div class="field"><label class="field-label">Role</label>'
    +'<select class="inp" id="edit-role">'
    +allRoles.map(function(rk){return '<option value="'+rk+'" '+(u.role===rk?'selected':'')+'>'+state.roles[rk].icon+' '+state.roles[rk].label+'</option>';}).join('')
    +'</select></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button onclick="saveEditUser()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save</button>'
    +'</div></div></div>';
}

async function saveEditUser() {
  if (!requirePerm('canManageUsers', 'edit users')) return;
  var uid=document.getElementById('edit-uid').value;
  var u=state.users.find(function(x){return String(x.id)===String(uid);});
  if(!u) return;
  var newName  = (document.getElementById('edit-name').value||'').trim()||u.name;
  var newEmail = (document.getElementById('edit-email').value||'').trim();
  var newPhone = (document.getElementById('edit-phone').value||'').trim();
  var newRole  = document.getElementById('edit-role').value;

  // Persist name + email to org_members so other admins on other devices see
  // the real name (not "User f0b212"). Without this DB write, edits would
  // only live in local state and revert to the server-side placeholder on
  // the next full reload. Falls back gracefully if the
  // db/org_members_invited_name.sql migration hasn't been applied yet.
  if (typeof supa !== 'undefined' && _currentOrgId) {
    try {
      var patch = { role: newRole, invited_name: newName, invited_email: newEmail || null };
      var res = await supa.from('org_members')
        .update(patch)
        .eq('user_id', String(uid))
        .eq('org_id', _currentOrgId);
      if (res && res.error) {
        var errCode = String(res.error.code || '');
        var errMsg  = String(res.error.message || '');
        var missingCol = errCode === '42703' || errCode === 'PGRST204'
          || /invited_name|invited_email|column.*not found/i.test(errMsg);
        if (missingCol) {
          // Migration not yet applied — retry without the new columns.
          console.warn('[saveEditUser] org_members.invited_name missing — run db/org_members_invited_name.sql to persist names server-side');
          var fallback = await supa.from('org_members')
            .update({ role: newRole })
            .eq('user_id', String(uid))
            .eq('org_id', _currentOrgId);
          if (fallback && fallback.error) {
            showToast('Saved locally only — DB update failed: ' + fallback.error.message, 'warn');
          } else {
            showToast('Saved (heads-up: invited_name column missing — run latest DB migration)', 'warn');
          }
        } else {
          showToast('DB update failed: ' + errMsg, 'error');
          return;
        }
      }
    } catch(e) {
      showToast('DB update error: ' + (e.message || 'unknown'), 'error');
      return;
    }
  }

  // Local state mirror — keeps UI snappy + matches what got saved.
  u.name = newName;
  u.email = newEmail;
  u.phone = newPhone;
  u.role = newRole;
  u.initials = u.name.split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
  if(String(u.id)===String(state.currentUser.id)){
    state.currentUser.name=u.name; state.currentUser.role=u.role; state.currentUser.initials=u.initials;
  }
  saveState(); closeModal(); render();
  showToast('User updated ✓','success');
}

async function deleteUserBtn(el) {
  if (!requirePerm('canManageUsers', 'delete users')) return;
  var uid=el.dataset.uid;
  var u=state.users.find(function(x){return String(x.id)===String(uid);});
  if(!u||!confirm('Permanently delete '+u.name+'? This cannot be undone.')) return;
  state.users=state.users.filter(function(x){return String(x.id)!==String(uid);});
  try{await supa.from('org_members').delete().eq('user_id',String(uid));}catch(e){console.warn(e);}
  saveState();render();
  showToast('User permanently removed','success');
}

function updateUserRoleByEl(sel) { updateUserRole(sel.dataset.uruid, sel.value); }


// ─────────────────────────────────────────────────────────────────────────────
// DOC PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
// Lazy-loads doc.dataUrl on demand. data_url is excluded from loadState to
// keep the boot fetch lean (legacy docs can carry MBs of base64). Returns
// the doc with dataUrl populated, or null if not found / fetch failed.
async function _loadDocDataUrl(docId) {
  var doc = null;
  var table = null;
  if (state.vault) {
    Object.keys(state.vault).some(function(tid){
      var match = (state.vault[tid]||[]).find(function(d){ return d.id === docId || d.name === docId; });
      if (match) { doc = match; table = 'tenant_docs'; return true; }
      return false;
    });
  }
  if (!doc && state.propDocs) {
    Object.keys(state.propDocs).some(function(pid){
      var match = (state.propDocs[pid]||[]).find(function(d){ return d.id === docId || d.name === docId; });
      if (match) { doc = match; table = 'property_docs'; return true; }
      return false;
    });
  }
  if (!doc) return null;
  if (doc.dataUrl) return doc; // already loaded earlier
  try {
    var r = await supa.from(table).select('data_url').eq('id', doc.id).maybeSingle();
    if (!r.error && r.data) doc.dataUrl = r.data.data_url || '';
  } catch (e) {
    console.warn('[_loadDocDataUrl] fetch failed:', e && e.message);
  }
  return doc;
}

// Triggers a browser download for a stored doc. Lazy-loads data_url first.
async function downloadDoc(docId) {
  var doc = await _loadDocDataUrl(docId);
  if (!doc || !doc.dataUrl) { if (typeof showToast === 'function') showToast('Could not fetch document','error'); return; }
  var a = document.createElement('a');
  a.href = doc.dataUrl;
  a.download = doc.name || 'document';
  if (doc.dataUrl.indexOf('http') === 0) a.target = '_blank';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ a.remove(); }, 100);
}

async function previewDoc(docId) {
  // Ensure dataUrl is loaded for THIS specific doc — kept out of loadState
  // since legacy base64 docs can run to MBs per row. One round-trip per
  // first-preview, then cached on the in-memory doc.
  var docPre = await _loadDocDataUrl(docId);
  var doc = docPre;
  if(!doc || !doc.dataUrl) { showToast('No preview available','error'); return; }
  var isPdf = doc.name && doc.name.match(/\.pdf$/i);
  var isImg = doc.name && doc.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  var isSupaUrl = doc.dataUrl && doc.dataUrl.indexOf('supabase.co') >= 0;
  if(isSupaUrl){
    document.getElementById('modal-container').innerHTML =
      '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
      +'<div class="modal" style="max-width:460px"><div class="modal-header">'
      +'<span class="modal-title">'+doc.name+'</span>'
      +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
      +'<div class="modal-body" style="text-align:center;padding:32px 24px">'
      +'<div style="font-size:52px;margin-bottom:16px">'+(isPdf?'&#x1F4C4;':isImg?'&#x1F5BC;&#xFE0F;':'&#x1F4CB;')+'</div>'
      +'<div style="font-size:15px;font-weight:700;margin-bottom:6px">'+doc.name+'</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:24px">'+(doc.type||'Document')+(doc.size?' &middot; '+doc.size:'')+'</div>'
      +'<div style="display:flex;gap:10px;justify-content:center">'
      +'<a href="'+doc.dataUrl+'" target="_blank" style="padding:11px 24px;border-radius:10px;background:var(--accent);color:#fff;font-size:14px;font-weight:700;text-decoration:none">Open / View</a>'
      +'<a href="'+doc.dataUrl+'" download="'+doc.name+'" style="padding:11px 24px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;font-weight:700;text-decoration:none">Download</a>'
      +'</div></div>'
      +'<div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">Close</button></div>'
      +'</div></div>';
    return;
  }
  var inner = isPdf
    ? '<iframe src="'+doc.dataUrl+'" style="width:100%;height:70vh;border:none;border-radius:8px"></iframe>'
    : isImg
      ? '<img src="'+doc.dataUrl+'" style="max-width:100%;max-height:70vh;border-radius:8px;display:block;margin:0 auto">'
      : '<div style="padding:40px;text-align:center;color:var(--muted)">Preview not available for this file type.<br><a href="'+doc.dataUrl+'" download="'+doc.name+'" style="color:var(--blue)">Download instead ↓</a></div>';
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()" style="align-items:flex-start;padding-top:40px">'
    +'<div class="modal" style="max-width:900px;width:95vw">'
    +'<div class="modal-header"><span class="modal-title">👁 '+doc.name+'</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body" style="padding:16px">'+inner+'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Close</button>'
    +'<a href="'+doc.dataUrl+'" download="'+doc.name+'" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;text-decoration:none">↓ Download</a>'
    +'</div></div></div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — MAINTENANCE
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTORS
// ─────────────────────────────────────────────────────────────────────────────
const CONTRACTOR_TRADES = ['General','Plumbing','Electrical','Heating','Structural','Cleaning','Pest Control','Locks / Security','Garden','White Goods','Broadband / WiFi','Other'];


function openContractorProfile(id) {
  var c=(state.contractors||[]).find(function(x){return x.id===id;});if(!c)return;
  var jobs=state.maintenance.filter(function(m){return m.contractor===c.name;});
  jobs.sort(function(a,b){return new Date(b.date||0)-new Date(a.date||0);});
  var totalPaid=0,openJobs=0,resolvedJobs=0,invoices=[];
  jobs.forEach(function(m){
    var mx=(state.maintExtras&&state.maintExtras[m.id])||{};
    if(mx.cost)totalPaid+=mx.cost;
    if(m.status==='resolved')resolvedJobs++;else openJobs++;
    if(mx.invoiceName)invoices.push({job:m.issue,name:mx.invoiceName,url:mx.invoiceUrl||'#',cost:mx.cost||0,date:m.date,property:m.property});
  });
  var stars=c.rating?'★'.repeat(c.rating)+'☆'.repeat(5-c.rating):'—';
  var tc={'Plumbing':'var(--blue)','Electrical':'var(--amber)','Heating':'#EF4444','Cleaning':'var(--green)'}[c.trade]||'var(--muted)';
  function sc(s){return s==='resolved'?'var(--green)':s==='in_progress'?'var(--amber)':'var(--red)';}
  function sl(s){return s==='in_progress'?'In Progress':s==='resolved'?'Resolved':'Open';}
  var html='<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:640px">'
    +'<div class="modal-header" style="background:linear-gradient(135deg,#0F0F1A,#1a1a3e)">'
    +'<div style="display:flex;align-items:center;gap:14px;width:100%">'
    +'<div style="width:48px;height:48px;border-radius:50%;background:'+tc+';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">👷</div>'
    +'<div style="flex:1"><div style="font-size:16px;font-weight:800;color:#fff">'+c.name+'</div>'
    +'<div style="display:flex;gap:8px;margin-top:3px">'
    +'<span style="font-size:11px;font-weight:700;color:'+tc+';background:rgba(255,255,255,.1);padding:2px 9px;border-radius:10px">'+c.trade+'</span>'
    +(c.rating?'<span style="font-size:12px;color:#F59E0B">'+stars+'</span>':'')
    +'</div></div>'
    +'<button class="modal-close" onclick="closeModal()" style="color:#fff">&times;</button></div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border)">'
    +[['Total Spent',totalPaid?'£'+totalPaid.toLocaleString():'£0','var(--red)'],
      ['Total Jobs',jobs.length,'var(--text)'],
      ['Open',openJobs,openJobs?'var(--amber)':'var(--green)'],
      ['Invoices',invoices.length,'var(--blue)']
    ].map(function(k){return '<div style="padding:14px;text-align:center;border-right:1px solid var(--border)"><div style="font-size:18px;font-weight:800;font-family:monospace;color:'+k[2]+'">'+k[1]+'</div><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-top:2px">'+k[0]+'</div></div>';}).join('')
    +'</div>'
    +'<div style="overflow-y:auto;max-height:60vh">'
    +'<div style="padding:16px 20px;border-bottom:1px solid var(--border)">'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Contact</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px">'
    +(c.phone?'<a href="tel:'+c.phone+'" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;color:var(--text);text-decoration:none">📞 '+c.phone+'</a>':'')
    +(c.whatsapp?'<a href="https://wa.me/'+String(c.whatsapp||'').replace(/\D/g,'')+'" target="_blank" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid #BBF7D0;background:#F0FDF4;font-size:12px;font-weight:600;color:#16A34A;text-decoration:none">💬 WhatsApp</a>':'')
    +(c.email?'<a href="mailto:'+c.email+'" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid #BFDBFE;background:var(--blue-light);font-size:12px;font-weight:600;color:var(--blue);text-decoration:none">✉ '+c.email+'</a>':'')
    +(c.callOutCharge?'<span style="padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;color:var(--muted)">💷 £'+c.callOutCharge+' call-out</span>':'')
    +'</div>'+(c.notes?'<div style="margin-top:10px;font-size:12px;color:var(--muted);background:var(--bg);padding:8px 12px;border-radius:8px">'+c.notes+'</div>':'')
    +'</div>';
  if(invoices.length){
    html+='<div style="padding:16px 20px;border-bottom:1px solid var(--border)">';
    html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Invoices & Receipts</div>';
    invoices.forEach(function(inv){
      html+='<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:9px;margin-bottom:6px">'
        +'<div style="font-size:20px">📄</div>'
        +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+inv.name+'</div>'
        +'<div style="font-size:11px;color:var(--muted)">'+inv.job+' · '+inv.property+'</div></div>'
        +(inv.cost?'<span style="font-size:13px;font-weight:800;color:var(--red);font-family:monospace;flex-shrink:0">£'+inv.cost+'</span>':'')
        +'<a href="'+inv.url+'" download="'+inv.name+'" style="padding:5px 10px;border-radius:7px;border:1.5px solid var(--blue);background:#fff;font-size:11px;font-weight:700;color:var(--blue);text-decoration:none;flex-shrink:0">Download</a></div>';
    });
    html+='</div>';
  }
  html+='<div style="padding:16px 20px">';
  html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Job History ('+jobs.length+')</div>';
  if(!jobs.length){html+='<div style="text-align:center;padding:24px;color:var(--dim);font-size:13px">No jobs assigned yet</div>';}
  else{jobs.forEach(function(m){
    var mx=(state.maintExtras&&state.maintExtras[m.id])||{};
    html+='<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">'
      +'<div style="width:10px;height:10px;border-radius:50%;background:'+sc(m.status)+';flex-shrink:0;margin-top:4px"></div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="font-size:13px;font-weight:700">'+m.issue+'</div>'
      +(mx.cost?'<div style="font-size:13px;font-weight:800;color:var(--red);font-family:monospace;flex-shrink:0">£'+mx.cost+'</div>':'')
      +'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+m.property+(m.room?' · Room '+m.room:'')+'</div>'
      +'<div style="display:flex;gap:7px;margin-top:5px;flex-wrap:wrap">'
      +'<span style="font-size:10px;font-weight:700;color:'+sc(m.status)+';padding:2px 8px;border-radius:10px;border:1px solid '+sc(m.status)+'">'+sl(m.status)+'</span>'
      +(m.cat?'<span style="font-size:10px;color:var(--dim)">'+m.cat+'</span>':'')
      +(m.date?'<span style="font-size:10px;color:var(--dim)">'+m.date+'</span>':'')
      +'</div>'
      +(m.notes?'<div style="font-size:11px;color:var(--muted);margin-top:4px;padding:5px 8px;background:var(--bg);border-radius:6px">'+m.notes+'</div>':'')
      +(mx.invoiceName?'<div style="margin-top:5px"><a href="'+(mx.invoiceUrl||'#')+'" download="'+mx.invoiceName+'" style="font-size:11px;font-weight:600;color:var(--blue)">📄 '+mx.invoiceName+'</a></div>':'')
      +'</div></div>';
  });}
  html+='</div></div>';
  html+='<div class="modal-footer" style="justify-content:space-between">'
    +'<button onclick="openEditContractorModal(\''+id+'\');closeModal()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--muted)">✏️ Edit Profile</button>'
    +'<button onclick="closeModal()" style="padding:9px 20px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Close</button>'
    +'</div></div></div>';
  document.getElementById('modal-container').innerHTML=html;
}

function openAddContractorModal() {
  var tradeOpts = CONTRACTOR_TRADES.map(function(t){ return '<option>'+t+'</option>'; }).join('');
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:500px">'
    +'<div class="modal-header"><span class="modal-title">➕ Add Contractor</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="row-2"><div class="field"><label class="field-label">Name *</label><input class="inp" id="cx-name" placeholder="e.g. Bob Smith Plumbing"></div>'
    +'<div class="field"><label class="field-label">Trade</label><select class="inp" id="cx-trade">'+tradeOpts+'</select></div></div>'
    +'<div class="row-2"><div class="field"><label class="field-label">Phone</label><input class="inp" id="cx-phone" type="tel" placeholder="07911000000"></div>'
    +'<div class="field"><label class="field-label">WhatsApp number</label><input class="inp" id="cx-wa" type="tel" placeholder="447911000000"></div></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="cx-email" type="email" placeholder="contractor@email.com"></div>'
    +'<div class="row-2"><div class="field"><label class="field-label">Call-out charge (£)</label><input class="inp" id="cx-callout" type="number" placeholder="0"></div>'
    +'<div class="field"><label class="field-label">Rating (1–5)</label><select class="inp" id="cx-rating"><option value="">—</option>'
    +'<option value="5">★★★★★ Excellent</option><option value="4">★★★★☆ Good</option><option value="3">★★★☆☆ OK</option><option value="2">★★☆☆☆ Poor</option><option value="1">★☆☆☆☆ Avoid</option>'
    +'</select></div></div>'
    +'<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="cx-notes" rows="2" placeholder="Specialisms, areas covered, payment terms…" style="resize:vertical"></textarea></div>'
    +'<div class="modal-footer">'
    +btn('Cancel','closeModal()','secondary')
    +btn('Add Contractor','saveContractor(null)','primary')
    +'</div></div></div></div>';
}

function openEditContractorModal(id) {
  var c = (state.contractors||[]).find(function(x){ return x.id===id; });
  if(!c) return;
  var tradeOpts = CONTRACTOR_TRADES.map(function(t){ return '<option '+(t===c.trade?'selected':'')+'>'+t+'</option>'; }).join('');
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:500px">'
    +'<div class="modal-header"><span class="modal-title">✏️ Edit Contractor</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="row-2"><div class="field"><label class="field-label">Name *</label><input class="inp" id="cx-name" value="'+c.name+'"></div>'
    +'<div class="field"><label class="field-label">Trade</label><select class="inp" id="cx-trade">'+tradeOpts+'</select></div></div>'
    +'<div class="row-2"><div class="field"><label class="field-label">Phone</label><input class="inp" id="cx-phone" type="tel" value="'+(c.phone||'')+'"></div>'
    +'<div class="field"><label class="field-label">WhatsApp number</label><input class="inp" id="cx-wa" type="tel" value="'+(c.whatsapp||'')+'"></div></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="cx-email" type="email" value="'+(c.email||'')+'"></div>'
    +'<div class="row-2"><div class="field"><label class="field-label">Call-out charge (£)</label><input class="inp" id="cx-callout" type="number" value="'+(c.callOutCharge||'')+'"></div>'
    +'<div class="field"><label class="field-label">Rating (1–5)</label><select class="inp" id="cx-rating"><option value="">—</option>'
    +[5,4,3,2,1].map(function(n){ return '<option value="'+n+'" '+(c.rating===n?'selected':'')+'>'+'★'.repeat(n)+'☆'.repeat(5-n)+' '+(n===5?'Excellent':n===4?'Good':n===3?'OK':n===2?'Poor':'Avoid')+'</option>'; }).join('')
    +'</select></div></div>'
    +'<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="cx-notes" rows="2" style="resize:vertical">'+(c.notes||'')+'</textarea></div>'
    +'<div class="modal-footer" style="justify-content:space-between">'
    +'<button onclick="deleteContractor(\''+id+'\')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">🗑 Delete</button>'
    +'<div style="display:flex;gap:8px">'+btn('Cancel','closeModal()','secondary')+btn('Save Changes','saveContractor(\''+id+'\')','primary')+'</div>'
    +'</div></div></div></div>';
}

function saveContractor(id) {
  if (!requirePerm('canEdit', id ? 'edit a contractor' : 'add a contractor')) return;
  var name = (document.getElementById('cx-name')||{value:''}).value.trim();
  if(!name){ alert('Please enter a contractor name.'); return; }
  var c = {
    id:   id || crypto.randomUUID(),
    name: name,
    trade:        (document.getElementById('cx-trade')||{value:'General'}).value,
    phone:        (document.getElementById('cx-phone')||{value:''}).value.trim(),
    whatsapp:     (document.getElementById('cx-wa')||{value:''}).value.trim().replace(/\s+/g,'').replace(/^\+/,''),
    email:        (document.getElementById('cx-email')||{value:''}).value.trim(),
    callOutCharge:+(document.getElementById('cx-callout')||{value:0}).value||0,
    rating:       +((document.getElementById('cx-rating')||{value:''}).value)||null,
    notes:        (document.getElementById('cx-notes')||{value:''}).value.trim(),
    lastUsed:     id ? ((state.contractors||[]).find(function(x){return x.id===id;})||{}).lastUsed : null,
  };
  if(!state.contractors) state.contractors = [];
  if(id) {
    var idx = state.contractors.findIndex(function(x){ return x.id===id; });
    if(idx>=0) state.contractors[idx] = c; else state.contractors.push(c);
  } else {
    state.contractors.push(c);
  }
  closeModal();
  saveState();
  render();
}

function deleteContractor(id) {
  if (!requirePerm('canDelete', 'delete a contractor')) return;
  if(!confirm('Delete this contractor?')) return;
  state.contractors = (state.contractors||[]).filter(function(c){ return c.id!==id; });
  closeModal();
  saveState();
  render();
}
