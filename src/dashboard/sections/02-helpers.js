// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = n => '£' + Math.round(Number(n)||0).toLocaleString('en-GB');
const pct = (a,b) => b ? Math.round(a/b*100) : 0;

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

/** Property assigned in DB/UI to this landlord — prefer UUID landlord_id; fall back to case‑trimmed name match. */
function propertyLinkedToLandlord(p, ll) {
  if (!p || !ll) return false;
  if (ll.id != null && p.landlordId != null && String(p.landlordId) === String(ll.id)) return true;
  var a = String(p.landlordName || '').trim().toLowerCase();
  var b = String(ll.name || '').trim().toLowerCase();
  return a !== '' && b !== '' && a === b;
}
const net = p => p.rent - p.landlord;

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
