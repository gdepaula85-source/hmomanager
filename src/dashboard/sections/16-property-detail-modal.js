// ── PROPERTY DETAIL MODAL ─────────────────────────────────────────────────────
async function openTenantDetail(id){
  var t=state.tenants.find(function(x){return x.id===id;});
  if(!t) return;
  state.tenantDetailTab=state.tenantDetailTab||'profile';
  var tab=state.tenantDetailTab;
  // Only build payment history when the History tab is actually open —
  // state.payments can have 500+ rows in a large portfolio and iterating it
  // on every tab switch made switching feel sluggish.
  var hist = [];
  if (tab === 'history') {
    hist = (t.paymentHistory||[]).slice();
    (state.payments||[]).forEach(function(p){
      if(p.tenant===t.name && p.status==='paid') {
        var already = hist.some(function(h){
          return h.date===p.paidDate && h.amount===p.amount;
        });
        if(!already) hist.push({
          amount: p.amount,
          date: p.paidDate||p.date||'',
          method: p.method||'bank',
          status: 'paid',
          _partial: p._partial||false,
          _shortfall: p._shortfall||0
        });
      }
    });
    hist.sort(function(a,b){
      return new Date(b.date.split(' ').reverse().join(' ')||0) - new Date(a.date.split(' ').reverse().join(' ')||0);
    });
  }

  // Extract photo URLs from notes (supports both emoji and plain markers)
  var _idPhotoUrl = '', _selfieUrl = '';
  if (t.notes) {
    var _idMatch = t.notes.match(/(?:\[ID_PHOTO\]|📄 ID): (https?:\/\/\S+)/);
    var _selfieMatch = t.notes.match(/(?:\[SELFIE\]|🤳 Selfie): (https?:\/\/\S+)/);
    if (_idMatch) _idPhotoUrl = _idMatch[1];
    if (_selfieMatch) _selfieUrl = _selfieMatch[1];
  }
  var isPending = t.status === 'pending_review';

  var profileTab = '';

  // Pending review banner + photos
  if (isPending) {
    profileTab += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:10px;padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:18px">⏳</span>'
      + '<div><div style="font-size:13px;font-weight:700;color:var(--amber)">Pending Review</div>'
      + '<div style="font-size:11px;color:var(--muted)">This tenant applied via the onboarding form. Review their details and assign a property.</div></div></div>';
  }

  // Photos section — show existing + upload buttons
  profileTab += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';
  // Selfie
  profileTab += '<div style="text-align:center">';
  profileTab += '<div style="font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase;margin-bottom:4px">Selfie</div>';
  if (_selfieUrl) {
    profileTab += '<img src="' + _selfieUrl + '" style="width:100%;max-height:130px;object-fit:cover;border-radius:10px;border:1px solid var(--border);margin-bottom:6px" onerror="this.style.display=\'none\'">';
  }
  profileTab += '<label style="display:flex;align-items:center;justify-content:center;gap:4px;padding:7px;border:2px dashed var(--border);border-radius:8px;cursor:pointer;font-size:10px;color:var(--muted);font-weight:600;background:var(--bg)">'
    + '<input type="file" accept="image/*" capture="user" style="display:none" onchange="uploadTenantPhoto(\''+id+'\',\'selfie\',this)">'
    + (_selfieUrl ? 'Replace' : 'Upload Selfie')
    + '</label></div>';
  // ID Document
  profileTab += '<div style="text-align:center">';
  profileTab += '<div style="font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase;margin-bottom:4px">ID Document</div>';
  if (_idPhotoUrl) {
    profileTab += '<img src="' + _idPhotoUrl + '" style="width:100%;max-height:130px;object-fit:cover;border-radius:10px;border:1px solid var(--border);margin-bottom:6px" onerror="this.style.display=\'none\'">';
  }
  profileTab += '<label style="display:flex;align-items:center;justify-content:center;gap:4px;padding:7px;border:2px dashed var(--border);border-radius:8px;cursor:pointer;font-size:10px;color:var(--muted);font-weight:600;background:var(--bg)">'
    + '<input type="file" accept="image/*,.pdf" style="display:none" onchange="uploadTenantPhoto(\''+id+'\',\'id-document\',this)">'
    + (_idPhotoUrl ? 'Replace' : 'Upload ID')
    + '</label></div>';
  profileTab += '</div>';

  profileTab += '<div class="field"><label class="field-label">Full Name</label><input class="inp" id="td-name" value="'+esc(t.name)+'"></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="td-email" type="email" value="'+esc(t.email||'')+'"></div>'
    +'<div class="field"><label class="field-label">📱 WhatsApp</label><input class="inp" id="td-wa" type="tel" value="'+esc(t.whatsapp||'')+'" placeholder="e.g. +44 7700 900000"><div style="font-size:11px;color:var(--muted);margin-top:4px">Include country code so messages deliver. UK <strong>+44</strong>, Portugal <strong>+351</strong>, Brazil <strong>+55</strong>.</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Check-in Date</label><input class="inp" id="td-movein" type="date" value="'+(t.startDate||t.moveIn||'')+'"></div>'
    +'<div class="field"><label class="field-label">Status</label><select class="inp" id="td-status"><option value="pending_review" '+(t.status==='pending_review'?'selected':'')+'>Pending Review</option><option value="active" '+(t.status==='active'?'selected':'')+'>Active</option><option value="notice_given" '+(t.status==='notice_given'?'selected':'')+'>On Notice</option><option value="inactive" '+(t.status==='inactive'?'selected':'')+'>Moved Out</option></select></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:0">'
    +'<div class="field"><label class="field-label">Date of Birth</label><input class="inp" id="td-dob" type="date" value="'+esc(t.dob||'')+'"></div>'
    +'<div class="field"><label class="field-label">Nationality</label><input class="inp" id="td-nationality" value="'+esc(t.nationality||'')+'" placeholder="e.g. British"></div>'
    +'</div>';

  // Property/Room assignment for pending tenants — only show properties with
  // at least one vacant room (or whole-let properties with no active tenant),
  // and only the vacant rooms inside the chosen property. Prevents an admin
  // from accidentally double-booking an occupied room when approving an
  // onboarding application.
  if (isPending || !t.property) {
    var _availProps = (state.properties || []).filter(isPropertyActive).filter(function(p){
      // Always include the property the tenant is currently linked to (so the
      // current selection stays valid even if the property has just filled up).
      if (t.property && p.name === t.property) return true;
      return typeof propertyHasVacancyForNewTenant === 'function'
        ? propertyHasVacancyForNewTenant(p)
        : true;
    });
    var _allActive = state.properties.filter(isPropertyActive).length;
    var _vacantCount = _availProps.length - (t.property ? 1 : 0);
    profileTab += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px">'
      + '<div class="field"><label class="field-label">Assign Property</label><select class="inp" id="td-prop" onchange="setPendingTenantProperty(\''+id+'\',this.value)">'
      + '<option value="">— Select —</option>'
      + _availProps.map(function(p) {
          var vacantRooms = (p.roomList || []).filter(function(r){return String(r.status||'').toLowerCase()!=='occupied';}).length;
          var label = p.name + ((p.lettingType||'hmo')==='whole'
            ? ((p.occupied>0)?' (whole let — currently occupied)':' (whole let — vacant)')
            : (' · ' + vacantRooms + ' vacant'));
          return '<option value="' + p.name + '" ' + (t.property === p.name ? 'selected' : '') + '>' + label + '</option>';
        }).join('')
      + '</select>'
      + (_vacantCount === 0 && !t.property
          ? '<div style="font-size:11px;color:var(--amber-700);margin-top:4px">No properties with vacant rooms — add a property or free a room first.</div>'
          : '<div style="font-size:11px;color:var(--gray-500);margin-top:4px">Showing ' + (_vacantCount + (t.property?1:0)) + ' of ' + _allActive + ' properties (vacancies only).</div>')
      + '</div>'
      + '<div class="field"><label class="field-label">Assign Room</label><select class="inp" id="td-room" onchange="syncPendingRoomPrice(this)">'
      + '<option value="">— Select —</option>'
      + (function() {
          var prop = _availProps.find(function(p) { return p.name === t.property; });
          if (!prop) return '<option value="" disabled>(select a property first)</option>';
          // Whole-let — single virtual "room"
          if ((prop.lettingType||'hmo') === 'whole') {
            var wholePrice = (prop.roomList && prop.roomList[0] && prop.roomList[0].price) || prop.rent || 0;
            return '<option value="1" data-price="'+wholePrice+'" '+(String(t.room||'1')==='1'?'selected':'')+'>Whole property</option>';
          }
          if (!prop.roomList || !prop.roomList.length) return '<option value="" disabled>(no rooms set up on this property)</option>';
          var rooms = prop.roomList.filter(function(r) {
            // Always show the room currently assigned (even if it shows as occupied — they ARE the occupant).
            if (t.room && String(r.n) === String(t.room)) return true;
            return String(r.status||'').toLowerCase() !== 'occupied';
          });
          if (!rooms.length) return '<option value="" disabled>(no vacant rooms in this property)</option>';
          return rooms.map(function(r) {
            return '<option value="' + r.n + '" data-price="' + (r.price||0) + '" ' + (String(t.room) === String(r.n) ? 'selected' : '') + '>Room ' + r.n + ' (' + (r.type || 'Single') + ') £' + (r.price||0) + '</option>';
          }).join('');
        })()
      + '</select></div></div>';

    // Room Price + Deposit (pending-only). Pre-filled from the currently
    // selected room's price; editable so the manager can override the room's
    // listed price for this specific tenancy. Wired to the room dropdown via
    // syncPendingRoomPrice — picking a different room auto-fills the price.
    var _selProp = _availProps.find(function(p){ return p.name === t.property; });
    var _selRoom = _selProp && _selProp.roomList
      ? _selProp.roomList.find(function(r){ return String(r.n) === String(t.room); })
      : null;
    var _seedPrice = (t.rent && +t.rent > 0) ? +t.rent : (_selRoom ? (+_selRoom.price || 0) : 0);
    var _freqLbl = t.freq === 'monthly' ? '/mo' : '/wk';
    profileTab += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px">'
      + '<div class="field"><label class="field-label">Room Price (£' + _freqLbl + ')</label>'
      + '<input class="inp" id="td-pending-rent" type="number" min="0" step="1" value="' + _seedPrice + '">'
      + '<div style="font-size:11px;color:var(--gray-500);margin-top:4px">Overrides the room\'s listed price for this tenancy.</div>'
      + '</div>'
      + '<div class="field"><label class="field-label">Deposit (£)</label>'
      + '<input class="inp" id="td-pending-deposit" type="number" min="0" step="1" value="' + (+t.deposit || 0) + '">'
      + '<div style="font-size:11px;color:var(--gray-500);margin-top:4px">Held before move-in.</div>'
      + '</div>'
      + '</div>';
  }

var financialsTab = (function(){
    var isMonthly = t.freq === 'monthly';
    var payDomOpts = Array.from({length:28}, function(_,i){
      var s=i+1;
      var sfx=[1,21].includes(s)?'st':[2,22].includes(s)?'nd':[3,23].includes(s)?'rd':'th';
      return '<option value="'+s+'" '+(t.payDayOfMonth===s?'selected':'')+'>'+s+sfx+' of month</option>';
    }).join('');
    var payDayOpts = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(function(d){
      return '<option '+(t.payDay===d?'selected':'')+'>'+d+'</option>';
    }).join('');

    return ''
      // KPI cards
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
        +'<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:14px;text-align:center">'
          +'<div style="font-size:22px;font-weight:800;color:var(--green);font-family:monospace">'+fmt(t.rent)+'</div>'
          +'<div style="font-size:11px;color:var(--muted)">per '+(isMonthly?'month':'week')+'</div>'
        +'</div>'
        +(function(){
          // Live arrears: overdue payments + legacy t.arrears, single source of truth shared with the tenant card pill.
          var _liveArr = typeof getTenantArrearsAmount === 'function' ? getTenantArrearsAmount(t.name) : (+t.arrears||0);
          var _isArr = _liveArr > 0;
          return '<div style="background:'+(_isArr?'var(--red-light)':'var(--bg)')+';border:1px solid '+(_isArr?'#FECDD3':'var(--border)')+';border-radius:10px;padding:14px;text-align:center">'
            +'<div style="font-size:22px;font-weight:800;color:'+(_isArr?'var(--red)':'var(--muted)')+';font-family:monospace">'+fmt(_liveArr)+'</div>'
            +'<div style="font-size:11px;color:var(--muted)">arrears</div>'
          +'</div>';
        })()
      +'</div>'
      // Rent & arrears
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
        +'<div class="field"><label class="field-label">'+(isMonthly?'Monthly':'Weekly')+' Rent (£)</label><input class="inp" id="td-rent" type="number" value="'+(t.rent||0)+'"></div>'
        +'<div class="field"><label class="field-label">Arrears (£)</label><input class="inp" id="td-arrears" type="number" value="'+(t.arrears||0)+'"></div>'
      +'</div>'
      // Deposit
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
        +'<div class="field"><label class="field-label">Deposit (£)</label><input class="inp" id="td-deposit" type="number" value="'+(t.deposit||0)+'"></div>'
        +'<div class="field"><label class="field-label">Deposit Status</label>'
          +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
+'<div class="field"><label class="field-label">Deposit Scheme</label>'
+'<select class="inp" id="td-depositScheme">'
+['DPS','MyDeposits','TDS','None'].map(function(s){return '<option value="'+s+'" '+(t.depositScheme===s?'selected':'')+'>'+s+'</option>';}).join('')
+'</select></div>'
+'<div class="field"><label class="field-label">Deposit Reference</label>'
+'<input class="inp" id="td-depositRef" value="'+(t.depositRef||'').replace(/"/g,'&quot;')+'" placeholder="e.g. DPS-12345678">'
+'</div></div>'
+'<select class="inp" id="td-depositStatus">'
            +'<option value="held" '+(t.depositStatus==='held'?'selected':'')+'>Held</option>'
            +'<option value="returned" '+(t.depositStatus==='returned'?'selected':'')+'>Returned</option>'
          +'</select>'
        +'</div>'
      +'</div>'
      // Property & Room — for inactive tenants show previous tenancy history instead
      +(t.status === 'inactive'
        ? (function(){
            var prevs = t.previousTenancies || [];
            if(!prevs.length && t.property) {
              // Legacy: property wasn't cleared yet, show it as a previous tenancy
              prevs = [{property: t.property, room: t.room, moveIn: t.startDate||t.moveIn, moveOut: t.moveOutDate, rent: t.rent, freq: t.freq}];
            }
            if(!prevs.length) return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;text-align:center;color:var(--dim);font-size:12px">No tenancy history recorded</div>';
            return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">'
              +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">📋 Tenancy History</div>'
              + prevs.slice().reverse().map(function(pt, idx) {
                  var moveIn  = pt.moveIn  ? new Date(pt.moveIn).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
                  var moveOut = pt.moveOut ? new Date(pt.moveOut).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
                  var isMonthly = pt.freq === 'monthly';
                  return '<div style="padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:9px;margin-bottom:8px">'
                    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
                    +'<div style="font-size:13px;font-weight:700">'+esc(pt.property||'Unknown property')+'</div>'
                    +(idx===0?'<span style="font-size:10px;padding:2px 7px;border-radius:5px;background:var(--border);color:var(--muted);font-weight:600">Most recent</span>':'')
                    +'</div>'
                    +'<div style="font-size:12px;color:var(--muted)">'
                    +(pt.room?'Room '+pt.room+' · ':'')
                    +'£'+(pt.rent||0)+'/'+(isMonthly?'mo':'wk')
                    +'</div>'
                    +'<div style="font-size:11px;color:var(--dim);margin-top:4px">'+moveIn+' → '+moveOut+'</div>'
                    +'</div>';
                }).join('')
              +'</div>';
          })()
        // Active/notice tenants: show the editable property & room section
        : '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">'
          +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">🏠 Property & Room</div>'
          +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
            +'<div class="field" style="margin:0"><label class="field-label">Property</label>'
              +'<select class="inp" id="td-prop">'+state.properties.filter(function(p){return isPropertyActive(p)||p.name===t.property;}).map(function(p){return '<option value="'+esc(p.name)+'" '+(t.property===p.name?'selected':'')+'>'+esc(p.name)+'</option>';}).join('')+'</select>'
            +'</div>'
            +(function(){
              var rp=state.properties.find(function(x){return x.name===t.property;});
              if(!rp||!rp.roomList) return '<div class="field" style="margin:0"><label class="field-label">Room No.</label><input class="inp" id="td-room" type="number" value="'+(t.room||1)+'"></div>';
              var opts=rp.roomList.map(function(r){
                var linked=state.tenants.find(function(tt){return tt.property===rp.name&&roomNumsEqual(tt.room,r.n)&&tt.status!=='inactive'&&tt.id!==t.id;});
                var isCurr=r.n===t.room;
                var dis=(r.status==='unavailable'||(linked&&!isCurr))?'disabled':'';
                var lbl='Rm '+r.n+' ('+(r.type||'Room')+') £'+r.price+'/wk'+(isCurr?' ✓':'')+(linked&&!isCurr?' (taken)':'');
                return '<option value="'+r.n+'" '+(isCurr?'selected':'')+' '+dis+'>'+lbl+'</option>';
              }).join('');
              return '<div class="field" style="margin:0"><label class="field-label">Room</label><select class="inp" id="td-room">'+opts+'</select></div>';
            })()
          +'</div>'
        +'</div>'
        +(function(){
            var rp2=state.properties.find(function(x){return x.name===t.property;});
            var rm2=rp2&&rp2.roomList?rp2.roomList.find(function(r){return r.n===t.room;}):null;
            var curType=rm2?rm2.type:(t.roomType||'Single');
            return '<div class="field" style="margin-bottom:12px"><label class="field-label">Room Type</label>'
              +'<select class="inp" id="td-roomtype">'
              +['Single','Double','Suite','Studio','Whole House'].map(function(ty){
                var icons={'Single':'🛏️ ','Double':'🛏️🛏️ ','Suite':'✨ ','Studio':'🏠 ','Whole House':'🏡 '};
                return '<option value="'+ty+'" '+(curType===ty?'selected':'')+'>'+icons[ty]+ty+'</option>';
              }).join('')
              +'</select></div>';
          })()
      )
      // Payment Collection
      +'<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">'
        +'<div style="font-size:11px;font-weight:700;color:var(--accent-dark);margin-bottom:12px">📅 PAYMENT COLLECTION</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'
          +'<div class="field" style="margin:0"><label class="field-label">Payment Method</label>'
            +'<select class="inp" id="td-method">'
              +'<option value="bank" '+(t.method==='bank'?'selected':'')+'>Bank Transfer</option>'
              +'<option value="cash" '+(t.method==='cash'?'selected':'')+'>Cash</option>'
            +'</select>'
          +'</div>'
          +'<div class="field" style="margin:0"><label class="field-label">Frequency</label>'
            +'<select class="inp" id="td-freq" onchange="updateTenantDueDaySection()">'
              +'<option value="weekly" '+(t.freq==='weekly'?'selected':'')+'>Weekly</option>'
              +'<option value="monthly" '+(t.freq==='monthly'?'selected':'')+'>Monthly</option>'
            +'</select>'
          +'</div>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
          +'<div id="td-due-day-section">'
            +(isMonthly
              ? '<div class="field" style="margin:0"><label class="field-label">Due Date (monthly)</label><select class="inp" id="td-paydom">'+payDomOpts+'</select></div>'
              : '<div class="field" style="margin:0"><label class="field-label">Due Day (weekly)</label><select class="inp" id="td-payday">'+payDayOpts+'</select></div>'
            )
          +'</div>'
        +'</div>'
      +'</div>';
  })();

var histTab='<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:700">Payment History</div><div style="font-size:11px;color:var(--muted)">'+hist.length+' records</div></div>'
    +'<div style="display:flex;flex-direction:column;gap:6px">'
    +hist.map(function(h){return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px"><div><div style="font-size:13px;font-weight:600">'+fmt(h.amount)+'</div><div style="font-size:11px;color:var(--muted)">'+h.date+'</div></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--muted)">'+(h.method==='bank'?'🏦 Bank':'💵 Cash')+'</span><span style="font-size:11px;font-weight:700;color:'+(h.status==='paid'?'var(--green)':'var(--red)')+'">'+h.status+'</span></div></div>';}).join('')
    +'</div>';

  var waBase=t.whatsapp?'https://wa.me/'+String(t.whatsapp||'').replace(/\D/g,'')+'?text=':'';
  var firstName=t.name.split(' ')[0];
  var actionsTab='<div style="display:flex;flex-direction:column;gap:12px">';
  if(waBase){
    actionsTab+='<div style="background:var(--wa-light);border:1px solid #BBF7D0;border-radius:12px;padding:16px">'
      +'<div style="font-size:13px;font-weight:700;color:var(--wa);margin-bottom:10px">💬 WhatsApp Messages</div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">'
      +'<a href="'+waBase+encodeURIComponent(_waSanitize('Hi '+firstName+', your rent of £'+t.rent+' is due. Please arrange payment. Thank you.'))+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #BBF7D0;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">💬</span><div><div style="font-size:13px;font-weight:600">Rent Reminder</div><div style="font-size:11px;color:var(--muted)">Gentle reminder about upcoming rent</div></div></a>'
      +(t.arrears>0?'<a href="'+waBase+encodeURIComponent(_waSanitize('Hi '+firstName+', you have arrears of £'+t.arrears+'. Please contact us urgently.'))+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #FECDD3;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">⚠️</span><div><div style="font-size:13px;font-weight:600">Chase Arrears</div><div style="font-size:11px;color:var(--muted)">£'+t.arrears+' outstanding</div></div></a>':'')
      +'<a href="'+waBase.split('?')[0]+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #BBF7D0;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">💬</span><div><div style="font-size:13px;font-weight:600">Open Chat</div><div style="font-size:11px;color:var(--muted)">Open WhatsApp directly</div></div></a>'
      +'</div></div>';
  }
  actionsTab+='<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:10px">📄 Legal Documents</div>'
    + (function(){
        // Signing status badge — shows when a signature exists or a token is outstanding.
        var sigStatus = '';
        if (t.signature) {
          var when = '';
          try { when = new Date(t.signatureSavedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); } catch(e){}
          // If the signing flow recorded which agreement was sent, link straight
          // to a re-render of that whole agreement (with both sigs + dates).
          var hasFullAgreement = !!t.signedAgreementType;
          var actionFn = hasFullAgreement ? 'viewSignedAgreement' : '_viewTenantSignature';
          var actionLabel = hasFullAgreement ? 'View agreement' : 'View';
          var pdfBtn = t.signedAgreementPdfPath
            ? ' <button onclick="event.stopPropagation();downloadSignedAgreementPdf(\''+t.id+'\')" style="background:#fff;border:1px solid #A7F3D0;color:#065F46;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit" title="Download signed PDF">⬇ PDF</button>'
            : '';
          sigStatus = '<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;margin-bottom:10px;font-size:12px;color:#065F46">'
            + '<span>✓</span><strong>Signed</strong>'
            + (when ? ' <span style="color:#059669">on ' + when + '</span>' : '')
            + ' <span style="margin-left:auto;display:inline-flex;gap:6px">'
            +   '<button onclick="event.stopPropagation();' + actionFn + '(\''+t.id+'\')" style="background:#fff;border:1px solid #A7F3D0;color:#065F46;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">' + actionLabel + '</button>'
            +   pdfBtn
            + '</span>'
            + '</div>';
        }
        return sigStatus;
      })()
    +'<button onclick="openContractPicker(\''+t.id+'\')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#fff;border:1.5px solid var(--blue);border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%">'
      +'<span style="font-size:20px">📄</span>'
      +'<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--blue)">Generate agreement</div>'
      +'<div style="font-size:11px;color:var(--muted)">AST · Room Letting · Company Let · Lodger · Excluded Licence · Send for remote signing · Renewal</div></div>'
      +'<span style="color:var(--blue);font-size:18px">›</span>'
    +'</button>'
    +'</div>';

  // Tenant portal section — passwords are managed server-side via /api/tenant-portal/set-password
  // ── Tenant Review Section ──
  var _reviewData = {};
  try { _reviewData = JSON.parse(localStorage.getItem('pm_tenant_review_'+id) || '{}'); } catch(e){}
  var _rating = _reviewData.rating || 0;
  var _reviewNotes = (_reviewData.notes || '').replace(/"/g, '&quot;');
  actionsTab += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">'
    + '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">⭐ Tenant Review</div>'
    + '<div style="margin-bottom:10px"><label class="field-label">Rating</label>'
    + '<div style="display:flex;gap:4px" id="td-rating-stars">'
    + [1,2,3,4,5].map(function(s){ return '<span onclick="setTenantRating(\''+id+'\','+s+')" style="font-size:24px;cursor:pointer;opacity:'+(s<=_rating?1:0.25)+'">'+(s<=_rating?'★':'☆')+'</span>'; }).join('')
    + '</div></div>'
    + '<div class="field"><label class="field-label">Review Notes</label>'
    + '<textarea class="inp" id="td-review-notes" rows="2" placeholder="Reliability, cleanliness, payment history..." style="resize:vertical" onchange="saveTenantReview(\''+id+'\')">' + (_reviewData.notes || '') + '</textarea></div>'
    + '</div>';

  // Ensure portal username exists
  ensurePortalCredentials(t);
  var hasPortal = true; // All tenants can have portal access
  var portalUrl = window.location.href.replace('index.html','').replace(/[^/]*$/, '') + 'tenant-portal.html';
  // _waEmoji() \u2014 emojis on mobile, plain text on desktop browsers.
  var portalWaMsg = encodeURIComponent(_waSanitize(
    'Hi '+t.name.split(' ')[0]+', your tenant portal is now active!\n\n'
    +_waEmoji('\uD83C\uDF10 ')+'*Tenant Portal Link:*\n'+portalUrl+'\n\n'
    +_waEmoji('\uD83D\uDC64 ')+'*Username:* '+getPortalUsername(t)+'\n'
    +_waEmoji('\uD83D\uDD11 ')+'*Password:* '+getPortalPassword(t)+'\n\n'
    +'You can view your payments, report maintenance issues, upload documents and more.\n\n'
    +_waEmoji('\uD83C\uDFE0 ')+'landlordapp.io'
  ));
  var waLink = t.whatsapp ? 'https://wa.me/'+t.whatsapp+'?text='+portalWaMsg : '';
  actionsTab+='<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px">🌐 Tenant Portal</div>'
        +'<div style="background:#fff;border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:10px">'    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Login Details</div>'    +'<div style="font-size:12px;margin-bottom:4px">👤 <strong>Username:</strong> <span style="font-family:monospace;background:var(--bg);padding:2px 7px;border-radius:4px">'+getPortalUsername(t)+'</span></div>'    +'<div style="font-size:12px;margin-bottom:4px">🔑 <strong>Password:</strong> <span style="font-family:monospace;background:var(--bg);padding:2px 7px;border-radius:4px">'+getPortalPassword(t)+'</span> <button onclick="resetPortalPassword(\''+id+'\')" style="font-size:10px;padding:2px 8px;border-radius:5px;border:1px solid var(--border);background:var(--bg);cursor:pointer;font-family:inherit;margin-left:6px">↻ New</button></div>'    +(t.email?'<div style="font-size:12px;margin-bottom:4px">📧 <strong>Email:</strong> '+t.email+'</div>':'')    +'<div style="font-size:12px">🔗 <strong>URL:</strong> <a href="'+portalUrl+'" target="_blank" style="color:var(--blue)">Open Portal ↗</a></div>'    +'</div>'
    +'<div style="display:flex;gap:8px">'
    +(t.whatsapp
      ? '<a href="'+waLink+'" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:9px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;text-decoration:none">💬 Share via WhatsApp</a>'
      : '<button disabled style="flex:1;padding:10px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--dim);font-size:13px;font-weight:600;cursor:not-allowed;font-family:inherit">💬 Add WhatsApp to share</button>')
    +'<a href="'+portalUrl+'" target="_blank" style="padding:10px 12px;border-radius:9px;border:1px solid #BFDBFE;background:var(--blue-light);color:var(--blue);font-size:12px;font-weight:700;text-decoration:none;display:flex;align-items:center">Open ↗</a>'
    +'</div></div>';

  // Give Notice section
  var noticeColor = t.status==='notice_given'?'var(--amber)':'var(--text)';
  var noticeBg    = t.status==='notice_given'?'var(--amber-light)':'var(--bg)';
  var noticeBorder= t.status==='notice_given'?'#FDE68A':'var(--border)';

  // Countdown calculation
  var countdownHtml = '';
  if(t.status==='notice_given' && t.moveOutDate){
    var daysLeft = Math.ceil((new Date(t.moveOutDate)-TODAY)/86400000);
    var countColor = daysLeft<=7?'var(--red)':daysLeft<=14?'var(--amber)':'var(--green)';
    countdownHtml = '<div style="margin-top:12px;padding:12px;background:#fff;border-radius:9px;border:1px solid '+noticeBorder+';text-align:center">'
      +'<div style="font-size:28px;font-weight:800;color:'+countColor+';font-family:monospace">'+(daysLeft>0?daysLeft+'d':'Today')+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+(daysLeft>0?'days until check-out':'Move-out day')+'</div>'
      +'<div style="font-size:11px;font-weight:600;color:var(--muted);margin-top:4px">Move-out: '+new Date(t.moveOutDate).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})+'</div>'
      +'</div>';
  }

  actionsTab+='<div style="background:'+noticeBg+';border:1px solid '+noticeBorder+';border-radius:12px;padding:16px">'
    +'<div style="font-size:13px;font-weight:700;color:'+noticeColor+';margin-bottom:10px">'
    +(t.status==='notice_given'?'⚠️ On Notice':'📋 Give Notice')
    +'</div>'
    +countdownHtml
    +(t.status==='notice_given'
      ? '<button onclick="cancelTenantNotice(\''+t.id+'\')" style="margin-top:10px;width:100%;padding:9px;border-radius:9px;border:1px solid #FDE68A;background:#fff;color:var(--amber);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel Notice</button>'
      : '<div style="margin-top:10px">'
        +'<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Move-out Date</label>'
        +'<input type="date" id="notice-moveout-'+t.id+'" class="inp" style="margin:6px 0 10px" min="'+new Date('2026-03-21').toISOString().split('T')[0]+'">'
        +'<button onclick="giveTenantNotice(\''+t.id+'\')" style="width:100%;padding:9px;border-radius:9px;border:none;background:var(--amber);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Give Notice</button>'
        +'</div>'
    )
    +'</div>';
  // Build available rooms for "move to room" section
  var availRooms = [];
  state.properties.forEach(function(ap){
    if(!isPropertyActive(ap)) return;
    (ap.roomList||[]).forEach(function(ar){
      if(ar.status==='vacant') availRooms.push({propName:ap.name,propId:ap.id,room:ar.n,type:ar.type||'Room',price:ar.price});
    });
  });
  var moveRoomHtml = availRooms.length===0
    ? '<div style="font-size:12px;color:var(--muted);padding:8px 0">No vacant rooms available</div>'
    : '<div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto">'
      +availRooms.map(function(vr){
        return '<button id="mvr_'+t.id+'_'+vr.propId+'_'+vr.room+'" onclick="doMoveRoom(this)" data-tid="'+t.id+'" data-pid="'+vr.propId+'" data-pname="'+encodeURIComponent(vr.propName)+'" data-room="'+vr.room+'" data-price="'+vr.price+'" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:#fff;border:1px solid var(--border);border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%;margin-bottom:3px"><div><div style=\"font-size:12px;font-weight:600\">'+vr.propName+'</div><div style=\"font-size:11px;color:var(--muted)\">Room '+vr.room+' · '+vr.type+'</div></div><span style=\"font-size:12px;font-weight:700;color:var(--accent-dark)\">£'+vr.price+'/wk</span></button>';
      }).join('')+'</div>';

  actionsTab+='<div style="background:#F0FDF4;border:1px solid #A7F3D0;border-radius:12px;padding:16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px">🔄 Move to Different Room</div>'
    +moveRoomHtml
    +'</div>';

  actionsTab+='<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:10px">🚪 Move Out</div>'
    +'<button onclick="moveTenantOut(\''+t.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #FECDD3;border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%"><span style="font-size:18px">🚪</span><div><div style="font-size:13px;font-weight:600;color:var(--red)">Mark as Moved Out</div><div style="font-size:11px;color:var(--muted)">Frees the room and archives tenant</div></div></button>'
    +'</div>';
  actionsTab+='</div>';

  // ── Vault Tab ──────────────────────────────────────────────────────────────
  var tVaultLocal = state.vault ? (state.vault[t.id]||[]) : [];
  // PERF: only hit Supabase Storage when the user is actually viewing the
  // vault tab. Without this gate, every tab switch (Profile / Rent / Actions)
  // also fired a list() round-trip — which made the modal sluggish to open.
  // Result on the other tabs is a tiny stale window where state.vault[t.id]
  // shows what loadState pulled; switch to vault and the live list runs once.
  // Per-tenant prefix on the doc id (was f.name only) prevents cross-tenant
  // ID collisions that triggered "ON CONFLICT cannot affect row a second
  // time" on saveState upsert.
  var tVaultSupa = [];
  if (tab === 'vault') {
    try {
      var tvr = await supa.storage.from('tenant-docs').list('tenants/'+String(t.id),{limit:50});
      if(!tvr.error && Array.isArray(tvr.data)) {
        tvr.data.filter(function(f){return f.name&&!f.name.startsWith('.');}).forEach(function(f){
          var path='tenants/'+String(t.id)+'/'+f.name;
          var pub=supa.storage.from('tenant-docs').getPublicUrl(path);
          var url=pub.data?pub.data.publicUrl:null;
          var loc=tVaultLocal.find(function(d){return d.storagePath===path;});
          if(loc){if(url&&!loc.dataUrl)loc.dataUrl=url;return;}
          var fsz=f.metadata&&f.metadata.size?(f.metadata.size>1048576?(f.metadata.size/1048576).toFixed(1)+'MB':Math.round(f.metadata.size/1024)+'KB'):'';
          var fdt=f.created_at?new Date(f.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'';
          var parsed=parseTenantVaultStorageFileName(f.name);
          // Tenant-scoped id avoids collisions across tenants who happen to
          // upload files with the same name.
          var stableId = 't:' + String(t.id) + ':' + f.name;
          tVaultSupa.push({id:stableId,name:f.name,vaultDisplayName:parsed.vaultDisplayName,type:parsed.docType,size:fsz,uploadedAt:fdt,dataUrl:url,storagePath:path,_fromStorage:true});
        });
      }
    } catch(e){console.warn('Tenant docs list err:',e.message);}
    if(tVaultSupa.length){if(!state.vault)state.vault={};if(!state.vault[t.id])state.vault[t.id]=[];tVaultSupa.forEach(function(sd){if(!state.vault[t.id].find(function(d){return d.storagePath===sd.storagePath;}))state.vault[t.id].push(sd);});}
  }
  var tVault = tVaultLocal.concat(tVaultSupa);
  var TENANT_DOC_TYPES = ['Right to Rent','Passport / ID','Proof of Address','Employment Reference','Landlord Reference','Tenancy Application','Bank Statement','NI Number','Other'];
  var vaultRows = tVault.map(function(doc){
    var p = parseTenantVaultStorageFileName(doc.name);
    var title = doc.vaultDisplayName || p.vaultDisplayName || doc.name;
    var typeLabel = (doc.type && doc.type !== 'Document') ? doc.type : (p.docType !== 'Document' ? p.docType : 'Document');
    var showTypeChip = typeLabel && typeLabel !== 'Document' && title !== typeLabel;
    var icon = doc.name&&doc.name.match(/\.pdf$/i)?'📄':doc.name&&doc.name.match(/\.(jpg|jpeg|png)$/i)?'🖼️':'📋';
    var typeColors = {'Right to Rent':'#DCFCE7','Passport / ID':'#EFF6FF','Proof of Address':'#FEF9C3','Employment Reference':'#F3E8FF','Other':'#F1F5F9'};
    var bg = typeColors[typeLabel]||'#F1F5F9';
    var textColor = {'Right to Rent':'#166534','Passport / ID':'#1E40AF','Proof of Address':'#854D0E','Employment Reference':'#6B21A8','Other':'#475569'}[typeLabel]||'#475569';
    return '<div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 13px;margin-bottom:7px">'
      +'<div style="width:36px;height:36px;border-radius:8px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'+icon+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+title+'</div>'
      +'<div style="display:flex;align-items:center;gap:6px;margin-top:2px">'
      +(showTypeChip?'<span style="font-size:10px;font-weight:700;color:'+textColor+';background:'+bg+';padding:1px 7px;border-radius:6px">'+typeLabel+'</span>':'')
      +'<span style="font-size:10px;color:var(--muted)">'+doc.size+' · '+doc.uploadedAt+'</span>'
      +'</div></div>'
      +'<div style="display:flex;gap:5px;flex-shrink:0">'
      // Preview + download always shown — handlers lazy-load doc.dataUrl on
      // click since loadState skips data_url to keep the boot fetch lean.
      +'<button onclick="previewDoc(\''+doc.id+'\')" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--accent-dark);cursor:pointer;font-family:inherit">👁 Preview</button>'
      +'<button onclick="downloadDoc(\''+doc.id+'\')" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--blue);cursor:pointer;font-family:inherit">↓</button>'
      +'<button data-tid="'+t.id+'" data-did="'+doc.id+'" onclick="removeTenantDocBtn(this)" style="padding:5px 9px;border-radius:7px;border:1px solid #FECDD3;background:#FFF1F2;font-size:11px;font-weight:700;color:#E11D48;cursor:pointer;font-family:inherit">&#x2715;</button>'
      +'</div></div>';
  }).join('');

  var vaultTab = '<div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">'
    +'<div><div style="font-size:13px;font-weight:700">📁 Document Vault</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+tVault.length+' document'+(tVault.length===1?'':'s')+' stored</div></div>'
    +'</div>'
    +'<select id="vault-doc-type-'+t.id+'" class="inp" style="margin-bottom:10px;font-size:13px">'
    +TENANT_DOC_TYPES.map(function(dt){return '<option>'+dt+'</option>';}).join('')
    +'</select>'
    +'<div style="margin-bottom:14px">'
    +'<input type="file" id="tvault-input-'+t.id+'" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple style="display:none" onchange="uploadTenantDoc(\''+t.id+'\',this)">'
    +'<button onclick="document.getElementById(\'tvault-input-'+t.id+'\').click()" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;border:2px dashed var(--accent);background:var(--accent-light);cursor:pointer;width:100%;font-family:inherit;text-align:left">'
    +'<span style="font-size:22px">📎</span>'
    +'<div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">Upload Document</div>'
    +'<div style="font-size:11px;color:var(--muted)">PDF, JPG, PNG · max 10MB</div></div>'
    +'</button></div>'
    +(tVault.length===0?'<div style="text-align:center;padding:28px;color:var(--dim);font-size:13px">No documents uploaded yet</div>':vaultRows);

  var messagesTab = tab === 'messages'
    ? ((typeof renderTenantMessagesTab === 'function')
        ? renderTenantMessagesTab(t.id)
        : '<div style="padding:30px;text-align:center;color:var(--muted)">Communication module not loaded.</div>')
    : '';

  var tabContent=tab==='profile'?profileTab:tab==='financials'?financialsTab:tab==='history'?histTab:tab==='vault'?vaultTab:tab==='messages'?messagesTab:actionsTab;
  var tabs=['profile','financials','history','vault','messages','actions'];
  var tabLabels={profile:'Profile',financials:'Financials',history:'Payment History',vault:'📁 Docs',messages:'📨 Messages',actions:'Actions'};

  // Only re-render the full modal if it's not already open (avoids close/reopen flicker on tab switch)
  var existingModal = document.querySelector('#modal-container .modal[data-tenant-id="'+id+'"]');
  if(existingModal) {
    // Tab switch: just update body + tab highlights
    existingModal.querySelector('.modal-body').innerHTML = tabContent;
    existingModal.querySelectorAll('.td-tab-btn').forEach(function(btn){
      var tv = btn.dataset.tab;
      btn.style.borderBottomColor = tv===tab ? 'var(--accent)' : 'transparent';
      btn.style.fontWeight = tv===tab ? '700' : '500';
      btn.style.color = tv===tab ? 'var(--accent-dark)' : 'var(--muted)';
    });
    return;
  }

  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this){state.tenantDetailTab=null;closeModal()}">'
    +'<div class="modal" data-tenant-id="'+id+'" style="max-width:806px;width:min(806px,calc(100vw - 16px));height:min(90vh,910px);overflow:hidden;display:flex;flex-direction:column">'
    +'<div style="padding:16px 18px 0;border-bottom:1px solid var(--border);background:var(--bg)">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
    +'<div style="width:40px;height:40px;border-radius:12px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:var(--accent-dark);flex-shrink:0">'+t.name[0]+'</div>'
    +'<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800">'+esc(t.name)+'</div>'
    +'<div style="font-size:12px;color:var(--muted)">'
    +(t.status==='inactive'
      ? (t.previousTenancies&&t.previousTenancies.length
          ? 'Last: '+t.previousTenancies[t.previousTenancies.length-1].property+' · '
          : (t.property?t.property+' · ':''))
        +'<span style="color:var(--muted)">Moved out</span>'
      : (t.property?t.property+' · ':'')+(t.room?'Room '+t.room+' · ':'')
        +'<span style="color:'+(t.status==='active'?'var(--green)':'var(--amber)')+'">'+t.status.replace('_',' ')+'</span>'
    )
    +'</div></div>'
    +'<button class="modal-close" onclick="state.tenantDetailTab=null;closeModal()">×</button>'
    +'</div>'
    +'<div style="display:flex;gap:0;overflow-x:auto;scrollbar-width:none">'
    +tabs.map(function(tv){return '<button class="td-tab-btn" data-tab="'+tv+'" onclick="state.tenantDetailTab=\''+tv+'\';openTenantDetail(\''+id+'\')" style="padding:10px 14px;border:none;border-bottom:2px solid '+(tab===tv?'var(--accent)':'transparent')+';background:transparent;font-size:13px;font-weight:'+(tab===tv?700:500)+';color:'+(tab===tv?'var(--accent-dark)':'var(--muted)')+';cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .15s;margin-bottom:-1px">'+tabLabels[tv]+'</button>';}).join('')
    +'</div></div>'
    +'<div class="modal-body" style="overflow-y:auto;flex:1">'+tabContent+'</div>'
    +'<div class="modal-footer" style="flex-shrink:0">'
    +'<button onclick="state.tenantDetailTab=null;closeModal()" class="btn btn-secondary">Cancel</button>'
    +(t.status==='inactive'
      ?'<button data-tid="'+id+'" onclick="deleteTenantPermanent(this.dataset.tid)" class="btn btn-danger" style="margin-right:auto;order:-1">&#x1F5D1; Delete</button>'
      :'<button data-tid="'+id+'" onclick="archiveTenant(this.dataset.tid)" class="btn btn-secondary" style="margin-right:auto;order:-1">&#x1F4E6; Archive</button>')
    +'<button onclick="generateTenantProfilePDF(\''+id+'\')" class="btn btn-secondary" style="font-size:11px" title="Profile PDF (KYC / contact card)">&#x1F464; Profile</button>'
    +'<button onclick="generateTenantStatementPDF(\''+id+'\')" class="btn btn-secondary" style="font-size:11px" title="Financial statement — rent charged, payments, balance">&#x1F4C4; Statement</button>'
    +'<button onclick="shareTenantProfile(\''+id+'\')" class="btn btn-secondary" style="font-size:11px" title="Share via WhatsApp">&#x1F4AC; Share</button>'
    +'<button onclick="openSendMessageForTenant(\''+id+'\')" class="btn btn-secondary" style="font-size:11px" title="Send templated message via email or WhatsApp">&#x1F4E8; Send</button>'
    +(isPending
      ? '<button onclick="approveTenant(\''+id+'\')" class="btn btn-primary" style="background:var(--green)">&#x2705; Approve</button>'
      : '<button onclick="saveTenantDetail(\''+id+'\')" class="btn btn-primary">Save Changes</button>')
    +'</div></div></div>';
}

async function uploadTenantPhoto(tenantId, type, input) {
  var file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('File too large (max 5MB)', 'error'); return; }
  showToast('Uploading ' + type + '...', 'success');
  try {
    var ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    var path = 'tenants/' + tenantId + '/' + type + '.' + ext;
    await supa.storage.from('tenant-docs').upload(path, file, { upsert: true, cacheControl: '3600' });
    var pub = supa.storage.from('tenant-docs').getPublicUrl(path);
    var url = pub.data.publicUrl;

    // Update tenant notes with new URL
    var t = state.tenants.find(function(x) { return x.id === tenantId; });
    if (t) {
      var marker = type === 'selfie' ? '[SELFIE]' : '[ID_PHOTO]';
      var oldMarker = type === 'selfie' ? /(?:\[SELFIE\]|🤳 Selfie): https?:\/\/\S+/g : /(?:\[ID_PHOTO\]|📄 ID): https?:\/\/\S+/g;
      var notes = (t.notes || '').replace(oldMarker, '').trim();
      t.notes = notes + '\n' + marker + ': ' + url;
      saveState();
    }
    showToast(type + ' uploaded', 'success');
    openTenantDetail(tenantId);
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
  }
}

// Update the in-memory tenant property when the assignment dropdown changes,
// then re-open the detail modal so the room list refreshes for the newly
// selected property. Doesn't persist — the user still has to click Approve.
function setPendingTenantProperty(id, propName) {
  var t = state.tenants.find(function(x){ return String(x.id) === String(id); });
  if (!t) return;
  t.property = propName || '';
  t.room = null; // force re-pick of a room in the new property
  state.tenantDetailTab = 'profile';
  if (typeof openTenantDetail === 'function') openTenantDetail(id);
  else render();
}

// When the pending tenant's room dropdown changes, copy the chosen room's
// listed price into the Room Price input. Fires on each room pick so the
// price always reflects the currently-selected room; the manager can then
// edit the price field freely after picking the room to override for this
// specific tenancy.
function syncPendingRoomPrice(sel) {
  if (!sel) return;
  var rentEl = document.getElementById('td-pending-rent');
  if (!rentEl) return;
  var opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  var price = opt.getAttribute('data-price');
  if (price != null) rentEl.value = price;
}

async function approveTenant(id) {
  var t = state.tenants.find(function(x){ return String(x.id) === String(id); });
  if (!t) return;
  // Get assigned property/room from form
  var propEl = document.getElementById('td-prop');
  var roomEl = document.getElementById('td-room');
  var nameEl = document.getElementById('td-name');
  var emailEl = document.getElementById('td-email');
  var waEl = document.getElementById('td-wa');
  var moveinEl = document.getElementById('td-movein');

  if (nameEl) t.name = nameEl.value || t.name;
  if (emailEl) t.email = emailEl.value;
  if (waEl) t.whatsapp = waEl.value.trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (moveinEl) { t.startDate = moveinEl.value; t.moveIn = moveinEl.value; }
  if (propEl && propEl.value) t.property = propEl.value;
  if (roomEl && roomEl.value) t.room = +roomEl.value || roomEl.value;

  if (!t.property) { showToast('Please assign a property first', 'error'); return; }

  // Defensive check: refuse to approve into an already-occupied room (shouldn't
  // happen because the dropdown filters, but the user could have approved a
  // pending tenant in two browser tabs simultaneously).
  if (t.room) {
    var clash = state.tenants.find(function(other){
      return other && String(other.id) !== String(t.id)
        && other.status !== 'inactive' && other.status !== 'pending_review'
        && other.property === t.property
        && String(other.room) === String(t.room);
    });
    if (clash) {
      showToast('Room ' + t.room + ' at ' + t.property + ' is already occupied by ' + clash.name + '. Pick a different room.', 'error');
      return;
    }
  }

  // Targeted DB UPDATE before mirroring to local state. The bulk autosave path
  // (saveState → _upsertTenantsSafe → onConflict id DO UPDATE) lets a stale
  // tab/session that still holds this tenant as pending_review race-overwrite
  // the approval the next time it autosaves anything. Writing the row directly
  // here means DB is authoritative the moment the user clicks Approve;
  // _upsertTenantsSafe also strips stale pending_review rows before upsert,
  // closing the cross-tab race. Mirrors archiveTenant's targeted-update pattern.
  var prop = state.properties.find(function(p){ return p.name === t.property; });
  var moveIn = t.startDate || t.moveIn || null;
  var payload = {
    status: 'active',
    property_id: (prop && prop.id) || null,
    property_name: t.property || '',
    room_number: t.room || null,
    name: t.name || '',
    email: t.email || '',
    whatsapp: t.whatsapp || '',
    start_date: moveIn,
    move_in: moveIn
  };
  try {
    var res = await supa.from('tenants')
      .update(payload)
      .eq('id', String(t.id))
      .eq('org_id', _currentOrgId);
    if (res.error) {
      var msg = typeof friendlyDbSaveError === 'function'
        ? friendlyDbSaveError(res.error)
        : (res.error.message || 'unknown');
      showToast('Approve failed: ' + msg, 'error');
      return;
    }
  } catch (e) {
    showToast('Approve failed: ' + ((e && e.message) || 'network error'), 'error');
    return;
  }

  // Mirror DB write into local state so the UI flips immediately.
  t.status = 'active';
  if (prop && prop.id) t.propertyId = prop.id;
  if (t.property) {
    occupyRoom(t.property, t.room, t.rent);
    if (typeof syncPropertyRoomsFromTenants === 'function') syncPropertyRoomsFromTenants();
  }
  saveState();
  state.tenantDetailTab = null;
  closeModal();
  showToast(t.name + ' approved and checked in ✓', 'success');
  render();
}

function setTenantRating(id, rating) {
  var data = {};
  try { data = JSON.parse(localStorage.getItem('pm_tenant_review_' + id) || '{}'); } catch(e) {}
  data.rating = rating;
  localStorage.setItem('pm_tenant_review_' + id, JSON.stringify(data));
  // Update stars visually
  var container = document.getElementById('td-rating-stars');
  if (container) {
    container.querySelectorAll('span').forEach(function(s, i) {
      s.textContent = i < rating ? '★' : '☆';
      s.style.opacity = i < rating ? '1' : '0.25';
    });
  }
}

function saveTenantReview(id) {
  var data = {};
  try { data = JSON.parse(localStorage.getItem('pm_tenant_review_' + id) || '{}'); } catch(e) {}
  var notesEl = document.getElementById('td-review-notes');
  if (notesEl) data.notes = notesEl.value;
  localStorage.setItem('pm_tenant_review_' + id, JSON.stringify(data));
  showToast('Review saved', 'success');
}

function pdLandlordChanged(){
  var sel=document.getElementById('pd-lname');
  var newRow=document.getElementById('pd-new-landlord-row');
  var phoneInp=document.getElementById('pd-lphone');
  if(!sel) return;
  if(sel.value==='__new__'){
    if(newRow) newRow.style.display='block';
    if(phoneInp) phoneInp.value='';
  } else {
    if(newRow) newRow.style.display='none';
    // Auto-fill phone from selected landlord
    var ll=(state.landlords||[]).find(function(l){return l.name===sel.value;});
    if(ll && phoneInp) phoneInp.value=ll.phone||'';
  }
}

function saveTenantDetail(id){
  if (!requirePerm('canEdit', 'edit tenant details')) return;
  var idStr = String(id);
  var t=state.tenants.find(function(x){return String(x.id)===idStr;});if(!t)return;
  var oldProp=t.property; var oldRoom=t.room;
  var g=function(eid){var el=document.getElementById(eid);return el?el.value:null;};
  if(g('td-name'))t.name=g('td-name')||t.name;
  if(g('td-email')!==null)t.email=g('td-email');
  // WhatsApp validation: must be E.164-compatible (10–15 digits, no leading 0).
  // A leading 0 = local format like UK "07700…" — won't deliver via WhatsApp's
  // wa.me API. Block save with a clear toast so the field is correctable inline.
  var wa=g('td-wa');
  if(wa!==null){
    var waDigits = wa.trim().replace(/[\s\-()+]/g, '');
    if (waDigits === '') {
      t.whatsapp = '';
    } else if (!/^[1-9]\d{9,14}$/.test(waDigits)) {
      var hint = waDigits[0] === '0'
        ? ' Drop the leading 0 and add the country code (UK: 07700… → 447700…).'
        : ' Add a country code (UK 44, Portugal 351, Brazil 55).';
      if (typeof showToast === 'function') showToast('WhatsApp number needs a country code.' + hint, 'error');
      return; // bail out of save — keep the modal open so user can fix
    } else {
      t.whatsapp = waDigits;
    }
  }
  if(g('td-prop'))t.property=g('td-prop');
  var newRoom = +g('td-room')||t.room;
  var newProp = g('td-prop')||t.property;
  // Check room isn't taken by another active tenant
  if(newRoom !== t.room || newProp !== t.property) {
    var roomTaken2 = state.tenants.find(function(x){
      return x.property===newProp && roomNumsEqual(x.room, newRoom) && x.status!=='inactive' && String(x.id)!==String(t.id);
    });
    if(roomTaken2){ alert('⚠️ Room '+newRoom+' at '+newProp+' is already occupied by '+roomTaken2.name+'.'); return; }
  }
  t.room = newRoom;
  var newRoomType=g('td-roomtype');
  if(newRoomType){
    t.roomType=newRoomType;
    var rProp=state.properties.find(function(x){return x.name===t.property;});
    if(rProp&&rProp.roomList){var rRoom=rProp.roomList.find(function(r){return r.n===t.room;});if(rRoom)rRoom.type=newRoomType;}
  }
  if(g('td-method'))t.method=g('td-method');
  if(g('td-freq'))t.freq=g('td-freq');
  // Payment schedule fields — these control when rent appears on the rent page
  var freq2=g('td-freq'); if(freq2) t.freq=freq2;               // frequency from dropdown
  var payDay=g('td-payday'); if(payDay) t.payDay=payDay;         // due day of week (weekly)
  var payDom=g('td-paydom'); if(payDom) t.payDayOfMonth=+payDom; // due date of month (monthly)
  var ns=g('td-movein');if(ns){t.moveIn=ns;t.startDate=ns;}
  var dobVal = g('td-dob');          if (dobVal !== null) t.dob = dobVal || null;
  var natVal = g('td-nationality');  if (natVal !== null) t.nationality = natVal;
  if(g('td-status'))t.status=g('td-status');
  // Reject negative numbers — UI accepted -100 as rent before this guard.
  var rentEl=g('td-rent');
  if(rentEl!==null){var nRent=parseFloat(rentEl);t.rent=(isFinite(nRent)&&nRent>=0)?nRent:t.rent;}
  var arrEl=g('td-arrears');
  if(arrEl!==null){var nArr=parseFloat(arrEl);t.arrears=(isFinite(nArr)&&nArr>=0)?nArr:0;}
  var depEl=g('td-deposit');
  if(depEl!==null){var nDep=parseFloat(depEl);t.deposit=(isFinite(nDep)&&nDep>=0)?nDep:0;}
  var dstatEl=g('td-depositStatus');if(dstatEl!==null)t.depositStatus=dstatEl;
  var drefEl=g('td-depositRef');if(drefEl!==null)t.depositRef=drefEl;
  var dschEl=g('td-depositScheme');if(dschEl!==null)t.depositScheme=dschEl;
  var movedOut=t.status==='inactive';
  if(movedOut){
    freeRoom(oldProp,oldRoom);
    // Store previous tenancy before clearing current assignment
    if(!t.previousTenancies) t.previousTenancies = [];
    // Only add if not already recorded (avoid duplicates on re-save)
    var alreadyRecorded = t.previousTenancies.some(function(pt){
      return pt.property===oldProp && pt.room===oldRoom;
    });
    if(!alreadyRecorded && oldProp) {
      t.previousTenancies.push({
        property: oldProp,
        room: oldRoom,
        moveIn: t.startDate || t.moveIn || null,
        moveOut: t.moveOutDate || new Date().toISOString().split('T')[0],
        rent: t.rent,
        freq: t.freq
      });
    }
    // Clear current property assignment — tenant is now unassigned
    t.property = '';
    t.room = null;
  }
  else if(t.property!==oldProp||t.room!==oldRoom){freeRoom(oldProp,oldRoom);occupyRoom(t.property,t.room,t.rent);}
  else{
    // Sync room price AND freq with tenant rent — without freq sync, a monthly tenant
    // saved against a wk-priced room caused the property total to be miscomputed (×52/12).
    var curProp = state.properties.find(function(p){return p.name===t.property;});
    if(curProp&&curProp.roomList){
      var curRoom = curProp.roomList.find(function(r){return r.n===t.room;});
      if(curRoom){
        curRoom.price = t.rent;
        curRoom.priceFreq = (t.freq==='monthly') ? 'mo' : 'wk';
      }
    }
    recalcProperty(curProp);
  }
  rebuildTenantSchedule(idStr);
  state.tenantDetailTab=null;
  closeModal();
  saveState();
  render();
}

function doMoveRoom(btn) {
  var tid   = btn.getAttribute('data-tid');  // keep as string for UUID compat
  var pname = decodeURIComponent(btn.getAttribute('data-pname'));
  var room  = +btn.getAttribute('data-room');
  var price = +btn.getAttribute('data-price');
  // Coerce tid to the same type as tenant IDs in state
  var t = state.tenants.find(function(x){return String(x.id)===String(tid);});
  if(!t){showToast('Tenant not found','error');return;}
  var oldProp=t.property;var oldRoom=t.room;
  t.property=pname;t.room=room;t.rent=price;
  freeRoom(oldProp,oldRoom);
  occupyRoom(pname,room,price);
  rebuildAllSchedules();
  saveState();
  showToast('Moved to '+pname+' Room '+room,'success');
  state.tenantDetailTab='actions';
  openTenantDetail(t.id);
}
function generatePortalPassword() {
  // 3 words from a friendly word list + 2 random digits
  var adjectives = ['Blue','Red','Green','Gold','Silver','Swift','Bright','Clear','Bold','Calm','Fresh','Sharp','Smart','Strong','Quick','Warm','Cool','Wild','Keen','Safe'];
  var nouns      = ['Door','Key','Room','Home','Gate','Hall','Park','Lane','Road','Hill','View','Lake','Tree','Leaf','Star','Moon','Sun','Wind','Rain','Sky'];
  var a = adjectives[Math.floor(Math.random()*adjectives.length)];
  var n = nouns[Math.floor(Math.random()*nouns.length)];
  var num = Math.floor(Math.random()*90)+10; // 10-99
  return a + n + num;
}



function giveTenantNotice(id) {
  var t = state.tenants.find(function(x){return x.id===id;});
  if(!t) return;
  var el = document.getElementById('notice-moveout-'+id);
  var moveOut = el ? el.value : '';
  if(!moveOut) { alert('Please select a move-out date.'); return; }
  t.status = 'notice_given';
  t.noticeDate = new Date().toISOString().split('T')[0];
  t.moveOutDate = moveOut;
  if(typeof sendTenantNoticeConfirmation === 'function') sendTenantNoticeConfirmation(t);
  state.tenantDetailTab = 'actions';
  saveState();
  openTenantDetail(id);
}
function cancelTenantNotice(id) {
  var t = state.tenants.find(function(x){return x.id===id;});
  if(!t) return;
  t.status = 'active';
  t.noticeDate = null;
  t.moveOutDate = null;
  state.tenantDetailTab = 'actions';
  saveState();
  openTenantDetail(id);
}
function moveTenantToRoom(tenantId, newPropId, newPropName, newRoomN, newPrice) {
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(!t) return;
  var oldProp = t.property; var oldRoom = t.room;
  t.property = newPropName; t.room = newRoomN; t.rent = newPrice;
  freeRoom(oldProp, oldRoom);
  occupyRoom(newPropName, newRoomN, newPrice);
  rebuildAllSchedules();
  saveState();
  state.tenantDetailTab = 'actions';
  openTenantDetail(tenantId);
}

function moveTenantOut(id){
  var t=state.tenants.find(function(x){return x.id===id;});if(!t)return;
  var prop=t.property;var room=t.room;
  t.status='inactive';freeRoom(prop,room);rebuildAllSchedules();
  state.tenantDetailTab=null;closeModal();saveState();
  render();
}

async function openPropDetail(id) {
  const p = state.properties.find(x=>x.id===id);
  if(!p) return;
  state.propDetailTab = state.propDetailTab || 'details';
  const tab = state.propDetailTab;
  const n = net(p);
  const n2 = net(p);
  const o = pct(p.occupied, p.rooms);
  const oc = o===100?'var(--green)':o<70?'var(--red)':'var(--amber)';
  // Active/notice tenants only — inactive are former tenants and must not show as current
  const propTenants = state.tenants.filter(t=>t.property===p.name && t.status!=='inactive');
  const formerTenants = state.tenants.filter(t=>t.property===p.name && t.status==='inactive');

  const detailsTab = `
    <!-- Property KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:${oc};font-family:monospace">${o}%</div>
        <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-top:2px">Occupancy</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">${p.occupied}/${p.rooms}</div>
      </div>
      <div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:var(--green);font-family:monospace">${fmt(p.rent)}</div>
        <div style="font-size:10px;color:var(--green);font-weight:700;text-transform:uppercase;margin-top:2px">Income/mo</div>
      </div>
      <div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:var(--red);font-family:monospace">${fmt(p.landlord)}</div>
        <div style="font-size:10px;color:var(--red);font-weight:700;text-transform:uppercase;margin-top:2px">Landlord/mo</div>
      </div>
      <div style="background:${n>=0?'var(--green-light)':'var(--red-light)'};border:1px solid ${n>=0?'#A7F3D0':'#FECDD3'};border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:${n>=0?'var(--green)':'var(--red)'};font-family:monospace">${fmt(n)}</div>
        <div style="font-size:10px;color:${n>=0?'var(--green)':'var(--red)'};font-weight:700;text-transform:uppercase;margin-top:2px">Profit/mo</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="field"><label class="field-label">Property Name</label><input class="inp" id="pd-name" value="${esc(p.name)}"></div>
      <div class="field"><label class="field-label">Type</label>
        <select class="inp" id="pd-type">
          <option ${p.type==='HMO'?'selected':''}>HMO</option>
          <option ${p.type==='Single Let'?'selected':''}>Single Let</option>
          <option ${p.type==='Semi-Commercial'?'selected':''}>Semi-Commercial</option>
          <option ${p.type==='Other'?'selected':''}>Other</option>
        </select>
      </div>
    </div>

    <!-- Ownership & Letting type -->
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Classification</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <label id="pd-lbl-owned" onclick="pdSetOwnership('owned')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:2px solid ${(p.ownershipType||'managed')==='owned'?'var(--accent)':'var(--border)'};background:${(p.ownershipType||'managed')==='owned'?'var(--accent-light)':'var(--bg)'};cursor:pointer">
          <input type="radio" name="pd-ownership" value="owned" ${(p.ownershipType||'managed')==='owned'?'checked':''} style="accent-color:var(--accent)">
          <div><div style="font-size:12px;font-weight:700;color:${(p.ownershipType||'managed')==='owned'?'var(--accent-dark)':'var(--text)'}">🏠 Owned</div></div>
        </label>
        <label id="pd-lbl-managed" onclick="pdSetOwnership('managed')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:2px solid ${(p.ownershipType||'managed')==='managed'?'var(--accent)':'var(--border)'};background:${(p.ownershipType||'managed')==='managed'?'var(--accent-light)':'var(--bg)'};cursor:pointer">
          <input type="radio" name="pd-ownership" value="managed" ${(p.ownershipType||'managed')==='managed'?'checked':''} style="accent-color:var(--accent)">
          <div><div style="font-size:12px;font-weight:700;color:${(p.ownershipType||'managed')==='managed'?'var(--accent-dark)':'var(--text)'}">🤝 Managed</div></div>
        </label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label id="pd-lbl-hmo" onclick="pdSetLetting('hmo')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:2px solid ${(p.lettingType||'hmo')==='hmo'?'var(--accent)':'var(--border)'};background:${(p.lettingType||'hmo')==='hmo'?'var(--accent-light)':'var(--bg)'};cursor:pointer">
          <input type="radio" name="pd-letting" value="hmo" ${(p.lettingType||'hmo')==='hmo'?'checked':''} style="accent-color:var(--accent)">
          <div><div style="font-size:12px;font-weight:700;color:${(p.lettingType||'hmo')==='hmo'?'var(--accent-dark)':'var(--text)'}">🏘️ HMO</div></div>
        </label>
        <label id="pd-lbl-whole" onclick="pdSetLetting('whole')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:2px solid ${(p.lettingType||'hmo')==='whole'?'var(--accent)':'var(--border)'};background:${(p.lettingType||'hmo')==='whole'?'var(--accent-light)':'var(--bg)'};cursor:pointer">
          <input type="radio" name="pd-letting" value="whole" ${(p.lettingType||'hmo')==='whole'?'checked':''} style="accent-color:var(--accent)">
          <div><div style="font-size:12px;font-weight:700;color:${(p.lettingType||'hmo')==='whole'?'var(--accent-dark)':'var(--text)'}">🏡 Whole</div></div>
        </label>
      </div>
      <!-- STR (Airbnb / Rent-to-SA) toggle -->
      <label style="display:flex;align-items:center;gap:10px;padding:10px 11px;margin-top:10px;border-radius:9px;border:2px solid ${p.isStrEnabled?'#FF5A5F':'var(--border)'};background:${p.isStrEnabled?'rgba(255,90,95,.06)':'var(--bg)'};cursor:pointer;transition:all .15s">
        <input type="checkbox" id="pd-str-enabled" ${p.isStrEnabled?'checked':''} onchange="pdSetStrEnabled(this.checked)" style="accent-color:#FF5A5F;width:16px;height:16px;cursor:pointer">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;color:${p.isStrEnabled?'#E04E53':'var(--text)'}">🛏️ Generates Airbnb / Rent-to-SA income</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">Tick this if the property hosts Airbnb / Booking.com / SpareRoom STR alongside (or instead of) tenancy rent.</div>
        </div>
      </label>
    </div>
    <div class="field"><label class="field-label">Full Address</label><input class="inp" id="pd-address" value="${p.address||''}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label class="field-label">Area</label>
        <input class="inp" id="pd-area" value="${esc(p.area||'')}" placeholder="e.g. town, district or postcode area" list="pd-area-suggestions">
        <datalist id="pd-area-suggestions">${(function(){var areas=[];(state.properties||[]).forEach(function(pp){if(pp.area&&areas.indexOf(pp.area)<0)areas.push(pp.area);});return areas.map(function(a){return '<option value="'+esc(a)+'">';}).join('');})()}</datalist>
      </div>
      <div class="field"><label class="field-label">Lease Start Date</label>
        <input class="inp" id="pd-lease-start" type="date" value="${(p.leaseStartDate||(p.createdAt?p.createdAt.split('T')[0]:'')||'')}">
      </div>
      <div class="field"><label class="field-label">Landlord Pay Day <span style="font-size:10px;color:var(--muted);font-weight:400">· day of month (1-31)</span></label>
        <input class="inp" id="pd-paydate" type="number" min="1" max="31" placeholder="e.g. 1" value="${(p.landlordPayDay!=null?p.landlordPayDay:'')}">
        <div style="font-size:10px;color:var(--muted);margin-top:3px">💡 Day each month landlord rent is due. Leave blank to default to the lease start day (or 1st).</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div id="pd-rooms-wrap" class="field" ${(p.lettingType||'hmo')==='whole'?'style="display:none"':''}><label class="field-label">Total Rooms</label><input class="inp" id="pd-rooms" type="number" value="${p.rooms}"></div>
      <div id="pd-bedrooms-wrap" class="field" ${(p.lettingType||'hmo')!=='whole'?'style="display:none"':''}><label class="field-label">🛏️ Bedrooms</label>
        <select class="inp" id="pd-bedrooms">
          ${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${(p.bedrooms||3)===n?'selected':''}>${n}${n===6?'+':''} bedroom${n===1?'':'s'}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label class="field-label" id="pd-outgoing-label">${(p.ownershipType||'managed')==='owned'?'Mortgage Payment (£/mo)':'Landlord Rent (£/mo)'}</label><input class="inp" id="pd-landlord" type="number" value="${p.landlord}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label class="field-label">Income (£/mo) <span style="font-size:10px;color:var(--muted);font-weight:400">auto from tenants</span></label><input class="inp" id="pd-rent" type="number" value="${p.rent}" readonly style="background:var(--bg);color:var(--muted);cursor:not-allowed"></div>
    </div>

    <!-- Landlord details (managed only) -->
    <div id="pd-landlord-section" ${(p.ownershipType||'managed')==='owned'?'style="display:none"':''}>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Landlord Details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field" style="margin:0"><label class="field-label">Landlord Name</label>
            <select class="inp" id="pd-lname" onchange="pdLandlordChanged()">
              <option value="">— Select landlord —</option>
              ${(state.landlords||[]).map(function(ll){ return '<option value="'+escapeHtml(ll.name)+'" '+(ll.name===(p.landlordName||'')?'selected':'')+'>'+escapeHtml(ll.name)+'</option>'; }).join('')}
              <option value="__new__">+ Add new landlord…</option>
            </select>
          </div>
          <div class="field" style="margin:0"><label class="field-label">Landlord Phone</label><input class="inp" id="pd-lphone" value="${p.landlordPhone||''}"></div>
        </div>
        <div id="pd-new-landlord-row" style="display:none;margin-top:10px">
          <div class="field" style="margin:0"><label class="field-label">New Landlord Name</label><input class="inp" id="pd-lname-new" placeholder="Enter new landlord name"></div>
        </div>
      </div>
    </div>

    <!-- Mortgage details (owned only) -->
    <div id="pd-mortgage-section" ${(p.ownershipType||'managed')!=='owned'?'style="display:none"':''}>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">🏦 Mortgage</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field" style="margin:0"><label class="field-label">Lender</label><input class="inp" id="pd-m-lender" value="${(p.mortgage&&p.mortgage.lender)||''}" placeholder="e.g. Halifax"></div>
          <div class="field" style="margin:0"><label class="field-label">Monthly Payment (£)</label><input class="inp" id="pd-m-payment" type="number" value="${(p.mortgage&&p.mortgage.monthlyPayment)||''}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          <div class="field" style="margin:0"><label class="field-label">Rate (%)</label><input class="inp" id="pd-m-rate" type="number" step="0.01" value="${(p.mortgage&&p.mortgage.rate)||''}"></div>
          <div class="field" style="margin:0"><label class="field-label">Rate Type</label>
            <select class="inp" id="pd-m-ratetype">
              ${['fixed','tracker','svr','variable'].map(rt=>`<option value="${rt}" ${(p.mortgage&&p.mortgage.rateType)===rt?'selected':''}>${rt.charAt(0).toUpperCase()+rt.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          <div class="field" style="margin:0"><label class="field-label">Fix End Date</label><input class="inp" id="pd-m-fixend" type="date" value="${(p.mortgage&&p.mortgage.fixEndDate)||''}"></div>
          <div class="field" style="margin:0"><label class="field-label">Outstanding Balance (£)</label><input class="inp" id="pd-m-balance" type="number" value="${(p.mortgage&&p.mortgage.outstandingBalance)||''}"></div>
        </div>
        ${(()=>{
          if(!p.mortgage||!p.mortgage.outstandingBalance||!p.purchaseInfo||!p.purchaseInfo.estimatedValue) return '';
          var equity = (p.purchaseInfo.estimatedValue||0) - (p.mortgage.outstandingBalance||0);
          var ltv    = p.purchaseInfo.estimatedValue ? Math.round((p.mortgage.outstandingBalance/p.purchaseInfo.estimatedValue)*100) : 0;
          return `<div style="margin-top:12px;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="text-align:center"><div style="font-size:15px;font-weight:800;color:var(--green);font-family:monospace">${fmt(equity)}</div><div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Equity</div></div>
            <div style="text-align:center"><div style="font-size:15px;font-weight:800;color:${ltv>75?'var(--red)':'var(--amber)'};font-family:monospace">${ltv}%</div><div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">LTV</div></div>
          </div>`;
        })()}
      </div>
    </div>

    <!-- Purchase info (owned only) -->
    <div id="pd-purchase-section" ${(p.ownershipType||'managed')!=='owned'?'style="display:none"':''}>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">📈 Purchase & Value</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field" style="margin:0"><label class="field-label">Purchase Price (£)</label><input class="inp" id="pd-p-purchase" type="number" value="${(p.purchaseInfo&&p.purchaseInfo.purchasePrice)||''}"></div>
          <div class="field" style="margin:0"><label class="field-label">Purchase Date</label><input class="inp" id="pd-p-date" type="date" value="${(p.purchaseInfo&&p.purchaseInfo.purchaseDate)||''}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          <div class="field" style="margin:0"><label class="field-label">Est. Value Now (£)</label><input class="inp" id="pd-p-value" type="number" value="${(p.purchaseInfo&&p.purchaseInfo.estimatedValue)||''}"></div>
          <div class="field" style="margin:0"><label class="field-label">Ownership Structure</label>
            <select class="inp" id="pd-p-structure">
              ${['sole','joint','ltd','other'].map(s=>`<option value="${s}" ${(p.purchaseInfo&&p.purchaseInfo.ownershipStructure)===s?'selected':''}>${s==='ltd'?'Ltd Company':s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>
    <div class="field"><label class="field-label">📍 Google Maps URL</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="inp" id="pd-maps" value="${p.mapsUrl||''}" placeholder="https://maps.google.com/?q=..." style="flex:1">
        ${p.mapsUrl?`<a href="${p.mapsUrl}" target="_blank" style="white-space:nowrap;font-size:12px;color:var(--blue);text-decoration:none;border:1px solid var(--blue-light);background:var(--blue-light);padding:8px 12px;border-radius:8px">🗺 Open</a>`:''}
      </div>
    </div>
    <div class="field"><label class="field-label">&#x1F3E2; Operating Company</label>
      <select class="inp" id="pd-company">
        <option value="">— Unassigned —</option>
        ${(state.companies||[]).map(c=>'<option value="'+c.id+'" '+(p.companyId===c.id?'selected':'')+'>'+esc(c.name)+'</option>').join('')}
      </select>
    </div>
    <div class="field"><label class="field-label">Notes</label>
      <textarea class="inp" id="pd-notes" rows="3" style="resize:vertical">${p.notes||''}</textarea>
    </div>`;

  const isWholeProperty = (p.lettingType||'hmo') === 'whole';
  const roomsTab = isWholeProperty ? `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center;margin-bottom:16px">
      <div style="font-size:32px;margin-bottom:10px">🏡</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">Whole Property Let</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">This property is let to one household — ${p.bedrooms||'?'} bedroom${(p.bedrooms||1)===1?'':'s'}. No individual room breakdown.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:300px;margin:0 auto">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:12px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${p.occupied>0?'var(--green)':'var(--red)'}">
            ${p.occupied>0?'●':'○'}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;font-weight:600">${p.occupied>0?'Occupied':'Vacant'}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:12px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:var(--green)">${fmt(p.rent||0)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;font-weight:600">Income/mo</div>
        </div>
      </div>
    </div>
    <div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:10px;padding:12px;font-size:12px;color:var(--blue)">
      💡 To add a tenant for this property, use the Tenants tab or the + Add Tenant button. One active tenancy at a time.
    </div>` : `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:13px;font-weight:700">${p.rooms} Rooms</div>
        <div style="font-size:11px;color:var(--muted)">${p.occupied} occupied · ${p.rooms-p.occupied} vacant</div>
      </div>
      <button onclick="addRoomToProp('${p.id}')" style="font-size:12px;font-weight:600;color:var(--accent-dark);background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;padding:7px 13px;cursor:pointer;font-family:inherit">+ Add Room</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${(p.roomList||[]).map(r=>`
        <div style="display:flex;align-items:center;gap:12px;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:12px 14px">
          <div style="width:32px;height:32px;border-radius:8px;background:${r.status==='occupied'?'var(--green-light)':'var(--red-light)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${r.status==='occupied'?'var(--green)':'var(--red)'};flex-shrink:0">
            ${r.n}
          </div>
          <div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0">
            <span style="font-size:12px;font-weight:700;color:var(--text);flex-shrink:0">Rm ${r.n}</span>
            <select onchange="updateRoomType('${p.id}',${r.n},this.value)" style="padding:4px 8px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;font-family:inherit;color:var(--text);cursor:pointer">
              ${['🛏️ Single','🛏️🛏️ Double','✨ Suite','🏠 Studio','🏡 Whole House'].map(opt=>`<option value="${opt.split(' ').slice(1).join(' ')}" ${(r.type||'Single')===opt.split(' ').slice(1).join(' ')?'selected':''}>${opt}</option>`).join('')}
            </select>
            <span style="font-size:11px;font-weight:600;color:${r.status==='occupied'?'var(--green)':'var(--red)'};background:${r.status==='occupied'?'var(--green-light)':'var(--red-light)'};padding:2px 8px;border-radius:5px;flex-shrink:0">${r.status}</span>
            ${r.status==='occupied'?`<span style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${propTenants.find(t=>roomNumsEqual(t.room,r.n))?propTenants.find(t=>roomNumsEqual(t.room,r.n)).name:'Tenant not linked'}</span>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:4px">
              <span style="font-size:11px;color:var(--muted)">£</span>
              <input type="number" value="${r.price}" onchange="updateRoomPrice('${p.id}',${r.n},this.value)"
                style="width:72px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:13px;font-weight:600;color:var(--text);font-family:inherit;outline:none">
              <select onchange="updateRoomPriceFreq('${p.id}',${r.n},this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:11px;font-weight:600;color:var(--muted);font-family:inherit;cursor:pointer">
                <option value="wk" ${(r.priceFreq||'wk')==='wk'?'selected':''}>/wk</option>
                <option value="mo" ${(r.priceFreq||'wk')==='mo'?'selected':''}>/mo</option>
              </select>
            </div>
          </div>
        </div>`).join('')}
    </div>`;

  const tenantsTab = `
    <div style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:2px">${propTenants.length} Current Tenant${propTenants.length!==1?'s':''}</div>
      <div style="font-size:11px;color:var(--muted)">${propTenants.filter(t=>t.arrears>0).length} in arrears${formerTenants.length?' · '+formerTenants.length+' previous':''}</div>
    </div>
    ${propTenants.length===0
      ? `<div style="padding:24px;text-align:center;color:var(--dim);font-size:13px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">No active tenants at this property</div>`
      : propTenants.map(t=>`
        <div onclick="state.propDetailTab=null;closeModal();setTimeout(function(){openTenantDetail('${t.id}');},50)" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border:1px solid ${t.arrears>0?'#FECDD3':'var(--border)'};border-radius:10px;margin-bottom:8px;cursor:pointer">
          <div style="width:34px;height:34px;border-radius:10px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--accent-dark);flex-shrink:0">${t.name[0]}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${esc(t.name)}</div>
            <div style="font-size:11px;color:var(--muted)">${t.room?'Room '+t.room+' · ':''}${fmt(t.rent)}/${t.freq==='weekly'?'wk':'mo'}</div>
            ${t.arrears>0?`<div style="font-size:11px;color:var(--red);font-weight:600">Arrears: ${fmt(t.arrears)}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
            ${badge(t.status==='notice_given'?'notice_given':t.status)}
            ${t.whatsapp?`<a href="https://wa.me/${t.whatsapp}" target="_blank" onclick="event.stopPropagation()" style="font-size:10px;color:var(--wa);background:var(--wa-light);border:1px solid #BBF7D0;border-radius:5px;padding:2px 7px;text-decoration:none">💬 WhatsApp</a>`:''}
          </div>
        </div>`).join('')}
    ${formerTenants.length ? `
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Previous Tenants (${formerTenants.length})</div>
        ${formerTenants.map(t=>`
          <div onclick="state.propDetailTab=null;closeModal();setTimeout(function(){openTenantDetail('${t.id}');},50)" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:9px;margin-bottom:6px;cursor:pointer;opacity:.7">
            <div style="width:28px;height:28px;border-radius:8px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--muted);flex-shrink:0">${t.name[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--muted)">${esc(t.name)}</div>
              <div style="font-size:11px;color:var(--dim)">Moved out${t.moveOutDate?' · '+new Date(t.moveOutDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):''}</div>
            </div>
            <span style="font-size:10px;padding:2px 7px;border-radius:5px;background:var(--border);color:var(--muted);font-weight:600">Archived</span>
          </div>`).join('')}
      </div>` : ''}`;

  const tabs = [
    {v:'details',  l:'Details'},
    {v:'rooms',    l:`Rooms (${p.rooms})`},
    {v:'tenants',  l:`Tenants (${propTenants.length})`},
    {v:'finance',  l:'💰 Finance'},
    {v:'media',    l:`🖼️ Media (${((p.gallery&&p.gallery.photos)||[]).length+((p.gallery&&p.gallery.videos)||[]).length})`},
    {v:'docs',     l:'📁 Docs'},
  ];

  const docsTab     = (tab==='docs')    ? (await renderPropDocsTab(p)) : '<div></div>';
  const financeTab  = (tab==='finance') ? renderPropFinanceTab(p, propTenants) : '<div></div>';
  const mediaTab    = (tab==='media')   ? (typeof renderPropMediaTab==='function' ? renderPropMediaTab(p) : '<div style="padding:20px;color:var(--muted)">Media tab not loaded.</div>') : '<div></div>';
  const tabContent  = tab==='details'  ? detailsTab
                    : tab==='rooms'    ? roomsTab
                    : tab==='tenants'  ? tenantsTab
                    : tab==='finance'  ? financeTab
                    : tab==='media'    ? mediaTab
                    : docsTab;

  // Check if modal is already open for this property — swap content only (no flicker)
  var _existingPropModal = document.querySelector('#modal-container .modal[data-prop-id="'+p.id+'"]');
  if(_existingPropModal) {
    var _contentEl = _existingPropModal.querySelector('.prop-detail-content');
    var _footerEl = _existingPropModal.querySelector('.modal-footer');
    if(_contentEl) _contentEl.innerHTML = tabContent;
    // Update tab highlights
    _existingPropModal.querySelectorAll('.pd-tab-btn').forEach(function(btn){
      var tv = btn.dataset.tab;
      btn.style.borderBottomColor = tv===tab ? 'var(--accent)' : 'transparent';
      btn.style.fontWeight = tv===tab ? '700' : '500';
      btn.style.color = tv===tab ? 'var(--accent-dark)' : 'var(--muted)';
    });
    // Update footer
    if(_footerEl) {
      if(tab==='details') _footerEl.innerHTML = btn('Cancel',"state.propDetailTab=null;closeModal()",'secondary')
        +(p.status==='archived'
          ? '<button onclick="deletePropPermanent(\''+p.id+'\')" class="btn btn-danger" style="margin-right:auto">&#x1F5D1; Delete</button><button onclick="restoreProperty(\''+p.id+'\')" class="btn" style="background:var(--green-light);color:var(--green);border:1px solid var(--green)">&#x21A9; Restore</button>'
          : '<button onclick="archiveProperty(\''+p.id+'\')" class="btn btn-secondary" style="margin-right:auto">&#x1F4E6; Archive</button>')
        +btn('Save Changes','savePropDetail(\''+p.id+'\')','primary');
      else if(tab==='tenants') _footerEl.innerHTML = btn('Close',"state.propDetailTab=null;closeModal()",'secondary')+btn('+ Add Tenant',"state.propDetailTab=null;closeModal();openModal('addTenant')",'primary');
      else _footerEl.innerHTML = btn('Close',"state.propDetailTab=null;closeModal()",'secondary');
    }
    return;
  }

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this){state.propDetailTab=null;closeModal()}">
      <div class="modal prop-detail-modal" data-prop-id="${p.id}" style="max-width:806px;width:min(806px,calc(100vw - 16px));height:min(90vh,910px);overflow:hidden;display:flex;flex-direction:column">
        <div class="modal-header" style="padding:16px 20px">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:700;margin-bottom:2px">${esc(p.name)}</div>
            <div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px">
              <span>${esc(p.area)}</span>
              <span>·</span>
              <span style="color:${n2>=0?'var(--green)':'var(--red)'};font-weight:600">${fmt(n2)} profit/mo</span>
              <span>·</span>
              <span style="color:${oc};font-weight:600">${o}% occupied</span>
            </div>
          </div>
          <button class="modal-close" onclick="state.propDetailTab=null;closeModal()">×</button>
        </div>

        <!-- Tab bar -->
        <div class="prop-detail-tabs" style="display:flex;align-items:stretch;min-height:44px;border-bottom:1px solid var(--border);padding:0 20px;background:var(--bg);overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch">
          ${tabs.map(t=>`
            <button class="pd-tab-btn" data-tab="${t.v}" onclick="state.propDetailTab='${t.v}';openPropDetail('${p.id}')"
              style="display:flex;align-items:center;min-height:44px;padding:0 14px;border:none;border-bottom:2px solid ${tab===t.v?'var(--accent)':'transparent'};
                margin-bottom:-1px;background:transparent;cursor:pointer;font-family:inherit;
                color:${tab===t.v?'var(--accent-dark)':'var(--muted)'};font-size:13px;font-weight:${tab===t.v?700:500};
                line-height:1.1;white-space:nowrap;transition:all .15s">
              ${t.l}
            </button>`).join('')}
        </div>

        <div class="prop-detail-content" style="padding:20px;overflow-y:auto;overflow-x:hidden;min-width:0;flex:1">
          ${tabContent}
        </div>

        ${tab==='details'?`
        <div class="modal-footer" style="padding:14px 20px;flex-wrap:wrap;gap:8px">
          ${btn('Cancel',"state.propDetailTab=null;closeModal()",'secondary')}
          ${p.status==='archived'
            ? `<button onclick="deletePropPermanent('${p.id}')" style="padding:9px 16px;border-radius:9px;border:none;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:auto">🗑 Delete</button>
               <button onclick="restoreProperty('${p.id}')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--green);background:var(--green-light);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">↩ Restore</button>`
            : `<button onclick="archiveProperty('${p.id}')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-right:auto">📦 Archive</button>`
          }
          <button onclick="generatePropertyReportPDF('${p.id}')" style="padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit" title="Open a full PDF report for this property (view first, then download)">📄 PDF Report</button>
          ${btn('Save Changes',`savePropDetail('${p.id}')`,'primary')}
        </div>`:
        tab==='tenants'?`
        <div class="modal-footer" style="padding:14px 20px">
          ${btn('Close',"state.propDetailTab=null;closeModal()",'secondary')}
          ${btn('+ Add Tenant',"state.propDetailTab=null;closeModal();openModal('addTenant')",'primary')}
        </div>`:tab==='finance'?`
        <div class="modal-footer" style="padding:14px 20px">
          ${btn('Close',"state.propDetailTab=null;closeModal()",'secondary')}
          ${btn('Edit Details',"state.propDetailTab='details';openPropDetail('"+p.id+"')",'primary')}
        </div>`:`
        <div class="modal-footer" style="padding:14px 20px">
          ${btn('Close',"state.propDetailTab=null;closeModal()",'secondary')}
        </div>`}
      </div>
    </div>`;
}
