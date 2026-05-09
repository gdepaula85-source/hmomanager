// ── TENANTS IMPORT ────────────────────────────────────────────────────────────
function renderImportTenants() {
  var html = '';

  if(!_importPreview || _importPreview.type !== 'tenants') {
    html += '<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:18px;margin-bottom:16px">'
      +'<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">📋 How to import</div>'
      +'<div style="font-size:12px;color:var(--muted);line-height:1.7">'
      +'Upload your Base44 tenants export (.csv). Required: <strong>Name, Phone</strong>. '
      +'Optional: Property, Room, Rent Amount, Rent Frequency, Check-in Date, Status. '
      +'Phones are auto-normalised to 447XXXXXXXXX. Fake @tenant.com emails are ignored. '
      +'Names with property codes (e.g. "Marcus Q3") are flagged for review.'
      +'</div></div>';

    html += '<div style="border:2px dashed var(--accent);border-radius:12px;padding:32px;text-align:center;background:var(--accent-light);margin-bottom:16px">'
      +'<div style="font-size:36px;margin-bottom:10px">👥</div>'
      +'<div style="font-size:14px;font-weight:700;color:var(--accent-dark);margin-bottom:6px">Upload Tenants CSV</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:16px">Base44 tenants export (.csv)</div>'
      +'<input type="file" id="tenant-import-file" accept=".csv" style="display:none" onchange="handleTenantsFile(this)">'
      +'<button onclick="document.getElementById(\'tenant-import-file\').click()" style="padding:11px 24px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Choose File</button>'
      +'</div>';
    return html;
  }

  var preview = _importPreview;
  var rows = preview.rows;
  var warnings = preview.warnings || [];
  var flagged = rows.filter(function(r){return r._flagged;}).length;

  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
    +'<div><div style="font-size:15px;font-weight:700">Preview — '+rows.length+' tenants ready to import</div>'
    +'<div style="font-size:12px;color:var(--muted);margin-top:3px">'
    +(flagged ? '<span style="color:var(--amber)">⚠️ '+flagged+' names flagged (property codes detected)</span>' : '<span style="color:var(--green)">✓ All names look clean</span>')
    +'</div></div>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="_importPreview=null;render()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--surface);font-size:13px;cursor:pointer;font-family:inherit">← Back</button>'
    +'<button onclick="confirmImportTenants()" style="padding:9px 20px;border-radius:9px;border:none;background:var(--green);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">✓ Import '+rows.length+' Tenants</button>'
    +'</div></div>';

  // Table
  html += '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<thead><tr style="background:var(--bg)">'
    +'<th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700">Name</th>'
    +'<th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700">WhatsApp</th>'
    +'<th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700">Property</th>'
    +'<th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Rm</th>'
    +'<th style="text-align:right;padding:9px 12px;color:var(--muted);font-weight:700">Rent</th>'
    +'<th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Freq</th>'
    +'<th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Status</th>'
    +'</tr></thead><tbody>';

  rows.forEach(function(r, i){
    var exists = state.tenants.some(function(t){return t.name.trim().toLowerCase()===r.name.trim().toLowerCase()&&t.whatsapp===r.whatsapp;});
    html += '<tr style="border-top:1px solid var(--border);background:'+(i%2?'var(--bg)':'var(--surface)')+'">'
      +'<td style="padding:8px 12px;font-weight:600">'
        +(r._flagged ? '<span title="Name contains property code - please verify" style="color:var(--amber)">⚠️ </span>' : '')
        +(exists ? '<span title="Already imported" style="color:var(--blue)">↩ </span>' : '')
        +esc(r.name)
      +'</td>'
      +'<td style="padding:8px 12px;font-family:monospace;color:var(--muted)">'+esc(r.whatsapp)+'</td>'
      +'<td style="padding:8px 12px;color:var(--muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.property)+'</td>'
      +'<td style="padding:8px 12px;text-align:center">'+esc(r.room)+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace">£'+esc(String(r.rent))+'</td>'
      +'<td style="padding:8px 12px;text-align:center;color:var(--muted)">'+esc(r.freq)+'</td>'
      +'<td style="padding:8px 12px;text-align:center">'+(exists?'<span style="font-size:10px;color:var(--blue);font-weight:700">SKIP</span>':'<span style="font-size:10px;color:var(--green);font-weight:700">NEW</span>')+'</td>'
      +'</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}
