const SUPA_URL = window.ENV.SUPA_URL;
const SUPA_KEY = window.ENV.SUPA_KEY;

// Optional hardcoded allowlist (bootstrap / emergencies). Primary allowlist: superadmin_organisations view (email or user_id).
const SUPERADMIN_EMAILS = ['g.depaula85@gmail.com','gleydson@reservationsdirect.co.uk','test2@gmail.com'];

const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

/** True if user is in SUPERADMIN_EMAILS (case-insensitive) or has a row in the superadmin_organisations view (email or user_id). */
async function userHasSuperadminAccess(user) {
  if (!user || !user.email) return false;
  var em = user.email.toLowerCase();
  if (SUPERADMIN_EMAILS.some(function (x) { return x.toLowerCase() === em; })) return true;

  var { data: byEmail, error: errEmail } = await supa
    .from('superadmin_organisations')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();
  if (byEmail) return true;
  if (errEmail && errEmail.code && errEmail.code !== 'PGRST116') {
    console.warn('superadmin_organisations (email eq):', errEmail.message);
  }

  var { data: byEmailI } = await supa
    .from('superadmin_organisations')
    .select('id')
    .ilike('email', user.email)
    .maybeSingle();
  if (byEmailI) return true;

  var { data: byUid, error: errUid } = await supa
    .from('superadmin_organisations')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (byUid) return true;
  if (errUid && errUid.code && errUid.code !== 'PGRST116') {
    console.warn('superadmin_organisations (user_id):', errUid.message);
  }

  return false;
}

// ── State ─────────────────────────────────────────────────────
var orgs = [];
var currentPage = 'dashboard';
var currentUser = null;
var lastLoaded = null;

// ── Init ──────────────────────────────────────────────────────
(async function init(){
  try {
    const { data:{ session } } = await supa.auth.getSession();
    if(!session) { showLogin(); return; }
    if(!(await userHasSuperadminAccess(session.user))) {
      showLogin('❌ This account does not have superadmin access.');
      await supa.auth.signOut();
      return;
    }
    currentUser = session.user;
    showApp();
    await loadData();
  } catch(e) {
    showLogin('Connection error: ' + e.message);
  }
})();

function showLogin(err) {
  document.getElementById('loading-overlay').classList.add('hidden');
  document.getElementById('login-screen').classList.add('show');
  if(err) {
    var el = document.getElementById('login-err');
    el.textContent = err; el.style.display = 'block';
  }
}

function showApp() {
  document.getElementById('loading-overlay').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('show');
  document.getElementById('app').style.display = 'grid';
  var name = (currentUser.user_metadata && currentUser.user_metadata.full_name) || currentUser.email.split('@')[0];
  document.getElementById('sb-name').textContent = name;
  document.getElementById('sb-avatar').textContent = name[0].toUpperCase();
}

async function doLogin() {
  var email = document.getElementById('sa-email').value.trim();
  var pass  = document.getElementById('sa-password').value;
  var errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  if(!email||!pass){ errEl.textContent='Please enter email and password.';errEl.style.display='block';return; }
  var { data, error } = await supa.auth.signInWithPassword({ email, password:pass });
  if(error){ errEl.textContent='❌ '+error.message;errEl.style.display='block';return; }
  if(!(await userHasSuperadminAccess(data.user))){
    errEl.textContent='❌ This account does not have superadmin access.';errEl.style.display='block';
    await supa.auth.signOut(); return;
  }
  currentUser = data.user;
  showApp();
  await loadData();
}

async function doLogout() {
  await supa.auth.signOut();
  document.getElementById('app').style.display = 'none';
  showLogin();
}

