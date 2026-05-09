// ── Onboarding wizard ────────────────────────────────────────────────────────
// Four slim steps for fresh signups: Company → Property → Tenant → Welcome.
// Triggered from render() when the org has no companies/properties/tenants
// and the user hasn't explicitly dismissed / completed onboarding.
//
// Design choices (confirmed with user):
//   - Wizard only, no dashboard checklist banner.
//   - No demo-data option (separate effort later).
//   - Logo is optional; every step is skippable.
//   - Step derived from data each render — no draft persistence needed.

function _obCfg() {
  if (!state.config) state.config = {};
  if (!state.config.onboarding) state.config.onboarding = {};
  return state.config.onboarding;
}

function getNextOnboardingStep() {
  if (!state.companies || !state.companies.length) return 'company';
  if (!state.properties || !state.properties.length) return 'property';
  if (!state.tenants || !state.tenants.length) return 'tenant';
  return 'complete';
}

function shouldShowOnboarding() {
  var ob = _obCfg();
  if (ob.completedAt) return false;
  if (ob.dismissedAt) return false;
  // Don't show until auth has resolved — state.currentUser is populated after
  // loadState finishes. Prevents a flash of the wizard over the boot overlay.
  if (!state || !state.currentUser) return false;
  // Staff / non-admin users: skip (their org's owner already set it up).
  try {
    var role = state.currentUser.role || window._currentUserRole || 'admin';
    if (role !== 'admin') return false;
  } catch (_e) { return false; }
  // Bulk-import escape hatch: when the user clicked "Import from CSV" on the
  // property step, we hid the wizard and routed them to /import. Keep it
  // hidden while they're on that page so the modal doesn't fight the import
  // form. Auto-clears the moment they navigate elsewhere.
  if (window._obPausedForBulkImport) {
    if (state.page === 'import') return false;
    delete window._obPausedForBulkImport;
  }
  return getNextOnboardingStep() !== 'complete';
}

/** Park the wizard in-memory, jump to the bulk-import page. After the user
 *  saves at least one property via CSV, getNextOnboardingStep advances to
 *  'tenant' on its own (it's data-derived) and the wizard reappears at that
 *  step on the next render. */
function _obBulkImport() {
  window._obPausedForBulkImport = true;
  var root = document.getElementById('ob-wizard-root');
  if (root) root.remove();
  state.page = 'import';
  if (typeof render === 'function') render();
}
if (typeof window !== 'undefined') window._obBulkImport = _obBulkImport;

// ── Sticky onboarding checklist ──────────────────────────────────────────────
// Surfaces post-wizard for orgs that still have an incomplete setup. The
// modal wizard hands off to the dashboard once the user dismisses it; the
// sticky bar then keeps the activation milestones visible without blocking
// the UI. Auto-hides when all 4 checklist items are done OR the user
// explicitly dismisses it.

/** Compute completion state for each of the 4 ladder steps. Cheap — runs on
 *  every render; pure reads from state with short-circuit logic. */
function _obChecklistStatus() {
  var hasProp     = !!(state.properties && state.properties.length);
  var hasTenant   = !!(state.tenants && state.tenants.length);
  var hasPayment  = !!(state.payments && state.payments.some(function(p){
    return p && p.status === 'paid';
  }));
  var hasDoc      = false;
  if (state.propDocs && typeof state.propDocs === 'object') {
    var pids = Object.keys(state.propDocs);
    for (var i = 0; i < pids.length && !hasDoc; i++) {
      var arr = state.propDocs[pids[i]];
      if (arr && arr.length) hasDoc = true;
    }
  }
  return [
    { id: 'prop',    label: 'Add your first property',    done: hasProp,    page: 'properties', icon: '🏠' },
    { id: 'tenant',  label: 'Add your first tenant',      done: hasTenant,  page: 'tenants',    icon: '👤' },
    { id: 'payment', label: 'Track first rent received',  done: hasPayment, page: 'rent',       icon: '💷' },
    { id: 'doc',     label: 'Upload a compliance doc',    done: hasDoc,     page: 'properties', icon: '📄' },
  ];
}

/** Show / refresh the sticky checklist bar. Bails out for staff (non-admin),
 *  unfinished orgs that haven't yet seen the wizard, fully completed
 *  setups, or users who explicitly dismissed it. */
