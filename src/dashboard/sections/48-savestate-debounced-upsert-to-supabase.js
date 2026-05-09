// ── saveState: debounced upsert to Supabase ───────────────
var _saveTimer = null;
var _configSaveTimer = null;
function _persistLocalKeys(){
  try {
    // NOTE: 'config' and 'roles' are intentionally excluded here — they are
    // persisted to Supabase organisations.app_config (see _persistConfigToSupabase).
    // localStorage is only used as a fast in-session fallback for non-critical state.
    var localKeys = ['rentSchedule','roomMedia','voidDates','lateFeeConfig','users','maintExtras','dealInputs'];
    localKeys.forEach(function(k){
      if(state[k]!==undefined) {
        try { 
          var storageKey = orgStorageKey('pm_local_' + k);
          localStorage.setItem(storageKey, JSON.stringify(state[k])); 
        }
        catch(e) { console.warn('localStorage full for key:', k, e); }
      }
    });
    try { localStorage.setItem(orgStorageKey('pm_local_page'), state.page); } catch(e) {}
  } catch(e) {}
}

/** Persist branding config + custom roles to Supabase organisations.app_config. Debounced unless immediate=true. */
function _persistConfigToSupabase(immediate) {
  if (!_currentOrgId) return;
  clearTimeout(_configSaveTimer);
  function _doConfigSave() {
    var payload = {
      config: state.config || {},
      roles: state.roles || {}
    };
    supa.from('organisations')
      .update({ app_config: payload })
      .eq('id', _currentOrgId)
      .then(function(res) {
        if (res.error) {
          var errCode = String(res.error.code || '');
          var errMsg = String(res.error.message || '');
          var isColMissing = errCode === '42703' || errCode === 'PGRST204' || errMsg.indexOf('app_config') !== -1;
          if (isColMissing) {
            console.warn('organisations.app_config column missing or cache stale. Run migration + "NOTIFY pgrst, \'reload schema\';" in Supabase.');
            try {
              localStorage.setItem(orgStorageKey('pm_local_config'), JSON.stringify(state.config || {}));
              localStorage.setItem(orgStorageKey('pm_local_roles'), JSON.stringify(state.roles || {}));
            } catch(e) {}
          } else {
            console.warn('Failed to save config to Supabase:', res.error.message);
          }
        }
      });
  }
  if (immediate) { _doConfigSave(); }
  else { _configSaveTimer = setTimeout(_doConfigSave, 1500); }
}

