// ── PROPERTY DETAIL MODAL ─────────────────────────────────────────────────────
async function openTenantDetail(id){
  var t=state.tenants.find(function(x){return x.id===id;});
  if(!t) return;
  state.tenantDetailTab=state.tenantDetailTab||'profile';
  var tab=state.tenantDetailTab;
  // Merge manual paymentHistory with actual payments from state.payments + rentSchedule
  var hist = (t.paymentHistory||[]).slice();
  // Pull in paid entries from state.payments for this tenant
  (state.payments||[]).forEach(function(p){
    if(p.tenant===t.name && p.status==='paid') {
      // Avoid duplicates if already in paymentHistory
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
  // Sort most recent first
  hist.sort(function(a,b){
    return new Date(b.date.split(' ').reverse().join(' ')||0) - new Date(a.date.split(' ').reverse().join(' ')||0);
  });

  var profileTab=''
    +'<div class="field"><label class="field-label">Full Name</label><input class="inp" id="td-name" value="'+t.name+'"></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="td-email" type="email" value="'+(t.email||'')+'"></div>'
    +'<div class="field"><label class="field-label">📱 WhatsApp</label><input class="inp" id="td-wa" type="tel" value="'+(t.whatsapp||'')+'" placeholder="447911000000"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Check-in Date</label><input class="inp" id="td-movein" type="date" value="'+(t.startDate||t.moveIn||'')+'"></div>'
    +'<div class="field"><label class="field-label">Status</label><select class="inp" id="td-status"><option value="active" '+(t.status==='active'?'selected':'')+'>Active</option><option value="notice_given" '+(t.status==='notice_given'?'selected':'')+'>On Notice</option><option value="inactive" '+(t.status==='inactive'?'selected':'')+'>Moved Out</option></select></div></div>';

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
        +'<div style="background:'+(t.arrears>0?'var(--red-light)':'var(--bg)')+';border:1px solid '+(t.arrears>0?'#FECDD3':'var(--border)')+';border-radius:10px;padding:14px;text-align:center">'
          +'<div style="font-size:22px;font-weight:800;color:'+(t.arrears>0?'var(--red)':'var(--muted)')+';font-family:monospace">'+fmt(t.arrears||0)+'</div>'
          +'<div style="font-size:11px;color:var(--muted)">arrears</div>'
        +'</div>'
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
                    +'<div style="font-size:13px;font-weight:700">'+(pt.property||'Unknown property')+'</div>'
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
              +'<select class="inp" id="td-prop">'+state.properties.filter(function(p){return isPropertyActive(p)||p.name===t.property;}).map(function(p){return '<option value="'+p.name+'" '+(t.property===p.name?'selected':'')+'>'+p.name+'</option>';}).join('')+'</select>'
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
      +'<a href="'+waBase+encodeURIComponent('Hi '+firstName+', your rent of £'+t.rent+' is due. Please arrange payment. Thank you.')+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #BBF7D0;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">💬</span><div><div style="font-size:13px;font-weight:600">Rent Reminder</div><div style="font-size:11px;color:var(--muted)">Gentle reminder about upcoming rent</div></div></a>'
      +(t.arrears>0?'<a href="'+waBase+encodeURIComponent('Hi '+firstName+', you have arrears of £'+t.arrears+'. Please contact us urgently.')+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #FECDD3;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">⚠️</span><div><div style="font-size:13px;font-weight:600">Chase Arrears</div><div style="font-size:11px;color:var(--muted)">£'+t.arrears+' outstanding</div></div></a>':'')
      +'<a href="'+waBase.split('?')[0]+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #BBF7D0;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">💬</span><div><div style="font-size:13px;font-weight:600">Open Chat</div><div style="font-size:11px;color:var(--muted)">Open WhatsApp directly</div></div></a>'
      +'</div></div>';
  }
  actionsTab+='<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:16px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:10px">📄 Legal Documents</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +'<button onclick="generateExcludedLicence(\''+t.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #BFDBFE;border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%"><span style="font-size:18px">📋</span><div><div style="font-size:13px;font-weight:600;color:var(--blue)">Excluded Licence Agreement</div><div style="font-size:11px;color:var(--muted)">Standard company document · 1 week notice</div></div></button>'
    +'<button onclick="generateAgreement(\''+t.id+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #BFDBFE;border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%"><span style="font-size:18px">📄</span><div><div style="font-size:13px;font-weight:600;color:var(--blue)">AST Agreement</div><div style="font-size:11px;color:var(--muted)">Assured Shorthold Tenancy</div></div></button>'
    +'</div></div>';

  // Tenant portal section — uses standard app password
  var passwords = JSON.parse(localStorage.getItem('pm_tenant_passwords')||'{}');
  // Auto-set standard password if not yet set and tenant has email
  if(t.email && !passwords[t.id]) {
    passwords[t.id] = btoa(PORTAL_PASSWORD);
    localStorage.setItem('pm_tenant_passwords', JSON.stringify(passwords));
  }
  // Ensure portal username exists
  ensurePortalCredentials(t);
  var hasPortal = true; // All tenants can have portal access
  var portalUrl = window.location.href.replace('index.html','').replace(/[^/]*$/, '') + 'tenant-portal.html';
  var portalWaMsg = encodeURIComponent(
    'Hi '+t.name.split(' ')[0]+', your tenant portal is now active!\n\n'
    +'\uD83C\uDF10 *Tenant Portal Link:*\n'+portalUrl+'\n\n'
    +'\uD83D\uDC64 *Username:* '+getPortalUsername(t)+'\n'
    +'\uD83D\uDD11 *Password:* '+getPortalPassword(t)+'\n\n'
    +'You can view your payments, report maintenance issues, upload documents and more.\n\n'
    +'\uD83C\uDFE0 Reservations Direct Limited'
  );
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
  // Load from Supabase tenant-docs storage
  var tVaultSupa = [];
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
        tVaultSupa.push({id:f.name,name:f.name,type:'Document',size:fsz,uploadedAt:fdt,dataUrl:url,storagePath:path,_fromStorage:true});
      });
    }
  } catch(e){console.warn('Tenant docs list err:',e.message);}
  if(tVaultSupa.length){if(!state.vault)state.vault={};if(!state.vault[t.id])state.vault[t.id]=[];tVaultSupa.forEach(function(sd){if(!state.vault[t.id].find(function(d){return d.storagePath===sd.storagePath;}))state.vault[t.id].push(sd);});}
  var tVault = tVaultLocal.concat(tVaultSupa);
  var TENANT_DOC_TYPES = ['Right to Rent','Passport / ID','Proof of Address','Employment Reference','Landlord Reference','Tenancy Application','Bank Statement','NI Number','Other'];
  var vaultRows = tVault.map(function(doc){
    var icon = doc.name&&doc.name.match(/\.pdf$/i)?'📄':doc.name&&doc.name.match(/\.(jpg|jpeg|png)$/i)?'🖼️':'📋';
    var typeColors = {'Right to Rent':'#DCFCE7','Passport / ID':'#EFF6FF','Proof of Address':'#FEF9C3','Employment Reference':'#F3E8FF','Other':'#F1F5F9'};
    var bg = typeColors[doc.type]||'#F1F5F9';
    var textColor = {'Right to Rent':'#166534','Passport / ID':'#1E40AF','Proof of Address':'#854D0E','Employment Reference':'#6B21A8','Other':'#475569'}[doc.type]||'#475569';
    return '<div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 13px;margin-bottom:7px">'
      +'<div style="width:36px;height:36px;border-radius:8px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'+icon+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+doc.name+'</div>'
      +'<div style="display:flex;align-items:center;gap:6px;margin-top:2px">'
      +'<span style="font-size:10px;font-weight:700;color:'+textColor+';background:'+bg+';padding:1px 7px;border-radius:6px">'+doc.type+'</span>'
      +'<span style="font-size:10px;color:var(--muted)">'+doc.size+' · '+doc.uploadedAt+'</span>'
      +'</div></div>'
      +'<div style="display:flex;gap:5px;flex-shrink:0">'
      +(doc.dataUrl?'<button onclick="previewDoc(\''+doc.id+'\')" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--accent-dark);cursor:pointer;font-family:inherit">👁 Preview</button>':'')
        +(doc.dataUrl?'<a href="'+doc.dataUrl+'" download="'+doc.name+'" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--blue);text-decoration:none">↓</a>':'')
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

  var tabContent=tab==='profile'?profileTab:tab==='financials'?financialsTab:tab==='history'?histTab:tab==='vault'?vaultTab:actionsTab;
  var tabs=['profile','financials','history','vault','actions'];
  var tabLabels={profile:'Profile',financials:'Financials',history:'Payment History',vault:'📁 Docs',actions:'Actions'};

  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this){state.tenantDetailTab=null;closeModal()}">'
    +'<div class="modal">'
    +'<div style="padding:16px 18px 0;border-bottom:1px solid var(--border)">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
    +'<div style="width:40px;height:40px;border-radius:12px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:var(--accent-dark);flex-shrink:0">'+t.name[0]+'</div>'
    +'<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800">'+t.name+'</div>'
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
    +tabs.map(function(tv){return '<button onclick="state.tenantDetailTab=\''+tv+'\';openTenantDetail(\''+id+'\')" style="padding:10px 14px;border:none;border-bottom:2px solid '+(tab===tv?'var(--accent)':'transparent')+';background:transparent;font-size:13px;font-weight:'+(tab===tv?700:500)+';color:'+(tab===tv?'var(--accent-dark)':'var(--muted)')+';cursor:pointer;white-space:nowrap;font-family:inherit">'+tabLabels[tv]+'</button>';}).join('')
    +'</div></div>'
    +'<div class="modal-body">'+tabContent+'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="state.tenantDetailTab=null;closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +(t.status==='inactive'
      ?'<button data-tid="'+id+'" onclick="deleteTenantPermanent(this.dataset.tid)" style="padding:9px 16px;border-radius:9px;border:none;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:auto;order:-1">&#x1F5D1; Delete Permanently</button>'
      :'<button data-tid="'+id+'" onclick="archiveTenant(this.dataset.tid)" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-right:auto;order:-1">&#x1F4E6; Archive</button>')
    +'<button onclick="saveTenantDetail(\''+id+'\')" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Changes</button>'
    +'</div></div></div>';
}