function showOnboardingStickyChecklistIfNeeded() {
  var bar = document.getElementById('ob-sticky-checklist');
  function removeBar() { if (bar) bar.remove(); }

  if (!state || !state.currentUser) { removeBar(); return; }
  // Staff users — owner already set this up.
  try {
    var role = state.currentUser.role || window._currentUserRole || 'admin';
    if (role !== 'admin') { removeBar(); return; }
  } catch(_e) { removeBar(); return; }

  var ob = _obCfg();
  // The MODAL wizard owns first-time setup. Don't double-up — wait until the
  // wizard is dismissed or completed before showing the sticky bar.
  if (!ob.dismissedAt && !ob.completedAt) { removeBar(); return; }
  // Permanent dismiss of the bar itself.
  if (ob.checklistDismissedAt) { removeBar(); return; }

  var items = _obChecklistStatus();
  var done = items.filter(function(x){ return x.done; }).length;
  var total = items.length;
  // All milestones hit — auto-clear the bar (and persist so it never reappears).
  if (done >= total) {
    if (!ob.checklistCompletedAt) {
      ob.checklistCompletedAt = new Date().toISOString();
      if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
    }
    removeBar();
    return;
  }

  // Find the next uncompleted step — that's the primary CTA.
  var next = items.find(function(x){ return !x.done; }) || items[0];

  var pillHtml = items.map(function(it){
    var col = it.done ? '#00B894' : 'rgba(255,255,255,.18)';
    var bg  = it.done ? 'rgba(0,184,148,.12)' : 'transparent';
    var fg  = it.done ? '#00B894' : 'rgba(255,255,255,.55)';
    var deco = it.done ? 'line-through' : 'none';
    return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid '+col+';background:'+bg+';color:'+fg+';font-size:11px;font-weight:600;text-decoration:'+deco+'">'
      + (it.done ? '✓' : it.icon) + ' ' + it.label
      + '</span>';
  }).join('');

  var html = ''
    + '<div id="ob-sticky-checklist" style="position:fixed;bottom:14px;left:14px;right:14px;max-width:920px;margin:0 auto;background:linear-gradient(135deg,#0F1729,#1A2540);color:#fff;border:1px solid rgba(0,184,148,.35);border-radius:14px;padding:14px 18px;box-shadow:0 12px 40px rgba(0,0,0,.45);z-index:9000;font-family:inherit">'
    +   '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">'
    +     '<div style="flex:1;min-width:240px">'
    +       '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:4px">Get set up · ' + done + ' / ' + total + '</div>'
    +       '<div style="font-size:14px;font-weight:700;color:#fff">' + (next ? next.icon + ' ' + next.label : 'All steps complete!') + '</div>'
    +     '</div>'
    +     '<div style="display:flex;gap:8px;align-items:center">'
    +       (next ? '<button type="button" onclick="_obStickyGo(\'' + next.page + '\')" style="padding:9px 16px;background:#00B894;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Do this →</button>' : '')
    +       '<button type="button" onclick="_obStickyDismiss()" aria-label="Hide checklist" style="width:32px;height:32px;background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.18);border-radius:8px;cursor:pointer;font-size:16px;font-family:inherit">×</button>'
    +     '</div>'
    +   '</div>'
    +   '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">' + pillHtml + '</div>'
    + '</div>';

  if (bar) bar.outerHTML = html;
  else document.body.insertAdjacentHTML('beforeend', html);
}

function _obStickyGo(page) {
  state.page = page;
  if (typeof render === 'function') render();
}
function _obStickyDismiss() {
  var ob = _obCfg();
  ob.checklistDismissedAt = new Date().toISOString();
  if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
  var bar = document.getElementById('ob-sticky-checklist');
  if (bar) bar.remove();
}
if (typeof window !== 'undefined') {
  window._obStickyGo = _obStickyGo;
  window._obStickyDismiss = _obStickyDismiss;
  window.showOnboardingStickyChecklistIfNeeded = showOnboardingStickyChecklistIfNeeded;
}

/** Called on every render; idempotent — won't re-render if the wizard is
 *  already visible for the same step. */