function saveState(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function(){ _doSupaSave({}); }, 1500);
  _persistLocalKeys();
  _persistConfigToSupabase();
}
/** Flush to Supabase now (e.g. archive/restore). Default saveState() waits 1.5s — refresh before then loses changes. */
function saveStateImmediate(opts){
  clearTimeout(_saveTimer);
  clearTimeout(_configSaveTimer);
  _saveTimer = null;
  _configSaveTimer = null;
  _persistLocalKeys();
  _persistConfigToSupabase(true); // M1 FIX: flush config immediately, not debounced
  return _doSupaSave(opts || {});
}
function showToast(msg, type) {
  var el = document.getElementById('pm-toast');
  if(!el) {
    el = document.createElement('div');
    el.id = 'pm-toast';
    el.className = 'pm-toast';
    document.body.appendChild(el);
    // Tap-to-dismiss — fixes "stuck" timeout/error messages staying on screen.
    el.addEventListener('click', function(){
      clearTimeout(el._t);
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    });
    el.style.cursor = 'pointer';
  }
  el.textContent = msg;
  el.className = 'pm-toast ' + (type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'success');
  el.style.opacity = '1';
  el.style.pointerEvents = 'auto';
  el.title = 'Click to dismiss';
  clearTimeout(el._t);
  // Errors get a longer read window (6s) so the user has time to scan a long
  // server message; success toasts stay snappy (2.5s).
  var dwell = (type === 'error') ? 6000 : (type === 'warn' ? 4000 : 2500);
  el._t = setTimeout(function(){
    el.style.opacity='0';
    el.style.pointerEvents = 'none';
  }, dwell);
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

// ── Diff-based upsert cache ───────────────────────────────────────────────
// Drastically cuts egress. Without this, every saveState() pushes ALL rows
// of ALL 12 tables — even when only one tenant changed. With ~140 tenants ×
// ~12 weeks of payments × multiple saves per minute, that's the exact pattern
// that blew the Supabase free tier 5 GB egress quota. By comparing the
// JSON-stringified rows against the last successful save, unchanged tables
// are skipped entirely (no network round-trip, no DB compute, no egress).
//
// First save of a session is a full sync (cache empty); from save #2 onward
// only tables that actually changed are pushed.
var _lastSavedSnapshot = {};

// ── Tombstone Set: recently-deleted IDs to filter out of autosave payloads ──
// Without this, deleting a row triggers a delete-then-autosave race: the bulk
// autosave's row payload (built from state.X *before* the delete) still
// contains the deleted row, so the DELETE is followed by an UPSERT that
// re-INSERTs the row. Multi-row deletes (user nukes 30 tenants in a row) lose
// most of them this way.
//
// We add an id to the tombstone set right before the DELETE, the autosave
// filters those ids out of every upsert payload, and after a grace period
// (60 s — long enough for any in-flight autosaves to settle) we forget the id
// so a fresh row with the same id (e.g. demo reset) can be persisted normally.
var _deletedTombstones = { tenants: {}, properties: {}, payments: {}, expenses: {}, maintenance: {}, contractors: {}, landlords: {}, companies: {}, clients: {}, landlord_payments: {} };
function markRowDeleted(table, id) {
  if (!_deletedTombstones[table]) _deletedTombstones[table] = {};
  var key = String(id);
  _deletedTombstones[table][key] = Date.now();
  setTimeout(function(){
    if (_deletedTombstones[table] && _deletedTombstones[table][key]) {
      delete _deletedTombstones[table][key];
    }
  }, 60000);
}
function _filterTombstones(table, rows) {
  var ts = _deletedTombstones[table];
  if (!ts || !rows) return rows;
  var keys = Object.keys(ts);
  if (!keys.length) return rows;
  return rows.filter(function(r){ return r && !ts[String(r.id)]; });
}
if (typeof window !== 'undefined') {
  window.markRowDeleted = markRowDeleted;
  window._deletedTombstones = _deletedTombstones;
}

// ── Cross-session ID tracking: which IDs have we confirmed are persisted? ──
// The tombstone Set above only protects deletes done in *this* tab during the
// last 60s. It can't protect against another tab/device deleting a tenant
// behind our back — when this tab's next bulk autosave fires, its tenantRows
// payload still contains the deleted row, the upsert's
// `INSERT ... ON CONFLICT id DO UPDATE` finds no conflict (row is gone), and
// the deleted row is RE-INSERTED. With staff working remotely on multiple
// devices, the user sees deleted tenants reappear after a refresh.
//
// Fix: maintain a set of "ids we know have been persisted to DB at some point"
// (populated by loadState + every successful upsert). Before each tenants
// upsert, fetch the current live IDs from DB. If a row's id is in
// `_persistedIds.tenants` but NOT in the live set, another session deleted it
// — strip it from the upsert payload AND from local state so this tab
// converges with DB truth.
//
// Cost: one extra `select id` per autosave (~5 KB for a 200-tenant org,
// <50 ms). Closes the multi-tab race that the tombstone alone can't.
var _persistedIds = { tenants: Object.create(null), properties: Object.create(null) };
function _setPersistedTenantIds(ids) {
  _persistedIds.tenants = Object.create(null);
  if (Array.isArray(ids)) {
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] != null) _persistedIds.tenants[String(ids[i])] = true;
    }
  }
}
function _setPersistedPropertyIds(ids) {
  _persistedIds.properties = Object.create(null);
  if (Array.isArray(ids)) {
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] != null) _persistedIds.properties[String(ids[i])] = true;
    }
  }
}
if (typeof window !== 'undefined') {
  window._setPersistedTenantIds = _setPersistedTenantIds;
  window._setPersistedPropertyIds = _setPersistedPropertyIds;
  window._persistedIds = _persistedIds;
}

