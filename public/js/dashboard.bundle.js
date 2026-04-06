(() => {
  // state.js
  var state = {
    page: "dashboard",
    properties: [],
    tenants: [],
    payments: [],
    expenses: [],
    maintenance: [],
    contractors: [],
    filters: {
      props: "all",
      tenants: "all",
      rent: "all",
      expenses: "overview",
      maint: "open",
      maintView: "requests",
      rentPeriod: "week",
      rentTab: "today",
      expMonth: "all",
      expCompany: "",
      landlords: "all",
      schedTab: "all",
      dashCompany: "",
      propCompany: "",
      landlordCompany: "",
      propQ: "",
      tenantQ: "",
      tenantProp: "",
      roomQ: "",
      roomArea: "all",
      roomType: "all",
      roomSort: "price_asc"
    },
    rentSchedule: [],
    dashMonth: "2026-03",
    propDetailTab: null,
    tenantDetailTab: null,
    roomMedia: {},
    vault: {},
    voidDates: {},
    propDocs: {},
    lateFeeConfig: { graceDays: 3, feeType: "fixed", feeAmount: 25, enabled: true },
    currentUser: { id: "", name: "Loading...", initials: "U", role: "viewer", email: "" },
    users: [],
    roles: {
      admin: {
        label: "Admin",
        color: "#8B5CF6",
        bg: "#F5F3FF",
        icon: "\u{1F451}",
        pages: ["dashboard", "properties", "tenants", "rent", "expenses", "maintenance", "landlords", "rooms", "reports", "settings", "users"],
        canEdit: true,
        canDelete: true,
        canAddTenant: true,
        canMarkPaid: true,
        canViewFinancials: true,
        canManageUsers: true
      },
      manager: {
        label: "Manager",
        color: "#3B82F6",
        bg: "#EFF6FF",
        icon: "\u{1F4BC}",
        pages: ["dashboard", "properties", "tenants", "rent", "expenses", "maintenance", "rooms", "reports"],
        canEdit: true,
        canDelete: false,
        canAddTenant: true,
        canMarkPaid: true,
        canViewFinancials: true,
        canManageUsers: false
      },
      maintenance: {
        label: "Maintenance",
        color: "#F59E0B",
        bg: "#FFFBEB",
        icon: "\u{1F527}",
        pages: ["dashboard", "maintenance", "properties", "rooms"],
        canEdit: false,
        canDelete: false,
        canAddTenant: false,
        canMarkPaid: false,
        canViewFinancials: false,
        canManageUsers: false
      },
      viewer: {
        label: "Viewer",
        color: "#64748B",
        bg: "#F8FAFC",
        icon: "\u{1F441}\uFE0F",
        pages: ["dashboard", "properties", "tenants", "rent", "rooms", "reports"],
        canEdit: false,
        canDelete: false,
        canAddTenant: false,
        canMarkPaid: false,
        canViewFinancials: false,
        canManageUsers: false
      }
    },
    landlords: [],
    landlordPayments: [],
    companies: [],
    config: {},
    maintExtras: {},
    dealInputs: {}
  };

  // app.js
  (function _restoreLocalState() {
    var keys = ["companies", "config"];
    keys.forEach(function(k) {
      try {
        var raw = localStorage.getItem("pm_local_" + k);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed !== null && parsed !== void 0) state[k] = parsed;
        }
      } catch (e) {
      }
    });
  })();
  var fmt = (n) => "\xA3" + Math.round(Number(n) || 0).toLocaleString("en-GB");
  var pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  var net = (p) => p.rent - p.landlord;
  var BADGE_COLORS = {
    active: ["#10B981", "#ECFDF5"],
    notice_given: ["#F59E0B", "#FFFBEB"],
    paid: ["#10B981", "#ECFDF5"],
    outstanding: ["#E8375A", "#FEF0F3"],
    open: ["#E8375A", "#FEF0F3"],
    in_progress: ["#F59E0B", "#FFFBEB"],
    resolved: ["#10B981", "#ECFDF5"],
    confirmed: ["#10B981", "#ECFDF5"],
    estimated: ["#F59E0B", "#FFFBEB"],
    urgent: ["#E8375A", "#FEF0F3"],
    medium: ["#F59E0B", "#FFFBEB"],
    low: ["#94A3B8", "#F1F5F9"],
    bank: ["#3B82F6", "#EFF6FF"],
    cash: ["#F59E0B", "#FFFBEB"],
    Loss: ["#E8375A", "#FEF0F3"],
    Active: ["#10B981", "#ECFDF5"],
    Notice: ["#F59E0B", "#FFFBEB"]
  };
  function badge(label, override) {
    const clean = String(label).replace("_", " ");
    const key = label;
    const [c, bg] = override || BADGE_COLORS[key] || ["#64748B", "#F1F5F9"];
    return `<span class="badge" style="color:${c};background:${bg}">${clean}</span>`;
  }
  function kpi(label, value, sub, color, icon) {
    return `<div class="kpi">
    <div class="kpi-accent-bar" style="background:${color}"></div>
    <div class="kpi-icon" style="background:${color}15">${icon || "\u{1F4CA}"}</div>
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ""}
  </div>`;
  }
  function btn(label, onclick, variant = "primary", sm = false) {
    return `<button class="btn btn-${variant}${sm ? " btn-sm" : ""}" onclick="${onclick}">${label}</button>`;
  }
  function waLink(number, message = "") {
    const clean = number.replace(/\D/g, "");
    const msg = encodeURIComponent(message);
    return `https://wa.me/${clean}${msg ? "?text=" + msg : ""}`;
  }
  function waBtn(number, message, label = "WhatsApp") {
    if (!number) return '<span style="font-size:11px;color:var(--dim)">No number</span>';
    return `<a href="${waLink(number, message)}" target="_blank" class="wa-btn">\u{1F4AC} ${label}</a>`;
  }
  function getStats() {
    const income = state.properties.reduce((s, p) => s + p.rent, 0);
    const landlord = state.properties.reduce((s, p) => s + p.landlord, 0);
    const opex = state.expenses.reduce((s, e) => s + e.amount, 0);
    const rooms = state.properties.reduce((s, p) => s + p.rooms, 0);
    const occ = state.properties.reduce((s, p) => s + p.occupied, 0);
    const paid = state.payments.filter((p) => p.status === "paid");
    const owed = state.payments.filter((p) => p.status === "outstanding");
    const openM = state.maintenance.filter((m) => m.status !== "resolved");
    return { income, landlord, opex, profit: income - landlord - opex, rooms, occ, paid, owed, openM };
  }
  var NAV = [
    { id: "dashboard", icon: "\u{1F4CA}", label: "Dashboard" },
    { id: "properties", icon: "\u{1F3E0}", label: "Properties" },
    { id: "tenants", icon: "\u{1F465}", label: "Tenants" },
    { id: "rent", icon: "\u{1F4B7}", label: "Rent" },
    { id: "expenses", icon: "\u{1F4CB}", label: "Expenses" },
    { id: "maintenance", icon: "\u{1F527}", label: "Maintenance" },
    { id: "landlords", icon: "\u{1F3E6}", label: "Landlords" },
    { id: "rooms", icon: "\u{1F3E1}", label: "Rooms" },
    { id: "reports", icon: "\u{1F4C8}", label: "Reports" },
    { id: "settings", icon: "\u2699\uFE0F", label: "Settings" },
    { id: "users", icon: "\u{1F464}", label: "Users" }
  ];
  function can(perm) {
    var r = state.roles[state.currentUser.role];
    return r ? !!r[perm] : false;
  }
  function canSee(pageId) {
    var r = state.roles[state.currentUser.role];
    return r ? r.pages.indexOf(pageId) >= 0 : false;
  }
  function switchUser(uid) {
    var u = state.users.find(function(x) {
      return x.id === uid;
    });
    if (!u || u.status === "inactive") return;
    state.currentUser = u;
    if (!canSee(state.page)) state.page = "dashboard";
    render();
  }
  var TODAY = /* @__PURE__ */ new Date();
  var PORTAL_PASSWORD = "Welcome2024!";
  function getPortalUsername(t) {
    if (t.portalUsername) return t.portalUsername;
    var first = (t.name || "tenant").split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    var room = t.room || "1";
    t.portalUsername = first + "." + room;
    return t.portalUsername;
  }
  function getPortalPassword(t) {
    if (t.portalPassword) return t.portalPassword;
    t.portalPassword = generatePortalPassword();
    return t.portalPassword;
  }
  function resetPortalPassword(tid) {
    var t = state.tenants.find(function(x) {
      return x.id === tid;
    });
    if (!t) return;
    t.portalPassword = generatePortalPassword();
    saveState();
    openTenantDetail(tid);
    showToast("New password generated \u2713", "success");
  }
  function ensurePortalCredentials(t) {
    if (!t.portalUsername) {
      t.portalUsername = getPortalUsername(t);
    }
    return t.portalUsername;
  }
  var SUPA_URL = window.ENV.SUPA_URL;
  var SUPA_KEY = window.ENV.SUPA_KEY;
  var supa = supabase.createClient(SUPA_URL, SUPA_KEY);
  async function fetchAiMessages(payload) {
    var sr = await supa.auth.getSession();
    var session = sr.data.session;
    if (!session) throw new Error("Not signed in");
    return fetch("/api/ai/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.access_token
      },
      body: JSON.stringify(payload)
    });
  }
  var _authReady = false;
  var _appBootPending = true;
  var _currentOrgId = null;
  var _currentMemberRole = "viewer";
  function setAppBootMessage(msg) {
    var el = document.getElementById("app-boot-overlay-msg");
    if (el && msg) el.textContent = msg;
  }
  function hideAppBootOverlay() {
    var el = document.getElementById("app-boot-overlay");
    if (el) {
      el.classList.add("app-boot--hide");
      el.setAttribute("aria-busy", "false");
    }
  }
  function normalizeRole(role) {
    var r = String(role || "").toLowerCase().trim();
    if (r === "owner") r = "admin";
    return state.roles && state.roles[r] ? r : "viewer";
  }
  function isPaidPlanForCheckout(plan) {
    var p = String(plan || "").toLowerCase();
    return p === "starter" || p === "professional" || p === "business";
  }
  function getStripeResultFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      return String(params.get("stripe") || "").toLowerCase();
    } catch (_e) {
      return "";
    }
  }
  async function refreshOrgBillingState(orgId, attempts, waitMs) {
    var total = attempts || 8;
    var delay = waitMs || 1500;
    for (var i = 0; i < total; i++) {
      var r = await supa.from("organisations").select("id,name,plan,status,trial_ends_at,billing_email,owner_email,stripe_customer_id,stripe_subscription_id").eq("id", orgId).maybeSingle();
      if (!r.error && r.data) {
        state._currentOrg = Object.assign({}, state._currentOrg || {}, r.data);
        if (r.data.stripe_subscription_id) return r.data;
      }
      if (i < total - 1) {
        await new Promise(function(resolve) {
          setTimeout(resolve, delay);
        });
      }
    }
    return state._currentOrg || null;
  }
  function needsPaidCheckoutGate(org) {
    return !!(org && isPaidPlanForCheckout(org.plan) && !org.stripe_subscription_id);
  }
  async function mergeOrgEmailSettingsIfAvailable() {
    if (!_currentOrgId || !state._currentOrg) return;
    var r = await supa.from("organisations").select("email_settings").eq("id", _currentOrgId).maybeSingle();
    if (r.error) {
      var c = String(r.error.code || "");
      var msg = String(r.error.message || "");
      if (c === "42703" || msg.indexOf("email_settings") !== -1) return;
      return;
    }
    if (r.data && r.data.email_settings != null) {
      state._currentOrg.email_settings = r.data.email_settings;
    }
  }
  function upsertSessionUser(session, roleHint) {
    if (!session || !session.user) return null;
    var authId = session.user.id;
    var authEmail = (session.user.email || "").trim();
    var authName = session.user.user_metadata && session.user.user_metadata.full_name ? String(session.user.user_metadata.full_name).trim() : authEmail ? authEmail.split("@")[0] : "User";
    var role = normalizeRole(roleHint != null ? roleHint : _currentMemberRole);
    var initials = (authName || "U").split(/\s+/).map(function(w) {
      return w[0] || "";
    }).join("").toUpperCase().slice(0, 2) || "U";
    var matched = state.users.find(function(u) {
      return String(u.id) === String(authId);
    });
    if (!matched && authEmail) {
      matched = state.users.find(function(u) {
        return u.email && u.email.toLowerCase() === authEmail.toLowerCase();
      });
    }
    if (matched) {
      matched.id = authId;
      matched.name = authName || matched.name || "User";
      matched.email = authEmail || matched.email || "";
      matched.initials = initials;
      matched.role = role;
      matched.status = matched.status || "active";
      matched.lastLogin = "Today";
      state.currentUser = matched;
    } else {
      state.currentUser = {
        id: authId,
        name: authName,
        initials,
        email: authEmail,
        phone: "",
        role,
        status: "active",
        lastLogin: "Today"
      };
      state.users.push(state.currentUser);
    }
    return state.currentUser;
  }
  async function syncUsersFromOrgMembers(session) {
    if (!_currentOrgId) return;
    try {
      var existingById = {};
      (state.users || []).forEach(function(u) {
        existingById[String(u.id)] = u;
      });
      var pendingInvites = (state.users || []).filter(function(u) {
        return u && u.status === "pending";
      });
      var currentId = String(session && session.user ? session.user.id : "");
      var currentEmail = session && session.user ? session.user.email || "" : "";
      var currentName = session && session.user && session.user.user_metadata && session.user.user_metadata.full_name ? session.user.user_metadata.full_name : state.currentUser && state.currentUser.name ? state.currentUser.name : "User";
      var q = await supa.from("org_members").select("user_id, role, created_at").eq("org_id", _currentOrgId).order("created_at", { ascending: true });
      if (q.error) {
        console.warn("syncUsersFromOrgMembers:", q.error);
        return;
      }
      var mapped = (q.data || []).map(function(m) {
        var uid = String(m.user_id || "");
        var prev = existingById[uid] || {};
        var isMe = uid === currentId;
        var name = prev.name || (isMe ? currentName : "User " + uid.slice(-6));
        var email = prev.email || (isMe ? currentEmail : "");
        var initials = (name || "U").split(/\s+/).map(function(w) {
          return w[0] || "";
        }).join("").toUpperCase().slice(0, 2) || "U";
        return {
          id: uid,
          name,
          initials,
          email,
          phone: prev.phone || "",
          role: normalizeRole(m.role),
          status: "active",
          lastLogin: isMe ? "Today" : prev.lastLogin || "\u2014"
        };
      });
      state.users = mapped.concat(pendingInvites);
      var me = state.users.find(function(u) {
        return String(u.id) === currentId;
      });
      if (me) state.currentUser = me;
    } catch (e) {
      console.warn("syncUsersFromOrgMembers failed:", e);
    }
  }
  async function resolveOrg(session) {
    _currentMemberRole = "viewer";
    setAppBootMessage("Preparing your workspace\u2026");
    var { data: membership, error: memberErr } = await supa.from("org_members").select("org_id, role, organisations(id,name,plan,status,trial_ends_at,billing_email,owner_email,stripe_customer_id,stripe_subscription_id)").eq("user_id", session.user.id).maybeSingle();
    if (memberErr && memberErr.code !== "PGRST116") {
      console.warn("org_members lookup:", memberErr);
    }
    if (membership && membership.org_id) {
      _currentOrgId = membership.org_id;
      _currentMemberRole = normalizeRole(membership.role);
      var org = membership.organisations;
      state._currentOrg = org;
      await mergeOrgEmailSettingsIfAvailable();
      var stripeResult = getStripeResultFromUrl();
      if (stripeResult === "success" && needsPaidCheckoutGate(state._currentOrg)) {
        setAppBootMessage("Confirming your payment\u2026");
        org = await refreshOrgBillingState(membership.org_id, 10, 1500) || org;
        state._currentOrg = org;
      }
      if (needsPaidCheckoutGate(org)) {
        if (stripeResult === "cancelled") {
          var fallbackPlan = String(org && org.plan || "starter").toLowerCase();
          if (!isPaidPlanForCheckout(fallbackPlan)) fallbackPlan = "starter";
          window.location.href = "choose-plan.html?stripe=cancelled&plan=" + encodeURIComponent(fallbackPlan);
          return false;
        }
        showCheckoutRequired(org);
        return false;
      }
      if (org && org.status === "trial" && org.trial_ends_at) {
        var daysLeft = Math.ceil((new Date(org.trial_ends_at) - /* @__PURE__ */ new Date()) / 864e5);
        if (daysLeft < 0) {
          showTrialExpired(org.name);
          return false;
        }
        if (daysLeft <= 3) {
          setTimeout(function() {
            showToast && showToast("\u26A0\uFE0F Trial expires in " + daysLeft + " day" + (daysLeft === 1 ? "" : "s"), "warn");
          }, 2e3);
        }
      }
      if (org && (org.status === "paused" || org.status === "cancelled")) {
        showAccountInactive(org.status, org.name);
        return false;
      }
      return true;
    }
    setAppBootMessage("Creating your organisation\u2026");
    var email = session.user.email || "";
    var name = session.user.user_metadata && session.user.user_metadata.full_name || email.split("@")[0];
    var companyName = session.user.user_metadata && session.user.user_metadata.company_name || name + "'s Properties";
    companyName = String(companyName).trim() || name + "'s Properties";
    var selectedPlan = session.user.user_metadata && session.user.user_metadata.selected_plan;
    if (!selectedPlan) {
      window.location.href = "choose-plan.html";
      return false;
    }
    selectedPlan = String(selectedPlan).toLowerCase();
    var isPaidSignupPlan = selectedPlan === "starter" || selectedPlan === "professional" || selectedPlan === "business";
    var slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
    var trialEnd = isPaidSignupPlan ? new Date(Date.now() + 14 * 864e5).toISOString() : null;
    var { data: newOrg, error: orgErr } = await supa.from("organisations").insert([{
      name: companyName,
      slug,
      owner_email: email,
      plan: isPaidSignupPlan ? selectedPlan : "free",
      status: isPaidSignupPlan ? "trial" : "active",
      trial_ends_at: trialEnd
    }]).select().single();
    if (orgErr || !newOrg) {
      console.error("Failed to create org:", orgErr);
      showToast && showToast("Could not create your organisation. Check console / Supabase policies.", "error");
      return false;
    }
    var { error: omErr } = await supa.from("org_members").insert([{
      org_id: newOrg.id,
      user_id: session.user.id,
      role: "admin"
    }]);
    if (omErr) {
      console.error("Failed to create org_members:", omErr);
      showToast && showToast("Organisation created but membership failed. Contact support.", "error");
      return false;
    }
    _currentOrgId = newOrg.id;
    _currentMemberRole = "admin";
    state._currentOrg = newOrg;
    console.log("New org provisioned:", newOrg.name, newOrg.id);
    if (needsPaidCheckoutGate(newOrg)) {
      showCheckoutRequired(newOrg);
      return false;
    }
    return true;
  }
  function showTrialExpired(orgName) {
    document.body.innerHTML = `
    <div style="min-height:100vh;background:#0B0D12;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:20px">
      <div style="background:#13161E;border:1px solid rgba(255,77,106,.3);border-radius:16px;padding:40px;max-width:460px;width:100%;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">\u23F0</div>
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
        <div style="font-size:48px;margin-bottom:16px">${status === "paused" ? "\u23F8\uFE0F" : "\u{1F512}"}</div>
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:8px">Account ${status === "paused" ? "Paused" : "Inactive"}</div>
        <div style="font-size:14px;color:#7A8099;margin-bottom:24px;line-height:1.6">
          <strong style="color:#fff">${orgName}</strong> has been ${status}.<br>Please contact support to reactivate.
        </div>
        <a href="mailto:gleydson@reservationsdirect.co.uk?subject=PropManager Account&body=Hi, my account (${orgName}) is ${status}. Please help." style="display:inline-block;padding:13px 28px;background:#00D897;color:#000;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;margin-bottom:12px">Contact Support</a>
        <br>
        <button onclick="doLogOut()" style="background:none;border:none;color:#7A8099;font-size:13px;cursor:pointer;margin-top:8px;font-family:inherit">Sign out</button>
      </div>
    </div>`;
  }
  function showCheckoutRequired(org) {
    var orgName = org && org.name || "your workspace";
    var plan = String(org && org.plan || "starter").toLowerCase();
    if (!isPaidPlanForCheckout(plan)) plan = "starter";
    var planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    document.body.innerHTML = `
    <div style="min-height:100vh;background:#0B0D12;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:20px">
      <div style="background:#13161E;border:1px solid rgba(0,216,151,.35);border-radius:16px;padding:40px;max-width:520px;width:100%;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">\u{1F4B3}</div>
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:8px">Complete subscription setup</div>
        <div style="font-size:14px;color:#7A8099;margin-bottom:24px;line-height:1.6">
          <strong style="color:#fff">${orgName}</strong> is on the <strong style="color:#fff">${planLabel}</strong> plan.<br>
          Complete Stripe checkout to continue to your dashboard.
        </div>
        <button onclick="startStripeCheckout('${plan}', { clearStartCheckoutParam: true })" style="display:inline-block;padding:13px 28px;background:#00D897;color:#000;font-weight:700;font-size:15px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;margin-bottom:12px">Continue to payment</button>
        <br>
        <button onclick="doLogOut()" style="background:none;border:none;color:#7A8099;font-size:13px;cursor:pointer;margin-top:8px;font-family:inherit">Sign out</button>
      </div>
    </div>`;
    try {
      var params = new URLSearchParams(window.location.search || "");
      var qPlan = String(params.get("startCheckout") || "").toLowerCase();
      if (qPlan === plan) {
        setTimeout(function() {
          startStripeCheckout(plan, { clearStartCheckoutParam: true });
        }, 250);
      }
    } catch (_qe) {
    }
  }
  supa.auth.onAuthStateChange(function(event, session) {
    if (event === "PASSWORD_RECOVERY") {
      document.open();
      document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Set New Password</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#fff;border-radius:16px;padding:36px;max-width:400px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08)}h2{font-size:20px;font-weight:700;margin-bottom:6px}p{font-size:13px;color:#64748b;margin-bottom:22px}input{width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:9px;font-size:15px;margin-bottom:12px;outline:none;font-family:inherit}input:focus{border-color:#00b894;box-shadow:0 0 0 3px rgba(0,184,148,.1)}.btn{width:100%;padding:13px;background:#00b894;color:#fff;border:none;border-radius:100px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}.msg{font-size:13px;font-weight:600;padding:10px 12px;border-radius:8px;margin-bottom:12px;display:none}.err{background:#fee2e2;color:#b91c1c}.ok{background:#d1fae5;color:#065f46}</style></head><body><div class="card"><h2>Set new password</h2><p>Choose a strong password for your account.</p><div id="msg" class="msg"></div><input type="password" id="pw1" placeholder="New password (min 8 characters)" autocomplete="new-password"><input type="password" id="pw2" placeholder="Confirm new password" autocomplete="new-password"><button class="btn" onclick="setpw()">Update password</button></div><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script><script>var _sc=supabase.createClient("' + window.ENV.SUPA_URL + '", "' + window.ENV.SUPA_KEY + '");async function setpw(){var p1=document.getElementById("pw1").value,p2=document.getElementById("pw2").value,m=document.getElementById("msg");if(p1.length<8){m.className="msg err";m.textContent="Min 8 characters";m.style.display="block";return;}if(p1!==p2){m.className="msg err";m.textContent="Passwords do not match";m.style.display="block";return;}var {error}=await _sc.auth.updateUser({password:p1});if(error){m.className="msg err";m.textContent="Error: "+error.message;m.style.display="block";return;}m.className="msg ok";m.textContent="Password updated! Redirecting to login...";m.style.display="block";setTimeout(function(){window.location.href="login.html";},1500);}<\/script></body></html>');
      document.close();
      return;
    }
    if (_authReady) return;
    _authReady = true;
    if (!session) {
      _appBootPending = false;
      hideAppBootOverlay();
      window.location.href = "propmanager-landing.html";
      return;
    }
    setAppBootMessage("Signing you in\u2026");
    upsertSessionUser(session, "viewer");
    resolveOrg(session).then(function(ok) {
      if (!ok) {
        _appBootPending = false;
        hideAppBootOverlay();
        return;
      }
      upsertSessionUser(session, _currentMemberRole);
      syncUsersFromOrgMembers(session).then(function() {
        setAppBootMessage("Loading your data\u2026");
        loadState().then(function(loaded) {
          _appBootPending = false;
          hideAppBootOverlay();
          if (!loaded) {
            showToast && showToast("Could not load workspace data.", "error");
            return;
          }
          runAfterSupabaseLoad();
          if (!canSee(state.page)) state.page = "dashboard";
          render();
          try {
            maybeStartCheckoutFromQuery();
          } catch (e3) {
          }
          try {
            saveState();
          } catch (e2) {
          }
        });
      });
    });
  });
  function rowToLandlord(r) {
    return {
      id: r.id,
      name: r.name || "",
      phone: r.phone || "",
      email: r.email || "",
      bank: r.bank || "",
      sortCode: r.sort_code || "",
      accountNo: r.account_no || "",
      notes: r.notes || ""
    };
  }
  function rowToProp(r) {
    return {
      id: r.id,
      name: r.name || "",
      address: r.address || "",
      postcode: r.postcode || "",
      area: r.area || "",
      type: r.type || "HMO",
      rooms: r.rooms || 0,
      occupied: r.occupied || 0,
      rent: parseFloat(r.rent) || 0,
      landlord: parseFloat(r.landlord_rent) || 0,
      landlordId: r.landlord_id || null,
      landlordName: r.landlord_name || "",
      mapsUrl: r.maps_url || "",
      notes: r.notes || "",
      companyId: r.company_id || "",
      roomList: Array.isArray(r.room_list) ? r.room_list : [],
      ownershipType: r.ownership_type || "managed",
      lettingType: r.letting_type || "hmo",
      bedrooms: r.bedrooms || null,
      mortgage: r.mortgage || null,
      purchaseInfo: r.purchase_info || null
    };
  }
  function rowToTenant(r) {
    return {
      id: r.id,
      name: r.name || "",
      property: r.property_name || "",
      propertyId: r.property_id || null,
      room: r.room_number || null,
      roomType: r.room_type || "Single",
      rent: parseFloat(r.rent) || 0,
      freq: r.freq || "weekly",
      payDay: r.pay_day || "Monday",
      payDayOfMonth: r.pay_day_of_month || null,
      method: r.method || "bank",
      status: r.status || "active",
      arrears: parseFloat(r.arrears) || 0,
      deposit: parseFloat(r.deposit) || 0,
      depositStatus: r.deposit_status || "held",
      whatsapp: r.whatsapp || "",
      email: r.email || "",
      checkIn: r.move_in || null,
      startDate: r.start_date || null,
      noticeDate: r.notice_date || null,
      moveOutDate: r.move_out_date || null,
      notes: r.notes || "",
      paymentHistory: Array.isArray(r.payment_history) ? r.payment_history : [],
      portalUsername: r.portal_username || null,
      portalPassword: r.portal_password || null,
      previousTenancies: Array.isArray(r.previous_tenancies) ? r.previous_tenancies : []
    };
  }
  function rowToPayment(r) {
    var dd = r.due_date || null;
    var ddRaw = null;
    if (dd) {
      var _ddp = dd.split("T")[0].split("-");
      if (_ddp.length === 3) ddRaw = new Date(+_ddp[0], +_ddp[1] - 1, +_ddp[2]).getTime();
      else ddRaw = new Date(dd).getTime();
    }
    var _paidDateRaw = null;
    var _pd = r.paid_date || null;
    if (_pd) {
      var _months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      var _pdp = String(_pd).split(" ");
      if (_pdp.length === 3 && _months[_pdp[1]] !== void 0) {
        _paidDateRaw = new Date(+_pdp[2], _months[_pdp[1]], +_pdp[0]).getTime();
      } else {
        var _iso = _pd.split("T")[0].split("-");
        if (_iso.length === 3) _paidDateRaw = new Date(+_iso[0], +_iso[1] - 1, +_iso[2]).getTime();
      }
    }
    return {
      id: r.id,
      tenantId: r.tenant_id || null,
      tenantName: r.tenant_name || "",
      tenant: r.tenant_name || "",
      // alias for renderRent compatibility
      propertyName: r.property_name || "",
      property: r.property_name || "",
      amount: parseFloat(r.amount) || 0,
      method: r.method || "bank",
      status: r.status || "paid",
      dueDate: dd,
      _dueDateRaw: ddRaw,
      _paidDateRaw,
      paidDate: r.paid_date || null,
      isPartial: r.is_partial || false,
      shortfall: parseFloat(r.shortfall) || 0,
      notes: r.notes || ""
    };
  }
  function rowToExpense(r) {
    var cat = r.category || "", desc = r.description || "", propName = r.property_name || "";
    return {
      id: r.id,
      category: cat,
      description: desc,
      cat,
      desc,
      amount: parseFloat(r.amount) || 0,
      type: r.type || "",
      status: r.status || "estimated",
      freq: r.freq || "one-off",
      recurring: r.recurring || false,
      startDate: r.start_date || null,
      propertyId: r.property_id || null,
      propertyName: propName,
      property: propName
    };
  }
  function rowToMaintenance(r) {
    return {
      id: r.id,
      property: r.property_name || "",
      propertyId: r.property_id || null,
      roomNumber: r.room_number || null,
      location: r.location || "",
      tenantName: r.tenant_name || "",
      room: r.room_number || null,
      tenant: r.tenant_name || "",
      issue: r.issue || "",
      category: r.category || "General",
      priority: r.priority || "medium",
      status: r.status || "open",
      notes: r.notes || "",
      photoUrl: r.photo_url || "",
      photo: r.photo_url || "",
      date: r.logged_date || null,
      cat: r.category || "General",
      loggedDate: r.logged_date || null,
      resolvedDate: r.resolved_date || null,
      contractor: r.contractor || "",
      jobCost: parseFloat(r.job_cost) || 0,
      invoiceName: r.invoice_name || "",
      invoiceUrl: r.invoice_url || ""
    };
  }
  function rowToLandlordPayment(r) {
    return {
      id: r.id,
      landlordId: r.landlord_id || null,
      landlordName: r.landlord_name || "",
      propId: r.property_id || null,
      propName: r.property_name || "",
      monthKey: r.month_key || "",
      monthLabel: r.month_label || "",
      amount: parseFloat(r.amount) || 0,
      dueDate: r.due_date || null,
      paidDate: r.paid_date || null,
      status: r.status || "pending",
      method: r.method || "bank",
      ref: r.ref || ""
    };
  }
  function rowToContractor(r) {
    return {
      id: r.id,
      name: r.name || "",
      trade: r.trade || "General",
      phone: r.phone || "",
      whatsapp: r.whatsapp || "",
      email: r.email || "",
      notes: r.notes || "",
      rating: r.rating || null,
      lastUsed: r.last_used || null,
      callOutCharge: parseFloat(r.call_out_charge) || 0
    };
  }
  function contractorToRow(c) {
    return {
      id: c.id,
      name: c.name || "",
      trade: c.trade || "General",
      phone: c.phone || "",
      whatsapp: c.whatsapp || "",
      email: c.email || "",
      notes: c.notes || "",
      rating: c.rating || null,
      last_used: c.lastUsed || null,
      call_out_charge: c.callOutCharge || 0
    };
  }
  function landlordToRow(l) {
    return {
      id: l.id,
      name: l.name || "",
      phone: l.phone || "",
      email: l.email || "",
      bank: l.bank || "",
      sort_code: l.sortCode || "",
      account_no: l.accountNo || "",
      notes: l.notes || ""
    };
  }
  function propToRow(p) {
    return {
      id: p.id,
      name: p.name || "",
      address: p.address || "",
      postcode: p.postcode || "",
      area: p.area || "",
      type: p.type || "HMO",
      rooms: p.rooms || 0,
      occupied: p.occupied || 0,
      rent: p.rent || 0,
      landlord_rent: p.landlord || 0,
      landlord_id: p.landlordId || null,
      landlord_name: p.landlordName || "",
      maps_url: p.mapsUrl || "",
      notes: p.notes || "",
      company_id: p.companyId || null,
      room_list: p.roomList || [],
      ownership_type: p.ownershipType || "managed",
      letting_type: p.lettingType || "hmo",
      bedrooms: p.bedrooms || null,
      mortgage: p.mortgage || null,
      purchase_info: p.purchaseInfo || null
    };
  }
  function tenantToRow(t) {
    return {
      id: t.id,
      name: t.name || "",
      property_id: t.propertyId || null,
      property_name: t.property || "",
      room_number: t.room || null,
      room_type: t.roomType || "Single",
      rent: t.rent || 0,
      freq: t.freq || "weekly",
      pay_day: t.payDay || null,
      pay_day_of_month: t.payDayOfMonth || null,
      method: t.method || "bank",
      status: t.status || "active",
      arrears: t.arrears || 0,
      deposit: t.deposit || 0,
      deposit_status: t.depositStatus || "held",
      whatsapp: t.whatsapp || "",
      email: t.email || "",
      move_in: t.checkIn || null,
      start_date: t.startDate || null,
      notice_date: t.noticeDate || null,
      move_out_date: t.moveOutDate || null,
      notes: t.notes || "",
      payment_history: t.paymentHistory || [],
      portal_username: t.portalUsername || null,
      portal_password: t.portalPassword || null,
      previous_tenancies: t.previousTenancies || []
    };
  }
  function paymentToRow(p) {
    return {
      id: p.id,
      tenant_id: p.tenantId || null,
      tenant_name: p.tenantName || "",
      property_name: p.propertyName || "",
      amount: p.amount || 0,
      method: p.method || "bank",
      status: p.status || "paid",
      due_date: p.dueDate || null,
      paid_date: p.paidDate || null,
      is_partial: p.isPartial || false,
      shortfall: p.shortfall || 0,
      notes: p.notes || ""
    };
  }
  function expenseToRow(e) {
    return {
      id: e.id,
      category: e.category || "",
      description: e.description || "",
      amount: e.amount || 0,
      type: e.type || "",
      status: e.status || "estimated",
      freq: e.freq || "one-off",
      recurring: e.recurring || false,
      start_date: e.startDate || null,
      property_id: e.propertyId || null,
      property_name: e.propertyName || ""
    };
  }
  function maintenanceToRow(m) {
    var mx = state.maintExtras && state.maintExtras[m.id] || {};
    return {
      id: m.id,
      property_id: m.propertyId || null,
      property_name: m.property || "",
      room_number: m.roomNumber || m.room || null,
      location: m.location || "",
      tenant_name: m.tenantName || m.tenant || "",
      issue: m.issue || "",
      category: m.category || m.cat || "General",
      priority: m.priority || "medium",
      status: m.status || "open",
      notes: m.notes || "",
      photo_url: m.photoUrl || m.photo || "",
      logged_date: m.loggedDate || m.date || null,
      resolved_date: m.resolvedDate || null,
      contractor: m.contractor || null,
      job_cost: mx.cost || m.jobCost || null,
      invoice_name: mx.invoiceName || m.invoiceName || null,
      invoice_url: mx.invoiceUrl || m.invoiceUrl || null
    };
  }
  function landlordPaymentToRow(lp) {
    return {
      id: lp.id,
      landlord_id: lp.landlordId || null,
      landlord_name: lp.landlordName || "",
      property_id: lp.propId || null,
      property_name: lp.propName || "",
      month_key: lp.monthKey || "",
      month_label: lp.monthLabel || "",
      amount: lp.amount || 0,
      due_date: lp.dueDate || null,
      paid_date: lp.paidDate || null,
      status: lp.status || "pending",
      method: lp.method || "bank",
      ref: lp.ref || ""
    };
  }
  async function supaDelete(table, id) {
    try {
      await supa.from(table).delete().eq("id", id);
    } catch (e) {
      console.warn("supaDelete failed", table, id, e);
    }
  }
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var WEEKS_AHEAD = 8;
  var MONTHS = (function() {
    var now = /* @__PURE__ */ new Date();
    var result = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var y = d.getFullYear(), m = d.getMonth();
      var lastDay = new Date(y, m + 1, 0).getDate();
      var MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var key = y + "-" + (m + 1 < 10 ? "0" : "") + (m + 1);
      result.push({
        key,
        label: MONTHS_ABBR[m] + " " + y,
        from: new Date(y, m, 1),
        to: new Date(y, m, lastDay)
      });
    }
    return result;
  })();
  function renderNav() {
    const s = getStats();
    const badges = { rent: s.owed.length, maintenance: s.openM.filter((m) => m.priority === "urgent").length };
    const rooms = state.properties.reduce((a, p) => a + p.rooms, 0);
    const occ = state.properties.reduce((a, p) => a + p.occupied, 0);
    const op = pct(occ, rooms);
    const visibleNav = NAV.filter((n) => canSee(n.id));
    document.getElementById("sb-nav").innerHTML = visibleNav.map((n) => `
    <button class="nav-btn ${state.page === n.id ? "active" : ""}" onclick="goto('${n.id}')">
      <span class="nav-inner">${n.icon} ${n.label}</span>
      ${badges[n.id] > 0 ? `<span class="nav-badge">${badges[n.id]}</span>` : ""}
    </button>`).join("");
    var occBar = document.getElementById("occ-bar");
    var occLabel = document.getElementById("occ-label");
    if (occBar) {
      occBar.style.width = op + "%";
      occBar.style.background = op >= 90 ? "#10B981" : op >= 70 ? "#F59E0B" : "#EF4444";
    }
    if (occLabel) occLabel.textContent = op + "% occupied";
    const alerts = [];
    if (s.owed.length > 0) alerts.push(`<span class="alert-chip" style="color:var(--red);background:var(--red-light)">\u26A0\uFE0F ${s.owed.length} outstanding</span>`);
    if (s.openM.filter((m) => m.priority === "urgent").length > 0) alerts.push(`<span class="alert-chip" style="color:var(--amber);background:var(--amber-light)">\u{1F527} ${s.openM.filter((m) => m.priority === "urgent").length} urgent</span>`);
    alerts.push(`<div style="width:32px;height:32px;border-radius:10px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--accent-dark)">G</div>`);
    const cu = state.currentUser;
    const cr = state.roles[cu.role];
    alerts.push(`<div style="display:flex;align-items:center;gap:6px"><div onclick="goto('settings')" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 8px;border-radius:9px;border:1px solid var(--border);background:var(--surface)">` + (state.config && state.config.logoUrl ? '<img src="' + state.config.logoUrl + '" style="width:24px;height:24px;border-radius:6px;object-fit:cover">' : "") + '<div style="width:28px;height:28px;border-radius:8px;background:' + (cr ? cr.bg : "var(--accent-light)") + ";display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:" + (cr ? cr.color : "var(--accent-dark)") + '">' + cu.initials + '</div><div style="line-height:1.2"><div style="font-size:11px;font-weight:700;color:var(--text)">' + cu.name.split(" ")[0] + '</div><div style="font-size:9px;font-weight:600;color:' + (cr ? cr.color : "var(--muted)") + '">' + (cr ? cr.icon + " " + cr.label : cu.role) + '</div></div></div><button onclick="doLogOut()" style="padding:5px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit" title="Log out">&rarr; Out</button></div>');
    document.getElementById("alerts-bar").innerHTML = alerts.join("");
    document.getElementById("mobile-nav").innerHTML = visibleNav.map((n) => `
    <button class="mob-btn ${state.page === n.id ? "active" : ""}" onclick="goto('${n.id}')">
      ${badges[n.id] > 0 ? `<span class="mob-badge">${badges[n.id]}</span>` : ""}
      <span style="font-size:20px">${n.icon}</span>
      <span>${n.label}</span>
    </button>`).join("");
  }
  function quickSetDueDay(tid, val, freq) {
    var t = state.tenants.find(function(x) {
      return x.id === tid;
    });
    if (!t) return;
    if (freq === "monthly") {
      t.payDayOfMonth = parseInt(val);
      t.payDay = null;
    } else {
      t.payDay = val;
      t.payDayOfMonth = null;
    }
    rebuildTenantSchedule(tid);
    saveState();
    showToast("Due day updated \u2713", "success");
  }
  function _parseRoomEid(el) {
    var id = el.id || "";
    if (!id || id === "rm-") return null;
    var m = id.match(/^rm-(.+)__(\d+)-/);
    if (!m) return null;
    var eidKey = m[1] + "__" + m[2];
    if (window._roomEidMap && window._roomEidMap[eidKey]) return window._roomEidMap[eidKey];
    return { pid: m[1], rn: parseInt(m[2]) };
  }
  function handleRoomPhotoChange(el) {
    var info = _parseRoomEid(el);
    if (!info) return;
    handlePhotoUpload(info.pid, info.rn, el);
  }
  function handleRoomVideoChange(el) {
    var info = _parseRoomEid(el);
    if (!info) return;
    handleVideoUpload(info.pid, info.rn, el);
  }
  function toggleRoomAvailByEid(el) {
    var info = _parseRoomEid(el);
    if (!info) return;
    var p = state.properties.find(function(x) {
      return x.id === info.pid;
    });
    if (!p || !p.roomList) return;
    var r = p.roomList.find(function(x) {
      return x.n === info.rn;
    });
    if (!r) return;
    r._hidden = !r._hidden;
    saveState();
    render();
    showToast(r._hidden ? "Room hidden from listings" : "Room visible in listings", r._hidden ? "error" : "success");
  }
  function saveRoomNotesByEid(el) {
    var info = _parseRoomEid(el);
    if (!info) return;
    var noteEl = document.getElementById("rm-" + info.pid + "__" + info.rn + "-notes");
    if (noteEl) {
      getMedia(info.pid, info.rn).notes = noteEl.value;
      saveState();
      showToast("Notes saved \u2713", "success");
    }
  }
  function shareRoomWAByEid(el) {
    var info = _parseRoomEid(el);
    if (!info) return;
    shareRoomWA(info.pid, info.rn);
  }
  function removeRoomPhotoByEid(el) {
    var info = _parseRoomEid(el);
    if (!info) return;
    var piMatch = el.id.match(/-delpic-(\d+)$/);
    if (piMatch) removeRoomPhoto(info.pid, info.rn, parseInt(piMatch[1]));
  }
  function removeRoomVideoByEid(el) {
    var info = _parseRoomEid(el);
    if (!info) return;
    removeRoomVideo(info.pid, info.rn);
  }
  function removeRoomPhotoBtn(el) {
    removeRoomPhoto(el.dataset.pid, parseInt(el.dataset.rn), parseInt(el.dataset.pi));
  }
  function removeRoomVideoBtn(el) {
    removeRoomVideo(el.dataset.pid, parseInt(el.dataset.rn));
  }
  function handlePhotoUploadBtn(el) {
    handlePhotoUpload(el.dataset.pid, parseInt(el.dataset.rn), el);
  }
  function handleVideoUploadBtn(el) {
    handleVideoUpload(el.dataset.pid, parseInt(el.dataset.rn), el);
  }
  function shareRoomWABtn(el) {
    shareRoomWA(el.dataset.pid, parseInt(el.dataset.rn));
  }
  function saveRoomNotesBtn(el) {
    saveRoomNotes(el.dataset.pid, parseInt(el.dataset.rn));
  }
  function goto(page) {
    if (!canSee(page)) return;
    if (page !== "tenants") state.filters.tenantQ = "";
    if (page !== "properties") state.filters.propQ = "";
    if (page !== "maintenance") state.filters.maintQ = "";
    state.page = page;
    render();
  }
  function render() {
    renderNav();
    const pages = { dashboard: renderDashboard, properties: renderProperties, tenants: renderTenants, rent: renderRent, expenses: renderExpenses, maintenance: renderMaintenance, landlords: renderLandlords, rooms: renderRooms, reports: renderReports, settings: renderSettings, users: renderUsers, import: renderImport };
    try {
      document.getElementById("content").innerHTML = pages[state.page]();
    } catch (e) {
      console.error("Render error on page " + state.page + ":", e);
      document.getElementById("content").innerHTML = '<div style="padding:40px;text-align:center;color:var(--red)"><div style="font-size:24px">\u26A0\uFE0F</div><div style="font-weight:700;margin:8px 0">Page error</div><div style="font-size:12px;color:var(--muted)">' + e.message + '</div><button onclick="render()" style="margin-top:16px;padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg);cursor:pointer;font-family:inherit">Retry</button></div>';
    }
  }
  function getMonthStats(monthKey) {
    var mo = MONTHS.find(function(m) {
      return m.key === monthKey;
    });
    if (!mo) return null;
    var pool = getFullPaymentPool();
    var pays = pool.filter(function(p) {
      var d = getDueDateObj(p);
      return d >= mo.from && d <= mo.to;
    });
    var income = pays.filter(function(p) {
      return p.status === "paid";
    }).reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var landlord = state.properties.reduce(function(s, p) {
      return s + p.landlord;
    }, 0);
    var opex = state.expenses.reduce(function(s, e) {
      return s + e.amount;
    }, 0);
    var occ = state.properties.reduce(function(s, p) {
      return s + p.occupied;
    }, 0);
    var rooms = state.properties.reduce(function(s, p) {
      return s + p.rooms;
    }, 0);
    var schedOutstanding = (state.rentSchedule || []).filter(function(s) {
      if (s.status === "paid") return false;
      if (!s.dueDateRaw) return false;
      var d = new Date(s.dueDateRaw);
      return d >= mo.from && d <= mo.to;
    }).length;
    var expectedIncome = Math.round(state.tenants.filter(function(t) {
      return t.status === "active";
    }).reduce(function(s, t) {
      return s + (t.freq === "monthly" ? t.rent : (t.rent || 0) * 52 / 12);
    }, 0));
    var expectedGross = expectedIncome - landlord;
    var expectedNet = expectedIncome - landlord - opex;
    return {
      income,
      landlord,
      opex,
      profit: income - landlord - opex,
      occ,
      rooms,
      outstanding: schedOutstanding,
      pays,
      label: mo.label,
      expectedIncome,
      expectedGross,
      expectedNet
    };
  }
  function showChartTip(e, text) {
    var tip = document.getElementById("chart-tip");
    if (!tip) return;
    var lines = text.split("|");
    tip.innerHTML = lines.map(function(l, i) {
      return i === 0 ? "<strong>" + l + "</strong>" : l;
    }).join("<br>");
    tip.style.display = "block";
    tip.style.left = Math.min(e.clientX + 10, window.innerWidth - 150) + "px";
    tip.style.top = e.clientY - 70 + "px";
  }
  function hideChartTip() {
    var tip = document.getElementById("chart-tip");
    if (tip) tip.style.display = "none";
  }
  function renderDashboard() {
    var selMonth = state.dashMonth || "2026-03";
    var ms = getMonthStats(selMonth) || getMonthStats("2026-03");
    var s = getStats();
    var trend = MONTHS.map(function(mo) {
      var pool = getFullPaymentPool();
      var pays = pool.filter(function(p) {
        var d = getDueDateObj(p);
        return d >= mo.from && d <= mo.to;
      });
      var inc = pays.filter(function(p) {
        return p.status === "paid";
      }).reduce(function(s2, p) {
        return s2 + p.amount;
      }, 0);
      var land = state.properties.reduce(function(s2, p) {
        return s2 + p.landlord;
      }, 0);
      var opex = state.expenses.reduce(function(s2, e) {
        return s2 + e.amount;
      }, 0);
      var costs = land + opex;
      return { m: mo.label.split(" ")[0], key: mo.key, i: inc, c: costs, p: inc - costs, label: mo.label };
    });
    var maxV = Math.max.apply(null, trend.map(function(t) {
      return Math.max(t.i, t.c);
    }));
    if (maxV === 0) maxV = 1;
    var lossProps = state.properties.filter(function(p) {
      return net(p) < 0;
    });
    var staffT = state.expenses.filter(function(e) {
      return e.type === "staff";
    }).reduce(function(a, e) {
      return a + e.amount;
    }, 0);
    var propT = state.expenses.filter(function(e) {
      return e.type === "property";
    }).reduce(function(a, e) {
      return a + e.amount;
    }, 0);
    var overT = state.expenses.filter(function(e) {
      return e.type === "overhead";
    }).reduce(function(a, e) {
      return a + e.amount;
    }, 0);
    var html = "";
    var dashCo = state.filters.dashCompany || "";
    html += '<div class="page-header"><div><div class="page-title">Dashboard</div><div class="page-sub">' + ms.label + "</div></div>";
    html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
    html += '<select onchange="state.filters.dashCompany=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">';
    html += '<option value="">&#x1F3E2; All Companies</option>';
    (state.companies || []).forEach(function(c) {
      html += '<option value="' + c.id + '" ' + (dashCo === c.id ? "selected" : "") + ">" + c.name + "</option>";
    });
    html += "</select>";
    html += '<select onchange="state.dashMonth=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;min-width:130px">';
    MONTHS.forEach(function(mo) {
      html += '<option value="' + mo.key + '" ' + (selMonth === mo.key ? "selected" : "") + ">" + mo.label + "</option>";
    });
    html += "</select>";
    html += "</div></div>";
    var _dashProps = dashCo ? state.properties.filter(function(p) {
      return p.companyId === dashCo;
    }) : state.properties;
    var _dashPropNames = _dashProps.map(function(p) {
      return p.name;
    });
    var collectedAmt = ms.pays.filter(function(p) {
      return p.status === "paid";
    }).reduce(function(a, p) {
      return a + p.amount;
    }, 0);
    html += '<div class="kpi-grid kpi-2" style="margin-bottom:10px">';
    html += kpi("Expected Income", fmt(ms.expectedIncome), ms.occ + "/" + ms.rooms + " rooms occupied", "#00B894", "&#x1F4B0;");
    html += kpi("Expected Net Profit", fmt(ms.expectedNet), "After all costs", ms.expectedNet >= 0 ? "#00B894" : "#E8375A", "&#x1F4C8;");
    html += "</div>";
    html += '<div class="kpi-grid kpi-4" style="margin-bottom:22px">';
    html += kpi("Collected", fmt(collectedAmt), ms.pays.filter(function(p) {
      return p.status === "paid";
    }).length + " payments", "#10B981", "&#x2705;");
    html += kpi("Landlord Costs", fmt(ms.landlord), pct(ms.landlord, ms.expectedIncome || 1) + "% of income", "#E8375A", "&#x1F3E6;");
    html += kpi("Operating Costs", fmt(ms.opex), "Staff + property + overhead", "#F59E0B", "&#x2699;&#xFE0F;");
    html += kpi("Active Tenants", state.tenants.filter(function(t) {
      return t.status === "active";
    }).length, state.tenants.filter(function(t) {
      return t.status === "notice_given";
    }).length + " on notice", "#3B82F6", "&#x1F465;");
    html += "</div>";
    html += '<div id="chart-tip" style="display:none;position:fixed;background:var(--text);color:#fff;padding:8px 12px;border-radius:9px;font-size:12px;font-weight:600;z-index:999;pointer-events:none;line-height:1.6;min-width:130px"></div>';
    html += '<div class="grid-6-4"><div class="card">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div class="card-title" style="margin:0">&#x1F4CA; 6-Month Cash Flow</div></div>';
    html += '<div style="font-size:11px;color:var(--muted);margin-bottom:14px">Tap a bar to drill into that month</div>';
    html += '<div class="chart-bars">';
    trend.forEach(function(t, i) {
      var isSel = t.key === selMonth;
      var ih = pct(t.i, maxV), ch = pct(t.c, maxV), ph = Math.abs(pct(t.p, maxV));
      var profitColor = t.p >= 0 ? "#10B981" : "#E8375A";
      var tip = t.label + "|&#x1F4B0; Income: " + fmt(Math.round(t.i)) + "|&#x1F4B8; Costs: " + fmt(Math.round(t.c)) + "|" + (t.p >= 0 ? "&#x2705;" : "&#x274C;") + " Profit: " + fmt(Math.round(Math.abs(t.p)));
      html += `<div class="chart-month" onclick="state.dashMonth='` + t.key + `';render()" style="cursor:pointer;opacity:` + (isSel ? 1 : 0.75) + `" onmouseover="showChartTip(event,'` + tip + `')" onmouseout="hideChartTip()">`;
      html += '<div class="chart-pair" style="align-items:flex-end;gap:2px">';
      html += '<div class="chart-bar" style="height:' + ih + "%;background:" + (isSel ? "var(--accent)" : "#BBF7D0") + ';border-radius:4px 4px 0 0"></div>';
      html += '<div class="chart-bar" style="height:' + ch + "%;background:" + (isSel ? "var(--red)" : "#FECDD3") + ';border-radius:4px 4px 0 0"></div>';
      html += '<div class="chart-bar" style="height:' + ph + "%;background:" + (isSel ? profitColor : t.p >= 0 ? "#ECFDF5" : "#FEF0F3") + ";border:1px solid " + profitColor + ';border-radius:4px 4px 0 0"></div>';
      html += '</div><div class="chart-lbl" style="font-weight:' + (isSel ? 700 : 400) + '">' + t.m + "</div></div>";
    });
    html += "</div>";
    html += '<div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">';
    html += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)"><div style="width:10px;height:10px;border-radius:3px;background:var(--accent)"></div>Income</div>';
    html += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)"><div style="width:10px;height:10px;border-radius:3px;background:var(--red)"></div>Costs</div>';
    html += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)"><div style="width:10px;height:10px;border-radius:3px;background:#10B981"></div>Profit</div>';
    html += '<span style="margin-left:auto;font-size:11px;color:var(--muted)">Tap bar to select month</span>';
    html += "</div></div>";
    html += '<div class="card"><div class="card-title">&#x1F4BC; P&amp;L &mdash; ' + ms.label + "</div>";
    html += '<div class="pl-row"><span class="pl-label">Total Income</span><span class="pl-val" style="color:var(--green)">' + fmt(ms.income) + "</span></div>";
    html += '<div class="pl-row"><span class="pl-label">Landlord Rent</span><span class="pl-val" style="color:var(--red)">&mdash; ' + fmt(ms.landlord) + "</span></div>";
    html += '<div class="pl-row"><span class="pl-label">Staff &amp; Labour</span><span class="pl-val" style="color:var(--amber)">&mdash; ' + fmt(staffT) + "</span></div>";
    html += '<div class="pl-row"><span class="pl-label">Property Costs</span><span class="pl-val" style="color:var(--amber)">&mdash; ' + fmt(propT) + "</span></div>";
    html += '<div class="pl-row"><span class="pl-label">Overhead</span><span class="pl-val" style="color:var(--muted)">&mdash; ' + fmt(overT) + "</span></div>";
    html += '<div class="pl-row"><span style="font-size:14px;font-weight:700">Net Profit</span><span style="font-size:16px;font-weight:700;font-family:monospace;color:' + (ms.profit >= 0 ? "var(--green)" : "var(--red)") + '">' + fmt(ms.profit) + "</span></div>";
    html += "</div></div>";
    html += '<div class="grid-2">';
    html += '<div class="card" style="' + (lossProps.length > 0 ? "border-color:#FECDD3" : "") + '"><div class="card-title" style="color:' + (lossProps.length > 0 ? "var(--red)" : "var(--text)") + '">&#x26A0;&#xFE0F; Loss-Making (' + lossProps.length + ")</div>";
    if (!lossProps.length) {
      html += '<div style="font-size:13px;color:var(--green)">&#x2713; All properties profitable</div>';
    } else {
      lossProps.slice(0, 6).forEach(function(p) {
        html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:12px;font-weight:600">' + p.name + '</div><div style="font-size:11px;color:var(--muted)">' + p.occupied + "/" + p.rooms + ' rooms</div></div><span class="mono" style="font-size:12px;font-weight:700;color:var(--red)">' + fmt(net(p)) + "</span></div>";
      });
      if (lossProps.length > 6) html += '<div style="font-size:11px;color:var(--muted);padding-top:6px">+' + (lossProps.length - 6) + " more</div>";
    }
    html += "</div>";
    html += '<div class="card"><div class="card-title" style="color:var(--amber)">&#x1F527; Open Maintenance</div>';
    if (!s.openM.length) {
      html += '<div style="font-size:13px;color:var(--green)">&#x2713; No open issues</div>';
    } else {
      s.openM.slice(0, 5).forEach(function(m) {
        html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:12px;font-weight:600">' + m.issue + '</div><div style="font-size:11px;color:var(--muted)">' + m.property + " &middot; Rm " + m.room + "</div></div>" + badge(m.priority) + "</div>";
      });
    }
    html += "</div></div>";
    html += '<div class="card" style="margin-top:18px;padding:0;overflow:hidden">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#0F0F1A 0%,#1a1a3e 100%)">';
    html += '<div style="display:flex;align-items:center;gap:10px">';
    html += '<div style="font-size:22px">\u{1F916}</div>';
    html += '<div><div style="font-size:14px;font-weight:800;color:#fff">AI Portfolio Agent</div>';
    html += '<div style="font-size:11px;color:rgba(255,255,255,.5)">Daily insights \xB7 Tasks \xB7 Health score</div></div>';
    html += "</div>";
    html += "</div>";
    html += '<div id="ai-agent-output"></div>';
    html += "</div>";
    html += '<div class="card" style="margin-top:14px">' + renderVoidTracker() + "</div>";
    html += '<div class="card" style="margin-top:14px">' + renderComplianceWidget() + "</div>";
    html += '<div class="card" style="margin-top:14px">' + renderDepositSummary() + "</div>";
    return html;
  }
  function renderProperties() {
    if ((state.filters.propView || "list") === "deal") return renderPropertiesDealView();
    const f = state.filters.props || "all";
    const q = (state.filters.propQ || "").toLowerCase();
    const pco = state.filters.propCompany || "";
    const data = state.properties.filter((p) => {
      if (pco && p.companyId !== pco) return false;
      const ok = p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q);
      if (f === "archived") return ok && p.status === "archived";
      if (p.status === "archived") return false;
      if (f === "profitable") return ok && net(p) > 0;
      if (f === "loss") return ok && net(p) < 0;
      if (f === "vacant") return ok && p.occupied < p.rooms;
      if (f === "owned") return ok && p.ownershipType === "owned";
      if (f === "managed") return ok && p.ownershipType !== "owned";
      return ok;
    });
    const coOpts = '<option value="">&#x1F3E2; All Companies</option>' + (state.companies || []).map((c) => '<option value="' + c.id + '" ' + (pco === c.id ? "selected" : "") + ">" + c.name + "</option>").join("");
    return `
    <div class="page-header">
      <div><div class="page-title">Properties</div><div class="page-sub">${data.length} of ${state.properties.length} properties</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="openDataModal('properties')" style="padding:8px 10px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit" title="Import / Export Properties">\u21C5</button>
        <button onclick="propViewDeal()" style="padding:9px 14px;border-radius:10px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Deal Analyzer</button>
        <select onchange="state.filters.propCompany=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">${coOpts}</select>
        ${btn("+ Add Property", "openModal('addProp')")}
      </div>
    </div>
    <div class="filters">
      <div class="search-wrap"><span class="search-ico">\u{1F50D}</span><input class="search-inp" placeholder="Search properties\u2026" value="${state.filters.propQ || ""}" oninput="state.filters.propQ=this.value;debouncedPropSearch()"></div>
      ${["all", "owned", "managed", "profitable", "loss", "vacant", "archived"].map((v) => `<button class="filter-btn ${f === v ? "active" : ""}" onclick="state.filters.props='${v}';render()">${v === "loss" ? "Loss-Making" : v === "vacant" ? "Has Vacancies" : v === "owned" ? "\u{1F3E0} Owned" : v === "managed" ? "\u{1F91D} Managed" : v === "archived" ? "\u{1F4E6} Archived" : v[0].toUpperCase() + v.slice(1)}</button>`).join("")}
    </div>
    <!-- Portfolio KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Total Portfolio</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-size:22px;font-weight:800;color:var(--text);font-family:monospace">${state.properties.length}</div>
            <div style="font-size:11px;color:var(--muted)">properties</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:800;color:var(--muted);font-family:monospace">${data.reduce((s, p) => s + p.rooms, 0)}</div>
            <div style="font-size:11px;color:var(--muted)">total rooms</div>
          </div>
        </div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Occupancy</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
          <div>
            <div style="font-size:22px;font-weight:800;font-family:monospace;color:${(() => {
      const occ = data.reduce((s, p) => s + p.occupied, 0);
      const tot = data.reduce((s, p) => s + p.rooms, 0);
      const pct2 = tot ? Math.round(occ / tot * 100) : 0;
      return pct2 >= 85 ? "var(--green)" : pct2 >= 70 ? "var(--amber)" : "var(--red)";
    })()} ">${(() => {
      const occ = data.reduce((s, p) => s + p.occupied, 0);
      const tot = data.reduce((s, p) => s + p.rooms, 0);
      return tot ? Math.round(occ / tot * 100) : 0;
    })()}%</div>
            <div style="font-size:11px;color:var(--muted)">${data.reduce((s, p) => s + p.occupied, 0)} occupied</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:800;color:var(--red);font-family:monospace">${state.properties.reduce((s, p) => s + (p.rooms - p.occupied), 0)}</div>
            <div style="font-size:11px;color:var(--muted)">vacant</div>
          </div>
        </div>
        <div style="background:var(--border);border-radius:3px;height:4px;overflow:hidden"><div style="height:100%;border-radius:3px;background:var(--green);width:${(() => {
      const occ = data.reduce((s, p) => s + p.occupied, 0);
      const tot = data.reduce((s, p) => s + p.rooms, 0);
      return tot ? Math.round(occ / tot * 100) : 0;
    })()}%"></div></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace">${fmt(data.reduce((s, p) => s + p.rent, 0))}</div>
        <div style="font-size:10px;font-weight:700;color:var(--green);margin-top:3px">MONTHLY INCOME</div>
      </div>
      <div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:800;color:var(--red);font-family:monospace">${fmt(data.reduce((s, p) => s + p.landlord, 0))}</div>
        <div style="font-size:10px;font-weight:700;color:var(--red);margin-top:3px">LANDLORD COSTS</div>
      </div>
      <div style="background:${data.reduce((s, p) => s + net(p), 0) >= 0 ? "var(--green-light)" : "var(--red-light)"};border:1px solid ${data.reduce((s, p) => s + net(p), 0) >= 0 ? "#A7F3D0" : "#FECDD3"};border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:800;color:${data.reduce((s, p) => s + net(p), 0) >= 0 ? "var(--green)" : "var(--red)"};font-family:monospace">${fmt(data.reduce((s, p) => s + net(p), 0))}</div>
        <div style="font-size:10px;font-weight:700;color:${data.reduce((s, p) => s + net(p), 0) >= 0 ? "var(--green)" : "var(--red)"};margin-top:3px">NET PROFIT/MO</div>
      </div>
    </div>

    <div class="prop-grid">
      ${data.map((p) => {
      const n = net(p);
      const o = pct(p.occupied, p.rooms);
      const oc = o === 100 ? "var(--green)" : o < 70 ? "var(--red)" : "var(--amber)";
      const vacantRooms = p.roomList ? p.roomList.filter((r) => r.status === "vacant").length : p.rooms - p.occupied;
      return `<div class="prop-card${n < 0 ? " loss" : ""}" onclick="openPropDetail('${p.id}')" style="cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;margin-bottom:2px">${p.name}</div>
              <div style="font-size:12px;color:var(--muted)">${p.address || p.area}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:10px;flex-wrap:wrap;justify-content:flex-end">
              ${p.ownershipType === "owned" ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0">\u{1F3E0} Owned</span>` : `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#FFFBEB;color:#92400E;border:1px solid #FDE68A">\u{1F91D} Managed</span>`}
              ${p.lettingType === "whole" ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE">\u{1F3E1} ${p.bedrooms || "?"}-bed</span>` : ""}
              ${badge(n < 0 ? "Loss" : "Active")}
            </div>
          </div>
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:11px;color:var(--muted);font-weight:500">Occupancy</span>
              <span style="font-size:11px;font-weight:600;color:${oc}">${p.lettingType === "whole" ? (p.occupied > 0 ? "Occupied" : "Vacant") + " \xB7 " + (p.bedrooms || "?") + " bed" : p.occupied + "/" + p.rooms + " rooms \xB7 " + o + "%" + (vacantRooms > 0 ? " \xB7 " + vacantRooms + " vacant" : "")}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${o}%;background:${oc}"></div></div>
          </div>
          <div class="prop-metrics">
            <div class="metric-box"><div class="metric-label">Income</div><div class="metric-val" style="color:var(--green)">${fmt(p.rent)}</div></div>
            <div class="metric-box"><div class="metric-label">Landlord</div><div class="metric-val" style="color:var(--red)">${fmt(p.landlord)}</div></div>
            <div class="metric-box"><div class="metric-label">Profit</div><div class="metric-val" style="color:${n >= 0 ? "var(--green)" : "var(--red)"}">${fmt(n)}</div></div>
          </div>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            ${p.mapsUrl ? `<a href="${p.mapsUrl}" target="_blank" onclick="event.stopPropagation()" style="font-size:11px;color:var(--blue);text-decoration:none;display:flex;align-items:center;gap:4px">\u{1F4CD} View on Maps</a>` : "<span></span>"}
            <span style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px">Tap to edit \u270F\uFE0F</span>
          </div>
        </div>`;
    }).join("")}
    </div>`;
  }
  function renderTenants() {
    const f = state.filters.tenants || "all";
    const q = (state.filters.tenantQ || "").toLowerCase();
    const propFilter = state.filters.tenantProp || "";
    const typeFilter = state.filters.tenantType || "";
    const data = state.tenants.filter((t) => {
      const ok = t.name.toLowerCase().includes(q) || t.property.toLowerCase().includes(q);
      if (propFilter && t.property !== propFilter) return false;
      if (typeFilter && (t.roomType || "Single") !== typeFilter) return false;
      if (f === "active") return ok && t.status === "active";
      if (f === "notice") return ok && t.status === "notice_given";
      if (f === "arrears") return ok && t.arrears > 0 && t.status !== "inactive";
      if (f === "archived") return ok && t.status === "inactive";
      return ok && t.status !== "inactive";
    });
    return `
    <div class="page-header">
      <div><div class="page-title">Tenants</div><div class="page-sub">${state.tenants.filter((t) => t.status === "active").length} active \xB7 ${state.tenants.filter((t) => t.arrears > 0).length} in arrears</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button onclick="openDataModal('tenants')" style="padding:8px 10px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit" title="Import / Export Tenants">\u21C5</button>
        ${btn("+ Add Tenant", "openModal('addTenant')")}
      </div>
    </div>
    <!-- Tenant KPIs -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Active Tenants</div>
            <div style="font-size:24px;font-weight:800;color:var(--green);font-family:monospace">${state.tenants.filter((t) => t.status === "active").length}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:800;color:var(--muted);font-family:monospace">${(() => {
      const r = state.properties.reduce((s, p) => s + p.rooms, 0);
      const a = state.tenants.filter((t) => t.status === "active").length;
      return r ? Math.round(a / r * 100) : 0;
    })()}%</div>
            <div style="font-size:10px;color:var(--muted)">occupancy</div>
          </div>
        </div>
        <div style="background:var(--border);border-radius:3px;height:4px;margin-top:8px;overflow:hidden">
          <div style="height:100%;border-radius:3px;background:${(() => {
      const r = state.properties.reduce((s, p) => s + p.rooms, 0);
      const a = state.tenants.filter((t) => t.status === "active").length;
      const pct2 = r ? Math.round(a / r * 100) : 0;
      return pct2 >= 90 ? "#10B981" : pct2 >= 70 ? "#F59E0B" : "#EF4444";
    })()};width:${(() => {
      const r = state.properties.reduce((s, p) => s + p.rooms, 0);
      const a = state.tenants.filter((t) => t.status === "active").length;
      return r ? Math.round(a / r * 100) : 0;
    })()}%"></div>
        </div>
      </div>
      ${(function() {
      var act = state.tenants.filter(function(t) {
        return t.status === "active" || t.status === "notice_given";
      });
      var wk = act.filter(function(t) {
        return t.freq === "weekly";
      }).reduce(function(s, t) {
        return s + t.rent;
      }, 0);
      var mo = act.filter(function(t) {
        return t.freq === "monthly";
      }).reduce(function(s, t) {
        return s + t.rent;
      }, 0);
      var total = Math.round(wk * 52 / 12 + mo);
      return '<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:12px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:4px" title="Calculated as: (weekly tenants \xD7 rent \xD7 52 \xF7 12) + (monthly tenants \xD7 rent). Full-portfolio figure, not filtered.">Monthly Rent Roll \u2139</div><div style="font-size:24px;font-weight:800;color:var(--green);font-family:monospace">\xA3' + total.toLocaleString() + '</div></div><div style="text-align:right"><div style="font-size:12px;color:var(--green);font-weight:600">' + act.length + ' tenants</div><div style="font-size:10px;color:var(--green)">wk \xD7 52\xF712 + monthly</div></div></div></div>';
    })()}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:${state.tenants.filter((t) => t.arrears > 0 && t.status !== "inactive").length ? "10px" : "14px"}">
      <div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--green)">${state.tenants.filter((t) => t.status === "active").length}</div>
        <div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;margin-top:2px">Active</div>
      </div>
      <div style="background:${state.tenants.filter((t) => t.status === "notice_given").length ? "var(--amber-light)" : "var(--bg)"};border:1px solid ${state.tenants.filter((t) => t.status === "notice_given").length ? "#FDE68A" : "var(--border)"};border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:${state.tenants.filter((t) => t.status === "notice_given").length ? "var(--amber)" : "var(--dim)"}">${state.tenants.filter((t) => t.status === "notice_given").length}</div>
        <div style="font-size:10px;font-weight:700;color:${state.tenants.filter((t) => t.status === "notice_given").length ? "var(--amber)" : "var(--dim)"};text-transform:uppercase;margin-top:2px">On Notice</div>
      </div>
      <div style="background:${state.tenants.filter((t) => t.arrears > 0 && t.status !== "inactive").length ? "var(--red-light)" : "var(--bg)"};border:1px solid ${state.tenants.filter((t) => t.arrears > 0 && t.status !== "inactive").length ? "#FECDD3" : "var(--border)"};border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:${state.tenants.filter((t) => t.arrears > 0 && t.status !== "inactive").length ? "var(--red)" : "var(--dim)"}">${state.tenants.filter((t) => t.arrears > 0 && t.status !== "inactive").length}</div>
        <div style="font-size:10px;font-weight:700;color:${state.tenants.filter((t) => t.arrears > 0 && t.status !== "inactive").length ? "var(--red)" : "var(--dim)"};text-transform:uppercase;margin-top:2px">In Arrears</div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--muted)">${state.tenants.filter((t) => t.status === "inactive").length}</div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-top:2px">Archived</div>
      </div>
    </div>

    <!-- Row 2 KPIs: rent roll, avg rate, longest overdue -->
    ${(function() {
      var TYPES = [
        { key: "Single", icon: "\u{1F6CF}\uFE0F", color: "var(--blue)", bg: "var(--blue-light)" },
        { key: "Double", icon: "\u{1F6CF}\uFE0F\u{1F6CF}\uFE0F", color: "#7C3AED", bg: "#F5F3FF" },
        { key: "Suite", icon: "\u2728", color: "var(--amber)", bg: "var(--amber-light)" },
        { key: "Studio", icon: "\u{1F3E0}", color: "#0891B2", bg: "#ECFEFF" },
        { key: "Whole House", icon: "\u{1F3E1}", color: "var(--green)", bg: "var(--green-light)" }
      ];
      var typeStats = {};
      TYPES.forEach(function(t) {
        typeStats[t.key] = { occ: 0, total: 0 };
      });
      state.properties.forEach(function(p) {
        (p.roomList || []).forEach(function(r) {
          var key = r.type || "Single";
          if (!typeStats[key]) typeStats[key] = { occ: 0, total: 0 };
          typeStats[key].total++;
          if (r.status === "occupied") typeStats[key].occ++;
        });
      });
      var active = TYPES;
      var curTypeFilter = state.filters.tenantType || "";
      var html = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">';
      active.forEach(function(t) {
        var s = typeStats[t.key];
        var pct2 = s.total ? Math.round(s.occ / s.total * 100) : 0;
        var vacant = s.total - s.occ;
        var isActive = curTypeFilter === t.key;
        html += `<div onclick="state.filters.tenantType=(state.filters.tenantType==='` + t.key + "' ? '':'" + t.key + `'');render()" style="background:` + (isActive ? t.bg.replace("light", "").trim() || t.bg : t.bg) + ";border:" + (isActive ? "2px solid " + t.color : "1px solid var(--border)") + ';border-radius:11px;padding:10px 8px;text-align:center;cursor:pointer;transition:all .15s">';
        html += '<div style="font-size:16px;margin-bottom:2px">' + t.icon + "</div>";
        html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:3px;white-space:nowrap">' + t.key + "</div>";
        html += '<div style="font-size:18px;font-weight:800;color:' + t.color + ';font-family:monospace;line-height:1">' + s.occ + "/" + s.total + "</div>";
        html += '<div style="background:var(--border);border-radius:3px;height:3px;margin:5px 0 3px">';
        html += '<div style="background:' + t.color + ";border-radius:3px;height:100%;width:" + pct2 + '%"></div></div>';
        html += '<div style="font-size:10px;color:var(--muted)">' + pct2 + "% \xB7 " + vacant + " free</div>";
        html += "</div>";
      });
      html += "</div>";
      return html;
    })()}

    <div class="filters">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <div class="search-wrap" style="flex:1;min-width:160px"><span class="search-ico">\u{1F50D}</span><input class="search-inp" placeholder="Search tenants\u2026" value="${state.filters.tenantQ || ""}" oninput="state.filters.tenantQ=this.value;debouncedTenantSearch()"></div>
      <select style="padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;min-width:160px" onchange="state.filters.tenantProp=this.value;render()">
        <option value="">All Properties</option>
        ${state.properties.map((p) => `<option value="${p.name}" ${(state.filters.tenantProp || "") === p.name ? "selected" : ""}>${p.name}</option>`).join("")}
      </select>
    </div>
      ${[{ v: "all", l: "All" }, { v: "active", l: "Active" }, { v: "notice", l: "On Notice" }, { v: "arrears", l: "In Arrears" }, { v: "archived", l: "Archived" }].map((x) => `<button class="filter-btn ${f === x.v ? "active" : ""}" onclick="state.filters.tenants='${x.v}';render()">${x.l}</button>`).join("")}
    </div>
    <div class="tenant-grid">
      ${data.map((t) => {
      const rentMsg = encodeURIComponent(`Hi ${t.name.split(" ")[0]}, this is a reminder that your rent of \xA3${t.rent}/${t.freq} is due. Please arrange payment at your earliest convenience. Thank you.`);
      const arrMsg = t.arrears > 0 ? encodeURIComponent(`Hi ${t.name.split(" ")[0]}, you have outstanding rent arrears of \xA3${t.arrears}. Please contact us urgently to arrange payment. Thank you.`) : "";
      return `<div class="tenant-card${t.arrears > 0 ? " arrears" : ""}" onclick="openTenantDetail('${t.id}')" style="cursor:pointer">
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
            <div class="t-avatar">${t.name[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:700;margin-bottom:3px">${t.name}</div>
              <div style="font-size:12px;color:var(--muted)">${t.property}</div>
              <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px">
                ${(function() {
        var p = state.properties.find(function(x) {
          return x.name === t.property;
        });
        var r = p && p.roomList ? p.roomList.find(function(x) {
          return x.n === t.room;
        }) : null;
        var type = r ? r.type : "Single";
        var icons = { "Single": "\u{1F6CF}\uFE0F", "Double": "\u{1F6CF}\uFE0F\u{1F6CF}\uFE0F", "Suite": "\u2728", "Studio": "\u{1F3E0}", "Whole House": "\u{1F3E1}" };
        return "<span>" + (icons[type] || "\u{1F6CF}\uFE0F") + "</span><span>Room " + t.room + " \xB7 " + (type || "Single") + "</span>";
      })()}
              </div>
            </div>
            ${badge(t.status === "notice_given" ? "notice_given" : t.status)}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
            <div class="metric-box"><div class="metric-label">Rent</div><div class="metric-val" style="color:var(--green)">${fmt(t.rent)}<span style="font-size:10px;color:var(--muted);font-weight:400;font-family:Inter,sans-serif">/${t.freq === "weekly" ? "wk" : "mo"}</span></div></div>
            <div class="metric-box"><div class="metric-label">Last Paid</div><div style="font-size:12px;font-weight:600;color:var(--text);margin-top:3px">${t.paid || "\u2014"}</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px" onclick="event.stopPropagation()">
            <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;flex-shrink:0">Due</span>
            ${(function() {
        if (t.freq === "monthly") {
          var opts = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th", "13th", "14th", "15th", "16th", "17th", "18th", "19th", "20th", "21st", "22nd", "23rd", "24th", "25th", "26th", "27th", "28th"];
          return '<select onclick="event.stopPropagation()" onchange="quickSetDueDay(' + JSON.stringify(t.id) + `,this.value,'monthly')" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;flex:1">` + opts.map(function(o, i) {
            return '<option value="' + (i + 1) + '" ' + (t.payDayOfMonth === i + 1 ? "selected" : "") + ">" + o + " of month</option>";
          }).join("") + "</select>";
        } else {
          var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          return '<select onclick="event.stopPropagation()" onchange="quickSetDueDay(' + JSON.stringify(t.id) + `,this.value,'weekly')" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;flex:1">` + days.map(function(d) {
            return '<option value="' + d + '" ' + (t.payDay === d ? "selected" : "") + ">" + d + "</option>";
          }).join("") + "</select>";
        }
      })()}
          </div>

          ${t.arrears > 0 ? `<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:8px;padding:8px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;font-weight:600;color:var(--red)">Arrears</span>
            <span class="mono" style="font-size:13px;font-weight:700;color:var(--red)">${fmt(t.arrears)}</span>
          </div>` : ""}

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px" onclick="event.stopPropagation()">
            ${badge(t.method === "bank" ? "bank" : "cash")}
            ${t.whatsapp ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${t.arrears > 0 ? `<a href="https://wa.me/${t.whatsapp.replace(/\D/g, "")}?text=${arrMsg}" target="_blank" class="wa-btn" style="background:#FEF0F3;color:var(--red);border-color:#FECDD3">\u{1F4AC} Chase</a>` : `<a href="https://wa.me/${t.whatsapp.replace(/\D/g, "")}?text=${rentMsg}" target="_blank" class="wa-btn">\u{1F4AC} Message</a>`}
                </div>` : '<span style="font-size:11px;color:var(--dim)">No WhatsApp</span>'}
          </div>
        </div>`;
    }).join("")}
    </div>`;
  }
  function getDueDateObj(p) {
    if (p._dueDateRaw) return new Date(p._dueDateRaw);
    return TODAY;
  }
  function getDueDate(p) {
    return getDueDateObj(p);
  }
  function getDueStatus(p) {
    if (p.status === "paid") return "paid";
    var due = getDueDateObj(p);
    var dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    var todDay = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
    var diff = Math.round((dueDay - todDay) / 864e5);
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    return "upcoming";
  }
  function getRentTab(p) {
    const today = TODAY;
    const due = new Date(getDueDate(p));
    const diff = Math.round((due - today) / 864e5);
    if (p.status === "paid") return "paid";
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    return "upcoming";
  }
  function getPeriodDates(period) {
    var now = /* @__PURE__ */ new Date();
    var y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    var dow = now.getDay();
    var diff = dow === 0 ? -6 : 1 - dow;
    var monThis = new Date(y, m, d + diff);
    var sunThis = new Date(y, m, d + diff + 6);
    var monPrev = new Date(monThis);
    monPrev.setDate(monPrev.getDate() - 7);
    var sunPrev = new Date(sunThis);
    sunPrev.setDate(sunPrev.getDate() - 7);
    var monthStart = new Date(y, m, 1);
    var monthEnd = new Date(y, m + 1, 0);
    var pm = m === 0 ? 11 : m - 1;
    var py = m === 0 ? y - 1 : y;
    var prevMonthStart = new Date(py, pm, 1);
    var prevMonthEnd = new Date(py, pm + 1, 0);
    var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var fmt2 = function(d2) {
      return d2.getDate() + " " + MONTHS_SHORT[d2.getMonth()];
    };
    if (period === "week") return { from: monThis, to: sunThis, label: "This Week (" + fmt2(monThis) + "\u2013" + fmt2(sunThis) + " " + y + ")" };
    if (period === "prev-week") return { from: monPrev, to: sunPrev, label: "Last Week (" + fmt2(monPrev) + "\u2013" + fmt2(sunPrev) + ")" };
    if (period === "month") return { from: monthStart, to: monthEnd, label: MONTHS_SHORT[m] + " " + y };
    if (period === "prev-month") return { from: prevMonthStart, to: prevMonthEnd, label: MONTHS_SHORT[pm] + " " + py };
    if (period === "ytd") return { from: new Date(y, 0, 1), to: now, label: "Year to Date " + y };
    return { from: monThis, to: sunThis, label: "This Week" };
  }
  function getFullPaymentPool() {
    var pool = state.payments.slice();
    var seen = new Set(pool.map(function(p) {
      var t = p.tenant || p.tenantName || "";
      var d = p._dueDateRaw || (p.dueDate ? new Date(p.dueDate).getTime() : null) || 0;
      return t + "|" + d + "|" + (p.amount || 0);
    }));
    state.tenants.forEach(function(t) {
      if (!t.paymentHistory) return;
      t.paymentHistory.forEach(function(h) {
        if (h.type !== "history") return;
        var parts = h.date.split(" ");
        var months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
        var d = new Date(+parts[2], months[parts[1]], +parts[0]);
        var raw = d.getTime();
        var key = t.name + "|" + raw + "|" + h.amount;
        if (!seen.has(key)) {
          seen.add(key);
          pool.push({ id: "h_" + t.id + "_" + raw, tenant: t.name, property: t.property, room: t.room, amount: h.amount, method: h.method, status: h.status, _dueDateRaw: raw, _fromHistory: true });
        }
      });
    });
    return pool;
  }
  function renderRentRow(p) {
    if (!p || !p.tenant) return "";
    var tenant = state.tenants.find(function(t2) {
      return t2.name === p.tenant;
    });
    if (p._isArrears) {
      var t = tenant;
      var h = '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);background:#FFF8F8">';
      h += '<div style="width:32px;height:32px;border-radius:9px;background:var(--red-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--red);flex-shrink:0">' + (t ? t.name[0] : "?") + "</div>";
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:13px;font-weight:700">' + p.tenant + "</div>";
      h += '<div style="font-size:11px;color:var(--muted)">' + p.property + " \xB7 Rm " + p.room + ' \xB7 <span style="color:var(--red);font-weight:600">\u26A0\uFE0F Standing Arrears</span></div>';
      h += "</div>";
      h += '<div style="font-size:15px;font-weight:800;color:var(--red);font-family:monospace;flex-shrink:0">' + fmt(p.amount) + "</div>";
      h += '<div style="display:flex;gap:6px;flex-shrink:0">';
      h += `<button onclick="markPaid('` + String(p.id) + `','bank')" style="padding:7px 12px;border-radius:8px;border:none;background:var(--green);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">\u2713 Clear</button>`;
      h += `<button onclick="markPartialPaid('` + String(p.id) + "'," + p.amount + ')" style="padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Partial</button>';
      h += "</div></div>";
      return h;
    }
    var dueStatus = getDueStatus(p);
    var dueDate = getDueDateObj(p);
    var dueDateStr = dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    var room = tenant ? tenant.room : p.room || "?";
    var isCash = p.method === "cash";
    var isPaid = p.status === "paid";
    var sc = {
      paid: { bg: "var(--green-light)", border: "#A7F3D0", text: "var(--green)" },
      overdue: { bg: "var(--red-light)", border: "#FECDD3", text: "var(--red)" },
      today: { bg: "var(--amber-light)", border: "#FDE68A", text: "var(--amber)" },
      tomorrow: { bg: "var(--blue-light)", border: "#BFDBFE", text: "var(--blue)" },
      upcoming: { bg: "#F8F9FB", border: "var(--border)", text: "var(--muted)" }
    }[dueStatus] || { bg: "#F8F9FB", border: "var(--border)", text: "var(--muted)" };
    var lateFee = calcLateFee(p);
    var dueLabel = dueStatus === "overdue" ? "&#x26A0;&#xFE0F; Overdue &middot; " + dueDateStr + (lateFee > 0 ? " + &pound;" + lateFee + " fee" : "") : dueStatus === "today" ? "&#x1F4C5; Due Today" : dueStatus === "tomorrow" ? "&#x1F4C5; Tomorrow" : dueStatus === "paid" ? "&#x2713; Paid" : "&#x1F4C5; Due " + dueDateStr;
    var waBase = tenant && tenant.whatsapp ? "https://wa.me/" + tenant.whatsapp.replace(/\D/g, "") + "?text=" : "";
    var waMsg = encodeURIComponent(
      "Hi " + (p.tenant || "Tenant").split(" ")[0] + ", your rent of \xA3" + (p.amount || 0) + " is " + (dueStatus === "overdue" ? "overdue. Please pay urgently" : "due " + dueDateStr + ". Please arrange payment.") + " Thank you \u2014 Reservations Direct."
    );
    var h = '<div style="border-bottom:1px solid var(--border);padding:12px 14px;background:' + (dueStatus === "overdue" ? "#FFF8F8" : dueStatus === "today" ? "#FFFBF0" : "var(--surface)") + ';">';
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
    h += '<div style="width:36px;height:36px;border-radius:10px;flex-shrink:0;background:' + sc.bg + ";border:1px solid " + sc.border + ";display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:" + sc.text + '">' + p.tenant[0] + "</div>";
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-weight:700;font-size:14px">' + p.tenant + "</div>";
    h += '<div style="font-size:11px;color:var(--muted)">' + p.property + " &middot; Rm " + room + "</div>";
    h += "</div>";
    h += '<div style="text-align:right;flex-shrink:0">';
    h += '<div style="font-size:16px;font-weight:700;font-family:monospace">&pound;' + p.amount + "</div>";
    h += '<div style="font-size:10px;font-weight:600;color:' + sc.text + '">' + dueLabel + "</div>";
    h += "</div></div>";
    h += '<div style="margin-bottom:8px;display:flex;align-items:center;gap:7px;flex-wrap:wrap">';
    h += `<button onclick="togglePaymentMethod('` + String(p.id) + `')" style="padding:4px 10px;border-radius:20px;border:1px solid ` + (isCash ? "#FDE68A" : "#BFDBFE") + ";background:" + (isCash ? "#FFFBEB" : "#EFF6FF") + ";color:" + (isCash ? "var(--amber)" : "var(--blue)") + ';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">' + (isCash ? "&#x1F4B5; Cash" : "&#x1F3E6; Bank") + "</button>";
    if (isCash && !isPaid)
      h += '<span style="font-size:10px;font-weight:700;color:var(--amber);background:#FFFBEB;border:1px solid #FDE68A;padding:2px 8px;border-radius:10px">&#x1F4CB; Cash Collection</span>';
    h += "</div>";
    h += '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">';
    if (!isPaid) {
      if (isCash) {
        h += `<button onclick="markPaid('` + String(p.id) + `','cash')" style="flex:1;padding:9px;border-radius:9px;border:none;background:var(--amber);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F4B5; Mark Cash Collected</button>`;
        h += `<button onclick="markPartialPaid('` + String(p.id) + "'," + p.amount + ')" style="padding:9px 10px;border-radius:9px;border:1px solid var(--amber);background:#fff;color:#92400E;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Partial</button>';
      } else {
        h += `<button onclick="markPaid('` + String(p.id) + `','bank')" style="flex:1;padding:9px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F3E6; Bank Confirmed</button>`;
        h += `<button onclick="markPartialPaid('` + String(p.id) + "'," + p.amount + ')" style="padding:9px 10px;border-radius:9px;border:1px solid var(--amber);background:var(--amber-light);color:#92400E;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Partial</button>';
        h += `<button onclick="markPaid('` + String(p.id) + `','cash')" style="padding:9px 10px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Cash</button>`;
      }
      if (waBase)
        h += '<a href="' + waBase + waMsg + '" target="_blank" style="padding:9px 10px;border-radius:9px;border:1px solid #BBF7D0;background:var(--wa-light);color:var(--wa);font-size:13px;font-weight:700;text-decoration:none">' + (dueStatus === "overdue" ? "&#x1F4AC; Chase" : "&#x1F4AC;") + "</a>";
    } else {
      h += '<span style="font-size:12px;color:var(--green);font-weight:700">&#x2713; Collected &mdash; ' + (p.paidMethod === "cash" ? "Cash" : "Bank") + "</span>";
      h += '<button data-pid="' + String(p.id) + '" onclick="openEditPaymentModal(this.dataset.pid)" style="margin-left:auto;padding:5px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">Fix</button>';
    }
    h += "</div></div>";
    return h;
  }
  function calcLateFee(p) {
    var cfg = state.lateFeeConfig;
    if (!cfg || !cfg.enabled) return 0;
    var due = getDueDateObj(p);
    var daysLate = Math.floor((TODAY - due) / 864e5);
    if (daysLate <= cfg.graceDays) return 0;
    return cfg.feeType === "fixed" ? cfg.feeAmount : Math.round(p.amount * cfg.feeAmount / 100);
  }
  function togglePaymentMethod(payId) {
    var idStr = String(payId);
    var found = false;
    state.payments = state.payments.map(function(p) {
      if (String(p.id) === idStr) {
        found = true;
        var nm = p.method === "cash" ? "bank" : "cash";
        var t2 = state.tenants.find(function(x) {
          return x.name === p.tenant;
        });
        if (t2) t2.method = nm;
        return Object.assign({}, p, { method: nm });
      }
      return p;
    });
    if (!found) {
      var s = state.rentSchedule.find(function(x) {
        return String(x.id) === idStr;
      });
      if (s) {
        s.method = s.method === "cash" ? "bank" : "cash";
        var t = state.tenants.find(function(x) {
          return x.id === s.tenantId;
        });
        if (t) t.method = s.method;
      }
    }
    render();
  }
  function openLateFeeSettings() {
    var cfg = state.lateFeeConfig;
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px"><div class="modal-header"><span class="modal-title">&#x23F0; Late Fee Settings</span><button class="modal-close" onclick="closeModal()">&#xD7;</button></div><div class="modal-body"><div class="field"><label class="field-label">Grace Period (days)</label><input class="inp" id="lf-grace" type="number" value="' + cfg.graceDays + '"></div><div class="field"><label class="field-label">Fee Type</label><select class="inp" id="lf-type"><option value="fixed" ' + (cfg.feeType === "fixed" ? "selected" : "") + '>Fixed (&pound;)</option><option value="percent" ' + (cfg.feeType === "percent" ? "selected" : "") + '>% of rent</option></select></div><div class="field"><label class="field-label">Amount</label><input class="inp" id="lf-amount" type="number" value="' + cfg.feeAmount + '"></div><div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="lf-enabled" ' + (cfg.enabled ? "checked" : "") + ' style="width:16px;height:16px"> Enable late fees</label></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button onclick="saveLateFeeSettings()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save</button></div></div></div></div>';
  }
  function saveLateFeeSettings() {
    state.lateFeeConfig.graceDays = +document.getElementById("lf-grace").value || 3;
    state.lateFeeConfig.feeType = document.getElementById("lf-type").value;
    state.lateFeeConfig.feeAmount = +document.getElementById("lf-amount").value || 25;
    state.lateFeeConfig.enabled = document.getElementById("lf-enabled").checked;
    closeModal();
    render();
  }
  function bulkChaseOverdue(mode) {
    mode = mode || "overdue";
    var pool = window._renderedOverdue || [];
    var source;
    if (mode === "all") source = pool.filter(function(p) {
      return !p._isArrears;
    });
    else if (mode === "today") source = pool.filter(function(p) {
      var s = getDueStatus(p);
      return s === "today" || s === "overdue";
    });
    else source = pool.filter(function(p) {
      return getDueStatus(p) === "overdue";
    });
    if (!source.length) {
      showToast("No payments to chase in this view", "success");
      return;
    }
    var byT = {};
    source.forEach(function(p) {
      var tn = p.tenant || p.tenantName || "";
      if (!byT[tn]) byT[tn] = { total: 0, pays: [], t: state.tenants.find(function(x) {
        return x.name === tn;
      }) };
      byT[tn].total += p.amount;
      byT[tn].pays.push(p);
    });
    var items = Object.keys(byT).map(function(n) {
      return byT[n];
    }).filter(function(x) {
      return x.t && x.t.whatsapp;
    });
    var noWA = Object.keys(byT).map(function(n) {
      return byT[n];
    }).filter(function(x) {
      return !x.t || !x.t.whatsapp;
    });
    function buildMsg(item) {
      var fn = item.t.name.split(" ")[0];
      var amt = "\xA3" + item.total;
      if (mode === "overdue") return "Hi " + fn + ", your rent of " + amt + " is overdue. Please pay as soon as possible. Thank you \u2014 Reservations Direct.";
      if (mode === "today") return "Hi " + fn + ", your rent of " + amt + " is due today. Please ensure payment is made. Thank you \u2014 Reservations Direct.";
      return "Hi " + fn + ", a rent payment of " + amt + " is outstanding. Please arrange payment at your earliest convenience. Thank you \u2014 Reservations Direct.";
    }
    var allLinks = items.map(function(item) {
      return "https://wa.me/" + item.t.whatsapp + "?text=" + encodeURIComponent(buildMsg(item));
    });
    window._bulkSendAll = function() {
      allLinks.forEach(function(u) {
        window.open(u, "_blank");
      });
    };
    var html = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:520px"><div class="modal-header"><span class="modal-title">&#x1F4AC; Bulk Reminder</span><button class="modal-close" onclick="closeModal()">&#xD7;</button></div><div class="modal-body" style="padding:0"><div style="display:flex;border-bottom:1px solid var(--border)"><button onclick="closeModal();bulkChaseOverdue('overdue')" style="flex:1;padding:10px;border:none;border-bottom:3px solid ` + (mode === "overdue" ? "var(--red)" : "transparent") + ";background:transparent;font-size:12px;font-weight:700;color:" + (mode === "overdue" ? "var(--red)" : "var(--muted)") + `;cursor:pointer;font-family:inherit">&#x26A0;&#xFE0F; Overdue only</button><button onclick="closeModal();bulkChaseOverdue('today')" style="flex:1;padding:10px;border:none;border-bottom:3px solid ` + (mode === "today" ? "var(--amber)" : "transparent") + ";background:transparent;font-size:12px;font-weight:700;color:" + (mode === "today" ? "var(--amber)" : "var(--muted)") + `;cursor:pointer;font-family:inherit">&#x1F4C5; Due today+overdue</button><button onclick="closeModal();bulkChaseOverdue('all')" style="flex:1;padding:10px;border:none;border-bottom:3px solid ` + (mode === "all" ? "var(--blue)" : "transparent") + ";background:transparent;font-size:12px;font-weight:700;color:" + (mode === "all" ? "var(--blue)" : "var(--muted)") + ';cursor:pointer;font-family:inherit">&#x1F4B7; All outstanding</button></div>';
    if (!items.length) {
      html += '<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">No tenants with WhatsApp numbers in this view.</div>';
    } else {
      html += '<div style="padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center"><div style="font-size:12px;color:var(--muted)">' + items.length + ' tenants with WhatsApp</div><button onclick="_bulkSendAll()" style="padding:7px 14px;border-radius:8px;border:none;background:#25D366;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F4AC; Send All (' + items.length + ')</button></div><div style="max-height:50vh;overflow-y:auto">';
      items.forEach(function(item) {
        var waHref = "https://wa.me/" + item.t.whatsapp + "?text=" + encodeURIComponent(buildMsg(item));
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--border)"><div><div style="font-size:13px;font-weight:700">' + item.t.name + '</div><div style="font-size:11px;color:var(--muted)">' + item.t.property + (item.t.room ? " \xB7 Rm " + item.t.room : "") + " \xB7 \xA3" + item.total + '</div></div><a href="' + waHref + '" target="_blank" style="padding:7px 14px;border-radius:8px;background:#25D366;color:#fff;font-size:12px;font-weight:700;text-decoration:none">&#x1F4AC; Send</a></div>';
      });
      html += "</div>";
    }
    if (noWA.length) html += '<div style="padding:10px 16px;background:#FFFBEB;border-top:1px solid var(--border);font-size:11px;color:var(--amber)">&#x26A0;&#xFE0F; ' + noWA.length + " tenant" + (noWA.length > 1 ? "s" : "") + " missing WhatsApp: " + noWA.map(function(x) {
      return x.t ? x.t.name : "?";
    }).join(", ") + "</div>";
    html += '</div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Close</button></div></div></div>';
    document.getElementById("modal-container").innerHTML = html;
  }
  function shareCashCollections(cashList) {
    if (!cashList.length) {
      alert("No cash collections to share.");
      return;
    }
    var NL = "\n";
    var today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    var total = cashList.reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var msg = "\u{1F4B5} *CASH COLLECTION LIST*" + NL;
    msg += "\u{1F4C5} " + today + NL;
    msg += "\u2501".repeat(18) + NL + NL;
    cashList.forEach(function(p, i) {
      var t = state.tenants.find(function(x) {
        return x.name === p.tenant;
      });
      var prop = state.properties.find(function(x) {
        return x.name === p.property;
      });
      var address = prop ? prop.address || p.property : p.property;
      var phone = t && t.whatsapp ? "+" + t.whatsapp : "\u2014";
      var dueStatus = getDueStatus(p);
      var statusIcon = dueStatus === "overdue" ? "\u26A0\uFE0F OVERDUE" : dueStatus === "today" ? "\u{1F534} TODAY" : "\u{1F4C5} DUE";
      msg += i + 1 + ". \u{1F464} *" + p.tenant + "*" + NL;
      msg += "   \u{1F3E0} " + address + ", Rm " + (t ? t.room : "?") + NL;
      msg += "   \u{1F4B0} *\xA3" + p.amount + "* " + statusIcon + NL;
      msg += "   \u{1F4DE} " + phone + NL;
      if (i < cashList.length - 1) msg += NL;
    });
    msg += NL + "\u2501".repeat(18) + NL;
    msg += "\u{1F4B0} *TOTAL: \xA3" + total + "* (" + cashList.length + " collection" + (cashList.length === 1 ? "" : "s") + ")" + NL;
    msg += "\u2705 Mark each as collected once received.";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  }
  function setRentPeriod(v) {
    state.filters.rentPeriod = v;
    render();
  }
  function setRentTab(v) {
    state.filters.rentTab = v;
    render();
  }
  function setRentTabBtn(el) {
    setRentTab(el.dataset.tab);
  }
  function setRentPeriodBtn(el) {
    state.filters.rentPeriod = el.dataset.period;
    render();
  }
  function setImportTab(el) {
    _importTab = el.dataset.tab;
    _importPreview = null;
    render();
  }
  function toggleUserStatusBtn(el) {
    toggleUserStatus(el.dataset.uid);
  }
  function switchUserBtn(el) {
    switchUser(el.dataset.uid);
  }
  function renderRent() {
    var period = state.filters.rentPeriod || "week";
    var rentTab = state.filters.rentTab || "today";
    var periodInfo = getPeriodDates(period);
    var from = periodInfo.from, to = periodInfo.to;
    var pool = getFullPaymentPool();
    var existing = period === "ytd" ? pool : pool.filter(function(p) {
      var d = getDueDateObj(p);
      return d >= from && d <= to;
    });
    var seenDates = new Set(existing.map(function(p) {
      return (p.tenant || p.tenantName || "") + "_" + getDueDateObj(p).toDateString();
    }));
    var _tenantPayTimes = {};
    state.payments.forEach(function(p) {
      var tn = p.tenant || p.tenantName || "";
      if (!tn) return;
      if (!_tenantPayTimes[tn]) _tenantPayTimes[tn] = [];
      if (p._dueDateRaw && !isNaN(p._dueDateRaw)) _tenantPayTimes[tn].push(p._dueDateRaw);
      else if (p._paidDateRaw && !isNaN(p._paidDateRaw)) _tenantPayTimes[tn].push(p._paidDateRaw);
    });
    var schedInPeriod = period === "ytd" ? state.rentSchedule : state.rentSchedule.filter(function(s) {
      var d = new Date(s.dueDateRaw);
      return d >= from && d <= to;
    });
    var schedOnly = schedInPeriod.filter(function(s) {
      if (s.status === "paid") return false;
      if (seenDates.has((s.tenantName || "") + "_" + new Date(s.dueDateRaw).toDateString())) return false;
      var times = _tenantPayTimes[s.tenantName || ""];
      if (times) {
        for (var _i = 0; _i < times.length; _i++) {
          if (Math.abs(times[_i] - s.dueDateRaw) <= 6 * 864e5) return false;
        }
      }
      return true;
    });
    var synth = schedOnly.map(function(s) {
      return { id: s.id, tenant: s.tenantName, property: s.property, amount: s.amount, method: s.method, status: "outstanding", _dueDateRaw: s.dueDateRaw, _fromSched: true };
    });
    var allPayments = existing.concat(synth);
    var paidInPeriod = state.payments.filter(function(p) {
      if (p.status !== "paid" && p.status !== "Paid") return false;
      if (period === "ytd") return true;
      var pd = p.paidDate || p.date;
      if (!pd) return false;
      var _months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      var _parts = String(pd).split(" ");
      var paidD;
      if (_parts.length === 3 && _months[_parts[1]] !== void 0) {
        paidD = new Date(+_parts[2], _months[_parts[1]], +_parts[0]);
      } else {
        var iso = String(pd).split("T")[0];
        paidD = iso ? new Date(iso) : null;
      }
      if (!paidD || isNaN(paidD)) return false;
      paidD.setHours(0, 0, 0, 0);
      var fromD = new Date(from);
      fromD.setHours(0, 0, 0, 0);
      var toD = new Date(to);
      toD.setHours(23, 59, 59, 999);
      return paidD >= fromD && paidD <= toD;
    });
    var paid = paidInPeriod.length > 0 ? paidInPeriod : allPayments.filter(function(p) {
      return p.status === "paid";
    });
    var paidForTab = paidInPeriod;
    var owed = allPayments.filter(function(p) {
      return p.status !== "paid";
    });
    var overdue = owed.filter(function(p) {
      return getDueStatus(p) === "overdue";
    });
    var arrearsEntries = state.tenants.filter(function(t) {
      return t.status !== "inactive" && (t.arrears || 0) > 0;
    }).filter(function(t) {
      return !overdue.some(function(o) {
        return o.tenant === t.name;
      });
    }).map(function(t) {
      return {
        id: "arrears_" + t.id,
        tenant: t.name,
        property: t.property,
        room: t.room,
        amount: t.arrears,
        method: t.method || "bank",
        status: "outstanding",
        _isArrears: true,
        _dueDateRaw: new Date(Date.now() - 864e5).toISOString().split("T")[0]
      };
    });
    overdue = overdue.concat(arrearsEntries);
    var dueToday = owed.filter(function(p) {
      return getDueStatus(p) === "today";
    });
    var tomorrow = owed.filter(function(p) {
      return getDueStatus(p) === "tomorrow";
    });
    var cashColl = owed.filter(function(p) {
      return p.method === "cash";
    });
    var activeData = rentTab === "overdue" ? overdue : rentTab === "today" ? dueToday : rentTab === "tomorrow" ? tomorrow : rentTab === "paid" ? paidForTab : cashColl;
    var totalPaid = paid.reduce(function(s, p) {
      return s + p.amount;
    }, 0).toLocaleString();
    var totalOwed = owed.reduce(function(s, p) {
      return s + p.amount;
    }, 0).toLocaleString();
    var totalCollected = paid.reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var totalOutstanding = synth.reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var totalExpect = totalCollected + totalOutstanding;
    var rate = totalExpect ? Math.round(totalCollected / totalExpect * 100) : 0;
    window._renderedOverdue = overdue;
    overdueWithWA = overdue.filter(function(p) {
      if (p._isArrears) {
        var t = state.tenants.find(function(x) {
          return x.name === p.tenant;
        });
        return t && t.whatsapp;
      }
      var t = state.tenants.find(function(x) {
        return x.name === p.tenant;
      });
      return t && t.whatsapp && getDueStatus(p) === "overdue";
    });
    var h = "";
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px">';
    h += '<div><div style="font-size:20px;font-weight:700;color:var(--text)">Rent Collection</div><div style="font-size:12px;color:var(--muted);margin-top:2px">' + periodInfo.label + "</div></div>";
    if (overdueWithWA.length > 0) h += '<button onclick="bulkChaseOverdue()" style="display:flex;align-items:center;gap:6px;padding:9px 14px;border-radius:9px;border:none;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">\u26A0\uFE0F Chase All (' + overdueWithWA.length + ")</button>";
    h += "</div>";
    var periods = [{ v: "week", l: "This Week" }, { v: "prev-week", l: "Last Week" }, { v: "month", l: "This Month" }, { v: "prev-month", l: "Last Month" }, { v: "ytd", l: "YTD" }];
    h += '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex-wrap:nowrap">';
    [{ v: "week", l: "This Week" }, { v: "prev-week", l: "Last Week" }, { v: "month", l: "This Month" }, { v: "prev-month", l: "Last Month" }, { v: "ytd", l: "YTD" }].forEach(function(x) {
      h += `<button onclick="state.filters.rentPeriod='` + x.v + `';render()" style="padding:7px 14px;border-radius:20px;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;border:1px solid ` + (period === x.v ? "var(--accent)" : "var(--border)") + ";background:" + (period === x.v ? "var(--accent)" : "var(--bg)") + ";color:" + (period === x.v ? "#fff" : "var(--muted)") + '">' + x.l + "</button>";
    });
    h += "</div>";
    h += '<button onclick="openLateFeeSettings()" style="font-size:11px;color:var(--muted);background:none;border:1px solid var(--border);border-radius:7px;padding:4px 10px;cursor:pointer;font-family:inherit;margin-bottom:16px">\u23F0 Late fee: ' + (state.lateFeeConfig.enabled ? "\xA3" + state.lateFeeConfig.feeAmount + " after " + state.lateFeeConfig.graceDays + "d" : "Off") + "</button>";
    var bankPaid = paid.filter(function(p) {
      return p.method === "bank";
    }).reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var cashPaid = paid.filter(function(p) {
      return p.method === "cash";
    }).reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var bankPaidCount = paid.filter(function(p) {
      return p.method === "bank";
    }).length;
    var cashPaidCount = paid.filter(function(p) {
      return p.method === "cash";
    }).length;
    h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:14px;padding:14px">';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-bottom:10px">';
    h += '<div style="text-align:center"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Collected</div><div style="font-size:15px;font-weight:800;color:var(--green);font-family:monospace">\xA3' + totalPaid + '</div><div style="font-size:10px;color:var(--muted)">' + paid.length + " payments</div></div>";
    h += '<div style="text-align:center;border-left:1px solid var(--border);border-right:1px solid var(--border)"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Outstanding</div><div style="font-size:15px;font-weight:800;color:' + (owed.length > 0 ? "var(--red)" : "var(--muted)") + ';font-family:monospace">\xA3' + totalOwed + '</div><div style="font-size:10px;color:var(--muted)">' + owed.length + " tenants</div></div>";
    h += '<div style="text-align:center"><div style="font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Expected</div><div style="font-size:15px;font-weight:800;color:var(--text);font-family:monospace">' + fmt(totalExpect) + '</div><div style="font-size:10px;color:var(--muted)">' + rate + "% rate</div></div>";
    h += "</div>";
    h += '<div style="background:var(--border);border-radius:4px;height:5px;margin-bottom:10px">';
    h += '<div style="background:var(--green);border-radius:4px;height:5px;width:' + (totalExpect ? Math.round(totalCollected / totalExpect * 100) : 0) + '%"></div>';
    h += "</div>";
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid var(--border);padding-top:10px">';
    h += '<div style="display:flex;align-items:center;gap:8px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 12px">';
    h += '<span style="font-size:16px">\u{1F3E6}</span>';
    h += '<div><div style="font-size:11px;font-weight:700;color:var(--blue)">BANK</div>';
    h += '<div style="font-size:14px;font-weight:800;color:var(--blue);font-family:monospace">\xA3' + bankPaid.toLocaleString() + "</div>";
    h += '<div style="font-size:10px;color:var(--muted)">' + bankPaidCount + " payment" + (bankPaidCount === 1 ? "" : "s") + "</div></div>";
    h += "</div>";
    h += '<div style="display:flex;align-items:center;gap:8px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:8px 12px">';
    h += '<span style="font-size:16px">\u{1F4B5}</span>';
    h += '<div><div style="font-size:11px;font-weight:700;color:var(--amber)">CASH</div>';
    h += '<div style="font-size:14px;font-weight:800;color:var(--amber);font-family:monospace">\xA3' + cashPaid.toLocaleString() + "</div>";
    h += '<div style="font-size:10px;color:var(--muted)">' + cashPaidCount + " payment" + (cashPaidCount === 1 ? "" : "s") + "</div></div>";
    h += "</div>";
    h += "</div>";
    h += "</div>";
    var totalArrears = state.tenants.filter(function(t) {
      return t.status !== "inactive" && t.arrears > 0;
    }).reduce(function(s, t) {
      return s + (t.arrears || 0);
    }, 0);
    var arrearsCount = state.tenants.filter(function(t) {
      return t.status !== "inactive" && t.arrears > 0;
    }).length;
    if (totalArrears > 0) {
      h += `<div onclick="state.filters.tenants='arrears';state.page='tenants';render()" style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer">`;
      h += '<div><div style="font-size:12px;font-weight:700;color:var(--red)">\u26A0\uFE0F Total Rent Arrears</div>';
      h += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + arrearsCount + " tenant" + (arrearsCount === 1 ? "" : "s") + " with outstanding balance</div></div>";
      h += '<div style="font-size:22px;font-weight:800;color:var(--red);font-family:monospace">' + fmt(totalArrears) + "</div>";
      h += "</div>";
    }
    h += '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:16px;-webkit-overflow-scrolling:touch;scrollbar-width:none">';
    [{ v: "today", l: "Due Today", count: dueToday.length, color: "var(--amber)" }, { v: "tomorrow", l: "Tomorrow", count: tomorrow.length, color: "var(--blue)" }, { v: "cash", l: "\u{1F4B5} Cash", count: cashColl.length, color: "var(--amber)" }, { v: "overdue", l: "Overdue", count: overdue.length, color: "var(--red)" }, { v: "paid", l: "Collected", count: paid.length, color: "var(--green)" }].forEach(function(t) {
      h += `<button onclick="state.filters.rentTab='` + t.v + `';render()" style="display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:20px;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;flex-shrink:0;border:1px solid ` + (rentTab === t.v ? t.color : "var(--border)") + ";background:" + (rentTab === t.v ? t.color + "22" : "var(--bg)") + ";color:" + (rentTab === t.v ? t.color : "var(--muted)") + '">' + (t.count > 0 ? '<span style="background:' + t.color + ';color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:700"> ' + t.count + " </span> " : "") + t.l + "</button>";
    });
    h += "</div>";
    if (rentTab === "cash" && activeData.length > 0) {
      window._cashData = activeData;
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
      h += '<div style="font-size:13px;font-weight:700">&#x1F4B5; Cash Collections &middot; <span style="color:var(--amber)">' + activeData.length + " pending</span></div>";
      h += '<button onclick="shareCashCollections(window._cashData||[])" style="display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:9px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F4AC; Share List</button>';
      h += "</div>";
    }
    h += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">';
    if (activeData.length === 0) {
      h += '<div style="padding:40px 20px;text-align:center;color:var(--dim)"><div style="font-size:40px;margin-bottom:10px">\u{1F4CB}</div><div style="font-size:14px;font-weight:600">No payments in this period</div></div>';
    } else {
      activeData.forEach(function(p) {
        h += renderRentRow(p);
      });
    }
    h += "</div>";
    return h;
  }
  function renderExpenses() {
    const tab = state.filters.expenses || "overview";
    const selMonth = state.filters.expMonth || "all";
    function expInMonth(e) {
      if (selMonth === "all") return true;
      var mo = MONTHS.find(function(m) {
        return m.key === selMonth;
      });
      if (!mo) return true;
      if (e.recurring && e.startDate) {
        var startD = new Date(e.startDate);
        return startD <= mo.to;
      }
      if (e.startDate) {
        var d = new Date(e.startDate);
        return d >= mo.from && d <= mo.to;
      }
      return true;
    }
    const expCo = state.filters.expCompany || "";
    const filtered = state.expenses.filter(function(e) {
      if (!expInMonth(e)) return false;
      if (!expCo) return true;
      if (e.companyId && e.companyId === expCo) return true;
      if (e.property) {
        var prop2 = state.properties.find(function(p) {
          return p.name === e.property;
        });
        if (prop2 && prop2.companyId === expCo) return true;
      }
      return false;
    });
    const staff = filtered.filter((e) => e.type === "staff").reduce((a, e) => a + e.amount, 0);
    const prop = filtered.filter((e) => e.type === "property").reduce((a, e) => a + e.amount, 0);
    const over = filtered.filter((e) => e.type === "overhead").reduce((a, e) => a + e.amount, 0);
    const actual = filtered.filter((e) => e.type === "actual").reduce((a, e) => a + e.amount, 0);
    const total = staff + prop + over + actual;
    const moLabel = selMonth === "all" ? "All Time" : (MONTHS.find(function(m) {
      return m.key === selMonth;
    }) || { label: selMonth }).label;
    return `
    <div class="page-header">
      <div><div class="page-title">Expenses</div><div class="page-sub">${filtered.length} records \xB7 ${moLabel}</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <select onchange="state.filters.expCompany=this.value;render()" style="padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">
          <option value="">\u{1F3E2} All Companies</option>
          ${(state.companies || []).map(function(c) {
      return '<option value="' + c.id + '" ' + (state.filters.expCompany === c.id ? "selected" : "") + ">" + c.name + "</option>";
    }).join("")}
        </select>
        <select onchange="state.filters.expMonth=this.value;render()" style="padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer">
          <option value="all">All Time</option>
          ${MONTHS.slice().reverse().map(function(m) {
      return '<option value="' + m.key + '" ' + (selMonth === m.key ? "selected" : "") + ">" + m.label + "</option>";
    }).join("")}
        </select>
        ${btn("+ Add Expense", "openModal('addExpense')")}
      </div>
    </div>
    <div class="filters">
      ${[{ v: "overview", l: "Overview" }, { v: "list", l: "All Expenses" }].map((x) => `<button class="filter-btn ${tab === x.v ? "active" : ""}" onclick="state.filters.expenses='${x.v}';state.filters.expType='';render()">${x.l}</button>`).join("")}
      ${tab === "list" ? `<button class="filter-btn ${!state.filters.expType ? "active" : ""}" onclick="state.filters.expType='';render()">All</button><button class="filter-btn ${"staff" === state.filters.expType ? "active" : ""}" onclick="state.filters.expType='staff';render()">\u{1F477} Staff</button><button class="filter-btn ${"property" === state.filters.expType ? "active" : ""}" onclick="state.filters.expType='property';render()">\u{1F3E0} Property</button><button class="filter-btn ${"overhead" === state.filters.expType ? "active" : ""}" onclick="state.filters.expType='overhead';render()">\u2699\uFE0F Overhead</button>` : ""}
    </div>
    ${tab === "overview" ? `
      <div class="kpi-grid kpi-4" style="margin-bottom:22px">
        <div onclick="state.filters.expenses='list';state.filters.expType='';render()" style="cursor:pointer">${kpi("Total Expenses", fmt(total), "This month", "#E8375A", "\u{1F4B8}")}</div>
        <div onclick="state.filters.expenses='list';state.filters.expType='staff';render()" style="cursor:pointer">${kpi("Staff & Labour", fmt(staff), `${filtered.filter((e) => e.type === "staff").length} records \xB7 tap to view`, "#F59E0B", "\u{1F477}")}</div>
        <div onclick="state.filters.expenses='list';state.filters.expType='property';render()" style="cursor:pointer">${kpi("Property Costs", fmt(prop), `${filtered.filter((e) => e.type === "property").length} records \xB7 tap to view`, "#3B82F6", "\u{1F3E0}")}</div>
        ${actual > 0 ? `<div onclick="state.filters.expenses='list';state.filters.expType='actual';render()" style="cursor:pointer">${kpi("Job Costs", fmt(actual), filtered.filter((e) => e.type === "actual").length + " maintenance jobs \xB7 tap to view", "#F97316", "\u{1F527}")}</div>` : ""}
        <div onclick="state.filters.expenses='list';state.filters.expType='overhead';render()" style="cursor:pointer">${kpi("Overhead", fmt(over), `${filtered.filter((e) => e.type === "overhead").length} records \xB7 tap to view`, "#8B5CF6", "\u2699\uFE0F")}</div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title">\u{1F4CA} Cost Breakdown</div>
          ${(function() {
      var cats = {};
      filtered.forEach(function(e) {
        var cat = e.cat || e.type || "Other";
        cats[cat] = (cats[cat] || 0) + e.amount;
      });
      var catColors = {
        "Council Tax": "#6366F1",
        "Energy \u2013 Gas": "#EF4444",
        "Energy \u2013 Electric": "#F59E0B",
        "Water": "#3B82F6",
        "Internet / Broadband": "#06B6D4",
        "Cleaning": "#10B981",
        "Maintenance & Repairs": "#F97316",
        "Insurance": "#8B5CF6",
        "HMO Licence": "#EC4899",
        "Property Costs": "#3B82F6",
        "Staff & Labour": "#F59E0B",
        "Contractor": "#FB923C",
        "Software & Tools": "#A855F7",
        "Accountancy": "#14B8A6",
        "Legal": "#64748B",
        "Overhead": "#94A3B8"
      };
      var sorted = Object.keys(cats).sort(function(a, b) {
        return cats[b] - cats[a];
      });
      if (!sorted.length) return '<div style="font-size:13px;color:var(--muted);padding:10px 0">No expenses in this period</div>';
      return sorted.map(function(cat) {
        var col = catColors[cat] || "#64748B";
        var pctV = total ? Math.round(cats[cat] / total * 100) : 0;
        return '<div class="exp-bar-row"><div class="exp-bar-top"><span style="font-size:12px;color:var(--muted)">' + cat + '</span><span class="mono" style="font-size:12px;font-weight:700;color:' + col + '">' + fmt(cats[cat]) + '</span></div><div class="bar-track"><div class="bar-fill" style="width:' + pctV + "%;background:" + col + '"></div></div></div>';
      }).join("");
    })()}
        </div>
        <div class="card">
          <div class="card-title">\u2705 Confirmation Status</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:var(--green)">${state.expenses.filter((e) => e.status === "confirmed").length}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px;font-weight:500">Confirmed</div>
            </div>
            <div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:var(--amber)">${state.expenses.filter((e) => e.status === "estimated").length}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px;font-weight:500">Estimated</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5">Confirm each expense once the actual amount is known. Estimated figures may change.</div>
        </div>
      </div>
    ` : `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Frequency</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${filtered.filter((e) => !state.filters.expType || e.type === state.filters.expType).map((e) => `<tr>
              <td style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.cat || e.type}</td>
              <td style="font-size:12px">
                ${e.desc}
                ${e.property ? `<div style="font-size:10px;color:var(--muted)">${e.property}</div>` : ""}
              </td>
              <td class="mono" style="font-weight:700;color:var(--red)">${fmt(e.amount)}</td>
              <td>
                <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${e.recurring ? "var(--blue-light)" : "var(--bg)"};color:${e.recurring ? "var(--blue)" : "var(--muted)"}">
                  ${e.recurring ? "\u{1F504} Monthly" : "1\xD7 One-off"}
                </span>
              </td>
              <td>${badge(e.status)}</td>
              <td><div style="display:flex;gap:6px">
                ${e.status === "estimated" ? btn("\u2713 Confirm", `confirmExp('${e.id}')`, "primary", true) : ""}
                ${btn("\u270F\uFE0F Edit", `editExpModal('${e.id}')`, "secondary", true)}
                ${btn("\u{1F5D1} Remove", `removeExp('${e.id}')`, "danger", true)}
              </div></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`}`;
  }
  function renderMaintenance() {
    const f = state.filters.maint || "open";
    const view = state.filters.maintView || "requests";
    const data = f === "all" ? state.maintenance : state.maintenance.filter((m) => m.status === f);
    const contractors = state.contractors || [];
    const TRADES = ["General", "Plumbing", "Electrical", "Heating", "Structural", "Cleaning", "Pest Control", "Locks / Security", "Garden", "White Goods", "Broadband / WiFi", "Other"];
    const contractorsView = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-size:15px;font-weight:700">${contractors.length} Contractor${contractors.length !== 1 ? "s" : ""}</div>
        <div style="font-size:12px;color:var(--muted)">Your trusted trades directory</div>
      </div>
      <button onclick="openAddContractorModal()" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add Contractor</button>
    </div>
    ${contractors.length === 0 ? `<div style="background:var(--surface);border:2px dashed var(--border);border-radius:14px;padding:48px;text-align:center;color:var(--muted)">
          <div style="font-size:36px;margin-bottom:12px">\u{1F527}</div>
          <div style="font-size:14px;font-weight:700;margin-bottom:6px">No contractors yet</div>
          <div style="font-size:12px">Add your trusted plumbers, electricians, and other trades.<br>You can then send maintenance jobs directly to them via WhatsApp or email.</div>
          <button onclick="openAddContractorModal()" style="margin-top:16px;padding:10px 22px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add first contractor</button>
         </div>` : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${contractors.map((c) => {
      const tradeColors = {
        "Plumbing": "var(--blue)",
        "Plumbing-bg": "var(--blue-light)",
        "Electrical": "var(--amber)",
        "Electrical-bg": "var(--amber-light)",
        "Heating": "#EF4444",
        "Heating-bg": "#FEF2F2",
        "Structural": "var(--muted)",
        "Structural-bg": "var(--bg)",
        "Cleaning": "var(--green)",
        "Cleaning-bg": "var(--green-light)",
        "General": "var(--purple)",
        "General-bg": "var(--purple-light)"
      };
      const tc = tradeColors[c.trade] || "var(--muted)";
      const tbg = tradeColors[c.trade + "-bg"] || "var(--bg)";
      const waHref = c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, "")}` : "";
      const mailHref = c.email ? `mailto:${c.email}` : "";
      const stars = c.rating ? "\u2605".repeat(c.rating) + "\u2606".repeat(5 - c.rating) : "";
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div>
                  <div style="font-size:15px;font-weight:700;margin-bottom:3px">${c.name}</div>
                  <span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:10px;background:${tbg};color:${tc}">${c.trade}</span>
                  ${stars ? `<span style="font-size:11px;color:var(--amber);margin-left:6px">${stars}</span>` : ""}
                </div>
                <div style="display:flex;gap:6px">
                  <button onclick="openContractorProfile('${c.id}')" style="padding:5px 12px;border-radius:7px;border:1.5px solid var(--accent);background:var(--accent-light);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--accent-dark)">View Profile</button>
                  <button onclick="openEditContractorModal('${c.id}')" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;cursor:pointer;font-family:inherit;color:var(--muted)">Edit</button>
                </div>
              </div>
              ${c.phone ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">\u{1F4DE} ${c.phone}</div>` : ""}
              ${c.email ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">\u2709\uFE0F ${c.email}</div>` : ""}
              ${c.callOutCharge ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">\u{1F4B7} Call-out: \xA3${c.callOutCharge}</div>` : ""}
              ${c.notes ? `<div style="font-size:11px;color:var(--dim);background:var(--bg);padding:6px 9px;border-radius:7px;margin:8px 0">${c.notes}</div>` : ""}
              ${c.lastUsed ? `<div style="font-size:11px;color:var(--dim);margin-bottom:4px">Last used: ${new Date(c.lastUsed).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>` : ""}
              ${(() => {
        var jobs = state.maintenance.filter(function(m) {
          return m.contractor === c.name;
        });
        var spend = state.expenses.filter(function(e) {
          return e.desc && e.desc.includes("[" + c.name + "]");
        }).reduce(function(s, e) {
          return s + e.amount;
        }, 0);
        if (!jobs.length) return "";
        return '<div style="display:flex;gap:6px;margin-bottom:8px"><span style="font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:10px">' + jobs.length + " job" + (jobs.length > 1 ? "s" : "") + "</span>" + (spend > 0 ? '<span style="font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:10px">\xA3' + spend.toLocaleString() + "</span>" : "") + "</div>";
      })()}
              <div style="display:flex;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                ${waHref ? `<a href="${waHref}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;border-radius:8px;background:#F0FDF4;border:1px solid #BBF7D0;color:#16A34A;font-size:12px;font-weight:700;text-decoration:none">\u{1F4AC} WhatsApp</a>` : ""}
                ${mailHref ? `<a href="${mailHref}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;border-radius:8px;background:var(--blue-light);border:1px solid #BFDBFE;color:var(--blue);font-size:12px;font-weight:700;text-decoration:none">\u2709\uFE0F Email</a>` : ""}
                ${!waHref && !mailHref ? `<span style="font-size:11px;color:var(--dim)">No contact details</span>` : ""}
              </div>
            </div>`;
    }).join("")}
        </div>`}`;
    const requestsView = `
    <div class="kpi-grid kpi-3" style="margin-bottom:22px">
      ${kpi("Open", state.maintenance.filter((m) => m.status === "open").length, "Awaiting action", "#E8375A", "\u{1F534}")}
      ${kpi("In Progress", state.maintenance.filter((m) => m.status === "in_progress").length, "Being handled", "#F59E0B", "\u{1F7E1}")}
      ${kpi("Resolved", state.maintenance.filter((m) => m.status === "resolved").length, "Completed", "#10B981", "\u2705")}
    </div>
    <div class="filters">
      ${["open", "in_progress", "all", "resolved"].map((v) => `<button class="filter-btn ${f === v ? "active" : ""}" onclick="state.filters.maint='${v}';render()">${v === "in_progress" ? "In Progress" : v === "all" ? "All" : v[0].toUpperCase() + v.slice(1)}</button>`).join("")}
    </div>
    <div class="maint-grid">
      ${data.map((m) => {
      const waNum = (m.tenant ? (state.tenants.find((t) => t.name === m.tenant && t.status !== "inactive") || {}).whatsapp : null) || "";
      const mx = state.maintExtras && state.maintExtras[m.id] || {};
      const allPhotos = [m.photo].filter(Boolean).concat((mx.photos || []).map(function(p) {
        return p.src;
      }));
      return `<div class="maint-card${m.priority === "urgent" && m.status !== "resolved" ? " urgent-open" : ""}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div style="display:flex;gap:5px;flex-wrap:wrap">${badge(m.priority)} ${badge(m.status.replace("_", " "))}</div>
            <button data-mid="${m.id}" onclick="openEditMaintModal(this.dataset.mid)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--muted);flex-shrink:0;margin-left:6px">Edit</button>
            <button data-mid="${m.id}" onclick="deleteMaintenanceJob(this.dataset.mid)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--red);background:var(--red-light);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--red);flex-shrink:0;margin-left:4px">\u2715</button>
          </div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">${m.issue}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px">${m.property}${m.room ? " \xB7 Room " + m.room : ""}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px">Tenant: ${m.tenant || "\u2014"}</div>
          <div style="font-size:11px;color:var(--dim);margin-bottom:8px">Logged: ${m.date} \xB7 ${m.cat}</div>
          ${allPhotos.length ? `<div style="display:grid;grid-template-columns:${allPhotos.length > 1 ? "1fr 1fr" : "1fr"};gap:4px;margin-bottom:10px">${allPhotos.map(function(src) {
        return '<img src="' + src + '" style="width:100%;height:90px;object-fit:cover;border-radius:7px">';
      }).join("")}</div>` : ""}
          ${m.notes ? `<div style="font-size:12px;color:var(--muted);background:var(--bg);padding:7px 10px;border-radius:7px;margin-bottom:10px">Notes: ${m.notes}</div>` : ""}
          ${m.contractor ? `<div style="font-size:11px;color:var(--blue);background:var(--blue-light);padding:5px 9px;border-radius:7px;margin-bottom:8px;font-weight:600">\u{1F477} ${m.contractor}</div>` : ""}
          ${mx.cost || mx.invoiceName ? `<div style="display:flex;align-items:center;gap:8px;background:var(--green-light);border:1px solid #A7F3D0;border-radius:8px;padding:7px 10px;margin-bottom:8px">${mx.cost ? '<span style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace">\xA3' + mx.cost + '</span><span style="font-size:11px;color:var(--muted)"> job cost</span>' : ""}${mx.invoiceName ? '<a href="' + (mx.invoiceUrl || "#") + '" download="' + mx.invoiceName + '" style="margin-left:auto;font-size:11px;font-weight:700;color:var(--blue);text-decoration:none">Invoice</a>' : ""}</div>` : ""}
          ${m.status !== "resolved" ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
                ${m.status === "open" ? btn("&#x25B6; Start", `updMaint('${m.id}','in_progress')`, "secondary", true) : ""}
                ${btn("\u2713 Resolve", `updMaint('${m.id}','resolved')`, m.status === "open" ? "secondary" : "primary", true)}
                <button data-mid="${m.id}" onclick="shareMaintWA(event,this.dataset.mid)" style="padding:5px 10px;border-radius:8px;border:1px solid #25D366;background:#F0FDF4;color:#16A34A;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">WA</button>
                <button data-mid="${m.id}" onclick="sendToContractorModal(this.dataset.mid)" style="padding:5px 10px;border-radius:8px;border:1px solid var(--blue);background:var(--blue-light);color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Contractor</button>
              </div>` : `<span style="font-size:12px;color:var(--green);font-weight:600">Resolved</span>`}
        </div>`;
    }).join("")}
      ${data.length === 0 ? '<div class="empty" style="grid-column:1/-1">No maintenance requests found</div>' : ""}
    </div>`;
    return `
    <div class="page-header">
      <div><div class="page-title">Maintenance</div><div class="page-sub">${state.maintenance.filter((m) => m.status !== "resolved").length} open \xB7 ${state.maintenance.filter((m) => m.priority === "urgent" && m.status !== "resolved").length} urgent</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button onclick="shareAllMaintWA()" style="padding:9px 14px;border-radius:9px;border:1px solid #25D366;background:#F0FDF4;color:#16A34A;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">\u{1F4F2} Share All Open</button>
        ${btn("+ Log Request", "openModal('addMaint')")}
      </div>
    </div>
    <!-- View tabs: Requests / Contractors -->
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px">
      <button onclick="state.filters.maintView='requests';render()" style="padding:10px 20px;border:none;border-bottom:2px solid ${view === "requests" ? "var(--accent)" : "transparent"};background:transparent;font-size:13px;font-weight:${view === "requests" ? 700 : 500};color:${view === "requests" ? "var(--accent-dark)" : "var(--muted)"};cursor:pointer;font-family:inherit">
        \u{1F527} Requests <span style="font-size:11px;background:${state.maintenance.filter((m) => m.status !== "resolved").length ? "var(--red)" : "var(--border)"};color:${state.maintenance.filter((m) => m.status !== "resolved").length ? "#fff" : "var(--muted)"};padding:1px 6px;border-radius:10px;margin-left:4px">${state.maintenance.filter((m) => m.status !== "resolved").length}</span>
      </button>
      <button onclick="state.filters.maintView='contractors';render()" style="padding:10px 20px;border:none;border-bottom:2px solid ${view === "contractors" ? "var(--accent)" : "transparent"};background:transparent;font-size:13px;font-weight:${view === "contractors" ? 700 : 500};color:${view === "contractors" ? "var(--accent-dark)" : "var(--muted)"};cursor:pointer;font-family:inherit">
        \u{1F477} Contractors <span style="font-size:11px;background:var(--bg);color:var(--muted);padding:1px 6px;border-radius:10px;margin-left:4px;border:1px solid var(--border)">${contractors.length}</span>
      </button>
    </div>
    ${view === "contractors" ? contractorsView : requestsView}`;
  }
  function getNextPayDate(fromDate, freq, payDay, payDayOfMonth) {
    var d = new Date(fromDate);
    if (freq === "weekly") {
      var target = DAYS.indexOf(payDay);
      var cur = d.getDay();
      var diff = (target - cur + 7) % 7;
      d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
    } else {
      var dom = +payDayOfMonth || 1;
      d.setDate(dom);
      if (d <= fromDate) d.setMonth(d.getMonth() + 1);
    }
    return d;
  }
  function dateToStr(d) {
    return d.toISOString().split("T")[0];
  }
  function generateSchedule(tenant) {
    if (!tenant.startDate || tenant.status === "inactive") return [];
    var entries = [];
    var freq = tenant.freq || "weekly";
    var payDay = tenant.payDay || "Friday";
    var payDom = tenant.payDayOfMonth || 1;
    var startD = new Date(tenant.startDate);
    var pastWindow = new Date(TODAY.getTime() - WEEKS_AHEAD * 7 * 864e5);
    var genFrom = startD > pastWindow ? startD : pastWindow;
    var searchFrom = new Date(genFrom.getTime() - 864e5);
    var nextDue = getNextPayDate(searchFrom, freq, payDay, payDom);
    while (nextDue < startD) {
      nextDue = getNextPayDate(nextDue, freq, payDay, payDom);
    }
    var count = freq === "weekly" ? WEEKS_AHEAD * 2 : 6;
    for (var i = 0; i < count; i++) {
      var isOverdue = nextDue < TODAY;
      var isToday = nextDue.toDateString() === TODAY.toDateString();
      var nextDueMidnight = new Date(nextDue.getFullYear(), nextDue.getMonth(), nextDue.getDate());
      entries.push({
        id: String(tenant.id) + "_sch_" + nextDueMidnight.getTime(),
        tenantId: tenant.id,
        tenantName: tenant.name,
        property: tenant.property,
        room: tenant.room,
        amount: tenant.rent,
        dueDate: dateToStr(nextDue),
        dueDateRaw: nextDueMidnight.getTime(),
        method: tenant.method,
        status: isOverdue ? "overdue" : isToday ? "due_today" : "upcoming",
        freq,
        payDay,
        type: "schedule"
      });
      nextDue = getNextPayDate(nextDue, freq, payDay, payDom);
    }
    return entries;
  }
  function rebuildAllSchedules() {
    var newSchedule = [];
    state.tenants.filter(function(t) {
      return t.status === "active" || t.status === "notice_given";
    }).forEach(function(t) {
      newSchedule = newSchedule.concat(generateSchedule(t));
    });
    var paidKeys = /* @__PURE__ */ new Set();
    state.payments.forEach(function(p) {
      if (p.status !== "paid") return;
      var tn = p.tenantName || p.tenant || "";
      if (p._dueDateRaw) paidKeys.add(tn + "_" + p._dueDateRaw);
      if (p._paidDateRaw) {
        for (var d = -3; d <= 3; d++) paidKeys.add(tn + "_" + (p._paidDateRaw + d * 864e5));
      }
    });
    newSchedule.forEach(function(s) {
      var key = (s.tenantName || "") + "_" + s.dueDateRaw;
      if (paidKeys.has(key)) s.status = "paid";
    });
    state.rentSchedule = newSchedule;
  }
  function rebuildTenantSchedule(tenantId) {
    state.rentSchedule = (state.rentSchedule || []).filter(function(s) {
      return s.tenantId !== tenantId;
    });
    var t = state.tenants.find(function(x) {
      return x.id === tenantId;
    });
    if (t && t.status === "active") {
      state.rentSchedule = state.rentSchedule.concat(generateSchedule(t));
    }
  }
  function markSchedulePaid(schedId, method) {
    var s = state.rentSchedule.find(function(x) {
      return String(x.id) === String(schedId);
    });
    if (!s) return;
    s.status = "paid";
    var t = state.tenants.find(function(x) {
      return x.id === s.tenantId;
    });
    if (t) {
      t.paid = new Date(s.dueDateRaw).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      var dueDateISO = new Date(s.dueDateRaw).toISOString().split("T")[0];
      state.payments.push({ id: crypto.randomUUID(), tenant: s.tenantName, tenantName: s.tenantName, tenantId: s.tenantId, property: s.property, propertyName: s.property, amount: s.amount, date: t.paid, dueDate: dueDateISO, paidDate: t.paid, method, status: "paid", _dueDateRaw: s.dueDateRaw });
    }
    saveState();
  }
  function markPartialPaid(id, fullAmount) {
    var tenantName = "";
    var idStr = String(id);
    if (idStr.indexOf("_sch_") >= 0) {
      var s = state.rentSchedule.find(function(x) {
        return String(x.id) === idStr;
      });
      if (s) tenantName = s.tenantName;
    } else {
      var pay0 = state.payments.find(function(p) {
        return String(p.id) === idStr;
      });
      if (pay0) tenantName = pay0.tenant;
    }
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:360px"><div class="modal-header"><span class="modal-title">\u{1F4B7} Partial Payment</span><button class="modal-close" onclick="closeModal()">\xD7</button></div><div class="modal-body"><div style="font-size:13px;color:var(--muted);margin-bottom:14px">' + tenantName + " \xB7 Full amount: <strong>" + fmt(fullAmount) + '</strong></div><div class="field"><label class="field-label">Amount Received (\xA3)</label><input type="hidden" id="partial-id" value="' + idStr + '"><input type="hidden" id="partial-full" value="' + fullAmount + '"><input class="inp" id="partial-amount-inp" type="number" placeholder="' + fullAmount + '" inputmode="decimal" style="font-size:18px;font-weight:700"></div><div id="partial-shortfall-preview" style="font-size:12px;color:var(--amber);margin-top:6px;min-height:18px"></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button onclick="confirmPartialPaid()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Confirm Partial</button></div></div></div></div>';
    var inp = document.getElementById("partial-amount-inp");
    if (inp) {
      inp.focus();
      inp.addEventListener("input", function() {
        var v = parseFloat(inp.value) || 0;
        var sf = Math.round((fullAmount - v) * 100) / 100;
        var el = document.getElementById("partial-shortfall-preview");
        if (el) el.textContent = v > 0 && v < fullAmount ? "\u26A0\uFE0F Shortfall: \xA3" + sf + " will be added to arrears" : "";
      });
    }
  }
  function confirmPartialPaid() {
    var inp = document.getElementById("partial-amount-inp");
    var idEl = document.getElementById("partial-id");
    var fullEl = document.getElementById("partial-full");
    if (!inp || !idEl || !fullEl) return;
    var id = idEl.value;
    var fullAmount = parseFloat(fullEl.value);
    var partial = parseFloat(inp.value);
    if (isNaN(partial) || partial <= 0) {
      inp.focus();
      return;
    }
    if (partial >= fullAmount) {
      closeModal();
      markPaid(String(id), "bank");
      return;
    }
    var shortfall = Math.round((fullAmount - partial) * 100) / 100;
    var idStr = String(id);
    var found = false;
    if (idStr.indexOf("_sch_") >= 0) {
      var s = state.rentSchedule.find(function(x) {
        return String(x.id) === idStr;
      });
      if (s) {
        var t = state.tenants.find(function(x) {
          return x.name === s.tenantName;
        });
        var _dueDateISO = new Date(s.dueDateRaw).toISOString().split("T")[0];
        var _paidStr = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        state.payments.push({
          id: crypto.randomUUID(),
          tenant: s.tenantName,
          tenantName: s.tenantName,
          tenantId: s.tenantId,
          property: s.property,
          propertyName: s.property,
          amount: partial,
          method: "bank",
          status: "paid",
          date: _paidStr,
          paidDate: _paidStr,
          dueDate: _dueDateISO,
          _dueDateRaw: s.dueDateRaw,
          isPartial: true,
          shortfall,
          _partial: true,
          _shortfall: shortfall
        });
        if (t) {
          t.arrears = Math.round(((t.arrears || 0) + shortfall) * 100) / 100;
        }
        s.amount = shortfall;
        s._partialPaid = partial;
        found = true;
      }
    } else {
      var pay = state.payments.find(function(p) {
        return String(p.id) === idStr;
      });
      if (pay) {
        var t2 = state.tenants.find(function(x) {
          return x.name === pay.tenant;
        });
        pay.amount = shortfall;
        pay._partial = true;
        pay._shortfall = shortfall;
        pay._partialPaid = partial;
        if (t2) {
          t2.arrears = Math.round(((t2.arrears || 0) + shortfall) * 100) / 100;
        }
        found = true;
      }
    }
    closeModal();
    if (found) render();
  }
  function markPaid(id, method) {
    var idStr = String(id);
    if (idStr.startsWith("arrears_")) {
      var _tidStr = idStr.replace("arrears_", "");
      var ta = state.tenants.find(function(x) {
        return String(x.id) === _tidStr;
      });
      if (ta) {
        var _aDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        var _aNow = /* @__PURE__ */ new Date();
        var _aISO = _aNow.toISOString().split("T")[0];
        var _aRaw = new Date(_aNow.getFullYear(), _aNow.getMonth(), _aNow.getDate()).getTime();
        state.payments.push({
          id: crypto.randomUUID(),
          tenant: ta.name,
          tenantName: ta.name,
          tenantId: ta.id,
          property: ta.property,
          propertyName: ta.property,
          amount: ta.arrears,
          method: method || "bank",
          status: "paid",
          date: _aDate,
          paidDate: _aDate,
          dueDate: _aISO,
          _dueDateRaw: _aRaw,
          _arrearsClearance: true
        });
        ta.arrears = 0;
      }
      render();
      return;
    }
    if (idStr.indexOf("_sch_") >= 0) {
      markSchedulePaid(id, method);
      render();
      return;
    }
    var found = false;
    state.payments = state.payments.map(function(p) {
      if (String(p.id) === idStr) {
        found = true;
        return Object.assign({}, p, { status: "paid", paidMethod: method });
      }
      return p;
    });
    if (!found) {
      var s = state.rentSchedule.find(function(x) {
        return String(x.id) === idStr;
      });
      if (s) markSchedulePaid(id, method);
    }
    saveState();
    render();
  }
  function recalcProperty(p) {
    if (!p) return;
    p.occupied = (p.roomList || []).filter(function(r) {
      return r.status === "occupied";
    }).length;
    var tenants = state.tenants.filter(function(t) {
      return t.property === p.name && t.status !== "inactive";
    });
    p.rent = Math.round(tenants.reduce(function(s, t) {
      return s + (t.freq === "monthly" ? t.rent : (t.rent || 0) * 52 / 12);
    }, 0));
  }
  function freeRoom(propName, roomN) {
    var p = state.properties.find(function(x) {
      return x.name === propName;
    });
    if (!p || !p.roomList) return;
    var r = p.roomList.find(function(rm) {
      return rm.n === roomN;
    });
    if (r) r.status = "vacant";
    recalcProperty(p);
    if (!state.voidDates) state.voidDates = {};
    var key = p.id + "_" + roomN;
    if (!state.voidDates[key]) state.voidDates[key] = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  }
  function occupyRoom(propName, roomN, rentAmount) {
    var p = state.properties.find(function(x) {
      return x.name === propName;
    });
    if (!p || !p.roomList) return;
    var r = p.roomList.find(function(rm) {
      return rm.n === roomN;
    });
    if (r) {
      r.status = "occupied";
      if (rentAmount && +rentAmount > 0) r.price = +rentAmount;
    }
    recalcProperty(p);
    if (state.voidDates) delete state.voidDates[p.id + "_" + roomN];
  }
  function deleteMaintenanceJob(id) {
    var m = state.maintenance.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!m) return;
    if (!confirm("Delete this job?\n\n" + m.issue + "\n\nThis cannot be undone.")) return;
    state.maintenance = state.maintenance.filter(function(x) {
      return String(x.id) !== String(id);
    });
    state.expenses = state.expenses.filter(function(e) {
      return e._maintId !== id;
    });
    if (state.maintExtras) delete state.maintExtras[id];
    try {
      supa.from("maintenance").delete().eq("id", String(id)).then(function() {
      });
    } catch (e) {
    }
    saveState();
    render();
    showToast("Job deleted", "success");
  }
  function updMaint(id, status) {
    state.maintenance = state.maintenance.map((m) => m.id === id ? { ...m, status } : m);
    saveState();
    render();
  }
  function confirmExp(id) {
    var e = state.expenses.find(function(x) {
      return String(x.id) === String(id);
    });
    if (e) {
      e.status = "confirmed";
    }
    saveState();
    render();
  }
  function removeExp(id) {
    var e = state.expenses.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!e) return;
    if (!confirm("Remove this expense?\n\n" + e.desc + " \xB7 " + fmt(e.amount) + (e.recurring ? "\n\u26A0\uFE0F This is a recurring expense." : ""))) return;
    supaDelete("expenses", id);
    state.expenses = state.expenses.filter(function(x) {
      return String(x.id) !== String(id);
    });
    saveState();
    render();
  }
  function editExpModal(id) {
    var e = state.expenses.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!e) return;
    var propOpts = '<option value="">\u2014 Portfolio-wide \u2014</option>' + state.properties.map(function(p) {
      return '<option value="' + p.name + '" ' + (e.property === p.name ? "selected" : "") + ">" + p.name + "</option>";
    }).join("");
    var coOpts = '<option value="">\u2014 Unassigned \u2014</option>' + (state.companies || []).map(function(c) {
      return '<option value="' + c.id + '" ' + (e.companyId === c.id ? "selected" : "") + ">" + c.name + "</option>";
    }).join("");
    var freqVal = e.freq || "one-off";
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-header"><span class="modal-title">\u270F\uFE0F Edit Expense</span><button class="modal-close" onclick="closeModal()">\xD7</button></div><div class="modal-body"><div class="field"><label class="field-label">Category</label><select class="inp" id="ee-cat"><optgroup label="\u{1F3E0} Property Running Costs">' + ["Council Tax", "Energy \u2013 Gas", "Energy \u2013 Electric", "Water", "Internet / Broadband", "Cleaning", "Maintenance & Repairs", "Insurance", "HMO Licence", "Property Costs"].map(function(c) {
      return '<option value="' + c + '" ' + (e.cat === c ? "selected" : "") + ">" + c + "</option>";
    }).join("") + '</optgroup><optgroup label="\u{1F477} Staff & Labour">' + ["Staff & Labour", "Contractor"].map(function(c) {
      return '<option value="' + c + '" ' + (e.cat === c ? "selected" : "") + ">" + c + "</option>";
    }).join("") + '</optgroup><optgroup label="\u2699\uFE0F Business Overhead">' + ["Software & Tools", "Accountancy", "Legal", "Overhead"].map(function(c) {
      return '<option value="' + c + '" ' + (e.cat === c ? "selected" : "") + ">" + c + "</option>";
    }).join("") + '</optgroup></select></div><div class="field"><label class="field-label">Description *</label><input class="inp" id="ee-desc" value="' + e.desc.replace(/"/g, "&quot;") + '"></div><div class="row-2"><div class="field"><label class="field-label">Amount (\xA3)</label><input class="inp" id="ee-amt" type="number" step="0.01" value="' + (e.amount || 0) + '"></div><div class="field"><label class="field-label">Frequency</label><select class="inp" id="ee-freq"><option value="one-off" ' + (freqVal === "one-off" ? "selected" : "") + '>One-off</option><option value="weekly" ' + (freqVal === "weekly" ? "selected" : "") + '>Weekly</option><option value="monthly" ' + (freqVal === "monthly" ? "selected" : "") + '>Monthly</option><option value="annual" ' + (freqVal === "annual" ? "selected" : "") + '>Annual</option></select></div></div><div class="row-2"><div class="field"><label class="field-label">Status</label><select class="inp" id="ee-status"><option value="estimated" ' + (e.status === "estimated" ? "selected" : "") + '>Estimated</option><option value="confirmed" ' + (e.status === "confirmed" ? "selected" : "") + '>Confirmed</option></select></div><div class="field"><label class="field-label">Date</label><input class="inp" id="ee-date" type="date" value="' + (e.startDate || "") + '"></div></div><div class="field"><label class="field-label">Property (optional)</label><select class="inp" id="ee-prop">' + propOpts + '</select></div><div class="field"><label class="field-label">\u{1F3E2} Company</label><select class="inp" id="ee-co">' + coOpts + '</select></div><div class="modal-footer">' + btn("Cancel", "closeModal()", "secondary") + btn("Save Changes", "saveExpEdit('" + id + "')", "primary") + "</div></div></div></div>";
  }
  function saveExpEdit(id) {
    var e = state.expenses.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!e) return;
    var desc = document.getElementById("ee-desc").value.trim();
    if (!desc) {
      alert("Please enter a description.");
      return;
    }
    var amt = +document.getElementById("ee-amt").value || 0;
    if (amt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    var cat = (document.getElementById("ee-cat") || { value: "" }).value;
    var staffCats = ["Staff & Labour", "Contractor"];
    var propCats = ["Council Tax", "Energy \u2013 Gas", "Energy \u2013 Electric", "Water", "Internet / Broadband", "Cleaning", "Maintenance & Repairs", "Insurance", "HMO Licence", "Property Costs"];
    e.cat = cat;
    e.type = staffCats.includes(cat) ? "staff" : propCats.includes(cat) ? "property" : "overhead";
    e.desc = desc;
    e.amount = amt;
    e.freq = (document.getElementById("ee-freq") || { value: "one-off" }).value;
    e.recurring = e.freq !== "one-off";
    e.status = (document.getElementById("ee-status") || { value: "estimated" }).value;
    e.startDate = (document.getElementById("ee-date") || { value: "" }).value || null;
    e.property = (document.getElementById("ee-prop") || { value: "" }).value || null;
    e.companyId = (document.getElementById("ee-co") || { value: "" }).value || null;
    closeModal();
    saveState();
    render();
  }
  function renderTenantDueDaySection(freq, payDay, payDayOfMonth) {
    if (freq === "monthly") {
      var opts = Array.from({ length: 28 }, function(_, i) {
        var s = i + 1;
        var sfx = [1, 21].includes(s) ? "st" : [2, 22].includes(s) ? "nd" : [3, 23].includes(s) ? "rd" : "th";
        return '<option value="' + s + '" ' + (payDayOfMonth === s ? "selected" : "") + ">" + s + sfx + " of month</option>";
      }).join("");
      return '<div class="field" style="margin:0"><label class="field-label">Due Date (monthly)</label><select class="inp" id="td-paydom">' + opts + "</select></div>";
    } else {
      var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      var opts = days.map(function(d) {
        return "<option " + (payDay === d ? "selected" : "") + ">" + d + "</option>";
      }).join("");
      return '<div class="field" style="margin:0"><label class="field-label">Due Day (weekly)</label><select class="inp" id="td-payday">' + opts + "</select></div>";
    }
  }
  function updateTenantDueDaySection() {
    var freqEl = document.getElementById("td-freq");
    var section = document.getElementById("td-due-day-section");
    if (!freqEl || !section) return;
    var freq = freqEl.value;
    var payDomEl = document.getElementById("td-paydom");
    var payDayEl = document.getElementById("td-payday");
    var currentDom = payDomEl ? +payDomEl.value : 1;
    var currentDay = payDayEl ? payDayEl.value : "Friday";
    section.innerHTML = renderTenantDueDaySection(freq, currentDay, currentDom);
  }
  function pdSetOwnership(val) {
    var isOwned = val === "owned";
    var radios = document.querySelectorAll('input[name="pd-ownership"]');
    radios.forEach(function(r) {
      r.checked = r.value === val;
    });
    var lblOwned = document.getElementById("pd-lbl-owned");
    var lblManaged = document.getElementById("pd-lbl-managed");
    if (lblOwned) {
      lblOwned.style.borderColor = isOwned ? "var(--accent)" : "var(--border)";
      lblOwned.style.background = isOwned ? "var(--accent-light)" : "var(--bg)";
    }
    if (lblManaged) {
      lblManaged.style.borderColor = !isOwned ? "var(--accent)" : "var(--border)";
      lblManaged.style.background = !isOwned ? "var(--accent-light)" : "var(--bg)";
    }
    var mortgageEl = document.getElementById("pd-mortgage-section");
    var purchaseEl = document.getElementById("pd-purchase-section");
    var landlordEl = document.getElementById("pd-landlord-section");
    var outLbl = document.getElementById("pd-outgoing-label");
    if (mortgageEl) mortgageEl.style.display = isOwned ? "block" : "none";
    if (purchaseEl) purchaseEl.style.display = isOwned ? "block" : "none";
    if (landlordEl) landlordEl.style.display = isOwned ? "none" : "block";
    if (outLbl) outLbl.textContent = isOwned ? "Mortgage Payment (\xA3/mo)" : "Landlord Rent (\xA3/mo)";
  }
  function pdSetLetting(val) {
    var isHmo = val === "hmo";
    var radios = document.querySelectorAll('input[name="pd-letting"]');
    radios.forEach(function(r) {
      r.checked = r.value === val;
    });
    var lblHmo = document.getElementById("pd-lbl-hmo");
    var lblWhole = document.getElementById("pd-lbl-whole");
    if (lblHmo) {
      lblHmo.style.borderColor = isHmo ? "var(--accent)" : "var(--border)";
      lblHmo.style.background = isHmo ? "var(--accent-light)" : "var(--bg)";
    }
    if (lblWhole) {
      lblWhole.style.borderColor = !isHmo ? "var(--accent)" : "var(--border)";
      lblWhole.style.background = !isHmo ? "var(--accent-light)" : "var(--bg)";
    }
    var roomsWrap = document.getElementById("pd-rooms-wrap");
    var bedroomsWrap = document.getElementById("pd-bedrooms-wrap");
    if (roomsWrap) roomsWrap.style.display = isHmo ? "block" : "none";
    if (bedroomsWrap) bedroomsWrap.style.display = isHmo ? "none" : "block";
  }
  function setPropOwnership(val) {
    var isOwned = val === "owned";
    var radios = document.querySelectorAll('input[name="f-ownership"]');
    radios.forEach(function(r) {
      r.checked = r.value === val;
    });
    var lblOwned = document.getElementById("lbl-owned");
    var lblManaged = document.getElementById("lbl-managed");
    if (lblOwned) {
      lblOwned.style.borderColor = isOwned ? "var(--accent)" : "var(--border)";
      lblOwned.style.background = isOwned ? "var(--accent-light)" : "var(--bg)";
    }
    if (lblManaged) {
      lblManaged.style.borderColor = !isOwned ? "var(--accent)" : "var(--border)";
      lblManaged.style.background = !isOwned ? "var(--accent-light)" : "var(--bg)";
    }
    var mortgageSection = document.getElementById("f-mortgage-section");
    var purchaseSection = document.getElementById("f-purchase-section");
    var landlordSection = document.getElementById("f-landlord-section");
    var outgoingLbl = document.getElementById("f-outgoing-label");
    var outgoingLblW = document.getElementById("f-outgoing-label-w");
    if (mortgageSection) mortgageSection.style.display = isOwned ? "block" : "none";
    if (purchaseSection) purchaseSection.style.display = isOwned ? "block" : "none";
    if (landlordSection) landlordSection.style.display = isOwned ? "none" : "block";
    var newLabel = isOwned ? "Mortgage Payment (\xA3/mo)" : "Landlord Rent (\xA3/mo)";
    if (outgoingLbl) outgoingLbl.textContent = newLabel;
    if (outgoingLblW) outgoingLblW.textContent = newLabel;
  }
  function setPropLetting(val) {
    var isHmo = val === "hmo";
    var radios = document.querySelectorAll('input[name="f-letting"]');
    radios.forEach(function(r) {
      r.checked = r.value === val;
    });
    var lblHmo = document.getElementById("lbl-hmo");
    var lblWhole = document.getElementById("lbl-whole");
    if (lblHmo) {
      lblHmo.style.borderColor = isHmo ? "var(--accent)" : "var(--border)";
      lblHmo.style.background = isHmo ? "var(--accent-light)" : "var(--bg)";
    }
    if (lblWhole) {
      lblWhole.style.borderColor = !isHmo ? "var(--accent)" : "var(--border)";
      lblWhole.style.background = !isHmo ? "var(--accent-light)" : "var(--bg)";
    }
    var hmoFields = document.getElementById("f-hmo-fields");
    var wholeFields = document.getElementById("f-whole-fields");
    if (hmoFields) hmoFields.style.display = isHmo ? "block" : "none";
    if (wholeFields) wholeFields.style.display = isHmo ? "none" : "block";
    var typeEl = document.getElementById("f-type");
    if (typeEl) typeEl.value = isHmo ? "HMO" : "Single Let";
  }
  function toggleNewLandlordFields() {
    var sel = document.getElementById("f-lname");
    var fields = document.getElementById("f-new-landlord-fields");
    if (!sel || !fields) return;
    fields.style.display = sel.value === "__new__" ? "block" : "none";
  }
  function refreshMaintRoomDropdown() {
    var propName = (document.getElementById("f-mprop") || {}).value;
    var roomSel = document.getElementById("f-mroom");
    if (!roomSel) return;
    roomSel.innerHTML = "";
    var communalOpt = document.createElement("option");
    communalOpt.value = "communal";
    communalOpt.textContent = "\u{1F3E0} Communal Area";
    roomSel.appendChild(communalOpt);
    var p = state.properties.find(function(x) {
      return x.name === propName;
    });
    if (p && p.roomList) {
      p.roomList.forEach(function(r) {
        var opt = document.createElement("option");
        opt.value = r.n;
        var ten = state.tenants.find(function(t) {
          return t.property === p.name && t.room === r.n && t.status !== "inactive";
        });
        opt.textContent = "Room " + r.n + " (" + (r.type || "Room") + ") " + (ten ? "\u2014 " + ten.name : "[Vacant]");
        roomSel.appendChild(opt);
      });
    }
    refreshMaintTenantInfo();
  }
  function refreshMaintTenantInfo() {
    var propName = (document.getElementById("f-mprop") || {}).value;
    var roomSel = document.getElementById("f-mroom");
    var roomVal = roomSel ? roomSel.value : "";
    var infoBox = document.getElementById("f-maint-tenant-info");
    var infoEl = document.getElementById("f-maint-tenant-detail");
    if (!infoBox || !infoEl) return;
    if (!roomVal || roomVal === "communal" || isNaN(+roomVal)) {
      infoBox.style.display = "none";
      return;
    }
    var t = state.tenants.find(function(x) {
      return x.property === propName && x.room === +roomVal && x.status !== "inactive";
    });
    if (!t) {
      infoBox.style.display = "none";
      return;
    }
    var phone = t.whatsapp ? "+" + t.whatsapp : "\u2014";
    infoEl.innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap"><div><span style="font-weight:600">\u{1F464}</span> ' + t.name + '</div><div><span style="font-weight:600">\u{1F4DE}</span> <a href="tel:+' + t.whatsapp + '" style="color:var(--blue)">' + phone + "</a></div>" + (t.whatsapp ? '<div><a href="https://wa.me/' + t.whatsapp + '" target="_blank" style="color:#25D366;font-weight:700">\u{1F4AC} WhatsApp</a></div>' : "") + "</div>";
    infoBox.style.display = "block";
  }
  function previewMaintModalPhoto(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById("f-mphoto-img").src = e.target.result;
      document.getElementById("f-mphoto-preview").style.display = "block";
    };
    reader.readAsDataURL(file);
  }
  function openModal(type) {
    const propOpts = state.properties.filter((p) => (p.roomList || []).some((r) => r.status === "vacant")).map((p) => {
      const vac = (p.roomList || []).filter((r) => r.status === "vacant").length;
      return `<option value="${p.name}">${p.name} (${vac} room${vac === 1 ? "" : "s"} free)</option>`;
    }).join("");
    const modals = {
      addProp: `
      <!-- \u2500\u2500 Step 1: Ownership & Letting Type \u2500\u2500 -->
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Property Classification</div>
        <div class="field" style="margin-bottom:12px">
          <label class="field-label">Ownership Type</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label id="lbl-owned" onclick="setPropOwnership('owned')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--accent);background:var(--accent-light);cursor:pointer">
              <input type="radio" name="f-ownership" value="owned" checked style="accent-color:var(--accent)">
              <div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">\u{1F3E0} Owned</div><div style="font-size:10px;color:var(--muted)">I own this property</div></div>
            </label>
            <label id="lbl-managed" onclick="setPropOwnership('managed')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--border);background:var(--bg);cursor:pointer">
              <input type="radio" name="f-ownership" value="managed" style="accent-color:var(--accent)">
              <div><div style="font-size:13px;font-weight:700;color:var(--text)">\u{1F91D} Managed</div><div style="font-size:10px;color:var(--muted)">I manage for a landlord</div></div>
            </label>
          </div>
        </div>
        <div class="field" style="margin:0">
          <label class="field-label">Letting Type</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label id="lbl-hmo" onclick="setPropLetting('hmo')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--accent);background:var(--accent-light);cursor:pointer">
              <input type="radio" name="f-letting" value="hmo" checked style="accent-color:var(--accent)">
              <div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">\u{1F3D8}\uFE0F HMO</div><div style="font-size:10px;color:var(--muted)">Rooms let individually</div></div>
            </label>
            <label id="lbl-whole" onclick="setPropLetting('whole')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--border);background:var(--bg);cursor:pointer">
              <input type="radio" name="f-letting" value="whole" style="accent-color:var(--accent)">
              <div><div style="font-size:13px;font-weight:700;color:var(--text)">\u{1F3E1} Whole Property</div><div style="font-size:10px;color:var(--muted)">Let to one household</div></div>
            </label>
          </div>
        </div>
      </div>

      <!-- \u2500\u2500 Step 2: Core details \u2500\u2500 -->
      <div class="field"><label class="field-label">Property Name *</label><input class="inp" id="f-name" placeholder="e.g. 15 Station Road"></div>
      <div class="row-2">
        <div class="field"><label class="field-label">Street Address</label><input class="inp" id="f-address" placeholder="e.g. 15 Station Road, Brixton"></div>
        <div class="field"><label class="field-label">Postcode</label><input class="inp" id="f-postcode" placeholder="e.g. SW9 8PS" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Area</label>
          <select class="inp" id="f-area"><option>Brixton</option><option>Clapham</option><option>Stockwell</option><option>Vauxhall</option><option>Kennington</option><option>Camberwell</option><option>Peckham</option><option>Dulwich</option><option>Streatham</option><option>Tooting</option><option>Balham</option><option>Norbury</option><option>Croydon</option><option>Thornton Heath</option><option>Norwood</option><option>Crystal Palace</option><option>Sydenham</option><option>Lewisham</option><option>Deptford</option><option>New Cross</option><option>Catford</option><option>Forest Hill</option><option>Lambeth</option><option>Wandsworth</option><option>Southwark</option><option>Bermondsey</option><option>Other</option></select>
        </div>
        <div class="field"><label class="field-label">Type</label>
          <select class="inp" id="f-type"><option>HMO</option><option>Single Let</option><option>Semi-Commercial</option><option>Other</option></select>
        </div>
      </div>

      <!-- \u2500\u2500 HMO fields (rooms) \u2500\u2500 -->
      <div id="f-hmo-fields">
        <div class="row-2">
          <div class="field"><label class="field-label">\u{1F6CF}\uFE0F Lettable Rooms</label><input class="inp" id="f-rooms" type="number" placeholder="6" min="1"></div>
          <div class="field"><label class="field-label" id="f-outgoing-label">Landlord Rent (\xA3/mo)</label><input class="inp" id="f-landlord" type="number" placeholder="3500"></div>
        </div>
      </div>

      <!-- \u2500\u2500 Whole property fields (bedrooms) \u2500\u2500 -->
      <div id="f-whole-fields" style="display:none">
        <div class="row-2">
          <div class="field">
            <label class="field-label">\u{1F6CF}\uFE0F Bedrooms</label>
            <select class="inp" id="f-bedrooms">
              <option value="1">1 bedroom</option>
              <option value="2">2 bedrooms</option>
              <option value="3" selected>3 bedrooms</option>
              <option value="4">4 bedrooms</option>
              <option value="5">5 bedrooms</option>
              <option value="6">6+ bedrooms</option>
            </select>
          </div>
          <div class="field"><label class="field-label" id="f-outgoing-label-w">Landlord Rent (\xA3/mo)</label><input class="inp" id="f-landlord-w" type="number" placeholder="1800"></div>
        </div>
        <div class="field">
          <label class="field-label">Monthly Rent (\xA3/mo)</label>
          <input class="inp" id="f-whole-rent" type="number" placeholder="e.g. 2200">
          <div style="font-size:11px;color:var(--muted);margin-top:4px">The rent charged to the tenant for the whole property</div>
        </div>
      </div>

      <!-- \u2500\u2500 Landlord section: shown for managed only \u2500\u2500 -->
      <div id="f-landlord-section">
        <div class="field"><label class="field-label">Landlord</label>
          <select class="inp" id="f-lname" onchange="toggleNewLandlordFields()">
            <option value="">\u2014 Select landlord \u2014</option>
            ${state.landlords.map((ll) => `<option value="${ll.name}">${ll.name}</option>`).join("")}
            <option value="__new__">\u2795 Add new landlord\u2026</option>
          </select>
        </div>
        <div id="f-new-landlord-fields" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:12px;margin-top:8px">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px">New Landlord Details</div>
          <div class="row-2">
            <div class="field"><label class="field-label">Name</label><input class="inp" id="f-newll-name" placeholder="Full name"></div>
            <div class="field"><label class="field-label">Phone</label><input class="inp" id="f-newll-phone" placeholder="07911000000"></div>
          </div>
          <div class="field"><label class="field-label">Email</label><input class="inp" id="f-newll-email" type="email" placeholder="landlord@email.com"></div>
        </div>
      </div>

      <!-- \u2500\u2500 Mortgage section: shown for owned only \u2500\u2500 -->
      <div id="f-mortgage-section" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">\u{1F3E6} Mortgage Details <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional \u2014 add now or later)</span></div>
        <div class="row-2">
          <div class="field"><label class="field-label">Lender</label><input class="inp" id="f-m-lender" placeholder="e.g. NatWest, Halifax"></div>
          <div class="field"><label class="field-label">Monthly Payment (\xA3)</label><input class="inp" id="f-m-payment" type="number" placeholder="900"></div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field-label">Interest Rate (%)</label><input class="inp" id="f-m-rate" type="number" step="0.01" placeholder="4.5"></div>
          <div class="field"><label class="field-label">Rate Type</label>
            <select class="inp" id="f-m-ratetype">
              <option value="fixed">Fixed</option>
              <option value="tracker">Tracker</option>
              <option value="svr">SVR</option>
              <option value="variable">Variable</option>
            </select>
          </div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field-label">Fix End Date</label><input class="inp" id="f-m-fixend" type="date"></div>
          <div class="field"><label class="field-label">Outstanding Balance (\xA3)</label><input class="inp" id="f-m-balance" type="number" placeholder="180000"></div>
        </div>
      </div>

      <!-- \u2500\u2500 Purchase info: shown for owned only \u2500\u2500 -->
      <div id="f-purchase-section" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">\u{1F4C8} Purchase & Value <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></div>
        <div class="row-2">
          <div class="field"><label class="field-label">Purchase Price (\xA3)</label><input class="inp" id="f-p-purchase" type="number" placeholder="280000"></div>
          <div class="field"><label class="field-label">Purchase Date</label><input class="inp" id="f-p-date" type="date"></div>
        </div>
        <div class="row-2">
          <div class="field"><label class="field-label">Current Est. Value (\xA3)</label><input class="inp" id="f-p-value" type="number" placeholder="320000"></div>
          <div class="field"><label class="field-label">Ownership Structure</label>
            <select class="inp" id="f-p-structure">
              <option value="sole">Sole</option>
              <option value="joint">Joint</option>
              <option value="ltd">Ltd Company</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div class="field"><label class="field-label">&#x1F3E2; Operating Company</label>
        <select class="inp" id="f-company">
          <option value="">\u2014 Unassigned \u2014</option>
          ${(state.companies || []).map((c) => '<option value="' + c.id + '">' + c.name + "</option>").join("")}
        </select>
      </div>`,
      addTenant: `
      <div class="field"><label class="field-label">Full Name</label><input class="inp" id="f-tname" placeholder="e.g. John Smith"></div>
      <div class="row-2">
        <div class="field"><label class="field-label">Property</label>
          <select class="inp" id="f-tprop" onchange="refreshRoomDropdown()">
            <option value="">Select property\u2026</option>${propOpts}
          </select>
        </div>
        <div class="field" id="f-troom-wrap"><label class="field-label">Room</label>
          <select class="inp" id="f-troom">
            <option value="">Select property first\u2026</option>
          </select>
        </div>
      </div>
      <div class="field" id="f-ttype-wrap">
        <label class="field-label">Room Type</label>
        <select class="inp" id="f-ttype">
          <option value="Single">\u{1F6CF}\uFE0F Single</option>
          <option value="Double">\u{1F6CF}\uFE0F\u{1F6CF}\uFE0F Double</option>
          <option value="Suite">\u2728 Suite</option>
          <option value="Studio">\u{1F3E0} Studio</option>
          <option value="Whole House">\u{1F3E1} Whole House</option>
        </select>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Rent (\xA3/wk) <span style="color:var(--red)">*</span></label>
          <input class="inp" id="f-trent" type="number" placeholder="220" required
            oninput="var d=document.getElementById('f-tdeposit');if(d&&!d.dataset.manual)d.value=(+this.value*2)||''">
        </div>
        <div class="field"><label class="field-label">Frequency</label>
          <select class="inp" id="f-tfreq" onchange="onFreqChange()">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      <div id="f-weekly-fields">
        <div class="field"><label class="field-label">\u{1F4C6} Payment Day (weekly)</label>
          <select class="inp" id="f-tpayday">
            <option>Monday</option><option>Tuesday</option><option>Wednesday</option>
            <option>Thursday</option><option selected>Friday</option><option>Saturday</option><option>Sunday</option>
          </select>
        </div>
      </div>
      <div id="f-monthly-fields" style="display:none">
        <div class="field"><label class="field-label">\u{1F4C6} Payment Date (monthly)</label>
          <select class="inp" id="f-tpaydom">
            ${Array.from({ length: 28 }, (_, i) => {
        const s = i + 1;
        const sfx = [1, 21].includes(s) ? "st" : [2, 22].includes(s) ? "nd" : [3, 23].includes(s) ? "rd" : "th";
        return `<option value="${s}">${s}${sfx} of each month</option>`;
      }).join("")}
          </select>
        </div>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">\u{1F4C5} Check-in Date <span style="color:var(--red)">*</span></label>
          <input class="inp" id="f-tstart" type="date" value="${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}" required>
        </div>
        <div class="field"><label class="field-label">Deposit (\xA3)</label>
          <input class="inp" id="f-tdeposit" type="number" placeholder="Auto: 2\xD7 rent" oninput="this.dataset.manual='1'">
        </div>
      </div>
      <div class="field"><label class="field-label">Payment Method</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--blue);background:var(--blue-light);cursor:pointer">
            <input type="radio" name="f-tmethod" value="bank" checked style="accent-color:var(--blue)">
            <div><div style="font-size:13px;font-weight:700;color:var(--blue)">\u{1F3E6} Bank</div><div style="font-size:10px;color:var(--muted)">Bank transfer</div></div>
          </label>
          <label id="cash-lbl" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid var(--border);background:var(--bg);cursor:pointer">
            <input type="radio" name="f-tmethod" value="cash" style="accent-color:var(--amber)">
            <div><div style="font-size:13px;font-weight:700;color:var(--amber)">\u{1F4B5} Cash</div><div style="font-size:10px;color:var(--muted)">Cash collection</div></div>
          </label>
        </div>
      </div>
      <div class="field">
        <label class="field-label">\u{1F4F1} WhatsApp Number <span style="color:var(--red)">*</span></label>
        <input class="inp" id="f-twa" type="tel" placeholder="e.g. 447911000000 or 351912345678" required>
        <div style="font-size:11px;color:var(--muted);margin-top:5px">Include country code \u2014 UK: 447911000000 \xB7 Portugal: 351912345678 \xB7 Brazil: 5511999990000</div>
      </div>`,
      addExpense: `
      <div class="field"><label class="field-label">Category</label>
        <select class="inp" id="f-ecat">
          <optgroup label="\u{1F3E0} Property Running Costs">
            <option value="Council Tax">\u{1F3DB}\uFE0F Council Tax</option>
            <option value="Energy \u2013 Gas">\u{1F525} Energy \u2013 Gas</option>
            <option value="Energy \u2013 Electric">\u26A1 Energy \u2013 Electric</option>
            <option value="Water">\u{1F4A7} Water</option>
            <option value="Internet / Broadband">\u{1F310} Internet / Broadband</option>
            <option value="Cleaning">\u{1F9F9} Cleaning</option>
            <option value="Maintenance & Repairs">\u{1F527} Maintenance & Repairs</option>
            <option value="Insurance">\u{1F6E1}\uFE0F Insurance</option>
            <option value="HMO Licence">\u{1F4CB} HMO Licence</option>
            <option value="Property Costs">\u{1F3E0} Other Property Cost</option>
          </optgroup>
          <optgroup label="\u{1F477} Staff & Labour">
            <option value="Staff & Labour">\u{1F477} Staff & Labour</option>
            <option value="Contractor">\u{1FA9B} Contractor</option>
          </optgroup>
          <optgroup label="\u2699\uFE0F Business Overhead">
            <option value="Software & Tools">\u{1F4BB} Software & Tools</option>
            <option value="Accountancy">\u{1F4CA} Accountancy</option>
            <option value="Legal">\u2696\uFE0F Legal</option>
            <option value="Overhead">\u2699\uFE0F Other Overhead</option>
          </optgroup>
        </select>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Property (optional)</label>
          <select class="inp" id="f-eprop">
            <option value="">\u2014 Portfolio-wide \u2014</option>
            ${(function() {
        return state.properties.map(function(p) {
          return '<option value="' + p.name + '">' + p.name + "</option>";
        }).join("");
      })()}
          </select>
        </div>
        <div class="field"><label class="field-label">\u{1F3E2} Company</label>
          <select class="inp" id="f-ecompany">
            <option value="">\u2014 Unassigned \u2014</option>
            ${(state.companies || []).map(function(c) {
        return '<option value="' + c.id + '">' + c.name + "</option>";
      }).join("")}
          </select>
        </div>
      </div>
      <div class="field"><label class="field-label">Description</label>
        <input class="inp" id="f-edesc" placeholder="e.g. Gas bill \u2014 19 Whiteley Road">
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Amount (\xA3)</label>
          <input class="inp" id="f-eamt" type="number" placeholder="250">
        </div>
        <div class="field"><label class="field-label">Status</label>
          <select class="inp" id="f-estat">
            <option value="estimated">Estimated</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Frequency</label>
          <select class="inp" id="f-efreq" onchange="document.getElementById('f-efreq-detail').style.display=this.value==='one-off'?'none':'block'">
            <option value="one-off">One-off</option>
            <option value="monthly">\u{1F504} Monthly (recurring)</option>
          </select>
        </div>
        <div class="field" id="f-efreq-detail" style="display:none"><label class="field-label">Start Date</label>
          <input class="inp" id="f-estart" type="date" value="${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}">
        </div>
      </div>`,
      addMaint: `
      <div class="field"><label class="field-label">Property</label>
        <select class="inp" id="f-mprop" onchange="refreshMaintRoomDropdown()">
          <option value="">Select property\u2026</option>
          ${state.properties.map(function(p) {
        return '<option value="' + p.name + '">' + p.name + "</option>";
      }).join("")}
        </select>
      </div>
      <div class="row-2">
        <div class="field"><label class="field-label">Location</label>
          <select class="inp" id="f-mroom" onchange="refreshMaintTenantInfo()">
            <option value="">Select property first\u2026</option>
          </select>
        </div>
        <div class="field"><label class="field-label">Priority</label>
          <select class="inp" id="f-mpri">
            <option value="urgent">\u{1F534} Urgent</option>
            <option value="high">\u{1F7E0} High</option>
            <option value="medium" selected>\u{1F7E1} Medium</option>
            <option value="low">\u{1F7E2} Low</option>
          </select>
        </div>
      </div>
      <div id="f-maint-tenant-info" style="display:none;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:9px;padding:10px 13px;margin-bottom:12px;font-size:12px">
        <div style="font-weight:700;color:var(--blue);margin-bottom:4px">\u{1F464} Tenant Details</div>
        <div id="f-maint-tenant-detail" style="color:var(--muted)"></div>
      </div>
      <div class="field"><label class="field-label">Issue Description</label>
        <textarea class="inp" id="f-missue" rows="3" placeholder="Describe the issue clearly\u2026 e.g. Boiler not working, no hot water since this morning" style="resize:vertical"></textarea>
      </div>
      <div class="field"><label class="field-label">Category</label>
        <select class="inp" id="f-mcat">
          <option>\u{1F527} Plumbing</option><option>\u26A1 Electrical</option><option>\u{1F525} Heating / Boiler</option>
          <option>\u{1FA9F} Windows / Doors</option><option>\u{1F4A7} Damp / Mould</option><option>\u{1F373} Kitchen</option>
          <option>\u{1F6BF} Bathroom</option><option>\u{1FAE7} Appliances</option>
          <option>\u{1F41B} Pest Control \u2013 Bed Bugs</option><option>\u{1FAB3} Pest Control \u2013 Cockroaches</option>
          <option>\u{1F42D} Pest Control \u2013 Mice</option><option>\u{1F400} Pest Control \u2013 Rats</option>
          <option>\u{1F528} General</option>
        </select>
      </div>
      <div class="field"><label class="field-label">\u{1F4F7} Photo (optional)</label>
        <input type="file" id="f-mphoto-input" accept="image/*" style="display:none" onchange="previewMaintModalPhoto(this)">
        <button onclick="document.getElementById('f-mphoto-input').click()" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px dashed var(--border);background:var(--bg);cursor:pointer;width:100%;font-family:inherit;text-align:left">
          <span style="font-size:20px">\u{1F4F7}</span>
          <div><div style="font-size:13px;font-weight:700;color:var(--muted)">Add Photo</div><div style="font-size:11px;color:var(--dim)">Helps identify the issue faster</div></div>
        </button>
        <div id="f-mphoto-preview" style="display:none;margin-top:8px;position:relative">
          <img id="f-mphoto-img" style="width:100%;max-height:180px;object-fit:cover;border-radius:9px">
          <button onclick="document.getElementById('f-mphoto-preview').style.display='none';document.getElementById('f-mphoto-input').value=''" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.55);border:none;color:#fff;border-radius:50%;width:24px;height:24px;font-size:12px;cursor:pointer">\u2715</button>
        </div>
      </div>
      <div class="field"><label class="field-label">Assign Contractor (optional)</label>
        <select class="inp" id="f-mcontractor">
          <option value="">\u2014 No contractor assigned \u2014</option>
          ${(state.contractors || []).map(function(c) {
        return '<option value="' + c.name + '">' + c.name + (c.trade ? " \xB7 " + c.trade : "") + (c.phone ? " (" + c.phone + ")" : "") + "</option>";
      }).join("")}
        </select>
      </div>
      <div class="field"><label class="field-label">Notes</label>
        <input class="inp" id="f-mnotes" placeholder="Any additional context, access details, best times to attend\u2026">
      </div>`
    };
    const titles = { addProp: "Add Property", addTenant: "Add Tenant", addExpense: "Add Expense", addMaint: "Log Maintenance Request" };
    const saveLabels = { addProp: "Add Property", addTenant: "Add Tenant", addExpense: "Add Expense", addMaint: "Log Request" };
    const saveType = { addProp: "prop", addTenant: "tenant", addExpense: "expense", addMaint: "maint" };
    document.getElementById("modal-container").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${titles[type]}</span>
          <button class="modal-close" onclick="closeModal()">\xD7</button>
        </div>
        <div class="modal-body">
          ${modals[type]}
          <div class="modal-footer">
            ${btn("Cancel", "closeModal()", "secondary")}
            ${btn(saveLabels[type], `saveModal('${saveType[type]}')`, "primary")}
          </div>
        </div>
      </div>
    </div>`;
  }
  function closeModal() {
    document.getElementById("modal-container").innerHTML = "";
  }
  var _tenantSearchTimer = null;
  function debouncedTenantSearch() {
    if (_tenantSearchTimer) clearTimeout(_tenantSearchTimer);
    _tenantSearchTimer = setTimeout(function() {
      if (state.page === "tenants") {
        document.getElementById("content").innerHTML = renderTenants();
        var inp = document.querySelector(".search-inp");
        if (inp) {
          var v = state.filters.tenantQ || "";
          inp.focus();
          inp.setSelectionRange(v.length, v.length);
        }
      }
    }, 250);
  }
  var _propSearchTimer = null;
  function debouncedPropSearch() {
    if (_propSearchTimer) clearTimeout(_propSearchTimer);
    _propSearchTimer = setTimeout(function() {
      if (state.page === "properties") {
        document.getElementById("content").innerHTML = renderProperties();
        var inp = document.querySelector(".search-inp");
        if (inp) {
          var v = state.filters.propQ || "";
          inp.focus();
          inp.setSelectionRange(v.length, v.length);
        }
      }
    }, 250);
  }
  function onFreqChange() {
    var freq = document.getElementById("f-tfreq");
    var wf = document.getElementById("f-weekly-fields");
    var mf = document.getElementById("f-monthly-fields");
    if (!freq) return;
    if (wf) wf.style.display = freq.value === "weekly" ? "block" : "none";
    if (mf) mf.style.display = freq.value === "monthly" ? "block" : "none";
  }
  function refreshRoomDropdown() {
    var propSel = document.getElementById("f-tprop");
    var roomSel = document.getElementById("f-troom");
    var roomWrap = document.getElementById("f-troom-wrap");
    var rentInp = document.getElementById("f-trent");
    var depInp = document.getElementById("f-tdeposit");
    var typeWrap = document.getElementById("f-ttype-wrap");
    if (!propSel || !roomSel) return;
    var propName = propSel.value;
    var p = state.properties.find(function(x) {
      return x.name === propName;
    });
    roomSel.innerHTML = "";
    if (!p || !propName) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Select property first\u2026";
      roomSel.appendChild(opt);
      return;
    }
    var isWhole = (p.lettingType || "hmo") === "whole";
    if (isWhole) {
      if (roomWrap) roomWrap.style.display = "none";
      if (typeWrap) typeWrap.style.display = "none";
      var opt = document.createElement("option");
      opt.value = "1";
      opt.textContent = "Whole property (" + (p.bedrooms || "?") + " bed)";
      roomSel.appendChild(opt);
      var existing = state.tenants.find(function(t) {
        return t.property === propName && t.status === "active";
      });
      if (existing) {
        roomSel.innerHTML = "";
        var opt2 = document.createElement("option");
        opt2.value = "";
        opt2.textContent = "Already occupied by " + existing.name;
        roomSel.appendChild(opt2);
      }
      return;
    }
    if (roomWrap) roomWrap.style.display = "";
    if (typeWrap) typeWrap.style.display = "";
    if (!p.roomList) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No rooms set up";
      roomSel.appendChild(opt);
      return;
    }
    var vacRooms = p.roomList.filter(function(r) {
      return r.status === "vacant";
    });
    if (!vacRooms.length) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No vacant rooms";
      roomSel.appendChild(opt);
      return;
    }
    vacRooms.forEach(function(r) {
      var opt3 = document.createElement("option");
      opt3.value = r.n;
      opt3.textContent = "Room " + r.n + " (" + (r.type || "Room") + ") \u2014 \xA3" + r.price + "/wk";
      opt3.setAttribute("data-price", r.price);
      roomSel.appendChild(opt3);
    });
    if (rentInp && vacRooms.length) {
      rentInp.value = +vacRooms[0].price;
      if (depInp && !depInp.dataset.manual) depInp.value = +vacRooms[0].price * 2;
    }
    roomSel.onchange = function() {
      var sel = roomSel.options[roomSel.selectedIndex];
      var price = sel ? sel.getAttribute("data-price") : null;
      if (price && rentInp) {
        rentInp.value = +price;
        if (depInp && !depInp.dataset.manual) depInp.value = +price * 2;
      }
    };
  }
  function saveModal(type) {
    if (type === "prop") {
      var fname = document.getElementById("f-name").value.trim();
      if (!fname) {
        alert("Please enter a property name.");
        return;
      }
      var ownershipEl = document.querySelector('input[name="f-ownership"]:checked');
      var lettingEl = document.querySelector('input[name="f-letting"]:checked');
      var ownershipType = ownershipEl ? ownershipEl.value : "managed";
      var lettingType = lettingEl ? lettingEl.value : "hmo";
      var isOwned = ownershipType === "owned";
      var isWhole = lettingType === "whole";
      var faddr = document.getElementById("f-address").value.trim();
      var fpost = document.getElementById("f-postcode").value.trim().toUpperCase();
      var fullAddr = faddr + (fpost ? ", " + fpost : "");
      var mapsUrl = fpost ? "https://maps.google.com/?q=" + encodeURIComponent(fullAddr) : "";
      var frooms = 0;
      var fbedrooms = 0;
      if (isWhole) {
        fbedrooms = +(document.getElementById("f-bedrooms") || { value: 3 }).value || 3;
        frooms = 1;
      } else {
        frooms = +document.getElementById("f-rooms").value || 0;
      }
      var landlordRent = 0;
      if (isWhole) {
        landlordRent = +(document.getElementById("f-landlord-w") || { value: 0 }).value || 0;
      } else {
        landlordRent = +(document.getElementById("f-landlord") || { value: 0 }).value || 0;
      }
      var wholeRent = isWhole ? +(document.getElementById("f-whole-rent") || { value: 0 }).value || 0 : 0;
      var llName = "";
      if (!isOwned) {
        var llSel = document.getElementById("f-lname") ? document.getElementById("f-lname").value : "";
        if (llSel === "__new__") {
          llName = (document.getElementById("f-newll-name") || { value: "" }).value.trim();
          if (llName) {
            state.landlords = state.landlords || [];
            state.landlords.push({
              id: crypto.randomUUID(),
              name: llName,
              phone: (document.getElementById("f-newll-phone") || { value: "" }).value.trim(),
              email: (document.getElementById("f-newll-email") || { value: "" }).value.trim(),
              bank: "",
              sortCode: "",
              accountNo: "",
              notes: "",
              properties: []
            });
          }
        } else {
          llName = llSel || "";
        }
      }
      var mortgage = null;
      if (isOwned) {
        var mLender = (document.getElementById("f-m-lender") || { value: "" }).value.trim();
        var mPayment = +(document.getElementById("f-m-payment") || { value: 0 }).value || 0;
        var mRate = +(document.getElementById("f-m-rate") || { value: 0 }).value || 0;
        var mRateType = (document.getElementById("f-m-ratetype") || { value: "fixed" }).value;
        var mFixEnd = (document.getElementById("f-m-fixend") || { value: "" }).value || null;
        var mBalance = +(document.getElementById("f-m-balance") || { value: 0 }).value || 0;
        if (mLender || mPayment || mBalance) {
          mortgage = { lender: mLender, monthlyPayment: mPayment, rate: mRate, rateType: mRateType, fixEndDate: mFixEnd, outstandingBalance: mBalance };
          if (!landlordRent && mPayment) landlordRent = mPayment;
        }
      }
      var purchaseInfo = null;
      if (isOwned) {
        var pPrice = +(document.getElementById("f-p-purchase") || { value: 0 }).value || 0;
        var pDate = (document.getElementById("f-p-date") || { value: "" }).value || null;
        var pValue = +(document.getElementById("f-p-value") || { value: 0 }).value || 0;
        var pStructure = (document.getElementById("f-p-structure") || { value: "sole" }).value;
        if (pPrice || pValue) {
          purchaseInfo = { purchasePrice: pPrice, purchaseDate: pDate, estimatedValue: pValue, ownershipStructure: pStructure };
        }
      }
      var roomList = [];
      if (isWhole) {
        roomList.push({ n: 1, type: "Whole Property", price: wholeRent ? Math.round(wholeRent * 12 / 52) : 0, status: "vacant", isWholeProperty: true });
      } else {
        for (var ri = 1; ri <= frooms; ri++) {
          roomList.push({ n: ri, type: "Single", price: 200, status: "vacant" });
        }
      }
      var newProp = {
        id: crypto.randomUUID(),
        name: fname,
        address: fullAddr,
        postcode: fpost,
        area: document.getElementById("f-area").value,
        type: document.getElementById("f-type").value,
        ownershipType,
        lettingType,
        bedrooms: isWhole ? fbedrooms : null,
        rooms: frooms,
        occupied: 0,
        rent: isWhole ? wholeRent : 0,
        landlord: landlordRent,
        landlordName: llName,
        mapsUrl,
        roomList,
        notes: "",
        companyId: (document.getElementById("f-company") || { value: "" }).value,
        mortgage: mortgage || null,
        purchaseInfo: purchaseInfo || null
      };
      state.properties.push(newProp);
    } else if (type === "tenant") {
      var g = function(id) {
        var el = document.getElementById(id);
        return el ? el.value : null;
      };
      var name = g("f-tname");
      if (!name || !name.trim()) return;
      var startDateVal = g("f-tstart");
      if (!startDateVal) {
        alert("Please enter a check-in date \u2014 this field is required.");
        return;
      }
      var waFull = (g("f-twa") || "").trim().replace(/\s+/g, "").replace(/^\+/, "");
      var freq = g("f-tfreq") || "weekly";
      var payDay = freq === "weekly" ? g("f-tpayday") || "Friday" : null;
      var payDom = freq === "monthly" ? +(g("f-tpaydom") || 1) : null;
      var startDate = g("f-tstart") || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      var methodEl = document.querySelector('input[name="f-tmethod"]:checked');
      var method = methodEl ? methodEl.value : "bank";
      var rentVal = +(g("f-trent") || 0);
      var deposit = +(g("f-tdeposit") || 0) || rentVal * 2;
      var propName = g("f-tprop") || "";
      var propObj = state.properties.find(function(x) {
        return x.name === propName;
      });
      var isWholeProp = propObj && (propObj.lettingType || "hmo") === "whole";
      var roomN = isWholeProp ? 1 : +(g("f-troom") || 1);
      var roomType = isWholeProp ? "Whole Property" : g("f-ttype") || "Single";
      if (!propName) {
        alert("Please select a property.");
        return;
      }
      if (!isWholeProp && !roomN) {
        alert("Please select a room.");
        return;
      }
      if (!waFull || waFull.length < 10) {
        alert("Please enter a valid WhatsApp number (include country code e.g. 447911000000).");
        return;
      }
      if (!rentVal || rentVal <= 0) {
        alert("Please enter a valid rent amount.");
        return;
      }
      if (isWholeProp) {
        var wholeTaken = state.tenants.find(function(t) {
          return t.property === propName && t.status === "active";
        });
        if (wholeTaken) {
          alert("\u26A0\uFE0F " + propName + " already has an active tenant (" + wholeTaken.name + ").\nMark them as inactive before adding a new one.");
          return;
        }
      } else {
        var roomTaken = state.tenants.find(function(t) {
          return t.property === propName && t.room === roomN && t.status !== "inactive";
        });
        if (roomTaken) {
          alert("\u26A0\uFE0F Room " + roomN + " at " + propName + " is already occupied by " + roomTaken.name + ".\nPlease select a different room.");
          return;
        }
      }
      if (propObj && propObj.roomList) {
        var rm = propObj.roomList.find(function(r) {
          return r.n === roomN;
        });
        if (rm) rm.type = roomType;
      }
      state.tenants.push({
        id: crypto.randomUUID(),
        name: name.trim(),
        property: propName,
        room: roomN,
        roomType,
        rent: rentVal,
        freq,
        payDay,
        payDayOfMonth: payDom,
        method,
        status: "active",
        paid: "\u2014",
        arrears: 0,
        whatsapp: waFull,
        deposit,
        depositStatus: "held",
        moveIn: startDate,
        startDate,
        noticeDate: null,
        moveOutDate: null,
        email: "",
        paymentHistory: []
      });
      occupyRoom(propName, roomN, rentVal);
      rebuildAllSchedules();
    } else if (type === "expense") {
      const desc = document.getElementById("f-edesc").value;
      if (!desc) {
        alert("Please enter a description.");
        return;
      }
      const cat = document.getElementById("f-ecat").value;
      const amt = +document.getElementById("f-eamt").value || 0;
      if (amt <= 0) {
        alert("Please enter an amount.");
        return;
      }
      const freq2 = document.getElementById("f-efreq").value;
      const estart = document.getElementById("f-estart") ? document.getElementById("f-estart").value : "";
      const eprop = document.getElementById("f-eprop").value;
      const staffCats = ["Staff & Labour", "Contractor"];
      const propCats = ["Council Tax", "Energy \u2013 Gas", "Energy \u2013 Electric", "Water", "Internet / Broadband", "Cleaning", "Maintenance & Repairs", "Insurance", "HMO Licence", "Property Costs"];
      const etype = staffCats.includes(cat) ? "staff" : propCats.includes(cat) ? "property" : "overhead";
      var ecompany = (document.getElementById("f-ecompany") || { value: "" }).value;
      state.expenses.push({
        id: crypto.randomUUID(),
        cat,
        desc,
        amount: amt,
        type: etype,
        status: document.getElementById("f-estat").value,
        freq: freq2,
        startDate: estart || null,
        property: eprop || null,
        companyId: ecompany || null,
        recurring: freq2 !== "one-off"
      });
    } else if (type === "maint") {
      var mprop = document.getElementById("f-mprop").value;
      var missue = document.getElementById("f-missue").value;
      if (!mprop || !missue) {
        alert("Please select a property and describe the issue.");
        return;
      }
      var mroomSel = document.getElementById("f-mroom");
      var mroomVal = mroomSel ? mroomSel.value : "";
      var isRoom = mroomVal && !isNaN(+mroomVal);
      var mroom = isRoom ? +mroomVal : 0;
      var mlocation = mroomVal || "Communal Area";
      var mtenant = "";
      if (isRoom) {
        var mten = state.tenants.find(function(t) {
          return t.property === mprop && t.room === mroom && t.status !== "inactive";
        });
        if (mten) mtenant = mten.name;
      }
      var mphotoEl = document.getElementById("f-mphoto-img");
      var mphoto = mphotoEl && mphotoEl.src && mphotoEl.src.startsWith("data:") ? mphotoEl.src : null;
      var mnodesEl = document.getElementById("f-mnotes");
      var mcontEl = document.getElementById("f-mcontractor");
      state.maintenance.push({
        id: crypto.randomUUID(),
        property: mprop,
        room: mroom,
        location: mlocation,
        tenant: mtenant,
        issue: missue,
        priority: document.getElementById("f-mpri").value,
        cat: document.getElementById("f-mcat").value,
        status: "open",
        date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        photo: mphoto,
        notes: mnodesEl ? mnodesEl.value : "",
        contractor: mcontEl ? mcontEl.value : ""
      });
    }
    saveState();
    closeModal();
    render();
  }
  async function openTenantDetail(id) {
    var t = state.tenants.find(function(x) {
      return x.id === id;
    });
    if (!t) return;
    state.tenantDetailTab = state.tenantDetailTab || "profile";
    var tab = state.tenantDetailTab;
    var hist = (t.paymentHistory || []).slice();
    (state.payments || []).forEach(function(p) {
      if (p.tenant === t.name && p.status === "paid") {
        var already = hist.some(function(h) {
          return h.date === p.paidDate && h.amount === p.amount;
        });
        if (!already) hist.push({
          amount: p.amount,
          date: p.paidDate || p.date || "",
          method: p.method || "bank",
          status: "paid",
          _partial: p._partial || false,
          _shortfall: p._shortfall || 0
        });
      }
    });
    hist.sort(function(a, b) {
      return new Date(b.date.split(" ").reverse().join(" ") || 0) - new Date(a.date.split(" ").reverse().join(" ") || 0);
    });
    var profileTab = '<div class="field"><label class="field-label">Full Name</label><input class="inp" id="td-name" value="' + t.name + '"></div><div class="field"><label class="field-label">Email</label><input class="inp" id="td-email" type="email" value="' + (t.email || "") + '"></div><div class="field"><label class="field-label">\u{1F4F1} WhatsApp</label><input class="inp" id="td-wa" type="tel" value="' + (t.whatsapp || "") + '" placeholder="447911000000"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">Check-in Date</label><input class="inp" id="td-movein" type="date" value="' + (t.startDate || t.moveIn || "") + '"></div><div class="field"><label class="field-label">Status</label><select class="inp" id="td-status"><option value="active" ' + (t.status === "active" ? "selected" : "") + '>Active</option><option value="notice_given" ' + (t.status === "notice_given" ? "selected" : "") + '>On Notice</option><option value="inactive" ' + (t.status === "inactive" ? "selected" : "") + ">Moved Out</option></select></div></div>";
    var financialsTab = (function() {
      var isMonthly = t.freq === "monthly";
      var payDomOpts = Array.from({ length: 28 }, function(_, i) {
        var s = i + 1;
        var sfx = [1, 21].includes(s) ? "st" : [2, 22].includes(s) ? "nd" : [3, 23].includes(s) ? "rd" : "th";
        return '<option value="' + s + '" ' + (t.payDayOfMonth === s ? "selected" : "") + ">" + s + sfx + " of month</option>";
      }).join("");
      var payDayOpts = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(function(d) {
        return "<option " + (t.payDay === d ? "selected" : "") + ">" + d + "</option>";
      }).join("");
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px"><div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--green);font-family:monospace">' + fmt(t.rent) + '</div><div style="font-size:11px;color:var(--muted)">per ' + (isMonthly ? "month" : "week") + '</div></div><div style="background:' + (t.arrears > 0 ? "var(--red-light)" : "var(--bg)") + ";border:1px solid " + (t.arrears > 0 ? "#FECDD3" : "var(--border)") + ';border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:' + (t.arrears > 0 ? "var(--red)" : "var(--muted)") + ';font-family:monospace">' + fmt(t.arrears || 0) + '</div><div style="font-size:11px;color:var(--muted)">arrears</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">' + (isMonthly ? "Monthly" : "Weekly") + ' Rent (\xA3)</label><input class="inp" id="td-rent" type="number" value="' + (t.rent || 0) + '"></div><div class="field"><label class="field-label">Arrears (\xA3)</label><input class="inp" id="td-arrears" type="number" value="' + (t.arrears || 0) + '"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">Deposit (\xA3)</label><input class="inp" id="td-deposit" type="number" value="' + (t.deposit || 0) + '"></div><div class="field"><label class="field-label">Deposit Status</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px"><div class="field"><label class="field-label">Deposit Scheme</label><select class="inp" id="td-depositScheme">' + ["DPS", "MyDeposits", "TDS", "None"].map(function(s) {
        return '<option value="' + s + '" ' + (t.depositScheme === s ? "selected" : "") + ">" + s + "</option>";
      }).join("") + '</select></div><div class="field"><label class="field-label">Deposit Reference</label><input class="inp" id="td-depositRef" value="' + (t.depositRef || "").replace(/"/g, "&quot;") + '" placeholder="e.g. DPS-12345678"></div></div><select class="inp" id="td-depositStatus"><option value="held" ' + (t.depositStatus === "held" ? "selected" : "") + '>Held</option><option value="returned" ' + (t.depositStatus === "returned" ? "selected" : "") + ">Returned</option></select></div></div>" + (t.status === "inactive" ? (function() {
        var prevs = t.previousTenancies || [];
        if (!prevs.length && t.property) {
          prevs = [{ property: t.property, room: t.room, moveIn: t.startDate || t.moveIn, moveOut: t.moveOutDate, rent: t.rent, freq: t.freq }];
        }
        if (!prevs.length) return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;text-align:center;color:var(--dim);font-size:12px">No tenancy history recorded</div>';
        return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">\u{1F4CB} Tenancy History</div>' + prevs.slice().reverse().map(function(pt, idx) {
          var moveIn = pt.moveIn ? new Date(pt.moveIn).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014";
          var moveOut = pt.moveOut ? new Date(pt.moveOut).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "\u2014";
          var isMonthly2 = pt.freq === "monthly";
          return '<div style="padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:9px;margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font-size:13px;font-weight:700">' + (pt.property || "Unknown property") + "</div>" + (idx === 0 ? '<span style="font-size:10px;padding:2px 7px;border-radius:5px;background:var(--border);color:var(--muted);font-weight:600">Most recent</span>' : "") + '</div><div style="font-size:12px;color:var(--muted)">' + (pt.room ? "Room " + pt.room + " \xB7 " : "") + "\xA3" + (pt.rent || 0) + "/" + (isMonthly2 ? "mo" : "wk") + '</div><div style="font-size:11px;color:var(--dim);margin-top:4px">' + moveIn + " \u2192 " + moveOut + "</div></div>";
        }).join("") + "</div>";
      })() : '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">\u{1F3E0} Property & Room</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field" style="margin:0"><label class="field-label">Property</label><select class="inp" id="td-prop">' + state.properties.map(function(p) {
        return '<option value="' + p.name + '" ' + (t.property === p.name ? "selected" : "") + ">" + p.name + "</option>";
      }).join("") + "</select></div>" + (function() {
        var rp = state.properties.find(function(x) {
          return x.name === t.property;
        });
        if (!rp || !rp.roomList) return '<div class="field" style="margin:0"><label class="field-label">Room No.</label><input class="inp" id="td-room" type="number" value="' + (t.room || 1) + '"></div>';
        var opts = rp.roomList.map(function(r) {
          var linked = state.tenants.find(function(tt) {
            return tt.property === rp.name && tt.room === r.n && tt.status !== "inactive" && tt.id !== t.id;
          });
          var isCurr = r.n === t.room;
          var dis = r.status === "unavailable" || linked && !isCurr ? "disabled" : "";
          var lbl = "Rm " + r.n + " (" + (r.type || "Room") + ") \xA3" + r.price + "/wk" + (isCurr ? " \u2713" : "") + (linked && !isCurr ? " (taken)" : "");
          return '<option value="' + r.n + '" ' + (isCurr ? "selected" : "") + " " + dis + ">" + lbl + "</option>";
        }).join("");
        return '<div class="field" style="margin:0"><label class="field-label">Room</label><select class="inp" id="td-room">' + opts + "</select></div>";
      })() + "</div></div>" + (function() {
        var rp2 = state.properties.find(function(x) {
          return x.name === t.property;
        });
        var rm2 = rp2 && rp2.roomList ? rp2.roomList.find(function(r) {
          return r.n === t.room;
        }) : null;
        var curType = rm2 ? rm2.type : t.roomType || "Single";
        return '<div class="field" style="margin-bottom:12px"><label class="field-label">Room Type</label><select class="inp" id="td-roomtype">' + ["Single", "Double", "Suite", "Studio", "Whole House"].map(function(ty) {
          var icons = { "Single": "\u{1F6CF}\uFE0F ", "Double": "\u{1F6CF}\uFE0F\u{1F6CF}\uFE0F ", "Suite": "\u2728 ", "Studio": "\u{1F3E0} ", "Whole House": "\u{1F3E1} " };
          return '<option value="' + ty + '" ' + (curType === ty ? "selected" : "") + ">" + icons[ty] + ty + "</option>";
        }).join("") + "</select></div>";
      })()) + '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px"><div style="font-size:11px;font-weight:700;color:var(--accent-dark);margin-bottom:12px">\u{1F4C5} PAYMENT COLLECTION</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px"><div class="field" style="margin:0"><label class="field-label">Payment Method</label><select class="inp" id="td-method"><option value="bank" ' + (t.method === "bank" ? "selected" : "") + '>Bank Transfer</option><option value="cash" ' + (t.method === "cash" ? "selected" : "") + '>Cash</option></select></div><div class="field" style="margin:0"><label class="field-label">Frequency</label><select class="inp" id="td-freq" onchange="updateTenantDueDaySection()"><option value="weekly" ' + (t.freq === "weekly" ? "selected" : "") + '>Weekly</option><option value="monthly" ' + (t.freq === "monthly" ? "selected" : "") + '>Monthly</option></select></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div id="td-due-day-section">' + (isMonthly ? '<div class="field" style="margin:0"><label class="field-label">Due Date (monthly)</label><select class="inp" id="td-paydom">' + payDomOpts + "</select></div>" : '<div class="field" style="margin:0"><label class="field-label">Due Day (weekly)</label><select class="inp" id="td-payday">' + payDayOpts + "</select></div>") + "</div></div></div>";
    })();
    var histTab = '<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:700">Payment History</div><div style="font-size:11px;color:var(--muted)">' + hist.length + ' records</div></div><div style="display:flex;flex-direction:column;gap:6px">' + hist.map(function(h) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px"><div><div style="font-size:13px;font-weight:600">' + fmt(h.amount) + '</div><div style="font-size:11px;color:var(--muted)">' + h.date + '</div></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--muted)">' + (h.method === "bank" ? "\u{1F3E6} Bank" : "\u{1F4B5} Cash") + '</span><span style="font-size:11px;font-weight:700;color:' + (h.status === "paid" ? "var(--green)" : "var(--red)") + '">' + h.status + "</span></div></div>";
    }).join("") + "</div>";
    var waBase = t.whatsapp ? "https://wa.me/" + t.whatsapp.replace(/\D/g, "") + "?text=" : "";
    var firstName = t.name.split(" ")[0];
    var actionsTab = '<div style="display:flex;flex-direction:column;gap:12px">';
    if (waBase) {
      actionsTab += '<div style="background:var(--wa-light);border:1px solid #BBF7D0;border-radius:12px;padding:16px"><div style="font-size:13px;font-weight:700;color:var(--wa);margin-bottom:10px">\u{1F4AC} WhatsApp Messages</div><div style="display:flex;flex-direction:column;gap:6px"><a href="' + waBase + encodeURIComponent("Hi " + firstName + ", your rent of \xA3" + t.rent + " is due. Please arrange payment. Thank you.") + '" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #BBF7D0;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">\u{1F4AC}</span><div><div style="font-size:13px;font-weight:600">Rent Reminder</div><div style="font-size:11px;color:var(--muted)">Gentle reminder about upcoming rent</div></div></a>' + (t.arrears > 0 ? '<a href="' + waBase + encodeURIComponent("Hi " + firstName + ", you have arrears of \xA3" + t.arrears + ". Please contact us urgently.") + '" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #FECDD3;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">\u26A0\uFE0F</span><div><div style="font-size:13px;font-weight:600">Chase Arrears</div><div style="font-size:11px;color:var(--muted)">\xA3' + t.arrears + " outstanding</div></div></a>" : "") + '<a href="' + waBase + waBase.split("?")[0].replace("https://wa.me/" + t.whatsapp.replace(/\D/g, "") + "?text=", "") + '" target="_blank" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#fff;border:1px solid #BBF7D0;border-radius:9px;text-decoration:none;color:var(--text)"><span style="font-size:18px">\u{1F4AC}</span><div><div style="font-size:13px;font-weight:600">Open Chat</div><div style="font-size:11px;color:var(--muted)">Open WhatsApp directly</div></div></a></div></div>';
    }
    actionsTab += `<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:16px"><div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:10px">\u{1F4C4} Legal Documents</div><div style="display:flex;flex-direction:column;gap:8px"><button onclick="generateExcludedLicence('` + t.id + `')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #BFDBFE;border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%"><span style="font-size:18px">\u{1F4CB}</span><div><div style="font-size:13px;font-weight:600;color:var(--blue)">Excluded Licence Agreement</div><div style="font-size:11px;color:var(--muted)">Standard company document \xB7 1 week notice</div></div></button><button onclick="generateAgreement('` + t.id + `')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #BFDBFE;border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%"><span style="font-size:18px">\u{1F4C4}</span><div><div style="font-size:13px;font-weight:600;color:var(--blue)">AST Agreement</div><div style="font-size:11px;color:var(--muted)">Assured Shorthold Tenancy</div></div></button></div></div>`;
    var passwords = JSON.parse(localStorage.getItem("pm_tenant_passwords") || "{}");
    if (t.email && !passwords[t.id]) {
      passwords[t.id] = btoa(PORTAL_PASSWORD);
      localStorage.setItem("pm_tenant_passwords", JSON.stringify(passwords));
    }
    ensurePortalCredentials(t);
    var hasPortal = true;
    var portalUrl = window.location.href.replace("index.html", "").replace(/[^/]*$/, "") + "tenant-portal.html";
    var portalWaMsg = encodeURIComponent(
      "Hi " + t.name.split(" ")[0] + ", your tenant portal is now active!\n\n\u{1F310} *Tenant Portal Link:*\n" + portalUrl + "\n\n\u{1F464} *Username:* " + getPortalUsername(t) + "\n\u{1F511} *Password:* " + getPortalPassword(t) + "\n\nYou can view your payments, report maintenance issues, upload documents and more.\n\n\u{1F3E0} Reservations Direct Limited"
    );
    var waLink2 = t.whatsapp ? "https://wa.me/" + t.whatsapp + "?text=" + portalWaMsg : "";
    actionsTab += '<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px"><div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px">\u{1F310} Tenant Portal</div><div style="background:#fff;border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Login Details</div><div style="font-size:12px;margin-bottom:4px">\u{1F464} <strong>Username:</strong> <span style="font-family:monospace;background:var(--bg);padding:2px 7px;border-radius:4px">' + getPortalUsername(t) + '</span></div><div style="font-size:12px;margin-bottom:4px">\u{1F511} <strong>Password:</strong> <span style="font-family:monospace;background:var(--bg);padding:2px 7px;border-radius:4px">' + getPortalPassword(t) + `</span> <button onclick="resetPortalPassword('` + id + `')" style="font-size:10px;padding:2px 8px;border-radius:5px;border:1px solid var(--border);background:var(--bg);cursor:pointer;font-family:inherit;margin-left:6px">\u21BB New</button></div>` + (t.email ? '<div style="font-size:12px;margin-bottom:4px">\u{1F4E7} <strong>Email:</strong> ' + t.email + "</div>" : "") + '<div style="font-size:12px">\u{1F517} <strong>URL:</strong> <a href="' + portalUrl + '" target="_blank" style="color:var(--blue)">Open Portal \u2197</a></div></div><div style="display:flex;gap:8px">' + (t.whatsapp ? '<a href="' + waLink2 + '" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:9px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;text-decoration:none">\u{1F4AC} Share via WhatsApp</a>' : '<button disabled style="flex:1;padding:10px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--dim);font-size:13px;font-weight:600;cursor:not-allowed;font-family:inherit">\u{1F4AC} Add WhatsApp to share</button>') + '<a href="' + portalUrl + '" target="_blank" style="padding:10px 12px;border-radius:9px;border:1px solid #BFDBFE;background:var(--blue-light);color:var(--blue);font-size:12px;font-weight:700;text-decoration:none;display:flex;align-items:center">Open \u2197</a></div></div>';
    var noticeColor = t.status === "notice_given" ? "var(--amber)" : "var(--text)";
    var noticeBg = t.status === "notice_given" ? "var(--amber-light)" : "var(--bg)";
    var noticeBorder = t.status === "notice_given" ? "#FDE68A" : "var(--border)";
    var countdownHtml = "";
    if (t.status === "notice_given" && t.moveOutDate) {
      var daysLeft = Math.ceil((new Date(t.moveOutDate) - TODAY) / 864e5);
      var countColor = daysLeft <= 7 ? "var(--red)" : daysLeft <= 14 ? "var(--amber)" : "var(--green)";
      countdownHtml = '<div style="margin-top:12px;padding:12px;background:#fff;border-radius:9px;border:1px solid ' + noticeBorder + ';text-align:center"><div style="font-size:28px;font-weight:800;color:' + countColor + ';font-family:monospace">' + (daysLeft > 0 ? daysLeft + "d" : "Today") + '</div><div style="font-size:11px;color:var(--muted);margin-top:2px">' + (daysLeft > 0 ? "days until check-out" : "Move-out day") + '</div><div style="font-size:11px;font-weight:600;color:var(--muted);margin-top:4px">Move-out: ' + new Date(t.moveOutDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) + "</div></div>";
    }
    actionsTab += '<div style="background:' + noticeBg + ";border:1px solid " + noticeBorder + ';border-radius:12px;padding:16px"><div style="font-size:13px;font-weight:700;color:' + noticeColor + ';margin-bottom:10px">' + (t.status === "notice_given" ? "\u26A0\uFE0F On Notice" : "\u{1F4CB} Give Notice") + "</div>" + countdownHtml + (t.status === "notice_given" ? `<button onclick="cancelTenantNotice('` + t.id + `')" style="margin-top:10px;width:100%;padding:9px;border-radius:9px;border:1px solid #FDE68A;background:#fff;color:var(--amber);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel Notice</button>` : '<div style="margin-top:10px"><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Move-out Date</label><input type="date" id="notice-moveout-' + t.id + '" class="inp" style="margin:6px 0 10px" min="' + (/* @__PURE__ */ new Date("2026-03-21")).toISOString().split("T")[0] + `"><button onclick="giveTenantNotice('` + t.id + `')" style="width:100%;padding:9px;border-radius:9px;border:none;background:var(--amber);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Give Notice</button></div>`) + "</div>";
    var availRooms = [];
    state.properties.forEach(function(ap) {
      (ap.roomList || []).forEach(function(ar) {
        if (ar.status === "vacant") availRooms.push({ propName: ap.name, propId: ap.id, room: ar.n, type: ar.type || "Room", price: ar.price });
      });
    });
    var moveRoomHtml = availRooms.length === 0 ? '<div style="font-size:12px;color:var(--muted);padding:8px 0">No vacant rooms available</div>' : '<div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto">' + availRooms.map(function(vr) {
      return '<button id="mvr_' + t.id + "_" + vr.propId + "_" + vr.room + '" onclick="doMoveRoom(this)" data-tid="' + t.id + '" data-pid="' + vr.propId + '" data-pname="' + encodeURIComponent(vr.propName) + '" data-room="' + vr.room + '" data-price="' + vr.price + '" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:#fff;border:1px solid var(--border);border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%;margin-bottom:3px"><div><div style="font-size:12px;font-weight:600">' + vr.propName + '</div><div style="font-size:11px;color:var(--muted)">Room ' + vr.room + " \xB7 " + vr.type + '</div></div><span style="font-size:12px;font-weight:700;color:var(--accent-dark)">\xA3' + vr.price + "/wk</span></button>";
    }).join("") + "</div>";
    actionsTab += '<div style="background:#F0FDF4;border:1px solid #A7F3D0;border-radius:12px;padding:16px"><div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:10px">\u{1F504} Move to Different Room</div>' + moveRoomHtml + "</div>";
    actionsTab += `<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:16px"><div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:10px">\u{1F6AA} Move Out</div><button onclick="moveTenantOut('` + t.id + `')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #FECDD3;border-radius:9px;cursor:pointer;font-family:inherit;text-align:left;width:100%"><span style="font-size:18px">\u{1F6AA}</span><div><div style="font-size:13px;font-weight:600;color:var(--red)">Mark as Moved Out</div><div style="font-size:11px;color:var(--muted)">Frees the room and archives tenant</div></div></button></div>`;
    actionsTab += "</div>";
    var tVaultLocal = state.vault ? state.vault[t.id] || [] : [];
    var tVaultSupa = [];
    try {
      var tvr = await supa.storage.from("tenant-docs").list("tenants/" + String(t.id), { limit: 50 });
      if (!tvr.error && Array.isArray(tvr.data)) {
        tvr.data.filter(function(f) {
          return f.name && !f.name.startsWith(".");
        }).forEach(function(f) {
          var path = "tenants/" + String(t.id) + "/" + f.name;
          var pub = supa.storage.from("tenant-docs").getPublicUrl(path);
          var url = pub.data ? pub.data.publicUrl : null;
          var loc = tVaultLocal.find(function(d) {
            return d.storagePath === path;
          });
          if (loc) {
            if (url && !loc.dataUrl) loc.dataUrl = url;
            return;
          }
          var fsz = f.metadata && f.metadata.size ? f.metadata.size > 1048576 ? (f.metadata.size / 1048576).toFixed(1) + "MB" : Math.round(f.metadata.size / 1024) + "KB" : "";
          var fdt = f.created_at ? new Date(f.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
          tVaultSupa.push({ id: f.name, name: f.name, type: "Document", size: fsz, uploadedAt: fdt, dataUrl: url, storagePath: path, _fromStorage: true });
        });
      }
    } catch (e) {
      console.warn("Tenant docs list err:", e.message);
    }
    if (tVaultSupa.length) {
      if (!state.vault) state.vault = {};
      if (!state.vault[t.id]) state.vault[t.id] = [];
      tVaultSupa.forEach(function(sd) {
        if (!state.vault[t.id].find(function(d) {
          return d.storagePath === sd.storagePath;
        })) state.vault[t.id].push(sd);
      });
    }
    var tVault = tVaultLocal.concat(tVaultSupa);
    var TENANT_DOC_TYPES = ["Right to Rent", "Passport / ID", "Proof of Address", "Employment Reference", "Landlord Reference", "Tenancy Application", "Bank Statement", "NI Number", "Other"];
    var vaultRows = tVault.map(function(doc) {
      var icon = doc.name && doc.name.match(/\.pdf$/i) ? "\u{1F4C4}" : doc.name && doc.name.match(/\.(jpg|jpeg|png)$/i) ? "\u{1F5BC}\uFE0F" : "\u{1F4CB}";
      var typeColors = { "Right to Rent": "#DCFCE7", "Passport / ID": "#EFF6FF", "Proof of Address": "#FEF9C3", "Employment Reference": "#F3E8FF", "Other": "#F1F5F9" };
      var bg = typeColors[doc.type] || "#F1F5F9";
      var textColor = { "Right to Rent": "#166534", "Passport / ID": "#1E40AF", "Proof of Address": "#854D0E", "Employment Reference": "#6B21A8", "Other": "#475569" }[doc.type] || "#475569";
      return '<div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 13px;margin-bottom:7px"><div style="width:36px;height:36px;border-radius:8px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">' + icon + '</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + doc.name + '</div><div style="display:flex;align-items:center;gap:6px;margin-top:2px"><span style="font-size:10px;font-weight:700;color:' + textColor + ";background:" + bg + ';padding:1px 7px;border-radius:6px">' + doc.type + '</span><span style="font-size:10px;color:var(--muted)">' + doc.size + " \xB7 " + doc.uploadedAt + '</span></div></div><div style="display:flex;gap:5px;flex-shrink:0">' + (doc.dataUrl ? `<button onclick="previewDoc('` + doc.id + `')" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--accent-dark);cursor:pointer;font-family:inherit">\u{1F441} Preview</button>` : "") + (doc.dataUrl ? '<a href="' + doc.dataUrl + '" download="' + doc.name + '" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--blue);text-decoration:none">\u2193</a>' : "") + '<button data-tid="' + t.id + '" data-did="' + doc.id + '" onclick="removeTenantDocBtn(this)" style="padding:5px 9px;border-radius:7px;border:1px solid #FECDD3;background:#FFF1F2;font-size:11px;font-weight:700;color:#E11D48;cursor:pointer;font-family:inherit">&#x2715;</button></div></div>';
    }).join("");
    var vaultTab = '<div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:13px;font-weight:700">\u{1F4C1} Document Vault</div><div style="font-size:11px;color:var(--muted);margin-top:2px">' + tVault.length + " document" + (tVault.length === 1 ? "" : "s") + ' stored</div></div></div><select id="vault-doc-type-' + t.id + '" class="inp" style="margin-bottom:10px;font-size:13px">' + TENANT_DOC_TYPES.map(function(dt) {
      return "<option>" + dt + "</option>";
    }).join("") + '</select><div style="margin-bottom:14px"><input type="file" id="tvault-input-' + t.id + `" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple style="display:none" onchange="uploadTenantDoc('` + t.id + `',this)"><button onclick="document.getElementById('tvault-input-` + t.id + `').click()" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;border:2px dashed var(--accent);background:var(--accent-light);cursor:pointer;width:100%;font-family:inherit;text-align:left"><span style="font-size:22px">\u{1F4CE}</span><div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">Upload Document</div><div style="font-size:11px;color:var(--muted)">PDF, JPG, PNG \xB7 max 10MB</div></div></button></div>` + (tVault.length === 0 ? '<div style="text-align:center;padding:28px;color:var(--dim);font-size:13px">No documents uploaded yet</div>' : vaultRows);
    var tabContent = tab === "profile" ? profileTab : tab === "financials" ? financialsTab : tab === "history" ? histTab : tab === "vault" ? vaultTab : actionsTab;
    var tabs = ["profile", "financials", "history", "vault", "actions"];
    var tabLabels = { profile: "Profile", financials: "Financials", history: "Payment History", vault: "\u{1F4C1} Docs", actions: "Actions" };
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this){state.tenantDetailTab=null;closeModal()}"><div class="modal"><div style="padding:16px 18px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><div style="width:40px;height:40px;border-radius:12px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:var(--accent-dark);flex-shrink:0">' + t.name[0] + '</div><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800">' + t.name + '</div><div style="font-size:12px;color:var(--muted)">' + (t.status === "inactive" ? (t.previousTenancies && t.previousTenancies.length ? "Last: " + t.previousTenancies[t.previousTenancies.length - 1].property + " \xB7 " : t.property ? t.property + " \xB7 " : "") + '<span style="color:var(--muted)">Moved out</span>' : (t.property ? t.property + " \xB7 " : "") + (t.room ? "Room " + t.room + " \xB7 " : "") + '<span style="color:' + (t.status === "active" ? "var(--green)" : "var(--amber)") + '">' + t.status.replace("_", " ") + "</span>") + '</div></div><button class="modal-close" onclick="state.tenantDetailTab=null;closeModal()">\xD7</button></div><div style="display:flex;gap:0;overflow-x:auto;scrollbar-width:none">' + tabs.map(function(tv) {
      return `<button onclick="state.tenantDetailTab='` + tv + "';openTenantDetail('" + id + `')" style="padding:10px 14px;border:none;border-bottom:2px solid ` + (tab === tv ? "var(--accent)" : "transparent") + ";background:transparent;font-size:13px;font-weight:" + (tab === tv ? 700 : 500) + ";color:" + (tab === tv ? "var(--accent-dark)" : "var(--muted)") + ';cursor:pointer;white-space:nowrap;font-family:inherit">' + tabLabels[tv] + "</button>";
    }).join("") + '</div></div><div class="modal-body">' + tabContent + '</div><div class="modal-footer"><button onclick="state.tenantDetailTab=null;closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>' + (t.status === "inactive" ? '<button data-tid="' + id + '" onclick="deleteTenantPermanent(this.dataset.tid)" style="padding:9px 16px;border-radius:9px;border:none;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:auto;order:-1">&#x1F5D1; Delete Permanently</button>' : '<button data-tid="' + id + '" onclick="archiveTenant(this.dataset.tid)" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-right:auto;order:-1">&#x1F4E6; Archive</button>') + `<button onclick="saveTenantDetail('` + id + `')" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Changes</button></div></div></div>`;
  }
  function saveTenantDetail(id) {
    var t = state.tenants.find(function(x) {
      return x.id === id;
    });
    if (!t) return;
    var oldProp = t.property;
    var oldRoom = t.room;
    var g = function(eid) {
      var el = document.getElementById(eid);
      return el ? el.value : null;
    };
    if (g("td-name")) t.name = g("td-name") || t.name;
    if (g("td-email") !== null) t.email = g("td-email");
    var wa = g("td-wa");
    if (wa !== null) t.whatsapp = wa.trim().replace(/\s+/g, "").replace(/^\+/, "");
    if (g("td-prop")) t.property = g("td-prop");
    var newRoom = +g("td-room") || t.room;
    var newProp = g("td-prop") || t.property;
    if (newRoom !== t.room || newProp !== t.property) {
      var roomTaken2 = state.tenants.find(function(x) {
        return x.property === newProp && x.room === newRoom && x.status !== "inactive" && x.id !== t.id;
      });
      if (roomTaken2) {
        alert("\u26A0\uFE0F Room " + newRoom + " at " + newProp + " is already occupied by " + roomTaken2.name + ".");
        return;
      }
    }
    t.room = newRoom;
    var newRoomType = g("td-roomtype");
    if (newRoomType) {
      t.roomType = newRoomType;
      var rProp = state.properties.find(function(x) {
        return x.name === t.property;
      });
      if (rProp && rProp.roomList) {
        var rRoom = rProp.roomList.find(function(r) {
          return r.n === t.room;
        });
        if (rRoom) rRoom.type = newRoomType;
      }
    }
    if (g("td-method")) t.method = g("td-method");
    if (g("td-freq")) t.freq = g("td-freq");
    var freq2 = g("td-freq");
    if (freq2) t.freq = freq2;
    var payDay = g("td-payday");
    if (payDay) t.payDay = payDay;
    var payDom = g("td-paydom");
    if (payDom) t.payDayOfMonth = +payDom;
    var ns = g("td-movein");
    if (ns) {
      t.moveIn = ns;
      t.startDate = ns;
    }
    if (g("td-status")) t.status = g("td-status");
    var rentEl = g("td-rent");
    if (rentEl !== null) t.rent = +rentEl || t.rent;
    var arrEl = g("td-arrears");
    if (arrEl !== null) t.arrears = +arrEl;
    var depEl = g("td-deposit");
    if (depEl !== null) t.deposit = +depEl;
    var dstatEl = g("td-depositStatus");
    if (dstatEl !== null) t.depositStatus = dstatEl;
    var drefEl = g("td-depositRef");
    if (drefEl !== null) t.depositRef = drefEl;
    var dschEl = g("td-depositScheme");
    if (dschEl !== null) t.depositScheme = dschEl;
    var movedOut = t.status === "inactive";
    if (movedOut) {
      freeRoom(oldProp, oldRoom);
      if (!t.previousTenancies) t.previousTenancies = [];
      var alreadyRecorded = t.previousTenancies.some(function(pt) {
        return pt.property === oldProp && pt.room === oldRoom;
      });
      if (!alreadyRecorded && oldProp) {
        t.previousTenancies.push({
          property: oldProp,
          room: oldRoom,
          moveIn: t.startDate || t.moveIn || null,
          moveOut: t.moveOutDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          rent: t.rent,
          freq: t.freq
        });
      }
      t.property = "";
      t.room = null;
    } else if (t.property !== oldProp || t.room !== oldRoom) {
      freeRoom(oldProp, oldRoom);
      occupyRoom(t.property, t.room, t.rent);
    } else {
      var curProp = state.properties.find(function(p) {
        return p.name === t.property;
      });
      if (curProp && curProp.roomList) {
        var curRoom = curProp.roomList.find(function(r) {
          return r.n === t.room;
        });
        if (curRoom) curRoom.price = t.rent;
      }
      recalcProperty(curProp);
    }
    rebuildTenantSchedule(id);
    state.tenantDetailTab = null;
    closeModal();
    saveState();
    render();
  }
  function doMoveRoom(btn2) {
    var tid = btn2.getAttribute("data-tid");
    var pname = decodeURIComponent(btn2.getAttribute("data-pname"));
    var room = +btn2.getAttribute("data-room");
    var price = +btn2.getAttribute("data-price");
    var t = state.tenants.find(function(x) {
      return String(x.id) === String(tid);
    });
    if (!t) {
      showToast("Tenant not found", "error");
      return;
    }
    var oldProp = t.property;
    var oldRoom = t.room;
    t.property = pname;
    t.room = room;
    t.rent = price;
    freeRoom(oldProp, oldRoom);
    occupyRoom(pname, room, price);
    rebuildAllSchedules();
    saveState();
    showToast("Moved to " + pname + " Room " + room, "success");
    state.tenantDetailTab = "actions";
    openTenantDetail(t.id);
  }
  function generatePortalPassword() {
    var adjectives = ["Blue", "Red", "Green", "Gold", "Silver", "Swift", "Bright", "Clear", "Bold", "Calm", "Fresh", "Sharp", "Smart", "Strong", "Quick", "Warm", "Cool", "Wild", "Keen", "Safe"];
    var nouns = ["Door", "Key", "Room", "Home", "Gate", "Hall", "Park", "Lane", "Road", "Hill", "View", "Lake", "Tree", "Leaf", "Star", "Moon", "Sun", "Wind", "Rain", "Sky"];
    var a = adjectives[Math.floor(Math.random() * adjectives.length)];
    var n = nouns[Math.floor(Math.random() * nouns.length)];
    var num = Math.floor(Math.random() * 90) + 10;
    return a + n + num;
  }
  function giveTenantNotice(id) {
    var t = state.tenants.find(function(x) {
      return x.id === id;
    });
    if (!t) return;
    var el = document.getElementById("notice-moveout-" + id);
    var moveOut = el ? el.value : "";
    if (!moveOut) {
      alert("Please select a move-out date.");
      return;
    }
    t.status = "notice_given";
    t.noticeDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    t.moveOutDate = moveOut;
    state.tenantDetailTab = "actions";
    openTenantDetail(id);
    saveState();
    openTenantDetail(id);
  }
  function cancelTenantNotice(id) {
    var t = state.tenants.find(function(x) {
      return x.id === id;
    });
    if (!t) return;
    t.status = "active";
    t.noticeDate = null;
    t.moveOutDate = null;
    state.tenantDetailTab = "actions";
    openTenantDetail(id);
    saveState();
    openTenantDetail(id);
  }
  function moveTenantToRoom(tenantId, newPropId, newPropName, newRoomN, newPrice) {
    var t = state.tenants.find(function(x) {
      return x.id === tenantId;
    });
    if (!t) return;
    var oldProp = t.property;
    var oldRoom = t.room;
    t.property = newPropName;
    t.room = newRoomN;
    t.rent = newPrice;
    freeRoom(oldProp, oldRoom);
    occupyRoom(newPropName, newRoomN, newPrice);
    rebuildAllSchedules();
    state.tenantDetailTab = "actions";
    openTenantDetail(tenantId);
  }
  function moveTenantOut(id) {
    var t = state.tenants.find(function(x) {
      return x.id === id;
    });
    if (!t) return;
    var prop = t.property;
    var room = t.room;
    t.status = "inactive";
    freeRoom(prop, room);
    rebuildAllSchedules();
    state.tenantDetailTab = null;
    closeModal();
    saveState();
    render();
  }
  async function openPropDetail(id) {
    const p = state.properties.find((x) => x.id === id);
    if (!p) return;
    state.propDetailTab = state.propDetailTab || "details";
    const tab = state.propDetailTab;
    const n = net(p);
    const n2 = net(p);
    const o = pct(p.occupied, p.rooms);
    const oc = o === 100 ? "var(--green)" : o < 70 ? "var(--red)" : "var(--amber)";
    const propTenants = state.tenants.filter((t) => t.property === p.name && t.status !== "inactive");
    const formerTenants = state.tenants.filter((t) => t.property === p.name && t.status === "inactive");
    const detailsTab = `
    <!-- Property KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:${oc};font-family:monospace">${o}%</div>
        <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-top:2px">Occupancy</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">${p.occupied}/${p.rooms}</div>
      </div>
      <div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:var(--green);font-family:monospace">${fmt(p.rent)}</div>
        <div style="font-size:10px;color:var(--green);font-weight:700;text-transform:uppercase;margin-top:2px">Income/mo</div>
      </div>
      <div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:var(--red);font-family:monospace">${fmt(p.landlord)}</div>
        <div style="font-size:10px;color:var(--red);font-weight:700;text-transform:uppercase;margin-top:2px">Landlord/mo</div>
      </div>
      <div style="background:${n >= 0 ? "var(--green-light)" : "var(--red-light)"};border:1px solid ${n >= 0 ? "#A7F3D0" : "#FECDD3"};border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:${n >= 0 ? "var(--green)" : "var(--red)"};font-family:monospace">${fmt(n)}</div>
        <div style="font-size:10px;color:${n >= 0 ? "var(--green)" : "var(--red)"};font-weight:700;text-transform:uppercase;margin-top:2px">Profit/mo</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="field"><label class="field-label">Property Name</label><input class="inp" id="pd-name" value="${p.name}"></div>
      <div class="field"><label class="field-label">Type</label>
        <select class="inp" id="pd-type">
          <option ${p.type === "HMO" ? "selected" : ""}>HMO</option>
          <option ${p.type === "Single Let" ? "selected" : ""}>Single Let</option>
          <option ${p.type === "Semi-Commercial" ? "selected" : ""}>Semi-Commercial</option>
          <option ${p.type === "Other" ? "selected" : ""}>Other</option>
        </select>
      </div>
    </div>

    <!-- Ownership & Letting type -->
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Classification</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <label id="pd-lbl-owned" onclick="pdSetOwnership('owned')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:2px solid ${(p.ownershipType || "managed") === "owned" ? "var(--accent)" : "var(--border)"};background:${(p.ownershipType || "managed") === "owned" ? "var(--accent-light)" : "var(--bg)"};cursor:pointer">
          <input type="radio" name="pd-ownership" value="owned" ${(p.ownershipType || "managed") === "owned" ? "checked" : ""} style="accent-color:var(--accent)">
          <div><div style="font-size:12px;font-weight:700;color:${(p.ownershipType || "managed") === "owned" ? "var(--accent-dark)" : "var(--text)"}">\u{1F3E0} Owned</div></div>
        </label>
        <label id="pd-lbl-managed" onclick="pdSetOwnership('managed')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:2px solid ${(p.ownershipType || "managed") === "managed" ? "var(--accent)" : "var(--border)"};background:${(p.ownershipType || "managed") === "managed" ? "var(--accent-light)" : "var(--bg)"};cursor:pointer">
          <input type="radio" name="pd-ownership" value="managed" ${(p.ownershipType || "managed") === "managed" ? "checked" : ""} style="accent-color:var(--accent)">
          <div><div style="font-size:12px;font-weight:700;color:${(p.ownershipType || "managed") === "managed" ? "var(--accent-dark)" : "var(--text)"}">\u{1F91D} Managed</div></div>
        </label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label id="pd-lbl-hmo" onclick="pdSetLetting('hmo')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:2px solid ${(p.lettingType || "hmo") === "hmo" ? "var(--accent)" : "var(--border)"};background:${(p.lettingType || "hmo") === "hmo" ? "var(--accent-light)" : "var(--bg)"};cursor:pointer">
          <input type="radio" name="pd-letting" value="hmo" ${(p.lettingType || "hmo") === "hmo" ? "checked" : ""} style="accent-color:var(--accent)">
          <div><div style="font-size:12px;font-weight:700;color:${(p.lettingType || "hmo") === "hmo" ? "var(--accent-dark)" : "var(--text)"}">\u{1F3D8}\uFE0F HMO</div></div>
        </label>
        <label id="pd-lbl-whole" onclick="pdSetLetting('whole')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:2px solid ${(p.lettingType || "hmo") === "whole" ? "var(--accent)" : "var(--border)"};background:${(p.lettingType || "hmo") === "whole" ? "var(--accent-light)" : "var(--bg)"};cursor:pointer">
          <input type="radio" name="pd-letting" value="whole" ${(p.lettingType || "hmo") === "whole" ? "checked" : ""} style="accent-color:var(--accent)">
          <div><div style="font-size:12px;font-weight:700;color:${(p.lettingType || "hmo") === "whole" ? "var(--accent-dark)" : "var(--text)"}">\u{1F3E1} Whole</div></div>
        </label>
      </div>
    </div>
    <div class="field"><label class="field-label">Full Address</label><input class="inp" id="pd-address" value="${p.address || ""}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label class="field-label">Area</label>
        <select class="inp" id="pd-area">
          <option ${p.area === "Brixton" ? "selected" : ""}>Brixton</option>
          <option ${p.area === "Clapham" ? "selected" : ""}>Clapham</option>
          <option ${p.area === "Stockwell" ? "selected" : ""}>Stockwell</option>
          <option ${p.area === "Vauxhall" ? "selected" : ""}>Vauxhall</option>
          <option ${p.area === "Kennington" ? "selected" : ""}>Kennington</option>
          <option ${p.area === "Camberwell" ? "selected" : ""}>Camberwell</option>
          <option ${p.area === "Peckham" ? "selected" : ""}>Peckham</option>
          <option ${p.area === "Dulwich" ? "selected" : ""}>Dulwich</option>
          <option ${p.area === "Streatham" ? "selected" : ""}>Streatham</option>
          <option ${p.area === "Tooting" ? "selected" : ""}>Tooting</option>
          <option ${p.area === "Balham" ? "selected" : ""}>Balham</option>
          <option ${p.area === "Norbury" ? "selected" : ""}>Norbury</option>
          <option ${p.area === "Croydon" ? "selected" : ""}>Croydon</option>
          <option ${p.area === "Thornton Heath" ? "selected" : ""}>Thornton Heath</option>
          <option ${p.area === "Norwood" ? "selected" : ""}>Norwood</option>
          <option ${p.area === "Crystal Palace" ? "selected" : ""}>Crystal Palace</option>
          <option ${p.area === "Sydenham" ? "selected" : ""}>Sydenham</option>
          <option ${p.area === "Lewisham" ? "selected" : ""}>Lewisham</option>
          <option ${p.area === "Deptford" ? "selected" : ""}>Deptford</option>
          <option ${p.area === "New Cross" ? "selected" : ""}>New Cross</option>
          <option ${p.area === "Catford" ? "selected" : ""}>Catford</option>
          <option ${p.area === "Forest Hill" ? "selected" : ""}>Forest Hill</option>
          <option ${p.area === "Lambeth" ? "selected" : ""}>Lambeth</option>
          <option ${p.area === "Wandsworth" ? "selected" : ""}>Wandsworth</option>
          <option ${p.area === "Southwark" ? "selected" : ""}>Southwark</option>
          <option ${p.area === "Bermondsey" ? "selected" : ""}>Bermondsey</option>
          <option ${p.area === "Other" ? "selected" : ""}>Other</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div id="pd-rooms-wrap" class="field" ${(p.lettingType || "hmo") === "whole" ? 'style="display:none"' : ""}><label class="field-label">Total Rooms</label><input class="inp" id="pd-rooms" type="number" value="${p.rooms}"></div>
      <div id="pd-bedrooms-wrap" class="field" ${(p.lettingType || "hmo") !== "whole" ? 'style="display:none"' : ""}><label class="field-label">\u{1F6CF}\uFE0F Bedrooms</label>
        <select class="inp" id="pd-bedrooms">
          ${[1, 2, 3, 4, 5, 6].map((n3) => `<option value="${n3}" ${(p.bedrooms || 3) === n3 ? "selected" : ""}>${n3}${n3 === 6 ? "+" : ""} bedroom${n3 === 1 ? "" : "s"}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label class="field-label" id="pd-outgoing-label">${(p.ownershipType || "managed") === "owned" ? "Mortgage Payment (\xA3/mo)" : "Landlord Rent (\xA3/mo)"}</label><input class="inp" id="pd-landlord" type="number" value="${p.landlord}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label class="field-label">Income (\xA3/mo) <span style="font-size:10px;color:var(--muted);font-weight:400">auto from tenants</span></label><input class="inp" id="pd-rent" type="number" value="${p.rent}" readonly style="background:var(--bg);color:var(--muted);cursor:not-allowed"></div>
    </div>

    <!-- Landlord details (managed only) -->
    <div id="pd-landlord-section" ${(p.ownershipType || "managed") === "owned" ? 'style="display:none"' : ""}>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Landlord Details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field" style="margin:0"><label class="field-label">Landlord Name</label><input class="inp" id="pd-lname" value="${p.landlordName || ""}"></div>
          <div class="field" style="margin:0"><label class="field-label">Landlord Phone</label><input class="inp" id="pd-lphone" value="${p.landlordPhone || ""}"></div>
        </div>
      </div>
    </div>

    <!-- Mortgage details (owned only) -->
    <div id="pd-mortgage-section" ${(p.ownershipType || "managed") !== "owned" ? 'style="display:none"' : ""}>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">\u{1F3E6} Mortgage</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field" style="margin:0"><label class="field-label">Lender</label><input class="inp" id="pd-m-lender" value="${p.mortgage && p.mortgage.lender || ""}" placeholder="e.g. Halifax"></div>
          <div class="field" style="margin:0"><label class="field-label">Monthly Payment (\xA3)</label><input class="inp" id="pd-m-payment" type="number" value="${p.mortgage && p.mortgage.monthlyPayment || ""}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          <div class="field" style="margin:0"><label class="field-label">Rate (%)</label><input class="inp" id="pd-m-rate" type="number" step="0.01" value="${p.mortgage && p.mortgage.rate || ""}"></div>
          <div class="field" style="margin:0"><label class="field-label">Rate Type</label>
            <select class="inp" id="pd-m-ratetype">
              ${["fixed", "tracker", "svr", "variable"].map((rt) => `<option value="${rt}" ${(p.mortgage && p.mortgage.rateType) === rt ? "selected" : ""}>${rt.charAt(0).toUpperCase() + rt.slice(1)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          <div class="field" style="margin:0"><label class="field-label">Fix End Date</label><input class="inp" id="pd-m-fixend" type="date" value="${p.mortgage && p.mortgage.fixEndDate || ""}"></div>
          <div class="field" style="margin:0"><label class="field-label">Outstanding Balance (\xA3)</label><input class="inp" id="pd-m-balance" type="number" value="${p.mortgage && p.mortgage.outstandingBalance || ""}"></div>
        </div>
        ${(() => {
      if (!p.mortgage || !p.mortgage.outstandingBalance || !p.purchaseInfo || !p.purchaseInfo.estimatedValue) return "";
      var equity = (p.purchaseInfo.estimatedValue || 0) - (p.mortgage.outstandingBalance || 0);
      var ltv = p.purchaseInfo.estimatedValue ? Math.round(p.mortgage.outstandingBalance / p.purchaseInfo.estimatedValue * 100) : 0;
      return `<div style="margin-top:12px;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="text-align:center"><div style="font-size:15px;font-weight:800;color:var(--green);font-family:monospace">${fmt(equity)}</div><div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Equity</div></div>
            <div style="text-align:center"><div style="font-size:15px;font-weight:800;color:${ltv > 75 ? "var(--red)" : "var(--amber)"};font-family:monospace">${ltv}%</div><div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">LTV</div></div>
          </div>`;
    })()}
      </div>
    </div>

    <!-- Purchase info (owned only) -->
    <div id="pd-purchase-section" ${(p.ownershipType || "managed") !== "owned" ? 'style="display:none"' : ""}>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">\u{1F4C8} Purchase & Value</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field" style="margin:0"><label class="field-label">Purchase Price (\xA3)</label><input class="inp" id="pd-p-purchase" type="number" value="${p.purchaseInfo && p.purchaseInfo.purchasePrice || ""}"></div>
          <div class="field" style="margin:0"><label class="field-label">Purchase Date</label><input class="inp" id="pd-p-date" type="date" value="${p.purchaseInfo && p.purchaseInfo.purchaseDate || ""}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          <div class="field" style="margin:0"><label class="field-label">Est. Value Now (\xA3)</label><input class="inp" id="pd-p-value" type="number" value="${p.purchaseInfo && p.purchaseInfo.estimatedValue || ""}"></div>
          <div class="field" style="margin:0"><label class="field-label">Ownership Structure</label>
            <select class="inp" id="pd-p-structure">
              ${["sole", "joint", "ltd", "other"].map((s) => `<option value="${s}" ${(p.purchaseInfo && p.purchaseInfo.ownershipStructure) === s ? "selected" : ""}>${s === "ltd" ? "Ltd Company" : s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
    </div>
    <div class="field"><label class="field-label">\u{1F4CD} Google Maps URL</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="inp" id="pd-maps" value="${p.mapsUrl || ""}" placeholder="https://maps.google.com/?q=..." style="flex:1">
        ${p.mapsUrl ? `<a href="${p.mapsUrl}" target="_blank" style="white-space:nowrap;font-size:12px;color:var(--blue);text-decoration:none;border:1px solid var(--blue-light);background:var(--blue-light);padding:8px 12px;border-radius:8px">\u{1F5FA} Open</a>` : ""}
      </div>
    </div>
    <div class="field"><label class="field-label">&#x1F3E2; Operating Company</label>
      <select class="inp" id="pd-company">
        <option value="">\u2014 Unassigned \u2014</option>
        ${(state.companies || []).map((c) => '<option value="' + c.id + '" ' + (p.companyId === c.id ? "selected" : "") + ">" + c.name + "</option>").join("")}
      </select>
    </div>
    <div class="field"><label class="field-label">Notes</label>
      <textarea class="inp" id="pd-notes" rows="3" style="resize:vertical">${p.notes || ""}</textarea>
    </div>`;
    const isWholeProperty = (p.lettingType || "hmo") === "whole";
    const roomsTab = isWholeProperty ? `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center;margin-bottom:16px">
      <div style="font-size:32px;margin-bottom:10px">\u{1F3E1}</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">Whole Property Let</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">This property is let to one household \u2014 ${p.bedrooms || "?"} bedroom${(p.bedrooms || 1) === 1 ? "" : "s"}. No individual room breakdown.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:300px;margin:0 auto">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:12px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${p.occupied > 0 ? "var(--green)" : "var(--red)"}">
            ${p.occupied > 0 ? "\u25CF" : "\u25CB"}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;font-weight:600">${p.occupied > 0 ? "Occupied" : "Vacant"}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:12px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:var(--green)">${fmt(p.rent || 0)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;font-weight:600">Income/mo</div>
        </div>
      </div>
    </div>
    <div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:10px;padding:12px;font-size:12px;color:var(--blue)">
      \u{1F4A1} To add a tenant for this property, use the Tenants tab or the + Add Tenant button. One active tenancy at a time.
    </div>` : `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:13px;font-weight:700">${p.rooms} Rooms</div>
        <div style="font-size:11px;color:var(--muted)">${p.occupied} occupied \xB7 ${p.rooms - p.occupied} vacant</div>
      </div>
      <button onclick="addRoomToProp('${p.id}')" style="font-size:12px;font-weight:600;color:var(--accent-dark);background:var(--accent-light);border:1px solid var(--accent);border-radius:8px;padding:7px 13px;cursor:pointer;font-family:inherit">+ Add Room</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${(p.roomList || []).map((r) => `
        <div style="display:flex;align-items:center;gap:12px;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:12px 14px">
          <div style="width:32px;height:32px;border-radius:8px;background:${r.status === "occupied" ? "var(--green-light)" : "var(--red-light)"};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${r.status === "occupied" ? "var(--green)" : "var(--red)"};flex-shrink:0">
            ${r.n}
          </div>
          <div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0">
            <span style="font-size:12px;font-weight:700;color:var(--text);flex-shrink:0">Rm ${r.n}</span>
            <select onchange="updateRoomType('${p.id}',${r.n},this.value)" style="padding:4px 8px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;font-family:inherit;color:var(--text);cursor:pointer">
              ${["\u{1F6CF}\uFE0F Single", "\u{1F6CF}\uFE0F\u{1F6CF}\uFE0F Double", "\u2728 Suite", "\u{1F3E0} Studio", "\u{1F3E1} Whole House"].map((opt) => `<option value="${opt.split(" ").slice(1).join(" ")}" ${(r.type || "Single") === opt.split(" ").slice(1).join(" ") ? "selected" : ""}>${opt}</option>`).join("")}
            </select>
            <span style="font-size:11px;font-weight:600;color:${r.status === "occupied" ? "var(--green)" : "var(--red)"};background:${r.status === "occupied" ? "var(--green-light)" : "var(--red-light)"};padding:2px 8px;border-radius:5px;flex-shrink:0">${r.status}</span>
            ${r.status === "occupied" ? `<span style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${propTenants.find((t) => t.room === r.n) ? propTenants.find((t) => t.room === r.n).name : "Tenant not linked"}</span>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:4px">
              <span style="font-size:11px;color:var(--muted)">\xA3</span>
              <input type="number" value="${r.price}" onchange="updateRoomPrice('${p.id}',${r.n},this.value)"
                style="width:72px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:13px;font-weight:600;color:var(--text);font-family:inherit;outline:none">
              <span style="font-size:10px;color:var(--muted)">/wk</span>
            </div>
          </div>
        </div>`).join("")}
    </div>`;
    const tenantsTab = `
    <div style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:2px">${propTenants.length} Current Tenant${propTenants.length !== 1 ? "s" : ""}</div>
      <div style="font-size:11px;color:var(--muted)">${propTenants.filter((t) => t.arrears > 0).length} in arrears${formerTenants.length ? " \xB7 " + formerTenants.length + " previous" : ""}</div>
    </div>
    ${propTenants.length === 0 ? `<div style="padding:24px;text-align:center;color:var(--dim);font-size:13px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">No active tenants at this property</div>` : propTenants.map((t) => `
        <div onclick="state.propDetailTab=null;closeModal();setTimeout(function(){openTenantDetail('${t.id}');},50)" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border:1px solid ${t.arrears > 0 ? "#FECDD3" : "var(--border)"};border-radius:10px;margin-bottom:8px;cursor:pointer">
          <div style="width:34px;height:34px;border-radius:10px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--accent-dark);flex-shrink:0">${t.name[0]}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${t.name}</div>
            <div style="font-size:11px;color:var(--muted)">${t.room ? "Room " + t.room + " \xB7 " : ""}${fmt(t.rent)}/${t.freq === "weekly" ? "wk" : "mo"}</div>
            ${t.arrears > 0 ? `<div style="font-size:11px;color:var(--red);font-weight:600">Arrears: ${fmt(t.arrears)}</div>` : ""}
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
            ${badge(t.status === "notice_given" ? "notice_given" : t.status)}
            ${t.whatsapp ? `<a href="https://wa.me/${t.whatsapp}" target="_blank" onclick="event.stopPropagation()" style="font-size:10px;color:var(--wa);background:var(--wa-light);border:1px solid #BBF7D0;border-radius:5px;padding:2px 7px;text-decoration:none">\u{1F4AC} WhatsApp</a>` : ""}
          </div>
        </div>`).join("")}
    ${formerTenants.length ? `
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Previous Tenants (${formerTenants.length})</div>
        ${formerTenants.map((t) => `
          <div onclick="state.propDetailTab=null;closeModal();setTimeout(function(){openTenantDetail('${t.id}');},50)" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:9px;margin-bottom:6px;cursor:pointer;opacity:.7">
            <div style="width:28px;height:28px;border-radius:8px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--muted);flex-shrink:0">${t.name[0]}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--muted)">${t.name}</div>
              <div style="font-size:11px;color:var(--dim)">Moved out${t.moveOutDate ? " \xB7 " + new Date(t.moveOutDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</div>
            </div>
            <span style="font-size:10px;padding:2px 7px;border-radius:5px;background:var(--border);color:var(--muted);font-weight:600">Archived</span>
          </div>`).join("")}
      </div>` : ""}`;
    const tabs = [
      { v: "details", l: "Details" },
      { v: "rooms", l: `Rooms (${p.rooms})` },
      { v: "tenants", l: `Tenants (${propTenants.length})` },
      { v: "finance", l: "\u{1F4B0} Finance" },
      { v: "docs", l: "\u{1F4C1} Docs" }
    ];
    const docsTab = tab === "docs" ? await renderPropDocsTab(p) : "<div></div>";
    const financeTab = tab === "finance" ? renderPropFinanceTab(p, propTenants) : "<div></div>";
    const tabContent = tab === "details" ? detailsTab : tab === "rooms" ? roomsTab : tab === "tenants" ? tenantsTab : tab === "finance" ? financeTab : docsTab;
    document.getElementById("modal-container").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this){state.propDetailTab=null;closeModal()}">
      <div class="modal" style="max-width:580px">
        <div class="modal-header" style="padding:16px 20px">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:700;margin-bottom:2px">${p.name}</div>
            <div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px">
              <span>${p.area}</span>
              <span>\xB7</span>
              <span style="color:${n2 >= 0 ? "var(--green)" : "var(--red)"};font-weight:600">${fmt(n2)} profit/mo</span>
              <span>\xB7</span>
              <span style="color:${oc};font-weight:600">${o}% occupied</span>
            </div>
          </div>
          <button class="modal-close" onclick="state.propDetailTab=null;closeModal()">\xD7</button>
        </div>

        <!-- Tab bar -->
        <div style="display:flex;border-bottom:1px solid var(--border);padding:0 20px;background:var(--bg)">
          ${tabs.map((t) => `
            <button onclick="state.propDetailTab='${t.v}';openPropDetail('${p.id}')"
              style="padding:10px 16px;border:none;border-bottom:2px solid ${tab === t.v ? "var(--accent)" : "transparent"};
                margin-bottom:-1px;background:transparent;cursor:pointer;font-family:inherit;
                color:${tab === t.v ? "var(--accent-dark)" : "var(--muted)"};font-size:13px;font-weight:${tab === t.v ? 700 : 500};
                white-space:nowrap;transition:all .15s">
              ${t.l}
            </button>`).join("")}
        </div>

        <div style="padding:20px;max-height:65vh;overflow-y:auto">
          ${tabContent}
        </div>

        ${tab === "details" ? `
        <div class="modal-footer" style="padding:14px 20px">
          ${btn("Cancel", "state.propDetailTab=null;closeModal()", "secondary")}
          ${p.status === "archived" ? `<button onclick="deletePropPermanent('${p.id}')" style="padding:9px 16px;border-radius:9px;border:none;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:auto">\u{1F5D1} Delete</button>
               <button onclick="restoreProperty('${p.id}')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--green);background:var(--green-light);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">\u21A9 Restore</button>` : `<button onclick="archiveProperty('${p.id}')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-right:auto">\u{1F4E6} Archive</button>`}
          ${btn("Save Changes", `savePropDetail('${p.id}')`, "primary")}
        </div>` : tab === "tenants" ? `
        <div class="modal-footer" style="padding:14px 20px">
          ${btn("Close", "state.propDetailTab=null;closeModal()", "secondary")}
          ${btn("+ Add Tenant", "state.propDetailTab=null;closeModal();openModal('addTenant')", "primary")}
        </div>` : tab === "finance" ? `
        <div class="modal-footer" style="padding:14px 20px">
          ${btn("Close", "state.propDetailTab=null;closeModal()", "secondary")}
          ${btn("Edit Details", "state.propDetailTab='details';openPropDetail('" + p.id + "')", "primary")}
        </div>` : `
        <div class="modal-footer" style="padding:14px 20px">
          ${btn("Close", "state.propDetailTab=null;closeModal()", "secondary")}
        </div>`}
      </div>
    </div>`;
  }
  function openEditMaintModal(id) {
    var m = state.maintenance.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!m) return;
    if (!state.maintExtras) state.maintExtras = {};
    if (!state.maintExtras[id]) state.maintExtras[id] = { photos: [] };
    var mx = state.maintExtras[id];
    var CATS = ["Plumbing", "Electrical", "Heating / Boiler", "Windows / Doors", "Damp / Mould", "Kitchen", "Bathroom", "Appliances", "Pest Control - Bed Bugs", "Pest Control - Cockroaches", "Pest Control - Mice", "Pest Control - Rats", "General"];
    var catOpts = CATS.map(function(c) {
      return "<option " + (c === (m.cat || m.category || "General") ? "selected" : "") + ">" + c + "</option>";
    }).join("");
    var photosHtml = "";
    if (m.photo) photosHtml += '<div style="position:relative;display:inline-block;margin:3px"><img src="' + m.photo + '" style="width:76px;height:76px;object-fit:cover;border-radius:7px"><span style="position:absolute;bottom:2px;left:2px;font-size:8px;background:rgba(0,0,0,.55);color:#fff;border-radius:3px;padding:1px 4px">Original</span></div>';
    (mx.photos || []).forEach(function(ph, i) {
      photosHtml += '<div data-eid="emph' + i + '" style="position:relative;display:inline-block;margin:3px"><img src="' + ph.src + '" style="width:76px;height:76px;object-fit:cover;border-radius:7px"><button data-mid="' + id + '" data-idx="' + i + '" onclick="removeMaintExtraPhoto(this.dataset.mid,this.dataset.idx);var _p=this.parentNode;if(_p)_p.remove()" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.65);border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1;padding:0">&times;</button></div>';
    });
    var invHtml = "";
    if (mx.invoiceName) invHtml = '<div id="em-inv-curr" style="display:flex;align-items:center;gap:7px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:8px;padding:8px 10px;margin-bottom:6px"><span style="font-size:11px;font-weight:600;color:var(--blue);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + mx.invoiceName + '</span><button data-mid="' + id + '" onclick="clearMaintInvoice(this.dataset.mid)" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0">Remove</button></div>';
    invHtml += '<div id="em-inv-prev" style="display:none;align-items:center;gap:7px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:8px;padding:8px 10px;margin-bottom:6px"><span id="em-inv-name" style="font-size:11px;font-weight:600;color:var(--blue);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span><button onclick="clearPendingInvoicePreview()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0">Remove</button></div>';
    window._pendingMaintInvoice = null;
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px"><div class="modal-header"><span class="modal-title">Edit Maintenance Job</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="field"><label class="field-label">Issue Description</label><textarea class="inp" id="em-issue" rows="2" style="resize:vertical">' + m.issue + '</textarea></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">Category</label><select class="inp" id="em-cat">' + catOpts + '</select></div><div class="field"><label class="field-label">Priority</label><select class="inp" id="em-pri"><option value="urgent"' + (m.priority === "urgent" ? " selected" : "") + '>Urgent</option><option value="high"' + (m.priority === "high" ? " selected" : "") + '>High</option><option value="medium"' + (m.priority === "medium" ? " selected" : "") + '>Medium</option><option value="low"' + (m.priority === "low" ? " selected" : "") + '>Low</option></select></div></div><div class="field"><label class="field-label">Status</label><select class="inp" id="em-status"><option value="open"' + (m.status === "open" ? " selected" : "") + '>Open</option><option value="in_progress"' + (m.status === "in_progress" ? " selected" : "") + '>In Progress</option><option value="resolved"' + (m.status === "resolved" ? " selected" : "") + '>Resolved</option></select></div><div class="field"><label class="field-label">Notes</label><input class="inp" id="em-notes" value="' + (m.notes || "").replace(/"/g, "&quot;") + '" placeholder="Access details, follow-up notes"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">Job Cost (\xA3)</label><input class="inp" id="em-cost" type="number" step="0.01" min="0" placeholder="0.00" value="' + (mx.cost || "") + '"></div><div class="field"><label class="field-label">Invoice / Receipt</label><input type="file" id="em-inv-inp" accept="image/*,.pdf" style="display:none" onchange="previewMaintInvoice(this)">' + invHtml + '<button onclick="clickMaintInvInput()" style="display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:8px;border:2px dashed var(--border);background:var(--bg);cursor:pointer;width:100%;font-family:inherit;font-size:12px;color:var(--muted)">+ Upload Invoice</button></div></div><div class="field"><label class="field-label">Photos</label><div id="em-photos-grid" style="line-height:0;margin-bottom:8px">' + photosHtml + '</div><input type="file" id="em-photos-inp" accept="image/*" multiple data-mid="' + id + '" style="display:none" onchange="addMaintExtraPhotos(this)"><button onclick="clickMaintPhotosInput()" style="display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:8px;border:2px dashed var(--border);background:var(--bg);cursor:pointer;width:100%;font-family:inherit;font-size:12px;color:var(--muted)">+ Add Photos</button></div></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button data-mid="' + id + '" onclick="saveEditMaint(this.dataset.mid)" style="padding:9px 20px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Changes</button></div></div></div>';
  }
  function saveEditMaint(id) {
    var m = state.maintenance.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!m) return;
    var issue = (document.getElementById("em-issue").value || "").trim();
    if (issue) m.issue = issue;
    m.cat = document.getElementById("em-cat").value;
    m.category = m.cat;
    m.priority = document.getElementById("em-pri").value;
    var ns = document.getElementById("em-status").value;
    if (ns === "resolved" && m.status !== "resolved") m.resolvedDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    m.status = ns;
    m.notes = document.getElementById("em-notes").value;
    var _cEl = document.getElementById("em-contractor");
    if (_cEl) m.contractor = _cEl.value;
    if (!state.maintExtras) state.maintExtras = {};
    if (!state.maintExtras[id]) state.maintExtras[id] = { photos: [] };
    var mx = state.maintExtras[id], prevCost = mx.cost || 0;
    var cv = parseFloat(document.getElementById("em-cost").value) || 0;
    if (cv > 0) mx.cost = Math.round(cv * 100) / 100;
    else delete mx.cost;
    if (window._pendingMaintInvoice) {
      mx.invoiceUrl = window._pendingMaintInvoice.url;
      mx.invoiceName = window._pendingMaintInvoice.name;
      window._pendingMaintInvoice = null;
    }
    if (cv > 0 && cv !== prevCost) {
      if (!state.expenses) state.expenses = [];
      state.expenses = state.expenses.filter(function(e) {
        return e._maintId !== id;
      });
      var _prop = state.properties.find(function(p) {
        return p.name === m.property;
      });
      var _desc = m.issue + (m.room ? " (Room " + m.room + ")" : "") + " - " + (m.cat || "General") + (m.contractor ? " [" + m.contractor + "]" : "");
      var _propAddr = _prop ? _prop.address && _prop.address !== _prop.name ? _prop.address : _prop.name : m.property || "";
      state.expenses.push({
        id: crypto.randomUUID(),
        _maintId: id,
        category: "Maintenance",
        cat: "Maintenance",
        description: _desc,
        desc: _desc,
        amount: cv,
        type: "actual",
        status: "actual",
        freq: "one-off",
        recurring: false,
        startDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        propertyId: _prop ? _prop.id : null,
        propertyName: _propAddr,
        property: _propAddr
      });
      showToast("Job updated - cost added to Expenses", "success");
    } else {
      showToast("Job updated", "success");
    }
    saveState();
    closeModal();
    render();
  }
  function previewMaintInvoice(input) {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("File too large - max 2MB", "error");
      input.value = "";
      return;
    }
    var pd = document.getElementById("em-inv-prev"), ne = document.getElementById("em-inv-name");
    if (pd) pd.style.display = "flex";
    if (ne) ne.textContent = file.name;
    var reader = new FileReader();
    reader.onload = function(e) {
      window._pendingMaintInvoice = { url: e.target.result, name: file.name };
    };
    reader.readAsDataURL(file);
  }
  function addMaintExtraPhotos(input) {
    var maintId = input.dataset.mid;
    if (!state.maintExtras) state.maintExtras = {};
    if (!state.maintExtras[maintId]) state.maintExtras[maintId] = { photos: [] };
    var mx = state.maintExtras[maintId], grid = document.getElementById("em-photos-grid");
    Array.from(input.files).forEach(function(file) {
      if (file.size > 3 * 1024 * 1024) {
        showToast("Photo too large (max 3MB) - skipped", "error");
        return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        var photo = { src: e.target.result, name: file.name };
        mx.photos.push(photo);
        if (grid) {
          var idx = mx.photos.length - 1;
          var div = document.createElement("div");
          div.id = "emph" + idx;
          div.style.cssText = "position:relative;display:inline-block;margin:3px";
          var btn2 = document.createElement("button");
          btn2.dataset.mid = maintId;
          btn2.dataset.idx = String(idx);
          btn2.innerHTML = "&times;";
          btn2.style.cssText = "position:absolute;top:2px;right:2px;background:rgba(0,0,0,.65);border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1;padding:0";
          btn2.onclick = function() {
            removeMaintExtraPhoto(this.dataset.mid, this.dataset.idx);
            var el = document.getElementById("emph" + this.dataset.idx);
            if (el) el.remove();
          };
          var img = document.createElement("img");
          img.src = photo.src;
          img.style.cssText = "width:76px;height:76px;object-fit:cover;border-radius:7px";
          div.appendChild(img);
          div.appendChild(btn2);
          grid.appendChild(div);
        }
      };
      reader.readAsDataURL(file);
    });
    input.value = "";
  }
  function removeMaintExtraPhoto(maintId, idx) {
    if (state.maintExtras && state.maintExtras[maintId]) state.maintExtras[maintId].photos.splice(Number(idx), 1);
  }
  function clearPendingInvoicePreview() {
    var pd = document.getElementById("em-inv-prev");
    if (pd) pd.style.display = "none";
    var inp = document.getElementById("em-inv-inp");
    if (inp) inp.value = "";
    window._pendingMaintInvoice = null;
  }
  function clickMaintInvInput() {
    var el = document.getElementById("em-inv-inp");
    if (el) el.click();
  }
  function clickMaintPhotosInput() {
    var el = document.getElementById("em-photos-inp");
    if (el) el.click();
  }
  function clearMaintInvoice(maintId) {
    if (state.maintExtras && state.maintExtras[maintId]) {
      delete state.maintExtras[maintId].invoiceUrl;
      delete state.maintExtras[maintId].invoiceName;
    }
    var el = document.getElementById("em-inv-curr");
    if (el) el.style.display = "none";
    saveState();
  }
  function openEditPaymentModal(payId) {
    var idStr = String(payId);
    var p = state.payments.find(function(x) {
      return String(x.id) === idStr;
    });
    var sc = !p ? state.rentSchedule.find(function(x) {
      return String(x.id) === idStr;
    }) : null;
    var entry = p || sc;
    if (!entry) return;
    var tenantName = entry.tenant || entry.tenantName || "";
    var amount = entry.amount || 0;
    var method = p ? p.paidMethod || p.method || "bank" : sc ? sc.method || "bank" : "bank";
    var propRoom = (entry.property || entry.propertyName || "") + (entry.room ? " - Rm " + (entry.room || "") : "");
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:400px"><div class="modal-header"><span class="modal-title">Fix Payment</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px"><div style="font-size:13px;font-weight:700">' + tenantName + '</div><div style="font-size:12px;color:var(--muted)">' + propRoom + '</div></div><div class="field"><label class="field-label">Amount (\xA3)</label><input class="inp" id="ep-amount" type="number" step="0.01" min="0" value="' + amount + '"></div><div class="field"><label class="field-label">Method</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid ' + (method === "bank" ? "var(--accent)" : "var(--border)") + ';cursor:pointer"><input type="radio" name="ep-method" value="bank"' + (method === "bank" ? " checked" : "") + ' style="accent-color:var(--accent)"> Bank</label><label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid ' + (method === "cash" ? "var(--accent)" : "var(--border)") + ';cursor:pointer"><input type="radio" name="ep-method" value="cash"' + (method === "cash" ? " checked" : "") + ' style="accent-color:var(--accent)"> Cash</label></div></div><div style="margin-top:8px;padding:12px;background:var(--red-light);border:1px solid #FECDD3;border-radius:10px"><div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:4px">Revert to Unpaid</div><div style="font-size:11px;color:var(--muted);margin-bottom:8px">Marks this entry as outstanding again.</div><button data-pid="' + idStr + '" onclick="revertPayment(this.dataset.pid)" style="padding:7px 14px;border-radius:8px;border:1px solid var(--red);background:#fff;color:var(--red);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Revert to Outstanding</button></div></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button data-pid="' + idStr + '" onclick="saveEditPayment(this.dataset.pid)" style="padding:9px 20px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Fix</button></div></div></div>';
  }
  function saveEditPayment(payId) {
    var idStr = String(payId), found = false;
    var newAmt = parseFloat(document.getElementById("ep-amount").value) || 0;
    var newMeth = (document.querySelector('input[name="ep-method"]:checked') || { value: "bank" }).value;
    state.payments = state.payments.map(function(p) {
      if (String(p.id) === idStr) {
        found = true;
        return Object.assign({}, p, { amount: newAmt, method: newMeth, paidMethod: newMeth });
      }
      return p;
    });
    if (!found) {
      var sc = state.rentSchedule.find(function(x) {
        return String(x.id) === idStr;
      });
      if (sc) {
        sc.amount = newAmt;
        sc.method = newMeth;
        sc.paidMethod = newMeth;
      }
    }
    saveState();
    closeModal();
    render();
    showToast("Payment updated", "success");
  }
  function revertPayment(payId) {
    var idStr = String(payId);
    if (!confirm("Revert this payment to outstanding?")) return;
    state.payments = state.payments.filter(function(p) {
      return String(p.id) !== idStr;
    });
    var sc = state.rentSchedule.find(function(x) {
      return String(x.id) === idStr;
    });
    if (sc) {
      sc.status = "pending";
      delete sc.paidDate;
      delete sc.paidMethod;
    }
    saveState();
    closeModal();
    render();
    showToast("Payment reverted", "success");
  }
  function renderPropertiesDealView() {
    if (!state.dealInputs) state.dealInputs = {};
    var d = state.dealInputs._scratch || {};
    var isOwned = (d.dealType || "r2r") === "owned";
    var scenarios = Object.keys(state.dealInputs).filter(function(k) {
      return k !== "_scratch" && state.dealInputs[k] && state.dealInputs[k]._name;
    }).map(function(k) {
      return state.dealInputs[k];
    });
    function inp(label, id, val, pfx) {
      return '<div><label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px">' + label + '</label><div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden">' + (pfx ? '<span style="padding:0 8px;font-size:12px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:34px;display:flex;align-items:center;flex-shrink:0">' + pfx + "</span>" : "") + '<input type="number" id="' + id + '" value="' + (val !== void 0 && val !== "" ? val : "") + '" oninput="recalcDealPage()" style="flex:1;border:none;padding:7px 9px;font-size:13px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%"></div></div>';
    }
    var scBar = "";
    if (scenarios.length) {
      scBar = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:var(--bg);border-radius:10px;border:1px solid var(--border)"><span style="font-size:11px;font-weight:700;color:var(--muted)">Saved:</span>';
      scenarios.forEach(function(sc) {
        var net2 = (sc._grossIncome || 0) - (sc._totalCosts || 0);
        scBar += '<div style="display:flex;align-items:center;border:1px solid var(--border);border-radius:20px;background:var(--surface);overflow:hidden"><button data-scid="' + sc._id + '" onclick="loadDealScenario(this.dataset.scid)" style="padding:5px 12px;border:none;background:transparent;font-size:12px;cursor:pointer;font-family:inherit"><span style="font-weight:600">' + sc._name + '</span> <span style="color:' + (net2 >= 0 ? "var(--green)" : "var(--red)") + ';font-weight:700;font-family:monospace">' + fmt(net2) + '/mo</span></button><button data-scid="' + sc._id + '" onclick="deleteDealScenario(this.dataset.scid)" style="padding:5px 8px;border:none;border-left:1px solid var(--border);background:transparent;color:var(--dim);cursor:pointer;font-size:12px">&times;</button></div>';
      });
      scBar += "</div>";
    }
    var html = '<div class="page-header"><div style="display:flex;align-items:center;gap:12px"><button onclick="propViewList()" style="padding:7px 12px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">&larr; Properties</button><div><div class="page-title">Deal Analyzer</div><div class="page-sub">Model any deal before committing</div></div></div><div style="display:flex;gap:8px"><button onclick="saveDealScenario()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Scenario</button><button onclick="resetDealPage()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">Reset</button></div></div>';
    html += scBar;
    var isWhole = (d.lettingType || "hmo") === "whole";
    html += '<div style="display:flex;gap:0;background:var(--bg);border:1.5px solid var(--border);border-radius:11px;padding:3px;margin-bottom:18px;width:fit-content">';
    ["r2r", "owned"].forEach(function(t) {
      var active = (d.dealType || "r2r") === t;
      html += '<button data-dt="' + t + '" onclick="switchDealType(this.dataset.dt)" style="padding:9px 22px;border-radius:8px;border:none;background:' + (active ? "var(--surface)" : "transparent") + ";box-shadow:" + (active ? "0 1px 4px rgba(0,0,0,.1)" : "none") + ";font-size:13px;font-weight:" + (active ? 700 : 500) + ";color:" + (active ? "var(--text)" : "var(--muted)") + ';cursor:pointer;font-family:inherit">' + (t === "r2r" ? "Rent-to-Rent (R2R)" : "Owned / BTL") + "</button>";
    });
    html += "</div>";
    var rentPeriod = d.rentPeriod || "wk";
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:18px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">';
    html += '<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Deal Inputs</div>';
    html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--muted);"><span>Whole Property</span><div data-lt="' + (isWhole ? "hmo" : "whole") + '" onclick="switchLettingType(this.dataset.lt)" style="width:36px;height:20px;border-radius:10px;background:' + (isWhole ? "var(--accent)" : "var(--border)") + ';position:relative;cursor:pointer;transition:background .2s"><div style="width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:2px;left:' + (isWhole ? "18px" : "2px") + ';transition:left .2s"></div></div></label></div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">';
    html += '<div style="opacity:' + (isWhole ? "0.35" : "1") + ";pointer-events:" + (isWhole ? "none" : "auto") + '"><label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px">Rooms</label><div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden"><span style="padding:0 8px;font-size:12px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:34px;display:flex;align-items:center;flex-shrink:0">#</span><input type="number" id="da-rooms" value="' + (d.rooms || 4) + '" oninput="recalcDealPage()" ' + (isWhole ? "disabled" : "") + ' style="flex:1;border:none;padding:7px 9px;font-size:13px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%"></div></div>';
    html += isOwned ? inp("Purchase Price", "da-price", d.price || "", "\xA3") : inp("LL Rent /mo", "da-llrent", d.llrent || "", "\xA3");
    html += '<div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px"><label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">' + (isWhole ? "Tenant Rent" : "Rent / Room") + `</label><div style="display:flex;gap:0;border:1px solid var(--border);border-radius:6px;overflow:hidden"><button onclick="switchRentPeriod('wk')" style="padding:2px 7px;border:none;background:` + (rentPeriod === "wk" ? "var(--accent)" : "var(--bg)") + ";color:" + (rentPeriod === "wk" ? "#fff" : "var(--muted)") + `;font-size:9px;font-weight:700;cursor:pointer;font-family:inherit">wk</button><button onclick="switchRentPeriod('mo')" style="padding:2px 7px;border:none;background:` + (rentPeriod === "mo" ? "var(--accent)" : "var(--bg)") + ";color:" + (rentPeriod === "mo" ? "#fff" : "var(--muted)") + ';font-size:9px;font-weight:700;cursor:pointer;font-family:inherit">mo</button></div></div><div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden"><span style="padding:0 8px;font-size:12px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:34px;display:flex;align-items:center;flex-shrink:0">&pound;</span><input type="number" id="da-wkrent" value="' + (d.wkrent || "") + '" oninput="recalcDealPage()" style="flex:1;border:none;padding:7px 9px;font-size:13px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%"></div></div>';
    html += inp("Occupancy", "da-occ", d.occ || 85, "%");
    html += inp("Bills", "da-bills", d.bills || "", "\xA3");
    html += inp("Maintenance", "da-maint", d.maint || "", "\xA3");
    html += inp("Insurance", "da-insur", d.insur || "", "\xA3");
    html += inp("Management", "da-mgmt", d.mgmt || "", "\xA3");
    html += inp("Void Allowance", "da-void", d.voidCost || "", "\xA3");
    html += inp("Other", "da-other", d.other || "", "\xA3");
    if (isOwned) {
      html += inp("Deposit %", "da-dep", d.dep || 25, "%");
      html += inp("Renovation", "da-reno", d.reno || "", "\xA3");
      html += inp("Mortgage Rate", "da-mrate", d.mrate || 4.5, "%");
      html += inp("Mortgage Term", "da-mterm", d.mterm || 25, "yr");
    }
    html += "</div>";
    if (isOwned) html += '<div id="da-calc-mortgage" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></div>';
    html += "</div>";
    html += '<div id="da-results"><div style="padding:32px;text-align:center;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:14px"><div style="font-size:28px;margin-bottom:8px">&#x1F9EE;</div><div style="font-size:13px">Fill in the figures above to see the analysis</div></div></div>';
    html += '<div style="margin-top:18px;background:linear-gradient(135deg,#0F0F1A,#1a1a3e);border-radius:14px;overflow:hidden"><div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="display:flex;align-items:center;gap:12px"><div style="font-size:24px">&#x1F916;</div><div><div style="font-size:14px;font-weight:700;color:#fff">AI Deal Analysis</div><div style="font-size:11px;color:rgba(255,255,255,.45)">Instant verdict \u2014 strengths, risks, suggestions</div></div></div><button onclick="runDealAI()" style="padding:9px 20px;border-radius:9px;border:none;background:#00D897;color:#000;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Analyze Deal</button></div><div id="da-ai-out" style="padding:0 20px 16px"></div></div>';
    return html;
  }
  function _dealSaveInputsToScratch() {
    function gv(id) {
      var el = document.getElementById(id);
      return el ? parseFloat(el.value) || 0 : 0;
    }
    if (!state.dealInputs) state.dealInputs = {};
    if (!state.dealInputs._scratch) state.dealInputs._scratch = {};
    var sc = state.dealInputs._scratch;
    var roomsEl = document.getElementById("da-rooms");
    if (roomsEl) {
      var rv = parseFloat(roomsEl.value) || 0;
      if (rv > 0) sc.rooms = rv;
    }
    sc.wkrent = gv("da-wkrent");
    sc.occ = gv("da-occ") || 85;
    sc.llrent = gv("da-llrent");
    sc.bills = gv("da-bills");
    sc.maint = gv("da-maint");
    sc.insur = gv("da-insur");
    sc.mgmt = gv("da-mgmt");
    sc.voidCost = gv("da-void");
    sc.other = gv("da-other");
    sc.price = gv("da-price");
    sc.dep = gv("da-dep") || 25;
    sc.reno = gv("da-reno");
    sc.mrate = gv("da-mrate") || 4.5;
    sc.mterm = gv("da-mterm") || 25;
  }
  function recalcDealPage() {
    if (!state.dealInputs) state.dealInputs = {};
    if (!document.getElementById("da-rooms")) return;
    function gv(id, def) {
      var el = document.getElementById(id);
      return el ? parseFloat(el.value) || 0 : def || 0;
    }
    var sc = state.dealInputs._scratch || {};
    var dealType = sc.dealType || "r2r";
    var isOwned = dealType === "owned";
    var isWhole = (sc.lettingType || "hmo") === "whole";
    var inputRooms = Math.max(1, gv("da-rooms", sc.rooms || 4));
    var rooms = isWhole ? 1 : inputRooms;
    var wkRent = gv("da-wkrent", 0);
    var occ = gv("da-occ", 85);
    var llRent = isOwned ? 0 : gv("da-llrent", 0), bills = gv("da-bills", 0), maint = gv("da-maint", 0), insur = gv("da-insur", 0), mgmt = gv("da-mgmt", 0), voidC = gv("da-void", 0), other = gv("da-other", 0);
    var price = isOwned ? gv("da-price", 0) : 0, dep = isOwned ? gv("da-dep", 25) : 0, reno = isOwned ? gv("da-reno", 0) : 0, mrate = isOwned ? gv("da-mrate", 4.5) : 0, mterm = isOwned ? gv("da-mterm", 25) : 0;
    var mortPayment = 0;
    if (isOwned && price && mrate && mterm) {
      var loan = price * (1 - dep / 100), mr = mrate / 100 / 12, n = mterm * 12;
      mortPayment = mr > 0 ? Math.round(loan * mr * Math.pow(1 + mr, n) / (Math.pow(1 + mr, n) - 1)) : 0;
      var mcEl = document.getElementById("da-calc-mortgage");
      if (mcEl) mcEl.innerHTML = mortPayment ? "Est. mortgage: <strong>" + fmt(mortPayment) + "/mo</strong>" : "";
    }
    var primaryCost = isOwned ? mortPayment : llRent;
    var rentPeriod = sc.rentPeriod || "wk";
    var rentMo = rentPeriod === "mo" ? wkRent : wkRent * 52 / 12;
    var grossIncome = isWhole ? Math.round(rentMo * occ / 100) : Math.round(rooms * rentMo * occ / 100);
    var runningCosts = bills + maint + insur + mgmt + voidC + other;
    var totalCosts = primaryCost + runningCosts, net2 = grossIncome - totalCosts, margin = grossIncome > 0 ? Math.round(net2 / grossIncome * 100) : 0, annualNet = net2 * 12;
    var cashIn = isOwned ? Math.max(1, price * dep / 100 + reno) : 0;
    var grossYield = isOwned && price > 0 ? +(grossIncome * 12 / price * 100).toFixed(1) : 0;
    var netYield = isOwned && price > 0 ? +(annualNet / price * 100).toFixed(1) : 0;
    var roi = isOwned && price > 0 && cashIn > 100 && annualNet > 0 ? +(annualNet / cashIn * 100).toFixed(1) : 0;
    var payback = isOwned && price > 0 && cashIn > 100 && net2 > 0 ? +(cashIn / net2 / 12).toFixed(1) : 0;
    var breakEven = !isOwned && grossIncome > 0 ? Math.ceil(totalCosts / (grossIncome / rooms)) : 0;
    state.dealInputs._scratch = { dealType, lettingType: sc.lettingType || "hmo", rentPeriod: sc.rentPeriod || "wk", rooms: inputRooms, wkrent: wkRent, occ, llrent: llRent, bills, maint, insur, mgmt, voidCost: voidC, other, price, dep, reno, mrate, mterm, _grossIncome: grossIncome, _totalCosts: totalCosts };
    clearTimeout(window._dealSaveTimer);
    window._dealSaveTimer = setTimeout(function() {
      saveState();
    }, 800);
    function col(v, g, a) {
      return v >= g ? "var(--green)" : v >= a ? "var(--amber)" : "var(--red)";
    }
    var nc = net2 >= 0 ? "var(--green)" : "var(--red)";
    function kpic(lbl, val, c, sub) {
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">' + lbl + '</div><div style="font-size:22px;font-weight:800;font-family:monospace;color:' + c + '">' + val + "</div>" + (sub ? '<div style="font-size:10px;color:var(--dim);margin-top:3px">' + sub + "</div>" : "") + "</div>";
    }
    var kpiHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' + kpic("Monthly Net", fmt(net2), nc) + kpic("Annual Net", fmt(annualNet), nc);
    if (!isOwned) {
      kpiHtml += kpic("Profit Margin", margin + "%", col(margin, 20, 10), "net / income");
      if (isWhole) {
        var voidMonths = net2 > 0 && totalCosts > 0 ? Math.floor(net2 * 12 / totalCosts * 10) / 10 : 0;
        kpiHtml += kpic("Void Buffer", voidMonths > 0 ? voidMonths + " mo" : "\u2014", col(voidMonths, 3, 1), "months surplus covers void");
      } else {
        kpiHtml += kpic("Break-even", breakEven ? breakEven + " rooms" : "\u2014", breakEven && breakEven <= Math.floor(rooms * 0.75) ? "var(--green)" : "var(--amber)", "rooms to cover costs");
      }
    } else {
      kpiHtml += kpic("Gross Yield", grossYield > 0 ? grossYield + "%" : "\u2014", col(grossYield, 8, 5), "annual rent / price") + kpic("Net Yield", netYield > 0 ? netYield + "%" : "\u2014", col(netYield, 5, 3)) + kpic("Cash ROI", roi > 0 ? roi + "%" : "\u2014", col(roi, 10, 5), "net / cash in") + kpic("Payback", payback > 0 ? payback + " yrs" : "\u2014", payback && payback < 10 ? "var(--green)" : "var(--amber)");
    }
    kpiHtml += "</div>";
    var bp = grossIncome > 0 ? Math.min(100, Math.round(totalCosts / grossIncome * 100)) : 100;
    var plHtml = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Monthly P&L</div><div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--muted)">Gross income (' + occ + '% occ.)</span><span style="font-size:13px;font-weight:700;color:var(--green);font-family:monospace">' + fmt(grossIncome) + "</span></div>" + (isOwned ? '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--muted)">Mortgage</span><span style="font-size:13px;font-weight:700;color:var(--red);font-family:monospace">- ' + fmt(mortPayment) + "</span></div>" : '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--muted)">Landlord rent</span><span style="font-size:13px;font-weight:700;color:var(--red);font-family:monospace">- ' + fmt(llRent) + "</span></div>") + '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--muted)">Running costs</span><span style="font-size:13px;font-weight:700;color:var(--amber);font-family:monospace">- ' + fmt(runningCosts) + '</span></div><div style="display:flex;justify-content:space-between;padding:8px 14px;background:' + (net2 >= 0 ? "var(--green-light)" : "var(--red-light)") + ';margin:6px -14px -14px;border-radius:0 0 11px 11px"><span style="font-size:13px;font-weight:700">Net Profit / Loss</span><span style="font-size:16px;font-weight:800;color:' + nc + ';font-family:monospace">' + fmt(net2) + "/mo</span></div></div>";
    var barHtml = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:8px"><span>Cost ratio: ' + bp + "%</span><span>Income: " + fmt(grossIncome) + '/mo</span></div><div style="height:12px;border-radius:6px;background:var(--green-light);overflow:hidden"><div style="height:100%;width:' + bp + "%;background:" + (bp > 90 ? "var(--red)" : bp > 70 ? "var(--amber)" : "var(--green)") + ';border-radius:6px;transition:width .4s"></div></div><div style="text-align:right;font-size:10px;color:var(--muted);margin-top:5px">' + (bp < 70 ? "Healthy margin" : bp < 90 ? "Tight margin" : "Loss-making") + "</div></div>";
    var MLBLS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], nowM = (/* @__PURE__ */ new Date()).getMonth();
    var maxV = Math.max(grossIncome, totalCosts, 1) * 1.2, W = 380, H = 120, bW = 10, gp = 2, gW = bW * 2 + gp + 9, oX = 28, oY = 8, aH = H - oY - 22;
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;height:120px;display:block">';
    for (var i = 0; i < 12; i++) {
      var x = oX + i * gW, iH = Math.max(2, Math.round(grossIncome / maxV * aH)), cH = Math.max(2, Math.round(totalCosts / maxV * aH));
      svg += '<rect x="' + x + '" y="' + (oY + aH - iH) + '" width="' + bW + '" height="' + iH + '" fill="#10B981" rx="2" opacity=".9"/><rect x="' + (x + bW + gp) + '" y="' + (oY + aH - cH) + '" width="' + bW + '" height="' + cH + '" fill="' + (totalCosts > grossIncome ? "#E8375A" : "#F59E0B") + '" rx="2" opacity=".85"/><text x="' + (x + bW) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="7.5" fill="#94A3B8">' + MLBLS[(i + nowM) % 12] + "</text>";
    }
    svg += '<rect x="4" y="3" width="8" height="8" fill="#10B981" rx="1"/><text x="14" y="10" font-size="8" fill="#64748B">Income</text><rect x="60" y="3" width="8" height="8" fill="#F59E0B" rx="1"/><text x="70" y="10" font-size="8" fill="#64748B">Costs</text></svg>';
    var chartHtml = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">12-Month Projection</div>' + svg + "</div>";
    var yr5 = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;overflow:hidden;margin-bottom:4px"><div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">5-Year Outlook <span style="font-weight:400;text-transform:none">(3% growth, 2% cost inflation)</span></div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg)"><th style="padding:6px 12px;text-align:left;color:var(--muted);font-size:10px;text-transform:uppercase">Year</th><th style="padding:6px 12px;text-align:right;color:var(--muted);font-size:10px;text-transform:uppercase">Income</th><th style="padding:6px 12px;text-align:right;color:var(--muted);font-size:10px;text-transform:uppercase">Costs</th><th style="padding:6px 12px;text-align:right;color:var(--muted);font-size:10px;text-transform:uppercase">Net</th></tr></thead><tbody>';
    for (var yr = 1; yr <= 5; yr++) {
      var yi = Math.round(grossIncome * 12 * Math.pow(1.03, yr - 1)), yc = Math.round(totalCosts * 12 * Math.pow(1.02, yr - 1)), yn = yi - yc;
      yr5 += '<tr style="border-top:1px solid var(--border);background:' + (yr % 2 ? "var(--bg)" : "var(--surface)") + '"><td style="padding:6px 12px;font-weight:600">Year ' + yr + '</td><td style="padding:6px 12px;text-align:right;color:var(--green);font-family:monospace">' + fmt(yi) + '</td><td style="padding:6px 12px;text-align:right;color:var(--red);font-family:monospace">' + fmt(yc) + '</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:' + (yn >= 0 ? "var(--green)" : "var(--red)") + ';font-family:monospace">' + fmt(yn) + "</td></tr>";
    }
    yr5 += "</tbody></table></div>";
    var resEl = document.getElementById("da-results");
    if (resEl) resEl.innerHTML = kpiHtml + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' + plHtml + barHtml + "</div>" + chartHtml + yr5;
    clearTimeout(window._localAnalysisTimer);
    window._localAnalysisTimer = setTimeout(function() {
      var aiOut = document.getElementById("da-ai-out");
      if (aiOut) {
        var result = analyzeLocalDeal();
        if (result) aiOut.innerHTML = renderLocalDealOutput(result);
      }
    }, 600);
  }
  function propViewList() {
    state.filters.propView = "list";
    render();
  }
  function propViewDeal() {
    if (!state.dealInputs) state.dealInputs = {};
    state.dealInputs._scratch = {};
    state.filters.propView = "deal";
    render();
  }
  function switchRentPeriod(period) {
    if (!state.dealInputs) state.dealInputs = {};
    if (!state.dealInputs._scratch) state.dealInputs._scratch = {};
    _dealSaveInputsToScratch();
    state.dealInputs._scratch.rentPeriod = period;
    state.filters.propView = "deal";
    render();
    setTimeout(recalcDealPage, 50);
  }
  function switchLettingType(lt) {
    if (!state.dealInputs) state.dealInputs = {};
    if (!state.dealInputs._scratch) state.dealInputs._scratch = {};
    _dealSaveInputsToScratch();
    state.dealInputs._scratch.lettingType = lt;
    state.filters.propView = "deal";
    saveState();
    render();
    setTimeout(recalcDealPage, 50);
  }
  function switchDealType(t) {
    if (!state.dealInputs) state.dealInputs = {};
    if (!state.dealInputs._scratch) state.dealInputs._scratch = {};
    _dealSaveInputsToScratch();
    state.dealInputs._scratch.dealType = t;
    state.filters.propView = "deal";
    saveState();
    render();
    setTimeout(recalcDealPage, 50);
  }
  function resetDealPage() {
    if (!state.dealInputs) state.dealInputs = {};
    delete state.dealInputs._scratch;
    state.filters.propView = "deal";
    saveState();
    render();
  }
  function saveDealScenario() {
    if (!state.dealInputs || !state.dealInputs._scratch) {
      showToast("Enter some figures first", "error");
      return;
    }
    var name = prompt("Name this scenario:");
    if (!name) return;
    var id = "sc_" + Date.now();
    state.dealInputs[id] = Object.assign({}, state.dealInputs._scratch, { _name: name, _id: id });
    state.filters.propView = "deal";
    saveState();
    render();
    showToast("Saved: " + name, "success");
  }
  function loadDealScenario(id) {
    if (!state.dealInputs || !state.dealInputs[id]) return;
    state.dealInputs._scratch = Object.assign({}, state.dealInputs[id]);
    state.page = "properties";
    state.filters.propView = "deal";
    saveState();
    render();
  }
  function deleteDealScenario(id) {
    if (!state.dealInputs || !state.dealInputs[id]) return;
    if (!confirm('Delete "' + state.dealInputs[id]._name + '"?')) return;
    delete state.dealInputs[id];
    state.filters.propView = "deal";
    saveState();
    render();
  }
  async function runDealAI() {
    var outEl = document.getElementById("da-ai-out");
    if (!outEl) return;
    _dealSaveInputsToScratch();
    var d = state.dealInputs && state.dealInputs._scratch || {};
    if (!d.rooms && !d.wkrent) {
      showToast("Enter deal figures first", "error");
      return;
    }
    var isOwned = d.dealType === "owned", grossIncome = d._grossIncome || 0, totalCosts = d._totalCosts || 0, net2 = grossIncome - totalCosts;
    var margin = grossIncome > 0 ? Math.round(net2 / grossIncome * 100) : 0, cashIn = isOwned ? Math.max(1, (d.price || 0) * (d.dep || 25) / 100 + (d.reno || 0)) : 0;
    var roi = cashIn && net2 && (d.price || 0) > 0 ? +(net2 * 12 / cashIn * 100).toFixed(1) : 0;
    var grossYield = isOwned && (d.price || 0) > 0 ? +(grossIncome * 12 / d.price * 100).toFixed(1) : 0;
    var breakEven = !isOwned && grossIncome > 0 ? Math.ceil(totalCosts / (grossIncome / Math.max(1, d.rooms || 1))) : 0;
    outEl.innerHTML = '<div style="padding:12px 0;display:flex;align-items:center;gap:10px"><div style="width:20px;height:20px;border:2px solid #00D897;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></div><span style="font-size:12px;color:rgba(255,255,255,.5)">Analyzing...</span></div>';
    var prompt2 = "UK property investment expert. Analyze this " + (isOwned ? "BTL" : "R2R") + " deal. Return ONLY valid JSON, no markdown.\nRooms: " + (d.rooms || 0) + "\nWeekly rent/room: " + (d.wkrent || 0) + "\nOccupancy: " + (d.occ || 85) + "%\nGross monthly income: " + grossIncome + "\nTotal costs: " + totalCosts + "\nNet monthly: " + net2 + "\nMargin: " + margin + "%\n" + (isOwned ? "Purchase: " + (d.price || 0) + ", Cash in: " + cashIn + ", Yield: " + grossYield + "%\n" : "Break-even: " + breakEven + " rooms\n") + 'Return: {"score":0-100,"verdict":"GO|CAUTION|NO-GO","headline":"under 20 words","strengths":["max 3"],"risks":["max 3"],"suggestions":["max 3"]}';
    function liDeal(arr, icon, c) {
      return (arr || []).map(function(s) {
        return '<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:rgba(255,255,255,.75);margin-bottom:5px;line-height:1.45"><span style="color:' + c + ';flex-shrink:0;margin-top:1px">' + icon + "</span>" + s + "</div>";
      }).join("");
    }
    function applyCloudResult(r2) {
      var vCol = r2.verdict === "GO" ? "#00D897" : r2.verdict === "CAUTION" ? "#F5A623" : "#FF4D6A";
      outEl.innerHTML = '<div style="padding:12px 0"><div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="width:52px;height:52px;border-radius:50%;border:2.5px solid ' + vCol + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><div style="font-size:18px;font-weight:800;color:' + vCol + '">' + r2.score + '</div></div><div><div style="font-size:15px;font-weight:800;color:' + vCol + ';margin-bottom:3px">' + r2.verdict + '</div><div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.4">' + r2.headline + "</div></div></div>" + (r2.strengths && r2.strengths.length ? '<div style="margin-bottom:10px">' + liDeal(r2.strengths, "&#x2713;", "#00D897") + "</div>" : "") + (r2.risks && r2.risks.length ? '<div style="margin-bottom:10px">' + liDeal(r2.risks, "!", "#FF4D6A") + "</div>" : "") + (r2.suggestions && r2.suggestions.length ? "<div>" + liDeal(r2.suggestions, "&#x2192;", "#F5A623") + "</div>" : "") + "</div>";
    }
    try {
      var res = await fetchAiMessages({ model: "claude-sonnet-4-20250514", max_tokens: 700, messages: [{ role: "user", content: prompt2 }] });
      var data = await res.json();
      if (!res.ok) {
        var msg = data && data.error && (typeof data.error === "string" ? data.error : data.error.message) || "AI unavailable";
        throw new Error(msg);
      }
      if (data.error) throw new Error(typeof data.error === "string" ? data.error : data.error.message || "AI error");
      var txt = (data.content || []).map(function(b) {
        return b.text || "";
      }).join("").replace(/```json|```/g, "").trim();
      var r = JSON.parse(txt);
      applyCloudResult(r);
    } catch (err) {
      var localResult = analyzeLocalDeal();
      outEl.innerHTML = renderLocalDealOutput(localResult);
      if (localResult) showToast("Showing local analysis \u2014 " + err.message, "warn");
      else outEl.innerHTML = '<div style="padding:8px 0;font-size:12px;color:#FF4D6A">' + err.message + "</div>";
    }
  }
  async function syncRoomPhotosBackground() {
    try {
      var storageResult = await supa.storage.from("room-media").list("rooms", { limit: 500 });
      if (storageResult.error || !storageResult.data || storageResult.data.length === 0) return;
      var propFolders = storageResult.data.filter(function(f) {
        return f && f.name;
      });
      var roomFetches = propFolders.map(function(_propFolder) {
        var _spid = _propFolder.name;
        return supa.storage.from("room-media").list("rooms/" + _spid, { limit: 100 }).then(function(_roomsResult) {
          if (_roomsResult.error || !_roomsResult.data) return Promise.resolve();
          var roomFolders = _roomsResult.data.filter(function(r) {
            return r && r.name && !isNaN(parseInt(r.name));
          });
          return Promise.all(roomFolders.map(function(_roomFolder) {
            var _srn = parseInt(_roomFolder.name);
            return supa.storage.from("room-media").list("rooms/" + _spid + "/" + _srn, { limit: 20 }).then(function(_photosResult) {
              if (_photosResult.error || !_photosResult.data || _photosResult.data.length === 0) return;
              var _media = getMedia(_spid, _srn);
              var added = false;
              _photosResult.data.forEach(function(_file) {
                if (!_file || !_file.name) return;
                var _path = "rooms/" + _spid + "/" + _srn + "/" + _file.name;
                var _urlData = supa.storage.from("room-media").getPublicUrl(_path);
                var _url = _urlData.data.publicUrl;
                var _exists = _media.photos.some(function(ph) {
                  return ph.src === _url || ph.path === _path;
                });
                if (!_exists) {
                  _media.photos.push({ src: _url, name: _file.name, path: _path });
                  added = true;
                }
              });
              return added;
            });
          }));
        });
      });
      await Promise.all(roomFetches);
      try {
        localStorage.setItem("pm_local_roomMedia", JSON.stringify(state.roomMedia));
      } catch (e) {
      }
      console.log("Room photos synced in background");
    } catch (_se) {
      console.warn("Background room sync error:", _se);
    }
  }
  function renderPropFinanceTab(p, propTenants) {
    var isOwned = p.ownershipType === "owned";
    var isWhole = p.lettingType === "whole";
    var mort = p.mortgage || {};
    var purchase = p.purchaseInfo || {};
    var activeTenants = propTenants.filter(function(t) {
      return t.status !== "inactive";
    });
    var monthlyIncome = Math.round(activeTenants.reduce(function(s, t) {
      return s + (t.freq === "monthly" ? t.rent : (t.rent || 0) * 52 / 12);
    }, 0));
    var monthlyOutgoing = p.landlord || 0;
    var monthlyProfit = monthlyIncome - monthlyOutgoing;
    var annualIncome = monthlyIncome * 12;
    var annualOutgoing = monthlyOutgoing * 12;
    var annualProfit = monthlyProfit * 12;
    var propExpenses = (state.expenses || []).filter(function(e) {
      return e.property === p.name && e.status !== "cancelled";
    });
    var monthlyExpenses = Math.round(propExpenses.reduce(function(s, e) {
      if (e.freq === "monthly") return s + (e.amount || 0);
      if (e.freq === "weekly") return s + (e.amount || 0) * 52 / 12;
      if (e.freq === "annual") return s + (e.amount || 0) / 12;
      return s;
    }, 0));
    var netProfit = monthlyProfit - monthlyExpenses;
    var propPayments = (state.payments || []).filter(function(py) {
      return py.property === p.name && py.status === "paid";
    });
    var totalCollected = Math.round(propPayments.reduce(function(s, py) {
      return s + (py.amount || 0);
    }, 0));
    var totalPaidToLL = Math.round((state.landlordPayments || []).filter(function(lp) {
      return lp.propId === p.id && lp.status === "paid";
    }).reduce(function(s, lp) {
      return s + (lp.amount || 0);
    }, 0));
    var totalArrears = Math.round(activeTenants.reduce(function(s, t) {
      return s + (t.arrears || 0);
    }, 0));
    var occupancyPct = p.rooms ? Math.round(p.occupied / p.rooms * 100) : 0;
    var voidRooms = p.rooms - p.occupied;
    var voidCostPerMonth = isWhole ? 0 : Math.round(
      (p.roomList || []).filter(function(r) {
        return r.status === "vacant";
      }).reduce(function(s, r) {
        return s + (r.price || 0) * 52 / 12;
      }, 0)
    );
    var estValue = purchase.estimatedValue || 0;
    var purchasePrice = purchase.purchasePrice || 0;
    var outstanding = mort.outstandingBalance || 0;
    var equity = estValue ? estValue - outstanding : 0;
    var ltv = estValue ? Math.round(outstanding / estValue * 100) : 0;
    var capitalGain = purchasePrice ? estValue - purchasePrice : 0;
    var grossYield = estValue && annualIncome ? +(annualIncome / estValue * 100).toFixed(1) : 0;
    var netYield = estValue && annualProfit ? +(annualProfit / estValue * 100).toFixed(1) : 0;
    var cashInvested = purchasePrice && outstanding ? purchasePrice - outstanding : purchasePrice;
    var roi = cashInvested && annualProfit ? +(annualProfit / cashInvested * 100).toFixed(1) : 0;
    function kpi2(label, value, color, sub) {
      return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">' + label + '</div><div style="font-size:20px;font-weight:800;font-family:monospace;color:' + (color || "var(--text)") + '">' + value + "</div>" + (sub ? '<div style="font-size:10px;color:var(--muted);margin-top:3px">' + sub + "</div>" : "") + "</div>";
    }
    function section(title, emoji) {
      return '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:18px 0 10px;display:flex;align-items:center;gap:6px">' + (emoji || "") + " " + title + "</div>";
    }
    function row(label, value, color) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:13px;color:var(--muted)">' + label + '</span><span style="font-size:13px;font-weight:700;color:' + (color || "var(--text)") + '">' + value + "</span></div>";
    }
    var html = "";
    html += section("Monthly Snapshot", "\u{1F4C5}");
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px">';
    html += kpi2("Income", fmt(monthlyIncome), "var(--green)");
    html += kpi2(isOwned ? "Mortgage" : "LL Rent", fmt(monthlyOutgoing), "var(--red)");
    html += kpi2("Profit", fmt(monthlyProfit), monthlyProfit >= 0 ? "var(--green)" : "var(--red)");
    html += "</div>";
    if (monthlyExpenses > 0) {
      html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px">';
      html += kpi2("Expenses/mo", fmt(monthlyExpenses), "var(--amber)");
      html += kpi2("Net after exp.", fmt(netProfit), netProfit >= 0 ? "var(--green)" : "var(--red)");
      html += "</div>";
    }
    html += section("Annual Projection", "\u{1F4C8}");
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">';
    html += row("Gross income", fmt(annualIncome), "var(--green)");
    html += row(isOwned ? "Mortgage payments" : "Landlord rent", fmt(annualOutgoing), "var(--red)");
    if (monthlyExpenses) html += row("Running expenses", fmt(monthlyExpenses * 12), "var(--amber)");
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;background:' + (annualProfit - monthlyExpenses * 12 >= 0 ? "var(--green-light)" : "var(--red-light)") + ';"><span style="font-size:13px;font-weight:700;color:var(--text);padding-left:0">Net annual profit</span><span style="font-size:15px;font-weight:800;color:' + (annualProfit - monthlyExpenses * 12 >= 0 ? "var(--green)" : "var(--red)") + '">' + fmt(annualProfit - monthlyExpenses * 12) + "</span></div>";
    html += "</div>";
    if (!isWhole) {
      html += section("Occupancy & Voids", "\u{1F3E0}");
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
      html += kpi2("Occupancy", occupancyPct + "%", occupancyPct === 100 ? "var(--green)" : occupancyPct < 70 ? "var(--red)" : "var(--amber)");
      html += kpi2("Void rooms", voidRooms, voidRooms === 0 ? "var(--green)" : "var(--red)");
      html += kpi2("Void cost/mo", fmt(voidCostPerMonth), voidCostPerMonth > 0 ? "var(--red)" : "var(--muted)", "lost income");
      html += "</div>";
    }
    html += section("Payment History", "\u{1F4B3}");
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">';
    html += row("Total rent collected", fmt(totalCollected), "var(--green)");
    if (totalPaidToLL) html += row(isOwned ? "Total mortgage paid" : "Total paid to landlord", fmt(totalPaidToLL), "var(--red)");
    if (totalArrears) html += row("Current arrears", fmt(totalArrears), "var(--red)");
    html += "</div>";
    if (isOwned) {
      html += section("Investment Metrics", "\u{1F3E6}");
      if (!estValue && !purchasePrice) {
        html += '<div style="background:var(--bg);border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;color:var(--muted)"><div style="font-size:24px;margin-bottom:8px">\u{1F4CA}</div><div style="font-size:13px;font-weight:600;margin-bottom:4px">Add property values to see investment metrics</div><div style="font-size:11px">Enter purchase price, estimated value and mortgage balance in the Details tab</div></div>';
      } else {
        html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:8px">';
        if (estValue) html += kpi2("Est. value", "\xA3" + estValue.toLocaleString("en-GB"), "var(--blue)");
        if (equity) html += kpi2("Equity", fmt(equity), equity > 0 ? "var(--green)" : "var(--red)");
        if (ltv) html += kpi2("LTV", ltv + "%", ltv > 75 ? "var(--red)" : ltv > 60 ? "var(--amber)" : "var(--green)");
        if (capitalGain) html += kpi2("Capital gain", fmt(capitalGain), capitalGain > 0 ? "var(--green)" : "var(--red)", "vs purchase");
        html += "</div>";
        html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
        if (grossYield) html += kpi2("Gross yield", grossYield + "%", grossYield >= 6 ? "var(--green)" : grossYield >= 4 ? "var(--amber)" : "var(--red)", "annual rent \xF7 value");
        if (netYield) html += kpi2("Net yield", netYield + "%", netYield >= 4 ? "var(--green)" : netYield >= 2 ? "var(--amber)" : "var(--red)", "net profit \xF7 value");
        if (roi) html += kpi2("Cash ROI", roi + "%", roi >= 10 ? "var(--green)" : roi >= 5 ? "var(--amber)" : "var(--red)", "profit \xF7 cash in");
        html += "</div>";
        if (mort.lender) {
          html += section("Mortgage", "\u{1F3E6}");
          html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">';
          html += row("Lender", mort.lender);
          if (mort.rate) html += row("Rate", mort.rate + "% " + (mort.rateType || ""), mort.rateType === "svr" ? "var(--red)" : "var(--text)");
          if (mort.monthlyPayment) html += row("Monthly payment", fmt(mort.monthlyPayment), "var(--red)");
          if (mort.outstandingBalance) html += row("Outstanding balance", "\xA3" + mort.outstandingBalance.toLocaleString("en-GB"));
          if (mort.fixEndDate) {
            var fixDate = new Date(mort.fixEndDate);
            var daysLeft = Math.round((fixDate - /* @__PURE__ */ new Date()) / 864e5);
            var fixColor = daysLeft < 90 ? "var(--red)" : daysLeft < 180 ? "var(--amber)" : "var(--green)";
            html += row("Fix ends", fixDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ' <span style="font-size:11px;color:' + fixColor + ';font-weight:700">(' + (daysLeft > 0 ? daysLeft + " days" : "EXPIRED") + ")</span>");
          }
          html += "</div>";
        }
      }
    }
    if (!isOwned && monthlyIncome && monthlyOutgoing) {
      var margin = +(monthlyProfit / monthlyIncome * 100).toFixed(1);
      var beRooms = p.rooms && monthlyIncome ? Math.ceil(monthlyOutgoing / (monthlyIncome / p.rooms)) : 0;
      html += section("R2R Margin Analysis", "");
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">';
      html += kpi2("Gross margin", margin + "%", margin >= 20 ? "var(--green)" : margin >= 10 ? "var(--amber)" : "var(--red)", "net / income");
      html += kpi2("Profit/room", p.rooms ? fmt(Math.round(monthlyProfit / p.rooms)) + "/mo" : "\u2014", monthlyProfit > 0 ? "var(--green)" : "var(--red)");
      html += kpi2("Break-even", beRooms ? beRooms + " rooms" : "\u2014", beRooms && beRooms <= Math.floor(p.rooms * 0.7) ? "var(--green)" : "var(--amber)", "to cover costs");
      html += "</div>";
      var bp = monthlyIncome > 0 ? Math.min(100, Math.round(monthlyOutgoing / monthlyIncome * 100)) : 100;
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:12px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:6px"><span>LL Rent: ' + fmt(monthlyOutgoing) + "</span><span>Income: " + fmt(monthlyIncome) + "</span></div>";
      html += '<div style="height:8px;border-radius:4px;background:var(--green-light);overflow:hidden"><div style="height:100%;width:' + bp + "%;background:" + (bp > 85 ? "var(--red)" : bp > 65 ? "var(--amber)" : "var(--green)") + ';border-radius:4px"></div></div>';
      html += '<div style="text-align:right;font-size:10px;color:var(--muted);margin-top:3px">' + bp + "% of income on LL rent</div></div>";
    }
    if (monthlyIncome > 0) {
      var MLBLS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var nowM = (/* @__PURE__ */ new Date()).getMonth(), tOut = monthlyOutgoing + monthlyExpenses;
      var maxV = Math.max(monthlyIncome, tOut, 1) * 1.2;
      var svgW = 320, svgH = 100, bW = 9, gp = 2, gW = bW * 2 + gp + 8, oX = 26, oY = 6, aH = svgH - oY - 22;
      var svgStr = '<svg viewBox="0 0 ' + svgW + " " + svgH + '" style="width:100%;height:100px;display:block">';
      for (var _i = 0; _i < 12; _i++) {
        var _x = oX + _i * gW;
        var _iH = Math.max(2, Math.round(monthlyIncome / maxV * aH));
        var _cH = Math.max(2, Math.round(tOut / maxV * aH));
        svgStr += '<rect x="' + _x + '" y="' + (oY + aH - _iH) + '" width="' + bW + '" height="' + _iH + '" fill="#10B981" rx="2" opacity=".85"/>';
        svgStr += '<rect x="' + (_x + bW + gp) + '" y="' + (oY + aH - _cH) + '" width="' + bW + '" height="' + _cH + '" fill="' + (tOut > monthlyIncome ? "#E8375A" : "#F59E0B") + '" rx="2" opacity=".8"/>';
        svgStr += '<text x="' + (_x + bW) + '" y="' + (svgH - 4) + '" text-anchor="middle" font-size="7" fill="#94A3B8">' + MLBLS[(_i + nowM) % 12] + "</text>";
      }
      svgStr += '<rect x="4" y="3" width="7" height="7" fill="#10B981" rx="1"/><text x="13" y="10" font-size="7.5" fill="#64748B">Income</text><rect x="56" y="3" width="7" height="7" fill="#F59E0B" rx="1"/><text x="65" y="10" font-size="7.5" fill="#64748B">Costs</text></svg>';
      html += section("12-Month Forecast", "");
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px"><div style="font-size:11px;color:var(--muted);margin-bottom:6px">Net: ' + fmt(monthlyIncome - tOut) + "/mo</div>" + svgStr + "</div>";
    }
    return html;
  }
  function archiveProperty(id) {
    var p = state.properties.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!p) return;
    var activeT = state.tenants.filter(function(t) {
      return t.property === p.name && (t.status === "active" || t.status === "notice_given");
    });
    var msg = activeT.length > 0 ? "This property has " + activeT.length + " active tenant(s). Archive anyway?\n\nActive tenants will remain linked but property hidden from main view." : 'Archive "' + p.name + '"?\n\nHidden from main view. Restore or delete from Archived tab.';
    if (!confirm(msg)) return;
    p.status = "archived";
    p.archivedDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    saveState();
    closeModal();
    state.filters.props = "archived";
    render();
    showToast(p.name + " archived", "success");
  }
  function deletePropPermanent(id) {
    var p = state.properties.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!p) return;
    if (p.status !== "archived") {
      showToast("Archive first before deleting", "error");
      return;
    }
    if (!confirm('PERMANENTLY DELETE "' + p.name + '"?\n\nThis cannot be undone.')) return;
    try {
      supa.from("properties").delete().eq("id", String(id)).then(function() {
      });
    } catch (e) {
    }
    state.properties = state.properties.filter(function(x) {
      return String(x.id) !== String(id);
    });
    saveState();
    closeModal();
    render();
    showToast(p.name + " permanently deleted", "success");
  }
  function restoreProperty(id) {
    var p = state.properties.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!p) return;
    p.status = "active";
    delete p.archivedDate;
    saveState();
    closeModal();
    state.filters.props = "all";
    render();
    showToast(p.name + " restored", "success");
  }
  function archiveTenant(id) {
    var t = state.tenants.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!t) return;
    if (!confirm('Archive "' + t.name + '"?\n\nMoved to Archived tab. Restore or delete from there.')) return;
    var oldProp = t.property, oldRoom = t.room;
    t.status = "inactive";
    t.archivedDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    freeRoom(oldProp, oldRoom);
    saveState();
    closeModal();
    state.filters.tenants = "archived";
    render();
    showToast(t.name + " archived", "success");
  }
  function deleteTenantPermanent(id) {
    var t = state.tenants.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!t) return;
    if (t.status !== "inactive") {
      showToast("Archive first before deleting", "error");
      return;
    }
    if (!confirm('PERMANENTLY DELETE "' + t.name + '"?\n\nAll payment history removed. Cannot be undone.')) return;
    try {
      supa.from("tenants").delete().eq("id", String(id)).then(function() {
      });
    } catch (e) {
    }
    state.tenants = state.tenants.filter(function(x) {
      return String(x.id) !== String(id);
    });
    state.payments = state.payments.filter(function(x) {
      return x.tenantId !== String(id) && x.tenantName !== t.name;
    });
    saveState();
    closeModal();
    render();
    showToast(t.name + " permanently deleted", "success");
  }
  function restoreTenant(id) {
    var t = state.tenants.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!t) return;
    t.status = "active";
    delete t.archivedDate;
    if (t.property && t.room) occupyRoom(t.property, t.room, t.rent);
    saveState();
    closeModal();
    state.filters.tenants = "all";
    render();
    showToast(t.name + " restored", "success");
  }
  function savePropDetail(id) {
    const p = state.properties.find((x) => x.id === id);
    if (!p) return;
    const name = document.getElementById("pd-name").value;
    const oldName = p.name;
    p.name = name;
    p.address = document.getElementById("pd-address").value;
    p.area = document.getElementById("pd-area").value;
    p.type = document.getElementById("pd-type").value;
    var owEl = document.querySelector('input[name="pd-ownership"]:checked');
    var ltEl = document.querySelector('input[name="pd-letting"]:checked');
    if (owEl) p.ownershipType = owEl.value;
    if (ltEl) p.lettingType = ltEl.value;
    var isOwned = p.ownershipType === "owned";
    var isWhole = p.lettingType === "whole";
    if (isWhole) {
      p.bedrooms = +(document.getElementById("pd-bedrooms") || { value: p.bedrooms || 3 }).value || p.bedrooms || 3;
      p.rooms = 1;
    } else {
      p.rooms = +document.getElementById("pd-rooms").value || p.rooms;
      p.bedrooms = null;
    }
    p.landlord = +document.getElementById("pd-landlord").value || p.landlord;
    var propTenants = state.tenants.filter(function(t) {
      return t.property === p.name && t.status !== "inactive";
    });
    p.rent = Math.round(propTenants.reduce(function(s, t) {
      return s + (t.freq === "monthly" ? t.rent : (t.rent || 0) * 52 / 12);
    }, 0));
    p.landlordName = isOwned ? "" : (document.getElementById("pd-lname") || { value: p.landlordName || "" }).value;
    p.landlordPhone = isOwned ? "" : (document.getElementById("pd-lphone") || { value: p.landlordPhone || "" }).value;
    p.mapsUrl = document.getElementById("pd-maps").value;
    p.notes = document.getElementById("pd-notes").value;
    var _pcoEl = document.getElementById("pd-company");
    if (_pcoEl) p.companyId = _pcoEl.value;
    if (isOwned) {
      var mLender = (document.getElementById("pd-m-lender") || { value: "" }).value.trim();
      var mPayment = +(document.getElementById("pd-m-payment") || { value: 0 }).value || 0;
      var mRate = +(document.getElementById("pd-m-rate") || { value: 0 }).value || 0;
      var mRateType = (document.getElementById("pd-m-ratetype") || { value: "fixed" }).value;
      var mFixEnd = (document.getElementById("pd-m-fixend") || { value: "" }).value || null;
      var mBalance = +(document.getElementById("pd-m-balance") || { value: 0 }).value || 0;
      p.mortgage = { lender: mLender, monthlyPayment: mPayment, rate: mRate, rateType: mRateType, fixEndDate: mFixEnd, outstandingBalance: mBalance };
      if (!p.landlord && mPayment) p.landlord = mPayment;
    } else {
      p.mortgage = null;
    }
    if (isOwned) {
      var pPrice = +(document.getElementById("pd-p-purchase") || { value: 0 }).value || 0;
      var pDate = (document.getElementById("pd-p-date") || { value: "" }).value || null;
      var pVal = +(document.getElementById("pd-p-value") || { value: 0 }).value || 0;
      var pStr = (document.getElementById("pd-p-structure") || { value: "sole" }).value;
      p.purchaseInfo = { purchasePrice: pPrice, purchaseDate: pDate, estimatedValue: pVal, ownershipStructure: pStr };
    } else {
      p.purchaseInfo = null;
    }
    if (name !== oldName) {
      state.tenants = state.tenants.map((t) => t.property === oldName ? { ...t, property: name } : t);
      state.payments = state.payments.map((pay) => pay.property === oldName ? { ...pay, property: name } : pay);
      state.maintenance = state.maintenance.map((m) => m.property === oldName ? { ...m, property: name } : m);
    }
    state.propDetailTab = null;
    closeModal();
    render();
  }
  function updateRoomPrice(propId, roomN, val) {
    const p = state.properties.find((x) => x.id === propId);
    if (!p || !p.roomList) return;
    const r = p.roomList.find((r2) => r2.n === roomN);
    if (r) r.price = +val;
    p.rent = Math.round(p.roomList.filter((r2) => r2.status === "occupied").reduce((s, r2) => s + r2.price * 52 / 12, 0));
    p.rooms = p.roomList.length;
    p.occupied = p.roomList.filter((r2) => r2.status === "occupied").length;
    var t = state.tenants.find(function(tt) {
      return tt.property === p.name && tt.room === roomN && tt.status !== "inactive";
    });
    if (t) {
      t.rent = +val;
      rebuildTenantSchedule(t.id);
    }
    saveState();
  }
  function updateRoomType(propId, roomN, newType) {
    var p = state.properties.find(function(x) {
      return x.id === propId;
    });
    if (!p || !p.roomList) return;
    var r = p.roomList.find(function(r2) {
      return r2.n === roomN;
    });
    if (r) r.type = newType;
    saveState();
  }
  function toggleRoomStatus(propId, roomN) {
    const p = state.properties.find((x) => x.id === propId);
    if (!p || !p.roomList) return;
    const r = p.roomList.find((r2) => r2.n === roomN);
    if (r) r.status = r.status === "occupied" ? "vacant" : "occupied";
    p.occupied = p.roomList.filter((r2) => r2.status === "occupied").length;
    p.rent = Math.round(p.roomList.filter((r2) => r2.status === "occupied").reduce(function(s, r2) {
      return s + r2.price * 52 / 12;
    }, 0));
    if (!state.voidDates) state.voidDates = {};
    var key = p.id + "_" + roomN;
    if (r && r.status === "vacant") {
      if (!state.voidDates[key]) state.voidDates[key] = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    } else {
      delete state.voidDates[key];
    }
    openPropDetail(propId);
  }
  function addRoomToProp(propId) {
    const p = state.properties.find((x) => x.id === propId);
    if (!p) return;
    if (!p.roomList) p.roomList = [];
    const nextN = p.roomList.length + 1;
    const avgPrice = p.roomList.length ? Math.round(p.roomList.reduce(function(s, r) {
      return s + r.price;
    }, 0) / p.roomList.length) : 200;
    var types = ["Single", "Double", "Suite", "Studio", "Whole House"];
    var typeStr = types.map(function(t, i) {
      return i + 1 + ". " + t;
    }).join("\n");
    var choice = prompt("Choose room type:\n" + typeStr + "\n\nEnter number (1-5):", "1");
    if (choice === null) return;
    var typeIdx = parseInt(choice) - 1;
    var roomType = typeIdx >= 0 && typeIdx < types.length ? types[typeIdx] : "Single";
    p.roomList.push({ n: nextN, type: roomType, price: avgPrice, status: "vacant" });
    p.rooms = p.roomList.length;
    p.occupied = p.roomList.filter((r) => r.status === "occupied").length;
    p.rent = Math.round(p.roomList.filter((r) => r.status === "occupied").reduce(function(s, r) {
      return s + r.price * 52 / 12;
    }, 0));
    openPropDetail(propId);
  }
  function markLandlordPaid(llId, payId) {
    var pay = (state.landlordPayments || []).find(function(p) {
      return p.id === payId;
    });
    if (!pay) {
      console.warn("markLandlordPaid: entry not found for id:", payId, "total entries:", state.landlordPayments.length);
      return;
    }
    pay.status = "paid";
    pay.paidDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    saveState();
    render();
  }
  function ensureLandlordSchedule() {
    if (!state.landlordPayments) state.landlordPayments = [];
    state.landlordPayments = state.landlordPayments.filter(function(p) {
      return p.propId !== void 0 && p.propId !== null;
    });
    var now = /* @__PURE__ */ new Date();
    var months = [];
    for (var offset = -3; offset <= 2; offset++) {
      var d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      var y = d.getFullYear(), m = d.getMonth();
      var key = y + "-" + (m + 1 < 10 ? "0" : "") + (m + 1);
      var label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      months.push({ key, label, ts: d.getTime() });
    }
    state.landlords.forEach(function(ll) {
      var llProps = state.properties.filter(function(p) {
        return p.landlordName === ll.name && p.landlord > 0;
      });
      if (!llProps.length) return;
      llProps.forEach(function(prop) {
        months.forEach(function(mo) {
          var exists = state.landlordPayments.find(function(p) {
            return p.landlordId === ll.id && p.propId === prop.id && p.monthKey === mo.key;
          });
          if (!exists) {
            state.landlordPayments.push({
              id: crypto.randomUUID(),
              landlordId: ll.id,
              landlordName: ll.name,
              propId: prop.id,
              monthKey: mo.key,
              monthLabel: mo.label,
              propName: prop.name,
              property: prop.name,
              amount: prop.landlord,
              dueDate: "01 " + mo.label,
              dueDateTs: mo.ts,
              paidDate: null,
              method: "bank",
              status: "pending",
              ref: "LP-" + mo.key + "-" + prop.id
            });
          }
        });
      });
    });
  }
  function renderLandlords() {
    ensureLandlordSchedule();
    var lls = state.landlords || [];
    var lpays = state.landlordPayments || [];
    var selLL = state.filters.landlords || "all";
    var selMonth = state.filters.landlordMonth || "";
    var filteredPays = lpays;
    if (selMonth) {
      var mo = MONTHS.find(function(m) {
        return m.key === selMonth;
      });
      if (mo) {
        filteredPays = lpays.filter(function(p) {
          if (!p.dueDate) return false;
          var d = new Date(p.dueDate.replace(/ /g, "-"));
          return d >= mo.from && d <= mo.to;
        });
      }
    }
    var selLLCo = state.filters.landlordCompany || "";
    if (selLLCo) {
      var _coProps = state.properties.filter(function(p) {
        return p.companyId === selLLCo;
      }).map(function(p) {
        return p.name;
      });
      lls = lls.filter(function(ll) {
        return state.properties.some(function(p) {
          return p.landlordName === ll.name && _coProps.indexOf(p.name) >= 0;
        });
      });
      var _coLLNames = lls.map(function(ll) {
        return ll.name;
      });
      filteredPays = filteredPays.filter(function(p) {
        return _coLLNames.indexOf(p.landlordName) >= 0 || _coProps.indexOf(p.propName) >= 0 || _coProps.indexOf(p.property) >= 0;
      });
    }
    var totalOwed = filteredPays.filter(function(p) {
      return p.status === "pending";
    }).reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var totalPaidAll = filteredPays.filter(function(p) {
      return p.status === "paid";
    }).reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var pendingCount = filteredPays.filter(function(p) {
      return p.status === "pending";
    }).length;
    var totalMonthly = lls.reduce(function(s, ll) {
      var llProps = (state.properties || []).filter(function(p) {
        return p.landlordName === ll.name && (!selLLCo || p.companyId === selLLCo);
      });
      return s + llProps.reduce(function(ss, p) {
        return ss + p.landlord;
      }, 0);
    }, 0);
    var html = '<div class="page-header"><div><div class="page-title">Landlords</div><div class="page-sub">' + lls.length + " landlords \xB7 " + pendingCount + " payments pending" + (selMonth ? " \xB7 " + MONTHS.find(function(m) {
      return m.key === selMonth;
    }).label : "") + '</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select onchange="state.filters.landlordCompany=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer"><option value="">&#x1F3E2; All Companies</option>' + (state.companies || []).map(function(c) {
      return '<option value="' + c.id + '" ' + (selLLCo === c.id ? "selected" : "") + ">" + c.name + "</option>";
    }).join("") + '</select><select onchange="state.filters.landlordMonth=this.value;render()" style="padding:9px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);font-family:inherit;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;min-width:130px"><option value="">All Time</option>' + MONTHS.map(function(m) {
      return '<option value="' + m.key + '" ' + (selMonth === m.key ? "selected" : "") + ">" + m.label + "</option>";
    }).join("") + `</select><button onclick="openDataModal('landlords')" title="Import / Export" style="padding:8px 11px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">&#x21C5;</button><button onclick="openAddLandlordModal()" style="padding:9px 16px;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">+ Add Landlord</button></div></div>`;
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">';
    html += '<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:11px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--red);font-family:monospace">' + fmt(totalMonthly) + '</div><div style="font-size:10px;color:var(--red);font-weight:700;margin-top:2px">MONTHLY RENT</div></div>';
    html += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:11px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--amber);font-family:monospace">' + fmt(totalOwed) + '</div><div style="font-size:10px;color:var(--amber);font-weight:700;margin-top:2px">PENDING (' + pendingCount + ")</div></div>";
    html += '<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:11px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace">' + fmt(totalPaidAll) + '</div><div style="font-size:10px;color:var(--green);font-weight:700;margin-top:2px">PAID (ALL TIME)</div></div>';
    html += "</div>";
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px">';
    var sortedLls = lls.slice().sort(function(a, b) {
      var aPend = filteredPays.filter(function(p) {
        return p.landlordId === a.id && p.status === "pending";
      });
      var bPend = filteredPays.filter(function(p) {
        return p.landlordId === b.id && p.status === "pending";
      });
      if (aPend.length && !bPend.length) return -1;
      if (!aPend.length && bPend.length) return 1;
      if (aPend.length && bPend.length) {
        var aEarliest = Math.min.apply(null, aPend.map(function(p) {
          return new Date(p.dueDate).getTime();
        }));
        var bEarliest = Math.min.apply(null, bPend.map(function(p) {
          return new Date(p.dueDate).getTime();
        }));
        return aEarliest - bEarliest;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
    sortedLls.forEach(function(ll) {
      var llProps = (state.properties || []).filter(function(p) {
        return p.landlordName === ll.name;
      });
      var llMonthly = llProps.reduce(function(s, p) {
        return s + p.landlord;
      }, 0);
      var llPending = filteredPays.filter(function(p) {
        return p.landlordId === ll.id && p.status === "pending";
      });
      var llPaid = filteredPays.filter(function(p) {
        return p.landlordId === ll.id && p.status === "paid";
      });
      var initials = ll.name.split(" ").map(function(w) {
        return w[0];
      }).join("").slice(0, 2);
      var hasPending = llPending.length > 0;
      html += '<div style="background:var(--surface);border:1px solid ' + (hasPending ? "#FDE68A" : "var(--border)") + ';border-radius:13px;overflow:hidden">';
      html += `<div style="padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:12px" onclick="openLandlordDetail('` + ll.id + `')">`;
      html += '<div style="width:42px;height:42px;border-radius:11px;background:var(--accent-light);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--accent-dark)">' + initials + "</div>";
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:14px;font-weight:700">' + ll.name + "</div>";
      html += '<div style="font-size:11px;color:var(--muted)">' + ll.phone + " \xB7 " + llProps.length + " propert" + (llProps.length === 1 ? "y" : "ies") + "</div>";
      html += "</div>";
      html += '<div style="text-align:right;flex-shrink:0">';
      html += '<div style="font-size:15px;font-weight:800;color:var(--red);font-family:monospace">' + fmt(llMonthly) + "</div>";
      html += '<div style="font-size:10px;color:var(--muted)">per month</div>';
      html += "</div>";
      html += "</div>";
      if (llProps.length) {
        html += '<div style="padding:0 16px 10px;display:flex;flex-wrap:wrap;gap:5px">';
        llProps.forEach(function(p) {
          html += '<span style="font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 8px;color:var(--muted)">' + p.name + "</span>";
        });
        html += "</div>";
      }
      var llAllPays = filteredPays.filter(function(p) {
        return p.landlordId === ll.id;
      });
      var nowMs = (/* @__PURE__ */ new Date()).getTime();
      var monthKeys = [];
      llAllPays.forEach(function(p) {
        if (monthKeys.indexOf(p.monthKey) < 0) monthKeys.push(p.monthKey);
      });
      monthKeys.sort(function(a, b) {
        var aMs = (/* @__PURE__ */ new Date(a + "-01")).getTime();
        var bMs = (/* @__PURE__ */ new Date(b + "-01")).getTime();
        var aPend = llAllPays.some(function(p) {
          return p.monthKey === a && p.status !== "paid";
        });
        var bPend = llAllPays.some(function(p) {
          return p.monthKey === b && p.status !== "paid";
        });
        var aOver = aPend && aMs < nowMs;
        var bOver = bPend && bMs < nowMs;
        if (aOver && !bOver) return -1;
        if (!aOver && bOver) return 1;
        if (aPend && !bPend) return -1;
        if (!aPend && bPend) return 1;
        return aMs - bMs;
      });
      if (monthKeys.length) {
        var nowMonthKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
        var visKeys = monthKeys.filter(function(mk) {
          return mk <= nowMonthKey && llAllPays.some(function(p) {
            return p.monthKey === mk && p.status !== "paid";
          });
        }).sort();
        var hiddenCount = monthKeys.filter(function(mk) {
          return mk > nowMonthKey || llAllPays.filter(function(p) {
            return p.monthKey === mk;
          }).every(function(p) {
            return p.status === "paid";
          });
        }).length;
        html += '<div style="border-top:1px solid var(--border)">';
        visKeys.forEach(function(mk) {
          var mPays = llAllPays.filter(function(p) {
            return p.monthKey === mk;
          });
          var mMs = (/* @__PURE__ */ new Date(mk + "-01")).getTime();
          var mLabel = mPays[0].monthLabel;
          var allPaid = mPays.every(function(p) {
            return p.status === "paid";
          });
          var anyOverdue = mPays.some(function(p) {
            return p.status !== "paid" && mMs < nowMs;
          });
          var mTotal = mPays.reduce(function(s, p) {
            return s + p.amount;
          }, 0);
          var paidTotal = mPays.filter(function(p) {
            return p.status === "paid";
          }).reduce(function(s, p) {
            return s + p.amount;
          }, 0);
          var headBg = allPaid ? "var(--green-light)" : anyOverdue ? "#FFF1F2" : "var(--bg)";
          var headIcon = allPaid ? "\u2705" : anyOverdue ? "\u26A0\uFE0F" : "\u{1F4C5}";
          var headColor = allPaid ? "var(--green)" : anyOverdue ? "var(--red)" : "var(--text)";
          html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:' + headBg + ';border-bottom:1px solid var(--border)">';
          html += "<span>" + headIcon + "</span>";
          html += '<span style="font-size:12px;font-weight:800;color:' + headColor + ';flex:1">' + mLabel + "</span>";
          html += '<span style="font-size:11px;color:var(--muted);font-family:monospace">';
          if (!allPaid && paidTotal > 0) html += fmt(paidTotal) + " / ";
          html += fmt(mTotal) + "</span>";
          html += "</div>";
          var mSorted = mPays.slice().sort(function(a, b) {
            if (a.status === "paid" && b.status !== "paid") return 1;
            if (a.status !== "paid" && b.status === "paid") return -1;
            return (a.property || "").localeCompare(b.property || "");
          });
          mSorted.forEach(function(pay) {
            var isPaid = pay.status === "paid";
            var isOverdue = !isPaid && mMs < nowMs;
            var amtColor = isPaid ? "var(--green)" : isOverdue ? "var(--red)" : "var(--amber)";
            html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px 8px 28px;border-bottom:1px solid var(--border);background:' + (isPaid ? "transparent" : isOverdue ? "#FFF8F8" : "transparent") + '">';
            html += '<div style="flex:1;min-width:0">';
            html += '<div style="font-size:12px;font-weight:600;color:' + (isPaid ? "var(--muted)" : "var(--text)") + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (pay.propName || pay.property || (state.properties.find(function(x) {
              return x.id === pay.propId;
            }) || {}).name || "Unknown") + "</div>";
            if (isPaid) html += '<div style="font-size:10px;color:var(--green)">Paid ' + pay.paidDate + "</div>";
            html += "</div>";
            html += '<span style="font-size:12px;font-weight:700;color:' + amtColor + ';font-family:monospace;flex-shrink:0">' + fmt(pay.amount) + "</span>";
            if (!isPaid) {
              html += `<button onclick="markLandlordPaid('` + ll.id + "','" + pay.id + `')" style="padding:5px 10px;border-radius:7px;border:none;background:` + (isOverdue ? "var(--red)" : "#10B981") + ';color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap">' + (isOverdue ? "Pay Now" : "Pay \u2713") + "</button>";
            } else {
              html += '<span style="font-size:10px;color:var(--green);font-weight:700">\u2713</span>';
            }
            html += "</div>";
          });
        });
        if (hiddenCount > 0 || llAllPays.some(function(p) {
          return p.status === "paid";
        })) {
          var hiddenAll = hiddenCount;
          if (hiddenAll > 0) {
            html += `<div style="padding:8px 14px;text-align:center;border-top:1px solid var(--border)"><button onclick="openLandlordDetail('` + ll.id + `')" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:inherit">\u{1F4CB} ` + hiddenAll + " month" + (hiddenAll > 1 ? "s" : "") + " hidden \xB7 View full history</button></div>";
          }
        }
        if (!visKeys.length) {
          html += '<div style="padding:12px 14px;display:flex;align-items:center;gap:8px;border-top:1px solid var(--border)"><span style="font-size:18px">\u2705</span><span style="font-size:12px;color:var(--green);font-weight:600">All payments up to date</span>' + (monthKeys.length ? `<button onclick="openLandlordDetail('` + ll.id + `')" style="margin-left:auto;font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:inherit">View history</button>` : "") + "</div>";
        }
        html += "</div>";
      }
      html += '<div style="padding:10px 14px;border-top:1px solid var(--border)">';
      html += `<button onclick="openLandlordDetail('` + ll.id + `')" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">\u270F\uFE0F Edit Profile</button>`;
      html += "</div>";
      html += "</div>";
    });
    html += "</div>";
    return html;
  }
  function openAddLandlordModal() {
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px"><div class="modal-header"><span class="modal-title">+ Add Landlord</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="field"><label class="field-label">Name *</label><input class="inp" id="ll-name" placeholder="e.g. John Smith"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">Phone</label><input class="inp" id="ll-phone" type="tel" placeholder="07911000000"></div><div class="field"><label class="field-label">Email</label><input class="inp" id="ll-email" type="email" placeholder="landlord@email.com"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">Bank Name</label><input class="inp" id="ll-bank" placeholder="e.g. Barclays"></div><div class="field"><label class="field-label">Sort Code</label><input class="inp" id="ll-sort" placeholder="00-00-00"></div></div><div class="field"><label class="field-label">Account No.</label><input class="inp" id="ll-acc" placeholder="12345678"></div><div class="field"><label class="field-label">Notes</label><textarea class="inp" id="ll-notes" rows="2" placeholder="Payment terms, preferences\u2026" style="resize:vertical"></textarea></div></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button onclick="saveNewLandlord()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Add Landlord</button></div></div></div>';
  }
  function saveNewLandlord() {
    var name = (document.getElementById("ll-name") || { value: "" }).value.trim();
    if (!name) {
      alert("Please enter a landlord name.");
      return;
    }
    var ll = {
      id: crypto.randomUUID(),
      name,
      phone: (document.getElementById("ll-phone") || { value: "" }).value.trim(),
      email: (document.getElementById("ll-email") || { value: "" }).value.trim(),
      bank: (document.getElementById("ll-bank") || { value: "" }).value.trim(),
      sortCode: (document.getElementById("ll-sort") || { value: "" }).value.trim(),
      accountNo: (document.getElementById("ll-acc") || { value: "" }).value.trim(),
      notes: (document.getElementById("ll-notes") || { value: "" }).value.trim(),
      properties: []
    };
    if (!state.landlords) state.landlords = [];
    state.landlords.push(ll);
    closeModal();
    saveState();
    render();
    showToast("Landlord added: " + ll.name, "success");
  }
  function deleteLandlord(id) {
    var ll = state.landlords.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!ll) return;
    var linkedProps = state.properties.filter(function(p) {
      return p.landlordName === ll.name;
    });
    var msg = "Delete " + ll.name + "?";
    if (linkedProps.length) msg += "\n\n\u26A0 Linked to " + linkedProps.length + " propert" + (linkedProps.length > 1 ? "ies" : "y") + ". Link will be removed.";
    msg += "\n\nThis cannot be undone.";
    if (!confirm(msg)) return;
    linkedProps.forEach(function(p) {
      delete p.landlordName;
      delete p.landlordPhone;
    });
    state.landlords = state.landlords.filter(function(x) {
      return String(x.id) !== String(id);
    });
    try {
      supa.from("landlords").delete().eq("id", String(id)).then(function() {
      });
    } catch (e) {
    }
    closeModal();
    saveState();
    render();
    showToast("Landlord deleted", "success");
  }
  function openLandlordDetail(id) {
    var ll = state.landlords.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!ll) return;
    var lpays = (state.landlordPayments || []).filter(function(p) {
      return p.landlordId === id;
    });
    var llProps = state.properties.filter(function(p) {
      return p.landlordName === ll.name;
    });
    var pendingPays = lpays.filter(function(p) {
      return p.status !== "paid";
    });
    var paidPays = lpays.filter(function(p) {
      return p.status === "paid";
    }).sort(function(a, b) {
      return (b.dueDate || "").localeCompare(a.dueDate || "");
    }).slice(0, 6);
    var shownPays = pendingPays.concat(paidPays);
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px"><div class="modal-header"><span class="modal-title">' + ll.name + '</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body" style="max-height:70vh;overflow-y:auto"><div class="field"><label class="field-label">Name</label><input class="inp" id="ll-name" value="' + ll.name + '"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">Phone</label><input class="inp" id="ll-phone" value="' + (ll.phone || "") + '"></div><div class="field"><label class="field-label">Email</label><input class="inp" id="ll-email" value="' + (ll.email || "") + '"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label class="field-label">Bank</label><input class="inp" id="ll-bank" value="' + (ll.bank || "") + '"></div><div class="field"><label class="field-label">Sort Code</label><input class="inp" id="ll-sort" value="' + (ll.sortCode || "") + '"></div></div><div class="field"><label class="field-label">Account No.</label><input class="inp" id="ll-acc" value="' + (ll.accountNo || "") + '"></div><div class="field"><label class="field-label">Notes</label><textarea class="inp" id="ll-notes" rows="2">' + (ll.notes || "") + '</textarea></div><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin:12px 0 6px">Linked Properties</div>' + (llProps.length ? llProps.map(function(p) {
      return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 10px;background:var(--bg);border-radius:7px;margin-bottom:4px"><span>' + p.name + '</span><span style="font-weight:700;color:var(--red);font-family:monospace">' + fmt(p.landlord) + "/mo</span></div>";
    }).join("") : '<div style="font-size:12px;color:var(--dim);padding:4px 0">No properties linked</div>') + '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin:12px 0 6px">Payment History (overdue + last 6 paid)</div>' + (shownPays.length ? shownPays.map(function(p) {
      var propName = p.propName || (state.properties.find(function(x) {
        return x.id === p.propId;
      }) || {}).name || p.property || "\u2014";
      var isPaid = p.status === "paid";
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px"><div><div style="font-weight:600;color:var(--text)">' + propName + '</div><div style="font-size:10px;color:var(--muted)">' + p.monthLabel + (isPaid ? " \xB7 Paid " + p.paidDate : "") + '</div></div><span style="font-weight:700;font-family:monospace;color:' + (isPaid ? "var(--green)" : "var(--amber)") + '">' + fmt(p.amount) + "</span></div>";
    }).join("") : '<div style="font-size:12px;color:var(--dim)">No payments yet</div>') + '</div><div class="modal-footer" style="justify-content:space-between"><button data-llid="' + id + '" onclick="deleteLandlord(this.dataset.llid)" style="padding:9px 16px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">\u{1F5D1} Delete</button><div style="display:flex;gap:8px"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button data-llid="' + id + '" onclick="saveLandlordDetail(this.dataset.llid)" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Changes</button></div></div></div></div>';
  }
  function saveLandlordDetail(id) {
    var ll = state.landlords.find(function(x) {
      return String(x.id) === String(id);
    });
    if (!ll) return;
    var g = function(eid) {
      var el = document.getElementById(eid);
      return el ? el.value : null;
    };
    ["ll-name", "ll-phone", "ll-email", "ll-bank", "ll-sort", "ll-acc", "ll-notes"].forEach(function(eid) {
      var v = g(eid);
      if (v !== null) {
        var map = { "ll-name": "name", "ll-phone": "phone", "ll-email": "email", "ll-bank": "bank", "ll-sort": "sortCode", "ll-acc": "accountNo", "ll-notes": "notes" };
        ll[map[eid]] = v;
      }
    });
    closeModal();
    saveState();
    render();
    showToast("Landlord updated", "success");
  }
  function getPostcode(a) {
    var m = a && a.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/i);
    return m ? m[0].toUpperCase() : "";
  }
  var _roomMediaMap = {};
  function registerMedia(elemId, pid, rn) {
    _roomMediaMap[elemId] = { pid, rn };
  }
  function getMediaByElem(el) {
    var info = _roomMediaMap[el.id] || _roomMediaMap[el.dataset && el.dataset.mid];
    if (!info) {
      console.warn("No media info for element:", el.id);
      return null;
    }
    return getMedia(info.pid, info.rn);
  }
  function getMedia(pid, n) {
    if (!state.roomMedia) state.roomMedia = {};
    var k = pid + "_" + n;
    if (!state.roomMedia[k]) state.roomMedia[k] = { photos: [], video: null, notes: "" };
    return state.roomMedia[k];
  }
  function buildGalleryUrl(pid, rn) {
    var base = window.location.origin + "/gallery.html";
    return base + "?p=" + encodeURIComponent(pid) + "&r=" + rn;
  }
  function stripHouseNo(addr) {
    var s = (addr || "").replace(/^\d+[A-Za-z]?[\s,]+/, "").trim();
    s = s.replace(/,?\s*[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}\s*$/i, "").trim().replace(/,+\s*$/, "").trim();
    return s;
  }
  function shareRoomWA(pid, rn) {
    var p = state.properties.find(function(x) {
      return x.id === pid;
    });
    var r = p && p.roomList ? p.roomList.find(function(x) {
      return x.n === rn;
    }) : null;
    if (!p || !r) return;
    var pc = getPostcode(p.address);
    var media = getMedia(pid, rn);
    var typeIcon = { "Single": "\u{1F6CF}\uFE0F", "Double": "\u{1F6CF}\uFE0F\u{1F6CF}\uFE0F", "Suite": "\u2728", "Studio": "\u{1F3E0}", "Whole House": "\u{1F3E1}" }[r.type || "Single"] || "\u{1F6CF}\uFE0F";
    var monthly = Math.round(r.price * 52 / 12);
    var galleryUrl = buildGalleryUrl(pid, rn);
    var NL = "\n";
    var msg = "\u{1F3E0} *Room Available \u2014 " + p.area + "*" + NL + NL;
    msg += "\u{1F4CD} " + stripHouseNo(p.address) + ", " + pc + NL;
    var _noticeTenantWA = state.tenants.find(function(t) {
      return t.property === p.name && t.room === r.n && t.status === "notice_given" && t.moveOutDate;
    });
    var _availFromWA = _noticeTenantWA ? new Date(_noticeTenantWA.moveOutDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;
    msg += typeIcon + " *" + (r.type || "Room") + " \xB7 Room " + r.n + "*" + NL;
    if (_availFromWA) msg += "\u{1F4C5} *Available from: " + _availFromWA + "*" + NL;
    msg += "\u{1F4B7} *\xA3" + r.price + "/week* (\xA3" + monthly + "/mo equiv.)" + NL;
    if (p.mapsUrl) msg += "\u{1F5FA}\uFE0F Google Maps: " + p.mapsUrl + NL;
    if (media.notes) msg += NL + "\u{1F4DD} " + media.notes + NL;
    if (galleryUrl && media.photos && media.photos.length > 0) {
      msg += NL + "\u{1F4F8} *View " + media.photos.length + " photo" + (media.photos.length === 1 ? "" : "s") + "*" + NL;
      msg += galleryUrl + NL;
    }
    if (media.video) msg += "\u{1F3A5} Video tour available \u2014 ask us to send it" + NL;
    msg += "\u{1F4DE} Contact us now to arrange a *FREE viewing*!";
    var url = "https://wa.me/?text=" + encodeURIComponent(msg);
    var w = window.open(url, "_blank");
    if (!w) window.location.href = url;
  }
  function shareAllRoomsWA() {
    var v = [];
    state.properties.forEach(function(p) {
      (p.roomList || []).forEach(function(r) {
        if (r.status === "vacant") v.push({ p, r });
      });
    });
    if (!v.length) {
      alert("No vacant rooms to share.");
      return;
    }
    var NL = "\n";
    var msg = "\u{1F3E0} *Available Rooms \u2014 Reservations Direct*" + NL;
    msg += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501" + NL + NL;
    v.forEach(function(item, i) {
      var p = item.p;
      var r = item.r;
      var pc = getPostcode(p.address);
      var monthly = Math.round(r.price * 52 / 12);
      var typeIcon = { Single: "\u{1F6CF}\uFE0F", Double: "\u{1F6CF}\uFE0F\u{1F6CF}\uFE0F", Suite: "\u2728", Studio: "\u{1F3E0}" }[r.type || "Single"] || "\u{1F6CF}\uFE0F";
      var media = getMedia(p.id, r.n);
      msg += i + 1 + ". " + typeIcon + " *" + (r.type || "Room") + " \xB7 " + p.area + "*" + NL;
      msg += "   \u{1F4CD} " + stripHouseNo(p.address) + ", " + pc + NL;
      msg += "   \u{1F4B7} *\xA3" + r.price + "/wk* (\xA3" + monthly + "/mo)" + NL;
      if (p.mapsUrl) msg += "   \u{1F5FA}\uFE0F " + p.mapsUrl + NL;
      if (media.photos && media.photos.length > 0) {
        var gurl = buildGalleryUrl(p.id, r.n);
        msg += "   \u{1F4F8} " + media.photos.length + " photo" + (media.photos.length === 1 ? "" : "s") + " available" + NL;
        if (gurl) msg += "   \u{1F517} " + gurl + NL;
      }
      msg += NL;
    });
    msg += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501" + NL;
    msg += "\u{1F4DE} *Reply or call to book a FREE viewing!*";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  }
  async function handlePhotoUpload(pid, rn, input) {
    if (!pid || pid === "undefined" || pid === "prop" || pid.length < 3) {
      showToast("Please refresh the page and try again", "error");
      return;
    }
    var files = Array.from(input.files);
    var media = getMedia(pid, rn);
    var maxPhotos = 4;
    var toUpload = Array.from(files).slice(0, maxPhotos - media.photos.length);
    for (var i = 0; i < toUpload.length; i++) {
      var file = toUpload[i];
      if (file.size > 5 * 1024 * 1024) {
        showToast("Photo too large (max 5MB)", "error");
        continue;
      }
      showToast("Uploading...", "success");
      var localReader = new FileReader();
      var fileRef = file;
      localReader.onload = /* @__PURE__ */ (function(lf, lpid, lrn) {
        return function(e) {
          var localMedia = getMedia(lpid, lrn);
          var localEntry = { src: e.target.result, name: lf.name, _localOnly: true };
          localMedia.photos.push(localEntry);
          render();
          showToast("Uploading photo...", "success");
          (async function() {
            try {
              var ext = lf.name.split(".").pop().toLowerCase();
              var path = "rooms/" + lpid + "/" + lrn + "/" + Date.now() + "." + ext;
              var upload = await supa.storage.from("room-media").upload(path, lf, { upsert: true });
              if (upload.error) throw upload.error;
              var urlData = supa.storage.from("room-media").getPublicUrl(path);
              var url = urlData.data.publicUrl;
              if (url) {
                var idx = localMedia.photos.indexOf(localEntry);
                if (idx >= 0) localMedia.photos[idx] = { src: url, name: lf.name, path };
                saveState();
                render();
                showToast("Photo uploaded \u2713", "success");
                console.log("Photo synced to Supabase:", url);
              }
            } catch (err) {
              console.warn("Photo upload failed:", err.message);
              showToast("Upload failed: " + (err.message || "check connection"), "error");
              render();
            }
          })();
        };
      })(fileRef, pid, rn);
      localReader.readAsDataURL(file);
    }
  }
  function renderRooms() {
    window._roomEidMap = {};
    var allV = [], hiddenV = [];
    state.properties.forEach(function(p) {
      (p.roomList || []).forEach(function(r) {
        if (r._hidden) {
          hiddenV.push({ p, r });
          return;
        }
        if (r.status === "vacant") {
          allV.push({ p, r, availFrom: null });
        } else if (r.status === "occupied") {
          var noticeTenant = state.tenants.find(function(t) {
            return t.property === p.name && t.room === r.n && t.status === "notice_given" && t.moveOutDate;
          });
          if (noticeTenant) {
            allV.push({ p, r, availFrom: noticeTenant.moveOutDate, _noticeTenant: noticeTenant });
          }
        }
      });
    });
    var f = { area: state.filters.roomArea || "all", type: state.filters.roomType || "all", sort: state.filters.roomSort || "price_asc" };
    var areas = [];
    allV.forEach(function(x) {
      if (areas.indexOf(x.p.area) < 0) areas.push(x.p.area);
    });
    var filtered = allV.filter(function(x) {
      return (f.area === "all" || x.p.area === f.area) && (f.type === "all" || (x.r.type || "Single") === f.type);
    });
    filtered.sort(function(a, b) {
      return f.sort === "price_desc" ? b.r.price - a.r.price : f.sort === "area" ? a.p.area.localeCompare(b.p.area) : a.r.price - b.r.price;
    });
    var html = '<div class="page-header"><div><div class="page-title">Available Rooms</div><div class="page-sub">' + filtered.length + " of " + allV.length + ' rooms</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><a href="/rooms.html" target="_blank" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px">&#x1F310; Public Page</a><button onclick="shareAllRoomsWA()" style="padding:9px 14px;border-radius:9px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Share All</button></div></div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:10px;margin-bottom:16px">';
    var trueVacant = allV.filter(function(x) {
      return !x.availFrom;
    }).length;
    var comingSoon = allV.filter(function(x) {
      return !!x.availFrom;
    }).length;
    html += '<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:11px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--red)">' + trueVacant + '</div><div style="font-size:10px;color:var(--red);font-weight:700">VACANT</div></div>';
    html += comingSoon ? '<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:11px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:#B45309">' + comingSoon + '</div><div style="font-size:10px;color:#B45309;font-weight:700">COMING SOON</div></div>' : "";
    html += '<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:11px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--green)">' + fmt(Math.round(allV.filter(function(x) {
      return !x.availFrom;
    }).reduce(function(s, x) {
      return s + x.r.price;
    }, 0) * 52 / 12)) + '</div><div style="font-size:10px;color:var(--green);font-weight:700">POTENTIAL/MO</div></div>';
    html += '<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:11px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--blue)">' + state.properties.filter(function(p) {
      return (p.roomList || []).some(function(r) {
        return r.status === "vacant" && !r._hidden;
      });
    }).length + '</div><div style="font-size:10px;color:var(--blue);font-weight:700">PROPERTIES</div></div>';
    html += "</div>";
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">';
    html += '<select class="inp" style="max-width:140px" onchange="state.filters.roomArea=this.value;render()"><option value="all">All Areas</option>' + areas.map(function(a) {
      return '<option value="' + a + '" ' + (f.area === a ? "selected" : "") + ">" + a + "</option>";
    }).join("") + "</select>";
    html += '<select class="inp" style="max-width:130px" onchange="state.filters.roomType=this.value;render()">' + ["all", "Single", "Double", "Suite", "Studio"].map(function(t) {
      return '<option value="' + t + '" ' + (f.type === t ? "selected" : "") + ">" + (t === "all" ? "All Types" : t) + "</option>";
    }).join("") + "</select>";
    html += '<select class="inp" style="max-width:140px" onchange="state.filters.roomSort=this.value;render()"><option value="price_asc">Price up</option><option value="price_desc">Price down</option><option value="area">Area</option></select>';
    html += "</div>";
    if (!filtered.length) {
      html += '<div style="text-align:center;padding:40px;color:var(--dim)">No rooms match filters</div>';
      return html;
    }
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">';
    filtered.forEach(function(item) {
      var p = item.p;
      var r = item.r;
      var pc = getPostcode(p.address);
      var media = getMedia(p.id, r.n);
      var availFrom = item.availFrom || null;
      var availFromStr = availFrom ? new Date(availFrom).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;
      var _pid = p.id && String(p.id).length > 0 ? String(p.id) : p.name || "prop" + filtered.indexOf(item);
      var _rn = r.n != null && r.n !== "" && !isNaN(r.n) ? parseInt(r.n) : 0;
      var _eidSafe = _pid.replace(/[^a-zA-Z0-9]/g, "X");
      if (!_eidSafe || _eidSafe.length === 0) _eidSafe = "p" + filtered.indexOf(item);
      var _eidKey = _eidSafe + "__" + _rn;
      window._roomEidMap = window._roomEidMap || {};
      window._roomEidMap[_eidKey] = { pid: _pid, rn: _rn };
      var _eid = _eidKey;
      var media = getMedia(_pid, _rn);
      var monthly = Math.round(r.price * 52 / 12);
      var typeIcon = { Single: "\u{1F6CF}\uFE0F", Double: "\u{1F6CF}\uFE0F\u{1F6CF}\uFE0F", Suite: "\u2728", Studio: "\u{1F3E0}" }[r.type || "Single"] || "\u{1F6CF}\uFE0F";
      html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column">';
      html += '<div style="position:relative;height:180px;background:#F1F5F9;flex-shrink:0">';
      if (media.photos && media.photos.length > 0) {
        html += '<div style="display:flex;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none">';
        media.photos.forEach(function(ph, pi) {
          html += '<div style="flex-shrink:0;width:100%;height:100%;scroll-snap-align:start;position:relative">';
          html += '<img src="' + ph.src + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display="none";this.nextSibling&&(this.nextSibling.style.display="flex")" onload="console.log("Photo loaded OK")">';
          html += '<button id="rm-' + _eid + "-delpic-" + pi + '" onclick="removeRoomPhotoByEid(this)" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center">&#x2715;</button>';
          html += "</div>";
        });
        html += "</div>";
        html += '<div style="position:absolute;bottom:6px;right:8px;font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);padding:2px 7px;border-radius:8px">' + media.photos.length + "/4</div>";
      } else {
        html += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:6px;color:var(--dim)"><div style="font-size:34px">&#x1F4F7;</div><div style="font-size:12px;font-weight:600">No photos yet</div></div>';
      }
      if (media.photos.length < 4) {
        html += '<label style="position:absolute;bottom:8px;left:8px;padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.93);border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:4px">';
        html += '&#x1F4F7; Add Photo<input type="file" accept="image/*" multiple style="display:none" id="rm-' + _eid + '-photo" onchange="handleRoomPhotoChange(this)">';
        html += "</label>";
      }
      html += "</div>";
      html += '<div style="padding:13px;flex:1;display:flex;flex-direction:column;gap:9px">';
      if (availFromStr) {
        html += '<div style="display:flex;align-items:center;gap:7px;background:#FFFBEB;border-bottom:1px solid #FDE68A;padding:8px 13px;font-size:11px;font-weight:700;color:#B45309"><span style="font-size:14px">\u{1F4C5}</span><span>Available from <strong>' + availFromStr + '</strong></span><span style="margin-left:auto;font-size:10px;background:#FDE68A;color:#92400E;padding:2px 7px;border-radius:6px">NOTICE GIVEN</span></div>';
      }
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
      html += '<div><div style="font-size:15px;font-weight:800">' + typeIcon + " " + (r.type || "Room") + " &middot; Room " + r.n + '</div><div style="font-size:11px;color:var(--muted)">' + p.name + "</div></div>";
      html += '<div style="text-align:right;flex-shrink:0"><div style="font-size:18px;font-weight:800;color:var(--accent-dark);font-family:monospace">&pound;' + r.price + '<span style="font-size:10px;font-weight:400;color:var(--muted)">/wk</span></div><div style="font-size:10px;color:var(--muted)">&pound;' + monthly + "/mo equiv.</div></div>";
      html += "</div>";
      html += '<div style="background:var(--bg);border-radius:9px;padding:9px 11px;font-size:12px">';
      html += '<div style="font-weight:600;margin-bottom:3px">&#x1F4CD; ' + p.address + "</div>";
      html += '<div style="display:flex;gap:10px;flex-wrap:wrap;color:var(--muted)">';
      html += "<span>&#x1F4EE; <strong>" + pc + "</strong></span><span>" + p.area + "</span>";
      if (p.mapsUrl) html += '<a href="' + p.mapsUrl + '" target="_blank" style="color:var(--blue);font-weight:600;text-decoration:none">&#x1F5FA; Maps &rarr;</a>';
      html += "</div></div>";
      html += '<div><label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Description</label>';
      html += '<textarea id="rm-' + _eid + '-notes" rows="2" class="inp" style="margin-top:4px;resize:vertical;font-size:12px" placeholder="Bright south-facing room, newly decorated, double bed..." onblur="saveRoomNotesByEid(this)">' + (media.notes || "") + "</textarea></div>";
      if (media.video) {
        html += '<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border-radius:8px;padding:8px 11px">';
        html += '<span>&#x1F3A5;</span><span style="font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + media.video.name + "</span>";
        html += '<button id="rm-' + _eid + '-delvid" onclick="removeRoomVideoByEid(this)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;cursor:pointer;font-family:inherit;color:var(--muted)">Remove</button>';
        html += "</div>";
      } else {
        html += '<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:1px dashed var(--border);cursor:pointer;font-size:12px;color:var(--muted)">';
        html += '<span>&#x1F3A5;</span><span>Add video tour <span style="font-size:10px">(max 50MB)</span></span>';
        html += '<input type="file" accept="video/*" style="display:none" id="rm-' + _eid + '-video" onchange="handleRoomVideoChange(this)">';
        html += "</label>";
      }
      html += '<div style="display:flex;gap:8px;margin-top:auto">';
      html += '<button id="rm-' + _eid + '-avail" onclick="toggleRoomAvailByEid(this)" style="flex:0 0 auto;padding:10px 12px;border-radius:10px;border:1px solid ' + (r._hidden ? "#FECDD3" : "var(--border)") + ";background:" + (r._hidden ? "#FFF1F2" : "var(--bg)") + ";color:" + (r._hidden ? "#E11D48" : "var(--muted)") + ';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">' + (r._hidden ? "\u{1F441} Make Available" : "\u{1F6AB} Mark Unavailable") + "</button>";
      html += '<button id="rm-' + _eid + '-share" onclick="shareRoomWAByEid(this)" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;border-radius:10px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F4AC; Share on WhatsApp</button>';
      html += "</div>";
      html += "</div></div>";
    });
    html += "</div>";
    return html;
  }
  var _importTab = "properties";
  var _importPreview = null;
  function renderImport() {
    var tab = _importTab || "properties";
    var tabs = [{ v: "properties", l: "\u{1F3E0} Properties" }, { v: "tenants", l: "\u{1F465} Tenants" }];
    var html = '<div class="page-header"><div><div class="page-title">\u{1F4E5} Data Import</div><div class="page-sub">Import properties and tenants from Base44 exports</div></div></div>';
    html += '<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px">';
    tabs.forEach(function(t) {
      html += `<button onclick="_importTab='` + t.v + `';_importPreview=null;render()" style="padding:11px 20px;border:none;border-bottom:2px solid ` + (tab === t.v ? "var(--accent)" : "transparent") + ";background:transparent;font-size:13px;font-weight:" + (tab === t.v ? 700 : 500) + ";color:" + (tab === t.v ? "var(--accent-dark)" : "var(--muted)") + ';cursor:pointer;font-family:inherit">' + t.l + "</button>";
    });
    html += "</div>";
    if (tab === "properties") html += renderImportProperties();
    else html += renderImportTenants();
    return html;
  }
  function renderImportProperties() {
    var html = "";
    if (!_importPreview || _importPreview.type !== "properties") {
      html += '<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:18px;margin-bottom:16px"><div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">\u{1F4CB} How to import</div><div style="font-size:12px;color:var(--muted);line-height:1.7">Upload your Base44 properties export (.xlsx or .csv). Required columns: <strong>Property Name, Address, Postcode, Total Rooms, Landlord Rent (\xA3), Landlord Name, Landlord Contact</strong>. Landlords are created automatically. Duplicate property names are skipped.</div></div>';
      html += `<div style="border:2px dashed var(--accent);border-radius:12px;padding:32px;text-align:center;background:var(--accent-light);margin-bottom:16px"><div style="font-size:36px;margin-bottom:10px">\u{1F4CA}</div><div style="font-size:14px;font-weight:700;color:var(--accent-dark);margin-bottom:6px">Upload Properties File</div><div style="font-size:12px;color:var(--muted);margin-bottom:16px">Accepts .xlsx or .csv from Base44</div><input type="file" id="prop-import-file" accept=".xlsx,.csv" style="display:none" onchange="handlePropertiesFile(this)"><button onclick="document.getElementById('prop-import-file').click()" style="padding:11px 24px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Choose File</button></div>`;
      return html;
    }
    var preview = _importPreview;
    var rows = preview.rows;
    var warnings = preview.warnings || [];
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div><div style="font-size:15px;font-weight:700">Preview \u2014 ' + rows.length + " properties ready to import</div>" + (warnings.length ? '<div style="font-size:12px;color:var(--amber);margin-top:3px">\u26A0\uFE0F ' + warnings.length + " warnings \u2014 review below</div>" : '<div style="font-size:12px;color:var(--green);margin-top:3px">\u2713 All data looks good</div>') + '</div><div style="display:flex;gap:8px"><button onclick="_importPreview=null;render()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--surface);font-size:13px;cursor:pointer;font-family:inherit">\u2190 Back</button><button onclick="confirmImportProperties()" style="padding:9px 20px;border-radius:9px;border:none;background:var(--green);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">\u2713 Import ' + rows.length + " Properties</button></div></div>";
    if (warnings.length) {
      html += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:10px;padding:12px 14px;margin-bottom:14px">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:6px">\u26A0\uFE0F Warnings</div>';
      warnings.slice(0, 5).forEach(function(w) {
        html += '<div style="font-size:12px;color:var(--muted);padding:2px 0">\u2022 ' + w + "</div>";
      });
      if (warnings.length > 5) html += '<div style="font-size:11px;color:var(--dim);margin-top:4px">...and ' + (warnings.length - 5) + " more</div>";
      html += "</div>";
    }
    html += '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr style="background:var(--bg)"><th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700;white-space:nowrap">Property</th><th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700;white-space:nowrap">Area / Postcode</th><th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Rooms</th><th style="text-align:right;padding:9px 12px;color:var(--muted);font-weight:700">Landlord Rent</th><th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700">Landlord</th><th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Status</th></tr></thead><tbody>';
    rows.forEach(function(r, i) {
      var exists = state.properties.some(function(p) {
        return p.name.trim().toLowerCase() === r.name.trim().toLowerCase();
      });
      html += '<tr style="border-top:1px solid var(--border);background:' + (i % 2 ? "var(--bg)" : "var(--surface)") + '"><td style="padding:8px 12px;font-weight:600">' + (exists ? '<span style="color:var(--amber)" title="Already exists">\u26A0\uFE0F </span>' : "") + r.name + '</td><td style="padding:8px 12px;color:var(--muted)">' + r.postcode + '</td><td style="padding:8px 12px;text-align:center">' + r.rooms + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--red)">\xA3' + r.landlord + '/mo</td><td style="padding:8px 12px">' + r.landlordName + '</td><td style="padding:8px 12px;text-align:center">' + (exists ? '<span style="font-size:10px;color:var(--amber);font-weight:700">SKIP</span>' : '<span style="font-size:10px;color:var(--green);font-weight:700">NEW</span>') + "</td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }
  function renderImportTenants() {
    var html = "";
    if (!_importPreview || _importPreview.type !== "tenants") {
      html += '<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:18px;margin-bottom:16px"><div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">\u{1F4CB} How to import</div><div style="font-size:12px;color:var(--muted);line-height:1.7">Upload your Base44 tenants export (.csv). Required: <strong>Name, Phone</strong>. Optional: Property, Room, Rent Amount, Rent Frequency, Check-in Date, Status. Phones are auto-normalised to 447XXXXXXXXX. Fake @tenant.com emails are ignored. Names with property codes (e.g. "Marcus Q3") are flagged for review.</div></div>';
      html += `<div style="border:2px dashed var(--accent);border-radius:12px;padding:32px;text-align:center;background:var(--accent-light);margin-bottom:16px"><div style="font-size:36px;margin-bottom:10px">\u{1F465}</div><div style="font-size:14px;font-weight:700;color:var(--accent-dark);margin-bottom:6px">Upload Tenants CSV</div><div style="font-size:12px;color:var(--muted);margin-bottom:16px">Base44 tenants export (.csv)</div><input type="file" id="tenant-import-file" accept=".csv" style="display:none" onchange="handleTenantsFile(this)"><button onclick="document.getElementById('tenant-import-file').click()" style="padding:11px 24px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Choose File</button></div>`;
      return html;
    }
    var preview = _importPreview;
    var rows = preview.rows;
    var warnings = preview.warnings || [];
    var flagged = rows.filter(function(r) {
      return r._flagged;
    }).length;
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div><div style="font-size:15px;font-weight:700">Preview \u2014 ' + rows.length + ' tenants ready to import</div><div style="font-size:12px;color:var(--muted);margin-top:3px">' + (flagged ? '<span style="color:var(--amber)">\u26A0\uFE0F ' + flagged + " names flagged (property codes detected)</span>" : '<span style="color:var(--green)">\u2713 All names look clean</span>') + '</div></div><div style="display:flex;gap:8px"><button onclick="_importPreview=null;render()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--surface);font-size:13px;cursor:pointer;font-family:inherit">\u2190 Back</button><button onclick="confirmImportTenants()" style="padding:9px 20px;border-radius:9px;border:none;background:var(--green);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">\u2713 Import ' + rows.length + " Tenants</button></div></div>";
    html += '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr style="background:var(--bg)"><th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700">Name</th><th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700">WhatsApp</th><th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700">Property</th><th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Rm</th><th style="text-align:right;padding:9px 12px;color:var(--muted);font-weight:700">Rent</th><th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Freq</th><th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Status</th></tr></thead><tbody>';
    rows.forEach(function(r, i) {
      var exists = state.tenants.some(function(t) {
        return t.name.trim().toLowerCase() === r.name.trim().toLowerCase() && t.whatsapp === r.whatsapp;
      });
      html += '<tr style="border-top:1px solid var(--border);background:' + (i % 2 ? "var(--bg)" : "var(--surface)") + '"><td style="padding:8px 12px;font-weight:600">' + (r._flagged ? '<span title="Name contains property code - please verify" style="color:var(--amber)">\u26A0\uFE0F </span>' : "") + (exists ? '<span title="Already imported" style="color:var(--blue)">\u21A9 </span>' : "") + r.name + '</td><td style="padding:8px 12px;font-family:monospace;color:var(--muted)">' + r.whatsapp + '</td><td style="padding:8px 12px;color:var(--muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + r.property + '</td><td style="padding:8px 12px;text-align:center">' + r.room + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace">\xA3' + r.rent + '</td><td style="padding:8px 12px;text-align:center;color:var(--muted)">' + r.freq + '</td><td style="padding:8px 12px;text-align:center">' + (exists ? '<span style="font-size:10px;color:var(--blue);font-weight:700">SKIP</span>' : '<span style="font-size:10px;color:var(--green);font-weight:700">NEW</span>') + "</td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }
  function cleanPhone(raw) {
    var p = String(raw || "").replace(/[\s\-\(\)]/g, "");
    if (p.startsWith("+44")) p = "44" + p.slice(3);
    else if (p.startsWith("0044")) p = "44" + p.slice(4);
    else if (p.startsWith("07")) p = "44" + p.slice(1);
    else if (p.startsWith("7") && p.length === 10) p = "44" + p;
    return p.replace(/\D/g, "");
  }
  function cleanPostcode(raw) {
    return String(raw || "").trim().toUpperCase().replace(/\s+/, " ");
  }
  function cleanPropertyName(raw) {
    return String(raw || "").trim().replace(/\s+/g, " ");
  }
  function hasPropCode(name) {
    return /[A-Z]?\d+[A-Z]?$/.test(name.trim().split(" ").pop()) || /\b(Q\d+|Rm\d+|casa\s*\d+|flat\s*\d+)\b/i.test(name);
  }
  function handlePropertiesFile(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var rows = [];
        var warnings = [];
        if (file.name.endsWith(".csv")) {
          var text = e.target.result;
          var lines = text.split("\n").filter(function(l) {
            return l.trim();
          });
          var headers = parseCSVLine(lines[0]);
          for (var i = 1; i < lines.length; i++) {
            var vals = parseCSVLine(lines[i]);
            var obj = {};
            headers.forEach(function(h, j) {
              obj[h.trim()] = (vals[j] || "").trim();
            });
            rows.push(obj);
          }
        } else {
          var data = new Uint8Array(e.target.result);
          var wb = XLSX.read(data, { type: "array" });
          var ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        }
        var mapped = [];
        rows.forEach(function(r) {
          var name = cleanPropertyName(r["Property Name"] || r["Name"] || r["property"] || "");
          if (!name) return;
          var landlordRent = parseFloat(String(r["Landlord Rent (\xA3)"] || r["Landlord Rent"] || r["landlord"] || 0).replace(/[£,]/g, "")) || 0;
          var totalRooms = parseInt(r["Total Rooms"] || r["rooms"] || 0) || 0;
          var occupied = parseInt(r["Occupied Rooms"] || r["occupied"] || 0) || 0;
          var income = parseFloat(String(r["Monthly Income (\xA3)"] || r["Monthly Income"] || r["rent"] || 0).replace(/[£,]/g, "")) || 0;
          var postcode = cleanPostcode(r["Postcode"] || r["postcode"] || "");
          var address = String(r["Address"] || r["address"] || "").trim();
          var landlordName = String(r["Landlord Name"] || r["landlord_name"] || "").trim();
          var landlordPhone = cleanPhone(r["Landlord Contact"] || r["landlord_contact"] || r["Landlord Phone"] || "");
          var status = String(r["Status"] || "active").toLowerCase();
          if (!totalRooms && !landlordRent) {
            warnings.push(name + ": no rooms or rent data");
          }
          mapped.push({
            name,
            address,
            postcode,
            rooms: totalRooms,
            occupied,
            rent: income,
            landlord: landlordRent,
            landlordName,
            landlordPhone,
            status,
            area: deriveArea(postcode, address),
            type: "HMO"
          });
        });
        _importPreview = { type: "properties", rows: mapped, warnings };
        render();
      } catch (err) {
        alert("Error reading file: " + err.message);
      }
    };
    if (file.name.endsWith(".csv")) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  }
  function deriveArea(postcode, address) {
    var southLondon = {
      "SW": "Lambeth",
      "SE": "Lewisham",
      "CR": "Croydon",
      "SW16": "Streatham",
      "SW2": "Brixton",
      "SW9": "Brixton",
      "SW4": "Clapham",
      "SW11": "Clapham",
      "SE5": "Camberwell",
      "SE15": "Peckham",
      "SE22": "Dulwich",
      "SE27": "Norwood",
      "SE26": "Sydenham",
      "SE23": "Forest Hill",
      "SE6": "Catford",
      "SE13": "Lewisham"
    };
    var pc = (postcode || "").replace(" ", "");
    var prefix4 = pc.slice(0, 4);
    var prefix3 = pc.slice(0, 3);
    var prefix2 = pc.slice(0, 2);
    return southLondon[prefix4] || southLondon[prefix3] || southLondon[prefix2] || "Other";
  }
  function handleTenantsFile(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var text = e.target.result;
        var lines = text.split("\n").filter(function(l) {
          return l.trim();
        });
        var headers = parseCSVLine(lines[0]);
        var warnings = [];
        var mapped = [];
        for (var i = 1; i < lines.length; i++) {
          var vals = parseCSVLine(lines[i]);
          var obj = {};
          headers.forEach(function(h, j) {
            obj[h.trim()] = (vals[j] || "").trim();
          });
          var name = (obj["Name"] || obj["name"] || "").trim();
          if (!name) continue;
          var phone = cleanPhone(obj["Phone"] || obj["phone"] || obj["WhatsApp"] || "");
          var email = (obj["Email"] || obj["email"] || "").trim();
          if (email.includes("@tenant.com")) email = "";
          var rentRaw = String(obj["Rent Amount"] || obj["Rent"] || obj["rent"] || "0").replace(/[£,]/g, "");
          var rent = parseFloat(rentRaw) || 0;
          var freq = (obj["Rent Frequency"] || obj["Frequency"] || "weekly").toLowerCase().trim();
          var prop = cleanPropertyName(obj["Property"] || obj["property"] || "");
          var room = parseInt(obj["Room"] || obj["room"] || 1) || 1;
          var checkin = parseDate(obj["Check-in Date"] || obj["check_in"] || "");
          var status = (obj["Status"] || "active").toLowerCase().trim();
          var flagged = hasPropCode(name);
          mapped.push({
            name,
            whatsapp: phone,
            email,
            rent,
            freq: freq === "monthly" ? "monthly" : "weekly",
            property: prop,
            room,
            startDate: checkin,
            status: status === "notice_given" ? "notice_given" : "active",
            _flagged: flagged
          });
        }
        _importPreview = { type: "tenants", rows: mapped, warnings };
        render();
      } catch (err) {
        alert("Error reading CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  }
  function parseDate(raw) {
    if (!raw) return "";
    var m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return "";
  }
  function parseCSVLine(line) {
    var result = [], cur = "", inQuote = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
        continue;
      }
      if (ch === "," && !inQuote) {
        result.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    result.push(cur);
    return result;
  }
  function confirmImportProperties() {
    var rows = _importPreview.rows;
    var imported = 0, skipped = 0;
    rows.forEach(function(r) {
      var exists = state.properties.some(function(p) {
        return p.name.trim().toLowerCase() === r.name.trim().toLowerCase();
      });
      if (exists) {
        skipped++;
        return;
      }
      if (r.landlordName && !state.landlords.find(function(ll) {
        return ll.name.trim().toLowerCase() === r.landlordName.trim().toLowerCase();
      })) {
        state.landlords.push({
          id: crypto.randomUUID(),
          name: r.landlordName,
          phone: r.landlordPhone,
          email: "",
          bank: "",
          sortCode: "",
          accountNo: "",
          notes: "",
          properties: []
        });
      }
      var roomList = [];
      for (var i = 1; i <= r.rooms; i++) {
        roomList.push({ n: i, type: "Single", price: 0, status: i <= r.occupied ? "occupied" : "vacant" });
      }
      state.properties.push({
        id: crypto.randomUUID(),
        name: r.name,
        address: r.address,
        postcode: r.postcode,
        area: r.area,
        type: r.type,
        rooms: r.rooms,
        occupied: r.occupied,
        rent: r.rent,
        landlord: r.landlord,
        landlordName: r.landlordName,
        mapsUrl: r.postcode ? "https://maps.google.com/?q=" + encodeURIComponent(r.address || r.name) : "",
        roomList,
        notes: ""
      });
      imported++;
    });
    _importPreview = null;
    _importTab = "properties";
    alert("\u2705 Import complete!\n\n" + imported + " properties imported\n" + skipped + " skipped (already exist)\n\nLandlords auto-created: " + state.landlords.length);
    state.page = "properties";
    render();
  }
  function confirmImportTenants() {
    var rows = _importPreview.rows;
    var imported = 0, skipped = 0;
    rows.forEach(function(r) {
      var exists = state.tenants.some(function(t) {
        return t.name.trim().toLowerCase() === r.name.trim().toLowerCase() && t.whatsapp === r.whatsapp;
      });
      if (exists) {
        skipped++;
        return;
      }
      var id = crypto.randomUUID();
      state.tenants.push({
        id,
        name: r.name,
        property: r.property,
        room: r.room,
        rent: r.rent,
        freq: r.freq,
        payDay: r.freq === "weekly" ? "Monday" : null,
        payDayOfMonth: r.freq === "monthly" ? 1 : null,
        method: "bank",
        status: r.status,
        paid: "\u2014",
        arrears: 0,
        whatsapp: r.whatsapp,
        email: r.email,
        deposit: r.rent * 2,
        depositStatus: "held",
        moveIn: r.startDate,
        startDate: r.startDate,
        noticeDate: null,
        moveOutDate: null,
        paymentHistory: []
      });
      if (r.property && r.room) occupyRoom(r.property, r.room, r.rent);
      imported++;
    });
    rebuildAllSchedules();
    _importPreview = null;
    alert("\u2705 Import complete!\n\n" + imported + " tenants imported\n" + skipped + " skipped (already exist)");
    state.page = "tenants";
    render();
  }
  function renderUsers() {
    var allRoles = Object.keys(state.roles);
    var activeCount = state.users.filter(function(u) {
      return u.status === "active" && u.status !== "deleted";
    }).length;
    var html = '<div class="page-header"><div><div class="page-title">Users</div><div class="page-sub">' + activeCount + " active &middot; " + state.users.length + ` total</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button onclick="openInviteUserModal()" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">&#x2709; Invite User</button><button onclick="exportData()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B07; Export</button><button onclick="document.getElementById('import-file-input').click()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--blue);background:var(--blue-light);color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B06; Import</button><input type="file" id="import-file-input" accept=".json" style="display:none" onchange="importData(this)"><button onclick="clearSavedState()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:12px;cursor:pointer;font-family:inherit">Reset Demo</button><button onclick="backfillPaymentDueDates()" style="padding:9px 14px;border-radius:9px;border:1px solid #F59E0B;background:#FFFBEB;color:#92400E;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F527; Fix Dates</button></div></div>`;
    state.users.filter(function(u) {
      return u.status !== "deleted";
    }).forEach(function(u) {
      var r = state.roles[u.role] || { label: u.role, color: "#64748B", bg: "#F8FAFC", icon: "?" };
      var isMe = String(u.id) === String(state.currentUser.id);
      var isPending = u.status === "pending";
      html += '<div style="background:var(--surface);border:1px solid ' + (isMe ? "var(--accent)" : "var(--border)") + ';border-radius:12px;padding:14px;margin-bottom:10px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div style="width:40px;height:40px;border-radius:10px;background:' + r.bg + ";display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:" + r.color + '">' + u.initials + '</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">' + u.name + (isMe ? ' <span style="font-size:10px;color:var(--accent-dark);background:var(--accent-light);padding:2px 7px;border-radius:8px">You</span>' : "") + (isPending ? ' <span style="font-size:10px;color:var(--amber);background:#FFFBEB;padding:2px 7px;border-radius:8px">&#x23F3; Pending invite</span>' : "") + '</div><div style="font-size:11px;color:var(--muted)">' + (u.email || "") + (u.phone ? " &middot; " + u.phone : "") + (u.lastLogin ? " &middot; Last: " + u.lastLogin : "") + '</div></div><span style="font-size:10px;font-weight:700;color:' + r.color + ";background:" + r.bg + ';padding:3px 9px;border-radius:8px;white-space:nowrap">' + r.icon + " " + r.label + '</span></div><div style="display:flex;gap:7px;flex-wrap:wrap"><select data-uruid="' + u.id + '" onchange="updateUserRoleByEl(this)" style="flex:1;min-width:140px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-family:inherit;font-size:12px;font-weight:600"' + (isMe ? " disabled" : "") + " >" + allRoles.map(function(rk) {
        return '<option value="' + rk + '" ' + (u.role === rk ? "selected" : "") + ">" + state.roles[rk].icon + " " + state.roles[rk].label + "</option>";
      }).join("") + "</select>" + (!isMe ? '<button data-uid="' + u.id + '" onclick="editUserModal(this.dataset.uid)" style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;cursor:pointer;font-family:inherit">&#x270F; Edit</button>' : "") + (!isMe ? '<button data-uid="' + u.id + '" onclick="toggleUserStatusBtn(this)" style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;cursor:pointer;font-family:inherit">' + (u.status === "active" ? "Deactivate" : "Activate") + "</button>" : "") + (!isMe ? '<button data-uid="' + u.id + '" onclick="deleteUserBtn(this)" style="padding:7px 12px;border-radius:8px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:12px;cursor:pointer;font-family:inherit">Delete</button>' : "") + (!isMe ? '<button data-uid="' + u.id + '" onclick="switchUserBtn(this)" style="padding:7px 12px;border-radius:8px;border:none;background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Switch &rarr;</button>' : "") + "</div></div>";
    });
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:16px;margin-top:8px">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:14px">Role Permissions</div>';
    html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Page Access</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr><th style="text-align:left;padding:7px 8px;color:var(--muted);border-bottom:1px solid var(--border)">Page</th>';
    allRoles.forEach(function(rk) {
      var r = state.roles[rk];
      html += '<th style="text-align:center;padding:7px 8px;color:' + r.color + ';border-bottom:1px solid var(--border)">' + r.icon + " " + r.label + "</th>";
    });
    html += "</tr></thead><tbody>";
    NAV.forEach(function(nav, ni) {
      html += "<tr" + (ni % 2 ? ' style="background:var(--bg)"' : "") + '><td style="padding:7px 8px;border-bottom:1px solid var(--border)">' + nav.icon + " " + nav.label + "</td>";
      allRoles.forEach(function(rk) {
        var has = state.roles[rk].pages.indexOf(nav.id) >= 0, locked = rk === "admin" || nav.id === "dashboard";
        html += '<td style="text-align:center;padding:7px 8px;border-bottom:1px solid var(--border)"><input type="checkbox"' + (has ? " checked" : "") + (locked ? " disabled" : "") + ' data-rk="' + rk + '" data-pg="' + nav.id + '" onchange="toggleRolePage(this.dataset.rk,this.dataset.pg)" style="width:15px;height:15px;accent-color:var(--accent);cursor:' + (locked ? "not-allowed" : "pointer") + '"></td>';
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;margin-top:16px">Action Permissions</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr><th style="text-align:left;padding:7px 8px;color:var(--muted);border-bottom:1px solid var(--border)">Permission</th>';
    allRoles.forEach(function(rk) {
      var r = state.roles[rk];
      html += '<th style="text-align:center;padding:7px 8px;color:' + r.color + ';border-bottom:1px solid var(--border)">' + r.icon + " " + r.label + "</th>";
    });
    html += "</tr></thead><tbody>";
    [["canViewFinancials", "Financials"], ["canMarkPaid", "Mark Paid"], ["canAddTenant", "Add Tenants"], ["canEdit", "Edit"], ["canDelete", "Delete"], ["canManageUsers", "Manage Users"]].forEach(function(perm, pi) {
      html += "<tr" + (pi % 2 ? ' style="background:var(--bg)"' : "") + '><td style="padding:7px 8px;border-bottom:1px solid var(--border)">' + perm[1] + "</td>";
      allRoles.forEach(function(rk) {
        var has = !!state.roles[rk][perm[0]], locked = rk === "admin";
        html += '<td style="text-align:center;padding:7px 8px;border-bottom:1px solid var(--border)"><input type="checkbox"' + (has ? " checked" : "") + (locked ? " disabled" : "") + ' data-rk="' + rk + '" data-pm="' + perm[0] + '" onchange="toggleRolePerm(this.dataset.rk,this.dataset.pm)" style="width:15px;height:15px;accent-color:var(--accent);cursor:' + (locked ? "not-allowed" : "pointer") + '"></td>';
      });
      html += "</tr>";
    });
    html += "</tbody></table></div></div>";
    return html;
  }
  function updateUserRole(uid, role) {
    var u = state.users.find(function(x) {
      return String(x.id) === String(uid);
    });
    if (!u) return;
    u.role = role;
    if (String(u.id) === String(state.currentUser.id)) {
      state.currentUser.role = role;
      if (!canSee(state.page)) state.page = "dashboard";
    }
    saveState();
    render();
  }
  function toggleRolePage(rk, pg) {
    if (rk === "admin" || pg === "dashboard") return;
    var r = state.roles[rk];
    if (!r) return;
    var i = r.pages.indexOf(pg);
    if (i >= 0) r.pages.splice(i, 1);
    else r.pages.push(pg);
    if (String(state.currentUser.role) === rk && !canSee(state.page)) state.page = "dashboard";
    saveState();
    render();
  }
  function toggleRolePerm(rk, pm) {
    if (rk === "admin") return;
    var r = state.roles[rk];
    if (!r) return;
    r[pm] = !r[pm];
    saveState();
    render();
  }
  function toggleUserStatus(uid) {
    var u = state.users.find(function(x) {
      return String(x.id) === String(uid);
    });
    if (!u || String(u.id) === String(state.currentUser.id)) return;
    u.status = u.status === "active" ? "inactive" : "active";
    saveState();
    render();
  }
  function openAddUserModal() {
    openInviteUserModal();
  }
  function saveNewUser() {
    var name = (document.getElementById("nu-name") || { value: "" }).value.trim();
    if (!name) return;
    var initials = name.split(" ").map(function(w) {
      return w[0];
    }).join("").toUpperCase().slice(0, 2);
    state.users.push({
      id: crypto.randomUUID(),
      name,
      initials,
      email: (document.getElementById("nu-email") || { value: "" }).value,
      phone: (document.getElementById("nu-phone") || { value: "" }).value,
      role: (document.getElementById("nu-role") || { value: "viewer" }).value,
      status: "active",
      lastLogin: "Never"
    });
    saveState();
    closeModal();
    render();
  }
  function getVoidDays(pid, rn) {
    if (!state.voidDates) return 0;
    var since = state.voidDates[pid + "_" + rn];
    if (!since) return 0;
    return Math.max(0, Math.floor((TODAY - new Date(since)) / 864e5));
  }
  function renderComplianceWidget() {
    if (!state.propDocs || !Object.keys(state.propDocs).length) {
      return `<div style="font-size:14px;font-weight:700;margin-bottom:6px">\u{1F4CB} Compliance Calendar</div><div style="font-size:12px;color:var(--muted)">Add Gas Safety, EICR and HMO Licence expiry dates in each property's Docs tab.</div>`;
    }
    var alerts = [], upcoming = [], ok = 0;
    Object.keys(state.propDocs).forEach(function(pid) {
      var prop = state.properties.find(function(p) {
        return String(p.id) === String(pid);
      });
      if (!prop || prop.status === "archived") return;
      (state.propDocs[pid] || []).forEach(function(doc) {
        if (!doc.expiresAt) return;
        var meta = getPropDocMeta(doc.type);
        if (!meta || meta.warn === 0) return;
        var days = getDaysUntilExpiry(doc.expiresAt);
        var item = { propName: prop.name, docType: doc.type, icon: meta.icon, days, expiresAt: doc.expiresAt };
        if (days < 0) {
          item.status = "expired";
          alerts.push(item);
        } else if (days <= meta.warn) {
          item.status = "warning";
          alerts.push(item);
        } else if (days <= meta.warn + 30) {
          item.status = "upcoming";
          upcoming.push(item);
        } else ok++;
      });
    });
    alerts.sort(function(a, b) {
      return a.days - b.days;
    });
    upcoming.sort(function(a, b) {
      return a.days - b.days;
    });
    var total = alerts.length + upcoming.length + ok;
    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div><div style="font-size:14px;font-weight:700">\u{1F4CB} Compliance Calendar</div>';
    html += '<div style="font-size:12px;color:var(--muted)">' + total + " certificates tracked</div></div></div>";
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">';
    html += '<div style="background:' + (alerts.length ? "var(--red-light)" : "var(--bg)") + ";border:1px solid " + (alerts.length ? "#FECDD3" : "var(--border)") + ';border-radius:9px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:' + (alerts.length ? "var(--red)" : "var(--dim)") + '">' + alerts.length + '</div><div style="font-size:9px;font-weight:700;color:' + (alerts.length ? "var(--red)" : "var(--dim)") + ';text-transform:uppercase;margin-top:2px">Expired / Due</div></div>';
    html += '<div style="background:' + (upcoming.length ? "var(--amber-light)" : "var(--bg)") + ";border:1px solid " + (upcoming.length ? "#FDE68A" : "var(--border)") + ';border-radius:9px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:' + (upcoming.length ? "var(--amber)" : "var(--dim)") + '">' + upcoming.length + '</div><div style="font-size:9px;font-weight:700;color:' + (upcoming.length ? "var(--amber)" : "var(--dim)") + ';text-transform:uppercase;margin-top:2px">Due Soon</div></div>';
    html += '<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:9px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--green)">' + ok + '</div><div style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;margin-top:2px">Current</div></div>';
    html += "</div>";
    if (!alerts.length && !upcoming.length) return html + '<div style="text-align:center;padding:12px;color:var(--dim);font-size:12px">\u2713 All certificates current</div>';
    alerts.concat(upcoming).slice(0, 8).forEach(function(item) {
      var isExp = item.days < 0;
      var bg = isExp ? "var(--red-light)" : "var(--amber-light)";
      var border = isExp ? "#FECDD3" : "#FDE68A";
      var col = isExp ? "var(--red)" : "var(--amber)";
      var label = isExp ? "EXPIRED " + Math.abs(item.days) + "d ago" : "Expires in " + item.days + "d";
      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:' + bg + ";border:1px solid " + border + ";border-left:3px solid " + col + ';border-radius:8px;margin-bottom:6px">';
      html += '<span style="font-size:16px">' + item.icon + "</span>";
      html += '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + item.propName + "</div>";
      html += '<div style="font-size:11px;color:var(--muted)">' + item.docType + "</div></div>";
      html += '<div style="text-align:right;flex-shrink:0"><div style="font-size:10px;font-weight:700;color:' + col + '">' + label + "</div>";
      html += '<div style="font-size:10px;color:var(--dim)">' + new Date(item.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + "</div></div></div>";
    });
    return html;
  }
  function renderDepositSummary() {
    var active = state.tenants.filter(function(t) {
      return t.status === "active" || t.status === "notice_given";
    });
    var totalHeld = active.filter(function(t) {
      return t.depositStatus !== "returned";
    }).reduce(function(s, t) {
      return s + (t.deposit || 0);
    }, 0);
    var noRef = active.filter(function(t) {
      return (t.deposit || 0) > 0 && !t.depositRef;
    }).length;
    var byScheme = {};
    active.forEach(function(t) {
      if (!(t.deposit > 0)) return;
      var s = t.depositScheme || "Unknown";
      byScheme[s] = (byScheme[s] || 0) + (t.deposit || 0);
    });
    var html = '<div style="font-size:14px;font-weight:700;margin-bottom:12px">\u{1F510} Deposit Register</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
    html += '<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:9px;padding:10px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace">' + fmt(totalHeld) + '</div><div style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;margin-top:2px">Held</div></div>';
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--muted);font-family:monospace">' + active.filter(function(t) {
      return t.depositStatus !== "returned";
    }).length + '</div><div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-top:2px">Tenants</div></div>';
    html += "</div>";
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    Object.keys(byScheme).forEach(function(s) {
      html += '<div style="padding:4px 10px;background:var(--bg);border:1px solid var(--border);border-radius:20px;font-size:12px"><span style="font-weight:700">' + s + '</span> <span style="color:var(--muted);font-family:monospace">' + fmt(byScheme[s]) + "</span></div>";
    });
    if (!Object.keys(byScheme).length) html += '<span style="font-size:12px;color:var(--dim)">No deposits recorded</span>';
    html += "</div>";
    if (noRef > 0) html += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:10px;font-size:12px;color:var(--amber);font-weight:600">\u26A0 ' + noRef + " tenant" + (noRef > 1 ? "s" : "") + " missing deposit reference</div>";
    return html;
  }
  function renderVoidTracker() {
    if (!state.voidDates) state.voidDates = {};
    var voids = [];
    state.properties.forEach(function(p) {
      (p.roomList || []).forEach(function(r) {
        if (r.status !== "vacant") return;
        var key = p.id + "_" + r.n;
        if (!state.voidDates[key]) {
          var d = /* @__PURE__ */ new Date();
          d.setDate(d.getDate() - (Math.floor(Math.random() * 83) + 7));
          state.voidDates[key] = d.toISOString().split("T")[0];
        }
        var days = getVoidDays(p.id, r.n);
        var dailyCost = Math.round(r.price / 7);
        voids.push({
          p,
          r,
          days,
          cost: Math.round(days * dailyCost),
          since: new Date(state.voidDates[key]).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          dailyCost
        });
      });
    });
    voids.sort(function(a, b) {
      return b.cost - a.cost;
    });
    var tc = voids.reduce(function(s, v) {
      return s + v.cost;
    }, 0);
    var td = voids.reduce(function(s, v) {
      return s + v.dailyCost;
    }, 0);
    var lng = voids.length ? voids.reduce(function(a, b) {
      return a.days > b.days ? a : b;
    }) : null;
    var html = '<div style="font-size:14px;font-weight:700;margin-bottom:4px">&#x1F4CA; Void Period Tracker</div>';
    html += '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">' + voids.length + " vacant rooms &middot; daily lost income tracked</div>";
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">';
    html += '<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:9px;padding:10px;text-align:center"><div style="font-size:13px;font-weight:800;color:var(--red);font-family:monospace">' + fmt(tc) + '</div><div style="font-size:9px;color:var(--red);font-weight:700;margin-top:2px">TOTAL VOID COST</div></div>';
    html += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:10px;text-align:center"><div style="font-size:13px;font-weight:800;color:var(--amber);font-family:monospace">' + fmt(td) + '</div><div style="font-size:9px;color:var(--amber);font-weight:700;margin-top:2px">DAILY LOSS</div></div>';
    html += '<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:9px;padding:10px;text-align:center"><div style="font-size:13px;font-weight:800;color:var(--blue);font-family:monospace">' + (lng ? lng.days + "d" : "0d") + '</div><div style="font-size:9px;color:var(--blue);font-weight:700;margin-top:2px">LONGEST VOID</div></div>';
    html += "</div>";
    if (!voids.length) return html + '<div style="text-align:center;padding:16px;color:var(--dim)">&#x1F389; No vacant rooms!</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<tr style="background:var(--bg)"><th style="text-align:left;padding:6px 8px;color:var(--muted)">Room</th><th style="padding:6px 8px;color:var(--muted)">Since</th><th style="padding:6px 8px;color:var(--muted)">Days</th><th style="padding:6px 8px;color:var(--muted)">&pound;/day</th><th style="padding:6px 8px;color:var(--muted)">Total</th></tr>';
    voids.slice(0, 12).forEach(function(v, i) {
      var col = v.days > 60 ? "var(--red)" : v.days > 30 ? "var(--amber)" : "var(--muted)";
      html += '<tr style="border-top:1px solid var(--border);background:' + (i % 2 ? "var(--bg)" : "var(--surface)") + '"><td style="padding:6px 8px"><div style="font-weight:600">' + v.p.name + '</div><div style="color:var(--muted);font-size:10px">Rm ' + v.r.n + " &middot; " + (v.r.type || "Room") + '</div></td><td style="padding:6px 8px;color:var(--muted)">' + v.since + '</td><td style="padding:6px 8px;font-weight:700;color:' + col + '">' + v.days + 'd</td><td style="padding:6px 8px;color:var(--muted)">&pound;' + v.dailyCost + '</td><td style="padding:6px 8px;font-weight:800;color:var(--red);font-family:monospace">' + fmt(v.cost) + "</td></tr>";
    });
    html += '<tr style="border-top:2px solid var(--border)"><td colspan="3" style="padding:6px 8px;font-weight:700">TOTAL</td><td style="padding:6px 8px;color:var(--amber);font-weight:700">&pound;' + td + '/d</td><td style="padding:6px 8px;font-weight:800;color:var(--red);font-family:monospace">' + fmt(tc) + "</td></tr>";
    html += "</table></div>";
    return html;
  }
  function generateAgreement(tenantId) {
    var t = state.tenants.find(function(x) {
      return x.id === tenantId;
    });
    if (!t) return;
    var p = state.properties.find(function(x) {
      return x.name === t.property;
    });
    var room = p && p.roomList ? p.roomList.find(function(r) {
      return r.n === t.room;
    }) : null;
    var ll = state.landlords.find(function(x) {
      return x.name === p.landlordName;
    }) || {};
    var co = state.companies && state.companies[0] || {};
    var today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    var moveIn = t.startDate ? new Date(t.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : t.moveIn || "\u2014";
    var fixedEnd = "";
    try {
      var fd = new Date(t.startDate || t.moveIn || Date.now());
      fd.setMonth(fd.getMonth() + 6);
      fixedEnd = fd.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    } catch (e) {
    }
    var propAddr = p ? p.address || p.name : t.property;
    var deposit = t.deposit || t.rent * 2;
    var depScheme = t.depositScheme || "DPS";
    var depRef = t.depositRef || "(to be confirmed within 30 days)";
    var rentAmt = "\xA3" + t.rent + " per " + (t.freq === "weekly" ? "week" : "month");
    var payDay = t.freq === "monthly" ? "the " + (t.payDayOfMonth || 1) + (t.payDayOfMonth === 1 ? "st" : t.payDayOfMonth === 2 ? "nd" : t.payDayOfMonth === 3 ? "rd" : "th") + " day of each month" : "every " + (t.payDay || "Monday");
    var payMethod = t.method === "bank" ? "Bank Transfer (BACS)" : "Cash";
    var roomDesc = "Room " + t.room + (room ? " (" + room.type + ")" : "");
    var propCoName = co.name || "Reservations Direct Limited";
    var propCoAddr = co.address || "South London";
    var S = [];
    S.push('<div id="agreement-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto">');
    S.push('<div style="position:sticky;top:0;background:#0F0F1A;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:10;print-color-adjust:exact">');
    S.push('<span style="color:#fff;font-size:14px;font-weight:700">AST Agreement \u2014 ' + t.name + "</span>");
    S.push('<div style="display:flex;gap:8px">');
    S.push('<button onclick="window.print()" style="padding:8px 16px;border-radius:8px;border:none;background:#10B981;color:#fff;font-size:13px;font-weight:700;cursor:pointer">\u{1F5A8} Print / PDF</button>');
    S.push('<button onclick="closeAgreement()" style="padding:8px 14px;border-radius:8px;border:1px solid #444;background:transparent;color:#fff;font-size:13px;cursor:pointer">\u2715 Close</button>');
    S.push("</div></div>");
    S.push('<div style="max-width:760px;margin:0 auto;padding:48px 36px;font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#111">');
    S.push('<div style="text-align:center;margin-bottom:36px;padding-bottom:24px;border-bottom:3px double #000">');
    S.push('<div style="font-size:24px;font-weight:800;letter-spacing:-.5px;font-family:Arial,sans-serif;text-transform:uppercase">' + propCoName + "</div>");
    S.push('<div style="font-size:11px;color:#555;margin-top:4px">' + propCoAddr + " \xB7 Property Management</div>");
    S.push('<div style="margin-top:20px;font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Assured Shorthold Tenancy Agreement</div>');
    S.push('<div style="font-size:11px;color:#777;margin-top:6px">Pursuant to the Housing Act 1988 as amended by the Housing Act 1996</div>');
    S.push('<div style="font-size:11px;color:#777;margin-top:2px">Agreement date: <strong>' + today + "</strong></div>");
    S.push("</div>");
    S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin:24px 0 10px">THE PARTIES</h2>');
    S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:4px;padding:14px 18px;margin-bottom:20px">');
    S.push('<div style="display:grid;grid-template-columns:180px 1fr;gap:0">');
    var parties = [
      ["Landlord / Licensor", propCoName + ' (the "Landlord")'],
      ["Landlord Address", propCoAddr],
      ["Tenant", t.name + ' (the "Tenant")'],
      ["Tenant Email", t.email || "\u2014"],
      ["Tenant Phone", t.whatsapp || "\u2014"]
    ];
    parties.forEach(function(r) {
      S.push('<div style="padding:5px 0;border-bottom:1px solid #E8EBF0;font-weight:700;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em">' + r[0] + "</div>");
      S.push('<div style="padding:5px 0;border-bottom:1px solid #E8EBF0;font-size:13px">' + r[1] + "</div>");
    });
    S.push("</div></div>");
    S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin:24px 0 10px">KEY TERMS</h2>');
    S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:4px;padding:14px 18px;margin-bottom:24px">');
    S.push('<div style="display:grid;grid-template-columns:180px 1fr;gap:0">');
    var terms = [
      ["Property", propAddr],
      ["Room", roomDesc],
      ["Tenancy Type", "Assured Shorthold Tenancy"],
      ["Start Date", moveIn],
      ["Initial Fixed Term", "6 months (to " + fixedEnd + ")"],
      ["After Fixed Term", "Periodic monthly tenancy (1 month notice each side)"],
      ["Weekly Rent", "\xA3" + t.rent + " per week"],
      ["Monthly Equivalent", "\xA3" + Math.round(t.rent * 52 / 12) + " per month"],
      ["Rent Frequency", t.freq === "weekly" ? "Weekly" : "Monthly"],
      ["Payment Due", payDay],
      ["Payment Method", payMethod],
      ["Deposit", "\xA3" + deposit],
      ["Deposit Scheme", depScheme],
      ["Deposit Reference", depRef]
    ];
    terms.forEach(function(r) {
      S.push('<div style="padding:5px 0;border-bottom:1px solid #E8EBF0;font-weight:700;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em">' + r[0] + "</div>");
      S.push('<div style="padding:5px 0;border-bottom:1px solid #E8EBF0;font-size:13px">' + r[1] + "</div>");
    });
    S.push("</div></div>");
    S.push('<div style="background:#EFF6FF;border:2px solid #3B82F6;border-radius:4px;padding:14px 18px;margin-bottom:24px">');
    S.push('<div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#1D4ED8">\u2139 PRESCRIBED INFORMATION \u2014 HOUSING ACT 1988</div>');
    S.push('<div style="font-size:12px;line-height:1.6;color:#1e3a5f">');
    S.push("This is an <strong>Assured Shorthold Tenancy (AST)</strong> under sections 19A and 20 of the Housing Act 1988 as amended. ");
    S.push("The Tenant has full statutory rights including the right to a section 21 notice before possession can be sought after the fixed term. ");
    S.push("The deposit will be protected in a government-approved scheme within 30 days of receipt. ");
    S.push("The Tenant is entitled to receive Prescribed Information about the deposit scheme within that period.");
    S.push("</div></div>");
    var clauses = [
      [
        "1. DEMISE",
        "<p>The Landlord lets and the Tenant takes the property known as <strong>" + roomDesc + ", " + propAddr + '</strong> (the "Property") for use as a private residential dwelling for the period described above.</p><p>The Tenant shall have exclusive use of the room and shared use of communal facilities including kitchen, bathrooms, and living areas (if any).</p>'
      ],
      [
        "2. TERM AND CONTINUATION",
        "<p>The tenancy is granted for an <strong>initial fixed term of 6 months</strong> commencing <strong>" + moveIn + "</strong> and expiring <strong>" + fixedEnd + "</strong>.</p><p>After the fixed term, if neither party serves notice, the tenancy shall continue as a <strong>statutory periodic tenancy</strong> on a monthly basis under section 5 of the Housing Act 1988.</p><p>During the periodic tenancy, either party may terminate by giving at least <strong>one month's written notice</strong> expiring on a rent payment date. The Landlord must serve a valid Section 21 Notice before commencing possession proceedings.</p>"
      ],
      [
        "3. RENT",
        "<p>The Tenant agrees to pay rent of <strong>" + rentAmt + "</strong>, payable in advance <strong>" + payDay + "</strong> by <strong>" + payMethod + "</strong>.</p><p>Rent is due on time without deduction, set-off, or counterclaim. The Landlord reserves the right to charge a late payment fee of \xA325 for rent received more than 3 days after the due date.</p><p>The Landlord may review and increase the rent after the fixed term by serving a <strong>Section 13 Notice</strong> (Form 4) giving at least one month's notice. The Tenant has the right to refer any rent increase to the First-tier Tribunal (Property Chamber).</p>"
      ],
      [
        "4. DEPOSIT",
        "<p>A deposit of <strong>\xA3" + deposit + "</strong> is payable before or upon commencement of the tenancy. The Landlord will protect this deposit in the <strong>" + depScheme + "</strong> scheme within 30 days.</p><p>The Prescribed Information regarding the deposit scheme will be provided to the Tenant within 30 days of receipt of the deposit.</p><p>The deposit may be used to cover: unpaid rent; damage beyond fair wear and tear; missing items from the inventory; costs of cleaning if the property is not left in an equivalent state of cleanliness.</p><p>The deposit will be returned, less any agreed deductions, within 10 days of the Tenant vacating and the parties agreeing the deductions. The Landlord will not make deductions without evidence.</p>"
      ],
      [
        "5. TENANT'S OBLIGATIONS",
        `<p>The Tenant agrees to:</p><ol style="margin:8px 0 0 20px;padding:0;line-height:2"><li>Pay the rent on time as specified above.</li><li>Pay any bills for which the Tenant is expressly responsible under this agreement.</li><li>Keep the room and shared areas in a clean and tidy condition.</li><li>Report any defects, damage, or maintenance issues to the Landlord promptly in writing.</li><li>Not cause or permit any damage to the property beyond fair wear and tear.</li><li>Not sublet, assign, or permit any other person to occupy the property without prior written consent.</li><li>Not keep any animals or pets at the property without prior written consent.</li><li>Not smoke or permit smoking anywhere inside the property.</li><li>Not carry on any business, trade, or profession at the property without prior written consent.</li><li>Not make any alterations, additions, or improvements to the property without prior written consent.</li><li>Allow the Landlord or their agents access to the property on giving at least <strong>24 hours' written notice</strong> (except in emergency).</li><li>Comply with all reasonable house rules and policies notified by the Landlord from time to time.</li><li>Not cause nuisance or annoyance to neighbouring occupiers or other residents.</li><li>Ensure bins are put out on collection days as directed.</li></ol>`
      ],
      [
        "6. LANDLORD'S OBLIGATIONS",
        '<p>The Landlord agrees to:</p><ol style="margin:8px 0 0 20px;padding:0;line-height:2"><li>Allow the Tenant quiet enjoyment of the property without interference.</li><li>Maintain the structure and exterior of the property in good repair (section 11, Landlord and Tenant Act 1985).</li><li>Keep in repair and proper working order installations for the supply of water, gas, electricity, and sanitation.</li><li>Ensure the property meets all fire, gas, and electrical safety requirements including annual gas safety certificate and 5-yearly EICR.</li><li>Provide an Energy Performance Certificate (EPC) with a minimum rating of E or above.</li><li>Protect the deposit in a government-approved scheme and provide Prescribed Information within 30 days.</li><li>Give proper notice before entering the property.</li></ol>'
      ],
      [
        "7. UTILITIES AND COUNCIL TAX",
        "<p>Unless otherwise agreed in writing, the rent <strong>includes</strong> the following: gas, electricity, water, and broadband.</p><p><strong>Council Tax</strong> is the responsibility of the Landlord as the property is an HMO. If the property ceases to qualify as an HMO or the Tenant is the sole occupant, the Tenant shall be responsible for Council Tax in their name.</p><p>The Landlord reserves the right to implement a fair usage policy for utilities. Excessive consumption will be notified in writing and may be charged to the Tenant at cost.</p>"
      ],
      [
        "8. REPAIRS AND MAINTENANCE",
        "<p>The Tenant must notify the Landlord in writing (including WhatsApp) of any defect or disrepair requiring attention as soon as reasonably practicable after it comes to their attention.</p><p>The Tenant shall be liable for any damage caused by their failure to report a defect promptly where that failure results in increased repair costs.</p><p>The Landlord will respond to urgent repairs (total loss of heating, water, or security) within 24 hours. Non-urgent repairs will be addressed within 14 days.</p>"
      ],
      [
        "9. ALTERATIONS AND DECORATION",
        "<p>The Tenant must not carry out any alterations, redecoration, or improvements to the property without the prior written consent of the Landlord. The Tenant must restore the property to its original condition at the end of the tenancy if alterations were permitted.</p>"
      ],
      [
        "10. ASSIGNMENT AND SUBLETTING",
        "<p>The Tenant must not assign this tenancy, sublet the whole or any part of the property, or take in a lodger or paying guest without the prior written consent of the Landlord. Any purported assignment or subletting without consent shall be void and may be grounds for possession.</p>"
      ],
      [
        "11. END OF TENANCY",
        '<p>On termination of this tenancy, the Tenant shall:</p><ol style="margin:8px 0 0 20px;padding:0;line-height:2"><li>Vacate the property and return all keys by 12:00 noon on the termination date.</li><li>Remove all personal belongings. Items left will be disposed of after 7 days without liability.</li><li>Leave the room and all communal areas in the same clean condition as at the start, allowing for fair wear and tear.</li><li>Leave all fixtures, fittings, and appliances provided in good working order.</li><li>Provide a forwarding address for correspondence.</li></ol>'
      ],
      [
        "12. POSSESSION PROCEEDINGS",
        `<p>The Landlord may seek possession of the property by serving the appropriate notice under the Housing Act 1988 (as amended by the Housing Act 1996 and Deregulation Act 2015):</p><ul style="margin:8px 0 0 20px;padding:0;line-height:2"><li><strong>Section 21 Notice:</strong> No-fault basis, giving at least 2 months' notice after the fixed term expires. Cannot be served in the first 4 months of the tenancy.</li><li><strong>Section 8 Notice:</strong> On specified grounds (e.g. rent arrears of 2+ months \u2014 Ground 8, 10, 11), with the appropriate notice period.</li></ul>`
      ],
      [
        "13. HOUSE RULES",
        '<p>The following rules apply to all occupants and guests:</p><ul style="margin:8px 0 0 20px;padding:0;line-height:2"><li><strong>Quiet hours:</strong> 11:00pm to 7:00am on all days.</li><li><strong>No smoking</strong> anywhere inside the property including all rooms, hallways, and stairwells.</li><li>All communal areas (kitchen, bathrooms, hallways) must be kept clean and tidy at all times.</li><li>No overnight guests without prior agreement from the Landlord.</li><li>No illegal drugs or activities of any kind on the premises.</li><li>No items to be stored in communal hallways or blocking fire escape routes.</li><li>Waste to be separated correctly and bins presented on collection days.</li></ul>'
      ],
      [
        "14. DATA PROTECTION",
        "<p>The Landlord will process the Tenant's personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. Personal data will be used solely for the purposes of managing this tenancy, complying with legal obligations, and protecting the Landlord's legitimate interests. The Tenant has the right to access, rectify, or erase their data by contacting the Landlord in writing.</p>"
      ],
      [
        "15. GOVERNING LAW",
        "<p>This agreement is governed by and construed in accordance with the <strong>law of England and Wales</strong>. Any disputes arising from this agreement shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p><p>Before commencing any court proceedings, the parties agree to attempt to resolve any dispute informally, and if unsuccessful, via the relevant redress scheme or the First-tier Tribunal (Property Chamber) where applicable.</p>"
      ]
    ];
    clauses.forEach(function(clause) {
      S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin:28px 0 10px">' + clause[0] + "</h2>");
      S.push(clause[1]);
    });
    S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin:28px 0 10px">16. INVENTORY</h2>');
    S.push("<p>An inventory of the furniture, furnishings, and fittings provided by the Landlord shall be prepared at the start of the tenancy and signed by both parties. The inventory forms part of this agreement. The Tenant should check the inventory carefully and report any discrepancies within 48 hours of moving in.</p>");
    S.push('<div style="background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:14px 18px;margin-top:10px">');
    S.push('<p style="font-weight:700;font-size:12px;margin-bottom:8px">ROOM ' + t.room + " INVENTORY (complete at check-in):</p>");
    ["Bed frame", "Mattress", "Wardrobe", "Chest of drawers / storage", "Desk / chair", "Curtains / blinds", "Smoke detector working", "Carbon monoxide detector (if applicable)"].forEach(function(item) {
      S.push('<div style="display:grid;grid-template-columns:1fr 80px 80px 80px;gap:8px;padding:4px 0;border-bottom:1px solid #eee;font-size:12px">');
      S.push("<span>" + item + '</span><span style="text-align:center;color:#555">Good / Fair / Poor</span><span style="text-align:center;color:#555">_______</span><span></span>');
      S.push("</div>");
    });
    S.push("</div>");
    S.push('<div style="margin-top:48px;page-break-inside:avoid">');
    S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin-bottom:24px">EXECUTION</h2>');
    S.push('<p style="font-size:12px;margin-bottom:24px">By signing below, both parties confirm they have read, understood, and agreed to the terms of this Assured Shorthold Tenancy Agreement.</p>');
    S.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">');
    S.push("<div>");
    S.push('<p style="font-weight:700;font-size:13px;margin-bottom:12px">TENANT</p>');
    S.push('<p style="font-size:12px;color:#555;margin-bottom:4px">Full Name: <strong>' + t.name + "</strong></p>");
    S.push('<div style="border:none;border-bottom:1px solid #000;height:50px;margin:16px 0 6px"></div>');
    S.push('<p style="font-size:11px;color:#777">Signature</p>');
    S.push('<div style="margin-top:16px;font-size:12px">Date: ________________________________</div>');
    S.push("</div>");
    S.push("<div>");
    S.push('<p style="font-weight:700;font-size:13px;margin-bottom:12px">LANDLORD / AGENT</p>');
    S.push('<p style="font-size:12px;color:#555;margin-bottom:4px">On behalf of: <strong>' + propCoName + "</strong></p>");
    S.push('<div style="border:none;border-bottom:1px solid #000;height:50px;margin:16px 0 6px"></div>');
    S.push('<p style="font-size:11px;color:#777">Authorised Signature</p>');
    S.push('<div style="margin-top:16px;font-size:12px">Date: ________________________________</div>');
    S.push("</div>");
    S.push("</div>");
    S.push('<div style="margin-top:32px;padding:14px 18px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px">');
    S.push('<p style="font-weight:700;font-size:12px;margin-bottom:10px">WITNESS (optional but recommended)</p>');
    S.push('<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;font-size:12px">');
    ["Name", "Signature", "Date"].forEach(function(f) {
      S.push('<div><p style="color:#555;font-size:11px;margin-bottom:4px">' + f + '</p><div style="border-bottom:1px solid #999;height:28px"></div></div>');
    });
    S.push("</div></div>");
    S.push("</div>");
    S.push('<div style="margin-top:40px;padding-top:16px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#999">');
    S.push(propCoName + " \xB7 Assured Shorthold Tenancy Agreement \xB7 Prepared " + today + " \xB7 Housing Act 1988 (as amended)");
    S.push("</div>");
    S.push("</div></div>");
    var existing = document.getElementById("agreement-overlay");
    if (existing) existing.remove();
    var div = document.createElement("div");
    div.innerHTML = S.join("");
    document.body.appendChild(div.firstChild);
  }
  function closeAgreement() {
    var el = document.getElementById("agreement-overlay");
    if (el) el.remove();
  }
  function generateExcludedLicence(tenantId) {
    var t = state.tenants.find(function(x) {
      return x.id === tenantId;
    });
    if (!t) return;
    var p = state.properties.find(function(x) {
      return x.name === t.property;
    });
    var room = p && p.roomList ? p.roomList.find(function(r) {
      return r.n === t.room;
    }) : null;
    var today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    var moveIn = t.startDate ? new Date(t.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : t.moveIn || "\u2014";
    var propAddr = p ? p.address || p.name : t.property;
    var deposit = t.deposit || t.rent * 2;
    var payDay = t.freq === "monthly" ? t.payDayOfMonth + "th of each month" : "every " + (t.payDay || "Friday");
    var S = [];
    S.push('<div id="agreement-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto">');
    S.push('<div style="position:sticky;top:0;background:#0F0F1A;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:10">');
    S.push('<span style="color:#fff;font-size:14px;font-weight:700">Excluded Licence Agreement \u2014 ' + t.name + "</span>");
    S.push('<div style="display:flex;gap:8px">');
    S.push('<button onclick="window.print()" style="padding:8px 16px;border-radius:8px;border:none;background:#10B981;color:#fff;font-size:13px;font-weight:700;cursor:pointer">\u{1F5A8} Print / PDF</button>');
    S.push('<button onclick="closeAgreement()" style="padding:8px 14px;border-radius:8px;border:1px solid #444;background:transparent;color:#fff;font-size:13px;cursor:pointer">\u2715 Close</button>');
    S.push("</div></div>");
    S.push('<div style="max-width:740px;margin:0 auto;padding:40px 28px;font-family:Georgia,serif;font-size:13px;line-height:1.7;color:#1a1a1a">');
    S.push('<div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #0F0F1A;padding-bottom:20px">');
    S.push('<div style="font-size:22px;font-weight:800;letter-spacing:-.5px;font-family:Arial,sans-serif">RESERVATIONS DIRECT LIMITED</div>');
    S.push('<div style="font-size:12px;color:#555;margin-top:4px">Company No. \xB7 Registered in England & Wales</div>');
    S.push('<div style="font-size:18px;font-weight:700;margin-top:16px;text-transform:uppercase;letter-spacing:1px">Excluded Licence Agreement</div>');
    S.push('<div style="font-size:12px;color:#777;margin-top:4px">Licence to Occupy \u2014 Not an Assured Shorthold Tenancy</div>');
    S.push("</div>");
    S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:6px;padding:4px 16px;margin-bottom:24px">');
    var rows = [
      ["Licensor", 'Reservations Direct Limited ("the Company")'],
      ["Licensee", t.name],
      ["Property Address", propAddr],
      ["Room", "Room " + t.room + (room ? " \u2014 " + room.type : "")],
      ["Licence Fee", "\xA3" + t.rent + " per " + (t.freq === "weekly" ? "week" : "month") + ", payable " + payDay],
      ["Deposit", "\xA3" + deposit],
      ["Payment Method", t.method === "bank" ? "Bank Transfer" : "Cash"],
      ["Commencement Date", moveIn],
      ["Date of Agreement", today]
    ];
    rows.forEach(function(r) {
      S.push('<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px solid #DDE1E7">');
      S.push('<span style="font-weight:700;min-width:160px;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:.04em">' + r[0] + "</span>");
      S.push('<span style="font-size:13px">' + r[1] + "</span>");
      S.push("</div>");
    });
    S.push("</div>");
    S.push('<div style="background:#FFF3CD;border:2px solid #FFC107;border-radius:6px;padding:14px 18px;margin-bottom:24px">');
    S.push('<div style="font-weight:700;font-size:13px;margin-bottom:6px">\u26A0 IMPORTANT NOTICE TO LICENSEE</div>');
    S.push('<div style="font-size:12px;line-height:1.6">This agreement is an <strong>Excluded Licence</strong> and is <strong>NOT</strong> an Assured Shorthold Tenancy. ');
    S.push("The Licensee does not have exclusive possession of the property and does not have the security of tenure afforded to tenants under the Housing Act 1988. ");
    S.push("The Licensor retains the right to access all areas of the property at all times. ");
    S.push("The Licensee is strongly advised to seek independent legal advice before signing this agreement.</div>");
    S.push("</div>");
    var clauses = [
      [
        "1. GRANT OF LICENCE",
        "The Company grants the Licensee a personal, non-exclusive licence to occupy Room " + t.room + " at the above property for the purposes of residential accommodation only. This licence does not create a tenancy or any other interest in land. The Licensee acknowledges that they do not have exclusive possession of the property or any part thereof."
      ],
      [
        "2. LICENCE FEE",
        "The Licensee shall pay a licence fee of <strong>\xA3" + t.rent + " per " + (t.freq === "weekly" ? "week" : "month") + "</strong>, payable in advance <strong>" + payDay + "</strong> by <strong>" + (t.method === "bank" ? "bank transfer" : "cash") + "</strong>. Bank details will be provided by the Company. Payments must be made on time without deduction or set-off. Late payment may result in immediate termination of this licence."
      ],
      [
        "3. DEPOSIT",
        "The Licensee shall pay a deposit of <strong>\xA3" + deposit + "</strong> prior to or on the commencement date. The deposit will be held by the Company and may be used to offset any unpaid licence fees, damage beyond fair wear and tear, or cleaning costs at the end of the licence. The Company will return the deposit within 14 days of the Licensee vacating, subject to any deductions. <em>Note: As this is a licence and not a tenancy, the deposit is not required by law to be protected in a tenancy deposit scheme.</em>"
      ],
      [
        "4. DURATION AND NOTICE",
        "This licence commences on <strong>" + moveIn + "</strong> and continues on a rolling basis until terminated. <strong>Either party may terminate this licence by giving not less than ONE (1) WEEK\u2019s written notice.</strong> Notice may be given in writing, by email, or by WhatsApp message to the other party\u2019s last known contact details. The Company may terminate this licence immediately and without notice in the event of breach of any term of this agreement, non-payment of the licence fee, or behaviour that is harmful to other occupants or the property."
      ],
      [
        "5. LICENSEE OBLIGATIONS",
        "The Licensee agrees to: (a) pay the licence fee on time; (b) keep their room and all shared areas clean and tidy; (c) not damage the property or its contents; (d) not sublet or allow any other person to occupy the room; (e) not keep pets without prior written consent; (f) not smoke inside the property; (g) report all maintenance issues promptly to the Company; (h) not make any alterations to the property; (i) comply with all reasonable house rules issued by the Company from time to time; (j) allow the Company access to the property at all times, with reasonable notice where practicable."
      ],
      [
        "6. HOUSE RULES",
        "Quiet hours are from <strong>11pm to 7am</strong>. No smoking anywhere inside the property. Shared areas including kitchen, bathrooms and communal spaces must be kept clean at all times. No unauthorised guests staying overnight. No illegal activities of any kind. All bins must be put out on collection day. Failure to comply with house rules may result in immediate termination."
      ],
      [
        "7. COMPANY OBLIGATIONS",
        "The Company agrees to: (a) provide the Licensee with quiet enjoyment of the room insofar as is consistent with this licence; (b) maintain the structure and fabric of the property in good repair; (c) ensure utilities (unless otherwise agreed) are maintained; (d) carry out repairs within a reasonable time of being notified."
      ],
      [
        "8. UTILITIES AND SERVICES",
        "Unless separately agreed in writing, the licence fee includes contribution towards gas, electricity, and water. The Licensee is responsible for their own council tax registration if required. Internet access may be provided at the Company\u2019s discretion."
      ],
      [
        "9. EXCLUSION OF LIABILITY",
        "The Company shall not be liable for any loss, theft, or damage to the Licensee\u2019s personal belongings. The Licensee is strongly advised to obtain personal contents insurance. The Company\u2019s liability is limited to the return of the deposit where applicable."
      ],
      [
        "10. GOVERNING LAW",
        "This agreement is governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales."
      ]
    ];
    clauses.forEach(function(cl) {
      S.push('<div style="margin-bottom:18px">');
      S.push('<div style="font-size:13px;font-weight:700;text-transform:uppercase;border-bottom:1px solid #CCC;padding-bottom:5px;margin-bottom:8px;letter-spacing:.04em">' + cl[0] + "</div>");
      S.push('<div style="font-size:13px;line-height:1.75">' + cl[1] + "</div>");
      S.push("</div>");
    });
    var sigDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    var sigIsoDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    S.push('<div style="margin-top:40px;border-top:2px solid #0F0F1A;padding-top:24px">');
    S.push('<div style="font-weight:700;font-size:13px;margin-bottom:20px;text-transform:uppercase;letter-spacing:.04em">Signatures</div>');
    S.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px">');
    S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:8px;padding:18px">');
    S.push('<div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:10px">For and on behalf of the Licensor</div>');
    S.push('<div style="font-size:14px;font-weight:800;margin-bottom:14px">Reservations Direct Limited</div>');
    S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:6px">Signature</div>');
    S.push('<div id="sig-canvas-wrap" style="border:2px solid #CCC;border-radius:6px;background:#fff;margin-bottom:10px;position:relative">');
    S.push('<canvas id="sig-canvas" width="280" height="90" style="display:block;cursor:crosshair;touch-action:none;width:100%"></canvas>');
    S.push('<button onclick="clearSignature()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.1);border:none;border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer;color:#555">Clear</button>');
    S.push("</div>");
    S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:5px">Name (print)</div>');
    S.push('<input id="sig-name" type="text" placeholder="Full name of signatory" style="width:100%;padding:8px 10px;border:1.5px solid #CCC;border-radius:6px;font-size:13px;font-family:inherit;margin-bottom:10px">');
    S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:5px">Date</div>');
    S.push('<div style="display:flex;gap:8px;align-items:center">');
    S.push('<input id="sig-date" type="date" value="' + sigIsoDate + '" style="flex:1;padding:8px 10px;border:1.5px solid #CCC;border-radius:6px;font-size:13px;font-family:inherit">');
    S.push(`<button onclick="document.getElementById('sig-date').value=new Date().toISOString().split('T')[0]" style="padding:8px 12px;border-radius:6px;border:1px solid #10B981;background:#ECFDF5;color:#065F46;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit">Today</button>`);
    S.push("</div>");
    S.push("</div>");
    S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:8px;padding:18px">');
    S.push('<div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:10px">Licensee</div>');
    S.push('<div style="font-size:14px;font-weight:800;margin-bottom:14px">' + t.name + "</div>");
    S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:6px">Signature</div>');
    S.push('<div style="border:2px solid #CCC;border-radius:6px;height:90px;background:#fff;margin-bottom:10px;display:flex;align-items:center;justify-content:center;color:#AAA;font-size:12px">Licensee signs here</div>');
    S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:5px">Name (print)</div>');
    S.push('<div style="border-bottom:1.5px solid #CCC;height:28px;margin-bottom:10px"></div>');
    S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:5px">Date</div>');
    S.push('<div style="border-bottom:1.5px solid #CCC;height:28px"></div>');
    S.push("</div>");
    S.push("</div>");
    S.push('<div style="margin-top:20px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:12px 16px;font-size:12px;color:#1E40AF">');
    S.push("\u{1F4A1} <strong>Before printing:</strong> Sign in the box above, enter your name and confirm the date, then click Print / PDF. Your signature will appear in the printed document.");
    S.push("</div>");
    S.push('<div style="margin-top:32px;padding-top:16px;border-top:1px solid #EEE;text-align:center;font-size:11px;color:#888">');
    S.push("Reservations Direct Limited \xB7 Excluded Licence Agreement \xB7 Generated " + today + " \xB7 Page 1 of 1");
    S.push("</div>");
    S.push("</div></div>");
    var existing = document.getElementById("agreement-overlay");
    if (existing) existing.remove();
    var div = document.createElement("div");
    div.innerHTML = S.join("");
    document.body.appendChild(div.firstChild);
    setTimeout(function() {
      var canvas = document.getElementById("sig-canvas");
      if (!canvas) return;
      var ctx = canvas.getContext("2d");
      var drawing = false;
      var lastX = 0, lastY = 0;
      function getPos(e) {
        var r = canvas.getBoundingClientRect();
        var scaleX = canvas.width / r.width;
        var scaleY = canvas.height / r.height;
        if (e.touches) {
          return { x: (e.touches[0].clientX - r.left) * scaleX, y: (e.touches[0].clientY - r.top) * scaleY };
        }
        return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
      }
      ctx.strokeStyle = "#0F0F1A";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      function start(e) {
        e.preventDefault();
        drawing = true;
        var p2 = getPos(e);
        lastX = p2.x;
        lastY = p2.y;
      }
      function move(e) {
        e.preventDefault();
        if (!drawing) return;
        var p2 = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        lastX = p2.x;
        lastY = p2.y;
      }
      function stop() {
        drawing = false;
      }
      canvas.addEventListener("mousedown", start);
      canvas.addEventListener("mousemove", move);
      canvas.addEventListener("mouseup", stop);
      canvas.addEventListener("mouseleave", stop);
      canvas.addEventListener("touchstart", start, { passive: false });
      canvas.addEventListener("touchmove", move, { passive: false });
      canvas.addEventListener("touchend", stop);
    }, 100);
  }
  function clearSignature() {
    var canvas = document.getElementById("sig-canvas");
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }
  function saveRoomNotes(pid, rn) {
    var el = document.getElementById("room-notes-" + pid + "-" + rn);
    if (el) getMedia(pid, rn).notes = el.value;
  }
  async function removeRoomPhoto(pid, rn, idx) {
    var media = getMedia(pid, rn);
    var photo = media.photos[idx];
    if (photo && photo.path) {
      try {
        await supa.storage.from("room-media").remove([photo.path]);
      } catch (e) {
        console.warn("Could not delete from storage:", e);
      }
    }
    media.photos.splice(idx, 1);
    saveState();
    render();
  }
  function removeRoomVideo(pid, rn) {
    getMedia(pid, rn).video = null;
    saveState();
    render();
  }
  async function handleVideoUpload(pid, rn, input) {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      showToast("Video too large (max 50MB)", "error");
      return;
    }
    showToast("Uploading video...", "success");
    try {
      var ext = file.name.split(".").pop();
      var path = "rooms/" + pid + "/" + rn + "/video_" + Date.now() + "." + ext;
      var upload = await supa.storage.from("room-media").upload(path, file, { upsert: true });
      if (upload.error) throw upload.error;
      var urlData = supa.storage.from("room-media").getPublicUrl(path);
      var url = urlData.data.publicUrl;
      getMedia(pid, rn).video = { src: url, name: file.name, path };
      saveState();
      render();
      showToast("Video uploaded \u2713", "success");
    } catch (err) {
      console.error("Video upload failed:", err);
      showToast("Upload failed: " + (err.message || err), "error");
    }
  }
  async function uploadTenantDoc(tenantId, input) {
    if (!state.vault) state.vault = {};
    if (!state.vault[tenantId]) state.vault[tenantId] = [];
    var docType = (document.getElementById("vault-doc-type-" + tenantId) || {}).value || "Other";
    var files = Array.from(input.files);
    if (!files.length) return;
    for (var fi = 0; fi < files.length; fi++) {
      var file = files[fi];
      if (file.size > 10 * 1024 * 1024) {
        showToast(file.name + " exceeds 10MB limit.", "error");
        continue;
      }
      var sizeStr = file.size > 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(1) + "MB" : Math.round(file.size / 1024) + "KB";
      var now = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      var docId = "tdoc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      var ext = file.name.split(".").pop().toLowerCase();
      var path = "tenants/" + tenantId + "/" + docId + "." + ext;
      showToast("Uploading " + file.name + "\u2026", "success");
      var entry = {
        id: docId,
        name: file.name,
        type: docType,
        size: sizeStr,
        uploadedAt: now,
        dataUrl: null,
        storagePath: null
      };
      state.vault[tenantId].push(entry);
      var uploaded = false;
      try {
        var { error: upErr } = await supa.storage.from("tenant-docs").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        var pubData = supa.storage.from("tenant-docs").getPublicUrl(path);
        if (pubData && pubData.data && pubData.data.publicUrl) {
          entry.dataUrl = pubData.data.publicUrl;
          entry.storagePath = path;
          uploaded = true;
        } else {
          var { data: urlData, error: urlErr } = await supa.storage.from("tenant-docs").createSignedUrl(path, 31536e3);
          if (!urlErr && urlData && urlData.signedUrl) {
            entry.dataUrl = urlData.signedUrl;
            entry.storagePath = path;
            uploaded = true;
          }
        }
        if (uploaded) {
          showToast(file.name + " uploaded \u2713", "success");
        } else {
          throw new Error("Could not get download URL");
        }
      } catch (err) {
        console.warn("Tenant doc storage failed, falling back to base64:", err.message);
        try {
          var b64 = await new Promise(function(res, rej) {
            var r = new FileReader();
            r.onload = function(e) {
              res(e.target.result);
            };
            r.onerror = rej;
            r.readAsDataURL(file);
          });
          entry.dataUrl = b64;
          entry.storagePath = null;
          showToast(file.name + " saved locally", "success");
          uploaded = true;
        } catch (b64err) {
          showToast("Upload failed: " + err.message, "error");
          state.vault[tenantId] = state.vault[tenantId].filter(function(d) {
            return d.id !== docId;
          });
          continue;
        }
      }
      saveState();
    }
    input.value = "";
    state.tenantDetailTab = "vault";
    openTenantDetail(tenantId);
  }
  var _dmEntity = "properties";
  var _dmPreview = null;
  var _dmWarnings = [];
  function openDataModal(entity) {
    _dmEntity = entity || "properties";
    _dmPreview = null;
    _dmWarnings = [];
    _renderDataModal();
  }
  function _renderDataModal() {
    var entity = _dmEntity;
    var label = entity.charAt(0).toUpperCase() + entity.slice(1);
    var preview = _dmPreview;
    var mc = document.getElementById("modal-container");
    if (!mc) return;
    var tabs = ["properties", "tenants", "landlords"].map(function(e) {
      var active = e === entity;
      var lbl = e.charAt(0).toUpperCase() + e.slice(1);
      return '<button data-ent="' + e + '" onclick="openDataModal(this.dataset.ent)" style="padding:9px 18px;border:none;border-bottom:2px solid ' + (active ? "var(--accent)" : "transparent") + ";background:transparent;font-size:13px;font-weight:" + (active ? 700 : 500) + ";color:" + (active ? "var(--accent-dark)" : "var(--muted)") + ';cursor:pointer;font-family:inherit;white-space:nowrap">' + lbl + "</button>";
    }).join("");
    var instrCols = {
      properties: "Property Name \xB7 Address \xB7 Postcode \xB7 Total Rooms \xB7 Landlord Rent (\xA3) \xB7 Monthly Income (\xA3) \xB7 Landlord Name \xB7 Landlord Contact",
      tenants: "Full Name \xB7 Property Name \xB7 Room Number \xB7 Weekly Rent (\xA3) \xB7 Payment Day \xB7 WhatsApp \xB7 Status \xB7 Move-In Date",
      landlords: "Name \xB7 Phone \xB7 Email \xB7 Bank \xB7 Sort Code \xB7 Account No \xB7 Notes"
    };
    var previewCols = {
      properties: [],
      tenants: ["Name", "Property", "Room", "Rent", "Pay Day", "Status"],
      landlords: ["Name", "Phone", "Email"]
    };
    var H = [];
    H.push('<div class="modal-overlay" onclick="if(event.target===this)closeModal()">');
    H.push('<div class="modal" style="max-width:640px">');
    H.push('<div class="modal-header" style="background:linear-gradient(135deg,#0F0F1A,#1a1a3e);padding:16px 20px">');
    H.push('<div style="display:flex;align-items:center;gap:12px"><span style="font-size:20px">\u21C5</span>');
    H.push('<div><div style="font-size:15px;font-weight:700;color:#fff">Data Manager</div>');
    H.push('<div style="font-size:11px;color:rgba(255,255,255,.5)">Import \xB7 Export \xB7 Template download</div></div></div>');
    H.push('<button class="modal-close" onclick="closeModal()" style="color:#fff">&times;</button></div>');
    H.push('<div style="display:flex;border-bottom:1px solid var(--border);background:var(--bg)">' + tabs + "</div>");
    H.push('<div class="modal-body" style="max-height:70vh;overflow-y:auto">');
    H.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">');
    H.push('<button onclick="_dmExport()" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;background:var(--green-light);border:1.5px solid #A7F3D0;border-radius:12px;cursor:pointer;font-family:inherit">');
    H.push('<span style="font-size:28px">\u2B07\uFE0F</span>');
    H.push('<div style="font-size:13px;font-weight:700;color:var(--green)">Export to CSV</div>');
    H.push('<div style="font-size:11px;color:var(--muted)">Download ' + label + " data</div></button>");
    H.push('<button onclick="_dmTemplate()" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;background:var(--blue-light);border:1.5px solid #BFDBFE;border-radius:12px;cursor:pointer;font-family:inherit">');
    H.push('<span style="font-size:28px">\u{1F4CB}</span>');
    H.push('<div style="font-size:13px;font-weight:700;color:var(--blue)">Download Template</div>');
    H.push('<div style="font-size:11px;color:var(--muted)">CSV with all column headers</div></button>');
    H.push("</div>");
    H.push('<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">');
    H.push('<div style="flex:1;height:1px;background:var(--border)"></div>');
    H.push('<span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Import</span>');
    H.push('<div style="flex:1;height:1px;background:var(--border)"></div></div>');
    if (!preview) {
      H.push('<div id="dm-dropzone" onclick="_dmBrowse()"');
      H.push(` ondragover="event.preventDefault();this.style.borderColor='var(--accent)'"`);
      H.push(` ondragleave="this.style.borderColor='var(--border)'"`);
      H.push(' ondrop="_dmDrop(event)"');
      H.push(' style="border:2px dashed var(--border);border-radius:12px;padding:36px 16px;text-align:center;cursor:pointer;background:var(--bg);transition:border-color .15s;margin-bottom:14px">');
      H.push('<div style="font-size:40px;margin-bottom:10px">\u{1F4C2}</div>');
      H.push('<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:5px">Drop file here or click to browse</div>');
      H.push('<div style="font-size:12px;color:var(--muted)">Accepts .xlsx or .csv</div></div>');
      H.push('<input type="file" id="dm-file-inp" accept=".xlsx,.csv" style="display:none" onchange="_dmPickFile(this)">');
      H.push('<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:10px;padding:12px 14px">');
      H.push('<div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:6px">\u2139 Required columns for ' + label + "</div>");
      H.push('<div style="font-size:11px;color:var(--muted);line-height:1.8">' + instrCols[entity] + "</div></div>");
    } else {
      var rows = preview.rows || [];
      var warnings = _dmWarnings || [];
      H.push('<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">');
      H.push('<div><div style="font-size:14px;font-weight:700">' + rows.length + " " + label + " ready</div>");
      if (warnings.length) H.push('<div style="font-size:12px;color:var(--amber);margin-top:3px">\u26A0 ' + warnings.length + " warning(s)</div>");
      else H.push('<div style="font-size:12px;color:var(--green);margin-top:3px">\u2713 All rows validated</div>');
      H.push("</div>");
      H.push('<button onclick="_dmPreview=null;_renderDataModal()" style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;cursor:pointer;font-family:inherit">\u2190 Back</button></div>');
      if (warnings.length) {
        H.push('<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:10px 13px;margin-bottom:12px">');
        warnings.slice(0, 4).forEach(function(w) {
          H.push('<div style="font-size:11px;color:var(--muted);padding:1px 0">\u2022 ' + w + "</div>");
        });
        if (warnings.length > 4) H.push('<div style="font-size:11px;color:var(--dim)">\u2026and ' + (warnings.length - 4) + " more</div>");
        H.push("</div>");
      }
      H.push('<div id="dm-progress-wrap" style="display:none;margin-bottom:14px">');
      H.push('<div style="display:flex;justify-content:space-between;margin-bottom:5px">');
      H.push('<span id="dm-progress-label" style="font-size:12px;font-weight:600">Importing\u2026</span>');
      H.push('<span id="dm-progress-pct" style="font-size:12px;font-weight:700;color:var(--accent);font-family:monospace">0%</span></div>');
      H.push('<div style="background:var(--border);border-radius:6px;height:10px;overflow:hidden">');
      H.push('<div id="dm-progress-bar" style="height:100%;border-radius:6px;background:var(--accent);width:0%;transition:width .35s"></div></div></div>');
      var cols = previewCols[entity] || [];
      H.push('<div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;margin-bottom:16px;max-height:260px;overflow-y:auto">');
      H.push('<table style="width:100%;border-collapse:collapse;font-size:11px">');
      H.push('<thead style="position:sticky;top:0;background:var(--bg)"><tr>');
      cols.forEach(function(c) {
        H.push('<th style="text-align:left;padding:8px 10px;color:var(--muted);font-weight:700;white-space:nowrap;border-bottom:1px solid var(--border)">' + c + "</th>");
      });
      H.push('<th style="padding:8px 10px;border-bottom:1px solid var(--border)"></th>');
      H.push("</tr></thead><tbody>");
      rows.forEach(function(r, i) {
        var exists = false;
        if (entity === "properties") exists = state.properties.some(function(p) {
          return p.name && r.name && p.name.trim().toLowerCase() === r.name.trim().toLowerCase();
        });
        else if (entity === "tenants") exists = state.tenants.some(function(t) {
          return t.name && r.name && t.name.trim().toLowerCase() === r.name.trim().toLowerCase() && t.property === r.property;
        });
        else if (entity === "landlords") exists = state.landlords && state.landlords.some(function(l) {
          return l.name && r.name && l.name.trim().toLowerCase() === r.name.trim().toLowerCase();
        });
        var badge2 = exists ? '<span style="font-size:9px;font-weight:700;color:var(--amber);background:var(--amber-light);padding:1px 6px;border-radius:4px">UPDATE</span>' : '<span style="font-size:9px;font-weight:700;color:var(--green);background:var(--green-light);padding:1px 6px;border-radius:4px">NEW</span>';
        H.push('<tr style="border-top:1px solid var(--border);background:' + (i % 2 ? "var(--bg)" : "var(--surface)") + '">');
        if (entity === "properties") {
          H.push('<td style="padding:7px 10px;font-weight:600;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + r.name + "</td>");
          H.push('<td style="padding:7px 10px;color:var(--muted)">' + (r.postcode || r.area || "\u2014") + "</td>");
          H.push('<td style="padding:7px 10px;text-align:center">' + (r.rooms || 0) + "</td>");
          H.push('<td style="padding:7px 10px;font-family:monospace;color:var(--red)">\xA3' + (r.landlord || 0) + "</td>");
          H.push('<td style="padding:7px 10px;font-family:monospace;color:var(--green)">\xA3' + (r.rent || 0) + "</td>");
          H.push('<td style="padding:7px 10px;max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (r.landlordName || "\u2014") + "</td>");
        } else if (entity === "tenants") {
          H.push('<td style="padding:7px 10px;font-weight:600">' + r.name + "</td>");
          H.push('<td style="padding:7px 10px;color:var(--muted);max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (r.property || "\u2014") + "</td>");
          H.push('<td style="padding:7px 10px;text-align:center">' + (r.room || "\u2014") + "</td>");
          H.push('<td style="padding:7px 10px;font-family:monospace;color:var(--green)">\xA3' + (r.rent || 0) + "/wk</td>");
          H.push('<td style="padding:7px 10px">' + (r.payDay || "\u2014") + "</td>");
          H.push('<td style="padding:7px 10px">' + (r.status || "active") + "</td>");
        } else {
          H.push('<td style="padding:7px 10px;font-weight:600">' + r.name + "</td>");
          H.push('<td style="padding:7px 10px;color:var(--muted)">' + (r.phone || "\u2014") + "</td>");
          H.push('<td style="padding:7px 10px;color:var(--muted)">' + (r.email || "\u2014") + "</td>");
        }
        H.push('<td style="padding:7px 10px">' + badge2 + "</td>");
        H.push("</tr>");
      });
      H.push("</tbody></table></div>");
    }
    H.push("</div>");
    H.push('<div class="modal-footer" style="justify-content:space-between">');
    H.push('<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">Close</button>');
    if (preview && preview.rows && preview.rows.length) {
      H.push('<button id="dm-import-btn" onclick="_dmConfirmImport()" style="padding:9px 22px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">\u2B06 Import ' + preview.rows.length + " " + label + "</button>");
    }
    H.push("</div>");
    H.push("</div></div>");
    mc.innerHTML = H.join("");
  }
  function _dmBrowse() {
    var inp = document.getElementById("dm-file-inp");
    if (inp) inp.click();
  }
  function _dmDrop(e) {
    e.preventDefault();
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) _dmProcessFile(file);
  }
  function _dmPickFile(input) {
    var file = input && input.files && input.files[0];
    if (file) _dmProcessFile(file);
  }
  function _dmProcessFile(file) {
    var entity = _dmEntity;
    var ext = (file.name || "").split(".").pop().toLowerCase();
    if (ext === "xlsx") {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          if (window.XLSX) {
            var wb = window.XLSX.read(e.target.result, { type: "array" });
            var ws = wb.Sheets[wb.SheetNames[0]];
            var data = window.XLSX.utils.sheet_to_json(ws, { defval: "" });
            _dmParseRows(data, entity);
          } else {
            _dmWarnings = ["XLSX parser not loaded \u2014 try CSV format"];
            _dmPreview = { rows: [] };
            _renderDataModal();
          }
        } catch (err) {
          _dmWarnings = ["Parse error: " + err.message];
          _dmPreview = { rows: [] };
          _renderDataModal();
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var lines = e.target.result.split(/\r?\n/).filter(function(l) {
            return l.trim();
          });
          var headers = lines[0].split(",").map(function(h) {
            return h.trim().replace(/^["']|["']$/g, "");
          });
          var data = lines.slice(1).map(function(line) {
            var vals = line.split(",");
            var obj = {};
            headers.forEach(function(h, i) {
              obj[h] = (vals[i] || "").trim().replace(/^["']|["']$/g, "");
            });
            return obj;
          });
          _dmParseRows(data, entity);
        } catch (err) {
          _dmWarnings = ["CSV parse error: " + err.message];
          _dmPreview = { rows: [] };
          _renderDataModal();
        }
      };
      reader.readAsText(file);
    }
  }
  function _dmParseRows(data, entity) {
    _dmWarnings = [];
    var rows = [];
    if (entity === "properties") {
      data.forEach(function(row, i) {
        var name = row["Property Name"] || row["Name"] || row["property_name"] || "";
        if (!name) return;
        var r = {
          name: name.trim(),
          address: row["Address"] || row["address"] || name,
          postcode: row["Postcode"] || row["postcode"] || row["Area"] || "",
          area: row["Area"] || row["area"] || "",
          rooms: parseInt(row["Total Rooms"] || row["Rooms"] || row["rooms"] || 0) || 0,
          landlord: parseFloat(row["Landlord Rent (\xA3)"] || row["Landlord Rent"] || row["landlord_rent"] || 0) || 0,
          rent: parseFloat(row["Monthly Income (\xA3)"] || row["Monthly Income"] || row["monthly_income"] || 0) || 0,
          landlordName: row["Landlord Name"] || row["landlord_name"] || "",
          landlordPhone: row["Landlord Contact"] || row["Landlord Phone"] || row["landlord_contact"] || "",
          companyName: row["Operating Company"] || row["Company"] || "",
          ownershipType: (row["Status"] || row["status"] || "managed").toLowerCase().includes("own") ? "owned" : "managed",
          mapsUrl: row["Maps URL"] || row["maps_url"] || "",
          notes: row["Notes"] || row["notes"] || ""
        };
        if (!r.rooms) _dmWarnings.push("Row " + (i + 2) + ": " + name + " \u2014 no room count");
        rows.push(r);
      });
    } else if (entity === "tenants") {
      data.forEach(function(row, i) {
        var name = row["Full Name"] || row["Name"] || row["name"] || "";
        if (!name) return;
        var r = {
          name: name.trim(),
          property: row["Property Name"] || row["Property"] || row["property"] || "",
          room: parseInt(row["Room Number"] || row["Room"] || row["room"] || 0) || 0,
          rent: parseFloat(row["Weekly Rent (\xA3)"] || row["Rent"] || row["rent"] || 0) || 0,
          freq: (row["Frequency"] || row["freq"] || "weekly").toLowerCase().includes("month") ? "monthly" : "weekly",
          payDay: row["Payment Day"] || row["Pay Day"] || row["payDay"] || "Monday",
          whatsapp: row["WhatsApp"] || row["Phone"] || row["phone"] || "",
          email: row["Email"] || row["email"] || "",
          status: (row["Status"] || row["status"] || "active").toLowerCase().includes("notice") ? "notice_given" : "active",
          moveIn: row["Move-In Date"] || row["Move In"] || row["moveIn"] || "",
          deposit: parseFloat(row["Deposit"] || row["deposit"] || 0) || 0,
          method: (row["Payment Method"] || row["method"] || "bank").toLowerCase().includes("cash") ? "cash" : "bank"
        };
        var p = state.properties.find(function(p2) {
          return r.property && p2.name && p2.name.trim().toLowerCase() === r.property.trim().toLowerCase();
        });
        if (r.property && !p) _dmWarnings.push("Row " + (i + 2) + ": " + name + ' \u2014 property "' + r.property + '" not found');
        rows.push(r);
      });
    } else if (entity === "landlords") {
      data.forEach(function(row, i) {
        var name = row["Name"] || row["name"] || "";
        if (!name) return;
        rows.push({
          name: name.trim(),
          phone: row["Phone"] || row["phone"] || "",
          email: row["Email"] || row["email"] || "",
          bank: row["Bank"] || row["bank"] || "",
          sortCode: row["Sort Code"] || row["sortCode"] || "",
          accountNo: row["Account No"] || row["accountNo"] || "",
          notes: row["Notes"] || row["notes"] || ""
        });
      });
    }
    _dmPreview = { rows };
    _renderDataModal();
  }
  async function _dmConfirmImport() {
    var entity = _dmEntity;
    var rows = _dmPreview && _dmPreview.rows || [];
    if (!rows.length) {
      showToast("Nothing to import", "error");
      return;
    }
    var btn2 = document.getElementById("dm-import-btn");
    var progressWrap = document.getElementById("dm-progress-wrap");
    var bar = document.getElementById("dm-progress-bar");
    var label = document.getElementById("dm-progress-label");
    var pct2 = document.getElementById("dm-progress-pct");
    if (btn2) btn2.disabled = true;
    if (progressWrap) progressWrap.style.display = "block";
    function setProgress(done, total2, msg) {
      var p = total2 > 0 ? Math.round(done / total2 * 100) : 0;
      if (bar) bar.style.width = p + "%";
      if (pct2) pct2.textContent = p + "%";
      if (label) label.textContent = msg || "Importing " + done + " / " + total2 + "\u2026";
      if (p === 100 && bar) {
        bar.style.background = "var(--green)";
        if (label) label.textContent = "\u2713 Import complete!";
      }
    }
    var imported = 0, skipped = 0, total = rows.length;
    if (entity === "properties") {
      if (!state.properties) state.properties = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var exists = state.properties.find(function(p) {
          return p.name && r.name && p.name.trim().toLowerCase() === r.name.trim().toLowerCase();
        });
        if (!exists) {
          if (r.landlordName) {
            var ll = state.landlords && state.landlords.find(function(l) {
              return l.name && l.name.trim().toLowerCase() === r.landlordName.trim().toLowerCase();
            });
            if (!ll) {
              if (!state.landlords) state.landlords = [];
              var newLL = { id: crypto.randomUUID(), name: r.landlordName, phone: r.landlordPhone || "", email: "", bank: "", sortCode: "", accountNo: "", notes: "", properties: [] };
              state.landlords.push(newLL);
            }
          }
          var newProp = {
            id: crypto.randomUUID(),
            name: r.name,
            address: r.address,
            postcode: r.postcode,
            area: r.area || r.postcode,
            rooms: r.rooms || 0,
            occupied: 0,
            landlord: r.landlord || 0,
            rent: r.rent || 0,
            ownershipType: r.ownershipType || "managed",
            status: "active",
            landlordName: r.landlordName || "",
            landlordPhone: r.landlordPhone || "",
            mapsUrl: r.mapsUrl || "",
            notes: r.notes || "",
            roomList: []
          };
          state.properties.push(newProp);
          imported++;
        } else {
          skipped++;
        }
        if (i % 10 === 9 || i === rows.length - 1) {
          setProgress(i + 1, total, "Importing properties\u2026 " + (i + 1) + " / " + total);
          await new Promise(function(res) {
            setTimeout(res, 30);
          });
        }
      }
    } else if (entity === "tenants") {
      if (!state.tenants) state.tenants = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var exists = state.tenants.find(function(t) {
          return t.name && r.name && t.name.trim().toLowerCase() === r.name.trim().toLowerCase() && t.property === r.property;
        });
        if (!exists) {
          state.tenants.push({
            id: crypto.randomUUID(),
            name: r.name,
            property: r.property,
            room: r.room,
            rent: r.rent,
            freq: r.freq,
            payDay: r.payDay,
            whatsapp: r.whatsapp,
            email: r.email,
            status: r.status,
            startDate: r.moveIn || null,
            moveIn: r.moveIn || null,
            deposit: r.deposit || 0,
            depositStatus: "held",
            method: r.method,
            arrears: 0,
            paid: "\u2014",
            paymentHistory: []
          });
          imported++;
        } else {
          skipped++;
        }
        if (i % 10 === 9 || i === rows.length - 1) {
          setProgress(i + 1, total, "Importing tenants\u2026 " + (i + 1) + " / " + total);
          await new Promise(function(res) {
            setTimeout(res, 30);
          });
        }
      }
    } else if (entity === "landlords") {
      if (!state.landlords) state.landlords = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var exists = state.landlords.find(function(l) {
          return l.name && r.name && l.name.trim().toLowerCase() === r.name.trim().toLowerCase();
        });
        if (!exists) {
          state.landlords.push({ id: crypto.randomUUID(), name: r.name, phone: r.phone, email: r.email, bank: r.bank, sortCode: r.sortCode, accountNo: r.accountNo, notes: r.notes, properties: [] });
          imported++;
        } else {
          skipped++;
        }
        if (i % 5 === 4 || i === rows.length - 1) {
          setProgress(i + 1, total, "Importing landlords\u2026 " + (i + 1) + " / " + total);
          await new Promise(function(res) {
            setTimeout(res, 20);
          });
        }
      }
    }
    setProgress(total, total);
    saveState();
    rebuildAllSchedules();
    await new Promise(function(res) {
      setTimeout(res, 600);
    });
    if (btn2) {
      btn2.textContent = "\u2713 Done \u2014 Close";
      btn2.disabled = false;
      btn2.onclick = function() {
        closeModal();
        render();
      };
    }
    showToast("Imported " + imported + " " + entity + (skipped ? " \xB7 " + skipped + " skipped" : ""), "success");
  }
  function _dmExport() {
    var entity = _dmEntity;
    var rows, filename, headers;
    if (entity === "properties") {
      headers = ["Property Name", "Address", "Postcode", "Area", "Total Rooms", "Landlord Rent (\xA3)", "Monthly Income (\xA3)", "Occupied Rooms", "Landlord Name", "Ownership Type", "Status", "Maps URL", "Notes"];
      rows = state.properties.map(function(p) {
        return [p.name, p.address || "", p.postcode || "", p.area || "", p.rooms, p.landlord, p.rent, p.occupied, p.landlordName || "", p.ownershipType || "managed", p.status || "active", p.mapsUrl || "", p.notes || ""];
      });
      filename = "properties-export-" + (/* @__PURE__ */ new Date()).toISOString().split("T")[0] + ".csv";
    } else if (entity === "tenants") {
      headers = ["Full Name", "Property Name", "Room Number", "Weekly Rent (\xA3)", "Frequency", "Payment Day", "WhatsApp", "Email", "Status", "Move-In Date", "Deposit", "Payment Method"];
      rows = state.tenants.map(function(t) {
        return [t.name, t.property, t.room, t.rent, t.freq || "weekly", t.payDay || "", t.whatsapp || "", t.email || "", t.status, t.startDate || t.moveIn || "", t.deposit || 0, t.method || "bank"];
      });
      filename = "tenants-export-" + (/* @__PURE__ */ new Date()).toISOString().split("T")[0] + ".csv";
    } else {
      headers = ["Name", "Phone", "Email", "Bank", "Sort Code", "Account No", "Notes"];
      rows = (state.landlords || []).map(function(l) {
        return [l.name, l.phone || "", l.email || "", l.bank || "", l.sortCode || "", l.accountNo || "", l.notes || ""];
      });
      filename = "landlords-export-" + (/* @__PURE__ */ new Date()).toISOString().split("T")[0] + ".csv";
    }
    var csv = [headers.join(",")].concat(rows.map(function(r) {
      return r.map(function(v) {
        var s = String(v || "");
        return s.includes(",") || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    })).join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported " + rows.length + " " + entity, "success");
  }
  function _dmTemplate() {
    var entity = _dmEntity;
    var headers, sample, filename;
    if (entity === "properties") {
      headers = ["Property Name", "Address", "Postcode", "Area", "Total Rooms", "Landlord Rent (\xA3)", "Monthly Income (\xA3)", "Occupied Rooms", "Landlord Name", "Landlord Contact", "Status", "Maps URL", "Notes", "Operating Company"];
      sample = ["99 Example Street", "99 Example Street London SW2 1AA", "SW2 1AA", "Brixton", 5, 2500, 3200, 4, "John Smith", "447911000001", "Managed", "https://maps.google.com", "Good condition", "Reservations Direct Limited"];
      filename = "properties-import-template.csv";
    } else if (entity === "tenants") {
      headers = ["Full Name", "Property Name", "Room Number", "Weekly Rent (\xA3)", "Frequency", "Payment Day", "WhatsApp", "Email", "Status", "Move-In Date", "Deposit", "Payment Method"];
      sample = ["Maria Santos", "99 Example Street", 1, 200, "weekly", "Monday", "447911000002", "maria@email.com", "active", "2026-01-01", 400, "bank"];
      filename = "tenants-import-template.csv";
    } else {
      headers = ["Name", "Phone", "Email", "Bank", "Sort Code", "Account No", "Notes"];
      sample = ["John Smith", "447911000001", "john@email.com", "Barclays", "20-00-00", "12345678", "Pays on 1st of month"];
      filename = "landlords-import-template.csv";
    }
    var csv = [headers.join(","), sample.map(function(v) {
      var s = String(v || "");
      return s.includes(",") || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")].join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Template downloaded", "success");
  }
  function exportData() {
    var snapshot = {};
    var SAVE_KEYS_LOCAL = [
      "tenants",
      "properties",
      "payments",
      "rentSchedule",
      "expenses",
      "maintenance",
      "landlords",
      "landlordPayments",
      "roomMedia",
      "lateFeeConfig",
      "users",
      "voidDates",
      "vault",
      "propDocs"
    ];
    SAVE_KEYS_LOCAL.forEach(function(k) {
      snapshot[k] = state[k];
    });
    snapshot._exportedAt = (/* @__PURE__ */ new Date()).toISOString();
    snapshot._version = "1.0";
    var blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    a.href = url;
    a.download = "propmanager-backup-" + date + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function importData(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data.tenants || !data.properties) {
          alert("\u26A0\uFE0F Invalid backup file. Please use a PropManager export file.");
          return;
        }
        var backupDate = data._exportedAt ? new Date(data._exportedAt).toLocaleDateString("en-GB") : "unknown date";
        if (!confirm("\u26A0\uFE0F This will replace ALL current data with the backup from " + backupDate + ".\n\nAre you sure?")) return;
        var SAVE_KEYS_LOCAL = [
          "tenants",
          "properties",
          "payments",
          "rentSchedule",
          "expenses",
          "maintenance",
          "landlords",
          "landlordPayments",
          "roomMedia",
          "lateFeeConfig",
          "users",
          "voidDates",
          "vault",
          "propDocs"
        ];
        SAVE_KEYS_LOCAL.forEach(function(k) {
          if (data[k] !== void 0) {
            state[k] = data[k];
            localStorage.setItem("pm_" + k, JSON.stringify(data[k]));
          }
        });
        rebuildAllSchedules();
        render();
        alert("\u2705 Data imported successfully! " + data.tenants.length + " tenants and " + data.properties.length + " properties loaded.");
      } catch (err) {
        alert("\u26A0\uFE0F Failed to read backup file: " + err.message);
      }
      input.value = "";
    };
    reader.readAsText(file);
  }
  var _agentRunning = false;
  function buildPortfolioSnapshot() {
    var active = state.tenants.filter(function(t) {
      return t.status === "active";
    });
    var notice = state.tenants.filter(function(t) {
      return t.status === "notice_given";
    });
    var arrears = active.filter(function(t) {
      return (t.arrears || 0) > 0;
    });
    var arrTotal = arrears.reduce(function(s, t) {
      return s + (t.arrears || 0);
    }, 0);
    var vacant = [];
    state.properties.forEach(function(p) {
      (p.roomList || []).forEach(function(r) {
        if (r.status === "vacant") {
          var days = state.voidDates && state.voidDates[p.id + "_" + r.n] ? Math.floor((/* @__PURE__ */ new Date() - new Date(state.voidDates[p.id + "_" + r.n])) / 864e5) : 0;
          vacant.push({ property: p.name, room: r.n, price: r.price || 0, days });
        }
      });
    });
    var dailyVoidLoss = vacant.reduce(function(s, v) {
      return s + Math.round(v.price / 7);
    }, 0);
    var now = /* @__PURE__ */ new Date();
    var llOverdue = (state.landlordPayments || []).filter(function(p) {
      return p.status !== "paid" && p.dueDateTs && p.dueDateTs < now.getTime();
    });
    var llOverdueTotal = llOverdue.reduce(function(s, p) {
      return s + p.amount;
    }, 0);
    var openMaint = state.maintenance.filter(function(m) {
      return m.status === "open";
    });
    var urgentMaint = openMaint.filter(function(m) {
      return m.priority === "urgent";
    });
    var totalRooms = state.properties.reduce(function(s, p) {
      return s + p.rooms;
    }, 0);
    var occRooms = state.properties.reduce(function(s, p) {
      return s + p.occupied;
    }, 0);
    var expectedMo = Math.round(active.reduce(function(s, t) {
      return s + (t.freq === "monthly" ? t.rent : t.rent * 52 / 12);
    }, 0));
    var landlordMo = state.properties.reduce(function(s, p) {
      return s + p.landlord;
    }, 0);
    return {
      date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      portfolio: {
        properties: state.properties.length,
        totalRooms,
        occupiedRooms: occRooms,
        occupancyPct: Math.round(occRooms / totalRooms * 100),
        vacantRooms: totalRooms - occRooms,
        expectedIncome: expectedMo,
        landlordCosts: landlordMo,
        netProfit: expectedMo - landlordMo
      },
      tenants: {
        active: active.length,
        onNotice: notice.length,
        inArrears: arrears.length,
        totalArrears: arrTotal,
        arrearsDetails: arrears.slice(0, 5).map(function(t) {
          return { name: t.name, property: t.property, arrears: t.arrears };
        })
      },
      voids: {
        count: vacant.length,
        dailyLoss: dailyVoidLoss,
        monthlyLoss: dailyVoidLoss * 30,
        longestVoids: vacant.sort(function(a, b) {
          return b.days - a.days;
        }).slice(0, 5)
      },
      landlordPayments: {
        overdueCount: llOverdue.length,
        overdueTotal: llOverdueTotal,
        overdueItems: llOverdue.slice(0, 5).map(function(p) {
          return { landlord: p.landlordName, property: p.property, amount: p.amount, month: p.monthLabel };
        })
      },
      maintenance: {
        openCount: openMaint.length,
        urgentCount: urgentMaint.length,
        urgentItems: urgentMaint.slice(0, 5).map(function(m) {
          return { property: m.property, issue: m.issue, room: m.room };
        })
      }
    };
  }
  async function runAIAgent(forceRefresh) {
    var cached = localStorage.getItem("pm_agent_cache");
    var cacheTs = +(localStorage.getItem("pm_agent_cache_ts") || 0);
    var age = (Date.now() - cacheTs) / 36e5;
    if (!forceRefresh && cached && age < 6) {
      document.getElementById("ai-agent-output").innerHTML = cached;
      return;
    }
    _agentRunning = true;
    document.getElementById("ai-agent-output").innerHTML = renderAgentLoading();
    var snap = buildPortfolioSnapshot();
    var prompt2 = "You are a property management analyst for a South London HMO portfolio. Analyse the following data and return ONLY valid JSON.\n\nPortfolio Snapshot (" + snap.date + "):\n" + JSON.stringify(snap, null, 2) + '\n\nReturn ONLY this JSON structure:\n{"score":<0-100>,"scoreLabel":"<Excellent|Good|Needs Attention|Critical>","scoreColor":"<green|amber|red>","summary":"<2 sentences>","insights":[{"icon":"<emoji>","title":"<short>","body":"<1-2 sentences>","priority":"<high|medium|low>"}],"tasks":[{"icon":"<emoji>","task":"<specific action>","urgency":"<urgent|today|this-week>"}]}\n\nRules: exactly 4 insights (arrears, voids, landlord payments, maintenance). 3-5 tasks. Be specific with names and numbers.';
    try {
      var res = await fetchAiMessages({ model: "claude-sonnet-4-20250514", max_tokens: 1e3, messages: [{ role: "user", content: prompt2 }] });
      var data = await res.json();
      if (!res.ok) {
        var msg = data && data.error && (typeof data.error === "string" ? data.error : data.error.message) || "AI unavailable";
        throw new Error(msg);
      }
      if (data.error) {
        throw new Error(typeof data.error === "string" ? data.error : data.error.message || "AI error");
      }
      var text = (data.content || []).map(function(b) {
        return b.text || "";
      }).join("");
      text = text.replace(/```json|```/g, "").trim();
      var parsed = JSON.parse(text);
      var html = renderAgentResult(parsed, snap.date);
      localStorage.setItem("pm_agent_cache", html);
      localStorage.setItem("pm_agent_cache_ts", Date.now());
      document.getElementById("ai-agent-output").innerHTML = html;
    } catch (err) {
      try {
        runLocalPortfolioAnalysis();
        showToast && showToast("Cloud AI unavailable \u2014 showing local summary", "warn");
      } catch (_e) {
        document.getElementById("ai-agent-output").innerHTML = renderAgentError(err.message);
      }
    }
    _agentRunning = false;
  }
  function renderAgentKeyPrompt() {
    return '<div style="padding:18px"><div style="font-size:13px;color:var(--muted);margin-bottom:12px;line-height:1.6">AI insights use the <strong>PropManager server</strong>. Ensure <code style="font-size:11px">ANTHROPIC_API_KEY</code> and <code style="font-size:11px">SUPABASE_SERVICE_ROLE_KEY</code> are set on the host, then run the analysis again.</div><button onclick="runAIAgent(true)" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">\u21BB Retry</button></div>';
  }
  function renderAgentLoading() {
    return '<div style="padding:28px;text-align:center"><div style="font-size:32px;margin-bottom:12px">\u{1F916}</div><div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Analysing your portfolio\u2026</div><div style="font-size:12px;color:var(--muted);margin-bottom:18px">Reviewing tenants \xB7 payments \xB7 voids \xB7 maintenance</div><div style="display:flex;justify-content:center;gap:6px"><div style="width:8px;height:8px;border-radius:50%;background:var(--accent);opacity:.3;animation:kf-pulse 1.2s .0s infinite ease-in-out"></div><div style="width:8px;height:8px;border-radius:50%;background:var(--accent);opacity:.3;animation:kf-pulse 1.2s .2s infinite ease-in-out"></div><div style="width:8px;height:8px;border-radius:50%;background:var(--accent);opacity:.3;animation:kf-pulse 1.2s .4s infinite ease-in-out"></div></div></div>';
  }
  function renderAgentError(msg) {
    return '<div style="padding:16px"><div style="font-size:13px;color:var(--red);font-weight:700;margin-bottom:6px">\u26A0\uFE0F Could not connect to AI</div><div style="font-size:12px;color:var(--muted);margin-bottom:12px;font-family:monospace;background:var(--bg);padding:8px;border-radius:7px">' + msg + '</div><div style="display:flex;gap:8px"><button onclick="runAIAgent(true)" style="padding:7px 14px;border-radius:8px;border:1px solid var(--accent);color:var(--accent);background:var(--accent-light);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">\u21BB Retry</button></div></div>';
  }
  function renderAgentResult(d, dateStr) {
    var scoreColors = { green: "var(--green)", amber: "var(--amber)", red: "var(--red)" };
    var scoreBgs = { green: "var(--green-light)", amber: "var(--amber-light)", red: "var(--red-light)" };
    var urgencyColors = { urgent: "var(--red)", today: "var(--amber)", "this-week": "var(--blue)" };
    var priorityBorders = { high: "#FECDD3", medium: "#FDE68A", low: "var(--border)" };
    var col = scoreColors[d.scoreColor] || "var(--blue)";
    var bg = scoreBgs[d.scoreColor] || "var(--blue-light)";
    var html = "";
    html += '<div style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);background:' + bg + '">';
    html += '<div style="text-align:center;min-width:72px">';
    html += '<div style="font-size:32px;font-weight:800;color:' + col + ';font-family:monospace;line-height:1">' + d.score + "</div>";
    html += '<div style="font-size:10px;font-weight:800;color:' + col + ';text-transform:uppercase;letter-spacing:.04em;margin-top:2px">' + d.scoreLabel + "</div>";
    html += "</div>";
    html += '<div><div style="font-size:10px;color:var(--muted);margin-bottom:4px">' + dateStr + "</div>";
    html += '<div style="font-size:12px;color:var(--text);line-height:1.6">' + d.summary + "</div></div>";
    html += "</div>";
    html += '<div style="padding:14px 16px;border-bottom:1px solid var(--border)">';
    html += '<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">\u{1F4CA} Insights</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    (d.insights || []).forEach(function(ins) {
      html += '<div style="background:var(--surface);border:1px solid ' + (priorityBorders[ins.priority] || "var(--border)") + ';border-radius:10px;padding:10px 12px">';
      html += '<div style="font-size:12px;font-weight:700;margin-bottom:3px">' + ins.icon + " " + ins.title + "</div>";
      html += '<div style="font-size:12px;color:var(--muted);line-height:1.5">' + ins.body + "</div>";
      html += "</div>";
    });
    html += "</div></div>";
    html += '<div style="padding:14px 16px">';
    html += '<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">\u2705 Action Items</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    (d.tasks || []).forEach(function(task) {
      var uc = urgencyColors[task.urgency] || "var(--muted)";
      html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:var(--surface);border-radius:9px;border:1px solid var(--border)">';
      html += '<span style="font-size:16px;flex-shrink:0">' + task.icon + "</span>";
      html += '<div style="flex:1;font-size:12px;color:var(--text);line-height:1.5">' + task.task + "</div>";
      html += '<span style="font-size:10px;font-weight:700;color:' + uc + ';flex-shrink:0;text-transform:uppercase;white-space:nowrap">' + task.urgency.replace("-", " ") + "</span>";
      html += "</div>";
    });
    html += "</div>";
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">';
    html += '<div style="font-size:10px;color:var(--dim)">Auto-refreshes every 6h \xB7 Powered by Claude AI</div>';
    html += '<div style="display:flex;gap:6px">';
    html += `<button onclick="localStorage.removeItem('pm_agent_cache');localStorage.removeItem('pm_agent_cache_ts');runAIAgent(true)" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;color:var(--muted);cursor:pointer;font-family:inherit">\u21BB New analysis</button>`;
    html += '<button onclick="runAIAgent(true)" style="padding:5px 12px;border-radius:7px;border:none;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">\u21BB Refresh</button>';
    html += "</div></div></div>";
    return html;
  }
  function analyzeLocalDeal() {
    var d = state.dealInputs && state.dealInputs._scratch || {};
    var isWhole = (d.lettingType || "hmo") === "whole";
    if (!d.wkrent && !d._grossIncome) return null;
    if (!isWhole && !d.rooms && !d.wkrent) return null;
    var isOwned = d.dealType === "owned";
    var grossIncome = d._grossIncome || 0;
    var totalCosts = d._totalCosts || 0;
    var net2 = grossIncome - totalCosts;
    var rooms = Math.max(1, d.rooms || 1);
    var margin = grossIncome > 0 ? Math.round(net2 / grossIncome * 100) : 0;
    var annualNet = net2 * 12;
    var cashIn = isOwned ? Math.max(1, (d.price || 0) * (d.dep || 25) / 100 + (d.reno || 0)) : 0;
    var grossYield = isOwned && (d.price || 0) > 0 ? +(grossIncome * 12 / d.price * 100).toFixed(1) : 0;
    var netYield = isOwned && (d.price || 0) > 0 ? +(annualNet / d.price * 100).toFixed(1) : 0;
    var roi = isOwned && cashIn > 100 && annualNet > 0 ? +(annualNet / cashIn * 100).toFixed(1) : 0;
    var payback = isOwned && cashIn > 100 && net2 > 0 ? +(cashIn / net2 / 12).toFixed(1) : 0;
    var beRooms = !isOwned && grossIncome > 0 ? Math.ceil(totalCosts / (grossIncome / rooms)) : 0;
    var beRatio = rooms > 0 ? beRooms / rooms : 1;
    var runCosts = (d.bills || 0) + (d.maint || 0) + (d.insur || 0) + (d.mgmt || 0) + (d.voidCost || 0) + (d.other || 0);
    var score = 50, strengths = [], risks = [], suggestions = [];
    if (!isOwned) {
      if (margin >= 25) {
        score += 20;
        strengths.push("Strong " + margin + "% profit margin \u2014 well above the 20% R2R benchmark");
      } else if (margin >= 20) {
        score += 12;
        strengths.push("Good " + margin + "% margin \u2014 meets the R2R 20% target");
      } else if (margin >= 12) {
        score += 2;
        suggestions.push("Margin of " + margin + "% is workable but tight \u2014 negotiate LL rent down or raise room rates to reach 20%+");
      } else if (margin >= 0) {
        score -= 12;
        risks.push("Margin of " + margin + "% is dangerously thin \u2014 any void will push this into a loss");
      } else {
        score -= 30;
        risks.push("Negative margin of " + margin + "% \u2014 costs already exceed income at current occupancy");
      }
      if (beRooms > 0) {
        if (beRatio <= 0.55) {
          score += 15;
          strengths.push("Low break-even at " + beRooms + "/" + rooms + " rooms \u2014 good downside protection if rooms go void");
        } else if (beRatio <= 0.7) {
          score += 8;
          strengths.push("Manageable break-even at " + beRooms + "/" + rooms + " rooms");
        } else if (beRatio <= 0.85) {
          score -= 5;
          risks.push("High break-even at " + beRooms + "/" + rooms + " rooms \u2014 limited void buffer");
        } else {
          score -= 18;
          risks.push("Very high break-even at " + beRooms + "/" + rooms + " rooms \u2014 one empty room pushes into the red");
        }
      }
      if (!(d.voidCost > 0)) suggestions.push("Add a void allowance of at least " + fmt(Math.round(grossIncome * 0.08)) + "/mo (8%) \u2014 empty periods will happen");
      else if (d.voidCost > 0 && d.voidCost < grossIncome * 0.05) suggestions.push("Void allowance of " + fmt(d.voidCost) + "/mo may be low \u2014 consider " + fmt(Math.round(grossIncome * 0.08)) + "/mo (8%)");
      if (!(d.maint > 0)) suggestions.push("No maintenance reserve \u2014 budget at least " + fmt(rooms * 50) + "/mo (\xA350/room) for repairs and upkeep");
      if (!isWhole && (d.wkrent || 0) > 0) {
        if (d.wkrent < 120) risks.push("Weekly rate of \xA3" + d.wkrent + "/room is below South London HMO market (typically \xA3130\u2013180/wk) \u2014 verify comparables");
        else if (d.wkrent >= 130 && d.wkrent <= 180) {
          score += 5;
          strengths.push("Room rate of \xA3" + d.wkrent + "/wk is within typical South London HMO range");
        } else if (d.wkrent > 220) risks.push("Weekly rate of \xA3" + d.wkrent + "/room is high \u2014 confirm rooms will let at this price before committing");
      }
      var llRent = d.llrent || 0;
      if (llRent > 0 && grossIncome > 0) {
        var llPct = Math.round(llRent / grossIncome * 100);
        if (llPct > 85) {
          score -= 10;
          risks.push("LL rent is " + llPct + "% of gross income \u2014 leaves almost no margin for costs or voids");
        } else if (llPct <= 70) {
          score += 5;
          strengths.push("LL rent at " + llPct + "% of gross income leaves good headroom for running costs");
        }
      }
    } else {
      if (grossYield >= 10) {
        score += 20;
        strengths.push("Excellent gross yield of " + grossYield + "% \u2014 well above the 8% BTL benchmark");
      } else if (grossYield >= 8) {
        score += 12;
        strengths.push("Good gross yield of " + grossYield + "%");
      } else if (grossYield >= 6) {
        score += 2;
        suggestions.push("Yield of " + grossYield + "% is modest \u2014 South London HMO conversions can achieve 8%+");
      } else if (grossYield >= 4) {
        score -= 8;
        risks.push("Low yield of " + grossYield + "% \u2014 property may struggle to cash-flow after all costs");
      } else if (grossYield > 0) {
        score -= 20;
        risks.push("Very low yield of " + grossYield + "% \u2014 returns do not justify the capital at risk");
      }
      if (roi >= 12) {
        score += 18;
        strengths.push("Strong cash ROI of " + roi + "% \u2014 good return on invested capital");
      } else if (roi >= 8) {
        score += 10;
        strengths.push("Good cash ROI of " + roi + "%");
      } else if (roi >= 5) {
        score += 2;
      } else if (roi > 0) {
        score -= 8;
        risks.push("Cash ROI of " + roi + "% is below typical BTL expectations of 8\u201312%");
      }
      if ((d.dep || 25) >= 25) {
        score += 5;
        strengths.push("25%+ deposit unlocks better mortgage rates and reduces LTV risk");
      } else if ((d.dep || 25) < 20) {
        risks.push("Deposit below 20% \u2014 restricted mortgage options and higher interest costs likely");
      }
      if ((d.mrate || 4.5) > 5.5) {
        score -= 5;
        risks.push("Mortgage rate of " + d.mrate + "% is high \u2014 stress-test cashflow at 7% in case of remortgage");
      } else if ((d.mrate || 4.5) <= 4) {
        score += 5;
        strengths.push("Mortgage rate of " + d.mrate + "% is favourable \u2014 lock in as long as possible");
      }
      if ((d.reno || 0) > 0) {
        var renoRatio = d.reno / (d.price || 1);
        if (renoRatio > 0.15) risks.push("Renovation of " + fmt(d.reno) + " is " + (renoRatio * 100).toFixed(0) + "% of purchase price \u2014 get independent contractor quotes before committing");
        else {
          score += 3;
          strengths.push("Renovation budget of " + fmt(d.reno) + " is reasonable relative to purchase price");
        }
      }
      if (payback > 0 && payback < 8) {
        score += 8;
        strengths.push("Payback period of " + payback + " years \u2014 solid return of invested cash");
      } else if (payback >= 12) {
        risks.push("Long payback period of " + payback + " years \u2014 capital tied up for a long time");
      }
      if (!(d.voidCost > 0)) suggestions.push("Add void allowance of at least " + fmt(Math.round(grossIncome * 0.06)) + "/mo \u2014 empty periods reduce yield significantly");
      if (!(d.maint > 0)) suggestions.push("Include maintenance reserve of \xA350\u201375/room/month for an HMO property");
    }
    if (net2 < 0) {
      score = Math.max(5, score - 30);
      risks.push("Deal produces a loss of " + fmt(Math.abs(net2)) + "/mo at " + d.occ + "% occupancy \u2014 only viable at 100% occupancy");
    } else if (net2 > 0 && net2 < 200) {
      score = Math.max(10, score - 8);
      suggestions.push("Net of " + fmt(net2) + "/mo is very thin \u2014 a single void or repair bill will flip this to a loss");
    } else if (net2 >= 1e3) {
      score += 5;
    }
    score = Math.max(5, Math.min(98, score));
    var verdict = score >= 65 ? "GO" : score >= 40 ? "CAUTION" : "NO-GO";
    var headline = verdict === "GO" ? isOwned ? "Strong deal \u2014 " + grossYield + "% yield with " + roi + "% cash ROI on " + fmt(cashIn) + " invested" : "Good deal \u2014 " + margin + "% margin, break-even at " + beRooms + " of " + rooms + " rooms" : verdict === "CAUTION" ? isOwned ? "Proceed carefully \u2014 returns are moderate, stress-test all costs" : "Marginal deal \u2014 thin margin leaves little room for error" : isOwned ? "Reconsider \u2014 capital could work harder elsewhere" : "Not recommended at current terms \u2014 costs are too high relative to income";
    return { score, verdict, headline, strengths: strengths.slice(0, 3), risks: risks.slice(0, 3), suggestions: suggestions.slice(0, 3) };
  }
  function renderLocalDealOutput(r) {
    if (!r) return '<div style="padding:12px 0;font-size:12px;color:rgba(255,255,255,.5)">Enter deal figures above first</div>';
    var vCol = r.verdict === "GO" ? "#00D897" : r.verdict === "CAUTION" ? "#F5A623" : "#FF4D6A";
    function li(arr, icon, c) {
      return (arr || []).map(function(s) {
        return '<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:rgba(255,255,255,.78);margin-bottom:5px;line-height:1.5"><span style="color:' + c + ';flex-shrink:0;margin-top:1px">' + icon + "</span>" + s + "</div>";
      }).join("");
    }
    return '<div style="padding:12px 0"><div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="width:54px;height:54px;border-radius:50%;border:2.5px solid ' + vCol + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;flex-direction:column"><div style="font-size:16px;font-weight:800;color:' + vCol + '">' + r.score + '</div></div><div><div style="font-size:15px;font-weight:800;color:' + vCol + ';margin-bottom:3px">' + r.verdict + '</div><div style="font-size:12px;color:rgba(255,255,255,.72);line-height:1.4">' + r.headline + "</div></div></div>" + (r.strengths.length ? '<div style="margin-bottom:8px">' + li(r.strengths, "&#x2713;", "#00D897") + "</div>" : "") + (r.risks.length ? '<div style="margin-bottom:8px">' + li(r.risks, "!", "#FF4D6A") + "</div>" : "") + (r.suggestions.length ? "<div>" + li(r.suggestions, "&#x2192;", "#F5A623") + "</div>" : "") + '<div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,.25)">Local analysis \u2014 no API required</div></div>';
  }
  function runLocalDealAnalysis() {
    runDealAI();
  }
  function runLocalPortfolioAnalysis() {
    var el = document.getElementById("ai-agent-output");
    if (!el) return;
    var props = state.properties || [];
    var tenants = (state.tenants || []).filter(function(t) {
      return t.status !== "inactive";
    });
    var maint = state.maintenance || [];
    var totalRooms = props.reduce(function(s, p) {
      return s + p.rooms;
    }, 0);
    var occupiedRooms = props.reduce(function(s, p) {
      return s + p.occupied;
    }, 0);
    var vacantRooms = totalRooms - occupiedRooms;
    var occupancyPct = totalRooms ? Math.round(occupiedRooms / totalRooms * 100) : 0;
    var totalIncome = props.reduce(function(s, p) {
      return s + p.rent;
    }, 0);
    var totalLLCost = props.reduce(function(s, p) {
      return s + p.landlord;
    }, 0);
    var totalNet = totalIncome - totalLLCost;
    var portfolioMargin = totalIncome > 0 ? Math.round(totalNet / totalIncome * 100) : 0;
    var avgRentPerRoom = occupiedRooms > 0 ? Math.round(totalIncome / occupiedRooms) : 0;
    var voidLoss = vacantRooms * avgRentPerRoom;
    var lossProps = props.filter(function(p) {
      return p.rent < p.landlord && p.rent > 0;
    });
    var profitProps = props.filter(function(p) {
      return p.rent >= p.landlord && p.rent > 0;
    });
    var noIncomeProps = props.filter(function(p) {
      return p.rent === 0;
    });
    var urgentMaint = maint.filter(function(m) {
      return m.priority === "urgent" && m.status !== "resolved";
    });
    var openMaint = maint.filter(function(m) {
      return m.status !== "resolved";
    });
    var arrearsTenants = tenants.filter(function(t) {
      return t.arrears > 0;
    });
    var totalArrears = arrearsTenants.reduce(function(s, t) {
      return s + (t.arrears || 0);
    }, 0);
    var noticeTenants = tenants.filter(function(t) {
      return t.status === "notice";
    });
    var topLosses = lossProps.slice().sort(function(a, b) {
      return a.rent - a.landlord - (b.rent - b.landlord);
    }).slice(0, 3);
    var score = 50;
    if (occupancyPct >= 90) {
      score += 18;
    } else if (occupancyPct >= 85) {
      score += 10;
    } else if (occupancyPct >= 75) {
      score += 2;
    } else if (occupancyPct < 65) {
      score -= 15;
    }
    if (portfolioMargin >= 25) {
      score += 18;
    } else if (portfolioMargin >= 20) {
      score += 10;
    } else if (portfolioMargin >= 15) {
      score += 4;
    } else if (portfolioMargin < 10) {
      score -= 12;
    }
    if (urgentMaint.length === 0) {
      score += 5;
    } else {
      score -= Math.min(20, urgentMaint.length * 6);
    }
    if (totalArrears === 0) {
      score += 5;
    } else if (totalArrears < 1e3) {
      score -= 2;
    } else if (totalArrears < 5e3) {
      score -= 8;
    } else {
      score -= 15;
    }
    if (lossProps.length === 0) {
      score += 8;
    } else {
      score -= Math.min(18, lossProps.length * 3);
    }
    score = Math.max(10, Math.min(98, score));
    var scoreColor = score >= 70 ? "var(--green)" : score >= 45 ? "var(--amber)" : "var(--red)";
    var scoreLabel = score >= 70 ? "Healthy" : score >= 45 ? "Needs Attention" : "Critical";
    var alerts = [], insights = [], actions = [];
    if (urgentMaint.length > 0) {
      alerts.push({ c: "var(--red)", icon: "&#x1F6A8;", t: urgentMaint.length + " urgent maintenance job" + (urgentMaint.length > 1 ? "s" : "") + ": " + urgentMaint.map(function(m) {
        return m.property.split(" ")[0];
      }).join(", ") });
    }
    if (totalArrears > 0) {
      alerts.push({ c: "var(--amber)", icon: "&#x26A0;&#xFE0F;", t: arrearsTenants.length + " tenant" + (arrearsTenants.length > 1 ? "s" : "") + " in arrears \u2014 total " + fmt(totalArrears) });
    }
    if (noticeTenants.length > 0) {
      alerts.push({ c: "var(--blue)", icon: "&#x1F4CB;", t: noticeTenants.length + " tenant" + (noticeTenants.length > 1 ? "s" : "") + " have given notice \u2014 plan re-letting now to avoid voids" });
    }
    if (occupancyPct >= 90) {
      insights.push({ c: "var(--green)", t: "Occupancy at " + occupancyPct + "% is excellent \u2014 above the 90% target. Portfolio running near full capacity." });
    } else if (occupancyPct >= 85) {
      insights.push({ c: "var(--green)", t: "Occupancy at " + occupancyPct + "% is on target. " + vacantRooms + " vacant room" + (vacantRooms > 1 ? "s" : "") + " represent " + fmt(voidLoss) + "/mo in lost income." });
    } else {
      insights.push({ c: "var(--amber)", t: "Occupancy at " + occupancyPct + "% is below target. " + vacantRooms + " vacant rooms are costing " + fmt(voidLoss) + "/mo \u2014 prioritise re-letting." });
    }
    if (portfolioMargin >= 20) {
      insights.push({ c: "var(--green)", t: "Portfolio gross margin of " + portfolioMargin + "% is strong \u2014 keeping " + portfolioMargin + "p in every \xA31 of rent." });
    } else if (portfolioMargin >= 12) {
      insights.push({ c: "var(--amber)", t: "Gross margin of " + portfolioMargin + "% is acceptable. Review LL rent on renewal properties to push above 20%." });
    } else {
      insights.push({ c: "var(--red)", t: "Gross margin of " + portfolioMargin + "% is very thin. Urgent review of LL rents and room rates needed." });
    }
    if (totalNet > 0) {
      insights.push({ c: "var(--green)", t: "Portfolio net (before expenses) is " + fmt(totalNet) + "/mo (" + fmt(totalNet * 12) + "/yr) across " + props.length + " properties." });
    }
    if (lossProps.length > 0) {
      var totalLoss = Math.abs(lossProps.reduce(function(s, p) {
        return s + (p.rent - p.landlord);
      }, 0));
      var msg = lossProps.length + " propert" + (lossProps.length > 1 ? "ies are" : "y is") + " loss-making \u2014 combined " + fmt(totalLoss) + "/mo loss.";
      if (topLosses.length > 0) msg += " Worst: " + topLosses[0].name + " (" + fmt(Math.abs(topLosses[0].rent - topLosses[0].landlord)) + "/mo).";
      insights.push({ c: "var(--red)", t: msg });
      actions.push("Review LL rent terms on " + topLosses.map(function(p) {
        return p.name.split(" ")[0];
      }).join(", ") + " \u2014 these are running at a loss");
    }
    if (openMaint.length > 0) {
      actions.push(openMaint.length + " open maintenance job" + (openMaint.length > 1 ? "s" : "") + " \u2014 resolve to protect tenant satisfaction and property condition");
    }
    if (vacantRooms > 0) {
      actions.push("Fill " + vacantRooms + " vacant room" + (vacantRooms > 1 ? "s" : "") + " \u2014 each empty room costs ~" + fmt(avgRentPerRoom) + "/mo in lost rent");
    }
    if (totalArrears > 2e3) {
      actions.push("Chase " + fmt(totalArrears) + " in arrears \u2014 contact " + arrearsTenants.map(function(t) {
        return t.name.split(" ")[0];
      }).join(", ") + "  directly");
    }
    var html = '<div style="padding:14px 18px">';
    html += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)"><div style="width:56px;height:56px;border-radius:50%;border:3px solid ' + scoreColor + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><div style="text-align:center"><div style="font-size:18px;font-weight:800;color:' + scoreColor + '">' + score + '</div></div></div><div style="flex:1"><div style="font-size:14px;font-weight:700;color:' + scoreColor + ';margin-bottom:2px">Portfolio Health: ' + scoreLabel + '</div><div style="font-size:11px;color:var(--muted)">' + props.length + " properties \xB7 " + occupancyPct + "% occupied \xB7 " + fmt(totalNet) + "/mo net \xB7 " + openMaint.length + ' open jobs</div><div style="margin-top:6px;height:6px;border-radius:3px;background:var(--border);overflow:hidden"><div style="height:100%;width:' + score + "%;background:" + scoreColor + ';border-radius:3px;transition:width .5s"></div></div></div><button onclick="runLocalPortfolioAnalysis()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:11px;color:var(--muted);cursor:pointer;font-family:inherit;flex-shrink:0">&#x21BB; Refresh</button></div>';
    if (alerts.length > 0) {
      html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">';
      alerts.forEach(function(a) {
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-left:3px solid ' + a.c + ';border-radius:8px"><span style="color:' + a.c + ';flex-shrink:0">' + a.icon + '</span><span style="font-size:12px;color:var(--text)">' + a.t + "</span></div>";
      });
      html += "</div>";
    }
    if (insights.length > 0) {
      html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Analysis</div>';
      html += '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px">';
      insights.forEach(function(ins) {
        html += '<div style="display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--text);line-height:1.5"><span style="color:' + ins.c + ';flex-shrink:0;margin-top:2px">&#x25CF;</span>' + ins.t + "</div>";
      });
      html += "</div>";
    }
    if (actions.length > 0) {
      html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Recommended Actions</div>';
      html += '<div style="display:flex;flex-direction:column;gap:5px">';
      actions.forEach(function(act, i) {
        html += '<div style="display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--text);line-height:1.5"><span style="background:var(--accent);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;flex-shrink:0;margin-top:2px">' + (i + 1) + "</span>" + act + "</div>";
      });
      html += "</div>";
    }
    html += '<div style="margin-top:10px;font-size:10px;color:var(--dim)">Local analysis \u2014 runs offline, no API required</div>';
    html += "</div>";
    el.innerHTML = html;
  }
  function renderDashboardAgent() {
    var el = document.getElementById("ai-agent-output");
    if (!el) return;
    var cached = localStorage.getItem("pm_agent_cache");
    var cacheTs = +(localStorage.getItem("pm_agent_cache_ts") || 0);
    if (cached && (Date.now() - cacheTs) / 36e5 < 6) {
      el.innerHTML = cached;
      return;
    }
    runAIAgent(false);
  }
  var _gsIdx = -1;
  function gsSearch(q) {
    var box = document.getElementById("gs-results");
    q = (q || "").trim().toLowerCase();
    if (q.length < 2) {
      box.style.display = "none";
      return;
    }
    var results = [];
    state.tenants.forEach(function(t) {
      if (t.status === "inactive") return;
      var score = 0;
      if (t.name.toLowerCase().includes(q)) score = 3;
      else if ((t.property || "").toLowerCase().includes(q)) score = 2;
      else if (String(t.whatsapp || "").includes(q)) score = 2;
      else if (String(t.room || "").includes(q) && t.name.toLowerCase().includes(q.split(" ")[0])) score = 1;
      if (score) results.push({
        type: "tenant",
        score: score + 10,
        icon: "\u{1F464}",
        bg: "#EFF6FF",
        label: t.name,
        sub: t.status === "inactive" ? (t.previousTenancies && t.previousTenancies.length ? "Last: " + t.previousTenancies[t.previousTenancies.length - 1].property : t.property || "Former tenant") + " \xB7 Moved out" : (t.property || "") + (t.room ? " \xB7 Room " + t.room : "") + (t.arrears > 0 ? " \xB7 \u26A0\uFE0F \xA3" + t.arrears + " arrears" : ""),
        action: function() {
          openTenantDetail(t.id);
        }
      });
    });
    state.properties.forEach(function(p) {
      if (!p.name.toLowerCase().includes(q) && !(p.address || "").toLowerCase().includes(q) && !(p.area || "").toLowerCase().includes(q)) return;
      results.push({
        type: "property",
        score: 8,
        icon: "\u{1F3E0}",
        bg: "#F0FDF4",
        label: p.name,
        sub: (p.address || p.area || "") + (p.rooms ? " \xB7 " + p.rooms + " rooms" : ""),
        action: function() {
          openPropDetail(p.id);
        }
      });
    });
    state.maintenance.forEach(function(m) {
      if (m.status === "resolved") return;
      if (!(m.issue || "").toLowerCase().includes(q) && !(m.property || "").toLowerCase().includes(q) && !(m.tenant || "").toLowerCase().includes(q)) return;
      results.push({
        type: "maintenance",
        score: 6,
        icon: "\u{1F527}",
        bg: "#FFF7ED",
        label: m.issue,
        sub: m.property + (m.room ? " Rm " + m.room : "") + (m.priority === "urgent" ? " \xB7 \u{1F6A8} URGENT" : ""),
        action: function() {
          state.page = "maintenance";
          render();
        }
      });
    });
    state.payments.forEach(function(p) {
      if (p.status === "paid") return;
      if (!(p.tenant || p.tenantName || "").toLowerCase().includes(q)) return;
      results.push({
        type: "payment",
        score: 5,
        icon: "\u{1F4B7}",
        bg: "#FEF2F2",
        label: p.tenant || p.tenantName || "",
        sub: "Outstanding \xA3" + (p.amount || 0) + " \xB7 Due " + new Date(p._dueDateRaw || Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        action: function() {
          state.page = "rent";
          render();
        }
      });
    });
    results.sort(function(a, b) {
      return b.score - a.score || (a.label || "").localeCompare(b.label || "");
    });
    results = results.slice(0, 10);
    if (!results.length) {
      box.innerHTML = '<div style="padding:16px;text-align:center;font-size:13px;color:var(--muted)">No results for "' + q.replace(/</g, "&lt;") + '"</div>';
      box.style.display = "block";
      _gsIdx = -1;
      return;
    }
    var sections = { tenant: "Tenants", property: "Properties", maintenance: "Maintenance", payment: "Payments" };
    var grouped = {};
    results.forEach(function(r) {
      if (!grouped[r.type]) grouped[r.type] = [];
      grouped[r.type].push(r);
    });
    var html = "";
    Object.keys(sections).forEach(function(type) {
      if (!grouped[type]) return;
      html += '<div class="gs-section">' + sections[type] + "</div>";
      grouped[type].forEach(function(r, i) {
        var idx = results.indexOf(r);
        html += '<div class="gs-item" data-gsidx="' + idx + '" onmousedown="gsGo(' + idx + ')"><div class="gs-icon" style="background:' + r.bg + '">' + r.icon + '</div><div><div class="gs-label">' + r.label + '</div><div class="gs-sub">' + r.sub + "</div></div></div>";
      });
    });
    box.innerHTML = html;
    box.style.display = "block";
    _gsIdx = -1;
    window._gsResults = results;
  }
  function gsKey(e) {
    var box = document.getElementById("gs-results");
    if (box.style.display === "none") return;
    var items = box.querySelectorAll(".gs-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      _gsIdx = Math.min(_gsIdx + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      _gsIdx = Math.max(_gsIdx - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (_gsIdx >= 0) gsGo(_gsIdx);
      else if (items.length === 1) gsGo(0);
      return;
    } else if (e.key === "Escape") {
      box.style.display = "none";
      return;
    } else return;
    items.forEach(function(el, i) {
      el.classList.toggle("gs-active", i === _gsIdx);
    });
  }
  function gsGo(idx) {
    var r = window._gsResults && window._gsResults[idx];
    if (!r) return;
    document.getElementById("gs-input").value = "";
    document.getElementById("gs-results").style.display = "none";
    r.action();
  }
  function renderReports() {
    var tab = state.filters.reportTab || "pl";
    var selCo = state.filters.reportCompany || "";
    var selYear = state.filters.reportYear || (/* @__PURE__ */ new Date()).getFullYear();
    var props = selCo ? state.properties.filter(function(p) {
      return p.companyId === selCo;
    }) : state.properties;
    var propNames = props.map(function(p) {
      return p.name;
    });
    var tenants = state.tenants.filter(function(t) {
      return t.status !== "inactive" && propNames.indexOf(t.property) >= 0;
    });
    var payments = state.payments.filter(function(p) {
      return propNames.indexOf(p.property || p.propertyName || "") >= 0 || propNames.indexOf(p.propertyName || "") >= 0;
    });
    var expenses = state.expenses.filter(function(e) {
      return !selCo || propNames.indexOf(e.property || "") >= 0;
    });
    var coOpts = '<option value="">All Companies</option>' + (state.companies || []).map(function(co) {
      return '<option value="' + co.id + '" ' + (selCo === co.id ? "selected" : "") + ">" + co.name + "</option>";
    }).join("");
    var yearOpts = [2024, 2025, 2026, 2027].map(function(y) {
      return '<option value="' + y + '" ' + (selYear == y ? "selected" : "") + ">" + y + "</option>";
    }).join("");
    var tabs = [{ v: "pl", l: "\u{1F4CA} P&L" }, { v: "arrears", l: "\u26A0\uFE0F Arrears" }, { v: "cashflow", l: "\u{1F4B0} Cash Flow" }, { v: "forecast", l: "\u{1F52E} Forecast" }];
    var tabBar = '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;overflow-x:auto">' + tabs.map(function(t) {
      var active = tab === t.v;
      return `<button onclick="state.filters.reportTab='` + t.v + `';render()" style="padding:11px 18px;border:none;border-bottom:3px solid ` + (active ? "var(--accent)" : "transparent") + ";margin-bottom:-2px;background:transparent;font-size:13px;font-weight:" + (active ? 700 : 500) + ";color:" + (active ? "var(--accent-dark)" : "var(--muted)") + ';cursor:pointer;font-family:inherit;white-space:nowrap">' + t.l + "</button>";
    }).join("") + "</div>";
    var controls = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;align-items:center"><select class="inp" style="max-width:200px" onchange="state.filters.reportCompany=this.value;render()">' + coOpts + '</select><select class="inp" style="max-width:100px" onchange="state.filters.reportYear=+this.value;render()">' + yearOpts + `</select><button onclick="exportReportCSV('` + tab + `')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B07; Export CSV</button></div>`;
    var content = "";
    if (tab === "pl") content = renderReportPL(props, tenants, payments, expenses, selYear);
    else if (tab === "arrears") content = renderReportArrears(tenants);
    else if (tab === "cashflow") content = renderReportCashFlow(payments, expenses, selYear);
    else if (tab === "forecast") content = renderReportForecast(props, tenants, expenses);
    return '<div class="page-header"><div><div class="page-title">&#x1F4C8; Reports</div><div class="page-sub">Financial analysis across your portfolio</div></div></div>' + controls + tabBar + content;
  }
  function renderReportPL(props, tenants, payments, expenses, year) {
    var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var months = MONTH_NAMES.map(function(m, i) {
      var from = new Date(year, i, 1);
      var to = new Date(year, i + 1, 0);
      var income = payments.filter(function(p) {
        if (p.status !== "paid") return false;
        var raw = p._paidDateRaw || p._dueDateRaw;
        if (!raw) return false;
        var d = new Date(raw);
        return d >= from && d <= to;
      }).reduce(function(s, p) {
        return s + p.amount;
      }, 0);
      var landlord = props.reduce(function(s, p) {
        return s + (p.landlord || 0);
      }, 0);
      var opex = expenses.filter(function(e) {
        if (!e.startDate) return false;
        var d = new Date(e.startDate);
        return d >= from && d <= to;
      }).reduce(function(s, e) {
        return s + e.amount;
      }, 0);
      var net2 = income - landlord - opex;
      return { label: m, income: Math.round(income), landlord: Math.round(landlord), opex: Math.round(opex), net: Math.round(net2) };
    });
    var ytdIncome = months.filter(function(_, i) {
      return i <= (/* @__PURE__ */ new Date()).getMonth();
    }).reduce(function(s, m) {
      return s + m.income;
    }, 0);
    var ytdLandlord = months.filter(function(_, i) {
      return i <= (/* @__PURE__ */ new Date()).getMonth();
    }).reduce(function(s, m) {
      return s + m.landlord;
    }, 0);
    var ytdOpex = months.filter(function(_, i) {
      return i <= (/* @__PURE__ */ new Date()).getMonth();
    }).reduce(function(s, m) {
      return s + m.opex;
    }, 0);
    var ytdNet = ytdIncome - ytdLandlord - ytdOpex;
    var maxVal = Math.max.apply(null, months.map(function(m) {
      return Math.max(m.income, m.landlord);
    })) || 1;
    var kpis = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px">';
    [
      [fmt(ytdIncome), "YTD INCOME", "var(--green)", "var(--green-light)", "#A7F3D0"],
      [fmt(ytdLandlord), "YTD LL COSTS", "var(--red)", "var(--red-light)", "#FECDD3"],
      [fmt(ytdOpex), "YTD EXPENSES", "var(--amber)", "var(--amber-light)", "#FDE68A"],
      [fmt(ytdNet), "YTD NET PROFIT", ytdNet >= 0 ? "var(--green)" : "var(--red)", ytdNet >= 0 ? "var(--green-light)" : "var(--red-light)", ytdNet >= 0 ? "#A7F3D0" : "#FECDD3"]
    ].forEach(function(kpi2) {
      kpis += '<div style="background:' + kpi2[3] + ";border:1px solid " + kpi2[4] + ';border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:' + kpi2[2] + ';font-family:monospace">' + kpi2[0] + '</div><div style="font-size:9px;font-weight:800;color:' + kpi2[2] + ';text-transform:uppercase;margin-top:3px">' + kpi2[1] + "</div></div>";
    });
    kpis += "</div>";
    var chart = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px"><div style="font-size:13px;font-weight:700;margin-bottom:14px">Monthly Income vs Costs &mdash; ' + year + '</div><div style="display:flex;align-items:flex-end;gap:4px;height:180px;padding-bottom:24px;position:relative;overflow:hidden">';
    months.forEach(function(m) {
      var h = Math.round(m.income / maxVal * 100);
      var hLL = Math.round(m.landlord / maxVal * 100);
      var isPast = MONTH_NAMES.indexOf(m.label) <= (/* @__PURE__ */ new Date()).getMonth() && year == (/* @__PURE__ */ new Date()).getFullYear();
      chart += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative"><div style="position:absolute;bottom:24px;left:0;right:0;display:flex;gap:1px;align-items:flex-end;height:130px"><div title="Income: ' + fmt(m.income) + '" style="flex:1;background:' + (isPast ? "var(--accent)" : "var(--accent-light)") + ";border-radius:4px 4px 0 0;height:" + h + '%"></div><div title="LL Cost: ' + fmt(m.landlord) + '" style="flex:1;background:' + (isPast ? "var(--red)" : "#FECDD3") + ";border-radius:4px 4px 0 0;height:" + hLL + '%"></div></div><div style="position:absolute;bottom:0;font-size:9px;font-weight:700;color:var(--muted)">' + m.label + "</div></div>";
    });
    chart += '</div><div style="display:flex;gap:14px;margin-top:6px;font-size:11px;color:var(--muted)"><span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--accent);margin-right:4px"></span>Income</span><span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--red);margin-right:4px"></span>LL Costs</span></div></div>';
    var table = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg)"><th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Month</th><th style="padding:10px 12px;text-align:right;color:var(--green);font-weight:700">Income</th><th style="padding:10px 12px;text-align:right;color:var(--red);font-weight:700">LL Costs</th><th style="padding:10px 12px;text-align:right;color:var(--amber);font-weight:700">Expenses</th><th style="padding:10px 12px;text-align:right;font-weight:700">Net Profit</th></tr></thead><tbody>';
    var totI = 0, totL = 0, totO = 0, totN = 0;
    months.forEach(function(m, i) {
      var isFuture = i > (/* @__PURE__ */ new Date()).getMonth() && year == (/* @__PURE__ */ new Date()).getFullYear();
      var netCol = m.net >= 0 ? "var(--green)" : "var(--red)";
      table += '<tr style="border-top:1px solid var(--border);' + (isFuture ? "opacity:.45" : "") + (i % 2 ? ";background:var(--bg)" : "") + '"><td style="padding:8px 12px;font-weight:600">' + m.label + " " + year + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--green)">' + fmt(m.income) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--red)">' + fmt(m.landlord) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--amber)">' + fmt(m.opex) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;font-weight:700;color:' + netCol + '">' + fmt(m.net) + "</td></tr>";
      totI += m.income;
      totL += m.landlord;
      totO += m.opex;
      totN += m.net;
    });
    var totNetCol = totN >= 0 ? "var(--green)" : "var(--red)";
    table += '<tr style="border-top:2px solid var(--border);background:var(--bg);font-weight:700"><td style="padding:10px 12px">TOTAL ' + year + '</td><td style="padding:10px 12px;text-align:right;font-family:monospace;color:var(--green)">' + fmt(totI) + '</td><td style="padding:10px 12px;text-align:right;font-family:monospace;color:var(--red)">' + fmt(totL) + '</td><td style="padding:10px 12px;text-align:right;font-family:monospace;color:var(--amber)">' + fmt(totO) + '</td><td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:800;font-size:14px;color:' + totNetCol + '">' + fmt(totN) + "</td></tr></tbody></table></div>";
    window._reportData = { tab: "pl", year, months };
    return kpis + chart + table;
  }
  function renderReportArrears(tenants) {
    var withArrears = tenants.filter(function(t) {
      return (t.arrears || 0) > 0;
    }).sort(function(a, b) {
      return b.arrears - a.arrears;
    });
    var totalArrears = withArrears.reduce(function(s, t) {
      return s + t.arrears;
    }, 0);
    var today = /* @__PURE__ */ new Date();
    var buckets = [
      { label: "0-7 days", min: 0, max: 7, col: "var(--amber)", bg: "var(--amber-light)" },
      { label: "8-30 days", min: 8, max: 30, col: "#EA580C", bg: "#FFF7ED" },
      { label: "31-60 days", min: 31, max: 60, col: "var(--red)", bg: "var(--red-light)" },
      { label: "60+ days", min: 61, max: 9999, col: "#7F1D1D", bg: "#FEE2E2" }
    ];
    var tenantWithAge = withArrears.map(function(t) {
      var lastPay = state.payments.filter(function(p) {
        return (p.tenantName === t.name || p.tenant === t.name) && p.status === "paid" && p._paidDateRaw;
      }).sort(function(a, b) {
        return b._paidDateRaw - a._paidDateRaw;
      })[0];
      var age = lastPay ? Math.floor((today - new Date(lastPay._paidDateRaw)) / 864e5) : 90;
      return Object.assign({}, t, { _age: age });
    });
    var kpis = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px">';
    kpis += '<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--red);font-family:monospace">' + fmt(totalArrears) + '</div><div style="font-size:9px;font-weight:800;color:var(--red);text-transform:uppercase;margin-top:3px">Total Arrears</div></div>';
    kpis += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--amber);font-family:monospace">' + withArrears.length + '</div><div style="font-size:9px;font-weight:800;color:var(--amber);text-transform:uppercase;margin-top:3px">Tenants</div></div>';
    buckets.forEach(function(b) {
      var bTenants = tenantWithAge.filter(function(t) {
        return t._age >= b.min && t._age <= b.max;
      });
      var bTotal = bTenants.reduce(function(s, t) {
        return s + t.arrears;
      }, 0);
      kpis += '<div style="background:' + b.bg + ";border:1px solid " + b.bg.replace("light", "").replace("var(", "") + ';border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:' + b.col + ';font-family:monospace">' + fmt(bTotal) + '</div><div style="font-size:9px;font-weight:800;color:' + b.col + ';text-transform:uppercase;margin-top:3px">' + b.label + "</div></div>";
    });
    kpis += "</div>";
    if (!withArrears.length) return kpis + '<div style="text-align:center;padding:40px;color:var(--green);font-size:14px;font-weight:600">&#x2705; No arrears \u2014 all tenants up to date!</div>';
    var table = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg)"><th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Tenant</th><th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Property</th><th style="padding:10px 12px;text-align:right;color:var(--muted);font-weight:700">Arrears</th><th style="padding:10px 12px;text-align:center;color:var(--muted);font-weight:700">Age</th><th style="padding:10px 12px;text-align:center;color:var(--muted);font-weight:700">Action</th></tr></thead><tbody>';
    tenantWithAge.forEach(function(t, i) {
      var bkt = buckets.find(function(b) {
        return t._age >= b.min && t._age <= b.max;
      }) || buckets[3];
      var waMsg = encodeURIComponent("Hi " + t.name.split(" ")[0] + ", your account has arrears of \xA3" + t.arrears + ". Please contact us to arrange payment. Thank you \u2014 Reservations Direct.");
      table += '<tr style="border-top:1px solid var(--border)' + (i % 2 ? ";background:var(--bg)" : "") + '"><td style="padding:9px 12px"><div style="font-weight:700">' + t.name + '</div><div style="font-size:11px;color:var(--muted)">Rm ' + t.room + '</div></td><td style="padding:9px 12px;color:var(--muted)">' + t.property + '</td><td style="padding:9px 12px;text-align:right;font-family:monospace;font-weight:800;color:var(--red)">' + fmt(t.arrears) + '</td><td style="padding:9px 12px;text-align:center"><span style="font-size:11px;font-weight:700;color:' + bkt.col + ";background:" + bkt.bg + ';padding:2px 8px;border-radius:6px">' + t._age + 'd</span></td><td style="padding:9px 12px;text-align:center">' + (t.whatsapp ? '<a href="https://wa.me/' + t.whatsapp + "?text=" + waMsg + '" target="_blank" style="padding:5px 10px;border-radius:7px;background:#25D366;color:#fff;font-size:11px;font-weight:700;text-decoration:none">&#x1F4AC; Chase</a>' : '<span style="font-size:11px;color:var(--dim)">No WA</span>') + "</td></tr>";
    });
    table += "</tbody></table></div>";
    window._reportData = { tab: "arrears", tenants: tenantWithAge };
    return kpis + table;
  }
  function renderReportCashFlow(payments, expenses, year) {
    var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var months = MONTH_NAMES.map(function(m, i) {
      var from = new Date(year, i, 1);
      var to = new Date(year, i + 1, 0);
      var inc = payments.filter(function(p) {
        if (p.status !== "paid") return false;
        var raw = p._paidDateRaw || p._dueDateRaw;
        if (!raw) return false;
        var d = new Date(raw);
        return d >= from && d <= to;
      }).reduce(function(s, p) {
        return s + p.amount;
      }, 0);
      var out = expenses.filter(function(e) {
        if (!e.startDate) return false;
        var d = new Date(e.startDate);
        return d >= from && d <= to;
      }).reduce(function(s, e) {
        return s + e.amount;
      }, 0);
      return { label: m, in: Math.round(inc), out: Math.round(out), net: Math.round(inc - out) };
    });
    var runningTotal = 0;
    var table = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px;margin-bottom:16px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg)"><th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Month</th><th style="padding:10px 12px;text-align:right;color:var(--green);font-weight:700">Cash In</th><th style="padding:10px 12px;text-align:right;color:var(--red);font-weight:700">Cash Out</th><th style="padding:10px 12px;text-align:right;font-weight:700">Net</th><th style="padding:10px 12px;text-align:right;color:var(--blue);font-weight:700">Running</th></tr></thead><tbody>';
    months.forEach(function(m, i) {
      runningTotal += m.net;
      var isFuture = i > (/* @__PURE__ */ new Date()).getMonth() && year == (/* @__PURE__ */ new Date()).getFullYear();
      table += '<tr style="border-top:1px solid var(--border)' + (i % 2 ? ";background:var(--bg)" : "") + (isFuture ? ";opacity:.45" : "") + '"><td style="padding:8px 12px;font-weight:600">' + m.label + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--green)">' + fmt(m.in) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--red)">' + fmt(m.out) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;font-weight:700;color:' + (m.net >= 0 ? "var(--green)" : "var(--red)") + '">' + fmt(m.net) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--blue)">' + fmt(runningTotal) + "</td></tr>";
    });
    table += "</tbody></table></div>";
    window._reportData = { tab: "cashflow", year, months };
    return table;
  }
  function renderReportForecast(props, tenants, expenses) {
    var monthlyIncome = Math.round(tenants.filter(function(t) {
      return t.status !== "inactive";
    }).reduce(function(s, t) {
      return s + (t.freq === "monthly" ? t.rent : (t.rent || 0) * 52 / 12);
    }, 0));
    var monthlyLL = props.reduce(function(s, p) {
      return s + (p.landlord || 0);
    }, 0);
    var monthlyExpenses = Math.round(expenses.filter(function(e) {
      return e.recurring;
    }).reduce(function(s, e) {
      return s + (e.amount || 0);
    }, 0));
    var monthlyNet = monthlyIncome - monthlyLL - monthlyExpenses;
    var vacantRooms = props.reduce(function(s, p) {
      return s + (p.rooms - p.occupied);
    }, 0);
    var avgRent = tenants.length ? Math.round(tenants.reduce(function(s, t) {
      return s + t.rent;
    }, 0) / tenants.length) : 0;
    var vacantPotential = Math.round(vacantRooms * avgRent * 52 / 12);
    var kpis = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px"><div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--green);font-family:monospace">' + fmt(monthlyIncome) + '</div><div style="font-size:9px;font-weight:800;color:var(--green);text-transform:uppercase;margin-top:3px" title="Monthly rent set per-property in the property editor. May differ from the Tenant Rent Roll, which is calculated from individual tenant amounts.">Monthly Income \u2139</div></div><div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--red);font-family:monospace">' + fmt(monthlyLL) + '</div><div style="font-size:9px;font-weight:800;color:var(--red);text-transform:uppercase;margin-top:3px">LL Costs / mo</div></div>' + (monthlyExpenses > 0 ? '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--amber);font-family:monospace">' + fmt(monthlyExpenses) + '</div><div style="font-size:9px;font-weight:800;color:var(--amber);text-transform:uppercase;margin-top:3px">Expenses / mo</div></div>' : "") + '<div style="background:' + (monthlyNet >= 0 ? "var(--green-light)" : "var(--red-light)") + ";border:1px solid " + (monthlyNet >= 0 ? "#A7F3D0" : "#FECDD3") + ';border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:' + (monthlyNet >= 0 ? "var(--green)" : "var(--red)") + ';font-family:monospace">' + fmt(monthlyNet) + '</div><div style="font-size:9px;font-weight:800;color:' + (monthlyNet >= 0 ? "var(--green)" : "var(--red)") + ';text-transform:uppercase;margin-top:3px">Net / Month</div></div><div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--blue);font-family:monospace">' + fmt(vacantPotential) + '</div><div style="font-size:9px;font-weight:800;color:var(--blue);text-transform:uppercase;margin-top:3px">Void Potential</div></div></div>';
    var today = /* @__PURE__ */ new Date();
    var table = '<div style="font-size:13px;font-weight:700;margin-bottom:10px">12-Month Forward Projection (at current run-rate)</div><div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg)"><th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Month</th><th style="padding:10px 12px;text-align:right;color:var(--green);font-weight:700">Income</th><th style="padding:10px 12px;text-align:right;color:var(--red);font-weight:700">LL Costs</th><th style="padding:10px 12px;text-align:right;color:var(--amber);font-weight:700">Expenses</th><th style="padding:10px 12px;text-align:right;font-weight:700">Net</th><th style="padding:10px 12px;text-align:right;color:var(--blue);font-weight:700">Cumulative</th></tr></thead><tbody>';
    var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var cum = 0;
    for (var i = 0; i < 12; i++) {
      var d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      cum += monthlyNet;
      table += '<tr style="border-top:1px solid var(--border)' + (i % 2 ? ";background:var(--bg)" : "") + '"><td style="padding:8px 12px;font-weight:600">' + MONTH_NAMES[d.getMonth()] + " " + d.getFullYear() + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--green)">' + fmt(monthlyIncome) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--red)">' + fmt(monthlyLL) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--amber)">' + fmt(monthlyExpenses) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;font-weight:700;color:' + (monthlyNet >= 0 ? "var(--green)" : "var(--red)") + '">' + fmt(monthlyNet) + '</td><td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--blue)">' + fmt(cum) + "</td></tr>";
    }
    table += "</tbody></table></div>";
    if (vacantRooms > 0) {
      table += '<div style="margin-top:14px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:14px 16px;font-size:13px"><span style="font-weight:700;color:var(--blue)">&#x1F4A1; Occupancy Opportunity:</span> ' + vacantRooms + " vacant room" + (vacantRooms > 1 ? "s" : "") + " at avg &pound;" + avgRent + "/wk = <strong>+" + fmt(vacantPotential) + "/mo</strong> additional income if filled.</div>";
    }
    window._reportData = { tab: "forecast", monthlyIncome, monthlyLL, monthlyNet };
    return kpis + table;
  }
  function exportReportCSV(tab) {
    var d = window._reportData;
    if (!d) return;
    var rows = [], filename = "propmanager-report-" + tab + "-" + (/* @__PURE__ */ new Date()).toISOString().split("T")[0] + ".csv";
    if (tab === "pl" && d.months) {
      rows.push(["Month", "Income", "LL Costs", "Expenses", "Net Profit"]);
      d.months.forEach(function(m) {
        rows.push([m.label + " " + d.year, m.income, m.landlord, m.opex, m.net]);
      });
      var tot = d.months.reduce(function(s, m) {
        return { income: s.income + m.income, landlord: s.landlord + m.landlord, opex: s.opex + m.opex, net: s.net + m.net };
      }, { income: 0, landlord: 0, opex: 0, net: 0 });
      rows.push(["TOTAL", tot.income, tot.landlord, tot.opex, tot.net]);
    } else if (tab === "arrears" && d.tenants) {
      rows.push(["Tenant", "Property", "Room", "Arrears", "Age (days)", "WhatsApp"]);
      d.tenants.forEach(function(t) {
        rows.push([t.name, t.property, t.room, t.arrears, t._age, t.whatsapp || ""]);
      });
    } else if (tab === "cashflow" && d.months) {
      rows.push(["Month", "Cash In", "Cash Out", "Net", "Running Total"]);
      var run = 0;
      d.months.forEach(function(m) {
        run += m.net;
        rows.push([m.label + " " + d.year, m.in, m.out, m.net, run]);
      });
    } else if (tab === "forecast") {
      rows.push(["Metric", "Value"]);
      rows.push(["Monthly Income", d.monthlyIncome], ["Monthly LL Costs", d.monthlyLL], ["Monthly Net", d.monthlyNet]);
    }
    var csv = rows.map(function(r) {
      return r.map(function(v) {
        return '"' + (v || "").toString().replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("CSV exported \u2713", "success");
  }
  var buildManagerReportHtml = function(reportType, stats, subjectLine, textBody) {
    var s = stats || {};
    var firstName = "there";
    if (typeof state !== "undefined" && state.currentUser && state.currentUser.name) {
      firstName = String(state.currentUser.name).trim().split(/\s+/)[0] || "there";
    }
    var occPct = typeof s.occPct === "number" ? s.occPct : 0;
    var income = s.income != null ? s.income : 0;
    var costs = s.costs != null ? s.costs : 0;
    var net2 = s.net != null ? s.net : income - costs;
    var propsLen = s.propsLen != null ? s.propsLen : 0;
    var maint = s.maintOpen != null ? s.maintOpen : 0;
    var nowLabel = s.nowLabel || (/* @__PURE__ */ new Date()).toLocaleString("en-GB");
    var title = reportType === "monthly" ? "Your monthly P&amp;L summary" : reportType === "test" ? "Connection test" : "Your weekly portfolio summary";
    var monthPhrase = reportType === "monthly" ? (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : reportType === "weekly" ? "Week of " + (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    var grossStr = "\xA3" + Number(income).toLocaleString("en-GB");
    var costsStr = "\xA3" + Number(costs).toLocaleString("en-GB");
    var netStr = "\xA3" + Number(net2).toLocaleString("en-GB");
    var styles = [
      ".em{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#F8F9FB}",
      ".em-header{background:linear-gradient(135deg,#0F172A 0%,#1a1a3e 100%);padding:28px 36px}",
      ".em-logo-name{font-size:18px;font-weight:800;color:#fff;letter-spacing:-.3px}",
      ".em-logo-name span{color:#00B894}",
      ".em-body{background:#fff;padding:36px}",
      ".em-greeting{font-size:22px;font-weight:700;color:#0F172A;margin:0 0 10px;line-height:1.3}",
      ".em-p{font-size:15px;color:#475569;line-height:1.7;margin:0 0 16px}",
      ".em-p strong{color:#0F172A}",
      ".em-btn{display:inline-block;background:#00B894;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:10px;margin:8px 0 20px}",
      ".em-divider{border:none;border-top:1px solid #E8ECF0;margin:24px 0}",
      ".em-small{font-size:12px;color:#94A3B8;line-height:1.6;margin:0}",
      ".em-footer{background:#F8F9FB;padding:22px 36px;border-top:1px solid #E8ECF0}",
      ".em-footer-links a{font-size:12px;color:#64748B;text-decoration:none;margin-right:18px}",
      ".em-footer-copy{font-size:11px;color:#94A3B8;margin:0}",
      ".em-kpi{display:flex;gap:0;background:#F8F9FB;border:1px solid #E8ECF0;border-radius:12px;overflow:hidden;margin:20px 0}",
      ".em-kpi-cell{flex:1;padding:16px;text-align:center;border-right:1px solid #E8ECF0}",
      ".em-kpi-cell:last-child{border-right:none}",
      ".em-kpi-val{font-size:22px;font-weight:800;color:#0F172A;font-family:Courier New,monospace}",
      ".em-kpi-lbl{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}",
      ".em-table{width:100%;border-collapse:collapse;margin:16px 0}",
      ".em-table th{background:#0F172A;color:#fff;font-size:11px;font-weight:700;padding:10px 14px;text-align:left;text-transform:uppercase;letter-spacing:.06em}",
      ".em-table td{font-size:13px;color:#475569;padding:10px 14px;border-bottom:1px solid #E8ECF0}",
      ".em-table tr:last-child td{border-bottom:none}",
      ".em-table td strong{color:#0F172A}",
      ".em-table .highlight td{background:#E8F8F5}",
      ".em-table .highlight td strong{color:#00B894}",
      ".em-pre{font-size:13px;color:#475569;white-space:pre-wrap;line-height:1.6;margin:0}"
    ].join("");
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + String(subjectLine).replace(/</g, "") + "</title><style>" + styles + '</style></head><body style="margin:0;background:#F8F9FB"><div class="em"><div class="em-header"><div class="em-logo-name">Landlord<span>App</span>.io</div></div><div class="em-body"><p class="em-greeting">Hi ' + escapeHtml(firstName) + " \u2014 " + title + '</p><p class="em-p">' + (reportType === "test" ? "This is a test message from your dashboard. If you can read this, outbound email is configured correctly." : "Here's a snapshot of your HMO portfolio. Figures match the plain-text summary below.") + '</p><div class="em-kpi"><div class="em-kpi-cell"><div class="em-kpi-val">' + occPct + '%</div><div class="em-kpi-lbl">Occupancy</div></div><div class="em-kpi-cell"><div class="em-kpi-val">' + grossStr + '</div><div class="em-kpi-lbl">Gross income (mo)</div></div><div class="em-kpi-cell"><div class="em-kpi-val">' + netStr + '</div><div class="em-kpi-lbl">Net (est.)</div></div></div><table class="em-table"><tr><th>Metric</th><th>This period</th><th>Notes</th></tr><tr><td>Properties</td><td><strong>' + propsLen + "</strong></td><td>\u2014</td></tr><tr><td>Gross income</td><td><strong>" + grossStr + "</strong></td><td>" + monthPhrase + "</td></tr><tr><td>Landlord costs</td><td><strong>" + costsStr + '</strong></td><td>\u2014</td></tr><tr class="highlight"><td><strong>Net</strong></td><td><strong>' + netStr + "</strong></td><td>Open maintenance: " + maint + '</td></tr></table><hr class="em-divider"><p class="em-small" style="margin-bottom:12px">Plain summary (same as above)</p><pre class="em-pre">' + escapeHtml(textBody) + '</pre><hr class="em-divider"><a href="https://landlordapp.io" class="em-btn">Open dashboard</a><p class="em-small">Sent ' + escapeHtml(nowLabel) + '. Reply to this email to reach your organisation contact.</p></div><div class="em-footer"><div class="em-footer-links"><a href="https://landlordapp.io">Dashboard</a><a href="mailto:admin@landlordapp.io">Support</a></div><p class="em-footer-copy">&copy; 2026 LandlordApp.io</p></div></div></body></html>';
  };
  var escapeHtml = function(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  var buildTenantOutboundHtml = function(subjectLine, textBody, tenantMeta) {
    var m = tenantMeta || {};
    var company = m.companyName || "Your property manager";
    var phone = m.companyPhone || "";
    var emailC = m.companyEmail || "";
    var first = m.firstName || "there";
    var lines = String(textBody || "").split(/\n/);
    var paras = lines.filter(function(ln) {
      return String(ln).trim().length;
    }).map(function(ln) {
      return '<p class="em-p">' + escapeHtml(ln) + "</p>";
    }).join("");
    var styles = [
      ".em{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#F8F9FB}",
      ".em-header{background:linear-gradient(135deg,#0F172A 0%,#1a1a3e 100%);padding:24px 28px}",
      ".em-body{background:#fff;padding:32px}",
      ".em-greeting{font-size:20px;font-weight:700;color:#0F172A;margin:0 0 12px;line-height:1.35}",
      ".em-p{font-size:15px;color:#475569;line-height:1.7;margin:0 0 14px}",
      ".em-footer{background:#F8F9FB;padding:20px 28px;border-top:1px solid #E8ECF0;font-size:11px;color:#94A3B8}",
      ".em-footer a{color:#00B894;text-decoration:none}"
    ].join("");
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escapeHtml(subjectLine) + "</title><style>" + styles + '</style></head><body style="margin:0;background:#F8F9FB"><div class="em"><div class="em-header"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td><div style="font-size:20px;font-weight:800;color:#fff">' + escapeHtml(company) + '</div><div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:4px">Property management</div></td><td align="right" style="font-size:11px;color:rgba(255,255,255,.5);line-height:1.6">' + (function() {
      var h = "";
      if (phone) h += escapeHtml(phone);
      if (phone && emailC) h += "<br>";
      if (emailC) h += escapeHtml(emailC);
      return h || "&nbsp;";
    })() + '</td></tr></table></div><div class="em-body"><p class="em-greeting">Hi ' + escapeHtml(first) + "</p>" + paras + '<hr style="border:none;border-top:1px solid #E8ECF0;margin:24px 0"><p class="em-p" style="font-size:13px;color:#64748B;margin:0">Questions? Reply to this email or contact us using the details above.</p></div><div class="em-footer">Sent via <a href="https://landlordapp.io">LandlordApp.io</a> \xB7 ' + escapeHtml(company) + "</div></div></body></html>";
  };
  var buildTriggerEmailHtml = function(templateId, subjectLine, textBody, meta) {
    var id = String(templateId || "").toLowerCase();
    var m = meta || {};
    var safeSubject = escapeHtml(subjectLine || "Notification");
    var safeBody = String(textBody || "").split(/\n/).filter(function(ln) {
      return String(ln).trim().length;
    }).map(function(ln) {
      return '<p class="em-p">' + escapeHtml(ln) + "</p>";
    }).join("");
    if (id === "weekly_report" || id === "monthly_report" || id === "test") {
      return buildManagerReportHtml(id === "test" ? "test" : id === "monthly_report" ? "monthly" : "weekly", m.stats || {}, subjectLine, textBody);
    }
    var alertClass = "green";
    var alertTitle = "Update";
    if (id === "rent_reminder_3day") {
      alertClass = "green";
      alertTitle = "Rent due in 3 days";
    } else if (id === "rent_reminder_day") {
      alertClass = "amber";
      alertTitle = "Rent due today";
    } else if (id === "rent_overdue_3day") {
      alertClass = "amber";
      alertTitle = "Rent overdue by 3 days";
    } else if (id === "rent_overdue_week") {
      alertClass = "red";
      alertTitle = "Rent overdue by 7 days";
    } else if (id === "move_in_welcome") {
      alertClass = "green";
      alertTitle = "Welcome to your new home";
    } else if (id === "notice_confirm") {
      alertClass = "amber";
      alertTitle = "Notice to vacate confirmed";
    } else if (id === "compliance_expiry") {
      alertClass = "red";
      alertTitle = "Compliance expiry alert";
    }
    var company = m.companyName || "Your property manager";
    var phone = m.companyPhone || "";
    var emailC = m.companyEmail || "";
    var first = m.firstName || "there";
    var styles = [
      ".em{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#F8F9FB}",
      ".em-header{background:linear-gradient(135deg,#0F172A 0%,#1a1a3e 100%);padding:24px 28px}",
      ".em-body{background:#fff;padding:32px}",
      ".em-greeting{font-size:20px;font-weight:700;color:#0F172A;margin:0 0 12px;line-height:1.35}",
      ".em-p{font-size:15px;color:#475569;line-height:1.7;margin:0 0 14px}",
      ".em-alert{border-radius:10px;padding:14px 18px;margin:0 0 16px}",
      ".em-alert.red{background:#FEF0F3;border-left:3px solid #E8375A}",
      ".em-alert.amber{background:#FFFBEB;border-left:3px solid #F59E0B}",
      ".em-alert.green{background:#E8F8F5;border-left:3px solid #00B894}",
      ".em-alert-title{font-size:13px;font-weight:700;color:#0F172A;margin:0 0 4px}",
      ".em-alert-body{font-size:13px;color:#475569;margin:0}",
      ".em-footer{background:#F8F9FB;padding:20px 28px;border-top:1px solid #E8ECF0;font-size:11px;color:#94A3B8}",
      ".em-footer a{color:#00B894;text-decoration:none}"
    ].join("");
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + safeSubject + "</title><style>" + styles + '</style></head><body style="margin:0;background:#F8F9FB"><div class="em"><div class="em-header"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td><div style="font-size:20px;font-weight:800;color:#fff">' + escapeHtml(company) + '</div><div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:4px">Property management</div></td><td align="right" style="font-size:11px;color:rgba(255,255,255,.5);line-height:1.6">' + (function() {
      var h = "";
      if (phone) h += escapeHtml(phone);
      if (phone && emailC) h += "<br>";
      if (emailC) h += escapeHtml(emailC);
      return h || "&nbsp;";
    })() + '</td></tr></table></div><div class="em-body"><p class="em-greeting">Hi ' + escapeHtml(first) + '</p><div class="em-alert ' + alertClass + '"><p class="em-alert-title">' + escapeHtml(alertTitle) + '</p><p class="em-alert-body">' + safeSubject + "</p></div>" + safeBody + '<hr style="border:none;border-top:1px solid #E8ECF0;margin:24px 0"><p class="em-p" style="font-size:13px;color:#64748B;margin:0">Reply to this email if you have any questions.</p></div><div class="em-footer">Sent via <a href="https://landlordapp.io">LandlordApp.io</a> \xB7 ' + escapeHtml(company) + "</div></div></body></html>";
  };
  var _saveTimer = null;
  function saveState() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_doSupaSave, 1500);
    try {
      var localKeys = ["rentSchedule", "roomMedia", "vault", "voidDates", "lateFeeConfig", "propDocs", "users", "companies", "config", "roles", "maintExtras", "dealInputs"];
      localKeys.forEach(function(k) {
        if (state[k] !== void 0) {
          try {
            localStorage.setItem("pm_local_" + k, JSON.stringify(state[k]));
          } catch (e) {
            console.warn("localStorage full for key:", k, e);
          }
        }
      });
      try {
        localStorage.setItem("pm_local_page", state.page);
      } catch (e) {
      }
    } catch (e) {
    }
  }
  function showToast(msg, type) {
    var el = document.getElementById("pm-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pm-toast";
      el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;transition:opacity .3s;pointer-events:none;font-family:inherit";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === "error" ? "#FEE2E2" : "#D1FAE5";
    el.style.color = type === "error" ? "#B91C1C" : "#065F46";
    el.style.border = "1px solid " + (type === "error" ? "#FECDD3" : "#A7F3D0");
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(function() {
      el.style.opacity = "0";
    }, 2e3);
  }
  async function _supaUpsert(table, rows, opts) {
    try {
      var r = await supa.from(table).upsert(rows, opts);
      if (r.error) {
        console.warn("Save warning [" + table + "]:", r.error.message);
        return r.error;
      }
      return null;
    } catch (e) {
      console.warn("Save error [" + table + "]:", e.message);
      return { message: e.message || "Save failed" };
    }
  }
  function friendlyDbSaveError(err) {
    var msg = String(err && err.message || "");
    if (!msg) return "Could not save changes. Please try again.";
    if (/Plan limit reached:\s*max\s*\d+\s*properties/i.test(msg)) {
      return "Property limit reached for your current plan. Upgrade plan or archive an unused property.";
    }
    if (/Plan limit reached:\s*max\s*\d+\s*active tenants/i.test(msg)) {
      return "Active tenant limit reached for your current plan. Upgrade plan or set inactive tenants first.";
    }
    if (/Plan limit reached:\s*max\s*\d+\s*users/i.test(msg)) {
      return "User seat limit reached for your current plan. Upgrade plan before inviting more users.";
    }
    if (/Organisation is\s+(paused|cancelled)/i.test(msg)) {
      return "This organisation is not active, so changes are locked. Reactivate billing to continue.";
    }
    return msg.length > 180 ? "Could not save changes. Please try again." : msg;
  }
  async function _doSupaSave() {
    if (!_currentOrgId) {
      console.warn("_doSupaSave: no org_id \u2014 skipping save");
      return;
    }
    function withOrg(rows) {
      return rows.map(function(r) {
        return Object.assign({}, r, { org_id: _currentOrgId });
      });
    }
    var landlordRows = withOrg(state.landlords.map(landlordToRow));
    var propRows = withOrg(state.properties.map(function(p) {
      var r = propToRow(p);
      delete r.room_list;
      return r;
    }));
    var tenantRows = withOrg(state.tenants.map(function(t) {
      var r = tenantToRow(t);
      if (!r.portal_username) delete r.portal_username;
      if (!r.portal_password) delete r.portal_password;
      return r;
    }));
    var errors = await Promise.all([
      _supaUpsert("landlords", landlordRows, { onConflict: "id" }),
      _supaUpsert("properties", propRows, { onConflict: "id" }),
      _supaUpsert("tenants", tenantRows, { onConflict: "id" }),
      _supaUpsert("payments", withOrg(state.payments.map(paymentToRow)), { onConflict: "id" }),
      _supaUpsert("expenses", withOrg(state.expenses.map(expenseToRow)), { onConflict: "id" }),
      _supaUpsert("maintenance", withOrg(state.maintenance.map(maintenanceToRow)), { onConflict: "id" }),
      _supaUpsert("contractors", withOrg((state.contractors || []).map(contractorToRow)), { onConflict: "id" }),
      _supaUpsert(
        "landlord_payments",
        withOrg(state.landlordPayments.filter(function(lp) {
          return lp.propId && lp.monthKey;
        }).map(landlordPaymentToRow)),
        { onConflict: "property_id,month_key", ignoreDuplicates: false }
      )
    ]);
    var firstErr = (errors || []).find(function(e) {
      return !!e;
    });
    if (firstErr) {
      if (typeof showToast === "function") showToast(friendlyDbSaveError(firstErr), "error");
      return;
    }
    if (typeof showToast === "function") showToast("\u2713 Saved", "success");
  }
  async function loadState() {
    if (!_currentOrgId) {
      console.warn("loadState skipped: org not resolved yet");
      return false;
    }
    setAppBootMessage("Loading your data\u2026");
    try {
      var results = await Promise.all([
        supa.from("landlords").select("*").eq("org_id", _currentOrgId),
        supa.from("properties").select("*").eq("org_id", _currentOrgId),
        supa.from("tenants").select("*").eq("org_id", _currentOrgId),
        supa.from("payments").select("*").eq("org_id", _currentOrgId),
        supa.from("expenses").select("*").eq("org_id", _currentOrgId),
        supa.from("maintenance").select("*").eq("org_id", _currentOrgId),
        supa.from("landlord_payments").select("*").eq("org_id", _currentOrgId),
        supa.from("contractors").select("*").eq("org_id", _currentOrgId),
        supa.from("organisations").select("billing_email,owner_email,name,plan,status,trial_ends_at,stripe_customer_id,stripe_subscription_id").eq("id", _currentOrgId).maybeSingle()
      ]);
      var errors = results.filter(function(r) {
        return r.error;
      });
      if (errors.length) {
        console.warn("Supabase load errors:", errors);
      }
      if (results[8] && results[8].data) {
        state._currentOrg = Object.assign({}, state._currentOrg || {}, results[8].data);
      }
      await mergeOrgEmailSettingsIfAvailable();
      state.landlords = (results[0].data || []).map(rowToLandlord);
      state.properties = (results[1].data || []).map(rowToProp);
      state.tenants = (results[2].data || []).map(rowToTenant);
      state.payments = (results[3].data || []).map(rowToPayment);
      state.expenses = (results[4].data || []).map(rowToExpense);
      state.maintenance = (results[5].data || []).map(rowToMaintenance);
      if (!state.maintExtras) state.maintExtras = {};
      state.maintenance.forEach(function(m) {
        if (!state.maintExtras[m.id]) state.maintExtras[m.id] = { photos: [] };
        var mx = state.maintExtras[m.id];
        if (m.jobCost && !mx.cost) mx.cost = m.jobCost;
        if (m.invoiceName && !mx.invoiceName) mx.invoiceName = m.invoiceName;
        if (m.invoiceUrl && !mx.invoiceUrl) mx.invoiceUrl = m.invoiceUrl;
      });
      state.landlordPayments = (results[6].data || []).map(rowToLandlordPayment);
      state.contractors = (results[7].data || []).map(rowToContractor);
      state.tenants.forEach(function(t) {
        var tenantPays = state.payments.filter(function(p) {
          return (p.tenantId === t.id || p.tenantName === t.name) && p.status === "paid" && p.paidDate;
        });
        if (tenantPays.length) {
          tenantPays.sort(function(a, b) {
            return new Date(b.paidDate) - new Date(a.paidDate);
          });
          var d = new Date(tenantPays[0].paidDate);
          t.paid = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        }
      });
      try {
        var localKeys = ["rentSchedule", "roomMedia", "vault", "voidDates", "lateFeeConfig", "propDocs", "companies", "config", "roles", "maintExtras", "dealInputs"];
        localKeys.forEach(function(k) {
          var raw = localStorage.getItem("pm_local_" + k);
          if (raw) {
            try {
              state[k] = JSON.parse(raw);
            } catch (e) {
            }
          }
        });
        var savedPage = localStorage.getItem("pm_local_page");
        if (savedPage && savedPage !== "dashboard") state.page = savedPage;
      } catch (e) {
      }
      try {
        if (state.propDocs) {
          Object.keys(state.propDocs).forEach(function(pid) {
            (state.propDocs[pid] || []).forEach(function(doc) {
              if (doc.storagePath && !doc.dataUrl) {
                supa.storage.from("property-docs").createSignedUrl(doc.storagePath, 31536e3).then(function(r) {
                  if (r.data) {
                    doc.dataUrl = r.data.signedUrl;
                  }
                }).catch(function() {
                });
              }
            });
          });
        }
        if (state.vault) {
          Object.keys(state.vault).forEach(function(tid) {
            (state.vault[tid] || []).forEach(function(doc) {
              if (doc.storagePath && !doc.dataUrl) {
                supa.storage.from("tenant-docs").createSignedUrl(doc.storagePath, 31536e3).then(function(r) {
                  if (r.data) {
                    doc.dataUrl = r.data.signedUrl;
                  }
                }).catch(function() {
                });
              }
            });
          });
        }
      } catch (_de) {
        console.warn("Doc URL refresh error:", _de);
      }
      if (state.roomMedia && Object.keys(state.roomMedia).length > 0) {
        var newMedia = {};
        state.properties.forEach(function(p) {
          Object.keys(state.roomMedia).forEach(function(oldKey) {
            var parts = oldKey.split("_");
            if (parts.length >= 2) {
              var lastNum = parts[parts.length - 1];
              var possibleOldId = parts.slice(0, -1).join("_");
              var oidNum = parseInt(possibleOldId);
              if (!isNaN(oidNum) && oidNum >= 1e3 && oidNum <= 2e3) {
                var newKey = p.id + "_" + lastNum;
                if (state.roomMedia[oldKey] && state.roomMedia[oldKey].photos && state.roomMedia[oldKey].photos.length > 0) {
                  newMedia[newKey] = state.roomMedia[oldKey];
                }
              } else {
                newMedia[oldKey] = state.roomMedia[oldKey];
              }
            }
          });
        });
        if (Object.keys(newMedia).length > 0) state.roomMedia = newMedia;
      }
      state.landlordPayments.forEach(function(lp) {
        if ((!lp.propName || lp.propName === "") && lp.propId) {
          var p = state.properties.find(function(x) {
            return x.id === lp.propId;
          });
          if (p) lp.propName = p.name;
        }
        if ((!lp.landlordName || lp.landlordName === "") && lp.landlordId) {
          var ll = state.landlords.find(function(x) {
            return x.id === lp.landlordId;
          });
          if (ll) lp.landlordName = ll.name;
        }
      });
      console.log("Loaded from Supabase:", state.landlords.length, "landlords,", state.properties.length, "props,", state.tenants.length, "tenants");
      ["companies", "config"].forEach(function(k) {
        try {
          var raw = localStorage.getItem("pm_local_" + k);
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed) state[k] = parsed;
          }
        } catch (e2) {
        }
      });
      return true;
    } catch (e) {
      console.error("loadState error:", e);
      showToast && showToast("Database error \u2014 running in offline mode", "error");
      return false;
    }
  }
  async function backfillPaymentDueDates() {
    var toFix = state.payments.filter(function(p2) {
      return !p2.dueDate && p2.paidDate;
    });
    if (toFix.length === 0) {
      showToast("No payments need fixing \u2713", "success");
      return;
    }
    showToast("Fixing " + toFix.length + " payments...", "success");
    var fixed = 0;
    for (var i = 0; i < toFix.length; i++) {
      var p = toFix[i];
      var paidStr = p.paidDate;
      var parts = String(paidStr).replace(/[^0-9\-]/g, "").split("T")[0];
      var isoDate = null;
      var _bmonths = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      if (paidStr) {
        var _bdp = String(paidStr).split(" ");
        if (_bdp.length === 3 && _bmonths[_bdp[1]] !== void 0) {
          var _bdt = new Date(+_bdp[2], _bmonths[_bdp[1]], +_bdp[0]);
          isoDate = _bdt.getFullYear() + "-" + String(_bdt.getMonth() + 1).padStart(2, "0") + "-" + String(_bdt.getDate()).padStart(2, "0");
        } else if (paidStr.match && paidStr.match(/\d{4}-\d{2}-\d{2}/)) {
          isoDate = paidStr.split("T")[0];
        }
      }
      if (!isoDate) continue;
      p.dueDate = isoDate;
      var pp = paidStr.split("T")[0].split("-");
      p._dueDateRaw = isoDate.split("-").length === 3 ? new Date(+isoDate.split("-")[0], +isoDate.split("-")[1] - 1, +isoDate.split("-")[2]).getTime() : null;
      try {
        await supa.from("payments").update({ due_date: isoDate }).eq("id", p.id);
        fixed++;
      } catch (e) {
      }
    }
    saveState();
    render();
    showToast("Fixed " + fixed + " of " + toFix.length + " payments \u2713", "success");
  }
  async function doLogOut() {
    try {
      await supa.auth.signOut();
    } catch (e) {
      console.warn("signOut:", e);
    }
    localStorage.removeItem("pm_local_users");
    window.location.href = "propmanager-landing.html";
  }
  var EMAIL_TRIGGERS = {
    rent_reminder_3day: { id: "rent_reminder_3day", label: "Rent Due \u2014 3 Days Before", type: "tenant", active: false, template: "Hi {name},\n\nReminder: your rent of \xA3{amount} is due on {date}.\n\nThank you,\n{company}" },
    rent_reminder_day: { id: "rent_reminder_day", label: "Rent Due \u2014 Day Of", type: "tenant", active: false, template: "Hi {name},\n\nYour rent of \xA3{amount} is due today. Please arrange payment.\n\nThank you,\n{company}" },
    rent_overdue_3day: { id: "rent_overdue_3day", label: "Rent Overdue \u2014 3 Days", type: "tenant", active: false, template: "Hi {name},\n\nYour rent of \xA3{amount} due {date} is unpaid. Please contact us urgently.\n\n{company}" },
    rent_overdue_week: { id: "rent_overdue_week", label: "Rent Overdue \u2014 1 Week", type: "tenant", active: false, template: "Hi {name},\n\nYour rent of \xA3{amount} is 7 days overdue. Please contact us immediately.\n\n{company}" },
    move_in_welcome: { id: "move_in_welcome", label: "Move-in Welcome Email", type: "tenant", active: false, template: "Hi {name},\n\nWelcome to {property}! Your tenancy begins on {date}.\n\n{company}" },
    notice_confirm: { id: "notice_confirm", label: "Notice Confirmation", type: "tenant", active: false, template: "Hi {name},\n\nThis confirms your notice to vacate {property} on {date}.\n\n{company}" },
    compliance_expiry: { id: "compliance_expiry", label: "Compliance Cert Expiry", type: "manager", active: false, template: "Alert: {doc_type} for {property} expires {date} ({days} days)." },
    weekly_report: { id: "weekly_report", label: "Weekly Portfolio Report", type: "manager", active: false, schedule: "Monday 09:00" },
    monthly_report: { id: "monthly_report", label: "Monthly P&L Summary", type: "manager", active: false, schedule: "1st of month 09:00" }
  };
  function getEmailConfig() {
    var ls = {};
    try {
      ls = JSON.parse(localStorage.getItem("pm_email_config") || "{}");
    } catch (e) {
    }
    var o = state._currentOrg || {};
    var db = o.email_settings && typeof o.email_settings === "object" ? o.email_settings : {};
    return {
      triggers: Object.assign({}, ls.triggers || {}, db.triggers || {}),
      managerEmail: db.managerEmail || ls.managerEmail || ""
    };
  }
  async function persistEmailSettings(cfg) {
    if (!_currentOrgId) {
      showToast && showToast("No organisation loaded", "error");
      return;
    }
    var clean = {
      triggers: cfg.triggers || {},
      managerEmail: cfg.managerEmail || ""
    };
    var { error } = await supa.from("organisations").update({ email_settings: clean }).eq("id", _currentOrgId);
    if (error) {
      var missingCol = String(error.code || "") === "42703" || String(error.message || "").indexOf("email_settings") !== -1;
      var msg = (error.message || "Could not save email settings") + (missingCol ? " Apply db/organisations_email_settings.sql on Supabase, then retry." : "");
      showToast && showToast(msg, "error");
      return false;
    }
    if (!state._currentOrg) state._currentOrg = {};
    state._currentOrg.email_settings = clean;
    return true;
  }
  function renderEmailSettings() {
    var cfg = getEmailConfig();
    var org = state._currentOrg || {};
    var replyHint = org.billing_email || org.owner_email || "your organisation billing email in Supabase";
    var html = "<div>";
    html += '<div style="background:var(--accent-light);border:1px solid var(--accent);border-radius:12px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '<div style="font-size:12px;color:var(--accent-dark);line-height:1.45;max-width:520px"><strong>LandlordApp.io email templates</strong> \u2014 HTML layouts for welcome, verification, password reset, trial reminders, billing, and reports. Open in a new tab to review or copy into Supabase Auth / Resend.</div>';
    html += '<a href="/landlordapp_emails.html" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;border:1.5px solid var(--accent);background:var(--surface);color:var(--accent-dark);font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0">Open template gallery \u2192</a>';
    html += "</div>";
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Sending (tenant &amp; manager emails)</div>';
    html += '<p style="font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 12px">Rent reminders and reports are sent via your server using <strong>LandlordApp &lt;noreply@landlordapp.io&gt;</strong> (configure <code style="font-size:11px">RESEND_API_KEY</code> on the host). Tenant replies go to: <strong>' + String(replyHint).replace(/</g, "&lt;") + "</strong> (billing email, or owner email, or your account).</p>";
    html += '<div class="field"><label class="field-label">Manager email (weekly / monthly reports)</label><input class="inp" id="ecfg-mgr" placeholder="manager@yourcompany.com" value="' + (cfg.managerEmail || "").replace(/"/g, "&quot;") + `" onchange="saveEmailField('managerEmail',this.value)"></div>`;
    html += "</div>";
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:12px">Triggers</div>';
    Object.values(EMAIL_TRIGGERS).forEach(function(tr) {
      var on = !!(cfg.triggers && cfg.triggers[tr.id]);
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">';
      html += '<div><div style="font-size:13px;font-weight:500">' + tr.label + "</div>" + (tr.schedule ? '<div style="font-size:11px;color:var(--muted)">\u{1F4C5} ' + tr.schedule + "</div>" : "") + "</div>";
      html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" ' + (on ? "checked" : "") + ' data-trid="' + tr.id + '" onchange="toggleEmailTrigger(this.dataset.trid,this.checked)" style="width:16px;height:16px;accent-color:var(--accent)"><span style="font-size:12px;color:' + (on ? "var(--green)" : "var(--muted)") + '">' + (on ? "On" : "Off") + "</span></label></div>";
    });
    html += "</div>";
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Test & Send</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
    html += '<button onclick="sendTestEmail()" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">\u2709 Send Test Email</button>';
    html += '<button onclick="runRentReminderEmails(true)" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">\u{1F50D} Dry Run</button>';
    html += '<button onclick="runRentReminderEmails(false)" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">\u{1F4E8} Send Reminders</button>';
    html += `<button onclick="sendScheduledReport('weekly')" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">\u{1F4CA} Weekly Report</button>`;
    html += `<button onclick="sendScheduledReport('monthly')" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">\u{1F4C5} Monthly P&L</button>`;
    html += '</div><div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:9px;margin-top:10px;font-size:11px;color:var(--muted)">\u26A0 Requires <code style="font-size:11px">RESEND_API_KEY</code> and verified domain on the Node server (<code style="font-size:11px">POST /api/email/send</code>). Auth &amp; billing emails use Supabase / Stripe separately. Gmail may file messages under <strong>Updates</strong>; drag one message to <strong>Primary</strong> and choose \u201CYes\u201D so future mail lands in the inbox.</div>';
    html += "</div></div>";
    return html;
  }
  function saveEmailField(key, value) {
    var cfg = getEmailConfig();
    cfg[key] = value;
    persistEmailSettings(cfg).then(function(ok) {
      if (ok) showToast("Saved", "success");
    });
  }
  function toggleEmailTrigger(id, enabled) {
    var cfg = getEmailConfig();
    if (!cfg.triggers) cfg.triggers = {};
    cfg.triggers[id] = enabled;
    persistEmailSettings(cfg).then(function(ok) {
      if (ok) {
        showToast((enabled ? "Enabled: " : "Disabled: ") + (EMAIL_TRIGGERS[id] || { label: id }).label, enabled ? "success" : "info");
        if (typeof render === "function") render();
      } else {
        var inp = document.querySelector('input[data-trid="' + id + '"]');
        if (inp) inp.checked = !enabled;
      }
    });
  }
  function previewEmailForTenant(triggerId, tenantId) {
    var t = state.tenants.find(function(x) {
      return x.id === tenantId;
    });
    if (!t) return null;
    var tr = EMAIL_TRIGGERS[triggerId];
    if (!tr) return null;
    var company = state.companies && state.companies[0] && state.companies[0].name || "Reservations Direct Limited";
    var body = tr.template.replace(/{name}/g, t.name).replace(/{property}/g, t.property || "").replace(/{amount}/g, "\xA3" + (t.rent || 0)).replace(/{company}/g, company).replace(/{date}/g, (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
    return { to: t.email, subject: tr.label, body };
  }
  function getCompanyEmailContext() {
    var co = state.companies && state.companies[0] || {};
    var org = state._currentOrg || {};
    return {
      companyName: co.name || "Your property manager",
      companyPhone: co.phone || co.tel || "",
      companyEmail: co.email || org.billing_email || org.owner_email || state.currentUser && state.currentUser.email || ""
    };
  }
  async function sendEmail(to, subject, body, kind, extra) {
    extra = extra || {};
    if (!_currentOrgId) {
      showToast("No organisation", "error");
      return false;
    }
    var sr = await supa.auth.getSession();
    var session = sr.data.session;
    if (!session) {
      showToast("Sign in required", "error");
      return false;
    }
    kind = kind || "tenant";
    var templateId = String(extra.templateId || "").toLowerCase();
    var html = extra.html;
    if (!html) {
      if (templateId && typeof buildTriggerEmailHtml === "function") {
        var cx = getCompanyEmailContext();
        if (extra.tenant) {
          if (extra.tenant.firstName) cx.firstName = extra.tenant.firstName;
          if (extra.tenant.companyName) cx.companyName = extra.tenant.companyName;
          if (extra.tenant.companyPhone) cx.companyPhone = extra.tenant.companyPhone;
          if (extra.tenant.companyEmail) cx.companyEmail = extra.tenant.companyEmail;
        }
        html = buildTriggerEmailHtml(templateId, subject, body, {
          companyName: cx.companyName,
          companyPhone: cx.companyPhone,
          companyEmail: cx.companyEmail,
          firstName: cx.firstName,
          stats: extra.stats || {}
        });
      } else if (kind === "report") {
        html = buildManagerReportHtml(extra.reportType || "weekly", extra.stats || {}, subject, body);
      } else if (kind === "tenant") {
        var cx2 = getCompanyEmailContext();
        if (extra.tenant) {
          if (extra.tenant.firstName) cx2.firstName = extra.tenant.firstName;
          if (extra.tenant.companyName) cx2.companyName = extra.tenant.companyName;
          if (extra.tenant.companyPhone) cx2.companyPhone = extra.tenant.companyPhone;
          if (extra.tenant.companyEmail) cx2.companyEmail = extra.tenant.companyEmail;
        }
        html = buildTenantOutboundHtml(subject, body, cx2);
      }
    }
    var payload = { orgId: _currentOrgId, to, subject, text: body, kind };
    if (html) payload.html = html;
    try {
      var resp = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify(payload)
      });
      var data = await resp.json().catch(function() {
        return {};
      });
      if (resp.ok) {
        showToast("Email sent to " + to, "success");
        return true;
      }
      var msg = data && data.error || data && data.message || JSON.stringify(data).slice(0, 120);
      if (/suppression/i.test(String(msg))) {
        msg += " In Resend: Dashboard \u2192 Emails (or Email suppressions) \u2192 find " + String(to) + " \u2192 Remove from suppression list. Addresses are listed after a bounce or spam complaint.";
      }
      showToast("Email failed: " + msg, "error");
      return false;
    } catch (e) {
      showToast("Email error: " + e.message, "error");
      return false;
    }
  }
  async function sendTestEmail() {
    var cfg = getEmailConfig();
    var to = (cfg.managerEmail || "").trim() || state.currentUser && state.currentUser.email || "";
    if (!to) {
      showToast("Set Manager email in Settings (below) or sign in with an account that has an email", "error");
      return;
    }
    var props = state.properties.filter(function(p) {
      return p.status !== "archived";
    });
    var rooms = props.reduce(function(s, p) {
      return s + p.rooms;
    }, 0);
    var occ = props.reduce(function(s, p) {
      return s + p.occupied;
    }, 0);
    var income = props.reduce(function(s, p) {
      return s + p.rent;
    }, 0);
    var costs = props.reduce(function(s, p) {
      return s + p.landlord;
    }, 0);
    var body = "Test from LandlordApp\n\n" + props.length + " properties \xB7 " + state.tenants.filter(function(t) {
      return t.status === "active";
    }).length + " tenants\nSent: " + (/* @__PURE__ */ new Date()).toLocaleString("en-GB");
    var shortDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    await sendEmail(to, "LandlordApp \xB7 connection test (" + shortDate + ")", body, "report", {
      templateId: "test",
      reportType: "test",
      stats: {
        propsLen: props.length,
        income,
        costs,
        net: income - costs,
        occPct: rooms ? Math.round(occ / rooms * 100) : 0,
        maintOpen: state.maintenance.filter(function(m) {
          return m.status !== "resolved";
        }).length,
        nowLabel: (/* @__PURE__ */ new Date()).toLocaleString("en-GB")
      }
    });
  }
  async function runRentReminderEmails(dryRun) {
    var cfg = getEmailConfig();
    if (!cfg.triggers) {
      showToast("No triggers configured", "error");
      return;
    }
    var today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    var sent = 0, skipped = 0, log = [];
    state.tenants.filter(function(t) {
      return t.status === "active" && t.email;
    }).forEach(function(t) {
      (state.rentSchedule || []).filter(function(s) {
        return s.tenantId === t.id && s.status === "pending";
      }).forEach(function(s) {
        var dueDate = new Date(s.dueDateRaw);
        dueDate.setHours(0, 0, 0, 0);
        var d = Math.round((dueDate - today) / 864e5);
        var tid = null;
        if (d === 3 && cfg.triggers.rent_reminder_3day) tid = "rent_reminder_3day";
        if (d === 0 && cfg.triggers.rent_reminder_day) tid = "rent_reminder_day";
        if (d === -3 && cfg.triggers.rent_overdue_3day) tid = "rent_overdue_3day";
        if (d === -7 && cfg.triggers.rent_overdue_week) tid = "rent_overdue_week";
        if (!tid) return;
        var preview = previewEmailForTenant(tid, t.id);
        if (!preview || !preview.to) {
          skipped++;
          return;
        }
        log.push({ name: t.name, to: preview.to, subject: preview.subject });
        if (!dryRun) {
          var firstN = (t.name || "there").trim().split(/\s+/)[0] || "there";
          sendEmail(preview.to, preview.subject, preview.body, "tenant", { templateId: tid, tenant: { firstName: firstN } });
        }
        sent++;
      });
    });
    showToast((dryRun ? "Dry run: " : "Sent: ") + sent + " emails" + (skipped ? " (" + skipped + " skipped)" : ""), "success");
  }
  async function sendScheduledReport(type) {
    var cfg = getEmailConfig();
    var to = cfg.managerEmail;
    if (!to) {
      showToast("Set manager email in Settings", "error");
      return;
    }
    var props = state.properties.filter(function(p) {
      return p.status !== "archived";
    });
    var rooms = props.reduce(function(s, p) {
      return s + p.rooms;
    }, 0);
    var occ = props.reduce(function(s, p) {
      return s + p.occupied;
    }, 0);
    var income = props.reduce(function(s, p) {
      return s + p.rent;
    }, 0);
    var costs = props.reduce(function(s, p) {
      return s + p.landlord;
    }, 0);
    var now = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    var shortDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    var subject = type === "weekly" ? "LandlordApp \xB7 your portfolio summary (" + shortDate + ")" : "LandlordApp \xB7 your P&L summary (" + shortDate + ")";
    var occPct = rooms ? Math.round(occ / rooms * 100) : 0;
    var body = type === "weekly" ? "Weekly portfolio snapshot\n" + now + "\n\n" + props.length + " properties \xB7 " + occPct + "% occupancy\nIncome: \xA3" + income.toLocaleString() + "/mo \xB7 Costs: \xA3" + costs.toLocaleString() + "/mo \xB7 Net: \xA3" + (income - costs).toLocaleString() + "/mo\nOpen maintenance: " + state.maintenance.filter(function(m) {
      return m.status !== "resolved";
    }).length : "Monthly P&L\n" + now + "\n\nGross Income: \xA3" + income.toLocaleString() + "\nLandlord Costs: \xA3" + costs.toLocaleString() + "\nNet Profit: \xA3" + (income - costs).toLocaleString() + "\nMargin: " + (income ? Math.round((income - costs) / income * 100) : 0) + "%\nOccupancy: " + occPct + "%";
    await sendEmail(to, subject, body, "report", {
      templateId: type === "monthly" ? "monthly_report" : "weekly_report",
      reportType: type,
      stats: {
        propsLen: props.length,
        rooms,
        occ,
        income,
        costs,
        net: income - costs,
        occPct,
        maintOpen: state.maintenance.filter(function(m) {
          return m.status !== "resolved";
        }).length,
        nowLabel: now
      }
    });
  }
  async function startStripeCheckout(plan) {
    var opts = arguments.length > 1 && arguments[1] ? arguments[1] : {};
    if (!_currentOrgId) {
      showToast && showToast("No organisation loaded", "error");
      return false;
    }
    var sr = await supa.auth.getSession();
    var session = sr && sr.data ? sr.data.session : null;
    if (!session) {
      showToast && showToast("Sign in required", "error");
      return false;
    }
    var normalizedPlan = String(plan || "starter").toLowerCase();
    if (normalizedPlan !== "starter" && normalizedPlan !== "professional" && normalizedPlan !== "business" && normalizedPlan !== "free") {
      showToast && showToast("Unsupported plan selected", "error");
      return false;
    }
    try {
      var resp = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token
        },
        body: JSON.stringify({ orgId: _currentOrgId, plan: normalizedPlan })
      });
      var data = await resp.json().catch(function() {
        return {};
      });
      if (!resp.ok || !data.url) {
        showToast && showToast("Checkout failed: " + (data && data.error || "Unknown error"), "error");
        return false;
      }
      if (opts && opts.clearStartCheckoutParam) {
        try {
          var params = new URLSearchParams(window.location.search || "");
          params.delete("startCheckout");
          var next = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + (window.location.hash || "");
          window.history.replaceState({}, "", next);
        } catch (_urlErr) {
        }
      }
      window.location.href = data.url;
      return true;
    } catch (e) {
      showToast && showToast("Checkout error: " + e.message, "error");
      return false;
    }
  }
  async function openStripeBillingPortal() {
    if (!_currentOrgId) {
      showToast && showToast("No organisation loaded", "error");
      return;
    }
    var sr = await supa.auth.getSession();
    var session = sr && sr.data ? sr.data.session : null;
    if (!session) {
      showToast && showToast("Sign in required", "error");
      return;
    }
    try {
      var resp = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token
        },
        body: JSON.stringify({ orgId: _currentOrgId })
      });
      var data = await resp.json().catch(function() {
        return {};
      });
      if (!resp.ok || !data.url) {
        showToast && showToast("Could not open billing portal: " + (data && data.error || "Unknown error"), "error");
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      showToast && showToast("Billing portal error: " + e.message, "error");
    }
  }
  function maybeStartCheckoutFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var stripeResult = String(params.get("stripe") || "").toLowerCase();
      if (stripeResult === "success") {
        showToast && showToast("Payment confirmed. Finalising your subscription\u2026", "success");
        params.delete("stripe");
        var successNext = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + (window.location.hash || "");
        window.history.replaceState({}, "", successNext);
      } else if (stripeResult === "cancelled") {
        showToast && showToast("Checkout cancelled. Complete payment to continue.", "warn");
        params.delete("stripe");
        var cancelNext = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + (window.location.hash || "");
        window.history.replaceState({}, "", cancelNext);
      }
    } catch (_e) {
    }
  }
  function renderSettings() {
    var companies = state.companies || [];
    var cfg = state.config || {};
    var org = state._currentOrg || {};
    var hiddenV = [];
    if (window._roomEidMap === void 0) window._roomEidMap = {};
    (state.properties || []).forEach(function(p) {
      (p.roomList || []).forEach(function(r) {
        if (r._hidden) hiddenV.push({ p, r });
      });
    });
    var PLANS = {
      free: { label: "Free", price: 0, color: "#64748B", bg: "#F8FAFC", border: "#CBD5E1", props: 3, seats: 2 },
      trial: { label: "Free Trial", price: 0, color: "#F5A623", bg: "#FFFBEB", border: "#FDE68A", props: 5, seats: 3 },
      starter: { label: "Starter", price: 49, color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", props: 15, seats: 3 },
      professional: { label: "Professional", price: 89, color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0", props: 25, seats: 5 },
      business: { label: "Business", price: 149, color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", props: 60, seats: 15 }
    };
    var plan = org.plan || "free";
    var status = org.status || "active";
    var planCfg = PLANS[plan] || PLANS.free;
    var trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    var daysLeft = trialEnd ? Math.ceil((trialEnd - /* @__PURE__ */ new Date()) / 864e5) : null;
    var isTrial = status === "trial";
    var propCount = state.properties.length;
    var tenantCount = state.tenants.filter(function(t) {
      return t.status !== "inactive";
    }).length;
    var userCount = (state.users || []).filter(function(u) {
      return u.status === "active";
    }).length;
    function usagePct(used, max) {
      return max ? Math.min(100, Math.round(used / max * 100)) : 0;
    }
    function usageColor(pct2) {
      return pct2 >= 90 ? "var(--red)" : pct2 >= 70 ? "var(--amber)" : "var(--green)";
    }
    function usageBar(used, max) {
      var pct2 = usagePct(used, max);
      return '<div style="height:5px;border-radius:3px;background:var(--border);overflow:hidden;margin-top:5px"><div style="height:100%;width:' + pct2 + "%;background:" + usageColor(pct2) + ';border-radius:3px;transition:width .4s"></div></div>';
    }
    var _planLimits = { "free": 3, "trial": 5, "starter": 15, "professional": 25, "business": 60, "enterprise": 9999 };
    var _curPlan = (org.plan || cfg.plan || "free").toLowerCase();
    var _planLimit = _planLimits[_curPlan] || 5;
    var _propCount = (state.properties || []).filter(function(p) {
      return p.status !== "archived";
    }).length;
    var _limitWarn = _propCount > _planLimit ? '<div style="background:#FEF3C7;border:1.5px solid #F59E0B;border-radius:12px;padding:14px 18px;margin-bottom:0;display:flex;align-items:center;gap:12px"><span style="font-size:22px">\u26A0\uFE0F</span><div><div style="font-size:13px;font-weight:700;color:#92400E">Plan Limit Exceeded</div><div style="font-size:12px;color:#78350F">You have <strong>' + _propCount + "</strong> properties but your <strong>" + _curPlan.charAt(0).toUpperCase() + _curPlan.slice(1) + "</strong> plan allows up to <strong>" + _planLimit + "</strong>. Consider upgrading or archiving unused properties.</div></div></div>" : "";
    var html = '<div class="page-header"><div><div class="page-title">&#x2699;&#xFE0F; Settings</div><div class="page-sub">Subscription, branding &amp; company profiles</div></div></div>';
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">';
    html += "<div>";
    html += '<div style="font-size:15px;font-weight:700;margin-bottom:4px">&#x1F4B3; Subscription</div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:6px;background:' + planCfg.bg + ";color:" + planCfg.color + ";border:1px solid " + planCfg.border + '">' + planCfg.label + "</span>";
    if (isTrial && daysLeft !== null) {
      var trialColor = daysLeft <= 3 ? "var(--red)" : daysLeft <= 7 ? "var(--amber)" : "var(--green)";
      html += '<span style="font-size:12px;color:' + trialColor + ';font-weight:700">' + (daysLeft > 0 ? daysLeft + " days remaining" : "Trial expired") + "</span>";
    } else if (status === "active") {
      html += '<span style="font-size:12px;color:var(--green);font-weight:600">&#x2713; Active</span>';
    }
    html += "</div></div>";
    if (isTrial) {
      html += `<button onclick="startStripeCheckout('starter')" style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B06; Upgrade Plan</button>`;
    } else if (plan === "free") {
      html += `<button onclick="startStripeCheckout('starter')" style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B06; Start 14-day paid trial</button>`;
    } else {
      html += '<button onclick="openStripeBillingPortal()" style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Manage plan</button>';
    }
    html += "</div>";
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">';
    html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
    html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Properties</div>';
    html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:' + usageColor(usagePct(propCount, planCfg.props)) + '">' + propCount + ' <span style="font-size:13px;color:var(--muted);font-weight:400">/ ' + planCfg.props + "</span></div>";
    html += usageBar(propCount, planCfg.props);
    html += "</div>";
    html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
    html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Active Tenants</div>';
    html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:var(--text)">' + tenantCount + "</div>";
    html += '<div style="font-size:11px;color:var(--muted);margin-top:5px">' + (plan === "free" ? "Up to 15" : plan === "starter" ? "Up to 75" : plan === "trial" ? "Up to 30" : "Unlimited") + "</div>";
    html += "</div>";
    html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
    html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Users (seats)</div>';
    html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:' + usageColor(usagePct(userCount, planCfg.seats)) + '">' + userCount + ' <span style="font-size:13px;color:var(--muted);font-weight:400">/ ' + planCfg.seats + "</span></div>";
    html += usageBar(userCount, planCfg.seats);
    html += "</div>";
    html += "</div>";
    if (isTrial || plan === "free" || plan === "starter") {
      html += '<div style="border-top:1px solid var(--border);padding-top:14px">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Available Plans</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
      [
        ["starter", "Starter", "\xA349/mo", "15 properties \xB7 3 users"],
        ["professional", "Professional", "\xA389/mo", "25 properties \xB7 5 users"],
        ["business", "Business", "\xA3149/mo", "60 properties \xB7 15 users"]
      ].forEach(function(p) {
        var isCurrent = p[0] === plan;
        html += '<div style="border:1.5px solid ' + (isCurrent ? "var(--accent)" : "var(--border)") + ";border-radius:9px;padding:12px;background:" + (isCurrent ? "var(--accent-light)" : "var(--bg)") + '">';
        html += '<div style="font-size:12px;font-weight:700;color:' + (isCurrent ? "var(--accent-dark)" : "var(--text)") + '">' + p[1] + "</div>";
        html += '<div style="font-size:16px;font-weight:800;font-family:monospace;margin:4px 0">' + p[2] + "</div>";
        html += '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">' + p[3] + "</div>";
        if (!isCurrent) {
          html += `<button onclick="startStripeCheckout('` + p[0] + `')" style="display:block;width:100%;text-align:center;padding:6px;border-radius:7px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Upgrade</button>`;
        } else {
          html += '<div style="text-align:center;font-size:12px;font-weight:700;color:var(--accent-dark)">&#x2713; Current plan' + (isTrial ? " (trial)" : "") + "</div>";
        }
        html += "</div>";
      });
      html += "</div></div>";
    }
    html += "</div>";
    html += '<div style="font-size:15px;font-weight:700;margin-bottom:12px">&#x1F3A8; Branding</div>';
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
    html += '<div class="field"><label class="field-label">Company Logo</label>';
    if (cfg.logoUrl) {
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
      html += '<img src="' + cfg.logoUrl + '" style="width:56px;height:56px;border-radius:10px;object-fit:contain;background:var(--bg);border:1px solid var(--border);padding:4px">';
      html += '<button onclick="removeLogo()" style="padding:5px 10px;border-radius:7px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:11px;cursor:pointer;font-family:inherit">Remove</button></div>';
    }
    html += '<label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border:2px dashed var(--border);border-radius:9px;cursor:pointer;background:var(--bg)">';
    html += '<span style="font-size:20px">&#x1F4F7;</span>';
    html += '<span style="font-size:12px;color:var(--muted)">Upload logo (PNG/JPG)</span>';
    html += '<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none" onchange="uploadLogo(this)">';
    html += "</label></div>";
    html += '<div class="field"><label class="field-label">Portfolio Name (sidebar)</label>';
    html += '<input class="inp" id="cfg-portname" value="' + (cfg.portfolioName || "South London HMOs") + '">';
    html += '<div class="field" style="margin-top:10px"><label class="field-label">Site Title (browser tab)</label>';
    html += '<input class="inp" id="cfg-sitetitle" value="' + (cfg.siteTitle || "PropManager") + '"></div>';
    html += "</div>";
    html += "</div>";
    html += '<button onclick="saveBranding()" style="margin-top:14px;padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Branding</button>';
    html += "</div>";
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    html += '<div style="font-size:15px;font-weight:700">&#x1F3E2; Company Profiles</div>';
    html += '<button onclick="openAddCompanyModal()" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add Company</button>';
    html += "</div>";
    if (companies.length === 0) {
      html += '<div style="background:var(--surface);border:2px dashed var(--border);border-radius:14px;padding:36px;text-align:center;color:var(--dim);margin-bottom:20px"><div style="font-size:36px;margin-bottom:10px">&#x1F3E2;</div><div style="font-size:14px;font-weight:700;margin-bottom:6px">No companies yet</div><div style="font-size:12px">Add your limited company profiles. Then assign properties to each one via the Properties page.</div></div>';
    } else {
      companies.forEach(function(co) {
        var props = state.properties.filter(function(p) {
          return p.companyId === co.id;
        });
        var tenants = state.tenants.filter(function(t) {
          return t.status !== "inactive" && props.some(function(p) {
            return p.name === t.property;
          });
        });
        var mo = Math.round(tenants.reduce(function(s, t) {
          return s + (t.freq === "monthly" ? t.rent : t.rent * 52 / 12);
        }, 0));
        var ll = props.reduce(function(s, p) {
          return s + (p.landlord || 0);
        }, 0);
        var net2 = mo - ll;
        html += '<div style="background:var(--surface);border:2px solid ' + (co.color || "#6366F1") + ';border-radius:14px;padding:18px;margin-bottom:12px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
        html += '<div><div style="font-size:16px;font-weight:800;margin-bottom:3px">&#x1F3E2; ' + co.name + '</div><div style="font-size:12px;color:var(--muted)">Co No: ' + (co.companyNo || "&mdash;") + " &nbsp;&middot;&nbsp; VAT: " + (co.vatNo || "&mdash;") + '</div><div style="font-size:12px;color:var(--muted)">Director: ' + (co.director || "&mdash;") + "</div>" + (co.address ? '<div style="font-size:12px;color:var(--muted)">&#x1F4CD; ' + co.address + "</div>" : "") + (co.email || co.phone ? '<div style="font-size:12px;color:var(--muted)">' + (co.email ? "&#x2709; " + co.email : "") + (co.phone ? " &middot; &#x1F4DE; " + co.phone : "") + (co.whatsapp ? " &middot; &#x1F4AC; " + co.whatsapp : "") + "</div>" : "") + "</div>";
        html += '<button data-coid="' + co.id + '" onclick="openEditCompanyModal(this.dataset.coid)" style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">&#x270F; Edit</button>';
        html += "</div>";
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:10px">';
        [
          "Properties:" + props.length + ":var(--muted)",
          "Tenants:" + tenants.length + ":var(--muted)",
          "Income/mo:&pound;" + mo.toLocaleString() + ":var(--green)",
          "LL Cost/mo:&pound;" + ll.toLocaleString() + ":var(--amber)",
          "Net/mo:&pound;" + net2.toLocaleString() + ":" + (net2 >= 0 ? "var(--green)" : "var(--red)")
        ].forEach(function(s) {
          var p = s.split(":");
          html += '<div style="background:var(--bg);border-radius:8px;padding:8px 10px"><div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:3px">' + p[0] + '</div><div style="font-size:18px;font-weight:800;color:' + p[2] + '">' + p[1] + "</div></div>";
        });
        html += "</div>";
        if (props.length) {
          html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:5px">Assigned Properties</div>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:5px">';
          props.forEach(function(p) {
            html += '<span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 8px">' + p.name + "</span>";
          });
          html += "</div>";
        } else {
          html += '<div style="font-size:11px;color:var(--dim);font-style:italic">No properties assigned \u2014 edit a property and select this company.</div>';
        }
        html += "</div>";
      });
    }
    html += '<div style="font-size:15px;font-weight:700;margin-bottom:12px;margin-top:8px">&#x1F464; Account</div>';
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">';
    html += '<div style="font-size:13px;color:var(--muted);margin-bottom:14px">Logged in as <strong>' + state.currentUser.name + "</strong>";
    if (state.currentUser.email) html += " (" + state.currentUser.email + ")";
    html += "</div>";
    html += '<button onclick="doLogOut()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">&rarr; Log Out</button>';
    html += "</div>";
    if (hiddenV.length) {
      html += '<div style="margin-top:28px;border-top:2px dashed var(--border);padding-top:20px">';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
      html += '<span style="font-size:14px;font-weight:700;color:var(--muted)">\u{1F6AB} Marked Unavailable (' + hiddenV.length + ")</span>";
      html += '<span style="font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:3px 10px;border-radius:8px">Hidden from listings</span>';
      html += "</div>";
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">';
      hiddenV.forEach(function(item) {
        var p = item.p, r = item.r;
        var _eid = "rm-" + p.id + "_" + r.n;
        window._roomEidMap[_eid] = { pid: p.id, rn: r.n };
        html += '<div style="background:var(--bg);border:1.5px dashed var(--border);border-radius:12px;padding:14px;opacity:.75;display:flex;align-items:center;justify-content:space-between;gap:10px">';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="font-size:13px;font-weight:700;color:var(--muted)">' + p.name + " \xB7 Rm " + r.n + "</div>";
        html += '<div style="font-size:12px;color:var(--dim)">' + (r.type || "Room") + " \xB7 \xA3" + r.price + "/wk</div>";
        html += "</div>";
        html += '<button id="' + _eid + '-avail" onclick="toggleRoomAvailByEid(this)" title="Click to make this room available in listings" ';
        html += 'style="padding:8px 12px;border-radius:9px;border:1.5px solid var(--green);background:var(--green-light);color:var(--green);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">';
        html += "\u{1F441} Make Available</button>";
        html += "</div>";
      });
      html += "</div></div>";
    }
    if (_limitWarn) html += '<div class="card" style="padding:0;background:transparent;box-shadow:none;border:none">' + _limitWarn + "</div>";
    html += '<div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px">';
    html += '<div><div style="font-size:14px;font-weight:700">\u21C5 Import & Export</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Upload CSV/XLSX or export all data</div></div>';
    html += `<button onclick="openDataModal('properties')" style="padding:9px 16px;border-radius:9px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Open Data Manager</button></div>`;
    html += '<div class="card"><div style="font-size:14px;font-weight:700;margin-bottom:16px">\u{1F4E7} Email & Notifications</div>' + renderEmailSettings() + "</div>";
    return html;
  }
  function uploadLogo(input) {
    var file = input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      showToast("Logo must be under 500KB", "error");
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      if (!state.config) state.config = {};
      state.config.logoUrl = e.target.result;
      saveState();
      render();
      showToast("Logo saved \u2713", "success");
    };
    reader.readAsDataURL(file);
  }
  function removeLogo() {
    if (!state.config) return;
    state.config.logoUrl = "";
    saveState();
    render();
  }
  function saveBranding() {
    if (!state.config) state.config = {};
    var pn = document.getElementById("cfg-portname");
    var st = document.getElementById("cfg-sitetitle");
    if (pn) state.config.portfolioName = pn.value.trim();
    if (st) state.config.siteTitle = st.value.trim();
    var sbSub = document.getElementById("sb-sub-txt");
    if (sbSub && state.config.portfolioName) sbSub.textContent = state.config.portfolioName;
    if (state.config.siteTitle) document.title = state.config.siteTitle;
    saveState();
    showToast("Branding saved \u2713", "success");
  }
  function openAddCompanyModal() {
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:460px"><div class="modal-header"><span class="modal-title">&#x1F3E2; New Company</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="field"><label class="field-label">Company Name *</label><input class="inp" id="co-name" placeholder="e.g. Reservations Direct Limited"></div><div class="row-2"><div class="field"><label class="field-label">Company Number</label><input class="inp" id="co-regno" placeholder="12345678"></div><div class="field"><label class="field-label">VAT Number</label><input class="inp" id="co-vat" placeholder="GB123456789"></div></div><div class="field"><label class="field-label">Director / Partner</label><input class="inp" id="co-director" placeholder="Gleydson De Paula"></div><div class="field"><label class="field-label">Registered Address</label><input class="inp" id="co-address" placeholder="123 High Street, London, SW1A 1AA"></div><div class="row-2"><div class="field"><label class="field-label">Email</label><input class="inp" id="co-email" type="email" placeholder="info@company.co.uk"></div><div class="field"><label class="field-label">Phone</label><input class="inp" id="co-phone" type="tel" placeholder="07911 000000"></div></div><div class="field"><label class="field-label">WhatsApp Number <span style="font-size:11px;color:var(--muted)">(used on Tenant Portal contact button)</span></label><input class="inp" id="co-wa" type="tel" placeholder="447911000000 (include country code)"></div><div class="field"><label class="field-label">Brand Colour</label><input class="inp" id="co-color" type="color" value="#6366F1" style="height:40px;padding:4px 8px;cursor:pointer"></div></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button onclick="saveNewCompany()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Company</button></div></div></div>';
  }
  function openEditCompanyModal(cid) {
    var co = (state.companies || []).find(function(c) {
      return c.id === cid;
    });
    if (!co) return;
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:460px"><div class="modal-header"><span class="modal-title">&#x270F; Edit Company</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><input type="hidden" id="co-edit-id" value="' + co.id + '"><div class="field"><label class="field-label">Company Name *</label><input class="inp" id="co-name" value="' + co.name + '"></div><div class="row-2"><div class="field"><label class="field-label">Company Number</label><input class="inp" id="co-regno" value="' + (co.companyNo || co.regNo || "") + '"></div><div class="field"><label class="field-label">VAT Number</label><input class="inp" id="co-vat" value="' + (co.vatNo || "") + '"></div></div><div class="field"><label class="field-label">Director / Partner</label><input class="inp" id="co-director" value="' + (co.director || "") + '"></div><div class="field"><label class="field-label">Registered Address</label><input class="inp" id="co-address" value="' + (co.address || "") + '"></div><div class="row-2"><div class="field"><label class="field-label">Email</label><input class="inp" id="co-email" value="' + (co.email || "") + '"></div><div class="field"><label class="field-label">Phone</label><input class="inp" id="co-phone" value="' + (co.phone || "") + '"></div></div><div class="field"><label class="field-label">WhatsApp Number <span style="font-size:11px;color:var(--muted)">(used on Tenant Portal contact button)</span></label><input class="inp" id="co-wa" type="tel" value="' + (co.whatsapp || co.phone || "") + '" placeholder="447911000000"></div><div class="field"><label class="field-label">Brand Colour</label><input class="inp" id="co-color" type="color" value="' + (co.color || "#6366F1") + '" style="height:40px;padding:4px 8px;cursor:pointer"></div></div><div class="modal-footer"><button data-dcoid="' + co.id + '" onclick="deleteCompany(this.dataset.dcoid)" style="padding:9px 18px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Delete</button><button onclick="saveEditCompany()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Changes</button></div></div></div>';
  }
  function saveNewCompany() {
    var name = (document.getElementById("co-name").value || "").trim();
    if (!name) {
      showToast("Company name required", "error");
      return;
    }
    if (!state.companies) state.companies = [];
    state.companies.push({
      id: "co_" + Date.now(),
      name,
      companyNo: (document.getElementById("co-regno").value || "").trim(),
      vatNo: (document.getElementById("co-vat").value || "").trim(),
      director: (document.getElementById("co-director").value || "").trim(),
      address: (document.getElementById("co-address").value || "").trim(),
      email: (document.getElementById("co-email").value || "").trim(),
      phone: (document.getElementById("co-phone").value || "").trim(),
      whatsapp: (document.getElementById("co-wa").value || "").trim().replace(/\D/g, ""),
      color: document.getElementById("co-color").value
    });
    saveState();
    closeModal();
    render();
    showToast("Company saved \u2713", "success");
  }
  function saveEditCompany() {
    var cid = document.getElementById("co-edit-id").value;
    var co = (state.companies || []).find(function(c) {
      return c.id === cid;
    });
    if (!co) return;
    co.name = (document.getElementById("co-name").value || "").trim();
    co.companyNo = (document.getElementById("co-regno").value || "").trim();
    co.vatNo = (document.getElementById("co-vat").value || "").trim();
    co.director = (document.getElementById("co-director").value || "").trim();
    co.address = (document.getElementById("co-address").value || "").trim();
    co.email = (document.getElementById("co-email").value || "").trim();
    co.phone = (document.getElementById("co-phone").value || "").trim();
    co.whatsapp = (document.getElementById("co-wa").value || "").trim().replace(/\D/g, "");
    co.color = document.getElementById("co-color").value;
    saveState();
    closeModal();
    render();
    showToast("Company updated \u2713", "success");
  }
  function deleteCompany(cid) {
    if (!confirm("Delete this company? Properties will become unassigned.")) return;
    state.companies = (state.companies || []).filter(function(c) {
      return c.id !== cid;
    });
    state.properties.forEach(function(p) {
      if (p.companyId === cid) p.companyId = "";
    });
    saveState();
    closeModal();
    render();
  }
  function openInviteUserModal() {
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:440px"><div class="modal-header"><span class="modal-title">&#x2709; Invite User</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div style="background:var(--accent-light);border:1px solid var(--accent);border-radius:9px;padding:11px 13px;margin-bottom:14px;font-size:12px;color:var(--accent-dark)">&#x2139;&#xFE0F; An invite email is sent. The user clicks the link and is logged in automatically.</div><div class="field"><label class="field-label">Email Address *</label><input class="inp" id="inv-email" type="email" placeholder="fred@reservationsdirect.co.uk"></div><div class="field"><label class="field-label">Full Name</label><input class="inp" id="inv-name" placeholder="Fred Mensah"></div><div class="field"><label class="field-label">Role</label><select class="inp" id="inv-role"><option value="viewer">&#x1F441;&#xFE0F; Viewer</option><option value="maintenance">&#x1F527; Maintenance</option><option value="manager">&#x1F4BC; Manager</option><option value="admin">&#x1F451; Admin</option></select></div><div id="inv-status" style="display:none;padding:10px 12px;border-radius:9px;font-size:13px;font-weight:600;margin-top:8px"></div></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button id="inv-btn" onclick="sendInvite()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Send Invite</button></div></div></div>';
  }
  async function sendInvite() {
    var email = (document.getElementById("inv-email").value || "").trim();
    var name = (document.getElementById("inv-name").value || "").trim();
    var role = document.getElementById("inv-role").value;
    var statusEl = document.getElementById("inv-status");
    var btn2 = document.getElementById("inv-btn");
    if (!email) {
      showToast("Email required", "error");
      return;
    }
    btn2.disabled = true;
    btn2.textContent = "Sending\u2026";
    statusEl.style.display = "none";
    try {
      var { error } = await supa.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/index.html", data: { full_name: name, role } }
      });
      if (error) throw error;
      var initials = name ? name.split(" ").map(function(w) {
        return w[0] || "";
      }).join("").toUpperCase().slice(0, 2) : email.slice(0, 2).toUpperCase();
      if (!state.users.find(function(u) {
        return u.email === email;
      })) {
        state.users.push({ id: crypto.randomUUID(), name: name || email, initials, email, phone: "", role, status: "pending", lastLogin: "Never" });
        saveState();
      }
      statusEl.style.cssText = "display:block;background:#D1FAE5;border:1px solid #A7F3D0;color:#065F46;padding:10px 12px;border-radius:9px;font-size:13px";
      statusEl.innerHTML = "&#x2713; Invite sent to " + email;
      btn2.textContent = "Sent \u2713";
      btn2.style.background = "var(--green)";
      setTimeout(function() {
        closeModal();
        render();
      }, 2e3);
    } catch (e) {
      statusEl.style.cssText = "display:block;background:#FEE2E2;border:1px solid #FECDD3;color:#B91C1C;padding:10px 12px;border-radius:9px;font-size:13px";
      statusEl.textContent = "Error: " + (e.message || "Could not send invite");
      btn2.disabled = false;
      btn2.textContent = "Send Invite";
    }
  }
  function editUserModal(uid) {
    var u = state.users.find(function(x) {
      return String(x.id) === String(uid);
    });
    if (!u) return;
    var allRoles = Object.keys(state.roles);
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:420px"><div class="modal-header"><span class="modal-title">&#x270F; Edit User</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><input type="hidden" id="edit-uid" value="' + u.id + '"><div class="field"><label class="field-label">Full Name</label><input class="inp" id="edit-name" value="' + u.name + '"></div><div class="field"><label class="field-label">Email</label><input class="inp" id="edit-email" type="email" value="' + (u.email || "") + '"></div><div class="field"><label class="field-label">Phone</label><input class="inp" id="edit-phone" value="' + (u.phone || "") + '"></div><div class="field"><label class="field-label">Role</label><select class="inp" id="edit-role">' + allRoles.map(function(rk) {
      return '<option value="' + rk + '" ' + (u.role === rk ? "selected" : "") + ">" + state.roles[rk].icon + " " + state.roles[rk].label + "</option>";
    }).join("") + '</select></div></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button><button onclick="saveEditUser()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save</button></div></div></div>';
  }
  function saveEditUser() {
    var uid = document.getElementById("edit-uid").value;
    var u = state.users.find(function(x) {
      return String(x.id) === String(uid);
    });
    if (!u) return;
    u.name = (document.getElementById("edit-name").value || "").trim() || u.name;
    u.email = (document.getElementById("edit-email").value || "").trim();
    u.phone = (document.getElementById("edit-phone").value || "").trim();
    u.role = document.getElementById("edit-role").value;
    u.initials = u.name.split(" ").map(function(w) {
      return w[0] || "";
    }).join("").toUpperCase().slice(0, 2);
    if (String(u.id) === String(state.currentUser.id)) {
      state.currentUser.name = u.name;
      state.currentUser.role = u.role;
      state.currentUser.initials = u.initials;
    }
    saveState();
    closeModal();
    render();
    showToast("User updated \u2713", "success");
  }
  async function deleteUserBtn(el) {
    var uid = el.dataset.uid;
    var u = state.users.find(function(x) {
      return String(x.id) === String(uid);
    });
    if (!u || !confirm("Permanently delete " + u.name + "? This cannot be undone.")) return;
    state.users = state.users.filter(function(x) {
      return String(x.id) !== String(uid);
    });
    try {
      await supa.from("org_members").delete().eq("user_id", String(uid));
    } catch (e) {
      console.warn(e);
    }
    saveState();
    render();
    showToast("User permanently removed", "success");
  }
  function updateUserRoleByEl(sel) {
    updateUserRole(sel.dataset.uruid, sel.value);
  }
  function previewDoc(docId) {
    var doc = null;
    if (state.vault) {
      Object.values(state.vault).forEach(function(arr) {
        arr.forEach(function(d) {
          if (d.id === docId || d.name === docId) doc = d;
        });
      });
    }
    if (!doc && state.propDocs) {
      Object.values(state.propDocs).forEach(function(arr) {
        arr.forEach(function(d) {
          if (d.id === docId || d.name === docId) doc = d;
        });
      });
    }
    if (!doc || !doc.dataUrl) {
      showToast("No preview available", "error");
      return;
    }
    var isPdf = doc.name && doc.name.match(/\.pdf$/i);
    var isImg = doc.name && doc.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    var isSupaUrl = doc.dataUrl && doc.dataUrl.indexOf("supabase.co") >= 0;
    if (isSupaUrl) {
      document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:460px"><div class="modal-header"><span class="modal-title">' + doc.name + '</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body" style="text-align:center;padding:32px 24px"><div style="font-size:52px;margin-bottom:16px">' + (isPdf ? "&#x1F4C4;" : isImg ? "&#x1F5BC;&#xFE0F;" : "&#x1F4CB;") + '</div><div style="font-size:15px;font-weight:700;margin-bottom:6px">' + doc.name + '</div><div style="font-size:12px;color:var(--muted);margin-bottom:24px">' + (doc.type || "Document") + (doc.size ? " &middot; " + doc.size : "") + '</div><div style="display:flex;gap:10px;justify-content:center"><a href="' + doc.dataUrl + '" target="_blank" style="padding:11px 24px;border-radius:10px;background:var(--accent);color:#fff;font-size:14px;font-weight:700;text-decoration:none">Open / View</a><a href="' + doc.dataUrl + '" download="' + doc.name + '" style="padding:11px 24px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;font-weight:700;text-decoration:none">Download</a></div></div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">Close</button></div></div></div>';
      return;
    }
    var inner = isPdf ? '<iframe src="' + doc.dataUrl + '" style="width:100%;height:70vh;border:none;border-radius:8px"></iframe>' : isImg ? '<img src="' + doc.dataUrl + '" style="max-width:100%;max-height:70vh;border-radius:8px;display:block;margin:0 auto">' : '<div style="padding:40px;text-align:center;color:var(--muted)">Preview not available for this file type.<br><a href="' + doc.dataUrl + '" download="' + doc.name + '" style="color:var(--blue)">Download instead \u2193</a></div>';
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()" style="align-items:flex-start;padding-top:40px"><div class="modal" style="max-width:900px;width:95vw"><div class="modal-header"><span class="modal-title">\u{1F441} ' + doc.name + '</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body" style="padding:16px">' + inner + '</div><div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Close</button><a href="' + doc.dataUrl + '" download="' + doc.name + '" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;text-decoration:none">\u2193 Download</a></div></div></div>';
  }
  var CONTRACTOR_TRADES = ["General", "Plumbing", "Electrical", "Heating", "Structural", "Cleaning", "Pest Control", "Locks / Security", "Garden", "White Goods", "Broadband / WiFi", "Other"];
  function openContractorProfile(id) {
    var c = (state.contractors || []).find(function(x) {
      return x.id === id;
    });
    if (!c) return;
    var jobs = state.maintenance.filter(function(m) {
      return m.contractor === c.name;
    });
    jobs.sort(function(a, b) {
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
    var totalPaid = 0, openJobs = 0, resolvedJobs = 0, invoices = [];
    jobs.forEach(function(m) {
      var mx = state.maintExtras && state.maintExtras[m.id] || {};
      if (mx.cost) totalPaid += mx.cost;
      if (m.status === "resolved") resolvedJobs++;
      else openJobs++;
      if (mx.invoiceName) invoices.push({ job: m.issue, name: mx.invoiceName, url: mx.invoiceUrl || "#", cost: mx.cost || 0, date: m.date, property: m.property });
    });
    var stars = c.rating ? "\u2605".repeat(c.rating) + "\u2606".repeat(5 - c.rating) : "\u2014";
    var tc = { "Plumbing": "var(--blue)", "Electrical": "var(--amber)", "Heating": "#EF4444", "Cleaning": "var(--green)" }[c.trade] || "var(--muted)";
    function sc(s) {
      return s === "resolved" ? "var(--green)" : s === "in_progress" ? "var(--amber)" : "var(--red)";
    }
    function sl(s) {
      return s === "in_progress" ? "In Progress" : s === "resolved" ? "Resolved" : "Open";
    }
    var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:640px"><div class="modal-header" style="background:linear-gradient(135deg,#0F0F1A,#1a1a3e)"><div style="display:flex;align-items:center;gap:14px;width:100%"><div style="width:48px;height:48px;border-radius:50%;background:' + tc + ';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">\u{1F477}</div><div style="flex:1"><div style="font-size:16px;font-weight:800;color:#fff">' + c.name + '</div><div style="display:flex;gap:8px;margin-top:3px"><span style="font-size:11px;font-weight:700;color:' + tc + ';background:rgba(255,255,255,.1);padding:2px 9px;border-radius:10px">' + c.trade + "</span>" + (c.rating ? '<span style="font-size:12px;color:#F59E0B">' + stars + "</span>" : "") + '</div></div><button class="modal-close" onclick="closeModal()" style="color:#fff">&times;</button></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border)">' + [
      ["Total Spent", totalPaid ? "\xA3" + totalPaid.toLocaleString() : "\xA30", "var(--red)"],
      ["Total Jobs", jobs.length, "var(--text)"],
      ["Open", openJobs, openJobs ? "var(--amber)" : "var(--green)"],
      ["Invoices", invoices.length, "var(--blue)"]
    ].map(function(k) {
      return '<div style="padding:14px;text-align:center;border-right:1px solid var(--border)"><div style="font-size:18px;font-weight:800;font-family:monospace;color:' + k[2] + '">' + k[1] + '</div><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-top:2px">' + k[0] + "</div></div>";
    }).join("") + '</div><div style="overflow-y:auto;max-height:60vh"><div style="padding:16px 20px;border-bottom:1px solid var(--border)"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Contact</div><div style="display:flex;flex-wrap:wrap;gap:8px">' + (c.phone ? '<a href="tel:' + c.phone + '" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;color:var(--text);text-decoration:none">\u{1F4DE} ' + c.phone + "</a>" : "") + (c.whatsapp ? '<a href="https://wa.me/' + c.whatsapp.replace(/\D/g, "") + '" target="_blank" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid #BBF7D0;background:#F0FDF4;font-size:12px;font-weight:600;color:#16A34A;text-decoration:none">\u{1F4AC} WhatsApp</a>' : "") + (c.email ? '<a href="mailto:' + c.email + '" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid #BFDBFE;background:var(--blue-light);font-size:12px;font-weight:600;color:var(--blue);text-decoration:none">\u2709 ' + c.email + "</a>" : "") + (c.callOutCharge ? '<span style="padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;color:var(--muted)">\u{1F4B7} \xA3' + c.callOutCharge + " call-out</span>" : "") + "</div>" + (c.notes ? '<div style="margin-top:10px;font-size:12px;color:var(--muted);background:var(--bg);padding:8px 12px;border-radius:8px">' + c.notes + "</div>" : "") + "</div>";
    if (invoices.length) {
      html += '<div style="padding:16px 20px;border-bottom:1px solid var(--border)">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Invoices & Receipts</div>';
      invoices.forEach(function(inv) {
        html += '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:9px;margin-bottom:6px"><div style="font-size:20px">\u{1F4C4}</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + inv.name + '</div><div style="font-size:11px;color:var(--muted)">' + inv.job + " \xB7 " + inv.property + "</div></div>" + (inv.cost ? '<span style="font-size:13px;font-weight:800;color:var(--red);font-family:monospace;flex-shrink:0">\xA3' + inv.cost + "</span>" : "") + '<a href="' + inv.url + '" download="' + inv.name + '" style="padding:5px 10px;border-radius:7px;border:1.5px solid var(--blue);background:#fff;font-size:11px;font-weight:700;color:var(--blue);text-decoration:none;flex-shrink:0">Download</a></div>';
      });
      html += "</div>";
    }
    html += '<div style="padding:16px 20px">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Job History (' + jobs.length + ")</div>";
    if (!jobs.length) {
      html += '<div style="text-align:center;padding:24px;color:var(--dim);font-size:13px">No jobs assigned yet</div>';
    } else {
      jobs.forEach(function(m) {
        var mx = state.maintExtras && state.maintExtras[m.id] || {};
        html += '<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)"><div style="width:10px;height:10px;border-radius:50%;background:' + sc(m.status) + ';flex-shrink:0;margin-top:4px"></div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-size:13px;font-weight:700">' + m.issue + "</div>" + (mx.cost ? '<div style="font-size:13px;font-weight:800;color:var(--red);font-family:monospace;flex-shrink:0">\xA3' + mx.cost + "</div>" : "") + '</div><div style="font-size:11px;color:var(--muted);margin-top:2px">' + m.property + (m.room ? " \xB7 Room " + m.room : "") + '</div><div style="display:flex;gap:7px;margin-top:5px;flex-wrap:wrap"><span style="font-size:10px;font-weight:700;color:' + sc(m.status) + ";padding:2px 8px;border-radius:10px;border:1px solid " + sc(m.status) + '">' + sl(m.status) + "</span>" + (m.cat ? '<span style="font-size:10px;color:var(--dim)">' + m.cat + "</span>" : "") + (m.date ? '<span style="font-size:10px;color:var(--dim)">' + m.date + "</span>" : "") + "</div>" + (m.notes ? '<div style="font-size:11px;color:var(--muted);margin-top:4px;padding:5px 8px;background:var(--bg);border-radius:6px">' + m.notes + "</div>" : "") + (mx.invoiceName ? '<div style="margin-top:5px"><a href="' + (mx.invoiceUrl || "#") + '" download="' + mx.invoiceName + '" style="font-size:11px;font-weight:600;color:var(--blue)">\u{1F4C4} ' + mx.invoiceName + "</a></div>" : "") + "</div></div>";
      });
    }
    html += "</div></div>";
    html += `<div class="modal-footer" style="justify-content:space-between"><button onclick="openEditContractorModal('` + id + `');closeModal()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--muted)">\u270F\uFE0F Edit Profile</button><button onclick="closeModal()" style="padding:9px 20px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Close</button></div></div></div>`;
    document.getElementById("modal-container").innerHTML = html;
  }
  function openAddContractorModal() {
    var tradeOpts = CONTRACTOR_TRADES.map(function(t) {
      return "<option>" + t + "</option>";
    }).join("");
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px"><div class="modal-header"><span class="modal-title">\u2795 Add Contractor</span><button class="modal-close" onclick="closeModal()">\xD7</button></div><div class="modal-body"><div class="row-2"><div class="field"><label class="field-label">Name *</label><input class="inp" id="cx-name" placeholder="e.g. Bob Smith Plumbing"></div><div class="field"><label class="field-label">Trade</label><select class="inp" id="cx-trade">' + tradeOpts + '</select></div></div><div class="row-2"><div class="field"><label class="field-label">Phone</label><input class="inp" id="cx-phone" type="tel" placeholder="07911000000"></div><div class="field"><label class="field-label">WhatsApp number</label><input class="inp" id="cx-wa" type="tel" placeholder="447911000000"></div></div><div class="field"><label class="field-label">Email</label><input class="inp" id="cx-email" type="email" placeholder="contractor@email.com"></div><div class="row-2"><div class="field"><label class="field-label">Call-out charge (\xA3)</label><input class="inp" id="cx-callout" type="number" placeholder="0"></div><div class="field"><label class="field-label">Rating (1\u20135)</label><select class="inp" id="cx-rating"><option value="">\u2014</option><option value="5">\u2605\u2605\u2605\u2605\u2605 Excellent</option><option value="4">\u2605\u2605\u2605\u2605\u2606 Good</option><option value="3">\u2605\u2605\u2605\u2606\u2606 OK</option><option value="2">\u2605\u2605\u2606\u2606\u2606 Poor</option><option value="1">\u2605\u2606\u2606\u2606\u2606 Avoid</option></select></div></div><div class="field"><label class="field-label">Notes</label><textarea class="inp" id="cx-notes" rows="2" placeholder="Specialisms, areas covered, payment terms\u2026" style="resize:vertical"></textarea></div><div class="modal-footer">' + btn("Cancel", "closeModal()", "secondary") + btn("Add Contractor", "saveContractor(null)", "primary") + "</div></div></div></div>";
  }
  function openEditContractorModal(id) {
    var c = (state.contractors || []).find(function(x) {
      return x.id === id;
    });
    if (!c) return;
    var tradeOpts = CONTRACTOR_TRADES.map(function(t) {
      return "<option " + (t === c.trade ? "selected" : "") + ">" + t + "</option>";
    }).join("");
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:500px"><div class="modal-header"><span class="modal-title">\u270F\uFE0F Edit Contractor</span><button class="modal-close" onclick="closeModal()">\xD7</button></div><div class="modal-body"><div class="row-2"><div class="field"><label class="field-label">Name *</label><input class="inp" id="cx-name" value="' + c.name + '"></div><div class="field"><label class="field-label">Trade</label><select class="inp" id="cx-trade">' + tradeOpts + '</select></div></div><div class="row-2"><div class="field"><label class="field-label">Phone</label><input class="inp" id="cx-phone" type="tel" value="' + (c.phone || "") + '"></div><div class="field"><label class="field-label">WhatsApp number</label><input class="inp" id="cx-wa" type="tel" value="' + (c.whatsapp || "") + '"></div></div><div class="field"><label class="field-label">Email</label><input class="inp" id="cx-email" type="email" value="' + (c.email || "") + '"></div><div class="row-2"><div class="field"><label class="field-label">Call-out charge (\xA3)</label><input class="inp" id="cx-callout" type="number" value="' + (c.callOutCharge || "") + '"></div><div class="field"><label class="field-label">Rating (1\u20135)</label><select class="inp" id="cx-rating"><option value="">\u2014</option>' + [5, 4, 3, 2, 1].map(function(n) {
      return '<option value="' + n + '" ' + (c.rating === n ? "selected" : "") + ">" + "\u2605".repeat(n) + "\u2606".repeat(5 - n) + " " + (n === 5 ? "Excellent" : n === 4 ? "Good" : n === 3 ? "OK" : n === 2 ? "Poor" : "Avoid") + "</option>";
    }).join("") + '</select></div></div><div class="field"><label class="field-label">Notes</label><textarea class="inp" id="cx-notes" rows="2" style="resize:vertical">' + (c.notes || "") + `</textarea></div><div class="modal-footer" style="justify-content:space-between"><button onclick="deleteContractor('` + id + `')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">\u{1F5D1} Delete</button><div style="display:flex;gap:8px">` + btn("Cancel", "closeModal()", "secondary") + btn("Save Changes", "saveContractor('" + id + "')", "primary") + "</div></div></div></div></div>";
  }
  function saveContractor(id) {
    var name = (document.getElementById("cx-name") || { value: "" }).value.trim();
    if (!name) {
      alert("Please enter a contractor name.");
      return;
    }
    var c = {
      id: id || crypto.randomUUID(),
      name,
      trade: (document.getElementById("cx-trade") || { value: "General" }).value,
      phone: (document.getElementById("cx-phone") || { value: "" }).value.trim(),
      whatsapp: (document.getElementById("cx-wa") || { value: "" }).value.trim().replace(/\s+/g, "").replace(/^\+/, ""),
      email: (document.getElementById("cx-email") || { value: "" }).value.trim(),
      callOutCharge: +(document.getElementById("cx-callout") || { value: 0 }).value || 0,
      rating: +(document.getElementById("cx-rating") || { value: "" }).value || null,
      notes: (document.getElementById("cx-notes") || { value: "" }).value.trim(),
      lastUsed: id ? ((state.contractors || []).find(function(x) {
        return x.id === id;
      }) || {}).lastUsed : null
    };
    if (!state.contractors) state.contractors = [];
    if (id) {
      var idx = state.contractors.findIndex(function(x) {
        return x.id === id;
      });
      if (idx >= 0) state.contractors[idx] = c;
      else state.contractors.push(c);
    } else {
      state.contractors.push(c);
    }
    closeModal();
    saveState();
    render();
  }
  function deleteContractor(id) {
    if (!confirm("Delete this contractor?")) return;
    state.contractors = (state.contractors || []).filter(function(c) {
      return c.id !== id;
    });
    closeModal();
    saveState();
    render();
  }
  function sendToContractorModal(maintId) {
    var m = state.maintenance.find(function(x) {
      return String(x.id) === String(maintId);
    });
    if (!m) return;
    var contractors = state.contractors || [];
    if (!contractors.length) {
      if (confirm("No contractors yet. Add one now?")) {
        state.filters.maintView = "contractors";
        render();
        setTimeout(openAddContractorModal, 100);
      }
      return;
    }
    var prop = state.properties.find(function(p) {
      return p.name === m.property;
    });
    var NL = "\n";
    var jobMsg = "\u{1F527} *JOB REQUEST \u2014 PropManager*" + NL + "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501" + NL + "*Issue:* " + m.issue + NL + "*Property:* " + m.property + NL + (prop && prop.address && prop.address !== m.property ? "*Address:* " + prop.address + NL : "") + (m.room ? "*Room:* " + m.room + NL : "") + (m.tenant ? "*Tenant:* " + m.tenant + NL : "") + "*Priority:* " + (m.priority || "Normal").toUpperCase() + NL + (m.notes ? NL + "*Details:* " + m.notes + NL : "") + (prop && prop.mapsUrl ? NL + "\u{1F4CD} " + prop.mapsUrl + NL : "") + "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501" + NL + "Please confirm if you can attend and your estimated arrival." + NL + "_Sent via PropManager_";
    var cRows = contractors.map(function(c) {
      var waNum = c.whatsapp ? c.whatsapp.replace(/\D/g, "") : "";
      var waHref = waNum ? "https://wa.me/" + waNum + "?text=" + encodeURIComponent(jobMsg) : "";
      var mailHref = c.email ? "mailto:" + c.email + "?subject=" + encodeURIComponent("[Job Request] " + m.issue + " \u2014 " + m.property) + "&body=" + encodeURIComponent(jobMsg) : "";
      var stars = c.rating ? "\u2605".repeat(c.rating) : "";
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;margin-bottom:8px"><div><div style="font-size:13px;font-weight:700">' + c.name + '</div><div style="font-size:11px;color:var(--muted)">' + c.trade + (stars ? ' \xB7 <span style="color:var(--amber)">' + stars + "</span>" : "") + "</div>" + (c.callOutCharge ? '<div style="font-size:11px;color:var(--dim)">Call-out: \xA3' + c.callOutCharge + "</div>" : "") + '</div><div style="display:flex;gap:6px">' + (waHref ? '<a href="' + waHref + `" target="_blank" onclick="markContractorUsed('` + c.id + `');closeModal()" style="padding:7px 12px;border-radius:8px;background:#F0FDF4;border:1px solid #BBF7D0;color:#16A34A;font-size:12px;font-weight:700;text-decoration:none">\u{1F4AC} WA</a>` : "") + (mailHref ? '<a href="' + mailHref + `" onclick="markContractorUsed('` + c.id + `');closeModal()" style="padding:7px 12px;border-radius:8px;background:var(--blue-light);border:1px solid #BFDBFE;color:var(--blue);font-size:12px;font-weight:700;text-decoration:none">\u2709\uFE0F Email</a>` : "") + (!waHref && !mailHref ? '<span style="font-size:11px;color:var(--dim);padding:7px">No contact</span>' : "") + "</div></div>";
    }).join("");
    document.getElementById("modal-container").innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:480px"><div class="modal-header"><span class="modal-title">\u{1F527} Send Job to Contractor</span><button class="modal-close" onclick="closeModal()">\xD7</button></div><div class="modal-body"><div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px"><div style="font-size:13px;font-weight:700;margin-bottom:2px">' + m.issue + '</div><div style="font-size:12px;color:var(--muted)">' + m.property + (m.room ? " \xB7 Room " + m.room : "") + '</div></div><div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Choose a contractor</div>' + cRows + `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)"><button onclick="state.filters.maintView='contractors';closeModal();render();setTimeout(openAddContractorModal,100)" style="width:100%;padding:10px;border-radius:9px;border:1px solid var(--border);background:transparent;font-size:13px;color:var(--muted);cursor:pointer;font-family:inherit">+ Add new contractor</button></div><div class="modal-footer">` + btn("Close", "closeModal()", "secondary") + "</div></div></div></div>";
  }
  function markContractorUsed(id) {
    var c = (state.contractors || []).find(function(x) {
      return x.id === id;
    });
    if (c) {
      c.lastUsed = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      saveState();
    }
  }
  function shareMaintWA(e, maintId) {
    if (e) e.stopPropagation();
    var m = state.maintenance.find(function(x) {
      return String(x.id) === String(maintId);
    });
    if (!m) return;
    var prop = state.properties.find(function(p) {
      return p.name === m.property;
    });
    var mx = state.maintExtras && state.maintExtras[m.id] || {};
    var NL = "\n", pri = m.priority === "urgent" ? " [URGENT]" : m.priority === "high" ? " [HIGH]" : "";
    var msg = "MAINTENANCE" + pri + "\n---\n" + m.issue + "\n\nProperty: " + m.property + NL;
    if (prop && prop.address && prop.address !== m.property) msg += prop.address + NL;
    if (m.room) msg += "Room: " + m.room + NL;
    msg += "Tenant: " + (m.tenant || "-") + NL + NL + "Priority: " + (m.priority || "normal").toUpperCase() + NL + "Status: " + (m.status || "open").replace("_", " ").toUpperCase() + NL;
    if (m.cat || m.category) msg += "Category: " + (m.cat || m.category) + NL;
    msg += "Logged: " + (m.date || (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })) + NL;
    if (mx.cost) msg += "Job Cost: \xA3" + mx.cost + NL;
    if (m.notes) msg += NL + "Notes: " + m.notes + NL;
    if (prop && prop.mapsUrl) msg += NL + "Location: " + prop.mapsUrl + NL;
    msg += "---\nSent via PropManager";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  }
  function shareAllMaintWA() {
    var open = state.maintenance.filter(function(m) {
      return m.status !== "resolved";
    });
    if (!open.length) {
      showToast("No open maintenance tasks", "error");
      return;
    }
    var msg = "OPEN MAINTENANCE (" + open.length + ")\n" + (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + "\n---\n";
    open.forEach(function(m, i) {
      msg += i + 1 + ". " + m.issue + (m.priority === "urgent" ? " [URGENT]" : "") + "\n   " + m.property + (m.room ? " Rm " + m.room : "") + "\n   " + (m.status || "open").replace("_", " ").toUpperCase() + "\n" + (m.notes ? "   " + m.notes + "\n" : "");
    });
    msg += "---";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  }
  function shareAllPropDocs(propId, propNameEncoded) {
    var propName = decodeURIComponent(propNameEncoded);
    var docs = state.propDocs && state.propDocs[propId] || [];
    if (!docs.length) {
      showToast("No documents to share", "error");
      return;
    }
    var msg = "\u{1F4C2} *PROPERTY DOCUMENTS*\n*Property:* " + propName + "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n";
    docs.forEach(function(doc, i) {
      var days = doc.expiresAt ? getDaysUntilExpiry(doc.expiresAt) : null;
      var expStr = days === null ? "" : days < 0 ? " \u26D4 EXPIRED" : days <= 30 ? " \u26A0\uFE0F Expires in " + days + "d" : " \u2713 Valid";
      msg += i + 1 + ". *" + doc.type + "*" + expStr + "\n   " + doc.name + " (" + doc.size + ")\n" + (doc.expiresAt ? "   Exp: " + new Date(doc.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + "\n" : "");
    });
    msg += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n_Sent via PropManager_";
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  }
  function clearSavedState() {
    var _kr = [];
    for (var _i = 0; _i < localStorage.length; _i++) {
      var _k = localStorage.key(_i);
      if (_k && _k.startsWith("pm_")) _kr.push(_k);
    }
    _kr.forEach(function(k) {
      localStorage.removeItem(k);
    });
    location.reload();
  }
  var _origRender = render;
  render = function() {
    if (_appBootPending) return;
    _origRender();
    clearTimeout(window._renderSaveTimer);
    window._renderSaveTimer = setTimeout(saveState, 800);
    if (state.page === "dashboard") {
      clearTimeout(window._dashAgentTimer);
      window._dashAgentTimer = setTimeout(renderDashboardAgent, 200);
    }
    if (state.page === "properties" && (state.filters.propView || "list") === "deal") {
      clearTimeout(window._dealCalcTimer);
      window._dealCalcTimer = setTimeout(recalcDealPage, 80);
    }
    if (!window._roomSyncDone) {
      clearTimeout(window._roomSyncTimer);
      window._roomSyncTimer = setTimeout(function() {
        window._roomSyncDone = true;
        syncRoomPhotosBackground();
      }, 3e3);
    }
  };
  function runAfterSupabaseLoad() {
    state.properties.forEach(function(p) {
      if (!p.roomList) return;
      p.roomList.forEach(function(r) {
        var tenant = state.tenants.find(function(t) {
          return t.property === p.name && t.room === r.n && t.status !== "inactive";
        });
        r.status = tenant ? "occupied" : "vacant";
        if (tenant && tenant.rent > 0) r.price = tenant.rent;
      });
      p.occupied = p.roomList.filter(function(r) {
        return r.status === "occupied";
      }).length;
      var occupiedPrices = p.roomList.filter(function(r) {
        return r.status === "occupied" && r.price > 0;
      }).map(function(r) {
        return r.price;
      });
      if (occupiedPrices.length) {
        var avgPrice = Math.round(occupiedPrices.reduce(function(s, v) {
          return s + v;
        }, 0) / occupiedPrices.length);
        p.roomList.forEach(function(r) {
          if (r.status === "vacant" && r.price === 0) r.price = avgPrice;
        });
      }
      var propTenants = state.tenants.filter(function(t) {
        return t.property === p.name && t.status !== "inactive";
      });
      p.rent = Math.round(propTenants.reduce(function(s, t) {
        return s + (t.freq === "monthly" ? t.rent : (t.rent || 0) * 52 / 12);
      }, 0));
    });
    rebuildAllSchedules();
    var today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    state.tenants.forEach(function(t) {
      if (t.status === "notice_given" && t.moveOutDate) {
        var moveOut = new Date(t.moveOutDate);
        moveOut.setHours(0, 0, 0, 0);
        if (moveOut <= today) {
          t.status = "inactive";
          freeRoom(t.property, t.room);
        }
      }
    });
  }
  var PROP_DOC_TYPES = [
    { type: "Gas Safety Certificate", icon: "\u{1F525}", warn: 60, color: "#FEF3C7", textColor: "#92400E" },
    { type: "HMO Licence", icon: "\u{1F3E0}", warn: 90, color: "#EDE9FE", textColor: "#5B21B6" },
    { type: "Electrical Certificate (EICR)", icon: "\u26A1", warn: 60, color: "#EFF6FF", textColor: "#1E40AF" },
    { type: "Energy Performance (EPC)", icon: "\u{1F33F}", warn: 90, color: "#DCFCE7", textColor: "#166534" },
    { type: "Fire Risk Assessment", icon: "\u{1F9EF}", warn: 60, color: "#FEE2E2", textColor: "#991B1B" },
    { type: "Boiler Service", icon: "\u{1F527}", warn: 60, color: "#F0FDF4", textColor: "#166534" },
    { type: "Landlord Insurance", icon: "\u{1F6E1}\uFE0F", warn: 30, color: "#EFF6FF", textColor: "#1D4ED8" },
    { type: "Planning Permission", icon: "\u{1F4CB}", warn: 0, color: "#F8FAFC", textColor: "#475569" },
    { type: "Other", icon: "\u{1F4C4}", warn: 0, color: "#F8FAFC", textColor: "#475569" }
  ];
  function getPropDocMeta(type) {
    return PROP_DOC_TYPES.find(function(d) {
      return d.type === type;
    }) || PROP_DOC_TYPES[PROP_DOC_TYPES.length - 1];
  }
  function getDaysUntilExpiry(expiresAt) {
    if (!expiresAt) return null;
    return Math.ceil((new Date(expiresAt) - /* @__PURE__ */ new Date()) / 864e5);
  }
  async function renderPropDocsTab(p) {
    if (!state.propDocs) state.propDocs = {};
    var localDocs = (state.propDocs[p.id] || []).slice();
    var supaFiles = [];
    try {
      var lr = await supa.storage.from("property-docs").list("properties/" + String(p.id), { limit: 50 });
      if (!lr.error && Array.isArray(lr.data)) {
        lr.data.filter(function(f) {
          return f.name && !f.name.startsWith(".");
        }).forEach(function(f) {
          var path = "properties/" + String(p.id) + "/" + f.name;
          var pub = supa.storage.from("property-docs").getPublicUrl(path);
          var url = pub.data ? pub.data.publicUrl : null;
          var local = localDocs.find(function(d) {
            return d.storagePath === path;
          });
          if (local) {
            if (url && !local.dataUrl) local.dataUrl = url;
            return;
          }
          var fsz = f.metadata && f.metadata.size ? f.metadata.size > 1048576 ? (f.metadata.size / 1048576).toFixed(1) + "MB" : Math.round(f.metadata.size / 1024) + "KB" : "";
          var fdt = f.created_at ? new Date(f.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
          supaFiles.push({ id: f.name, name: f.name, type: "Document", size: fsz, uploadedAt: fdt, expiresAt: null, dataUrl: url, storagePath: path, _fromStorage: true });
        });
      }
    } catch (e) {
      console.warn("Property docs list err:", e.message);
    }
    if (supaFiles.length) {
      if (!state.propDocs) state.propDocs = {};
      if (!state.propDocs[p.id]) state.propDocs[p.id] = [];
      supaFiles.forEach(function(sd) {
        if (!state.propDocs[p.id].find(function(d) {
          return d.storagePath === sd.storagePath;
        })) state.propDocs[p.id].push(sd);
      });
    }
    var docs = localDocs.concat(supaFiles);
    docs = docs.slice().sort(function(a, b) {
      var da = a.expiresAt ? getDaysUntilExpiry(a.expiresAt) : 9999;
      var db = b.expiresAt ? getDaysUntilExpiry(b.expiresAt) : 9999;
      return da - db;
    });
    var expiring = docs.filter(function(d) {
      if (!d.expiresAt) return false;
      var days = getDaysUntilExpiry(d.expiresAt);
      return days !== null && days <= 90;
    });
    var html = "";
    if (expiring.length) {
      html += '<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:12px 14px;margin-bottom:14px">';
      html += '<div style="font-size:12px;font-weight:700;color:#C2410C;margin-bottom:8px">\u26A0\uFE0F ' + expiring.length + " document" + (expiring.length === 1 ? "" : "s") + " expiring soon</div>";
      expiring.forEach(function(d) {
        var days = getDaysUntilExpiry(d.expiresAt);
        var col = days < 0 ? "#DC2626" : days <= 30 ? "#EA580C" : "#D97706";
        html += '<div style="font-size:12px;color:var(--text);display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #FED7AA"><span>' + d.type + '</span><span style="font-weight:700;color:' + col + '">' + (days < 0 ? "Expired " + Math.abs(days) + "d ago" : days === 0 ? "Expires today" : "Expires in " + days + "d") + "</span></div>";
      });
      html += "</div>";
    }
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Upload Document</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    html += '<div><label style="font-size:11px;color:var(--muted);font-weight:600">Document Type</label><select class="inp" id="pdoc-type-' + p.id + '" style="margin-top:4px">' + PROP_DOC_TYPES.map(function(dt) {
      return "<option>" + dt.type + "</option>";
    }).join("") + "</select></div>";
    html += '<div><label style="font-size:11px;color:var(--muted);font-weight:600">Expiry Date</label><input type="date" class="inp" id="pdoc-expires-' + p.id + '" style="margin-top:4px"></div>';
    html += "</div>";
    html += '<input type="file" id="pvault-input-' + p.id + `" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="uploadPropDocFromInput(this)"><button onclick="document.getElementById('pvault-input-` + p.id + `').click()" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px dashed var(--accent);background:var(--accent-light);cursor:pointer;width:100%;font-family:inherit;text-align:left"><span style="font-size:20px">\u{1F4CE}</span><div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">Choose File</div><div style="font-size:11px;color:var(--muted)">PDF, JPG, PNG \xB7 max 20MB</div></div></button>`;
    html += "</div>";
    if (!docs.length) {
      html += '<div style="text-align:center;padding:32px;color:var(--dim);font-size:13px">\u{1F4C2} No documents uploaded yet</div>';
    } else {
      docs.forEach(function(doc) {
        var meta = getPropDocMeta(doc.type);
        var days = doc.expiresAt ? getDaysUntilExpiry(doc.expiresAt) : null;
        var expiryBadge = "";
        if (days !== null) {
          var col = days < 0 ? "#DC2626" : days <= 30 ? "#EA580C" : days <= 90 ? "#D97706" : "#059669";
          var bg = days < 0 ? "#FEE2E2" : days <= 30 ? "#FFF7ED" : days <= 90 ? "#FFFBEB" : "#DCFCE7";
          var txt = days < 0 ? "Expired" : days === 0 ? "Today!" : days <= 30 ? days + "d left" : days <= 90 ? days + "d left" : "Valid";
          expiryBadge = '<span style="font-size:10px;font-weight:700;color:' + col + ";background:" + bg + ';padding:2px 8px;border-radius:6px">\u23F0 ' + txt + "</span>";
        }
        html += '<div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid ' + (days !== null && days <= 30 ? "#FECDD3" : days !== null && days <= 90 ? "#FED7AA" : "var(--border)") + ';border-radius:10px;padding:11px 13px;margin-bottom:8px"><div style="width:38px;height:38px;border-radius:9px;background:' + meta.color + ';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">' + meta.icon + '</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + doc.name + '</div><div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap"><span style="font-size:10px;font-weight:700;color:' + meta.textColor + ";background:" + meta.color + ';padding:1px 7px;border-radius:5px">' + doc.type + '</span><span style="font-size:10px;color:var(--muted)">' + doc.size + " \xB7 " + doc.uploadedAt + "</span>" + (doc.expiresAt ? '<span style="font-size:10px;color:var(--muted)">Exp: ' + new Date(doc.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + "</span>" : "") + expiryBadge + '</div></div><div style="display:flex;gap:5px;flex-shrink:0">' + (doc.dataUrl ? '<a href="' + doc.dataUrl + '" download="' + doc.name + '" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--blue);text-decoration:none">\u2193</a>' : "") + `<button onclick="removePropDoc('+p.id+','+doc.id+')" style="padding:5px 9px;border-radius:7px;border:1px solid #FECDD3;background:#FFF1F2;font-size:11px;font-weight:700;color:#E11D48;cursor:pointer;font-family:inherit">&#x2715;</button></div></div>`;
      });
    }
    return html;
  }
  function uploadPropDocFromInput(input) {
    uploadPropDoc(input.id.replace("pvault-input-", ""), input);
  }
  async function uploadPropDoc(propId, input) {
    if (!state.propDocs) state.propDocs = {};
    if (!state.propDocs[propId]) state.propDocs[propId] = [];
    var typeEl = document.getElementById("pdoc-type-" + propId);
    var expEl = document.getElementById("pdoc-expires-" + propId);
    var docType = typeEl ? typeEl.value : "Other";
    var expiresAt = expEl ? expEl.value : "";
    var files = Array.from(input.files);
    if (!files.length) return;
    for (var fi = 0; fi < files.length; fi++) {
      var file = files[fi];
      if (file.size > 20 * 1024 * 1024) {
        showToast(file.name + " exceeds 20MB.", "error");
        continue;
      }
      var sizeStr = file.size > 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(1) + "MB" : Math.round(file.size / 1024) + "KB";
      var now = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      var docId = "pdoc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      var ext = file.name.split(".").pop().toLowerCase();
      var path = "properties/" + String(propId) + "/" + docId + "." + ext;
      showToast("Uploading\u2026", "success");
      var entry = { id: docId, name: file.name, type: docType, size: sizeStr, uploadedAt: now, expiresAt: expiresAt || null, dataUrl: null, storagePath: null };
      state.propDocs[propId].push(entry);
      try {
        var up = await supa.storage.from("property-docs").upload(path, file, { upsert: true });
        if (up.error) throw up.error;
        var pub = supa.storage.from("property-docs").getPublicUrl(path);
        if (pub.data && pub.data.publicUrl) {
          entry.dataUrl = pub.data.publicUrl;
          entry.storagePath = path;
        } else {
          var sig = await supa.storage.from("property-docs").createSignedUrl(path, 31536e3);
          if (sig.error || !sig.data || !sig.data.signedUrl) throw new Error("Cannot get URL \u2014 check storage policy");
          entry.dataUrl = sig.data.signedUrl;
          entry.storagePath = path;
        }
        showToast(file.name + " uploaded \u2713", "success");
      } catch (err) {
        console.warn("Storage failed, using base64:", err.message);
        try {
          entry.dataUrl = await new Promise(function(res, rej) {
            var r = new FileReader();
            r.onload = function(e) {
              res(e.target.result);
            };
            r.onerror = rej;
            r.readAsDataURL(file);
          });
          entry.storagePath = null;
          showToast(file.name + " saved locally", "success");
        } catch (e2) {
          showToast("Upload failed: " + err.message, "error");
          state.propDocs[propId] = state.propDocs[propId].filter(function(d) {
            return d.id !== docId;
          });
          continue;
        }
      }
      saveState();
    }
    input.value = "";
    state.propDetailTab = "docs";
    openPropDetail(propId);
  }
  function removePropDoc(propId, docId) {
    if (!state.propDocs || !state.propDocs[propId]) return;
    var doc = state.propDocs[propId].find(function(d) {
      return d.id === docId;
    });
    if (doc && doc.storagePath) supa.storage.from("property-docs").remove([doc.storagePath]).catch(function() {
    });
    state.propDocs[propId] = state.propDocs[propId].filter(function(d) {
      return d.id !== docId;
    });
    saveState();
    state.propDetailTab = "docs";
    openPropDetail(propId);
  }
  if (typeof window !== "undefined") {
    window.badge = badge;
    window.kpi = kpi;
    window.btn = btn;
    window.waLink = waLink;
    window.waBtn = waBtn;
    window.getStats = getStats;
    window.can = can;
    window.canSee = canSee;
    window.switchUser = switchUser;
    window.getPortalUsername = getPortalUsername;
    window.getPortalPassword = getPortalPassword;
    window.resetPortalPassword = resetPortalPassword;
    window.ensurePortalCredentials = ensurePortalCredentials;
    window.setAppBootMessage = setAppBootMessage;
    window.hideAppBootOverlay = hideAppBootOverlay;
    window.normalizeRole = normalizeRole;
    window.isPaidPlanForCheckout = isPaidPlanForCheckout;
    window.getStripeResultFromUrl = getStripeResultFromUrl;
    window.needsPaidCheckoutGate = needsPaidCheckoutGate;
    window.upsertSessionUser = upsertSessionUser;
    window.showTrialExpired = showTrialExpired;
    window.showAccountInactive = showAccountInactive;
    window.showCheckoutRequired = showCheckoutRequired;
    window.rowToLandlord = rowToLandlord;
    window.rowToProp = rowToProp;
    window.rowToTenant = rowToTenant;
    window.rowToPayment = rowToPayment;
    window.rowToExpense = rowToExpense;
    window.rowToMaintenance = rowToMaintenance;
    window.rowToLandlordPayment = rowToLandlordPayment;
    window.rowToContractor = rowToContractor;
    window.contractorToRow = contractorToRow;
    window.landlordToRow = landlordToRow;
    window.propToRow = propToRow;
    window.tenantToRow = tenantToRow;
    window.paymentToRow = paymentToRow;
    window.expenseToRow = expenseToRow;
    window.maintenanceToRow = maintenanceToRow;
    window.landlordPaymentToRow = landlordPaymentToRow;
    window.renderNav = renderNav;
    window.quickSetDueDay = quickSetDueDay;
    window._parseRoomEid = _parseRoomEid;
    window.handleRoomPhotoChange = handleRoomPhotoChange;
    window.handleRoomVideoChange = handleRoomVideoChange;
    window.toggleRoomAvailByEid = toggleRoomAvailByEid;
    window.saveRoomNotesByEid = saveRoomNotesByEid;
    window.shareRoomWAByEid = shareRoomWAByEid;
    window.removeRoomPhotoByEid = removeRoomPhotoByEid;
    window.removeRoomVideoByEid = removeRoomVideoByEid;
    window.removeRoomPhotoBtn = removeRoomPhotoBtn;
    window.removeRoomVideoBtn = removeRoomVideoBtn;
    window.handlePhotoUploadBtn = handlePhotoUploadBtn;
    window.handleVideoUploadBtn = handleVideoUploadBtn;
    window.shareRoomWABtn = shareRoomWABtn;
    window.saveRoomNotesBtn = saveRoomNotesBtn;
    window.goto = goto;
    window.render = render;
    window.getMonthStats = getMonthStats;
    window.showChartTip = showChartTip;
    window.hideChartTip = hideChartTip;
    window.renderDashboard = renderDashboard;
    window.renderProperties = renderProperties;
    window.renderTenants = renderTenants;
    window.getDueDateObj = getDueDateObj;
    window.getDueDate = getDueDate;
    window.getDueStatus = getDueStatus;
    window.getRentTab = getRentTab;
    window.getPeriodDates = getPeriodDates;
    window.getFullPaymentPool = getFullPaymentPool;
    window.renderRentRow = renderRentRow;
    window.calcLateFee = calcLateFee;
    window.togglePaymentMethod = togglePaymentMethod;
    window.openLateFeeSettings = openLateFeeSettings;
    window.saveLateFeeSettings = saveLateFeeSettings;
    window.bulkChaseOverdue = bulkChaseOverdue;
    window.shareCashCollections = shareCashCollections;
    window.setRentPeriod = setRentPeriod;
    window.setRentTab = setRentTab;
    window.setRentTabBtn = setRentTabBtn;
    window.setRentPeriodBtn = setRentPeriodBtn;
    window.setImportTab = setImportTab;
    window.toggleUserStatusBtn = toggleUserStatusBtn;
    window.switchUserBtn = switchUserBtn;
    window.renderRent = renderRent;
    window.renderExpenses = renderExpenses;
    window.renderMaintenance = renderMaintenance;
    window.getNextPayDate = getNextPayDate;
    window.dateToStr = dateToStr;
    window.generateSchedule = generateSchedule;
    window.rebuildAllSchedules = rebuildAllSchedules;
    window.rebuildTenantSchedule = rebuildTenantSchedule;
    window.markSchedulePaid = markSchedulePaid;
    window.markPartialPaid = markPartialPaid;
    window.confirmPartialPaid = confirmPartialPaid;
    window.markPaid = markPaid;
    window.recalcProperty = recalcProperty;
    window.freeRoom = freeRoom;
    window.occupyRoom = occupyRoom;
    window.deleteMaintenanceJob = deleteMaintenanceJob;
    window.updMaint = updMaint;
    window.confirmExp = confirmExp;
    window.removeExp = removeExp;
    window.editExpModal = editExpModal;
    window.saveExpEdit = saveExpEdit;
    window.renderTenantDueDaySection = renderTenantDueDaySection;
    window.updateTenantDueDaySection = updateTenantDueDaySection;
    window.pdSetOwnership = pdSetOwnership;
    window.pdSetLetting = pdSetLetting;
    window.setPropOwnership = setPropOwnership;
    window.setPropLetting = setPropLetting;
    window.toggleNewLandlordFields = toggleNewLandlordFields;
    window.refreshMaintRoomDropdown = refreshMaintRoomDropdown;
    window.refreshMaintTenantInfo = refreshMaintTenantInfo;
    window.previewMaintModalPhoto = previewMaintModalPhoto;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.debouncedTenantSearch = debouncedTenantSearch;
    window.debouncedPropSearch = debouncedPropSearch;
    window.onFreqChange = onFreqChange;
    window.refreshRoomDropdown = refreshRoomDropdown;
    window.saveModal = saveModal;
    window.saveTenantDetail = saveTenantDetail;
    window.doMoveRoom = doMoveRoom;
    window.generatePortalPassword = generatePortalPassword;
    window.giveTenantNotice = giveTenantNotice;
    window.cancelTenantNotice = cancelTenantNotice;
    window.moveTenantToRoom = moveTenantToRoom;
    window.moveTenantOut = moveTenantOut;
    window.openEditMaintModal = openEditMaintModal;
    window.saveEditMaint = saveEditMaint;
    window.previewMaintInvoice = previewMaintInvoice;
    window.addMaintExtraPhotos = addMaintExtraPhotos;
    window.removeMaintExtraPhoto = removeMaintExtraPhoto;
    window.clearPendingInvoicePreview = clearPendingInvoicePreview;
    window.clickMaintInvInput = clickMaintInvInput;
    window.clickMaintPhotosInput = clickMaintPhotosInput;
    window.clearMaintInvoice = clearMaintInvoice;
    window.openEditPaymentModal = openEditPaymentModal;
    window.saveEditPayment = saveEditPayment;
    window.revertPayment = revertPayment;
    window.renderPropertiesDealView = renderPropertiesDealView;
    window._dealSaveInputsToScratch = _dealSaveInputsToScratch;
    window.recalcDealPage = recalcDealPage;
    window.propViewList = propViewList;
    window.propViewDeal = propViewDeal;
    window.switchRentPeriod = switchRentPeriod;
    window.switchLettingType = switchLettingType;
    window.switchDealType = switchDealType;
    window.resetDealPage = resetDealPage;
    window.saveDealScenario = saveDealScenario;
    window.loadDealScenario = loadDealScenario;
    window.deleteDealScenario = deleteDealScenario;
    window.renderPropFinanceTab = renderPropFinanceTab;
    window.archiveProperty = archiveProperty;
    window.deletePropPermanent = deletePropPermanent;
    window.restoreProperty = restoreProperty;
    window.archiveTenant = archiveTenant;
    window.deleteTenantPermanent = deleteTenantPermanent;
    window.restoreTenant = restoreTenant;
    window.savePropDetail = savePropDetail;
    window.updateRoomPrice = updateRoomPrice;
    window.updateRoomType = updateRoomType;
    window.toggleRoomStatus = toggleRoomStatus;
    window.addRoomToProp = addRoomToProp;
    window.markLandlordPaid = markLandlordPaid;
    window.ensureLandlordSchedule = ensureLandlordSchedule;
    window.renderLandlords = renderLandlords;
    window.openAddLandlordModal = openAddLandlordModal;
    window.saveNewLandlord = saveNewLandlord;
    window.deleteLandlord = deleteLandlord;
    window.openLandlordDetail = openLandlordDetail;
    window.saveLandlordDetail = saveLandlordDetail;
    window.getPostcode = getPostcode;
    window.registerMedia = registerMedia;
    window.getMediaByElem = getMediaByElem;
    window.getMedia = getMedia;
    window.buildGalleryUrl = buildGalleryUrl;
    window.stripHouseNo = stripHouseNo;
    window.shareRoomWA = shareRoomWA;
    window.shareAllRoomsWA = shareAllRoomsWA;
    window.renderRooms = renderRooms;
    window.renderImport = renderImport;
    window.renderImportProperties = renderImportProperties;
    window.renderImportTenants = renderImportTenants;
    window.cleanPhone = cleanPhone;
    window.cleanPostcode = cleanPostcode;
    window.cleanPropertyName = cleanPropertyName;
    window.hasPropCode = hasPropCode;
    window.handlePropertiesFile = handlePropertiesFile;
    window.deriveArea = deriveArea;
    window.handleTenantsFile = handleTenantsFile;
    window.parseDate = parseDate;
    window.parseCSVLine = parseCSVLine;
    window.confirmImportProperties = confirmImportProperties;
    window.confirmImportTenants = confirmImportTenants;
    window.renderUsers = renderUsers;
    window.updateUserRole = updateUserRole;
    window.toggleRolePage = toggleRolePage;
    window.toggleRolePerm = toggleRolePerm;
    window.toggleUserStatus = toggleUserStatus;
    window.openAddUserModal = openAddUserModal;
    window.saveNewUser = saveNewUser;
    window.getVoidDays = getVoidDays;
    window.renderComplianceWidget = renderComplianceWidget;
    window.renderDepositSummary = renderDepositSummary;
    window.renderVoidTracker = renderVoidTracker;
    window.generateAgreement = generateAgreement;
    window.closeAgreement = closeAgreement;
    window.generateExcludedLicence = generateExcludedLicence;
    window.clearSignature = clearSignature;
    window.saveRoomNotes = saveRoomNotes;
    window.removeRoomVideo = removeRoomVideo;
    window.openDataModal = openDataModal;
    window._renderDataModal = _renderDataModal;
    window._dmBrowse = _dmBrowse;
    window._dmDrop = _dmDrop;
    window._dmPickFile = _dmPickFile;
    window._dmProcessFile = _dmProcessFile;
    window._dmParseRows = _dmParseRows;
    window._dmExport = _dmExport;
    window._dmTemplate = _dmTemplate;
    window.exportData = exportData;
    window.importData = importData;
    window.buildPortfolioSnapshot = buildPortfolioSnapshot;
    window.renderAgentKeyPrompt = renderAgentKeyPrompt;
    window.renderAgentLoading = renderAgentLoading;
    window.renderAgentError = renderAgentError;
    window.renderAgentResult = renderAgentResult;
    window.analyzeLocalDeal = analyzeLocalDeal;
    window.renderLocalDealOutput = renderLocalDealOutput;
    window.runLocalDealAnalysis = runLocalDealAnalysis;
    window.runLocalPortfolioAnalysis = runLocalPortfolioAnalysis;
    window.renderDashboardAgent = renderDashboardAgent;
    window.gsSearch = gsSearch;
    window.gsKey = gsKey;
    window.gsGo = gsGo;
    window.renderReports = renderReports;
    window.renderReportPL = renderReportPL;
    window.renderReportArrears = renderReportArrears;
    window.renderReportCashFlow = renderReportCashFlow;
    window.renderReportForecast = renderReportForecast;
    window.exportReportCSV = exportReportCSV;
    window.saveState = saveState;
    window.showToast = showToast;
    window.friendlyDbSaveError = friendlyDbSaveError;
    window.getEmailConfig = getEmailConfig;
    window.renderEmailSettings = renderEmailSettings;
    window.saveEmailField = saveEmailField;
    window.toggleEmailTrigger = toggleEmailTrigger;
    window.previewEmailForTenant = previewEmailForTenant;
    window.getCompanyEmailContext = getCompanyEmailContext;
    window.maybeStartCheckoutFromQuery = maybeStartCheckoutFromQuery;
    window.renderSettings = renderSettings;
    window.uploadLogo = uploadLogo;
    window.removeLogo = removeLogo;
    window.saveBranding = saveBranding;
    window.openAddCompanyModal = openAddCompanyModal;
    window.openEditCompanyModal = openEditCompanyModal;
    window.saveNewCompany = saveNewCompany;
    window.saveEditCompany = saveEditCompany;
    window.deleteCompany = deleteCompany;
    window.openInviteUserModal = openInviteUserModal;
    window.editUserModal = editUserModal;
    window.saveEditUser = saveEditUser;
    window.updateUserRoleByEl = updateUserRoleByEl;
    window.previewDoc = previewDoc;
    window.openContractorProfile = openContractorProfile;
    window.openAddContractorModal = openAddContractorModal;
    window.openEditContractorModal = openEditContractorModal;
    window.saveContractor = saveContractor;
    window.deleteContractor = deleteContractor;
    window.sendToContractorModal = sendToContractorModal;
    window.markContractorUsed = markContractorUsed;
    window.shareMaintWA = shareMaintWA;
    window.shareAllMaintWA = shareAllMaintWA;
    window.shareAllPropDocs = shareAllPropDocs;
    window.clearSavedState = clearSavedState;
    window.runAfterSupabaseLoad = runAfterSupabaseLoad;
    window.getPropDocMeta = getPropDocMeta;
    window.getDaysUntilExpiry = getDaysUntilExpiry;
    window.uploadPropDocFromInput = uploadPropDocFromInput;
    window.removePropDoc = removePropDoc;
    window.fetchAiMessages = fetchAiMessages;
    window.refreshOrgBillingState = refreshOrgBillingState;
    window.mergeOrgEmailSettingsIfAvailable = mergeOrgEmailSettingsIfAvailable;
    window.syncUsersFromOrgMembers = syncUsersFromOrgMembers;
    window.resolveOrg = resolveOrg;
    window.supaDelete = supaDelete;
    window.openTenantDetail = openTenantDetail;
    window.openPropDetail = openPropDetail;
    window.runDealAI = runDealAI;
    window.syncRoomPhotosBackground = syncRoomPhotosBackground;
    window.handlePhotoUpload = handlePhotoUpload;
    window.removeRoomPhoto = removeRoomPhoto;
    window.handleVideoUpload = handleVideoUpload;
    window.uploadTenantDoc = uploadTenantDoc;
    window._dmConfirmImport = _dmConfirmImport;
    window.runAIAgent = runAIAgent;
    window._supaUpsert = _supaUpsert;
    window._doSupaSave = _doSupaSave;
    window.loadState = loadState;
    window.backfillPaymentDueDates = backfillPaymentDueDates;
    window.doLogOut = doLogOut;
    window.persistEmailSettings = persistEmailSettings;
    window.sendEmail = sendEmail;
    window.sendTestEmail = sendTestEmail;
    window.runRentReminderEmails = runRentReminderEmails;
    window.sendScheduledReport = sendScheduledReport;
    window.startStripeCheckout = startStripeCheckout;
    window.openStripeBillingPortal = openStripeBillingPortal;
    window.sendInvite = sendInvite;
    window.deleteUserBtn = deleteUserBtn;
    window.renderPropDocsTab = renderPropDocsTab;
    window.uploadPropDoc = uploadPropDoc;
  }

  // entry.js
  if (typeof window !== "undefined") window.state = state;
})();
