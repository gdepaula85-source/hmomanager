// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function getMonthStats(monthKey) {
  var mo = MONTHS.find(function(m){return m.key===monthKey;});
  if(!mo) return null;
  var pool = getFullPaymentPool();
  var pays = pool.filter(function(p){var d=getDueDateObj(p);return d>=mo.from&&d<=mo.to;});
  var income = pays.filter(function(p){return p.status==='paid';}).reduce(function(s,p){return s+p.amount;},0);
  var landlord = state.properties.reduce(function(s,p){return s+p.landlord;},0);
  var opex = state.expenses.reduce(function(s,e){return s+e.amount;},0);
  var occ = state.properties.reduce(function(s,p){return s+p.occupied;},0);
  var rooms = state.properties.reduce(function(s,p){return s+p.rooms;},0);
  // Outstanding: count unpaid entries from rentSchedule in this month
  var schedOutstanding = (state.rentSchedule||[]).filter(function(s){
    if(s.status==='paid') return false;
    if(!s.dueDateRaw) return false;
    var d = new Date(s.dueDateRaw);
    return d>=mo.from && d<=mo.to;
  }).length;
  // Expected income = weekly rent × 52/12 for all active tenants
  var expectedIncome = Math.round(state.tenants.filter(function(t){return t.status==='active';})
    .reduce(function(s,t){return s+(t.freq==='monthly'?t.rent:(t.rent||0)*52/12);},0));
  var expectedGross = expectedIncome - landlord;
  var expectedNet   = expectedIncome - landlord - opex;
  return {income:income, landlord:landlord, opex:opex, profit:income-landlord-opex,
          occ:occ, rooms:rooms, outstanding:schedOutstanding, pays:pays,
          label:mo.label, expectedIncome:expectedIncome,
          expectedGross:expectedGross, expectedNet:expectedNet};
}

function showChartTip(e, text) {
  var tip = document.getElementById('chart-tip');
  if(!tip) return;
  var lines = text.split('|');
  tip.innerHTML = lines.map(function(l,i){return i===0?'<strong>'+l+'</strong>':l;}).join('<br>');
  tip.style.display = 'block';
  tip.style.left = Math.min(e.clientX+10, window.innerWidth-150)+'px';
  tip.style.top = (e.clientY-70)+'px';
}
function hideChartTip(){var tip=document.getElementById('chart-tip');if(tip)tip.style.display='none';}

