// ── ACTIONS ───────────────────────────────────────────────────────────────────
function getTodayLocalMidnight() {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function getNextPayDate(fromDate,freq,payDay,payDayOfMonth){
  var d=new Date(fromDate);
  if(freq==='weekly'){var target=DAYS.indexOf(payDay);var cur=d.getDay();var diff=(target-cur+7)%7;d.setDate(d.getDate()+(diff===0?7:diff));}
  else{var dom=+payDayOfMonth||1;d.setDate(dom);if(d<=fromDate)d.setMonth(d.getMonth()+1);}
  return d;
}
function dateToStr(d){return formatLocalDateISO(d);}
function generateSchedule(tenant){
  if(tenant.status==='inactive') return [];
  var entries=[];
  var freq=tenant.freq||'weekly';
  var payDay=tenant.payDay||'Friday';
  var payDom=tenant.payDayOfMonth||1;

  // Generate from (today - WEEKS_AHEAD weeks) so overdue entries appear in the rent page
  var todayMid = getTodayLocalMidnight();
  var pastWindow = new Date(todayMid.getTime() - WEEKS_AHEAD * 7 * 86400000);
  var startRaw = tenant.startDate || tenant.moveIn;
  var startD = startRaw ? new Date(startRaw) : pastWindow;
  if(isNaN(startD.getTime())) startD = pastWindow;
  var genFrom = startD > pastWindow ? startD : pastWindow;
  // Search from one day before the window start
  var searchFrom = new Date(genFrom.getTime() - 86400000);
  var nextDue = getNextPayDate(searchFrom, freq, payDay, payDom);
  // Safety: never show dates before tenancy started
  while(nextDue < startD) {
    nextDue = getNextPayDate(nextDue, freq, payDay, payDom);
  }

  var count = freq==='weekly' ? WEEKS_AHEAD*2 : 6; // past + future window
  for(var i=0; i<count; i++){
    var nextDueMidnight = new Date(nextDue.getFullYear(), nextDue.getMonth(), nextDue.getDate());
    if (tenant.moveOutDate) {
      var moveOutCap = new Date(tenant.moveOutDate);
      if (!isNaN(moveOutCap.getTime())) {
        moveOutCap = new Date(moveOutCap.getFullYear(), moveOutCap.getMonth(), moveOutCap.getDate());
        if (nextDueMidnight > moveOutCap) break;
      }
    }
    var isOverdue = nextDueMidnight < todayMid;
    var isToday   = nextDueMidnight.getTime() === todayMid.getTime();
    entries.push({
      id: String(tenant.id)+'_sch_'+nextDueMidnight.getTime(),
      tenantId: tenant.id, tenantName: tenant.name,
      property: tenant.property, room: tenant.room,
      amount: tenant.rent, dueDate: dateToStr(nextDue),
      dueDateRaw: nextDueMidnight.getTime(), method: tenant.method,
      status: isOverdue?'overdue':isToday?'due_today':'upcoming',
      freq: freq, payDay: payDay, type: 'schedule'
    });
    nextDue = getNextPayDate(nextDue, freq, payDay, payDom);
  }
  return entries;
}
function syncSchedulePaidFromPayments(){
  var paidKeys = new Set();
  var paidDueDayKeys = new Set();
  state.payments.forEach(function(p){
    if(p.status!=='paid') return;
    var tn = p.tenantName||p.tenant||'';
    if(p._dueDateRaw != null && p._dueDateRaw !== '' && !isNaN(+p._dueDateRaw)) {
      paidKeys.add(tn+'_'+p._dueDateRaw);
      paidDueDayKeys.add(tn+'|'+formatLocalDateISO(new Date(+p._dueDateRaw)));
    }
    if(p._paidDateRaw) {
      for(var d=-3; d<=3; d++) paidKeys.add(tn+'_'+(p._paidDateRaw + d*86400000));
    }
  });
  state.rentSchedule.forEach(function(s){
    var key = (s.tenantName||'')+'_'+s.dueDateRaw;
    if(paidKeys.has(key)) { s.status = 'paid'; return; }
    var dayKey = (s.tenantName||'')+'|'+formatLocalDateISO(new Date(s.dueDateRaw));
    if(paidDueDayKeys.has(dayKey)) s.status = 'paid';
  });
}

/**
 * Paid rows saved with Date#toISOString() due_date lost one local day (e.g. UK BST).
 * Stored due = D−1, paid_date = D on the real due day → schedule never matches after reload.
 * Nudge due onto the unpaid slot that falls on the paid day, then re-sync.
 */
function repairPaymentDueDatesUtcShift() {
  if (!state.payments || !state.rentSchedule) return;
  var changed = false;
  state.payments.forEach(function(p) {
    if (String(p.status).toLowerCase() !== 'paid') return;
    if (p.isPartial || p._partial || p._arrearsClearance) return;
    if (p._dueDateRaw == null || p._dueDateRaw === '' || isNaN(+p._dueDateRaw)) return;
    if (p._paidDateRaw == null || isNaN(+p._paidDateRaw)) return;
    var tn = p.tenantName || p.tenant;
    if (!tn) return;
    var dueMid = new Date(+p._dueDateRaw);
    var paidMid = new Date(+p._paidDateRaw);
    if (formatLocalDateISO(dueMid) === formatLocalDateISO(paidMid)) return;
    var dayDiff = Math.round((paidMid.getTime() - dueMid.getTime()) / 86400000);
    if (dayDiff !== 1) return;
    var paidDayStr = formatLocalDateISO(paidMid);
    var sched = state.rentSchedule.find(function(s) {
      return s.tenantName === tn && s.status !== 'paid'
        && formatLocalDateISO(new Date(s.dueDateRaw)) === paidDayStr;
    });
    if (!sched) return;
    p.dueDate = formatLocalDateISO(new Date(sched.dueDateRaw));
    p._dueDateRaw = sched.dueDateRaw;
    changed = true;
  });
  if (changed) syncSchedulePaidFromPayments();
}

function rebuildAllSchedules(){
  var newSchedule = [];
  state.tenants.filter(function(t){return t.status==='active'||t.status==='notice_given';}).forEach(function(t){
    newSchedule = newSchedule.concat(generateSchedule(t));
  });
  state.rentSchedule = newSchedule;
  syncSchedulePaidFromPayments();
}

// One-shot utility: bump every active tenant's check-in / start date to today,
// drop any stale auto-rolled overdue schedule rows, and rebuild from scratch.
// Run from the JS console: resetAllTenantStartDatesToToday()
function resetAllTenantStartDatesToToday(opts){
  opts = opts || {};
  var todayISO = formatLocalDateISO(new Date());
  var tenants = (state.tenants||[]).filter(function(t){
    return t && t.status !== 'inactive';
  });
  if(!tenants.length){
    if(typeof showToast === 'function') showToast('No active tenants to update','info');
    return 0;
  }
  if(!opts.skipConfirm){
    var ok = confirm('Set check-in / start date to TODAY ('+todayISO+') for '+tenants.length+
      ' active tenant'+(tenants.length===1?'':'s')+'?\n\nThis also clears any auto-generated overdue rent entries dated before today.');
    if(!ok) return 0;
  }
  var n = 0;
  tenants.forEach(function(t){
    t.startDate = todayISO;
    // Some legacy code paths read moveIn / checkIn instead of startDate — keep
    // them in sync so generateSchedule() and the various renderers all agree.
    if('moveIn' in t || t.moveIn !== undefined) t.moveIn = todayISO;
    if('checkIn' in t || t.checkIn !== undefined) t.checkIn = todayISO;
    n++;
  });
  // Wipe and regenerate the schedule so nothing pre-today survives.
  if(typeof rebuildAllSchedules === 'function') rebuildAllSchedules();
  if(typeof saveState === 'function') saveState();
  if(typeof render === 'function') render();
  if(typeof showToast === 'function') showToast('Reset '+n+' tenant start date'+(n===1?'':'s')+' to '+todayISO+' ✓','success');
  return n;
}
// Expose on window so it can be called from the console without needing a UI.
if(typeof window !== 'undefined') window.resetAllTenantStartDatesToToday = resetAllTenantStartDatesToToday;

// Rebuild schedule for a single tenant only (faster after individual edits)
function rebuildTenantSchedule(tenantId){
  var idStr = String(tenantId);
  state.rentSchedule = (state.rentSchedule||[]).filter(function(s){
    return String(s.tenantId) !== idStr;
  });
  var t = state.tenants.find(function(x){ return String(x.id) === idStr; });
  if(t && (t.status==='active'||t.status==='notice_given')){
    state.rentSchedule = state.rentSchedule.concat(generateSchedule(t));
  }
  syncSchedulePaidFromPayments();
}

function markSchedulePaid(schedId,method){
  var s=state.rentSchedule.find(function(x){return String(x.id)===String(schedId);});
  if(!s) return;
  // Double-click guard — without this, rapid clicks before the 1.5 s debounced save flushes
  // create duplicate payment rows in state.payments (each with a fresh UUID, both saved to DB).
  if(s.status === 'paid') return;
  s.status='paid';
  var t=state.tenants.find(function(x){return x.id===s.tenantId;});
  if(t){
    var dueDateISO=formatLocalDateISO(new Date(s.dueDateRaw));
    var now=new Date();
    var paidRaw=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    // Collected tab filters by paidDate in the selected period — must be the day rent was received, not the due date.
    var paidStr=now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    t.paid=paidStr;
    state.payments.push({
      id:crypto.randomUUID(),tenant:s.tenantName,tenantName:s.tenantName,tenantId:s.tenantId,
      property:s.property,propertyName:s.property,amount:s.amount,date:paidStr,dueDate:dueDateISO,paidDate:paidStr,
      method:method,status:'paid',_dueDateRaw:s.dueDateRaw,_paidDateRaw:paidRaw
    });
  }

  // Flush immediately rather than wait for the 1.5 s debounce — payment-marking is a
  // critical action and a refresh before the debounce loses the new payment row.
  saveStateImmediate({silentSuccess:true});
}
function markPartialPaid(id, fullAmount) {
  if (!requirePerm('canMarkPaid')) return;
  // Show inline modal - prompt() doesn't work on all mobile browsers
  var tenantName = '';
  var idStr = String(id);
  if(idStr.indexOf('_sch_') >= 0) {
    var s = state.rentSchedule.find(function(x){return String(x.id)===idStr;});
    if(s) tenantName = s.tenantName;
  } else {
    var pay0 = state.payments.find(function(p){return String(p.id)===idStr;});
    if(pay0) tenantName = pay0.tenant;
  }

  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:360px">'
    +'<div class="modal-header"><span class="modal-title">💷 Partial Payment</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body">'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:14px">'+tenantName+' · Full amount: <strong>'+fmt(fullAmount)+'</strong></div>'
    +'<div class="field"><label class="field-label">Amount Received (£)</label>'
    +'<input type="hidden" id="partial-id" value="'+idStr+'">'
    +'<input type="hidden" id="partial-full" value="'+fullAmount+'">'
    +'<input class="inp" id="partial-amount-inp" type="number" placeholder="'+fullAmount+'" inputmode="decimal" style="font-size:18px;font-weight:700">'
    +'</div>'
    +'<div id="partial-shortfall-preview" style="font-size:12px;color:var(--amber);margin-top:6px;min-height:18px"></div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button onclick="confirmPartialPaid()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Confirm Partial</button>'
    +'</div></div></div></div>';

  // Live shortfall preview
  var inp = document.getElementById('partial-amount-inp');
  if(inp) {
    inp.focus();
    inp.addEventListener('input', function(){
      var v = parseFloat(inp.value)||0;
      var sf = Math.round((fullAmount - v)*100)/100;
      var el = document.getElementById('partial-shortfall-preview');
      if(el) el.textContent = v>0 && v<fullAmount ? '⚠️ Shortfall: £'+sf+' will be added to arrears' : '';
    });
  }
}

function confirmPartialPaid() {
  var inp = document.getElementById('partial-amount-inp');
  var idEl = document.getElementById('partial-id');
  var fullEl = document.getElementById('partial-full');
  if(!inp||!idEl||!fullEl) return;
  var id = idEl.value;
  var fullAmount = parseFloat(fullEl.value);
  var partial = parseFloat(inp.value);
  if(isNaN(partial) || partial <= 0) { inp.focus(); return; }
  if(partial >= fullAmount) { closeModal(); markPaid(String(id), 'bank'); return; }
  var shortfall = Math.round((fullAmount - partial) * 100) / 100;
  var idStr = String(id);
  var found = false;
  if(idStr.indexOf('_sch_') >= 0) {
    var s = state.rentSchedule.find(function(x){return String(x.id)===idStr;});
    if(s) {
      var t = state.tenants.find(function(x){return x.name===s.tenantName;});
      var _dueDateISO = formatLocalDateISO(new Date(s.dueDateRaw));
      var _paidStr = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      var _pr = new Date();
      var _paidRawPartial = new Date(_pr.getFullYear(),_pr.getMonth(),_pr.getDate()).getTime();
      state.payments.push({
        id: crypto.randomUUID(), tenant: s.tenantName, tenantName: s.tenantName,
        tenantId: s.tenantId, property: s.property, propertyName: s.property,
        amount: partial, method: 'bank', status: 'paid',
        date: _paidStr, paidDate: _paidStr, dueDate: _dueDateISO,
        _dueDateRaw: s.dueDateRaw, _paidDateRaw: _paidRawPartial, isPartial: true, shortfall: shortfall,
        _partial: true, _shortfall: shortfall
      });
      if(t) { t.arrears = Math.round(((t.arrears||0) + shortfall) * 100) / 100; }
      // Keep schedule entry as outstanding but reduce amount shown
      s.amount = shortfall;
      s._partialPaid = partial;
      found = true;
    }
  } else {
    var pay = state.payments.find(function(p){return String(p.id)===idStr;});
    if(pay) {
      var t2 = state.tenants.find(function(x){return x.name===pay.tenant;});
      // Keep in outstanding — reduce amount to shortfall
      pay.amount = shortfall;
      pay._partial = true; pay._shortfall = shortfall; pay._partialPaid = partial;
      if(t2) { t2.arrears = Math.round(((t2.arrears||0) + shortfall) * 100) / 100; }
      found = true;
    }
  }
  closeModal();
  if(found) {
    // Persist the partial-payment state (new payment row, updated arrears, modified schedule entry).
    // The previous version called only render() — leaving the changes in memory only,
    // so a refresh before any other autosave-triggering action would lose the partial payment.
    saveStateImmediate({silentSuccess:true});
    render();
  }
}

function markPaid(id,method){
  if (!requirePerm('canMarkPaid')) return;
  var idStr=String(id);
  // Handle arrears clearance entry
  if(idStr.startsWith('arrears_')) {
    var _tidStr = idStr.replace('arrears_', '');
    // Support both numeric ids and UUID string ids
    var ta = state.tenants.find(function(x){return String(x.id)===_tidStr;});
    if(ta) {
      var _aDate = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      var _aNow = new Date(); var _aISO = formatLocalDateISO(_aNow);
      var _aRaw = new Date(_aNow.getFullYear(),_aNow.getMonth(),_aNow.getDate()).getTime();
      state.payments.push({
        id: crypto.randomUUID(), tenant: ta.name, tenantName: ta.name,
        tenantId: ta.id, property: ta.property, propertyName: ta.property,
        amount: ta.arrears, method: method||'bank', status: 'paid',
        date: _aDate, paidDate: _aDate, dueDate: _aISO, _dueDateRaw: _aRaw,
        _arrearsClearance: true
      });
      var _paidAmount = ta.arrears;
      ta.arrears = 0;
      // Auto-send payment receipt + landlord notice (use captured amount before zeroing)
      if(ta.email && typeof sendPaymentReceiptEmail==='function') sendPaymentReceiptEmail(ta, {amount:_paidAmount});
      if(typeof sendLandlordPaymentNotice==='function') sendLandlordPaymentNotice(ta, {amount:_paidAmount});
    }
    saveStateImmediate({silentSuccess:true});
    render(); return;
  }
  if(idStr.indexOf('_sch_')>=0){markSchedulePaid(id,method);render();return;}
  var found=false;
  var paidRaw=new Date(); paidRaw=new Date(paidRaw.getFullYear(),paidRaw.getMonth(),paidRaw.getDate()).getTime();
  var paidStrNow=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  // Optimistic UI: flip the clicked button visually immediately so the click
  // feels responsive even when the full re-render (which can be slow on large
  // portfolios) is still pending. The real render follows in rAF.
  try {
    var _btn = event && event.target && event.target.closest ? event.target.closest('button') : null;
    if(_btn) {
      _btn.disabled = true;
      _btn.style.opacity = '.55';
      _btn.style.cursor = 'wait';
    }
  } catch(_e) {}
  state.payments=state.payments.map(function(p){if(String(p.id)===idStr){found=true;return Object.assign({},p,{status:'paid',paidMethod:method,_paidDateRaw:paidRaw,paidDate:paidStrNow,date:paidStrNow});}return p;});
  if(!found){var s=state.rentSchedule.find(function(x){return String(x.id)===idStr;});if(s)markSchedulePaid(id,method);}
  // Defer the expensive work (email send + full re-render) to the next animation
  // frame so the browser paints the disabled button first. Net user-visible
  // latency is the same; perceived latency drops significantly on large portfolios.
  var _afterPaid = function(){
    var paidPay = state.payments.find(function(p){return String(p.id)===idStr;});
    if(paidPay && paidPay.tenantId){
      var paidTenant = state.tenants.find(function(t){return String(t.id)===String(paidPay.tenantId);});
      if(paidTenant && typeof sendPaymentReceiptEmail==='function') sendPaymentReceiptEmail(paidTenant, paidPay);
      if(paidTenant && typeof sendLandlordPaymentNotice==='function') sendLandlordPaymentNotice(paidTenant, paidPay);
    }
    saveState();
    render();
  };
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(_afterPaid);
  else setTimeout(_afterPaid, 0);
}

function recalcProperty(p) {
  if(!p || !p.name) return;
  // Without the !p.name guard, `t.property === undefined` would match every tenant whose
  // property field is also undefined — corrupting the occupied count for the broken property.
  // Occupancy uses non-inactive tenants (so notice/pending all "occupy" a room).
  var occTenants = state.tenants.filter(function(t){return t.property===p.name&&t.status!=='inactive';});
  var list = p.roomList||[];
  var fromRooms = list.filter(function(r){return r.status==='occupied';}).length;
  if ((p.lettingType||'hmo')==='whole') {
    p.occupied = occTenants.length > 0 ? Math.min(occTenants.length, p.rooms||1) : 0;
  } else if (list.length) {
    p.occupied = fromRooms;
    if (fromRooms===0 && occTenants.length>0) {
      p.occupied = Math.min(occTenants.length, list.length);
    }
  } else {
    p.occupied = occTenants.length;
  }
  // Rent uses ONLY billable tenants (active + notice). Same predicate as dashboard
  // expectedIncome — eliminates the £16k discrepancy that came from each page
  // using a different filter.
  var billable = state.tenants.filter(function(t){return t.property===p.name && isBillableTenant(t);});
  p.rent = Math.round(billable.reduce(function(s,t){ return s + tenantMonthlyRent(t); }, 0));
}
function freeRoom(propName, roomN) {
  var p = state.properties.find(function(x){return x.name===propName;});
  if(!p||!p.roomList) return;
  var r = p.roomList.find(function(rm){return roomNumsEqual(rm.n, roomN);});
  if(r) r.status = 'vacant';
  recalcProperty(p);
  if(!state.voidDates) state.voidDates={};
  var key = p.id+'_'+roomN;
  if(!state.voidDates[key]) state.voidDates[key] = new Date().toISOString().split('T')[0];
}
function occupyRoom(propName, roomN, rentAmount) {
  var p = state.properties.find(function(x){return x.name===propName;});
  if(!p) return;
  if(p.roomList && p.roomList.length){
    var r = p.roomList.find(function(rm){return roomNumsEqual(rm.n, roomN);});
    if(r) {
      r.status = 'occupied';
      if(rentAmount && +rentAmount > 0) r.price = +rentAmount;
    }
  }
  recalcProperty(p);
  if(state.voidDates) delete state.voidDates[p.id+'_'+roomN];
}

async function deleteMaintenanceJob(id){
  if (!requirePerm('canDelete', 'delete a maintenance job')) return;
  var m=state.maintenance.find(function(x){return String(x.id)===String(id);});
  if(!m)return;
  if(!confirm('Delete this job?\n\n'+m.issue+'\n\nThis cannot be undone.')) return;

  // Tombstone the id so any concurrent bulk autosave can't re-INSERT this row
  // via its upsert ON CONFLICT path (delete-then-autosave race). 60 s expiry.
  if (typeof markRowDeleted === 'function') markRowDeleted('maintenance', String(id));

  // Targeted DB delete must succeed before we mutate state — otherwise a failed delete
  // (e.g. RLS, network) leaves the row in DB and it reappears on next page load.
  // .select() forces the row count back so RLS-silent-failure (200 + 0 rows) is caught.
  var res = await supa.from('maintenance').delete().eq('id', String(id)).eq('org_id', _currentOrgId).select('id');
  if (res.error) { showToast('Delete failed: ' + res.error.message, 'error'); return; }
  if (!res.data || res.data.length === 0) { showToast('Delete blocked — no row removed (likely RLS).', 'error'); return; }

  state.maintenance=state.maintenance.filter(function(x){return String(x.id)!==String(id);});
  state.expenses=state.expenses.filter(function(e){return e._maintId!==id;});
  if(state.maintExtras)delete state.maintExtras[id];
  saveState();render();showToast('Job deleted','success');
}
function updMaint(id,status){state.maintenance=state.maintenance.map(m=>m.id===id?{...m,status}:m);saveState();render()}
function confirmExp(id){
  var e=state.expenses.find(function(x){return String(x.id)===String(id);});
  if(e){e.status='confirmed';}
  saveState();render();
}
function removeExp(id){
  var e=state.expenses.find(function(x){return String(x.id)===String(id);});
  if(!e) return;
  if(!confirm('Remove this expense?\n\n'+e.desc+' · '+fmt(e.amount)+(e.recurring?'\n⚠️ This is a recurring expense.':''))) return;
  supaDelete('expenses',id);
  state.expenses=state.expenses.filter(function(x){return String(x.id)!==String(id);});
  saveState();render();
}
function editExpModal(id){
  var e=state.expenses.find(function(x){return String(x.id)===String(id);});
  if(!e) return;
  var propOpts='<option value="">— Portfolio-wide —</option>'
    +state.properties.filter(function(p){return isPropertyActive(p)||p.name===e.property;}).map(function(p){return '<option value="'+p.name+'" '+(e.property===p.name?'selected':'')+'>'+p.name+'</option>';}).join('');
  var coOpts='<option value="">— Unassigned —</option>'
    +(state.companies||[]).map(function(c){return '<option value="'+c.id+'" '+(e.companyId===c.id?'selected':'')+'>'+c.name+'</option>';}).join('');
  var freqVal = e.freq||'one-off';
  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal"><div class="modal-header"><span class="modal-title">✏️ Edit Expense</span>'
    +'<button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label class="field-label">Category</label>'
    +'<select class="inp" id="ee-cat">'
    +'<optgroup label="🏠 Property Running Costs">'
    +['Council Tax','Energy – Gas','Energy – Electric','Water','Internet / Broadband','Cleaning','Maintenance & Repairs','Insurance','HMO Licence','Property Costs'].map(function(c){return '<option value="'+c+'" '+(e.cat===c?'selected':'')+'>'+c+'</option>';}).join('')
    +'</optgroup><optgroup label="👷 Staff & Labour">'
    +['Staff & Labour','Contractor'].map(function(c){return '<option value="'+c+'" '+(e.cat===c?'selected':'')+'>'+c+'</option>';}).join('')
    +'</optgroup><optgroup label="⚙️ Business Overhead">'
    +['Software & Tools','Accountancy','Legal','Overhead'].map(function(c){return '<option value="'+c+'" '+(e.cat===c?'selected':'')+'>'+c+'</option>';}).join('')
    +'</optgroup></select></div>'
    +'<div class="field"><label class="field-label">Description *</label>'
    +'<input class="inp" id="ee-desc" value="'+e.desc.replace(/"/g,'&quot;')+'"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Amount (£)</label>'
    +'<input class="inp" id="ee-amt" type="number" step="0.01" value="'+(e.amount||0)+'"></div>'
    +'<div class="field"><label class="field-label">Frequency</label>'
    +'<select class="inp" id="ee-freq">'
    +'<option value="one-off" '+(freqVal==='one-off'?'selected':'')+'>One-off</option>'
    +'<option value="weekly" '+(freqVal==='weekly'?'selected':'')+'>Weekly</option>'
    +'<option value="monthly" '+(freqVal==='monthly'?'selected':'')+'>Monthly</option>'
    +'<option value="annual" '+(freqVal==='annual'?'selected':'')+'>Annual</option>'
    +'</select></div></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Status</label>'
    +'<select class="inp" id="ee-status">'
    +'<option value="estimated" '+(e.status==='estimated'?'selected':'')+'>Estimated</option>'
    +'<option value="confirmed" '+(e.status==='confirmed'?'selected':'')+'>Confirmed</option>'
    +'</select></div>'
    +'<div class="field"><label class="field-label">Date</label>'
    +'<input class="inp" id="ee-date" type="date" value="'+(e.startDate||'')+'"></div></div>'
    +'<div class="field"><label class="field-label">Property (optional)</label>'
    +'<select class="inp" id="ee-prop">'+propOpts+'</select></div>'
    +'<div class="field"><label class="field-label">🏢 Company</label>'
    +'<select class="inp" id="ee-co">'+coOpts+'</select></div>'
    +'<div class="modal-footer">'
    +btn('Cancel','closeModal()','secondary')
    +btn('Save Changes','saveExpEdit(\''+id+'\')','primary')
    +'</div></div></div></div>';
}
function saveExpEdit(id){
  var e=state.expenses.find(function(x){return String(x.id)===String(id);});
  if(!e) return;
  var desc=document.getElementById('ee-desc').value.trim();
  if(!desc){alert('Please enter a description.');return;}
  var amt=+(document.getElementById('ee-amt').value)||0;
  if(amt<=0){alert('Please enter a valid amount.');return;}
  var cat=(document.getElementById('ee-cat')||{value:''}).value;
  var staffCats=['Staff & Labour','Contractor'];
  var propCats=['Council Tax','Energy – Gas','Energy – Electric','Water','Internet / Broadband','Cleaning','Maintenance & Repairs','Insurance','HMO Licence','Property Costs'];
  e.cat=cat;
  e.type=staffCats.includes(cat)?'staff':propCats.includes(cat)?'property':'overhead';
  e.desc=desc;
  e.amount=amt;
  e.freq=(document.getElementById('ee-freq')||{value:'one-off'}).value;
  e.recurring=e.freq!=='one-off';
  e.status=(document.getElementById('ee-status')||{value:'estimated'}).value;
  e.startDate=(document.getElementById('ee-date')||{value:''}).value||null;
  e.property=(document.getElementById('ee-prop')||{value:''}).value||null;
  e.companyId=(document.getElementById('ee-co')||{value:''}).value||null;
  closeModal();
  saveState();
  render();
}