function _snapKey(table) { return (_currentOrgId || 'noorg') + '::' + table; }
function _changedSinceLastSave(table, rows) {
  var sig = JSON.stringify(rows);
  return _lastSavedSnapshot[_snapKey(table)] !== sig;
}
function _markTableSaved(table, rows) {
  _lastSavedSnapshot[_snapKey(table)] = JSON.stringify(rows);
}
/** Wraps _supaUpsert: skips the network call entirely if the rows match the
 *  last successful save for this table+org. Also filters out any tombstoned
 *  (recently-deleted) ids so a delete-then-autosave race can't re-INSERT
 *  the deleted row via the upsert's ON CONFLICT path. */
async function _upsertIfChanged(table, rows, opts) {
  rows = _filterTombstones(table, rows);
  if (!_changedSinceLastSave(table, rows)) return null;
  var err = await _supaUpsert(table, rows, opts);
  if (!err) _markTableSaved(table, rows);
  return err;
}
/** Reset the diff cache — call after a fresh state load so the first save
 *  baselines against DB-truth instead of triggering a full re-upload. Also
 *  clears the persisted-IDs set since a fresh load (e.g. org switch) means
 *  prior IDs are no longer authoritative. */
function _resetSaveSnapshot() {
  _lastSavedSnapshot = {};
  _persistedIds.tenants = Object.create(null);
  _persistedIds.properties = Object.create(null);
}
if (typeof window !== 'undefined') window._resetSaveSnapshot = _resetSaveSnapshot;

/** Tenants-specific upsert that protects against cross-session resurrection.
 *  Before the upsert, fetches the current live tenant IDs from DB and strips
 *  any row whose id WAS persisted to DB at some prior point but is now missing
 *  — that's a row deleted in another tab/device/session. Stripped rows are
 *  also removed from local state so this tab converges with DB truth.
 *
 *  Falls back to a plain upsert (no live-IDs check) if the SELECT fails — we
 *  never want to *block* a save, only to filter it. The tombstone Set still
 *  applies as the within-tab race guard. */