function showOnboardingWizardIfNeeded() {
  if (!shouldShowOnboarding()) {
    var existing = document.getElementById('ob-wizard-root');
    if (existing) existing.remove();
    return;
  }
  var step = _obCfg().currentStep || getNextOnboardingStep();
  // If the derived step has moved ahead, follow the data.
  var derived = getNextOnboardingStep();
  if (derived === 'complete') { _finishOnboarding(); return; }
  // If the user just saved a row that advanced us, sync the stored step.
  _obCfg().currentStep = derived;

  var container = document.getElementById('modal-container');
  if (!container) return;
  // Don't re-paint if we're already showing this step.
  var current = document.getElementById('ob-wizard-root');
  if (current && current.dataset.step === derived) return;
  if (current) current.remove();
  container.insertAdjacentHTML('beforeend', _obRenderShell(derived));
}

function _obRenderShell(step) {
  var stepIndex = {company:1, property:2, tenant:3, welcome:4}[step] || 1;
  var body;
  if (step === 'company')       body = _obRenderStepCompany();
  else if (step === 'property') body = _obRenderStepProperty();
  else if (step === 'tenant')   body = _obRenderStepTenant();
  else                          body = _obRenderStepWelcome();

  var progress = '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
    + [1,2,3,4].map(function(n){
        var done = n < stepIndex;
        var active = n === stepIndex;
        var col = done ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--border)';
        var fill = done || active ? '100%' : '0%';
        return '<div style="flex:1;height:4px;border-radius:3px;background:var(--border);overflow:hidden">'
          +  '<div style="width:'+fill+';height:100%;background:'+col+';transition:width .3s"></div>'
          +'</div>';
      }).join('')
    + '</div>'
    + '<div style="font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.04em">STEP '+stepIndex+' OF 4</div>';

  return '<div id="ob-wizard-root" data-step="'+step+'" class="modal-overlay" style="z-index:9999">'
    +'<div class="modal" style="max-width:560px;width:min(560px,calc(100vw - 16px));max-height:min(92vh,860px);overflow:hidden;display:flex;flex-direction:column;position:relative">'
    +  (step !== 'welcome'
        ? '<button onclick="dismissOnboarding()" title="Skip onboarding for now" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:15px;cursor:pointer;font-family:inherit;z-index:2">×</button>'
        : '')
    +  '<div style="padding:22px 24px 14px">'+progress+'</div>'
    +  '<div class="modal-body" style="overflow-y:auto;flex:1;padding:8px 24px 24px">'+body+'</div>'
    +'</div></div>';
}

