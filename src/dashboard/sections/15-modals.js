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
      var ten = state.tenants.find(function(t){return t.property===p.name&&t.room===r.n&&t.status!=='inactive';});
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
  var t = state.tenants.find(function(x){return x.property===propName&&x.room===+roomVal&&x.status!=='inactive';});
  if(!t) { infoBox.style.display='none'; return; }
  var phone = t.whatsapp ? '+'+t.whatsapp : '—';
  infoEl.innerHTML =
    '<div style="display:flex;gap:16px;flex-wrap:wrap">'
    +'<div><span style="font-weight:600">👤</span> '+t.name+'</div>'
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
      set.add(+t.room || 1);
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

function openModal(type) {
  const propOpts = (state.properties || [])
    .map(function(p) {
      var isWhole = (p.lettingType || 'hmo') === 'whole';
      if (isWhole) {
        var hasActive = (state.tenants || []).some(function(t) {
          return t && t.property === p.name && t.status !== 'inactive';
        });
        return '<option value="' + p.name + '">' + p.name + ' (' + (hasActive ? 'occupied' : 'available') + ')</option>';
      }
      var rooms = _derivePropertyRoomsForTenantModal(p);
      var occupiedByTenant = _activeTenantRoomSet(p.name);
      var vacant = rooms.filter(function(r) {
        var explicitlyOccupied = r.status === 'occupied';
        return !occupiedByTenant.has(r.n) && !explicitlyOccupied;
      }).length;
      if (!rooms.length) {
        return '<option value="' + p.name + '">' + p.name + ' (no rooms set up)</option>';
      }
      return '<option value="' + p.name + '">' + p.name + ' (' + vacant + ' room' + (vacant === 1 ? '' : 's') + ' free)</option>';
    })
    .join('');
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
      </div>

      <!-- ── Step 2: Core details ── -->
      <div class="field"><label class="field-label">Property Name *</label><input class="inp" id="f-name" placeholder="e.g. 15 Station Road"></div>
      <div class="row-2">
        <div class="field"><label class="field-label">Street Address</label><input class="inp" id="f-address" placeholder="e.g. 15 Station Road, Brixton"></div>
        <div class="field"><label class="field-label">Postcode</label><input class="inp" id="f-postcode" placeholder="e.g. SW9 8PS" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Area</label>
          <select class="inp" id="f-area"><option>Brixton</option><option>Clapham</option><option>Stockwell</option><option>Vauxhall</option><option>Kennington</option><option>Camberwell</option><option>Peckham</option><option>Dulwich</option><option>Streatham</option><option>Tooting</option><option>Balham</option><option>Norbury</option><option>Croydon</option><option>Thornton Heath</option><option>Norwood</option><option>Crystal Palace</option><option>Sydenham</option><option>Lewisham</option><option>Deptford</option><option>New Cross</option><option>Catford</option><option>Forest Hill</option><option>Lambeth</option><option>Wandsworth</option><option>Southwark</option><option>Bermondsey</option><option>Other</option></select>
        </div>
        <div class="field"><label class="field-label">Type</label>
          <select class="inp" id="f-type"><option>HMO</option><option>Single Let</option><option>Semi-Commercial</option><option>Other</option></select>
        </div>
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
            ${state.landlords.map(ll=>`<option value="${ll.name}">${ll.name}</option>`).join('')}
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
          ${(state.companies||[]).map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('')}
        </select>
      </div>`,

    addTenant:`
      <div class="field"><label class="field-label">Full Name</label><input class="inp" id="f-tname" placeholder="e.g. John Smith"></div>
      <div class="row-2">
        <div class="field"><label class="field-label">Property</label>
          <select class="inp" id="f-tprop" onchange="refreshRoomDropdown()">
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
      <div class="field">
        <label class="field-label">📱 WhatsApp Number <span style="color:var(--red)">*</span></label>
        <input class="inp" id="f-twa" type="tel" placeholder="e.g. 447911000000 or 351912345678" required>
        <div style="font-size:11px;color:var(--muted);margin-top:5px">Include country code — UK: 447911000000 · Portugal: 351912345678 · Brazil: 5511999990000</div>
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
            ${(function(){return state.properties.map(function(p){return '<option value="'+p.name+'">'+p.name+'</option>';}).join('');})()}
          </select>
        </div>
        <div class="field"><label class="field-label">🏢 Company</label>
          <select class="inp" id="f-ecompany">
            <option value="">— Unassigned —</option>
            ${(state.companies||[]).map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('')}
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
          ${state.properties.map(function(p){return '<option value="'+p.name+'">'+p.name+'</option>';}).join('')}
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
        <input type="file" id="f-mphoto-input" accept="image/*" style="display:none" onchange="previewMaintModalPhoto(this)">
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
          ${(state.contractors||[]).map(function(c){return '<option value="'+c.name+'">'+c.name+(c.trade?' · '+c.trade:'')+(c.phone?' ('+c.phone+')':'')+'</option>';}).join('')}
        </select>
      </div>
      <div class="field"><label class="field-label">Notes</label>
        <input class="inp" id="f-mnotes" placeholder="Any additional context, access details, best times to attend…">
      </div>`,
  };
  const titles = {addProp:'Add Property',addTenant:'Add Tenant',addExpense:'Add Expense',addMaint:'Log Maintenance Request'};
  const saveLabels = {addProp:'Add Property',addTenant:'Add Tenant',addExpense:'Add Expense',addMaint:'Log Request'};
  const saveType = {addProp:'prop',addTenant:'tenant',addExpense:'expense',addMaint:'maint'};

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${titles[type]}</span>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          ${modals[type]}
          <div class="modal-footer">
            ${btn('Cancel',"closeModal()",'secondary')}
            ${btn(saveLabels[type],`saveModal('${saveType[type]}')`,'primary')}
          </div>
        </div>
      </div>
    </div>`;
}

