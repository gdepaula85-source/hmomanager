// ── Send maintenance job to contractor ────────────────────────────────────────
function sendToContractorModal(maintId) {
  var m = state.maintenance.find(function(x){ return String(x.id)===String(maintId); });
  if(!m) return;
  var contractors = state.contractors || [];
  if(!contractors.length) {
    if(confirm('No contractors yet. Add one now?')) {
      state.filters.maintView = 'contractors';
      render();
      setTimeout(openAddContractorModal, 100);
    }
    return;
  }

  // Pre-build the WA message for this job
  var prop = state.properties.find(function(p){ return p.name===m.property; });
  var NL = '\n';
  var jobMsg = '🔧 *JOB REQUEST — PropManager*'+NL
    +'━━━━━━━━━━━━━━━━━'+NL
    +'*Issue:* '+m.issue+NL
    +'*Property:* '+m.property+NL
    +(prop&&prop.address&&prop.address!==m.property?'*Address:* '+prop.address+NL:'')
    +(m.room?'*Room:* '+m.room+NL:'')
    +(m.tenant?'*Tenant:* '+m.tenant+NL:'')
    +'*Priority:* '+(m.priority||'Normal').toUpperCase()+NL
    +(m.notes?NL+'*Details:* '+m.notes+NL:'')
    +(prop&&prop.mapsUrl?NL+'📍 '+prop.mapsUrl+NL:'')
    +'━━━━━━━━━━━━━━━━━'+NL
    +'Please confirm if you can attend and your estimated arrival.'+NL
    +'_Sent via PropManager_';

  var cRows = contractors.map(function(c) {
    var waNum = c.whatsapp ? String(c.whatsapp||'').replace(/\D/g,'') : '';
    var waHref = waNum ? 'https://wa.me/'+waNum+'?text='+encodeURIComponent(jobMsg) : '';
    var mailHref = c.email ? 'mailto:'+c.email
      +'?subject='+encodeURIComponent('[Job Request] '+m.issue+' — '+m.property)
      +'&body='+encodeURIComponent(jobMsg) : '';
    var stars = c.rating ? '★'.repeat(c.rating) : '';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">'
      +'<div><div style="font-size:13px;font-weight:700">'+c.name+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+c.trade+(stars?' · <span style="color:var(--amber)">'+stars+'</span>':'')+'</div>'
      +(c.callOutCharge?'<div style="font-size:11px;color:var(--dim)">Call-out: £'+c.callOutCharge+'</div>':'')
      +'</div>'
      +'<div style="display:flex;gap:6px">'
      +(waHref?'<a href="'+waHref+'" target="_blank" onclick="markContractorUsed(\''+c.id+'\');closeModal()" style="padding:7px 12px;border-radius:8px;background:#F0FDF4;border:1px solid #BBF7D0;color:#16A34A;font-size:12px;font-weight:700;text-decoration:none">💬 WA</a>':'')
      +(mailHref?'<a href="'+mailHref+'" onclick="markContractorUsed(\''+c.id+'\');closeModal()" style="padding:7px 12px;border-radius:8px;background:var(--blue-light);border:1px solid #BFDBFE;color:var(--blue);font-size:12px;font-weight:700;text-decoration:none">✉️ Email</a>':'')
      +(!waHref&&!mailHref?'<span style="font-size:11px;color:var(--dim);padding:7px">No contact</span>':'')
      +'</div>'
      +'</div>';
  }).join('');

  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:480px">'
    +'<div class="modal-header"><span class="modal-title">🔧 Send Job to Contractor</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body">'
    +'<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:700;margin-bottom:2px">'+m.issue+'</div>'
    +'<div style="font-size:12px;color:var(--muted)">'+m.property+(m.room?' · Room '+m.room:'')+'</div>'
    +'</div>'
    +'<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Choose a contractor</div>'
    +cRows
    +'<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">'
    +'<button onclick="state.filters.maintView=\'contractors\';closeModal();render();setTimeout(openAddContractorModal,100)" style="width:100%;padding:10px;border-radius:9px;border:1px solid var(--border);background:transparent;font-size:13px;color:var(--muted);cursor:pointer;font-family:inherit">+ Add new contractor</button>'
    +'</div>'
    +'<div class="modal-footer">'+btn('Close','closeModal()','secondary')+'</div>'
    +'</div></div></div>';
}

