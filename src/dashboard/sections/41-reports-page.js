// ── REPORTS PAGE ─────────────────────────────────────────────────────────────
function renderReports() {
  var tab = state.filters.reportTab || 'pl';
  var selCo = state.filters.reportCompany || '';
  var selYear = state.filters.reportYear || new Date().getFullYear();

  // Filter properties by company
  var props = selCo ? state.properties.filter(function(p){return p.companyId===selCo;}) : state.properties;
  var propNames = props.map(function(p){return p.name;});
  var tenants = state.tenants.filter(function(t){return t.status!=='inactive'&&propNames.indexOf(t.property)>=0;});
  var payments = state.payments.filter(function(p){return propNames.indexOf(p.property||p.propertyName||'')>=0||propNames.indexOf(p.propertyName||'')>=0;});
  var expenses = state.expenses.filter(function(e){return !selCo||(propNames.indexOf(e.property||'')>=0);});

  var coOpts = '<option value="">All Companies</option>'+(state.companies||[]).map(function(co){return '<option value="'+co.id+'" '+(selCo===co.id?'selected':'')+'>'+co.name+'</option>';}).join('');
  var yearOpts = [2024,2025,2026,2027].map(function(y){return '<option value="'+y+'" '+(selYear==y?'selected':'')+'>'+y+'</option>';}).join('');

  var tabs = [{v:'pl',l:'📊 P&L'},  {v:'arrears',l:'⚠️ Arrears'},  {v:'cashflow',l:'💰 Cash Flow'},  {v:'forecast',l:'🔮 Forecast'}];
  var tabBar = '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;overflow-x:auto">'
    +tabs.map(function(t){
      var active = tab===t.v;
      return '<button onclick="state.filters.reportTab=\''+t.v+'\';render()" style="padding:11px 18px;border:none;border-bottom:3px solid '+(active?'var(--accent)':'transparent')+';margin-bottom:-2px;background:transparent;font-size:13px;font-weight:'+(active?700:500)+';color:'+(active?'var(--accent-dark)':'var(--muted)')+';cursor:pointer;font-family:inherit;white-space:nowrap">'+t.l+'</button>';
    }).join('')+'</div>';

  var controls = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;align-items:center">'
    +'<select class="inp" style="max-width:200px" onchange="state.filters.reportCompany=this.value;render()">'+coOpts+'</select>'
    +'<select class="inp" style="max-width:100px" onchange="state.filters.reportYear=+this.value;render()">'+yearOpts+'</select>'
    +'<button onclick="exportReportCSV(\''+tab+'\')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B07; Export CSV</button>'
    +'</div>';

  var content = '';
  if(tab==='pl')        content = renderReportPL(props, tenants, payments, expenses, selYear);
  else if(tab==='arrears')  content = renderReportArrears(tenants);
  else if(tab==='cashflow') content = renderReportCashFlow(payments, expenses, selYear);
  else if(tab==='forecast') content = renderReportForecast(props, tenants, expenses);

  return '<div class="page-header"><div><div class="page-title">&#x1F4C8; Reports</div>'
    +'<div class="page-sub">Financial analysis across your portfolio</div></div></div>'
    +controls+tabBar+content;
}
