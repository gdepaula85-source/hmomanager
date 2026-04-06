// ── HTML email bodies (keep visual parity with public/landlordapp_emails.html) ──
// Manager reports → Template 9 (Monthly Portfolio Report) layout.
// Tenant mail → Section B operator header + body (see Tenant Template 2 style).

var buildManagerReportHtml = function (reportType, stats, subjectLine, textBody) {
  var s = stats || {};
  var firstName = 'there';
  if (typeof state !== 'undefined' && state.currentUser && state.currentUser.name) {
    firstName = String(state.currentUser.name).trim().split(/\s+/)[0] || 'there';
  }
  var occPct = typeof s.occPct === 'number' ? s.occPct : 0;
  var income = s.income != null ? s.income : 0;
  var costs = s.costs != null ? s.costs : 0;
  var net = s.net != null ? s.net : income - costs;
  var propsLen = s.propsLen != null ? s.propsLen : 0;
  var maint = s.maintOpen != null ? s.maintOpen : 0;
  var nowLabel = s.nowLabel || new Date().toLocaleString('en-GB');

  var title =
    reportType === 'monthly'
      ? 'Your monthly P&amp;L summary'
      : reportType === 'test'
        ? 'Connection test'
        : 'Your weekly portfolio summary';
  var monthPhrase =
    reportType === 'monthly'
      ? new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : reportType === 'weekly'
        ? 'Week of ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  var grossStr = '£' + Number(income).toLocaleString('en-GB');
  var costsStr = '£' + Number(costs).toLocaleString('en-GB');
  var netStr = '£' + Number(net).toLocaleString('en-GB');
  var styles = [
    '.em{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#F8F9FB}',
    '.em-header{background:linear-gradient(135deg,#0F172A 0%,#1a1a3e 100%);padding:28px 36px}',
    '.em-logo-name{font-size:18px;font-weight:800;color:#fff;letter-spacing:-.3px}',
    '.em-logo-name span{color:#00B894}',
    '.em-body{background:#fff;padding:36px}',
    '.em-greeting{font-size:22px;font-weight:700;color:#0F172A;margin:0 0 10px;line-height:1.3}',
    '.em-p{font-size:15px;color:#475569;line-height:1.7;margin:0 0 16px}',
    '.em-p strong{color:#0F172A}',
    '.em-btn{display:inline-block;background:#00B894;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:10px;margin:8px 0 20px}',
    '.em-divider{border:none;border-top:1px solid #E8ECF0;margin:24px 0}',
    '.em-small{font-size:12px;color:#94A3B8;line-height:1.6;margin:0}',
    '.em-footer{background:#F8F9FB;padding:22px 36px;border-top:1px solid #E8ECF0}',
    '.em-footer-links a{font-size:12px;color:#64748B;text-decoration:none;margin-right:18px}',
    '.em-footer-copy{font-size:11px;color:#94A3B8;margin:0}',
    '.em-kpi{display:flex;gap:0;background:#F8F9FB;border:1px solid #E8ECF0;border-radius:12px;overflow:hidden;margin:20px 0}',
    '.em-kpi-cell{flex:1;padding:16px;text-align:center;border-right:1px solid #E8ECF0}',
    '.em-kpi-cell:last-child{border-right:none}',
    '.em-kpi-val{font-size:22px;font-weight:800;color:#0F172A;font-family:Courier New,monospace}',
    '.em-kpi-lbl{font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}',
    '.em-table{width:100%;border-collapse:collapse;margin:16px 0}',
    '.em-table th{background:#0F172A;color:#fff;font-size:11px;font-weight:700;padding:10px 14px;text-align:left;text-transform:uppercase;letter-spacing:.06em}',
    '.em-table td{font-size:13px;color:#475569;padding:10px 14px;border-bottom:1px solid #E8ECF0}',
    '.em-table tr:last-child td{border-bottom:none}',
    '.em-table td strong{color:#0F172A}',
    '.em-table .highlight td{background:#E8F8F5}',
    '.em-table .highlight td strong{color:#00B894}',
    '.em-pre{font-size:13px;color:#475569;white-space:pre-wrap;line-height:1.6;margin:0}',
  ].join('');

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    String(subjectLine).replace(/</g, '') +
    '</title><style>' +
    styles +
    '</style></head><body style="margin:0;background:#F8F9FB"><div class="em"><div class="em-header"><div class="em-logo-name">Landlord<span>App</span>.io</div></div><div class="em-body"><p class="em-greeting">Hi ' +
    escapeHtml(firstName) +
    ' — ' +
    title +
    '</p><p class="em-p">' +
    (reportType === 'test'
      ? 'This is a test message from your dashboard. If you can read this, outbound email is configured correctly.'
      : "Here's a snapshot of your HMO portfolio. Figures match the plain-text summary below.") +
    '</p><div class="em-kpi"><div class="em-kpi-cell"><div class="em-kpi-val">' +
    occPct +
    '%</div><div class="em-kpi-lbl">Occupancy</div></div><div class="em-kpi-cell"><div class="em-kpi-val">' +
    grossStr +
    '</div><div class="em-kpi-lbl">Gross income (mo)</div></div><div class="em-kpi-cell"><div class="em-kpi-val">' +
    netStr +
    '</div><div class="em-kpi-lbl">Net (est.)</div></div></div><table class="em-table"><tr><th>Metric</th><th>This period</th><th>Notes</th></tr><tr><td>Properties</td><td><strong>' +
    propsLen +
    '</strong></td><td>—</td></tr><tr><td>Gross income</td><td><strong>' +
    grossStr +
    '</strong></td><td>' +
    monthPhrase +
    '</td></tr><tr><td>Landlord costs</td><td><strong>' +
    costsStr +
    '</strong></td><td>—</td></tr><tr class="highlight"><td><strong>Net</strong></td><td><strong>' +
    netStr +
    '</strong></td><td>Open maintenance: ' +
    maint +
    '</td></tr></table><hr class="em-divider"><p class="em-small" style="margin-bottom:12px">Plain summary (same as above)</p><pre class="em-pre">' +
    escapeHtml(textBody) +
    '</pre><hr class="em-divider"><a href="https://landlordapp.io" class="em-btn">Open dashboard</a><p class="em-small">Sent ' +
    escapeHtml(nowLabel) +
    '. Reply to this email to reach your organisation contact.</p></div><div class="em-footer"><div class="em-footer-links"><a href="https://landlordapp.io">Dashboard</a><a href="mailto:admin@landlordapp.io">Support</a></div><p class="em-footer-copy">&copy; 2026 LandlordApp.io</p></div></div></body></html>'
  );
};

