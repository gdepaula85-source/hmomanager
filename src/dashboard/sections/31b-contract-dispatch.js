// ── Contract dispatch — save / email / WhatsApp ──────────────────────────────
// Generates a PDF from the rendered #agreement-doc-body (toolbar excluded), then
// either downloads, uploads + emails, or uploads + opens a WhatsApp link.
//
// PDF strategy: html2canvas rasterises the doc body at 2× pixel density, then
// jsPDF embeds the resulting image across A4 pages. jsPDF + autotable are already
// loaded by the dashboard shell; html2canvas is loaded lazily from CDN on first
// use so the bundle stays lean for users who never dispatch a contract.

var _html2canvasLoading = null;
function _ensureHtml2Canvas() {
  if (typeof window !== 'undefined' && window.html2canvas) return Promise.resolve(window.html2canvas);
  if (_html2canvasLoading) return _html2canvasLoading;
  _html2canvasLoading = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = function () { resolve(window.html2canvas); };
    s.onerror = function () { _html2canvasLoading = null; reject(new Error('html2canvas failed to load')); };
    document.head.appendChild(s);
  });
  return _html2canvasLoading;
}

function _jsPDFCtor() {
  return (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
}

/**
 * Render an HTML element into an A4 PDF. Returns a jsPDF doc instance + Blob.
 * Pages are stitched by slicing the rendered canvas vertically into A4 chunks
 * so multi-page contracts paginate cleanly without breaking mid-paragraph image.
 */
async function renderElementToPDF(element, opts) {
  if (!element) throw new Error('Nothing to render');
  opts = opts || {};
  var html2canvas = await _ensureHtml2Canvas();
  var jsPDF = _jsPDFCtor();
  if (!jsPDF) throw new Error('jsPDF not loaded');

  var canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
  });

  var pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  var pageW = pdf.internal.pageSize.getWidth();   // 210
  var pageH = pdf.internal.pageSize.getHeight();  // 297
  var margin = 6; // mm — slim margins so the rendered HTML uses the full A4
  var imgW = pageW - margin * 2;
  var pxPerMm = canvas.width / imgW;
  var pageHpx = Math.floor((pageH - margin * 2) * pxPerMm);

  // Slice canvas vertically into A4-page-height chunks.
  var sliceCanvas = document.createElement('canvas');
  sliceCanvas.width = canvas.width;
  var sctx = sliceCanvas.getContext('2d');
  var y = 0;
  var pages = 0;
  while (y < canvas.height) {
    var h = Math.min(pageHpx, canvas.height - y);
    sliceCanvas.height = h;
    sctx.fillStyle = '#fff';
    sctx.fillRect(0, 0, sliceCanvas.width, h);
    sctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    var imgH = h / pxPerMm;
    if (pages > 0) pdf.addPage();
    pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, imgH, undefined, 'FAST');
    y += h;
    pages++;
  }
  var blob = pdf.output('blob');
  return { pdf: pdf, blob: blob, pages: pages };
}

/** Strip dataURL prefix → raw base64 (Resend-friendly). */
function _b64FromBlob(blob) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () {
      var s = String(r.result || '');
      var i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function _slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tenant';
}

/** Upload PDF to tenant-docs storage AND create a tenant_docs row so the
 *  agreement appears in the tenant's Vault tab. Returns {url, storagePath, docId}. */
async function _uploadContractPDF(tenant, blob, fileName, contractType) {
  if (!window.supa || !_currentOrgId) throw new Error('Not signed in');
  var ext = 'pdf';
  var docId = 'tdoc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  var path = 'tenants/' + tenant.id + '/agreements/' + _slug(contractType) + '__' + docId + '.' + ext;
  var up = await supa.storage.from('tenant-docs').upload(path, blob, { upsert: true, contentType: 'application/pdf' });
  if (up && up.error) throw up.error;
  var url = '';
  try {
    var pub = supa.storage.from('tenant-docs').getPublicUrl(path);
    url = (pub && pub.data && pub.data.publicUrl) || '';
  } catch (_e) {}
  if (!url) {
    var sign = await supa.storage.from('tenant-docs').createSignedUrl(path, 60 * 60 * 24 * 365);
    url = (sign && sign.data && sign.data.signedUrl) || '';
  }
  // Persist a vault entry so the tenant can find it later.
  if (!state.vault) state.vault = {};
  if (!state.vault[tenant.id]) state.vault[tenant.id] = [];
  var sizeBytes = blob.size || 0;
  var sizeStr = sizeBytes > 1024 * 1024
    ? (sizeBytes / 1024 / 1024).toFixed(1) + 'MB'
    : Math.round(sizeBytes / 1024) + 'KB';
  var entry = {
    id: docId,
    name: fileName,
    type: 'Tenancy Agreement',
    size: sizeStr,
    uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    dataUrl: url,
    storagePath: path,
  };
  state.vault[tenant.id].push(entry);
  if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
  return { url: url, storagePath: path, docId: docId };
}

