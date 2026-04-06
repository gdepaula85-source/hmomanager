// ── RENT ──────────────────────────────────────────────────────────────────────
// Simulate due dates based on payment id for demo realism
function getDueDateObj(p) {
  if(p._dueDateRaw) return new Date(p._dueDateRaw);
  return TODAY;
}
function getDueDate(p) { return getDueDateObj(p); }

function getDueStatus(p) {
  if(p.status==='paid') return 'paid';
  var due=getDueDateObj(p);
  // Normalize both to midnight for clean whole-day comparison
  var dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  var todDay = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  var diff = Math.round((dueDay - todDay) / 86400000);
  if(diff<0) return 'overdue';
  if(diff===0) return 'today';
  if(diff===1) return 'tomorrow';
  return 'upcoming';
}


function getRentTab(p) {
  const today = TODAY;
  const due = new Date(getDueDate(p));
  const diff = Math.round((due - today) / 86400000);
  if(p.status==='paid') return 'paid';
  if(diff < 0) return 'overdue';
  if(diff === 0) return 'today';
  if(diff === 1) return 'tomorrow';
  return 'upcoming';
}

function getPeriodDates(period) {
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  // Monday of current week
  var dow = now.getDay(); var diff = (dow===0?-6:1-dow);
  var monThis = new Date(y,m,d+diff);
  var sunThis = new Date(y,m,d+diff+6);
  var monPrev = new Date(monThis); monPrev.setDate(monPrev.getDate()-7);
  var sunPrev = new Date(sunThis); sunPrev.setDate(sunPrev.getDate()-7);
  // Current month
  var monthStart = new Date(y,m,1);
  var monthEnd   = new Date(y,m+1,0);
  // Prev month
  var pm = m===0?11:m-1; var py = m===0?y-1:y;
  var prevMonthStart = new Date(py,pm,1);
  var prevMonthEnd   = new Date(py,pm+1,0);
  var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var fmt2 = function(d){return d.getDate()+' '+MONTHS_SHORT[d.getMonth()];};
  if(period==='week')      return {from:monThis, to:sunThis,      label:'This Week ('+fmt2(monThis)+'–'+fmt2(sunThis)+' '+y+')'};
  if(period==='prev-week') return {from:monPrev, to:sunPrev,      label:'Last Week ('+fmt2(monPrev)+'–'+fmt2(sunPrev)+')'};
  if(period==='month')     return {from:monthStart, to:monthEnd,  label:MONTHS_SHORT[m]+' '+y};
  if(period==='prev-month')return {from:prevMonthStart, to:prevMonthEnd, label:MONTHS_SHORT[pm]+' '+py};
  if(period==='ytd')       return {from:new Date(y,0,1), to:now,  label:'Year to Date '+y};
  return {from:monThis, to:sunThis, label:'This Week'};
}

function getFullPaymentPool() {
  var pool = state.payments.slice();
  var seen = new Set(pool.map(function(p){
    var t = p.tenant||p.tenantName||'';
    var d = p._dueDateRaw||(p.dueDate?new Date(p.dueDate).getTime():null)||0;
    return t+'|'+d+'|'+(p.amount||0);
  }));
  state.tenants.forEach(function(t) {
    if(!t.paymentHistory) return;
    t.paymentHistory.forEach(function(h) {
      if(h.type!=='history') return;
      var parts=h.date.split(' ');
      var months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
      var d=new Date(+parts[2],months[parts[1]],+parts[0]);
      var raw=d.getTime();
      var key=t.name+'|'+raw+'|'+h.amount;
      if(!seen.has(key)){seen.add(key);pool.push({id:'h_'+t.id+'_'+raw,tenant:t.name,property:t.property,room:t.room,amount:h.amount,method:h.method,status:h.status,_dueDateRaw:raw,_fromHistory:true});}
    });
  });
  return pool;
}



