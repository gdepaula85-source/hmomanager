// ── GLOBAL SEARCH ─────────────────────────────────────────────────────────────
var _gsIdx = -1;

function gsSearch(q) {
  var box = document.getElementById('gs-results');
  q = (q||'').trim().toLowerCase();
  if(q.length < 2) { box.style.display='none'; return; }

  var results = [];

  // Tenants
  state.tenants.forEach(function(t) {
    if(t.status==='inactive') return;
    var score = 0;
    if(t.name.toLowerCase().includes(q)) score=3;
    else if((t.property||'').toLowerCase().includes(q)) score=2;
    else if(String(t.whatsapp||'').includes(q)) score=2;
    else if(String(t.room||'').includes(q) && (t.name.toLowerCase().includes(q.split(' ')[0]))) score=1;
    if(score) results.push({
      type:'tenant', score:score+10, icon:'👤', bg:'#EFF6FF', label:t.name,
      sub:(t.status==='inactive'
        ? (t.previousTenancies&&t.previousTenancies.length ? 'Last: '+t.previousTenancies[t.previousTenancies.length-1].property : t.property||'Former tenant')+' · Moved out'
        : (t.property||'')+(t.room?' · Room '+t.room:'')+(t.arrears>0?' · ⚠️ £'+t.arrears+' arrears':'')),
      action:function(){ openTenantDetail(t.id); }
    });
  });

  // Properties
  state.properties.forEach(function(p) {
    if(!p.name.toLowerCase().includes(q) && !(p.address||'').toLowerCase().includes(q) && !(p.area||'').toLowerCase().includes(q)) return;
    results.push({
      type:'property', score:8, icon:'🏠', bg:'#F0FDF4', label:p.name,
      sub:(p.address||p.area||'')+(p.rooms?' · '+p.rooms+' rooms':''),
      action:function(){ openPropDetail(p.id); }
    });
  });

  // Maintenance
  state.maintenance.forEach(function(m) {
    if(m.status==='resolved') return;
    if(!(m.issue||'').toLowerCase().includes(q) && !(m.property||'').toLowerCase().includes(q) && !(m.tenant||'').toLowerCase().includes(q)) return;
    results.push({
      type:'maintenance', score:6, icon:'🔧', bg:'#FFF7ED', label:m.issue,
      sub:m.property+(m.room?' Rm '+m.room:'')+(m.priority==='urgent'?' · 🚨 URGENT':''),
      action:function(){ state.page='maintenance'; render(); }
    });
  });

  // Payments (overdue/outstanding only)
  state.payments.forEach(function(p) {
    if(p.status==='paid') return;
    if(!(p.tenant||p.tenantName||'').toLowerCase().includes(q)) return;
    results.push({
      type:'payment', score:5, icon:'💷', bg:'#FEF2F2', label:(p.tenant||p.tenantName||''),
      sub:'Outstanding £'+(p.amount||0)+' · Due '+new Date(p._dueDateRaw||Date.now()).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}),
      action:function(){ state.page='rent'; render(); }
    });
  });

  // Sort by score desc, then alphabetically
  results.sort(function(a,b){ return b.score-a.score || (a.label||'').localeCompare(b.label||''); });
  results = results.slice(0,10);

  if(!results.length) {
    box.innerHTML = '<div style="padding:16px;text-align:center;font-size:13px;color:var(--muted)">No results for "'+q.replace(/</g,'&lt;')+'"</div>';
    box.style.display='block'; _gsIdx=-1; return;
  }

  // Group by type
  var sections = {tenant:'Tenants',property:'Properties',maintenance:'Maintenance',payment:'Payments'};
  var grouped = {};
  results.forEach(function(r){ if(!grouped[r.type]) grouped[r.type]=[]; grouped[r.type].push(r); });

  var html = '';
  Object.keys(sections).forEach(function(type) {
    if(!grouped[type]) return;
    html += '<div class="gs-section">'+sections[type]+'</div>';
    grouped[type].forEach(function(r, i) {
      var idx = results.indexOf(r);
      html += '<div class="gs-item" data-gsidx="'+idx+'" onmousedown="gsGo('+idx+')">'
        +'<div class="gs-icon" style="background:'+r.bg+'">'+r.icon+'</div>'
        +'<div><div class="gs-label">'+r.label+'</div><div class="gs-sub">'+r.sub+'</div></div>'
        +'</div>';
    });
  });

  box.innerHTML = html;
  box.style.display = 'block';
  _gsIdx = -1;
  window._gsResults = results;
}

function gsKey(e) {
  var box = document.getElementById('gs-results');
  if(box.style.display==='none') return;
  var items = box.querySelectorAll('.gs-item');
  if(!items.length) return;
  if(e.key==='ArrowDown') {
    e.preventDefault();
    _gsIdx = Math.min(_gsIdx+1, items.length-1);
  } else if(e.key==='ArrowUp') {
    e.preventDefault();
    _gsIdx = Math.max(_gsIdx-1, 0);
  } else if(e.key==='Enter') {
    e.preventDefault();
    if(_gsIdx>=0) gsGo(_gsIdx);
    else if(items.length===1) gsGo(0);
    return;
  } else if(e.key==='Escape') {
    box.style.display='none'; return;
  } else return;
  items.forEach(function(el,i){ el.classList.toggle('gs-active', i===_gsIdx); });
}

function gsGo(idx) {
  var r = window._gsResults && window._gsResults[idx];
  if(!r) return;
  document.getElementById('gs-input').value = '';
  document.getElementById('gs-results').style.display = 'none';
  r.action();
}
