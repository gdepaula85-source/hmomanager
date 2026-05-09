// ── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Detect whether the user is on a mobile device. WhatsApp's mobile clients
 * (iOS / Android) and the WhatsApp Desktop app render 4-byte UTF-8 emojis
 * correctly. Only WhatsApp Web running in a desktop browser mangles them to
 * � replacement chars. We use this flag at wa.me-link click time to decide
 * whether to ship a rich (with emojis) or sanitised (text-only) message.
 *
 * Heuristic: classic User-Agent sniff. Conservative — false-positives mean
 * the user gets text-only on a mobile device which is still readable;
 * false-negatives mean they get emojis on desktop which mangle. We accept
 * the former. iPad's UA can mimic desktop Safari, so we also check for
 * touch as a backup.
 */
function _waIsMobile() {
  if (typeof navigator === 'undefined') return false;
  var ua = String(navigator.userAgent || '');
  if (/Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return true;
  // iPad on iOS 13+ reports as MacIntel — distinguish via touch support.
  if (ua.indexOf('Mac') !== -1 && navigator.maxTouchPoints && navigator.maxTouchPoints > 1) return true;
  return false;
}
if (typeof window !== 'undefined') window._waIsMobile = _waIsMobile;

/**
 * Returns the supplied emoji on mobile, empty string on desktop. Use this
 * when adding emoji decorations to outbound wa.me messages so the same code
 * path produces a rich message on mobile and a clean text message on desktop.
 *
 * Tip: include any trailing space INSIDE the emoji argument so the desktop
 * fallback collapses cleanly with no orphan whitespace, e.g.:
 *   msg += _waEmoji('🔧 ') + '*OPEN MAINTENANCE*';
 */
function _waEmoji(emoji) {
  return _waIsMobile() ? String(emoji || '') : '';
}
if (typeof window !== 'undefined') window._waEmoji = _waEmoji;

/**
 * Sanitise text for outbound WhatsApp messages (wa.me click-to-chat).
 *
 * On mobile (where every emoji renders correctly) this is a passthrough —
 * user-typed content keeps its emojis intact.
 *
 * On desktop (where WhatsApp Web mangles 4-byte UTF-8 to �) we strip
 * 4-byte sequences and the VS-16 selector entirely, leaving only ASCII +
 * BMP text and box-drawing chars. The message arrives readable everywhere.
 */
function _waSanitize(text) {
  if (text == null) return '';
  if (_waIsMobile()) return String(text);
  return String(text)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF][ \t]?/g, '')
    .replace(/️/g, '')
    .replace(/[ \t][ \t]+/g, ' ');
}
if (typeof window !== 'undefined') window._waSanitize = _waSanitize;


/**
 * Format a number as a currency amount.
 * Reads currency_symbol from state._currentOrg at call time — falls back to '£'.
 * This means the symbol updates instantly after saveCurrencyLanguage() calls render().
 */
const fmt = function(n) {
  var sym = (typeof state !== 'undefined' && state && state._currentOrg && state._currentOrg.currency_symbol)
    ? state._currentOrg.currency_symbol : '£';
  return sym + Math.round(Number(n) || 0).toLocaleString('en-GB');
};

/**
 * Format a date string using the org's date_format preference.
 * Reads date_format from state._currentOrg at call time — falls back to 'DD/MM/YYYY'.
 * Supports: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD MMM YYYY, DD-MM-YYYY
 * @param {string|Date} dateStr  ISO string, YYYY-MM-DD, or Date object
 * @param {string=}     override Optional format string to override org setting
 */
function formatDate(dateStr, override) {
  if (dateStr == null || dateStr === '') return '';
  var d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  var pattern = override ||
    ((typeof state !== 'undefined' && state && state._currentOrg && state._currentOrg.date_format)
      ? state._currentOrg.date_format : 'DD/MM/YYYY');
  var day   = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var year  = String(d.getFullYear());
  // Replace MMM before MM to avoid double-replacement
  var monthShort = d.toLocaleDateString('en-GB', { month: 'short' });
  return pattern
    .replace('DD', day)
    .replace('MMM', monthShort)
    .replace('MM', month)
    .replace('YYYY', year);
}

