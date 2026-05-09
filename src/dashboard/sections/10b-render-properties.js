// ── renderProperties — canonical implementation ────────────────────────────
// Extracted from src/dashboard/app.js into its own section so the build
// pipeline (sections/*.js concat) picks it up.

function renderProperties() {
  if((state.filters.propView||'list')==='deal') return renderPropertiesDealView();
  // Refresh cached p.rent / p.occupied for every property so the totals on this
  // page can't drift from the dashboard. Cheap — just iterates tenants per property.
  if (typeof recalcProperty === 'function') (state.properties||[]).forEach(recalcProperty);
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
    if(f==='str')     return ok&&p.isStrEnabled;
    if(f==='compliance') {
      if(!ok) return false;
      var cs = typeof getPropertyComplianceStatus === 'function' ? getPropertyComplianceStatus(p) : {level:'ok'};
      return cs.level === 'critical' || cs.level === 'warning' || cs.level === 'missing';
    }
    return ok;
  });
  // ── Aggregates for hero/stat row ──
  const totalIncome  = data.reduce((s,p)=>s + (p.rent||0) + ((typeof getPropStrMonthlyIncome==='function')?getPropStrMonthlyIncome(p):0), 0);
  const totalCosts   = data.reduce((s,p)=>s + (p.landlord||0), 0);
  const totalNet     = data.reduce((s,p)=>s + net(p), 0);
  const marginPct    = totalIncome > 0 ? Math.round(totalNet/totalIncome*100) : 0;
  const totalRooms   = data.reduce((s,p)=>s+p.rooms,0);
  const totalOcc     = data.reduce((s,p)=>s+p.occupied,0);
  const totalVacant  = data.reduce((s,p)=>s+(p.rooms-p.occupied),0);
  const occPct       = totalRooms ? Math.round(totalOcc/totalRooms*100) : 0;
  const occColor     = occPct>=85 ? 'emerald' : occPct>=70 ? 'amber' : 'orange';
  const complianceIssues = state.properties.filter(function(p){
    if(p.status==='archived') return false;
    if(typeof getPropertyComplianceStatus !== 'function') return false;
    var cs = getPropertyComplianceStatus(p);
    return cs.level === 'critical' || cs.level === 'warning' || cs.level === 'missing';
  }).length;

  // ── Header — Deal Analyzer + Add Property pills ──
  const coOpts = '<option value="">All Companies</option>'+(state.companies||[]).map(c=>'<option value="'+c.id+'" '+(pco===c.id?'selected':'')+'>'+c.name+'</option>').join('');
  const headerCo = '<select aria-label="Company" onchange="state.filters.propCompany=this.value;render()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;max-width:140px">'+coOpts+'</select>';
  const dealBtn  = '<button onclick="propViewDeal()" style="padding:7px 14px;border-radius:999px;border:1px solid var(--teal-500);background:var(--teal-50);color:var(--teal-700);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Deal Analyzer</button>';
  const addBtn   = '<button onclick="openModal(\'addProp\')" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Add</button>';
  const subtitle = fmt(totalIncome) + ' income · ' + marginPct + '% margin';
  let html = '';
  html += renderScreenHeader({
    title: 'Properties',
    subtitle: subtitle,
    rightActions: [headerCo, dealBtn, addBtn]
  });

  // ── Hero: Net Profit / Mo with Income−Costs=Profit breakdown ──
  html += renderHeroCard({
    icon: '🏠',
    label: 'Net Profit / Mo',
    value: '<span style="color:#fff">' + fmt(totalNet) + '</span>',
    subtitle: data.length + ' of ' + state.properties.length + ' properties shown',
    breakdown: [
      { label:'Income', value: fmt(totalIncome) },
      { label:'Costs',  value: '− ' + fmt(totalCosts) },
      { label:'Profit', value: fmt(totalNet) }
    ]
  });

  // ── Stat row: Properties · Total Rooms · Vacant ──
  html += renderStatRow([
    { label:'Properties',  value: data.length, color:'default', subtitle: state.properties.length === data.length ? null : ('of ' + state.properties.length) },
    { label:'Total Rooms', value: totalRooms,  color:'default' },
    { label:'Vacant',      value: totalVacant, color: totalVacant>0?'orange':'emerald' }
  ]);

  // ── Slim portfolio occupancy bar card ──
  html += '<div style="background:var(--surface);border-radius:var(--radius-lg);padding:12px 14px;box-shadow:var(--shadow-card);margin-bottom:14px">'
    +  '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">'
    +    '<span style="font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.04em">Portfolio Occupancy</span>'
    +    '<span style="font-size:13px;font-weight:700;color:var(--gray-900);font-family:\'DM Mono\',monospace">' + occPct + '% · ' + totalOcc + '/' + totalRooms + '</span>'
    +  '</div>'
    +  '<div style="height:8px;background:var(--gray-100);border-radius:999px;overflow:hidden"><div style="height:100%;width:' + occPct + '%;background:var(--' + (occColor==='orange'?'orange-500':occColor+'-500') + ');border-radius:999px;transition:width .4s ease"></div></div>'
    + '</div>';

  // ── Search + single Filter dropdown (replaces 9-tag row) ──
  const filterOpts = [
    {v:'all',         l:'All properties'},
    {v:'owned',       l:'🏠 Owned'},
    {v:'managed',     l:'🤝 Managed'},
    {v:'str',         l:'🛏️ Airbnb / SA'},
    {v:'compliance',  l:'⚠️ Compliance' + (complianceIssues?(' ('+complianceIssues+')'):'')},
    {v:'vacant',      l:'Has vacancies'},
    {v:'profitable',  l:'Profitable'},
    {v:'loss',        l:'Loss-making'},
    {v:'archived',    l:'📦 Archived'}
  ];
  const filterSelect = filterOpts.map(o=>'<option value="'+o.v+'" '+(f===o.v?'selected':'')+'>'+o.l+'</option>').join('');
  html += '<div style="display:flex;gap:8px;margin-bottom:10px">'
    +  '<div style="flex:1;position:relative">'
    +    '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--gray-500)">🔍</span>'
    +    '<input class="inp" id="p-search-input" placeholder="Search properties…" value="'+(state.filters.propQ||'')+'" oninput="state.filters.propQ=this.value;debouncedPropSearch()" style="width:100%;padding-left:30px;border-radius:var(--radius-md);background:#fff;border:1px solid var(--gray-200);font-size:13px;height:38px">'
    +  '</div>'
    +  '<select onchange="state.filters.props=this.value;render()" style="padding:0 12px;border-radius:var(--radius-md);border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:13px;font-weight:600;color:var(--gray-700);cursor:pointer;height:38px">'+filterSelect+'</select>'
    + '</div>';
  // Active-filter chip if not "all"
  if (f !== 'all') {
    const cur = filterOpts.find(o=>o.v===f);
    html += renderActiveFilters([{ key:f, label:(cur?cur.l:f) }], 'state.filters.props=\'all\';render()');
  }

  html += `
    <div class="prop-grid">
      ${data.map(p=>{
        const n=net(p);
        const saIncome = (typeof getPropStrMonthlyIncome==='function')?getPropStrMonthlyIncome(p):0;
        const saActive = (typeof isPropStrActive==='function')&&isPropStrActive(p);
        const roomOcc = pct(p.occupied,p.rooms);
        const o = (saActive && roomOcc < 100) ? 100 : roomOcc;
        const oc=o===100?'var(--green)':o<70?'var(--red)':'var(--amber)';
        const vacantRooms = p.roomList ? p.roomList.filter(r=>r.status==='vacant').length : p.rooms-p.occupied;
        return `<div class="prop-card${n<0?' loss':''}" onclick="openPropDetail('${p.id}')" style="cursor:pointer">
          <div style="margin-bottom:14px">
            <div style="font-size:15px;font-weight:700;margin-bottom:2px;line-height:1.25">${p.name}</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${p.address||p.area}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${p.ownershipType==='owned'
                ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0">🏠 Owned</span>`
                : `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#FFFBEB;color:#92400E;border:1px solid #FDE68A">🤝 Managed</span>`}
              ${p.lettingType==='whole'
                ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE">🏡 ${p.bedrooms||'?'}-bed</span>`
                : ''}
              ${p.isStrEnabled
                ? `<span title="This property generates Airbnb / STR income" style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#FFF1F2;color:#E04E53;border:1px solid #FECDD3">🛏️ Airbnb</span>`
                : ''}
              ${badge(n<0?'Loss':'Active')}
            </div>
          </div>
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:11px;color:var(--muted);font-weight:500">Occupancy</span>
              <span style="font-size:11px;font-weight:600;color:${oc}">${
                saActive && p.occupied===0
                  ? '🛏️ Airbnb active'
                  : p.lettingType==='whole'
                    ? (p.occupied>0?'Occupied':'Vacant')+' · '+(p.bedrooms||'?')+' bed'
                    : p.occupied+'/'+p.rooms+' rooms · '+o+'%'+(vacantRooms>0?' · '+vacantRooms+' vacant':'')
              }</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${o}%;background:${oc}"></div></div>
          </div>
          <div class="prop-metrics">
            <div class="metric-box"><div class="metric-label">Income</div><div class="metric-val" style="color:var(--green)">${fmt((p.rent||0)+saIncome)}${saIncome>0?`<div style="font-size:9px;color:#E04E53;font-weight:700;margin-top:2px">🛏️ ${fmt(saIncome)} SA</div>`:''}</div></div>
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
  html += renderFAB({icon:'+', label:'Add property', onClick:"openModal('addProp')"});
  return html;
}

