// ── P&L Report ────────────────────────────────────────────────────────────────
function renderReportPL(props, tenants, payments, expenses, year) {
  var MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var months = MONTH_NAMES.map(function(m, i){
    var from = new Date(year, i, 1);
    var to   = new Date(year, i+1, 0);
    // Income split by source — paid payments in this month
    var paidThisMonth = payments.filter(function(p){
      if(p.status!=='paid') return false;
      var raw = p._paidDateRaw || p._dueDateRaw;
      if(!raw) return false;
      var d = new Date(raw);
      return d >= from && d <= to;
    });
    var rentIncome = paidThisMonth.filter(function(p){return (p.incomeSource||'rent')==='rent';}).reduce(function(s,p){return s+p.amount;},0);
    var strIncome  = paidThisMonth.filter(function(p){return p.incomeSource==='airbnb';}).reduce(function(s,p){return s+p.amount;},0);
    var income = rentIncome + strIncome;
    // Landlord cost: CASH BASIS — only count landlord payments that have
    // actually been confirmed as paid (status='paid'), allocated to the month
    // the payment was made. This is the same accounting basis used for income
    // (only paid rent counts), so the P&L reflects reality month-on-month.
    //
    // Previously this summed each property's monthly landlord_rent for every
    // month after the lease started, producing huge phantom losses on future
    // months (e.g. Dec 2026 showing £-173,500 even though we won't pay until
    // Dec). Forecasting / projections live in the Forecast tab.
    var landlord = (state.landlordPayments || []).filter(function(lp){
      if (lp.status !== 'paid') return false;
      if (!lp.paidDate) return false;
      var d = new Date(lp.paidDate);
      if (isNaN(d.getTime())) return false;
      return d >= from && d <= to;
    }).reduce(function(s, lp){ return s + (lp.amount || 0); }, 0);
    // Operating expenses in this month
    var opex = expenses.filter(function(e){
      if(!e.startDate) return false;
      var d = new Date(e.startDate);
      return d >= from && d <= to;
    }).reduce(function(s,e){return s+e.amount;},0);
    var net = income - landlord - opex;
    return {label:m, income:Math.round(income), rentIncome:Math.round(rentIncome), strIncome:Math.round(strIncome), landlord:Math.round(landlord), opex:Math.round(opex), net:Math.round(net)};
  });

  var ytdIncome   = months.filter(function(_,i){return i<=new Date().getMonth();}).reduce(function(s,m){return s+m.income;},0);
  var ytdRent     = months.filter(function(_,i){return i<=new Date().getMonth();}).reduce(function(s,m){return s+m.rentIncome;},0);
  var ytdStr      = months.filter(function(_,i){return i<=new Date().getMonth();}).reduce(function(s,m){return s+m.strIncome;},0);
  var ytdLandlord = months.filter(function(_,i){return i<=new Date().getMonth();}).reduce(function(s,m){return s+m.landlord;},0);
  var ytdOpex     = months.filter(function(_,i){return i<=new Date().getMonth();}).reduce(function(s,m){return s+m.opex;},0);
  var ytdNet      = ytdIncome - ytdLandlord - ytdOpex;

  var maxVal = Math.max.apply(null, months.map(function(m){return Math.max(m.income, m.landlord);})) || 1;

  // Summary KPIs
  var kpis = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px">';
  [[fmt(ytdIncome),'YTD INCOME','var(--green)','var(--green-light)','#A7F3D0'],
   [fmt(ytdLandlord),'YTD LL COSTS','var(--red)','var(--red-light)','#FECDD3'],
   [fmt(ytdOpex),'YTD EXPENSES','var(--amber)','var(--amber-light)','#FDE68A'],
   [fmt(ytdNet),'YTD NET PROFIT',ytdNet>=0?'var(--green)':'var(--red)',ytdNet>=0?'var(--green-light)':'var(--red-light)',ytdNet>=0?'#A7F3D0':'#FECDD3']
  ].forEach(function(kpi){
    kpis += '<div style="background:'+kpi[3]+';border:1px solid '+kpi[4]+';border-radius:12px;padding:12px;text-align:center">'
      +'<div style="font-size:16px;font-weight:800;color:'+kpi[2]+';font-family:monospace">'+kpi[0]+'</div>'
      +'<div style="font-size:9px;font-weight:800;color:'+kpi[2]+';text-transform:uppercase;margin-top:3px">'+kpi[1]+'</div></div>';
  });
  kpis += '</div>';

  // Revenue breakdown card — only shown when STR income exists (cleaner option)
  if(ytdStr > 0) {
    kpis += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:18px">'
      +'<div style="font-size:12px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px">Revenue Breakdown · YTD '+year+'</div>'
      +'<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px"><span>🏠 Tenant rent</span><span style="font-family:monospace;font-weight:700;color:var(--green)">'+fmt(ytdRent)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px"><span>🛏️ Airbnb / STR income</span><span style="font-family:monospace;font-weight:700;color:#E04E53">'+fmt(ytdStr)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;padding:9px 0 2px;font-size:14px;font-weight:800"><span>Total income</span><span style="font-family:monospace;color:var(--text)">'+fmt(ytdIncome)+'</span></div>'
    +'</div>';
  }

  // Bar chart
  var chart = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:700;margin-bottom:14px">Monthly Income vs Costs &mdash; '+year+'</div>'
    +'<div style="display:flex;align-items:flex-end;gap:4px;height:180px;padding-bottom:24px;position:relative;overflow:hidden">';
  months.forEach(function(m){
    var h = Math.round((m.income/maxVal)*100);
    var hLL = Math.round((m.landlord/maxVal)*100);
    var isPast = MONTH_NAMES.indexOf(m.label) <= new Date().getMonth() && year == new Date().getFullYear();
    chart += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative">'
      +'<div style="position:absolute;bottom:24px;left:0;right:0;display:flex;gap:1px;align-items:flex-end;height:130px">'
      +'<div title="Income: '+fmt(m.income)+'" style="flex:1;background:'+(isPast?'var(--accent)':'var(--accent-light)')+';border-radius:4px 4px 0 0;height:'+h+'%"></div>'
      +'<div title="LL Cost: '+fmt(m.landlord)+'" style="flex:1;background:'+(isPast?'var(--red)':'#FECDD3')+';border-radius:4px 4px 0 0;height:'+hLL+'%"></div>'
      +'</div>'
      +'<div style="position:absolute;bottom:0;font-size:9px;font-weight:700;color:var(--muted)">'+m.label+'</div>'
      +'</div>';
  });
  chart += '</div>'
    +'<div style="display:flex;gap:14px;margin-top:6px;font-size:11px;color:var(--muted)">'
    +'<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--accent);margin-right:4px"></span>Income</span>'
    +'<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--red);margin-right:4px"></span>LL Costs</span>'
    +'</div></div>';

  // Monthly table
  var table = '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:var(--bg)">'
    +'<th style="padding:10px 12px;text-align:left;color:var(--muted);font-weight:700">Month</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--green);font-weight:700">Income</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--red);font-weight:700">LL Costs</th>'
    +'<th style="padding:10px 12px;text-align:right;color:var(--amber);font-weight:700">Expenses</th>'
    +'<th style="padding:10px 12px;text-align:right;font-weight:700">Net Profit</th>'
    +'</tr></thead><tbody>';
  var totI=0,totL=0,totO=0,totN=0;
  months.forEach(function(m, i){
    var isFuture = i > new Date().getMonth() && year == new Date().getFullYear();
    var netCol = m.net>=0?'var(--green)':'var(--red)';
    table += '<tr style="border-top:1px solid var(--border);'+(isFuture?'opacity:.45':'')+(i%2?';background:var(--bg)':'')+'">'
      +'<td style="padding:8px 12px;font-weight:600">'+m.label+' '+year+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--green)">'+fmt(m.income)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--red)">'+fmt(m.landlord)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--amber)">'+fmt(m.opex)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;font-weight:700;color:'+netCol+'">'+fmt(m.net)+'</td>'
      +'</tr>';
    totI+=m.income; totL+=m.landlord; totO+=m.opex; totN+=m.net;
  });
  var totNetCol = totN>=0?'var(--green)':'var(--red)';
  table += '<tr style="border-top:2px solid var(--border);background:var(--bg);font-weight:700">'
    +'<td style="padding:10px 12px">TOTAL '+year+'</td>'
    +'<td style="padding:10px 12px;text-align:right;font-family:monospace;color:var(--green)">'+fmt(totI)+'</td>'
    +'<td style="padding:10px 12px;text-align:right;font-family:monospace;color:var(--red)">'+fmt(totL)+'</td>'
    +'<td style="padding:10px 12px;text-align:right;font-family:monospace;color:var(--amber)">'+fmt(totO)+'</td>'
    +'<td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:800;font-size:14px;color:'+totNetCol+'">'+fmt(totN)+'</td>'
    +'</tr></tbody></table></div>';

  // Store for CSV export
  window._reportData = {tab:'pl', year:year, months:months};
  return kpis + chart + table;
}
