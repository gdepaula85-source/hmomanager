const SUPA_URL = window.ENV.SUPA_URL;
const SUPA_KEY = window.ENV.SUPA_KEY;

// Superadmin access is controlled by the superadmin_allowlist table + superadmin_organisations view.
// To grant access: INSERT INTO public.superadmin_allowlist (email) VALUES ('you@company.com');
// No hardcoded emails — all managed in the database. See db/superadmin_rls_policies.sql.
const SUPERADMIN_EMAILS = [];

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
var allUsers = [];
var auditLog = [];
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

  // Inject Admins nav if not already in HTML
  var logsNav = document.getElementById('nav-logs');
  if (logsNav && !document.getElementById('nav-admins')) {
    var adminBtn = document.createElement('button');
    adminBtn.className = 'sb-item';
    adminBtn.id = 'nav-admins';
    adminBtn.onclick = function() { navigate('admins'); };
    adminBtn.innerHTML = '<span class="icon">🛡️</span> Admins';
    logsNav.parentNode.insertBefore(adminBtn, logsNav.nextSibling);
  }
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
    // Load users in background (non-blocking)
    loadUsers().then(function(u){ allUsers = u; updateBadges(); }).catch(function(){ /* silent */ });
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

// ── Load users from org_members ───────────────────────────────
async function loadUsers() {
  var { data, error } = await supa.from('org_members').select('id, user_id, role, created_at, org_id, organisations(name, owner_email)');
  if (error) { console.warn('loadUsers error:', error); return []; }
  return data || [];
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
  var badgeUsers = document.getElementById('badge-users');
  if (badgeUsers) badgeUsers.textContent = allUsers.length || '—';
}

// ── Audit Log helpers ─────────────────────────────────────────
function pushAudit(action, target, details) {
  auditLog.unshift({
    time: new Date(),
    action: action,
    target: target,
    details: details || ''
  });
  // keep last 200 entries max
  if (auditLog.length > 200) auditLog.length = 200;
}

// ── Org Health helpers ────────────────────────────────────────
function orgHealth(o) {
  if (!o) return { icon: '⚪', label: 'Unknown', cls: 'dim' };
  if (o.status === 'cancelled') return { icon: '🔴', label: 'Churned', cls: 'red' };
  if (o.status === 'paused') return { icon: '🟠', label: 'Needs Attention', cls: 'amber' };
  if (o.status === 'trial') {
    if (o.trial_ends_at) {
      var d = daysUntil(o.trial_ends_at);
      if (d < 7) return { icon: '🟡', label: 'At Risk', cls: 'amber' };
    }
    return { icon: '🟡', label: 'Trial', cls: 'amber' };
  }
  if (o.status === 'active' && calcMRR(o) > 0) return { icon: '🟢', label: 'Healthy', cls: 'green' };
  if (o.status === 'active') return { icon: '🟢', label: 'Active (free)', cls: 'green' };
  return { icon: '⚪', label: 'Unknown', cls: 'dim' };
}

function healthSummary() {
  var healthy = 0, atRisk = 0, needsAttention = 0, churned = 0;
  orgs.forEach(function(o) {
    var h = orgHealth(o);
    if (h.label === 'Healthy' || h.label === 'Active (free)') healthy++;
    else if (h.label === 'At Risk' || h.label === 'Trial') atRisk++;
    else if (h.label === 'Needs Attention') needsAttention++;
    else if (h.label === 'Churned') churned++;
  });
  return { healthy: healthy, atRisk: atRisk, needsAttention: needsAttention, churned: churned };
}

// ── Navigation ────────────────────────────────────────────────
var PAGE_TITLES = {
  dashboard:'Dashboard', companies:'All Companies', trials:'Trials & free',
  cancelled:'Cancelled', revenue:'MRR & Plans', activity:'Activity',
  settings:'Plans & Pricing', users:'All Users', logs:'Audit Log',
  admins:'Superadmin Access',
  blog:'Blog'
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
    companies:  function(){ return renderOrgList(orgs); },
    trials:     function(){ return renderOrgList(orgs.filter(isTrialsTabOrg)); },
    cancelled:  function(){ return renderOrgList(orgs.filter(function(o){ return o.status==='cancelled'; })); },
    revenue:    renderRevenue,
    activity:   renderActivity,
    settings:   renderSettings,
    users:      renderUsers,
    logs:       renderLogs,
    admins:     renderAdmins,
    blog:       renderBlog,
  };
  document.getElementById('content').innerHTML = (pages[page]||renderDashboard)();
}