function closeModal(){document.getElementById('modal-container').innerHTML=''}

var _tenantSearchTimer = null;
function debouncedTenantSearch() {
  if(_tenantSearchTimer) clearTimeout(_tenantSearchTimer);
  _tenantSearchTimer = setTimeout(function() {
    if(state.page === 'tenants') {
      document.getElementById('content').innerHTML = renderTenants();
      var inp = document.querySelector('.search-inp');
      if(inp) {
        var v = state.filters.tenantQ || '';
        inp.focus();
        inp.setSelectionRange(v.length, v.length);
      }
    }
  }, 250);
}

var _propSearchTimer = null;
function debouncedPropSearch() {
  if(_propSearchTimer) clearTimeout(_propSearchTimer);
  _propSearchTimer = setTimeout(function() {
    if(state.page === 'properties') {
      document.getElementById('content').innerHTML = renderProperties();
      var inp = document.querySelector('.search-inp');
      if(inp) {
        var v = state.filters.propQ || '';
        inp.focus();
        inp.setSelectionRange(v.length, v.length);
      }
    }
  }, 250);
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
    // Check if already occupied by an active tenant
    var existing = state.tenants.find(function(t){ return t.property===propName && t.status==='active'; });
    if(existing) {
      roomSel.innerHTML = '';
      var opt2 = document.createElement('option');
      opt2.value = ''; opt2.textContent = 'Already occupied by ' + existing.name;
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
    };
    state.properties.push(newProp);
  } else if(type==='tenant'){
    var g = function(id){ var el=document.getElementById(id); return el?el.value:null; };
    var name = g('f-tname'); if(!name||!name.trim()) return;
    var startDateVal = g('f-tstart');
    if(!startDateVal) { alert('Please enter a check-in date — this field is required.'); return; }
    var waFull = (g('f-twa')||'').trim().replace(/\s+/g,'').replace(/^\+/,'');
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
    // Validate WhatsApp
    if(!waFull || waFull.length < 10){ alert('Please enter a valid WhatsApp number (include country code e.g. 447911000000).'); return; }
    // Validate rent
    if(!rentVal || rentVal <= 0){ alert('Please enter a valid rent amount.'); return; }
    // Prevent duplicate assignment — for whole property block if any active tenant exists
    if(isWholeProp) {
      var wholeTaken = state.tenants.find(function(t){ return t.property===propName && t.status==='active'; });
      if(wholeTaken){ alert('⚠️ '+propName+' already has an active tenant ('+wholeTaken.name+').\nMark them as inactive before adding a new one.'); return; }
    } else {
      var roomTaken = state.tenants.find(function(t){ return t.property===propName && t.room===roomN && t.status!=='inactive'; });
      if(roomTaken){ alert('⚠️ Room '+roomN+' at '+propName+' is already occupied by '+roomTaken.name+'.\nPlease select a different room.'); return; }
    }
    // Update room type on the property roomList
    if(propObj && propObj.roomList){
      var rm = propObj.roomList.find(function(r){return r.n===roomN;});
      if(rm) rm.type = roomType;
    }
    state.tenants.push({
      id:crypto.randomUUID(), name:name.trim(), property:propName, room:roomN, roomType:roomType,
      rent:rentVal, freq:freq, payDay:payDay, payDayOfMonth:payDom,
      method:method, status:'active', paid:'—', arrears:0,
      whatsapp:waFull, deposit:deposit, depositStatus:'held',
      moveIn:startDate, startDate:startDate, noticeDate:null,
      moveOutDate:null, email:'', paymentHistory:[]
    });
    occupyRoom(propName, roomN, rentVal);
    rebuildAllSchedules();
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
      var mten = state.tenants.find(function(t){return t.property===mprop&&t.room===mroom&&t.status!=='inactive';});
      if(mten) mtenant = mten.name;
    }
    // Get photo
    var mphotoEl = document.getElementById('f-mphoto-img');
    var mphoto = (mphotoEl && mphotoEl.src && mphotoEl.src.startsWith('data:')) ? mphotoEl.src : null;
    var mnodesEl = document.getElementById('f-mnotes');
    var mcontEl=document.getElementById('f-mcontractor');
    state.maintenance.push({
      id:crypto.randomUUID(), property:mprop, room:mroom, location:mlocation,
      tenant:mtenant, issue:missue, priority:document.getElementById('f-mpri').value,
      cat:document.getElementById('f-mcat').value, status:'open',
      date:new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),
      photo:mphoto, notes:mnodesEl?mnodesEl.value:'',
      contractor:mcontEl?mcontEl.value:''
    });
  }
  saveState();
  closeModal();
  render();
}
