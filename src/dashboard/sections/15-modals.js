// ── MODALS ────────────────────────────────────────────────────────────────────
function renderTenantDueDaySection(freq, payDay, payDayOfMonth) {
  if(freq === 'monthly') {
    var opts = Array.from({length:28}, function(_,i) {
      var s = i+1;
      var sfx = [1,21].includes(s)?'st':[2,22].includes(s)?'nd':[3,23].includes(s)?'rd':'th';
      return '<option value="'+s+'" '+(payDayOfMonth===s?'selected':'')+'>'+s+sfx+' of month</option>';
    }).join('');
    return '<div class="field" style="margin:0"><label class="field-label">Due Date (monthly)</label>'
      +'<select class="inp" id="td-paydom">'+opts+'</select></div>';
  } else {
    var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    var opts = days.map(function(d){
      return '<option '+(payDay===d?'selected':'')+'>'+d+'</option>';
    }).join('');
    return '<div class="field" style="margin:0"><label class="field-label">Due Day (weekly)</label>'
      +'<select class="inp" id="td-payday">'+opts+'</select></div>';
  }
}

function updateTenantDueDaySection() {
  var freqEl = document.getElementById('td-freq');
  var section = document.getElementById('td-due-day-section');
  if(!freqEl || !section) return;
  var freq = freqEl.value;
  // Preserve current selections
  var payDomEl = document.getElementById('td-paydom');
  var payDayEl = document.getElementById('td-payday');
  var currentDom = payDomEl ? +payDomEl.value : 1;
  var currentDay = payDayEl ? payDayEl.value : 'Friday';
  section.innerHTML = renderTenantDueDaySection(freq, currentDay, currentDom);
}

function pdSetOwnership(val) {
  var isOwned = val === 'owned';
  var radios = document.querySelectorAll('input[name="pd-ownership"]');
  radios.forEach(function(r){ r.checked = r.value === val; });
  var lblOwned   = document.getElementById('pd-lbl-owned');
  var lblManaged = document.getElementById('pd-lbl-managed');
  if(lblOwned){
    lblOwned.style.borderColor = isOwned ? 'var(--accent)' : 'var(--border)';
    lblOwned.style.background  = isOwned ? 'var(--accent-light)' : 'var(--bg)';
  }
  if(lblManaged){
    lblManaged.style.borderColor = !isOwned ? 'var(--accent)' : 'var(--border)';
    lblManaged.style.background  = !isOwned ? 'var(--accent-light)' : 'var(--bg)';
  }
  var mortgageEl  = document.getElementById('pd-mortgage-section');
  var purchaseEl  = document.getElementById('pd-purchase-section');
  var landlordEl  = document.getElementById('pd-landlord-section');
  var outLbl      = document.getElementById('pd-outgoing-label');
  if(mortgageEl) mortgageEl.style.display = isOwned ? 'block' : 'none';
  if(purchaseEl) purchaseEl.style.display = isOwned ? 'block' : 'none';
  if(landlordEl) landlordEl.style.display = isOwned ? 'none'  : 'block';
  if(outLbl) outLbl.textContent = isOwned ? 'Mortgage Payment (£/mo)' : 'Landlord Rent (£/mo)';
}

function pdSetLetting(val) {
  var isHmo = val === 'hmo';
  var radios = document.querySelectorAll('input[name="pd-letting"]');
  radios.forEach(function(r){ r.checked = r.value === val; });
  var lblHmo   = document.getElementById('pd-lbl-hmo');
  var lblWhole = document.getElementById('pd-lbl-whole');
  if(lblHmo){
    lblHmo.style.borderColor = isHmo ? 'var(--accent)' : 'var(--border)';
    lblHmo.style.background  = isHmo ? 'var(--accent-light)' : 'var(--bg)';
  }
  if(lblWhole){
    lblWhole.style.borderColor = !isHmo ? 'var(--accent)' : 'var(--border)';
    lblWhole.style.background  = !isHmo ? 'var(--accent-light)' : 'var(--bg)';
  }
  var roomsWrap    = document.getElementById('pd-rooms-wrap');
  var bedroomsWrap = document.getElementById('pd-bedrooms-wrap');
  if(roomsWrap)    roomsWrap.style.display    = isHmo ? 'block' : 'none';
  if(bedroomsWrap) bedroomsWrap.style.display = isHmo ? 'none'  : 'block';
}

function setPropOwnership(val) {
  var isOwned = val === 'owned';
  // Radio state
  var radios = document.querySelectorAll('input[name="f-ownership"]');
  radios.forEach(function(r){ r.checked = r.value === val; });
  // Style toggle
  var lblOwned   = document.getElementById('lbl-owned');
  var lblManaged = document.getElementById('lbl-managed');
  if(lblOwned) {
    lblOwned.style.borderColor   = isOwned ? 'var(--accent)' : 'var(--border)';
    lblOwned.style.background    = isOwned ? 'var(--accent-light)' : 'var(--bg)';
  }
  if(lblManaged) {
    lblManaged.style.borderColor = !isOwned ? 'var(--accent)' : 'var(--border)';
    lblManaged.style.background  = !isOwned ? 'var(--accent-light)' : 'var(--bg)';
  }
  // Show/hide sections
  var mortgageSection  = document.getElementById('f-mortgage-section');
  var purchaseSection  = document.getElementById('f-purchase-section');
  var landlordSection  = document.getElementById('f-landlord-section');
  var outgoingLbl      = document.getElementById('f-outgoing-label');
  var outgoingLblW     = document.getElementById('f-outgoing-label-w');
  if(mortgageSection) mortgageSection.style.display = isOwned ? 'block' : 'none';
  if(purchaseSection) purchaseSection.style.display = isOwned ? 'block' : 'none';
  if(landlordSection) landlordSection.style.display = isOwned ? 'none' : 'block';
  // Relabel the outgoing field
  var newLabel = isOwned ? 'Mortgage Payment (£/mo)' : 'Landlord Rent (£/mo)';
  if(outgoingLbl)  outgoingLbl.textContent  = newLabel;
  if(outgoingLblW) outgoingLblW.textContent = newLabel;
}

function setPropLetting(val) {
  var isHmo = val === 'hmo';
  var radios = document.querySelectorAll('input[name="f-letting"]');
  radios.forEach(function(r){ r.checked = r.value === val; });
  var lblHmo   = document.getElementById('lbl-hmo');
  var lblWhole = document.getElementById('lbl-whole');
  if(lblHmo) {
    lblHmo.style.borderColor = isHmo ? 'var(--accent)' : 'var(--border)';
    lblHmo.style.background  = isHmo ? 'var(--accent-light)' : 'var(--bg)';
  }
  if(lblWhole) {
    lblWhole.style.borderColor = !isHmo ? 'var(--accent)' : 'var(--border)';
    lblWhole.style.background  = !isHmo ? 'var(--accent-light)' : 'var(--bg)';
  }
  var hmoFields   = document.getElementById('f-hmo-fields');
  var wholeFields = document.getElementById('f-whole-fields');
  if(hmoFields)   hmoFields.style.display   = isHmo ? 'block' : 'none';
  if(wholeFields) wholeFields.style.display = isHmo ? 'none'  : 'block';
  // Auto-set the Type dropdown to match
  var typeEl = document.getElementById('f-type');
  if(typeEl) typeEl.value = isHmo ? 'HMO' : 'Single Let';
}

function toggleNewLandlordFields() {
  var sel = document.getElementById('f-lname');
  var fields = document.getElementById('f-new-landlord-fields');
  if(!sel || !fields) return;
  fields.style.display = sel.value === '__new__' ? 'block' : 'none';
}

function refreshMaintRoomDropdown() {
  var propName = (document.getElementById('f-mprop')||{}).value;
  var roomSel = document.getElementById('f-mroom');
  if(!roomSel) return;
  roomSel.innerHTML = '';
  // Communal areas first
  var communalOpt = document.createElement('option');
  communalOpt.value = 'communal';
  communalOpt.textContent = '🏠 Communal Area';
  roomSel.appendChild(communalOpt);
  var p = state.properties.find(function(x){return x.name===propName;});
  if(p && p.roomList) {
    p.roomList.forEach(function(r){
      var opt = document.createElement('option');
      opt.value = r.n;
      var ten = state.tenants.find(function(t){return t.property===p.name&&roomNumsEqual(t.room,r.n)&&t.status!=='inactive';});
      opt.textContent = 'Room '+r.n+' ('+(r.type||'Room')+') '+(ten?'— '+ten.name:'[Vacant]');
      roomSel.appendChild(opt);
    });
  }
  refreshMaintTenantInfo();
}

function refreshMaintTenantInfo() {
  var propName = (document.getElementById('f-mprop')||{}).value;
  var roomSel  = document.getElementById('f-mroom');
  var roomVal  = roomSel ? roomSel.value : '';
  var infoBox  = document.getElementById('f-maint-tenant-info');
  var infoEl   = document.getElementById('f-maint-tenant-detail');
  if(!infoBox || !infoEl) return;
  if(!roomVal || roomVal==='communal' || isNaN(+roomVal)) {
    infoBox.style.display = 'none';
    return;
  }
  var t = state.tenants.find(function(x){return x.property===propName&&roomNumsEqual(x.room,roomVal)&&x.status!=='inactive';});
  if(!t) { infoBox.style.display='none'; return; }
  var phone = t.whatsapp ? '+'+t.whatsapp : '—';
  infoEl.innerHTML =
    '<div style="display:flex;gap:16px;flex-wrap:wrap">'
    +'<div><span style="font-weight:600">👤</span> '+esc(t.name)+'</div>'
    +'<div><span style="font-weight:600">📞</span> <a href="tel:+'+t.whatsapp+'" style="color:var(--blue)">'+phone+'</a></div>'
    +(t.whatsapp?'<div><a href="https://wa.me/'+t.whatsapp+'" target="_blank" style="color:#25D366;font-weight:700">💬 WhatsApp</a></div>':'')
    +'</div>';
  infoBox.style.display = 'block';
}

