// ── Arrears Report ─────────────────────────────────────────────────────────────
// Note: Arrears are tenant-scoped only. Airbnb / STR income has no arrears concept
// (it's recorded as actual receipts after the fact, not against scheduled rent).
function renderReportArrears(tenants) {
  var liveArrears = (typeof getTenantsInArrearsKpiMap === 'function') ? getTenantsInArrearsKpiMap() : {};
  var withArrears = tenants.map(function(t){
    var liveAmount = liveArrears[t.name];
    var amount = liveAmount != null ? liveAmount : (t.arrears || 0);
    return Object.assign({}, t, { arrears: +amount || 0 });
  }).filter(function(t){return (t.arrears||0)>0;}).sort(function(a,b){return b.arrears-a.arrears;});
  var totalArrears = withArrears.reduce(function(s,t){return s+t.arrears;},0);
  var today = new Date();

  // Ageing buckets: 0-7d, 8-30d, 31-60d, 60d+
  var buckets = [{label:'0-7 days',min:0,max:7,col:'var(--amber)',bg:'var(--amber-light)'},
                 {label:'8-30 days',min:8,max:30,col:'#EA580C',bg:'#FFF7ED'},
                 {label:'31-60 days',min:31,max:60,col:'var(--red)',bg:'var(--red-light)'},
                 {label:'60+ days',min:61,max:9999,col:'#7F1D1D',bg:'#FEE2E2'}];

  // Assign ageing from last payment date
  var tenantWithAge = withArrears.map(function(t){
    var lastPay = state.payments.filter(function(p){
      return (p.tenantName===t.name||p.tenant===t.name) && p.status==='paid' && p._paidDateRaw;
    }).sort(function(a,b){return b._paidDateRaw-a._paidDateRaw;})[0];
    var age = lastPay ? Math.floor((today-new Date(lastPay._paidDateRaw))/86400000) : 90;
    return Object.assign({},t,{_age:age});
  });

  var kpis = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px">';
  kpis += '<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--red);font-family:monospace">'+fmt(totalArrears)+'</div><div style="font-size:9px;font-weight:800;color:var(--red);text-transform:uppercase;margin-top:3px">Total Arrears</div></div>';
  kpis += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--amber);font-family:monospace">'+withArrears.length+'</div><div style="font-size:9px;font-weight:800;color:var(--amber);text-transform:uppercase;margin-top:3px">Tenants</div></div>';
  buckets.forEach(function(b){
    var bTenants = tenantWithAge.filter(function(t){return t._age>=b.min&&t._age<=b.max;});
    var bTotal = bTenants.reduce(function(s,t){return s+t.arrears;},0);
    kpis += '<div style="background:'+b.bg+';border:1px solid '+b.bg.replace('light','').replace('var(','')+';border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:'+b.col+';font-family:monospace">'+fmt(bTotal)+'</div><div style="font-size:9px;font-weight:800;color:'+b.col+';text-transform:uppercase;margin-top:3px">'+b.label+'</div></div>';
  });
  kpis += '</div>';

  if(!withArrears.length) return kpis+'<div style="text-align:center;padding:40px;color:var(--green);font-size:14px;font-weight:600">&#x2705; No arrears — all tenants up to date!</div>';

  var table = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg)">'
    +'<th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Tenant</th>'
    +'<th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Property</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--muted);font-weight:700">Arrears</th>'
    +'<th style="padding:10px 12px;text-align:center;color:var(--muted);font-weight:700">Age</th>'
    +'<th style="padding:10px 12px;text-align:center;color:var(--muted);font-weight:700">Action</th>'
    +'</tr></thead><tbody>';

  tenantWithAge.forEach(function(t, i){
    var bkt = buckets.find(function(b){return t._age>=b.min&&t._age<=b.max;})||buckets[3];
    var waMsg = encodeURIComponent('Hi '+t.name.split(' ')[0]+', your account has arrears of \u00a3'+t.arrears+'. Please contact us to arrange payment. Thank you \u2014 landlordapp.io');
    table += '<tr style="border-top:1px solid var(--border)'+(i%2?';background:var(--bg)':'')+'">'
      +'<td style="padding:9px 12px"><div style="font-weight:700">'+esc(t.name)+'</div><div style="font-size:11px;color:var(--muted)">Rm '+esc(t.room)+'</div></td>'
      +'<td style="padding:9px 12px;color:var(--muted)">'+esc(t.property)+'</td>'
      +'<td style="padding:9px 12px;text-align:right;font-family:monospace;font-weight:800;color:var(--red)">'+fmt(t.arrears)+'</td>'
      +'<td style="padding:9px 12px;text-align:center"><span style="font-size:11px;font-weight:700;color:'+bkt.col+';background:'+bkt.bg+';padding:2px 8px;border-radius:6px">'+t._age+'d</span></td>'
      +'<td style="padding:9px 12px;text-align:center">'
      +(t.whatsapp?'<a href="https://wa.me/'+t.whatsapp+'?text='+waMsg+'" target="_blank" style="padding:5px 10px;border-radius:7px;background:#25D366;color:#fff;font-size:11px;font-weight:700;text-decoration:none">&#x1F4AC; Chase</a>':'<span style="font-size:11px;color:var(--dim)">No WA</span>')
      +'</td></tr>';
  });
  table += '</tbody></table></div>';
  window._reportData = {tab:'arrears', tenants:tenantWithAge};
  return kpis + table;
}
