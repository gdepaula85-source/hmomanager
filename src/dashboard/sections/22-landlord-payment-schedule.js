// ── LANDLORD PAYMENT SCHEDULE ──────────────────────────────────────────────
// Generates one entry per PROPERTY per month — so each can be paid independently
function ensureLandlordSchedule() {
  if(!state.landlordPayments) state.landlordPayments = [];
  // Purge any old bundle-style entries (created before per-property migration)
  // These are identified by having no propId field
  state.landlordPayments = state.landlordPayments.filter(function(p){
    return p.propId !== undefined && p.propId !== null;
  });
  var now = new Date();
  // Generate for last 3 months, current month, next 2 months
  var months = [];
  for(var offset=-3; offset<=2; offset++) {
    var d = new Date(now.getFullYear(), now.getMonth()+offset, 1);
    var y = d.getFullYear(), m = d.getMonth();
    var key = y+'-'+(m+1<10?'0':'')+(m+1);
    var label = d.toLocaleDateString('en-GB',{month:'short',year:'numeric'});
    months.push({key:key, label:label, ts: d.getTime()});
  }

  state.landlords.forEach(function(ll) {
    var llProps = state.properties.filter(function(p){return p.landlordName===ll.name && p.landlord>0;});
    if(!llProps.length) return;

    llProps.forEach(function(prop) {
      months.forEach(function(mo) {
        // One entry per property per month — keyed by landlordId + propId + monthKey
        var exists = state.landlordPayments.find(function(p){
          return p.landlordId===ll.id && p.propId===prop.id && p.monthKey===mo.key;
        });
        if(!exists) {
          state.landlordPayments.push({
            id: crypto.randomUUID(),
            landlordId: ll.id,
            landlordName: ll.name,
            propId: prop.id,
            monthKey: mo.key,
            monthLabel: mo.label,
            propName: prop.name,
            property: prop.name,
            amount: prop.landlord,
            dueDate: '01 '+mo.label,
            dueDateTs: mo.ts,
            paidDate: null,
            method: 'bank',
            status: 'pending',
            ref: 'LP-'+mo.key+'-'+prop.id
          });
        }
      });
    });
  });
}


