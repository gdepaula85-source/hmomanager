// ── EXPORT / IMPORT ──────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════
// DATA MANAGER MODAL — Import / Export / Template
// ══════════════════════════════════════════════════════
var _dmEntity = 'properties'; // current entity in modal
var _dmPreview = null;        // parsed preview rows
var _dmWarnings = [];

function _dmCleanDigits(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

function _dmPlanCaps(plan) {
  var p = String(plan || 'free').toLowerCase();
  return {
    properties: p === 'business' ? 60 : p === 'professional' ? 25 : p === 'starter' ? 15 : p === 'trial' ? 5 : 3,
    tenants: p === 'business' || p === 'professional' ? 2147483647 : p === 'starter' ? 75 : p === 'trial' ? 30 : 15
  };
}

function _dmValidatePlanLimitBeforeImport(entity, rows) {
  var caps = _dmPlanCaps(state && state._currentOrg ? state._currentOrg.plan : 'free');
  if (entity === 'properties') {
    var currentProps = (state.properties || []).filter(function(p){ return p && p.status !== 'archived'; }).length;
    var newProps = rows.filter(function(r){
      return !(state.properties || []).some(function(p){
        return p && p.name && r.name && String(p.name).trim().toLowerCase() === String(r.name).trim().toLowerCase();
      });
    }).length;
    if (currentProps + newProps > caps.properties) {
      return 'Import blocked: ' + newProps + ' new properties would exceed your ' + String((state._currentOrg && state._currentOrg.plan) || 'free') + ' plan limit (' + caps.properties + ').';
    }
  }
  if (entity === 'tenants') {
    var currentTenants = (state.tenants || []).filter(function(t){ return t && (t.status || 'active') !== 'inactive'; }).length;
    var newTenants = rows.filter(function(r){
      return !(state.tenants || []).some(function(t){
        return t && t.name && r.name
          && String(t.name).trim().toLowerCase() === String(r.name).trim().toLowerCase()
          && String(t.property || '') === String(r.property || '');
      });
    }).filter(function(r){
      return String((r && r.status) || 'active').toLowerCase() !== 'inactive';
    }).length;
    if (currentTenants + newTenants > caps.tenants) {
      return 'Import blocked: ' + newTenants + ' new active tenants would exceed your ' + String((state._currentOrg && state._currentOrg.plan) || 'free') + ' plan limit (' + caps.tenants + ').';
    }
  }
  return '';
}

function openDataModal(entity) {
  _dmEntity = entity || 'properties';
  _dmPreview = null;
  _dmWarnings = [];
  _renderDataModal();
}

function _renderDataModal() {
  var entity = _dmEntity;
  var label  = entity.charAt(0).toUpperCase()+entity.slice(1);
  var preview = _dmPreview;
  var mc = document.getElementById('modal-container');
  if(!mc) return;

  /* ── tabs ── */
  var tabs = ['properties','tenants','landlords'].map(function(e) {
    var active = e===entity;
    var lbl = e.charAt(0).toUpperCase()+e.slice(1);
    return '<button data-ent="'+e+'" onclick="openDataModal(this.dataset.ent)"'
      +' style="padding:9px 18px;border:none;border-bottom:2px solid '+(active?'var(--accent)':'transparent')
      +';background:transparent;font-size:13px;font-weight:'+(active?700:500)
      +';color:'+(active?'var(--accent-dark)':'var(--muted)')
      +';cursor:pointer;font-family:inherit;white-space:nowrap">'+lbl+'</button>';
  }).join('');

  /* ── instructions text per entity ── */
  var instrCols = {
    properties:'Property Name · Address · Postcode · Total Rooms · Landlord Rent (£) · Monthly Income (£) · Landlord Name · Landlord Contact',
    tenants:   'Full Name · Property Name · Room Number · Weekly Rent (£) · Payment Day · WhatsApp · Status · Move-In Date',
    landlords: 'Name · Phone · Email · Bank · Sort Code · Account No · Notes'
  };

  /* ── column headers for preview table ── */
  var previewCols = {
  properties:[],
    tenants:   ['Name','Property','Room','Rent','Pay Day','Status'],
    landlords: ['Name','Phone','Email']
  };

  /* ── build HTML ── */
  var H = [];
  H.push('<div class="modal-overlay" onclick="if(event.target===this)closeModal()">');
  H.push('<div class="modal" style="max-width:640px">');

  /* header */
  H.push('<div class="modal-header" style="background:linear-gradient(135deg,#0F0F1A,#1a1a3e);padding:16px 20px">');
  H.push('<div style="display:flex;align-items:center;gap:12px"><span style="font-size:20px">⇅</span>');
  H.push('<div><div style="font-size:15px;font-weight:700;color:#fff">Data Manager</div>');
  H.push('<div style="font-size:11px;color:rgba(255,255,255,.5)">Import · Export · Template download</div></div></div>');
  H.push('<button class="modal-close" onclick="closeModal()" style="color:#fff">&times;</button></div>');

  /* tabs */
  H.push('<div style="display:flex;border-bottom:1px solid var(--border);background:var(--bg)">'+tabs+'</div>');

  /* body */
  H.push('<div class="modal-body" style="max-height:70vh;overflow-y:auto">');

  /* export + template row */
  H.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">');
  H.push('<button onclick="_dmExport()" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;background:var(--green-light);border:1.5px solid #A7F3D0;border-radius:12px;cursor:pointer;font-family:inherit">');
  H.push('<span style="font-size:28px">⬇️</span>');
  H.push('<div style="font-size:13px;font-weight:700;color:var(--green)">Export to CSV</div>');
  H.push('<div style="font-size:11px;color:var(--muted)">Download '+label+' data</div></button>');
  H.push('<button onclick="_dmTemplate()" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;background:var(--blue-light);border:1.5px solid #BFDBFE;border-radius:12px;cursor:pointer;font-family:inherit">');
  H.push('<span style="font-size:28px">📋</span>');
  H.push('<div style="font-size:13px;font-weight:700;color:var(--blue)">Download Template</div>');
  H.push('<div style="font-size:11px;color:var(--muted)">CSV with all column headers</div></button>');
  H.push('</div>');

  /* divider */
  H.push('<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">');
  H.push('<div style="flex:1;height:1px;background:var(--border)"></div>');
  H.push('<span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Import</span>');
  H.push('<div style="flex:1;height:1px;background:var(--border)"></div></div>');

  if(!preview) {
    /* drop zone */
    H.push('<div id="dm-dropzone" onclick="_dmBrowse()"');
    H.push(' ondragover="event.preventDefault();this.style.borderColor=\'var(--accent)\'"');
    H.push(' ondragleave="this.style.borderColor=\'var(--border)\'"');
    H.push(' ondrop="_dmDrop(event)"');
    H.push(' style="border:2px dashed var(--border);border-radius:12px;padding:36px 16px;text-align:center;cursor:pointer;background:var(--bg);transition:border-color .15s;margin-bottom:14px">');
    H.push('<div style="font-size:40px;margin-bottom:10px">📂</div>');
    H.push('<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:5px">Drop file here or click to browse</div>');
    H.push('<div style="font-size:12px;color:var(--muted)">Accepts .xlsx or .csv</div></div>');
    H.push('<input type="file" id="dm-file-inp" accept=".xlsx,.csv" style="display:none" onchange="_dmPickFile(this)">');

    /* instructions */
    H.push('<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:10px;padding:12px 14px">');
    H.push('<div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:6px">ℹ Required columns for '+label+'</div>');
    H.push('<div style="font-size:11px;color:var(--muted);line-height:1.8">'+instrCols[entity]+'</div></div>');

  } else {
    /* preview */
    var rows = preview.rows||[];
    var warnings = _dmWarnings||[];
    H.push('<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">');
    H.push('<div><div style="font-size:14px;font-weight:700">'+rows.length+' '+label+' ready</div>');
    if(warnings.length) H.push('<div style="font-size:12px;color:var(--amber);margin-top:3px">⚠ '+warnings.length+' warning(s)</div>');
    else H.push('<div style="font-size:12px;color:var(--green);margin-top:3px">✓ All rows validated</div>');
    H.push('</div>');
    H.push('<button onclick="_dmPreview=null;_renderDataModal()" style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;cursor:pointer;font-family:inherit">← Back</button></div>');

    if(warnings.length) {
      H.push('<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:10px 13px;margin-bottom:12px">');
      warnings.slice(0,4).forEach(function(w){H.push('<div style="font-size:11px;color:var(--muted);padding:1px 0">• '+w+'</div>');});
      if(warnings.length>4) H.push('<div style="font-size:11px;color:var(--dim)">…and '+(warnings.length-4)+' more</div>');
      H.push('</div>');
    }

    /* progress bar — hidden until import starts */
    H.push('<div id="dm-progress-wrap" style="display:none;margin-bottom:14px">');
    H.push('<div style="display:flex;justify-content:space-between;margin-bottom:5px">');
    H.push('<span id="dm-progress-label" style="font-size:12px;font-weight:600">Importing…</span>');
    H.push('<span id="dm-progress-pct" style="font-size:12px;font-weight:700;color:var(--accent);font-family:monospace">0%</span></div>');
    H.push('<div style="background:var(--border);border-radius:6px;height:10px;overflow:hidden">');
    H.push('<div id="dm-progress-bar" style="height:100%;border-radius:6px;background:var(--accent);width:0%;transition:width .35s"></div></div></div>');

    /* table */
    var cols = previewCols[entity]||[];
    H.push('<div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;margin-bottom:16px;max-height:260px;overflow-y:auto">');
    H.push('<table style="width:100%;border-collapse:collapse;font-size:11px">');
    H.push('<thead style="position:sticky;top:0;background:var(--bg)"><tr>');
    cols.forEach(function(c){
      H.push('<th style="text-align:left;padding:8px 10px;color:var(--muted);font-weight:700;white-space:nowrap;border-bottom:1px solid var(--border)">'+c+'</th>');
    });
    H.push('<th style="padding:8px 10px;border-bottom:1px solid var(--border)"></th>');
    H.push('</tr></thead><tbody>');

    rows.forEach(function(r, i) {
      var exists = false;
      if(entity==='properties') exists = state.properties.some(function(p){return p.name&&r.name&&p.name.trim().toLowerCase()===r.name.trim().toLowerCase();});
      else if(entity==='tenants') exists = state.tenants.some(function(t){return t.name&&r.name&&t.name.trim().toLowerCase()===r.name.trim().toLowerCase()&&t.property===r.property;});
      else if(entity==='landlords') exists = state.landlords&&state.landlords.some(function(l){return l.name&&r.name&&l.name.trim().toLowerCase()===r.name.trim().toLowerCase();});

      var badge = exists
        ? '<span style="font-size:9px;font-weight:700;color:var(--amber);background:var(--amber-light);padding:1px 6px;border-radius:4px">UPDATE</span>'
        : '<span style="font-size:9px;font-weight:700;color:var(--green);background:var(--green-light);padding:1px 6px;border-radius:4px">NEW</span>';

      H.push('<tr style="border-top:1px solid var(--border);background:'+(i%2?'var(--bg)':'var(--surface)')+'">');
      if(entity==='properties') {
        H.push('<td style="padding:7px 10px;font-weight:600;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+r.name+'</td>');
        H.push('<td style="padding:7px 10px;color:var(--muted)">'+(r.postcode||r.area||'—')+'</td>');
        H.push('<td style="padding:7px 10px;text-align:center">'+(r.rooms||0)+'</td>');
        H.push('<td style="padding:7px 10px;font-family:monospace;color:var(--red)">£'+(r.landlord||0)+'</td>');
        H.push('<td style="padding:7px 10px;font-family:monospace;color:var(--green)">£'+(r.rent||0)+'</td>');
        H.push('<td style="padding:7px 10px;max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(r.landlordName||'—')+'</td>');
      } else if(entity==='tenants') {
        H.push('<td style="padding:7px 10px;font-weight:600">'+r.name+'</td>');
        H.push('<td style="padding:7px 10px;color:var(--muted);max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(r.property||'—')+'</td>');
        H.push('<td style="padding:7px 10px;text-align:center">'+(r.room||'—')+'</td>');
        H.push('<td style="padding:7px 10px;font-family:monospace;color:var(--green)">£'+(r.rent||0)+'/wk</td>');
        H.push('<td style="padding:7px 10px">'+(r.payDay||'—')+'</td>');
        H.push('<td style="padding:7px 10px">'+(r.status||'active')+'</td>');
      } else {
        H.push('<td style="padding:7px 10px;font-weight:600">'+r.name+'</td>');
        H.push('<td style="padding:7px 10px;color:var(--muted)">'+(r.phone||'—')+'</td>');
        H.push('<td style="padding:7px 10px;color:var(--muted)">'+(r.email||'—')+'</td>');
      }
      H.push('<td style="padding:7px 10px">'+badge+'</td>');
      H.push('</tr>');
    });
    H.push('</tbody></table></div>');
  }

  H.push('</div>'); /* end modal-body */

  /* footer */
  H.push('<div class="modal-footer" style="justify-content:space-between">');
  H.push('<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">Close</button>');
  if(preview && preview.rows && preview.rows.length) {
    H.push('<button id="dm-import-btn" onclick="_dmConfirmImport()" style="padding:9px 22px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">⬆ Import '+preview.rows.length+' '+label+'</button>');
  }
  H.push('</div>');

  H.push('</div></div>'); /* end modal + overlay */

  mc.innerHTML = H.join('');
}


function _dmBrowse() {
  var inp = document.getElementById('dm-file-inp');
  if(inp) inp.click();
}

function _dmDrop(e) {
  e.preventDefault();
  var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(file) _dmProcessFile(file);
}

function _dmPickFile(input) {
  var file = input && input.files && input.files[0];
  if(file) _dmProcessFile(file);
}

function _dmProcessFile(file) {
  var entity = _dmEntity;
  var ext = (file.name||'').split('.').pop().toLowerCase();
  if(ext==='xlsx') {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        // Use XLSX if available, else fallback to CSV-like parse
        if(window.XLSX) {
          var wb = window.XLSX.read(e.target.result, {type:'array'});
          var ws = wb.Sheets[wb.SheetNames[0]];
          var data = window.XLSX.utils.sheet_to_json(ws,{defval:''});
          _dmParseRows(data, entity);
        } else {
          _dmWarnings = ['XLSX parser not loaded — try CSV format'];
          _dmPreview = {rows:[]};
          _renderDataModal();
        }
      } catch(err){ _dmWarnings=['Parse error: '+err.message]; _dmPreview={rows:[]}; _renderDataModal(); }
    };
    reader.readAsArrayBuffer(file);
  } else {
    // CSV
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var lines = e.target.result.split(/\r?\n/).filter(function(l){return l.trim();});
        var headers = lines[0].split(',').map(function(h){return h.trim().replace(/^["']|["']$/g,'');});
        var data = lines.slice(1).map(function(line){
          var vals = line.split(',');
          var obj = {};
          headers.forEach(function(h,i){obj[h]=(vals[i]||'').trim().replace(/^["']|["']$/g,'');});
          return obj;
        });
        _dmParseRows(data, entity);
      } catch(err){ _dmWarnings=['CSV parse error: '+err.message]; _dmPreview={rows:[]}; _renderDataModal(); }
    };
    reader.readAsText(file);
  }
}

function _dmParseRows(data, entity) {
  _dmWarnings = [];
  var rows = [];
  if(entity==='properties') {
    data.forEach(function(row,i){
      var name = row['Property Name']||row['Name']||row['property_name']||'';
      if(!name) return;
      var r = {
        name: name.trim(),
        address: row['Address']||row['address']||name,
        postcode: row['Postcode']||row['postcode']||row['Area']||'',
        area: row['Area']||row['area']||'',
        rooms: parseInt(row['Total Rooms']||row['Rooms']||row['rooms']||0)||0,
        landlord: parseFloat(row['Landlord Rent (£)']||row['Landlord Rent']||row['landlord_rent']||0)||0,
        rent: parseFloat(row['Monthly Income (£)']||row['Monthly Income']||row['monthly_income']||0)||0,
        landlordName: row['Landlord Name']||row['landlord_name']||'',
        landlordPhone: row['Landlord Contact']||row['Landlord Phone']||row['landlord_contact']||'',
        companyName: row['Operating Company']||row['Company']||'',
        ownershipType: (row['Status']||row['status']||'managed').toLowerCase().includes('own')?'owned':'managed',
        mapsUrl: row['Maps URL']||row['maps_url']||'',
        notes: row['Notes']||row['notes']||'',
      };
      if(!r.rooms) _dmWarnings.push('Row '+(i+2)+': '+name+' — no room count');
      rows.push(r);
    });
  } else if(entity==='tenants') {
    data.forEach(function(row,i){
      var name = row['Full Name']||row['Name']||row['name']||'';
      if(!name) return;
      var r = {
        name: name.trim(),
        property: row['Property Name']||row['Property']||row['property']||'',
        room: parseInt(row['Room Number']||row['Room']||row['room']||0)||0,
        rent: parseFloat(row['Weekly Rent (£)']||row['Rent']||row['rent']||0)||0,
        freq: (row['Frequency']||row['freq']||'weekly').toLowerCase().includes('month')?'monthly':'weekly',
        payDay: row['Payment Day']||row['Pay Day']||row['payDay']||'Monday',
        whatsapp: _dmCleanDigits(row['WhatsApp']||row['Phone']||row['phone']||''),
        email: row['Email']||row['email']||'',
        status: (row['Status']||row['status']||'active').toLowerCase().includes('notice')?'notice_given':'active',
        moveIn: row['Move-In Date']||row['Move In']||row['moveIn']||'',
        deposit: parseFloat(row['Deposit']||row['deposit']||0)||0,
        method: (row['Payment Method']||row['method']||'bank').toLowerCase().includes('cash')?'cash':'bank',
      };
      var p = state.properties.find(function(p){return r.property&&p.name&&p.name.trim().toLowerCase()===r.property.trim().toLowerCase();});
      if(r.property && !p) _dmWarnings.push('Row '+(i+2)+': '+name+' — property "'+r.property+'" not found');
      rows.push(r);
    });
  } else if(entity==='landlords') {
    data.forEach(function(row,i){
      var name = row['Name']||row['name']||'';
      if(!name) return;
      rows.push({
        name: name.trim(),
        phone: _dmCleanDigits(row['Phone']||row['phone']||''),
        email: row['Email']||row['email']||'',
        bank: row['Bank']||row['bank']||'',
        sortCode: row['Sort Code']||row['sortCode']||'',
        accountNo: row['Account No']||row['accountNo']||'',
        notes: row['Notes']||row['notes']||'',
      });
    });
  }
  _dmPreview = {rows:rows};
  _renderDataModal();
}

async function _dmConfirmImport() {
  var entity = _dmEntity;
  var rows = (_dmPreview&&_dmPreview.rows)||[];
  if(!rows.length){showToast('Nothing to import','error');return;}

  var btn = document.getElementById('dm-import-btn');
  var progressWrap = document.getElementById('dm-progress-wrap');
  var bar = document.getElementById('dm-progress-bar');
  var label = document.getElementById('dm-progress-label');
  var pct = document.getElementById('dm-progress-pct');
  if(btn) btn.disabled=true;
  if(progressWrap) progressWrap.style.display='block';

  function setProgress(done, total, msg) {
    var p = total>0 ? Math.round(done/total*100) : 0;
    if(bar) bar.style.width=p+'%';
    if(pct) pct.textContent=p+'%';
    if(label) label.textContent=msg||('Importing '+done+' / '+total+'…');
    if(p===100 && bar) { bar.style.background='var(--green)'; if(label) label.textContent='✓ Import complete!'; }
  }

  var imported=0, skipped=0, total=rows.length;
  var limitErr = _dmValidatePlanLimitBeforeImport(entity, rows);
  if (limitErr) {
    if(btn) btn.disabled=false;
    if(progressWrap) progressWrap.style.display='none';
    showToast(limitErr, 'error');
    alert('⚠️ ' + limitErr);
    return;
  }

  if(entity==='properties') {
    if(!state.properties) state.properties=[];
    for(var i=0;i<rows.length;i++) {
      var r=rows[i];
      var exists = state.properties.find(function(p){return p.name&&r.name&&p.name.trim().toLowerCase()===r.name.trim().toLowerCase();});
      if(!exists) {
        // Auto-create landlord if needed
        if(r.landlordName) {
          var ll=state.landlords&&state.landlords.find(function(l){return l.name&&l.name.trim().toLowerCase()===r.landlordName.trim().toLowerCase();});
          if(!ll){if(!state.landlords)state.landlords=[];var newLL={id:crypto.randomUUID(),name:r.landlordName,phone:r.landlordPhone||'',email:'',bank:'',sortCode:'',accountNo:'',notes:'',properties:[]};state.landlords.push(newLL);}
        }
        var newProp = {
          id:crypto.randomUUID(), name:r.name, address:r.address, postcode:r.postcode, area:r.area||r.postcode,
          rooms:r.rooms||0, occupied:0, landlord:r.landlord||0, rent:r.rent||0,
          ownershipType:r.ownershipType||'managed', status:'active',
          landlordName:r.landlordName||'', landlordPhone:r.landlordPhone||'',
          mapsUrl:r.mapsUrl||'', notes:r.notes||'', roomList:[]
        };
        state.properties.push(newProp);
        imported++;
      } else { skipped++; }
      if(i%10===9 || i===rows.length-1) {
        setProgress(i+1, total, 'Importing properties… '+(i+1)+' / '+total);
        await new Promise(function(res){setTimeout(res,30);});
      }
    }
  } else if(entity==='tenants') {
    if(!state.tenants) state.tenants=[];
    for(var i=0;i<rows.length;i++) {
      var r=rows[i];
      var exists = state.tenants.find(function(t){return t.name&&r.name&&t.name.trim().toLowerCase()===r.name.trim().toLowerCase()&&t.property===r.property;});
      if(!exists) {
        state.tenants.push({
          id:crypto.randomUUID(), name:r.name, property:r.property, room:r.room,
          rent:r.rent, freq:r.freq, payDay:r.payDay, whatsapp:_dmCleanDigits(r.whatsapp), email:r.email,
          status:r.status, startDate:r.moveIn||null, moveIn:r.moveIn||null,
          deposit:r.deposit||0, depositStatus:'held', method:r.method, arrears:0, paid:'—', paymentHistory:[]
        });
        imported++;
      } else { skipped++; }
      if(i%10===9 || i===rows.length-1) {
        setProgress(i+1, total, 'Importing tenants… '+(i+1)+' / '+total);
        await new Promise(function(res){setTimeout(res,30);});
      }
    }
  } else if(entity==='landlords') {
    if(!state.landlords) state.landlords=[];
    for(var i=0;i<rows.length;i++) {
      var r=rows[i];
      var exists = state.landlords.find(function(l){return l.name&&r.name&&l.name.trim().toLowerCase()===r.name.trim().toLowerCase();});
      if(!exists) {
        state.landlords.push({id:crypto.randomUUID(),name:r.name,phone:_dmCleanDigits(r.phone),email:r.email,bank:r.bank,sortCode:r.sortCode,accountNo:r.accountNo,notes:r.notes,properties:[]});
        imported++;
      } else { skipped++; }
      if(i%5===4 || i===rows.length-1) {
        setProgress(i+1, total, 'Importing landlords… '+(i+1)+' / '+total);
        await new Promise(function(res){setTimeout(res,20);});
      }
    }
  }

  setProgress(total, total);
  saveState();
  rebuildAllSchedules();
  await new Promise(function(res){setTimeout(res,600);});
  if(btn){ btn.textContent='✓ Done — Close'; btn.disabled=false; btn.onclick=function(){closeModal();render();}; }
  showToast('Imported '+imported+' '+entity+(skipped?' · '+skipped+' skipped':''),'success');
}

function _dmExport() {
  var entity = _dmEntity;
  var rows, filename, headers;
  if(entity==='properties') {
    headers=['Property Name','Address','Postcode','Area','Total Rooms','Landlord Rent (£)','Monthly Income (£)','Occupied Rooms','Landlord Name','Ownership Type','Status','Maps URL','Notes'];
    rows=state.properties.map(function(p){return [p.name,p.address||'',p.postcode||'',p.area||'',p.rooms,p.landlord,p.rent,p.occupied,p.landlordName||'',p.ownershipType||'managed',p.status||'active',p.mapsUrl||'',p.notes||''];});
    filename='properties-export-'+new Date().toISOString().split('T')[0]+'.csv';
  } else if(entity==='tenants') {
    headers=['Full Name','Property Name','Room Number','Weekly Rent (£)','Frequency','Payment Day','WhatsApp','Email','Status','Move-In Date','Deposit','Payment Method'];
    rows=state.tenants.map(function(t){return [t.name,t.property,t.room,t.rent,t.freq||'weekly',t.payDay||'',t.whatsapp||'',t.email||'',t.status,t.startDate||t.moveIn||'',t.deposit||0,t.method||'bank'];});
    filename='tenants-export-'+new Date().toISOString().split('T')[0]+'.csv';
  } else {
    headers=['Name','Phone','Email','Bank','Sort Code','Account No','Notes'];
    rows=(state.landlords||[]).map(function(l){return [l.name,l.phone||'',l.email||'',l.bank||'',l.sortCode||'',l.accountNo||'',l.notes||''];});
    filename='landlords-export-'+new Date().toISOString().split('T')[0]+'.csv';
  }
  var csv=[headers.join(',')].concat(rows.map(function(r){return r.map(function(v){var s=String(v||'');return s.includes(',')||s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s;}).join(',');})).join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('Exported '+rows.length+' '+entity,'success');
}

function _dmTemplate() {
  var entity = _dmEntity;
  var headers, sample, filename;
  if(entity==='properties') {
    headers=['Property Name','Address','Postcode','Area','Total Rooms','Landlord Rent (£)','Monthly Income (£)','Occupied Rooms','Landlord Name','Landlord Contact','Status','Maps URL','Notes','Operating Company'];
    sample=['99 Example Street','99 Example Street London SW2 1AA','SW2 1AA','Brixton',5,2500,3200,4,'John Smith','447911000001','Managed','https://maps.google.com','Good condition','Reservations Direct Limited'];
    filename='properties-import-template.csv';
  } else if(entity==='tenants') {
    headers=['Full Name','Property Name','Room Number','Weekly Rent (£)','Frequency','Payment Day','WhatsApp','Email','Status','Move-In Date','Deposit','Payment Method'];
    sample=['Maria Santos','99 Example Street',1,200,'weekly','Monday','447911000002','maria@email.com','active','2026-01-01',400,'bank'];
    filename='tenants-import-template.csv';
  } else {
    headers=['Name','Phone','Email','Bank','Sort Code','Account No','Notes'];
    sample=['John Smith','447911000001','john@email.com','Barclays','20-00-00','12345678','Pays on 1st of month'];
    filename='landlords-import-template.csv';
  }
  var csv=[headers.join(','),sample.map(function(v){var s=String(v||'');return s.includes(',')||s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s;}).join(',')].join('\n');
  var blob=new Blob([csv],{type:'text/csv'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('Template downloaded','success');
}

function exportData() {
  var snapshot = {};
  var SAVE_KEYS_LOCAL = ['tenants','properties','payments','rentSchedule','expenses',
    'maintenance','landlords','landlordPayments','roomMedia','lateFeeConfig',
    'users','voidDates','vault','propDocs'];
  SAVE_KEYS_LOCAL.forEach(function(k){ snapshot[k] = state[k]; });
  snapshot._exportedAt = new Date().toISOString();
  snapshot._version    = '1.0';

  var blob = new Blob([JSON.stringify(snapshot, null, 2)], {type:'application/json'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  var date = new Date().toISOString().split('T')[0];
  a.href     = url;
  a.download = 'propmanager-backup-' + date + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(input) {
  var file = input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if(!data.tenants || !data.properties) {
        alert('\u26A0\uFE0F Invalid backup file. Please use a PropManager export file.');
        return;
      }
      var backupDate = data._exportedAt ? new Date(data._exportedAt).toLocaleDateString('en-GB') : 'unknown date';
      if(!confirm('\u26A0\uFE0F This will replace ALL current data with the backup from ' + backupDate + '.\n\nAre you sure?')) return;

      var SAVE_KEYS_LOCAL = ['tenants','properties','payments','rentSchedule','expenses',
        'maintenance','landlords','landlordPayments','roomMedia','lateFeeConfig',
        'users','voidDates','vault','propDocs'];
      SAVE_KEYS_LOCAL.forEach(function(k){
        if(data[k] !== undefined) {
          state[k] = data[k];
          localStorage.setItem('pm_' + k, JSON.stringify(data[k]));
        }
      });
      rebuildAllSchedules();
      render();
      alert('\u2705 Data imported successfully! ' + data.tenants.length + ' tenants and ' + data.properties.length + ' properties loaded.');
    } catch(err) {
      alert('\u26A0\uFE0F Failed to read backup file: ' + err.message);
    }
    input.value = '';
  };
  reader.readAsText(file);
}
