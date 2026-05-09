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

  // _waEmoji() decorates with emojis on mobile, plain text on desktop.
  var prop = state.properties.find(function(p){ return p.name===m.property; });
  var NL = '\n';
  var jobMsg = _waEmoji('🔧 ') + '*JOB REQUEST — landlordapp.io*'+NL
    +'━━━━━━━━━━━━━━━━'+NL
    +'*Issue:* '+m.issue+NL
    +'*Property:* '+m.property+NL
    +(prop&&prop.address&&prop.address!==m.property?'*Address:* '+prop.address+NL:'')
    +(m.room?'*Room:* '+m.room+NL:'')
    +(m.tenant?'*Tenant:* '+m.tenant+NL:'')
    +'*Priority:* '+(m.priority||'Normal').toUpperCase()+NL
    +(m.notes?NL+'*Details:* '+m.notes+NL:'')
    +(prop&&prop.mapsUrl?NL+_waEmoji('📍 ')+'*Map:* '+prop.mapsUrl+NL:'')
    +'━━━━━━━━━━━━━━━━'+NL
    +'Please confirm if you can attend and your estimated arrival.'+NL
    +'_Sent via landlordapp.io_';

  var _safeJobMsg = _waSanitize(jobMsg);
  var cRows = contractors.map(function(c) {
    var waNum = c.whatsapp ? String(c.whatsapp||'').replace(/\D/g,'') : '';
    var waHref = waNum ? 'https://wa.me/'+waNum+'?text='+encodeURIComponent(_safeJobMsg) : '';
    var mailHref = c.email ? 'mailto:'+c.email
      +'?subject='+encodeURIComponent('[Job Request] '+m.issue+' — '+m.property)
      +'&body='+encodeURIComponent(jobMsg) : '';
    var stars = c.rating ? '★'.repeat(c.rating) : '';
    var isAssigned = m.contractor === c.name;
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:'+(isAssigned?'#ECFDF5':'var(--bg)')+';border:1px solid '+(isAssigned?'#A7F3D0':'var(--border)')+';border-radius:10px;margin-bottom:8px">'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">'+esc(c.name)
      +(isAssigned?'<span style="font-size:10px;font-weight:700;color:#16A34A;background:#DCFCE7;border:1px solid #A7F3D0;padding:2px 8px;border-radius:6px">ASSIGNED</span>':'')
      +'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+c.trade+(stars?' · <span style="color:var(--amber)">'+stars+'</span>':'')+'</div>'
      +(c.callOutCharge?'<div style="font-size:11px;color:var(--dim)">Call-out: £'+c.callOutCharge+'</div>':'')
      +'</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">'
      +(isAssigned
        ? '<button data-mid="'+m.id+'" onclick="unassignContractorFromMaint(this.dataset.mid)" style="padding:7px 12px;border-radius:8px;background:#FFF7ED;border:1px solid #FED7AA;color:#C2410C;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Unassign</button>'
        : '<button data-mid="'+m.id+'" data-cid="'+c.id+'" onclick="assignContractorToMaint(this.dataset.mid,this.dataset.cid)" style="padding:7px 12px;border-radius:8px;background:var(--accent);border:none;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Assign</button>')
      +(waHref?'<a href="'+waHref+'" target="_blank" onclick="assignContractorToMaint(\''+m.id+'\',\''+c.id+'\');closeModal()" style="padding:7px 12px;border-radius:8px;background:#F0FDF4;border:1px solid #BBF7D0;color:#16A34A;font-size:12px;font-weight:700;text-decoration:none">💬 WA</a>':'')
      +(mailHref?'<a href="'+mailHref+'" onclick="assignContractorToMaint(\''+m.id+'\',\''+c.id+'\');closeModal()" style="padding:7px 12px;border-radius:8px;background:var(--blue-light);border:1px solid #BFDBFE;color:var(--blue);font-size:12px;font-weight:700;text-decoration:none">✉️ Email</a>':'')
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
    +'<div style="font-size:13px;font-weight:700;margin-bottom:2px">'+esc(m.issue)+'</div>'
    +'<div style="font-size:12px;color:var(--muted)">'+esc(m.property)+(m.room?' · Room '+esc(m.room):'')+'</div>'
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

/** Assign a contractor to a maintenance job directly from the send-to-contractor
 *  dialog. Also marks the contractor as used (lastUsed=today) and re-renders the
 *  dialog so the "ASSIGNED" badge flips over. Called both by the "Assign" action
 *  and as a side-effect of the WA / Email links. */
function assignContractorToMaint(maintId, contractorId) {
  var m = state.maintenance.find(function(x){ return String(x.id)===String(maintId); });
  var c = (state.contractors||[]).find(function(x){ return String(x.id)===String(contractorId); });
  if(!m || !c) return;
  m.contractor = c.name;
  c.lastUsed = new Date().toISOString().split('T')[0];
  if(typeof saveStateImmediate === 'function') saveStateImmediate({silentSuccess:true}); else saveState();
  if(typeof showToast === 'function') showToast(c.name+' assigned to this job','success');
  // Re-render the open dialog so the badge updates.
  if(document.querySelector('.modal-overlay')) {
    sendToContractorModal(maintId);
  } else {
    render();
  }
}

function unassignContractorFromMaint(maintId) {
  var m = state.maintenance.find(function(x){ return String(x.id)===String(maintId); });
  if(!m) return;
  m.contractor = '';
  if(typeof saveStateImmediate === 'function') saveStateImmediate({silentSuccess:true}); else saveState();
  if(typeof showToast === 'function') showToast('Contractor unassigned','success');
  if(document.querySelector('.modal-overlay')) {
    sendToContractorModal(maintId);
  } else {
    render();
  }
}
if(typeof window !== 'undefined') {
  window.assignContractorToMaint    = assignContractorToMaint;
  window.unassignContractorFromMaint= unassignContractorFromMaint;
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
  msg+='---\nSent via landlordapp.io';
  window.open('https://wa.me/?text='+encodeURIComponent(_waSanitize(msg)),'_blank');
}

function shareAllMaintWA() {
  var open=state.maintenance.filter(function(m){return m.status!=='resolved';});
  if(!open.length){showToast('No open maintenance tasks','error');return;}
  var NL='\n';
  var dateStr = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

  // ── Device-aware emoji decoration ────────────────────────────────────────
  // _waEmoji() returns the emoji on mobile (where WhatsApp renders 4-byte
  // UTF-8 fine) and an empty string on desktop browsers (where WhatsApp Web
  // mangles 4-byte emojis to �). Same code path produces a rich message on
  // mobile and a clean text message on desktop. _waSanitize at the bottom
  // also strips 4-byte chars from user-typed fields on desktop only.
  // ─────────────────────────────────────────────────────────────────────────

  // Group by property — same building's jobs read together (faster for contractors).
  var byProp = {};
  open.forEach(function(m){
    var key = m.property || 'Unassigned';
    if(!byProp[key]) byProp[key] = [];
    byProp[key].push(m);
  });

  // Sort: urgent buildings first, then by job count desc, then alpha
  var urgentCount = open.filter(function(m){return m.priority==='urgent';}).length;
  var propKeys = Object.keys(byProp).sort(function(a,b){
    var aU = byProp[a].some(function(m){return m.priority==='urgent';});
    var bU = byProp[b].some(function(m){return m.priority==='urgent';});
    if (aU !== bU) return aU ? -1 : 1;
    if (byProp[b].length !== byProp[a].length) return byProp[b].length - byProp[a].length;
    return a.localeCompare(b);
  });

  var msg = _waEmoji('🔧 ') + '*OPEN MAINTENANCE*' + NL;
  msg += _waEmoji('📋 ') + '*' + open.length + '* job' + (open.length===1?'':'s');
  if (urgentCount) msg += ' (' + _waEmoji('🚨 ') + '*' + urgentCount + ' urgent*)';
  msg += NL + _waEmoji('📅 ') + dateStr + NL;
  msg += '━━━━━━━━━━━━━━━━' + NL;

  var jobNum = 0;
  propKeys.forEach(function(propName, pIdx) {
    var jobs = byProp[propName];
    var prop = state.properties.find(function(p){return p.name===propName;});
    var addr = prop && prop.address && prop.address !== propName ? prop.address : '';

    // Property header
    msg += NL + _waEmoji('🏠 ') + '*' + propName + '*' + NL;
    if (addr) msg += '   ' + _waEmoji('📍 ') + addr + NL;
    if (prop && prop.mapsUrl) msg += '   ' + _waEmoji('🗺️ ') + prop.mapsUrl + NL;
    msg += NL;

    jobs.forEach(function(m, jIdx) {
      jobNum++;
      var priIcon = m.priority==='urgent' ? _waEmoji('🚨 ') : m.priority==='high' ? _waEmoji('⚠️ ') : '';
      var priLabel = m.priority==='urgent' ? ' *[URGENT]*' : m.priority==='high' ? ' *[HIGH]*' : '';
      var statusLabel = (m.status||'open').replace('_',' ').toUpperCase();
      var cat = m.category || m.cat;

      msg += jobNum + '. ' + priIcon + '*' + m.issue + '*' + priLabel + NL;
      if (m.room) msg += '   ' + _waEmoji('🚪 ') + 'Room: ' + m.room + NL;
      if (m.tenant) msg += '   ' + _waEmoji('👤 ') + 'Tenant: ' + m.tenant + NL;
      if (cat) msg += '   ' + _waEmoji('🏷️ ') + 'Category: ' + cat + NL;
      if (m.notes) msg += '   ' + _waEmoji('📝 ') + 'Notes: ' + m.notes + NL;
      if (m.contractor) msg += '   ' + _waEmoji('👷 ') + 'Assigned: ' + m.contractor + NL;
      msg += '   Status: *' + statusLabel + '*' + NL;
      if (jIdx < jobs.length - 1) msg += '   ────────────' + NL;
    });

    if (pIdx < propKeys.length - 1) msg += NL + '━━━━━━━━━━━━━━━━' + NL;
  });

  msg += NL + '━━━━━━━━━━━━━━━━' + NL;
  msg += '_Sent via landlordapp.io_';

  // Final sanitisation: catches any 4-byte emojis users typed into job titles,
  // notes, tenant names, etc. Without this, those would render as � on WhatsApp.
  window.open('https://wa.me/?text='+encodeURIComponent(_waSanitize(msg)),'_blank');
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — PROPERTY DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
function shareAllPropDocs(propId, propNameEncoded) {
  var propName = decodeURIComponent(propNameEncoded);
  var docs = (state.propDocs&&state.propDocs[propId])||[];
  if(!docs.length){ showToast('No documents to share','error'); return; }
  // _waEmoji() adds icons on mobile, drops them on desktop browsers.
  var msg = _waEmoji('📂 ') + '*PROPERTY DOCUMENTS*\n*Property:* '+propName+'\n━━━━━━━━━━━━━━━━\n';
  docs.forEach(function(doc,i){
    var days = doc.expiresAt ? getDaysUntilExpiry(doc.expiresAt) : null;
    var expStr = days===null?'':(days<0?' '+_waEmoji('⛔ ')+'[EXPIRED]':days<=30?' '+_waEmoji('⚠️ ')+'[Expires in '+days+'d]':' '+_waEmoji('✅ ')+'[Valid]');
    msg+=(i+1)+'. *'+doc.type+'*'+expStr+'\n   '+doc.name+' ('+doc.size+')'+'\n'
      +(doc.expiresAt?'   Exp: '+new Date(doc.expiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+'\n':'');
  });
  msg+='━━━━━━━━━━━━━━━━\n_Sent via landlordapp.io_';
  window.open('https://wa.me/?text='+encodeURIComponent(_waSanitize(msg)),'_blank');
}

function clearSavedState(){
  var _kr=[];
  var _orgSfx = (typeof _currentOrgId !== 'undefined' && _currentOrgId) ? ('_' + String(_currentOrgId)) : '';
  for(var _i=0;_i<localStorage.length;_i++){
    var _k=localStorage.key(_i);
    if(!_k||!_k.startsWith('pm_')) continue;
    // Reset only the active org's cache to avoid wiping other accounts in the same browser.
    if(!_orgSfx || _k.endsWith(_orgSfx)) _kr.push(_k);
  }
  // Remove legacy global keys that were previously unscoped and can leak across account switches.
  ['pm_local_page','pm_agent_cache','pm_agent_cache_ts','pm_email_config','pm_local_config','pm_local_roles'].forEach(function(k){
    if(localStorage.getItem(k)!=null) _kr.push(k);
  });
  _kr.forEach(function(k){localStorage.removeItem(k);});
  location.reload();
}
var _origRender=render;
render=function(){
  // During boot we skip painting so org-scoped data never flashes wrong; after boot always repaint.
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
/** Sync room vacant/occupied + per-property rent from tenants (same as after loadState). Safe to call on Tenants tab render. */
function syncPropertyRoomsFromTenants(){
  state.properties.forEach(function(p){
    var propTenants = state.tenants.filter(function(t){return t.property===p.name&&t.status!=='inactive';});
    if(Array.isArray(p.roomList) && p.roomList.length){
      p.roomList.forEach(function(r){
        var tenant = state.tenants.find(function(t){
          return t.property===p.name && t.status!=='inactive' && roomNumsEqual(t.room, r.n);
        });
        r.status = tenant ? 'occupied' : 'vacant';
        if(tenant && tenant.rent > 0) r.price = tenant.rent;
      });
      var occFromRooms = p.roomList.filter(function(r){return r.status==='occupied';}).length;
      if ((p.lettingType||'hmo')!=='whole' && propTenants.length > 0 && occFromRooms === 0) {
        p.occupied = Math.min(propTenants.length, p.roomList.length);
      } else if ((p.lettingType||'hmo')==='whole' && propTenants.length > 0) {
        p.occupied = Math.min(propTenants.length, p.rooms || 1);
      } else {
        p.occupied = occFromRooms;
      }
      var occupiedPrices = p.roomList.filter(function(r){return r.status==='occupied'&&r.price>0;}).map(function(r){return r.price;});
      if(occupiedPrices.length) {
        var avgPrice = Math.round(occupiedPrices.reduce(function(s,v){return s+v;},0)/occupiedPrices.length);
        p.roomList.forEach(function(r){if(r.status==='vacant'&&r.price===0) r.price=avgPrice;});
      }
    } else {
      // Fallback for older properties lacking roomList:
      // hydrate synthetic room rows so Rooms tab can render mixed occupancy correctly.
      var maxTenantRoom = propTenants.reduce(function(mx, t){
        var rn = Number(t && t.room);
        return isNaN(rn) ? mx : Math.max(mx, rn);
      }, 0);
      var inferredRooms = Math.max(0, Number(p.rooms)||0, propTenants.length, maxTenantRoom);
      if(inferredRooms > 0){
        p.roomList = [];
        var avgWeekly = propTenants.length
          ? Math.round(propTenants.reduce(function(s,t){
              var weekly = (t && t.freq==='monthly') ? ((Number(t.rent)||0)*12/52) : (Number(t && t.rent)||0);
              return s + (weekly||0);
            },0)/propTenants.length)
          : 0;
        for(var i=1;i<=inferredRooms;i++){
          var tenantForRoom = propTenants.find(function(t){ return roomNumsEqual(t.room, i); });
          p.roomList.push({
            n:i,
            type:'Single',
            price:tenantForRoom ? (Number(tenantForRoom.rent)||avgWeekly||0) : (avgWeekly||0),
            status:tenantForRoom ? 'occupied' : 'vacant'
          });
        }
      }
      p.occupied = propTenants.length;
      if(!p.rooms || p.rooms < p.occupied) p.rooms = p.occupied;
    }
    var billable = propTenants.filter(function(t){
      return typeof isBillableTenant === 'function' ? isBillableTenant(t) : (t.status === 'active' || t.status === 'notice_given');
    });
    p.rent = Math.round(billable.reduce(function(s,t){
      return s + (typeof tenantMonthlyRent === 'function'
        ? tenantMonthlyRent(t)
        : (t.freq==='monthly' ? t.rent : (t.rent||0)*52/12));
    }, 0));
  });
}
function runAfterSupabaseLoad(){
  syncPropertyRoomsFromTenants();
  rebuildAllSchedules();
  if (typeof repairPaymentDueDatesUtcShift === 'function') repairPaymentDueDatesUtcShift();
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
  // PERF: storage list() is a network round-trip — only run when the user is
  // actually viewing this property's Docs tab (i.e. when this function gets
  // called). The id collision fix below is the bigger deal: previously
  // `id: f.name` made two properties with a "gas-cert.pdf" both end up with
  // id="gas-cert.pdf" — saveState's upsert then 500'd with "ON CONFLICT
  // cannot affect row a second time". Prefixing with property id makes ids
  // unique across properties while staying stable per (property, file).
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
        var stableId = 'p:' + String(p.id) + ':' + f.name;
        supaFiles.push({id:stableId,name:f.name,type:'Document',size:fsz,uploadedAt:fdt,expiresAt:null,dataUrl:url,storagePath:path,_fromStorage:true});
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

  // ── Inspections block ─────────────────────────────────────────────────────
  var _insps = Array.isArray(p.inspections) ? p.inspections.slice() : [];
  _insps.sort(function(a,b){
    var ta = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
    var tb = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });
  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">🔍 Property Inspections</div>';
  html += '<button onclick="openInspectionModal(\''+p.id+'\')" style="padding:8px 14px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ New Inspection</button>';
  html += '</div>';
  if(!_insps.length) {
    html += '<div style="font-size:12px;color:var(--muted);padding:8px 0">No inspections logged yet. File a report to document property condition with photos and notes.</div>';
  } else {
    _insps.forEach(function(insp){
      var _dt = insp.timestamp ? new Date(insp.timestamp) : null;
      var _dtLbl = _dt ? _dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' · '+_dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
      var _rating = insp.overallRating || 'Good';
      var _ratingCol = _rating==='Excellent'?'var(--green)':_rating==='Good'?'var(--blue)':_rating==='Fair'?'var(--amber)':'var(--red)';
      var _ratingBg  = _rating==='Excellent'?'#DCFCE7':_rating==='Good'?'#DBEAFE':_rating==='Fair'?'#FEF3C7':'#FEE2E2';
      var _photoCount = (insp.photos||[]).length;
      html += '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">';
      html += '<span style="font-size:13px;font-weight:700;color:var(--text)">'+esc(insp.inspector||'Inspection')+'</span>';
      html += '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;color:var(--muted);background:var(--bg);border:1px solid var(--border)">'+(insp.roomN?('Room '+insp.roomN):'Whole property')+'</span>';
      html += '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;color:'+_ratingCol+';background:'+_ratingBg+'">'+esc(_rating)+'</span>';
      if(_photoCount) html += '<span style="font-size:10px;color:var(--muted)">📎 '+_photoCount+' photo'+(_photoCount===1?'':'s')+'</span>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--muted)">'+_dtLbl+'</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:6px;flex-shrink:0">';
      html += '<button onclick="viewInspection(\''+p.id+'\',\''+insp.id+'\')" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">View</button>';
      html += '<button onclick="deleteInspection(\''+p.id+'\',\''+insp.id+'\')" style="padding:5px 9px;border-radius:7px;border:1px solid #FECDD3;background:#FFF1F2;color:#E11D48;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">×</button>';
      html += '</div>';
      html += '</div>';
      if(insp.notes) {
        html += '<div style="font-size:12px;color:var(--text-mid);line-height:1.5;margin-top:4px;padding-top:6px;border-top:1px solid var(--border);white-space:pre-wrap;max-height:60px;overflow:hidden">'+esc(insp.notes)+'</div>';
      }
      html += '</div>';
    });
  }
  html += '</div>';

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
        // Download is always shown — handler lazy-loads doc.dataUrl on click
        // since loadState skips it to keep boot fast.
        +'<button onclick="downloadDoc(\''+doc.id+'\')" style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;font-weight:700;color:var(--blue);cursor:pointer;font-family:inherit">↓</button>'
        +'<button onclick="emailDocToTenants(\''+p.id+'\',\''+doc.id+'\')" style="padding:5px 9px;border-radius:7px;border:1px solid var(--purple);background:var(--purple-light);font-size:11px;font-weight:700;color:var(--purple);cursor:pointer;font-family:inherit" title="Email to tenants">✉</button>'
        +'<button onclick="removePropDoc(\''+p.id+'\',\''+doc.id+'\')" style="padding:5px 9px;border-radius:7px;border:1px solid #FECDD3;background:#FFF1F2;font-size:11px;font-weight:700;color:#E11D48;cursor:pointer;font-family:inherit">&#x2715;</button>'
        +'</div></div>';
    });
  }
  return html;
}
