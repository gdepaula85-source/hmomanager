// ── IMPORT PAGE ───────────────────────────────────────────────────────────────
var _importTab = 'properties';
var _importPreview = null; // {type, rows, warnings}

function renderImport() {
  var tab = _importTab || 'properties';
  var tabs = [{v:'properties',l:'🏠 Properties'},{v:'tenants',l:'👥 Tenants'}];
  var html = '<div class="page-header"><div><div class="page-title">📥 Data Import</div>'
    +'<div class="page-sub">Import properties and tenants from Base44 exports</div></div></div>';

  // Tab bar
  html += '<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px">';
  tabs.forEach(function(t){
    html += '<button onclick="_importTab=\''+t.v+'\';_importPreview=null;render()" style="padding:11px 20px;border:none;border-bottom:2px solid '+(tab===t.v?'var(--accent)':'transparent')+';background:transparent;font-size:13px;font-weight:'+(tab===t.v?700:500)+';color:'+(tab===t.v?'var(--accent-dark)':'var(--muted)')+';cursor:pointer;font-family:inherit">'+t.l+'</button>';
  });
  html += '</div>';

  if(tab === 'properties') html += renderImportProperties();
  else                      html += renderImportTenants();
  return html;
}