function markContractorUsed(id) {
  var c = (state.contractors||[]).find(function(x){ return x.id===id; });
  if(c) { c.lastUsed = new Date().toISOString().split('T')[0]; saveState(); }
}

function shareMaintWA(e, maintId) {
  if(e) e.stopPropagation();
  var m=state.maintenance.find(function(x){return String(x.id)===String(maintId);});if(!m)return;
  var prop=state.properties.find(function(p){return p.name===m.property;});
  var mx=(state.maintExtras&&state.maintExtras[m.id])||{};
  var NL='\n',pri=m.priority==='urgent'?' [URGENT]':m.priority==='high'?' [HIGH]':'';
  var msg='MAINTENANCE'+pri+'\n---\n'+m.issue+'\n\nProperty: '+m.property+NL;
  if(prop&&prop.address&&prop.address!==m.property)msg+=prop.address+NL;
  if(m.room)msg+='Room: '+m.room+NL;
  msg+='Tenant: '+(m.tenant||'-')+NL+NL+'Priority: '+(m.priority||'normal').toUpperCase()+NL+'Status: '+(m.status||'open').replace('_',' ').toUpperCase()+NL;
  if(m.cat||m.category)msg+='Category: '+(m.cat||m.category)+NL;
  msg+='Logged: '+(m.date||new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}))+NL;
  if(mx.cost)msg+='Job Cost: £'+mx.cost+NL;
  if(m.notes)msg+=NL+'Notes: '+m.notes+NL;
  if(prop&&prop.mapsUrl)msg+=NL+'Location: '+prop.mapsUrl+NL;
  msg+='---\nSent via PropManager';
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

