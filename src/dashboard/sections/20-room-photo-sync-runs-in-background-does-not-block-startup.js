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
    try { localStorage.setItem('pm_local_roomMedia', JSON.stringify(state.roomMedia)); } catch(e) {}
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

function archiveProperty(id){
  var p=state.properties.find(function(x){return String(x.id)===String(id);});if(!p)return;
  var activeT=state.tenants.filter(function(t){return t.property===p.name&&(t.status==='active'||t.status==='notice_given');});
  var msg=activeT.length>0?'This property has '+activeT.length+' active tenant(s). Archive anyway?\n\nActive tenants will remain linked but property hidden from main view.':'Archive "'+p.name+'"?\n\nHidden from main view. Restore or delete from Archived tab.';
  if(!confirm(msg)) return;
  p.status='archived';p.archivedDate=new Date().toISOString().split('T')[0];
  saveState();closeModal();state.filters.props='archived';render();
  showToast(p.name+' archived','success');
}
function deletePropPermanent(id){
  var p=state.properties.find(function(x){return String(x.id)===String(id);});if(!p)return;
  if(p.status!=='archived'){showToast('Archive first before deleting','error');return;}
  if(!confirm('PERMANENTLY DELETE "'+p.name+'"?\n\nThis cannot be undone.')) return;
  try{supa.from('properties').delete().eq('id',String(id)).then(function(){});}catch(e){}
  state.properties=state.properties.filter(function(x){return String(x.id)!==String(id);});
  saveState();closeModal();render();showToast(p.name+' permanently deleted','success');
}
function restoreProperty(id){
  var p=state.properties.find(function(x){return String(x.id)===String(id);});if(!p)return;
  p.status='active';delete p.archivedDate;
  saveState();closeModal();state.filters.props='all';render();showToast(p.name+' restored','success');
}
function archiveTenant(id){
  var t=state.tenants.find(function(x){return String(x.id)===String(id);});if(!t)return;
  if(!confirm('Archive "'+t.name+'"?\n\nMoved to Archived tab. Restore or delete from there.')) return;
  var oldProp=t.property,oldRoom=t.room;
  t.status='inactive';t.archivedDate=new Date().toISOString().split('T')[0];
  freeRoom(oldProp,oldRoom);
  saveState();closeModal();state.filters.tenants='archived';render();showToast(t.name+' archived','success');
}
function deleteTenantPermanent(id){
  var t=state.tenants.find(function(x){return String(x.id)===String(id);});if(!t)return;
  if(t.status!=='inactive'){showToast('Archive first before deleting','error');return;}
  if(!confirm('PERMANENTLY DELETE "'+t.name+'"?\n\nAll payment history removed. Cannot be undone.')) return;
  try{supa.from('tenants').delete().eq('id',String(id)).then(function(){});}catch(e){}
  state.tenants=state.tenants.filter(function(x){return String(x.id)!==String(id);});
  state.payments=state.payments.filter(function(x){return x.tenantId!==String(id)&&x.tenantName!==t.name;});
  saveState();closeModal();render();showToast(t.name+' permanently deleted','success');
}
function restoreTenant(id){
  var t=state.tenants.find(function(x){return String(x.id)===String(id);});if(!t)return;
  t.status='active';delete t.archivedDate;
  if(t.property&&t.room) occupyRoom(t.property,t.room,t.rent);
  saveState();closeModal();state.filters.tenants='all';render();showToast(t.name+' restored','success');
}
function savePropDetail(id) {
  const p = state.properties.find(x=>x.id===id);
  if(!p) return;
  const name = document.getElementById('pd-name').value;
  const oldName = p.name;
  p.name    = name;
  p.address = document.getElementById('pd-address').value;
  p.area    = document.getElementById('pd-area').value;
  p.type    = document.getElementById('pd-type').value;
  // Ownership & letting
  var owEl = document.querySelector('input[name="pd-ownership"]:checked');
  var ltEl = document.querySelector('input[name="pd-letting"]:checked');
  if(owEl) p.ownershipType = owEl.value;
  if(ltEl) p.lettingType   = ltEl.value;
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
  p.landlordName  = isOwned ? '' : (document.getElementById('pd-lname')||{value:p.landlordName||''}).value;
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
  // Update tenant references if name changed
  if(name !== oldName) {
    state.tenants    = state.tenants.map(t => t.property===oldName ? {...t, property:name} : t);
    state.payments   = state.payments.map(pay => pay.property===oldName ? {...pay, property:name} : pay);
    state.maintenance= state.maintenance.map(m => m.property===oldName ? {...m, property:name} : m);
  }
  state.propDetailTab = null;
  closeModal();
  render();
}

function updateRoomPrice(propId, roomN, val) {
  const p = state.properties.find(x=>x.id===propId);
  if(!p||!p.roomList) return;
  const r = p.roomList.find(r=>r.n===roomN);
  if(r) r.price = +val;
  // Recalculate total rent from occupied rooms (weekly × 52/12 = monthly)
  p.rent = Math.round(p.roomList.filter(r=>r.status==='occupied').reduce((s,r)=>s+r.price*52/12,0));
  p.rooms = p.roomList.length;
  p.occupied = p.roomList.filter(r=>r.status==='occupied').length;
  // Update tenant rent to match room price
  var t = state.tenants.find(function(tt){return tt.property===p.name&&tt.room===roomN&&tt.status!=='inactive';});
  if(t) { t.rent = +val; rebuildTenantSchedule(t.id); }

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
  p.rent = Math.round(p.roomList.filter(r=>r.status==='occupied').reduce(function(s,r){return s+r.price*52/12;},0));
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
