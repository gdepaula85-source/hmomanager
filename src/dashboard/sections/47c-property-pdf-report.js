// ── Per-property PDF report ───────────────────────────────────────────────────
// Full multi-section portfolio profile for a single property. Opens the PDF
// in a new browser tab so the user can view it first, with the browser's
// native Download button available to save to disk. (On mobile where tabs are
// suppressed, falls back to a direct download.)
//
// Sections (skipped when empty): Overview KPIs · Property info · Rooms table ·
// Tenants table · Finance summary + STR · Compliance status · Inspections
// history · Documents list.

function generatePropertyReportPDF(propertyId) {
  var p = state.properties.find(function(x){ return String(x.id) === String(propertyId); });
  if (!p) { if(typeof showToast==='function') showToast('Property not found','error'); return; }

  var _jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!_jsPDFLib) {
    showToast('PDF library loading — try again', 'error');
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    s.onload = function() {
      var s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js';
      s2.onload = function() { generatePropertyReportPDF(propertyId); };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
    return;
  }

  var jsPDF = _jsPDFLib;
  var doc = new jsPDF('p', 'mm', 'a4');
  var pageW = doc.internal.pageSize.getWidth();
  var pageH = doc.internal.pageSize.getHeight();
  var margin = 15;
  var y = margin;

  var org = state._currentOrg || {};
  var cfg = (state.config) || {};
  var companyName = (state.companies && state.companies[0] && state.companies[0].name) || cfg.siteTitle || cfg.portfolioName || org.name || 'LandlordApp';
  var logoUrl = cfg.logoUrl || '';
  var now = new Date();
  var dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  function addHeader(title) {
    doc.setFillColor(11, 17, 32);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setFillColor(0, 184, 148);
    doc.rect(0, 30, pageW, 1.5, 'F');
    var textX = margin;
    if (logoUrl) {
      try {
        var tKind = logoUrl.indexOf('data:image/png')===0 ? 'PNG'
                  : logoUrl.indexOf('data:image/jpeg')===0 || logoUrl.indexOf('data:image/jpg')===0 ? 'JPEG'
                  : 'PNG';
        doc.addImage(logoUrl, tKind, margin, 6, 18, 18);
        textX = margin + 22;
      } catch (e) {}
    }
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(companyName, textX, 13);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(title + ' — ' + dateStr, textX, 20);
    doc.setFontSize(8);
    doc.text('Property report · ' + (p.name || ''), pageW - margin, 20, { align: 'right' });
    y = 40;
  }
  function checkPageBreak(needed) {
    if (y + (needed || 10) > pageH - 20) { doc.addPage(); addHeader('Property Report (cont.)'); }
  }
  function sectionTitle(title) {
    checkPageBreak(14);
    doc.setFillColor(236, 253, 245);
    doc.rect(margin, y, pageW - margin*2, 7, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 85, 72);
    doc.text(title, margin + 3, y + 5);
    y += 11;
  }
  function kv(label, value, col) {
    checkPageBreak(5);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    var c = col === 'green' ? [16,185,129] : col === 'red' ? [239,68,68] : col === 'amber' ? [245,158,11] : [17,24,39];
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(String(value==null?'—':value), pageW - margin, y, { align: 'right' });
    y += 5;
  }

  addHeader(p.name || 'Property Report');

  // Title block
  doc.setTextColor(17,24,39);
  doc.setFont('helvetica','bold'); doc.setFontSize(20);
  doc.text(p.name || '—', margin, y);
  y += 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.setTextColor(100,116,139);
  doc.text((p.address || p.area || '—') + (p.postcode ? (', ' + p.postcode) : ''), margin, y);
  y += 8;

  // Overview KPIs
  var propTenants = state.tenants.filter(function(t){ return t.property === p.name && t.status !== 'inactive'; });
  var saIncome = (typeof getPropStrMonthlyIncome === 'function') ? getPropStrMonthlyIncome(p) : 0;
  var monthlyIncome = (p.rent || 0) + saIncome;
  var monthlyLL = p.landlord || 0;
  var monthlyProfit = monthlyIncome - monthlyLL;
  var occupancyTxt = p.lettingType === 'whole'
    ? ((p.occupied > 0 ? 'Occupied' : 'Vacant') + ' (' + (p.bedrooms || '?') + ' bed)')
    : (p.occupied + '/' + p.rooms + ' rooms · ' + (p.rooms ? Math.round(p.occupied / p.rooms * 100) : 0) + '%');
  var kpiW = (pageW - margin*2 - 18) / 4;
  var kpis = [
    { label: 'OCCUPANCY',  value: occupancyTxt, col: [17,24,39] },
    { label: 'INCOME/MO',  value: '£' + monthlyIncome.toLocaleString('en-GB'), col: [16,185,129] },
    { label: 'LL COST/MO', value: '£' + monthlyLL.toLocaleString('en-GB'), col: [239,68,68] },
    { label: 'PROFIT/MO',  value: '£' + monthlyProfit.toLocaleString('en-GB'), col: monthlyProfit >= 0 ? [16,185,129] : [239,68,68] }
  ];
  kpis.forEach(function(k, i) {
    var x = margin + i * (kpiW + 6);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, kpiW, 18, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text(k.label, x + 3, y + 5);
    doc.setFontSize(12); doc.setTextColor(k.col[0], k.col[1], k.col[2]);
    doc.text(k.value, x + 3, y + 13);
  });
  y += 24;

  // Property information
  sectionTitle('Property Information');
  kv('Type',          p.type || 'HMO');
  kv('Ownership',     p.ownershipType === 'owned' ? 'Owned' : 'Managed');
  kv('Letting type',  p.lettingType === 'whole' ? 'Whole property' : 'HMO (rooms let individually)');
  if (p.lettingType !== 'whole') kv('Lettable rooms', p.rooms || 0);
  else kv('Bedrooms', p.bedrooms || '—');
  if (p.isStrEnabled) kv('Airbnb / SA enabled', 'Yes', 'amber');
  if (p.ownershipType !== 'owned') {
    kv('Landlord',         p.landlordName || '—');
    kv('Landlord rent/mo', '£' + (p.landlord || 0).toLocaleString('en-GB'), 'red');
  } else if (p.mortgage && p.mortgage.lender) {
    kv('Mortgage lender',  p.mortgage.lender);
    if (p.mortgage.monthlyPayment) kv('Mortgage pmt/mo', '£' + p.mortgage.monthlyPayment.toLocaleString('en-GB'), 'red');
    if (p.mortgage.rate) kv('Rate', p.mortgage.rate + '% ' + (p.mortgage.rateType || ''));
    if (p.mortgage.outstandingBalance) kv('Outstanding balance', '£' + p.mortgage.outstandingBalance.toLocaleString('en-GB'));
  }
  y += 4;

  // Rooms
  if (p.roomList && p.roomList.length && typeof doc.autoTable === 'function') {
    sectionTitle('Rooms');
    var roomRows = p.roomList.map(function(r) {
      var tenant = state.tenants.find(function(t) { return t.property === p.name && t.room === r.n && t.status !== 'inactive'; });
      return [
        p.lettingType === 'whole' ? 'Whole' : ('Room ' + r.n),
        r.type || 'Single',
        '£' + ((+r.price) || 0).toLocaleString('en-GB') + '/wk',
        r.status === 'occupied' ? 'Occupied' : 'Vacant',
        tenant ? tenant.name : '—'
      ];
    });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [['Room', 'Type', 'Rent', 'Status', 'Tenant']],
      body: roomRows,
      theme: 'striped',
      headStyles: { fillColor: [11, 17, 32], textColor: [255,255,255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Tenants
  if (propTenants.length && typeof doc.autoTable === 'function') {
    sectionTitle('Active Tenants');
    var tenantRows = propTenants.map(function(t) {
      return [
        t.name || '—',
        t.room ? 'Rm ' + t.room : '—',
        '£' + (t.rent||0) + '/' + (t.freq === 'monthly' ? 'mo' : 'wk'),
        t.startDate || t.moveIn || '—',
        t.status === 'notice_given' ? 'On Notice' : 'Active',
        t.whatsapp || t.email || '—'
      ];
    });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [['Name', 'Room', 'Rent', 'Check-in', 'Status', 'Contact']],
      body: tenantRows,
      theme: 'striped',
      headStyles: { fillColor: [11, 17, 32], textColor: [255,255,255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Finance
  sectionTitle('Finance (monthly)');
  kv('Tenant rent', '£' + (p.rent||0).toLocaleString('en-GB'), 'green');
  if (saIncome > 0) kv('Airbnb / SA income (latest month)', '£' + saIncome.toLocaleString('en-GB'), 'green');
  kv('Total income', '£' + monthlyIncome.toLocaleString('en-GB'), 'green');
  kv(p.ownershipType === 'owned' ? 'Mortgage' : 'Landlord rent', '£' + monthlyLL.toLocaleString('en-GB'), 'red');
  kv('Net profit', '£' + monthlyProfit.toLocaleString('en-GB'), monthlyProfit >= 0 ? 'green' : 'red');
  y += 2;
  sectionTitle('Finance (annual projection)');
  kv('Gross income',   '£' + (monthlyIncome * 12).toLocaleString('en-GB'), 'green');
  kv(p.ownershipType === 'owned' ? 'Mortgage paid' : 'Landlord rent paid', '£' + (monthlyLL * 12).toLocaleString('en-GB'), 'red');
  kv('Net annual profit', '£' + (monthlyProfit * 12).toLocaleString('en-GB'), monthlyProfit >= 0 ? 'green' : 'red');
  y += 4;

  // Compliance
  if (typeof getPropertyComplianceStatus === 'function') {
    var cs = getPropertyComplianceStatus(p);
    sectionTitle('Compliance Status');
    if (!cs.items || !cs.items.length) {
      doc.setFont('helvetica','italic'); doc.setFontSize(9);
      doc.setTextColor(107,114,128);
      doc.text('No compliance documents uploaded.', margin, y); y += 6;
    } else {
      cs.items.forEach(function(i) {
        var tag = i.state === 'expired' ? 'Expired ' + Math.abs(i.days) + 'd ago'
                : i.state === 'critical' ? (i.days === 0 ? 'Expires today' : 'Expires in ' + i.days + 'd')
                : i.state === 'warning' ? 'Expires in ' + i.days + 'd'
                : i.state === 'missing' ? 'Not uploaded'
                : i.state === 'no-date' ? 'No expiry set'
                : i.days + 'd left';
        var colName = (i.state === 'expired' || i.state === 'critical' || i.state === 'missing') ? 'red'
                    : i.state === 'warning' ? 'amber' : 'green';
        kv(i.label, tag, colName);
      });
    }
    y += 4;
  }

  // Inspections
  if (p.inspections && p.inspections.length) {
    sectionTitle('Inspections');
    var recent = p.inspections.slice().sort(function(a,b){
      return new Date(b.timestamp||0) - new Date(a.timestamp||0);
    }).slice(0, 5);
    recent.forEach(function(insp) {
      checkPageBreak(16);
      var ts = insp.timestamp ? new Date(insp.timestamp) : null;
      var tsLbl = ts && !isNaN(ts.getTime()) ? ts.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.setTextColor(17,24,39);
      doc.text((insp.inspector || 'Inspection') + '  ·  ' + (insp.roomN ? 'Room ' + insp.roomN : 'Whole property'), margin, y);
      doc.setFont('helvetica','normal'); doc.setTextColor(107,114,128);
      doc.text(tsLbl + '  ·  ' + (insp.overallRating || 'Good') + (insp.photos && insp.photos.length ? '  ·  ' + insp.photos.length + ' photos' : ''), pageW - margin, y, { align: 'right' });
      y += 5;
      if (insp.notes) {
        doc.setFontSize(8.5); doc.setTextColor(75,85,99);
        var lines = doc.splitTextToSize(insp.notes, pageW - margin*2);
        checkPageBreak(lines.length * 4);
        doc.text(lines, margin, y);
        y += lines.length * 4 + 2;
      } else {
        y += 2;
      }
    });
    y += 4;
  }

  // Documents
  if (state.propDocs && state.propDocs[p.id] && state.propDocs[p.id].length && typeof doc.autoTable === 'function') {
    sectionTitle('Documents');
    var docRows = state.propDocs[p.id].map(function(d) {
      var daysLeft = null;
      if (d.expiresAt) {
        try { daysLeft = Math.ceil((new Date(d.expiresAt) - new Date()) / 86400000); } catch (e) {}
      }
      return [
        d.type || 'Document',
        d.name || '—',
        d.uploadedAt || '—',
        d.expiresAt ? (new Date(d.expiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + (daysLeft != null ? (' (' + (daysLeft < 0 ? Math.abs(daysLeft)+'d expired' : daysLeft+'d left') + ')') : '')) : '—'
      ];
    });
    doc.autoTable({
      startY: y, margin: { left: margin, right: margin },
      head: [['Type', 'Filename', 'Uploaded', 'Expiry']],
      body: docRows,
      theme: 'striped',
      headStyles: { fillColor: [11, 17, 32], textColor: [255,255,255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Footer page numbers
  var total = doc.internal.getNumberOfPages();
  for (var pi = 1; pi <= total; pi++) {
    doc.setPage(pi);
    doc.setFontSize(8); doc.setTextColor(148,163,184);
    doc.text('Page ' + pi + ' of ' + total, pageW/2, 290, { align: 'center' });
    doc.text(companyName + ' — Confidential', margin, 290);
    doc.text('landlordapp.io', pageW - margin, 290, { align: 'right' });
  }

  // Open in new tab (user can review, then use the browser Download button)
  var filename = (p.name || 'property').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') + '-report-' + now.toISOString().split('T')[0] + '.pdf';
  try {
    var blobUrl = doc.output('bloburl');
    var win = window.open(blobUrl, '_blank');
    if (!win) {
      doc.save(filename);
      if (typeof showToast === 'function') showToast('Popups blocked — PDF downloaded instead', 'warn');
    } else {
      if (typeof showToast === 'function') showToast('PDF opened in a new tab. Use the browser Download button to save.', 'success');
    }
  } catch (e) {
    console.warn('Open-in-tab failed, falling back to save:', e);
    doc.save(filename);
  }
}

if (typeof window !== 'undefined') {
  window.generatePropertyReportPDF = generatePropertyReportPDF;
}