function renderLandlords() {
  ensureLandlordSchedule();
  var lls   = state.landlords || [];
  var lpays = state.landlordPayments || [];
  var selLL = state.filters.landlords || 'all';

  // ── Month filter ─────────────────────────────────────────────────────────────
  var selMonth = state.filters.landlordMonth || '';
  var filteredPays = lpays;
  if(selMonth) {
    var mo = MONTHS.find(function(m){return m.key===selMonth;});
    if(mo) {
      filteredPays = lpays.filter(function(p){
        if(!p.dueDate) return false;
        var d = new Date(p.dueDate.replace(/ /g,'-'));
        return d >= mo.from && d <= mo.to;
      });
    }
  }

  // ── Company filter — apply FIRST so KPIs reflect selected company ───────────
  var selLLCo = state.filters.landlordCompany||'';
  if(selLLCo){
    var _coProps=state.properties.filter(function(p){return p.companyId===selLLCo;}).map(function(p){return p.name;});
    lls=lls.filter(function(ll){return state.properties.some(function(p){return p.landlordName===ll.name&&_coProps.indexOf(p.name)>=0;});});
    // Also filter payments to only those for this company's landlords
    var _coLLNames = lls.map(function(ll){return ll.name;});
    filteredPays = filteredPays.filter(function(p){
      return _coLLNames.indexOf(p.landlordName)>=0 ||
             _coProps.indexOf(p.propName)>=0 ||
             _coProps.indexOf(p.property)>=0;
    });
  }

  // ── Summary KPIs (now from filtered set) ────────────────────────────────────
  var totalOwed    = filteredPays.filter(function(p){return p.status==='pending';}).reduce(function(s,p){return s+p.amount;},0);
  var totalPaidAll = filteredPays.filter(function(p){return p.status==='paid';}).reduce(function(s,p){return s+p.amount;},0);
  var pendingCount = filteredPays.filter(function(p){return p.status==='pending';}).length;
  var totalMonthly = lls.reduce(function(s,ll){
    var llProps = (state.properties||[]).filter(function(p){
      return p.landlordName===ll.name && (!selLLCo || p.companyId===selLLCo);
    });
    return s + llProps.reduce(function(ss,p){return ss+p.landlord;},0);
  },0);
  var html = '<div class="page-header">'    +'<div><div class="page-title">Landlords</div>'    +'<div class="page-sub">'+lls.length+' landlords \u00B7 '+pendingCount+' payments pending'+(selMonth?' \u00B7 '+MONTHS.find(function(m){return m.key===selMonth;}).label:'')+'</div></div>'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    +'<select onchange="state.filters.landlordCompany=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">'
    +'<option value="">&#x1F3E2; All Companies</option>'
    +(state.companies||[]).map(function(c){return '<option value="'+c.id+'" '+(selLLCo===c.id?'selected':'')+'>'+c.name+'</option>';}).join('')
    +'</select>'
    +'<select onchange="state.filters.landlordMonth=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;min-width:130px">'
    +'<option value="">All Time</option>'
    +MONTHS.map(function(m){return '<option value="'+m.key+'" '+(selMonth===m.key?'selected':'')+'>'+m.label+'</option>';}).join('')
    +'</select>'
    +'<button onclick="openDataModal(\'landlords\')" title="Import / Export" style="padding:8px 11px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">&#x21C5;</button>'
    +'<button onclick="openAddLandlordModal()" style="padding:9px 16px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">+ Add Landlord</button>'
    +'</div></div>';

  // KPI strip
  html += '<div class="ll-kpi-grid">';
  html += '<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:11px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--red);font-family:monospace">'+fmt(totalMonthly)+'</div><div style="font-size:10px;color:var(--red);font-weight:700;margin-top:2px">MONTHLY RENT</div></div>';
  html += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:11px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--amber);font-family:monospace">'+fmt(totalOwed)+'</div><div style="font-size:10px;color:var(--amber);font-weight:700;margin-top:2px">PENDING ('+pendingCount+')</div></div>';
  html += '<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:11px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace">'+fmt(totalPaidAll)+'</div><div style="font-size:10px;color:var(--green);font-weight:700;margin-top:2px">PAID (ALL TIME)</div></div>';
  html += '</div>';

  // Landlord cards
  html += '<div class="ll-grid">';
  // Sort landlords: those with pending payments first, then by pending amount desc
  var sortedLls = lls.slice().sort(function(a, b) {
    var aPend = filteredPays.filter(function(p){return p.landlordId===a.id&&p.status==='pending';});
    var bPend = filteredPays.filter(function(p){return p.landlordId===b.id&&p.status==='pending';});
    // Pending first
    if(aPend.length && !bPend.length) return -1;
    if(!aPend.length && bPend.length) return 1;
    // Both pending: sort by earliest due date (most overdue first)
    if(aPend.length && bPend.length) {
      var aEarliest = Math.min.apply(null, aPend.map(function(p){return new Date(p.dueDate).getTime();}));
      var bEarliest = Math.min.apply(null, bPend.map(function(p){return new Date(p.dueDate).getTime();}));
      return aEarliest - bEarliest;
    }
    // Both fully paid: sort alphabetically
    return (a.name||'').localeCompare(b.name||'');
  });

  sortedLls.forEach(function(ll) {
    var llProps    = (state.properties||[]).filter(function(p){return p.landlordName===ll.name;});
    var llMonthly  = llProps.reduce(function(s,p){return s+p.landlord;},0);
    var llPending  = filteredPays.filter(function(p){return p.landlordId===ll.id&&p.status==='pending';});
    var llPaid     = filteredPays.filter(function(p){return p.landlordId===ll.id&&p.status==='paid';});
    var initials   = ll.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2);
    var hasPending = llPending.length > 0;

    html += '<div class="ll-card" style="border-color:'+(hasPending?'#FDE68A':'var(--border)')+'">';

    // Card header — click to open detail
    html += '<div class="ll-card-head" onclick="openLandlordDetail(\''+ll.id+'\')">';
    html += '<div style="width:42px;height:42px;border-radius:11px;background:var(--accent-light);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--accent-dark)">'+initials+'</div>';
    html += '<div class="ll-card-meta">';
    html += '<div class="ll-card-name">'+ll.name+'</div>';
    html += '<div class="ll-card-sub">'+ll.phone+' · '+llProps.length+' propert'+(llProps.length===1?'y':'ies')+'</div>';
    html += '</div>';
    html += '<div class="ll-card-amount">';
    html += '<div class="ll-card-amount-val">'+fmt(llMonthly)+'</div>';
    html += '<div class="ll-card-amount-sub">per month</div>';
    html += '</div>';
    html += '</div>';

    // Properties mini-list
    if(llProps.length) {
      html += '<div style="padding:0 16px 10px;display:flex;flex-wrap:wrap;gap:5px">';
      llProps.forEach(function(p){
        html += '<span style="font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 8px;color:var(--muted)">'+p.name+'</span>';
      });
      html += '</div>';
    }

    // ── Payment schedule: per-property rows, grouped by month ───────────────
    var llAllPays = filteredPays.filter(function(p){return p.landlordId===ll.id;});
    var nowMs = new Date().getTime();

    // Group payments by monthKey, sorted overdue→upcoming→paid
    var monthKeys = [];
    llAllPays.forEach(function(p){ if(monthKeys.indexOf(p.monthKey)<0) monthKeys.push(p.monthKey); });
    monthKeys.sort(function(a,b){
      var aMs = new Date(a+'-01').getTime();
      var bMs = new Date(b+'-01').getTime();
      // Check if any pending in this month
      var aPend = llAllPays.some(function(p){return p.monthKey===a&&p.status!=='paid';});
      var bPend = llAllPays.some(function(p){return p.monthKey===b&&p.status!=='paid';});
      var aOver = aPend && aMs < nowMs;
      var bOver = bPend && bMs < nowMs;
      if(aOver && !bOver) return -1;
      if(!aOver && bOver) return 1;
      if(aPend && !bPend) return -1;
      if(!aPend && bPend) return 1;
      return aMs - bMs;
    });

    if(monthKeys.length) {
      var nowMonthKey=new Date().toISOString().slice(0,7);
      // Only show OVERDUE months (past due with unpaid items). Paid + future = hidden.
      var visKeys=monthKeys.filter(function(mk){
        return mk<=nowMonthKey && llAllPays.some(function(p){return p.monthKey===mk&&p.status!=='paid';});
      }).sort();
      var hiddenCount=monthKeys.filter(function(mk){
        return mk>nowMonthKey || llAllPays.filter(function(p){return p.monthKey===mk;}).every(function(p){return p.status==='paid';});
      }).length;
      html += '<div style="border-top:1px solid var(--border)">';
      visKeys.forEach(function(mk) {
        var mPays = llAllPays.filter(function(p){return p.monthKey===mk;});
        var mMs   = new Date(mk+'-01').getTime();
        var mLabel = mPays[0].monthLabel;
        var allPaid = mPays.every(function(p){return p.status==='paid';});
        var anyOverdue = mPays.some(function(p){return p.status!=='paid' && mMs < nowMs;});
        var mTotal = mPays.reduce(function(s,p){return s+p.amount;},0);
        var paidTotal = mPays.filter(function(p){return p.status==='paid';}).reduce(function(s,p){return s+p.amount;},0);

        // Month header row
        var headBg = allPaid ? 'var(--green-light)' : anyOverdue ? '#FFF1F2' : 'var(--bg)';
        var headIcon = allPaid ? '✅' : anyOverdue ? '⚠️' : '📅';
        var headColor = allPaid ? 'var(--green)' : anyOverdue ? 'var(--red)' : 'var(--text)';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:'+headBg+';border-bottom:1px solid var(--border)">';
        html += '<span>'+headIcon+'</span>';
        html += '<span style="font-size:12px;font-weight:800;color:'+headColor+';flex:1">'+mLabel+'</span>';
        html += '<span style="font-size:11px;color:var(--muted);font-family:monospace">';
        if(!allPaid && paidTotal>0) html += fmt(paidTotal)+' / ';
        html += fmt(mTotal)+'</span>';
        html += '</div>';

        // Property rows within this month
        var mSorted = mPays.slice().sort(function(a,b){
          if(a.status==='paid' && b.status!=='paid') return 1;
          if(a.status!=='paid' && b.status==='paid') return -1;
          return (a.property||'').localeCompare(b.property||'');
        });
        mSorted.forEach(function(pay) {
          var isPaid    = pay.status === 'paid';
          var isOverdue = !isPaid && mMs < nowMs;
          var amtColor  = isPaid ? 'var(--green)' : isOverdue ? 'var(--red)' : 'var(--amber)';

          html += '<div class="ll-pay-row" style="background:'+(isPaid?'transparent':isOverdue?'#FFF8F8':'transparent')+'">';
          html += '<div class="ll-pay-main">';
          html += '<div style="font-size:12px;font-weight:600;color:'+(isPaid?'var(--muted)':'var(--text)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(pay.propName||pay.property||(state.properties.find(function(x){return x.id===pay.propId;})||{}).name||'Unknown')+'</div>';
          if(isPaid) html += '<div style="font-size:10px;color:var(--green)">Paid '+pay.paidDate+'</div>';
          html += '</div>';
          html += '<span style="font-size:12px;font-weight:700;color:'+amtColor+';font-family:monospace;flex-shrink:0">'+fmt(pay.amount)+'</span>';
          if(!isPaid) {
            html += '<button onclick="markLandlordPaid(\'' + ll.id + '\',\''+pay.id+'\')" style="padding:5px 10px;border-radius:7px;border:none;background:'+(isOverdue?'var(--red)':'#10B981')+';color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap">'+(isOverdue?'Pay Now':'Pay ✓')+'</button>';
          } else {
            html += '<span style="font-size:10px;color:var(--green);font-weight:700">✓</span>';
          }
          html += '</div>';
        });
      });
      // Always show the 'View full history' link (paid + future months are all hidden)
      if(hiddenCount>0||llAllPays.some(function(p){return p.status==='paid';})){
        var hiddenAll=hiddenCount;
        if(hiddenAll>0){
          html+='<div style="padding:8px 14px;text-align:center;border-top:1px solid var(--border)">'
            +'<button onclick="openLandlordDetail(\''+ll.id+'\')" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:inherit">'
            +'📋 '+hiddenAll+' month'+(hiddenAll>1?'s':'')+' hidden · View full history</button></div>';
        }
      }
      // If nothing overdue at all, show a clean 'all up to date' badge
      if(!visKeys.length){
        html += '<div style="padding:12px 14px;display:flex;align-items:center;gap:8px;border-top:1px solid var(--border)">'
          +'<span style="font-size:18px">✅</span>'
          +'<span style="font-size:12px;color:var(--green);font-weight:600">All payments up to date</span>'
          +(monthKeys.length?'<button onclick="openLandlordDetail(\''+ll.id+'\')" style="margin-left:auto;font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:inherit">View history</button>':'')
          +'</div>';
      }
      html += '</div>';
    }

    // Edit button
    html += '<div style="padding:10px 14px;border-top:1px solid var(--border)">';
    html += '<button onclick="openLandlordDetail(\''+ll.id+'\')" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">✏️ Edit Profile</button>';
    html += '</div>';

    html += '</div>'; // card
  });
  html += '</div>'; // grid

  return html;
}

