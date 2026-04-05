// ── Forecast Report ────────────────────────────────────────────────────────────
function renderReportForecast(props, tenants, expenses) {
  var monthlyIncome  = Math.round(tenants.filter(function(t){return t.status!=='inactive';}).reduce(function(s,t){return s+(t.freq==='monthly'?t.rent:(t.rent||0)*52/12);},0));
  var monthlyLL      = props.reduce(function(s,p){return s+(p.landlord||0);},0);
  var monthlyExpenses= Math.round(expenses.filter(function(e){return e.recurring;}).reduce(function(s,e){return s+(e.amount||0);},0));
  var monthlyNet     = monthlyIncome - monthlyLL - monthlyExpenses;
  var vacantRooms    = props.reduce(function(s,p){return s+(p.rooms-p.occupied);},0);
  var avgRent        = tenants.length ? Math.round(tenants.reduce(function(s,t){return s+t.rent;},0)/tenants.length) : 0;
  var vacantPotential= Math.round(vacantRooms * avgRent * 52/12);

  var kpis = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px">'
    +'<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--green);font-family:monospace">'+fmt(monthlyIncome)+'</div><div style="font-size:9px;font-weight:800;color:var(--green);text-transform:uppercase;margin-top:3px" title="Monthly rent set per-property in the property editor. May differ from the Tenant Rent Roll, which is calculated from individual tenant amounts.">Monthly Income ℹ</div></div>'
    +'<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--red);font-family:monospace">'+fmt(monthlyLL)+'</div><div style="font-size:9px;font-weight:800;color:var(--red);text-transform:uppercase;margin-top:3px">LL Costs / mo</div></div>'
    +(monthlyExpenses>0?'<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--amber);font-family:monospace">'+fmt(monthlyExpenses)+'</div><div style="font-size:9px;font-weight:800;color:var(--amber);text-transform:uppercase;margin-top:3px">Expenses / mo</div></div>':'')
    +'<div style="background:'+(monthlyNet>=0?'var(--green-light)':'var(--red-light)')+';border:1px solid '+(monthlyNet>=0?'#A7F3D0':'#FECDD3')+';border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:'+(monthlyNet>=0?'var(--green)':'var(--red)')+';font-family:monospace">'+fmt(monthlyNet)+'</div><div style="font-size:9px;font-weight:800;color:'+(monthlyNet>=0?'var(--green)':'var(--red)')+';text-transform:uppercase;margin-top:3px">Net / Month</div></div>'
    +'<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:12px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--blue);font-family:monospace">'+fmt(vacantPotential)+'</div><div style="font-size:9px;font-weight:800;color:var(--blue);text-transform:uppercase;margin-top:3px">Void Potential</div></div>'
    +'</div>';

  // 12-month forward projection table
  var today = new Date();
  var table = '<div style="font-size:13px;font-weight:700;margin-bottom:10px">12-Month Forward Projection (at current run-rate)</div>'
    +'<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg)">'
    +'<th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Month</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--green);font-weight:700">Income</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--red);font-weight:700">LL Costs</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--amber);font-weight:700">Expenses</th>'
    +'<th style="padding:10px 12px;text-align:right;font-weight:700">Net</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--blue);font-weight:700">Cumulative</th>'
    +'</tr></thead><tbody>';
  var MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var cum = 0;
  for(var i=0;i<12;i++){
    var d = new Date(today.getFullYear(), today.getMonth()+i, 1);
    cum += monthlyNet;
    table += '<tr style="border-top:1px solid var(--border)'+(i%2?';background:var(--bg)':'')+'">'
      +'<td style="padding:8px 12px;font-weight:600">'+MONTH_NAMES[d.getMonth()]+' '+d.getFullYear()+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--green)">'+fmt(monthlyIncome)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--red)">'+fmt(monthlyLL)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--amber)">'+fmt(monthlyExpenses)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;font-weight:700;color:'+(monthlyNet>=0?'var(--green)':'var(--red)')+'">'+fmt(monthlyNet)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--blue)">'+fmt(cum)+'</td>'
      +'</tr>';
  }
  table += '</tbody></table></div>';

  if(vacantRooms>0){
    table += '<div style="margin-top:14px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:14px 16px;font-size:13px">'
      +'<span style="font-weight:700;color:var(--blue)">&#x1F4A1; Occupancy Opportunity:</span> '+vacantRooms+' vacant room'+(vacantRooms>1?'s':'')+' at avg &pound;'+avgRent+'/wk = <strong>+'+fmt(vacantPotential)+'/mo</strong> additional income if filled.'
      +'</div>';
  }
  window._reportData = {tab:'forecast', monthlyIncome:monthlyIncome, monthlyLL:monthlyLL, monthlyNet:monthlyNet};
  return kpis + table;
}
