// ── RENT ──────────────────────────────────────────────────────────────────────
// Simulate due dates based on payment id for demo realism
function nowLocalMidnight() {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function toLocalMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function getDueDateObj(p) {
  if(p._dueDateRaw) return new Date(p._dueDateRaw);
  return nowLocalMidnight();
}
function getDueDate(p) { return getDueDateObj(p); }

function getDueStatus(p) {
  if(p.status==='paid') return 'paid';
  var dueDay = toLocalMidnight(getDueDateObj(p));
  var todDay = nowLocalMidnight();
  var diff = Math.round((dueDay - todDay) / 86400000);
  if(diff<0) return 'overdue';
  if(diff===0) return 'today';
  if(diff===1) return 'tomorrow';
  return 'upcoming';
}


function getRentTab(p) {
  if(p.status==='paid') return 'paid';
  var today = nowLocalMidnight();
  var due = toLocalMidnight(new Date(getDueDate(p)));
  const diff = Math.round((due - today) / 86400000);
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

/** Split timestamps so ±6d fuzzy dedup applies only to legacy payments without _dueDateRaw.
 * Otherwise a payment tied to an old due day (within 6 days of “today”) hides the new slot after changing pay day. */
function buildScheduleDedupMapsFromPayments() {
  var dueRawByTenant = {};
  var legacyPaidRawByTenant = {};
  state.payments.forEach(function (p) {
    var tn = p.tenant || p.tenantName || '';
    if (!tn) return;
    if (p._dueDateRaw != null && p._dueDateRaw !== '' && !isNaN(+p._dueDateRaw)) {
      if (!dueRawByTenant[tn]) dueRawByTenant[tn] = [];
      dueRawByTenant[tn].push(+p._dueDateRaw);
    } else if (p._paidDateRaw != null && !isNaN(+p._paidDateRaw)) {
      if (!legacyPaidRawByTenant[tn]) legacyPaidRawByTenant[tn] = [];
      legacyPaidRawByTenant[tn].push(+p._paidDateRaw);
    }
  });
  return { dueRawByTenant: dueRawByTenant, legacyPaidRawByTenant: legacyPaidRawByTenant };
}

function scheduleSyntheticLooksDuped(s, maps) {
  var tn = s.tenantName || '';
  var sDay = new Date(s.dueDateRaw).toDateString();
  var dueRaws = maps.dueRawByTenant[tn];
  if (dueRaws) {
    for (var i = 0; i < dueRaws.length; i++) {
      if (new Date(dueRaws[i]).toDateString() === sDay) return true;
    }
  }
  var leg = maps.legacyPaidRawByTenant[tn];
  if (leg) {
    for (var j = 0; j < leg.length; j++) {
      if (Math.abs(leg[j] - s.dueDateRaw) <= 6 * 86400000) return true;
    }
  }
  return false;
}

function renderRentRow(p) {
  if(!p) return '';
  // STR (Airbnb) entries have no tenant — render a compact STR row instead of bailing
  if(p.incomeSource === 'airbnb') {
    var paidStr = p.paidDate || '—';
    var period = '';
    if(p.periodStart && p.periodEnd) {
      period = new Date(p.periodStart).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) + ' – ' + new Date(p.periodEnd).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    } else if(p.periodStart) {
      period = 'from ' + new Date(p.periodStart).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    }
    var hStr = '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);background:linear-gradient(90deg,#FFF1F2 0%,#fff 60%)">';
    hStr += '<div style="width:32px;height:32px;border-radius:9px;background:#FFE4E6;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">🛏️</div>';
    hStr += '<div style="flex:1;min-width:0">';
    hStr += '<div style="font-size:13px;font-weight:700">Airbnb / STR income</div>';
    hStr += '<div style="font-size:11px;color:var(--muted)">'+esc(p.property||'')+(period?' · '+period:'')+' · paid '+paidStr+'</div>';
    hStr += '</div>';
    hStr += '<div style="font-size:15px;font-weight:800;color:#E04E53;font-family:monospace;flex-shrink:0">'+fmt(+p.amount||0)+'</div>';
    hStr += '<button data-pid="'+p.id+'" onclick="deleteStrIncome(this.dataset.pid)" title="Remove" style="background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:0 6px;font-family:inherit">×</button>';
    hStr += '</div>';
    return hStr;
  }
  if(!p.tenant) return '';
  var tenant = state.tenants.find(function(t){return t.name===p.tenant;});
  if(p._isArrears) {
    var t = tenant;
    var h = '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);background:#FFF8F8">';
    h += '<div style="width:32px;height:32px;border-radius:9px;background:var(--red-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--red);flex-shrink:0">'+(t?t.name[0]:'?')+'</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:13px;font-weight:700">'+esc(p.tenant)+'</div>';
    h += '<div style="font-size:11px;color:var(--muted)">'+esc(p.property)+' · Rm '+esc(p.room)+' · <span style="color:var(--red);font-weight:600">⚠️ Standing Arrears</span></div>';
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
  // _waSanitize strips any 4-byte emojis from tenant names / company names that
  // would otherwise show as \uFFFD on the recipient's WhatsApp.
  var waMsg = encodeURIComponent(_waSanitize(
    'Hi '+((p.tenant||'Tenant').split(' ')[0])+', your rent of \u00A3'+(p.amount||0)+
    ' is '+(dueStatus==='overdue'?'overdue. Please pay urgently':'due '+dueDateStr+'. Please arrange payment.')+
    ' Thank you \u2014 '+((state.companies&&state.companies[0]&&state.companies[0].name)||(state._currentOrg&&state._currentOrg.name)||'Your Property Manager')+'.'));

  var h = '<div style="border-bottom:1px solid var(--border);padding:12px 14px;background:'
    +(dueStatus==='overdue'?'#FFF8F8':dueStatus==='today'?'#FFFBF0':'var(--surface)')+';">';

  // Header row: avatar + name + amount
  h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
  h += '<div style="width:36px;height:36px;border-radius:10px;flex-shrink:0;background:'+sc.bg
    +';border:1px solid '+sc.border+';display:flex;align-items:center;justify-content:center'
    +';font-size:14px;font-weight:700;color:'+sc.text+'">'+p.tenant[0]+'</div>';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-weight:700;font-size:14px">'+esc(p.tenant)+'</div>';
  h += '<div style="font-size:11px;color:var(--muted)">'+esc(p.property)+' &middot; Rm '+esc(room)+'</div>';
  h += '</div>';
  h += '<div style="text-align:right;flex-shrink:0">';
  h += '<div style="font-size:16px;font-weight:700;font-family:monospace">&pound;'+p.amount+'</div>';
  h += '<div style="font-size:10px;font-weight:600;color:'+sc.text+'">'+dueLabel+'</div>';
  h += '</div></div>';

  // Method pill row — fixed min-height so cash (with Cash Collection badge) and
  // bank cards line up vertically. Without this the cards have different heights
  // because cash mode adds a "Cash Collection" badge that bank mode lacks.
  h += '<div style="margin-bottom:8px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:24px">';
  h += '<button onclick="togglePaymentMethod(\''+String(p.id)+'\')" style="padding:4px 10px;border-radius:20px;'
    +'border:1px solid '+(isCash?'#FDE68A':'#BFDBFE')+';background:'+(isCash?'#FFFBEB':'#EFF6FF')
    +';color:'+(isCash?'var(--amber)':'var(--blue)')+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">'
    +(isCash?'&#x1F4B5; Cash':'&#x1F3E6; Bank')+'</button>';
  if(isCash&&!isPaid)
    h += '<span style="font-size:10px;font-weight:700;color:var(--amber);background:#FFFBEB;'
      +'border:1px solid #FDE68A;padding:2px 8px;border-radius:10px">&#x1F4CB; Cash Collection</span>';
  h += '</div>';

  // Action buttons — both cash and bank cards now have the same number of buttons
  // (4: primary + Partial + alt-method + WA) so the row wraps identically and the
  // cards have matching heights. min-height locks the row when WA is missing.
  h += '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-height:42px">';
  if(!isPaid){
    if(isCash){
      h += '<button onclick="markPaid(\''+String(p.id)+'\',\'cash\')" style="flex:1;padding:9px;border-radius:9px;'
        +'border:none;background:var(--amber);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">'
        +'&#x1F4B5; Mark Cash Collected</button>';
      h += '<button onclick="markPartialPaid(\''+String(p.id)+'\','+p.amount+')" style="padding:9px 10px;border-radius:9px;'
        +'border:1px solid var(--amber);background:#fff;color:#92400E;font-size:12px;font-weight:700;'
        +'cursor:pointer;font-family:inherit">Partial</button>';
      // Symmetry button: lets a cash-mode card flip to bank-confirmed without first
      // toggling the pill — mirrors the "Cash" shortcut on bank cards.
      h += '<button onclick="markPaid(\''+String(p.id)+'\',\'bank\')" style="padding:9px 10px;border-radius:9px;'
        +'border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;'
        +'cursor:pointer;font-family:inherit">Bank</button>';
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
  var daysLate = Math.floor((nowLocalMidnight() - toLocalMidnight(due)) / 86400000);
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
    if(mode==='overdue') return 'Hi '+fn+', your rent of '+amt+' is overdue. Please pay as soon as possible. Thank you — '+((state.companies&&state.companies[0]&&state.companies[0].name)||(state._currentOrg&&state._currentOrg.name)||'Your Property Manager')+'.';
    if(mode==='today')   return 'Hi '+fn+', your rent of '+amt+' is due today. Please ensure payment is made. Thank you — '+((state.companies&&state.companies[0]&&state.companies[0].name)||(state._currentOrg&&state._currentOrg.name)||'Your Property Manager')+'.';
    return 'Hi '+fn+', a rent payment of '+amt+' is outstanding. Please arrange payment at your earliest convenience. Thank you — '+((state.companies&&state.companies[0]&&state.companies[0].name)||(state._currentOrg&&state._currentOrg.name)||'Your Property Manager')+'.';
  }
  var allLinks=items.map(function(item){return 'https://wa.me/'+String(item.t.whatsapp||'').replace(/\D/g,'')+'?text='+encodeURIComponent(_waSanitize(buildMsg(item)));});
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
      var waHref='https://wa.me/'+String(item.t.whatsapp||'').replace(/\D/g,'')+'?text='+encodeURIComponent(_waSanitize(buildMsg(item)));
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

  // _waEmoji() \u2014 emojis on mobile, plain text on desktop browsers.
  var msg = _waEmoji('\uD83D\uDCB5 ') + '*CASH COLLECTION LIST*' + NL;
  msg += _waEmoji('\uD83D\uDCC5 ') + today + NL;
  msg += '\u2501'.repeat(18) + NL + NL;

  cashList.forEach(function(p, i) {
    var t = state.tenants.find(function(x){ return x.name === p.tenant; });
    var prop = state.properties.find(function(x){ return x.name === p.property; });
    var address = prop ? (prop.address || p.property) : p.property;
    var phone = t && t.whatsapp ? '+' + t.whatsapp : '\u2014';
    var dueStatus = getDueStatus(p);
    var statusIcon = dueStatus === 'overdue' ? _waEmoji('\u26A0\uFE0F ') : dueStatus === 'today' ? _waEmoji('\uD83D\uDD34 ') : _waEmoji('\uD83D\uDCC5 ');
    var statusLbl = dueStatus === 'overdue' ? '[OVERDUE]' : dueStatus === 'today' ? '[TODAY]' : '[DUE]';

    msg += (i + 1) + '. ' + _waEmoji('\uD83D\uDC64 ') + '*' + p.tenant + '*' + NL;
    msg += '   ' + _waEmoji('\uD83C\uDFE0 ') + address + ', Rm ' + (t ? t.room : '?') + NL;
    msg += '   ' + _waEmoji('\uD83D\uDCB0 ') + '*\u00A3' + p.amount + '* ' + statusIcon + statusLbl + NL;
    msg += '   ' + _waEmoji('\uD83D\uDCDE ') + 'Phone: ' + phone + NL;
    if(i < cashList.length - 1) msg += NL;
  });

  msg += NL + '\u2501'.repeat(18) + NL;
  msg += _waEmoji('\uD83D\uDCB0 ') + '*TOTAL: \u00A3' + total + '* (' + cashList.length + ' collection' + (cashList.length === 1 ? '' : 's') + ')' + NL;
  msg += _waEmoji('\u2705 ') + 'Mark each as collected once received.';

  window.open('https://wa.me/?text=' + encodeURIComponent(_waSanitize(msg)), '_blank');
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
  var schedDedupMaps = buildScheduleDedupMapsFromPayments();
  var schedInPeriod=period==='ytd'?state.rentSchedule:state.rentSchedule.filter(function(s){var d=new Date(s.dueDateRaw);return d>=from&&d<=to;});
  var schedOnly=schedInPeriod.filter(function(s){
    if(s.status==='paid') return false;
    if(seenDates.has((s.tenantName||'')+'_'+new Date(s.dueDateRaw).toDateString())) return false;
    if (scheduleSyntheticLooksDuped(s, schedDedupMaps)) return false;
    return true;
  });
  var synth=schedOnly.map(function(s){return {id:s.id,tenant:s.tenantName,property:s.property,amount:s.amount,method:s.method,status:'outstanding',_dueDateRaw:s.dueDateRaw,_fromSched:true};});
  var allPayments=existing.concat(synth);
  // For collected tab: filter ALL payments by paidDate in period (not dueDate)
  // This shows payments RECEIVED in the period, regardless of when they were due
  var paidInPeriod = state.payments.filter(function(p){
    if(p.status!=='paid' && p.status!=='Paid') return false;
    if(period==='ytd') return true;
    var fromD = new Date(from); fromD.setHours(0,0,0,0);
    var toD = new Date(to); toD.setHours(23,59,59,999);
    // Prefer clock date when payment was marked (correct for Collected); paidDate strings were historically wrong for schedule-paid rows.
    if(p._paidDateRaw && !isNaN(p._paidDateRaw)) {
      var paidFromRaw = new Date(p._paidDateRaw);
      paidFromRaw.setHours(0,0,0,0);
      return paidFromRaw >= fromD && paidFromRaw <= toD;
    }
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
    return paidD >= fromD && paidD <= toD;
  });
  // Apply income source filter (rent / airbnb / all) — only filters paid/owed lists, not the schedule
  var _rentSrc = state.filters.rentSource || 'all';
  function _matchesSource(p){
    if(_rentSrc === 'all') return true;
    var src = p.incomeSource || 'rent';
    return src === _rentSrc;
  }
  // Collected tab + “Collected” summary: only payments received in this period (no fallback to all-time — that hid fresh marks when paidDate was wrong).
  var paid = paidInPeriod.filter(_matchesSource);
  var paidForTab = paid;
  var owed=allPayments.filter(function(p){return p.status!=='paid'&&p.status!=='Paid';}).filter(_matchesSource);
  var overdueFromPeriod=owed.filter(function(p){return getDueStatus(p)==='overdue';});
  // Payment rows + synth for ALL unpaid overdue slots (any due date). Period filter above hides
  // last week’s / last month’s overdue when viewing “This Week” etc., which emptied the Overdue tab.
  var overduePayRows = overdueFromPeriod;
  if(period!=='ytd'){
    var existingAll = pool;
    var seenAll = new Set(existingAll.map(function(p){ return (p.tenant||p.tenantName||'')+'_'+getDueDateObj(p).toDateString(); }));
    var schedOnlyAll = state.rentSchedule.filter(function(s){
      if(s.status==='paid') return false;
      if(seenAll.has((s.tenantName||'')+'_'+new Date(s.dueDateRaw).toDateString())) return false;
      if (scheduleSyntheticLooksDuped(s, schedDedupMaps)) return false;
      return true;
    });
    var synthAll = schedOnlyAll.map(function(s){
      return {id:s.id,tenant:s.tenantName,property:s.property,amount:s.amount,method:s.method,status:'outstanding',_dueDateRaw:s.dueDateRaw,_fromSched:true};
    });
    var owedAll = existingAll.concat(synthAll).filter(function(p){ return p.status!=='paid'&&p.status!=='Paid'; });
    overduePayRows = owedAll.filter(function(p){ return getDueStatus(p)==='overdue'; });
  }
  // Standing arrears: only if not already listed as overdue rent for that tenant
  var arrearsEntries = state.tenants
    .filter(function(t){return t.status!=='inactive' && (t.arrears||0)>0;})
    .filter(function(t){
      return !overduePayRows.some(function(o){return o.tenant===t.name;});
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
        _dueDateRaw: (function(){ var n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()-1).getTime(); })()
      };
    });
  var overdue = overduePayRows.concat(arrearsEntries);
  var totalOverdueMoney = overdue.reduce(function(s,p){ return s+(p.amount||0); }, 0);
  var upcomingUnpaidSum = owed.filter(function(p){ return getDueStatus(p)!=='overdue'; }).reduce(function(s,p){ return s+p.amount; }, 0);
  var dueToday=owed.filter(function(p){return getDueStatus(p)==='today';});
  var tomorrow=owed.filter(function(p){return getDueStatus(p)==='tomorrow';});
  var cashColl=owed.filter(function(p){return p.method==='cash';});
  var activeData=rentTab==='overdue'?overdue:rentTab==='today'?dueToday:rentTab==='tomorrow'?tomorrow:rentTab==='paid'?paidForTab:cashColl;
  // Free-text search across tenant + property in the active tab. Empty query
  // returns the full list. Search applies AFTER tab filtering so the counts on
  // the tab pills above remain accurate.
  var rentQ = (state.filters.rentQ||'').toLowerCase().trim();
  if (rentQ) {
    activeData = activeData.filter(function(p){
      var t = (p.tenant || p.tenantName || '').toLowerCase();
      var pr = (p.property || p.propertyName || '').toLowerCase();
      return t.indexOf(rentQ) >= 0 || pr.indexOf(rentQ) >= 0;
    });
  }
  var totalPaid=paid.reduce(function(s,p){return s+p.amount;},0).toLocaleString();
  var owedSum = owed.reduce(function(s,p){ return s+p.amount; }, 0);
  var totalOwed = owedSum.toLocaleString();
  // Expected = sum of all payments scheduled in this period (paid + outstanding)
  // This makes the bar and rate reflect the chosen period correctly
  // Expected = only scheduled amounts (paid + outstanding in period), NOT all historical payments
  // This prevents old Supabase payments with null due_date (which fall back to TODAY) inflating the total
  var totalCollected = paid.reduce(function(s,p){return s+p.amount;},0);
  var totalOutstanding = synth.reduce(function(s,p){return s+p.amount;},0);
  var totalExpect = totalCollected + totalOutstanding;
  var rate = totalExpect ? Math.round(totalCollected/totalExpect*100) : 0;
  window._renderedOverdue = overdue;
  // Chase: tenants with WA on any row in the Overdue list (overdue spans all past dues when period ≠ YTD)
  overdueWithWA=overdue.filter(function(p){
    if(p._isArrears) {
      var t=state.tenants.find(function(x){return x.name===p.tenant;});
      return t&&t.whatsapp;
    }
    var t=state.tenants.find(function(x){return x.name===p.tenant;});
    return t&&t.whatsapp&&getDueStatus(p)==='overdue';
  });
  var bankPaid = paid.filter(function(p){return p.method==='bank';}).reduce(function(s,p){return s+p.amount;},0);
  var cashPaid = paid.filter(function(p){return p.method==='cash';}).reduce(function(s,p){return s+p.amount;},0);
  var bankPaidCount = paid.filter(function(p){return p.method==='bank';}).length;
  var cashPaidCount = paid.filter(function(p){return p.method==='cash';}).length;

  var h='';
  // ── New v2 header — title + Chase pill (red) on the right ──
  var rentActions = [];
  if (overdueWithWA.length > 0) {
    rentActions.push('<button onclick="bulkChaseOverdue()" style="padding:7px 12px;border-radius:999px;border:none;background:var(--red-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px">⚠ Chase <span style="background:rgba(255,255,255,.25);padding:1px 6px;border-radius:999px;font-size:10px">'+overdueWithWA.length+'</span></button>');
  }
  rentActions.push('<button onclick="bulkEmailReminders()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit" title="Email reminders">✉</button>');
  h += renderScreenHeader({
    title: 'Rent Collection',
    subtitle: periodInfo.label,
    rightActions: rentActions
  });

  // ── Hero with embedded progress bar ──
  h += renderHeroCard({
    icon: '📈',
    label: 'Collected ' + (period==='ytd' ? 'YTD' : 'This Period'),
    value: '<span style="color:#fff">£' + totalCollected.toLocaleString() + '</span> <span style="font-size:14px;opacity:.7">/ ' + fmt(totalExpect) + ' expected</span>',
    subtitle: rate + '% collection rate · ' + paid.length + ' of ' + (paid.length + owed.length) + ' payments',
    progress: rate
  });

  // ── Overdue alert card (only when there's any) ──
  if (totalOverdueMoney > 0) {
    h += renderAlertCard({
      severity: 'danger',
      icon: '⚠',
      title: '£' + totalOverdueMoney.toLocaleString() + ' overdue',
      subtitle: overdue.length + ' payments need chasing',
      onClick: 'state.filters.rentTab=\'overdue\';render()'
    });
  }

  // ── 3-col stat row: Bank · Cash · Unpaid ──
  h += renderStatRow([
    { label:'Bank',   value: '£' + bankPaid.toLocaleString(), color:'blue',   subtitle: bankPaidCount + ' payments' },
    { label:'Cash',   value: '£' + cashPaid.toLocaleString(), color: cashPaid>0?'amber':'default', subtitle: cashPaidCount + ' payments' },
    { label:'Unpaid', value: '£' + (totalOverdueMoney + upcomingUnpaidSum).toLocaleString(), color: owed.length?'red':'default', subtitle: owed.length + ' due' }
  ]);

  // ── Period selector — compact horizontal scroll of chips ──
  h += '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px;-webkit-overflow-scrolling:touch;scrollbar-width:none">';
  [{v:'week',l:'This Week'},{v:'prev-week',l:'Last Week'},{v:'month',l:'This Month'},{v:'prev-month',l:'Last Month'},{v:'ytd',l:'YTD'}].forEach(function(x){
    var active = period===x.v;
    h += '<button onclick="state.filters.rentPeriod=\''+x.v+'\';render()" style="padding:7px 14px;border-radius:999px;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;flex-shrink:0;border:1px solid '+(active?'var(--teal-300)':'var(--gray-200)')+';background:'+(active?'var(--teal-50)':'#fff')+';color:'+(active?'var(--teal-700)':'var(--gray-700)')+'">'+x.l+'</button>';
  });
  h += '</div>';

  // Income-source pills (only when STR present)
  var hasAnyStr = (state.properties||[]).some(function(p){return p.isStrEnabled;});
  if (hasAnyStr) {
    var rs = state.filters.rentSource||'all';
    h += '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px;-webkit-overflow-scrolling:touch;scrollbar-width:none">';
    [{v:'all',l:'All sources'},{v:'rent',l:'🏠 Tenant rent'},{v:'airbnb',l:'🛏️ Airbnb / STR'}].forEach(function(x){
      var active = rs===x.v;
      h += '<button onclick="state.filters.rentSource=\''+x.v+'\';render()" style="padding:6px 12px;border-radius:999px;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;flex-shrink:0;border:1px solid '+(active?'var(--teal-300)':'var(--gray-200)')+';background:'+(active?'var(--teal-50)':'#fff')+';color:'+(active?'var(--teal-700)':'var(--gray-700)')+'">'+x.l+'</button>';
    });
    h += '</div>';
  }
  // Total Arrears KPI — based on real overdue scheduled payments (not the stale t.arrears field)
  // Sum every overdue unpaid payment for active tenants. Counts unique tenants with at least one overdue.
  var _today = new Date(); _today.setHours(0,0,0,0);
  var _activeTenantIds = {};
  state.tenants.forEach(function(t){ if(t.status!=='inactive') _activeTenantIds[String(t.id)] = true; });
  var _overduePayments = (state.payments||[]).filter(function(p){
    if(p.status==='paid' || p.status==='Paid') return false;
    if(p.tenantId && !_activeTenantIds[String(p.tenantId)]) return false;
    var d = p._dueDateRaw ? new Date(p._dueDateRaw) : (typeof getDueDateObj === 'function' ? getDueDateObj(p) : null);
    return d && d < _today;
  });
  var totalArrears = _overduePayments.reduce(function(s,p){return s+(+p.amount||0);},0);
  var _arrearTenants = {};
  _overduePayments.forEach(function(p){ if(p.tenantId) _arrearTenants[String(p.tenantId)] = true; });
  var arrearsCount = Object.keys(_arrearTenants).length;
  // Fallback to legacy t.arrears field if no overdue payments computed (back-compat)
  if(totalArrears === 0) {
    totalArrears = state.tenants.filter(function(t){return t.status!=='inactive'&&t.arrears>0;}).reduce(function(s,t){return s+(t.arrears||0);},0);
    arrearsCount = state.tenants.filter(function(t){return t.status!=='inactive'&&t.arrears>0;}).length;
  }
  // Red Total Rent Arrears banner removed — was producing misleading numbers; arrears now only surface
  // in the dedicated Arrears / Tenants views.
  
  // Search box — filters the rows in the active tab by tenant name OR property.
  // Stable id ('rent-search-input') so debouncedRentSearch can restore focus
  // after re-render (same pattern as the Tenants page search).
  h += '<div style="position:relative;margin-bottom:10px">'
    +   '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--gray-500)">🔍</span>'
    +   '<input class="inp" id="rent-search-input" placeholder="Search tenant or property…" value="'+esc(state.filters.rentQ||'')+'" oninput="state.filters.rentQ=this.value;debouncedRentSearch()" style="width:100%;padding-left:30px;border-radius:var(--radius-md);background:#fff;border:1px solid var(--gray-200);font-size:13px;height:38px">'
    + '</div>';

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

/**
 * Tenant name → true for KPIs and filters: standing balance (t.arrears) or any overdue rent
 * line (scheduled or in the payment pool). Uses YTD scope so weekly/monthly dues are not clipped
 * to “this week” only (matches how Rent builds overdue from the full schedule + history).
 */
function getTenantsInArrearsKpiMap() {
  var out = {};
  state.tenants.forEach(function (t) {
    if (t.status === 'inactive') return;
    if ((t.arrears || 0) > 0) out[t.name] = +t.arrears || 0;
  });
  var period = 'ytd';
  var periodInfo = getPeriodDates(period);
  // Use live payments only — not getFullPaymentPool() (which merges tenant.paymentHistory).
  // History rows are not updated when schedule/payments are marked paid, so they caused
  // false "overdue" on the Tenants KPI after rent was cleared.
  var pool = state.payments.slice();
  var existing = period === 'ytd' ? pool : pool.filter(function (p) {
    var d = getDueDateObj(p);
    return d >= periodInfo.from && d <= periodInfo.to;
  });
  var seenDates = new Set(
    existing.map(function (p) {
      return (p.tenant || p.tenantName || '') + '_' + getDueDateObj(p).toDateString();
    })
  );
  var schedDedupMaps = buildScheduleDedupMapsFromPayments();
  var schedInPeriod =
    period === 'ytd'
      ? state.rentSchedule
      : state.rentSchedule.filter(function (s) {
          var d = new Date(s.dueDateRaw);
          return d >= periodInfo.from && d <= periodInfo.to;
        });
  var schedOnly = schedInPeriod.filter(function (s) {
    if (s.status === 'paid') return false;
    if (seenDates.has((s.tenantName || '') + '_' + new Date(s.dueDateRaw).toDateString())) return false;
    if (scheduleSyntheticLooksDuped(s, schedDedupMaps)) return false;
    return true;
  });
  var synth = schedOnly.map(function (s) {
    return {
      id: s.id,
      tenant: s.tenantName,
      property: s.property,
      amount: s.amount,
      method: s.method,
      status: 'outstanding',
      _dueDateRaw: s.dueDateRaw,
      _fromSched: true,
    };
  });
  var allPayments = existing.concat(synth);
  var owed = allPayments.filter(function (p) {
    return p.status !== 'paid' && p.status !== 'Paid';
  });
  owed.forEach(function (p) {
    if (getDueStatus(p) !== 'overdue') return;
    var tn = p.tenant || p.tenantName;
    if (!tn) return;
    var tenant = state.tenants.find(function (t) {
      return t.name === tn;
    });
    if (tenant && tenant.status !== 'inactive') {
      out[tn] = (out[tn] || 0) + (+p.amount || 0);
    }
  });
  return out;
}

/** Live arrears £ for a single tenant — single source of truth used by the tenant
 *  profile AND the KPI pill on the tenant cards. Keeps them in sync so a tenant
 *  can't show "Rent overdue" on the card and £0 inside the profile. */
function getTenantArrearsAmount(tenantName) {
  if (!tenantName) return 0;
  var map = getTenantsInArrearsKpiMap();
  return +map[tenantName] || 0;
}

// ── Expenses helpers (Bundle 1) ─────────────────────────────────────────────
function _expDate(e){
  if(!e || !e.startDate) return null;
  var d = new Date(e.startDate);
  return isNaN(d.getTime()) ? null : d;
}
// Returns the "next due date" for a recurring monthly expense from a given anchor.
// Recurring expenses repeat on the same day-of-month as their startDate.
function _expNextDue(e, fromDate){
  var sd = _expDate(e); if(!sd) return null;
  if(!e.recurring) return sd >= fromDate ? sd : null;
  var anchor = new Date(fromDate.getFullYear(), fromDate.getMonth(), sd.getDate());
  if(anchor < fromDate) anchor.setMonth(anchor.getMonth()+1);
  // If recurring started in the future, use the actual start
  if(sd > anchor) return sd;
  return anchor;
}
function _expMatchesQ(e, q){
  if(!q) return true;
  q = q.toLowerCase();
  return ((e.desc||'')+' '+(e.cat||'')+' '+(e.type||'')+' '+(e.property||'')+' '+(e.vendor||'')).toLowerCase().indexOf(q) >= 0;
}
function clearExpFilters(){
  state.filters.expQ=''; state.filters.expMin=''; state.filters.expMax='';
  state.filters.expType=''; state.filters.expCompany=''; state.filters.expMonth='all';
  render();
}

// ── Expense budgets (Bundle 2) ─────────────────────────────────────────
function getExpenseBudgets(){
  if(!state.config) state.config = {};
  if(!state.config.expenseBudgets) state.config.expenseBudgets = {};
  return state.config.expenseBudgets;
}
function setExpenseBudget(cat, amount){
  var b = getExpenseBudgets();
  var amt = parseFloat(amount);
  if(isNaN(amt) || amt <= 0) { delete b[cat]; }
  else { b[cat] = amt; }
  saveState();
  render();
}
function openBudgetsModal(){
  var b = getExpenseBudgets();
  var defaults = ['Council Tax','Energy – Gas','Energy – Electric','Water','Internet / Broadband','Cleaning','Maintenance & Repairs','Insurance','HMO Licence','Property Costs','Staff & Labour','Contractor','Software & Tools','Accountancy','Legal','Overhead'];
  // "In use" cats = whatever the Cost Breakdown actually groups by on the Expenses
  // Overview — so a budget entered here matches exactly what the card shows.
  var inUseCats = [];
  var seenCI = {}; // case-insensitive dedupe
  state.expenses.forEach(function(e){
    var c = e.cat || e.type;
    if(!c) return;
    var key = String(c).trim().toLowerCase();
    if(!seenCI[key]){ seenCI[key] = c; inUseCats.push(c); }
  });
  // Remaining defaults = defaults not already represented (case-insensitive).
  var extraDefaults = defaults.filter(function(d){return !seenCI[String(d).trim().toLowerCase()];});
  function _getBudgetCI(c){
    if(b[c]!=null) return b[c];
    var nk = String(c).trim().toLowerCase();
    var ks = Object.keys(b);
    for(var i=0;i<ks.length;i++){ if(String(ks[i]).trim().toLowerCase()===nk) return b[ks[i]]; }
    return '';
  }
  function _row(c){
    return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">'
      +'<div style="flex:1;font-size:13px;color:var(--text)">'+esc(c)+'</div>'
      +'<div style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--muted)">£'
      +'<input type="number" step="50" value="'+(_getBudgetCI(c)||'')+'" data-cat="'+esc(c)+'" oninput="setExpenseBudget(this.dataset.cat,this.value)" style="width:90px;padding:6px 8px;border-radius:7px;border:1px solid var(--border);font-family:monospace;font-size:13px" placeholder="—">'
      +'</div>'
    +'</div>';
  }
  var sectionHdr = function(t){ return '<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 4px">'+t+'</div>'; };
  var body = '';
  if(inUseCats.length){
    body += sectionHdr('Categories you use ('+inUseCats.length+')');
    body += inUseCats.map(_row).join('');
  }
  if(extraDefaults.length){
    body += sectionHdr('Other common categories');
    body += extraDefaults.map(_row).join('');
  }
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:520px">'
    +'<div class="modal-header"><span class="modal-title">📊 Monthly Budgets</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body" style="max-height:65vh;overflow-y:auto">'
    +'<p style="font-size:12px;color:var(--muted);margin-bottom:4px;line-height:1.5">Set a target monthly spend per category. Leave blank or 0 to remove a budget. The Overview shows progress bars (green &lt; 80%, amber 80–100%, red over budget).</p>'
    +'<p style="font-size:11px;color:var(--dim);margin-bottom:14px;line-height:1.5">The <strong>Categories you use</strong> section mirrors the exact labels grouping your current expenses — budgets set here are guaranteed to match the Cost Breakdown card.</p>'
    +body
    +'</div>'
    +'<div class="modal-footer"><button onclick="closeModal()" class="btn btn-primary">Done</button></div>'
    +'</div></div>';
}

// ── Receipt attachments (Bundle 2) ─────────────────────────────────────
// Receipts stored on the expense object as data URL (base64) for now;
// future enhancement: upload to Supabase Storage and store URL instead.
function attachReceiptToExp(expId, fileInput){
  var e = state.expenses.find(function(x){return x.id===expId;});
  if(!e) return;
  var f = fileInput.files && fileInput.files[0];
  if(!f) return;
  if(f.size > 4*1024*1024){ alert('Receipt too large (max 4 MB).'); return; }
  var reader = new FileReader();
  reader.onload = function(ev){
    e.receipt = ev.target.result;
    e.receiptName = f.name;
    e.receiptType = f.type;
    saveState();
    showToast('Receipt attached to '+(e.desc||'expense'), 'success');
    render();
  };
  reader.readAsDataURL(f);
}
function viewReceipt(expId){
  var e = state.expenses.find(function(x){return x.id===expId;});
  if(!e || !e.receipt){ alert('No receipt attached.'); return; }
  var w = window.open();
  if(!w){ alert('Please allow pop-ups to view the receipt.'); return; }
  if((e.receiptType||'').indexOf('pdf')>=0){
    w.document.write('<embed src="'+e.receipt+'" style="width:100%;height:100vh">');
  } else {
    w.document.write('<img src="'+e.receipt+'" style="max-width:100%;display:block;margin:0 auto">');
  }
  w.document.title = e.receiptName||'Receipt';
}
function removeReceipt(expId){
  var e = state.expenses.find(function(x){return x.id===expId;});
  if(!e) return;
  if(!confirm('Remove receipt for "'+(e.desc||'expense')+'"?')) return;
  delete e.receipt; delete e.receiptName; delete e.receiptType;
  saveState(); render();
}

function renderExpenses() {
  const tab      = state.filters.expenses||'overview';
  const selMonth = state.filters.expMonth||'all';
  const expQ     = (state.filters.expQ||'').trim();
  const expMin   = state.filters.expMin === '' || state.filters.expMin == null ? null : +state.filters.expMin;
  const expMax   = state.filters.expMax === '' || state.filters.expMax == null ? null : +state.filters.expMax;

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
    if(expQ && !_expMatchesQ(e, expQ)) return false;
    if(expMin != null && !isNaN(expMin) && (+e.amount||0) < expMin) return false;
    if(expMax != null && !isNaN(expMax) && (+e.amount||0) > expMax) return false;
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

  // ── v2 header / hero / stat row ──
  var coPill = '<select onchange="state.filters.expCompany=this.value;render()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;max-width:140px"><option value="">All Co.</option>'+(state.companies||[]).map(function(c){return '<option value="'+c.id+'" '+(state.filters.expCompany===c.id?'selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select>';
  var moPill = '<select onchange="state.filters.expMonth=this.value;render()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer"><option value="all">All Time</option>'+MONTHS.slice().reverse().map(function(m){return '<option value="'+m.key+'" '+(selMonth===m.key?'selected':'')+'>'+m.label+'</option>';}).join('')+'</select>';
  var budgetsBtn = '<button onclick="openBudgetsModal()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit" title="Budgets">📊</button>';
  var expAddBtn = '<button onclick="openModal(\'addExpense\')" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Add</button>';
  var headerHtml = '';
  headerHtml += renderScreenHeader({
    title: 'Expenses',
    subtitle: filtered.length + ' record' + (filtered.length===1?'':'s') + ' · ' + moLabel,
    rightActions: [coPill, moPill, budgetsBtn, expAddBtn]
  });
  headerHtml += renderHeroCard({
    icon: '\u{1F4B7}',
    label: 'Total Spent · ' + moLabel,
    value: '<span style="color:#fff">' + fmt(total) + '</span>',
    subtitle: filtered.length + ' record' + (filtered.length===1?'':'s') + (actual>0 ? ' · ' + fmt(actual) + ' job costs' : '')
  });
  headerHtml += renderStatRow([
    { label:'Property', value: fmt(prop),  color: prop>0?'blue':'dim' },
    { label:'Staff',    value: fmt(staff), color: staff>0?'amber':'dim' },
    { label:'Overhead', value: fmt(over),  color: over>0?'default':'dim' }
  ]);
  return headerHtml + `
    <div class="filters">
      ${[{v:'overview',l:'Overview'},{v:'list',l:'All Expenses'}].map(x=>`<button class="filter-btn ${tab===x.v?'active':''}" onclick="state.filters.expenses='${x.v}';state.filters.expType='';render()">${x.l}</button>`).join('')}
      ${tab==='list'?`<button class="filter-btn ${!state.filters.expType?'active':''}" onclick="state.filters.expType='';render()">All</button><button class="filter-btn ${'staff'===state.filters.expType?'active':''}" onclick="state.filters.expType='staff';render()">👷 Staff</button><button class="filter-btn ${'property'===state.filters.expType?'active':''}" onclick="state.filters.expType='property';render()">🏠 Property</button><button class="filter-btn ${'overhead'===state.filters.expType?'active':''}" onclick="state.filters.expType='overhead';render()">⚙️ Overhead</button>`:''}
    </div>
    <!-- Search + amount range filter (always visible) -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <div style="position:relative;flex:1;min-width:220px">
        <input class="inp" id="exp-search-q" type="search" placeholder="🔍 Search description, vendor, category, property…" value="${esc(expQ)}" oninput="state.filters.expQ=this.value;clearTimeout(window._expQ);window._expQ=setTimeout(render,200)" style="padding-right:32px">
        ${expQ?`<button onclick="state.filters.expQ='';render()" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:16px;font-family:inherit">×</button>`:''}
      </div>
      <div style="display:flex;gap:6px;align-items:center;font-size:11px;color:var(--muted)">
        £<input class="inp" type="number" inputmode="numeric" placeholder="min" value="${expMin==null?'':expMin}" oninput="state.filters.expMin=this.value;clearTimeout(window._expR);window._expR=setTimeout(render,250)" style="width:80px;padding:8px 10px">
        – £<input class="inp" type="number" inputmode="numeric" placeholder="max" value="${expMax==null?'':expMax}" oninput="state.filters.expMax=this.value;clearTimeout(window._expR);window._expR=setTimeout(render,250)" style="width:80px;padding:8px 10px">
      </div>
      ${(expQ||expMin!=null||expMax!=null||state.filters.expCompany||(state.filters.expMonth&&state.filters.expMonth!=='all'))?`<button onclick="clearExpFilters()" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Clear filters</button>`:''}
    </div>
    ${tab==='overview'?`
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
        var budgets = getExpenseBudgets();
        // Case/whitespace-insensitive budget lookup — so a budget set as "Council Tax"
        // still matches an expense category stored as "council tax" or "Council Tax ".
        function _findBudget(catName){
          if(!catName) return 0;
          if(budgets[catName] != null) return +budgets[catName] || 0;
          var nk = String(catName).trim().toLowerCase();
          var keys = Object.keys(budgets);
          for(var i=0;i<keys.length;i++){
            if(String(keys[i]).trim().toLowerCase() === nk) return +budgets[keys[i]] || 0;
          }
          return 0;
        }
        return sorted.map(function(cat){
          var col = catColors[cat]||'#64748B';
          var spent = cats[cat];
          var budget = _findBudget(cat);
          var pctV;
          var budgetLabel = '';
          if(budget > 0) {
            pctV = Math.round(spent/budget*100);
            var barCol = pctV < 80 ? 'var(--green)' : pctV <= 100 ? 'var(--amber)' : 'var(--red)';
            col = barCol; // override category colour with budget status
            var pctClamped = Math.min(100, pctV);
            budgetLabel = '<span style="font-size:10px;color:var(--muted);font-weight:600;margin-left:6px">'+pctV+'% of '+fmt(budget)+'</span>';
            return '<div class="exp-bar-row">'
              +'<div class="exp-bar-top">'
                +'<span style="font-size:12px;color:var(--muted)">'+cat+budgetLabel+'</span>'
                +'<span class="mono" style="font-size:12px;font-weight:700;color:'+barCol+'">'+fmt(spent)+(pctV>100?' <span style="color:var(--red);font-weight:800">↑</span>':'')+'</span>'
              +'</div>'
              +'<div class="bar-track" style="background:#F1F5F9"><div class="bar-fill" style="width:'+pctClamped+'%;background:'+barCol+'"></div></div>'
            +'</div>';
          }
          // No budget set — show category colour and share-of-total
          pctV = total ? Math.round(spent/total*100) : 0;
          return '<div class="exp-bar-row">'
            +'<div class="exp-bar-top"><span style="font-size:12px;color:var(--muted)">'+cat+' <span style="font-size:10px;color:var(--dim)">no budget</span></span>'
            +'<span class="mono" style="font-size:12px;font-weight:700;color:'+col+'">'+fmt(spent)+'</span></div>'
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
      <!-- 12-Month Trend Chart (Bundle 1) -->
      ${(function(){
        var months = [];
        var now = new Date();
        for(var i=11;i>=0;i--){
          var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
          var end = new Date(now.getFullYear(), now.getMonth()-i+1, 0, 23,59,59);
          var label = d.toLocaleDateString('en-GB',{month:'short'});
          // Sum expenses in this month: one-off + recurring projected back if startDate<=end
          var total = 0;
          state.expenses.forEach(function(e){
            var sd = _expDate(e); if(!sd) return;
            // Apply company filter if active
            if(expCo){
              var companyMatch = (e.companyId===expCo);
              if(!companyMatch && e.property){ var p=state.properties.find(function(pp){return pp.name===e.property;}); if(p&&p.companyId===expCo) companyMatch=true; }
              if(!companyMatch) return;
            }
            if(e.recurring){
              if(sd <= end) total += (+e.amount||0);
            } else {
              if(sd >= d && sd <= end) total += (+e.amount||0);
            }
          });
          months.push({label:label, total:total, isCurrent: i===0});
        }
        var max = Math.max.apply(null, months.map(function(m){return m.total;}).concat([1]));
        var avg = months.reduce(function(s,m){return s+m.total;},0) / months.length;
        var lastVsAvg = avg ? Math.round(((months[11].total - avg)/avg)*100) : 0;
        return '<div class="card" style="margin-top:14px">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px">'
            +'<div><div class="card-title" style="margin:0">📈 12-Month Spend Trend</div>'
            +'<div style="font-size:11px;color:var(--muted);margin-top:3px">Avg/mo <strong style="color:var(--text);font-family:monospace">'+fmt(Math.round(avg))+'</strong>'+(lastVsAvg!==0?' · This month <span style="color:'+(lastVsAvg>0?'var(--red)':'var(--green)')+';font-weight:700">'+(lastVsAvg>0?'+':'')+lastVsAvg+'%</span> vs avg':'')+'</div></div>'
          +'</div>'
          +'<div style="display:flex;gap:6px;align-items:flex-end;padding:0 4px">'
            +months.map(function(m){
              var BAR_MAX_PX = 110; // pixel-based so it actually renders
              var px = max ? Math.max(2, Math.round((m.total/max)*BAR_MAX_PX)) : 2;
              var color = m.isCurrent ? 'var(--red)' : '#FCA5A5';
              return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:default" title="'+m.label+': '+fmt(m.total)+'">'
                +'<div style="font-size:9px;color:var(--muted);font-family:monospace;font-weight:'+(m.isCurrent?'800':'600')+'">'+(m.total>=1000?'£'+(m.total/1000).toFixed(1)+'k':'£'+(m.total||0))+'</div>'
                +'<div style="width:100%;background:'+color+';border-radius:4px 4px 0 0;height:'+px+'px;transition:height .4s ease-out"></div>'
                +'<div style="font-size:10px;color:'+(m.isCurrent?'var(--red)':'var(--muted)')+';font-weight:'+(m.isCurrent?'800':'600')+'">'+m.label+'</div>'
              +'</div>';
            }).join('')
          +'</div>'
        +'</div>';
      })()}
      ${(function(){
        // ── Upcoming Bills panel — recurring + future-dated, next 30 days (now at the bottom) ──
        var today = new Date(); today.setHours(0,0,0,0);
        var horizon = new Date(today.getTime() + 30*86400000);
        var upcoming = [];
        state.expenses.forEach(function(e){
          var due = _expNextDue(e, today);
          if(due && due >= today && due <= horizon){
            upcoming.push({e:e, due:due});
          }
        });
        upcoming.sort(function(a,b){ return a.due - b.due; });
        if(!upcoming.length) {
          return '<div class="card" style="margin-top:14px;background:linear-gradient(135deg,var(--green-light),#fff);border-color:#A7F3D0">'
            +'<div class="card-title" style="color:var(--green)">📅 Upcoming Bills · Next 30 days</div>'
            +'<div style="font-size:13px;color:var(--muted);padding:6px 0">Nothing scheduled in the next 30 days. Add a recurring expense to start tracking upcoming bills.</div>'
            +'</div>';
        }
        var totalUpcoming = upcoming.reduce(function(s,x){return s+(+x.e.amount||0);},0);
        var rows = upcoming.slice(0,8).map(function(x){
          var e=x.e, d=x.due;
          var daysAway = Math.round((d-today)/86400000);
          var label = daysAway===0?'Today':daysAway===1?'Tomorrow':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
          var pillColor = daysAway<=2?'var(--red)':daysAway<=7?'var(--amber)':'var(--blue)';
          var pillBg    = daysAway<=2?'#FEF2F2':daysAway<=7?'#FFFBEB':'#EFF6FF';
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px">'
            +'<span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:7px;background:'+pillBg+';color:'+pillColor+';min-width:62px;text-align:center">'+label+'</span>'
            +'<div style="flex:1;min-width:0">'
              +'<div style="font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.desc||e.cat||'Expense')+(e.recurring?' <span style="color:var(--blue);font-size:10px">🔄</span>':'')+'</div>'
              +'<div style="font-size:10px;color:var(--muted)">'+esc(e.cat||e.type||'')+(e.property?' · '+esc(e.property):'')+'</div>'
            +'</div>'
            +'<span class="mono" style="font-weight:700;color:var(--red)">'+fmt(+e.amount||0)+'</span>'
            +'</div>';
        }).join('');
        return '<div class="card" style="margin-top:14px;background:linear-gradient(135deg,#FFFBEB,#fff);border-color:#FDE68A">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
            +'<div class="card-title" style="margin:0;color:#92400E">📅 Upcoming Bills · Next 30 days</div>'
            +'<div style="font-size:11px;color:var(--muted)"><strong style="color:#92400E;font-family:monospace;font-size:14px">'+fmt(totalUpcoming)+'</strong> · '+upcoming.length+' bill'+(upcoming.length===1?'':'s')+'</div>'
          +'</div>'
          +rows
          +(upcoming.length>8?'<div style="font-size:11px;color:var(--muted);text-align:center;padding:8px 0">+ '+(upcoming.length-8)+' more</div>':'')
          +'</div>';
      })()}
    `:`
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Frequency</th><th>Status</th><th>Receipt</th><th>Actions</th></tr></thead>
          <tbody>
            ${filtered.filter(e=>!state.filters.expType||e.type===state.filters.expType).map(e=>`<tr>
              <td style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.cat||e.type}</td>
              <td style="font-size:12px">
                ${e.desc}
                ${e.property?`<div style="font-size:10px;color:var(--muted)">${esc(e.property)}</div>`:''}
              </td>
              <td class="mono" style="font-weight:700;color:var(--red)">${fmt(e.amount)}</td>
              <td>
                <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${e.recurring?'var(--blue-light)':'var(--bg)'};color:${e.recurring?'var(--blue)':'var(--muted)'}">
                  ${e.recurring?'🔄 Monthly':'1× One-off'}
                </span>
              </td>
              <td>${badge(e.status)}</td>
              <td>
                ${e.receipt
                  ? `<div style="display:flex;gap:4px;align-items:center"><button onclick="viewReceipt('${e.id}')" title="View receipt" style="padding:3px 7px;border-radius:6px;border:1px solid var(--green);background:var(--green-light);color:var(--green);font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">📎 View</button><button onclick="removeReceipt('${e.id}')" title="Remove receipt" style="padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:10px;cursor:pointer;font-family:inherit">×</button></div>`
                  : `<label style="cursor:pointer;font-size:10px;color:var(--blue);font-weight:600">📎 Attach<input type="file" accept="image/*,application/pdf" style="display:none" onchange="attachReceiptToExp('${e.id}',this)"></label>`}
              </td>
              <td><div style="display:flex;gap:6px">
                ${e.status==='estimated'?btn('✓ Confirm',`confirmExp('${e.id}')`,'primary',true):''}
                ${btn('✏️ Edit',`editExpModal('${e.id}')`,'secondary',true)}
                ${btn('🗑 Remove',`removeExp('${e.id}')`,'danger',true)}
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}` + renderFAB({icon:'+', label:'Add expense', onClick:"openModal('addExpense')"});
}