function renderRentRow(p) {
  if(!p || !p.tenant) return '';
  var tenant = state.tenants.find(function(t){return t.name===p.tenant;});
  if(p._isArrears) {
    var t = tenant;
    var h = '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);background:#FFF8F8">';
    h += '<div style="width:32px;height:32px;border-radius:9px;background:var(--red-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--red);flex-shrink:0">'+(t?t.name[0]:'?')+'</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:13px;font-weight:700">'+p.tenant+'</div>';
    h += '<div style="font-size:11px;color:var(--muted)">'+p.property+' · Rm '+p.room+' · <span style="color:var(--red);font-weight:600">⚠️ Standing Arrears</span></div>';
    h += '</div>';
    h += '<div style="font-size:15px;font-weight:800;color:var(--red);font-family:monospace;flex-shrink:0">'+fmt(p.amount)+'</div>';
    h += '<div style="display:flex;gap:6px;flex-shrink:0">';
    h += '<button onclick="markPaid(\''+String(p.id)+'\',\'bank\')" style="padding:7px 12px;border-radius:8px;border:none;background:var(--green);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✓ Clear</button>';
    h += '<button onclick="markPartialPaid(\''+String(p.id)+'\','+p.amount+')" style="padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Partial</button>';
    h += '</div></div>';
    return h;
  }
  var dueStatus = getDueStatus(p);
  var dueDate   = getDueDateObj(p);
  var dueDateStr = dueDate.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  var room   = tenant ? tenant.room : (p.room||'?');
  var isCash = p.method==='cash';
  var isPaid = p.status==='paid';
  var sc = {
    paid:    {bg:'var(--green-light)', border:'#A7F3D0', text:'var(--green)'},
    overdue: {bg:'var(--red-light)',   border:'#FECDD3', text:'var(--red)'},
    today:   {bg:'var(--amber-light)', border:'#FDE68A', text:'var(--amber)'},
    tomorrow:{bg:'var(--blue-light)',  border:'#BFDBFE', text:'var(--blue)'},
    upcoming:{bg:'#F8F9FB',            border:'var(--border)', text:'var(--muted)'}
  }[dueStatus] || {bg:'#F8F9FB', border:'var(--border)', text:'var(--muted)'};

  var lateFee  = calcLateFee(p);
  var dueLabel = dueStatus==='overdue'
    ? '&#x26A0;&#xFE0F; Overdue &middot; '+dueDateStr+(lateFee>0?' + &pound;'+lateFee+' fee':'')
    : dueStatus==='today'    ? '&#x1F4C5; Due Today'
    : dueStatus==='tomorrow' ? '&#x1F4C5; Tomorrow'
    : dueStatus==='paid'     ? '&#x2713; Paid'
    : '&#x1F4C5; Due '+dueDateStr;

  var waBase = tenant&&tenant.whatsapp
    ? 'https://wa.me/'+String(tenant.whatsapp||'').replace(/\D/g,'')+'?text=' : '';
  var waMsg = encodeURIComponent(
    'Hi '+((p.tenant||'Tenant').split(' ')[0])+', your rent of \u00A3'+(p.amount||0)+
    ' is '+(dueStatus==='overdue'?'overdue. Please pay urgently':'due '+dueDateStr+'. Please arrange payment.')+
    ' Thank you \u2014 Reservations Direct.');

  var h = '<div style="border-bottom:1px solid var(--border);padding:12px 14px;background:'
    +(dueStatus==='overdue'?'#FFF8F8':dueStatus==='today'?'#FFFBF0':'var(--surface)')+';">';

  // Header row: avatar + name + amount
  h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
  h += '<div style="width:36px;height:36px;border-radius:10px;flex-shrink:0;background:'+sc.bg
    +';border:1px solid '+sc.border+';display:flex;align-items:center;justify-content:center'
    +';font-size:14px;font-weight:700;color:'+sc.text+'">'+p.tenant[0]+'</div>';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-weight:700;font-size:14px">'+p.tenant+'</div>';
  h += '<div style="font-size:11px;color:var(--muted)">'+p.property+' &middot; Rm '+room+'</div>';
  h += '</div>';
  h += '<div style="text-align:right;flex-shrink:0">';
  h += '<div style="font-size:16px;font-weight:700;font-family:monospace">&pound;'+p.amount+'</div>';
  h += '<div style="font-size:10px;font-weight:600;color:'+sc.text+'">'+dueLabel+'</div>';
  h += '</div></div>';

  // Method pill
  h += '<div style="margin-bottom:8px;display:flex;align-items:center;gap:7px;flex-wrap:wrap">';
  h += '<button onclick="togglePaymentMethod(\''+String(p.id)+'\')" style="padding:4px 10px;border-radius:20px;'
    +'border:1px solid '+(isCash?'#FDE68A':'#BFDBFE')+';background:'+(isCash?'#FFFBEB':'#EFF6FF')
    +';color:'+(isCash?'var(--amber)':'var(--blue)')+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">'
    +(isCash?'&#x1F4B5; Cash':'&#x1F3E6; Bank')+'</button>';
  if(isCash&&!isPaid)
    h += '<span style="font-size:10px;font-weight:700;color:var(--amber);background:#FFFBEB;'
      +'border:1px solid #FDE68A;padding:2px 8px;border-radius:10px">&#x1F4CB; Cash Collection</span>';
  h += '</div>';

  // Action buttons
  h += '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">';
  if(!isPaid){
    if(isCash){
      h += '<button onclick="markPaid(\''+String(p.id)+'\',\'cash\')" style="flex:1;padding:9px;border-radius:9px;'
        +'border:none;background:var(--amber);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">'
        +'&#x1F4B5; Mark Cash Collected</button>';
      h += '<button onclick="markPartialPaid(\''+String(p.id)+'\','+p.amount+')" style="padding:9px 10px;border-radius:9px;'
        +'border:1px solid var(--amber);background:#fff;color:#92400E;font-size:12px;font-weight:700;'
        +'cursor:pointer;font-family:inherit">Partial</button>';
    } else {
      h += '<button onclick="markPaid(\''+String(p.id)+'\',\'bank\')" style="flex:1;padding:9px;border-radius:9px;'
        +'border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">'
        +'&#x1F3E6; Bank Confirmed</button>';
      h += '<button onclick="markPartialPaid(\''+String(p.id)+'\','+p.amount+')" style="padding:9px 10px;border-radius:9px;'
        +'border:1px solid var(--amber);background:var(--amber-light);color:#92400E;font-size:12px;font-weight:700;'
        +'cursor:pointer;font-family:inherit">Partial</button>';
      h += '<button onclick="markPaid(\''+String(p.id)+'\',\'cash\')" style="padding:9px 10px;border-radius:9px;'
        +'border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;'
        +'cursor:pointer;font-family:inherit">Cash</button>';
    }
    if(waBase)
      h += '<a href="'+waBase+waMsg+'" target="_blank" style="padding:9px 10px;border-radius:9px;'
        +'border:1px solid #BBF7D0;background:var(--wa-light);color:var(--wa);font-size:13px;'
        +'font-weight:700;text-decoration:none">'+(dueStatus==='overdue'?'&#x1F4AC; Chase':'&#x1F4AC;')+'</a>';
  } else {
    h += '<span style="font-size:12px;color:var(--green);font-weight:700">&#x2713; Collected &mdash; '
      +(p.paidMethod==='cash'?'Cash':'Bank')+'</span>';
    h += '<button data-pid="'+String(p.id)+'" onclick="openEditPaymentModal(this.dataset.pid)" '
      +'style="margin-left:auto;padding:5px 11px;border-radius:8px;border:1px solid var(--border);'
      +'background:var(--bg);color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">Fix</button>';
  }
  h += '</div></div>';
  return h;
}

