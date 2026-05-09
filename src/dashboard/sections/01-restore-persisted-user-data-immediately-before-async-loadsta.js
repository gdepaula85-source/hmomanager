// ── Restore persisted user data immediately (before async loadState) ──────────
// This runs synchronously so saved users/companies/config win over hardcoded defaults
(function _restoreLocalState() {
  // Guard: never read unscoped cache before org/account context is known.
  if (typeof _currentOrgId === 'undefined' || !_currentOrgId) return;
  var keys = ['companies', 'config'];
  keys.forEach(function(k) {
    try {
      var raw = localStorage.getItem(orgStorageKey('pm_local_' + k));
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed !== null && parsed !== undefined) state[k] = parsed;
      }
    } catch(e) {}
  });
})();