// ── Load data from Supabase ───────────────────────────────────
async function loadData() {
  document.getElementById('content').innerHTML = '<div class="empty"><div class="spin" style="width:28px;height:28px;border-width:2px"></div></div>';
  try {
    await loadConfig(); // load plan/trial config first
    var { data, error } = await supa.from('organisations').select('*').order('created_at', {ascending:false});
    if (error) throw error;
    orgs = data || [];
    lastLoaded = new Date();
    updateBadges();
    navigate(currentPage);
  } catch(e) {
    var hint = '';
    if (e && (e.code === '42501' || (e.message && e.message.toLowerCase().indexOf('permission') >= 0))) {
      hint = '<div style="font-size:11px;color:var(--muted);margin-top:10px;max-width:420px;line-height:1.5">If the list is empty but organisations exist in the database, run <code style="font-size:10px">db/superadmin_rls_policies.sql</code> in the Supabase SQL editor so superadmin JWTs can read <code style="font-size:10px">organisations</code>.</div>';
    }
    document.getElementById('content').innerHTML =
      '<div class="empty"><div class="empty-icon">⚠️</div><div style="font-size:14px;font-weight:600;margin-bottom:8px">Could not load data</div><div style="font-size:12px;color:var(--muted)">' + (e && e.message ? e.message : String(e)) + '</div>' + hint + '</div>';
  }
}

/** Trial tab: classic trial status/plan, active free tier, or orgs still inside trial_ends_at. */
function isTrialsTabOrg(o) {
  if (!o || o.status === 'cancelled') return false;
  if (o.status === 'trial' || o.plan === 'trial') return true;
  if (o.plan === 'free' && o.status === 'active') return true;
  if (o.trial_ends_at) {
    try {
      return new Date(o.trial_ends_at) > new Date();
    } catch (err) { return false; }
  }
  return false;
}

function updateBadges() {
  document.getElementById('badge-total').textContent     = orgs.length;
  document.getElementById('badge-trials').textContent    = orgs.filter(isTrialsTabOrg).length;
  document.getElementById('badge-cancelled').textContent = orgs.filter(o=>o.status==='cancelled').length;
}

// ── Navigation ────────────────────────────────────────────────
var PAGE_TITLES = {
  dashboard:'Dashboard', companies:'All Companies', trials:'Trials & free',
  cancelled:'Cancelled', revenue:'MRR & Plans', activity:'Activity',
  settings:'Plans & Pricing'
};

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('active'));
  var navEl = document.getElementById('nav-'+page);
  if(navEl) navEl.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[page]||page;
  document.getElementById('page-sub').textContent = lastLoaded ? 'Last updated ' + lastLoaded.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';

  var pages = {
    dashboard:  renderDashboard,
    companies:  ()=>renderOrgList(orgs),
    trials:     ()=>renderOrgList(orgs.filter(isTrialsTabOrg)),
    cancelled:  ()=>renderOrgList(orgs.filter(o=>o.status==='cancelled')),
    revenue:    renderRevenue,
    activity:   renderActivity,
    settings:   renderSettings,
  };
  document.getElementById('content').innerHTML = (pages[page]||renderDashboard)();
}

