// ── TENANTS ───────────────────────────────────────────────────────────────────
/** Escape tenant id for use inside onchange="quickSetDueDay('…',…)" (JSON.stringify adds " which breaks the HTML attribute). */
function tenantIdForQuickDueAttr(id) {
  return String(id == null ? '' : id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function shareOnboardingLink() {
  if (!_currentOrgId) { showToast('No organisation loaded', 'error'); return; }
  var baseUrl = window.location.origin;
  var link = baseUrl + '/onboard.html?org=' + _currentOrgId;

  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:440px">'
    + '<div class="modal-header"><span class="modal-title">&#x1F517; Tenant Onboarding Link</span><button class="modal-close" onclick="closeModal()">&#x00D7;</button></div>'
    + '<div class="modal-body">'
    + '<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Share this link with prospective tenants. They can register with their details, upload ID and a selfie.</p>'
    + '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:14px;word-break:break-all;font-size:12px;font-family:\'DM Mono\',monospace;color:var(--text)">' + link + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + '<button onclick="navigator.clipboard.writeText(\'' + link + '\');showToast(\'Link copied!\',\'success\')" class="btn btn-primary" style="width:100%;justify-content:center">&#x1F4CB; Copy Link</button>'
    + '<a href="https://wa.me/?text=' + encodeURIComponent(_waSanitize('Register as a tenant here: ' + link)) + '" target="_blank" class="btn btn-secondary" style="width:100%;justify-content:center;text-decoration:none">&#x1F4AC; Share via WhatsApp</a>'
    + '<a href="mailto:?subject=Tenant Registration&body=' + encodeURIComponent('Please register using this link: ' + link) + '" class="btn btn-secondary" style="width:100%;justify-content:center;text-decoration:none">&#x2709; Share via Email</a>'
    + '<a href="' + link + '" target="_blank" class="btn btn-secondary" style="width:100%;justify-content:center;text-decoration:none">&#x1F440; Preview Form</a>'
    + '</div>'
    + '</div>'
    + '<div class="modal-footer"><button onclick="closeModal()" class="btn btn-secondary">Close</button></div>'
    + '</div></div>';
}

function renderTenants() {
  // Match post–loadState room/tenant sync so KPIs stay correct after adds/edits without a full refresh.
  if (typeof syncPropertyRoomsFromTenants === 'function') syncPropertyRoomsFromTenants();
  // Sub-tab: 'individuals' (default) or 'business'. Business view swaps the body
  // for the clients listing; everything above (header, hero, etc.) stays.
  var tenantView = state.filters.tenantView || 'individuals';
  var businessClientsCount = (state.clients||[]).filter(function(c){ return (c.type||'business')==='business'; }).length;
  const f = state.filters.tenants||'all';
  const q = (state.filters.tenantQ||'').toLowerCase();
  const propFilter = state.filters.tenantProp||'';
  const typeFilter = state.filters.tenantType || '';
  const arrearsKpiMap = typeof getTenantsInArrearsKpiMap === 'function' ? getTenantsInArrearsKpiMap() : {};
  const arrearsKpiCount = state.tenants.filter(function (t) {
    return t.status !== 'inactive' && !!arrearsKpiMap[t.name];
  }).length;
  var portfolioOccUi = getPortfolioOccupancyUi();
  const data = state.tenants.filter(t=>{
    // Individuals tab excludes tenancies attached to a business client — those
    // surface under the Business Clients sub-tab instead, so an 8-property B2R
    // operator shows as ONE row there rather than 8 rows here.
    if (t.clientId) return false;
    const ok = t.name.toLowerCase().includes(q)||t.property.toLowerCase().includes(q);
    if(propFilter && t.property !== propFilter) return false;
    if(typeFilter && (t.roomType||'Single') !== typeFilter) return false;
    if(f==='active')   return ok&&t.status==='active';
    if(f==='pending')  return ok&&t.status==='pending_review';
    if(f==='notice')   return ok&&t.status==='notice_given';
    if(f==='arrears')  return ok&&!!arrearsKpiMap[t.name]&&t.status!=='inactive';
    if(f==='archived') return ok&&t.status==='inactive';
    return ok&&t.status!=='inactive'&&t.status!=='pending_review';
  });

  // ── New v2 header + hero + arrears alert + stat row + room-type list ──
  var activeCount   = state.tenants.filter(t=>t.status==='active'&&tenantOnLiveProperty(t)).length;
  var noticeCount   = state.tenants.filter(t=>t.status==='notice_given').length;
  var archivedCount = state.tenants.filter(t=>t.status==='inactive').length;
  var pendingCount  = state.tenants.filter(t=>t.status==='pending_review').length;
  var rentActive    = state.tenants.filter(function(t){return(t.status==='active'||t.status==='notice_given')&&tenantOnLiveProperty(t);});
  var rentWk        = rentActive.filter(function(t){return t.freq==='weekly';}).reduce(function(s,t){return s+t.rent;},0);
  var rentMo        = rentActive.filter(function(t){return t.freq==='monthly';}).reduce(function(s,t){return s+t.rent;},0);
  var rentRoll      = Math.round(rentWk*52/12 + rentMo);

  var html = '';
  // Header
  var actions = [
    '<button onclick="shareOnboardingLink()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--teal-500);background:#ECFDF5;font-size:12px;font-weight:700;color:#047857;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px" title="Share tenant onboarding / registration link">📝 Onboard</button>',
    '<button onclick="openDataModal(\'tenants\')" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit" title="Import / Export">⇅</button>',
    '<button onclick="openModal(\'addTenant\')" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Add</button>'
  ];
  html += renderScreenHeader({
    title: 'Tenants',
    subtitle: activeCount + ' tenants · ' + portfolioOccUi.displayPct + '% occupancy',
    rightActions: actions
  });

  // Hero — Monthly Rent Roll
  html += renderHeroCard({
    icon: '💷',
    label: 'Monthly Rent Roll',
    value: '<span style="color:#fff">£' + rentRoll.toLocaleString() + '</span>',
    subtitle: rentActive.length + ' tenants · paid weekly + monthly'
  });

  // Arrears alert (only if any)
  if (arrearsKpiCount > 0) {
    html += renderAlertCard({
      severity: 'danger',
      icon: '⚠',
      title: arrearsKpiCount + ' tenant' + (arrearsKpiCount===1?'':'s') + ' in arrears',
      subtitle: 'Tap to filter and chase',
      onClick: 'state.filters.tenants=\'arrears\';render()'
    });
  }

  // Stat row — Active · On Notice · Archived
  html += renderStatRow([
    { label:'Active',    value: activeCount,   color:'teal' },
    { label:'On Notice', value: noticeCount,   color: noticeCount?'amber':'default' },
    { label:'Archived',  value: archivedCount, color:'default' }
  ]);

  // ── Sub-tab strip: Individuals / Business Clients / Communications ──
  // Communications used to be its own top-level page; consolidated here so the
  // main nav stays focused on financial / operational pages.
  html += '<div style="display:flex;gap:0;border-bottom:1px solid var(--gray-200);margin-bottom:14px">'
    +    '<button onclick="state.filters.tenantView=\'individuals\';render()" style="padding:10px 18px;background:transparent;border:none;border-bottom:2px solid '+(tenantView==='individuals'?'var(--accent)':'transparent')+';font-size:13px;font-weight:'+(tenantView==='individuals'?700:500)+';color:'+(tenantView==='individuals'?'var(--accent-dark, var(--accent))':'var(--gray-500)')+';cursor:pointer;font-family:inherit">👤 Individuals</button>'
    +    '<button onclick="state.filters.tenantView=\'business\';render()" style="padding:10px 18px;background:transparent;border:none;border-bottom:2px solid '+(tenantView==='business'?'var(--accent)':'transparent')+';font-size:13px;font-weight:'+(tenantView==='business'?700:500)+';color:'+(tenantView==='business'?'var(--accent-dark, var(--accent))':'var(--gray-500)')+';cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px">🏢 Business Clients'+(businessClientsCount?'<span style="font-size:10px;font-weight:700;background:var(--gray-100);color:var(--gray-700);padding:1px 7px;border-radius:999px">'+businessClientsCount+'</span>':'')+'</button>'
    +    '<button onclick="state.filters.tenantView=\'communications\';render()" style="padding:10px 18px;background:transparent;border:none;border-bottom:2px solid '+(tenantView==='communications'?'var(--accent)':'transparent')+';font-size:13px;font-weight:'+(tenantView==='communications'?700:500)+';color:'+(tenantView==='communications'?'var(--accent-dark, var(--accent))':'var(--gray-500)')+';cursor:pointer;font-family:inherit">💬 Communications</button>'
    +  '</div>';

  // Communications view: short-circuit and render the comm hub body.
  // Sub-tabs (Templates / History) live inside _renderCommBody.
  if (tenantView === 'communications' && typeof _renderCommBody === 'function') {
    html += _renderCommBody();
    return html;
  }

  // Business Clients view: short-circuit and render the clients list / detail entrypoint.
  if (tenantView === 'business' && typeof renderBusinessClientsList === 'function') {
    html += renderBusinessClientsList();
    html += renderFAB({icon:'+', label:'Add tenant', onClick:"openModal('addTenant')"});
    return html;
  }

  // Room-type breakdown — stacked progress bars (replaces 5-card grid)
  html += (function(){
      // Room type occupancy — count occupied vs total per type across all properties
      var TYPES = [
        {key:'Single',      icon:'🛏️',  color:'var(--blue)',   bg:'var(--blue-light)'},
        {key:'Double',      icon:'🛏️🛏️', color:'#7C3AED',      bg:'#F5F3FF'},
        {key:'Suite',       icon:'✨',   color:'var(--amber)',  bg:'var(--amber-light)'},
        {key:'Studio',      icon:'🏠',   color:'#0891B2',      bg:'#ECFEFF'},
        {key:'Whole House', icon:'🏡',   color:'var(--green)',  bg:'var(--green-light)'}
      ];
      var typeStats = {};
      TYPES.forEach(function(t){ typeStats[t.key] = {occ:0, total:0}; });
      state.properties.forEach(function(p){
        if(!isPropertyActive(p)) return;
        (p.roomList||[]).forEach(function(r){
          var tenant = state.tenants.find(function(t){
            return t.property===p.name && t.status!=='inactive' && roomNumsEqual(t.room, r.n);
          });
          var key = normalizeTenantRoomTypeKey(tenant && tenant.roomType ? tenant.roomType : r.type);
          if(!typeStats[key]) typeStats[key] = {occ:0, total:0};
          typeStats[key].total++;
          var isOcc = !!(tenant && tenant.status!=='inactive') || (r.status==='occupied');
          if(isOcc) typeStats[key].occ++;
        });
      });
      // Properties with no roomList (legacy / not yet synced): must still count toward totals even when
      // another property already has a roomList — otherwise KPIs show only the newest property until refresh.
      state.properties.forEach(function(p){
        if(!isPropertyActive(p)) return;
        if ((p.roomList||[]).length) return;
        var propTenants = state.tenants.filter(function(t){
          return t.property === p.name && t.status !== 'inactive';
        });
        var maxRn = propTenants.reduce(function(m, t) {
          return Math.max(m, Number(t.room) || 0);
        }, 0);
        var n = Math.max(p.rooms || 0, propTenants.length, maxRn);
        if (n === 0 && propTenants.length === 0) return;
        if (n === 0) n = propTenants.length;
        propTenants.forEach(function(t){
          var k = normalizeTenantRoomTypeKey(t.roomType);
          if (!typeStats[k]) typeStats[k] = { occ: 0, total: 0 };
          typeStats[k].occ++;
          typeStats[k].total++;
        });
        var vacant = Math.max(0, n - propTenants.length);
        if (vacant > 0) {
          typeStats['Single'].total += vacant;
        }
      });
      // Stacked horizontal bars per type — sorted by % occupancy descending, hide types with zero rooms.
      var curTypeFilter = state.filters.tenantType||'';
      var rows = TYPES.map(function(t){
        var s = typeStats[t.key] || {occ:0,total:0};
        return { t:t, s:s, pct: s.total ? Math.round(s.occ/s.total*100) : 0 };
      }).filter(function(r){ return r.s.total > 0; })
        .sort(function(a,b){ return b.pct - a.pct; });
      if (!rows.length) return '';
      var totalOccAll = rows.reduce(function(s,r){return s+r.s.occ;},0);
      var totalAll    = rows.reduce(function(s,r){return s+r.s.total;},0);
      var out = '<div class="bar-list">'
        +  '<div class="bar-list__head"><h3 class="bar-list__title">Occupancy by room type</h3>'
        +    '<span class="bar-list__total">' + totalOccAll + '/' + totalAll + '</span></div>';
      rows.forEach(function(r){
        var t = r.t, s = r.s, pct = r.pct;
        var isActive = curTypeFilter===t.key;
        out += '<div class="bar-row" onclick="state.filters.tenantType=(state.filters.tenantType===\''+t.key+'\' ? \'\':\''+t.key+'\');render()"'
          +     (isActive ? ' style="background:var(--gray-50)"' : '')
          +   '>'
          +   '<span class="bar-row__icon">'+t.icon+'</span>'
          +   '<div class="bar-row__body">'
          +     '<div class="bar-row__top">'
          +       '<span class="bar-row__label">'+t.key+'</span>'
          +       '<span class="bar-row__value">'+s.occ+'/'+s.total+' · '+pct+'%</span>'
          +     '</div>'
          +     '<div class="bar-row__track"><div class="bar-row__fill" style="background:'+t.color+';width:'+pct+'%"></div></div>'
          +   '</div>'
          + '</div>';
      });
      out += '</div>';
      return out;
    })();

  // Search + property dropdown
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">'
    +  '<div style="flex:1;position:relative;min-width:160px">'
    +    '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--gray-500)">🔍</span>'
    +    '<input class="inp" id="t-search-input" placeholder="Search tenants…" value="'+(state.filters.tenantQ||'')+'" oninput="state.filters.tenantQ=this.value;debouncedTenantSearch()" style="width:100%;padding-left:30px;border-radius:var(--radius-md);background:#fff;border:1px solid var(--gray-200);font-size:13px;height:38px">'
    +  '</div>'
    +  '<select onchange="state.filters.tenantProp=this.value;render()" style="padding:0 12px;border-radius:var(--radius-md);border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:13px;font-weight:600;color:var(--gray-700);cursor:pointer;height:38px;max-width:160px">'
    +    '<option value="">All Properties</option>'
    +    state.properties.filter(isPropertyActive).map(function(p){return '<option value="'+esc(p.name)+'" '+((state.filters.tenantProp||'')===p.name?'selected':'')+'>'+esc(p.name)+'</option>';}).join('')
    +  '</select>'
    + '</div>';

  // Filter tabs with counts
  html += renderTabs({
    tabs: [
      {id:'all',     label:'All'},
      {id:'active',  label:'Active', count: activeCount || null},
      {id:'arrears', label:'Arrears', count: arrearsKpiCount || null},
      {id:'notice',  label:'Notice',  count: noticeCount || null},
      {id:'pending', label:'Pending', count: pendingCount || null},
      {id:'archived',label:'Archived'}
    ],
    activeId: f,
    onChangeTpl: 'state.filters.tenants=\'%ID%\';render()'
  });
  // Begin tenant-grid as a template literal (preserves the existing complex card markup verbatim).
  html += `
    <div class="tenant-grid">
      ${data.map(t=>{
        const inArrearsKpi = !!arrearsKpiMap[t.name];
        // _waSanitize strips any 4-byte chars from tenant names (rare but possible
        // if a tenant's name was pasted in with an emoji).
        const rentMsg = encodeURIComponent(_waSanitize(`Hi ${t.name.split(' ')[0]}, this is a reminder that your rent of £${t.rent}/${t.freq} is due. Please arrange payment at your earliest convenience. Thank you.`));
        const arrMsg = t.arrears>0
          ? encodeURIComponent(_waSanitize(`Hi ${t.name.split(' ')[0]}, you have outstanding rent arrears of £${t.arrears}. Please contact us urgently to arrange payment. Thank you.`))
          : encodeURIComponent(_waSanitize(`Hi ${t.name.split(' ')[0]}, our records show your rent is overdue. Please arrange payment as soon as possible. Thank you.`));
        return `<div class="tenant-card${inArrearsKpi?' arrears':''}" onclick="openTenantDetail('${t.id}')" style="cursor:pointer">
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
            <div class="t-avatar">${t.name[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;margin-bottom:3px">${esc(t.name)}</div>
              <div style="font-size:12px;color:var(--muted)">${esc(t.property)}</div>
              <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px">
                ${(function(){var p=state.properties.find(function(x){return x.name===t.property;});var r=p&&p.roomList?p.roomList.find(function(x){return x.n===t.room;}):null;var type=r?r.type:'Single';var icons={'Single':'🛏️','Double':'🛏️🛏️','Suite':'✨','Studio':'🏠','Whole House':'🏡'};return '<span>'+( icons[type]||'🛏️')+'</span><span>Room '+t.room+' · '+(type||'Single')+'</span>';})()}
              </div>
            </div>
            ${t.status==='pending_review'?'<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--amber-light);color:var(--amber)">&#x23F3; Pending</span>':badge(t.status==='notice_given'?'notice_given':t.status)}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
            <div class="metric-box"><div class="metric-label">Rent</div><div class="metric-val" style="color:var(--green)">${fmt(t.rent)}<span style="font-size:10px;color:var(--muted);font-weight:400;font-family:Inter,sans-serif">/${t.freq==='weekly'?'wk':'mo'}</span></div></div>
            <div class="metric-box"><div class="metric-label">Last Paid</div><div style="font-size:12px;font-weight:600;color:var(--text);margin-top:3px">${t.paid||'—'}</div></div>
          </div>
          ${(function(){
            if(t.status !== 'notice_given' || !t.moveOutDate) return '';
            var _mo = new Date(t.moveOutDate);
            if(isNaN(_mo.getTime())) return '';
            var _today = new Date(); _today.setHours(0,0,0,0);
            var _daysLeft = Math.ceil((_mo - _today) / 86400000);
            var _col = _daysLeft < 0 ? 'var(--red)' : _daysLeft <= 7 ? 'var(--red)' : _daysLeft <= 30 ? 'var(--amber)' : 'var(--blue)';
            var _bg  = _daysLeft < 0 ? '#FEE2E2' : _daysLeft <= 7 ? '#FEE2E2' : _daysLeft <= 30 ? '#FEF3C7' : '#DBEAFE';
            var _txt = _daysLeft < 0 ? Math.abs(_daysLeft)+'d overdue' : _daysLeft === 0 ? 'Today' : _daysLeft+'d left';
            var _dt  = _mo.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
            return '<div style="background:'+_bg+';border:1px solid '+_col+'33;border-radius:8px;padding:8px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">'
              +'<span style="font-size:12px;font-weight:600;color:'+_col+'">&#x1F4C5; Move-out '+_dt+'</span>'
              +'<span class="mono" style="font-size:11px;font-weight:700;color:'+_col+'">'+_txt+'</span>'
              +'</div>';
          })()}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px" onclick="event.stopPropagation()">
            <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;flex-shrink:0">Due</span>
            ${(function(){
              var tidQ = tenantIdForQuickDueAttr(t.id);
              if(t.freq==='monthly'){
                var opts=['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th','15th','16th','17th','18th','19th','20th','21st','22nd','23rd','24th','25th','26th','27th','28th'];
                var dom = +t.payDayOfMonth || 0;
                return '<select onclick="event.stopPropagation()" onchange="quickSetDueDay(\''+tidQ+'\',this.value,\'monthly\')" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;flex:1">'+opts.map(function(o,i){return '<option value="'+(i+1)+'" '+(dom===(i+1)?'selected':'')+'>'+o+' of month</option>';}).join('')+'</select>';
              } else {
                var days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                return '<select onclick="event.stopPropagation()" onchange="quickSetDueDay(\''+tidQ+'\',this.value,\'weekly\')" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;flex:1">'+days.map(function(d){return '<option value="'+d+'" '+(t.payDay===d?'selected':'')+'>'+d+'</option>';}).join('')+'</select>';
              }
            })()}
          </div>

          ${(function(){
            if(!inArrearsKpi) return '';
            var _liveArr = (+arrearsKpiMap[t.name]||0) || (+t.arrears||0);
            return '<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:8px;padding:8px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">'
              +'<span style="font-size:12px;font-weight:600;color:var(--red)">'+(_liveArr>0?'Arrears':'Rent overdue')+'</span>'
              +'<span class="mono" style="font-size:13px;font-weight:700;color:var(--red)">'+(_liveArr>0?fmt(_liveArr):'—')+'</span>'
              +'</div>';
          })()}

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px" onclick="event.stopPropagation()">
            ${badge(t.method==='bank'?'bank':'cash')}
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${t.whatsapp
                ? (inArrearsKpi
                    ? `<a href="https://wa.me/${String(t.whatsapp||'').replace(/\D/g,'')}?text=${arrMsg}" target="_blank" class="wa-btn" style="background:#FEF0F3;color:var(--red);border-color:#FECDD3">💬 Chase</a>`
                    : `<a href="https://wa.me/${String(t.whatsapp||'').replace(/\D/g,'')}?text=${rentMsg}" target="_blank" class="wa-btn">💬 Message</a>`)
                : ''}
              ${t.email
                ? `<button onclick="event.stopPropagation();sendRentChaseEmail('${t.id}')" style="padding:5px 10px;border-radius:7px;border:1px solid var(--blue);background:var(--blue-light);color:var(--blue);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">&#x2709; Email</button>`
                : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  html += renderFAB({icon:'+', label:'Add tenant', onClick:"openModal('addTenant')"});
  return html;
}
