// ── ACTIONS ───────────────────────────────────────────────────────────────────
function getNextPayDate(fromDate,freq,payDay,payDayOfMonth){
  var d=new Date(fromDate);
  if(freq==='weekly'){var target=DAYS.indexOf(payDay);var cur=d.getDay();var diff=(target-cur+7)%7;d.setDate(d.getDate()+(diff===0?7:diff));}
  else{var dom=+payDayOfMonth||1;d.setDate(dom);if(d<=fromDate)d.setMonth(d.getMonth()+1);}
  return d;
}
function dateToStr(d){return d.toISOString().split('T')[0];}
function generateSchedule(tenant){
  if(!tenant.startDate||tenant.status==='inactive') return [];
  var entries=[];
  var freq=tenant.freq||'weekly';
  var payDay=tenant.payDay||'Friday';
  var payDom=tenant.payDayOfMonth||1;
  var startD=new Date(tenant.startDate);

  // Generate from (today - WEEKS_AHEAD weeks) so overdue entries appear in the rent page
  var pastWindow = new Date(TODAY.getTime() - WEEKS_AHEAD * 7 * 86400000);
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
    var isOverdue = nextDue < TODAY;
    var isToday   = nextDue.toDateString() === TODAY.toDateString();
    var nextDueMidnight = new Date(nextDue.getFullYear(), nextDue.getMonth(), nextDue.getDate());
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
function rebuildAllSchedules(){
  // Wipe and regenerate fresh — paid status comes from state.payments, not stale localStorage
  var newSchedule = [];
  state.tenants.filter(function(t){return t.status==='active'||t.status==='notice_given';}).forEach(function(t){
    newSchedule = newSchedule.concat(generateSchedule(t));
  });
  // Cross-reference with actual payments to mark schedule entries as paid
  // Use a set of {tenantName}_{dueDateRaw} keys from paid payments
  var paidKeys = new Set();
  state.payments.forEach(function(p){
    if(p.status!=='paid') return;
    var tn = p.tenantName||p.tenant||'';
    // Match by due date raw
    if(p._dueDateRaw) paidKeys.add(tn+'_'+p._dueDateRaw);
    // Also match by paid date ±3 days (handles payments logged on slightly different dates)
    if(p._paidDateRaw) {
      for(var d=-3; d<=3; d++) paidKeys.add(tn+'_'+(p._paidDateRaw + d*86400000));
    }
  });
  newSchedule.forEach(function(s){
    var key = (s.tenantName||'')+'_'+s.dueDateRaw;
    if(paidKeys.has(key)) s.status = 'paid';
  });
  state.rentSchedule = newSchedule;
}

// Rebuild schedule for a single tenant only (faster after individual edits)
function rebuildTenantSchedule(tenantId){
  // Remove all existing entries for this tenant
  state.rentSchedule = (state.rentSchedule||[]).filter(function(s){
    return s.tenantId !== tenantId;
  });
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(t && t.status==='active'){
    state.rentSchedule = state.rentSchedule.concat(generateSchedule(t));
  }
}

function markSchedulePaid(schedId,method){
  var s=state.rentSchedule.find(function(x){return String(x.id)===String(schedId);});if(!s)return;s.status='paid';
  var t=state.tenants.find(function(x){return x.id===s.tenantId;});
  if(t){
    t.paid=new Date(s.dueDateRaw).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    var dueDateISO=new Date(s.dueDateRaw).toISOString().split('T')[0];
    var now=new Date();
    var paidRaw=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    state.payments.push({
      id:crypto.randomUUID(),tenant:s.tenantName,tenantName:s.tenantName,tenantId:s.tenantId,
      property:s.property,propertyName:s.property,amount:s.amount,date:t.paid,dueDate:dueDateISO,paidDate:t.paid,
      method:method,status:'paid',_dueDateRaw:s.dueDateRaw,_paidDateRaw:paidRaw
    });
  }

  saveState();
}
function markPartialPaid(id, fullAmount) {
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
      var _dueDateISO = new Date(s.dueDateRaw).toISOString().split('T')[0];
      var _paidStr = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      state.payments.push({
        id: crypto.randomUUID(), tenant: s.tenantName, tenantName: s.tenantName,
        tenantId: s.tenantId, property: s.property, propertyName: s.property,
        amount: partial, method: 'bank', status: 'paid',
        date: _paidStr, paidDate: _paidStr, dueDate: _dueDateISO,
        _dueDateRaw: s.dueDateRaw, isPartial: true, shortfall: shortfall,
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
  if(found) render();
}

function markPaid(id,method){
  var idStr=String(id);
  // Handle arrears clearance entry
  if(idStr.startsWith('arrears_')) {
    var _tidStr = idStr.replace('arrears_', '');
    // Support both numeric ids and UUID string ids
    var ta = state.tenants.find(function(x){return String(x.id)===_tidStr;});
    if(ta) {
      var _aDate = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      var _aNow = new Date(); var _aISO = _aNow.toISOString().split('T')[0];
      var _aRaw = new Date(_aNow.getFullYear(),_aNow.getMonth(),_aNow.getDate()).getTime();
      state.payments.push({
        id: crypto.randomUUID(), tenant: ta.name, tenantName: ta.name,
        tenantId: ta.id, property: ta.property, propertyName: ta.property,
        amount: ta.arrears, method: method||'bank', status: 'paid',
        date: _aDate, paidDate: _aDate, dueDate: _aISO, _dueDateRaw: _aRaw,
        _arrearsClearance: true
      });
      ta.arrears = 0;
    }
    render(); return;
  }
  if(idStr.indexOf('_sch_')>=0){markSchedulePaid(id,method);render();return;}
  var found=false;
  var paidRaw=new Date(); paidRaw=new Date(paidRaw.getFullYear(),paidRaw.getMonth(),paidRaw.getDate()).getTime();
  state.payments=state.payments.map(function(p){if(String(p.id)===idStr){found=true;return Object.assign({},p,{status:'paid',paidMethod:method,_paidDateRaw:paidRaw});}return p;});
  if(!found){var s=state.rentSchedule.find(function(x){return String(x.id)===idStr;});if(s)markSchedulePaid(id,method);}
  saveState();
  render();
}

function recalcProperty(p) {
  if(!p) return;
  var tenants = state.tenants.filter(function(t){return t.property===p.name&&t.status!=='inactive';});
  var list = p.roomList||[];
  var fromRooms = list.filter(function(r){return r.status==='occupied';}).length;
  if ((p.lettingType||'hmo')==='whole') {
    p.occupied = tenants.length > 0 ? Math.min(tenants.length, p.rooms||1) : 0;
  } else if (list.length) {
    p.occupied = fromRooms;
    if (fromRooms===0 && tenants.length>0) {
      p.occupied = Math.min(tenants.length, list.length);
    }
  } else {
    p.occupied = tenants.length;
  }
  p.rent = Math.round(tenants.reduce(function(s,t){
    return s + (t.freq==='monthly' ? t.rent : (t.rent||0)*52/12);
  }, 0));
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

function deleteMaintenanceJob(id){
  var m=state.maintenance.find(function(x){return String(x.id)===String(id);});
  if(!m)return;
  if(!confirm('Delete this job?\n\n'+m.issue+'\n\nThis cannot be undone.')) return;
  state.maintenance=state.maintenance.filter(function(x){return String(x.id)!==String(id);});
  state.expenses=state.expenses.filter(function(e){return e._maintId!==id;});
  if(state.maintExtras)delete state.maintExtras[id];
  try{supa.from('maintenance').delete().eq('id',String(id)).then(function(){});}catch(e){}
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
