// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = n => '£' + Math.round(Number(n)||0).toLocaleString('en-GB');
const pct = (a,b) => b ? Math.round(a/b*100) : 0;
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
  const income = state.properties.reduce((s,p)=>s+p.rent,0);
  const landlord = state.properties.reduce((s,p)=>s+p.landlord,0);
  const opex = state.expenses.reduce((s,e)=>s+e.amount,0);
  const rooms = state.properties.reduce((s,p)=>s+p.rooms,0);
  const occ = state.properties.reduce((s,p)=>s+p.occupied,0);
  const paid = state.payments.filter(p=>p.status==='paid');
  const owed = state.payments.filter(p=>p.status==='outstanding');
  const openM = state.maintenance.filter(m=>m.status!=='resolved');
  return {income,landlord,opex,profit:income-landlord-opex,rooms,occ,paid,owed,openM};
}
