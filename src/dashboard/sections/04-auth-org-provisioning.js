// ── Auth & Org provisioning ───────────────────────────────────
var _authReady = false;
var _appBootPending = true; // block render/saveState until org resolved + loadState (prevents demo/other-org flash)
var _currentOrgId = null;   // set once org is resolved
var _currentMemberRole = 'viewer'; // last known org_members.role (app role key)

function setAppBootMessage(msg) {
  var el = document.getElementById('app-boot-overlay-msg');
  if (el && msg) el.textContent = msg;
}
function hideAppBootOverlay() {
  var el = document.getElementById('app-boot-overlay');
  if (el) {
    el.classList.add('app-boot--hide');
    el.setAttribute('aria-busy', 'false');
  }
}

function normalizeRole(role) {
  var r = String(role || '').toLowerCase().trim();
  if (r === 'owner') r = 'admin';
  return state.roles && state.roles[r] ? r : 'viewer';
}

/** When `organisations.email_settings` exists, merge it into state._currentOrg (skips if column not migrated). */
async function mergeOrgEmailSettingsIfAvailable() {
  if (!_currentOrgId || !state._currentOrg) return;
  var r = await supa.from('organisations').select('email_settings').eq('id', _currentOrgId).maybeSingle();
  if (r.error) {
    var c = String(r.error.code || '');
    var msg = String(r.error.message || '');
    if (c === '42703' || msg.indexOf('email_settings') !== -1) return;
    return;
  }
  if (r.data && r.data.email_settings != null) {
    state._currentOrg.email_settings = r.data.email_settings;
  }
}

/** Bind Supabase session to state.users / state.currentUser (always use session.user.id). */
function upsertSessionUser(session, roleHint) {
  if (!session || !session.user) return null;
  var authId = session.user.id;
  var authEmail = (session.user.email || '').trim();
  var authName = (session.user.user_metadata && session.user.user_metadata.full_name)
    ? String(session.user.user_metadata.full_name).trim()
    : (authEmail ? authEmail.split('@')[0] : 'User');
  var role = normalizeRole(roleHint != null ? roleHint : _currentMemberRole);
  var initials = (authName || 'U').split(/\s+/).map(function(w){ return w[0]||''; }).join('').toUpperCase().slice(0,2) || 'U';

  var matched = state.users.find(function(u){ return String(u.id) === String(authId); });
  if (!matched && authEmail) {
    matched = state.users.find(function(u){
      return u.email && u.email.toLowerCase() === authEmail.toLowerCase();
    });
  }
  if (matched) {
    matched.id = authId;
    matched.name = authName || matched.name || 'User';
    matched.email = authEmail || matched.email || '';
    matched.initials = initials;
    matched.role = role;
    matched.status = matched.status || 'active';
    matched.lastLogin = 'Today';
    state.currentUser = matched;
  } else {
    state.currentUser = {
      id: authId, name: authName, initials: initials,
      email: authEmail, phone: '', role: role, status: 'active', lastLogin: 'Today'
    };
    state.users.push(state.currentUser);
  }
  return state.currentUser;
}

async function syncUsersFromOrgMembers(session){
  if(!_currentOrgId) return;
  try{
    var existingById = {};
    (state.users||[]).forEach(function(u){ existingById[String(u.id)] = u; });
    var pendingInvites = (state.users||[]).filter(function(u){ return u && u.status === 'pending'; });
    var currentId = String(session && session.user ? session.user.id : '');
    var currentEmail = session && session.user ? (session.user.email||'') : '';
    var currentName = session && session.user && session.user.user_metadata && session.user.user_metadata.full_name
      ? session.user.user_metadata.full_name
      : (state.currentUser && state.currentUser.name ? state.currentUser.name : 'User');

    var q = await supa.from('org_members')
      .select('user_id, role, created_at')
      .eq('org_id', _currentOrgId)
      .order('created_at', {ascending:true});
    if(q.error) {
      console.warn('syncUsersFromOrgMembers:', q.error);
      return;
    }

    var mapped = (q.data||[]).map(function(m){
      var uid = String(m.user_id||'');
      var prev = existingById[uid] || {};
      var isMe = uid === currentId;
      var name = prev.name || (isMe ? currentName : ('User ' + uid.slice(-6)));
      var email = prev.email || (isMe ? currentEmail : '');
      var initials = (name||'U').split(/\s+/).map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2) || 'U';
      return {
        id: uid,
        name: name,
        initials: initials,
        email: email,
        phone: prev.phone || '',
        role: normalizeRole(m.role),
        status: 'active',
        lastLogin: isMe ? 'Today' : (prev.lastLogin || '—')
      };
    });

    state.users = mapped.concat(pendingInvites);
    var me = state.users.find(function(u){ return String(u.id) === currentId; });
    if(me) state.currentUser = me;
  }catch(e){
    console.warn('syncUsersFromOrgMembers failed:', e);
  }
}