const pct = (a,b) => b ? Math.round(a/b*100) : 0;

/** Escape user-supplied strings before inserting into innerHTML to prevent XSS. */
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/**
 * Build an org-scoped localStorage key when org context exists.
 * This prevents data from one org/account being read by another in the same browser.
 */
function orgStorageKey(baseKey) {
  var hasOrg = typeof _currentOrgId !== 'undefined' && !!_currentOrgId;
  return hasOrg ? (String(baseKey) + '_' + String(_currentOrgId)) : String(baseKey);
}

/** Compare room indices from UI / DB (string vs number safe). */
function roomNumsEqual(a, b) {
  return Number(a) === Number(b);
}

/** Map room / tenant type labels to tenants page KPI keys (Single, Double, …). Always returns one of the five canonical keys. */
function normalizeTenantRoomTypeKey(raw) {
  var CANON = ['Single', 'Double', 'Suite', 'Studio', 'Whole House'];
  if (raw == null || raw === '') return 'Single';
  var s = String(raw).trim();
  s = s.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
  if (!s) return 'Single';
  var lower = s.toLowerCase();
  var byLower = {
    room: 'Single', single: 'Single', double: 'Double', suite: 'Suite', studio: 'Studio',
    'whole property': 'Whole House', 'whole house': 'Whole House',
  };
  if (byLower[lower]) return byLower[lower];
  var w0 = lower.split(/\s+/)[0];
  if (byLower[w0]) return byLower[w0];
  var map = {
    Room: 'Single', Single: 'Single', Double: 'Double', Suite: 'Suite', Studio: 'Studio',
    'Whole Property': 'Whole House', 'Whole House': 'Whole House',
  };
  if (map[s]) return map[s];
  if (CANON.indexOf(s) >= 0) return s;
  return 'Single';
}

function isPaidStatus(v) {
  return String(v || '').toLowerCase() === 'paid';
}

function isPropertyActive(p) {
  return !!(p && p.status !== 'archived');
}

/** Tenant's property is not archived (for KPIs / rent roll). */
function tenantOnLiveProperty(t) {
  if (!t || !t.property) return false;
  var pr = (state.properties || []).find(function(p) { return p.name === t.property; });
  return !pr || pr.status !== 'archived';
}

/** Single source of truth for "this tenant should contribute to monthly rent income".
 * Active OR on-notice tenants pay rent; pending_review and inactive don't.
 * Used by recalcProperty + dashboard expectedIncome so the two pages can't disagree. */
function isBillableTenant(t) {
  if (!t) return false;
  if (t.status !== 'active' && t.status !== 'notice_given') return false;
  return tenantOnLiveProperty(t);
}

/** Convert a tenant's rent to monthly £. Weekly rents → ×52/12. */
function tenantMonthlyRent(t) {
  if (!t) return 0;
  return (t.freq === 'monthly') ? (+t.rent || 0) : Math.round(((+t.rent || 0) * 52) / 12);
}

/** Property assigned in DB/UI to this landlord — prefer UUID landlord_id; fall back to case‑trimmed name match. */
function propertyLinkedToLandlord(p, ll) {
  if (!p || !ll) return false;
  if (ll.id != null && p.landlordId != null && String(p.landlordId) === String(ll.id)) return true;
  var a = String(p.landlordName || '').trim().toLowerCase();
  var b = String(ll.name || '').trim().toLowerCase();
  return a !== '' && b !== '' && a === b;
}
/** Monthly STR/SA income for a property — uses the most recent month with any
 *  SA payment (falls back to 0 if none). Keeps the property card in sync with
 *  what the owner actually sees on the Finance tab. */