function renderDashboard() {
  var selMonth = state.dashMonth || '2026-03';
  var ms = getMonthStats(selMonth) || getMonthStats('2026-03');
  var s = getStats();

  // Build 6-month trend from real payment data
  var trend = MONTHS.map(function(mo) {
    var pool = getFullPaymentPool();
    var pays = pool.filter(function(p){var d=getDueDateObj(p);return d>=mo.from&&d<=mo.to;});
    var inc  = pays.filter(function(p){return p.status==='paid';}).reduce(function(s,p){return s+p.amount;},0);
    var land = state.properties.reduce(function(s,p){return s+p.landlord;},0);
    var opex = state.expenses.reduce(function(s,e){return s+e.amount;},0);
    var costs= land+opex;
    return {m:mo.label.split(' ')[0], key:mo.key, i:inc, c:costs, p:inc-costs, label:mo.label};
  });
  var maxV = Math.max.apply(null, trend.map(function(t){return Math.max(t.i,t.c);}));
  if(maxV===0) maxV=1;

  var lossProps = state.properties.filter(function(p){return net(p)<0;});
  var staffT = state.expenses.filter(function(e){return e.type==='staff';}).reduce(function(a,e){return a+e.amount;},0);
  var propT  = state.expenses.filter(function(e){return e.type==='property';}).reduce(function(a,e){return a+e.amount;},0);
  var overT  = state.expenses.filter(function(e){return e.type==='overhead';}).reduce(function(a,e){return a+e.amount;},0);

  var html = '';

  // Header with month selector
  var dashCo = state.filters.dashCompany||'';
  html += '<div class="page-header"><div><div class="page-title">Dashboard</div><div class="page-sub">'+ms.label+'</div></div>';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
  html += '<select onchange="state.filters.dashCompany=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">';
  html += '<option value="">&#x1F3E2; All Companies</option>';
  (state.companies||[]).forEach(function(c){html+='<option value="'+c.id+'" '+(dashCo===c.id?'selected':'')+'>'+c.name+'</option>';});
  html += '</select>';
  html += '<select onchange="state.dashMonth=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;min-width:130px">';
  MONTHS.forEach(function(mo){
    html += '<option value="'+mo.key+'" '+(selMonth===mo.key?'selected':'')+'>'+mo.label+'</option>';
  });
  html += '</select>';
  html += '</div></div>';
  // Filter properties by company for KPI calculations
  var _dashProps = dashCo ? state.properties.filter(function(p){return p.companyId===dashCo;}) : state.properties;
  var _dashPropNames = _dashProps.map(function(p){return p.name;});

  // KPIs — Row 1: Expected Income + Expected Net Profit
  var collectedAmt = ms.pays.filter(function(p){return p.status==='paid';}).reduce(function(a,p){return a+p.amount;},0);
  html += '<div class="kpi-grid kpi-2" style="margin-bottom:10px">';
  html += kpi('Expected Income', fmt(ms.expectedIncome), ms.occ+'/'+ms.rooms+' rooms occupied', '#00B894', '&#x1F4B0;');
  html += kpi('Expected Net Profit', fmt(ms.expectedNet), 'After all costs', ms.expectedNet>=0?'#00B894':'#E8375A', '&#x1F4C8;');
  html += '</div>';
  // Row 2: Actual collected + costs
  html += '<div class="kpi-grid kpi-4" style="margin-bottom:22px">';
  html += kpi('Collected', fmt(collectedAmt), ms.pays.filter(function(p){return p.status==='paid';}).length+' payments', '#10B981', '&#x2705;');
  html += kpi('Landlord Costs', fmt(ms.landlord), pct(ms.landlord,ms.expectedIncome||1)+'% of income', '#E8375A', '&#x1F3E6;');
  html += kpi('Operating Costs', fmt(ms.opex), 'Staff + property + overhead', '#F59E0B', '&#x2699;&#xFE0F;');
  html += kpi('Active Tenants', state.tenants.filter(function(t){return t.status==='active';}).length, state.tenants.filter(function(t){return t.status==='notice_given';}).length+' on notice', '#3B82F6', '&#x1F465;');
  html += '</div>';

  // Tooltip div
  html += '<div id="chart-tip" style="display:none;position:fixed;background:var(--text);color:#fff;padding:8px 12px;border-radius:9px;font-size:12px;font-weight:600;z-index:999;pointer-events:none;line-height:1.6;min-width:130px"></div>';

  // 6-month chart + P&L
  html += '<div class="grid-6-4"><div class="card">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div class="card-title" style="margin:0">&#x1F4CA; 6-Month Cash Flow</div></div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-bottom:14px">Tap a bar to drill into that month</div>';
  html += '<div class="chart-bars">';
  trend.forEach(function(t,i){
    var isSel = t.key===selMonth;
    var ih = pct(t.i,maxV), ch = pct(t.c,maxV), ph = Math.abs(pct(t.p,maxV));
    var profitColor = t.p>=0?'#10B981':'#E8375A';
    var tip = t.label+'|&#x1F4B0; Income: '+fmt(Math.round(t.i))+'|&#x1F4B8; Costs: '+fmt(Math.round(t.c))+'|'+(t.p>=0?'&#x2705;':'&#x274C;')+' Profit: '+fmt(Math.round(Math.abs(t.p)));
    html += '<div class="chart-month" onclick="state.dashMonth=\''+t.key+'\';render()" style="cursor:pointer;opacity:'+(isSel?1:0.75)+'" onmouseover="showChartTip(event,\''+tip+'\')" onmouseout="hideChartTip()">';
    html += '<div class="chart-pair" style="align-items:flex-end;gap:2px">';
    html += '<div class="chart-bar" style="height:'+ih+'%;background:'+(isSel?'var(--accent)':'#BBF7D0')+';border-radius:4px 4px 0 0"></div>';
    html += '<div class="chart-bar" style="height:'+ch+'%;background:'+(isSel?'var(--red)':'#FECDD3')+';border-radius:4px 4px 0 0"></div>';
    html += '<div class="chart-bar" style="height:'+ph+'%;background:'+(isSel?profitColor:(t.p>=0?'#ECFDF5':'#FEF0F3'))+';border:1px solid '+profitColor+';border-radius:4px 4px 0 0"></div>';
    html += '</div><div class="chart-lbl" style="font-weight:'+(isSel?700:400)+'">'+t.m+'</div></div>';
  });
  html += '</div>';
  html += '<div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">';
  html += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)"><div style="width:10px;height:10px;border-radius:3px;background:var(--accent)"></div>Income</div>';
  html += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)"><div style="width:10px;height:10px;border-radius:3px;background:var(--red)"></div>Costs</div>';
  html += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)"><div style="width:10px;height:10px;border-radius:3px;background:#10B981"></div>Profit</div>';
  html += '<span style="margin-left:auto;font-size:11px;color:var(--muted)">Tap bar to select month</span>';
  html += '</div></div>';

  // P&L card
  html += '<div class="card"><div class="card-title">&#x1F4BC; P&amp;L &mdash; '+ms.label+'</div>';
  html += '<div class="pl-row"><span class="pl-label">Total Income</span><span class="pl-val" style="color:var(--green)">'+fmt(ms.income)+'</span></div>';
  html += '<div class="pl-row"><span class="pl-label">Landlord Rent</span><span class="pl-val" style="color:var(--red)">&mdash; '+fmt(ms.landlord)+'</span></div>';
  html += '<div class="pl-row"><span class="pl-label">Staff &amp; Labour</span><span class="pl-val" style="color:var(--amber)">&mdash; '+fmt(staffT)+'</span></div>';
  html += '<div class="pl-row"><span class="pl-label">Property Costs</span><span class="pl-val" style="color:var(--amber)">&mdash; '+fmt(propT)+'</span></div>';
  html += '<div class="pl-row"><span class="pl-label">Overhead</span><span class="pl-val" style="color:var(--muted)">&mdash; '+fmt(overT)+'</span></div>';
  html += '<div class="pl-row"><span style="font-size:14px;font-weight:700">Net Profit</span><span style="font-size:16px;font-weight:700;font-family:monospace;color:'+(ms.profit>=0?'var(--green)':'var(--red)')+'">'+fmt(ms.profit)+'</span></div>';
  html += '</div></div>';

  // Loss-making + maintenance
  html += '<div class="grid-2">';
  html += '<div class="card" style="'+(lossProps.length>0?'border-color:#FECDD3':'')+'"><div class="card-title" style="color:'+(lossProps.length>0?'var(--red)':'var(--text)')+'">&#x26A0;&#xFE0F; Loss-Making ('+lossProps.length+')</div>';
  if(!lossProps.length){html+='<div style="font-size:13px;color:var(--green)">&#x2713; All properties profitable</div>';}
  else{lossProps.slice(0,6).forEach(function(p){html+='<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:12px;font-weight:600">'+p.name+'</div><div style="font-size:11px;color:var(--muted)">'+p.occupied+'/'+p.rooms+' rooms</div></div><span class="mono" style="font-size:12px;font-weight:700;color:var(--red)">'+fmt(net(p))+'</span></div>';});if(lossProps.length>6)html+='<div style="font-size:11px;color:var(--muted);padding-top:6px">+'+(lossProps.length-6)+' more</div>';}
  html += '</div>';
  html += '<div class="card"><div class="card-title" style="color:var(--amber)">&#x1F527; Open Maintenance</div>';
  if(!s.openM.length){html+='<div style="font-size:13px;color:var(--green)">&#x2713; No open issues</div>';}
  else{s.openM.slice(0,5).forEach(function(m){html+='<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:12px;font-weight:600">'+m.issue+'</div><div style="font-size:11px;color:var(--muted)">'+m.property+' &middot; Rm '+m.room+'</div></div>'+badge(m.priority)+'</div>';});}
  html += '</div></div>';

  // ── AI Agent card ──
  html += '<div class="card" style="margin-top:0;padding:0;overflow:hidden">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#0F0F1A 0%,#1a1a3e 100%)">';
  html += '<div style="display:flex;align-items:center;gap:10px">';
  html += '<div style="font-size:22px">🤖</div>';
  html += '<div><div style="font-size:14px;font-weight:800;color:#fff">AI Portfolio Agent</div>';
  html += '<div style="font-size:11px;color:rgba(255,255,255,.5)">Daily insights · Tasks · Health score</div></div>';
  html += '</div>';
  html += '</div>';
  html += '<div id="ai-agent-output"></div>';
  html += '</div>';
  html += '<div class="card" style="margin-top:0">'+renderVoidTracker()+'</div>';
  html += '<div class="card" style="margin-top:0">'+renderComplianceWidget()+'</div>';
  html += '<div class="card" style="margin-top:0">'+renderDepositSummary()+'</div>';

  return html;
}