// ── Formatters ────────────────────────────────────────────────
function fmt(n){ return '£'+(+n||0).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
/** Safe text for HTML attributes and content (avoids broken modals when names contain quotes). */
function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function daysUntil(d){ return Math.ceil((new Date(d)-new Date())/(1000*60*60*24)); }
function planClass(p){ var m={'trial':'plan-trial','free':'plan-free','starter':'plan-starter','professional':'plan-professional','business':'plan-business','enterprise':'plan-business'}; return m[p]||'plan-business'; }
function statusClass(s){ var m={'trial':'trial','active':'active','paused':'paused','cancelled':'cancelled'}; return m[s]||'paused'; }
function orgColor(name){ var colors=['#00D897','#4B9EFF','#9B8AFF','#F5A623','#FF4D6A','#06B6D4']; return colors[name.charCodeAt(0)%colors.length]; }
function orgInitials(name){ return name.split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase(); }
function fmtTime(d){ if(!d) return '—'; var dt = d instanceof Date ? d : new Date(d); return dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

// ── Plan config (loaded from Supabase, falls back to defaults) ────────────────
var PLAN_CONFIG = {
  trial:        { price:0,   days:14,  seats:3,  properties:5,  tenants:30,  label:'Trial',        features:['Dashboard','Properties','Tenants','Rent Collection'] },
  free:         { price:0,   days:null, seats:1,  properties:3,  tenants:15,  label:'Free',         features:['Up to 3 properties','Up to 15 tenants','Dashboard','Rent tracking'] },
  starter:      { price:49,  days:null, seats:3,  properties:15, tenants:75,  label:'Starter',      features:['Dashboard','Properties','Tenants','Rent Collection','WhatsApp sharing'] },
  professional: { price:89,  days:null, seats:5,  properties:25, tenants:0,   label:'Professional', features:['Everything in Starter','Tenancy agreements','Document vault','Landlord payments','Late fee automation'] },
  business:     { price:149, days:null, seats:15, properties:60, tenants:0,   label:'Business',     features:['Everything in Professional','Available rooms page','Priority support','Role-based access'] },
  enterprise:   { price:299, days:null, seats:0,  properties:0,  tenants:0,   label:'Enterprise',   features:['Everything in Business','Unlimited properties','Unlimited users','API access','Custom branding','Dedicated support'] },
};
var TRIAL_DURATION_DAYS = 14;

/** Returns all paid/self-serve plan keys in a consistent order. Dynamic — picks up new plans added via the UI. */
function getPaidPlanKeys() {
  var core  = ['free','starter','professional','business','enterprise'];
  var extra = Object.keys(PLAN_CONFIG).filter(function(k){ return k !== 'trial' && core.indexOf(k) < 0; });
  return core.filter(function(k){ return !!PLAN_CONFIG[k]; }).concat(extra);
}

/** Is this a user-added plan (vs. one of the built-in tiers)? */
function isCustomPlan(key) {
  return ['trial','free','starter','professional','business','enterprise'].indexOf(key) < 0;
}

function planColor(key) {
  var map = { free:'var(--muted)', starter:'var(--blue)', professional:'var(--green)', business:'var(--purple)', enterprise:'#F59E0B' };
  return map[key] || '#8B5CF6';
}

var PLAN_MRR = { trial:0, starter:49, professional:89, business:149, enterprise:299 };
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
  var plans = ['trial'].concat(getPaidPlanKeys());
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
      <div style="padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px">
        ${getPaidPlanKeys().map(function(plan){
          var cfg = PLAN_CONFIG[plan]||{};
          var color = planColor(plan);
          var isUnlimited = cfg.properties === 0;
          var isTenantsUnlimited = (cfg.tenants === 0 || cfg.tenants == null);
          var activeCos = orgs.filter(o=>o.plan===plan&&o.status==='active');
          var planMRR = activeCos.reduce((s,o)=>s+calcMRR(o),0);
          var custom = isCustomPlan(plan);
          return `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:16px;position:relative">
            ${custom ? `<button onclick="removeCustomPlan('${plan}')" title="Remove custom plan" style="position:absolute;top:8px;right:8px;background:transparent;border:1px solid var(--border2);color:var(--red);width:24px;height:24px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;line-height:1;font-family:inherit">×</button>` : ''}

            <div style="margin-bottom:14px">
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Plan Name</label>
              <input class="inp" id="plan-${plan}-label" type="text" value="${cfg.label||plan}" style="font-size:13px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.04em">
              <div style="font-size:10px;color:var(--dim);margin-top:4px">Key: <code style="background:var(--surface);padding:1px 5px;border-radius:4px">${plan}</code></div>
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Monthly Price (£)</label>
              <div style="display:flex;align-items:center;gap:4px">
                <span style="font-size:20px;color:var(--muted)">£</span>
                <input class="inp" id="plan-${plan}-price" type="number" min="0" value="${cfg.price||0}" style="font-size:24px;font-weight:700;text-align:center;font-family:'DM Mono',monospace;color:${color}">
              </div>
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Max Properties</label>
              <div style="display:flex;align-items:center;gap:8px">
                <input class="inp" id="plan-${plan}-props" type="number" min="1" value="${isUnlimited?'':cfg.properties||10}" placeholder="${isUnlimited?'∞':''}" ${isUnlimited?'disabled':''} style="text-align:center;font-weight:700;flex:1;${isUnlimited?'opacity:.4':''}">
                <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap;cursor:pointer;user-select:none">
                  <input type="checkbox" id="plan-${plan}-unlimited" ${isUnlimited?'checked':''} onchange="togglePlanUnlimited('${plan}')">
                  ∞
                </label>
              </div>
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Max Tenants</label>
              <div style="display:flex;align-items:center;gap:8px">
                <input class="inp" id="plan-${plan}-tenants" type="number" min="1" value="${isTenantsUnlimited?'':cfg.tenants||50}" placeholder="${isTenantsUnlimited?'∞':''}" ${isTenantsUnlimited?'disabled':''} style="text-align:center;font-weight:700;flex:1;${isTenantsUnlimited?'opacity:.4':''}">
                <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap;cursor:pointer;user-select:none">
                  <input type="checkbox" id="plan-${plan}-tenants-unlim" ${isTenantsUnlimited?'checked':''} onchange="togglePlanTenantsUnlimited('${plan}')">
                  ∞
                </label>
              </div>
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Max Users (seats)</label>
              <div style="display:flex;align-items:center;gap:8px">
                <input class="inp" id="plan-${plan}-seats" type="number" min="1" value="${cfg.seats===0?'':cfg.seats||3}" placeholder="${cfg.seats===0?'∞':''}" ${cfg.seats===0?'disabled':''} style="text-align:center;font-weight:700;flex:1;${cfg.seats===0?'opacity:.4':''}">
                <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap;cursor:pointer;user-select:none">
                  <input type="checkbox" id="plan-${plan}-seats-unlim" ${cfg.seats===0?'checked':''} onchange="togglePlanSeatsUnlimited('${plan}')">
                  ∞
                </label>
              </div>
            </div>

            <div>
              <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px">Features (one per line)</label>
              <textarea class="inp" id="plan-${plan}-features" rows="6" style="resize:vertical;font-size:12px;line-height:1.5">${(cfg.features||[]).join('\n')}</textarea>
            </div>

            <div style="margin-top:12px;padding:10px;background:var(--surface);border-radius:8px;text-align:center">
              <div style="font-size:10px;color:var(--muted);margin-bottom:2px">MRR · ARR at current signups</div>
              <div style="font-size:15px;font-weight:700;font-family:'DM Mono',monospace;color:${color}">${fmt(planMRR)}/mo · ${fmt(planMRR*12)}/yr</div>
              <div style="font-size:10px;color:var(--dim)">${activeCos.length} active co.</div>
            </div>
          </div>`;
        }).join('')}

        <!-- Add Plan card -->
        <div onclick="addCustomPlan()" style="background:var(--surface2);border:2px dashed var(--border2);border-radius:12px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;min-height:220px" onmouseover="this.style.borderColor='var(--green)';this.style.background='var(--surface)'" onmouseout="this.style.borderColor='var(--border2)';this.style.background='var(--surface2)'">
          <div style="font-size:36px;color:var(--green);line-height:1;margin-bottom:10px">+</div>
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Add Plan</div>
          <div style="font-size:11px;color:var(--muted);max-width:180px;line-height:1.4">Create a new pricing tier. Custom plans are saved alongside built-in ones.</div>
        </div>

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
  pushAudit('Save Trial Config', 'Settings', 'Days: ' + days + ', Seats: ' + seats);
  showToast('Trial settings saved ✓');
}

function togglePlanUnlimited(plan) {
  var cb  = document.getElementById('plan-'+plan+'-unlimited');
  var inp = document.getElementById('plan-'+plan+'-props');
  if (!cb || !inp) return;
  if (cb.checked) {
    inp.disabled = true; inp.value = ''; inp.placeholder = '∞'; inp.style.opacity = '.4';
  } else {
    inp.disabled = false; inp.placeholder = ''; inp.style.opacity = '1';
    if (!inp.value) inp.value = '10';
  }
}

function togglePlanTenantsUnlimited(plan) {
  var cb  = document.getElementById('plan-'+plan+'-tenants-unlim');
  var inp = document.getElementById('plan-'+plan+'-tenants');
  if (!cb || !inp) return;
  if (cb.checked) {
    inp.disabled = true; inp.value = ''; inp.placeholder = '∞'; inp.style.opacity = '.4';
  } else {
    inp.disabled = false; inp.placeholder = ''; inp.style.opacity = '1';
    if (!inp.value) inp.value = '50';
  }
}

function togglePlanSeatsUnlimited(plan) {
  var cb  = document.getElementById('plan-'+plan+'-seats-unlim');
  var inp = document.getElementById('plan-'+plan+'-seats');
  if (!cb || !inp) return;
  if (cb.checked) {
    inp.disabled = true; inp.value = ''; inp.placeholder = '∞'; inp.style.opacity = '.4';
  } else {
    inp.disabled = false; inp.placeholder = ''; inp.style.opacity = '1';
    if (!inp.value) inp.value = '3';
  }
}

function addCustomPlan() {
  var raw = prompt('New plan name (e.g. "Scale", "Partner", "Growth"):');
  if (!raw) return;
  var label = raw.trim();
  if (!label) return;
  var key = label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  if (!key) { showToast('Invalid plan key — use letters and numbers.', 'error'); return; }
  if (PLAN_CONFIG[key]) { showToast('A plan with that key already exists.', 'error'); return; }
  PLAN_CONFIG[key] = {
    price: 0, days: null, seats: 3, properties: 10,
    label: label,
    features: ['Custom plan — edit pricing and features, then Save All Plans']
  };
  pushAudit('Add Plan', 'Settings', 'Added "' + label + '" (key: ' + key + ')');
  showToast('Plan "' + label + '" added — set pricing and save.');
  navigate('settings');
}

function removeCustomPlan(key) {
  if (!isCustomPlan(key)) { showToast('Built-in plans can\'t be removed.', 'error'); return; }
  var inUse = orgs.filter(function(o){ return o.plan === key; }).length;
  var msg = 'Remove the "' + (PLAN_CONFIG[key]?.label||key) + '" plan?' + (inUse ? '\n\nWARNING: ' + inUse + ' organisation(s) are currently on this plan. They will need to be moved to another plan first.' : '');
  if (!confirm(msg)) return;
  delete PLAN_CONFIG[key];
  saveConfig('plan_config', PLAN_CONFIG).then(function(){
    pushAudit('Remove Plan', 'Settings', 'Removed plan key: ' + key);
    showToast('Plan removed.');
    navigate('settings');
  });
}

async function savePlanConfig() {
  getPaidPlanKeys().forEach(function(plan){
    if (!PLAN_CONFIG[plan]) PLAN_CONFIG[plan] = {};
    var labelEl     = document.getElementById('plan-'+plan+'-label');
    var priceEl     = document.getElementById('plan-'+plan+'-price');
    var propEl      = document.getElementById('plan-'+plan+'-props');
    var tenantsEl   = document.getElementById('plan-'+plan+'-tenants');
    var seatsEl     = document.getElementById('plan-'+plan+'-seats');
    var featEl      = document.getElementById('plan-'+plan+'-features');
    var propsUnlim  = document.getElementById('plan-'+plan+'-unlimited');
    var tenantsUnlim= document.getElementById('plan-'+plan+'-tenants-unlim');
    var seatsUnlim  = document.getElementById('plan-'+plan+'-seats-unlim');
    if (labelEl) PLAN_CONFIG[plan].label = labelEl.value.trim() || PLAN_CONFIG[plan].label || plan;
    PLAN_CONFIG[plan].price      = priceEl ? (+priceEl.value || 0) : (PLAN_CONFIG[plan].price || 0);
    PLAN_CONFIG[plan].properties = (propsUnlim && propsUnlim.checked) ? 0 : (propEl ? (+propEl.value || 10) : 10);
    PLAN_CONFIG[plan].tenants    = (tenantsUnlim && tenantsUnlim.checked) ? 0 : (tenantsEl ? (+tenantsEl.value || 50) : 50);
    PLAN_CONFIG[plan].seats      = (seatsUnlim && seatsUnlim.checked) ? 0 : (seatsEl ? (+seatsEl.value || 3)  : 3);
    PLAN_CONFIG[plan].features   = featEl ? featEl.value.split('\n').map(function(s){return s.trim();}).filter(Boolean) : (PLAN_CONFIG[plan].features||[]);
  });
  syncPlanMRR();
  await saveConfig('plan_config', PLAN_CONFIG);
  pushAudit('Save Plan Config', 'Settings', 'Updated pricing for ' + getPaidPlanKeys().length + ' plans');
  showToast('Plan pricing saved ✓');
  navigate('settings'); // re-render to show updated ARR
}

function showToast(msg, kind) {
  var t = document.createElement('div');
  t.textContent = msg;
  var bg = kind === 'error' ? '#DC2626' : '#059669';
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:'+bg+';color:#fff;font-weight:700;font-size:13px;padding:10px 20px;border-radius:10px;z-index:9999;max-width:min(420px,calc(100vw - 32px));line-height:1.35;animation:fadeIn .2s ease;box-shadow:0 4px 12px rgba(0,0,0,.15)';
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, kind === 'error' ? 4000 : 2500);
}

