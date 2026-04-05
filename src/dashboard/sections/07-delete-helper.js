// ── Delete helper ──────────────────────────────────────────
async function supaDelete(table, id){
  try{ await supa.from(table).delete().eq('id', id); }
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
      to:   new Date(y, m, lastDay)
    });
  }
  return result;
})();
const DUE_DATES = {};

function renderNav() {
  const s = getStats();
  const badges = {rent:s.owed.length, maintenance:s.openM.filter(m=>m.priority==='urgent').length};
  const rooms = state.properties.reduce((a,p)=>a+p.rooms,0);
  const occ = state.properties.reduce((a,p)=>a+p.occupied,0);
  const op = pct(occ,rooms);

  const visibleNav = NAV.filter(n=>canSee(n.id));
  document.getElementById('sb-nav').innerHTML = visibleNav.map(n=>`
    <button class="nav-btn ${state.page===n.id?'active':''}" onclick="goto('${n.id}')">
      <span class="nav-inner">${n.icon} ${n.label}</span>
      ${badges[n.id]>0?`<span class="nav-badge">${badges[n.id]}</span>`:''}
    </button>`).join('');

  var occBar = document.getElementById('occ-bar');
  var occLabel = document.getElementById('occ-label');
  if(occBar) {
    occBar.style.width = op+'%';
    occBar.style.background = op>=90?'#10B981':op>=70?'#F59E0B':'#EF4444';
  }
  if(occLabel) occLabel.textContent = op+'% occupied';

  const alerts = [];
  if(s.owed.length>0) alerts.push(`<span class="alert-chip" style="color:var(--red);background:var(--red-light)">⚠️ ${s.owed.length} outstanding</span>`);
  if(s.openM.filter(m=>m.priority==='urgent').length>0) alerts.push(`<span class="alert-chip" style="color:var(--amber);background:var(--amber-light)">🔧 ${s.openM.filter(m=>m.priority==='urgent').length} urgent</span>`);
  alerts.push(`<div style="width:32px;height:32px;border-radius:10px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--accent-dark)">G</div>`);
  const cu=state.currentUser; const cr=state.roles[cu.role];
  alerts.push('<div style="display:flex;align-items:center;gap:6px">'
    +'<div onclick="goto(\'settings\')" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 8px;border-radius:9px;border:1px solid var(--border);background:var(--surface)">'
    +(state.config&&state.config.logoUrl?'<img src="'+state.config.logoUrl+'" style="width:24px;height:24px;border-radius:6px;object-fit:cover">':'')
    +'<div style="width:28px;height:28px;border-radius:8px;background:'+(cr?cr.bg:'var(--accent-light)')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:'+(cr?cr.color:'var(--accent-dark)')+'">'+cu.initials+'</div>'
    +'<div style="line-height:1.2"><div style="font-size:11px;font-weight:700;color:var(--text)">'+cu.name.split(' ')[0]+'</div>'
    +'<div style="font-size:9px;font-weight:600;color:'+(cr?cr.color:'var(--muted)')+'">'+( cr?cr.icon+' '+cr.label:cu.role)+'</div></div></div>'
    +'<button onclick="doLogOut()" style="padding:5px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit" title="Log out">&rarr; Out</button>'
    +'</div>');
  document.getElementById('alerts-bar').innerHTML = alerts.join('');

  document.getElementById('mobile-nav').innerHTML = visibleNav.map(n=>`
    <button class="mob-btn ${state.page===n.id?'active':''}" onclick="goto('${n.id}')">
      ${badges[n.id]>0?`<span class="mob-badge">${badges[n.id]}</span>`:''}
      <span style="font-size:20px">${n.icon}</span>
      <span>${n.label}</span>
    </button>`).join('');
}

function quickSetDueDay(tid, val, freq) {
  var t = state.tenants.find(function(x){return x.id===tid;});
  if(!t) return;
  if(freq==='monthly') { t.payDayOfMonth = parseInt(val); t.payDay = null; }
  else { t.payDay = val; t.payDayOfMonth = null; }
  rebuildTenantSchedule(tid);
  saveState();
  showToast('Due day updated ✓', 'success');
}