async function _upsertTenantsSafe(rows) {
  rows = _filterTombstones('tenants', rows);
  if (!_changedSinceLastSave('tenants', rows)) return null;
  try {
    // Fetch id + status — status is needed to detect a stale-tab/session
    // payload that would race-overwrite a tenant just approved (or otherwise
    // transitioned out of pending_review) elsewhere. Without this, the
    // upsert's ON CONFLICT id DO UPDATE writes our stale 'pending_review'
    // back over DB's 'active' and the tenant "moves back" to pending the
    // next time the dashboard loads.
    var live = await supa.from('tenants').select('id, status').eq('org_id', _currentOrgId);
    if (!live.error && live.data) {
      var liveSet = Object.create(null);
      var liveStatus = Object.create(null);
      for (var i = 0; i < live.data.length; i++) {
        var lid = String(live.data[i].id);
        liveSet[lid] = true;
        liveStatus[lid] = live.data[i].status || null;
      }
      var dead = [];
      var stalePending = [];
      rows = rows.filter(function(r){
        var rid = String(r.id);
        // Strip ONLY if we have positive evidence the row was once persisted:
        // a brand-new tenant created locally hasn't been added to
        // _persistedIds.tenants yet, so it correctly stays in the payload.
        if (_persistedIds.tenants[rid] && !liveSet[rid]) {
          dead.push(rid);
          return false;
        }
        // Stale-status guard: another session already approved this tenant.
        // Local payload is pending_review, DB is something else — drop the
        // row from the upsert and reconcile local state with DB.
        if (r.status === 'pending_review'
            && liveStatus[rid]
            && liveStatus[rid] !== 'pending_review') {
          stalePending.push({ id: rid, dbStatus: liveStatus[rid] });
          return false;
        }
        return true;
      });
      if (dead.length) {
        console.log('[autosave] reconcile: ' + dead.length + ' tenant(s) deleted in another session, removing locally:', dead);
        // Mirror the deletes into local state so the running tab's UI converges.
        // Same scope as deleteTenantPermanent's local-state cleanup.
        state.tenants = state.tenants.filter(function(t){ return dead.indexOf(String(t.id)) < 0; });
        state.payments = (state.payments || []).filter(function(p){ return dead.indexOf(String(p.tenantId)) < 0; });
        state.rentSchedule = (state.rentSchedule || []).filter(function(s){ return dead.indexOf(String(s.tenantId)) < 0; });
        for (var d = 0; d < dead.length; d++) {
          var did = dead[d];
          markRowDeleted('tenants', did);
          delete _persistedIds.tenants[did];
          if (state.vault) delete state.vault[did];
        }
        // Re-render so e.g. the Archived tab and tenant counts reflect reality
        // immediately. Wrapped in try/catch because render() touches half the
        // dashboard and we never want a render glitch to abort the save.
        if (typeof render === 'function') {
          try { render(); } catch (e) { console.warn('[autosave] render after reconcile failed:', e && e.message); }
        }
      }
      if (stalePending.length) {
        console.log('[autosave] reconcile: ' + stalePending.length + ' tenant(s) approved in another session, syncing local status:', stalePending);
        for (var sp = 0; sp < stalePending.length; sp++) {
          var spRow = stalePending[sp];
          var localT = state.tenants.find(function(t){ return String(t.id) === spRow.id; });
          if (localT) localT.status = spRow.dbStatus;
        }
        if (typeof render === 'function') {
          try { render(); } catch (e) { console.warn('[autosave] render after stale-pending reconcile failed:', e && e.message); }
        }
      }
    } else if (live.error) {
      console.warn('[autosave] live-IDs fetch failed, proceeding with plain upsert:', live.error.message);
    }
  } catch (e) {
    console.warn('[autosave] live-IDs fetch threw, proceeding with plain upsert:', e && e.message);
  }
  var err = await _supaUpsert('tenants', rows, { onConflict: 'id' });
  if (!err) {
    _markTableSaved('tenants', rows);
    // After a successful upsert, every id in the batch is confirmed persisted.
    // Future autosaves will treat any id missing from DB as "deleted elsewhere"
    // (rather than "brand new local insert pending first save").
    for (var k = 0; k < rows.length; k++) {
      if (rows[k] && rows[k].id) _persistedIds.tenants[String(rows[k].id)] = true;
    }
  }
  return err;
}

/** Properties variant of _upsertTenantsSafe — same cross-session resurrection
 *  guard. When another tab/device permanently deletes a property, this tab's
 *  next bulk autosave would otherwise re-INSERT it via ON CONFLICT id DO
 *  UPDATE. The live-IDs check before each upsert detects the divergence and
 *  strips the dead row from both the upsert payload AND local state.
 *
 *  Cascade cleanup mirrors deletePropPermanent: tenants are detached (rather
 *  than removed — server-side they were already detached by the other tab's
 *  delete), expenses/maintenance/landlord_payments referencing the property
 *  are dropped from local state, propDocs entries are removed.
 */