// ── Charts helpers (pure CSS/HTML) ────────────────────────────
function buildBarChart(items, maxVal) {
  // items: [{label, value, color, sub}]
  if (!maxVal) maxVal = Math.max.apply(null, items.map(function(i){ return i.value; }).concat([1]));
  return '<div style="display:flex;flex-direction:column;gap:10px">' + items.map(function(item) {
    var pct = Math.round((item.value / maxVal) * 100);
    return '<div style="display:flex;align-items:center;gap:10px">' +
      '<div style="min-width:90px;font-size:12px;font-weight:600;color:var(--text);text-align:right">' + escapeHtml(item.label) + '</div>' +
      '<div style="flex:1;background:var(--surface2);border-radius:6px;height:24px;overflow:hidden;position:relative">' +
        '<div style="height:100%;width:' + pct + '%;background:' + (item.color || 'var(--green)') + ';border-radius:6px;transition:width .3s ease;min-width:2px"></div>' +
        '<div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--text);font-family:\'DM Mono\',monospace">' + escapeHtml(String(item.value)) + (item.sub ? ' <span style="color:var(--muted);font-weight:400">' + escapeHtml(item.sub) + '</span>' : '') + '</div>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
}

function buildDonut(segments, totalLabel) {
  // segments: [{label, value, color}]
  var total = segments.reduce(function(s, seg){ return s + seg.value; }, 0);
  if (total === 0) return '<div style="text-align:center;color:var(--muted);padding:20px">No data</div>';

  var gradientParts = [];
  var cumulative = 0;
  segments.forEach(function(seg) {
    var startPct = (cumulative / total) * 100;
    cumulative += seg.value;
    var endPct = (cumulative / total) * 100;
    gradientParts.push(seg.color + ' ' + startPct.toFixed(1) + '% ' + endPct.toFixed(1) + '%');
  });

  var donutStyle = 'width:140px;height:140px;border-radius:50%;background:conic-gradient(' + gradientParts.join(',') + ');display:flex;align-items:center;justify-content:center;margin:0 auto';
  var innerStyle = 'width:80px;height:80px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-direction:column';

  var legend = segments.map(function(seg) {
    var pct = total ? Math.round((seg.value / total) * 100) : 0;
    return '<div style="display:flex;align-items:center;gap:8px;font-size:12px">' +
      '<div style="width:10px;height:10px;border-radius:3px;background:' + seg.color + ';flex-shrink:0"></div>' +
      '<span style="color:var(--text);font-weight:600">' + escapeHtml(seg.label) + '</span>' +
      '<span style="color:var(--muted);margin-left:auto;font-family:\'DM Mono\',monospace">' + seg.value + ' (' + pct + '%)</span>' +
    '</div>';
  }).join('');

  return '<div style="display:flex;align-items:center;gap:24px;padding:8px 0">' +
    '<div style="' + donutStyle + '"><div style="' + innerStyle + '">' +
      '<div style="font-size:18px;font-weight:700;font-family:\'DM Mono\',monospace;color:var(--text)">' + total + '</div>' +
      '<div style="font-size:9px;color:var(--muted);text-transform:uppercase">' + escapeHtml(totalLabel || 'Total') + '</div>' +
    '</div></div>' +
    '<div style="flex:1;display:flex;flex-direction:column;gap:6px">' + legend + '</div>' +
  '</div>';
}

function signupsByMonth() {
  var months = {};
  var now = new Date();
  // Initialize last 6 months
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    months[key] = { label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), count: 0 };
  }
  orgs.forEach(function(o) {
    if (!o.created_at) return;
    var dt = new Date(o.created_at);
    var key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    if (months[key] !== undefined) months[key].count++;
  });
  var result = [];
  Object.keys(months).forEach(function(k) {
    result.push({ label: months[k].label, value: months[k].count, color: 'var(--blue)' });
  });
  return result;
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
  var hs = healthSummary();

  var alerts = '';
  if(expiringTrials.length) {
    alerts += '<div class="alert warn">⚠️ '+expiringTrials.length+' trial'+(expiringTrials.length>1?'s':'')+' expiring within 7 days — '
      +expiringTrials.map(o=>'<strong>'+escapeHtml(o.name)+'</strong>').join(', ')+'</div>';
  }

  // Recent signups
  var recent = orgs.slice(0,5);

  // MRR by plan data for chart — dynamic across all paid plans (skip free, which has price 0)
  var _paidForChart = getPaidPlanKeys().filter(function(k){ return (PLAN_CONFIG[k] && (PLAN_CONFIG[k].price||0) > 0); });
  var mrrByPlan = _paidForChart.map(function(plan){
    var cos = orgs.filter(o=>o.plan===plan&&o.status==='active');
    var rev = cos.reduce(function(s,o){ return s+calcMRR(o); },0);
    return { label: (PLAN_CONFIG[plan] && PLAN_CONFIG[plan].label) || plan, value: rev, color: planColor(plan), sub: '/mo' };
  });

  // Plan distribution for donut — dynamic, trial/no-plan grouped together at the end
  var _donutPalette = { business:'#9B8AFF', professional:'#00D897', starter:'#4B9EFF', enterprise:'#F59E0B', free:'#06B6D4' };
  var planDist = getPaidPlanKeys().map(function(plan){
    return {
      label: (PLAN_CONFIG[plan] && PLAN_CONFIG[plan].label) || plan,
      value: orgs.filter(function(o){ return o.plan===plan; }).length,
      color: _donutPalette[plan] || '#8B5CF6'
    };
  }).concat([{ label: 'Trial', value: orgs.filter(function(o){ return o.plan==='trial'||!o.plan; }).length, color: '#F5A623' }]);

  var signupsData = signupsByMonth();

  // ── Extra granular metrics ───────────────────────────────────────────────
  var payingOrgs = orgs.filter(function(o){ return o.status==='active' && o.billing_override!=='free' && calcMRR(o) > 0; });
  var arr = mrr * 12;
  var arpu = payingOrgs.length ? Math.round(mrr / payingOrgs.length) : 0;
  var trialTotal = orgs.filter(function(o){ return o.trial_ends_at; }).length;
  var trialConverted = orgs.filter(function(o){ return o.trial_ends_at && o.status==='active' && o.billing_override!=='free'; }).length;
  var convRate = trialTotal ? Math.round(trialConverted / trialTotal * 100) : 0;
  var freeGrantCount = orgs.filter(function(o){ return o.billing_override==='free'; }).length;
  var todayTs = new Date(); todayTs.setHours(0,0,0,0);
  var freeUntilActive = orgs.filter(function(o){
    if(!o.free_until) return false;
    var d = new Date(o.free_until); return !isNaN(d.getTime()) && d >= todayTs;
  });
  var atRiskTrials = orgs.filter(function(o){
    return o.status==='trial' && o.trial_ends_at && daysUntil(o.trial_ends_at) >= 0 && daysUntil(o.trial_ends_at) <= 7;
  }).length;
  var topPaying = orgs.slice().sort(function(a,b){ return calcMRR(b) - calcMRR(a); }).slice(0,5);
  var growth30 = orgs.filter(function(o){
    if(!o.created_at) return false;
    var d = new Date(o.created_at);
    return !isNaN(d.getTime()) && (Date.now() - d.getTime()) / 86400000 <= 30;
  }).length;

  return alerts + `
    <!-- Granular metrics strip -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title">📊 Business Metrics</div><div style="font-size:10px;color:var(--dim);letter-spacing:.08em;text-transform:uppercase">Live</div></div>
      <div style="padding:14px 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        <div style="background:var(--surface2);border-radius:10px;padding:12px;border-left:3px solid var(--green)">
          <div style="font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin-bottom:4px">ARR</div>
          <div style="font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:var(--green)">${fmt(arr)}</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px">MRR × 12</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:12px;border-left:3px solid var(--blue)">
          <div style="font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin-bottom:4px">ARPU</div>
          <div style="font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:var(--blue)">${fmt(arpu)}</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px">${payingOrgs.length} paying</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:12px;border-left:3px solid var(--purple)">
          <div style="font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin-bottom:4px">TRIAL → PAID</div>
          <div style="font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:var(--purple)">${convRate}%</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px">${trialConverted} / ${trialTotal}</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:12px;border-left:3px solid ${atRiskTrials?'var(--amber)':'var(--dim)'}">
          <div style="font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin-bottom:4px">AT-RISK TRIALS</div>
          <div style="font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:${atRiskTrials?'var(--amber)':'var(--dim)'}">${atRiskTrials}</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px">≤ 7 days left</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:12px;border-left:3px solid var(--amber)">
          <div style="font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin-bottom:4px">FREE GRANTS</div>
          <div style="font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:var(--amber)">${freeGrantCount + freeUntilActive.length}</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px">${freeGrantCount} indef · ${freeUntilActive.length} time-boxed</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:12px;border-left:3px solid ${growth30?'var(--green)':'var(--dim)'}">
          <div style="font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin-bottom:4px">NEW (30 DAYS)</div>
          <div style="font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:${growth30?'var(--green)':'var(--dim)'}">${growth30}</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px">recent signups</div>
        </div>
      </div>
      ${topPaying.length ? `
      <div style="padding:6px 20px 16px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.06em;margin:8px 0 6px">TOP 5 BY MRR</div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${topPaying.map(function(o,i){
            var m = calcMRR(o);
            if(!m && o.billing_override !== 'free' && !o.free_until) return '';
            var tag = o.billing_override==='free' ? '<span style="font-size:9px;color:var(--amber);font-weight:700">FREE</span>' : o.free_until ? '<span style="font-size:9px;color:var(--amber);font-weight:700">GRANT</span>' : '';
            return '<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--surface2);border-radius:7px;font-size:12px">'
              + '<span style="color:var(--dim);font-weight:700;width:18px">'+(i+1)+'.</span>'
              + '<span style="flex:1;font-weight:600">'+escapeHtml(o.name||'—')+'</span>'
              + tag
              + '<span style="font-family:\'DM Mono\',monospace;font-weight:700;color:'+(m?'var(--green)':'var(--dim)')+'">'+(m?fmt(m):'—')+'</span>'
              + '</div>';
          }).filter(Boolean).join('')}
        </div>
      </div>` : ''}
    </div>

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

    <!-- Health Summary -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title">Organisation Health</div></div>
      <div style="padding:16px 20px;display:flex;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px;background:var(--surface2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;margin-bottom:4px">🟢</div>
          <div style="font-size:22px;font-weight:700;font-family:'DM Mono',monospace;color:var(--green)">${hs.healthy}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Healthy</div>
        </div>
        <div style="flex:1;min-width:120px;background:var(--surface2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;margin-bottom:4px">🟡</div>
          <div style="font-size:22px;font-weight:700;font-family:'DM Mono',monospace;color:var(--amber)">${hs.atRisk}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Trial / At Risk</div>
        </div>
        <div style="flex:1;min-width:120px;background:var(--surface2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;margin-bottom:4px">🟠</div>
          <div style="font-size:22px;font-weight:700;font-family:'DM Mono',monospace;color:var(--amber)">${hs.needsAttention}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Paused</div>
        </div>
        <div style="flex:1;min-width:120px;background:var(--surface2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;margin-bottom:4px">🔴</div>
          <div style="font-size:22px;font-weight:700;font-family:'DM Mono',monospace;color:var(--red)">${hs.churned}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Churned</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <!-- MRR by Plan chart -->
      <div class="card">
        <div class="card-header"><div class="card-title">MRR by Plan</div></div>
        <div style="padding:16px 20px">
          ${buildBarChart(mrrByPlan)}
        </div>
      </div>

      <!-- Plan Distribution donut -->
      <div class="card">
        <div class="card-header"><div class="card-title">Plan Distribution</div></div>
        <div style="padding:16px 20px">
          ${buildDonut(planDist, 'Orgs')}
        </div>
      </div>
    </div>

    <!-- Signups Over Time chart -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title">Signups Over Time</div><div class="card-sub">Last 6 months</div></div>
      <div style="padding:16px 20px">
        ${buildBarChart(signupsData)}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px">
      <div class="card">
        <div class="card-header">
          <div><div class="card-title">Recent Companies</div><div class="card-sub">Last ${recent.length} registered</div></div>
          <button class="action-btn" onclick="navigate('companies')">View all →</button>
        </div>
        <table>
          <thead><tr><th>Company</th><th>Plan</th><th>Status</th><th>Health</th><th>MRR</th><th>Joined</th></tr></thead>
          <tbody>${recent.map(o=>{
            var h = orgHealth(o);
            return `<tr onclick="openOrgDetail('${o.id}')" style="cursor:pointer">
              <td><div style="display:flex;align-items:center;gap:10px">
                <div class="org-avatar" style="background:${orgColor(o.name)}22;color:${orgColor(o.name)}">${orgInitials(o.name)}</div>
                <div><div class="org-name">${escapeHtml(o.name)}</div><div class="org-meta">${escapeHtml(o.owner_email||'—')}</div></div>
              </div></td>
              <td><span class="plan-pill ${planClass(o.plan)}">${escapeHtml(o.plan||'trial')}</span></td>
              <td><span class="pill ${statusClass(o.status)}">${escapeHtml(o.status||'trial')}</span></td>
              <td style="font-size:13px" title="${escapeHtml(h.label)}">${h.icon}</td>
              <td class="mono">${o.status==='active'?fmt(calcMRR(o)):'—'}</td>
              <td style="color:var(--muted)">${fmtDate(o.created_at)}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Plan Breakdown</div></div>
        <div style="padding:16px 20px">
          ${getPaidPlanKeys().filter(function(k){return k!=='free';}).concat(['trial']).map(plan=>{
            var count = orgs.filter(o=>o.plan===plan||(plan==='trial'&&!o.plan)).length;
            var rev   = orgs.filter(o=>o.plan===plan&&o.status==='active').reduce((s,o)=>s+calcMRR(o),0);
            var pct   = orgs.length ? Math.round(count/orgs.length*100) : 0;
            var label = plan==='trial' ? 'trial' : ((PLAN_CONFIG[plan]&&PLAN_CONFIG[plan].label)||plan).toLowerCase();
            var col   = plan==='trial' ? 'var(--amber)' : planColor(plan);
            return `<div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <span class="plan-pill ${planClass(plan)}" style="font-size:11px">${label}</span>
                <span style="font-size:12px;color:var(--muted)">${count} co. · ${fmt(rev)}/mo</span>
              </div>
              <div class="usage-bar" style="width:100%;height:5px">
                <div class="usage-fill" style="width:${pct}%;background:${col}"></div>
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
            <thead><tr><th>Company</th><th>Plan</th><th>Status</th><th>Health</th><th>MRR</th><th>Trial / Renewal</th><th>Actions</th></tr></thead>
            <tbody id="org-tbody">${data.map(orgRow).join('')}</tbody>
          </table>`}
    </div>`;
}

function orgRow(o) {
  var d = o.status==='trial'&&o.trial_ends_at ? daysUntil(o.trial_ends_at) : null;
  var trialStr = d!==null ? (d<0?'<span style="color:var(--red)">Expired</span>':'<span class="trial-days" style="color:'+(d<=3?'var(--red)':d<=7?'var(--amber)':'var(--muted)')+'">'+d+'d left</span>') : '';
  var mrr = calcMRR(o);
  var h = orgHealth(o);
  return `<tr style="cursor:pointer" onclick="openOrgDetail('${o.id}')">
    <td><div style="display:flex;align-items:center;gap:10px">
      <div class="org-avatar" style="background:${orgColor(o.name)}22;color:${orgColor(o.name)}">${orgInitials(o.name)}</div>
      <div><div class="org-name">${escapeHtml(o.name)}</div><div class="org-meta">${escapeHtml(o.owner_email||'No email')}</div></div>
    </div></td>
    <td><span class="plan-pill ${planClass(o.plan)}">${escapeHtml(o.plan||'trial')}</span></td>
    <td><span class="pill ${statusClass(o.status)}">${escapeHtml(o.status||'trial')}</span></td>
    <td style="font-size:13px" title="${escapeHtml(h.label)}">${h.icon}</td>
    <td class="mono" style="color:${mrr?'var(--green)':'var(--dim)'}">${(function(){
      if(o.billing_override==='free') return '<span class="billing-badge" style="font-size:9px;padding:2px 6px">FREE</span>';
      if(o.free_until){
        var fu = new Date(o.free_until); var tday = new Date(); tday.setHours(0,0,0,0);
        var dLeft = Math.ceil((fu - tday) / 86400000);
        if(!isNaN(dLeft) && dLeft >= 0){
          var col = dLeft <= 14 ? '#D97706' : '#059669';
          return '<span title="Free until '+escapeHtml(String(o.free_until).split("T")[0])+'" style="font-size:9px;font-weight:700;color:'+col+';background:#FFFBEB;border:1px solid #FDE68A;padding:2px 7px;border-radius:5px">FREE · '+dLeft+'d</span>';
        }
      }
      return o.status==='active' && mrr ? fmt(mrr) : '—';
    })()}</td>
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
  var byPlan = getPaidPlanKeys().filter(function(k){return (PLAN_CONFIG[k]&&(PLAN_CONFIG[k].price||0)>0);}).map(function(plan){
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
              <td><span class="plan-pill ${planClass(p.plan)}">${escapeHtml(p.plan)}</span></td>
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
            <span style="font-weight:600">${escapeHtml(o.name)}</span>
          </div></td>
          <td style="color:var(--muted)">${escapeHtml(o.owner_email||'—')}</td>
          <td><span class="plan-pill ${planClass(o.plan)}">${escapeHtml(o.plan||'trial')}</span></td>
          <td><span class="pill ${statusClass(o.status)}">${escapeHtml(o.status||'trial')}</span></td>
          <td style="color:var(--muted)">${fmtDate(o.created_at)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// ── Users Page ────────────────────────────────────────────────
function renderUsers() {
  var data = allUsers.slice();

  setTimeout(function(){
    var inp = document.getElementById('user-search');
    if (inp) inp.oninput = function(){
      var q = this.value.toLowerCase();
      var filtered = allUsers.filter(function(u) {
        var orgName = (u.organisations && u.organisations.name) || '';
        var email = (u.organisations && u.organisations.owner_email) || '';
        return orgName.toLowerCase().indexOf(q) >= 0 ||
               email.toLowerCase().indexOf(q) >= 0 ||
               (u.user_id || '').toLowerCase().indexOf(q) >= 0 ||
               (u.role || '').toLowerCase().indexOf(q) >= 0;
      });
      renderUserTable(filtered);
    };
  }, 50);

  return `
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">${data.length} User${data.length===1?'':'s'} Across All Organisations</div></div>
        <div style="display:flex;gap:8px">
          <input id="user-search" class="search-inp" placeholder="Search users by name, email, org…">
        </div>
      </div>
      ${data.length===0
        ? '<div class="empty"><div class="empty-icon">👥</div><div>No users found</div><div style="font-size:12px;color:var(--muted);margin-top:6px">Users appear here once they join an organisation via org_members.</div></div>'
        : `<table>
            <thead><tr><th>User ID</th><th>Organisation</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody id="user-tbody">${data.map(userRow).join('')}</tbody>
          </table>`}
    </div>`;
}

function userRow(u) {
  var orgName = (u.organisations && u.organisations.name) || '—';
  var orgEmail = (u.organisations && u.organisations.owner_email) || '';
  var roleCls = u.role === 'admin' ? 'color:var(--purple);' : u.role === 'manager' ? 'color:var(--blue);' : 'color:var(--muted);';
  return `<tr>
    <td><div>
      <div style="font-weight:600;font-size:13px">${escapeHtml(u.user_id ? u.user_id.substring(0, 12) + '...' : '—')}</div>
      <div style="font-size:11px;color:var(--muted)">${escapeHtml(orgEmail)}</div>
    </div></td>
    <td><span style="font-weight:600">${escapeHtml(orgName)}</span></td>
    <td><span style="font-size:12px;font-weight:700;${roleCls}text-transform:uppercase;letter-spacing:.04em">${escapeHtml(u.role || 'viewer')}</span></td>
    <td style="color:var(--muted)">${fmtDate(u.created_at)}</td>
    <td><div style="display:flex;gap:5px">
      <button class="action-btn" onclick="openEditUserModal('${escapeHtml(u.id)}')">Edit</button>
      <button class="action-btn" onclick="openSetPasswordModal('${escapeHtml(u.id)}')" title="Set Password">🔑</button>
      <button class="action-btn" style="color:var(--red)" onclick="removeUserFromOrg('${escapeHtml(u.id)}')" title="Remove from org">✕</button>
    </div></td>
  </tr>`;
}

function renderUserTable(data) {
  var tbody = document.getElementById('user-tbody');
  if (tbody) tbody.innerHTML = data.map(userRow).join('');
}

function openEditUserModal(memberId) {
  var u = allUsers.find(function(x){ return x.id === memberId; });
  if (!u) { showToast('User not found', 'error'); return; }
  var orgName = (u.organisations && u.organisations.name) || '—';

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal-head">
      <div class="modal-title">Edit User</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">User ID</div>
        <div style="font-size:13px;font-weight:600;font-family:'DM Mono',monospace;word-break:break-all">${escapeHtml(u.user_id || '—')}</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Organisation</div>
        <div style="font-size:13px;font-weight:600">${escapeHtml(orgName)}</div>
      </div>
      <div class="field">
        <label>Role</label>
        <select class="inp" id="eu-role">
          ${['admin','manager','viewer'].map(function(r){
            return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + r + '</option>';
          }).join('')}
        </select>
      </div>
      <div class="field">
        <label>Reassign to Organisation</label>
        <select class="inp" id="eu-org">
          ${orgs.map(function(o){
            return '<option value="' + escapeHtml(o.id) + '"' + (u.org_id === o.id ? ' selected' : '') + '>' + escapeHtml(o.name) + '</option>';
          }).join('')}
        </select>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveUserEdit('${escapeHtml(memberId)}')">Save Changes</button>
    </div>`;
  openModal();
}

async function saveUserEdit(memberId) {
  var role = document.getElementById('eu-role').value;
  var orgId = document.getElementById('eu-org').value;
  var updates = { role: role, org_id: orgId };
  var r = await supa.from('org_members').update(updates).eq('id', memberId).select('id');
  if (r.error) { showToast('Could not update user: ' + r.error.message, 'error'); return; }
  if (!r.data || !r.data.length) { showToast('Update blocked (RLS).', 'error'); return; }
  var u = allUsers.find(function(x){ return x.id === memberId; });
  var target = u ? (u.user_id || memberId) : memberId;
  pushAudit('Edit User', target, 'Role: ' + role + ', Org: ' + orgId);
  showToast('User updated');
  closeModal();
  allUsers = await loadUsers();
  updateBadges();
  if (currentPage === 'users') navigate('users');
}

async function resetUserPassword(memberId) {
  var u = allUsers.find(function(x){ return x.id === memberId; });
  if (!u) { showToast('User not found', 'error'); return; }
  var email = (u.organisations && u.organisations.owner_email) || '';
  if (!email) { showToast('No email found for this user. Cannot reset password.', 'error'); return; }
  if (!confirm('Send password reset email to ' + email + '?')) return;

  try {
    var session = await supa.auth.getSession();
    var token = session.data.session ? session.data.session.access_token : '';
    var resp = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ email: email })
    });
    if (!resp.ok) {
      var errBody = await resp.text();
      showToast('Reset failed: ' + errBody, 'error');
      return;
    }
    pushAudit('Reset Password', email, 'Sent password reset email');
    showToast('Password reset email sent to ' + email);
  } catch(e) {
    showToast('Reset failed: ' + e.message, 'error');
  }
}

function openSetPasswordModal(memberId) {
  var u = allUsers.find(function(x){ return x.id === memberId; });
  if (!u) { showToast('User not found', 'error'); return; }
  var email = (u.organisations && u.organisations.owner_email) || '';
  var orgName = (u.organisations && u.organisations.name) || '';

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal-head">
      <div class="modal-title">Set Password</div>
      <button class="modal-close" onclick="closeModal()">x</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:4px">
        <div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:2px">User</div>
        <div style="font-size:13px;font-weight:600">${escapeHtml(email || u.user_id || 'Unknown')}</div>
        ${orgName ? '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + escapeHtml(orgName) + '</div>' : ''}
      </div>
      <div style="background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--amber)">
        This directly changes the user's password. They will need to use the new password on their next login. Use "Send Reset Email" instead if you want them to choose their own password.
      </div>
      <div class="field">
        <label>New Password *</label>
        <input class="inp" id="sp-password" type="password" placeholder="Minimum 6 characters" autocomplete="new-password">
      </div>
      <div class="field">
        <label>Confirm Password *</label>
        <input class="inp" id="sp-confirm" type="password" placeholder="Repeat password" autocomplete="new-password">
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-secondary" style="font-size:12px;padding:7px 14px;flex:1" onclick="resetUserPassword('${escapeHtml(memberId)}')">Send Reset Email Instead</button>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="sp-save-btn" onclick="doSetPassword('${escapeHtml(memberId)}')">Set Password</button>
    </div>`;
  openModal();
}

async function doSetPassword(memberId) {
  var u = allUsers.find(function(x){ return x.id === memberId; });
  if (!u) { showToast('User not found', 'error'); return; }
  var pw = (document.getElementById('sp-password').value || '');
  var confirm = (document.getElementById('sp-confirm').value || '');
  if (pw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  if (pw !== confirm) { showToast('Passwords do not match', 'error'); return; }

  var btn = document.getElementById('sp-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Setting...'; }

  try {
    var session = await supa.auth.getSession();
    var token = session.data.session ? session.data.session.access_token : '';
    var resp = await fetch('/api/superadmin/set-user-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ user_id: u.user_id, password: pw })
    });
    if (!resp.ok) {
      var errBody = await resp.json().catch(function(){ return { error: 'Unknown error' }; });
      showToast('Failed: ' + (errBody.error || resp.statusText), 'error');
      return;
    }
    var email = (u.organisations && u.organisations.owner_email) || u.user_id;
    pushAudit('Set Password', email, 'Directly set new password');
    showToast('Password updated successfully');
    closeModal();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Set Password'; }
  }
}

async function removeUserFromOrg(memberId) {
  var u = allUsers.find(function(x){ return x.id === memberId; });
  var label = u ? (u.user_id || memberId) : memberId;
  if (!confirm('Remove user ' + label + ' from their organisation?')) return;

  var r = await supa.from('org_members').delete().eq('id', memberId).select('id');
  if (r.error) { showToast('Could not remove user: ' + r.error.message, 'error'); return; }
  if (!r.data || !r.data.length) { showToast('Delete blocked (RLS).', 'error'); return; }
  pushAudit('Remove User', label, 'Removed from organisation');
  showToast('User removed from organisation');
  allUsers = await loadUsers();
  updateBadges();
  if (currentPage === 'users') navigate('users');
}

// ── Audit Log Page ────────────────────────────────────────────
function renderLogs() {
  if (auditLog.length === 0) {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">Session Audit Log</div><div class="card-sub">Actions performed during this session are logged here</div></div>
        <div class="empty">
          <div class="empty-icon">📋</div>
          <div>No actions logged yet</div>
          <div style="font-size:12px;color:var(--muted);margin-top:6px">Actions like status changes, plan updates, user edits, and deletions will appear here.</div>
        </div>
      </div>`;
  }

  return `
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">Session Audit Log</div><div class="card-sub">${auditLog.length} action${auditLog.length===1?'':'s'} this session</div></div>
        <button class="action-btn" onclick="clearAuditLog()" style="color:var(--red)">Clear Log</button>
      </div>
      <table>
        <thead><tr><th>Time</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>${auditLog.map(function(entry) {
          return '<tr>' +
            '<td style="color:var(--muted);font-family:\'DM Mono\',monospace;font-size:12px;white-space:nowrap">' + fmtTime(entry.time) + '</td>' +
            '<td><span style="font-weight:600">' + escapeHtml(entry.action) + '</span></td>' +
            '<td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(entry.target) + '</td>' +
            '<td style="font-size:12px;color:var(--muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(entry.details) + '</td>' +
          '</tr>';
        }).join('')}</tbody>
      </table>
    </div>`;
}

function clearAuditLog() {
  if (!confirm('Clear all audit log entries?')) return;
  auditLog = [];
  navigate('logs');
}

// ── Superadmin Management ────────────────────────────────────────
async function loadSuperadmins() {
  var { data, error } = await supa.from('superadmin_allowlist').select('*').order('created_at', {ascending:false});
  if (error) { console.warn('loadSuperadmins:', error.message); return []; }
  return data || [];
}

function renderAdmins() {
  // load async, render placeholder first
  var html = '<div class="card"><div class="card-header"><div><div class="card-title">🛡️ Superadmin Access</div><div class="card-sub">Users who can access this admin panel</div></div><button class="btn-primary" style="font-size:12px;padding:7px 16px" onclick="openAddAdminModal()">+ Add Admin</button></div><div id="admins-body"><div class="empty"><div class="spin" style="width:24px;height:24px;border-width:2px"></div></div></div></div>';
  setTimeout(async function() {
    var admins = await loadSuperadmins();
    var el = document.getElementById('admins-body');
    if (!el) return;
    if (!admins.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🛡️</div><div>No superadmin entries yet</div></div>';
      return;
    }
    el.innerHTML = '<table><thead><tr><th>Email</th><th>User ID</th><th>Added</th><th>Actions</th></tr></thead><tbody>' + admins.map(function(a) {
      return '<tr><td style="font-weight:600">' + escapeHtml(a.email || '—') + '</td><td style="font-size:11px;color:var(--muted);font-family:monospace">' + escapeHtml(a.user_id ? a.user_id.substring(0,8) + '…' : '—') + '</td><td style="color:var(--muted)">' + fmtDate(a.created_at) + '</td><td><div style="display:flex;gap:5px"><button class="action-btn" onclick="openAdminPasswordModal(\'' + escapeHtml(a.email || '') + '\',\'' + escapeHtml(a.user_id || '') + '\')" title="Set Password">🔑</button><button class="action-btn danger" onclick="removeSuperadmin(\'' + escapeHtml(a.id) + '\',\'' + escapeHtml(a.email || a.user_id || '') + '\')">Remove</button></div></td></tr>';
    }).join('') + '</tbody></table>';
  }, 50);
  return html;
}

function openAddAdminModal() {
  document.getElementById('modal-inner').innerHTML = '<div class="modal-head"><div class="modal-title">Add Superadmin</div><button class="modal-close" onclick="closeModal()">×</button></div><div class="modal-body"><div style="background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--amber)">⚠️ Superadmins have full access to all organisations, billing, and user data. Only add trusted team members.</div><div class="field"><label>Email Address *</label><input class="inp" id="new-admin-email" type="email" placeholder="admin@company.com"></div><div class="field"><label>User ID (optional)</label><input class="inp" id="new-admin-uid" placeholder="UUID from auth.users — leave empty if unknown"><div style="font-size:11px;color:var(--muted);margin-top:4px">If you only know the email, leave User ID empty. The email must match their Supabase auth email.</div></div></div><div class="modal-foot"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveSuperadmin()">Add Superadmin</button></div>';
  openModal();
}

async function saveSuperadmin() {
  var email = (document.getElementById('new-admin-email').value || '').trim().toLowerCase();
  var uid = (document.getElementById('new-admin-uid').value || '').trim() || null;
  if (!email && !uid) { showToast('Email or User ID required', 'error'); return; }
  var row = {};
  if (email) row.email = email;
  if (uid) row.user_id = uid;
  var { error } = await supa.from('superadmin_allowlist').insert([row]);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  pushAudit('admin', email || uid, 'Added superadmin access');
  showToast('Superadmin added ✓');
  closeModal();
  navigate('admins');
}

function openAdminPasswordModal(email, userId) {
  var label = email || userId || 'Unknown';
  document.getElementById('modal-inner').innerHTML = `
    <div class="modal-head">
      <div class="modal-title">Set Admin Password</div>
      <button class="modal-close" onclick="closeModal()">x</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:4px">
        <div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:2px">Admin Account</div>
        <div style="font-size:14px;font-weight:600">${escapeHtml(label)}</div>
      </div>
      <div style="background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--amber)">
        This directly changes this superadmin's password. They will need to use the new password on their next login.
      </div>
      <div class="field">
        <label>New Password *</label>
        <input class="inp" id="ap-password" type="password" placeholder="Minimum 6 characters" autocomplete="new-password">
      </div>
      <div class="field">
        <label>Confirm Password *</label>
        <input class="inp" id="ap-confirm" type="password" placeholder="Repeat password" autocomplete="new-password">
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="ap-save-btn" onclick="doSetAdminPassword('${escapeHtml(email)}','${escapeHtml(userId)}')">Set Password</button>
    </div>`;
  openModal();
}

async function doSetAdminPassword(email, userId) {
  var pw = (document.getElementById('ap-password').value || '');
  var confirmPw = (document.getElementById('ap-confirm').value || '');
  if (pw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  if (pw !== confirmPw) { showToast('Passwords do not match', 'error'); return; }

  var btn = document.getElementById('ap-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Setting...'; }

  try {
    // We need the auth user_id. If we have it, use it directly. Otherwise look it up by email via our server endpoint.
    var targetUserId = userId;
    if (!targetUserId && email) {
      // Look up user by email using the server endpoint
      var session = await supa.auth.getSession();
      var token = session.data.session ? session.data.session.access_token : '';
      var lookupResp = await fetch('/api/superadmin/lookup-user-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ email: email })
      });
      if (!lookupResp.ok) {
        var lookupErr = await lookupResp.json().catch(function(){ return { error: 'Lookup failed' }; });
        showToast('Could not find user: ' + (lookupErr.error || 'Unknown error'), 'error');
        return;
      }
      var lookupData = await lookupResp.json();
      targetUserId = lookupData.user_id;
    }
    if (!targetUserId) { showToast('Could not determine user ID for this admin', 'error'); return; }

    var session2 = await supa.auth.getSession();
    var token2 = session2.data.session ? session2.data.session.access_token : '';
    var resp = await fetch('/api/superadmin/set-user-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token2 },
      body: JSON.stringify({ user_id: targetUserId, password: pw })
    });
    if (!resp.ok) {
      var errBody = await resp.json().catch(function(){ return { error: 'Unknown error' }; });
      showToast('Failed: ' + (errBody.error || resp.statusText), 'error');
      return;
    }
    pushAudit('Set Admin Password', email || userId, 'Directly set new password');
    showToast('Password updated successfully');
    closeModal();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Set Password'; }
  }
}

async function removeSuperadmin(id, label) {
  if (!confirm('Remove superadmin access for ' + label + '?')) return;
  var { error } = await supa.from('superadmin_allowlist').delete().eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  pushAudit('admin', label, 'Removed superadmin access');
  showToast('Superadmin removed');
  navigate('admins');
}

// ── Org detail modal (enhanced with usage stats + members) ────
function openOrgDetail(id) {
  var o = orgs.find(function(x){ return x.id===id; });
  if(!o) return;
  var d = o.status==='trial'&&o.trial_ends_at ? daysUntil(o.trial_ends_at) : null;
  var h = orgHealth(o);

  // Find members of this org from loaded users
  var members = allUsers.filter(function(u){ return u.org_id === id; });

  document.getElementById('modal-inner').innerHTML = `
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="org-avatar" style="width:40px;height:40px;font-size:14px;border-radius:10px;background:${orgColor(o.name)}22;color:${orgColor(o.name)}">${orgInitials(o.name)}</div>
        <div>
          <div class="modal-title">${escapeHtml(o.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${escapeHtml(o.owner_email||'No email')}</div>
        </div>
      </div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Status</div>
          <span class="pill ${statusClass(o.status)}" style="font-size:12px">${escapeHtml(o.status)}</span>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Plan</div>
          <span class="plan-pill ${planClass(o.plan)}" style="font-size:12px">${escapeHtml(o.plan||'trial')}</span>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Health</div>
          <div style="font-size:16px">${h.icon} <span style="font-size:12px;color:var(--${h.cls})">${escapeHtml(h.label)}</span></div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">MRR</div>
          <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;color:var(--green)">${o.status==='active'?fmt(calcMRR(o)):'—'}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">${o.status==='trial'?'Trial ends':'Joined'}</div>
          <div style="font-size:13px;font-weight:600;color:${d!==null&&d<=7?'var(--amber)':'var(--text)'}">${o.status==='trial'?fmtDate(o.trial_ends_at)+(d!==null?' ('+d+'d)':''):fmtDate(o.created_at)}</div>
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:12px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Members</div>
          <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;color:var(--blue)">${members.length}</div>
        </div>
      </div>
      ${o.billing_override==='free'?`<div style="background:var(--primary-bg);border:1px solid var(--primary-border);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px">
        <span class="billing-badge">FREE GRANT</span>
        <span style="font-size:12px;color:var(--muted)">${escapeHtml(o.billing_override_note||'No billing — admin override')}</span>
      </div>`:''}
      ${o.phone?`<div style="font-size:13px;color:var(--muted)">📞 ${escapeHtml(o.phone)}</div>`:''}
      ${o.stripe_subscription_id?`<div style="font-size:12px;color:var(--dim)">Billing: ${escapeHtml(o.stripe_subscription_id)}${o.stripe_subscription_id==='manual'?' <span style="color:var(--amber)">(no Stripe -- admin grant)</span>':''}</div>`:''}

      <!-- Usage Stats (loaded async) -->
      <div style="padding-top:4px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Usage Stats</div>
        <div id="org-usage-stats" style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="background:var(--surface2);border-radius:8px;padding:10px 16px;text-align:center;flex:1;min-width:80px">
            <div class="spin" style="width:14px;height:14px;border-width:2px;margin:0 auto"></div>
          </div>
        </div>
      </div>

      <!-- Members List -->
      <div style="padding-top:4px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Members (${members.length})</div>
        ${members.length === 0
          ? '<div style="font-size:12px;color:var(--dim)">No members found in org_members for this organisation.</div>'
          : '<div style="display:flex;flex-direction:column;gap:6px">' + members.map(function(m) {
              var roleCls = m.role === 'admin' ? 'color:var(--purple)' : m.role === 'manager' ? 'color:var(--blue)' : 'color:var(--muted)';
              var memberEmail = (m.organisations && m.organisations.owner_email) || '';
              return '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border-radius:8px;padding:8px 12px">' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                  '<div style="font-size:12px;font-weight:600">' + escapeHtml(m.user_id ? m.user_id.substring(0, 12) + '...' : '—') + '</div>' +
                  '<span style="font-size:10px;font-weight:700;text-transform:uppercase;' + roleCls + '">' + escapeHtml(m.role || 'viewer') + '</span>' +
                '</div>' +
                '<div style="display:flex;gap:4px">' +
                  '<button class="action-btn" style="font-size:11px;padding:3px 8px" onclick="event.stopPropagation();openSetPasswordModal(\'' + escapeHtml(m.id) + '\')" title="Set Password">🔑</button>' +
                  '<button class="action-btn" style="font-size:11px;padding:3px 8px;color:var(--red)" onclick="event.stopPropagation();removeUserFromOrg(\'' + escapeHtml(m.id) + '\')" title="Remove">✕</button>' +
                '</div>' +
              '</div>';
            }).join('') + '</div>'
        }
      </div>

      <div style="padding-top:4px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Change Status</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${['trial','active','paused','cancelled'].map(s=>`
            <button type="button" onclick="quickStatus('${o.id}','${s}')" style="padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid var(--border2);background:${o.status===s?'var(--green)':'transparent'};color:${o.status===s?'#000':'var(--muted)'}">${s}</button>
          `).join('')}
        </div>
      </div>
      <div style="padding-top:4px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Change Plan</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${['trial'].concat(getPaidPlanKeys()).map(p=>`
            <button type="button" onclick="quickPlan('${o.id}','${p}')" style="padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid var(--border2);background:${o.plan===p?'var(--green)':'transparent'};color:${o.plan===p?'#000':'var(--muted)'}">${p}</button>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn-primary" onclick="openEditOrgModal('${o.id}')">✏️ Edit Details</button>
    </div>`;
  openModal();

  // Load usage stats async
  loadOrgUsageStats(id);
}

async function loadOrgUsageStats(orgId) {
  var el = document.getElementById('org-usage-stats');
  if (!el) return;

  var propCount = 0, tenantCount = 0, roomCount = 0;
  try {
    var pRes = await supa.from('properties').select('id', { count: 'exact', head: true }).eq('org_id', orgId);
    propCount = pRes.count || 0;
  } catch(e) { /* silent */ }
  try {
    var tRes = await supa.from('tenants').select('id', { count: 'exact', head: true }).eq('org_id', orgId);
    tenantCount = tRes.count || 0;
  } catch(e) { /* silent */ }
  try {
    var rRes = await supa.from('rooms').select('id', { count: 'exact', head: true }).eq('org_id', orgId);
    roomCount = rRes.count || 0;
  } catch(e) { /* silent */ }

  // Re-check element still exists (modal may have closed)
  el = document.getElementById('org-usage-stats');
  if (!el) return;

  el.innerHTML =
    '<div style="background:var(--surface2);border-radius:8px;padding:10px 16px;text-align:center;flex:1;min-width:80px">' +
      '<div style="font-size:18px;font-weight:700;font-family:\'DM Mono\',monospace;color:var(--blue)">' + propCount + '</div>' +
      '<div style="font-size:10px;color:var(--muted);margin-top:2px">Properties</div>' +
    '</div>' +
    '<div style="background:var(--surface2);border-radius:8px;padding:10px 16px;text-align:center;flex:1;min-width:80px">' +
      '<div style="font-size:18px;font-weight:700;font-family:\'DM Mono\',monospace;color:var(--green)">' + tenantCount + '</div>' +
      '<div style="font-size:10px;color:var(--muted);margin-top:2px">Tenants</div>' +
    '</div>' +
    '<div style="background:var(--surface2);border-radius:8px;padding:10px 16px;text-align:center;flex:1;min-width:80px">' +
      '<div style="font-size:18px;font-weight:700;font-family:\'DM Mono\',monospace;color:var(--purple)">' + roomCount + '</div>' +
      '<div style="font-size:10px;color:var(--muted);margin-top:2px">Rooms</div>' +
    '</div>';
}

// ── Add / Edit org modals ─────────────────────────────────────
function openAddOrgModal() {
  window._saEditOrgId = null;
  document.getElementById('modal-inner').innerHTML = orgForm(null);
  openModal();
}
function openEditOrgModal(id) {
  window._saEditOrgId = id;
  var o = orgs.find(function(x){ return x.id===id; });
  document.getElementById('modal-inner').innerHTML = orgForm(o);
  openModal();
}

function orgForm(o) {
  var isEdit = !!o;
  var nm = isEdit ? escapeHtml(o.name) : '';
  var oe = isEdit ? escapeHtml(o.owner_email||'') : '';
  var ph = isEdit ? escapeHtml(o.phone||'') : '';
  var tr = isEdit && o.trial_ends_at ? escapeHtml(o.trial_ends_at.split('T')[0]) : '';
  var mr = isEdit && o.mrr != null ? escapeHtml(String(o.mrr)) : '';
  var be = isEdit ? escapeHtml(o.billing_email||'') : '';
  var st = isEdit ? escapeHtml(o.stripe_subscription_id||'') : '';
  var isFreeGrant = isEdit && o.billing_override === 'free';
  var overrideNote = isEdit && o.billing_override_note ? escapeHtml(o.billing_override_note) : '';
  var freeUntil = isEdit && o.free_until ? escapeHtml(String(o.free_until).split('T')[0]) : '';
  var freeUntilNote = isEdit && o.free_until_note ? escapeHtml(o.free_until_note) : '';
  return `
    <div class="modal-head">
      <div class="modal-title">${isEdit?'Edit: '+escapeHtml(o.name):'Add New Company'}</div>
      <button class="modal-close" onclick="closeModal()">x</button>
    </div>
    <div class="modal-body">
      <div class="field"><label>Company Name *</label><input class="inp" id="of-name" value="${nm}" placeholder="e.g. Smith Properties Ltd" autocomplete="organization"></div>
      <div class="row-2">
        <div class="field"><label>Owner Email</label><input class="inp" id="of-email" type="email" value="${oe}" placeholder="owner@email.com" autocomplete="email"></div>
        <div class="field"><label>Billing Email</label><input class="inp" id="of-billing-email" type="email" value="${be}" placeholder="billing@company.com (optional)"></div>
      </div>
      <div class="row-2">
        <div class="field"><label>Phone</label><input class="inp" id="of-phone" value="${ph}" placeholder="07911000000" autocomplete="tel"></div>
        <div class="field"><label>MRR Override (£)</label><input class="inp" id="of-mrr" type="number" step="0.01" value="${mr}" placeholder="Auto from plan"></div>
      </div>
      <div class="row-2">
        <div class="field"><label>Plan</label>
          <select class="inp" id="of-plan" onchange="toggleBillingOverrideHint()">
            ${['trial'].concat(getPaidPlanKeys()).map(p=>`<option value="${p}" ${isEdit&&o.plan===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select class="inp" id="of-status">
            ${['trial','active','paused','cancelled'].map(s=>`<option value="${s}" ${isEdit&&o.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Billing Override / Free Grant -->
      <div style="background:var(--primary-bg);border:1px solid var(--primary-border);border-radius:12px;padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--primary)">Billing Override</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Grant free access to a paid plan (no Stripe required)</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="of-free-grant" ${isFreeGrant?'checked':''} onchange="toggleBillingOverrideHint()">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="billing-override-details" style="display:${isFreeGrant?'block':'none'}">
          <div class="field" style="margin-bottom:0">
            <label>Reason / Note</label>
            <input class="inp" id="of-override-note" value="${overrideNote}" placeholder="e.g. Partner company, beta tester, internal use...">
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.4">
            When enabled, this company gets full access to the selected plan without being charged. MRR will show as £0. The company will not be redirected to Stripe checkout.
          </div>
        </div>
      </div>

      <!-- Free Until — time-boxed free grant (alternative to indefinite override) -->
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px;margin-top:12px">
        <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:4px">⏱️ Free Until — Time-boxed Grant</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.4">
          Alternative to the indefinite override above. Unlimited caps + no billing until this date, then reverts to the plan rules automatically. Ideal for accelerators, extended trials, or partner deals that renew annually.
        </div>
        <div class="row-2" style="align-items:start">
          <div class="field" style="margin-bottom:0"><label>Expires on</label><input class="inp" id="of-free-until" type="date" value="${freeUntil}"></div>
          <div class="field" style="margin-bottom:0"><label>Reason</label><input class="inp" id="of-free-until-note" value="${freeUntilNote}" placeholder="e.g. Accelerator programme — renews Dec 2027"></div>
        </div>
        ${freeUntil ? (function(){
          var d = new Date(freeUntil); var now = new Date(); now.setHours(0,0,0,0);
          var dLeft = Math.ceil((d - now) / 86400000);
          var col = dLeft < 0 ? '#DC2626' : dLeft <= 14 ? '#D97706' : '#059669';
          var txt = dLeft < 0 ? ('Expired ' + Math.abs(dLeft) + ' days ago') : dLeft === 0 ? 'Expires today' : (dLeft + ' days remaining');
          return '<div style="margin-top:8px;font-size:11px;font-weight:700;color:'+col+'">' + txt + '</div>';
        })() : ''}
      </div>

      <div class="field"><label>Trial Ends</label><input class="inp" id="of-trial" type="date" value="${tr}"></div>
      ${isEdit?`<div class="field"><label>Stripe Subscription ID</label><input class="inp" id="of-stripe" value="${st}" placeholder="sub_... or leave empty -- paid plans work without Stripe">
        <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.45">Leave empty when assigning Starter+ manually: the app records an internal grant so users are not sent to checkout. Enter a real <code style="font-size:10px">sub_...</code> if they pay via Stripe.</div>
      </div>`:''}
    </div>
    <div class="modal-foot">
      ${isEdit?`<button type="button" class="btn-danger" onclick="deleteOrg(window._saEditOrgId)">Delete</button>`:''}
      <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn-primary" id="of-save-btn" onclick="saveOrg(window._saEditOrgId)">${isEdit?'Save Changes':'Add Company'}</button>
    </div>`;
}

function toggleBillingOverrideHint() {
  var el = document.getElementById('billing-override-details');
  var cb = document.getElementById('of-free-grant');
  if (el && cb) el.style.display = cb.checked ? 'block' : 'none';
}

function isPaidPlanKey(plan) {
  var p = String(plan||'').toLowerCase();
  return p === 'starter' || p === 'professional' || p === 'business';
}

function resolveStripeSubForSave(plan, stripeInput) {
  var raw = String(stripeInput||'').trim();
  if (!isPaidPlanKey(plan)) return raw || null;
  if (raw.indexOf('sub_') === 0) return raw;
  return 'manual';
}

async function saveOrg(id) {
  var btn = document.getElementById('of-save-btn');
  var isEdit = !!id;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
  var name   = document.getElementById('of-name').value.trim();
  if(!name){ showToast('Please enter a company name.', 'error'); return; }
  var plan = document.getElementById('of-plan').value;
  var stripeEl = document.getElementById('of-stripe');
  var stripeInput = stripeEl ? stripeEl.value.trim() : '';
  var freeGrantEl = document.getElementById('of-free-grant');
  var isFreeGrant = freeGrantEl && freeGrantEl.checked;
  var overrideNote = (document.getElementById('of-override-note') && document.getElementById('of-override-note').value.trim()) || null;

  var data = {
    name,
    owner_email: document.getElementById('of-email').value.trim()||null,
    billing_email: (document.getElementById('of-billing-email') && document.getElementById('of-billing-email').value.trim()) || null,
    phone:       document.getElementById('of-phone').value.trim()||null,
    plan:        plan,
    status:      document.getElementById('of-status').value,
    trial_ends_at: document.getElementById('of-trial').value||null,
    mrr:         isFreeGrant ? 0 : (+(document.getElementById('of-mrr')||{value:''}).value||null),
    slug:        name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
    billing_override: isFreeGrant ? 'free' : null,
    billing_override_note: isFreeGrant ? overrideNote : null,
    free_until: (function(){ var el = document.getElementById('of-free-until'); var v = el && el.value ? el.value.trim() : ''; return v || null; })(),
    free_until_note: (function(){ var el = document.getElementById('of-free-until-note'); var v = el && el.value ? el.value.trim() : ''; return v || null; })(),
  };
  if (isFreeGrant) {
    data.stripe_subscription_id = 'manual';
    if (plan !== 'trial') data.status = 'active';
  } else if (stripeEl) {
    data.stripe_subscription_id = resolveStripeSubForSave(plan, stripeInput);
  } else if (isPaidPlanKey(plan)) {
    data.stripe_subscription_id = 'manual';
  }

  var result;
  if(id) {
    result = await supa.from('organisations').update(data).eq('id', id).select('id');
  } else {
    result = await supa.from('organisations').insert([data]).select('id');
  }
  if(result.error){ showToast('Error: '+result.error.message, 'error'); return; }
  if(id && (!result.data || !result.data.length)) {
    showToast('Update blocked: no row changed. If you can log in but not save, run db/superadmin_rls_policies.sql and add your email or user id to superadmin_allowlist.', 'error');
    return;
  }
  pushAudit(id ? 'Edit Org' : 'Add Org', name, 'Plan: ' + plan + ', Status: ' + data.status);
  showToast(id ? 'Company updated' : 'Company added');
  closeModal();
  await loadData();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Save Changes' : 'Add Company'; }
  }
}

async function quickStatus(id, status) {
  var o = orgs.find(function(x){ return x.id===id; });
  var r = await supa.from('organisations').update({status:status}).eq('id', id).select('id');
  if (r.error) { showToast('Could not update status: '+r.error.message, 'error'); return; }
  if (!r.data || !r.data.length) { showToast('Status update blocked (RLS). Add your account to superadmin_allowlist — see db/superadmin_rls_policies.sql.', 'error'); return; }
  pushAudit('Change Status', o ? o.name : id, 'New status: ' + status);
  showToast('Status updated');
  await loadData();
  var ov = document.getElementById('modal-overlay');
  if (ov && ov.classList.contains('open')) openOrgDetail(id);
}
async function quickPlan(id, plan) {
  var o = orgs.find(function(x){ return x.id===id; });
  var updates = { plan: plan };
  if (isPaidPlanKey(plan)) {
    var sid = o && String(o.stripe_subscription_id||'').trim();
    if (!sid || sid.indexOf('sub_') !== 0) {
      updates.stripe_subscription_id = 'manual';
    }
    if (plan !== 'trial') updates.status = 'active';
  } else {
    updates.stripe_subscription_id = null;
    if (plan === 'trial') updates.status = 'trial';
  }
  var r = await supa.from('organisations').update(updates).eq('id', id).select('id');
  if (r.error) { showToast('Could not update plan: '+r.error.message, 'error'); return; }
  if (!r.data || !r.data.length) { showToast('Plan update blocked (RLS). Add your account to superadmin_allowlist — see db/superadmin_rls_policies.sql.', 'error'); return; }
  pushAudit('Change Plan', o ? o.name : id, 'New plan: ' + plan);
  showToast('Plan updated'+(isPaidPlanKey(plan)?' (no Stripe required)':''));
  await loadData();
  var ov = document.getElementById('modal-overlay');
  if (ov && ov.classList.contains('open')) openOrgDetail(id);
}
async function deleteOrg(id) {
  var o = orgs.find(function(x){ return x.id===id; });
  if(!confirm('Delete '+( o?o.name:'this company')+'?\n\nThis removes the organisation record only — their data tables are not deleted.')) return;
  var del = await supa.from('organisations').delete().eq('id', id).select('id');
  if (del.error) { showToast('Could not delete: '+del.error.message, 'error'); return; }
  if (!del.data || !del.data.length) { showToast('Delete blocked (RLS). Add your account to superadmin_allowlist — see db/superadmin_rls_policies.sql.', 'error'); return; }
  pushAudit('Delete Org', o ? o.name : id, 'Organisation deleted');
  closeModal();
  await loadData();
}

function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }


// ────────────────────────────────────────────────────────────────────────────
// BLOG CMS
// ────────────────────────────────────────────────────────────────────────────
var blogPosts = [];
var blogEditing = null; // null = list view; 'new' or {id} = editor view
var _blogLoaded = false; // prevents auto-load from re-firing during typing

async function _blogAuthHeader() {
  var sr = await supa.auth.getSession();
  var session = sr && sr.data ? sr.data.session : null;
  if (!session) throw new Error('No session — re-login as superadmin.');
  return { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' };
}

async function loadBlogPosts() {
  try {
    var headers = await _blogAuthHeader();
    var resp = await fetch('/api/blog/posts', { headers: headers });
    var data = await resp.json();
    if (!resp.ok) { showToast(data.error || 'Failed to load posts', 'error'); return; }
    blogPosts = data.posts || [];
  } catch (e) {
    showToast('Failed to load posts: ' + e.message, 'error');
    blogPosts = [];
  }
}

function renderBlog() {
  // If we're in the editor, render that — never auto-load posts here, it would
  // re-render the editor mid-typing and wipe the form (kills cursor focus).
  if (blogEditing !== null) return renderBlogEditor();

  // First time visiting the Blog tab in this session — fetch the list once.
  if (!_blogLoaded) {
    _blogLoaded = true;
    setTimeout(function(){ loadBlogPosts().then(function(){
      if (currentPage === 'blog' && blogEditing === null) {
        document.getElementById('content').innerHTML = renderBlog();
      }
    }); }, 0);
  }

  var rows = blogPosts.map(function(p) {
    var statusBadge = p.status === 'published'
      ? '<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:6px;background:var(--green-bg,#DCFCE7);color:var(--green,#16A34A);border:1px solid var(--green-border,#86EFAC)">PUBLISHED</span>'
      : '<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:6px;background:var(--amber-bg,#FEF3C7);color:var(--amber,#D97706);border:1px solid var(--amber-border,#FDE68A)">DRAFT</span>';
    var updated = p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    var url = p.status === 'published' ? '<a href="/blog/'+escapeHtml(p.slug)+'" target="_blank" style="font-size:11px;color:var(--blue);text-decoration:none">View →</a>' : '';
    return '<tr>'
      +'<td style="padding:12px 14px"><div style="font-weight:700;font-size:13px;color:var(--text)">'+escapeHtml(p.title || 'Untitled')+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:2px;font-family:monospace">/blog/'+escapeHtml(p.slug)+'</div></td>'
      +'<td style="padding:12px 14px">'+escapeHtml(p.category || '—')+'</td>'
      +'<td style="padding:12px 14px">'+statusBadge+'</td>'
      +'<td style="padding:12px 14px;font-size:11px;color:var(--muted)">'+updated+'</td>'
      +'<td style="padding:12px 14px;text-align:right;white-space:nowrap">'
      +'<button class="action-btn" style="font-size:11px;padding:5px 10px" onclick="openBlogEditor(\''+p.id+'\')">Edit</button> '
      +url+' '
      +'<button class="action-btn" style="font-size:11px;padding:5px 10px;color:var(--red)" onclick="deleteBlogPost(\''+p.id+'\')">×</button>'
      +'</td></tr>';
  }).join('');

  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">'
    +'<div><div class="card-title">📝 Blog Posts</div><div class="card-sub">'+blogPosts.length+' total · '+blogPosts.filter(function(p){return p.status==='published';}).length+' published</div></div>'
    +'<button class="btn-primary" style="font-size:13px;padding:9px 18px" onclick="openBlogEditor(\'new\')">+ New Post</button>'
    +'</div>'
    +(blogPosts.length === 0
      ? '<div class="card" style="padding:60px 20px;text-align:center;color:var(--muted)"><div style="font-size:32px;margin-bottom:8px">📝</div><div style="font-size:14px;font-weight:600">No posts yet</div><div style="font-size:12px;margin-top:6px">Click <strong>+ New Post</strong> above to write your first one.</div></div>'
      : '<div class="card" style="padding:0;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:12px">'
        +'<thead><tr style="background:var(--bg);border-bottom:1px solid var(--border)">'
        +'<th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:700">Title</th>'
        +'<th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:700">Category</th>'
        +'<th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:700">Status</th>'
        +'<th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:700">Updated</th>'
        +'<th style="padding:10px 14px"></th>'
        +'</tr></thead><tbody>'+rows+'</tbody></table></div>');
}

async function openBlogEditor(idOrNew) {
  blogEditing = idOrNew;
  if (idOrNew !== 'new') {
    try {
      var headers = await _blogAuthHeader();
      var resp = await fetch('/api/blog/posts/'+idOrNew, { headers: headers });
      var data = await resp.json();
      if (!resp.ok) { showToast(data.error || 'Failed to load post', 'error'); blogEditing = null; return; }
      blogEditing = data.post;
    } catch (e) {
      showToast('Failed to load post: ' + e.message, 'error');
      blogEditing = null;
      return;
    }
  } else {
    blogEditing = { slug:'', title:'', excerpt:'', body_html:'', cover_image:'', author:'Gleydson', category:'', read_minutes:'', tags:[], status:'draft' };
  }
  document.getElementById('content').innerHTML = renderBlogEditor();
}

function renderBlogEditor() {
  var p = blogEditing || {};
  var isNew = !p.id;
  var tagsStr = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
  return '<div style="max-width:880px">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">'
    +'<button onclick="closeBlogEditor()" style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;cursor:pointer;font-family:inherit">← Back</button>'
    +'<div><div class="card-title">'+(isNew ? 'New Post' : 'Edit Post')+'</div><div class="card-sub">'+(p.status === 'published' ? 'Currently PUBLISHED — saving keeps it live.' : 'Draft — only visible to you. Hit Publish to make it live.')+'</div></div>'
    +'</div>'

    +'<div class="card" style="padding:20px">'

    +'<label class="lbl">Title *</label>'
    +'<input class="inp" id="bp-title" value="'+escapeHtml(p.title||'')+'" placeholder="The headline of your post" oninput="_blogAutoSlug()">'

    +'<label class="lbl" style="margin-top:14px">Slug (URL)</label>'
    +'<div style="display:flex;align-items:center;gap:8px"><span style="font-family:monospace;font-size:12px;color:var(--muted)">/blog/</span>'
    +'<input class="inp" id="bp-slug" value="'+escapeHtml(p.slug||'')+'" placeholder="auto-from-title" style="font-family:monospace;flex:1"></div>'

    +'<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;margin-top:14px">'
    +'<div><label class="lbl">Category</label><input class="inp" id="bp-category" value="'+escapeHtml(p.category||'')+'" placeholder="e.g. HMO Licensing"></div>'
    +'<div><label class="lbl">Author</label><input class="inp" id="bp-author" value="'+escapeHtml(p.author||'Gleydson')+'"></div>'
    +'<div><label class="lbl">Read time (min)</label><input class="inp" id="bp-read" type="number" min="1" value="'+(p.read_minutes||'')+'" placeholder="5"></div>'
    +'</div>'

    +'<label class="lbl" style="margin-top:14px">Excerpt (1-2 sentence summary, used on the listing page + meta description)</label>'
    +'<textarea class="inp" id="bp-excerpt" rows="2" placeholder="Short summary, max ~160 chars for SEO" style="resize:vertical;font-family:inherit">'+escapeHtml(p.excerpt||'')+'</textarea>'

    +'<label class="lbl" style="margin-top:14px">Cover image</label>'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<input class="inp" id="bp-cover" value="'+escapeHtml(p.cover_image||'')+'" placeholder="https://… or leave blank" style="flex:1">'
    +'<input type="file" id="bp-cover-file" accept="image/*" style="display:none" onchange="uploadBlogCover(event)">'
    +'<button onclick="document.getElementById(\'bp-cover-file\').click()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📷 Upload</button>'
    +'</div>'
    +'<div id="bp-cover-preview" style="margin-top:8px">'+(p.cover_image ? '<img src="'+escapeHtml(p.cover_image)+'" style="max-height:120px;border-radius:8px">' : '')+'</div>'

    +'<label class="lbl" style="margin-top:14px">Body (HTML)</label>'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Write valid HTML. Allowed: <code>&lt;h2&gt; &lt;h3&gt; &lt;p&gt; &lt;ul&gt; &lt;ol&gt; &lt;li&gt; &lt;a&gt; &lt;strong&gt; &lt;em&gt; &lt;blockquote&gt; &lt;img&gt; &lt;code&gt;</code> etc. Hero image / nav / footer are added automatically.</div>'
    +'<textarea class="inp" id="bp-body" rows="20" style="resize:vertical;font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.55" placeholder="<h2>Your first heading</h2>&#10;<p>Your content…</p>">'+escapeHtml(p.body_html||'')+'</textarea>'
    +'<div style="margin-top:6px"><button onclick="insertBlogImage()" style="padding:6px 12px;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">📷 Insert image at cursor…</button></div>'

    +'<label class="lbl" style="margin-top:14px">Tags (comma-separated)</label>'
    +'<input class="inp" id="bp-tags" value="'+escapeHtml(tagsStr)+'" placeholder="hmo, licensing, london">'

    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:22px;padding-top:18px;border-top:1px solid var(--border)">'
    +'<div>'+(isNew ? '' :
        '<button onclick="deleteBlogPost(\''+p.id+'\',true)" style="padding:9px 16px;border-radius:8px;border:1px solid var(--red);background:transparent;color:var(--red);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Delete</button>'
       )+'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="saveBlogPost(\'draft\')" style="padding:10px 20px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save draft</button>'
    +'<button onclick="saveBlogPost(\'published\')" class="btn-primary" style="font-size:13px;padding:10px 22px">'+(p.status === 'published' ? 'Save (keep live)' : 'Publish')+'</button>'
    +'</div>'
    +'</div>'
    +'</div>'
    +'<style>.lbl{display:block;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}.inp{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface,#fff);color:var(--text);font-size:13px;font-family:inherit;outline:none}.inp:focus{border-color:var(--accent,#00B894)}</style>'
    +'</div>';
}

function closeBlogEditor() {
  blogEditing = null;
  loadBlogPosts().then(function(){
    if (currentPage === 'blog') document.getElementById('content').innerHTML = renderBlog();
  });
}

function _blogAutoSlug() {
  var title = document.getElementById('bp-title').value;
  var slugEl = document.getElementById('bp-slug');
  // Only auto-fill if user hasn't manually set a slug.
  if (!slugEl.value || slugEl.dataset.auto === '1') {
    slugEl.value = title.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
    slugEl.dataset.auto = '1';
  }
}

function _readEditorForm() {
  return {
    title:        document.getElementById('bp-title').value.trim(),
    slug:         document.getElementById('bp-slug').value.trim(),
    excerpt:      document.getElementById('bp-excerpt').value.trim(),
    body_html:    document.getElementById('bp-body').value,
    cover_image:  document.getElementById('bp-cover').value.trim(),
    author:       document.getElementById('bp-author').value.trim() || 'Gleydson',
    category:     document.getElementById('bp-category').value.trim(),
    read_minutes: document.getElementById('bp-read').value || null,
    tags:         document.getElementById('bp-tags').value
  };
}

async function saveBlogPost(status) {
  var form = _readEditorForm();
  if (!form.title) { showToast('Title is required', 'error'); return; }
  form.status = status;
  try {
    var headers = await _blogAuthHeader();
    var wasNew = !(blogEditing && blogEditing.id);
    var url = wasNew ? '/api/blog/posts' : '/api/blog/posts/'+blogEditing.id;
    var method = wasNew ? 'POST' : 'PUT';
    var resp = await fetch(url, { method: method, headers: headers, body: JSON.stringify(form) });
    var data = await resp.json();
    if (!resp.ok) { showToast(data.error || 'Save failed', 'error'); return; }
    showToast(status === 'published' ? '✓ Published' : '✓ Draft saved', 'success');
    // Update in-memory copy WITHOUT re-rendering the editor (preserves cursor & typing).
    // Only re-render if we just transitioned new → saved (so the URL "Edit" semantics apply).
    var prev = blogEditing;
    blogEditing = data.post;
    _blogLoaded = false; // listing data is stale; will reload when user backs out
    if (wasNew) {
      // First save needs a re-render so the Delete button + correct URL appear.
      document.getElementById('content').innerHTML = renderBlogEditor();
    }
    // Otherwise: no re-render. The form already has the values the user just typed.
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

async function deleteBlogPost(id, fromEditor) {
  if (!confirm('Delete this post permanently? This cannot be undone.')) return;
  try {
    var headers = await _blogAuthHeader();
    var resp = await fetch('/api/blog/posts/'+id, { method:'DELETE', headers: headers });
    var data = await resp.json().catch(function(){ return {}; });
    if (!resp.ok) { showToast(data.error || 'Delete failed', 'error'); return; }
    showToast('Post deleted', 'success');
    if (fromEditor) closeBlogEditor();
    else { await loadBlogPosts(); document.getElementById('content').innerHTML = renderBlog(); }
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

async function uploadBlogCover(event) {
  var file = event.target.files[0];
  if (!file) return;
  var url = await uploadBlogImageFile(file);
  if (!url) return;
  document.getElementById('bp-cover').value = url;
  document.getElementById('bp-cover-preview').innerHTML = '<img src="'+escapeHtml(url)+'" style="max-height:120px;border-radius:8px">';
  showToast('Cover image uploaded', 'success');
}

async function insertBlogImage() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async function(e){
    var file = e.target.files[0];
    if (!file) return;
    var url = await uploadBlogImageFile(file);
    if (!url) return;
    var alt = prompt('Alt text for this image (for SEO + accessibility):', file.name.replace(/\.[^.]+$/,''));
    if (alt === null) alt = '';
    var tag = '<img src="'+url+'" alt="'+(alt||'').replace(/"/g,'&quot;')+'" style="width:100%;border-radius:10px;margin:18px 0">';
    var ta = document.getElementById('bp-body');
    var pos = ta.selectionStart || 0;
    ta.value = ta.value.slice(0,pos) + tag + ta.value.slice(pos);
    ta.focus();
    showToast('Image inserted', 'success');
  };
  input.click();
}

async function uploadBlogImageFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be under 5 MB', 'error');
    return null;
  }
  var ext  = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'jpg';
  var name = 'post-' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.' + ext.toLowerCase();
  try {
    var up = await supa.storage.from('blog-images').upload(name, file, { contentType: file.type, upsert: false });
    if (up.error) { showToast('Upload failed: ' + up.error.message, 'error'); return null; }
    var pub = supa.storage.from('blog-images').getPublicUrl(name);
    var url = (pub && pub.data && pub.data.publicUrl) ? pub.data.publicUrl : null;
    if (!url) { showToast('Upload OK but could not resolve public URL', 'error'); return null; }
    return url;
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
    return null;
  }
}
