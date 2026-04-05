// ── Restore persisted user data immediately (before async loadState) ──────────
// This runs synchronously so saved users/companies/config win over hardcoded defaults
(function _restoreLocalState() {
  var keys = ['companies', 'config'];
  keys.forEach(function(k) {
    try {
      var raw = localStorage.getItem('pm_local_' + k);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed !== null && parsed !== undefined) state[k] = parsed;
      }
    } catch(e) {}
  });
})();
