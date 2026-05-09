const SUPA_URL = window.ENV.SUPA_URL;
const SUPA_KEY = window.ENV.SUPA_KEY;
const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

// ── On load: check session + read URL params ───────────────────
(async function() {
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (session) { window.location.href = '/app'; return; }
  } catch(e) {}

  var params = new URLSearchParams(location.search);
  var tabParam  = params.get('tab');
  if(tabParam === 'signup') {
    switchTab('signup');
  }
  // `?demo=1` from a marketing CTA — auto-trigger the demo login so visitors
  // land directly inside the demo workspace without an extra click. Wait for
  // the DOM and the demo button handler to be ready before firing.
  if (params.get('demo') === '1') {
    var fire = function(){ if (typeof handleDemoLogin === 'function') handleDemoLogin(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fire);
    } else {
      setTimeout(fire, 0);
    }
  }

  // Social proof — fetch aggregated platform stats and surface them above the
  // auth tabs. Fire-and-forget; if the endpoint is slow or down, the strip
  // simply never appears (it's `display:none` by default).
  fetch('/api/public/platform-stats').then(function(r){ return r.ok ? r.json() : null; }).then(function(s){
    if (!s || !s.properties) return;
    var el = document.getElementById('social-proof');
    var text = document.getElementById('sp-text');
    if (!el || !text) return;
    // Format: "Managing £42,300/mo across 87 properties · 312 tenants"
    var parts = [];
    if (s.monthlyRentGbp > 0) {
      parts.push('Managing £' + s.monthlyRentGbp.toLocaleString('en-GB') + '/mo');
    }
    if (s.properties > 0) {
      parts.push((parts.length ? 'across ' : 'Managing ') + s.properties.toLocaleString('en-GB') + ' propert' + (s.properties === 1 ? 'y' : 'ies'));
    }
    if (s.tenants > 0) {
      parts.push(s.tenants.toLocaleString('en-GB') + ' tenant' + (s.tenants === 1 ? '' : 's'));
    }
    if (!parts.length) return;
    text.textContent = parts.join(' · ');
    el.style.display = '';
  }).catch(function(){ /* swallow — social proof is non-critical */ });
})();

// ── Tab switching ──────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('login-form').style.display   = tab==='login'   ? '' : 'none';
  document.getElementById('signup-form').style.display  = tab==='signup'  ? '' : 'none';
  document.getElementById('reset-form').style.display   = 'none';
  document.getElementById('reset-success').style.display= 'none';
  document.getElementById('auth-tabs').style.display    = '';
  document.getElementById('back-link').style.display    = '';
  clearMsg();
  document.querySelectorAll('.tab').forEach((t,i) => {
    t.classList.toggle('active', (tab==='login'&&i===0)||(tab==='signup'&&i===1));
  });
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type==='password' ? 'text' : 'password';
  btn.textContent = inp.type==='password' ? '👁' : '🙈';
}

function showMsg(text, type) {
  const el = document.getElementById('msg');
  el.textContent = text; el.className = 'msg ' + type;
}
function clearMsg() {
  const el = document.getElementById('msg');
  el.className = 'msg'; el.textContent = '';
}
function setLoading(prefix, loading) {
  const btn     = document.getElementById(prefix+'-btn');
  const spinner = document.getElementById(prefix+'-spinner');
  const text    = document.getElementById(prefix+'-btn-text');
  if(btn)     btn.disabled = loading;
  if(spinner) spinner.style.display = loading ? 'block' : 'none';
  if(text)    text.style.opacity = loading ? '.5' : '1';
}

// ── Login ──────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault(); clearMsg();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if(!email || !password) { showMsg('Please enter your email and password.', 'error'); return; }
  setLoading('login', true);
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if(error) { showMsg(friendlyError(error.message), 'error'); setLoading('login', false); return; }
  showMsg('✓ Logged in — loading dashboard…', 'success');
  setTimeout(() => { window.location.href = '/app'; }, 600);
}

// ── Demo login — one-click access with pre-seeded data that resets daily ──
const DEMO_EMAIL    = 'demo@landlordapp.io';
const DEMO_PASSWORD = 'DemoAccount2026!';
async function handleDemoLogin() {
  clearMsg();
  var btn = document.getElementById('demo-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.innerHTML = '<span>⏳</span><span>Opening demo…</span>'; }
  try {
    const { error } = await supa.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    if (error) {
      showMsg('Demo account unavailable. Please try the Sign up flow instead.', 'error');
      if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = '<span>🚀</span><span>Try the demo — no signup</span>'; }
      return;
    }
    showMsg('✓ Loading demo dashboard…', 'success');
    setTimeout(function(){ window.location.href = '/app'; }, 500);
  } catch (e) {
    showMsg('Could not load the demo. Please try again.', 'error');
    if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = '<span>🚀</span><span>Try the demo — no signup</span>'; }
  }
}