/** Friendly file name like `tenancy-agreement-john-smith-2026-04-27.pdf`. */
function _contractFileName(tenant, contractType) {
  var label = contractType === 'excluded_licence' ? 'excluded-licence'
    : contractType === 'company_let'      ? 'company-let'
    : contractType === 'lodger'           ? 'lodger-agreement'
    : contractType === 'room_letting'     ? 'room-letting'
    : contractType === 'renewal'          ? 'renewal'
    : 'tenancy-agreement';
  var iso = new Date().toISOString().split('T')[0];
  return label + '-' + _slug(tenant.name || 'tenant') + '-' + iso + '.pdf';
}

/** Save the contract PDF to the user's downloads folder. */
async function saveContractPDF() {
  var el = document.getElementById('agreement-doc-body');
  if (!el) { showToast && showToast('Could not find contract on page', 'error'); return; }
  var tenantId = el.getAttribute('data-tenant-id');
  var contractType = el.getAttribute('data-contract-type') || 'ast';
  var tenant = (state.tenants || []).find(function (x) { return String(x.id) === String(tenantId); }) || { id: tenantId, name: 'Tenant' };
  var fileName = _contractFileName(tenant, contractType);
  var btn = document.getElementById('contract-action-pdf');
  if (btn) { btn.disabled = true; btn.textContent = 'Building PDF…'; }
  try {
    var out = await renderElementToPDF(el);
    out.pdf.save(fileName);
    showToast && showToast('Saved ' + out.pages + '-page PDF', 'success');
  } catch (e) {
    console.error('Save PDF failed:', e);
    showToast && showToast('PDF generation failed — use the 🖨 Print button to save via your browser', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Save PDF'; }
  }
}

/** Build the PDF, upload it, then call /api/email/send with the file as an attachment. */
async function emailContractPDF() {
  var el = document.getElementById('agreement-doc-body');
  if (!el) return;
  var tenantId = el.getAttribute('data-tenant-id');
  var contractType = el.getAttribute('data-contract-type') || 'ast';
  var tenant = (state.tenants || []).find(function (x) { return String(x.id) === String(tenantId); });
  if (!tenant) { showToast && showToast('Tenant not found', 'error'); return; }
  if (!tenant.email) { showToast && showToast('Tenant has no email on file', 'error'); return; }
  var btn = document.getElementById('contract-action-email');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    var out = await renderElementToPDF(el);
    var fileName = _contractFileName(tenant, contractType);
    var b64 = await _b64FromBlob(out.blob);
    // Best-effort upload so a copy lives in the tenant's vault even if the email fails.
    try { await _uploadContractPDF(tenant, out.blob, fileName, contractType); } catch (_e) { console.warn('Vault upload failed (continuing with email):', _e); }
    var sess = await supa.auth.getSession();
    var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
    if (!token) throw new Error('Not signed in');
    var subjectMap = {
      ast: 'Your Tenancy Agreement',
      excluded_licence: 'Your Excluded Licence Agreement',
      company_let: 'Your Company Let Agreement',
      lodger: 'Your Lodger Agreement',
      room_letting: 'Your Room Letting Agreement',
      renewal: 'Your Tenancy Renewal',
    };
    var co = (state.config && (state.config.portfolioName || state.config.siteTitle)) || 'LandlordApp';
    var firstName = (tenant.name || '').split(' ')[0] || 'there';
    var subject = subjectMap[contractType] || 'Your Tenancy Agreement';
    var text = 'Hi ' + firstName + ',\n\nPlease find your signed agreement attached. Review, sign your copy, and reply to this email with the signed PDF.\n\nThanks,\n' + co;
    var html = '<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">'
      + '<h2 style="font-size:20px;font-weight:700;margin:0 0 12px">Hi ' + firstName + ',</h2>'
      + '<p style="font-size:14px;line-height:1.55;margin:0 0 16px">Please find your <strong>' + (subject.replace(/^Your /, '').toLowerCase()) + '</strong> attached. Have a read through, sign your copy, and reply to this email with the signed PDF.</p>'
      + '<p style="font-size:13px;color:#6B7280;margin:0 0 16px">If you have any questions just reply — happy to walk you through anything.</p>'
      + '<p style="font-size:14px;margin:0">— ' + co + '</p>'
      + '</div>';
    var resp = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        orgId: _currentOrgId,
        to: tenant.email,
        subject: subject,
        text: text,
        html: html,
        kind: 'tenant',
        attachments: [{ filename: fileName, content: b64 }],
      }),
    });
    var data = await resp.json().catch(function () { return {}; });
    if (!resp.ok) throw new Error(data.error || 'Email send failed');
    showToast && showToast('Emailed to ' + tenant.email + ' ✓', 'success');
  } catch (e) {
    console.error('Email contract failed:', e);
    showToast && showToast('Email failed: ' + (e.message || 'unknown'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✉ Email tenant'; }
  }
}

/** Build the PDF, upload to storage, then open WhatsApp prefilled with a link to it. */
async function whatsappContractPDF() {
  var el = document.getElementById('agreement-doc-body');
  if (!el) return;
  var tenantId = el.getAttribute('data-tenant-id');
  var contractType = el.getAttribute('data-contract-type') || 'ast';
  var tenant = (state.tenants || []).find(function (x) { return String(x.id) === String(tenantId); });
  if (!tenant) { showToast && showToast('Tenant not found', 'error'); return; }
  var phone = String(tenant.whatsapp || '').replace(/\D/g, '');
  if (!phone) { showToast && showToast('Tenant has no WhatsApp number on file', 'error'); return; }
  var btn = document.getElementById('contract-action-wa');
  if (btn) { btn.disabled = true; btn.textContent = 'Building…'; }
  try {
    var out = await renderElementToPDF(el);
    var fileName = _contractFileName(tenant, contractType);
    var uploaded = await _uploadContractPDF(tenant, out.blob, fileName, contractType);
    var firstName = (tenant.name || '').split(' ')[0] || 'there';
    var co = (state.config && (state.config.portfolioName || state.config.siteTitle)) || 'LandlordApp';
    var msg = 'Hi ' + firstName + ', here\'s your tenancy agreement: ' + uploaded.url + '\n\nPlease sign and send back. — ' + co;
    // _waSanitize strips any 4-byte emojis from name/co that would mangle to � on WhatsApp.
    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(_waSanitize(msg));
    window.open(url, '_blank', 'noopener');
    showToast && showToast('WhatsApp opened with link', 'success');
  } catch (e) {
    console.error('WhatsApp contract failed:', e);
    showToast && showToast('Could not prepare WhatsApp link: ' + (e.message || 'unknown'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💬 WhatsApp'; }
  }
}

/** HTML for the toolbar action group — used by every contract template.
 *  Send-for-remote-signing reads the agreement body's data-contract-type +
 *  data-tenant-id so the token captures which agreement was sent. */
function contractToolbarActions() {
  return ''
    + '<button onclick="sendCurrentAgreementForSigning()" style="padding:8px 14px;border-radius:8px;border:none;background:#F59E0B;color:#fff;font-size:13px;font-weight:700;cursor:pointer">📤 Send to tenant</button>'
    + '<button id="contract-action-pdf" onclick="saveContractPDF()" style="padding:8px 14px;border-radius:8px;border:none;background:#3B82F6;color:#fff;font-size:13px;font-weight:700;cursor:pointer">⬇ Save PDF</button>'
    + '<button id="contract-action-email" onclick="emailContractPDF()" style="padding:8px 14px;border-radius:8px;border:none;background:#8B5CF6;color:#fff;font-size:13px;font-weight:700;cursor:pointer">✉ Email tenant</button>'
    + '<button id="contract-action-wa" onclick="whatsappContractPDF()" style="padding:8px 14px;border-radius:8px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer">💬 WhatsApp</button>'
    + '<button onclick="window.print()" style="padding:8px 14px;border-radius:8px;border:none;background:#10B981;color:#fff;font-size:13px;font-weight:700;cursor:pointer">🖨 Print</button>';
}

// Resolves contract type + tenant id from the open agreement overlay and
// delegates to sendTenantSigningLink (which calls /api/tenants/:id/sign-token).
function sendCurrentAgreementForSigning() {
  var el = document.querySelector('#agreement-overlay [data-contract-type][data-tenant-id]');
  if (!el) {
    if (typeof showToast === 'function') showToast('Open an agreement first', 'error');
    return;
  }
  var contractType = el.getAttribute('data-contract-type') || 'ast';
  var tenantId = el.getAttribute('data-tenant-id');
  if (!tenantId) return;
  if (typeof sendTenantSigningLink === 'function') sendTenantSigningLink(tenantId, contractType);
}
