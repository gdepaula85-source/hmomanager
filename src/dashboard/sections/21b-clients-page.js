// ── BUSINESS CLIENTS — sub-tab on the Tenants page ──────────────────────────
// A "client" is a parent entity (usually a business — e.g. a rent-to-rent
// company) that holds one or more tenancies. Each tenancy still maps 1:1 to a
// property/room and carries its own rent / contract / signing flow. The
// dashboard groups tenancy rows by client_id so a single company holding 8
// properties shows as one row with an expandable portfolio view.

// ── List view (renders inside the Tenants page when "Business Clients" is the active sub-tab) ──
function renderBusinessClientsList() {
  var clients = (state.clients || []).filter(function(c){ return (c.type||'business') === 'business'; });
  var q = (state.filters.clientQ || '').toLowerCase();
  if (q) {
    clients = clients.filter(function(c){
      return (c.name||'').toLowerCase().indexOf(q) >= 0
          || (c.contactPerson||'').toLowerCase().indexOf(q) >= 0
          || (c.email||'').toLowerCase().indexOf(q) >= 0;
    });
  }
  // Aggregate per-client portfolio metrics from existing tenancy rows.
  function statsFor(clientId){
    var tts = (state.tenants||[]).filter(function(t){ return String(t.clientId)===String(clientId) && t.status!=='inactive'; });
    var monthly = 0;
    tts.forEach(function(t){
      monthly += (t.freq==='monthly') ? (+t.rent||0) : Math.round(((+t.rent||0)*52)/12);
    });
    var arrears = tts.reduce(function(s,t){ return s + (+t.arrears||0); }, 0);
    return { propCount: tts.length, monthlyRent: monthly, arrears: arrears };
  }

  var html = '';
  // Search row
  html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">'
    +   '<div style="flex:1;position:relative;min-width:160px">'
    +     '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--gray-500)">🔍</span>'
    +     '<input class="inp" placeholder="Search business clients…" value="' + esc(state.filters.clientQ || '') + '" oninput="state.filters.clientQ=this.value;render()" style="width:100%;padding-left:30px;border-radius:var(--radius-md);background:#fff;border:1px solid var(--gray-200);font-size:13px;height:38px">'
    +   '</div>'
    + '</div>';

  if (!clients.length) {
    html += '<div style="background:#fff;border:1px solid var(--gray-200);border-radius:14px;padding:36px 24px;text-align:center;color:var(--gray-500)">'
      +    '<div style="font-size:36px;margin-bottom:8px">🏢</div>'
      +    '<div style="font-size:15px;font-weight:700;color:var(--gray-700);margin-bottom:6px">No business clients yet</div>'
      +    '<div style="font-size:12px;line-height:1.6;max-width:360px;margin:0 auto">Click <strong>+ Add</strong>, switch the type to <strong>Business client</strong>, and add their first property. Future tenancies for the same company can be added from this tab.</div>'
      +  '</div>';
    return html;
  }

  html += '<div style="display:grid;gap:10px">';
  clients.forEach(function(c){
    var s = statsFor(c.id);
    var contactBits = [];
    if (c.contactPerson) contactBits.push(esc(c.contactPerson));
    if (c.email)         contactBits.push(esc(c.email));
    if (c.phone)         contactBits.push(esc(c.phone));
    html += '<div onclick="openBusinessClientDetail(\''+c.id+'\')" style="background:#fff;border:1px solid var(--gray-200);border-radius:12px;padding:14px 16px;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;transition:transform .12s ease,box-shadow .12s ease" onmouseover="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 6px 18px rgba(0,0,0,.06)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">'
      +   '<div style="min-width:0">'
      +     '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
      +       '<span style="font-size:13px;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.name||'(unnamed)')+'</span>'
      +       '<span style="font-size:9px;font-weight:800;background:var(--green-light, #ECFDF5);color:var(--green-dark, #047857);padding:2px 7px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase;flex-shrink:0">Business</span>'
      +     '</div>'
      +     (contactBits.length
            ? '<div style="font-size:11px;color:var(--gray-500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+contactBits.join(' · ')+'</div>'
            : '<div style="font-size:11px;color:var(--gray-400);font-style:italic">No contact details on file</div>')
      +   '</div>'
      +   '<div style="text-align:right;font-family:\'DM Mono\',monospace">'
      +     '<div style="font-size:13px;font-weight:800;color:var(--text)">£'+s.monthlyRent.toLocaleString()+'<span style="font-size:10px;color:var(--gray-500);font-weight:500;margin-left:2px">/mo</span></div>'
      +     '<div style="font-size:11px;color:var(--gray-500);margin-top:2px">'+s.propCount+' propert'+(s.propCount===1?'y':'ies')+(s.arrears>0 ? ' · <span style="color:var(--red);font-weight:700">£'+Math.round(s.arrears).toLocaleString()+' arrears</span>' : '')+'</div>'
      +   '</div>'
      + '</div>';
  });
  html += '</div>';
  return html;
}