function saveTenantDetail(id){
  var t=state.tenants.find(function(x){return x.id===id;});if(!t)return;
  var oldProp=t.property; var oldRoom=t.room;
  var g=function(eid){var el=document.getElementById(eid);return el?el.value:null;};
  if(g('td-name'))t.name=g('td-name')||t.name;
  if(g('td-email')!==null)t.email=g('td-email');
  var wa=g('td-wa');if(wa!==null)t.whatsapp=wa.trim().replace(/\s+/g,'').replace(/^\+/,'');
  if(g('td-prop'))t.property=g('td-prop');
  var newRoom = +g('td-room')||t.room;
  var newProp = g('td-prop')||t.property;
  // Check room isn't taken by another active tenant
  if(newRoom !== t.room || newProp !== t.property) {
    var roomTaken2 = state.tenants.find(function(x){
      return x.property===newProp && x.room===newRoom && x.status!=='inactive' && x.id!==t.id;
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
  if(g('td-status'))t.status=g('td-status');
  var rentEl=g('td-rent');if(rentEl!==null)t.rent=+rentEl||t.rent;
  var arrEl=g('td-arrears');if(arrEl!==null)t.arrears=+arrEl;
  var depEl=g('td-deposit');if(depEl!==null)t.deposit=+depEl;
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
    // Sync room price with tenant rent
    var curProp = state.properties.find(function(p){return p.name===t.property;});
    if(curProp&&curProp.roomList){
      var curRoom = curProp.roomList.find(function(r){return r.n===t.room;});
      if(curRoom) curRoom.price = t.rent;
    }
    recalcProperty(curProp);
  }
  // Rebuild only this tenant's schedule entries so new pay day takes effect immediately
  rebuildTenantSchedule(id);
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
  state.tenantDetailTab = 'actions';
  openTenantDetail(id);

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
  openTenantDetail(id);

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
      <div class="field"><label class="field-label">Property Name</label><input class="inp" id="pd-name" value="${p.name}"></div>
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
    </div>
    <div class="field"><label class="field-label">Full Address</label><input class="inp" id="pd-address" value="${p.address||''}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label class="field-label">Area</label>
        <select class="inp" id="pd-area">
          <option ${p.area==='Brixton'?'selected':''}>Brixton</option>
          <option ${p.area==='Clapham'?'selected':''}>Clapham</option>
          <option ${p.area==='Stockwell'?'selected':''}>Stockwell</option>
          <option ${p.area==='Vauxhall'?'selected':''}>Vauxhall</option>
          <option ${p.area==='Kennington'?'selected':''}>Kennington</option>
          <option ${p.area==='Camberwell'?'selected':''}>Camberwell</option>
          <option ${p.area==='Peckham'?'selected':''}>Peckham</option>
          <option ${p.area==='Dulwich'?'selected':''}>Dulwich</option>
          <option ${p.area==='Streatham'?'selected':''}>Streatham</option>
          <option ${p.area==='Tooting'?'selected':''}>Tooting</option>
          <option ${p.area==='Balham'?'selected':''}>Balham</option>
          <option ${p.area==='Norbury'?'selected':''}>Norbury</option>
          <option ${p.area==='Croydon'?'selected':''}>Croydon</option>
          <option ${p.area==='Thornton Heath'?'selected':''}>Thornton Heath</option>
          <option ${p.area==='Norwood'?'selected':''}>Norwood</option>
          <option ${p.area==='Crystal Palace'?'selected':''}>Crystal Palace</option>
          <option ${p.area==='Sydenham'?'selected':''}>Sydenham</option>
          <option ${p.area==='Lewisham'?'selected':''}>Lewisham</option>
          <option ${p.area==='Deptford'?'selected':''}>Deptford</option>
          <option ${p.area==='New Cross'?'selected':''}>New Cross</option>
          <option ${p.area==='Catford'?'selected':''}>Catford</option>
          <option ${p.area==='Forest Hill'?'selected':''}>Forest Hill</option>
          <option ${p.area==='Lambeth'?'selected':''}>Lambeth</option>
          <option ${p.area==='Wandsworth'?'selected':''}>Wandsworth</option>
          <option ${p.area==='Southwark'?'selected':''}>Southwark</option>
          <option ${p.area==='Bermondsey'?'selected':''}>Bermondsey</option>
          <option ${p.area==='Other'?'selected':''}>Other</option>
        </select>
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
          <div class="field" style="margin:0"><label class="field-label">Landlord Name</label><input class="inp" id="pd-lname" value="${p.landlordName||''}"></div>
          <div class="field" style="margin:0"><label class="field-label">Landlord Phone</label><input class="inp" id="pd-lphone" value="${p.landlordPhone||''}"></div>
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
        ${(state.companies||[]).map(c=>'<option value="'+c.id+'" '+(p.companyId===c.id?'selected':'')+'>'+c.name+'</option>').join('')}
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
              <span style="font-size:10px;color:var(--muted)">/wk</span>
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
            <div style="font-size:13px;font-weight:600">${t.name}</div>
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
              <div style="font-size:12px;font-weight:600;color:var(--muted)">${t.name}</div>
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
    {v:'docs',     l:'📁 Docs'},
  ];

  const docsTab     = (tab==='docs')    ? (await renderPropDocsTab(p)) : '<div></div>';
  const financeTab  = (tab==='finance') ? renderPropFinanceTab(p, propTenants) : '<div></div>';
  const tabContent  = tab==='details'  ? detailsTab
                    : tab==='rooms'    ? roomsTab
                    : tab==='tenants'  ? tenantsTab
                    : tab==='finance'  ? financeTab
                    : docsTab;

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this){state.propDetailTab=null;closeModal()}">
      <div class="modal" style="max-width:580px">
        <div class="modal-header" style="padding:16px 20px">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:700;margin-bottom:2px">${p.name}</div>
            <div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px">
              <span>${p.area}</span>
              <span>·</span>
              <span style="color:${n2>=0?'var(--green)':'var(--red)'};font-weight:600">${fmt(n2)} profit/mo</span>
              <span>·</span>
              <span style="color:${oc};font-weight:600">${o}% occupied</span>
            </div>
          </div>
          <button class="modal-close" onclick="state.propDetailTab=null;closeModal()">×</button>
        </div>

        <!-- Tab bar -->
        <div style="display:flex;border-bottom:1px solid var(--border);padding:0 20px;background:var(--bg)">
          ${tabs.map(t=>`
            <button onclick="state.propDetailTab='${t.v}';openPropDetail('${p.id}')"
              style="padding:10px 16px;border:none;border-bottom:2px solid ${tab===t.v?'var(--accent)':'transparent'};
                margin-bottom:-1px;background:transparent;cursor:pointer;font-family:inherit;
                color:${tab===t.v?'var(--accent-dark)':'var(--muted)'};font-size:13px;font-weight:${tab===t.v?700:500};
                white-space:nowrap;transition:all .15s">
              ${t.l}
            </button>`).join('')}
        </div>

        <div style="padding:20px;max-height:65vh;overflow-y:auto">
          ${tabContent}
        </div>

        ${tab==='details'?`
        <div class="modal-footer" style="padding:14px 20px">
          ${btn('Cancel',"state.propDetailTab=null;closeModal()",'secondary')}
          ${p.status==='archived'
            ? `<button onclick="deletePropPermanent('${p.id}')" style="padding:9px 16px;border-radius:9px;border:none;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:auto">🗑 Delete</button>
               <button onclick="restoreProperty('${p.id}')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--green);background:var(--green-light);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">↩ Restore</button>`
            : `<button onclick="archiveProperty('${p.id}')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-right:auto">📦 Archive</button>`
          }
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
