const SUPA_URL = window.ENV.SUPA_URL;
const SUPA_KEY = window.ENV.SUPA_KEY;
const supa = supabase.createClient(SUPA_URL, SUPA_KEY);
// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
var currentTenant = null;
var TODAY = new Date('2026-03-21');
var TENANT_PASSWORDS_KEY = 'pm_tenant_passwords';
var TENANT_MAINTENANCE_KEY = 'pm_tenant_maintenance';

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function fmt(n){ return '£' + Math.round(Number(n)||0).toLocaleString('en-GB'); }
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }

function toast(msg, duration){
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function(){ el.classList.remove('show'); }, duration||2500);
}

// loadState now fetches from Supabase (async)
async function loadTenantsFromSupabase() {
  try {
    var res = await fetch(SUPA_URL + '/rest/v1/tenants?status=neq.inactive&select=*', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    var rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(function(r) {
      return {
        id:              r.id,
        name:            r.name || '',
        property:        r.property_name || '',
        room:            r.room_number || null,
        roomType:        r.room_type || 'Single',
        rent:            parseFloat(r.rent) || 0,
        freq:            r.freq || 'weekly',
        payDay:          r.pay_day || 'Monday',
        payDayOfMonth:   r.pay_day_of_month || null,
        method:          r.method || 'bank',
        status:          r.status || 'active',
        arrears:         parseFloat(r.arrears) || 0,
        deposit:         parseFloat(r.deposit) || 0,
        depositStatus:   r.deposit_status || 'held',
        whatsapp:        r.whatsapp || '',
        email:           r.email || '',
        startDate:       r.start_date || null,
        noticeDate:      r.notice_date || null,
        moveOutDate:     r.move_out_date || null,
        notes:           r.notes || '',
        paymentHistory:  Array.isArray(r.payment_history) ? r.payment_history : [],
        portalUsername:  r.portal_username || null,
        portalPassword:  r.portal_password || null
      };
    });
  } catch(e) {
    console.warn('Could not load tenants from Supabase:', e);
    return [];
  }
}
// Keep sync fallback for parts of code that still call loadState()
function loadState(){
  var raw = localStorage.getItem('pm_tenants');
  return raw ? JSON.parse(raw) : [];
}

function saveTenants(tenants){
  localStorage.setItem('pm_tenants', JSON.stringify(tenants));
}

function loadPasswords(){
  var raw = localStorage.getItem(TENANT_PASSWORDS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function savePasswords(p){
  localStorage.setItem(TENANT_PASSWORDS_KEY, JSON.stringify(p));
}

function loadTenantMaintenance(){
  var raw = localStorage.getItem(TENANT_MAINTENANCE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveTenantMaintenance(list){
  localStorage.setItem(TENANT_MAINTENANCE_KEY, JSON.stringify(list));
}

function loadVault(){
  var raw = localStorage.getItem('pm_vault');
  return raw ? JSON.parse(raw) : {};
}

function saveVault(v){
  localStorage.setItem('pm_vault', JSON.stringify(v));
}

// Payments cache loaded from Supabase on login
var _portalPayments = [];
var _portalSched = [];

async function loadPaymentsFromSupabase() {
  if(!currentTenant) return;
  try {
    var months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    var res = await fetch(SUPA_URL+'/rest/v1/payments?or=(tenant_name.eq.'+encodeURIComponent(currentTenant.name)+',tenant_id.eq.'+encodeURIComponent(currentTenant.id)+')&select=*&order=paid_date.desc&limit=100', {
      headers: {'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY}
    });
    var rows = await res.json();
    if(!Array.isArray(rows)) return;
    _portalPayments = rows.map(function(r) {
      // Parse dueDate
      var dd = r.due_date||null;
      var ddRaw = null;
      if(dd) { var p=dd.split('T')[0].split('-'); ddRaw=new Date(+p[0],+p[1]-1,+p[2]).getTime(); }
      // Parse paidDate  
      var pd = r.paid_date||null;
      var pdRaw = null;
      if(pd) {
        var pp = String(pd).split(' ');
        if(pp.length===3 && months[pp[1]]!==undefined) pdRaw = new Date(+pp[2],months[pp[1]],+pp[0]).getTime();
        else { var ps = pd.split('T')[0].split('-'); if(ps.length===3) pdRaw=new Date(+ps[0],+ps[1]-1,+ps[2]).getTime(); }
      }
      return {id:r.id, tenant:r.tenant_name||'', amount:parseFloat(r.amount)||0,
        status:r.status||'paid', method:r.method||'bank',
        _dueDateRaw: ddRaw, _paidDateRaw: pdRaw,
        date: r.paid_date||r.due_date||'', paidDate:r.paid_date||null};
    });
    // Add paymentHistory entries not already in DB
    if(currentTenant.paymentHistory) {
      var seen = new Set(_portalPayments.map(function(p){return p.amount+'_'+p._dueDateRaw;}));
      currentTenant.paymentHistory.forEach(function(h){
        var d = new Date(h.date); var raw = d.getTime();
        if(!seen.has(h.amount+'_'+raw)) {
          _portalPayments.push({id:'h_'+raw, tenant:currentTenant.name, amount:h.amount,
            status:h.status||'paid', method:h.method||'bank', _dueDateRaw:raw, date:h.date});
        }
      });
      _portalPayments.sort(function(a,b){return (b._paidDateRaw||b._dueDateRaw||0)-(a._paidDateRaw||a._dueDateRaw||0);});
    }
  } catch(e) { console.warn('Portal payments load error:', e); }
}

function getPayments(tenantId){
  // Return cached payments (loaded async on launch)
  if(_portalPayments.length) return _portalPayments;
  // Fallback: localStorage
  var raw = localStorage.getItem('pm_payments');
  var all = raw ? JSON.parse(raw) : [];
  var t = currentTenant;
  var tenantPays = all.filter(function(p){ return p.tenant === (t?t.name:''); });
  if(t && t.paymentHistory) {
    var seen = new Set(tenantPays.map(function(p){return p.amount+'_'+p._dueDateRaw;}));
    t.paymentHistory.forEach(function(h){
      var raw2 = new Date(h.date).getTime();
      if(!seen.has(h.amount+'_'+raw2)) tenantPays.push({id:'h_'+Math.random(),tenant:t.name,amount:h.amount,status:h.status||'paid',method:h.method||'bank',_dueDateRaw:raw2,date:h.date});
    });
  }
  tenantPays.sort(function(a,b){return (b._dueDateRaw||0)-(a._dueDateRaw||0);});
  return tenantPays;
}

var _portalCompanyWA = '';

async function loadCompanyFromSupabase() {
  if(!currentTenant) return;
  try {
    // Find which property the tenant is in to get company
    var propRes = await fetch(SUPA_URL+'/rest/v1/properties?name=eq.'+encodeURIComponent(currentTenant.property)+'&select=company_id', {
      headers: {'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY}
    });
    // Companies are stored in localStorage on the main app side
    var coRaw = localStorage.getItem('pm_local_companies');
    if(coRaw) {
      var companies = JSON.parse(coRaw);
      // Use first company's WA, or match by property
      if(companies && companies.length) {
        _portalCompanyWA = companies[0].whatsapp || companies[0].phone || '';
      }
    }
  } catch(e) {}
}

async function loadScheduleFromSupabase() {
  if(!currentTenant) return;
  try {
    var res = await fetch(SUPA_URL+'/rest/v1/rpc/get_tenant_schedule', {
      method: 'POST',
      headers: {'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY, 'Content-Type':'application/json'},
      body: JSON.stringify({tid: currentTenant.id})
    });
    // If RPC doesn't exist, fall back to localStorage schedule
    if(!res.ok) throw new Error('rpc not available');
    var data = await res.json();
    if(Array.isArray(data)) _portalSched = data;
  } catch(e) {
    // Fallback: localStorage (for when both main app and portal on same device)
    var raw = localStorage.getItem('pm_local_rentSchedule');
    if(raw) {
      try {
        var all = JSON.parse(raw);
        _portalSched = all.filter(function(s){ return String(s.tenantId)===String(currentTenant.id); });
      } catch(e2) {}
    }
  }
}

function getSchedule(){
  if(_portalSched.length) return _portalSched;
  var raw = localStorage.getItem('pm_local_rentSchedule') || localStorage.getItem('pm_rentSchedule');
  var all = raw ? JSON.parse(raw) : [];
  return all.filter(function(s){ return String(s.tenantId) === String(currentTenant.id); });
}

function daysUntil(dateStr){
  if(!dateStr) return null;
  return Math.ceil((new Date(dateStr)-TODAY)/86400000);
}

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
async function doLogin(){
  var username = document.getElementById('login-email').value.trim().toLowerCase();
  var pass     = document.getElementById('login-pass').value;
  var errEl    = document.getElementById('login-error');
  var btn      = document.getElementById('login-btn');

  if(!username || !pass){ showError(errEl,'Please enter your username and password.'); return; }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  errEl.style.display = 'none';

  try {
    // Fetch tenants from Supabase, match by portalUsername
    var tenants = await loadTenantsFromSupabase();

    // Also try localStorage fallback
    if(!tenants.length) tenants = loadState();

    // Helper: compute username the same way main app does
    function computeUsername(t) {
      var first = (t.name||'tenant').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
      var room = t.room || '1';
      return first + '.' + room;
    }

    // 1. Try stored portalUsername
    var tenant = tenants.find(function(t){
      return t.portalUsername && t.portalUsername.toLowerCase() === username && t.status !== 'inactive';
    });

    // 2. Fallback: compute username from name.room (handles NULL portal_username in DB)
    if(!tenant) {
      tenant = tenants.find(function(t){
        return computeUsername(t) === username && t.status !== 'inactive';
      });
      // If matched via computed username, save it back to Supabase so it's stored
      if(tenant && !tenant.portalUsername) {
        tenant.portalUsername = username;
        fetch(SUPA_URL + '/rest/v1/tenants?id=eq.' + encodeURIComponent(tenant.id), {
          method: 'PATCH',
          headers: {'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'},
          body: JSON.stringify({ portal_username: username })
        }).catch(function(){});
      }
    }

    if(!tenant){ showError(errEl,'Username not found. Check with your property manager.'); btn.disabled=false; btn.textContent='Sign In'; return; }

    // Check password: first try portalPassword stored in tenant record
    var storedPass = tenant.portalPassword || '';
    var passwords  = loadPasswords(); // legacy localStorage passwords
    var legacyPass = passwords[tenant.id];

    var passwordOk = false;
    if(storedPass && storedPass === pass) passwordOk = true;          // plain match
    if(storedPass && storedPass === btoa(pass)) passwordOk = true;     // btoa match
    if(legacyPass && legacyPass === btoa(pass)) passwordOk = true;     // legacy localStorage

    if(!passwordOk){ showError(errEl,'Incorrect password. Please try again.'); btn.disabled=false; btn.textContent='Sign In'; return; }

    errEl.style.display = 'none';
    currentTenant = tenant;
    localStorage.setItem('pm_portal_session', JSON.stringify({tenantId: tenant.id}));
    localStorage.setItem('pm_portal_tenant_cache', JSON.stringify(tenants)); // cache for session
    launchApp();
  } catch(e) {
    showError(errEl, 'Connection error. Please try again.');
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function doSetPassword(){
  var username = document.getElementById('setup-email').value.trim().toLowerCase();
  var p1       = document.getElementById('setup-pass1').value;
  var p2       = document.getElementById('setup-pass2').value;
  var errEl    = document.getElementById('setup-error');
  var btn      = document.getElementById('setup-btn');

  if(!username){ showError(errEl,'Please enter your username.'); return; }
  if(p1.length < 6){ showError(errEl,'Password must be at least 6 characters.'); return; }
  if(p1 !== p2){ showError(errEl,'Passwords do not match.'); return; }

  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    var tenants = await loadTenantsFromSupabase();
    if(!tenants.length) tenants = loadState();

    function computeUsernameS(t) {
      var first = (t.name||'tenant').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
      var room = t.room || '1';
      return first + '.' + room;
    }
    var tenant = tenants.find(function(t){
      return (t.portalUsername && t.portalUsername.toLowerCase() === username) ||
             computeUsernameS(t) === username;
    });
    if(tenant && !tenant.portalUsername) tenant.portalUsername = username;

    if(!tenant){ showError(errEl,'Username not found. Contact your property manager.'); btn.disabled=false; btn.textContent='Set Password'; return; }

    // Save new password to Supabase tenant record AND localStorage fallback
    await fetch(SUPA_URL + '/rest/v1/tenants?id=eq.' + encodeURIComponent(tenant.id), {
      method: 'PATCH',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ portal_password: p1 })
    });

    // Also save in legacy localStorage
    var passwords = loadPasswords();
    passwords[tenant.id] = btoa(p1);
    savePasswords(passwords);

    document.getElementById('setup-modal').style.display = 'none';
    toast('✅ Password updated! You can now sign in.');
    btn.disabled = false; btn.textContent = 'Set Password';
  } catch(e) {
    showError(errEl, 'Could not save password. Try again.');
    btn.disabled = false; btn.textContent = 'Set Password';
  }
}

function showError(el, msg){ el.textContent=msg; el.style.display='block'; }

function showSetPassword(){
  document.getElementById('setup-modal').style.display='flex';
}

function doLogout(){
  currentTenant = null;
  localStorage.removeItem('pm_portal_session');
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-email').value='';
  document.getElementById('login-pass').value='';
}

async function checkSession(){
  var sess = localStorage.getItem('pm_portal_session');
  if(!sess) return;
  var data = JSON.parse(sess);
  // Try Supabase first, fall back to cache
  var cached = localStorage.getItem('pm_portal_tenant_cache');
  var tenants = [];
  try {
    tenants = await loadTenantsFromSupabase();
    if(tenants.length) localStorage.setItem('pm_portal_tenant_cache', JSON.stringify(tenants));
  } catch(e) {}
  if(!tenants.length && cached) tenants = JSON.parse(cached);
  if(!tenants.length) tenants = loadState();
  var t = tenants.find(function(x){ return x.id===data.tenantId && x.status!=='inactive'; });
  if(t){ currentTenant=t; launchApp(); }
}

// ═══════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════
function launchApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  renderAll();
  // Load payments + schedule from Supabase in background
  loadPaymentsFromSupabase().then(function(){
    renderPayments(); // re-render once data arrives
  }).catch(function(){});
  loadScheduleFromSupabase().then(function(){
    renderHome(); renderPayments();
  }).catch(function(){});
  loadCompanyFromSupabase(); // load company info for WA number
}

function renderAll(){
  var t = currentTenant;
  if(!t) return;

  // Header
  document.getElementById('hdr-avatar').textContent = t.name[0].toUpperCase();
  document.getElementById('hdr-name').textContent   = t.name.split(' ')[0];
  document.getElementById('hdr-prop').textContent   = t.property + ' · Room ' + t.room;

  renderHome();
  renderPayments();
  // These are async — call but don't await so UI renders immediately
  renderMaintenance();
  renderDocuments();
  renderProfile();
  updateBadges();
}

// ═══════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════
function renderHome(){
  var t = currentTenant;
  document.getElementById('home-name').textContent = 'Hello, '+t.name.split(' ')[0]+'! 👋';
  document.getElementById('home-prop').textContent = t.property + ' · Room ' + t.room;
  document.getElementById('stat-rent').textContent = fmt(t.rent);
  document.getElementById('stat-arrears').textContent = t.arrears>0 ? fmt(t.arrears) : '£0';
  if(t.arrears>0) document.getElementById('stat-arrears').style.color='#F87171';
  else document.getElementById('stat-arrears').style.color='#6EE7B7';

  // Next due from schedule
  var sched = getSchedule().filter(function(s){ return s.status!=='paid'; });
  sched.sort(function(a,b){ return a.dueDateRaw-b.dueDateRaw; });
  if(sched.length){
    var nextD = new Date(sched[0].dueDateRaw);
    var diff  = daysUntil(nextD.toISOString().split('T')[0]);
    document.getElementById('stat-next').textContent = diff===0?'Today':diff===1?'Tomorrow':diff+'d';
    document.getElementById('stat-next').style.color = diff<=1?'#FCD34D':'#fff';
  } else {
    document.getElementById('stat-next').textContent = '—';
  }

  // Alerts
  var alertsHtml = '';
  if(t.arrears>0){
    alertsHtml += '<div class="alert-banner danger"><div class="alert-icon">⚠️</div><div><div class="alert-title">You have arrears of '+fmt(t.arrears)+'</div><div class="alert-msg">Please contact your property manager or make a payment as soon as possible.</div></div></div>';
  }
  if(t.status==='notice_given' && t.moveOutDate){
    var days = daysUntil(t.moveOutDate);
    alertsHtml += '<div class="alert-banner warning"><div class="alert-icon">📋</div><div><div class="alert-title">You are on notice</div><div class="alert-msg">Move-out date: '+fmtDate(t.moveOutDate)+(days>=0?' ('+days+' days remaining)':' (today)')+'. Please ensure your room is clear.</div></div></div>';
  }
  document.getElementById('home-alerts').innerHTML = alertsHtml;

  // Notice countdown
  var noticeSection = document.getElementById('notice-section');
  if(t.status==='notice_given' && t.moveOutDate){
    noticeSection.style.display='block';
    var dLeft = daysUntil(t.moveOutDate);
    var col   = dLeft<=7?'var(--red)':dLeft<=14?'var(--amber)':'var(--green)';
    document.getElementById('notice-countdown-card').innerHTML =
      '<div style="color:'+col+'" class="countdown-num">'+(dLeft>0?dLeft:0)+'</div>'
      +'<div class="countdown-lbl">days until check-out</div>'
      +'<div class="countdown-date">Move-out: '+fmtDate(t.moveOutDate)+'</div>';
  } else {
    noticeSection.style.display='none';
  }

  // Checklist
  var checks = [
    {id:'chk-keys',    label:'Keys / access fob received',        sub:'Confirm you have all keys'},
    {id:'chk-contract',label:'Tenancy agreement signed',          sub:'Keep your copy safe'},
    {id:'chk-deposit', label:'Deposit paid ('+fmt(t.deposit||t.rent*2)+')', sub:'Should be protected in a scheme'},
    {id:'chk-rtr',     label:'Right to Rent documents submitted',  sub:'Upload in My Documents'},
    {id:'chk-wa',      label:'WhatsApp contact saved',            sub:t.whatsapp?'✓ '+t.whatsapp:'Add in My Profile'},
    {id:'chk-bank',    label:'Payment method confirmed',           sub:t.method==='bank'?'Bank transfer':'Cash collection'},
  ];
  var savedChecks = JSON.parse(localStorage.getItem(getChecksKey())||'{}');
  var checkHtml = checks.map(function(c){
    var checked = !!savedChecks[c.id];
    return '<div class="checklist-item">'
      +'<div class="check-box'+(checked?' checked':'')+'" onclick="toggleCheck(\''+c.id+'\')" id="'+c.id+'">'
      +(checked?'&#x2713;':'')+'</div>'
      +'<div><div class="check-label">'+c.label+'</div><div class="check-sub">'+c.sub+'</div></div>'
      +'</div>';
  }).join('');
  document.getElementById('checklist-card').innerHTML = checkHtml;

  // Contact card
  var waMsg = 'Hi, this is '+t.name+' from '+t.property+' Room '+t.room+'. ';
  var waNumber = (_portalCompanyWA||'').replace(/\D/g,'');
  var waHref = waNumber ? 'https://wa.me/'+waNumber+'?text='+encodeURIComponent(waMsg) : 'https://wa.me/?text='+encodeURIComponent(waMsg);
  document.getElementById('contact-card').innerHTML =
    '<div class="card-title" style="margin-bottom:12px">📞 Reservations Direct</div>'
    +'<a href="https://wa.me/?text='+encodeURIComponent(waMsg)+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;text-decoration:none;color:var(--text);margin-bottom:8px">'
    +'<span style="font-size:22px">💬</span><div><div style="font-size:13px;font-weight:700;color:var(--green)">Message on WhatsApp</div><div style="font-size:11px;color:var(--muted)">Fastest response</div></div></a>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
    +'<span style="font-size:12px;color:var(--muted);background:var(--bg);padding:6px 12px;border-radius:8px;border:1px solid var(--border)">📧 info@reservationsdirect.co.uk</span>'
    +'</div>';
}

function getChecksKey(){
  var t = currentTenant;
  // Use a stable key: first try id, fallback to name+room
  return 'pm_portal_checks_'+(t.id||t.name.toLowerCase().replace(/\s+/g,'_')+'_'+t.room);
}

function toggleCheck(id){
  var checks = JSON.parse(localStorage.getItem(getChecksKey())||'{}');
  checks[id] = !checks[id];
  localStorage.setItem(getChecksKey(), JSON.stringify(checks));
  var el = document.getElementById(id);
  if(el){
    if(checks[id]){ el.classList.add('checked'); el.textContent='\u2713'; }
    else { el.classList.remove('checked'); el.textContent=''; }
  }
}

// ═══════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════
function renderPayments(){
  var t = currentTenant;
  var pays = getPayments(t.id);
  var sched = getSchedule();

  var paid   = pays.filter(function(p){ return p.status==='paid'; });
  var owed   = pays.filter(function(p){ return p.status!=='paid'; });
  var totalPaid = paid.reduce(function(s,p){return s+p.amount;},0);
  var totalOwed = owed.reduce(function(s,p){return s+p.amount;},0);

  document.getElementById('pay-summary').innerHTML =
    '<div style="text-align:center;padding:16px;border-right:1px solid var(--border)">'
    +'<div style="font-size:18px;font-weight:800;color:var(--green);font-family:monospace">'+fmt(totalPaid)+'</div>'
    +'<div style="font-size:11px;color:var(--muted);text-transform:uppercase;margin-top:3px">Paid</div></div>'
    +'<div style="text-align:center;padding:16px;border-right:1px solid var(--border)">'
    +'<div style="font-size:18px;font-weight:800;color:'+(totalOwed>0?'var(--red)':'var(--muted)')+';font-family:monospace">'+fmt(totalOwed)+'</div>'
    +'<div style="font-size:11px;color:var(--muted);text-transform:uppercase;margin-top:3px">Outstanding</div></div>'
    +'<div style="text-align:center;padding:16px">'
    +'<div style="font-size:18px;font-weight:800;font-family:monospace">'+fmt(t.rent)+'</div>'
    +'<div style="font-size:11px;color:var(--muted);text-transform:uppercase;margin-top:3px">Per '+(t.freq==='weekly'?'week':'month')+'</div></div>';

  // Upcoming from schedule
  var upcoming = sched.filter(function(s){ return s.status!=='paid'; })
    .sort(function(a,b){ return a.dueDateRaw-b.dueDateRaw; }).slice(0,4);

  if(upcoming.length){
    var upHtml = upcoming.map(function(s){
      var due  = new Date(s.dueDateRaw);
      var diff = daysUntil(s.dueDate);
      var isOverdue = diff < 0;
      var col  = isOverdue?'var(--red)':diff===0?'var(--amber)':diff===1?'var(--blue)':'var(--muted)';
      var label= isOverdue?'⚠ Overdue':diff===0?'Today':diff===1?'Tomorrow':'In '+diff+'d';
      return '<div class="payment-row">'
        +'<div class="payment-icon" style="background:'+(isOverdue?'var(--red-l)':diff<=1?'var(--amber-l)':'var(--bg)')+'">💷</div>'
        +'<div class="payment-info"><div class="payment-desc">'+fmt(s.amount)+' due</div>'
        +'<div class="payment-date">'+due.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})+'</div></div>'
        +'<div style="text-align:right"><span class="badge" style="color:'+col+';background:transparent;font-size:12px;font-weight:700">'+label+'</span></div>'
        +'</div>';
    }).join('');
    document.getElementById('upcoming-payments').innerHTML = upHtml || '<div style="text-align:center;padding:20px;color:var(--dim)">No upcoming payments</div>';
  } else {
    document.getElementById('upcoming-payments').innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim)">No scheduled payments found</div>';
  }

  // History — show paid items sorted by paid date
  var paidHist = pays.filter(function(x){ return x.status==='paid' || x.status==='Paid'; });
  // Also include all from _portalPayments if available
  if(_portalPayments.length && !paidHist.length) {
    paidHist = _portalPayments.filter(function(x){ return x.status==='paid'||x.status==='Paid'; });
  }
  paidHist.sort(function(a,b){ return (b._paidDateRaw||b._dueDateRaw||0)-(a._paidDateRaw||a._dueDateRaw||0); });

  if(paidHist.length){
    var histHtml = paidHist.slice(0,30).map(function(p){
      var icon = p.method==='cash'?'💵':'🏦';
      // Show paid date if available, fall back to due date
      var displayRaw = p._paidDateRaw || p._dueDateRaw;
      var dt = displayRaw ? new Date(displayRaw) : null;
      var dateStr = p.paidDate || (dt ? dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : p.date||'—');
      return '<div class="payment-row">'        +'<div class="payment-icon" style="background:var(--green-l)">'+icon+'</div>'        +'<div class="payment-info"><div class="payment-desc">'+fmt(p.amount)+'</div>'        +'<div class="payment-date">'+dateStr+'</div></div>'        +'<div style="text-align:right">'        +'<span class="badge badge-green">✓ Paid</span>'        +'<div class="payment-method">'+(p.method==='cash'?'💵 Cash':'🏦 Bank')+'</div></div>'        +'</div>';
    }).join('');
    document.getElementById('payment-history').innerHTML = histHtml;
    } else {
    document.getElementById('payment-history').innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim);font-size:13px">No payment history yet</div>';
  }
}

// ═══════════════════════════════════════════════════════
// MAINTENANCE
// ═══════════════════════════════════════════════════════
async function renderMaintenance(){
  var t = currentTenant;
  var allMaint = loadTenantMaintenance();

  // Load from Supabase maintenance table
  var supabaseMaint = [];
  try {
    var res = await fetch(SUPA_URL+'/rest/v1/maintenance?or=(tenant_name.eq.'+encodeURIComponent(t.name)+',tenant_id.eq.'+encodeURIComponent(t.id)+')&select=*&order=date.desc&limit=50', {
      headers: {'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY}
    });
    var rows = await res.json();
    if(Array.isArray(rows)) {
      supabaseMaint = rows.map(function(r){
        return {id:r.id, tenantId:r.tenant_id, tenantName:r.tenant_name,
          property:r.property_name||t.property, room:r.room_number||t.room,
          issue:r.issue, category:r.category, priority:r.priority||'medium',
          notes:r.notes, status:r.status||'open',
          reportedDate: r.date ? new Date(r.date).getTime() : Date.now()};
      });
    }
  } catch(e) {
    // Fallback: localStorage
    try {
      var raw = localStorage.getItem('pm_maintenance');
      if(raw) supabaseMaint = JSON.parse(raw).filter(function(m){ return String(m.tenantId)===String(t.id)||m.property===t.property; });
    } catch(e2){}
  }

  // Merge: use Supabase as primary, local only for newly submitted (tm_ prefix)
  var localNew = allMaint.filter(function(m){
    return String(m.id).startsWith('tm_') && !supabaseMaint.some(function(s){return String(s.id)===String(m.id);});
  });
  var combined = supabaseMaint.concat(localNew).sort(function(a,b){ return (b.reportedDate||0)-(a.reportedDate||0); });

  document.getElementById('maint-count').textContent = combined.length+' request'+(combined.length===1?'':'s');

  var priColors = {urgent:'var(--red)',high:'#EA580C',medium:'var(--amber)',low:'var(--green)'};
  var priLabels = {urgent:'🔴 Urgent',high:'🟠 High',medium:'🟡 Medium',low:'🟢 Low'};
  var statusColors = {open:'var(--red)',  'in-progress':'var(--amber)', resolved:'var(--green)'};

  if(!combined.length){
    document.getElementById('maint-list').innerHTML =
      '<div style="text-align:center;padding:48px 20px;color:var(--dim)">'
      +'<div style="font-size:40px;margin-bottom:12px">🔧</div>'
      +'<div style="font-size:14px;font-weight:600">No maintenance requests</div>'
      +'<div style="font-size:13px;margin-top:6px">Tap + New Request to report an issue</div></div>';
    return;
  }

  document.getElementById('maint-list').innerHTML = combined.map(function(m){
    var pri = m.priority||'medium';
    var sts = m.status||'open';
    var barColor = priColors[pri]||'var(--amber)';
    return '<div class="maint-card">'
      +'<div class="maint-top">'
      +'<div><div class="maint-title">'+m.issue+'</div>'
      +'<div class="maint-meta">'+m.property+' · Rm '+(m.room||t.room)+' · '+m.category+'</div></div>'
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">'
      +'<span class="badge" style="color:'+(statusColors[sts]||'var(--muted)')+';background:transparent;border:1px solid '+(statusColors[sts]||'var(--border)')+'">'+sts.replace('-',' ')+'</span>'
      +'<span style="font-size:11px;font-weight:600;color:'+barColor+'">'+priLabels[pri]+'</span>'
      +'</div></div>'
      +(m.notes?'<div style="font-size:12px;color:var(--muted);margin-top:6px">📝 '+m.notes+'</div>':'')
      +(m.reportedDate?'<div style="font-size:11px;color:var(--dim);margin-top:6px">Reported: '+fmtDate(new Date(m.reportedDate).toISOString())+'</div>':'')
      +'<div class="priority-bar" style="background:'+barColor+';opacity:.4"></div>'
      +'</div>';
  }).join('');
}

function openMaintenanceForm(){
  document.getElementById('maint-modal').style.display='flex';
  document.getElementById('maint-issue').value='';
  document.getElementById('maint-notes').value='';
  document.getElementById('maint-photo-preview').style.display='none';
}

function previewMaintPhoto(input){
  var file = input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload=function(e){
    document.getElementById('maint-preview-img').src=e.target.result;
    document.getElementById('maint-photo-preview').style.display='block';
  };
  reader.readAsDataURL(file);
}

async function submitMaintenance(){
  var issue = document.getElementById('maint-issue').value.trim();
  if(!issue){ toast('⚠️ Please describe the issue'); return; }
  var btn = document.getElementById('maint-submit-btn');
  if(btn) { btn.disabled=true; btn.textContent='Submitting…'; }

  var t = currentTenant;
  var category = document.getElementById('maint-cat').value;
  var priority = document.getElementById('maint-pri').value;
  var notes = document.getElementById('maint-notes').value.trim();
  var today = new Date().toISOString().split('T')[0];
  var todayLabel = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

  var newId = crypto.randomUUID ? crypto.randomUUID() : 'tm_'+Date.now();

  var row = {
    id: newId,
    tenant_id: t.id,
    tenant_name: t.name,
    property_name: t.property,
    room_number: String(t.room),
    issue: issue,
    category: category,
    priority: priority,
    notes: '(Reported by tenant) '+notes,
    status: 'open',
    date: todayLabel,
    submitted_by_tenant: true
  };

  // POST to Supabase — single write, no duplication
  var saved = false;
  try {
    var res = await fetch(SUPA_URL+'/rest/v1/maintenance', {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify([row])
    });
    if(res.ok || res.status===201) { saved=true; }
    else { console.warn('Maint save status:', res.status, await res.text()); }
  } catch(e) { console.warn('Maint save error:', e); }

  // Also track locally so tenant can see it immediately
  var list = loadTenantMaintenance();
  list.push({
    id: newId, tenantId: t.id, tenantName: t.name,
    property: t.property, room: t.room,
    issue: issue, category: category, priority: priority, notes: notes,
    status: 'open', reportedDate: Date.now(), submittedByTenant: true
  });
  saveTenantMaintenance(list);

  document.getElementById('maint-modal').style.display='none';
  if(btn) { btn.disabled=false; btn.textContent='Submit Request'; }
  toast(saved ? '✅ Maintenance request submitted!' : '✅ Saved locally (will sync when online)');
  goTab('maintenance');
  renderMaintenance();
}

// ═══════════════════════════════════════════════════════
// DOCUMENTS
// ═══════════════════════════════════════════════════════
async function renderDocuments(){
  var t = currentTenant;
  var vault = loadVault();
  var docs = vault[t.id] || [];

  var typeColors = {
    'Right to Rent':'#DCFCE7','Passport / ID':'#EFF6FF','Proof of Address':'#FEF9C3',
    'Employment Reference':'#F3E8FF','Other':'#F1F5F9'
  };
  var typeTextColors = {
    'Right to Rent':'#166534','Passport / ID':'#1E40AF','Proof of Address':'#854D0E',
    'Employment Reference':'#6B21A8','Other':'#475569'
  };

  // Load from Supabase storage too
  var supabaseDocs = [];
  try {
    var listRes = await fetch(SUPA_URL+'/storage/v1/object/list/tenant-docs', {
      method:'POST',
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({prefix:'tenants/'+t.id,limit:20})
    });
    var files = await listRes.json();
    if(Array.isArray(files)){
      supabaseDocs = files.filter(function(f){return f.name&&!f.name.startsWith('.');}).map(function(f){
        return {id:f.name,name:f.name,type:'Document',size:'',uploadedAt:'',
          dataUrl:SUPA_URL+'/storage/v1/object/public/tenant-docs/tenants/'+t.id+'/'+f.name,
          _fromSupabase:true};
      });
    }
  } catch(e){}

  // Merge: skip supabase entries already in vault
  var allDocs = docs.concat(supabaseDocs.filter(function(sd){
    return !docs.some(function(d){return d.storagePath&&d.storagePath.indexOf(sd.name)>=0;});
  }));

  // Contract section always at top
  var contractHtml = '<div style="background:linear-gradient(135deg,#EFF6FF,#F0FDF4);border:1.5px solid #BFDBFE;border-radius:12px;padding:14px 16px;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:700;color:#1E40AF;margin-bottom:10px">\uD83D\uDCDC Your Tenancy Agreement</div>'
    +'<div style="font-size:12px;color:#475569;margin-bottom:10px">Your licence agreement with Reservations Direct Limited &middot; Room '+t.room+', '+t.property+'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="viewContract()" style="padding:9px 14px;border-radius:9px;border:none;background:#1E40AF;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">\uD83D\uDCC4 View Agreement</button>'
    +'</div>'
    +'</div>';

  var docsHtml = '';
  if(!allDocs.length){
    docsHtml = '<div style="text-align:center;padding:32px;color:var(--dim)">'
      +'<div style="font-size:36px;margin-bottom:10px">\uD83D\uDCC2</div>'
      +'<div style="font-size:14px;font-weight:600">No documents uploaded yet</div>'
      +'<div style="font-size:13px;margin-top:6px">Your property manager may upload your ID, references, and other documents here</div>'
      +'</div>';
  } else {
    docsHtml = allDocs.map(function(doc){
      var icon = (doc.name||'').match(/\.pdf$/i)?'\uD83D\uDCC4':(doc.name||'').match(/\.(jpg|jpeg|png)$/i)?'\uD83D\uDDBC\uFE0F':'\uD83D\uDCCB';
      var bg   = typeColors[doc.type]||'#F1F5F9';
      var col  = typeTextColors[doc.type]||'#475569';
      return '<div class="doc-row">'
        +'<div class="doc-icon" style="background:'+bg+'">'+icon+'</div>'
        +'<div class="doc-info"><div class="doc-name">'+doc.name+'</div>'
        +'<div class="doc-meta"><span style="color:'+col+';font-weight:700">'+doc.type+'</span>'+(doc.size?' &middot; '+doc.size:'')+(doc.uploadedAt?' &middot; '+doc.uploadedAt:'')+'</div></div>'
        +'<div class="doc-actions">'
        +(doc.dataUrl?'<a href="'+doc.dataUrl+'" target="_blank" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:12px;font-weight:700;color:var(--blue);text-decoration:none">\u2193</a>':'')
        +(!doc._fromSupabase?'<button onclick="deleteTenantDoc(\''+doc.id+'\')" style="padding:6px 10px;border-radius:8px;border:1px solid #FECACA;background:#FFF1F2;font-size:12px;font-weight:700;color:var(--red);cursor:pointer;font-family:inherit">&times;</button>':'')
        +'</div></div>';
    }).join('');
  }

  document.getElementById('doc-list').innerHTML = contractHtml + docsHtml;
}

function viewContract(){
  var t = currentTenant;
  // Open a simple printable agreement in a new window
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tenancy Agreement - '+t.name+'</title>'
    +'<style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;font-size:13px;line-height:1.8;color:#111}'
    +'h1{font-size:18px;text-align:center;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px}'
    +'.row{display:flex;padding:6px 0;border-bottom:1px solid #eee;gap:10px}'
    +'.lbl{font-weight:bold;min-width:140px;color:#555;font-size:12px;text-transform:uppercase}'
    +'h2{font-size:13px;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #ccc;padding-bottom:4px;margin:20px 0 8px}'
    +'@media print{button{display:none}}</style>'
    +'<script>window.onload=function(){window.print();}<\/script>'
    +'</head><body>'
    +'<h1>Excluded Licence Agreement</h1>'
    +'<div style="text-align:center;margin-bottom:20px;font-size:12px;color:#555">Reservations Direct Limited</div>'
    +'<div style="background:#f7f7f7;padding:8px 16px;margin-bottom:20px">'
    +'<div class="row"><span class="lbl">Licensor</span><span>Reservations Direct Limited</span></div>'
    +'<div class="row"><span class="lbl">Licensee</span><span>'+t.name+'</span></div>'
    +'<div class="row"><span class="lbl">Property</span><span>'+t.property+'</span></div>'
    +'<div class="row"><span class="lbl">Room</span><span>Room '+t.room+'</span></div>'
    +'<div class="row"><span class="lbl">Licence Fee</span><span>&pound;'+t.rent+' per '+(t.freq==='weekly'?'week':'month')+'</span></div>'
    +'<div class="row"><span class="lbl">Start Date</span><span>'+(t.startDate||t.moveIn||'&mdash;')+'</span></div>'
    +'</div>'
    +'<h2>1. Grant of Licence</h2><p>Reservations Direct Limited grants the Licensee a personal, non-exclusive licence to occupy the above room for residential purposes only. This does not create a tenancy or any interest in land.</p>'
    +'<h2>2. Licence Fee</h2><p>The Licensee shall pay &pound;'+t.rent+' per '+(t.freq==='weekly'?'week':'month')+' by '+(t.method==='bank'?'bank transfer':'cash')+', payable in advance.</p>'
    +'<h2>3. Notice</h2><p>Either party may terminate by giving 1 week written notice. The Company may terminate immediately on breach.</p>'
    +'<h2>4. Obligations</h2><p>Pay on time. Keep room clean. Report issues promptly. No pets without permission. No smoking inside. Allow access with reasonable notice.</p>'
    +'<h2>5. House Rules</h2><p>Quiet hours 11pm&ndash;7am. Keep communal areas clean. No unauthorised overnight guests.</p>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px">'
    +'<div><p style="font-weight:bold">Tenant Signature</p><div style="border:1px solid #999;height:60px;margin:8px 0 6px"></div><p style="font-size:11px;color:#555">'+t.name+'<br>Date: _____________</p></div>'
    +'<div><p style="font-weight:bold">Agent Signature</p><div style="border:1px solid #999;height:60px;margin:8px 0 6px"></div><p style="font-size:11px;color:#555">Reservations Direct Limited<br>Date: _____________</p></div>'
    +'</div>'
    +'</body></html>';
  var w = window.open('','_blank','width=800,height=600');
  if(w) { w.document.write(html); w.document.close(); }
}

function handleDocUpload(input){
  var t = currentTenant;
  var docType = document.getElementById('doc-type-sel').value;
  var vault = loadVault();
  if(!vault[t.id]) vault[t.id]=[];
  var files = Array.from(input.files);
  var done = 0;
  files.forEach(function(file){
    if(file.size>10*1024*1024){ toast('⚠️ '+file.name+' is too large (max 10MB)'); return; }
    var reader=new FileReader();
    reader.onload=function(e){
      var sz = file.size>1024*1024?(file.size/1024/1024).toFixed(1)+'MB':Math.round(file.size/1024)+'KB';
      vault[t.id].push({
        id:'doc_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
        name:file.name, type:docType, dataUrl:e.target.result,
        size:sz, uploadedAt:new Date('2026-03-21').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
      });
      done++;
      if(done===files.length){ saveVault(vault); renderDocuments(); toast('✅ '+done+' document'+(done===1?'':'s')+' uploaded!'); }
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}

function deleteTenantDoc(docId){
  var t = currentTenant;
  var vault = loadVault();
  vault[t.id] = (vault[t.id]||[]).filter(function(d){ return d.id!==docId; });
  saveVault(vault);
  renderDocuments();
  toast('Document removed');
}

// ═══════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════
function renderProfile(){
  var t = currentTenant;
  document.getElementById('profile-avatar').textContent = t.name[0].toUpperCase();
  document.getElementById('profile-name').textContent = t.name;
  document.getElementById('profile-prop').textContent = t.property+' · Room '+t.room;

  var statusColors = {active:'badge-green',notice_given:'badge-amber',inactive:'badge-gray'};
  var statusLabels = {active:'✓ Active Tenant',notice_given:'📋 On Notice',inactive:'Archived'};
  document.getElementById('profile-status-badge').innerHTML =
    '<span class="badge '+(statusColors[t.status]||'badge-gray')+'">'+(statusLabels[t.status]||t.status)+'</span>';

  document.getElementById('p-name').value  = t.name||'';
  document.getElementById('p-email').value = t.email||'';
  document.getElementById('p-wa').value    = t.whatsapp||'';

  // Tenancy details
  document.getElementById('tenancy-details-card').innerHTML =
    '<div style="display:flex;flex-direction:column;gap:0">'
    ++detailRow('\U0001f464 Username', '<code style="background:#F1F5F9;padding:2px 8px;border-radius:4px;font-size:13px">'+(t.portalUsername||'\u2014')+'</code>')
    detailRow('📅 Check-in Date', fmtDate(t.startDate||t.moveIn))
    +detailRow('💷 Weekly Rent', fmt(t.rent))
    +detailRow('📆 Pay Day', t.freq==='weekly'?(t.payDay||'—'):(t.payDayOfMonth+'th of month')||'—')
    +detailRow('🏦 Payment Method', t.method==='bank'?'Bank Transfer':'Cash')
    +detailRow('🔒 Deposit', fmt(t.deposit||t.rent*2))
    +detailRow('📋 Deposit Status', t.depositStatus==='returned'?'Returned':'Held')
    +'</div>';

  // Give Notice section
  var giveNoticeCard = document.getElementById('give-notice-card');
  if(t.status==='notice_given' && t.moveOutDate){
    var days = daysUntil(t.moveOutDate);
    giveNoticeCard.innerHTML =
      '<div class="alert-banner warning" style="margin-bottom:12px"><div class="alert-icon">📋</div><div>'
      +'<div class="alert-title">Notice submitted</div>'
      +'<div class="alert-msg">Move-out: '+fmtDate(t.moveOutDate)+(days>=0?' · '+days+' days remaining':' · Today')+'</div>'
      +'</div></div>'
      +'<button onclick="cancelNoticeRequest()" style="width:100%;padding:12px;border-radius:10px;border:1px solid #FDE68A;background:var(--amber-l);color:var(--amber);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Cancel Notice Request</button>';
  } else if(t.status==='active'){
    giveNoticeCard.innerHTML =
      '<div style="font-size:13px;color:var(--muted);margin-bottom:14px">Your tenancy agreement requires <strong>4 weeks written notice</strong>. Use the button below to formally notify your property manager.</div>'
      +'<button onclick="openNoticeModal()" style="width:100%;padding:12px;border-radius:10px;border:none;background:var(--red);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">📋 Give Notice to Vacate</button>';
  } else {
    giveNoticeCard.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:12px">No action available</div>';
  }
}

function detailRow(label, value){
  return '<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">'
    +'<span style="font-size:13px;color:var(--muted)">'+label+'</span>'
    +'<span style="font-size:13px;font-weight:700">'+value+'</span></div>';
}

function saveProfile(){
  var t = currentTenant;
  var tenants = loadState();
  var idx = tenants.findIndex(function(x){ return x.id===t.id; });
  if(idx<0) return;
  tenants[idx].name     = document.getElementById('p-name').value.trim()||t.name;
  tenants[idx].email    = document.getElementById('p-email').value.trim();
  tenants[idx].whatsapp = document.getElementById('p-wa').value.trim().replace(/\s+/g,'').replace(/^\+/,'');
  currentTenant = tenants[idx];
  saveTenants(tenants);
  renderAll();
  toast('✅ Profile updated!');
}

function changePassword(){
  var oldPass = document.getElementById('p-old-pass').value;
  var newPass = document.getElementById('p-new-pass').value;
  var confPass= document.getElementById('p-confirm-pass').value;
  if(!oldPass||!newPass||!confPass){ toast('⚠️ Please fill all password fields'); return; }
  if(newPass.length<6){ toast('⚠️ New password must be at least 6 characters'); return; }
  if(newPass!==confPass){ toast('⚠️ New passwords do not match'); return; }
  var passwords = loadPasswords();
  if(passwords[currentTenant.id] !== btoa(oldPass)){ toast('⚠️ Current password is incorrect'); return; }
  passwords[currentTenant.id] = btoa(newPass);
  savePasswords(passwords);
  document.getElementById('p-old-pass').value='';
  document.getElementById('p-new-pass').value='';
  document.getElementById('p-confirm-pass').value='';
  toast('✅ Password updated!');
}

// ═══════════════════════════════════════════════════════
// NOTICE
// ═══════════════════════════════════════════════════════
function openNoticeModal(){
  var minDate = new Date('2026-03-21');
  minDate.setDate(minDate.getDate()+28);
  document.getElementById('notice-date').min = minDate.toISOString().split('T')[0];
  document.getElementById('notice-date').value = '';
  document.getElementById('notice-modal').style.display='flex';
}

async function submitNotice(){
  var date = document.getElementById('notice-date').value;
  if(!date){ toast('⚠️ Please select a move-out date'); return; }
  var t = currentTenant;
  var today = new Date().toISOString().split('T')[0];

  // PATCH to Supabase so manager sees it immediately
  try {
    await fetch(SUPA_URL+'/rest/v1/tenants?id=eq.'+encodeURIComponent(t.id), {
      method: 'PATCH',
      headers: {'apikey': SUPA_KEY, 'Authorization': 'Bearer '+SUPA_KEY,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'},
      body: JSON.stringify({
        status: 'notice_given',
        notice_date: today,
        move_out_date: date,
        notes: (t.notes||'') + (document.getElementById('notice-notes').value ? '\nNotice reason: '+document.getElementById('notice-notes').value : '')
      })
    });
  } catch(e) { console.warn('Notice save error:', e); }

  // Update local state
  currentTenant.status = 'notice_given';
  currentTenant.noticeDate = today;
  currentTenant.moveOutDate = date;
  currentTenant.noticeReason = document.getElementById('notice-reason').value;
  localStorage.setItem('pm_portal_tenant_cache', JSON.stringify([currentTenant]));

  document.getElementById('notice-modal').style.display='none';
  renderAll();
  toast('📋 Notice submitted. Your manager has been notified.');
}

function cancelNoticeRequest(){
  var t = currentTenant;
  var tenants = loadState();
  var idx = tenants.findIndex(function(x){ return x.id===t.id; });
  if(idx<0) return;
  tenants[idx].status      = 'active';
  tenants[idx].noticeDate  = null;
  tenants[idx].moveOutDate = null;
  currentTenant = tenants[idx];
  saveTenants(tenants);
  renderAll();
  toast('✅ Notice cancelled');
}

// ═══════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════
function goTab(tab){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var page = document.getElementById('page-'+tab);
  var nav  = document.getElementById('nav-'+tab);
  if(page) page.classList.add('active');
  if(nav)  nav.classList.add('active');
  window.scrollTo(0,0);
}

function updateBadges(){
  var t = currentTenant;
  // Payment badge - overdue count
  var sched = getSchedule().filter(function(s){ return s.status!=='paid' && s.dueDateRaw < TODAY.getTime(); });
  var payBadge = document.getElementById('nav-pay-badge');
  if(sched.length+((t.arrears||0)>0?1:0) > 0){
    payBadge.style.display='block';
    payBadge.textContent = sched.length;
  } else {
    payBadge.style.display='none';
  }
  // Maintenance badge - open requests
  var allMaint = loadTenantMaintenance().filter(function(m){ return m.tenantId===t.id && m.status==='open'; });
  var maintBadge = document.getElementById('nav-maint-badge');
  if(allMaint.length){ maintBadge.style.display='block'; maintBadge.textContent=allMaint.length; }
  else maintBadge.style.display='none';
}

// ═══════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════
document.getElementById('login-email').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('login-pass').focus(); });
document.getElementById('login-pass').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
checkSession();