var escapeHtml = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

var buildTenantOutboundHtml = function (subjectLine, textBody, tenantMeta) {
  var m = tenantMeta || {};
  var company = m.companyName || 'Your property manager';
  var phone = m.companyPhone || '';
  var emailC = m.companyEmail || '';
  var first = m.firstName || 'there';
  var lines = String(textBody || '').split(/\n/);
  var paras = lines
    .filter(function (ln) {
      return String(ln).trim().length;
    })
    .map(function (ln) {
      return '<p class="em-p">' + escapeHtml(ln) + '</p>';
    })
    .join('');

  var styles = [
    '.em{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#F8F9FB}',
    '.em-header{background:linear-gradient(135deg,#0F172A 0%,#1a1a3e 100%);padding:24px 28px}',
    '.em-body{background:#fff;padding:32px}',
    '.em-greeting{font-size:20px;font-weight:700;color:#0F172A;margin:0 0 12px;line-height:1.35}',
    '.em-p{font-size:15px;color:#475569;line-height:1.7;margin:0 0 14px}',
    '.em-footer{background:#F8F9FB;padding:20px 28px;border-top:1px solid #E8ECF0;font-size:11px;color:#94A3B8}',
    '.em-footer a{color:#00B894;text-decoration:none}',
  ].join('');

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    escapeHtml(subjectLine) +
    '</title><style>' +
    styles +
    '</style></head><body style="margin:0;background:#F8F9FB"><div class="em"><div class="em-header"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td><div style="font-size:20px;font-weight:800;color:#fff">' +
    escapeHtml(company) +
    '</div><div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:4px">Property management</div></td><td align="right" style="font-size:11px;color:rgba(255,255,255,.5);line-height:1.6">' +
    (function () {
      var h = '';
      if (phone) h += escapeHtml(phone);
      if (phone && emailC) h += '<br>';
      if (emailC) h += escapeHtml(emailC);
      return h || '&nbsp;';
    })() +
    '</td></tr></table></div><div class="em-body"><p class="em-greeting">Hi ' +
    escapeHtml(first) +
    '</p>' +
    paras +
    '<hr style="border:none;border-top:1px solid #E8ECF0;margin:24px 0"><p class="em-p" style="font-size:13px;color:#64748B;margin:0">Questions? Reply to this email or contact us using the details above.</p></div><div class="em-footer">Sent via <a href="https://landlordapp.io">LandlordApp.io</a> · ' +
    escapeHtml(company) +
    '</div></div></body></html>'
  );
};