function renderProperties() {
  if((state.filters.propView||'list')==='deal') return renderPropertiesDealView();
  const f = state.filters.props||'all';
  const q = (state.filters.propQ||'').toLowerCase();
  const pco = state.filters.propCompany||'';
  const data = state.properties.filter(p=>{
    if(pco && p.companyId!==pco) return false;
    const ok = p.name.toLowerCase().includes(q)||p.area.toLowerCase().includes(q);
    if(f==='archived') return ok&&p.status==='archived';
    if(p.status==='archived') return false;
    if(f==='profitable') return ok&&net(p)>0;
    if(f==='loss') return ok&&net(p)<0;
    if(f==='vacant') return ok&&p.occupied<p.rooms;
    if(f==='owned')   return ok&&p.ownershipType==='owned';
    if(f==='managed') return ok&&p.ownershipType!=='owned';
    return ok;
  });
  const coOpts = '<option value="">&#x1F3E2; All Companies</option>'+(state.companies||[]).map(c=>'<option value="'+c.id+'" '+(pco===c.id?'selected':'')+'>'+c.name+'</option>').join('');
  return `
    <div class="page-header">
      <div><div class="page-title">Properties</div><div class="page-sub">${data.length} of ${state.properties.length} properties</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="openDataModal('properties')" style="padding:8px 10px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit" title="Import / Export Properties">⇅</button>
        <button onclick="propViewDeal()" style="padding:9px 14px;border-radius:10px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Deal Analyzer</button>
        <select onchange="state.filters.propCompany=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">${coOpts}</select>
        ${btn('+ Add Property',"openModal('addProp')")}
      </div>
    </div>
    <div class="filters">
      <div class="search-wrap"><span class="search-ico">🔍</span><input class="search-inp" placeholder="Search properties…" value="${state.filters.propQ||''}" oninput="state.filters.propQ=this.value;debouncedPropSearch()"></div>
      ${['all','owned','managed','profitable','loss','vacant','archived'].map(v=>`<button class="filter-btn ${f===v?'active':''}" onclick="state.filters.props='${v}';render()">${v==='loss'?'Loss-Making':v==='vacant'?'Has Vacancies':v==='owned'?'🏠 Owned':v==='managed'?'🤝 Managed':v==='archived'?'📦 Archived':v[0].toUpperCase()+v.slice(1)}</button>`).join('')}
    </div>
    <!-- Portfolio KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Total Portfolio</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-size:22px;font-weight:800;color:var(--text);font-family:monospace">${state.properties.length}</div>
            <div style="font-size:11px;color:var(--muted)">properties</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:800;color:var(--muted);font-family:monospace">${data.reduce((s,p)=>s+p.rooms,0)}</div>
            <div style="font-size:11px;color:var(--muted)">total rooms</div>
          </div>
        </div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Occupancy</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
          <div>
            <div style="font-size:22px;font-weight:800;font-family:monospace;color:${(()=>{const occ=data.reduce((s,p)=>s+p.occupied,0);const tot=data.reduce((s,p)=>s+p.rooms,0);const pct=tot?Math.round(occ/tot*100):0;return pct>=85?'var(--green)':pct>=70?'var(--amber)':'var(--red)';})()} ">${(()=>{const occ=data.reduce((s,p)=>s+p.occupied,0);const tot=data.reduce((s,p)=>s+p.rooms,0);return tot?Math.round(occ/tot*100):0;})()}%</div>
            <div style="font-size:11px;color:var(--muted)">${data.reduce((s,p)=>s+p.occupied,0)} occupied</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:800;color:var(--red);font-family:monospace">${state.properties.reduce((s,p)=>s+(p.rooms-p.occupied),0)}</div>
            <div style="font-size:11px;color:var(--muted)">vacant</div>
          </div>
        </div>
        <div style="background:var(--border);border-radius:3px;height:4px;overflow:hidden"><div style="height:100%;border-radius:3px;background:var(--green);width:${(()=>{const occ=data.reduce((s,p)=>s+p.occupied,0);const tot=data.reduce((s,p)=>s+p.rooms,0);return tot?Math.round(occ/tot*100):0;})()}%"></div></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace">${fmt(data.reduce((s,p)=>s+p.rent,0))}</div>
        <div style="font-size:10px;font-weight:700;color:var(--green);margin-top:3px">MONTHLY INCOME</div>
      </div>
      <div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:800;color:var(--red);font-family:monospace">${fmt(data.reduce((s,p)=>s+p.landlord,0))}</div>
        <div style="font-size:10px;font-weight:700;color:var(--red);margin-top:3px">LANDLORD COSTS</div>
      </div>
      <div style="background:${data.reduce((s,p)=>s+net(p),0)>=0?'var(--green-light)':'var(--red-light)'};border:1px solid ${data.reduce((s,p)=>s+net(p),0)>=0?'#A7F3D0':'#FECDD3'};border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:800;color:${data.reduce((s,p)=>s+net(p),0)>=0?'var(--green)':'var(--red)'};font-family:monospace">${fmt(data.reduce((s,p)=>s+net(p),0))}</div>
        <div style="font-size:10px;font-weight:700;color:${data.reduce((s,p)=>s+net(p),0)>=0?'var(--green)':'var(--red)'};margin-top:3px">NET PROFIT/MO</div>
      </div>
    </div>

    <div class="prop-grid">
      ${data.map(p=>{
        const n=net(p); const o=pct(p.occupied,p.rooms);
        const oc=o===100?'var(--green)':o<70?'var(--red)':'var(--amber)';
        const vacantRooms = p.roomList ? p.roomList.filter(r=>r.status==='vacant').length : p.rooms-p.occupied;
        return `<div class="prop-card${n<0?' loss':''}" onclick="openPropDetail('${p.id}')" style="cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;margin-bottom:2px">${p.name}</div>
              <div style="font-size:12px;color:var(--muted)">${p.address||p.area}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:10px;flex-wrap:wrap;justify-content:flex-end">
              ${p.ownershipType==='owned'
                ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0">🏠 Owned</span>`
                : `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#FFFBEB;color:#92400E;border:1px solid #FDE68A">🤝 Managed</span>`}
              ${p.lettingType==='whole'
                ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE">🏡 ${p.bedrooms||'?'}-bed</span>`
                : ''}
              ${badge(n<0?'Loss':'Active')}
            </div>
          </div>
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:11px;color:var(--muted);font-weight:500">Occupancy</span>
              <span style="font-size:11px;font-weight:600;color:${oc}">${p.lettingType==='whole' ? (p.occupied>0?'Occupied':'Vacant')+' · '+(p.bedrooms||'?')+' bed' : p.occupied+'/'+p.rooms+' rooms · '+o+'%'+(vacantRooms>0?' · '+vacantRooms+' vacant':'')}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${o}%;background:${oc}"></div></div>
          </div>
          <div class="prop-metrics">
            <div class="metric-box"><div class="metric-label">Income</div><div class="metric-val" style="color:var(--green)">${fmt(p.rent)}</div></div>
            <div class="metric-box"><div class="metric-label">Landlord</div><div class="metric-val" style="color:var(--red)">${fmt(p.landlord)}</div></div>
            <div class="metric-box"><div class="metric-label">Profit</div><div class="metric-val" style="color:${n>=0?'var(--green)':'var(--red)'}">${fmt(n)}</div></div>
          </div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            ${p.mapsUrl?`<a href="${p.mapsUrl}" target="_blank" onclick="event.stopPropagation()" style="font-size:11px;color:var(--blue);text-decoration:none;display:flex;align-items:center;gap:4px">📍 View on Maps</a>`:'<span></span>'}
            <span style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px">Tap to edit ✏️</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}
