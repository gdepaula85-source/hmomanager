// ── Room photo sync — runs in background, does NOT block startup ──────────────
async function syncRoomPhotosBackground() {
  try {
    var storageResult = await supa.storage.from('room-media').list('rooms', { limit: 500 });
    if (storageResult.error || !storageResult.data || storageResult.data.length === 0) return;

    // Use Promise.all to fetch all property folders in parallel instead of sequential
    var propFolders = storageResult.data.filter(function(f){ return f && f.name; });
    var roomFetches = propFolders.map(function(_propFolder) {
      var _spid = _propFolder.name;
      return supa.storage.from('room-media').list('rooms/' + _spid, { limit: 100 })
        .then(function(_roomsResult) {
          if (_roomsResult.error || !_roomsResult.data) return Promise.resolve();
          var roomFolders = _roomsResult.data.filter(function(r){ return r && r.name && !isNaN(parseInt(r.name)); });
          return Promise.all(roomFolders.map(function(_roomFolder) {
            var _srn = parseInt(_roomFolder.name);
            return supa.storage.from('room-media').list('rooms/' + _spid + '/' + _srn, { limit: 20 })
              .then(function(_photosResult) {
                if (_photosResult.error || !_photosResult.data || _photosResult.data.length === 0) return;
                var _media = getMedia(_spid, _srn);
                var added = false;
                _photosResult.data.forEach(function(_file) {
                  if (!_file || !_file.name) return;
                  var _path = 'rooms/' + _spid + '/' + _srn + '/' + _file.name;
                  var _urlData = supa.storage.from('room-media').getPublicUrl(_path);
                  var _url = _urlData.data.publicUrl;
                  var _exists = _media.photos.some(function(ph){ return ph.src === _url || ph.path === _path; });
                  if (!_exists) { _media.photos.push({ src: _url, name: _file.name, path: _path }); added = true; }
                });
                return added;
              });
          }));
        });
    });

    await Promise.all(roomFetches);
    // Save updated cache to localStorage (no render needed — photos show on next open)
    try { 
      var storageKey = typeof _currentOrgId !== 'undefined' && _currentOrgId ? 'pm_local_roomMedia_'+_currentOrgId : 'pm_local_roomMedia';
      localStorage.setItem(storageKey, JSON.stringify(state.roomMedia)); 
    } catch(e) {}
    console.log('Room photos synced in background');
  } catch(_se) { console.warn('Background room sync error:', _se); }
}