async function _upsertPropertiesSafe(rows) {
  rows = _filterTombstones('properties', rows);
  if (!_changedSinceLastSave('properties', rows)) return null;
  try {
    var live = await supa.from('properties').select('id').eq('org_id', _currentOrgId);
    if (!live.error && live.data) {
      var liveSet = Object.create(null);
      for (var i = 0; i < live.data.length; i++) {
        liveSet[String(live.data[i].id)] = true;
      }
      var dead = [];
      var deadNames = [];
      rows = rows.filter(function(r){
        var rid = String(r.id);
        if (_persistedIds.properties[rid] && !liveSet[rid]) {
          dead.push(rid);
          // Capture the name too — some downstream rows (expenses, maintenance,
          // payments) reference properties by name rather than id.
          var localProp = state.properties && state.properties.find(function(p){ return String(p.id) === rid; });
          if (localProp && localProp.name) deadNames.push(localProp.name);
          return false;
        }
        return true;
      });
      if (dead.length) {
        console.log('[autosave] reconcile: ' + dead.length + ' property(ies) deleted in another session, removing locally:', dead);
        // Mirror the local-state cleanup that deletePropPermanent performs.
        state.properties = state.properties.filter(function(p){ return dead.indexOf(String(p.id)) < 0; });
        // Detach tenants pointing at the dead property (server-side they were
        // already detached when the other tab deleted the property — local
        // state would otherwise show them with a stale property reference).
        (state.tenants || []).forEach(function(t){
          if (dead.indexOf(String(t.propertyId || '')) >= 0 || deadNames.indexOf(t.property) >= 0) {
            t.propertyId = null;
            t.property = '';
            t.room = null;
          }
        });
        state.landlordPayments = (state.landlordPayments || []).filter(function(x){
          return dead.indexOf(String(x.propId || '')) < 0;
        });
        state.expenses = (state.expenses || []).filter(function(x){
          return dead.indexOf(String(x.propertyId || '')) < 0 && deadNames.indexOf(x.property) < 0;
        });
        state.maintenance = (state.maintenance || []).filter(function(x){
          return dead.indexOf(String(x.propertyId || '')) < 0 && deadNames.indexOf(x.property) < 0;
        });
        for (var d = 0; d < dead.length; d++) {
          var did = dead[d];
          markRowDeleted('properties', did);
          delete _persistedIds.properties[did];
          if (state.propDocs) delete state.propDocs[did];
        }
        if (typeof render === 'function') {
          try { render(); } catch (e) { console.warn('[autosave] render after property reconcile failed:', e && e.message); }
        }
      }
    } else if (live.error) {
      console.warn('[autosave] live-IDs fetch (properties) failed, proceeding with plain upsert:', live.error.message);
    }
  } catch (e) {
    console.warn('[autosave] live-IDs fetch (properties) threw, proceeding with plain upsert:', e && e.message);
  }
  var err = await _supaUpsert('properties', rows, { onConflict: 'id' });
  if (!err) {
    _markTableSaved('properties', rows);
    for (var k = 0; k < rows.length; k++) {
      if (rows[k] && rows[k].id) _persistedIds.properties[String(rows[k].id)] = true;
    }
  }
  return err;
}

/** Tenant_docs upsert that falls back to the server endpoint if RLS rejects.
 * This handles the membership-sync edge case where a freshly invited / re-mapped
 * user's `_currentOrgId` doesn't yet match an org_members row visible to RLS. */
