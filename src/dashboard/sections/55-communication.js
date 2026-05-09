// ── COMMUNICATION HUB ─────────────────────────────────────────────────────────
// Templates, history, composer + per-tenant message tab.
// Backed by /api/comm/* routes. Email goes through Resend; WhatsApp uses
// click-to-chat via wa.me — the click intent is logged to comm_log so the
// history view can show it alongside email_log entries.

var _commCache = { templates: null, lang: 'en', history: null };

function _withTimeout(promise, ms) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() { reject(new Error('Request timed out — Supabase may be slow. Try again in a moment.')); }, ms);
    promise.then(function(v) { clearTimeout(timer); resolve(v); }, function(e) { clearTimeout(timer); reject(e); });
  });
}
var _commTab = 'templates'; // 'templates' | 'history'

var _COMM_VAR_HELP = [
  ['{{tenant_name}}', "Tenant's full name"],
  ['{{property_name}}', 'Property name'],
  ['{{room_number}}', 'Room number'],
  ['{{rent_amount}}', 'Rent (numeric, locale-formatted)'],
  ['{{currency_symbol}}', 'Currency symbol (£, €, R$ …)'],
  ['{{pay_day}}', 'Pay day (e.g. Monday or "1st of the month")'],
  ['{{move_in}}', 'Check-in date'],
  ['{{move_out_date}}', 'Check-out date'],
  ['{{arrears}}', 'Outstanding balance (formatted)'],
  ['{{landlord_name}}', 'Org / landlord name'],
  ['{{landlord_email}}', 'Reply-to email'],
  ['{{org_name}}', 'Organisation name'],
];