function renderPropFinanceTab(p, propTenants) {
  var isOwned  = p.ownershipType === 'owned';
  var isWhole  = p.lettingType   === 'whole';
  var mort     = p.mortgage     || {};
  var purchase = p.purchaseInfo || {};

  // ── Core income/cost numbers ──────────────────────────────────────────────
  var activeTenants  = propTenants.filter(function(t){ return t.status !== 'inactive'; });
  var monthlyIncome  = Math.round(activeTenants.reduce(function(s,t){ return s + (t.freq==='monthly' ? t.rent : (t.rent||0)*52/12); }, 0));
  var monthlyOutgoing= p.landlord || 0; // landlord rent OR mortgage payment
  var monthlyProfit  = monthlyIncome - monthlyOutgoing;
  var annualIncome   = monthlyIncome  * 12;
  var annualOutgoing = monthlyOutgoing * 12;
  var annualProfit   = monthlyProfit  * 12;

  // ── Expenses for this property ────────────────────────────────────────────
  var propExpenses = (state.expenses||[]).filter(function(e){ return e.property === p.name && e.status !== 'cancelled'; });
  var monthlyExpenses = Math.round(propExpenses.reduce(function(s,e){
    if(e.freq==='monthly') return s + (e.amount||0);
    if(e.freq==='weekly')  return s + (e.amount||0)*52/12;
    if(e.freq==='annual')  return s + (e.amount||0)/12;
    return s; // one-off not included in monthly
  }, 0));
  var netProfit = monthlyProfit - monthlyExpenses;

  // ── Payment history totals ────────────────────────────────────────────────
  var propPayments = (state.payments||[]).filter(function(py){ return py.property === p.name && py.status === 'paid'; });
  var totalCollected = Math.round(propPayments.reduce(function(s,py){ return s + (py.amount||0); }, 0));
  var totalPaidToLL  = Math.round((state.landlordPayments||[]).filter(function(lp){
    return lp.propId === p.id && lp.status === 'paid';
  }).reduce(function(s,lp){ return s + (lp.amount||0); }, 0));

  // ── Arrears ───────────────────────────────────────────────────────────────
  var totalArrears = Math.round(activeTenants.reduce(function(s,t){ return s + (t.arrears||0); }, 0));

  // ── Occupancy stats ───────────────────────────────────────────────────────
  var occupancyPct = p.rooms ? Math.round(p.occupied / p.rooms * 100) : 0;
  var voidRooms    = p.rooms - p.occupied;
  var voidCostPerMonth = isWhole ? 0 : Math.round(
    (p.roomList||[]).filter(function(r){ return r.status==='vacant'; })
      .reduce(function(s,r){ return s + (r.price||0)*52/12; }, 0)
  );

  // ── Owned-only calculations ───────────────────────────────────────────────
  var estValue      = purchase.estimatedValue  || 0;
  var purchasePrice = purchase.purchasePrice   || 0;
  var outstanding   = mort.outstandingBalance  || 0;
  var equity        = estValue ? estValue - outstanding : 0;
  var ltv           = estValue ? Math.round(outstanding / estValue * 100) : 0;
  var capitalGain   = purchasePrice ? estValue - purchasePrice : 0;
  var grossYield    = estValue && annualIncome ? +(annualIncome / estValue * 100).toFixed(1) : 0;
  var netYield      = estValue && annualProfit ? +(annualProfit / estValue * 100).toFixed(1) : 0;
  // ROI = annual net profit / cash invested (deposit = purchase price - original mortgage; approx as purchase price - outstanding if no data)
  var cashInvested  = purchasePrice && outstanding ? purchasePrice - outstanding : purchasePrice;
  var roi           = cashInvested && annualProfit ? +(annualProfit / cashInvested * 100).toFixed(1) : 0;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function kpi(label, value, color, sub) {
    return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">'
      + '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">'+label+'</div>'
      + '<div style="font-size:20px;font-weight:800;font-family:monospace;color:'+(color||'var(--text)')+'">'+value+'</div>'
      + (sub ? '<div style="font-size:10px;color:var(--muted);margin-top:3px">'+sub+'</div>' : '')
      + '</div>';
  }
  function section(title, emoji) {
    return '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:18px 0 10px;display:flex;align-items:center;gap:6px">'
      + (emoji||'') + ' ' + title + '</div>';
  }
  function row(label, value, color) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">'
      + '<span style="font-size:13px;color:var(--muted)">'+label+'</span>'
      + '<span style="font-size:13px;font-weight:700;color:'+(color||'var(--text)')+'">'+value+'</span>'
      + '</div>';
  }

  var html = '';

  // ── STR (Airbnb / SA) inline entry + history ──────────────────────────────
  if(p.isStrEnabled) {
    var _strAll = (state.payments||[]).filter(function(py){
      return py.propertyId === p.id && py.incomeSource === 'airbnb';
    }).sort(function(a,b){
      var da = a.periodStart || a.paidDate || '';
      var db = b.periodStart || b.paidDate || '';
      return db.localeCompare(da);
    });
    var _nowD = new Date(); var _cy = _nowD.getFullYear(); var _cm = _nowD.getMonth();
    var _curKey = _cy + '-' + String(_cm+1).padStart(2,'0');
    var _strThisMo = _strAll.filter(function(py){
      var d = py.periodStart || py.paidDate || '';
      return d.indexOf(_curKey) === 0;
    }).reduce(function(s,py){return s+(+py.amount||0);},0);
    var _strAllTotal = _strAll.reduce(function(s,py){return s+(+py.amount||0);},0);
    var _monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var _monthOpts = '';
    // Offer last 24 months in the picker, current month selected
    for(var _mi=0;_mi<24;_mi++){
      var _md = new Date(_cy, _cm - _mi, 1);
      var _mk = _md.getFullYear()+'-'+String(_md.getMonth()+1).padStart(2,'0');
      var _ml = _monthNames[_md.getMonth()]+' '+_md.getFullYear();
      _monthOpts += '<option value="'+_mk+'"'+(_mi===0?' selected':'')+'>'+_ml+'</option>';
    }
    html += section('Airbnb / SA Income', '🛏️');
    html += '<div style="background:#FFF1F2;border:1px solid #FECDD3;border-radius:10px;padding:14px;margin-bottom:14px">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
    html += kpi('This month', fmt(_strThisMo), _strThisMo>0?'#E04E53':'var(--muted)');
    html += kpi('All time',    fmt(_strAllTotal), _strAllTotal>0?'#E04E53':'var(--muted)', _strAll.length+' entries');
    html += '</div>';
    html += '<div style="font-size:11px;font-weight:700;color:#92251B;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Log income for a month</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end">';
    html += '<div><label style="font-size:10px;color:var(--muted);font-weight:600">Month</label>'
      + '<select class="inp" id="sa-month-'+p.id+'" style="margin-top:3px">'+_monthOpts+'</select></div>';
    html += '<div><label style="font-size:10px;color:var(--muted);font-weight:600">Net income (£)</label>'
      + '<input type="number" class="inp" id="sa-amount-'+p.id+'" placeholder="e.g. 2400" min="0" step="0.01" style="margin-top:3px"></div>';
    html += '<button onclick="logStrIncomeFromFinanceTab(\''+p.id+'\')" style="padding:10px 16px;border-radius:9px;border:none;background:#FF5A5F;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">+ Save</button>';
    html += '</div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:8px">Net of platform fees &amp; cleaning. Logs against this property only.</div>';
    if(_strAll.length) {
      html += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #FECDD3">';
      html += '<div style="font-size:11px;font-weight:700;color:#92251B;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">History</div>';
      _strAll.slice(0,12).forEach(function(py){
        var _label = '';
        var _d = py.periodStart || py.paidDate || '';
        if(_d) {
          var _parts = _d.split('-');
          if(_parts.length>=2){
            _label = _monthNames[parseInt(_parts[1],10)-1]+' '+_parts[0];
          }
        }
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #FECDD3;font-size:12px">'
          + '<span style="color:var(--text)">'+_label+'</span>'
          + '<span style="display:flex;align-items:center;gap:8px">'
          +   '<span style="font-weight:700;font-family:monospace;color:#E04E53">'+fmt(+py.amount||0)+'</span>'
          +   '<button onclick="deleteStrIncome(\''+py.id+'\')" title="Delete" style="padding:2px 6px;border-radius:6px;border:1px solid #FECDD3;background:#fff;color:#E04E53;cursor:pointer;font-family:inherit;font-size:11px">×</button>'
          + '</span>'
          + '</div>';
      });
      if(_strAll.length>12) html += '<div style="font-size:10px;color:var(--muted);text-align:center;padding:6px 0">+ '+(_strAll.length-12)+' older entries</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // ── Monthly snapshot ──────────────────────────────────────────────────────
  html += section('Monthly Snapshot', '📅');
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px">';
  html += kpi('Income',   fmt(monthlyIncome),   'var(--green)');
  html += kpi(isOwned ? 'Mortgage' : 'LL Rent', fmt(monthlyOutgoing), 'var(--red)');
  html += kpi('Profit',   fmt(monthlyProfit),   monthlyProfit>=0?'var(--green)':'var(--red)');
  html += '</div>';
  if(monthlyExpenses > 0) {
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px">';
    html += kpi('Expenses/mo', fmt(monthlyExpenses), 'var(--amber)');
    html += kpi('Net after exp.', fmt(netProfit), netProfit>=0?'var(--green)':'var(--red)');
    html += '</div>';
  }

  // ── Annual projection ─────────────────────────────────────────────────────
  html += section('Annual Projection', '📈');
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">';
  html += row('Gross income', fmt(annualIncome), 'var(--green)');
  html += row(isOwned ? 'Mortgage payments' : 'Landlord rent', fmt(annualOutgoing), 'var(--red)');
  if(monthlyExpenses) html += row('Running expenses', fmt(monthlyExpenses*12), 'var(--amber)');
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;background:'+( (annualProfit-monthlyExpenses*12)>=0?'var(--green-light)':'var(--red-light)')+';">'
    + '<span style="font-size:13px;font-weight:700;color:var(--text);padding-left:0">Net annual profit</span>'
    + '<span style="font-size:15px;font-weight:800;color:'+((annualProfit-monthlyExpenses*12)>=0?'var(--green)':'var(--red)')+'">'+fmt(annualProfit - monthlyExpenses*12)+'</span>'
    + '</div>';
  html += '</div>';

  // ── Occupancy & voids ─────────────────────────────────────────────────────
  if(!isWhole) {
    html += section('Occupancy & Voids', '🏠');
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
    html += kpi('Occupancy', occupancyPct+'%', occupancyPct===100?'var(--green)':occupancyPct<70?'var(--red)':'var(--amber)');
    html += kpi('Void rooms', voidRooms, voidRooms===0?'var(--green)':'var(--red)');
    html += kpi('Void cost/mo', fmt(voidCostPerMonth), voidCostPerMonth>0?'var(--red)':'var(--muted)', 'lost income');
    html += '</div>';
  }

  // ── Payment history totals ────────────────────────────────────────────────
  html += section('Payment History', '💳');
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">';
  html += row('Total rent collected', fmt(totalCollected), 'var(--green)');
  if(totalPaidToLL) html += row(isOwned ? 'Total mortgage paid' : 'Total paid to landlord', fmt(totalPaidToLL), 'var(--red)');
  if(totalArrears)  html += row('Current arrears', fmt(totalArrears), 'var(--red)');
  html += '</div>';

  // ── Owned-only: investment metrics ────────────────────────────────────────
  if(isOwned) {
    html += section('Investment Metrics', '🏦');

    if(!estValue && !purchasePrice) {
      html += '<div style="background:var(--bg);border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;color:var(--muted)">'
        + '<div style="font-size:24px;margin-bottom:8px">📊</div>'
        + '<div style="font-size:13px;font-weight:600;margin-bottom:4px">Add property values to see investment metrics</div>'
        + '<div style="font-size:11px">Enter purchase price, estimated value and mortgage balance in the Details tab</div>'
        + '</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:8px">';
      if(estValue)    html += kpi('Est. value',    '£'+estValue.toLocaleString('en-GB'),    'var(--blue)');
      if(equity)      html += kpi('Equity',         fmt(equity),   equity>0?'var(--green)':'var(--red)');
      if(ltv)         html += kpi('LTV',             ltv+'%',       ltv>75?'var(--red)':ltv>60?'var(--amber)':'var(--green)');
      if(capitalGain) html += kpi('Capital gain',   fmt(capitalGain), capitalGain>0?'var(--green)':'var(--red)','vs purchase');
      html += '</div>';

      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
      if(grossYield) html += kpi('Gross yield', grossYield+'%', grossYield>=6?'var(--green)':grossYield>=4?'var(--amber)':'var(--red)', 'annual rent ÷ value');
      if(netYield)   html += kpi('Net yield',   netYield+'%',   netYield>=4?'var(--green)':netYield>=2?'var(--amber)':'var(--red)',   'net profit ÷ value');
      if(roi)        html += kpi('Cash ROI',    roi+'%',        roi>=10?'var(--green)':roi>=5?'var(--amber)':'var(--red)',           'profit ÷ cash in');
      html += '</div>';

      // Mortgage snapshot
      if(mort.lender) {
        html += section('Mortgage', '🏦');
        html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">';
        html += row('Lender', mort.lender);
        if(mort.rate)         html += row('Rate', mort.rate+'% '+( mort.rateType||''), mort.rateType==='svr'?'var(--red)':'var(--text)');
        if(mort.monthlyPayment) html += row('Monthly payment', fmt(mort.monthlyPayment), 'var(--red)');
        if(mort.outstandingBalance) html += row('Outstanding balance', '£'+mort.outstandingBalance.toLocaleString('en-GB'));
        if(mort.fixEndDate) {
          var fixDate = new Date(mort.fixEndDate);
          var daysLeft = Math.round((fixDate - new Date()) / 86400000);
          var fixColor = daysLeft < 90 ? 'var(--red)' : daysLeft < 180 ? 'var(--amber)' : 'var(--green)';
          html += row('Fix ends', fixDate.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
            + ' <span style="font-size:11px;color:'+fixColor+';font-weight:700">('+( daysLeft>0 ? daysLeft+' days' : 'EXPIRED')+')</span>');
        }
        html += '</div>';
      }
    }
  }

  // R2R margin + chart
  if(!isOwned && monthlyIncome && monthlyOutgoing) {
    var margin=+((monthlyProfit/monthlyIncome)*100).toFixed(1);
    var beRooms=p.rooms&&monthlyIncome?Math.ceil(monthlyOutgoing/(monthlyIncome/p.rooms)):0;
    html+=section('R2R Margin Analysis','');
    html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">';
    html+=kpi('Gross margin',margin+'%',margin>=20?'var(--green)':margin>=10?'var(--amber)':'var(--red)','net / income');
    html+=kpi('Profit/room',p.rooms?fmt(Math.round(monthlyProfit/p.rooms))+'/mo':'—',monthlyProfit>0?'var(--green)':'var(--red)');
    html+=kpi('Break-even',beRooms?beRooms+' rooms':'—',beRooms&&beRooms<=Math.floor(p.rooms*0.7)?'var(--green)':'var(--amber)','to cover costs');
    html+='</div>';
    var bp=monthlyIncome>0?Math.min(100,Math.round(monthlyOutgoing/monthlyIncome*100)):100;
    html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:12px">';
    html+='<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:6px"><span>LL Rent: '+fmt(monthlyOutgoing)+'</span><span>Income: '+fmt(monthlyIncome)+'</span></div>';
    html+='<div style="height:8px;border-radius:4px;background:var(--green-light);overflow:hidden"><div style="height:100%;width:'+bp+'%;background:'+(bp>85?'var(--red)':bp>65?'var(--amber)':'var(--green)')+';border-radius:4px"></div></div>';
    html+='<div style="text-align:right;font-size:10px;color:var(--muted);margin-top:3px">'+bp+'% of income on LL rent</div></div>';
  }
  // 12-month chart for all properties
  if(monthlyIncome>0){
    var MLBLS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var nowM=new Date().getMonth(),tOut=monthlyOutgoing+monthlyExpenses;
    var maxV=Math.max(monthlyIncome,tOut,1)*1.2;
    var svgW=320,svgH=100,bW=9,gp=2,gW=bW*2+gp+8,oX=26,oY=6,aH=svgH-oY-22;
    var svgStr='<svg viewBox="0 0 '+svgW+' '+svgH+'" style="width:100%;height:100px;display:block">';
    for(var _i=0;_i<12;_i++){var _x=oX+_i*gW;var _iH=Math.max(2,Math.round((monthlyIncome/maxV)*aH));var _cH=Math.max(2,Math.round((tOut/maxV)*aH));svgStr+='<rect x="'+_x+'" y="'+(oY+aH-_iH)+'" width="'+bW+'" height="'+_iH+'" fill="#10B981" rx="2" opacity=".85"/>';svgStr+='<rect x="'+(_x+bW+gp)+'" y="'+(oY+aH-_cH)+'" width="'+bW+'" height="'+_cH+'" fill="'+(tOut>monthlyIncome?'#E8375A':'#F59E0B')+'" rx="2" opacity=".8"/>';svgStr+='<text x="'+(_x+bW)+'" y="'+(svgH-4)+'" text-anchor="middle" font-size="7" fill="#94A3B8">'+MLBLS[(_i+nowM)%12]+'</text>';}
    svgStr+='<rect x="4" y="3" width="7" height="7" fill="#10B981" rx="1"/><text x="13" y="10" font-size="7.5" fill="#64748B">Income</text><rect x="56" y="3" width="7" height="7" fill="#F59E0B" rx="1"/><text x="65" y="10" font-size="7.5" fill="#64748B">Costs</text></svg>';
    html+=section('12-Month Forecast','');
    html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px"><div style="font-size:11px;color:var(--muted);margin-bottom:6px">Net: '+fmt(monthlyIncome-tOut)+'/mo</div>'+svgStr+'</div>';
  }

  return html;
}

async function archiveProperty(id){
  if (!requirePerm('canDelete', 'archive a property')) return;
  var p=state.properties.find(function(x){return String(x.id)===String(id);});if(!p)return;

  // Find tenants who'll be moved out as part of the archive. We include
  // pending_review (onboarding) and notice_given because they're all "live"
  // links that would otherwise orphan when the property disappears from view.
  var activeT = state.tenants.filter(function(t){
    return t.property === p.name &&
      (t.status === 'active' || t.status === 'notice_given' || t.status === 'pending_review');
  });

  var msg;
  if (activeT.length > 0) {
    msg = 'Archive "' + p.name + '" and move out ' + activeT.length + ' tenant' + (activeT.length===1?'':'s') + '?\n\n'
      + '• Tenants will be marked inactive (room freed, rent schedule stopped)\n'
      + '• Future unpaid landlord rents for this property will be cleared\n'
      + '• Restore or delete from the Archived tab\n\n'
      + 'Tenants must be restored manually after archive.';
  } else {
    msg = 'Archive "'+p.name+'"?\n\nFuture unpaid landlord rents for this property will be cleared. Restore or delete from Archived tab.';
  }
  if(!confirm(msg)) return;

  var archiveDate = new Date().toISOString().split('T')[0];
  var prevStatus=p.status,prevArch=p.archivedDate;
  p.status='archived';p.archivedDate=archiveDate;

  // Step 1: Persist the property archive flag (existing path).
  var r=await persistPropertyArchiveToSupabase(p);
  if(r&&r.error){
    p.status=prevStatus;p.archivedDate=prevArch;
    if(typeof showToast==='function')showToast(typeof friendlyDbSaveError==='function'?friendlyDbSaveError(r.error):(r.error.message||'Could not archive'),'error');
    return;
  }

  // Step 2: Move out all live tenants on this property in one batch UPDATE.
  // Fire-and-await so UI flips together — if it fails the property is still
  // archived (better than orphans), we just toast the partial outcome.
  if (activeT.length > 0) {
    try {
      var tRes = await supa.from('tenants')
        .update({ status: 'inactive', archived_at: archiveDate, move_out_date: archiveDate })
        .eq('property_id', String(p.id))
        .eq('org_id', _currentOrgId);
      if (tRes.error) {
        // Fallback if archived_at column missing — try without it.
        var msgStr = String(tRes.error.message || '');
        if (tRes.error.code === '42703' || /archived_at/i.test(msgStr)) {
          await supa.from('tenants')
            .update({ status: 'inactive', move_out_date: archiveDate })
            .eq('property_id', String(p.id))
            .eq('org_id', _currentOrgId);
          console.warn('[archiveProperty] tenants.archived_at column missing — run db/2026_05_field_fixes.sql');
        } else {
          showToast('Tenants couldn\'t be moved out: ' + msgStr, 'warn');
        }
      }
      // Update local state to match
      activeT.forEach(function(t){
        t.status='inactive';
        t.archivedDate=archiveDate;
        t.moveOutDate=archiveDate;
        if(typeof freeRoom==='function') freeRoom(t.property, t.room);
      });
    } catch(e) { console.warn('archiveProperty tenants update threw:', e && e.message); }
  }

  // Step 3: Clear future unpaid landlord_payments for this property — these
  // would otherwise keep showing up as "due" on the Landlords page even
  // though the property is archived and no rent will be paid.
  var nowMonthKey = new Date().toISOString().slice(0,7);
  try {
    var lpRes = await supa.from('landlord_payments')
      .delete()
      .eq('property_id', String(p.id))
      .eq('org_id', _currentOrgId)
      .eq('status', 'pending')
      .gte('month_key', nowMonthKey);
    if (lpRes.error) console.warn('archiveProperty: future LL payments cleanup error:', lpRes.error.message);
  } catch(e) { console.warn('archiveProperty LL cleanup threw:', e && e.message); }
  state.landlordPayments = (state.landlordPayments || []).filter(function(lp){
    if (String(lp.propId||'') !== String(p.id)) return true;
    if (lp.status === 'paid') return true;
    if (!lp.monthKey || lp.monthKey < nowMonthKey) return true;
    return false;
  });

  state.filters.propQ = '';
  if (typeof cancelPendingPropSearchRefresh === 'function') cancelPendingPropSearchRefresh();
  saveStateImmediate({silentSuccess:true});closeModal();state.filters.props='archived';
  render();
  var summary = p.name + ' archived';
  if (activeT.length > 0) summary += ' (' + activeT.length + ' tenant' + (activeT.length===1?'':'s') + ' moved out)';
  showToast(summary, 'success');
}
async function deletePropPermanent(id){
  if (!requirePerm('canDelete', 'permanently delete a property')) return;
  var p=state.properties.find(function(x){return String(x.id)===String(id);});if(!p)return;
  if(p.status!=='archived'){showToast('Archive first before deleting','error');return;}
  if(!confirm('PERMANENTLY DELETE "'+p.name+'"?\n\nLandlord rents, maintenance, expenses and property documents for this property will be removed. Tenants will be preserved but un-linked. This cannot be undone.')) return;

  var pidStr = String(id);
  var pName = p.name;

  // Tombstone the property id so any in-flight bulk autosave can't re-INSERT
  // the deleted property via its upsert ON CONFLICT path. 60 s expiry.
  if (typeof markRowDeleted === 'function') markRowDeleted('properties', pidStr);

  // Step 1: Decouple tenants from the property — tenants.property_id has a FK constraint to
  // properties.id, so an active tenant link will block the property delete with a FK violation.
  try {
    var tRes = await supa.from('tenants')
      .update({ property_id: null, property_name: '', room_number: null })
      .eq('property_id', pidStr)
      .eq('org_id', _currentOrgId);
    if (tRes.error) { showToast('Delete failed (un-linking tenants): ' + tRes.error.message, 'error'); return; }
  } catch(e) { showToast('Delete error (tenants): ' + (e.message || 'unknown'), 'error'); return; }

  // Step 2: Delete all child rows that have a FK to property_id.
  // payments has no property_id column (uses property_name), so it isn't in this list.
  var fkTables = ['landlord_payments', 'expenses', 'maintenance', 'property_docs'];
  for (var i = 0; i < fkTables.length; i++) {
    try {
      var r = await supa.from(fkTables[i]).delete().eq('property_id', pidStr).eq('org_id', _currentOrgId);
      if (r && r.error) { showToast('Delete failed (' + fkTables[i] + '): ' + r.error.message, 'error'); return; }
    } catch(e) { showToast('Delete error (' + fkTables[i] + '): ' + (e.message || 'unknown'), 'error'); return; }
  }

  // Step 3: Delete the property itself — FK constraints are now clear.
  var res = await supa.from('properties').delete().eq('id', pidStr).eq('org_id', _currentOrgId);
  if (res.error) { showToast('Delete failed (properties): ' + res.error.message, 'error'); return; }

  // Step 4: Clean up local state to match the DB.
  state.properties = state.properties.filter(function(x){ return String(x.id) !== pidStr; });
  state.tenants.forEach(function(t){
    if (String(t.propertyId||'') === pidStr || t.property === pName) {
      t.propertyId = null; t.property = ''; t.room = null;
    }
  });
  state.landlordPayments = (state.landlordPayments||[]).filter(function(x){ return String(x.propId||'') !== pidStr; });
  state.expenses = (state.expenses||[]).filter(function(x){ return String(x.propertyId||'') !== pidStr && x.property !== pName; });
  state.maintenance = (state.maintenance||[]).filter(function(x){ return String(x.propertyId||'') !== pidStr && x.property !== pName; });
  if (state.propDocs) delete state.propDocs[id];

  state.filters.propQ = '';
  if (typeof cancelPendingPropSearchRefresh === 'function') cancelPendingPropSearchRefresh();
  saveStateImmediate({silentSuccess:true});closeModal();render();
  showToast(p.name+' permanently deleted','success');
}
async function restoreProperty(id){
  var p=state.properties.find(function(x){return String(x.id)===String(id);});if(!p)return;
  var prevStatus=p.status,prevArch=p.archivedDate;
  p.status='active';delete p.archivedDate;
  var r=await persistPropertyArchiveToSupabase(p);
  if(r&&r.error){
    p.status=prevStatus;if(prevArch!==undefined)p.archivedDate=prevArch;
    if(typeof showToast==='function')showToast(typeof friendlyDbSaveError==='function'?friendlyDbSaveError(r.error):(r.error.message||'Could not restore'),'error');
    return;
  }
  state.filters.propQ = '';
  if (typeof cancelPendingPropSearchRefresh === 'function') cancelPendingPropSearchRefresh();
  saveStateImmediate({silentSuccess:true});closeModal();state.filters.props='all';render();showToast(p.name+' restored','success');
}
async function archiveTenant(id){
  var t=state.tenants.find(function(x){return String(x.id)===String(id);});if(!t)return;
  // For active/notice tenants, make the action explicit — they're being moved out.
  var isActive = t.status === 'active' || t.status === 'notice_given' || t.status === 'pending_review';
  var msg = isActive
    ? 'Move out & archive "'+t.name+'"?\n\nTheir room will be freed and rent schedule stopped. Restore or delete from the Archived tab.'
    : 'Archive "'+t.name+'"?\n\nMoved to Archived tab. Restore or delete from there.';
  if(!confirm(msg)) return;
  var oldProp=t.property,oldRoom=t.room;
  var archiveDate=new Date().toISOString().split('T')[0];

  // Direct targeted DB patch first — more reliable than waiting for the full
  // saveStateImmediate upsert. If this fails we revert state and abort.
  var res = await supa.from('tenants')
    .update({ status: 'inactive', archived_at: archiveDate, move_out_date: archiveDate })
    .eq('id', String(id))
    .eq('org_id', _currentOrgId);
  if (res.error) {
    var msgStr = String(res.error.message || '');
    var isMissingCol = res.error.code === '42703' || /archived_at.*column.*not found/i.test(msgStr) || /column.*archived_at.*not found/i.test(msgStr);
    if (isMissingCol) {
      // Fallback path for an unmigrated DB: status + move_out_date only,
      // archived_at silently dropped. Surface a nudge to run the migration.
      var fallback = await supa.from('tenants')
        .update({ status: 'inactive', move_out_date: archiveDate })
        .eq('id', String(id))
        .eq('org_id', _currentOrgId);
      if (fallback.error) {
        showToast('Archive failed: ' + fallback.error.message + ' — try a hard refresh first.', 'error');
        return;
      }
      console.warn('[archiveTenant] tenants.archived_at column missing — run db/2026_05_field_fixes.sql + NOTIFY pgrst, \'reload schema\'');
      showToast('Archived (heads-up: archived_at column missing — run latest DB migration).', 'warn');
    } else {
      showToast('Archive failed: ' + msgStr, 'error');
      return;
    }
  }

  t.status='inactive';t.archivedDate=archiveDate;t.moveOutDate=archiveDate;
  freeRoom(oldProp,oldRoom);
  if(typeof rebuildTenantSchedule==='function') rebuildTenantSchedule(id);
  saveStateImmediate({silentSuccess:true});closeModal();state.filters.tenants='archived';render();showToast(t.name+' archived','success');
}

async function deleteTenantPermanent(id){
  if (!requirePerm('canDelete', 'permanently delete a tenant')) return;
  var t=state.tenants.find(function(x){return String(x.id)===String(id);});if(!t)return;
  // Allow deleting from any status as long as user confirms (was previously
  // gated to status==='inactive' which prevented deleting pending_review or
  // active tenants — sometimes a tenant should just go).
  if(!confirm('PERMANENTLY DELETE "'+t.name+'"?\n\nAll payment history removed. Cannot be undone.')) return;

  // Tombstone the id BEFORE the DB call. Any in-flight bulk autosave that's
  // still racing with the delete (built from a state snapshot before the
  // filter ran) will now have this id stripped from its upsert payload — no
  // more "deleted then re-inserted" symptom when nuking many tenants in a
  // row. The tombstone auto-expires after 60 s.
  if (typeof markRowDeleted === 'function') {
    markRowDeleted('tenants', String(id));
    markRowDeleted('payments', String(id)); // payments rows for this tenant share the id semantics
  }

  // Heads-up if the user is on the demo org — its hourly pg_cron will
  // re-create deleted tenants. Real orgs are unaffected.
  var DEMO_ORG_ID = '00000000-0000-0000-0000-00000000d3d0';
  var onDemo = (_currentOrgId === DEMO_ORG_ID);

  var delBtn = document.querySelector('[data-tid="'+id+'"]');
  if (delBtn) { delBtn.disabled = true; delBtn.textContent = '…'; }

  // Step 1: Delete related payments first.
  // payments has a FK constraint (payments_tenant_id_fkey → tenants.id) so the tenant
  // delete will be rejected with a FK violation unless we clear child rows first.
  var payRes = await supa.from('payments').delete().eq('tenant_id', String(id)).eq('org_id', _currentOrgId);
  if (payRes.error) {
    if (delBtn) { delBtn.disabled = false; delBtn.textContent = '🗑 Delete'; }
    showToast('Delete failed (payments): ' + payRes.error.message, 'error');
    return;
  }

  // Step 2: Best-effort cleanup of related tables that may have a tenant_id FK.
  // Errors here don't abort — these tables may have ON DELETE SET NULL or no FK at all,
  // in which case the per-table delete is a no-op or matches zero rows.
  // Run in parallel for speed since none of them block each other.
  await Promise.all([
    supa.from('tenant_docs').delete().eq('tenant_id', String(id)).eq('org_id', _currentOrgId),
    supa.from('comm_log').delete().eq('tenant_id', String(id)).eq('org_id', _currentOrgId),
    supa.from('email_log').delete().eq('tenant_id', String(id)).eq('org_id', _currentOrgId),
    supa.from('rent_schedule').delete().eq('tenant_id', String(id)).eq('org_id', _currentOrgId),
  ]).catch(function(e){ console.warn('Tenant child-table cleanup warning:', e && e.message); });

  // Step 3: Delete the tenant — FK is now clear. Chain .select() so the
  // returned data array is the actual deleted rows. RLS that silently blocks
  // a delete returns 200 with data=[] and no error — the .select() lets us
  // detect that case explicitly instead of trusting the lack of an error code.
  var res = await supa.from('tenants').delete().eq('id', String(id)).eq('org_id', _currentOrgId).select('id');
  if (res.error) {
    if (delBtn) { delBtn.disabled = false; delBtn.textContent = '🗑 Delete'; }
    showToast('Delete failed — please try again: ' + res.error.message, 'error');
    return;
  }
  if (!res.data || res.data.length === 0) {
    if (delBtn) { delBtn.disabled = false; delBtn.textContent = '🗑 Delete'; }
    showToast('Delete blocked — no row removed. Likely an RLS policy blocking delete on tenants. Check Supabase policies.', 'error');
    return;
  }

  state.tenants=state.tenants.filter(function(x){return String(x.id)!==String(id);});
  state.payments=state.payments.filter(function(x){return x.tenantId!==String(id)&&x.tenantName!==t.name;});
  state.rentSchedule=(state.rentSchedule||[]).filter(function(x){return String(x.tenantId)!==String(id);});
  if (state.vault) delete state.vault[String(id)];
  saveStateImmediate({silentSuccess:true});closeModal();render();
  if (onDemo) {
    showToast(t.name+' deleted — note: demo org resets hourly so they\'ll reappear', 'warn');
  } else {
    showToast(t.name+' permanently deleted','success');
  }
}
function restoreTenant(id){
  if (!requirePerm('canEdit', 'restore a tenant')) return;
  var t=state.tenants.find(function(x){return String(x.id)===String(id);});if(!t)return;

  // If the tenant's old property is gone or archived, restoring would re-occupy a stale
  // reference. Decouple them gracefully and let the user re-assign manually.
  if (t.property) {
    var prop = state.properties.find(function(x){ return x.name === t.property; });
    if (!prop || prop.status === 'archived') {
      t.property = ''; t.room = null;
    } else if (t.room) {
      // Check if the old room is now occupied by a different active tenant
      var conflict = state.tenants.find(function(x){
        return x.id !== t.id
          && x.property === t.property
          && x.room === t.room
          && x.status !== 'inactive';
      });
      if (conflict) {
        if (!confirm('Room ' + t.room + ' at ' + t.property + ' is now occupied by ' + conflict.name + '.\n\nRestore ' + t.name + ' WITHOUT re-assigning a room?\n\n(You can move them into a different room from their profile.)')) return;
        t.room = null;
      }
    }
  }

  t.status='active';delete t.archivedDate;
  if(t.property&&t.room) occupyRoom(t.property,t.room,t.rent);
  if(typeof rebuildTenantSchedule==='function') rebuildTenantSchedule(id);
  saveStateImmediate({silentSuccess:true});closeModal();state.filters.tenants='all';render();showToast(t.name+' restored','success');
}
async function savePropDetail(id) {
  if (!requirePerm('canEdit', 'edit property details')) return;
  const p = state.properties.find(x=>x.id===id);
  if(!p) return;
  const name = document.getElementById('pd-name').value;
  const oldName = p.name;
  p.name    = name;
  p.address = document.getElementById('pd-address').value;
  p.area    = document.getElementById('pd-area').value;
  p.type    = document.getElementById('pd-type').value;
  // Lease start anchor (if set, ensureLandlordSchedule uses this over createdAt / earliest tenant).
  var leaseEl = document.getElementById('pd-lease-start');
  if(leaseEl && leaseEl.value) p.leaseStartDate = leaseEl.value;
  // Landlord pay day — independent of lease start date. Empty = clear it (back
  // to fallback: leaseStartDate's day-of-month, then 1).
  var payDayEl = document.getElementById('pd-paydate');
  if (payDayEl) {
    var rawPd = payDayEl.value;
    if (rawPd === '' || rawPd == null) {
      p.landlordPayDay = null;
    } else {
      var nPd = parseInt(rawPd, 10);
      p.landlordPayDay = (isFinite(nPd) && nPd >= 1 && nPd <= 31) ? nPd : null;
    }
  }
  // Ownership & letting
  var owEl = document.querySelector('input[name="pd-ownership"]:checked');
  var ltEl = document.querySelector('input[name="pd-letting"]:checked');
  if(owEl) p.ownershipType = owEl.value;
  if(ltEl) p.lettingType   = ltEl.value;
  // STR (Airbnb / Rent-to-SA) flag
  var strEl = document.getElementById('pd-str-enabled');
  if(strEl) p.isStrEnabled = !!strEl.checked;
  var isOwned = p.ownershipType === 'owned';
  var isWhole = p.lettingType   === 'whole';
  // Rooms/bedrooms
  if(isWhole) {
    p.bedrooms = +(document.getElementById('pd-bedrooms')||{value:p.bedrooms||3}).value || p.bedrooms || 3;
    p.rooms = 1;
  } else {
    p.rooms = +document.getElementById('pd-rooms').value || p.rooms;
    p.bedrooms = null;
  }
  // Income
  p.landlord = +document.getElementById('pd-landlord').value || p.landlord;
  var propTenants = state.tenants.filter(function(t){return t.property===p.name&&t.status!=='inactive';});
  p.rent = Math.round(propTenants.reduce(function(s,t){return s+(t.freq==='monthly'?t.rent:(t.rent||0)*52/12);},0));
  // Landlord dropdown: handle "Add new" option
  var _pdLnSel = document.getElementById('pd-lname');
  var _pdLnVal = _pdLnSel ? _pdLnSel.value : (p.landlordName||'');
  if (_pdLnVal === '__new__') {
    _pdLnVal = (document.getElementById('pd-lname-new')||{value:''}).value.trim();
    // Add new landlord to state if it doesn't exist
    if (_pdLnVal && !(state.landlords||[]).find(function(l){return l.name===_pdLnVal;})) {
      var newLL = {id:crypto.randomUUID(),name:_pdLnVal,phone:'',email:'',bank:'',sortCode:'',accountNo:'',notes:''};
      state.landlords.push(newLL);
    }
  }
  p.landlordName  = isOwned ? '' : _pdLnVal;
  p.landlordPhone = isOwned ? '' : (document.getElementById('pd-lphone')||{value:p.landlordPhone||''}).value;
  p.mapsUrl = document.getElementById('pd-maps').value;
  p.notes   = document.getElementById('pd-notes').value;
  var _pcoEl=document.getElementById('pd-company'); if(_pcoEl) p.companyId=_pcoEl.value;
  // Mortgage
  if(isOwned) {
    var mLender   = (document.getElementById('pd-m-lender')||{value:''}).value.trim();
    var mPayment  = +(document.getElementById('pd-m-payment')||{value:0}).value  || 0;
    var mRate     = +(document.getElementById('pd-m-rate')||{value:0}).value     || 0;
    var mRateType = (document.getElementById('pd-m-ratetype')||{value:'fixed'}).value;
    var mFixEnd   = (document.getElementById('pd-m-fixend')||{value:''}).value   || null;
    var mBalance  = +(document.getElementById('pd-m-balance')||{value:0}).value  || 0;
    p.mortgage = { lender:mLender, monthlyPayment:mPayment, rate:mRate, rateType:mRateType, fixEndDate:mFixEnd, outstandingBalance:mBalance };
    if(!p.landlord && mPayment) p.landlord = mPayment;
  } else {
    p.mortgage = null;
  }
  // Purchase info
  if(isOwned) {
    var pPrice = +(document.getElementById('pd-p-purchase')||{value:0}).value || 0;
    var pDate  = (document.getElementById('pd-p-date')||{value:''}).value    || null;
    var pVal   = +(document.getElementById('pd-p-value')||{value:0}).value   || 0;
    var pStr   = (document.getElementById('pd-p-structure')||{value:'sole'}).value;
    p.purchaseInfo = { purchasePrice:pPrice, purchaseDate:pDate, estimatedValue:pVal, ownershipStructure:pStr };
  } else {
    p.purchaseInfo = null;
  }
  // Update tenant / payment / maintenance / expense / landlord-payment references if the
  // property NAME changed. The property is referenced by NAME (not ID) in many child rows,
  // so without this, renaming a property orphans every related row keyed by the old name —
  // tenants stop appearing under the renamed property, expense reports go blank, etc.
  // Direct UPDATE statements run first so the DB is correct even if the bulk autosave 504s.
  if(name !== oldName) {
    var renameTables = ['tenants', 'payments', 'maintenance', 'expenses', 'landlord_payments'];
    try {
      var renameResults = await Promise.all(renameTables.map(function(tbl){
        return supa.from(tbl)
          .update({ property_name: name })
          .eq('property_name', oldName)
          .eq('org_id', _currentOrgId);
      }));
      var firstErr = renameResults.find(function(r){ return r && r.error; });
      if (firstErr && firstErr.error) {
        // Rollback the in-memory name change so state stays consistent with DB
        p.name = oldName;
        showToast('Rename failed (' + (firstErr.error.message || 'unknown') + ') — reverted', 'error');
        return;
      }
    } catch(e) {
      p.name = oldName;
      showToast('Rename error: ' + (e.message || 'unknown') + ' — reverted', 'error');
      return;
    }
    state.tenants    = state.tenants.map(t => t.property===oldName ? {...t, property:name} : t);
    state.payments   = state.payments.map(pay => pay.property===oldName ? {...pay, property:name} : pay);
    state.maintenance= state.maintenance.map(m => m.property===oldName ? {...m, property:name} : m);
    state.expenses   = (state.expenses||[]).map(e => e.property===oldName ? {...e, property:name} : e);
    state.landlordPayments = (state.landlordPayments||[]).map(lp => (lp.propName===oldName||lp.property===oldName) ? {...lp, propName:name, property:name} : lp);
  }
  state.propDetailTab = null;
  saveStateImmediate({silentSuccess:true});
  closeModal();
  render();
}

// Convert a room's stored price to monthly £, respecting its priceFreq ('wk' default, 'mo').
function roomMonthlyRent(r){
  if(!r) return 0;
  var v = +r.price || 0;
  return (r.priceFreq === 'mo') ? v : Math.round(v * 52 / 12);
}

function updateRoomPrice(propId, roomN, val) {
  const p = state.properties.find(x=>x.id===propId);
  if(!p||!p.roomList) return;
  const r = p.roomList.find(r=>r.n===roomN);
  if(r) r.price = +val;
  // Recalculate total monthly rent — each room's freq decides whether *52/12 is needed.
  p.rent = Math.round(p.roomList.filter(r=>r.status==='occupied').reduce((s,r)=>s+roomMonthlyRent(r),0));
  p.rooms = p.roomList.length;
  p.occupied = p.roomList.filter(r=>r.status==='occupied').length;
  // Update tenant rent to match room price; tenant's freq stays in sync with room's freq.
  var t = state.tenants.find(function(tt){return tt.property===p.name&&tt.room===roomN&&tt.status!=='inactive';});
  if(t) {
    t.rent = +val;
    if(r) t.freq = (r.priceFreq === 'mo') ? 'monthly' : 'weekly';
    rebuildTenantSchedule(t.id);
  }

  saveState();
}

function updateRoomPriceFreq(propId, roomN, freq) {
  const p = state.properties.find(x=>x.id===propId);
  if(!p||!p.roomList) return;
  const r = p.roomList.find(r=>r.n===roomN);
  if(!r) return;
  r.priceFreq = (freq==='mo' ? 'mo' : 'wk');
  // Re-sum p.rent using the new freq for this room.
  p.rent = Math.round(p.roomList.filter(rm=>rm.status==='occupied').reduce((s,rm)=>s+roomMonthlyRent(rm),0));
  // Sync linked tenant's freq + schedule so rent page stops disagreeing with the room.
  var t = state.tenants.find(function(tt){return tt.property===p.name&&tt.room===roomN&&tt.status!=='inactive';});
  if(t){
    t.freq = (r.priceFreq==='mo') ? 'monthly' : 'weekly';
    t.rent = +r.price || t.rent;
    rebuildTenantSchedule(t.id);
  }
  saveState();
}
function updateRoomType(propId, roomN, newType) {
  var p = state.properties.find(function(x){return x.id===propId;});
  if(!p||!p.roomList) return;
  var r = p.roomList.find(function(r){return r.n===roomN;});
  if(r) r.type = newType;
  saveState();
}
function toggleRoomStatus(propId, roomN) {
  const p = state.properties.find(x=>x.id===propId);
  if(!p||!p.roomList) return;
  const r = p.roomList.find(r=>r.n===roomN);
  if(r) r.status = r.status==='occupied'?'vacant':'occupied';
  p.occupied = p.roomList.filter(r=>r.status==='occupied').length;
  p.rent = Math.round(p.roomList.filter(r=>r.status==='occupied').reduce(function(s,r){return s+roomMonthlyRent(r);},0));
  // Track void date
  if(!state.voidDates) state.voidDates={};
  var key = p.id+'_'+roomN;
  if(r && r.status==='vacant') { if(!state.voidDates[key]) state.voidDates[key]=new Date().toISOString().split('T')[0]; }
  else { delete state.voidDates[key]; }
  openPropDetail(propId);
}

function addRoomToProp(propId) {
  const p = state.properties.find(x=>x.id===propId);
  if(!p) return;
  if(!p.roomList) p.roomList = [];
  const nextN = p.roomList.length + 1;
  // Default price = average of existing rooms or 200
  const avgPrice = p.roomList.length
    ? Math.round(p.roomList.reduce(function(s,r){return s+r.price;},0)/p.roomList.length)
    : 200;
  // Prompt for room type
  var types = ['Single','Double','Suite','Studio','Whole House'];
  var typeStr = types.map(function(t,i){return (i+1)+'. '+t;}).join('\n');
  var choice = prompt('Choose room type:\n' + typeStr + '\n\nEnter number (1-5):', '1');
  if(choice === null) return; // cancelled
  var typeIdx = parseInt(choice) - 1;
  var roomType = (typeIdx >= 0 && typeIdx < types.length) ? types[typeIdx] : 'Single';

  p.roomList.push({n:nextN, type:roomType, price:avgPrice, status:'vacant'});
  p.rooms = p.roomList.length;
  p.occupied = p.roomList.filter(r=>r.status==='occupied').length;
  p.rent = Math.round(p.roomList.filter(r=>r.status==='occupied').reduce(function(s,r){return s+r.price*52/12;},0));
  openPropDetail(propId);
}
