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