function openAddLandlordModal(){
  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:500px">'
    +'<div class="modal-header"><span class="modal-title">+ Add Landlord</span><button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label class="field-label">Name *</label><input class="inp" id="ll-name" placeholder="e.g. John Smith"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Phone</label><input class="inp" id="ll-phone" type="tel" placeholder="07911000000"></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="ll-email" type="email" placeholder="landlord@email.com"></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Bank Name</label><input class="inp" id="ll-bank" placeholder="e.g. Barclays"></div>'
    +'<div class="field"><label class="field-label">Sort Code</label><input class="inp" id="ll-sort" placeholder="00-00-00"></div></div>'
    +'<div class="field"><label class="field-label">Account No.</label><input class="inp" id="ll-acc" placeholder="12345678"></div>'
    +'<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="ll-notes" rows="2" placeholder="Payment terms, preferences…" style="resize:vertical"></textarea></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button onclick="saveNewLandlord()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Add Landlord</button>'
    +'</div></div></div>';
}

function saveNewLandlord(){
  var name=(document.getElementById('ll-name')||{value:''}).value.trim();
  if(!name){alert('Please enter a landlord name.');return;}
  var ll={id:crypto.randomUUID(),name:name,
    phone:(document.getElementById('ll-phone')||{value:''}).value.trim(),
    email:(document.getElementById('ll-email')||{value:''}).value.trim(),
    bank:(document.getElementById('ll-bank')||{value:''}).value.trim(),
    sortCode:(document.getElementById('ll-sort')||{value:''}).value.trim(),
    accountNo:(document.getElementById('ll-acc')||{value:''}).value.trim(),
    notes:(document.getElementById('ll-notes')||{value:''}).value.trim(),properties:[]};
  if(!state.landlords) state.landlords=[];
  state.landlords.push(ll);
  closeModal();saveState();render();
  showToast('Landlord added: '+ll.name,'success');
}

