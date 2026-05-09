// ── Delete helper ──────────────────────────────────────────
async function supaDelete(table, id){
  try{ await supa.from(table).delete().eq('id', id).eq('org_id', _currentOrgId); }
  catch(e){ console.warn('supaDelete failed', table, id, e); }
}
const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEKS_AHEAD = 8;
const MONTHS = (function() {
  var now = new Date();
  var result = [];
  for(var i=5; i>=0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    var y = d.getFullYear(), m = d.getMonth();
    var lastDay = new Date(y, m+1, 0).getDate();
    var MONTHS_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var key = y+'-'+(m+1<10?'0':'')+(m+1);
    result.push({
      key: key,
      label: MONTHS_ABBR[m]+' '+y,
      from: new Date(y, m, 1),
      to:   new Date(y, m, lastDay, 23, 59, 59, 999)
    });
  }
  return result;
})();
const DUE_DATES = {};

function renderNav() {
  const s = getStats();
  const badges = {rent:s.owed.length, maintenance:s.openM.filter(m=>m.priority==='urgent').length};
  const op = getPortfolioOccupancyUi().displayPct;

  const visibleNav = NAV.filter(n=>!n.hidden && (n.id==='_section'||canSee(n.id)));
  document.getElementById('sb-nav').innerHTML = visibleNav.map(n=>{
    if(n.id==='_section') return `<div class="sb-nav-section">${n.label}</div>`;
    return `<button class="nav-btn ${state.page===n.id?'active':''}" onclick="goto('${n.id}')">
      <span class="nav-inner">${n.icon} ${n.label}</span>
      ${badges[n.id]>0?`<span class="nav-badge">${badges[n.id]}</span>`:''}
    </button>`;
  }).join('');

  var occBar = document.getElementById('occ-bar');
  var occLabel = document.getElementById('occ-label');
  if(occBar) {
    occBar.style.width = op+'%';
  }
  if(occLabel) {
    var occData = getPortfolioOccupancyUi();
    occLabel.textContent = op+'% \u00B7 '+(occData.occupiedRooms||0)+' / '+(occData.totalRooms||0)+' rooms';
  }

  const alerts = [];
  if(s.owed.length>0) alerts.push(`<span class="alert-chip" style="color:var(--red);background:var(--red-light)">⚠️ ${s.owed.length} outstanding</span>`);
  if(s.openM.filter(m=>m.priority==='urgent').length>0) alerts.push(`<span class="alert-chip tb-desktop-only" style="color:var(--amber);background:var(--amber-light)">🔧 ${s.openM.filter(m=>m.priority==='urgent').length} urgent</span>`);
  const cu=state.currentUser; const cr=state.roles[cu.role];
  // Desktop: full user card with initials + role + logout
  // Mobile: just compact avatar
  alerts.push('<div style="display:flex;align-items:center;gap:6px">'
    +'<button data-refresh-btn onclick="refreshAppData()" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:4px" title="Pull latest data from Supabase"><span class="refresh-spinner-target">&#x21BB;</span><span class="tb-desktop-only">Refresh</span></button>'
    +'<div onclick="goto(\'settings\')" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:3px 8px;border-radius:9px;border:1px solid var(--border);background:var(--surface)">'
    +(state.config&&state.config.logoUrl?'<img src="'+state.config.logoUrl+'" style="width:22px;height:22px;border-radius:6px;object-fit:cover">':'')
    +'<div style="width:26px;height:26px;border-radius:8px;background:'+(cr?cr.bg:'var(--accent-light)')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:'+(cr?cr.color:'var(--accent-dark)')+'">'+cu.initials+'</div>'
    +'<div class="tb-desktop-only" style="line-height:1.2"><div style="font-size:11px;font-weight:700;color:var(--text)">'+cu.name.split(' ')[0]+'</div>'
    +'<div style="font-size:9px;font-weight:600;color:'+(cr?cr.color:'var(--muted)')+'">'+( cr?cr.icon+' '+cr.label:cu.role)+'</div></div></div>'
    +'<button class="tb-desktop-only" onclick="doLogOut()" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit" title="Log out">&rarr; Out</button>'
    +'</div>');
  document.getElementById('alerts-bar').innerHTML = alerts.join('');

  document.getElementById('mobile-nav').innerHTML = visibleNav.filter(n=>n.id!=='_section').map(n=>`
    <button class="mob-btn ${state.page===n.id?'active':''}" onclick="goto('${n.id}')">
      ${badges[n.id]>0?`<span class="mob-badge">${badges[n.id]}</span>`:''}
      <span style="font-size:20px">${n.icon}</span>
      <span>${n.label}</span>
    </button>`).join('');
}

function quickSetDueDay(tid, val, freq) {
  if (!requirePerm('canEdit', 'change due day')) return;
  var idStr = String(tid);
  var t = state.tenants.find(function(x){ return String(x.id) === idStr; });
  if(!t) { showToast('Could not find tenant', 'error'); return; }
  if(freq==='monthly') { t.payDayOfMonth = parseInt(val, 10); t.payDay = null; }
  else { t.payDay = val; t.payDayOfMonth = null; }
  rebuildTenantSchedule(idStr);
  saveState();
  showToast('Due day updated ✓', 'success');
  if (typeof render === 'function') render();
}