// ── Sign up (with plan + company) ─────────────────────────────
async function handleSignup(e) {
  e.preventDefault(); clearMsg();
  const name     = document.getElementById('signup-name').value.trim();
  const company  = document.getElementById('signup-company').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if(!name || !email || !password) { showMsg('Please fill in all required fields.', 'error'); return; }

  setLoading('signup', true);
  const { data, error } = await supa.auth.signUp({
    email, password,
    options: {
      data: {
        full_name:    name,
        company_name: company || name + "'s Properties",
      }
    }
  });
  if(error) { showMsg(friendlyError(error.message), 'error'); setLoading('signup', false); return; }

  // Meta Pixel: signup succeeded (fires regardless of whether email confirmation
  // is required — both branches below represent a real registration).
  if (typeof fbq === 'function') {
    try {
      fbq('track', 'CompleteRegistration', {
        content_name: 'Trial Signup',
        status: !!(data.session)
      });
    } catch(_) {}
  }

  if(data.user && !data.session) {
    // Email confirmation required — Supabase sends the confirmation email
    // itself; the branded welcome_signup mail fires on first login (server.js
    // checks for never-welcomed orgs at session-start).
    showMsg('✓ Account created! Check your email to confirm, then log in.', 'success');
    document.getElementById('signup-form').style.display = 'none';
  } else {
    // Day-0 welcome — fire-and-forget, fully detached from the redirect so a
    // slow Resend round-trip never blocks the signup flow. Activation playbook:
    // this email arrives within 5 min of signup and pushes "Add your first
    // property in 60 seconds" — the highest-leverage email in the funnel.
    var token = data.session && data.session.access_token;
    if (token) {
      fetch('/api/email/auth-lifecycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          templateId: 'welcome_signup',
          to: email,
          vars: {
            first_name: name.split(' ')[0],
            plan_name: 'Free',
            trial_end_date: '',
          },
        }),
      }).catch(function (err) {
        // Non-fatal: a failed welcome shouldn't block account creation. Logged
        // for ops follow-up; the trial_ending_7 cron will still hit them later.
        console.warn('Welcome email send failed:', err && err.message);
      });
    }
    showMsg('✓ Account created — choose your plan…', 'success');
    setTimeout(() => { window.location.href = 'choose-plan.html'; }, 600);
  }
  setLoading('signup', false);
}

// ── Forgot password ────────────────────────────────────────────
function showForgot(e) {
  if(e) e.preventDefault();
  document.getElementById('login-form').style.display    = 'none';
  document.getElementById('signup-form').style.display   = 'none';
  document.getElementById('auth-tabs').style.display     = 'none';
  document.getElementById('back-link').style.display     = 'none';
  document.getElementById('reset-form').style.display    = '';
  document.getElementById('reset-success').style.display = 'none';
  document.getElementById('forgot-title').style.display  = '';
  clearMsg();
}
function hideForgot() {
  document.getElementById('reset-form').style.display    = 'none';
  document.getElementById('reset-success').style.display = 'none';
  document.getElementById('forgot-title').style.display  = 'none';
  document.getElementById('auth-tabs').style.display     = '';
  document.getElementById('back-link').style.display     = '';
  switchTab('login');
}
async function handleReset(e) {
  e.preventDefault(); clearMsg();
  const email = document.getElementById('reset-email').value.trim();
  if(!email) { showMsg('Please enter your email address.', 'error'); return; }
  setLoading('reset', true);
  var error = null;
  try {
    const resp = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        redirectTo: window.ENV.WORKER_URL || window.location.origin + '/app'
      })
    });
    if(!resp.ok){
      const data = await resp.json().catch(function(){ return {}; });
      error = { message: (data && data.error) || 'Could not send reset email' };
    }
  } catch (e2) {
    error = { message: e2 && e2.message ? e2.message : 'Could not send reset email' };
  }
  setLoading('reset', false);
  if(error) { showMsg(friendlyError(error.message), 'error'); return; }
  document.getElementById('reset-form').style.display    = 'none';
  document.getElementById('reset-success').style.display = 'block';
}

function friendlyError(msg) {
  if(msg.includes('Invalid login'))      return '❌ Wrong email or password. Please try again.';
  if(msg.includes('Email not confirmed'))return '📬 Please confirm your email first — check your inbox.';
  if(msg.includes('already registered')) return '⚠️ This email is already registered. Try logging in instead.';
  if(msg.includes('Password should'))    return '⚠️ Password must be at least 8 characters.';
  if(msg.includes('rate limit'))         return '⏳ Too many attempts. Please wait a moment.';
  return '❌ ' + msg;
}

function showReset(e, show=true) { if(show) showForgot(e); else hideForgot(); }
