// ── REPORTS PAGE ─────────────────────────────────────────────────────────────
// Map card type → reports-page tab that actually exists
var REPORT_TAB_MAP = {pl:'pl',arrears:'arrears',occupancy:'cashflow',compliance:null,landlord:null,ai:'forecast'};

function applyReportFiltersAndShow(type) {
  // Commit the selections from the dialog into state.filters BEFORE rendering
  var monthEl   = document.getElementById('rpt-dlg-month');
  var yearEl    = document.getElementById('rpt-dlg-year');
  var companyEl = document.getElementById('rpt-dlg-company');
  if(monthEl)   state.filters.reportMonth   = monthEl.value === '' ? '' : +monthEl.value;
  if(yearEl)    state.filters.reportYear    = +yearEl.value;
  if(companyEl) state.filters.reportCompany = companyEl.value;
  var targetTab = REPORT_TAB_MAP[type];
  if(targetTab) state.filters.reportTab = targetTab;
}

function viewReportInPage(type) {
  applyReportFiltersAndShow(type);
  closeModal();
  // If compliance / landlord selected, jump to the appropriate page (they don't have a reports tab)
  if(type === 'compliance') { goto('properties'); return; }
  if(type === 'landlord')  { goto('landlords'); return; }
  if(type === 'ai')        { goto('dashboard'); return; }
  goto('reports');
  // Scroll the report content into view after render
  setTimeout(function(){
    var el = document.querySelector('.report-tabs') || document.querySelector('.report-table') || document.querySelector('.stat-row') || document.querySelector('.hero-card');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  }, 150);
}

function downloadReportFromDialog(type) {
  applyReportFiltersAndShow(type);
  closeModal();
  // Landlord card → open the Landlords page so the user can pick WHICH landlord to download
  if(type === 'landlord') {
    goto('landlords');
    showToast('Open any landlord and use the 📄 Statement PDF button','success');
    return;
  }
  if(typeof generateReportPDF === 'function') generateReportPDF(type);
}

function csvReportFromDialog(type) {
  applyReportFiltersAndShow(type);
  closeModal();
  if(typeof exportReportCSV === 'function') exportReportCSV(type === 'occupancy' ? 'cashflow' : type);
}

