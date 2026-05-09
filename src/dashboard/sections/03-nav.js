// ── NAV ──────────────────────────────────────────────────────────────────────
const NAV = [
  {id:'_section',label:'Overview'},
  {id:'dashboard',icon:'📊',label:'Dashboard'},
  {id:'properties',icon:'🏠',label:'Properties'},
  {id:'_section',label:'Operations'},
  {id:'tenants',icon:'👥',label:'Tenants'},
  // Communication moved to a sub-tab inside Tenants (state.filters.tenantView='communications').
  // Direct route to /communication kept in pages map for backward-compat with old links.
  {id:'rent',icon:'💷',label:'Rent'},
  {id:'maintenance',icon:'🔧',label:'Maintenance'},
  {id:'landlords',icon:'🏦',label:'Landlords'},
  {id:'rooms',icon:'🚪',label:'Vacancies'},
  {id:'diary',icon:'📅',label:'Diary'},
  {id:'_section',label:'Business'},
  {id:'expenses',icon:'💰',label:'Expenses'},
  {id:'reports',icon:'📈',label:'Reports'},
  {id:'_section',label:'System'},
  // Users now lives inside Settings → Users tab. Kept in NAV but hidden.
  {id:'users',icon:'👤',label:'Users',hidden:true},
  {id:'settings',icon:'⚙️',label:'Settings'},
];

function can(perm){var r=state.roles[state.currentUser.role];return r?!!r[perm]:false;}
function canSee(pageId){var r=state.roles[state.currentUser.role];return r?r.pages.indexOf(pageId)>=0:false;}
// Guard for action handlers — call at the top of any function that performs a
// privileged action (edit/save/delete/markPaid/etc.). Returns true and lets the
// caller proceed; returns false and shows a friendly toast when the current
// role lacks the permission. Callers do:
//   if (!requirePerm('canEdit', 'edit property')) return;
// Friendly labels are mapped here so each call site doesn't have to repeat them.
var _PERM_LABEL = {
  canEdit:           'edit',
  canDelete:         'delete',
  canMarkPaid:       'mark rent paid',
  canAddTenant:      'add tenants',
  canViewFinancials: 'view financials',
  canManageUsers:    'manage users'
};
function requirePerm(perm, customLabel){
  if (can(perm)) return true;
  var label = customLabel || _PERM_LABEL[perm] || perm;
  if (typeof showToast === 'function') {
    var roleName = (state.roles[state.currentUser.role] && state.roles[state.currentUser.role].label) || state.currentUser.role || 'your role';
    showToast('🔒 ' + roleName + ' role can\'t ' + label + '. Ask an admin.', 'error');
  }
  return false;
}
// First page the current role IS allowed to see, in NAV order. Used as the
// fallback when a role's permissions change and the user's current page (or
// the default 'dashboard') is no longer visible to them. Settings is the
// last-resort because every role typically has it.
function fallbackVisiblePage(){
  if(canSee('dashboard')) return 'dashboard';
  var r = state.roles[state.currentUser.role];
  var nav = (typeof NAV !== 'undefined') ? NAV : [];
  var first = nav.find(function(n){ return n.id !== '_section' && r && r.pages.indexOf(n.id) >= 0; });
  return first ? first.id : ((r && r.pages && r.pages[0]) || 'settings');
}
function switchUser(uid){var u=state.users.find(function(x){return x.id===uid;});if(!u||u.status==='inactive')return;state.currentUser=u;if(!canSee(state.page))state.page=fallbackVisiblePage();render();}

const TODAY = new Date();

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
