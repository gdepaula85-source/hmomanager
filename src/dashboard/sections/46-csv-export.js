// ── CSV Export ─────────────────────────────────────────────────────────────────
function exportReportCSV(tab) {
  var d = window._reportData;
  if(!d) return;
  var rows = [], filename = 'propmanager-report-'+tab+'-'+new Date().toISOString().split('T')[0]+'.csv';

  if(tab==='pl' && d.months) {
    rows.push(['Month','Income','LL Costs','Expenses','Net Profit']);
    d.months.forEach(function(m){ rows.push([m.label+' '+d.year, m.income, m.landlord, m.opex, m.net]); });
    var tot = d.months.reduce(function(s,m){return {income:s.income+m.income,landlord:s.landlord+m.landlord,opex:s.opex+m.opex,net:s.net+m.net};},{income:0,landlord:0,opex:0,net:0});
    rows.push(['TOTAL', tot.income, tot.landlord, tot.opex, tot.net]);
  } else if(tab==='arrears' && d.tenants) {
    rows.push(['Tenant','Property','Room','Arrears','Age (days)','WhatsApp']);
    d.tenants.forEach(function(t){ rows.push([t.name, t.property, t.room, t.arrears, t._age, t.whatsapp||'']); });
  } else if(tab==='cashflow' && d.months) {
    rows.push(['Month','Cash In','Cash Out','Net','Running Total']);
    var run=0; d.months.forEach(function(m){run+=m.net; rows.push([m.label+' '+d.year, m.in, m.out, m.net, run]);});
  } else if(tab==='forecast') {
    rows.push(['Metric','Value']);
    rows.push(['Monthly Income',d.monthlyIncome],['Monthly LL Costs',d.monthlyLL],['Monthly Net',d.monthlyNet]);
  }

  var csv = rows.map(function(r){return r.map(function(v){return '"'+(v||'').toString().replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob = new Blob([csv],{type:'text/csv'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('CSV exported \u2713','success');
}

// ── Accounting Export (Xero / QuickBooks / Sage / FreeAgent) ────────────────
function exportAccountingCSV(format, timeframe, customStart, customEnd) {
  // format: 'xero' | 'quickbooks' | 'sage' | 'freeagent'
  // timeframe: 'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'last_year' | 'custom'
  var now = new Date();
  var startDate, endDate;

  // Resolve timeframe to date range
  switch(timeframe) {
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'this_quarter':
      var qMonth = Math.floor(now.getMonth()/3)*3;
      startDate = new Date(now.getFullYear(), qMonth, 1);
      endDate = now;
      break;
    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear()-1, 0, 1);
      endDate = new Date(now.getFullYear()-1, 11, 31);
      break;
    case 'custom':
      startDate = customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1);
      endDate = customEnd ? new Date(customEnd) : now;
      break;
    default: // this_month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
  }

  var startMs = startDate.getTime();
  var endMs = endDate.getTime() + 86400000; // include end date

  function fmtDate(d) {
    var dt = d instanceof Date ? d : new Date(d);
    var dd = String(dt.getDate()).padStart(2,'0');
    var mm = String(dt.getMonth()+1).padStart(2,'0');
    return dd + '/' + mm + '/' + dt.getFullYear();
  }

  function fmtAmount(n) {
    var v = Number(n||0);
    // No currency symbols, no thousand separators, 2 decimal places
    return v.toFixed(2);
  }

  function inRange(dateStr) {
    if(!dateStr) return false;
    var d = new Date(dateStr).getTime();
    return d >= startMs && d < endMs;
  }

  // Gather income (rent payments)
  var incomeRows = [];
  (state.payments||[]).forEach(function(p) {
    if(p.status !== 'paid') return;
    var payDate = p.paid_date || p.paidDate || p.due_date || p.dueDate;
    if(!inRange(payDate)) return;
    var tenant = (state.tenants||[]).find(function(t){ return String(t.id)===String(p.tenant_id||p.tenantId); });
    var tName = tenant ? (tenant.name||'Tenant') : 'Tenant';
    var prop = tenant ? (tenant.property||'') : '';
    var desc = 'Rent Payment - ' + tName + (prop ? ' (' + prop + ')' : '');
    incomeRows.push({
      date: payDate,
      description: desc,
      amount: Number(p.amount||0) // positive = income
    });
  });

  // Gather expenses (maintenance, landlord payments, etc.)
  var expenseRows = [];
  (state.expenses||[]).forEach(function(e) {
    var expDate = e.date || e.created_at;
    if(!inRange(expDate)) return;
    var desc = (e.category||'Expense') + ' - ' + (e.description||e.note||'');
    expenseRows.push({
      date: expDate,
      description: desc.replace(/,/g,' '),
      amount: -Math.abs(Number(e.amount||0)) // negative = expense
    });
  });

  // Landlord payments as expenses
  (state.landlordPayments||[]).forEach(function(lp) {
    if(lp.status !== 'paid') return;
    var lpDate = lp.paid_date || lp.paidDate;
    if(!inRange(lpDate)) return;
    var ll = (state.landlords||[]).find(function(l){ return String(l.id)===String(lp.landlordId||lp.landlord_id); });
    var desc = 'Landlord Payment - ' + (ll ? ll.name : 'Landlord') + ' (' + (lp.monthLabel||lp.monthKey||'') + ')';
    expenseRows.push({
      date: lpDate,
      description: desc.replace(/,/g,' '),
      amount: -Math.abs(Number(lp.amount||0))
    });
  });

  // Maintenance costs as expenses
  (state.maintenance||[]).forEach(function(m) {
    if(!m.cost || Number(m.cost) === 0) return;
    var mDate = m.completedDate || m.completed_date || m.date || m.created_at;
    if(!inRange(mDate)) return;
    var prop = m.property || '';
    var desc = 'Maintenance - ' + (m.title||m.description||'Repair') + (prop ? ' (' + prop + ')' : '');
    expenseRows.push({
      date: mDate,
      description: desc.replace(/,/g,' '),
      amount: -Math.abs(Number(m.cost||0))
    });
  });

  // Combine and sort all transactions by date
  var allRows = incomeRows.concat(expenseRows).sort(function(a,b) {
    return (a.date||'').localeCompare(b.date||'');
  });

  // Enforce Xero's 500-row limit
  if(format === 'xero' && allRows.length > 500) {
    allRows = allRows.slice(0, 500);
    showToast('Xero limit: exported first 500 rows. Use a shorter timeframe for full data.', 'warn');
  }

  if(!allRows.length) {
    showToast('No transactions found for this period', 'warn');
    return;
  }

  // Build CSV based on format
  var csvLines = [];
  var isFreeAgent = (format === 'freeagent');

  // Header row — FreeAgent does NOT use a header
  if(!isFreeAgent) {
    csvLines.push('"Date","Description","Amount"');
  }

  allRows.forEach(function(row) {
    var d = fmtDate(row.date);
    var desc = '"' + (row.description||'').replace(/"/g,'""') + '"';
    var amt = fmtAmount(row.amount);

    if(isFreeAgent) {
      // FreeAgent: Date, Amount, Description (no header)
      csvLines.push(d + ',' + amt + ',' + desc);
    } else {
      // Xero / QuickBooks / Sage: Date, Description, Amount (with header)
      csvLines.push(d + ',' + desc + ',' + amt);
    }
  });

  var csv = csvLines.join('\n');
  var timeLabel = timeframe.replace(/_/g,'-');
  var filename = format + '-export-' + timeLabel + '-' + now.toISOString().split('T')[0] + '.csv';
  var blob = new Blob([csv], {type:'text/csv'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(format.charAt(0).toUpperCase()+format.slice(1)+' export downloaded \u2713', 'success');
}

// ── Accounting Export Modal ─────────────────────────────────────────────────
function showAccountingExportModal() {
  var html = '<div class="modal-overlay active" id="accounting-export-overlay" onclick="if(event.target===this)this.remove()">'
    +'<div class="modal" style="max-width:420px;padding:24px;background:#fff">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    +'<h3 style="margin:0;font-size:16px">Export for Accounting Software</h3>'
    +'<button onclick="document.getElementById(\'accounting-export-overlay\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">&times;</button>'
    +'</div>'

    +'<div class="field" style="margin-bottom:14px">'
    +'<label class="field-label">Software</label>'
    +'<select class="inp" id="acc-export-format">'
    +'<option value="xero">Xero</option>'
    +'<option value="quickbooks">QuickBooks</option>'
    +'<option value="sage">Sage</option>'
    +'<option value="freeagent">FreeAgent</option>'
    +'</select>'
    +'</div>'

    +'<div class="field" style="margin-bottom:14px">'
    +'<label class="field-label">Time Period</label>'
    +'<select class="inp" id="acc-export-timeframe" onchange="var c=document.getElementById(\'acc-custom-dates\');c.style.display=this.value===\'custom\'?\'flex\':\'none\'">'
    +'<option value="this_month">This Month</option>'
    +'<option value="last_month">Last Month</option>'
    +'<option value="this_quarter">This Quarter</option>'
    +'<option value="ytd">Year to Date</option>'
    +'<option value="last_year">Last Year</option>'
    +'<option value="custom">Custom Range</option>'
    +'</select>'
    +'</div>'

    +'<div id="acc-custom-dates" style="display:none;gap:10px;margin-bottom:14px">'
    +'<div class="field" style="flex:1"><label class="field-label">From</label><input type="date" class="inp" id="acc-export-start"></div>'
    +'<div class="field" style="flex:1"><label class="field-label">To</label><input type="date" class="inp" id="acc-export-end"></div>'
    +'</div>'

    +'<div style="display:flex;gap:8px;justify-content:flex-end">'
    +'<button class="btn btn-secondary" onclick="document.getElementById(\'accounting-export-overlay\').remove()">Cancel</button>'
    +'<button class="btn btn-primary" onclick="'
    +'var fmt=document.getElementById(\'acc-export-format\').value;'
    +'var tf=document.getElementById(\'acc-export-timeframe\').value;'
    +'var cs=document.getElementById(\'acc-export-start\').value;'
    +'var ce=document.getElementById(\'acc-export-end\').value;'
    +'exportAccountingCSV(fmt,tf,cs,ce);'
    +'document.getElementById(\'accounting-export-overlay\').remove();'
    +'">Export CSV</button>'
    +'</div>'

    +'<div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:8px;font-size:11px;color:var(--muted)">'
    +'<b>Format notes:</b> Xero/QuickBooks/Sage use Date, Description, Amount with header row. '
    +'FreeAgent uses Date, Amount, Description without header. All dates DD/MM/YYYY, no currency symbols. '
    +'Income is positive, expenses negative. Xero max 500 rows.'
    +'</div>'

    +'</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
}