function previewMaintModalPhoto(input) {
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    document.getElementById('f-mphoto-img').src = e.target.result;
    document.getElementById('f-mphoto-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function _activeTenantRoomSet(propName) {
  var set = new Set();
  (state.tenants || []).forEach(function(t) {
    if (t && t.property === propName && t.status !== 'inactive') {
      set.add(Number(t.room) || 1);
    }
  });
  return set;
}

function _derivePropertyRoomsForTenantModal(p) {
  var rooms = [];
  if (Array.isArray(p && p.roomList) && p.roomList.length) {
    rooms = p.roomList.map(function(r) {
      return {
        n: +r.n || 1,
        type: r.type || 'Room',
        price: +r.price || 0,
        status: String(r.status || '').toLowerCase()
      };
    });
  } else {
    var count = Math.max(0, +((p && p.rooms) || 0));
    if (count > 0) {
      var weeklyHint = count > 0 && p && p.rent ? Math.round((+p.rent * 12 / 52) / count) : 0;
      for (var i = 1; i <= count; i++) {
        rooms.push({ n: i, type: 'Room', price: weeklyHint, status: '' });
      }
    }
  }
  return rooms.sort(function(a, b) { return a.n - b.n; });
}

/** True if this property can accept a new tenant (has at least one vacant room, or whole let with no current tenancy). */
function propertyHasVacancyForNewTenant(p) {
  if (!p) return false;
  var isWhole = (p.lettingType || 'hmo') === 'whole';
  if (isWhole) {
    return !(state.tenants || []).some(function(t) {
      return t && t.property === p.name && t.status !== 'inactive';
    });
  }
  var rooms = _derivePropertyRoomsForTenantModal(p);
  if (!rooms.length) return true;
  var occupiedByTenant = _activeTenantRoomSet(p.name);
  var vacant = rooms.filter(function(r) {
    var explicitlyOccupied = String(r.status || '').toLowerCase() === 'occupied';
    return !occupiedByTenant.has(r.n) && !explicitlyOccupied;
  }).length;
  return vacant > 0;
}

function openModal(type) {
  if (type === 'addProp') {
    var orgM = state._currentOrg;
    if (orgM && Array.isArray(orgM)) orgM = orgM[0];
    var cfg = state.config || {};
    var plan = typeof _dmEffectiveOrgPlanKey === 'function' ? _dmEffectiveOrgPlanKey(orgM, cfg) : String((orgM && orgM.plan) || 'free').toLowerCase();
    var cap = typeof _dmPlanCaps === 'function' ? _dmPlanCaps(plan, orgM).properties : 3;
    var currentProps = (state.properties || []).filter(function(p) { return p && isPropertyActive(p); }).length;
    if (currentProps >= cap) {
      if (typeof showToast === 'function') {
        showToast('Property limit reached for your current plan. Upgrade plan or archive an unused property.', 'error');
      } else {
        alert('Property limit reached for your current plan. Upgrade plan or archive an unused property.');
      }
      return;
    }
  }
  var propertiesWithVacancy = (state.properties || []).filter(isPropertyActive).filter(propertyHasVacancyForNewTenant);
  const propOpts = propertiesWithVacancy.length
    ? propertiesWithVacancy.map(function(p) {
        var isWhole = (p.lettingType || 'hmo') === 'whole';
        if (isWhole) {
          return '<option value="' + p.name + '">' + p.name + ' (whole property · available)</option>';
        }
        var rooms = _derivePropertyRoomsForTenantModal(p);
        var occupiedByTenant = _activeTenantRoomSet(p.name);
        var vacant = rooms.filter(function(r) {
          var explicitlyOccupied = String(r.status || '').toLowerCase() === 'occupied';
          return !occupiedByTenant.has(r.n) && !explicitlyOccupied;
        }).length;
        if (!rooms.length) {
          return '<option value="' + p.name + '">' + p.name + ' (no rooms set up)</option>';
        }
        return '<option value="' + p.name + '">' + p.name + ' (' + vacant + ' room' + (vacant === 1 ? '' : 's') + ' free)</option>';
      }).join('')
    : '<option value="" disabled>All properties are fully occupied — free a room to add a tenant</option>';
  const modals = {
    addProp:`
      <!-- ── Step 1: Ownership & Letting Type ── -->
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Property Classification</div>
        <div class="field" style="margin-bottom:12px">
          <label class="field-label">Ownership Type</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label id="lbl-owned" onclick="setPropOwnership('owned')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--accent);background:var(--accent-light);cursor:pointer">
              <input type="radio" name="f-ownership" value="owned" checked style="accent-color:var(--accent)">
              <div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">🏠 Owned</div><div style="font-size:10px;color:var(--muted)">I own this property</div></div>
            </label>
            <label id="lbl-managed" onclick="setPropOwnership('managed')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--border);background:var(--bg);cursor:pointer">
              <input type="radio" name="f-ownership" value="managed" style="accent-color:var(--accent)">
              <div><div style="font-size:13px;font-weight:700;color:var(--text)">🤝 Managed</div><div style="font-size:10px;color:var(--muted)">I manage for a landlord</div></div>
            </label>
          </div>
        </div>
        <div class="field" style="margin:0">
          <label class="field-label">Letting Type</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label id="lbl-hmo" onclick="setPropLetting('hmo')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--accent);background:var(--accent-light);cursor:pointer">
              <input type="radio" name="f-letting" value="hmo" checked style="accent-color:var(--accent)">
              <div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">🏘️ HMO</div><div style="font-size:10px;color:var(--muted)">Rooms let individually</div></div>
            </label>
            <label id="lbl-whole" onclick="setPropLetting('whole')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--border);background:var(--bg);cursor:pointer">
              <input type="radio" name="f-letting" value="whole" style="accent-color:var(--accent)">
              <div><div style="font-size:13px;font-weight:700;color:var(--text)">🏡 Whole Property</div><div style="font-size:10px;color:var(--muted)">Let to one household</div></div>
            </label>
          </div>
        </div>
        <!-- STR (Airbnb / Rent-to-SA) toggle -->
        <label id="lbl-str" style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:10px;border-radius:9px;border:2px solid var(--border);background:var(--bg);cursor:pointer;transition:all .15s" onclick="(function(cb){if(event.target!==cb){cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'))}})(this.querySelector('input'))">
          <input type="checkbox" id="f-str-enabled" style="accent-color:#FF5A5F;width:16px;height:16px;cursor:pointer" onchange="(function(cb){var lbl=document.getElementById('lbl-str');if(!lbl)return;lbl.style.borderColor=cb.checked?'#FF5A5F':'var(--border)';lbl.style.background=cb.checked?'rgba(255,90,95,.06)':'var(--bg)';var t=lbl.querySelector('.str-title');if(t)t.style.color=cb.checked?'#E04E53':'var(--text)';})(this)">
          <div style="flex:1">
            <div class="str-title" style="font-size:13px;font-weight:700;color:var(--text)">🛏️ Generates Airbnb / Rent-to-SA income</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px">Tick this if the property hosts Airbnb / Booking.com / SpareRoom STR alongside (or instead of) tenancy rent.</div>
          </div>
        </label>
      </div>

      <!-- ── Step 2: Core details ── -->
      <div class="field"><label class="field-label">Property Name *</label><input class="inp" id="f-name" placeholder="e.g. 15 Station Road"></div>
      <div class="row-2">
        <div class="field"><label class="field-label">Street Address</label><input class="inp" id="f-address" placeholder="e.g. 15 Station Road"></div>
        <div class="field"><label class="field-label">Postcode</label><input class="inp" id="f-postcode" placeholder="e.g. SW9 8PS" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Area</label>
          <input class="inp" id="f-area" placeholder="e.g. town, district or postcode area" list="area-suggestions">
          <datalist id="area-suggestions">${(function(){var areas=[];state.properties.forEach(function(p){if(p.area&&areas.indexOf(p.area)<0)areas.push(p.area);});return areas.map(function(a){return '<option value="'+a+'">'; }).join('');})()}</datalist>
        </div>
        <div class="field"><label class="field-label">Type</label>
          <select class="inp" id="f-type"><option>HMO</option><option>Single Let</option><option>Semi-Commercial</option><option>Other</option></select>
        </div>
      </div>

      <!-- ── Lease start date — anchors landlord rent schedule + void tracking ── -->
      <div class="field"><label class="field-label">Lease Start Date</label>
        <input class="inp" id="f-lease-start" type="date" value="${(new Date()).toISOString().split('T')[0]}">
        <div style="font-size:10px;color:var(--muted);margin-top:4px">Used to start the landlord-rent schedule. Defaults to today.</div>
      </div>

      <!-- ── HMO fields (rooms) ── -->
      <div id="f-hmo-fields">
        <div class="row-2">
          <div class="field"><label class="field-label">🛏️ Lettable Rooms</label><input class="inp" id="f-rooms" type="number" placeholder="6" min="1"></div>
          <div class="field"><label class="field-label" id="f-outgoing-label">Landlord Rent (£/mo)</label><input class="inp" id="f-landlord" type="number" placeholder="3500"></div>
        </div>
      </div>

      <!-- ── Whole property fields (bedrooms) ── -->
      <div id="f-whole-fields" style="display:none">
        <div class="row-2">
          <div class="field">
            <label class="field-label">🛏️ Bedrooms</label>
            <select class="inp" id="f-bedrooms">
              <option value="1">1 bedroom</option>
              <option value="2">2 bedrooms</option>
              <option value="3" selected>3 bedrooms</option>
              <option value="4">4 bedrooms</option>
              <option value="5">5 bedrooms</option>
              <option value="6">6+ bedrooms</option>
            </select>
          </div>
          <div class="field"><label class="field-label" id="f-outgoing-label-w">Landlord Rent (£/mo)</label><input class="inp" id="f-landlord-w" type="number" placeholder="1800"></div>
        </div>
        <div class="field">
          <label class="field-label">Monthly Rent (£/mo)</label>
          <input class="inp" id="f-whole-rent" type="number" placeholder="e.g. 2200">
          <div style="font-size:11px;color:var(--muted);margin-top:4px">The rent charged to the tenant for the whole property</div>
        </div>
      </div>

      <!-- ── Landlord section: shown for managed only ── -->
      <div id="f-landlord-section">
        <div class="field"><label class="field-label">Landlord</label>
          <select class="inp" id="f-lname" onchange="toggleNewLandlordFields()">
            <option value="">— Select landlord —</option>
            ${state.landlords.map(ll=>`<option value="${esc(ll.name)}">${esc(ll.name)}</option>`).join('')}
            <option value="__new__">➕ Add new landlord…</option>
          </select>
        </div>
        <div id="f-new-landlord-fields" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:12px;margin-top:8px">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px">New Landlord Details</div>
          <div class="row-2">
            <div class="field"><label class="field-label">Name</label><input class="inp" id="f-newll-name" placeholder="Full name"></div>
            <div class="field"><label class="field-label">Phone</label><input class="inp" id="f-newll-phone" placeholder="07911000000"></div>
          </div>
          <div class="field"><label class="field-label">Email</label><input class="inp" id="f-newll-email" type="email" placeholder="landlord@email.com"></div>
        </div>
      </div>

      <!-- ── Mortgage section: shown for owned only ── -->
      <div id="f-mortgage-section" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">🏦 Mortgage Details <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional — add now or later)</span></div>
        <div class="row-2">
          <div class="field"><label class="field-label">Lender</label><input class="inp" id="f-m-lender" placeholder="e.g. NatWest, Halifax"></div>
          <div class="field"><label class="field-label">Monthly Payment (£)</label><input class="inp" id="f-m-payment" type="number" placeholder="900"></div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field-label">Interest Rate (%)</label><input class="inp" id="f-m-rate" type="number" step="0.01" placeholder="4.5"></div>
          <div class="field"><label class="field-label">Rate Type</label>
            <select class="inp" id="f-m-ratetype">
              <option value="fixed">Fixed</option>
              <option value="tracker">Tracker</option>
              <option value="svr">SVR</option>
              <option value="variable">Variable</option>
            </select>
          </div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field-label">Fix End Date</label><input class="inp" id="f-m-fixend" type="date"></div>
          <div class="field"><label class="field-label">Outstanding Balance (£)</label><input class="inp" id="f-m-balance" type="number" placeholder="180000"></div>
        </div>
      </div>

      <!-- ── Purchase info: shown for owned only ── -->
      <div id="f-purchase-section" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">📈 Purchase & Value <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></div>
        <div class="row-2">
          <div class="field"><label class="field-label">Purchase Price (£)</label><input class="inp" id="f-p-purchase" type="number" placeholder="280000"></div>
          <div class="field"><label class="field-label">Purchase Date</label><input class="inp" id="f-p-date" type="date"></div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field-label">Current Est. Value (£)</label><input class="inp" id="f-p-value" type="number" placeholder="320000"></div>
          <div class="field"><label class="field-label">Ownership Structure</label>
            <select class="inp" id="f-p-structure">
              <option value="sole">Sole</option>
              <option value="joint">Joint</option>
              <option value="ltd">Ltd Company</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div class="field"><label class="field-label">&#x1F3E2; Operating Company</label>
        <select class="inp" id="f-company">
          <option value="">— Unassigned —</option>
          ${(state.companies||[]).map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('')}
        </select>
      </div>`,

    addTenant:`
      <div class="field" style="margin-bottom:14px">
        <label class="field-label">Tenant Type</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label id="f-cat-individual-lbl" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--blue);background:var(--blue-light);cursor:pointer">
            <input type="radio" name="f-tcategory" value="individual" checked style="accent-color:var(--blue)" onchange="onTenantCategoryChange()">
            <div><div style="font-size:13px;font-weight:700;color:var(--blue)">👤 Individual</div><div style="font-size:10px;color:var(--muted)">A single person renting</div></div>
          </label>
          <label id="f-cat-business-lbl" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--border);background:var(--bg);cursor:pointer">
            <input type="radio" name="f-tcategory" value="business" style="accent-color:var(--green)" onchange="onTenantCategoryChange()">
            <div><div style="font-size:13px;font-weight:700;color:var(--green-dark, var(--green))">🏢 Business client</div><div style="font-size:10px;color:var(--muted)">Company renting one or more properties</div></div>
          </label>
        </div>
      </div>
      <div id="f-business-section" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:12px;margin-bottom:14px">
        <div class="field" style="margin-bottom:8px"><label class="field-label">Client</label>
          <select class="inp" id="f-tclient" onchange="onClientChange()">
            <option value="__new">＋ Add new client</option>
            ${(state.clients||[]).filter(function(c){return (c.type||'business')==='business';}).map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('')}
          </select>
        </div>
        <div id="f-newclient-fields">
          <div class="field"><label class="field-label">Business Name</label><input class="inp" id="f-cname" placeholder="e.g. Acme Lettings Ltd"></div>
          <div class="row-2">
            <div class="field"><label class="field-label">Contact Person</label><input class="inp" id="f-ccontact" placeholder="e.g. John Smith"></div>
            <div class="field"><label class="field-label">Company No. (optional)</label><input class="inp" id="f-ccompno" placeholder="e.g. 12345678"></div>
          </div>
          <div class="row-2">
            <div class="field"><label class="field-label">Email</label><input class="inp" id="f-cemail" type="email" placeholder="contact@acme.example"></div>
            <div class="field"><label class="field-label">WhatsApp / Phone</label><input class="inp" id="f-cphone" type="tel" placeholder="447911000000"></div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px;padding-top:8px;border-top:1px solid var(--border);line-height:1.5">
          💡 You're adding the <strong>first property</strong> for this client. Add more later from <em>Tenants → Business Clients</em>.
        </div>
      </div>
      <div class="field" id="f-individual-name-wrap"><label class="field-label">Full Name</label><input class="inp" id="f-tname" placeholder="e.g. John Smith"></div>
      <div class="row-2">
        <div class="field"><label class="field-label">Property</label>
          <select class="inp" id="f-tprop" onchange="refreshRoomDropdown();autofillTenantRentFromProperty()">
            <option value="">Select property…</option>${propOpts}
          </select>
        </div>
        <div class="field" id="f-troom-wrap"><label class="field-label">Room</label>
          <select class="inp" id="f-troom">
            <option value="">Select property first…</option>
          </select>
        </div>
      </div>
      <div class="field" id="f-ttype-wrap">
        <label class="field-label">Room Type</label>
        <select class="inp" id="f-ttype">
          <option value="Single">🛏️ Single</option>
          <option value="Double">🛏️🛏️ Double</option>
          <option value="Suite">✨ Suite</option>
          <option value="Studio">🏠 Studio</option>
          <option value="Whole House">🏡 Whole House</option>
        </select>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Rent (£/wk) <span style="color:var(--red)">*</span></label>
          <input class="inp" id="f-trent" type="number" placeholder="220" required
            oninput="var d=document.getElementById('f-tdeposit');if(d&&!d.dataset.manual)d.value=(+this.value*2)||''">
        </div>
        <div class="field"><label class="field-label">Frequency</label>
          <select class="inp" id="f-tfreq" onchange="onFreqChange()">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      <div id="f-weekly-fields">
        <div class="field"><label class="field-label">📆 Payment Day (weekly)</label>
          <select class="inp" id="f-tpayday">
            <option>Monday</option><option>Tuesday</option><option>Wednesday</option>
            <option>Thursday</option><option selected>Friday</option><option>Saturday</option><option>Sunday</option>
          </select>
        </div>
      </div>
      <div id="f-monthly-fields" style="display:none">
        <div class="field"><label class="field-label">📆 Payment Date (monthly)</label>
          <select class="inp" id="f-tpaydom">
            ${Array.from({length:28},(_,i)=>{const s=i+1;const sfx=[1,21].includes(s)?'st':[2,22].includes(s)?'nd':[3,23].includes(s)?'rd':'th';return `<option value="${s}">${s}${sfx} of each month</option>`;}).join('')}
          </select>
        </div>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">📅 Check-in Date <span style="color:var(--red)">*</span></label>
          <input class="inp" id="f-tstart" type="date" value="${new Date().toISOString().split('T')[0]}" required>
        </div>
        <div class="field"><label class="field-label">Deposit (£)</label>
          <input class="inp" id="f-tdeposit" type="number" placeholder="Auto: 2× rent" oninput="this.dataset.manual='1'">
        </div>
      </div>
      <div class="field"><label class="field-label">Payment Method</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--blue);background:var(--blue-light);cursor:pointer">
            <input type="radio" name="f-tmethod" value="bank" checked style="accent-color:var(--blue)">
            <div><div style="font-size:13px;font-weight:700;color:var(--blue)">🏦 Bank</div><div style="font-size:10px;color:var(--muted)">Bank transfer</div></div>
          </label>
          <label id="cash-lbl" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--border);background:var(--bg);cursor:pointer">
            <input type="radio" name="f-tmethod" value="cash" style="accent-color:var(--amber)">
            <div><div style="font-size:13px;font-weight:700;color:var(--amber)">💵 Cash</div><div style="font-size:10px;color:var(--muted)">Cash collection</div></div>
          </label>
        </div>
      </div>
      <div class="field" id="f-twa-wrap">
        <label class="field-label">📱 WhatsApp Number <span style="color:var(--red)">*</span></label>
        <input class="inp" id="f-twa" type="tel" placeholder="e.g. +44 7700 900000" required>
        <div style="font-size:11px;color:var(--muted);margin-top:5px">Country code is required so messages deliver. UK: <strong>+44 7700…</strong> · Portugal: <strong>+351 91…</strong> · Brazil: <strong>+55 11…</strong>. Don't start with a 0.</div>
      </div>`,

    addExpense:`
      <div class="field"><label class="field-label">Category</label>
        <select class="inp" id="f-ecat">
          <optgroup label="🏠 Property Running Costs">
            <option value="Council Tax">🏛️ Council Tax</option>
            <option value="Energy – Gas">🔥 Energy – Gas</option>
            <option value="Energy – Electric">⚡ Energy – Electric</option>
            <option value="Water">💧 Water</option>
            <option value="Internet / Broadband">🌐 Internet / Broadband</option>
            <option value="Cleaning">🧹 Cleaning</option>
            <option value="Maintenance & Repairs">🔧 Maintenance & Repairs</option>
            <option value="Insurance">🛡️ Insurance</option>
            <option value="HMO Licence">📋 HMO Licence</option>
            <option value="Property Costs">🏠 Other Property Cost</option>
          </optgroup>
          <optgroup label="👷 Staff & Labour">
            <option value="Staff & Labour">👷 Staff & Labour</option>
            <option value="Contractor">🪛 Contractor</option>
          </optgroup>
          <optgroup label="⚙️ Business Overhead">
            <option value="Software & Tools">💻 Software & Tools</option>
            <option value="Accountancy">📊 Accountancy</option>
            <option value="Legal">⚖️ Legal</option>
            <option value="Overhead">⚙️ Other Overhead</option>
          </optgroup>
        </select>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Property (optional)</label>
          <select class="inp" id="f-eprop">
            <option value="">— Portfolio-wide —</option>
            ${(function(){return state.properties.filter(isPropertyActive).map(function(p){return '<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>';}).join('');})()}
          </select>
        </div>
        <div class="field"><label class="field-label">🏢 Company</label>
          <select class="inp" id="f-ecompany">
            <option value="">— Unassigned —</option>
            ${(state.companies||[]).map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('')}
          </select>
        </div>
      </div>
      <div class="field"><label class="field-label">Description</label>
        <input class="inp" id="f-edesc" placeholder="e.g. Gas bill — 19 Whiteley Road">
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Amount (£)</label>
          <input class="inp" id="f-eamt" type="number" placeholder="250">
        </div>
        <div class="field"><label class="field-label">Status</label>
          <select class="inp" id="f-estat">
            <option value="estimated">Estimated</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Frequency</label>
          <select class="inp" id="f-efreq" onchange="document.getElementById('f-efreq-detail').style.display=this.value==='one-off'?'none':'block'">
            <option value="one-off">One-off</option>
            <option value="monthly">🔄 Monthly (recurring)</option>
          </select>
        </div>
        <div class="field" id="f-efreq-detail" style="display:none"><label class="field-label">Start Date</label>
          <input class="inp" id="f-estart" type="date" value="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>`,

    addMaint:`
      <div class="field"><label class="field-label">Property</label>
        <select class="inp" id="f-mprop" onchange="refreshMaintRoomDropdown()">
          <option value="">Select property…</option>
          ${state.properties.filter(isPropertyActive).map(function(p){return '<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>';}).join('')}
        </select>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Location</label>
          <select class="inp" id="f-mroom" onchange="refreshMaintTenantInfo()">
            <option value="">Select property first…</option>
          </select>
        </div>
        <div class="field"><label class="field-label">Priority</label>
          <select class="inp" id="f-mpri">
            <option value="urgent">🔴 Urgent</option>
            <option value="high">🟠 High</option>
            <option value="medium" selected>🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
      </div>
      <div id="f-maint-tenant-info" style="display:none;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:9px;padding:10px 13px;margin-bottom:12px;font-size:12px">
        <div style="font-weight:700;color:var(--blue);margin-bottom:4px">👤 Tenant Details</div>
        <div id="f-maint-tenant-detail" style="color:var(--muted)"></div>
      </div>
      <div class="field"><label class="field-label">Issue Description</label>
        <textarea class="inp" id="f-missue" rows="3" placeholder="Describe the issue clearly… e.g. Boiler not working, no hot water since this morning" style="resize:vertical"></textarea>
      </div>
      <div class="field"><label class="field-label">Category</label>
        <select class="inp" id="f-mcat">
          <option>🔧 Plumbing</option><option>⚡ Electrical</option><option>🔥 Heating / Boiler</option>
          <option>🪟 Windows / Doors</option><option>💧 Damp / Mould</option><option>🍳 Kitchen</option>
          <option>🚿 Bathroom</option><option>🫧 Appliances</option>
          <option>🐛 Pest Control – Bed Bugs</option><option>🪳 Pest Control – Cockroaches</option>
          <option>🐭 Pest Control – Mice</option><option>🐀 Pest Control – Rats</option>
          <option>🔨 General</option>
        </select>
      </div>
      <div class="field"><label class="field-label">📷 Photo (optional)</label>
        <input type="file" id="f-mphoto-input" accept="image/*" capture="environment" style="display:none" onchange="previewMaintModalPhoto(this)">
        <button onclick="document.getElementById('f-mphoto-input').click()" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px dashed var(--border);background:var(--bg);cursor:pointer;width:100%;font-family:inherit;text-align:left">
          <span style="font-size:20px">📷</span>
          <div><div style="font-size:13px;font-weight:700;color:var(--muted)">Add Photo</div><div style="font-size:11px;color:var(--dim)">Helps identify the issue faster</div></div>
        </button>
        <div id="f-mphoto-preview" style="display:none;margin-top:8px;position:relative">
          <img id="f-mphoto-img" style="width:100%;max-height:180px;object-fit:cover;border-radius:9px">
          <button onclick="document.getElementById('f-mphoto-preview').style.display='none';document.getElementById('f-mphoto-input').value=''" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.55);border:none;color:#fff;border-radius:50%;width:24px;height:24px;font-size:12px;cursor:pointer">✕</button>
        </div>
      </div>
      <div class="field"><label class="field-label">Assign Contractor (optional)</label>
        <select class="inp" id="f-mcontractor">
          <option value="">— No contractor assigned —</option>
          ${(state.contractors||[]).map(function(c){return '<option value="'+esc(c.name)+'">'+esc(c.name)+(c.trade?' · '+esc(c.trade):'')+(c.phone?' ('+esc(c.phone)+')':'')+'</option>';}).join('')}
        </select>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Scheduled date (optional)</label>
          <input class="inp" id="f-mdate" type="date" lang="en-GB">
        </div>
        <div class="field"><label class="field-label">Time (optional, 24h)</label>
          <input class="inp" id="f-mtime" type="time" lang="en-GB" step="60">
        </div>
      </div>
      <div class="field"><label class="field-label">Notes</label>
        <input class="inp" id="f-mnotes" placeholder="Any additional context, access details, best times to attend…">
      </div>`,
  };
  const titles = {addProp:'Add Property',addTenant:'Add Tenant',addExpense:'Add Expense',addMaint:'Log Maintenance Request'};
  const saveLabels = {addProp:'Add Property',addTenant:'Add Tenant',addExpense:'Add Expense',addMaint:'Log Request'};
  const saveType = {addProp:'prop',addTenant:'tenant',addExpense:'expense',addMaint:'maint'};

  var _wideModals = {addProp:true, addTenant:true};
  var _modalStyle = _wideModals[type]
    ? 'style="max-width:806px;width:min(806px,calc(100vw - 16px));height:min(90vh,910px);overflow:hidden;display:flex;flex-direction:column"'
    : '';
  var _bodyStyle  = _wideModals[type] ? 'style="overflow-y:auto;flex:1"' : '';
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" ${_modalStyle}>
        <div class="modal-header">
          <span class="modal-title">${titles[type]}</span>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body" ${_bodyStyle}>
          ${modals[type]}
          <div class="modal-footer">
            ${btn('Cancel',"closeModal()",'secondary')}
            ${btn(saveLabels[type],`saveModal('${saveType[type]}')`,'primary')}
          </div>
        </div>
      </div>
    </div>`;

  // Ensure radio defaults and dependent sections are synced on first render.
  if(type === 'addProp') {
    var own = document.querySelector('input[name="f-ownership"]:checked');
    var letting = document.querySelector('input[name="f-letting"]:checked');
    setPropOwnership(own ? own.value : 'owned');
    setPropLetting(letting ? letting.value : 'hmo');
  }
}

function closeModal(){document.getElementById('modal-container').innerHTML=''}

var _tenantSearchTimer = null;
function debouncedTenantSearch() {
  if(_tenantSearchTimer) clearTimeout(_tenantSearchTimer);
  // 180ms is short enough to feel responsive while still coalescing fast typists.
  _tenantSearchTimer = setTimeout(function() {
    if(state.page !== 'tenants') return;
    document.getElementById('content').innerHTML = renderTenants();
    // The previous selector ('.search-inp') didn't match the actual input class
    // ('inp'), so focus was never restored — that's why the search box "froze"
    // for the user (cursor disappeared on every keystroke). Now uses a stable
    // ID so focus + caret position survive each re-render.
    var inp = document.getElementById('t-search-input');
    if (inp) {
      var v = state.filters.tenantQ || '';
      inp.focus();
      try { inp.setSelectionRange(v.length, v.length); } catch (_e) {}
    }
  }, 180);
}

var _rentSearchTimer = null;
function debouncedRentSearch() {
  if (_rentSearchTimer) clearTimeout(_rentSearchTimer);
  _rentSearchTimer = setTimeout(function () {
    if (state.page !== 'rent') return;
    document.getElementById('content').innerHTML = renderRent();
    var inp = document.getElementById('rent-search-input');
    if (inp) {
      var v = state.filters.rentQ || '';
      inp.focus();
      try { inp.setSelectionRange(v.length, v.length); } catch (_e) {}
    }
  }, 180);
}

var _propSearchTimer = null;
function cancelPendingPropSearchRefresh() {
  if (_propSearchTimer) {
    clearTimeout(_propSearchTimer);
    _propSearchTimer = null;
  }
}
function cancelPendingTenantSearchRefresh() {
  if (_tenantSearchTimer) {
    clearTimeout(_tenantSearchTimer);
    _tenantSearchTimer = null;
  }
}
function debouncedPropSearch() {
  if(_propSearchTimer) clearTimeout(_propSearchTimer);
  _propSearchTimer = setTimeout(function() {
    if(state.page !== 'properties') return;
    document.getElementById('content').innerHTML = renderProperties();
    // Selector '.search-inp' didn't match the actual input class ('inp') so
    // focus was never restored — same bug that the tenant search hit. Use the
    // stable id so caret + focus survive every re-render.
    var inp = document.getElementById('p-search-input');
    if (inp) {
      var v = state.filters.propQ || '';
      inp.focus();
      try { inp.setSelectionRange(v.length, v.length); } catch (_e) {}
    }
  }, 180);
}

function onFreqChange() {
  var freq = document.getElementById('f-tfreq');
  var wf   = document.getElementById('f-weekly-fields');
  var mf   = document.getElementById('f-monthly-fields');
  if(!freq) return;
  if(wf) wf.style.display = freq.value === 'weekly' ? 'block' : 'none';
  if(mf) mf.style.display = freq.value === 'monthly' ? 'block' : 'none';
}

function refreshRoomDropdown() {
  var propSel = document.getElementById('f-tprop');
  var roomSel = document.getElementById('f-troom');
  var roomWrap= document.getElementById('f-troom-wrap');
  var rentInp = document.getElementById('f-trent');
  var depInp  = document.getElementById('f-tdeposit');
  var typeWrap= document.getElementById('f-ttype-wrap');
  if(!propSel || !roomSel) return;
  var propName = propSel.value;
  var p = state.properties.find(function(x){ return x.name === propName; });
  roomSel.innerHTML = '';

  if(!p || !propName) {
    var opt = document.createElement('option');
    opt.value = ''; opt.textContent = 'Select property first…';
    roomSel.appendChild(opt);
    return;
  }

  // Whole property — no room picker needed, always room 1
  var isWhole = (p.lettingType||'hmo') === 'whole';
  if(isWhole) {
    if(roomWrap) roomWrap.style.display = 'none';
    if(typeWrap) typeWrap.style.display = 'none';
    var opt = document.createElement('option');
    opt.value = '1'; opt.textContent = 'Whole property (' + (p.bedrooms||'?') + ' bed)';
    roomSel.appendChild(opt);
    // Whole let: any non-inactive tenant blocks a new tenancy
    var existing = state.tenants.find(function(t){ return t.property===propName && t.status!=='inactive'; });
    if(existing) {
      roomSel.innerHTML = '';
      var opt2 = document.createElement('option');
      opt2.value = ''; opt2.textContent = 'Already let to ' + existing.name;
      roomSel.appendChild(opt2);
    }
    return;
  }

  // HMO — show vacant rooms
  if(roomWrap) roomWrap.style.display = '';
  if(typeWrap) typeWrap.style.display = '';
  var rooms = _derivePropertyRoomsForTenantModal(p);
  if(!rooms.length) {
    var opt = document.createElement('option');
    opt.value = ''; opt.textContent = 'No rooms set up';
    roomSel.appendChild(opt);
    return;
  }
  var occupiedByTenant = _activeTenantRoomSet(propName);
  var vacRooms = rooms.filter(function(r){
    var explicitlyOccupied = String(r.status || '').toLowerCase() === 'occupied';
    return !occupiedByTenant.has(r.n) && !explicitlyOccupied;
  });
  if(!vacRooms.length) {
    var opt = document.createElement('option');
    opt.value = ''; opt.textContent = 'No vacant rooms';
    roomSel.appendChild(opt);
    return;
  }
  vacRooms.forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r.n;
    opt.textContent = 'Room ' + r.n + ' (' + (r.type || 'Room') + ') — £' + r.price + '/wk';
    opt.setAttribute('data-price', r.price);
    roomSel.appendChild(opt);
  });
  // Auto-fill rent from first vacant room
  if(rentInp && vacRooms.length) {
    rentInp.value = +vacRooms[0].price;
    if(depInp && !depInp.dataset.manual) depInp.value = +vacRooms[0].price * 2;
  }
  // Update rent when room selection changes
  roomSel.onchange = function() {
    var sel = roomSel.options[roomSel.selectedIndex];
    var price = sel ? sel.getAttribute('data-price') : null;
    if(price && rentInp) {
      rentInp.value = +price;
      if(depInp && !depInp.dataset.manual) depInp.value = +price * 2;
    }
  };
}

function saveModal(type) {
  // Centralized permission gate for the four "Add X" modal flows. Each role
  // can be configured to allow/deny these in the Users page Permissions table.
  // canEdit covers prop/expense/maint; canAddTenant is the more granular guard
  // for tenant adds (admins typically delegate this to viewers/maintenance).
  var permMap = { prop: 'canEdit', tenant: 'canAddTenant', expense: 'canEdit', maint: 'canEdit' };
  var labelMap = { prop: 'add a property', tenant: 'add a tenant', expense: 'log an expense', maint: 'log a maintenance request' };
  if (permMap[type] && !requirePerm(permMap[type], labelMap[type])) return;
  if(type==='prop'){
    var fname = document.getElementById('f-name').value.trim();
    if(!fname){ alert('Please enter a property name.'); return; }

    // Ownership & letting type
    var ownershipEl = document.querySelector('input[name="f-ownership"]:checked');
    var lettingEl   = document.querySelector('input[name="f-letting"]:checked');
    var ownershipType = ownershipEl ? ownershipEl.value : 'managed'; // 'owned' | 'managed'
    var lettingType   = lettingEl   ? lettingEl.value   : 'hmo';     // 'hmo' | 'whole'
    var isOwned  = ownershipType === 'owned';
    var isWhole  = lettingType   === 'whole';

    var faddr  = document.getElementById('f-address').value.trim();
    var fpost  = document.getElementById('f-postcode').value.trim().toUpperCase();
    var fullAddr = faddr + (fpost ? ', ' + fpost : '');
    var mapsUrl  = fpost ? 'https://maps.google.com/?q=' + encodeURIComponent(fullAddr) : '';

    // Rooms vs bedrooms
    var frooms    = 0;
    var fbedrooms = 0;
    if(isWhole) {
      fbedrooms = +(document.getElementById('f-bedrooms')||{value:3}).value || 3;
      frooms    = 1; // whole property = 1 lettable unit
    } else {
      frooms = +document.getElementById('f-rooms').value || 0;
    }

    // Outgoing: landlord rent OR mortgage payment
    var landlordRent = 0;
    if(isWhole) {
      landlordRent = +(document.getElementById('f-landlord-w')||{value:0}).value || 0;
    } else {
      landlordRent = +(document.getElementById('f-landlord')||{value:0}).value || 0;
    }

    // Initial rent for whole property lets
    var wholeRent = isWhole ? (+(document.getElementById('f-whole-rent')||{value:0}).value || 0) : 0;

    // Landlord (managed only)
    var llName = '';
    if(!isOwned) {
      var llSel = document.getElementById('f-lname') ? document.getElementById('f-lname').value : '';
      if(llSel === '__new__') {
        llName = (document.getElementById('f-newll-name')||{value:''}).value.trim();
        if(llName) {
          state.landlords = state.landlords || [];
          state.landlords.push({
            id: crypto.randomUUID(),
            name: llName,
            phone: (document.getElementById('f-newll-phone')||{value:''}).value.trim(),
            email: (document.getElementById('f-newll-email')||{value:''}).value.trim(),
            bank:'', sortCode:'', accountNo:'', notes:'', properties:[]
          });
        }
      } else {
        llName = llSel || '';
      }
    }

    // Mortgage (owned only)
    var mortgage = null;
    if(isOwned) {
      var mLender  = (document.getElementById('f-m-lender')||{value:''}).value.trim();
      var mPayment = +(document.getElementById('f-m-payment')||{value:0}).value || 0;
      var mRate    = +(document.getElementById('f-m-rate')||{value:0}).value    || 0;
      var mRateType= (document.getElementById('f-m-ratetype')||{value:'fixed'}).value;
      var mFixEnd  = (document.getElementById('f-m-fixend')||{value:''}).value  || null;
      var mBalance = +(document.getElementById('f-m-balance')||{value:0}).value || 0;
      if(mLender || mPayment || mBalance) {
        mortgage = { lender:mLender, monthlyPayment:mPayment, rate:mRate, rateType:mRateType, fixEndDate:mFixEnd, outstandingBalance:mBalance };
        // Treat mortgage payment as the outgoing if landlordRent not set separately
        if(!landlordRent && mPayment) landlordRent = mPayment;
      }
    }

    // Purchase info (owned only)
    var purchaseInfo = null;
    if(isOwned) {
      var pPrice    = +(document.getElementById('f-p-purchase')||{value:0}).value || 0;
      var pDate     = (document.getElementById('f-p-date')||{value:''}).value     || null;
      var pValue    = +(document.getElementById('f-p-value')||{value:0}).value    || 0;
      var pStructure= (document.getElementById('f-p-structure')||{value:'sole'}).value;
      if(pPrice || pValue) {
        purchaseInfo = { purchasePrice:pPrice, purchaseDate:pDate, estimatedValue:pValue, ownershipStructure:pStructure };
      }
    }

    // Build roomList
    var roomList = [];
    if(isWhole) {
      roomList.push({n:1, type:'Whole Property', price: wholeRent ? Math.round(wholeRent*12/52) : 0, status:'vacant', isWholeProperty:true});
    } else {
      for(var ri=1; ri<=frooms; ri++) {
        roomList.push({n:ri, type:'Single', price:200, status:'vacant'});
      }
    }

    var newProp = {
      id: crypto.randomUUID(),
      name: fname,
      address: fullAddr,
      postcode: fpost,
      area: document.getElementById('f-area').value,
      type: document.getElementById('f-type').value,
      ownershipType: ownershipType,
      lettingType:   lettingType,
      isStrEnabled:  !!(document.getElementById('f-str-enabled')||{checked:false}).checked,
      bedrooms:      isWhole ? fbedrooms : null,
      rooms:   frooms,
      occupied: 0,
      rent:     isWhole ? wholeRent : 0,
      landlord: landlordRent,
      landlordName: llName,
      mapsUrl:  mapsUrl,
      roomList: roomList,
      notes: '',
      companyId: (document.getElementById('f-company')||{value:''}).value,
      mortgage:     mortgage     || null,
      purchaseInfo: purchaseInfo || null,
      status:       'active',
      // Stamp createdAt locally so landlord-payment and void-tracking schedules don't
      // backfill from the earliest tenant's startDate before the DB round-trips the
      // server-side created_at value.
      createdAt:    new Date().toISOString(),
      // Lease start anchors the landlord-rent schedule (without this, ensureLandlordSchedule
      // back-fills from the earliest tenant or January).
      leaseStartDate: (function(){
        var el = document.getElementById('f-lease-start');
        return (el && el.value) ? el.value : new Date().toISOString().split('T')[0];
      })(),
    };
    state.properties.push(newProp);
    // So the new card is not hidden by an active search string; cancel stale debounced re-renders.
    state.filters.propQ = '';
    cancelPendingPropSearchRefresh();
    if (typeof recalcProperty === 'function') recalcProperty(newProp);
  } else if(type==='tenant'){
    var g = function(id){ var el=document.getElementById(id); return el?el.value:null; };
    // Tenant category: 'individual' (default) or 'business'. Business clients
    // attach to a clients row; their name/whatsapp/email come from there so we
    // never duplicate the company's contact across multiple tenancies.
    var catEl = document.querySelector('input[name="f-tcategory"]:checked');
    var tenantCategory = catEl ? catEl.value : 'individual';
    var isBusiness = tenantCategory === 'business';

    var clientId = null;
    var clientObj = null;
    if (isBusiness) {
      var clientSel = g('f-tclient') || '__new';
      if (clientSel === '__new') {
        var newCName = (g('f-cname')||'').trim();
        if (!newCName) { alert('Please enter the business / client name.'); return; }
        clientObj = {
          id: crypto.randomUUID(),
          name: newCName,
          type: 'business',
          companyNo: (g('f-ccompno')||'').trim(),
          contactPerson: (g('f-ccontact')||'').trim(),
          email: (g('f-cemail')||'').trim(),
          phone: (g('f-cphone')||'').trim().replace(/\s+/g,''),
          whatsapp: (g('f-cphone')||'').trim().replace(/\s+/g,'').replace(/^\+/,''),
          address: '',
          notes: ''
        };
        if (!Array.isArray(state.clients)) state.clients = [];
        state.clients.push(clientObj);
        clientId = clientObj.id;
      } else {
        clientObj = (state.clients||[]).find(function(c){ return String(c.id) === String(clientSel); });
        if (!clientObj) { alert('Selected client not found — please pick again or add a new one.'); return; }
        clientId = clientObj.id;
      }
    }

    // Individual mode requires a typed name; business mode pulls from the client.
    var name = isBusiness ? (clientObj && clientObj.name) || '' : (g('f-tname')||'');
    if(!name || !name.trim()) {
      alert(isBusiness ? 'Business client name is missing.' : 'Please enter the tenant\'s name.');
      return;
    }
    var startDateVal = g('f-tstart');
    if(!startDateVal) { alert('Please enter a check-in date — this field is required.'); return; }
    // Whatsapp on the tenant row: blank for business (sourced from client at runtime).
    var waFull = isBusiness
      ? ''
      : (g('f-twa')||'').trim().replace(/\s+/g,'').replace(/^\+/,'');
    var freq   = g('f-tfreq') || 'weekly';
    var payDay = freq==='weekly' ? (g('f-tpayday')||'Friday') : null;
    var payDom = freq==='monthly' ? +(g('f-tpaydom')||1) : null;
    var startDate = g('f-tstart') || new Date().toISOString().split('T')[0];
    var methodEl  = document.querySelector('input[name="f-tmethod"]:checked');
    var method    = methodEl ? methodEl.value : 'bank';
    var rentVal   = +(g('f-trent')||0);
    var deposit   = +(g('f-tdeposit')||0) || rentVal*2;
    var propName  = g('f-tprop') || '';
    var propObj   = state.properties.find(function(x){return x.name===propName;});
    var isWholeProp = propObj && (propObj.lettingType||'hmo') === 'whole';
    var roomN     = isWholeProp ? 1 : +(g('f-troom')||1);
    var roomType  = isWholeProp ? 'Whole Property' : (g('f-ttype')||'Single');
    if(!propName){ alert('Please select a property.'); return; }
    if(!isWholeProp && !roomN){ alert('Please select a room.'); return; }
    // WhatsApp validation skipped for business mode (it lives on the client).
    // For individual mode: must be 10–15 digits with no leading 0 — leading 0
    // = local format ("07700…") which won't deliver via WhatsApp's wa.me API.
    if (!isBusiness){
      if (!waFull || !/^[1-9]\d{9,14}$/.test(waFull)) {
        var hint = (waFull && waFull[0] === '0')
          ? '\n\nDrop the leading 0 and add the country code (UK 07700 → 447700).'
          : '\n\nAdd the country code (UK 44, Portugal 351, Brazil 55).';
        alert('Please enter a valid WhatsApp number with country code.' + hint);
        return;
      }
    }
    // Validate rent
    if(!rentVal || rentVal <= 0){ alert('Please enter a valid rent amount.'); return; }
    // Prevent duplicate assignment — whole property: block if any current tenancy (active or on notice)
    if(isWholeProp) {
      var wholeTaken = state.tenants.find(function(t){ return t.property===propName && t.status!=='inactive'; });
      if(wholeTaken){ alert('⚠️ '+propName+' is already let ('+wholeTaken.name+').\nMark them as inactive or moved out before adding a new tenant.'); return; }
    } else {
      var roomTaken = state.tenants.find(function(t){ return t.property===propName && roomNumsEqual(t.room, roomN) && t.status!=='inactive'; });
      if(roomTaken){ alert('⚠️ Room '+roomN+' at '+propName+' is already occupied by '+roomTaken.name+'.\nPlease select a different room.'); return; }
    }
    // Update room type on the property roomList
    if(propObj && propObj.roomList){
      var rm = propObj.roomList.find(function(r){return roomNumsEqual(r.n, roomN);});
      if(rm) rm.type = roomType;
    }
    state.tenants.push({
      id:crypto.randomUUID(), name:name.trim(), property:propName, room:roomN, roomType:roomType,
      rent:rentVal, freq:freq, payDay:payDay, payDayOfMonth:payDom,
      method:method, status:'active', paid:'—', arrears:0,
      whatsapp:waFull, deposit:deposit, depositStatus:'held',
      moveIn:startDate, startDate:startDate, noticeDate:null,
      moveOutDate:null, email: isBusiness ? '' : '', paymentHistory:[],
      clientId: clientId
    });
    occupyRoom(propName, roomN, rentVal);
    if (typeof runAfterSupabaseLoad === 'function') runAfterSupabaseLoad();
    rebuildAllSchedules();
    // Auto-send welcome email to new tenant
    var newTenant = state.tenants[state.tenants.length - 1];
    if (newTenant && newTenant.email && typeof sendWelcomeEmail === 'function') sendWelcomeEmail(newTenant);
    // So the new card is not hidden by search / a stale debounced re-render (same idea as propQ on add property).
    state.filters.tenantQ = '';
    state.filters.tenants = 'all';
    cancelPendingTenantSearchRefresh();
  } else if(type==='expense'){
    const desc=document.getElementById('f-edesc').value;
    if(!desc){ alert('Please enter a description.'); return; }
    const cat   = document.getElementById('f-ecat').value;
    const amt   = +document.getElementById('f-eamt').value || 0;
    if(amt <= 0){ alert('Please enter an amount.'); return; }
    const freq  = document.getElementById('f-efreq').value;
    const estart= document.getElementById('f-estart') ? document.getElementById('f-estart').value : '';
    const eprop = document.getElementById('f-eprop').value;
    const staffCats = ['Staff & Labour','Contractor'];
    const propCats  = ['Council Tax','Energy – Gas','Energy – Electric','Water','Internet / Broadband','Cleaning','Maintenance & Repairs','Insurance','HMO Licence','Property Costs'];
    const etype = staffCats.includes(cat)?'staff':propCats.includes(cat)?'property':'overhead';
    var ecompany=(document.getElementById('f-ecompany')||{value:''}).value;
    state.expenses.push({
      id:crypto.randomUUID(), cat, desc, amount:amt, type:etype,
      status:document.getElementById('f-estat').value,
      freq, startDate:estart||null, property:eprop||null, companyId:ecompany||null,
      recurring: freq!=='one-off'
    });
  } else if(type==='maint'){
    var mprop = document.getElementById('f-mprop').value;
    var missue = document.getElementById('f-missue').value;
    if(!mprop||!missue){alert('Please select a property and describe the issue.');return;}
    var mroomSel = document.getElementById('f-mroom');
    var mroomVal = mroomSel ? mroomSel.value : '';
    var isRoom = mroomVal && !isNaN(+mroomVal);
    var mroom = isRoom ? +mroomVal : 0;
    var mlocation = mroomVal || 'Communal Area';
    // Find tenant in that room
    var mtenant = '';
    if(isRoom) {
      var mten = state.tenants.find(function(t){return t.property===mprop&&roomNumsEqual(t.room,mroom)&&t.status!=='inactive';});
      if(mten) mtenant = mten.name;
    }
    // Get photo
    var mphotoEl = document.getElementById('f-mphoto-img');
    var mphoto = (mphotoEl && mphotoEl.src && mphotoEl.src.startsWith('data:')) ? mphotoEl.src : null;
    var mnodesEl = document.getElementById('f-mnotes');
    var mcontEl=document.getElementById('f-mcontractor');
    var mdateEl=document.getElementById('f-mdate');
    var mtimeEl=document.getElementById('f-mtime');
    var mScheduledDate = mdateEl && mdateEl.value ? mdateEl.value : null; // YYYY-MM-DD
    var mScheduledTime = mtimeEl && mtimeEl.value ? mtimeEl.value : null; // HH:MM
    // Format a friendly "date" string based on either the scheduled date or today
    var friendlyDate = new Date();
    if(mScheduledDate) {
      var parts = mScheduledDate.split('-');
      if(parts.length===3) friendlyDate = new Date(+parts[0], +parts[1]-1, +parts[2]);
    }
    state.maintenance.push({
      id:crypto.randomUUID(), property:mprop, room:mroom, location:mlocation,
      tenant:mtenant, issue:missue, priority:document.getElementById('f-mpri').value,
      cat:document.getElementById('f-mcat').value, status:'open',
      date:friendlyDate.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),
      scheduledDate: mScheduledDate, scheduledTime: mScheduledTime,
      photo:mphoto, notes:mnodesEl?mnodesEl.value:'',
      contractor:mcontEl?mcontEl.value:''
    });
  }
  saveState();
  closeModal();
  render();
}

// ── STR (Airbnb) income entry modal ─────────────────────────────────────────
// Opens from the property detail Finance tab when isStrEnabled is true.
function openStrIncomeModal(propId) {
  var p = state.properties.find(function(x){return String(x.id)===String(propId);});
  if(!p) { alert('Property not found'); return; }
  if(!p.isStrEnabled) { alert('This property is not marked as Airbnb / STR enabled.'); return; }

  // Default period to the current month
  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var monthEnd   = new Date(now.getFullYear(), now.getMonth()+1, 0);
  var iso = function(d){ return d.toISOString().split('T')[0]; };

  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:480px">'
    +'<div class="modal-header"><span class="modal-title">🛏️ Log Airbnb / STR income</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body">'
    +'<div style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:9px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#E04E53;font-weight:600">📍 '+esc(p.name)+'</div>'
    +'<div class="row-2">'
      +'<div class="field"><label class="field-label">Period start (optional)</label><input class="inp" id="str-period-start" type="date" lang="en-GB" value="'+iso(monthStart)+'"></div>'
      +'<div class="field"><label class="field-label">Period end (optional)</label><input class="inp" id="str-period-end" type="date" lang="en-GB" value="'+iso(monthEnd)+'"></div>'
    +'</div>'
    +'<div class="row-2">'
      +'<div class="field"><label class="field-label">Net amount received *</label><input class="inp" id="str-amount" type="number" step="0.01" min="0" placeholder="0.00" required></div>'
      +'<div class="field"><label class="field-label">Date received</label><input class="inp" id="str-paid-date" type="date" lang="en-GB" value="'+iso(now)+'"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">Method</label>'
      +'<select class="inp" id="str-method"><option value="bank">🏦 Bank</option><option value="cash">💵 Cash</option><option value="airbnb">🛏️ Airbnb payout</option><option value="other">Other</option></select>'
    +'</div>'
    +'<div class="field"><label class="field-label">Notes (optional)</label>'
      +'<input class="inp" id="str-notes" placeholder="e.g. 12 nights · 2 guests">'
    +'</div>'
    +'<div style="font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:9px 11px;line-height:1.5">💡 Record net income only (after Airbnb / Booking.com fees and cleaning). This appears in your P&L under <em>Airbnb / STR income</em> alongside (not replacing) your tenant rent.</div>'
    +'</div>'
    +'<div class="modal-footer">'
      +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
      +'<button data-pid="'+propId+'" onclick="saveStrIncome(this.dataset.pid)" style="padding:9px 18px;border-radius:9px;border:none;background:#FF5A5F;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Log Income</button>'
    +'</div></div></div>';
}

function saveStrIncome(propId) {
  if (!requirePerm('canEdit', 'log STR / Airbnb income')) return;
  var p = state.properties.find(function(x){return String(x.id)===String(propId);});
  if(!p) return;
  var amount = parseFloat(document.getElementById('str-amount').value);
  if(!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
  var ps   = (document.getElementById('str-period-start')||{value:''}).value || null;
  var pe   = (document.getElementById('str-period-end')||{value:''}).value || null;
  var paid = (document.getElementById('str-paid-date')||{value:''}).value || null;
  var method = (document.getElementById('str-method')||{value:'airbnb'}).value;
  var notes  = (document.getElementById('str-notes')||{value:''}).value;
  var paidStr = paid ? new Date(paid).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  var paidRaw = paid ? new Date(paid).getTime() : Date.now();

  state.payments.push({
    id: crypto.randomUUID(),
    tenantId: null, tenantName: '', tenant: '',
    property: p.name, propertyName: p.name,
    amount: amount,
    method: method,
    status: 'paid',
    dueDate: pe || ps || paid,
    paidDate: paidStr,
    _dueDateRaw: paidRaw, _paidDateRaw: paidRaw,
    isPartial: false, shortfall: 0,
    notes: notes,
    incomeSource: 'airbnb',
    periodStart: ps, periodEnd: pe
  });
  saveState();
  closeModal();
  if(typeof showToast === 'function') showToast('STR income logged: '+(window.fmt?fmt(amount):'£'+amount), 'success');
  render();
}

function deleteStrIncome(payId) {
  if (!requirePerm('canDelete', 'delete STR / Airbnb income')) return;
  var idx = state.payments.findIndex(function(x){return String(x.id)===String(payId);});
  if(idx < 0) return;
  var p = state.payments[idx];
  if(p.incomeSource !== 'airbnb') { alert('Only STR entries can be deleted from here.'); return; }
  if(!confirm('Remove this STR income entry?\n\n'+(window.fmt?fmt(p.amount):'£'+p.amount)+' · '+(p.paidDate||'—'))) return;
  var _propId = p.propertyId;
  state.payments.splice(idx,1);
  // Best-effort delete from Supabase
  try { if(window.supa && window._currentOrgId) supa.from('payments').delete().eq('id', String(p.id)).eq('org_id', _currentOrgId).then(function(){}); } catch(e){}
  saveStateImmediate({silentSuccess:true});
  if(typeof showToast === 'function') showToast('STR entry removed','success');
  if(_propId && typeof openPropDetail === 'function'){ state.propDetailTab = 'finance'; openPropDetail(_propId); }
  render();
}

// Inline SA monthly income logger from the property Finance tab.
// Reads sa-month-<pid> + sa-amount-<pid>, appends a payment row with
// incomeSource='airbnb' and period_start/period_end covering that month.
function logStrIncomeFromFinanceTab(propId) {
  var p = (state.properties||[]).find(function(x){return String(x.id)===String(propId);});
  if(!p) return;
  var monthEl  = document.getElementById('sa-month-'+propId);
  var amountEl = document.getElementById('sa-amount-'+propId);
  var monthKey = monthEl ? monthEl.value : '';
  var amount   = amountEl ? +amountEl.value : 0;
  if(!monthKey || !amount || amount <= 0) {
    if(typeof showToast === 'function') showToast('Enter a month and a positive amount', 'error');
    return;
  }
  var parts = monthKey.split('-');
  var y = +parts[0], m = +parts[1];
  var ps = y+'-'+String(m).padStart(2,'0')+'-01';
  var lastDay = new Date(y, m, 0).getDate();
  var pe = y+'-'+String(m).padStart(2,'0')+'-'+String(lastDay).padStart(2,'0');
  var paidRaw = new Date(pe).getTime();
  var paidStr = new Date(pe).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  state.payments.push({
    id: crypto.randomUUID(),
    tenantId: null, tenantName: '', tenant: '',
    property: p.name, propertyName: p.name, propertyId: p.id,
    amount: amount,
    method: 'airbnb',
    status: 'paid',
    dueDate: pe, paidDate: paidStr,
    _dueDateRaw: paidRaw, _paidDateRaw: paidRaw,
    isPartial: false, shortfall: 0,
    notes: '',
    incomeSource: 'airbnb',
    periodStart: ps, periodEnd: pe
  });
  saveStateImmediate({silentSuccess:true});
  if(typeof showToast === 'function') showToast('SA income logged: '+(window.fmt?fmt(amount):'£'+amount), 'success');
  // Re-render the open property-detail modal so the new row + totals appear immediately.
  state.propDetailTab = 'finance';
  if(typeof openPropDetail === 'function') openPropDetail(p.id);
  render();
}

// ═════════════════════════════════════════════════════════════════════════
// Property Inspections
// Stored on properties.inspections (JSONB array). Photos live in the
// property-docs Storage bucket under properties/{pid}/inspections/{inspId}/.
// ═════════════════════════════════════════════════════════════════════════

var _inspectionPhotoBuffer = []; // {name, dataUrl, file} pending upload

// In-memory selection state for the open inspection modal. Keys updated by
// _setInspCond / _setInspRating via direct button clicks (more reliable than
// hidden <input type=radio> labels, which silently failed in some browsers).
var _inspectionSelection = { rating: 'Good', conditions: {} };

function openInspectionModal(propId) {
  var p = (state.properties||[]).find(function(x){return String(x.id)===String(propId);});
  if(!p) return;
  _inspectionPhotoBuffer = [];
  var today = new Date().toISOString().split('T')[0];
  var AREAS = [
    {k:'kitchen',    l:'Kitchen'},
    {k:'bathroom',   l:'Bathroom'},
    {k:'bedrooms',   l:'Bedrooms'},
    {k:'living',     l:'Living areas'},
    {k:'exterior',   l:'Exterior / Garden'},
    {k:'smokealarm', l:'Smoke / CO alarms'},
    {k:'cleanliness',l:'General cleanliness'}
  ];
  // Seed selections: overall rating defaults to Good, every area defaults to OK.
  // areas list lives on the selection state so custom rows added at runtime survive re-renders.
  _inspectionSelection = { rating: 'Good', conditions: {}, areas: AREAS.slice() };
  AREAS.forEach(function(a){ _inspectionSelection.conditions[a.k] = 'OK'; });

  // Room picker — "Whole property" + each lettable room. Stored on insp.roomN.
  var isWhole = (p.lettingType||'hmo') === 'whole';
  var roomOptsHtml = '<option value="">Whole property</option>';
  if(!isWhole && p.roomList) {
    p.roomList.forEach(function(r){
      roomOptsHtml += '<option value="'+r.n+'">Room '+r.n+(r.type?(' · '+esc(r.type)):'')+'</option>';
    });
  }

  function condPillsHtml(areaKey) {
    return ['OK','Issue','N/A'].map(function(v){
      var selected = _inspectionSelection.conditions[areaKey] === v;
      // Non-selected: neutral grey so the picked option is unmistakable.
      // Selected: full colour fill — OK=green, Issue=red, N/A=slate.
      var selBg = v==='OK' ? '#10B981' : v==='Issue' ? '#E8375A' : '#475569';
      var bg = selected ? selBg : '#F1F5F9';
      var fg = selected ? '#fff' : '#475569';
      var border = selected ? selBg : '#E2E8F0';
      var dataVal = v==='N/A' ? 'NA' : v;
      return '<button type="button" onclick="_setInspCond(\''+areaKey+'\',\''+v.replace("/","\\/")+'\')" data-area="'+areaKey+'" data-val="'+dataVal+'" class="insp-cond-btn" style="padding:6px 14px;border-radius:7px;border:1.5px solid '+border+';background:'+bg+';color:'+fg+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .1s;min-width:50px">'+v+'</button>';
    }).join('');
  }

  function buildAreasHtml(){
    var rows = (_inspectionSelection.areas||[]).map(function(a){
      var isCustom = a.custom;
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)" data-area-row="'+a.k+'">'
        +'<span style="font-size:13px;color:var(--text);flex:1;min-width:0">'+esc(a.l)+(isCustom?' <button type="button" onclick="_removeInspArea(\''+a.k+'\')" title="Remove" style="background:transparent;border:none;color:var(--dim);font-size:14px;cursor:pointer;padding:0 4px">×</button>':'')+'</span>'
        +'<div style="display:flex;gap:6px;flex-shrink:0">'+condPillsHtml(a.k)+'</div>'
        +'</div>';
    }).join('');
    return rows
      +'<div style="padding:10px 0 4px"><button type="button" onclick="_addInspArea()" style="font-size:12px;font-weight:600;color:var(--accent-dark);background:var(--accent-light);border:1px dashed var(--accent);border-radius:7px;padding:6px 12px;cursor:pointer;font-family:inherit">+ Add room / area</button></div>';
  }
  var areasHtml = buildAreasHtml();

  var ratingPillsHtml = ['Excellent','Good','Fair','Poor'].map(function(r){
    var selected = _inspectionSelection.rating === r;
    var col = r==='Excellent'?'var(--green)':r==='Good'?'var(--blue)':r==='Fair'?'var(--amber)':'var(--red)';
    return '<button type="button" onclick="_setInspRating(\''+r+'\')" data-rating="'+r+'" class="insp-rate-btn" style="padding:10px 6px;border-radius:9px;border:2px solid '+(selected?col:'transparent')+';background:'+(selected?col:'var(--bg)')+';color:'+(selected?'#fff':'var(--text)')+';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .1s">'+r+'</button>';
  }).join('');

  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:640px;width:min(640px,calc(100vw - 16px));height:min(90vh,860px);overflow:hidden;display:flex;flex-direction:column">'
    +'<div class="modal-header"><span class="modal-title">🔍 New Inspection — '+esc(p.name)+'</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body" style="overflow-y:auto;flex:1">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
    +  '<div class="field"><label class="field-label">Inspector</label><input class="inp" id="insp-inspector" placeholder="Your name" value=""></div>'
    +  '<div class="field"><label class="field-label">Date</label><input class="inp" id="insp-date" type="date" value="'+today+'"></div>'
    +'</div>'
    +'<div class="field" style="margin-bottom:14px">'
    +  '<label class="field-label">Reason for inspection</label>'
    +  '<select class="inp" id="insp-reason">'
    +    '<option value="routine">Routine / Periodic</option>'
    +    '<option value="move_in">Move-in / Check-in</option>'
    +    '<option value="move_out">Move-out / Check-out</option>'
    +    '<option value="mid_tenancy">Mid-tenancy</option>'
    +    '<option value="maintenance">Post-maintenance</option>'
    +    '<option value="complaint">Complaint follow-up</option>'
    +    '<option value="inventory">Inventory check</option>'
    +    '<option value="licensing">HMO licensing</option>'
    +    '<option value="other">Other</option>'
    +  '</select>'
    +'</div>'
    +'<div class="field" style="margin-bottom:14px">'
    +  '<label class="field-label">Scope</label>'
    +  '<select class="inp" id="insp-room">'+roomOptsHtml+'</select>'
    +  '<div style="font-size:10px;color:var(--dim);margin-top:4px">Inspect a specific room or the whole property.</div>'
    +'</div>'
    +'<div class="field" style="margin-bottom:14px"><label class="field-label">Overall rating</label>'
    +  '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px" id="insp-rating-wrap">'+ratingPillsHtml+'</div>'
    +'</div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Condition by area</div>'
    +'<div id="insp-areas-wrap" style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:14px">'+areasHtml+'</div>'
    +'<div class="field" style="margin-bottom:14px"><label class="field-label">Notes</label>'
    +  '<textarea class="inp" id="insp-notes" rows="4" placeholder="Detailed observations, any follow-up actions, tenant feedback…"></textarea>'
    +'</div>'
    +'<div class="field" style="margin-bottom:14px"><label class="field-label">Photos</label>'
    +  '<input type="file" id="insp-photo-input" accept="image/*" multiple style="display:none" onchange="addInspectionPhotos(this)">'
    +  '<input type="file" id="insp-camera-input" accept="image/*" capture="environment" multiple style="display:none" onchange="addInspectionPhotos(this)">'
    +  '<div style="display:flex;gap:8px">'
    +    '<button type="button" onclick="document.getElementById(\'insp-camera-input\').click()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;border-radius:9px;border:2px dashed var(--accent);background:var(--accent-light);cursor:pointer;font-family:inherit"><span style="font-size:18px">📷</span><span style="font-size:12px;font-weight:700;color:var(--accent-dark)">Camera</span></button>'
    +    '<button type="button" onclick="document.getElementById(\'insp-photo-input\').click()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);cursor:pointer;font-family:inherit"><span style="font-size:18px">🖼️</span><span style="font-size:12px;font-weight:700;color:var(--muted)">Files</span></button>'
    +  '</div>'
    +  '<button type="button" style="display:none">'
    +    '<span style="font-size:20px">📷</span>'
    +    '<div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">Add photos</div>'
    +    '<div style="font-size:11px;color:var(--muted)">JPG / PNG · multiple allowed</div></div>'
    +  '</button>'
    +  '<div id="insp-photo-preview" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px;margin-top:10px"></div>'
    +'</div>'
    +'</div>'
    +'<div class="modal-footer">'
    +  btn('Cancel','closeModal()','secondary')
    +  btn('Save Inspection','saveInspection(\''+p.id+'\')','primary')
    +'</div>'
    +'</div></div>';
}

function _setInspCond(areaKey, value) {
  _inspectionSelection.conditions[areaKey] = value;
  var row = document.querySelector('[data-area-row="'+areaKey+'"]');
  if(!row) return;
  Array.prototype.forEach.call(row.querySelectorAll('.insp-cond-btn'), function(btn){
    // data-val uses 'NA' for the N/A button to dodge attribute-quoting issues; map back here.
    var v = btn.dataset.val === 'NA' ? 'N/A' : btn.dataset.val;
    var selected = v === value;
    var selBg = v==='OK' ? '#10B981' : v==='Issue' ? '#E8375A' : '#475569';
    btn.style.background   = selected ? selBg : '#F1F5F9';
    btn.style.color        = selected ? '#fff' : '#475569';
    btn.style.borderColor  = selected ? selBg : '#E2E8F0';
  });
}
// Add a custom inspection row at runtime (e.g. "Bedroom 2", "Garage").
function _addInspArea(){
  var label = (prompt('Name of the room or area to inspect:','')||'').trim();
  if(!label) return;
  if(!_inspectionSelection.areas) _inspectionSelection.areas = [];
  // Generate a unique key from the label.
  var base = label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'area';
  var k = base, i = 2;
  while(_inspectionSelection.areas.some(function(a){return a.k===k;})) { k = base+'_'+i; i++; }
  _inspectionSelection.areas.push({k:k, l:label, custom:true});
  _inspectionSelection.conditions[k] = 'OK';
  var wrap = document.getElementById('insp-areas-wrap');
  if(wrap){
    var html = (_inspectionSelection.areas||[]).map(function(a){
      var isCustom = a.custom;
      var pills = ['OK','Issue','N/A'].map(function(v){
        var selected = _inspectionSelection.conditions[a.k] === v;
        var selBg = v==='OK' ? '#10B981' : v==='Issue' ? '#E8375A' : '#475569';
        var bg = selected ? selBg : '#F1F5F9';
        var fg = selected ? '#fff' : '#475569';
        var border = selected ? selBg : '#E2E8F0';
        var dataVal = v==='N/A' ? 'NA' : v;
        return '<button type="button" onclick="_setInspCond(\''+a.k+'\',\''+v+'\')" data-area="'+a.k+'" data-val="'+dataVal+'" class="insp-cond-btn" style="padding:6px 14px;border-radius:7px;border:1.5px solid '+border+';background:'+bg+';color:'+fg+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .1s;min-width:50px">'+v+'</button>';
      }).join('');
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)" data-area-row="'+a.k+'">'
        +'<span style="font-size:13px;color:var(--text);flex:1;min-width:0">'+esc(a.l)+(isCustom?' <button type="button" onclick="_removeInspArea(\''+a.k+'\')" title="Remove" style="background:transparent;border:none;color:var(--dim);font-size:14px;cursor:pointer;padding:0 4px">×</button>':'')+'</span>'
        +'<div style="display:flex;gap:6px;flex-shrink:0">'+pills+'</div></div>';
    }).join('');
    wrap.innerHTML = html
      +'<div style="padding:10px 0 4px"><button type="button" onclick="_addInspArea()" style="font-size:12px;font-weight:600;color:var(--accent-dark);background:var(--accent-light);border:1px dashed var(--accent);border-radius:7px;padding:6px 12px;cursor:pointer;font-family:inherit">+ Add room / area</button></div>';
  }
}

function _removeInspArea(k){
  if(!_inspectionSelection.areas) return;
  _inspectionSelection.areas = _inspectionSelection.areas.filter(function(a){return a.k!==k;});
  delete _inspectionSelection.conditions[k];
  var row = document.querySelector('[data-area-row="'+k+'"]');
  if(row && row.parentElement) row.parentElement.removeChild(row);
}

function _setInspRating(value) {
  _inspectionSelection.rating = value;
  var wrap = document.getElementById('insp-rating-wrap');
  if(!wrap) return;
  Array.prototype.forEach.call(wrap.querySelectorAll('.insp-rate-btn'), function(btn){
    var r = btn.dataset.rating;
    var selected = r === value;
    var col = r==='Excellent'?'var(--green)':r==='Good'?'var(--blue)':r==='Fair'?'var(--amber)':'var(--red)';
    btn.style.background  = selected ? col : 'var(--bg)';
    btn.style.color       = selected ? '#fff' : 'var(--text)';
    btn.style.borderColor = selected ? col : 'transparent';
  });
}

function addInspectionPhotos(inputEl) {
  var files = Array.from(inputEl.files || []);
  files.forEach(function(file){
    if(!/^image\//.test(file.type)) return;
    var reader = new FileReader();
    reader.onload = function(e){
      _inspectionPhotoBuffer.push({name:file.name, dataUrl:e.target.result, file:file});
      renderInspectionPhotoPreviews();
    };
    reader.readAsDataURL(file);
  });
  inputEl.value = '';
}

function renderInspectionPhotoPreviews() {
  var wrap = document.getElementById('insp-photo-preview');
  if(!wrap) return;
  wrap.innerHTML = _inspectionPhotoBuffer.map(function(ph, i){
    return '<div style="position:relative">'
      +'<img src="'+ph.dataUrl+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid var(--border)">'
      +'<button onclick="removeInspectionPhoto('+i+')" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(0,0,0,.7);color:#fff;cursor:pointer;font-family:inherit;font-size:13px;line-height:1">×</button>'
      +'</div>';
  }).join('');
}

function removeInspectionPhoto(i) {
  _inspectionPhotoBuffer.splice(i,1);
  renderInspectionPhotoPreviews();
}

async function saveInspection(propId) {
  var p = (state.properties||[]).find(function(x){return String(x.id)===String(propId);});
  if(!p) return;
  var inspector = (document.getElementById('insp-inspector')||{value:''}).value.trim();
  var date      = (document.getElementById('insp-date')||{value:''}).value;
  var reason    = (document.getElementById('insp-reason')||{value:'routine'}).value;
  var notes     = (document.getElementById('insp-notes')||{value:''}).value.trim();
  var roomRaw   = (document.getElementById('insp-room')||{value:''}).value;
  var roomN     = roomRaw === '' ? null : (parseInt(roomRaw,10) || null);
  // Pull selections from the module-level state — survives any browser quirk
  // around hidden <input type=radio> labels that was dropping clicks before.
  var rating     = (_inspectionSelection && _inspectionSelection.rating) || 'Good';
  var conditions = (_inspectionSelection && _inspectionSelection.conditions) ? Object.assign({}, _inspectionSelection.conditions) : {};
  var inspId = crypto.randomUUID();
  var ts = date ? (date + 'T' + new Date().toISOString().split('T')[1]) : new Date().toISOString();

  // Upload photos. Try Supabase Storage first; if the bucket / RLS rejects, fall
  // back to embedding the image as a base64 data URL so the photo isn't lost.
  // (Inspection records are tiny — even a few embedded photos stay well under
  // the per-org app_config size limit.)
  var photos = [];
  var uploadErrors = [];
  var fallbackCount = 0;
  if(_inspectionPhotoBuffer.length) {
    if(typeof showToast === 'function') showToast('Saving '+_inspectionPhotoBuffer.length+' photo(s)…','success');
    var canTryStorage = !!(window.supa && window._currentOrgId);
    for(var i=0;i<_inspectionPhotoBuffer.length;i++){
      var ph = _inspectionPhotoBuffer[i];
      var ext = (ph.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
      var path = 'properties/'+p.id+'/inspections/'+inspId+'/'+String(i+1).padStart(2,'0')+'.'+ext;
      var saved = false;
      if (canTryStorage) {
        try {
          var up = await supa.storage.from('property-docs').upload(path, ph.file, {upsert:true, contentType: ph.file.type||'image/jpeg'});
          if(up && up.error){
            console.warn('Inspection photo storage error (will fall back to embed):', up.error);
            uploadErrors.push(ph.name+': '+(up.error.message||'storage rejected'));
          } else {
            var pub = supa.storage.from('property-docs').getPublicUrl(path);
            photos.push({name: ph.name, url: (pub.data&&pub.data.publicUrl)||null, storagePath: path});
            saved = true;
          }
        } catch(e) {
          console.warn('Inspection photo storage threw (will fall back):', e);
          uploadErrors.push(ph.name+': '+(e && e.message || 'storage threw'));
        }
      }
      // Fallback: embed the data URL directly so the photo is still part of the inspection.
      if (!saved && ph.dataUrl) {
        photos.push({ name: ph.name, dataUrl: ph.dataUrl, embedded: true });
        fallbackCount++;
      }
    }
  }

  if(!p.inspections) p.inspections = [];
  p.inspections.push({
    id: inspId,
    timestamp: ts,
    inspector: inspector || 'Inspector',
    reason: reason,         // routine, move_in, move_out, etc.
    roomN: roomN,           // null = whole property
    overallRating: rating,
    conditions: conditions,
    notes: notes,
    photos: photos
  });
  _inspectionPhotoBuffer = [];
  saveStateImmediate({silentSuccess:true});
  closeModal();
  if(uploadErrors.length && fallbackCount > 0){
    if(typeof showToast === 'function') showToast('Inspection saved · '+fallbackCount+' photo(s) embedded (storage offline)','success');
    console.warn('Inspection storage errors (used fallback embed):', uploadErrors);
  } else if(uploadErrors.length){
    if(typeof showToast === 'function') showToast('Inspection saved, but '+uploadErrors.length+' photo(s) failed','warn');
    console.warn('Inspection photo errors:', uploadErrors);
  } else {
    if(typeof showToast === 'function') showToast('Inspection saved'+(photos.length?' with '+photos.length+' photo(s)':''), 'success');
  }
  // Re-open the property detail modal on the Docs tab so the new inspection shows.
  state.propDetailTab = 'docs';
  if(typeof openPropDetail === 'function') openPropDetail(p.id);
  render();
}

var REASON_LABELS = {
  routine: 'Routine / Periodic',
  move_in: 'Move-in / Check-in',
  move_out: 'Move-out / Check-out',
  mid_tenancy: 'Mid-tenancy',
  maintenance: 'Post-maintenance',
  complaint: 'Complaint follow-up',
  inventory: 'Inventory check',
  licensing: 'HMO licensing',
  other: 'Other'
};

function viewInspection(propId, inspId) {
  var p = (state.properties||[]).find(function(x){return String(x.id)===String(propId);});
  if(!p || !p.inspections) return;
  var insp = p.inspections.find(function(x){return x.id===inspId;});
  if(!insp) return;
  var ts = insp.timestamp ? new Date(insp.timestamp) : null;
  var tsLbl = ts ? ts.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})+' at '+ts.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '—';
  var cond = insp.conditions || {};
  var AREA_LABELS = {kitchen:'Kitchen',bathroom:'Bathroom',bedrooms:'Bedrooms',living:'Living areas',exterior:'Exterior / Garden',smokealarm:'Smoke / CO alarms',cleanliness:'General cleanliness'};
  var condHtml = Object.keys(cond).map(function(k){
    var v = cond[k];
    var col = v==='OK'?'var(--green)':v==='Issue'?'var(--red)':'var(--muted)';
    return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">'
      +'<span>'+(AREA_LABELS[k]||k)+'</span>'
      +'<span style="font-weight:700;color:'+col+'">'+esc(v)+'</span></div>';
  }).join('');
  var photoHtml = (insp.photos||[]).length
    ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">'
      + insp.photos.map(function(ph){
          // Storage upload path (ph.url) OR embedded base64 fallback (ph.dataUrl).
          var src = ph.url || ph.dataUrl || '';
          if(!src) return '';
          return '<a href="'+src+'" target="_blank" style="display:block"><img src="'+src+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid var(--border)"></a>';
        }).join('')
      +'</div>'
    : '<div style="font-size:12px;color:var(--muted)">No photos.</div>';
  var ratingCol = insp.overallRating==='Excellent'?'var(--green)':insp.overallRating==='Good'?'var(--blue)':insp.overallRating==='Fair'?'var(--amber)':'var(--red)';
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:640px;width:min(640px,calc(100vw - 16px));height:min(90vh,860px);overflow:hidden;display:flex;flex-direction:column">'
    +'<div class="modal-header"><span class="modal-title">🔍 Inspection · '+esc(p.name)+'</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body" style="overflow-y:auto;flex:1">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">'
    +  '<div><div style="font-size:14px;font-weight:700">'+esc(insp.inspector||'')+'</div>'
    +  '<div style="font-size:12px;color:var(--muted)">'+tsLbl+(insp.reason&&insp.reason!=='routine'?' · <span style="color:var(--accent);font-weight:600">'+esc(REASON_LABELS[insp.reason]||insp.reason)+'</span>':'')+'</div></div>'
    +  '<div style="display:flex;gap:6px;align-items:center">'
    +    '<span style="padding:4px 10px;border-radius:7px;font-size:11px;font-weight:700;color:var(--text);background:var(--bg);border:1px solid var(--border)">'+(insp.roomN?('Room '+insp.roomN):'Whole property')+'</span>'
    +    '<span style="padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;color:#fff;background:'+ratingCol+'">'+esc(insp.overallRating||'')+'</span>'
    +  '</div>'
    +'</div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Condition by area</div>'
    +'<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:14px">'+condHtml+'</div>'
    +(insp.notes
      ? '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Notes</div>'
        +'<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:1.6;white-space:pre-wrap">'+esc(insp.notes)+'</div>'
      : '')
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Photos</div>'
    +photoHtml
    +'</div>'
    +'<div class="modal-footer">'
    +  btn('Close','closeModal()','primary')
    +'</div>'
    +'</div></div>';
}

function deleteInspection(propId, inspId) {
  var p = (state.properties||[]).find(function(x){return String(x.id)===String(propId);});
  if(!p || !p.inspections) return;
  if(!confirm('Delete this inspection report and its photos?')) return;
  var insp = p.inspections.find(function(x){return x.id===inspId;});
  p.inspections = p.inspections.filter(function(x){return x.id!==inspId;});
  // Best-effort: remove photos from storage
  if(insp && insp.photos && window.supa && window._currentOrgId){
    var paths = insp.photos.map(function(ph){return ph.storagePath;}).filter(Boolean);
    if(paths.length) {
      try { supa.storage.from('property-docs').remove(paths).then(function(){}); } catch(e){}
    }
  }
  saveStateImmediate({silentSuccess:true});
  if(typeof showToast === 'function') showToast('Inspection deleted','success');
  state.propDetailTab = 'docs';
  if(typeof openPropDetail === 'function') openPropDetail(p.id);
  render();
}

// ── Add Tenant modal helpers — Business client toggle + autofill ─────────────
// Toggling between Individual / Business mode hides irrelevant fields:
//  · Individual: shows Full Name + WhatsApp inline; hides client picker.
//  · Business:   shows client picker (existing or + New); hides Full Name +
//                WhatsApp because both come from the client and are sourced
//                at runtime by the dashboard (single source of truth).
function onTenantCategoryChange(){
  var catEl = document.querySelector('input[name="f-tcategory"]:checked');
  var isBusiness = catEl && catEl.value === 'business';
  var sec        = document.getElementById('f-business-section');
  var indWrap    = document.getElementById('f-individual-name-wrap');
  var waWrap     = document.getElementById('f-twa-wrap');
  var indLbl     = document.getElementById('f-cat-individual-lbl');
  var bizLbl     = document.getElementById('f-cat-business-lbl');
  if (sec)    sec.style.display    = isBusiness ? 'block' : 'none';
  if (indWrap)indWrap.style.display = isBusiness ? 'none'  : '';
  if (waWrap) waWrap.style.display  = isBusiness ? 'none'  : '';
  // Recolour the toggle pills so the active option is obvious.
  if (indLbl) {
    indLbl.style.borderColor = isBusiness ? 'var(--border)' : 'var(--blue)';
    indLbl.style.background  = isBusiness ? 'var(--bg)' : 'var(--blue-light)';
  }
  if (bizLbl) {
    bizLbl.style.borderColor = isBusiness ? 'var(--green, #10B981)' : 'var(--border)';
    bizLbl.style.background  = isBusiness ? 'var(--green-light, #ECFDF5)' : 'var(--bg)';
  }
  if (isBusiness) onClientChange();
}

// Reveals the new-client inline form when "+ Add new client" is selected;
// hides it when the user picks an existing client.
function onClientChange(){
  var sel = document.getElementById('f-tclient');
  var newFields = document.getElementById('f-newclient-fields');
  if (!sel || !newFields) return;
  newFields.style.display = (sel.value === '__new') ? 'block' : 'none';
}

// Auto-fills the Rent field from the selected property's whole-let rent.
// Business clients usually take whole properties, so we anchor on properties.rent.
// HMO single-room rents are still entered manually (per-room price varies).
function autofillTenantRentFromProperty(){
  var catEl = document.querySelector('input[name="f-tcategory"]:checked');
  var isBusiness = catEl && catEl.value === 'business';
  if (!isBusiness) return;
  var propSel  = document.getElementById('f-tprop');
  var rentInp  = document.getElementById('f-trent');
  var freqSel  = document.getElementById('f-tfreq');
  if (!propSel || !rentInp) return;
  var prop = (state.properties||[]).find(function(p){ return p.name === propSel.value; });
  if (!prop) return;
  var isWhole = (prop.lettingType||'hmo') === 'whole';
  if (isWhole && prop.rent) {
    rentInp.value = prop.rent;
    // Whole-let rents in this app are stored monthly; flip the freq to monthly.
    if (freqSel && freqSel.value !== 'monthly') {
      freqSel.value = 'monthly';
      if (typeof onFreqChange === 'function') onFreqChange();
    }
    // Suppress the auto-deposit (2× rent) recalc — business deposits are
    // typically negotiated separately, so leave the field for manual entry.
    var dep = document.getElementById('f-tdeposit');
    if (dep && !dep.dataset.manual) dep.value = '';
  }
}

// Expose to window — sections are concatenated; explicit attachment for safety
if(typeof window !== 'undefined') {
  window.openStrIncomeModal = openStrIncomeModal;
  window.saveStrIncome     = saveStrIncome;
  window.deleteStrIncome   = deleteStrIncome;
  window.logStrIncomeFromFinanceTab = logStrIncomeFromFinanceTab;
  window.openInspectionModal  = openInspectionModal;
  window.addInspectionPhotos  = addInspectionPhotos;
  window.removeInspectionPhoto= removeInspectionPhoto;
  window.saveInspection       = saveInspection;
  window.viewInspection       = viewInspection;
  window.deleteInspection     = deleteInspection;
  window._setInspCond         = _setInspCond;
  window._setInspRating       = _setInspRating;
  window._addInspArea         = _addInspArea;
  window._removeInspArea      = _removeInspArea;
  window.onTenantCategoryChange       = onTenantCategoryChange;
  window.onClientChange               = onClientChange;
  window.autofillTenantRentFromProperty = autofillTenantRentFromProperty;
}
