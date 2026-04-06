// ── TENANTS ───────────────────────────────────────────────────────────────────
function renderTenants() {
  // Match post–loadState room/tenant sync so KPIs stay correct after adds/edits without a full refresh.
  if (typeof syncPropertyRoomsFromTenants === 'function') syncPropertyRoomsFromTenants();
  const f = state.filters.tenants||'all';
  const q = (state.filters.tenantQ||'').toLowerCase();
  const propFilter = state.filters.tenantProp||'';
  const typeFilter = state.filters.tenantType || '';
  const data = state.tenants.filter(t=>{
    const ok = t.name.toLowerCase().includes(q)||t.property.toLowerCase().includes(q);
    if(propFilter && t.property !== propFilter) return false;
    if(typeFilter && (t.roomType||'Single') !== typeFilter) return false;
    if(f==='active')   return ok&&t.status==='active';
    if(f==='notice')   return ok&&t.status==='notice_given';
    if(f==='arrears')  return ok&&t.arrears>0&&t.status!=='inactive';
    if(f==='archived') return ok&&t.status==='inactive';
    return ok&&t.status!=='inactive';
  });

  return `
    <div class="page-header">
      <div><div class="page-title">Tenants</div><div class="page-sub">${state.tenants.filter(t=>t.status==='active'&&tenantOnLiveProperty(t)).length} active · ${state.tenants.filter(t=>t.arrears>0).length} in arrears</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="openDataModal('tenants')" style="padding:8px 10px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit" title="Import / Export Tenants">⇅</button>
        ${btn('+ Add Tenant',"openModal('addTenant')")}
      </div>
    </div>
    <!-- Tenant KPIs -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Active Tenants</div>
            <div style="font-size:24px;font-weight:800;color:var(--green);font-family:monospace">${state.tenants.filter(t=>t.status==='active'&&tenantOnLiveProperty(t)).length}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:800;color:var(--muted);font-family:monospace">${(()=>{const r=state.properties.filter(isPropertyActive).reduce((s,p)=>s+p.rooms,0);const a=state.tenants.filter(t=>t.status==='active'&&tenantOnLiveProperty(t)).length;return r?Math.round(a/r*100):0;})()}%</div>
            <div style="font-size:10px;color:var(--muted)">occupancy</div>
          </div>
        </div>
        <div style="background:var(--border);border-radius:3px;height:4px;margin-top:8px;overflow:hidden">
          <div style="height:100%;border-radius:3px;background:${(()=>{const r=state.properties.filter(isPropertyActive).reduce((s,p)=>s+p.rooms,0);const a=state.tenants.filter(t=>t.status==='active'&&tenantOnLiveProperty(t)).length;const pct=r?Math.round(a/r*100):0;return pct>=90?'#10B981':pct>=70?'#F59E0B':'#EF4444';})()};width:${(()=>{const r=state.properties.filter(isPropertyActive).reduce((s,p)=>s+p.rooms,0);const a=state.tenants.filter(t=>t.status==='active'&&tenantOnLiveProperty(t)).length;return r?Math.round(a/r*100):0;})()}%"></div>
        </div>
      </div>
      ${(function(){
        var act=state.tenants.filter(function(t){return(t.status==='active'||t.status==='notice_given')&&tenantOnLiveProperty(t);});
        var wk=act.filter(function(t){return t.freq==='weekly';}).reduce(function(s,t){return s+t.rent;},0);
        var mo=act.filter(function(t){return t.freq==='monthly';}).reduce(function(s,t){return s+t.rent;},0);
        var total=Math.round(wk*52/12+mo);
        return '<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:12px;padding:12px">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-end">'
          +'<div><div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:4px" title="Calculated as: (weekly tenants × rent × 52 ÷ 12) + (monthly tenants × rent). Full-portfolio figure, not filtered.">Monthly Rent Roll ℹ</div>'
          +'<div style="font-size:24px;font-weight:800;color:var(--green);font-family:monospace">£'+total.toLocaleString()+'</div></div>'
          +'<div style="text-align:right"><div style="font-size:12px;color:var(--green);font-weight:600">'+act.length+' tenants</div>'
          +'<div style="font-size:10px;color:var(--green)">wk × 52÷12 + monthly</div></div></div></div>';
      })()}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:${state.tenants.filter(t=>t.arrears>0&&t.status!=='inactive').length?'10px':'14px'}">
      <div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--green)">${state.tenants.filter(t=>t.status==='active'&&tenantOnLiveProperty(t)).length}</div>
        <div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;margin-top:2px">Active</div>
      </div>
      <div style="background:${state.tenants.filter(t=>t.status==='notice_given').length?'var(--amber-light)':'var(--bg)'};border:1px solid ${state.tenants.filter(t=>t.status==='notice_given').length?'#FDE68A':'var(--border)'};border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:${state.tenants.filter(t=>t.status==='notice_given').length?'var(--amber)':'var(--dim)'}">${state.tenants.filter(t=>t.status==='notice_given').length}</div>
        <div style="font-size:10px;font-weight:700;color:${state.tenants.filter(t=>t.status==='notice_given').length?'var(--amber)':'var(--dim)'};text-transform:uppercase;margin-top:2px">On Notice</div>
      </div>
      <div style="background:${state.tenants.filter(t=>t.arrears>0&&t.status!=='inactive').length?'var(--red-light)':'var(--bg)'};border:1px solid ${state.tenants.filter(t=>t.arrears>0&&t.status!=='inactive').length?'#FECDD3':'var(--border)'};border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:${state.tenants.filter(t=>t.arrears>0&&t.status!=='inactive').length?'var(--red)':'var(--dim)'}">${state.tenants.filter(t=>t.arrears>0&&t.status!=='inactive').length}</div>
        <div style="font-size:10px;font-weight:700;color:${state.tenants.filter(t=>t.arrears>0&&t.status!=='inactive').length?'var(--red)':'var(--dim)'};text-transform:uppercase;margin-top:2px">In Arrears</div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--muted)">${state.tenants.filter(t=>t.status==='inactive').length}</div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-top:2px">Archived</div>
      </div>
    </div>

    <!-- Row 2 KPIs: rent roll, avg rate, longest overdue -->
    ${(function(){
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
      // Show ALL 5 types always so the row is always full
      var active = TYPES;
      var curTypeFilter = state.filters.tenantType||'';
      var html = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">';
      active.forEach(function(t){
        var s = typeStats[t.key];
        var pct = s.total ? Math.round(s.occ/s.total*100) : 0;
        var vacant = s.total - s.occ;
        var isActive = curTypeFilter===t.key;
        html += '<div onclick="state.filters.tenantType=(state.filters.tenantType===\''+t.key+'\' ? \'\':\''+t.key+'\'\');render()" style="background:'+(isActive?t.bg.replace('light','').trim()||t.bg:t.bg)+';border:'+(isActive?'2px solid '+t.color:'1px solid var(--border)')+';border-radius:11px;padding:10px 8px;text-align:center;cursor:pointer;transition:all .15s">';
        html += '<div style="font-size:16px;margin-bottom:2px">'+t.icon+'</div>';
        html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:3px;white-space:nowrap">'+t.key+'</div>';
        html += '<div style="font-size:18px;font-weight:800;color:'+t.color+';font-family:monospace;line-height:1">'+s.occ+'/'+s.total+'</div>';
        html += '<div style="background:var(--border);border-radius:3px;height:3px;margin:5px 0 3px">';
        html += '<div style="background:'+t.color+';border-radius:3px;height:100%;width:'+pct+'%"></div></div>';
        html += '<div style="font-size:10px;color:var(--muted)">'+pct+'% · '+vacant+' free</div>';
        html += '</div>';
      });
      html += '</div>';
      return html;
    })()}

    <div class="filters">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <div class="search-wrap" style="flex:1;min-width:160px"><span class="search-ico">🔍</span><input class="search-inp" placeholder="Search tenants…" value="${state.filters.tenantQ||''}" oninput="state.filters.tenantQ=this.value;debouncedTenantSearch()"></div>
      <select style="padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;min-width:160px" onchange="state.filters.tenantProp=this.value;render()">
        <option value="">All Properties</option>
        ${state.properties.filter(isPropertyActive).map(p=>`<option value="${p.name}" ${(state.filters.tenantProp||'')=== p.name?'selected':''}>${p.name}</option>`).join('')}
      </select>
    </div>
      ${[{v:'all',l:'All'},{v:'active',l:'Active'},{v:'notice',l:'On Notice'},{v:'arrears',l:'In Arrears'},{v:'archived',l:'Archived'}].map(x=>`<button class="filter-btn ${f===x.v?'active':''}" onclick="state.filters.tenants='${x.v}';render()">${x.l}</button>`).join('')}
    </div>
    <div class="tenant-grid">
      ${data.map(t=>{
        const rentMsg = encodeURIComponent(`Hi ${t.name.split(' ')[0]}, this is a reminder that your rent of £${t.rent}/${t.freq} is due. Please arrange payment at your earliest convenience. Thank you.`);
        const arrMsg = t.arrears>0 ? encodeURIComponent(`Hi ${t.name.split(' ')[0]}, you have outstanding rent arrears of £${t.arrears}. Please contact us urgently to arrange payment. Thank you.`) : '';
        return `<div class="tenant-card${t.arrears>0?' arrears':''}" onclick="openTenantDetail('${t.id}')" style="cursor:pointer">
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
            <div class="t-avatar">${t.name[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;margin-bottom:3px">${t.name}</div>
              <div style="font-size:12px;color:var(--muted)">${t.property}</div>
              <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px">
                ${(function(){var p=state.properties.find(function(x){return x.name===t.property;});var r=p&&p.roomList?p.roomList.find(function(x){return x.n===t.room;}):null;var type=r?r.type:'Single';var icons={'Single':'🛏️','Double':'🛏️🛏️','Suite':'✨','Studio':'🏠','Whole House':'🏡'};return '<span>'+( icons[type]||'🛏️')+'</span><span>Room '+t.room+' · '+(type||'Single')+'</span>';})()}
              </div>
            </div>
            ${badge(t.status==='notice_given'?'notice_given':t.status)}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
            <div class="metric-box"><div class="metric-label">Rent</div><div class="metric-val" style="color:var(--green)">${fmt(t.rent)}<span style="font-size:10px;color:var(--muted);font-weight:400;font-family:Inter,sans-serif">/${t.freq==='weekly'?'wk':'mo'}</span></div></div>
            <div class="metric-box"><div class="metric-label">Last Paid</div><div style="font-size:12px;font-weight:600;color:var(--text);margin-top:3px">${t.paid||'—'}</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px" onclick="event.stopPropagation()">
            <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;flex-shrink:0">Due</span>
            ${(function(){
              if(t.freq==='monthly'){
                var opts=['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th','15th','16th','17th','18th','19th','20th','21st','22nd','23rd','24th','25th','26th','27th','28th'];
                return '<select onclick="event.stopPropagation()" onchange="quickSetDueDay('+JSON.stringify(t.id)+',this.value,\'monthly\')" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;flex:1">'+opts.map(function(o,i){return '<option value="'+(i+1)+'" '+(t.payDayOfMonth===(i+1)?'selected':'')+'>'+o+' of month</option>';}).join('')+'</select>';
              } else {
                var days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                return '<select onclick="event.stopPropagation()" onchange="quickSetDueDay('+JSON.stringify(t.id)+',this.value,\'weekly\')" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;flex:1">'+days.map(function(d){return '<option value="'+d+'" '+(t.payDay===d?'selected':'')+'>'+d+'</option>';}).join('')+'</select>';
              }
            })()}
          </div>

          ${t.arrears>0 ? `<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:8px;padding:8px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;font-weight:600;color:var(--red)">Arrears</span>
            <span class="mono" style="font-size:13px;font-weight:700;color:var(--red)">${fmt(t.arrears)}</span>
          </div>` : ''}

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px" onclick="event.stopPropagation()">
            ${badge(t.method==='bank'?'bank':'cash')}
            ${t.whatsapp
              ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${t.arrears>0
                    ? `<a href="https://wa.me/${String(t.whatsapp||'').replace(/\D/g,'')}?text=${arrMsg}" target="_blank" class="wa-btn" style="background:#FEF0F3;color:var(--red);border-color:#FECDD3">💬 Chase</a>`
                    : `<a href="https://wa.me/${String(t.whatsapp||'').replace(/\D/g,'')}?text=${rentMsg}" target="_blank" class="wa-btn">💬 Message</a>`
                  }
                </div>`
              : '<span style="font-size:11px;color:var(--dim)">No WhatsApp</span>'}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}
