// ── PROPERTIES IMPORT ─────────────────────────────────────────────────────────
function renderImportProperties() {
  var html = '';

  if(!_importPreview || _importPreview.type !== 'properties') {
    html += '<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:12px;padding:18px;margin-bottom:16px">'
      +'<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px">📋 How to import</div>'
      +'<div style="font-size:12px;color:var(--muted);line-height:1.7">'
      +'Upload your Base44 properties export (.xlsx or .csv). Required columns: <strong>Property Name, Address, Postcode, Total Rooms, Landlord Rent (£), Landlord Name, Landlord Contact</strong>. '
      +'Landlords are created automatically. Duplicate property names are skipped.'
      +'</div></div>';

    html += '<div style="border:2px dashed var(--accent);border-radius:12px;padding:32px;text-align:center;background:var(--accent-light);margin-bottom:16px">'
      +'<div style="font-size:36px;margin-bottom:10px">📊</div>'
      +'<div style="font-size:14px;font-weight:700;color:var(--accent-dark);margin-bottom:6px">Upload Properties File</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:16px">Accepts .xlsx or .csv from Base44</div>'
      +'<input type="file" id="prop-import-file" accept=".xlsx,.csv" style="display:none" onchange="handlePropertiesFile(this)">'
      +'<button onclick="document.getElementById(\'prop-import-file\').click()" style="padding:11px 24px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Choose File</button>'
      +'</div>';
    return html;
  }

  // Preview
  var preview = _importPreview;
  var rows = preview.rows;
  var warnings = preview.warnings || [];

  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
    +'<div><div style="font-size:15px;font-weight:700">Preview — '+rows.length+' properties ready to import</div>'
    +(warnings.length ? '<div style="font-size:12px;color:var(--amber);margin-top:3px">⚠️ '+warnings.length+' warnings — review below</div>' : '<div style="font-size:12px;color:var(--green);margin-top:3px">✓ All data looks good</div>')
    +'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="_importPreview=null;render()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--surface);font-size:13px;cursor:pointer;font-family:inherit">← Back</button>'
    +'<button onclick="confirmImportProperties()" style="padding:9px 20px;border-radius:9px;border:none;background:var(--green);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">✓ Import '+rows.length+' Properties</button>'
    +'</div></div>';

  if(warnings.length) {
    html += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:10px;padding:12px 14px;margin-bottom:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:6px">⚠️ Warnings</div>';
    warnings.slice(0,5).forEach(function(w){ html += '<div style="font-size:12px;color:var(--muted);padding:2px 0">• '+w+'</div>'; });
    if(warnings.length > 5) html += '<div style="font-size:11px;color:var(--dim);margin-top:4px">...and '+(warnings.length-5)+' more</div>';
    html += '</div>';
  }

  // Table
  html += '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<thead><tr style="background:var(--bg)">'
    +'<th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700;white-space:nowrap">Property</th>'
    +'<th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700;white-space:nowrap">Area / Postcode</th>'
    +'<th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Rooms</th>'
    +'<th style="text-align:right;padding:9px 12px;color:var(--muted);font-weight:700">Landlord Rent</th>'
    +'<th style="text-align:left;padding:9px 12px;color:var(--muted);font-weight:700">Landlord</th>'
    +'<th style="text-align:center;padding:9px 12px;color:var(--muted);font-weight:700">Status</th>'
    +'</tr></thead><tbody>';
  rows.forEach(function(r, i){
    var exists = state.properties.some(function(p){return p.name.trim().toLowerCase()===r.name.trim().toLowerCase();});
    html += '<tr style="border-top:1px solid var(--border);background:'+(i%2?'var(--bg)':'var(--surface)')+'">'
      +'<td style="padding:8px 12px;font-weight:600">'+(exists?'<span style="color:var(--amber)" title="Already exists">⚠️ </span>':'')+r.name+'</td>'
      +'<td style="padding:8px 12px;color:var(--muted)">'+r.postcode+'</td>'
      +'<td style="padding:8px 12px;text-align:center">'+r.rooms+'</td>'
      +'<td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--red)">£'+r.landlord+'/mo</td>'
      +'<td style="padding:8px 12px">'+r.landlordName+'</td>'
      +'<td style="padding:8px 12px;text-align:center">'+(exists?'<span style="font-size:10px;color:var(--amber);font-weight:700">SKIP</span>':'<span style="font-size:10px;color:var(--green);font-weight:700">NEW</span>')+'</td>'
      +'</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}