function openReportAction(type, title) {
  var now = new Date();
  var curYear = state.filters.reportYear || now.getFullYear();
  var curMonth = state.filters.reportMonth != null ? state.filters.reportMonth : '';
  var curCompany = state.filters.reportCompany || '';
  var MNAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var monthOpts = '<option value="">Full year</option>' + MNAMES.map(function(n,i){return '<option value="'+i+'" '+(curMonth!==''&&+curMonth===i?'selected':'')+'>'+n+'</option>';}).join('');
  var yearOpts = [2024,2025,2026,2027].map(function(y){return '<option value="'+y+'" '+(+curYear===y?'selected':'')+'>'+y+'</option>';}).join('');
  var coOpts = '<option value="">All Companies</option>' + (state.companies||[]).map(function(co){return '<option value="'+co.id+'" '+(curCompany===co.id?'selected':'')+'>'+esc(co.name)+'</option>';}).join('');

  var hasTab = !!REPORT_TAB_MAP[type];
  var canPDF = type !== 'ai';
  var canCSV = type === 'pl' || type === 'arrears' || type === 'occupancy';
  var descByType = {
    pl: 'Income, costs and profit broken down by property/company for the selected period.',
    arrears: 'Every unpaid scheduled payment with aging and tenant contact info.',
    occupancy: 'Room-level occupancy + estimated void costs + projected cash flow.',
    compliance: 'Gas safety, EICR, EPC, HMO licence expiries flagged on Properties page.',
    landlord: 'Per-landlord income statement with property breakdown and payment history.',
    ai: 'AI portfolio intelligence — underperformers, trends, opportunities.'
  };

  var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:520px">'
    +'<div class="modal-header"><span class="modal-title">'+title+'</span><button class="modal-close" onclick="closeModal()">&#x00D7;</button></div>'
    +'<div class="modal-body">'
    +'<p style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.5">'+(descByType[type]||'')+'</p>';

  // Period + company selector
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:6px">'
    +'<div class="field" style="margin:0"><label class="field-label">Month</label><select class="inp" id="rpt-dlg-month">'+monthOpts+'</select></div>'
    +'<div class="field" style="margin:0"><label class="field-label">Year</label><select class="inp" id="rpt-dlg-year">'+yearOpts+'</select></div>'
    +'<div class="field" style="margin:0"><label class="field-label">Scope</label><select class="inp" id="rpt-dlg-company">'+coOpts+'</select></div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:16px">Leave Month on <strong>Full year</strong> for YTD figures.</div>';

  html += '<div style="display:flex;flex-direction:column;gap:8px">';

  // View (unless this type has no reports tab, still show a labelled button)
  if(hasTab || type === 'compliance' || type === 'landlord' || type === 'ai') {
    var viewLabel = '&#x1F4CA; View Report';
    if(type === 'compliance') viewLabel = '&#x1F4C5; Open Compliance on Properties page';
    else if(type === 'landlord') viewLabel = '&#x1F3E6; Open Landlords page';
    else if(type === 'ai') viewLabel = '&#x1F916; Open AI Agent';
    html += '<button data-t="'+type+'" onclick="viewReportInPage(this.dataset.t)" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:13px">'+viewLabel+'</button>';
  }

  if(canPDF) {
    var pdfLabel = type === 'landlord' ? '&#x1F4C4; Download per-landlord PDFs (pick on next page)' : '&#x1F4C4; Download PDF';
    html += '<button data-t="'+type+'" onclick="downloadReportFromDialog(this.dataset.t)" class="btn btn-secondary" style="width:100%;justify-content:center;padding:12px;font-size:13px">'+pdfLabel+'</button>';
  }

  if(canCSV) {
    html += '<button data-t="'+type+'" onclick="csvReportFromDialog(this.dataset.t)" class="btn btn-secondary" style="width:100%;justify-content:center;padding:12px;font-size:13px">&#x2B07; Export as CSV</button>';
  }

  html += '<button onclick="closeModal();goto(\'settings\');state.filters.settingsTab=\'email\';render()" class="btn btn-secondary" style="width:100%;justify-content:center;padding:12px;font-size:13px">&#x1F4E7; Configure email delivery</button>';

  html += '</div></div>'
    +'<div class="modal-footer"><button onclick="closeModal()" class="btn btn-secondary">Close</button></div>'
    +'</div></div>';
  document.getElementById('modal-container').innerHTML = html;
}