// ── renderPropMaintenanceTab — property detail maintenance tab ──────────────
function renderPropMaintenanceTab(p, jobs) {
  jobs = jobs || [];
  var open    = jobs.filter(function(m){return m.status === 'open';});
  var inProg  = jobs.filter(function(m){return m.status === 'in_progress';});
  var resolved= jobs.filter(function(m){return m.status === 'resolved';});
  var totalSpent = jobs.reduce(function(s,m){ var mx=(state.maintExtras&&state.maintExtras[m.id])||{}; return s + (parseFloat(mx.cost)||parseFloat(m.jobCost)||0); }, 0);
  var resolvedWithDates = resolved.filter(function(m){return m.date && m.resolvedDate;});
  var avgDays = '—';
  if(resolvedWithDates.length){
    var totalDays = resolvedWithDates.reduce(function(s,m){ var a=new Date(m.date), b=new Date(m.resolvedDate); return s+Math.max(0,Math.round((b-a)/86400000)); }, 0);
    avgDays = Math.round(totalDays/resolvedWithDates.length) + 'd';
  }
  var catCount = {};
  jobs.forEach(function(m){ var c = m.cat || m.category || 'Other'; catCount[c] = (catCount[c]||0) + 1; });
  var topCat = Object.keys(catCount).sort(function(a,b){return catCount[b]-catCount[a];})[0] || '—';
  var spendByCat = {};
  jobs.forEach(function(m){
    var mx=(state.maintExtras&&state.maintExtras[m.id])||{};
    var cost = parseFloat(mx.cost)||parseFloat(m.jobCost)||0;
    if(cost <= 0) return;
    var c = m.cat || m.category || 'Other';
    spendByCat[c] = (spendByCat[c]||0) + cost;
  });
  var spendCats = Object.keys(spendByCat).sort(function(a,b){return spendByCat[b]-spendByCat[a];});
  var maxSpend = Math.max.apply(null, spendCats.map(function(c){return spendByCat[c];}).concat([1]));

  var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">';
  html += '<div style="background:var(--red-light);border:1px solid #FECACA;border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--red);font-family:monospace">'+open.length+'</div><div style="font-size:10px;color:var(--red);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">Open</div></div>';
  html += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--amber);font-family:monospace">'+inProg.length+'</div><div style="font-size:10px;color:var(--amber);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">In Progress</div></div>';
  html += '<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--green);font-family:monospace">'+resolved.length+'</div><div style="font-size:10px;color:var(--green);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">Resolved</div></div>';
  html += '<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800;color:var(--blue);font-family:monospace">'+fmt(totalSpent)+'</div><div style="font-size:10px;color:var(--blue);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">Total Spent</div></div>';
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">';
  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Avg resolve time</div><div style="font-size:18px;font-weight:800;color:var(--text)">'+avgDays+'</div></div>';
  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Most common</div><div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(topCat)+'</div></div>';
  html += '</div>';

  if(spendCats.length) {
    html += '<div style="margin-bottom:18px"><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">📊 Spend by category</div>';
    spendCats.slice(0,6).forEach(function(c){
      var pctVal = Math.round(spendByCat[c]/maxSpend*100);
      html += '<div style="margin-bottom:8px">'
        +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:var(--muted)">'+esc(c)+'</span><span class="mono" style="color:var(--blue);font-weight:700">'+fmt(spendByCat[c])+'</span></div>'
        +'<div class="bar-track" style="background:#F1F5F9;height:6px;border-radius:3px;overflow:hidden"><div style="width:'+pctVal+'%;height:100%;background:var(--blue);border-radius:3px"></div></div>'
        +'</div>';
    });
    html += '</div>';
  }

  var recent = jobs.slice().sort(function(a,b){
    var ad = new Date(a.date||0), bd = new Date(b.date||0);
    return bd - ad;
  }).slice(0, 8);
  html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">Recent jobs</div>';
  if(!recent.length) {
    html += '<div style="background:var(--bg);border:1px dashed var(--border);border-radius:10px;padding:24px;text-align:center;font-size:12px;color:var(--muted)">No maintenance history for this property yet.</div>';
  } else {
    recent.forEach(function(m){
      var statusCol = m.status==='resolved'?'var(--green)':m.status==='in_progress'?'var(--amber)':'var(--red)';
      html += '<div onclick="state.propDetailTab=null;closeModal();setTimeout(function(){goto(\'maintenance\');state.filters.maintQ=\''+(m.issue||'').replace(/'/g,'').slice(0,30)+'\';render();},80)" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg);border:1px solid var(--border);border-left:3px solid '+statusCol+';border-radius:8px;margin-bottom:5px;cursor:pointer">'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:12px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(m.issue||'')+'</div>'
          +'<div style="font-size:10px;color:var(--muted)">'+m.date+(m.cat?' · '+esc(m.cat):'')+(m.contractor?' · 👷 '+esc(m.contractor):'')+'</div>'
        +'</div>'
        +'<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:'+statusCol+'15;color:'+statusCol+';white-space:nowrap">'+(m.status||'open').replace('_',' ')+'</span>'
      +'</div>';
    });
  }
  html += '<div style="margin-top:14px;text-align:center"><button onclick="state.propDetailTab=null;closeModal();setTimeout(function(){goto(\'maintenance\');state.filters.maintProp=\''+(p.name||'').replace(/'/g,'')+'\';render();},80)" style="padding:8px 16px;border-radius:8px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">View all maintenance for this property →</button></div>';
  return html;
}

// ── pdSetStrEnabled — toggles Airbnb/SA styling in property detail ──────────
function pdSetStrEnabled(checked) {
  var lbl = document.getElementById('pd-str-enabled');
  if(!lbl) return;
  var wrap = lbl.parentElement;
  if(wrap) {
    wrap.style.borderColor = checked ? '#FF5A5F' : 'var(--border)';
    wrap.style.background  = checked ? 'rgba(255,90,95,.06)' : 'var(--bg)';
    var title = wrap.querySelector('div > div');
    if(title) title.style.color = checked ? '#E04E53' : 'var(--text)';
  }
}

// ── saveEmailConfig — persists email config to localStorage ─────────────────
function saveEmailConfig(cfg){localStorage.setItem('pm_email_config',JSON.stringify(cfg));}

// ── applyBranding — applies org branding to sidebar, tab title, favicon ─────
function applyBranding() {
  var cfg = (state && state.config) || {};
  if(cfg.siteTitle) document.title = cfg.siteTitle;
  var sbName = document.querySelector('.sb-name');
  if(sbName) {
    if(cfg.siteTitle) sbName.textContent = cfg.siteTitle;
    else if(cfg.portfolioName) sbName.textContent = cfg.portfolioName;
    else sbName.innerHTML = 'landlordapp<span style="color:var(--accent);font-weight:400">.io</span>';
  }
  var sbSub = document.getElementById('sb-sub-txt');
  if(sbSub) sbSub.textContent = cfg.portfolioName || 'Property Management';
  var sbIcon = document.querySelector('.sb-icon');
  if(sbIcon) {
    if(cfg.logoUrl) {
      sbIcon.innerHTML = '<img src="'+cfg.logoUrl+'" style="width:100%;height:100%;border-radius:inherit;object-fit:cover" alt="Logo">';
      sbIcon.style.padding = '0';
      sbIcon.style.background = 'transparent';
    } else {
      sbIcon.innerHTML = '<img src="/favicon.svg" alt="" style="width:26px;height:26px;display:block" onerror="this.parentElement.textContent=\'🏠\'">';
      sbIcon.style.padding = '';
      sbIcon.style.background = '';
    }
  }
  if(cfg.logoUrl) {
    var link = document.querySelector("link[rel~='icon']");
    if(!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = cfg.logoUrl;
  }
}