function _commAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function _commEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function _commAuthHeaders() {
  var sr = await supa.auth.getSession();
  var session = sr.data.session;
  if (!session) throw new Error('Not signed in');
  return { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' };
}

function _commNormalizeWhatsappDigits(raw) {
  var s = String(raw || '').replace(/\D+/g, '');
  if (!s) return '';
  if (s.length > 1 && s.charAt(0) === '0' && s.charAt(1) === '0') s = s.slice(2);
  return s;
}

async function _commLoadTemplates(force) {
  if (!force && _commCache.templates) return _commCache.templates;
  var headers = await _withTimeout(_commAuthHeaders(), 10000);
  var url = '/api/comm/templates?orgId=' + encodeURIComponent(_currentOrgId);
  var r = await _withTimeout(fetch(url, { headers: headers }), 12000);
  var d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to load templates');
  _commCache.setupRequired = !!d._setup_required;
  _commCache.templates = d.templates || [];
  return _commCache.templates;
}

async function _commLoadHistory(tenantId) {
  var headers = await _withTimeout(_commAuthHeaders(), 10000);
  var url = '/api/comm/log?orgId=' + encodeURIComponent(_currentOrgId);
  if (tenantId) url += '&tenantId=' + encodeURIComponent(tenantId);
  var r = await _withTimeout(fetch(url, { headers: headers }), 12000);
  var d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to load history');
  return d.entries || [];
}

/** Body of the communications hub (Templates/History tabs + content).
 *  Used by both the standalone /communication page and the Tenants > 💬
 *  Communications sub-tab. No screen header — caller is responsible for that. */
function _renderCommBody() {
  // Templates / History tabs row + "+ New Template" action on the right
  var tabs = [
    { id: 'templates', label: 'Templates' },
    { id: 'history', label: 'History' }
  ];
  var html = '<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:16px;align-items:center">';
  tabs.forEach(function(t) {
    var active = t.id === _commTab;
    html += '<button onclick="_commSetTab(\'' + t.id + '\')" style="padding:10px 18px;border:none;border-bottom:2px solid ' + (active ? 'var(--accent,#3B82F6)' : 'transparent') + ';background:transparent;font-size:13px;font-weight:' + (active ? 700 : 500) + ';color:' + (active ? 'var(--accent-dark,#1E40AF)' : 'var(--muted)') + ';cursor:pointer;font-family:inherit;margin-bottom:-1px">' + t.label + '</button>';
  });
  // Always-visible "+ New Template" button on the right of the tab row
  html += '<button onclick="openCommunicationTemplateEditor(null)" style="margin-left:auto;margin-bottom:6px;padding:7px 14px;border-radius:999px;border:none;background:var(--accent,#3B82F6);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ New Template</button>';
  html += '</div>';

  if (_commTab === 'templates') {
    html += '<div id="comm-templates-body"><div style="padding:30px;text-align:center;color:var(--muted)">Loading…</div></div>';
    setTimeout(_commRenderTemplatesBody, 0);
  } else {
    html += '<div id="comm-history-body"><div style="padding:30px;text-align:center;color:var(--muted)">Loading…</div></div>';
    setTimeout(_commRenderHistoryBody, 0);
  }
  return html;
}

/** Standalone /communication page (kept for backward-compat with old links).
 *  The same body renders inside Tenants > 💬 Communications going forward. */
function renderCommunication() {
  var html = renderScreenHeader({
    title: 'Communication',
    subtitle: 'Send templated messages to tenants via email or WhatsApp',
    rightActions: []
  });
  html += _renderCommBody();
  return html;
}

function _commSetTab(tab) {
  _commTab = tab;
  render();
}

async function _commRenderTemplatesBody() {
  var el = document.getElementById('comm-templates-body');
  if (!el) return;
  try {
    var all = await _commLoadTemplates(true);

    // DB tables not yet created — show setup instructions instead of blank page
    if (_commCache.setupRequired) {
      el.innerHTML = '<div style="padding:48px 24px;text-align:center;background:var(--bg);border:1px dashed var(--border);border-radius:12px;max-width:560px;margin:0 auto">'
        + '<div style="font-size:32px;margin-bottom:12px">⚙️</div>'
        + '<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">Database setup required</div>'
        + '<div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:16px">The Communication Hub tables have not been created in your Supabase project yet. Run these three SQL files in order:</div>'
        + '<div style="text-align:left;background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-size:12px;font-family:monospace;color:var(--text);line-height:2">'
        + '1. db/communication_templates.sql<br>'
        + '2. db/communication_log.sql<br>'
        + '3. db/communication_templates_seed.sql'
        + '</div>'
        + '</div>';
      return;
    }

    var lang = _commCache.lang;
    var languages = {};
    all.forEach(function(t) { languages[t.language] = true; });
    var langKeys = Object.keys(languages).sort();
    if (langKeys.indexOf(lang) < 0 && langKeys.length) lang = langKeys[0];
    var filtered = all.filter(function(t) { return t.language === lang; });

    var html = '';
    if (langKeys.length > 1) {
      html += '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">';
      langKeys.forEach(function(lk) {
        var active = lk === lang;
        var label = lk === 'pt-BR' ? 'Português (BR)' : lk === 'en' ? 'English' : lk;
        html += '<button onclick="_commSetLang(\'' + lk + '\')" style="padding:6px 12px;border-radius:999px;border:1px solid ' + (active ? 'var(--accent,#3B82F6)' : 'var(--border)') + ';background:' + (active ? 'var(--accent,#3B82F6)' : '#fff') + ';color:' + (active ? '#fff' : 'var(--text)') + ';font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">' + label + '</button>';
      });
      html += '</div>';
    }

    if (!filtered.length) {
      html += '<div style="padding:40px;text-align:center;color:var(--muted);background:var(--bg);border:1px dashed var(--border);border-radius:12px">No templates yet for this language. Click <strong>+ New Template</strong> to create one.</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
      filtered.forEach(function(t) {
        var channelIcon = t.channel === 'email' ? '✉️' : t.channel === 'whatsapp' ? '💬' : '✉️💬';
        html += '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;flex-direction:column">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
        html += '<span style="font-size:14px;font-weight:700;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _commEsc(t.name) + '</span>';
        if (t.is_builtin) html += '<span style="font-size:10px;font-weight:700;color:var(--accent-dark,#1E40AF);background:var(--accent-light,#DBEAFE);padding:2px 7px;border-radius:999px">Built-in</span>';
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">' + channelIcon + ' · ' + _commEsc(t.language) + '</div>';
        html += '<div style="font-size:12px;color:var(--muted);background:var(--bg);border-radius:8px;padding:8px;margin-bottom:10px;max-height:60px;overflow:hidden;line-height:1.4">' + _commEsc((t.body_text || '').slice(0, 140)) + (t.body_text && t.body_text.length > 140 ? '…' : '') + '</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto">';
        html += '<button onclick="openCommunicationComposer(\'' + t.id + '\', null)" style="flex:1;min-width:80px;padding:7px;border-radius:7px;border:none;background:var(--accent,#3B82F6);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">📨 Send</button>';
        html += '<button onclick="openCommunicationTemplateEditor(\'' + t.id + '\')" style="padding:7px 10px;border-radius:7px;border:1px solid var(--border);background:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit" title="Edit">✏️</button>';
        html += '<button onclick="duplicateCommTemplate(\'' + t.id + '\')" style="padding:7px 10px;border-radius:7px;border:1px solid var(--border);background:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit" title="Duplicate">📋</button>';
        if (!t.is_builtin) {
          html += '<button onclick="deleteCommTemplate(\'' + t.id + '\')" style="padding:7px 10px;border-radius:7px;border:1px solid var(--red,#E8375A);background:#fff;color:var(--red,#E8375A);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit" title="Delete">🗑</button>';
        }
        html += '</div></div>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--red,#E8375A)">' + _commEsc(e.message) + '</div>';
  }
}

function _commSetLang(lang) {
  _commCache.lang = lang;
  _commRenderTemplatesBody();
}

async function _commRenderHistoryBody(targetEl, tenantId) {
  var el = targetEl || document.getElementById('comm-history-body');
  if (!el) return;
  try {
    var entries = await _commLoadHistory(tenantId || null);
    if (!entries.length) {
      el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);background:var(--bg);border:1px dashed var(--border);border-radius:12px">No messages sent yet.</div>';
      return;
    }
    var tenantsById = {};
    (state.tenants || []).forEach(function(t) { tenantsById[t.id] = t; });
    var html = '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead style="background:var(--bg)"><tr>';
    html += '<th style="text-align:left;padding:8px 12px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--border)">When</th>';
    html += '<th style="text-align:left;padding:8px 12px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--border)">Channel</th>';
    if (!tenantId) html += '<th style="text-align:left;padding:8px 12px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--border)">Tenant</th>';
    html += '<th style="text-align:left;padding:8px 12px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--border)">Subject / Preview</th>';
    html += '<th style="text-align:left;padding:8px 12px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--border)">Status</th>';
    html += '</tr></thead><tbody>';
    entries.forEach(function(e) {
      var d = new Date(e.created_at);
      var dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      var icon = e.channel === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email';
      var t = tenantsById[e.tenant_id];
      var name = t ? t.name : (e.recipient || '—');
      var preview = e.subject || e.preview || '';
      var statusColor = e.status === 'sent' ? 'var(--green,#00B894)' : e.status === 'opened' ? 'var(--muted)' : 'var(--red,#E8375A)';
      html += '<tr>';
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--muted)">' + _commEsc(dateStr) + '</td>';
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--border);white-space:nowrap">' + icon + '</td>';
      if (!tenantId) html += '<td style="padding:8px 12px;border-bottom:1px solid var(--border)">' + _commEsc(name) + '</td>';
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text)">' + _commEsc(preview.slice(0, 80)) + (preview.length > 80 ? '…' : '') + '</td>';
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--border);color:' + statusColor + ';font-weight:600">' + _commEsc(e.status) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--red,#E8375A)">' + _commEsc(e.message) + '</div>';
  }
}

// ── Template editor modal ─────────────────────────────────────────────────────
async function openCommunicationTemplateEditor(templateId) {
  var template = null;
  if (templateId) {
    var all = await _commLoadTemplates(false);
    template = all.find(function(t) { return t.id === templateId; }) || null;
  }
  var t = template || { name: '', language: _commCache.lang || 'en', channel: 'both', subject: '', body_text: '', body_html: '', is_builtin: false };

  var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">';
  html += '<div class="modal" style="max-width:760px;width:min(760px,calc(100vw - 16px));max-height:90vh;display:flex;flex-direction:column">';
  html += '<div class="modal-header"><span class="modal-title">' + (template ? '✏️ Edit Template' : '+ New Template') + '</span><button class="modal-close" onclick="closeModal()">×</button></div>';
  html += '<div class="modal-body" style="display:grid;grid-template-columns:1fr 220px;gap:18px">';

  // Left: form
  html += '<div>';
  html += '<div class="field"><label class="field-label">Template name</label><input class="inp" id="ct-name" value="' + _commAttr(t.name) + '"' + (t.is_builtin ? '' : '') + '></div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  html += '<div class="field"><label class="field-label">Language</label><select class="inp" id="ct-language"><option value="en"' + (t.language === 'en' ? ' selected' : '') + '>English</option><option value="pt-BR"' + (t.language === 'pt-BR' ? ' selected' : '') + '>Português (BR)</option></select></div>';
  html += '<div class="field"><label class="field-label">Channel</label><select class="inp" id="ct-channel" onchange="_commToggleSubjectField()"><option value="both"' + (t.channel === 'both' ? ' selected' : '') + '>Email + WhatsApp</option><option value="email"' + (t.channel === 'email' ? ' selected' : '') + '>Email only</option><option value="whatsapp"' + (t.channel === 'whatsapp' ? ' selected' : '') + '>WhatsApp only</option></select></div>';
  html += '</div>';
  html += '<div class="field" id="ct-subject-field"' + (t.channel === 'whatsapp' ? ' style="display:none"' : '') + '><label class="field-label">Email subject</label><input class="inp" id="ct-subject" value="' + _commAttr(t.subject) + '"></div>';
  html += '<div class="field"><label class="field-label">Message body</label><textarea class="inp" id="ct-body" style="min-height:240px;font-family:\'DM Mono\',monospace;font-size:13px;line-height:1.5">' + _commEsc(t.body_text) + '</textarea></div>';
  html += '</div>';

  // Right: variable cheat sheet
  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:11px;line-height:1.6">';
  html += '<div style="font-weight:700;color:var(--text);margin-bottom:8px">Variables</div>';
  html += '<div style="color:var(--muted);margin-bottom:8px">Click a chip to copy.</div>';
  _COMM_VAR_HELP.forEach(function(v) {
    html += '<div style="margin-bottom:5px"><code onclick="navigator.clipboard.writeText(\'' + v[0] + '\');showToast(\'Copied ' + v[0] + '\',\'success\')" style="cursor:pointer;background:#fff;border:1px solid var(--border);border-radius:6px;padding:2px 6px;font-size:11px;color:var(--accent-dark,#1E40AF);font-family:\'DM Mono\',monospace">' + v[0] + '</code><div style="color:var(--muted);font-size:10px;margin-top:2px">' + v[1] + '</div></div>';
  });
  html += '</div>';

  html += '</div>'; // body
  html += '<div class="modal-footer">';
  html += '<button onclick="closeModal()" class="btn btn-secondary">Cancel</button>';
  html += '<button onclick="saveCommTemplate(' + (templateId ? '\'' + templateId + '\'' : 'null') + ')" class="btn btn-primary">' + (template ? 'Save changes' : 'Create template') + '</button>';
  html += '</div></div></div>';

  document.getElementById('modal-container').innerHTML = html;
}

function _commToggleSubjectField() {
  var ch = document.getElementById('ct-channel').value;
  var f = document.getElementById('ct-subject-field');
  if (f) f.style.display = ch === 'whatsapp' ? 'none' : '';
}

async function saveCommTemplate(templateId) {
  var name = document.getElementById('ct-name').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }
  var language = document.getElementById('ct-language').value;
  var channel = document.getElementById('ct-channel').value;
  var subject = document.getElementById('ct-subject') ? document.getElementById('ct-subject').value : '';
  var body_text = document.getElementById('ct-body').value;
  if (!body_text.trim()) { showToast('Message body is required', 'error'); return; }
  try {
    var headers = await _commAuthHeaders();
    var url = '/api/comm/templates' + (templateId ? '/' + templateId : '');
    var r = await fetch(url, {
      method: templateId ? 'PUT' : 'POST',
      headers: headers,
      body: JSON.stringify({ orgId: _currentOrgId, name: name, language: language, channel: channel, subject: subject, body_text: body_text })
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Failed to save');
    _commCache.templates = null;
    closeModal();
    showToast(templateId ? 'Template updated' : 'Template created', 'success');
    if (state.page === 'communication') render();
  } catch (e) {
    showToast(e.message || 'Failed to save', 'error');
  }
}

async function duplicateCommTemplate(templateId) {
  try {
    var headers = await _commAuthHeaders();
    var r = await fetch('/api/comm/templates/' + templateId + '/duplicate', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ orgId: _currentOrgId })
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Duplicate failed');
    _commCache.templates = null;
    showToast('Template duplicated', 'success');
    if (state.page === 'communication') render();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteCommTemplate(templateId) {
  if (!confirm('Delete this template?')) return;
  try {
    var headers = await _commAuthHeaders();
    var r = await fetch('/api/comm/templates/' + templateId + '?orgId=' + encodeURIComponent(_currentOrgId), {
      method: 'DELETE',
      headers: headers,
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Delete failed');
    _commCache.templates = null;
    showToast('Template deleted', 'success');
    if (state.page === 'communication') render();
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Composer ──────────────────────────────────────────────────────────────────
async function openCommunicationComposer(templateId, tenantId) {
  var all = await _commLoadTemplates(false);
  var template = all.find(function(t) { return t.id === templateId; });
  if (!template) { showToast('Template not found', 'error'); return; }

  var tenantsList = (state.tenants || []).filter(function(t) { return t.status !== 'inactive'; });
  var preselected = tenantId ? tenantsList.find(function(t) { return t.id === tenantId; }) : null;
  if (!preselected && tenantsList.length === 1) preselected = tenantsList[0];

  var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">';
  html += '<div class="modal" style="max-width:780px;width:min(780px,calc(100vw - 16px));max-height:90vh;display:flex;flex-direction:column">';
  html += '<div class="modal-header"><span class="modal-title">📨 Send: ' + _commEsc(template.name) + '</span><button class="modal-close" onclick="closeModal()">×</button></div>';
  html += '<div class="modal-body">';

  // Tenant picker
  html += '<div class="field"><label class="field-label">Recipient</label><select class="inp" id="cc-tenant" onchange="_commRefreshPreview(\'' + templateId + '\')">';
  html += '<option value="">— Select tenant —</option>';
  tenantsList.forEach(function(t) {
    var sel = preselected && preselected.id === t.id ? ' selected' : '';
    var labelExtra = (t.email ? ' · ' + t.email : '') + (t.whatsapp ? ' · 📱' : '');
    html += '<option value="' + _commAttr(t.id) + '"' + sel + '>' + _commEsc(t.name) + _commEsc(labelExtra) + '</option>';
  });
  html += '</select></div>';

  // Preview
  html += '<div id="cc-preview" style="margin-top:14px"><div style="padding:30px;text-align:center;color:var(--muted)">Pick a tenant to preview the message…</div></div>';

  html += '</div>';
  html += '<div class="modal-footer">';
  html += '<button onclick="closeModal()" class="btn btn-secondary">Cancel</button>';
  html += '<button id="cc-btn-wa" onclick="sendCommViaWhatsapp(\'' + templateId + '\')" class="btn btn-secondary" disabled style="opacity:.5">💬 Open WhatsApp</button>';
  html += '<button id="cc-btn-email" onclick="sendCommViaEmail(\'' + templateId + '\')" class="btn btn-primary" disabled style="opacity:.5">✉️ Send Email</button>';
  html += '</div></div></div>';

  document.getElementById('modal-container').innerHTML = html;
  if (preselected) _commRefreshPreview(templateId);
}

async function _commRefreshPreview(templateId) {
  var tenantId = document.getElementById('cc-tenant').value;
  var prevEl = document.getElementById('cc-preview');
  var emailBtn = document.getElementById('cc-btn-email');
  var waBtn = document.getElementById('cc-btn-wa');
  if (!tenantId) {
    prevEl.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted)">Pick a tenant to preview the message…</div>';
    emailBtn.disabled = true; emailBtn.style.opacity = '.5';
    waBtn.disabled = true; waBtn.style.opacity = '.5';
    return;
  }
  prevEl.innerHTML = '<div style="padding:18px;text-align:center;color:var(--muted)">Rendering preview…</div>';
  try {
    var headers = await _commAuthHeaders();
    var r = await fetch('/api/comm/preview', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ orgId: _currentOrgId, templateId: templateId, tenantId: tenantId })
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Preview failed');
    window._commCurrentPreview = d;
    var html = '';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
    // Email card
    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px">';
    html += '<div style="font-size:11px;font-weight:700;color:var(--accent-dark,#1E40AF);margin-bottom:6px">✉️ EMAIL</div>';
    html += '<div style="font-size:11px;color:var(--muted);margin-bottom:4px">To: ' + _commEsc(d.tenant.email || '(no email on file)') + '</div>';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px">' + _commEsc(d.email.subject || '(no subject)') + '</div>';
    html += '<div style="font-size:12px;line-height:1.55;color:var(--text);white-space:pre-wrap;max-height:280px;overflow-y:auto">' + _commEsc(d.email.text || '') + '</div>';
    html += '</div>';
    // WhatsApp card
    html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px">';
    html += '<div style="font-size:11px;font-weight:700;color:#16A34A;margin-bottom:6px">💬 WHATSAPP</div>';
    html += '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">To: ' + _commEsc(d.tenant.whatsapp || '(no WhatsApp on file)') + '</div>';
    html += '<div style="font-size:12px;line-height:1.55;color:var(--text);background:#DCFCE7;border-radius:10px;padding:10px;white-space:pre-wrap;max-height:280px;overflow-y:auto">' + _commEsc(d.whatsapp.text || '') + '</div>';
    html += '</div>';
    html += '</div>';
    prevEl.innerHTML = html;
    var canEmail = !!(d.tenant.email && d.tenant.email.indexOf('@') >= 0);
    var canWa = !!_commNormalizeWhatsappDigits(d.tenant.whatsapp);
    emailBtn.disabled = !canEmail; emailBtn.style.opacity = canEmail ? '1' : '.5';
    waBtn.disabled = !canWa; waBtn.style.opacity = canWa ? '1' : '.5';
  } catch (e) {
    prevEl.innerHTML = '<div style="padding:18px;text-align:center;color:var(--red,#E8375A)">' + _commEsc(e.message) + '</div>';
  }
}

async function sendCommViaEmail(templateId) {
  var tenantId = document.getElementById('cc-tenant').value;
  if (!tenantId) { showToast('Pick a tenant first', 'error'); return; }
  var btn = document.getElementById('cc-btn-email');
  btn.disabled = true; btn.style.opacity = '.5'; btn.textContent = 'Sending…';
  try {
    var headers = await _commAuthHeaders();
    var r = await fetch('/api/comm/send-email', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ orgId: _currentOrgId, templateId: templateId, tenantId: tenantId })
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Send failed');
    closeModal();
    showToast('Email sent ✓', 'success');
  } catch (e) {
    btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '✉️ Send Email';
    showToast(e.message || 'Send failed', 'error');
  }
}

async function sendCommViaWhatsapp(templateId) {
  var tenantId = document.getElementById('cc-tenant').value;
  if (!tenantId) { showToast('Pick a tenant first', 'error'); return; }
  var preview = window._commCurrentPreview;
  if (!preview) { showToast('Preview not ready', 'error'); return; }
  var digits = _commNormalizeWhatsappDigits(preview.tenant.whatsapp);
  if (!digits) { showToast('Tenant has no WhatsApp number on file', 'error'); return; }
  var text = preview.whatsapp.text || '';
  // Best-effort log of the send intent before opening wa.me
  try {
    var headers = await _commAuthHeaders();
    await fetch('/api/comm/log-whatsapp', {
      method: 'POST', headers: headers,
      body: JSON.stringify({
        orgId: _currentOrgId, tenantId: tenantId, templateId: templateId,
        recipient_handle: digits, preview: text.slice(0, 240),
        metadata: (function() { var tpl = (_commCache.templates || []).find(function(t){return t.id===templateId;}); return { template_name: tpl ? tpl.name : '' }; })()
      })
    });
  } catch (_) { /* don't block the wa.me open if logging fails */ }
  // Sanitise any 4-byte emojis users put in their templates — those would
  // otherwise show as � on the recipient's WhatsApp.
  var safeText = (typeof _waSanitize === 'function') ? _waSanitize(text) : text;
  var url = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(safeText);
  window.open(url, '_blank', 'noopener');
  closeModal();
  showToast('WhatsApp opened — review the message and hit Send', 'success');
}

// ── Per-tenant Messages tab content (used by tenant detail modal) ─────────────
function renderTenantMessagesTab(tenantId) {
  var holderId = 'tm-history-' + tenantId;
  setTimeout(function() {
    var el = document.getElementById(holderId);
    if (el) _commRenderHistoryBody(el, tenantId);
  }, 0);
  var html = '';
  html += '<div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">';
  html += '<div><div style="font-size:13px;font-weight:700">Recent messages</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Email + WhatsApp send history for this tenant.</div></div>';
  html += '<button onclick="openSendMessageForTenant(\'' + tenantId + '\')" style="padding:7px 14px;border-radius:999px;border:none;background:var(--accent,#3B82F6);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📨 Send message</button>';
  html += '</div>';
  html += '<div id="' + holderId + '"><div style="padding:30px;text-align:center;color:var(--muted)">Loading…</div></div>';
  return html;
}

// Helper invoked from the tenant modal action ribbon and Messages tab.
async function openSendMessageForTenant(tenantId) {
  try {
    var all = await _commLoadTemplates(false);
    if (!all.length) { showToast('No templates available — create one first', 'error'); return; }
    // Picker modal with tenant pre-locked.
    var lang = _commCache.lang || 'en';
    var pool = all.filter(function(t) { return t.language === lang; });
    if (!pool.length) pool = all;
    var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">';
    html += '<div class="modal" style="max-width:480px;width:min(480px,calc(100vw - 16px))">';
    html += '<div class="modal-header"><span class="modal-title">📨 Pick a template</span><button class="modal-close" onclick="closeModal()">×</button></div>';
    html += '<div class="modal-body">';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    pool.forEach(function(t) {
      var ch = t.channel === 'email' ? '✉️' : t.channel === 'whatsapp' ? '💬' : '✉️💬';
      html += '<button onclick="closeModal();openCommunicationComposer(\'' + t.id + '\',\'' + tenantId + '\')" style="text-align:left;padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:#fff;cursor:pointer;font-family:inherit">';
      html += '<div style="font-size:13px;font-weight:700;color:var(--text)">' + ch + ' ' + _commEsc(t.name) + '</div>';
      html += '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + _commEsc((t.body_text || '').slice(0, 90)) + (t.body_text && t.body_text.length > 90 ? '…' : '') + '</div>';
      html += '</button>';
    });
    html += '</div></div>';
    html += '<div class="modal-footer"><button onclick="closeModal()" class="btn btn-secondary">Cancel</button></div>';
    html += '</div></div>';
    document.getElementById('modal-container').innerHTML = html;
  } catch (e) {
    showToast(e.message || 'Failed to load templates', 'error');
  }
}
