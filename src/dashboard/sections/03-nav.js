// ── NAV ──────────────────────────────────────────────────────────────────────
const NAV = [
  {id:'dashboard',icon:'📊',label:'Dashboard'},
  {id:'properties',icon:'🏠',label:'Properties'},
  {id:'tenants',icon:'👥',label:'Tenants'},
  {id:'rent',icon:'💷',label:'Rent'},
  {id:'expenses',icon:'📋',label:'Expenses'},
  {id:'maintenance',icon:'🔧',label:'Maintenance'},
  {id:'landlords',icon:'🏦',label:'Landlords'},
  {id:'rooms',icon:'🏡',label:'Rooms'},
  {id:'reports',icon:'📈',label:'Reports'},
  {id:'settings',icon:'⚙️',label:'Settings'},
  {id:'users',icon:'👤',label:'Users'},
];

function can(perm){var r=state.roles[state.currentUser.role];return r?!!r[perm]:false;}
function canSee(pageId){var r=state.roles[state.currentUser.role];return r?r.pages.indexOf(pageId)>=0:false;}
function switchUser(uid){var u=state.users.find(function(x){return x.id===uid;});if(!u||u.status==='inactive')return;state.currentUser=u;if(!canSee(state.page))state.page='dashboard';render();}

const TODAY = new Date();
const PORTAL_PASSWORD = 'Welcome2024!';

function getPortalUsername(t) {
  if(t.portalUsername) return t.portalUsername;
  var first = (t.name||'tenant').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g,'');
  var room = t.room || '1';
  t.portalUsername = first + '.' + room;
  return t.portalUsername;
}

function getPortalPassword(t) {
  if(t.portalPassword) return t.portalPassword;
  t.portalPassword = generatePortalPassword();
  return t.portalPassword;
}

function resetPortalPassword(tid) {
  var t = state.tenants.find(function(x){return x.id===tid;});
  if(!t) return;
  t.portalPassword = generatePortalPassword();
  saveState();
  openTenantDetail(tid);
  showToast('New password generated ✓', 'success');
}

function ensurePortalCredentials(t) {
  if(!t.portalUsername) {
    t.portalUsername = getPortalUsername(t);
  }
  return t.portalUsername;
}
const DATA_VERSION = 'v10-rent-fix'; // Standard portal password for all tenants

// ══════════════════════════════════════════════════════════
// SUPABASE DATA LAYER
// ══════════════════════════════════════════════════════════
const SUPA_URL = window.ENV.SUPA_URL;
const SUPA_KEY = window.ENV.SUPA_KEY;
const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

/** Server-side Anthropic proxy at POST /api/ai/messages (requires Supabase session). */
async function fetchAiMessages(payload) {
  var sr = await supa.auth.getSession();
  var session = sr.data.session;
  if (!session) throw new Error('Not signed in');
  return fetch('/api/ai/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token
    },
    body: JSON.stringify(payload)
  });
}