function getPropStrMonthlyIncome(p){
  if(!p || !p.isStrEnabled) return 0;
  var pays = (state.payments||[]).filter(function(py){
    return py.propertyId === p.id && py.incomeSource === 'airbnb';
  });
  if(!pays.length) return 0;
  // Group by YYYY-MM (prefer periodStart; fall back to paidDate).
  var byMonth = {};
  pays.forEach(function(py){
    var d = py.periodStart || '';
    if(!d && py.paidDate){
      var parts = String(py.paidDate).split(' ');
      var months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
      if(parts.length===3 && months[parts[1]]!==undefined){
        d = parts[2]+'-'+String(months[parts[1]]+1).padStart(2,'0')+'-01';
      }
    }
    if(!d) return;
    var key = String(d).slice(0,7); // YYYY-MM
    byMonth[key] = (byMonth[key]||0) + (+py.amount || 0);
  });
  var keys = Object.keys(byMonth).sort();
  if(!keys.length) return 0;
  return byMonth[keys[keys.length-1]]; // latest month with SA income
}

/** True when an SA-enabled property has any recent SA income (last 60 days).
 *  Used for property-card occupancy so SA-active properties aren't shown as 0%. */
function isPropStrActive(p){
  if(!p || !p.isStrEnabled) return false;
  var pays = (state.payments||[]).filter(function(py){
    return py.propertyId === p.id && py.incomeSource === 'airbnb';
  });
  if(!pays.length) return false;
  var cutoff = Date.now() - 60*86400000;
  return pays.some(function(py){
    var d = py.periodEnd || py.periodStart;
    if(!d) return true; // date missing — assume recent
    var ts = new Date(d).getTime();
    return !isNaN(ts) && ts >= cutoff;
  });
}

// Net profit per property — tenant rent + SA income minus landlord rent.
const net = p => (p.rent||0) + getPropStrMonthlyIncome(p) - (p.landlord||0);

/** Compliance snapshot for a property.
 *  Looks at state.propDocs[pid] for Gas, EICR, EPC, HMO Licence documents and
 *  evaluates their expiresAt against today. Returns:
 *    { level:'critical'|'warning'|'ok'|'missing',
 *      count: <total issues>,
 *      items: [{label, days, state}]  — sorted by urgency }
 *  `missing` = no docs uploaded at all. `critical` = expired / expires ≤30d.
 *  `warning` = 31–90d. `ok` = everything >90d. */
function getPropertyComplianceStatus(p) {
  if (!p) return { level: 'missing', count: 0, items: [] };
  var CORE = ['Gas Safety Certificate', 'Electrical Certificate (EICR)', 'EPC', 'HMO Licence'];
  var docs = (state.propDocs && state.propDocs[p.id]) || [];
  var items = [];
  CORE.forEach(function(type) {
    var matches = docs.filter(function(d) { return d.type === type; });
    if (!matches.length) {
      items.push({ label: type, days: null, state: 'missing' });
      return;
    }
    // Use the doc with the *latest* expiry (most recent cert for this type).
    var latest = matches.reduce(function(a, b) {
      var da = a.expiresAt ? new Date(a.expiresAt).getTime() : 0;
      var db = b.expiresAt ? new Date(b.expiresAt).getTime() : 0;
      return db > da ? b : a;
    });
    if (!latest.expiresAt) {
      items.push({ label: type, days: null, state: 'no-date' });
      return;
    }
    var days = Math.ceil((new Date(latest.expiresAt) - new Date()) / 86400000);
    var st = days < 0 ? 'expired' : days <= 30 ? 'critical' : days <= 90 ? 'warning' : 'ok';
    items.push({ label: type, days: days, state: st });
  });
  items.sort(function(a, b) {
    var order = { expired: 0, critical: 1, warning: 2, missing: 3, 'no-date': 4, ok: 5 };
    return (order[a.state] || 9) - (order[b.state] || 9);
  });
  var hasCritical = items.some(function(i) { return i.state === 'expired' || i.state === 'critical'; });
  var hasWarning  = items.some(function(i) { return i.state === 'warning'; });
  var hasMissing  = items.some(function(i) { return i.state === 'missing'; });
  var level = hasCritical ? 'critical' : hasWarning ? 'warning' : hasMissing ? 'missing' : 'ok';
  var count = items.filter(function(i) { return i.state !== 'ok' && i.state !== 'no-date'; }).length;
  return { level: level, count: count, items: items };
}