function calcLateFee(p) {
  var cfg = state.lateFeeConfig;
  if(!cfg||!cfg.enabled) return 0;
  var due = getDueDateObj(p);
  var daysLate = Math.floor((TODAY - due) / 86400000);
  if(daysLate <= cfg.graceDays) return 0;
  return cfg.feeType==='fixed' ? cfg.feeAmount : Math.round(p.amount * cfg.feeAmount / 100);
}

function togglePaymentMethod(payId) {
  var idStr = String(payId);
  var found = false;
  state.payments = state.payments.map(function(p) {
    if(String(p.id)===idStr) {
      found = true;
      var nm = p.method==='cash'?'bank':'cash';
      var t = state.tenants.find(function(x){return x.name===p.tenant;});
      if(t) t.method = nm;
      return Object.assign({},p,{method:nm});
    }
    return p;
  });
  if(!found) {
    var s = state.rentSchedule.find(function(x){return String(x.id)===idStr;});
    if(s) {
      s.method = s.method==='cash'?'bank':'cash';
      var t = state.tenants.find(function(x){return x.id===s.tenantId;});
      if(t) t.method = s.method;
    }
  }
  render();
}

function openLateFeeSettings() {
  var cfg = state.lateFeeConfig;
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:400px"><div class="modal-header">'
    +'<span class="modal-title">&#x23F0; Late Fee Settings</span>'
    +'<button class="modal-close" onclick="closeModal()">&#xD7;</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label class="field-label">Grace Period (days)</label>'
    +'<input class="inp" id="lf-grace" type="number" value="'+cfg.graceDays+'"></div>'
    +'<div class="field"><label class="field-label">Fee Type</label>'
    +'<select class="inp" id="lf-type">'
    +'<option value="fixed" '+(cfg.feeType==='fixed'?'selected':'')+'>Fixed (&pound;)</option>'
    +'<option value="percent" '+(cfg.feeType==='percent'?'selected':'')+'>% of rent</option>'
    +'</select></div>'
    +'<div class="field"><label class="field-label">Amount</label>'
    +'<input class="inp" id="lf-amount" type="number" value="'+cfg.feeAmount+'"></div>'
    +'<div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer">'
    +'<input type="checkbox" id="lf-enabled" '+(cfg.enabled?'checked':'')+' style="width:16px;height:16px"> '
    +'Enable late fees</label></div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button onclick="saveLateFeeSettings()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save</button>'
    +'</div></div></div></div>';
}

function saveLateFeeSettings() {
  state.lateFeeConfig.graceDays  = +document.getElementById('lf-grace').value  || 3;
  state.lateFeeConfig.feeType    = document.getElementById('lf-type').value;
  state.lateFeeConfig.feeAmount  = +document.getElementById('lf-amount').value || 25;
  state.lateFeeConfig.enabled    = document.getElementById('lf-enabled').checked;
  closeModal(); render();
}