async function resolveOrg(session) {
  _currentMemberRole = 'viewer';
  setAppBootMessage('Preparing your workspace…');
  // 1. Look up org_members for this user (maybeSingle: no row is OK)
  var { data: membership, error: memberErr } = await supa.from('org_members')
    .select('org_id, role, organisations(id,name,plan,status,trial_ends_at,billing_email,owner_email)')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (memberErr && memberErr.code !== 'PGRST116') {
    console.warn('org_members lookup:', memberErr);
  }

  if (membership && membership.org_id) {
    _currentOrgId = membership.org_id;
    _currentMemberRole = normalizeRole(membership.role);
    var org = membership.organisations;
    state._currentOrg = org; // store for Settings page
    await mergeOrgEmailSettingsIfAvailable();

    // Trial enforcement — check if expired
    if (org && org.status === 'trial' && org.trial_ends_at) {
      var daysLeft = Math.ceil((new Date(org.trial_ends_at) - new Date()) / 86400000);
      if (daysLeft < 0) {
        // Trial expired — show locked screen
        showTrialExpired(org.name);
        return false;
      }
      // Trial active — show warning if close
      if (daysLeft <= 3) {
        setTimeout(function(){
          showToast && showToast('⚠️ Trial expires in ' + daysLeft + ' day' + (daysLeft===1?'':'s'), 'warn');
        }, 2000);
      }
    }

    // Account paused or cancelled
    if (org && (org.status === 'paused' || org.status === 'cancelled')) {
      showAccountInactive(org.status, org.name);
      return false;
    }

    return true;
  }

  // 2. No org found — this is a brand new user. Provision their org.
  setAppBootMessage('Creating your organisation…');
  var email     = session.user.email || '';
  var name      = (session.user.user_metadata && session.user.user_metadata.full_name) || email.split('@')[0];
  var companyName = (session.user.user_metadata && session.user.user_metadata.company_name) || name + "'s Properties";
  companyName = String(companyName).trim() || (name + "'s Properties");
  var selectedPlan = session.user.user_metadata && session.user.user_metadata.selected_plan;
  if (!selectedPlan) {
    window.location.href = 'choose-plan.html';
    return false;
  }
  selectedPlan = String(selectedPlan).toLowerCase();
  var isPaidSignupPlan = selectedPlan === 'starter' || selectedPlan === 'professional' || selectedPlan === 'business';
  var slug      = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  var trialEnd  = isPaidSignupPlan ? new Date(Date.now() + 14 * 86400000).toISOString() : null;

  // Create organisation (owner_email = account email; creator becomes admin in org_members)
  var { data: newOrg, error: orgErr } = await supa.from('organisations').insert([{
    name:            companyName,
    slug:            slug,
    owner_email:     email,
    plan:            isPaidSignupPlan ? selectedPlan : 'free',
    status:          isPaidSignupPlan ? 'trial' : 'active',
    trial_ends_at:   trialEnd,
  }]).select().single();

  if (orgErr || !newOrg) {
    console.error('Failed to create org:', orgErr);
    showToast && showToast('Could not create your organisation. Check console / Supabase policies.', 'error');
    return false;
  }

  // Link user to org — first user is organisation admin (owner)
  var { error: omErr } = await supa.from('org_members').insert([{
    org_id:  newOrg.id,
    user_id: session.user.id,
    role:    'admin',
  }]);
  if (omErr) {
    console.error('Failed to create org_members:', omErr);
    showToast && showToast('Organisation created but membership failed. Contact support.', 'error');
    return false;
  }

  _currentOrgId = newOrg.id;
  _currentMemberRole = 'admin';
  state._currentOrg = newOrg; // store for Settings page
  console.log('New org provisioned:', newOrg.name, newOrg.id);
  return true;
}