async function _upsertTenantDocs(rows) {
  if (!rows || !rows.length) return null;
  // Direct attempt first (cheap, no extra round-trip on the happy path).
  var direct = await _supaUpsert('tenant_docs', rows, { onConflict: 'id' });
  if (!direct) return null;
  var msg = String((direct && direct.message) || '');
  // Only re-try via server endpoint when the failure is RLS-shaped.
  if (!/row.level security|row-level security|new row violates/i.test(msg)) return direct;
  try {
    var sess = await supa.auth.getSession();
    var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
    if (!token) return direct;
    var resp = await fetch('/api/tenant-docs/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ orgId: _currentOrgId, rows: rows }),
    });
    var data = await resp.json().catch(function(){ return {}; });
    if (resp.ok) return null; // success via fallback
    console.warn('Tenant docs server-fallback failed:', data && data.error);
    return { message: 'Could not save tenant documents: ' + (data.error || 'membership mismatch — sign out and back in') };
  } catch (e) {
    console.warn('Tenant docs server-fallback threw:', e);
    return direct;
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

  // Doc rows are deduped by id before upsert. Without this, two properties
  // with a same-named file (e.g. "gas-cert.pdf") would push two rows with the
  // same id (one per property) and Postgres rejects with "ON CONFLICT DO
  // UPDATE command cannot affect row a second time". The renderer fix
  // (prefixing id with property/tenant id) prevents new collisions; this
  // dedupe handles any legacy rows already in state from before the fix.
  function _dedupeById(rows){
    var seen = {}, out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r.id) continue;
      if (seen[r.id]) continue;
      seen[r.id] = true;
      out.push(r);
    }
    return out;
  }

  var flatPropDocs = [];
  if(state.propDocs){
    Object.keys(state.propDocs).forEach(function(pid){
      (state.propDocs[pid]||[]).forEach(function(d){
        var row = docToRow(d); row.property_id = pid; flatPropDocs.push(row);
      });
    });
  }
  flatPropDocs = _dedupeById(flatPropDocs);

  var flatTenantDocs = [];
  if(state.vault){
    Object.keys(state.vault).forEach(function(tid){
      (state.vault[tid]||[]).forEach(function(d){
        var row = vaultDocToRow(d); row.tenant_id = tid; flatTenantDocs.push(row);
      });
    });
  }
  flatTenantDocs = _dedupeById(flatTenantDocs);

  // Pre-flight: upsert clients FIRST so any new client row is committed before
  // we try to insert tenant rows that reference it via tenants.client_id. Without
  // this ordering the parallel Promise.all races, and Supabase rejects the
  // tenant insert with a 409 / foreign-key violation.
  var clientRows = withOrg((state.clients||[]).map(clientToRow));
  var clientErr = await _upsertIfChanged('clients', clientRows, {onConflict:'id'});

  // Pre-compute landlord_payments rows with the 13-month cutoff so the diff
  // check operates on the same payload that would actually be sent.
  var _lpCutoff = new Date(Date.now() - 13*30*24*60*60*1000).toISOString().slice(0,7);
  var lpRows = withOrg(state.landlordPayments.filter(function(lp){
    return lp.propId && lp.monthKey && lp.monthKey >= _lpCutoff;
  }).map(landlordPaymentToRow));

  var paymentRows    = withOrg(state.payments.map(paymentToRow));
  var expenseRows    = withOrg(state.expenses.map(expenseToRow));
  var maintRows      = withOrg(state.maintenance.map(maintenanceToRow));
  var contractorRows = withOrg((state.contractors||[]).map(contractorToRow));
  var companyRows    = withOrg((state.companies||[]).map(companyToRow));
  var propDocRows    = withOrg(flatPropDocs);
  var tenantDocRows  = withOrg(flatTenantDocs);

  var errors = await Promise.all([
    _upsertIfChanged('landlords',     landlordRows,   {onConflict:'id'}),
    // Properties + Tenants use the safe variant: live-IDs check before upsert
    // prevents re-INSERTing rows another tab/device just deleted (multi-tab
    // race). The dropped rows are also reconciled out of local state.
    _upsertPropertiesSafe(propRows),
    _upsertTenantsSafe(tenantRows),
    _upsertIfChanged('payments',      paymentRows,    {onConflict:'id'}),
    _upsertIfChanged('expenses',      expenseRows,    {onConflict:'id'}),
    _upsertIfChanged('maintenance',   maintRows,      {onConflict:'id'}),
    _upsertIfChanged('contractors',   contractorRows, {onConflict:'id'}),
    _upsertIfChanged('companies',     companyRows,    {onConflict:'id'}),
    _upsertIfChanged('property_docs', propDocRows,    {onConflict:'id'}),
    // tenant_docs uses _upsertTenantDocs which has its own RLS-fallback path.
    // Diff it manually using a custom signature so the fallback path is preserved.
    (async function(){
      if (!_changedSinceLastSave('tenant_docs', tenantDocRows)) return null;
      var err = await _upsertTenantDocs(tenantDocRows);
      if (!err) _markTableSaved('tenant_docs', tenantDocRows);
      return err;
    })(),
    // landlord_payments uses ignoreDuplicates:true (DO NOTHING on conflict) — the
    // browser only INSERTs genuinely new month rows; existing DB rows are never
    // overwritten by browser cache (protects pg_cron demo resets).
    _upsertIfChanged('landlord_payments', lpRows,
      {onConflict:'property_id,month_key',ignoreDuplicates:true})
  ]);
  // Surface a clients-upsert failure alongside the other errors so the user
  // sees the toast even though clients ran in pre-flight rather than parallel.
  if (clientErr) errors.unshift(clientErr);
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