function bulkChaseOverdue(mode) {
  mode = mode || 'overdue';
  var pool = (window._renderedOverdue||[]);
  var source;
  if(mode==='all')    source = pool.filter(function(p){return !p._isArrears;});
  else if(mode==='today') source = pool.filter(function(p){var s=getDueStatus(p);return s==='today'||s==='overdue';});
  else                source = pool.filter(function(p){return getDueStatus(p)==='overdue';});

  if(!source.length){showToast('No payments to chase in this view','success');return;}

  var byT={};
  source.forEach(function(p){
    var tn=p.tenant||p.tenantName||'';
    if(!byT[tn]) byT[tn]={total:0,pays:[],t:state.tenants.find(function(x){return x.name===tn;})};
    byT[tn].total+=p.amount; byT[tn].pays.push(p);
  });
  var items=Object.keys(byT).map(function(n){return byT[n];}).filter(function(x){return x.t&&x.t.whatsapp;});
  var noWA =Object.keys(byT).map(function(n){return byT[n];}).filter(function(x){return !x.t||!x.t.whatsapp;});

  function buildMsg(item){
    var fn=item.t.name.split(' ')[0]; var amt='£'+item.total;
    if(mode==='overdue') return 'Hi '+fn+', your rent of '+amt+' is overdue. Please pay as soon as possible. Thank you — Reservations Direct.';
    if(mode==='today')   return 'Hi '+fn+', your rent of '+amt+' is due today. Please ensure payment is made. Thank you — Reservations Direct.';
    return 'Hi '+fn+', a rent payment of '+amt+' is outstanding. Please arrange payment at your earliest convenience. Thank you — Reservations Direct.';
  }
  var allLinks=items.map(function(item){return 'https://wa.me/'+String(item.t.whatsapp||'').replace(/\D/g,'')+'?text='+encodeURIComponent(buildMsg(item));});
  window._bulkSendAll=function(){allLinks.forEach(function(u){window.open(u,'_blank');});};

  var html='<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:520px"><div class="modal-header">'
    +'<span class="modal-title">&#x1F4AC; Bulk Reminder</span>'
    +'<button class="modal-close" onclick="closeModal()">&#xD7;</button></div>'
    +'<div class="modal-body" style="padding:0">'
    +'<div style="display:flex;border-bottom:1px solid var(--border)">'
    +'<button onclick="closeModal();bulkChaseOverdue(\'overdue\')" style="flex:1;padding:10px;border:none;border-bottom:3px solid '+(mode==='overdue'?'var(--red)':'transparent')+';background:transparent;font-size:12px;font-weight:700;color:'+(mode==='overdue'?'var(--red)':'var(--muted)')+';cursor:pointer;font-family:inherit">&#x26A0;&#xFE0F; Overdue only</button>'
    +'<button onclick="closeModal();bulkChaseOverdue(\'today\')" style="flex:1;padding:10px;border:none;border-bottom:3px solid '+(mode==='today'?'var(--amber)':'transparent')+';background:transparent;font-size:12px;font-weight:700;color:'+(mode==='today'?'var(--amber)':'var(--muted)')+';cursor:pointer;font-family:inherit">&#x1F4C5; Due today+overdue</button>'
    +'<button onclick="closeModal();bulkChaseOverdue(\'all\')" style="flex:1;padding:10px;border:none;border-bottom:3px solid '+(mode==='all'?'var(--blue)':'transparent')+';background:transparent;font-size:12px;font-weight:700;color:'+(mode==='all'?'var(--blue)':'var(--muted)')+';cursor:pointer;font-family:inherit">&#x1F4B7; All outstanding</button>'
    +'</div>';

  if(!items.length){
    html+='<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">No tenants with WhatsApp numbers in this view.</div>';
  } else {
    html+='<div style="padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">'
      +'<div style="font-size:12px;color:var(--muted)">'+items.length+' tenants with WhatsApp</div>'
      +'<button onclick="_bulkSendAll()" style="padding:7px 14px;border-radius:8px;border:none;background:#25D366;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F4AC; Send All ('+items.length+')</button>'
      +'</div><div style="max-height:50vh;overflow-y:auto">';
    items.forEach(function(item){
      var waHref='https://wa.me/'+String(item.t.whatsapp||'').replace(/\D/g,'')+'?text='+encodeURIComponent(buildMsg(item));
      html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--border)">'
        +'<div><div style="font-size:13px;font-weight:700">'+item.t.name+'</div>'
        +'<div style="font-size:11px;color:var(--muted)">'+item.t.property+(item.t.room?' · Rm '+item.t.room:'')+' · £'+item.total+'</div></div>'
        +'<a href="'+waHref+'" target="_blank" style="padding:7px 14px;border-radius:8px;background:#25D366;color:#fff;font-size:12px;font-weight:700;text-decoration:none">&#x1F4AC; Send</a>'
        +'</div>';
    });
    html+='</div>';
  }
  if(noWA.length) html+='<div style="padding:10px 16px;background:#FFFBEB;border-top:1px solid var(--border);font-size:11px;color:var(--amber)">&#x26A0;&#xFE0F; '+noWA.length+' tenant'+(noWA.length>1?'s':'')+' missing WhatsApp: '+noWA.map(function(x){return x.t?x.t.name:'?';}).join(', ')+'</div>';
  html+='</div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Close</button></div></div></div>';
  document.getElementById('modal-container').innerHTML=html;
}

