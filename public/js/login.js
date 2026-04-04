const SUPA_URL = window.ENV.SUPA_URL;
const SUPA_KEY = window.ENV.SUPA_KEY;
const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

const PLAN_LABELS = { trial:'Free Trial', starter:'Starter', professional:'Professional', business:'Business' };

// ── On load: check session + read URL params ───────────────────
(async function() {
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (session) { window.location.href = 'index.html'; return; }
  } catch(e) {}

  // Read URL params
  var params = new URLSearchParams(location.search);
  var planParam = params.get('plan');
  var tabParam  = params.get('tab');

  if(tabParam === 'signup' || planParam) {
    switchTab('signup');
  }

  if(planParam && PLAN_LABELS[planParam]) {
    // Pre-select plan from pricing page
    selectPlan(planParam);
    // Show banner, hide picker
    document.getElementById('plan-banner').style.display = 'flex';
    document.getElementById('plan-banner-name').textContent = PLAN_LABELS[planParam];
    document.getElementById('plan-picker').style.display = 'none';
  } else if(tabParam === 'signup') {
    // No plan — show picker
    document.getElementById('plan-banner').style.display = 'none';
    document.getElementById('plan-picker').style.display = 'block';
  }
})();

function selectPlan(plan) {
  var radios = document.querySelectorAll('input[name="signup-plan"]');
  radios.forEach(function(r){ r.checked = r.value === plan; });
}

function getSelectedPlan() {
  var checked = document.querySelector('input[name="signup-plan"]:checked');
  return checked ? checked.value : 'trial';
}

function showPlanPicker() {
  document.getElementById('plan-banner').style.display = 'none';
  document.getElementById('plan-picker').style.display = 'block';
}

function onPlanChange() {
  var plan = getSelectedPlan();
  document.getElementById('plan-banner-name').textContent = PLAN_LABELS[plan] || plan;
}

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
  setTimeout(() => { window.location.href = 'index.html'; }, 600);
}

// ── Sign up (with plan + company) ─────────────────────────────
async function handleSignup(e) {
  e.preventDefault(); clearMsg();
  const name     = document.getElementById('signup-name').value.trim();
  const company  = document.getElementById('signup-company').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const plan     = getSelectedPlan();

  if(!name || !email || !password) { showMsg('Please fill in all required fields.', 'error'); return; }

  setLoading('signup', true);
  const { data, error } = await supa.auth.signUp({
    email, password,
    options: {
      data: {
        full_name:    name,
        company_name: company || name + "'s Properties",
        selected_plan: plan,   // stored in user metadata, read by resolveOrg()
      }
    }
  });
  if(error) { showMsg(friendlyError(error.message), 'error'); setLoading('signup', false); return; }

  if(data.user && !data.session) {
    // Email confirmation required
    showMsg('✓ Account created! Check your email to confirm, then log in.', 'success');
    document.getElementById('signup-form').style.display = 'none';
  } else {
    showMsg('✓ Account created — loading your dashboard…', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
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
  const { error } = await supa.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://calm-cell-1923.g-depaula85.workers.dev/index.html'
  });
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