// ── Formatters ────────────────────────────────────────────────
function fmt(n){ return '£'+(+n||0).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function daysUntil(d){ return Math.ceil((new Date(d)-new Date())/(1000*60*60*24)); }
function planClass(p){ var m={'trial':'plan-trial','free':'plan-free','starter':'plan-starter','professional':'plan-professional','business':'plan-business'}; return m[p]||'plan-trial'; }
function statusClass(s){ var m={'trial':'trial','active':'active','paused':'paused','cancelled':'cancelled'}; return m[s]||'paused'; }
function orgColor(name){ var colors=['#00D897','#4B9EFF','#9B8AFF','#F5A623','#FF4D6A','#06B6D4']; return colors[name.charCodeAt(0)%colors.length]; }
function orgInitials(name){ return name.split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase(); }

// ── Plan config (loaded from Supabase, falls back to defaults) ────────────────
var PLAN_CONFIG = {
  trial:        { price:0,   days:14,  seats:3,  properties:5,  label:'Trial',        features:['Dashboard','Properties','Tenants','Rent Collection'] },
  free:         { price:0,   days:null, seats:1,  properties:3,  tenants:15, label:'Free',         features:['Up to 3 properties','Up to 15 tenants','Dashboard','Rent tracking'] },
  starter:      { price:49,  days:null, seats:3,  properties:15, label:'Starter',      features:['Dashboard','Properties','Tenants','Rent Collection','WhatsApp sharing'] },
  professional: { price:89,  days:null, seats:5,  properties:25, label:'Professional', features:['Everything in Starter','Tenancy agreements','Document vault','Landlord payments','Late fee automation'] },
  business:     { price:149, days:null, seats:15, properties:60, label:'Business',     features:['Everything in Professional','Available rooms page','Priority support','Role-based access'] },
};
var TRIAL_DURATION_DAYS = 14;

var PLAN_MRR = { trial:0, starter:49, professional:89, business:149 };
function syncPlanMRR(){ Object.keys(PLAN_CONFIG).forEach(function(k){ PLAN_MRR[k]=PLAN_CONFIG[k].price||0; }); }
function calcMRR(org){ return org.mrr || PLAN_MRR[org.plan||'trial'] || 0; }
function totalMRR(){ return orgs.filter(o=>o.status==='active').reduce((s,o)=>s+calcMRR(o),0); }

async function loadConfig() {
  try {
    var { data } = await supa.from('saas_config').select('*');
    if(data && data.length) {
      data.forEach(function(row){
        if(row.key === 'plan_config')    PLAN_CONFIG = JSON.parse(row.value);
        if(row.key === 'trial_days')     TRIAL_DURATION_DAYS = +row.value || 14;
      });
      syncPlanMRR();
    }
  } catch(e) { /* table may not exist yet, use defaults */ }
}

async function saveConfig(key, value) {
  try {
    await supa.from('saas_config').upsert([{key, value: JSON.stringify(value)}], {onConflict:'key'});
  } catch(e) { alert('Save failed: '+e.message); }
}

// ── Settings / Plans & Pricing page ──────────────────────────────────────────
function renderSettings() {
  var plans = ['trial','free','starter','professional','business'];
  return `
    <!-- Trial Rules -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div><div class="card-title">⏳ Trial Rules</div><div class="card-sub">Applied when a new company registers</div></div>
        <button class="btn-primary" style="font-size:12px;padding:7px 16px" onclick="saveTrialConfig()">Save Trial Settings</button>
      </div>
      <div style="padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px">Trial Duration (days)</label>
          <input class="inp" id="cfg-trial-days" type="number" min="1" max="90" value="${TRIAL_DURATION_DAYS}" style="font-size:22px;font-weight:700;text-align:center;font-family:'DM Mono',monospace">
          <div style="font-size:11px;color:var(--muted);margin-top:6px">New signups get this many days free</div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px">Trial Plan</label>
          <select class="inp" id="cfg-trial-plan" style="font-size:15px;font-weight:600">
            ${plans.map(p=>`<option value="${p}" ${p==='trial'?'selected':''}>${PLAN_CONFIG[p]?.label||p}</option>`).join('')}
          </select>
          <div style="font-size:11px;color:var(--muted);margin-top:6px">Plan features available during trial</div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px">Trial Seats</label>
          <input class="inp" id="cfg-trial-seats" type="number" min="1" max="20" value="${PLAN_CONFIG.trial?.seats||3}" style="font-size:22px;font-weight:700;text-align:center;font-family:'DM Mono',monospace">
          <div style="font-size:11px;color:var(--muted);margin-top:6px">Max users during trial</div>
        </div>
      </div>
      <div style="padding:0 20px 16px">
        <div style="background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--amber)">
          ⚠️ Trial enforcement in the main app is handled by checking <code style="background:rgba(255,255,255,.1);padding:2px 5px;border-radius:4px">organisations.status</code> and <code style="background:rgba(255,255,255,.1);padding:2px 5px;border-radius:4px">trial_ends_at</code> on every login. Expired trials show a locked screen.
        </div>
      </div>
    </div>

    <!-- Plan Pricing -->
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">💷 Plans & Pricing</div><div class="card-sub">Changes apply immediately to MRR calculations and new signups</div></div>
        <button class="btn-primary" style="font-size:12px;padding:7px 16px" onclick="savePlanConfig()">Save All Plans</button>
      </div>
      <div style="padding:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
        ${['free','starter','professional','business'].map(function(plan){
          var cfg = PLAN_CONFIG[plan]||{};
          var color = plan==='business'?'var(--purple)':plan==='professional'?'var(--green)':'var(--blue)';
          return `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:16px">
            <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px">${cfg.label||plan}</div>

            <div style="margin-bottom:12px">
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Monthly Price (£)</label>
              <div style="display:flex;align-items:center;gap:4px">
                <span style="font-size:20px;color:var(--muted)">£</span>
                <input class="inp" id="plan-${plan}-price" type="number" min="0" value="${cfg.price||0}" style="font-size:24px;font-weight:700;text-align:center;font-family:'DM Mono',monospace;color:${color}">
              </div>
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Max Properties</label>
              <input class="inp" id="plan-${plan}-props" type="number" min="1" value="${cfg.properties||10}" style="text-align:center;font-weight:700">
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Max Users (seats)</label>
              <input class="inp" id="plan-${plan}-seats" type="number" min="1" value="${cfg.seats||3}" style="text-align:center;font-weight:700">
            </div>

            <div>
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Features (one per line)</label>
              <textarea class="inp" id="plan-${plan}-features" rows="6" style="resize:vertical;font-size:12px;line-height:1.5">${(cfg.features||[]).join('\n')}</textarea>
            </div>

            <div style="margin-top:12px;padding:10px;background:var(--surface);border-radius:8px;text-align:center">
              <div style="font-size:10px;color:var(--muted);margin-bottom:2px">ARR at current signups</div>
              <div style="font-size:16px;font-weight:700;font-family:'DM Mono',monospace;color:${color}">
                ${fmt((cfg.price||0) * orgs.filter(o=>o.plan===plan&&o.status==='active').length * 12)}
              </div>
              <div style="font-size:10px;color:var(--dim)">${orgs.filter(o=>o.plan===plan&&o.status==='active').length} active co.</div>
            </div>
          </div>`;
        }).join('')}

        <!-- Trial column (read-only pricing) -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;opacity:.7">
          <div style="font-size:12px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px">Trial</div>
          <div style="font-size:28px;font-weight:700;font-family:'DM Mono',monospace;color:var(--amber);margin-bottom:4px">Free</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:14px">${TRIAL_DURATION_DAYS} days</div>
          <div style="font-size:10px;color:var(--dim)">Configure trial duration and seats in the Trial Rules section above.</div>
        </div>
      </div>
    </div>`;
}

async function saveTrialConfig() {
  var days  = +document.getElementById('cfg-trial-days').value  || 14;
  var seats = +document.getElementById('cfg-trial-seats').value || 3;
  TRIAL_DURATION_DAYS = days;
  PLAN_CONFIG.trial.seats = seats;
  await saveConfig('trial_days', days);
  await saveConfig('plan_config', PLAN_CONFIG);
  showToast('Trial settings saved ✓');
}

async function savePlanConfig() {
  ['starter','professional','business'].forEach(function(plan){
    PLAN_CONFIG[plan].price      = +document.getElementById('plan-'+plan+'-price').value    || 0;
    PLAN_CONFIG[plan].properties = +document.getElementById('plan-'+plan+'-props').value    || 10;
    PLAN_CONFIG[plan].seats      = +document.getElementById('plan-'+plan+'-seats').value    || 3;
    var featEl = document.getElementById('plan-'+plan+'-features');
    PLAN_CONFIG[plan].features   = featEl ? featEl.value.split('\n').map(function(s){return s.trim();}).filter(Boolean) : [];
  });
  syncPlanMRR();
  await saveConfig('plan_config', PLAN_CONFIG);
  showToast('Plan pricing saved ✓');
  navigate('settings'); // re-render to show updated ARR
}

function showToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--green);color:#000;font-weight:700;font-size:13px;padding:10px 20px;border-radius:10px;z-index:9999;animation:fadeIn .2s ease';
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 2500);
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  var active   = orgs.filter(o=>o.status==='active').length;
  var trials   = orgs.filter(o=>o.status==='trial').length;
  var mrr      = totalMRR();
  var churn    = orgs.filter(o=>o.status==='cancelled').length;
  var expiringTrials = orgs.filter(o=>{
    if(o.status!=='trial'||!o.trial_ends_at) return false;
    var d=daysUntil(o.trial_ends_at); return d>=0&&d<=7;
  });

  var alerts = '';
  if(expiringTrials.length) {
    alerts += '<div class="alert warn">⚠️ '+expiringTrials.length+' trial'+(expiringTrials.length>1?'s':'')+' expiring within 7 days — '
      +expiringTrials.map(o=>'<strong>'+o.name+'</strong>').join(', ')+'</div>';
  }

  // Recent signups
  var recent = orgs.slice(0,5);

  return alerts + `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Monthly Recurring Revenue</div>
        <div class="kpi-val">${fmt(mrr)}</div>
        <div class="kpi-sub"><span class="kpi-up">↑</span> from ${active} active companies</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Active Companies</div>
        <div class="kpi-val">${active}</div>
        <div class="kpi-sub">of ${orgs.length} total registered</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Active Trials</div>
        <div class="kpi-val" style="color:var(--amber)">${trials}</div>
        <div class="kpi-sub">${expiringTrials.length} expiring this week</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Cancelled</div>
        <div class="kpi-val" style="color:var(--red)">${churn}</div>
        <div class="kpi-sub">churn rate: ${orgs.length?Math.round(churn/orgs.length*100):0}%</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px">
      <div class="card">
        <div class="card-header">
          <div><div class="card-title">Recent Companies</div><div class="card-sub">Last ${recent.length} registered</div></div>
          <button class="action-btn" onclick="navigate('companies')">View all →</button>
        </div>
        <table>
          <thead><tr><th>Company</th><th>Plan</th><th>Status</th><th>MRR</th><th>Joined</th></tr></thead>
          <tbody>${recent.map(o=>`
            <tr onclick="openOrgDetail('${o.id}')" style="cursor:pointer">
              <td><div style="display:flex;align-items:center;gap:10px">
                <div class="org-avatar" style="background:${orgColor(o.name)}22;color:${orgColor(o.name)}">${orgInitials(o.name)}</div>
                <div><div class="org-name">${o.name}</div><div class="org-meta">${o.owner_email||'—'}</div></div>
              </div></td>
              <td><span class="plan-pill ${planClass(o.plan)}">${o.plan||'trial'}</span></td>
              <td><span class="pill ${statusClass(o.status)}">${o.status||'trial'}</span></td>
              <td class="mono">${o.status==='active'?fmt(calcMRR(o)):'—'}</td>
              <td style="color:var(--muted)">${fmtDate(o.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Plan Breakdown</div></div>
        <div style="padding:16px 20px">
          ${['business','professional','starter','trial'].map(plan=>{
            var count = orgs.filter(o=>o.plan===plan).length;
            var rev   = orgs.filter(o=>o.plan===plan&&o.status==='active').reduce((s,o)=>s+calcMRR(o),0);
            var pct   = orgs.length ? Math.round(count/orgs.length*100) : 0;
            return `<div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span class="plan-pill ${planClass(plan)}" style="font-size:11px">${plan}</span>
                <span style="font-size:12px;color:var(--muted)">${count} co. · ${fmt(rev)}/mo</span>
              </div>
              <div class="usage-bar" style="width:100%;height:5px">
                <div class="usage-fill" style="width:${pct}%;background:${plan==='business'?'var(--purple)':plan==='professional'?'var(--green)':plan==='starter'?'var(--blue)':'var(--amber)'}"></div>
              </div>
            </div>`;
          }).join('')}
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);display:flex;justify-content:space-between">
            <span style="font-size:12px;color:var(--muted)">Total MRR</span>
            <span style="font-size:16px;font-weight:700;font-family:'DM Mono',monospace;color:var(--green)">${fmt(mrr)}</span>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Org list ──────────────────────────────────────────────────
function renderOrgList(data) {
  var q = '';
  var filtered = data;

  setTimeout(function(){
    var inp = document.getElementById('org-search');
    if(inp) inp.oninput = function(){
      q = this.value.toLowerCase();
      filtered = data.filter(o=>o.name.toLowerCase().includes(q)||(o.owner_email||'').toLowerCase().includes(q));
      renderOrgTable(filtered);
    };
  }, 50);

  return `
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">${data.length} Compan${data.length===1?'y':'ies'}</div></div>
        <div style="display:flex;gap:8px">
          <input id="org-search" class="search-inp" placeholder="Search companies…">
          <select class="filter-sel" onchange="filterOrgs(this.value,'${currentPage}')">
            <option value="">All statuses</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      ${data.length===0
        ? '<div class="empty"><div class="empty-icon">🏢</div><div>No companies here yet</div></div>'
        : `<table>
            <thead><tr><th>Company</th><th>Plan</th><th>Status</th><th>MRR</th><th>Trial / Renewal</th><th>Actions</th></tr></thead>
            <tbody id="org-tbody">${data.map(orgRow).join('')}</tbody>
          </table>`}
    </div>`;
}

function orgRow(o) {
  var d = o.status==='trial'&&o.trial_ends_at ? daysUntil(o.trial_ends_at) : null;
  var trialStr = d!==null ? (d<0?'<span style="color:var(--red)">Expired</span>':'<span class="trial-days" style="color:'+(d<=3?'var(--red)':d<=7?'var(--amber)':'var(--muted)')+'">'+d+'d left</span>') : '';
  var mrr = calcMRR(o);
  return `<tr style="cursor:pointer" onclick="openOrgDetail('${o.id}')">
    <td><div style="display:flex;align-items:center;gap:10px">
      <div class="org-avatar" style="background:${orgColor(o.name)}22;color:${orgColor(o.name)}">${orgInitials(o.name)}</div>
      <div><div class="org-name">${o.name}</div><div class="org-meta">${o.owner_email||'No email'}</div></div>
    </div></td>
    <td><span class="plan-pill ${planClass(o.plan)}">${o.plan||'trial'}</span></td>
    <td><span class="pill ${statusClass(o.status)}">${o.status||'trial'}</span></td>
    <td class="mono" style="color:${mrr?'var(--green)':'var(--dim)'}">${o.status==='active'&&mrr?fmt(mrr):'—'}</td>
    <td style="font-size:12px">${trialStr||fmtDate(o.trial_ends_at)||'—'}</td>
    <td onclick="event.stopPropagation()"><div style="display:flex;gap:5px">
      <button class="action-btn" onclick="openOrgDetail('${o.id}')">View</button>
      <button class="action-btn" onclick="quickStatus('${o.id}','active')" title="Activate">✓</button>
    </div></td>
  </tr>`;
}

function renderOrgTable(data) {
  var tbody = document.getElementById('org-tbody');
  if(tbody) tbody.innerHTML = data.map(orgRow).join('');
}

function filterOrgs(status, page) {
  var base = page==='trials' ? orgs.filter(o=>o.status==='trial')
           : page==='cancelled' ? orgs.filter(o=>o.status==='cancelled')
           : orgs;
  renderOrgTable(status ? base.filter(o=>o.status===status) : base);
}

// ── Revenue page ──────────────────────────────────────────────
function renderRevenue() {
  var byPlan = ['starter','professional','business'].map(function(plan){
    var cos = orgs.filter(o=>o.plan===plan&&o.status==='active');
    return {plan, count:cos.length, rev:cos.reduce((s,o)=>s+calcMRR(o),0)};
  });
  var mrr = totalMRR();
  var arr = mrr * 12;

  return `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">MRR</div><div class="kpi-val" style="color:var(--green)">${fmt(mrr)}</div><div class="kpi-sub">Monthly recurring</div></div>
      <div class="kpi-card"><div class="kpi-label">ARR</div><div class="kpi-val">${fmt(arr)}</div><div class="kpi-sub">Annual run rate</div></div>
      <div class="kpi-card"><div class="kpi-label">Paying Companies</div><div class="kpi-val">${orgs.filter(o=>o.status==='active').length}</div><div class="kpi-sub">Active subscriptions</div></div>
      <div class="kpi-card"><div class="kpi-label">ARPU</div><div class="kpi-val">${orgs.filter(o=>o.status==='active').length?fmt(Math.round(mrr/orgs.filter(o=>o.status==='active').length)):'£0'}</div><div class="kpi-sub">Avg revenue per user</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Revenue by Plan</div></div>
      <table>
        <thead><tr><th>Plan</th><th>Price</th><th>Companies</th><th>MRR</th><th>% of Revenue</th></tr></thead>
        <tbody>
          ${byPlan.map(function(p){
            var pct = mrr ? Math.round(p.rev/mrr*100) : 0;
            return `<tr>
              <td><span class="plan-pill ${planClass(p.plan)}">${p.plan}</span></td>
              <td class="mono">£${PLAN_MRR[p.plan]}/mo</td>
              <td>${p.count}</td>
              <td class="mono" style="color:var(--green)">${fmt(p.rev)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="usage-bar" style="width:100px"><div class="usage-fill" style="width:${pct}%;background:var(--green)"></div></div>
                  <span style="font-size:12px;color:var(--muted)">${pct}%</span>
                </div>
              </td>
            </tr>`;
          }).join('')}
          <tr style="font-weight:700">
            <td colspan="2" style="color:var(--muted)">Total</td>
            <td>${orgs.filter(o=>o.status==='active').length}</td>
            <td class="mono" style="color:var(--green)">${fmt(mrr)}</td>
            <td style="color:var(--muted)">100%</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

// ── Activity ──────────────────────────────────────────────────
function renderActivity() {
  var sorted = orgs.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,20);
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">Recent Registrations</div><div class="card-sub">Latest 20 companies</div></div>
      <table>
        <thead><tr><th>Company</th><th>Email</th><th>Plan</th><th>Status</th><th>Registered</th></tr></thead>
        <tbody>${sorted.map(o=>`<tr onclick="openOrgDetail('${o.id}')" style="cursor:pointer">
          <td><div style="display:flex;align-items:center;gap:10px">
            <div class="org-avatar" style="background:${orgColor(o.name)}22;color:${orgColor(o.name)};width:28px;height:28px;font-size:10px;border-radius:7px">${orgInitials(o.name)}</div>
            <span style="font-weight:600">${o.name}</span>
          </div></td>
          <td style="color:var(--muted)">${o.owner_email||'—'}</td>
          <td><span class="plan-pill ${planClass(o.plan)}">${o.plan||'trial'}</span></td>
          <td><span class="pill ${statusClass(o.status)}">${o.status||'trial'}</span></td>
          <td style="color:var(--muted)">${fmtDate(o.created_at)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// ── Org detail modal ──────────────────────────────────────────
function openOrgDetail(id) {
  var o = orgs.find(function(x){ return x.id===id; });
  if(!o) return;
  var d = o.status==='trial'&&o.trial_ends_at ? daysUntil(o.trial_ends_at) : null;
  document.getElementById('modal-inner').innerHTML = `
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="org-avatar" style="width:40px;height:40px;font-size:14px;border-radius:10px;background:${orgColor(o.name)}22;color:${orgColor(o.name)}">${orgInitials(o.name)}</div>
        <div>
          <div class="modal-title">${o.name}</div>
          <div style="font-size:12px;color:var(--muted)">${o.owner_email||'No email'}</div>
        </div>
      </div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Status</div>
          <span class="pill ${statusClass(o.status)}" style="font-size:12px">${o.status}</span>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Plan</div>
          <span class="plan-pill ${planClass(o.plan)}" style="font-size:12px">${o.plan||'trial'}</span>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">MRR</div>
          <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;color:var(--green)">${o.status==='active'?fmt(calcMRR(o)):'—'}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">${o.status==='trial'?'Trial ends':'Joined'}</div>
          <div style="font-size:13px;font-weight:600;color:${d!==null&&d<=7?'var(--amber)':'var(--text)'}">${o.status==='trial'?fmtDate(o.trial_ends_at)+(d!==null?' ('+d+'d)':''):fmtDate(o.created_at)}</div>
        </div>
      </div>
      ${o.phone?`<div style="font-size:13px;color:var(--muted)">📞 ${o.phone}</div>`:''}
      ${o.stripe_subscription_id?`<div style="font-size:12px;color:var(--dim)">Stripe: ${o.stripe_subscription_id}</div>`:''}

      <div style="padding-top:4px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Change Status</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${['trial','active','paused','cancelled'].map(s=>`
            <button onclick="quickStatus('${o.id}','${s}');closeModal()" style="padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid var(--border2);background:${o.status===s?'var(--green)':'transparent'};color:${o.status===s?'#000':'var(--muted)'}">${s}</button>
          `).join('')}
        </div>
      </div>
      <div style="padding-top:4px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Change Plan</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${['trial','starter','professional','business'].map(p=>`
            <button onclick="quickPlan('${o.id}','${p}');closeModal()" style="padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid var(--border2);background:${o.plan===p?'var(--green)':'transparent'};color:${o.plan===p?'#000':'var(--muted)'}">${p}</button>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn-primary" onclick="openEditOrgModal('${o.id}');closeModal()">✏️ Edit Details</button>
    </div>`;
  openModal();
}

// ── Add / Edit org modals ─────────────────────────────────────
function openAddOrgModal() {
  document.getElementById('modal-inner').innerHTML = orgForm(null);
  openModal();
}
function openEditOrgModal(id) {
  var o = orgs.find(function(x){ return x.id===id; });
  document.getElementById('modal-inner').innerHTML = orgForm(o);
  openModal();
}

function orgForm(o) {
  var isEdit = !!o;
  return `
    <div class="modal-head">
      <div class="modal-title">${isEdit?'Edit: '+o.name:'Add New Company'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="field"><label>Company Name *</label><input class="inp" id="of-name" value="${isEdit?o.name:''}" placeholder="e.g. Smith Properties Ltd"></div>
      <div class="row-2">
        <div class="field"><label>Owner Email</label><input class="inp" id="of-email" type="email" value="${isEdit?(o.owner_email||''):''}" placeholder="owner@email.com"></div>
        <div class="field"><label>Phone</label><input class="inp" id="of-phone" value="${isEdit?(o.phone||''):''}" placeholder="07911000000"></div>
      </div>
      <div class="row-2">
        <div class="field"><label>Plan</label>
          <select class="inp" id="of-plan">
            ${['trial','free','starter','professional','business'].map(p=>`<option value="${p}" ${isEdit&&o.plan===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select class="inp" id="of-status">
            ${['trial','active','paused','cancelled'].map(s=>`<option value="${s}" ${isEdit&&o.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row-2">
        <div class="field"><label>Trial Ends</label><input class="inp" id="of-trial" type="date" value="${isEdit&&o.trial_ends_at?o.trial_ends_at.split('T')[0]:''}"></div>
        <div class="field"><label>MRR Override (£)</label><input class="inp" id="of-mrr" type="number" value="${isEdit?(o.mrr||''):''}" placeholder="Auto from plan"></div>
      </div>
      ${isEdit?`<div class="field"><label>Stripe Subscription ID</label><input class="inp" id="of-stripe" value="${o.stripe_subscription_id||''}" placeholder="sub_..."></div>`:''}
    </div>
    <div class="modal-foot">
      ${isEdit?`<button class="btn-danger" onclick="deleteOrg('${o.id}')">Delete</button>`:''}
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveOrg(${isEdit?"'"+o.id+"'":'null'})">${isEdit?'Save Changes':'Add Company'}</button>
    </div>`;
}

async function saveOrg(id) {
  var name   = document.getElementById('of-name').value.trim();
  if(!name){ alert('Please enter a company name.'); return; }
  var data = {
    name,
    owner_email: document.getElementById('of-email').value.trim()||null,
    phone:       document.getElementById('of-phone').value.trim()||null,
    plan:        document.getElementById('of-plan').value,
    status:      document.getElementById('of-status').value,
    trial_ends_at: document.getElementById('of-trial').value||null,
    mrr:         +(document.getElementById('of-mrr')||{value:0}).value||null,
    slug:        name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
  };
  if(document.getElementById('of-stripe')) data.stripe_subscription_id = document.getElementById('of-stripe').value.trim()||null;

  var result;
  if(id) {
    result = await supa.from('organisations').update(data).eq('id', id);
  } else {
    result = await supa.from('organisations').insert([data]);
  }
  if(result.error){ alert('Error: '+result.error.message); return; }
  closeModal();
  await loadData();
}

async function quickStatus(id, status) {
  await supa.from('organisations').update({status}).eq('id', id);
  await loadData();
}
async function quickPlan(id, plan) {
  await supa.from('organisations').update({plan}).eq('id', id);
  await loadData();
}
async function deleteOrg(id) {
  var o = orgs.find(function(x){ return x.id===id; });
  if(!confirm('Delete '+( o?o.name:'this company')+'?\n\nThis removes the organisation record only — their data tables are not deleted.')) return;
  await supa.from('organisations').delete().eq('id', id);
  closeModal();
  await loadData();
}

function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