// ── Step 1: Company ──────────────────────────────────────────────────────────
function _obRenderStepCompany() {
  var org = state._currentOrg; if (org && Array.isArray(org)) org = org[0];
  var prefillName = (org && org.name) || (state.currentUser && state.currentUser.company) || '';
  return ''
    + '<div style="font-family:\'Instrument Serif\',serif;font-size:30px;line-height:1.15;color:var(--text);margin-bottom:6px">Welcome to LandlordApp.</div>'
    + '<div style="font-size:14px;color:var(--muted);margin-bottom:22px">Let\'s set you up in under two minutes. You can change anything later.</div>'
    + '<div class="field" style="margin-bottom:14px">'
    +   '<label class="field-label">Company / portfolio name *</label>'
    +   '<input class="inp" id="ob-company-name" placeholder="e.g. Reservations Direct" value="'+String(prefillName).replace(/"/g,'&quot;')+'" autofocus>'
    + '</div>'
    + '<div class="field" style="margin-bottom:22px">'
    +   '<label class="field-label">Logo <span style="color:var(--dim);font-weight:400;font-size:11px">· optional</span></label>'
    +   '<div style="display:flex;align-items:center;gap:10px">'
    +     '<div id="ob-logo-preview" style="width:56px;height:56px;border-radius:10px;background:var(--bg);border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--dim);flex-shrink:0">🏠</div>'
    +     '<div style="flex:1">'
    +       '<input type="file" id="ob-logo-input" accept="image/*" style="display:none" onchange="_obPreviewLogo(this)">'
    +       '<button onclick="document.getElementById(\'ob-logo-input\').click()" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text)">Upload logo</button>'
    +       '<div style="font-size:11px;color:var(--dim);margin-top:4px">PNG / JPG · shown on tenant emails &amp; PDF reports</div>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + _obFooter({ primary:{label:'Next  →', onclick:"_obSaveCompany()"}, skipable:false });
}

function _obPreviewLogo(input) {
  var f = (input.files || [])[0];
  if (!f) return;
  var r = new FileReader();
  r.onload = function(e) {
    var box = document.getElementById('ob-logo-preview');
    if (box) {
      box.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:10px">';
      box.style.borderStyle = 'solid';
    }
    window._obPendingLogoDataUrl = e.target.result;
  };
  r.readAsDataURL(f);
}

function _obSaveCompany() {
  var nameEl = document.getElementById('ob-company-name');
  var name = (nameEl && nameEl.value || '').trim();
  if (!name) { if (typeof showToast === 'function') showToast('Please enter a company name', 'error'); nameEl && nameEl.focus(); return; }
  if (!state.companies) state.companies = [];
  state.companies.push({
    id: crypto.randomUUID(),
    name: name,
    createdAt: new Date().toISOString()
  });
  // Persist optional logo into config.logoUrl (re-used by PDF header + email templates).
  if (window._obPendingLogoDataUrl) {
    if (!state.config) state.config = {};
    state.config.logoUrl = window._obPendingLogoDataUrl;
    delete window._obPendingLogoDataUrl;
  }
  _advanceOnboarding('property');
}

// ── Step 2: Property ─────────────────────────────────────────────────────────
function _obRenderStepProperty() {
  return ''
    + '<div style="font-family:\'Instrument Serif\',serif;font-size:28px;line-height:1.15;color:var(--text);margin-bottom:6px">Add your first property.</div>'
    + '<div style="font-size:13px;color:var(--muted);margin-bottom:20px">Just the essentials — room breakdowns, mortgage, documents and compliance can all come later from the property card.</div>'
    + '<div class="field" style="margin-bottom:12px">'
    +   '<label class="field-label">Property name *</label>'
    +   '<input class="inp" id="ob-prop-name" placeholder="e.g. 27 Vassall Road" autofocus>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:12px">'
    +   '<div class="field" style="margin-bottom:0"><label class="field-label">Street address</label><input class="inp" id="ob-prop-address" placeholder="e.g. 27 Vassall Road, London"></div>'
    +   '<div class="field" style="margin-bottom:0"><label class="field-label">Postcode</label><input class="inp" id="ob-prop-postcode" placeholder="SW9 6TA" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>'
    + '</div>'
    + '<div style="margin-bottom:14px">'
    +   '<label class="field-label" style="margin-bottom:6px;display:block">Ownership</label>'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="ob-ownership-wrap">'
    +     _obRadioCard('ob-own', 'owned',   '🏠', 'Owned',   'I own this property', true)
    +     _obRadioCard('ob-own', 'managed', '🤝', 'Managed', 'I manage for a landlord', false)
    +   '</div>'
    + '</div>'
    + '<div style="margin-bottom:14px">'
    +   '<label class="field-label" style="margin-bottom:6px;display:block">Letting type</label>'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="ob-letting-wrap">'
    +     _obRadioCard('ob-let', 'hmo',   '🏘️', 'HMO',   'Rooms let individually', true)
    +     _obRadioCard('ob-let', 'whole', '🏡', 'Whole', 'Let to one household', false)
    +   '</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">'
    +   '<div class="field" style="margin-bottom:0"><label class="field-label">Rooms</label><input class="inp" id="ob-prop-rooms" type="number" min="1" value="4"></div>'
    +   '<div class="field" style="margin-bottom:0"><label class="field-label">Landlord rent (£/mo) <span style="color:var(--dim);font-weight:400;font-size:11px" id="ob-landlord-hint">· if managed</span></label><input class="inp" id="ob-prop-landlord" type="number" min="0" placeholder="e.g. 2500"></div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--dim);margin-top:10px">Tick Airbnb / Rent-to-SA later from the property’s Details tab if this property also hosts short-term lets.</div>'
    // Bulk-import escape hatch — landlords with 5+ doors won't enter them
    // one-by-one. The Import page already supports CSV/JSON for properties +
    // tenants; this just surfaces it inside the onboarding flow so they don't
    // bounce hunting for the right menu.
    + '<div style="margin-top:14px;padding:12px 14px;background:var(--bg);border:1px dashed var(--border);border-radius:10px;font-size:12px;color:var(--muted);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'
    +   '<span><strong style="color:var(--text)">Got several properties?</strong> Skip this form and import them all from a CSV / spreadsheet.</span>'
    +   '<button type="button" onclick="_obBulkImport()" style="padding:8px 14px;background:#fff;border:1.5px solid var(--accent);color:var(--accent);font-size:12px;font-weight:700;border-radius:8px;cursor:pointer;font-family:inherit;white-space:nowrap">📥 Bulk import →</button>'
    + '</div>'
    + _obFooter({ primary:{label:'Next  →', onclick:"_obSaveProperty()"}, skipable:true, skipOnclick:"_obSkipProperty()" });
}

function _obRadioCard(group, value, icon, title, sub, checked) {
  return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;border:2px solid '+(checked?'var(--accent)':'var(--border)')+';background:'+(checked?'var(--accent-light)':'var(--bg)')+';cursor:pointer;transition:all .15s" onclick="_obRadioSelect(this, \''+group+'\')">'
    + '<input type="radio" name="'+group+'" value="'+value+'" '+(checked?'checked':'')+' style="accent-color:var(--accent)">'
    + '<div><div style="font-size:13px;font-weight:700;color:var(--text)">'+icon+' '+title+'</div><div style="font-size:11px;color:var(--muted)">'+sub+'</div></div>'
    + '</label>';
}
function _obRadioSelect(clickedLabel, group) {
  var wrap = document.getElementById(group === 'ob-own' ? 'ob-ownership-wrap' : 'ob-letting-wrap');
  if (!wrap) return;
  Array.prototype.forEach.call(wrap.querySelectorAll('label'), function(lb) {
    var input = lb.querySelector('input[type=radio]');
    var on = input && input === clickedLabel.querySelector('input[type=radio]');
    lb.style.borderColor = on ? 'var(--accent)' : 'var(--border)';
    lb.style.background  = on ? 'var(--accent-light)' : 'var(--bg)';
  });
  var chosen = clickedLabel.querySelector('input[type=radio]');
  if (chosen) chosen.checked = true;
}

function _obSaveProperty() {
  var nameEl = document.getElementById('ob-prop-name');
  var name = (nameEl && nameEl.value || '').trim();
  if (!name) { showToast && showToast('Please enter a property name', 'error'); nameEl && nameEl.focus(); return; }
  var addr = (document.getElementById('ob-prop-address') || {}).value || '';
  var pc   = ((document.getElementById('ob-prop-postcode') || {}).value || '').toUpperCase();
  var own  = (document.querySelector('input[name="ob-own"]:checked') || {}).value || 'owned';
  var let0 = (document.querySelector('input[name="ob-let"]:checked') || {}).value || 'hmo';
  var rooms = parseInt((document.getElementById('ob-prop-rooms') || {}).value, 10) || 1;
  var landlord = parseFloat((document.getElementById('ob-prop-landlord') || {}).value) || 0;
  var isWhole = let0 === 'whole';
  var fullAddr = addr ? (addr + (pc ? ', ' + pc : '')) : pc;
  var mapsUrl = pc ? 'https://maps.google.com/?q=' + encodeURIComponent(fullAddr) : '';
  var roomList = [];
  if (isWhole) {
    roomList.push({ n: 1, type: 'Whole Property', price: 0, status: 'vacant', isWholeProperty: true });
  } else {
    for (var i = 1; i <= rooms; i++) roomList.push({ n: i, type: 'Single', price: 200, status: 'vacant' });
  }
  state.properties.push({
    id: crypto.randomUUID(),
    name: name,
    address: fullAddr,
    postcode: pc,
    area: '',
    type: 'HMO',
    ownershipType: own,
    lettingType: let0,
    bedrooms: isWhole ? 1 : null,
    rooms: isWhole ? 1 : rooms,
    occupied: 0,
    rent: 0,
    landlord: own === 'managed' ? landlord : 0,
    landlordName: '',
    mapsUrl: mapsUrl,
    roomList: roomList,
    notes: '',
    companyId: (state.companies && state.companies[0] && state.companies[0].id) || '',
    mortgage: null,
    purchaseInfo: null,
    status: 'active'
  });
  _advanceOnboarding('tenant');
}
function _obSkipProperty() {
  dismissOnboarding('property');
}

// ── Step 3: Tenant ───────────────────────────────────────────────────────────
function _obRenderStepTenant() {
  var prop = state.properties && state.properties[state.properties.length-1];
  var isWhole = prop && prop.lettingType === 'whole';
  var roomOpts = '';
  if (prop && prop.roomList) {
    roomOpts = prop.roomList.map(function(r) {
      return '<option value="'+r.n+'">'+(isWhole ? 'Whole property' : 'Room ' + r.n)+'</option>';
    }).join('');
  }
  var todayIso = new Date().toISOString().split('T')[0];
  return ''
    + '<div style="font-family:\'Instrument Serif\',serif;font-size:28px;line-height:1.15;color:var(--text);margin-bottom:6px">Add your first tenant.</div>'
    + '<div style="font-size:13px;color:var(--muted);margin-bottom:20px">If the property is empty or SA-only, skip this step — you can add tenants any time from the Tenants tab.</div>'
    + '<div class="field" style="margin-bottom:12px">'
    +   '<label class="field-label">Tenant name *</label>'
    +   '<input class="inp" id="ob-ten-name" placeholder="e.g. Sarah Jones" autofocus>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
    +   '<div class="field" style="margin-bottom:0"><label class="field-label">Property</label><input class="inp" readonly value="'+((prop && prop.name) || '—').replace(/"/g,'&quot;')+'" style="background:var(--bg);color:var(--muted)"></div>'
    +   '<div class="field" style="margin-bottom:0"><label class="field-label">Room</label><select class="inp" id="ob-ten-room">'+roomOpts+'</select></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:12px">'
    +   '<div class="field" style="margin-bottom:0"><label class="field-label">Rent *</label><input class="inp" id="ob-ten-rent" type="number" min="0" placeholder="e.g. 650"></div>'
    +   '<div class="field" style="margin-bottom:0"><label class="field-label">Frequency</label><select class="inp" id="ob-ten-freq"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>'
    + '</div>'
    + '<div class="field" style="margin-bottom:8px">'
    +   '<label class="field-label">Check-in date *</label>'
    +   '<input class="inp" id="ob-ten-start" type="date" value="'+todayIso+'">'
    + '</div>'
    + _obFooter({ primary:{label:'Finish setup', onclick:"_obSaveTenant()"}, skipable:true, skipOnclick:"_obSkipTenant()", skipLabel:'Skip — finish setup' });
}

function _obSaveTenant() {
  var name = ((document.getElementById('ob-ten-name') || {}).value || '').trim();
  if (!name) { showToast && showToast('Please enter a tenant name', 'error'); return; }
  var rent = parseFloat((document.getElementById('ob-ten-rent') || {}).value) || 0;
  if (!rent) { showToast && showToast('Enter the rent amount', 'error'); return; }
  var prop = state.properties[state.properties.length-1];
  var roomN = parseInt((document.getElementById('ob-ten-room') || {}).value, 10) || 1;
  var freq = (document.getElementById('ob-ten-freq') || {}).value || 'weekly';
  var startDate = (document.getElementById('ob-ten-start') || {}).value || new Date().toISOString().split('T')[0];
  state.tenants.push({
    id: crypto.randomUUID(),
    name: name,
    property: prop.name,
    propertyId: prop.id,
    room: roomN,
    roomType: 'Single',
    rent: rent,
    freq: freq,
    method: 'bank',
    startDate: startDate,
    moveIn: startDate,
    deposit: rent * 2,
    status: 'active',
    arrears: 0,
    payDay: freq === 'weekly' ? 'Friday' : null,
    payDayOfMonth: freq === 'monthly' ? 1 : null,
    email: '', whatsapp: '',
    paymentHistory: []
  });
  // Mark the room as occupied.
  if (prop.roomList) {
    var rm = prop.roomList.find(function(r){ return r.n === roomN; });
    if (rm) { rm.status = 'occupied'; rm.price = freq === 'weekly' ? rent : Math.round(rent * 12 / 52); }
  }
  if (typeof recalcProperty === 'function') recalcProperty(prop);
  _advanceOnboarding('welcome');
}
function _obSkipTenant() { _advanceOnboarding('welcome'); }

// ── Step 4: Welcome ──────────────────────────────────────────────────────────
function _obRenderStepWelcome() {
  return ''
    + '<div style="text-align:center;padding:12px 4px">'
    +   '<div style="font-size:48px;margin-bottom:8px">🎉</div>'
    +   '<div style="font-family:\'Instrument Serif\',serif;font-size:30px;line-height:1.15;color:var(--text);margin-bottom:8px">You\'re all set.</div>'
    +   '<div style="font-size:14px;color:var(--muted);margin:0 auto 24px;max-width:380px">Your portfolio is ready. Explore the tabs below when you\'re comfortable — or jump in and let us know what breaks.</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">'
    +   _obHintCard('🏠', 'Properties',  'Edit details, log inspections, upload docs.')
    +   _obHintCard('💷', 'Rent',        'Mark payments as paid, chase arrears.')
    +   _obHintCard('🔧', 'Maintenance', 'Log issues, assign contractors.')
    +   _obHintCard('📊', 'Reports',     'P&L, cash flow, AI portfolio insights.')
    + '</div>'
    + _obFooter({ primary:{label:'Open my dashboard', onclick:"completeOnboarding()"}, skipable:false });
}
function _obHintCard(icon, title, sub) {
  return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px">'
    + '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">'+icon+' '+title+'</div>'
    + '<div style="font-size:11px;color:var(--muted);line-height:1.45">'+sub+'</div>'
    + '</div>';
}

// ── Shared footer ────────────────────────────────────────────────────────────
function _obFooter(opts) {
  var skipHtml = '';
  if (opts.skipable) {
    var lbl = opts.skipLabel || 'Skip for now';
    skipHtml = '<button onclick="'+(opts.skipOnclick || 'dismissOnboarding()')+'" style="padding:10px 14px;border-radius:9px;border:none;background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">'+lbl+'</button>';
  }
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:18px;margin-top:18px;border-top:1px solid var(--border)">'
    + '<div>'+skipHtml+'</div>'
    + '<button onclick="'+opts.primary.onclick+'" style="padding:11px 22px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 2px 8px rgba(0,184,148,.25)">'+opts.primary.label+'</button>'
    + '</div>';
}

// ── Step transitions ─────────────────────────────────────────────────────────
function _advanceOnboarding(nextStep) {
  var ob = _obCfg();
  ob.currentStep = nextStep;
  if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
  else if (typeof saveState === 'function') saveState();
  var root = document.getElementById('ob-wizard-root');
  if (root) root.remove();
  // Re-show the wizard at the new step; render() isn't strictly required
  // because only the wizard DOM changes, but we also want any new row (a new
  // property/tenant) to be visible behind the wizard if they skip.
  if (typeof render === 'function') render();
  // Ensure the wizard stays on top after render() (which re-invokes us).
  setTimeout(showOnboardingWizardIfNeeded, 0);
}

function dismissOnboarding(fromStep) {
  var ob = _obCfg();
  ob.dismissedAt = new Date().toISOString();
  if (fromStep) ob.dismissedAtStep = fromStep;
  if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
  else if (typeof saveState === 'function') saveState();
  var root = document.getElementById('ob-wizard-root');
  if (root) root.remove();
  if (typeof showToast === 'function') showToast('Setup saved — explore the app anytime', 'success');
  if (typeof render === 'function') render();
}

function completeOnboarding() {
  var ob = _obCfg();
  ob.completedAt = new Date().toISOString();
  if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
  else if (typeof saveState === 'function') saveState();
  var root = document.getElementById('ob-wizard-root');
  if (root) root.remove();
  if (typeof showToast === 'function') showToast('Welcome aboard 🎉', 'success');
  if (typeof render === 'function') render();
}

function _finishOnboarding() {
  // Derived step is 'complete' but wizard hadn't been marked done — e.g. user
  // imported data that filled all three slots before seeing the wizard. Silent.
  var ob = _obCfg();
  ob.completedAt = ob.completedAt || new Date().toISOString();
  var root = document.getElementById('ob-wizard-root');
  if (root) root.remove();
}

if (typeof window !== 'undefined') {
  window.getNextOnboardingStep          = getNextOnboardingStep;
  window.shouldShowOnboarding           = shouldShowOnboarding;
  window.showOnboardingWizardIfNeeded   = showOnboardingWizardIfNeeded;
  window.dismissOnboarding              = dismissOnboarding;
  window.completeOnboarding             = completeOnboarding;
  window._obPreviewLogo                 = _obPreviewLogo;
  window._obRadioSelect                 = _obRadioSelect;
  window._obSaveCompany                 = _obSaveCompany;
  window._obSaveProperty                = _obSaveProperty;
  window._obSaveTenant                  = _obSaveTenant;
  window._obSkipProperty                = _obSkipProperty;
  window._obSkipTenant                  = _obSkipTenant;
}