function deleteLandlord(id){
  var ll=state.landlords.find(function(x){return String(x.id)===String(id);});if(!ll)return;
  var linkedProps=state.properties.filter(function(p){return p.landlordName===ll.name;});
  var msg='Delete '+ll.name+'?';
  if(linkedProps.length) msg+='\n\n⚠ Linked to '+linkedProps.length+' propert'+(linkedProps.length>1?'ies':'y')+'. Link will be removed.';
  msg+='\n\nThis cannot be undone.';
  if(!confirm(msg)) return;
  linkedProps.forEach(function(p){delete p.landlordName;delete p.landlordPhone;});
  state.landlords=state.landlords.filter(function(x){return String(x.id)!==String(id);});
  try{supa.from('landlords').delete().eq('id',String(id)).then(function(){});}catch(e){}
  closeModal();saveState();render();
  showToast('Landlord deleted','success');
}

function openLandlordDetail(id){
  var ll=state.landlords.find(function(x){return String(x.id)===String(id);});if(!ll)return;
  var lpays=(state.landlordPayments||[]).filter(function(p){return p.landlordId===id;});
  var llProps=state.properties.filter(function(p){return p.landlordName===ll.name;});
  var pendingPays=lpays.filter(function(p){return p.status!=='paid';});
  var paidPays=lpays.filter(function(p){return p.status==='paid';}).sort(function(a,b){return (b.dueDate||'').localeCompare(a.dueDate||'');}).slice(0,6);
  var shownPays=pendingPays.concat(paidPays);
  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:560px"><div class="modal-header"><span class="modal-title">'+ll.name+'</span><button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body" style="max-height:70vh;overflow-y:auto">'
    +'<div class="field"><label class="field-label">Name</label><input class="inp" id="ll-name" value="'+ll.name+'"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Phone</label><input class="inp" id="ll-phone" value="'+(ll.phone||'')+'"></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="ll-email" value="'+(ll.email||'')+'"></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Bank</label><input class="inp" id="ll-bank" value="'+(ll.bank||'')+'"></div>'
    +'<div class="field"><label class="field-label">Sort Code</label><input class="inp" id="ll-sort" value="'+(ll.sortCode||'')+'"></div></div>'
    +'<div class="field"><label class="field-label">Account No.</label><input class="inp" id="ll-acc" value="'+(ll.accountNo||'')+'"></div>'
    +'<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="ll-notes" rows="2">'+(ll.notes||'')+'</textarea></div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin:12px 0 6px">Linked Properties</div>'
    +(llProps.length?llProps.map(function(p){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 10px;background:var(--bg);border-radius:7px;margin-bottom:4px"><span>'+p.name+'</span><span style="font-weight:700;color:var(--red);font-family:monospace">'+fmt(p.landlord)+'/mo</span></div>';}).join(''):'<div style="font-size:12px;color:var(--dim);padding:4px 0">No properties linked</div>')
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin:12px 0 6px">Payment History (overdue + last 6 paid)</div>'
    +(shownPays.length?shownPays.map(function(p){
        var propName=p.propName||(state.properties.find(function(x){return x.id===p.propId;})||{}).name||p.property||'—';
        var isPaid=p.status==='paid';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">'
          +'<div><div style="font-weight:600;color:var(--text)">'+propName+'</div>'
          +'<div style="font-size:10px;color:var(--muted)">'+p.monthLabel+(isPaid?' · Paid '+p.paidDate:'')+'</div></div>'
          +'<span style="font-weight:700;font-family:monospace;color:'+(isPaid?'var(--green)':'var(--amber)')+'">'+fmt(p.amount)+'</span>'
          +'</div>';
      }).join(''):'<div style="font-size:12px;color:var(--dim)">No payments yet</div>')
    +'</div>'
    +'<div class="modal-footer" style="justify-content:space-between">'
    +'<button data-llid="'+id+'" onclick="deleteLandlord(this.dataset.llid)" style="padding:9px 16px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">🗑 Delete</button>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button data-llid="'+id+'" onclick="saveLandlordDetail(this.dataset.llid)" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Changes</button>'
    +'</div></div></div></div>';
}

function saveLandlordDetail(id){
  var ll=state.landlords.find(function(x){return String(x.id)===String(id);});if(!ll)return;
  var g=function(eid){var el=document.getElementById(eid);return el?el.value:null;};
  ['ll-name','ll-phone','ll-email','ll-bank','ll-sort','ll-acc','ll-notes'].forEach(function(eid){var v=g(eid);if(v!==null){var map={'ll-name':'name','ll-phone':'phone','ll-email':'email','ll-bank':'bank','ll-sort':'sortCode','ll-acc':'accountNo','ll-notes':'notes'};ll[map[eid]]=v;}});
  closeModal();saveState();render();
  showToast('Landlord updated','success');
}