function showTrialExpired(orgName) {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0B0D12;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:20px">
      <div style="background:#13161E;border:1px solid rgba(255,77,106,.3);border-radius:16px;padding:40px;max-width:460px;width:100%;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">⏰</div>
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:8px">Trial Expired</div>
        <div style="font-size:14px;color:#7A8099;margin-bottom:24px;line-height:1.6">
          Your 14-day free trial for <strong style="color:#fff">${orgName}</strong> has ended.<br>
          Upgrade now to continue managing your properties.
        </div>
        <button onclick="startStripeCheckout('starter')" style="display:inline-block;padding:13px 28px;background:#00D897;color:#000;font-weight:700;font-size:15px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;margin-bottom:12px">Upgrade Now</button>
        <br>
        <button onclick="doLogOut()" style="background:none;border:none;color:#7A8099;font-size:13px;cursor:pointer;margin-top:8px;font-family:inherit">Sign out</button>
      </div>
    </div>`;
}

function showAccountInactive(status, orgName) {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0B0D12;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:20px">
      <div style="background:#13161E;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:40px;max-width:460px;width:100%;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">${status==='paused'?'⏸️':'🔒'}</div>
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:8px">Account ${status==='paused'?'Paused':'Inactive'}</div>
        <div style="font-size:14px;color:#7A8099;margin-bottom:24px;line-height:1.6">
          <strong style="color:#fff">${orgName}</strong> has been ${status}.<br>Please contact support to reactivate.
        </div>
        <a href="mailto:gleydson@reservationsdirect.co.uk?subject=PropManager Account&body=Hi, my account (${orgName}) is ${status}. Please help." style="display:inline-block;padding:13px 28px;background:#00D897;color:#000;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;margin-bottom:12px">Contact Support</a>
        <br>
        <button onclick="doLogOut()" style="background:none;border:none;color:#7A8099;font-size:13px;cursor:pointer;margin-top:8px;font-family:inherit">Sign out</button>
      </div>
    </div>`;
}

supa.auth.onAuthStateChange(function(event, session) {
  if (event === 'PASSWORD_RECOVERY') {
    // Password reset link clicked — show inline form
    document.open();
    document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Set New Password</title>'
      +'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}'
      +'.card{background:#fff;border-radius:16px;padding:36px;max-width:400px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08)}'
      +'h2{font-size:20px;font-weight:700;margin-bottom:6px}p{font-size:13px;color:#64748b;margin-bottom:22px}'
      +'input{width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:9px;font-size:15px;margin-bottom:12px;outline:none;font-family:inherit}'
      +'input:focus{border-color:#00b894;box-shadow:0 0 0 3px rgba(0,184,148,.1)}'
      +'.btn{width:100%;padding:13px;background:#00b894;color:#fff;border:none;border-radius:100px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}'
      +'.msg{font-size:13px;font-weight:600;padding:10px 12px;border-radius:8px;margin-bottom:12px;display:none}'
      +'.err{background:#fee2e2;color:#b91c1c}.ok{background:#d1fae5;color:#065f46}'
      +'</style></head><body>'
      +'<div class="card"><h2>Set new password</h2><p>Choose a strong password for your account.</p>'
      +'<div id="msg" class="msg"></div>'
      +'<input type="password" id="pw1" placeholder="New password (min 8 characters)" autocomplete="new-password">'
      +'<input type="password" id="pw2" placeholder="Confirm new password" autocomplete="new-password">'
      +'<button class="btn" onclick="setpw()">Update password</button>'
      +'</div>'
      +'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>'
      +'<script>'
      +'var _sc=supabase.createClient("'+window.ENV.SUPA_URL+'", "'+window.ENV.SUPA_KEY+'");'
      +'async function setpw(){'
      +'var p1=document.getElementById("pw1").value,p2=document.getElementById("pw2").value,m=document.getElementById("msg");'
      +'if(p1.length<8){m.className="msg err";m.textContent="Min 8 characters";m.style.display="block";return;}'
      +'if(p1!==p2){m.className="msg err";m.textContent="Passwords do not match";m.style.display="block";return;}'
      +'var {error}=await _sc.auth.updateUser({password:p1});'
      +'if(error){m.className="msg err";m.textContent="Error: "+error.message;m.style.display="block";return;}'
      +'m.className="msg ok";m.textContent="Password updated! Redirecting to login...";m.style.display="block";'
      +'setTimeout(function(){window.location.href="login.html";},1500);}'
      +'<\/script></body></html>');
    document.close();
    return;
  }

  if (_authReady) return;
  _authReady = true;

  if (!session) {
    _appBootPending = false;
    hideAppBootOverlay();
    window.location.href = 'propmanager-landing.html';
    return;
  }

  setAppBootMessage('Signing you in…');
  // Update session user in state only — do not render() yet (avoids flashing demo / other-org data).
  upsertSessionUser(session, 'viewer');

  // Resolve org (provisions new org if first login) then load org-scoped data, then render.
  resolveOrg(session).then(function(ok) {
    if (!ok) {
      // Trial/inactive screens replace body; provisioning errors keep page — always unlock boot UI.
      _appBootPending = false;
      hideAppBootOverlay();
      return;
    }

    upsertSessionUser(session, _currentMemberRole);
    syncUsersFromOrgMembers(session).then(function(){
    setAppBootMessage('Loading your data…');
    loadState().then(function(loaded){
      _appBootPending = false;
      hideAppBootOverlay();
      if (!loaded) {
        showToast && showToast('Could not load workspace data.', 'error');
        return;
      }
      runAfterSupabaseLoad();
      if (!canSee(state.page)) state.page = 'dashboard';
      render();
      try { maybeStartCheckoutFromQuery(); } catch(e3) {}
      try { saveState(); } catch(e2) {}
    });
    });
  });
});
