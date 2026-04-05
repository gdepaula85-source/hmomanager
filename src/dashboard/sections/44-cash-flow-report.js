// ── Cash Flow Report ───────────────────────────────────────────────────────────
function renderReportCashFlow(payments, expenses, year) {
  var MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var months = MONTH_NAMES.map(function(m, i){
    var from = new Date(year, i, 1);
    var to   = new Date(year, i+1, 0);
    var inc = payments.filter(function(p){
      if(p.status!=='paid') return false;
      var raw = p._paidDateRaw||p._dueDateRaw; if(!raw) return false;
      var d = new Date(raw); return d>=from&&d<=to;
    }).reduce(function(s,p){return s+p.amount;},0);
    var out = expenses.filter(function(e){
      if(!e.startDate) return false;
      var d=new Date(e.startDate); return d>=from&&d<=to;
    }).reduce(function(s,e){return s+e.amount;},0);
    return {label:m, in:Math.round(inc), out:Math.round(out), net:Math.round(inc-out)};
  });

  var runningTotal = 0;
  var table = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px;margin-bottom:16px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg)">'
    +'<th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Month</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--green);font-weight:700">Cash In</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--red);font-weight:700">Cash Out</th>'
    +'<th style="padding:10px 12px;text-align:right;font-weight:700">Net</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--blue);font-weight:700">Running</th>'
    +'</tr></thead><tbody>';
  months.forEach(function(m, i){
    runningTotal += m.net;
    var isFuture = i > new Date().getMonth() && year == new Date().getFullYear();
    table += '<tr style="border-top:1px solid var(--border)'+(i%2?';background:var(--bg)':'')+(isFuture?';opacity:.45':'')+'">'
      +'<td style="padding:8px 12px;font-weight:600">'+m.label+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--green)">'+fmt(m.in)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--red)">'+fmt(m.out)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;font-weight:700;color:'+(m.net>=0?'var(--green)':'var(--red)')+'">'+fmt(m.net)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--blue)">'+fmt(runningTotal)+'</td>'
      +'</tr>';
  });
  table += '</tbody></table></div>';
  window._reportData = {tab:'cashflow', year:year, months:months};
  return table;
}