function renderReports() {
  if (typeof can === 'function' && !can('canViewFinancials')) {
    var locked = renderScreenHeader({
      title: 'Reports',
      subtitle: 'Financial access required',
      rightActions: []
    });
    locked += '<div class="card" style="padding:24px;text-align:center">'
      +'<div style="font-size:34px;margin-bottom:10px">&#x1F512;</div>'
      +'<div style="font-size:16px;font-weight:800;margin-bottom:6px">Reports are restricted</div>'
      +'<div style="font-size:13px;color:var(--muted);line-height:1.5;max-width:520px;margin:0 auto">Ask an admin to enable Financials access for your role before viewing income, arrears, cash flow, and forecast reports.</div>'
      +'</div>';
    return locked;
  }
  var tab = state.filters.reportTab || 'pl';
  var selCo = state.filters.reportCompany || '';
  var selYear = state.filters.reportYear || new Date().getFullYear();

  // Property-type filter: all / owned / managed / hmo / sa (Airbnb)
  var selPropType = state.filters.reportPropType || 'all';
  // Filter properties by company + property type
  var props0 = selCo ? state.properties.filter(function(p){return p.companyId===selCo;}) : state.properties;
  var propsActive = props0.filter(isPropertyActive);
  var props = propsActive.filter(function(p){
    if(selPropType === 'all')     return true;
    if(selPropType === 'owned')   return (p.ownershipType||'managed') === 'owned';
    if(selPropType === 'managed') return (p.ownershipType||'managed') === 'managed';
    if(selPropType === 'hmo')     return (p.lettingType||'hmo')      === 'hmo';
    if(selPropType === 'sa')      return !!p.isStrEnabled;
    return true;
  });
  var propNames = props.map(function(p){return p.name;});
  var tenants = state.tenants.filter(function(t){return t.status!=='inactive'&&propNames.indexOf(t.property)>=0;});
  var payments = state.payments.filter(function(p){return propNames.indexOf(p.property||p.propertyName||'')>=0||propNames.indexOf(p.propertyName||'')>=0;});
  var expenses = state.expenses.filter(function(e){return !selCo||(propNames.indexOf(e.property||'')>=0);});

  // Period filter — pill-based presets. `custom` keeps the old month+year dropdown.
  // Presets: this_month, last_month, this_quarter, ytd, last_year, all, custom.
  // Default to 'this_month' so users land on the most actionable period —
  // YTD shown by default tended to surface huge year-aggregate numbers users
  // weren't looking for.
  var period = state.filters.reportPeriod || 'this_month';
  var todayR = new Date(); var curYr = todayR.getFullYear(); var curMo = todayR.getMonth();
  var selMonthRaw = state.filters.reportMonth;
  var hasMonth = period === 'custom' && selMonthRaw !== '' && selMonthRaw != null && !isNaN(+selMonthRaw);
  var periodStart, periodEnd, monthsInPeriod, periodLabel;
  var MNAMES_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if(period === 'this_month'){
    periodStart = new Date(curYr, curMo, 1);
    periodEnd   = new Date(curYr, curMo+1, 0, 23,59,59);
    monthsInPeriod = 1;
    periodLabel = MNAMES_LONG[curMo]+' '+curYr;
    selYear = curYr;
  } else if(period === 'last_month'){
    var lmYr = curMo===0 ? curYr-1 : curYr;
    var lmMo = curMo===0 ? 11 : curMo-1;
    periodStart = new Date(lmYr, lmMo, 1);
    periodEnd   = new Date(lmYr, lmMo+1, 0, 23,59,59);
    monthsInPeriod = 1;
    periodLabel = MNAMES_LONG[lmMo]+' '+lmYr;
    selYear = lmYr;
  } else if(period === 'this_quarter'){
    var qStart = curMo - (curMo%3);
    periodStart = new Date(curYr, qStart, 1);
    periodEnd   = new Date(curYr, qStart+3, 0, 23,59,59);
    monthsInPeriod = curMo - qStart + 1;
    periodLabel = 'Q'+(Math.floor(curMo/3)+1)+' '+curYr;
    selYear = curYr;
  } else if(period === 'last_year'){
    periodStart = new Date(curYr-1, 0, 1);
    periodEnd   = new Date(curYr-1, 11, 31, 23,59,59);
    monthsInPeriod = 12;
    periodLabel = String(curYr-1);
    selYear = curYr-1;
  } else if(period === 'all'){
    periodStart = new Date(2020, 0, 1);
    periodEnd   = new Date(curYr, 11, 31, 23,59,59);
    monthsInPeriod = Math.max(1, (curYr-2020)*12 + curMo + 1);
    periodLabel = 'All time';
    selYear = curYr;
  } else if(period === 'custom' && hasMonth){
    var mi = +selMonthRaw;
    periodStart = new Date(selYear, mi, 1);
    periodEnd   = new Date(selYear, mi+1, 0, 23,59,59);
    monthsInPeriod = 1;
    periodLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mi]+' '+selYear;
  } else { // 'ytd' (default) or 'custom' with no month
    periodStart = new Date(selYear, 0, 1);
    periodEnd   = new Date(selYear, 11, 31, 23,59,59);
    monthsInPeriod = selYear < curYr ? 12 : (selYear === curYr ? (curMo+1) : 12);
    periodLabel = selYear + ' YTD';
  }
  var ytdStart = periodStart; // keep old name for downstream compatibility
  var ytdIncome = payments.filter(function(p){
    if(p.status!=='paid'&&p.status!=='Paid') return false;
    var d = p._paidDateRaw ? new Date(p._paidDateRaw) : getDueDateObj(p);
    return d >= periodStart && d <= periodEnd;
  }).reduce(function(s,p){return s+p.amount;},0);
  // Landlord cost — CASH BASIS. Sum only landlord payments confirmed as paid
  // (status='paid'), allocated to the period by their paidDate. Mirrors how
  // income is calculated above (only paid rent counts) so the P&L reflects
  // reality, not future commitments. Forecasting lives in the Forecast tab.
  var ytdLLCosts = (state.landlordPayments || []).filter(function(lp){
    if (lp.status !== 'paid') return false;
    if (!lp.paidDate) return false;
    var d = new Date(lp.paidDate);
    if (isNaN(d.getTime())) return false;
    return d >= periodStart && d <= periodEnd;
  }).reduce(function(s, lp){ return s + (lp.amount || 0); }, 0);
  var ytdExpenses = expenses.filter(function(e){ if(!e.startDate) return false; var d=new Date(e.startDate); return d>=periodStart && d<=periodEnd; }).reduce(function(s,e){return s+e.amount;},0);
  var ytdNet = ytdIncome - ytdLLCosts - ytdExpenses;

  var coOpts = '<option value="">All Companies</option>'+(state.companies||[]).map(function(co){return '<option value="'+co.id+'" '+(selCo===co.id?'selected':'')+'>'+esc(co.name)+'</option>';}).join('');
  var yearOpts = [2024,2025,2026,2027].map(function(y){return '<option value="'+y+'" '+(selYear==y?'selected':'')+'>'+y+'</option>';}).join('');
  var selMonth = state.filters.reportMonth != null ? state.filters.reportMonth : '';
  var MNAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthOpts = '<option value="">Full year</option>' + MNAMES.map(function(n,i){return '<option value="'+i+'" '+(selMonth!==''&&+selMonth===i?'selected':'')+'>'+n+'</option>';}).join('');

  // Period presets (pill row) — replaces the old month+year dropdowns
  var PERIOD_PRESETS = [
    {v:'this_month',   l:'This Month'},
    {v:'last_month',   l:'Last Month'},
    {v:'this_quarter', l:'This Quarter'},
    {v:'ytd',          l:'YTD'},
    {v:'last_year',    l:'Last Year'},
    {v:'all',          l:'All Time'},
    {v:'custom',       l:'Custom'}
  ];
  // Period pill row — compact horizontal scroll teal-pill chips (mockup style)
  var pillRow = '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;-webkit-overflow-scrolling:touch;scrollbar-width:none">'
    + PERIOD_PRESETS.map(function(p){
        var active = period===p.v;
        return '<button onclick="state.filters.reportPeriod=\''+p.v+'\';render()" style="padding:6px 12px;border-radius:999px;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;flex-shrink:0;border:1px solid '+(active?'var(--teal-300)':'var(--gray-200)')+';background:'+(active?'var(--teal-50)':'#fff')+';color:'+(active?'var(--teal-700)':'var(--gray-700)')+'">'+p.l+'</button>';
      }).join('')
    +'</div>';

  // Property-type filter — compact dropdown instead of a 5-pill row to save vertical space on mobile
  var PROP_TYPE_PRESETS = [
    {v:'all',     l:'All properties'},
    {v:'owned',   l:'🏠 Owned'},
    {v:'managed', l:'🤝 Managed'},
    {v:'hmo',     l:'🏘️ HMO'},
    {v:'sa',      l:'🛏️ Airbnb / SA'}
  ];
  var typeRow = '<div style="margin-bottom:14px"><select onchange="state.filters.reportPropType=this.value;render()" style="width:100%;max-width:240px;padding:8px 12px;border-radius:var(--radius-md);border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:13px;font-weight:600;color:var(--gray-700);cursor:pointer">'
    + PROP_TYPE_PRESETS.map(function(p){return '<option value="'+p.v+'" '+(selPropType===p.v?'selected':'')+'>'+p.l+'</option>';}).join('')
    + '</select></div>';

  var h = '';

  // ── v2 header / hero / stat row ──
  var coPill = '<select onchange="state.filters.reportCompany=this.value;render()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;max-width:140px">'+coOpts+'</select>';
  var pdfBtn = '<button onclick="generateReportPDF(\''+tab+'\')" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit" title="Download PDF">📄</button>';
  var csvBtn = '<button onclick="exportReportCSV(\''+tab+'\')" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit" title="Download CSV">⬇</button>';
  var acctBtn = '<button onclick="showAccountingExportModal()" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export</button>';
  h += renderScreenHeader({
    title: 'Reports',
    subtitle: periodLabel + ' · ' + props.length + ' propert' + (props.length===1?'y':'ies'),
    rightActions: [coPill, pdfBtn, csvBtn, acctBtn]
  });
  // Hero — period net profit (success when positive, warning when negative)
  h += renderHeroCard({
    variant: ytdNet >= 0 ? 'default' : 'warning',
    icon: ytdNet >= 0 ? '\u{1F4C8}' : '\u{1F4C9}',
    label: periodLabel + ' · Net Profit',
    value: '<span style="color:#fff">' + fmt(ytdNet) + '</span>',
    subtitle: fmt(ytdIncome) + ' income · ' + fmt(ytdLLCosts + ytdExpenses) + ' costs'
  });
  h += renderStatRow([
    { label:'Income',   value: fmt(ytdIncome),    color: ytdIncome>0?'emerald':'dim' },
    { label:'LL Costs', value: fmt(ytdLLCosts),   color: ytdLLCosts>0?'red':'dim' },
    { label:'Expenses', value: fmt(ytdExpenses),  color: ytdExpenses>0?'amber':'dim' }
  ]);

  // Period pill row + (only when Custom) month/year dropdowns
  h += pillRow;
  if(period === 'custom'){
    h += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
      +'<select class="filter-select" style="max-width:150px" onchange="state.filters.reportMonth=this.value===\'\'?\'\':+this.value;render()">'+monthOpts+'</select>'
      +'<select class="filter-select" style="max-width:110px" onchange="state.filters.reportYear=+this.value;render()">'+yearOpts+'</select>'
      +'</div>';
  }
  // Property-type pill row
  h += typeRow;

  // (Period KPI strip removed — now surfaced in the hero + stat row above.)

  // Tabs — unified design
  var tabs = [{v:'pl',l:'&#x1F4CA; P&L'},{v:'arrears',l:'&#x1F4B7; Rent Collection'},{v:'cashflow',l:'&#x1F4B0; Cash Flow'},{v:'forecast',l:'&#x1F52E; Forecast'}];
  h += '<div class="card" style="padding:0;overflow:hidden">';
  h += '<div style="display:flex;border-bottom:1px solid var(--border);padding:0 20px;background:var(--bg)">';
  tabs.forEach(function(t){
    var active = tab===t.v;
    h += '<button onclick="state.filters.reportTab=\''+t.v+'\';render()" style="padding:14px 18px;border:none;border-bottom:2px solid '+(active?'var(--accent)':'transparent')+';margin-bottom:-1px;background:transparent;font-size:13px;font-weight:'+(active?700:500)+';color:'+(active?'var(--accent)':'var(--muted)')+';cursor:pointer;font-family:inherit;white-space:nowrap;transition:all .15s">'+t.l+'</button>';
  });
  h += '</div>';
  h += '<div style="padding:20px">';

  if(tab==='pl')        h += renderReportPL(props, tenants, payments, expenses, selYear);
  else if(tab==='arrears')  h += renderReportArrears(tenants);
  else if(tab==='cashflow') h += renderReportCashFlow(payments, expenses, selYear);
  else if(tab==='forecast') h += renderReportForecast(props, tenants, expenses);

  h += '</div></div>';

  // Report generation cards
  h += '<div class="section-title" style="margin-top:20px">&#x1F4C4; Generate &amp; Export</div>';
  h += '<div class="report-grid">';
  h += '<div class="report-card" onclick="openReportAction(\'pl\',\'P&amp;L Statement\')"><div class="report-card-icon" style="background:var(--green-light)">&#x1F4B0;</div><div class="report-card-title">P&amp;L Statement</div><div class="report-card-desc">Income, costs, and profit by property, company, or portfolio.</div><div class="report-card-tags"><span class="report-tag">Monthly</span><span class="report-tag">Quarterly</span><span class="report-tag">PDF</span><span class="report-tag">CSV</span></div></div>';
  h += '<div class="report-card" onclick="openReportAction(\'arrears\',\'Rent Collection\')"><div class="report-card-icon" style="background:var(--blue-light)">&#x1F4B7;</div><div class="report-card-title">Rent Collection</div><div class="report-card-desc">Payment history, arrears aging, collection rates.</div><div class="report-card-tags"><span class="report-tag">Weekly</span><span class="report-tag">Monthly</span><span class="report-tag">PDF</span></div></div>';
  h += '<div class="report-card" onclick="openReportAction(\'occupancy\',\'Occupancy &amp; Voids\')"><div class="report-card-icon" style="background:var(--purple-light)">&#x1F3D8;</div><div class="report-card-title">Occupancy &amp; Voids</div><div class="report-card-desc">Room-level occupancy and void period costs.</div><div class="report-card-tags"><span class="report-tag">Live</span><span class="report-tag">Monthly</span><span class="report-tag">PDF</span></div></div>';
  h += '<div class="report-card" onclick="openReportAction(\'compliance\',\'Compliance Status\')"><div class="report-card-icon" style="background:var(--red-light)">&#x1F4C5;</div><div class="report-card-title">Compliance Status</div><div class="report-card-desc">Gas, EPC, EICR, HMO, fire risk expiry tracker.</div><div class="report-card-tags"><span class="report-tag">Live</span><span class="report-tag">Alerts</span><span class="report-tag">PDF</span></div></div>';
  h += '<div class="report-card" onclick="openReportAction(\'landlord\',\'Landlord Statements\')"><div class="report-card-icon" style="background:var(--amber-light)">&#x1F4B3;</div><div class="report-card-title">Landlord Statements</div><div class="report-card-desc">Per-landlord income, deductions, net payable.</div><div class="report-card-tags"><span class="report-tag">Monthly</span><span class="report-tag">PDF</span><span class="report-tag">Email</span></div></div>';
  h += '<div class="report-card" onclick="openReportAction(\'ai\',\'AI Portfolio Insights\')"><div class="report-card-icon" style="background:var(--green-light)">&#x1F916;</div><div class="report-card-title">AI Portfolio Insights</div><div class="report-card-desc">AI analysis of underperformers and opportunities.</div><div class="report-card-tags"><span class="report-tag">Weekly</span><span class="report-tag">On-demand</span><span class="report-tag">PDF</span></div></div>';
  h += '</div>';

  // Scheduled reports
  h += '<div class="section-title">&#x23F0; Scheduled Reports</div>';
  h += '<div class="schedule-grid">';
  h += '<div class="schedule-card"><div class="schedule-icon" style="background:var(--green-light)">&#x1F4CA;</div><div style="flex:1"><div style="font-size:13px;font-weight:700">Weekly Portfolio Summary</div><div style="font-size:11px;color:var(--dim);margin-top:2px">Every Monday 09:00</div></div><div class="schedule-toggle"></div></div>';
  h += '<div class="schedule-card"><div class="schedule-icon" style="background:var(--blue-light)">&#x1F4B0;</div><div style="flex:1"><div style="font-size:13px;font-weight:700">Monthly P&amp;L Report</div><div style="font-size:11px;color:var(--dim);margin-top:2px">1st of month 09:00</div></div><div class="schedule-toggle"></div></div>';
  h += '<div class="schedule-card"><div class="schedule-icon" style="background:var(--amber-light)">&#x1F4B3;</div><div style="flex:1"><div style="font-size:13px;font-weight:700">Landlord Statements</div><div style="font-size:11px;color:var(--dim);margin-top:2px">1st of month 10:00</div></div><div class="schedule-toggle off"></div></div>';
  h += '<div class="schedule-card"><div class="schedule-icon" style="background:var(--red-light)">&#x1F4C5;</div><div style="flex:1"><div style="font-size:13px;font-weight:700">Compliance Alerts</div><div style="font-size:11px;color:var(--dim);margin-top:2px">Daily &middot; 30d warning</div></div><div class="schedule-toggle"></div></div>';
  h += '</div>';

  // Recent exports
  h += '<div class="card"><div class="card-header"><div class="card-title">&#x1F4E5; Recent Exports</div></div>';
  h += '<div class="export-row"><span style="font-size:16px;width:20px;text-align:center">&#x1F4CA;</span><span style="font-weight:600;flex:1">Weekly Summary</span><span style="font-size:11px;color:var(--dim)">Last Monday</span><button class="export-dl" onclick="exportReportCSV(\'pl\')">&#x2B07; CSV</button></div>';
  h += '<div class="export-row"><span style="font-size:16px;width:20px;text-align:center">&#x1F4B0;</span><span style="font-weight:600;flex:1">P&amp;L &mdash; '+selYear+'</span><span style="font-size:11px;color:var(--dim)">Current</span><button class="export-dl" onclick="exportReportCSV(\'pl\')">&#x2B07; CSV</button></div>';
  h += '<div class="export-row"><span style="font-size:16px;width:20px;text-align:center">&#x26A0;</span><span style="font-weight:600;flex:1">Arrears Report</span><span style="font-size:11px;color:var(--dim)">Current</span><button class="export-dl" onclick="exportReportCSV(\'arrears\')">&#x2B07; CSV</button></div>';
  h += '</div>';

  return h;
}