function shareCashCollections(cashList) {
  if(!cashList.length){ alert('No cash collections to share.'); return; }
  var NL = '\n';
  var today = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var total = cashList.reduce(function(s,p){ return s + p.amount; }, 0);

  var msg = '\uD83D\uDCB5 *CASH COLLECTION LIST*' + NL;
  msg += '\uD83D\uDCC5 ' + today + NL;
  msg += '\u2501'.repeat(18) + NL + NL;

  cashList.forEach(function(p, i) {
    var t = state.tenants.find(function(x){ return x.name === p.tenant; });
    var prop = state.properties.find(function(x){ return x.name === p.property; });
    var address = prop ? (prop.address || p.property) : p.property;
    var phone = t && t.whatsapp ? '+' + t.whatsapp : '\u2014';
    var dueStatus = getDueStatus(p);
    var statusIcon = dueStatus === 'overdue' ? '\u26A0\uFE0F OVERDUE' : dueStatus === 'today' ? '\uD83D\uDD34 TODAY' : '\uD83D\uDCC5 DUE';

    msg += (i + 1) + '. \uD83D\uDC64 *' + p.tenant + '*' + NL;
    msg += '   \uD83C\uDFE0 ' + address + ', Rm ' + (t ? t.room : '?') + NL;
    msg += '   \uD83D\uDCB0 *\u00A3' + p.amount + '* ' + statusIcon + NL;
    msg += '   \uD83D\uDCDE ' + phone + NL;
    if(i < cashList.length - 1) msg += NL;
  });

  msg += NL + '\u2501'.repeat(18) + NL;
  msg += '\uD83D\uDCB0 *TOTAL: \u00A3' + total + '* (' + cashList.length + ' collection' + (cashList.length === 1 ? '' : 's') + ')' + NL;
  msg += '\u2705 Mark each as collected once received.';

  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

function setRentPeriod(v) { state.filters.rentPeriod = v; render(); }
function setRentTab(v)    { state.filters.rentTab    = v; render(); }
function setRentTabBtn(el) { setRentTab(el.dataset.tab); }
function setRentPeriodBtn(el) { state.filters.rentPeriod = el.dataset.period; render(); }
function setImportTab(el) { _importTab=el.dataset.tab; _importPreview=null; render(); }
function toggleUserStatusBtn(el) { toggleUserStatus(el.dataset.uid); }
function switchUserBtn(el) { switchUser(el.dataset.uid); }

function renderRent() {
  var period=state.filters.rentPeriod||'week';
  var rentTab=state.filters.rentTab||'today';
  var periodInfo=getPeriodDates(period);
  var from=periodInfo.from,to=periodInfo.to;
  var pool=getFullPaymentPool();
  var existing=period==='ytd'?pool:pool.filter(function(p){var d=getDueDateObj(p);return d>=from&&d<=to;});
  var seenDates=new Set(existing.map(function(p){return (p.tenant||p.tenantName||'')+'_'+getDueDateObj(p).toDateString();}));
  // Build per-tenant payment date list using BOTH due date and paid date for robust dedup
  // This handles legacy payments that have due_date=null but have a valid paid_date
  var _tenantPayTimes = {};
  state.payments.forEach(function(p) {
    var tn = p.tenant||p.tenantName||''; if(!tn) return;
    if(!_tenantPayTimes[tn]) _tenantPayTimes[tn] = [];
    if(p._dueDateRaw && !isNaN(p._dueDateRaw)) _tenantPayTimes[tn].push(p._dueDateRaw);
    else if(p._paidDateRaw && !isNaN(p._paidDateRaw)) _tenantPayTimes[tn].push(p._paidDateRaw);
  });
  var schedInPeriod=period==='ytd'?state.rentSchedule:state.rentSchedule.filter(function(s){var d=new Date(s.dueDateRaw);return d>=from&&d<=to;});
  var schedOnly=schedInPeriod.filter(function(s){
    if(s.status==='paid') return false;
    // Exact date match
    if(seenDates.has((s.tenantName||'')+'_'+new Date(s.dueDateRaw).toDateString())) return false;
    // Fuzzy match: any payment for this tenant within ±6 days of schedule due date
    var times = _tenantPayTimes[s.tenantName||''];
    if(times) {
      for(var _i=0;_i<times.length;_i++) {
        if(Math.abs(times[_i] - s.dueDateRaw) <= 6*86400000) return false;
      }
    }
    return true;
  });
  var synth=schedOnly.map(function(s){return {id:s.id,tenant:s.tenantName,property:s.property,amount:s.amount,method:s.method,status:'outstanding',_dueDateRaw:s.dueDateRaw,_fromSched:true};});
  var allPayments=existing.concat(synth);
  // For collected tab: filter ALL payments by paidDate in period (not dueDate)
  // This shows payments RECEIVED in the period, regardless of when they were due
  var paidInPeriod = state.payments.filter(function(p){
    if(p.status!=='paid' && p.status!=='Paid') return false;
    if(period==='ytd') return true;
    // Parse paidDate (stored as "21 Mar 2026" or ISO)
    var pd = p.paidDate || p.date;
    if(!pd) return false;
    var _months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    var _parts = String(pd).split(' ');
    var paidD;
    if(_parts.length===3 && _months[_parts[1]]!==undefined){
      paidD = new Date(+_parts[2], _months[_parts[1]], +_parts[0]);
    } else {
      var iso = String(pd).split('T')[0];
      paidD = iso ? new Date(iso) : null;
    }
    if(!paidD || isNaN(paidD)) return false;
    paidD.setHours(0,0,0,0);
    var fromD = new Date(from); fromD.setHours(0,0,0,0);
    var toD = new Date(to); toD.setHours(23,59,59,999);
    return paidD >= fromD && paidD <= toD;
  });
  var paid = paidInPeriod.length > 0 ? paidInPeriod : allPayments.filter(function(p){return p.status==='paid';});
  // Use paidInPeriod for the collected tab, allPayments paid for stats
  var paidForTab = paidInPeriod;
  var owed=allPayments.filter(function(p){return p.status!=='paid';});
  var overdue=owed.filter(function(p){return getDueStatus(p)==='overdue';});
  // Also add tenants with standing arrears (from partials) into overdue tab
  var arrearsEntries = state.tenants
    .filter(function(t){return t.status!=='inactive' && (t.arrears||0)>0;})
    .filter(function(t){
      // Only add if not already represented in overdue (to avoid double-counting)
      return !overdue.some(function(o){return o.tenant===t.name;});
    })
    .map(function(t){
      return {
        id: 'arrears_'+t.id,
        tenant: t.name,
        property: t.property,
        room: t.room,
        amount: t.arrears,
        method: t.method||'bank',
        status: 'outstanding',
        _isArrears: true,
        _dueDateRaw: new Date(Date.now() - 86400000).toISOString().split('T')[0]
      };
    });
  overdue = overdue.concat(arrearsEntries);
  var dueToday=owed.filter(function(p){return getDueStatus(p)==='today';});
  var tomorrow=owed.filter(function(p){return getDueStatus(p)==='tomorrow';});
  var cashColl=owed.filter(function(p){return p.method==='cash';});
  var activeData=rentTab==='overdue'?overdue:rentTab==='today'?dueToday:rentTab==='tomorrow'?tomorrow:rentTab==='paid'?paidForTab:cashColl;
  var totalPaid=paid.reduce(function(s,p){return s+p.amount;},0).toLocaleString();
  var totalOwed=owed.reduce(function(s,p){return s+p.amount;},0).toLocaleString();
  // Expected = sum of all payments scheduled in this period (paid + outstanding)
  // This makes the bar and rate reflect the chosen period correctly
  // Expected = only scheduled amounts (paid + outstanding in period), NOT all historical payments
  // This prevents old Supabase payments with null due_date (which fall back to TODAY) inflating the total
  var totalCollected = paid.reduce(function(s,p){return s+p.amount;},0);
  var totalOutstanding = synth.reduce(function(s,p){return s+p.amount;},0);
  var totalExpect = totalCollected + totalOutstanding;
  var rate = totalExpect ? Math.round(totalCollected/totalExpect*100) : 0;
  window._renderedOverdue = overdue;
  // Chase button: only tenants with overdue items in CURRENT PERIOD view
  // overdue is already filtered to this period — just check which have WA
  overdueWithWA=overdue.filter(function(p){
    if(p._isArrears) {
      var t=state.tenants.find(function(x){return x.name===p.tenant;});
      return t&&t.whatsapp;
    }
    var t=state.tenants.find(function(x){return x.name===p.tenant;});
    return t&&t.whatsapp&&getDueStatus(p)==='overdue';
  });
  var h='';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px">';
  h+='<div><div style="font-size:20px;font-weight:700;color:var(--text)">Rent Collection</div><div style="font-size:12px;color:var(--muted);margin-top:2px">'+periodInfo.label+'</div></div>';
  if(overdueWithWA.length>0)h+='<button onclick="bulkChaseOverdue()" style="display:flex;align-items:center;gap:6px;padding:9px 14px;border-radius:9px;border:none;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">⚠️ Chase All ('+overdueWithWA.length+')</button>';
  h+='</div>';
  var periods=[{v:'week',l:'This Week'},{v:'prev-week',l:'Last Week'},{v:'month',l:'This Month'},{v:'prev-month',l:'Last Month'},{v:'ytd',l:'YTD'}];
  h+='<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex-wrap:nowrap">';
  [{v:'week',l:'This Week'},{v:'prev-week',l:'Last Week'},{v:'month',l:'This Month'},{v:'prev-month',l:'Last Month'},{v:'ytd',l:'YTD'}].forEach(function(x){h+='<button onclick="state.filters.rentPeriod=\''+x.v+'\';render()" style="padding:7px 14px;border-radius:20px;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;border:1px solid '+(period===x.v?'var(--accent)':'var(--border)')+';background:'+(period===x.v?'var(--accent)':'var(--bg)')+';color:'+(period===x.v?'#fff':'var(--muted)')+'">'+ x.l+'</button>';});
  h+='</div>';
  h+='<button onclick="openLateFeeSettings()" style="font-size:11px;color:var(--muted);background:none;border:1px solid var(--border);border-radius:7px;padding:4px 10px;cursor:pointer;font-family:inherit;margin-bottom:16px">⏰ Late fee: '+(state.lateFeeConfig.enabled?'£'+state.lateFeeConfig.feeAmount+' after '+state.lateFeeConfig.graceDays+'d':'Off')+'</button>';
  var bankPaid = paid.filter(function(p){return p.method==='bank';}).reduce(function(s,p){return s+p.amount;},0);
  var cashPaid = paid.filter(function(p){return p.method==='cash';}).reduce(function(s,p){return s+p.amount;},0);
  var bankPaidCount = paid.filter(function(p){return p.method==='bank';}).length;
  var cashPaidCount = paid.filter(function(p){return p.method==='cash';}).length;

  h+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:14px;padding:14px">';
  // Top row: Collected / Outstanding / Expected
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-bottom:10px">';
  h+='<div style="text-align:center"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Collected</div><div style="font-size:15px;font-weight:800;color:var(--green);font-family:monospace">£'+totalPaid+'</div><div style="font-size:10px;color:var(--muted)">'+paid.length+' payments</div></div>';
  h+='<div style="text-align:center;border-left:1px solid var(--border);border-right:1px solid var(--border)"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Outstanding</div><div style="font-size:15px;font-weight:800;color:'+(owed.length>0?'var(--red)':'var(--muted)')+';font-family:monospace">£'+totalOwed+'</div><div style="font-size:10px;color:var(--muted)">'+owed.length+' tenants</div></div>';
  h+='<div style="text-align:center"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Expected</div><div style="font-size:15px;font-weight:800;color:var(--text);font-family:monospace">'+fmt(totalExpect)+'</div><div style="font-size:10px;color:var(--muted)">'+rate+'% rate</div></div>';
  h+='</div>';
  // Progress bar
  h+='<div style="background:var(--border);border-radius:4px;height:5px;margin-bottom:10px">';
  h+='<div style="background:var(--green);border-radius:4px;height:5px;width:'+(totalExpect?Math.round(totalCollected/totalExpect*100):0)+'%"></div>';
  h+='</div>';
  // Bank vs Cash breakdown row
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid var(--border);padding-top:10px">';
  h+='<div style="display:flex;align-items:center;gap:8px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 12px">';
  h+='<span style="font-size:16px">🏦</span>';
  h+='<div><div style="font-size:11px;font-weight:700;color:var(--blue)">BANK</div>';
  h+='<div style="font-size:14px;font-weight:800;color:var(--blue);font-family:monospace">£'+bankPaid.toLocaleString()+'</div>';
  h+='<div style="font-size:10px;color:var(--muted)">'+bankPaidCount+' payment'+(bankPaidCount===1?'':'s')+'</div></div>';
  h+='</div>';
  h+='<div style="display:flex;align-items:center;gap:8px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:8px 12px">';
  h+='<span style="font-size:16px">💵</span>';
  h+='<div><div style="font-size:11px;font-weight:700;color:var(--amber)">CASH</div>';
  h+='<div style="font-size:14px;font-weight:800;color:var(--amber);font-family:monospace">£'+cashPaid.toLocaleString()+'</div>';
  h+='<div style="font-size:10px;color:var(--muted)">'+cashPaidCount+' payment'+(cashPaidCount===1?'':'s')+'</div></div>';
  h+='</div>';
  h+='</div>';
  h+='</div>';
  // Total Arrears KPI
  var totalArrears = state.tenants.filter(function(t){return t.status!=='inactive'&&t.arrears>0;}).reduce(function(s,t){return s+(t.arrears||0);},0);
  var arrearsCount = state.tenants.filter(function(t){return t.status!=='inactive'&&t.arrears>0;}).length;
  if(totalArrears>0){
    h+='<div onclick="state.filters.tenants=\'arrears\';state.page=\'tenants\';render()" style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer">';
    h+='<div><div style="font-size:12px;font-weight:700;color:var(--red)">⚠️ Total Rent Arrears</div>';
    h+='<div style="font-size:11px;color:var(--muted);margin-top:2px">'+arrearsCount+' tenant'+(arrearsCount===1?'':'s')+' with outstanding balance</div></div>';
    h+='<div style="font-size:22px;font-weight:800;color:var(--red);font-family:monospace">'+fmt(totalArrears)+'</div>';
    h+='</div>';
  }
  
  h+='<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:16px;-webkit-overflow-scrolling:touch;scrollbar-width:none">';
  [{v:'today',l:'Due Today',count:dueToday.length,color:'var(--amber)'},{v:'tomorrow',l:'Tomorrow',count:tomorrow.length,color:'var(--blue)'},{v:'cash',l:'💵 Cash',count:cashColl.length,color:'var(--amber)'},{v:'overdue',l:'Overdue',count:overdue.length,color:'var(--red)'},{v:'paid',l:'Collected',count:paid.length,color:'var(--green)'}].forEach(function(t){h+='<button onclick="state.filters.rentTab=\''+t.v+'\';render()" style="display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:20px;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;flex-shrink:0;border:1px solid '+(rentTab===t.v?t.color:'var(--border)')+';background:'+(rentTab===t.v?t.color+'22':'var(--bg)')+';color:'+(rentTab===t.v?t.color:'var(--muted)')+'">'+(t.count>0?'<span style="background:'+t.color+';color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:700"> '+t.count+' </span> ':'')+t.l+'</button>';});
  h+='</div>';
  // Cash tab: add Share button header
  if(rentTab==='cash' && activeData.length > 0) {
    window._cashData = activeData; // store for share button
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    h += '<div style="font-size:13px;font-weight:700">&#x1F4B5; Cash Collections &middot; <span style="color:var(--amber)">' + activeData.length + ' pending</span></div>';
    h += '<button onclick="shareCashCollections(window._cashData||[])" style="display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:9px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F4AC; Share List</button>';
    h += '</div>';
  }
  h+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">';
  if(activeData.length===0){h+='<div style="padding:40px 20px;text-align:center;color:var(--dim)"><div style="font-size:40px;margin-bottom:10px">📋</div><div style="font-size:14px;font-weight:600">No payments in this period</div></div>';}
  else{activeData.forEach(function(p){h+=renderRentRow(p);});}
  h+='</div>';
  return h;
}


function renderExpenses() {
  const tab      = state.filters.expenses||'overview';
  const selMonth = state.filters.expMonth||'all';

  // Filter expenses by month
  function expInMonth(e) {
    if(selMonth==='all') return true;
    var mo = MONTHS.find(function(m){return m.key===selMonth;});
    if(!mo) return true;
    if(e.recurring && e.startDate) {
      // Recurring monthly: show in selected month if started on/before that month
      var startD = new Date(e.startDate);
      return startD <= mo.to;
    }
    if(e.startDate) {
      var d = new Date(e.startDate);
      return d >= mo.from && d <= mo.to;
    }
    return true;
  }

  const expCo = state.filters.expCompany||'';
  const filtered = state.expenses.filter(function(e){
    if(!expInMonth(e)) return false;
    if(!expCo) return true;
    if(e.companyId && e.companyId===expCo) return true;
    if(e.property){ var prop=state.properties.find(function(p){return p.name===e.property;}); if(prop&&prop.companyId===expCo) return true; }
    return false;
  });
  const staff = filtered.filter(e=>e.type==='staff').reduce((a,e)=>a+e.amount,0);
  const prop  = filtered.filter(e=>e.type==='property').reduce((a,e)=>a+e.amount,0);
  const over  = filtered.filter(e=>e.type==='overhead').reduce((a,e)=>a+e.amount,0);
  const actual= filtered.filter(e=>e.type==='actual').reduce((a,e)=>a+e.amount,0);
  const total = staff+prop+over+actual;
  const moLabel = selMonth==='all' ? 'All Time' : (MONTHS.find(function(m){return m.key===selMonth;})||{label:selMonth}).label;

  return `
    <div class="page-header">
      <div><div class="page-title">Expenses</div><div class="page-sub">${filtered.length} records · ${moLabel}</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <select onchange="state.filters.expCompany=this.value;render()" style="padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">
          <option value="">🏢 All Companies</option>
          ${(state.companies||[]).map(function(c){return '<option value="'+c.id+'" '+(state.filters.expCompany===c.id?'selected':'')+'>'+c.name+'</option>';}).join('')}
        </select>
        <select onchange="state.filters.expMonth=this.value;render()" style="padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">
          <option value="all">All Time</option>
          ${MONTHS.slice().reverse().map(function(m){return '<option value="'+m.key+'" '+(selMonth===m.key?'selected':'')+'>'+m.label+'</option>';}).join('')}
        </select>
        ${btn('+ Add Expense',"openModal('addExpense')")}
      </div>
    </div>
    <div class="filters">
      ${[{v:'overview',l:'Overview'},{v:'list',l:'All Expenses'}].map(x=>`<button class="filter-btn ${tab===x.v?'active':''}" onclick="state.filters.expenses='${x.v}';state.filters.expType='';render()">${x.l}</button>`).join('')}
      ${tab==='list'?`<button class="filter-btn ${!state.filters.expType?'active':''}" onclick="state.filters.expType='';render()">All</button><button class="filter-btn ${'staff'===state.filters.expType?'active':''}" onclick="state.filters.expType='staff';render()">👷 Staff</button><button class="filter-btn ${'property'===state.filters.expType?'active':''}" onclick="state.filters.expType='property';render()">🏠 Property</button><button class="filter-btn ${'overhead'===state.filters.expType?'active':''}" onclick="state.filters.expType='overhead';render()">⚙️ Overhead</button>`:''}
    </div>
    ${tab==='overview'?`
      <div class="kpi-grid kpi-4" style="margin-bottom:22px">
        <div onclick="state.filters.expenses='list';state.filters.expType='';render()" style="cursor:pointer">${kpi('Total Expenses', fmt(total), 'This month', '#E8375A', '💸')}</div>
        <div onclick="state.filters.expenses='list';state.filters.expType='staff';render()" style="cursor:pointer">${kpi('Staff & Labour', fmt(staff), `${filtered.filter(e=>e.type==='staff').length} records · tap to view`, '#F59E0B', '👷')}</div>
        <div onclick="state.filters.expenses='list';state.filters.expType='property';render()" style="cursor:pointer">${kpi('Property Costs', fmt(prop), `${filtered.filter(e=>e.type==='property').length} records · tap to view`, '#3B82F6', '🏠')}</div>
        ${actual>0?`<div onclick="state.filters.expenses='list';state.filters.expType='actual';render()" style="cursor:pointer">${kpi('Job Costs', fmt(actual), filtered.filter(e=>e.type==='actual').length+' maintenance jobs · tap to view', '#F97316', '🔧')}</div>`:''}
        <div onclick="state.filters.expenses='list';state.filters.expType='overhead';render()" style="cursor:pointer">${kpi('Overhead', fmt(over), `${filtered.filter(e=>e.type==='overhead').length} records · tap to view`, '#8B5CF6', '⚙️')}</div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title">📊 Cost Breakdown</div>
          ${(function(){
        // Group by actual category
        var cats = {};
        filtered.forEach(function(e){
          var cat = e.cat||e.type||'Other';
          cats[cat] = (cats[cat]||0) + e.amount;
        });
        var catColors = {
          'Council Tax':'#6366F1','Energy – Gas':'#EF4444','Energy – Electric':'#F59E0B',
          'Water':'#3B82F6','Internet / Broadband':'#06B6D4','Cleaning':'#10B981',
          'Maintenance & Repairs':'#F97316','Insurance':'#8B5CF6','HMO Licence':'#EC4899',
          'Property Costs':'#3B82F6','Staff & Labour':'#F59E0B','Contractor':'#FB923C',
          'Software & Tools':'#A855F7','Accountancy':'#14B8A6','Legal':'#64748B',
          'Overhead':'#94A3B8'
        };
        var sorted = Object.keys(cats).sort(function(a,b){return cats[b]-cats[a];});
        if(!sorted.length) return '<div style="font-size:13px;color:var(--muted);padding:10px 0">No expenses in this period</div>';
        return sorted.map(function(cat){
          var col = catColors[cat]||'#64748B';
          var pctV = total ? Math.round(cats[cat]/total*100) : 0;
          return '<div class="exp-bar-row">'
            +'<div class="exp-bar-top"><span style="font-size:12px;color:var(--muted)">'+cat+'</span>'
            +'<span class="mono" style="font-size:12px;font-weight:700;color:'+col+'">'+fmt(cats[cat])+'</span></div>'
            +'<div class="bar-track"><div class="bar-fill" style="width:'+pctV+'%;background:'+col+'"></div></div>'
            +'</div>';
        }).join('');
      })()}
        </div>
        <div class="card">
          <div class="card-title">✅ Confirmation Status</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:var(--green)">${state.expenses.filter(e=>e.status==='confirmed').length}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px;font-weight:500">Confirmed</div>
            </div>
            <div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:var(--amber)">${state.expenses.filter(e=>e.status==='estimated').length}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px;font-weight:500">Estimated</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5">Confirm each expense once the actual amount is known. Estimated figures may change.</div>
        </div>
      </div>
    `:`
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Frequency</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${filtered.filter(e=>!state.filters.expType||e.type===state.filters.expType).map(e=>`<tr>
              <td style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.cat||e.type}</td>
              <td style="font-size:12px">
                ${e.desc}
                ${e.property?`<div style="font-size:10px;color:var(--muted)">${e.property}</div>`:''}
              </td>
              <td class="mono" style="font-weight:700;color:var(--red)">${fmt(e.amount)}</td>
              <td>
                <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${e.recurring?'var(--blue-light)':'var(--bg)'};color:${e.recurring?'var(--blue)':'var(--muted)'}">
                  ${e.recurring?'🔄 Monthly':'1× One-off'}
                </span>
              </td>
              <td>${badge(e.status)}</td>
              <td><div style="display:flex;gap:6px">
                ${e.status==='estimated'?btn('✓ Confirm',`confirmExp('${e.id}')`,'primary',true):''}
                ${btn('✏️ Edit',`editExpModal('${e.id}')`,'secondary',true)}
                ${btn('🗑 Remove',`removeExp('${e.id}')`,'danger',true)}
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;
}