// ── Detail modal: client profile + portfolio of properties ──
function openBusinessClientDetail(clientId){
  var c = (state.clients||[]).find(function(x){ return String(x.id) === String(clientId); });
  if (!c) { if (typeof showToast==='function') showToast('Client not found','error'); return; }
  var tts = (state.tenants||[]).filter(function(t){ return String(t.clientId) === String(clientId) && t.status !== 'inactive'; });
  var totalMonthly = tts.reduce(function(s,t){ return s + ((t.freq==='monthly') ? (+t.rent||0) : Math.round(((+t.rent||0)*52)/12)); }, 0);
  var totalArrears = tts.reduce(function(s,t){ return s + (+t.arrears||0); }, 0);
  var html = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:600px">'
    +   '<div class="modal-header">'
    +     '<span class="modal-title">🏢 ' + esc(c.name||'(unnamed)') + '</span>'
    +     '<button class="modal-close" onclick="closeModal()">&times;</button>'
    +   '</div>'
    +   '<div class="modal-body" style="max-height:70vh;overflow-y:auto">'
    +     '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
    +       '<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Properties</div><div style="font-size:18px;font-weight:800;color:var(--text);font-family:\'DM Mono\',monospace">'+tts.length+'</div></div>'
    +       '<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Monthly</div><div style="font-size:18px;font-weight:800;color:var(--green);font-family:\'DM Mono\',monospace">£'+totalMonthly.toLocaleString()+'</div></div>'
    +       '<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Arrears</div><div style="font-size:18px;font-weight:800;color:'+(totalArrears>0?'var(--red)':'var(--text)')+';font-family:\'DM Mono\',monospace">£'+Math.round(totalArrears).toLocaleString()+'</div></div>'
    +     '</div>'
    +     '<div class="field"><label class="field-label">Business Name</label><input class="inp" id="bc-name" value="'+esc(c.name||'')+'"></div>'
    +     '<div class="row-2">'
    +       '<div class="field"><label class="field-label">Contact Person</label><input class="inp" id="bc-contact" value="'+esc(c.contactPerson||'')+'"></div>'
    +       '<div class="field"><label class="field-label">Company No.</label><input class="inp" id="bc-compno" value="'+esc(c.companyNo||'')+'"></div>'
    +     '</div>'
    +     '<div class="row-2">'
    +       '<div class="field"><label class="field-label">Email</label><input class="inp" id="bc-email" type="email" value="'+esc(c.email||'')+'"></div>'
    +       '<div class="field"><label class="field-label">WhatsApp / Phone</label><input class="inp" id="bc-phone" type="tel" value="'+esc(c.phone||'')+'"></div>'
    +     '</div>'
    +     '<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="bc-notes" rows="2">'+esc(c.notes||'')+'</textarea></div>'
    +     '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:18px 0 8px;display:flex;justify-content:space-between;align-items:center">'
    +       '<span>Portfolio (' + tts.length + ')</span>'
    +       '<button onclick="addTenancyForClient(\''+c.id+'\')" style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:7px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;font-family:inherit;text-transform:none;letter-spacing:0">+ Add property</button>'
    +     '</div>';
  if (tts.length) {
    tts.forEach(function(t){
      var freqLbl = t.freq==='monthly' ? '/mo' : '/wk';
      html += '<div onclick="closeModal();openTenantDetail(\''+t.id+'\')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:9px;margin-bottom:6px;cursor:pointer">'
        +   '<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        +     '<div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(t.property)+(t.room ? ' · Room '+t.room : '')+'</div>'
        +     '<div style="font-size:11px;color:var(--muted)">Started '+esc(t.startDate||t.checkIn||'—')+'</div>'
        +   '</div>'
        +   '<div style="font-family:\'DM Mono\',monospace;font-weight:700;color:var(--green);font-size:13px;flex-shrink:0">£'+(+t.rent||0).toLocaleString()+'<span style="font-size:10px;color:var(--muted);font-weight:400">'+freqLbl+'</span></div>'
        + '</div>';
    });
  } else {
    html += '<div style="background:var(--bg);border:1px dashed var(--border);border-radius:9px;padding:14px;text-align:center;font-size:12px;color:var(--muted)">No properties yet — click <strong>+ Add property</strong> to attach the first one.</div>';
  }
  html += '</div>'
    +   '<div class="modal-footer" style="justify-content:space-between">'
    +     '<button onclick="deleteBusinessClient(\''+c.id+'\')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">🗑 Delete</button>'
    +     '<div style="display:flex;gap:8px">'
    +       '<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +       '<button onclick="saveBusinessClientDetail(\''+c.id+'\')" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save</button>'
    +     '</div>'
    +   '</div>'
    + '</div></div>';
  document.getElementById('modal-container').innerHTML = html;
}