function shareAllMaintWA() {
  var open=state.maintenance.filter(function(m){return m.status!=='resolved';});
  if(!open.length){showToast('No open maintenance tasks','error');return;}
  var msg='OPEN MAINTENANCE ('+open.length+')\n'+new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+'\n---\n';
  open.forEach(function(m,i){msg+=(i+1)+'. '+m.issue+(m.priority==='urgent'?' [URGENT]':'')+'\n   '+m.property+(m.room?' Rm '+m.room:'')+'\n   '+((m.status||'open').replace('_',' ').toUpperCase())+'\n'+(m.notes?'   '+m.notes+'\n':'');});
  msg+='---';
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — PROPERTY DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
function shareAllPropDocs(propId, propNameEncoded) {
  var propName = decodeURIComponent(propNameEncoded);
  var docs = (state.propDocs&&state.propDocs[propId])||[];
  if(!docs.length){ showToast('No documents to share','error'); return; }
  var msg = '📂 *PROPERTY DOCUMENTS*\n*Property:* '+propName+'\n━━━━━━━━━━━━━━━━━\n';
  docs.forEach(function(doc,i){
    var days = doc.expiresAt ? getDaysUntilExpiry(doc.expiresAt) : null;
    var expStr = days===null?'':(days<0?' ⛔ EXPIRED':days<=30?' ⚠️ Expires in '+days+'d':' ✓ Valid');
    msg+=(i+1)+'. *'+doc.type+'*'+expStr+'\n   '+doc.name+' ('+doc.size+')'+'\n'
      +(doc.expiresAt?'   Exp: '+new Date(doc.expiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+'\n':'');
  });
  msg+='━━━━━━━━━━━━━━━━━\n_Sent via PropManager_';
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

function clearSavedState(){
  var _kr=[];for(var _i=0;_i<localStorage.length;_i++){var _k=localStorage.key(_i);if(_k&&_k.startsWith('pm_'))_kr.push(_k);}
  _kr.forEach(function(k){localStorage.removeItem(k);});
  location.reload();
}
var _origRender=render;
render=function(){
  if(_appBootPending) return;
  _origRender();
  // Debounce saveState — prevents expensive serialisation on every rapid render
  clearTimeout(window._renderSaveTimer);
  window._renderSaveTimer=setTimeout(saveState,800);
  // Debounce dashboard agent — prevents multiple concurrent DOM rebuilds
  if(state.page==='dashboard'){
    clearTimeout(window._dashAgentTimer);
    window._dashAgentTimer=setTimeout(renderDashboardAgent,200);
  }
  // Debounce deal recalc
  if(state.page==='properties'&&(state.filters.propView||'list')==='deal'){
    clearTimeout(window._dealCalcTimer);
    window._dealCalcTimer=setTimeout(recalcDealPage,80);
  }
  // Trigger room photo background sync once, 3s after first render
  if(!window._roomSyncDone){
    clearTimeout(window._roomSyncTimer);
    window._roomSyncTimer=setTimeout(function(){
      window._roomSyncDone=true;
      syncRoomPhotosBackground();
    },3000);
  }
};
function runAfterSupabaseLoad(){
  state.properties.forEach(function(p){
    if(!p.roomList) return;
    p.roomList.forEach(function(r){
      var tenant = state.tenants.find(function(t){
        return t.property===p.name && t.room===r.n && t.status!=='inactive';
      });
      r.status = tenant ? 'occupied' : 'vacant';
      if(tenant && tenant.rent > 0) r.price = tenant.rent;
    });
    p.occupied = p.roomList.filter(function(r){return r.status==='occupied';}).length;
    var occupiedPrices = p.roomList.filter(function(r){return r.status==='occupied'&&r.price>0;}).map(function(r){return r.price;});
    if(occupiedPrices.length) {
      var avgPrice = Math.round(occupiedPrices.reduce(function(s,v){return s+v;},0)/occupiedPrices.length);
      p.roomList.forEach(function(r){if(r.status==='vacant'&&r.price===0) r.price=avgPrice;});
    }
    var propTenants = state.tenants.filter(function(t){return t.property===p.name&&t.status!=='inactive';});
    p.rent = Math.round(propTenants.reduce(function(s,t){
      return s + (t.freq==='monthly' ? t.rent : (t.rent||0)*52/12);
    }, 0));
  });
  rebuildAllSchedules();
  var today = new Date();
  today.setHours(0,0,0,0);
  state.tenants.forEach(function(t) {
    if(t.status === 'notice_given' && t.moveOutDate) {
      var moveOut = new Date(t.moveOutDate);
      moveOut.setHours(0,0,0,0);
      if(moveOut <= today) {
        t.status = 'inactive';
        freeRoom(t.property, t.room);
      }
    }
  });
}


var PROP_DOC_TYPES = [
  {type:'Gas Safety Certificate',    icon:'🔥', warn:60, color:'#FEF3C7', textColor:'#92400E'},
  {type:'HMO Licence',               icon:'🏠', warn:90, color:'#EDE9FE', textColor:'#5B21B6'},
  {type:'Electrical Certificate (EICR)', icon:'⚡', warn:60, color:'#EFF6FF', textColor:'#1E40AF'},
  {type:'Energy Performance (EPC)',  icon:'🌿', warn:90, color:'#DCFCE7', textColor:'#166534'},
  {type:'Fire Risk Assessment',      icon:'🧯', warn:60, color:'#FEE2E2', textColor:'#991B1B'},
  {type:'Boiler Service',            icon:'🔧', warn:60, color:'#F0FDF4', textColor:'#166534'},
  {type:'Landlord Insurance',        icon:'🛡️', warn:30, color:'#EFF6FF', textColor:'#1D4ED8'},
  {type:'Planning Permission',       icon:'📋', warn:0,  color:'#F8FAFC', textColor:'#475569'},
  {type:'Other',                     icon:'📄', warn:0,  color:'#F8FAFC', textColor:'#475569'},
];

function getPropDocMeta(type) {
  return PROP_DOC_TYPES.find(function(d){return d.type===type;}) || PROP_DOC_TYPES[PROP_DOC_TYPES.length-1];
}

function getDaysUntilExpiry(expiresAt) {
  if(!expiresAt) return null;
  return Math.ceil((new Date(expiresAt) - new Date()) / 86400000);
}

async function renderPropDocsTab(p) {
  if(!state.propDocs) state.propDocs = {};
  var localDocs = (state.propDocs[p.id] || []).slice();
  // Load from Supabase Storage — ensures files show on all devices/sessions
  var supaFiles = [];
  try {
    var lr = await supa.storage.from('property-docs').list('properties/'+String(p.id),{limit:50});
    if(!lr.error && Array.isArray(lr.data)) {
      lr.data.filter(function(f){return f.name&&!f.name.startsWith('.');}).forEach(function(f){
        var path = 'properties/'+String(p.id)+'/'+f.name;
        var pub = supa.storage.from('property-docs').getPublicUrl(path);
        var url = pub.data ? pub.data.publicUrl : null;
        var local = localDocs.find(function(d){return d.storagePath===path;});
        if(local){ if(url&&!local.dataUrl) local.dataUrl=url; return; }
        var fsz = f.metadata&&f.metadata.size ? (f.metadata.size>1048576?(f.metadata.size/1048576).toFixed(1)+'MB':Math.round(f.metadata.size/1024)+'KB') : '';
        var fdt = f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '';
        supaFiles.push({id:f.name,name:f.name,type:'Document',size:fsz,uploadedAt:fdt,expiresAt:null,dataUrl:url,storagePath:path,_fromStorage:true});
      });
    }
  } catch(e){ console.warn('Property docs list err:',e.message); }
  if(supaFiles.length){if(!state.propDocs)state.propDocs={};if(!state.propDocs[p.id])state.propDocs[p.id]=[];supaFiles.forEach(function(sd){if(!state.propDocs[p.id].find(function(d){return d.storagePath===sd.storagePath;}))state.propDocs[p.id].push(sd);});}
  var docs = localDocs.concat(supaFiles);

  // Sort: expired first, then soonest expiry, then no expiry
  docs = docs.slice().sort(function(a,b){
    var da = a.expiresAt ? getDaysUntilExpiry(a.expiresAt) : 9999;
    var db = b.expiresAt ? getDaysUntilExpiry(b.expiresAt) : 9999;
    return da - db;
  });

  // Expiry summary strip
  var expiring = docs.filter(function(d){
    if(!d.expiresAt) return false;
    var days = getDaysUntilExpiry(d.expiresAt);
    return days !== null && days <= 90;
  });

  var html = '';
  if(expiring.length) {
    html += '<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:12px 14px;margin-bottom:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:#C2410C;margin-bottom:8px">⚠️ '+expiring.length+' document'+(expiring.length===1?'':'s')+' expiring soon</div>';
    expiring.forEach(function(d){
      var days = getDaysUntilExpiry(d.expiresAt);
      var col  = days < 0 ? '#DC2626' : days <= 30 ? '#EA580C' : '#D97706';
      html += '<div style="font-size:12px;color:var(--text);display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #FED7AA">'
        +'<span>'+d.type+'</span>'
        +'<span style="font-weight:700;color:'+col+'">'+(days<0?'Expired '+Math.abs(days)+'d ago':days===0?'Expires today':'Expires in '+days+'d')+'</span></div>';
    });
    html += '</div>';
  }

  // Upload controls
  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">';
  html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Upload Document</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
  html += '<div><label style="font-size:11px;color:var(--muted);font-weight:600">Document Type</label>'
    +'<select class="inp" id="pdoc-type-'+p.id+'" style="margin-top:4px">'
    +PROP_DOC_TYPES.map(function(dt){return '<option>'+dt.type+'</option>';}).join('')
    +'</select></div>';
  html += '<div><label style="font-size:11px;color:var(--muted);font-weight:600">Expiry Date</label>'
    +'<input type="date" class="inp" id="pdoc-expires-'+p.id+'" style="margin-top:4px"></div>';
  html += '</div>';
  html += '<input type="file" id="pvault-input-'+p.id+'" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="uploadPropDocFromInput(this)">'
    +'<button onclick="document.getElementById(\'pvault-input-'+p.id+'\').click()" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px dashed var(--accent);background:var(--accent-light);cursor:pointer;width:100%;font-family:inherit;text-align:left">'
    +'<span style="font-size:20px">📎</span>'
    +'<div><div style="font-size:13px;font-weight:700;color:var(--accent-dark)">Choose File</div>'
    +'<div style="font-size:11px;color:var(--muted)">PDF, JPG, PNG · max 20MB</div></div>'
    +'</button>';
  html += '</div>';

  // Document list
  if(!docs.length) {
    html += '<div style="text-align:center;padding:32px;color:var(--dim);font-size:13px">📂 No documents uploaded yet</div>';
  } else {
    docs.forEach(function(doc){
      var meta  = getPropDocMeta(doc.type);
      var days  = doc.expiresAt ? getDaysUntilExpiry(doc.expiresAt) : null;
      var expiryBadge = '';
      if(days !== null) {
        var col  = days < 0 ? '#DC2626' : days <= 30 ? '#EA580C' : days <= 90 ? '#D97706' : '#059669';
        var bg   = days < 0 ? '#FEE2E2' : days <= 30 ? '#FFF7ED' : days <= 90 ? '#FFFBEB' : '#DCFCE7';
        var txt  = days < 0 ? 'Expired' : days === 0 ? 'Today!' : days <= 30 ? days+'d left' : days <= 90 ? days+'d left' : 'Valid';
        expiryBadge = '<span style="font-size:10px;font-weight:700;color:'+col+';background:'+bg+';padding:2px 8px;border-radius:6px">⏰ '+txt+'</span>';
      }
      html += '<div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid '
        +(days!==null&&days<=30?'#FECDD3':days!==null&&days<=90?'#FED7AA':'var(--border)')
        +';border-radius:10px;padding:11px 13px;margin-bottom:8px">'
        +'<div style="width:38px;height:38px;border-radius:9px;background:'+meta.color+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'+meta.icon+'</div>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+doc.name+'</div>'
        +'<div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">'
        +'<span style="font-size:10px;font-weight:700;color:'+meta.textColor+';background:'+meta.color+';padding:1px 7px;border-radius:5px">'+doc.type+'</span>'
        +'<span style="font-size:10px;color:var(--muted)">'+doc.size+' · '+doc.uploadedAt+'</span>'
        +(doc.expiresAt?'<span style="font-size:10px;color:var(--muted)">Exp: '+new Date(doc.expiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+'</span>':'')
        +expiryBadge
        +'</div></div>'
        +'<div style="display:flex;gap:5px;flex-shrink:0">'
        +(doc.dataUrl?'<a href="'+doc.dataUrl+'" download="'+doc.name+'" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--blue);text-decoration:none">↓</a>':'')
        +'<button onclick="removePropDoc(\'+p.id+\',\'+doc.id+\')" style="padding:5px 9px;border-radius:7px;border:1px solid #FECDD3;background:#FFF1F2;font-size:11px;font-weight:700;color:#E11D48;cursor:pointer;font-family:inherit">&#x2715;</button>'
        +'</div></div>';
    });
  }
  return html;
}