const BADGE_COLORS = {
  active:['#10B981','#ECFDF5'], notice_given:['#F59E0B','#FFFBEB'],
  paid:['#10B981','#ECFDF5'], outstanding:['#E8375A','#FEF0F3'],
  open:['#E8375A','#FEF0F3'], in_progress:['#F59E0B','#FFFBEB'], resolved:['#10B981','#ECFDF5'],
  confirmed:['#10B981','#ECFDF5'], estimated:['#F59E0B','#FFFBEB'],
  urgent:['#E8375A','#FEF0F3'], medium:['#F59E0B','#FFFBEB'], low:['#94A3B8','#F1F5F9'],
  bank:['#3B82F6','#EFF6FF'], cash:['#F59E0B','#FFFBEB'],
  Loss:['#E8375A','#FEF0F3'], Active:['#10B981','#ECFDF5'], Notice:['#F59E0B','#FFFBEB'],
};
function badge(label, override) {
  const clean = String(label).replace('_',' ');
  const key = label;
  const [c,bg] = override || BADGE_COLORS[key] || ['#64748B','#F1F5F9'];
  return `<span class="badge" style="color:${c};background:${bg}">${clean}</span>`;
}

function kpi(label, value, sub, color, icon) {
  return `<div class="kpi">
    <div class="kpi-accent-bar" style="background:${color}"></div>
    <div class="kpi-icon" style="background:${color}15">${icon||'📊'}</div>
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${sub?`<div class="kpi-sub">${sub}</div>`:''}
  </div>`;
}

function btn(label, onclick, variant='primary', sm=false) {
  return `<button class="btn btn-${variant}${sm?' btn-sm':''}" onclick="${onclick}">${label}</button>`;
}

function waLink(number, message='') {
  const clean = String(number || '').replace(/\D/g,'');
  const msg = encodeURIComponent(message);
  return `https://wa.me/${clean}${msg?'?text='+msg:''}`;
}

function waBtn(number, message, label='WhatsApp') {
  if(!number) return '<span style="font-size:11px;color:var(--dim)">No number</span>';
  return `<a href="${waLink(number,message)}" target="_blank" class="wa-btn">💬 ${label}</a>`;
}

function getStats() {
  const props = (state.properties||[]).filter(isPropertyActive);
  const income = props.reduce((s,p)=>s+p.rent,0);
  const landlord = props.reduce((s,p)=>s+p.landlord,0);
  const opex = state.expenses.reduce((s,e)=>s+e.amount,0);
  const rooms = props.reduce((s,p)=>s+p.rooms,0);
  const occ = props.reduce((s,p)=>s+p.occupied,0);
  const paid = state.payments.filter(p=>p.status==='paid');
  const owed = state.payments.filter(p=>p.status==='outstanding');
  const openM = state.maintenance.filter(m=>m.status!=='resolved');
  return {income,landlord,opex,profit:income-landlord-opex,rooms,occ,paid,owed,openM};
}

/** Occupied room slots / total rooms — same basis as sidebar & property KPIs. `displayPct` capped 0–100 for UI. */
function getPortfolioOccupancyUi(propList) {
  var props = propList || (state.properties || []).filter(isPropertyActive);
  var totalRooms = props.reduce(function(s, p) { return s + (Number(p.rooms) || 0); }, 0);
  var occupiedRooms = props.reduce(function(s, p) { return s + (Number(p.occupied) || 0); }, 0);
  var raw = totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  return {
    occupiedRooms: occupiedRooms,
    totalRooms: totalRooms,
    displayPct: Math.min(100, Math.max(0, raw)),
  };
}

/** Local calendar YYYY-MM-DD. Never use Date#toISOString() for due dates — UTC shifts the day in BST and breaks schedule ↔ payment matching after reload. */
function formatLocalDateISO(d) {
  var x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return '';
  var y = x.getFullYear();
  var m = String(x.getMonth() + 1).padStart(2, '0');
  var day = String(x.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