// Persists the client profile edit. Tenancy rows are not touched here — the
// dashboard sources email/whatsapp from the client at runtime, so updating
// the client cascades naturally to every property under it.
function saveBusinessClientDetail(clientId){
  if (!requirePerm('canEdit', 'edit business client details')) return;
  var c = (state.clients||[]).find(function(x){ return String(x.id) === String(clientId); });
  if (!c) return;
  var g = function(id){ var el = document.getElementById(id); return el ? el.value : null; };
  c.name          = (g('bc-name')||'').trim() || c.name;
  c.contactPerson = (g('bc-contact')||'').trim();
  c.companyNo     = (g('bc-compno')||'').trim();
  c.email         = (g('bc-email')||'').trim();
  c.phone         = (g('bc-phone')||'').trim().replace(/\s+/g,'');
  c.whatsapp      = c.phone.replace(/^\+/,'');
  c.notes         = (g('bc-notes')||'').trim();
  closeModal();
  saveState();
  render();
  if (typeof showToast === 'function') showToast('Client updated','success');
}

// Soft-deletes the client. Tenancy rows are kept (their client_id is nulled
// via on-delete-set-null on the FK), so historical rent / contracts survive.
function deleteBusinessClient(clientId){
  if (!requirePerm('canDelete', 'delete a business client')) return;
  var c = (state.clients||[]).find(function(x){ return String(x.id) === String(clientId); });
  if (!c) return;
  var tenancyCount = (state.tenants||[]).filter(function(t){ return String(t.clientId)===String(clientId); }).length;
  var msg = 'Delete ' + (c.name||'this client') + '?';
  if (tenancyCount) msg += '\n\n⚠ ' + tenancyCount + ' tenanc' + (tenancyCount===1?'y':'ies') + ' will become unlinked individuals (the tenancies and their rent history are preserved).';
  msg += '\n\nThis cannot be undone.';
  if (!confirm(msg)) return;
  // Detach client_id from any in-memory tenants — DB on-delete will mirror.
  (state.tenants||[]).forEach(function(t){ if (String(t.clientId)===String(clientId)) t.clientId = null; });
  state.clients = (state.clients||[]).filter(function(x){ return String(x.id) !== String(clientId); });
  // Best-effort direct delete so the row goes away even before the next debounced save flushes.
  try { supa.from('clients').delete().eq('id', String(clientId)).eq('org_id', _currentOrgId).then(function(){}); } catch(e){}
  closeModal();
  saveState();
  render();
  if (typeof showToast === 'function') showToast('Client deleted','success');
}

// "+ Add property" inside the client detail modal: opens the standard Add
// Tenant flow but pre-flips it into Business mode with the client pre-selected.
// Avoids forking the existing add-tenant code path.
function addTenancyForClient(clientId){
  closeModal();
  if (typeof openModal !== 'function') return;
  openModal('addTenant');
  // The modal is rendered synchronously in this codebase, so the elements are
  // immediately available — no need for setTimeout / mutation observer.
  try {
    var bizRadio = document.querySelector('input[name="f-tcategory"][value="business"]');
    if (bizRadio) {
      bizRadio.checked = true;
      if (typeof onTenantCategoryChange === 'function') onTenantCategoryChange();
    }
    var sel = document.getElementById('f-tclient');
    if (sel) {
      sel.value = String(clientId);
      if (typeof onClientChange === 'function') onClientChange();
    }
  } catch(e) { console.warn('addTenancyForClient pre-fill failed:', e); }
}

if (typeof window !== 'undefined') {
  window.renderBusinessClientsList = renderBusinessClientsList;
  window.openBusinessClientDetail  = openBusinessClientDetail;
  window.saveBusinessClientDetail  = saveBusinessClientDetail;
  window.deleteBusinessClient      = deleteBusinessClient;
  window.addTenancyForClient       = addTenancyForClient;
}
