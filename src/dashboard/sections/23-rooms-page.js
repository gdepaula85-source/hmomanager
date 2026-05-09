// ── ROOMS PAGE ─────────────────────────────────────────────────────────────────
function listingsOrgDisplayName(){
  var o=state._currentOrg;
  return (o&&o.name)?o.name:'Our team';
}

/** Open public listings in a new tab. Must open the tab synchronously on click (popup blockers kill async window.open). */
function openPublicListingsInNewTab(e, url) {
  var u = url || '/rooms.html';
  if (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return true;
    e.preventDefault();
  }
  var w = window.open('', '_blank');
  if (!w) {
    window.location.href = u;
    return false;
  }
  try { w.opener = null; } catch (err) {}
  if (!_currentOrgId) {
    w.location.href = u;
    return false;
  }
  supa.auth.getSession().then(function (res) {
    var s = res.data && res.data.session;
    if (s) {
      try {
        sessionStorage.setItem('pm_listings_bearer_' + String(_currentOrgId), s.access_token);
      } catch (err) {}
    }
    try {
      if (!w.closed) w.location.href = u;
      else window.open(u, '_blank', 'noopener,noreferrer');
    } catch (e2) {
      window.location.href = u;
    }
  }).catch(function () {
    try {
      if (!w.closed) w.location.href = u;
      else window.open(u, '_blank', 'noopener,noreferrer');
    } catch (e3) {
      window.location.href = u;
    }
  });
  return false;
}
function getPostcode(a){var m=a&&a.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/i);return m?m[0].toUpperCase():'';}
/** True when room row is vacant (sync uses lowercase "vacant"). */
function isVacantRoomStatus(r){return String(r&&r.status!=null?r.status:'').toLowerCase()==='vacant';}
/** Map legacy "Whole Property" etc. for the type filter dropdown. */
function roomTypeKeyForFilter(r){
  var t=String((r&&r.type)||'Single').trim();
  if(/^whole\s/i.test(t)||/^whole$/i.test(t))return'Whole House';
  return t;
}
var _roomMediaMap = {};  // elemId -> {pid, rn}

function registerMedia(elemId, pid, rn) { _roomMediaMap[elemId] = {pid:pid, rn:rn}; }
function getMediaByElem(el) {
  var info = _roomMediaMap[el.id] || _roomMediaMap[el.dataset && el.dataset.mid];
  if(!info) { console.warn('No media info for element:', el.id); return null; }
  return getMedia(info.pid, info.rn);
}

function getMedia(pid,n){if(!state.roomMedia)state.roomMedia={};var k=pid+'_'+n;if(!state.roomMedia[k])state.roomMedia[k]={photos:[],video:null,notes:''};return state.roomMedia[k];}

function buildGalleryUrl(pid, rn) {
  var base = window.location.origin + '/gallery.html';
  return base + '?p=' + encodeURIComponent(pid) + '&r=' + rn;
}

function stripHouseNo(addr) {
  // Remove leading house number for privacy, also dedupe trailing postcode
  var s = (addr||'').replace(/^\d+[A-Za-z]?[\s,]+/, '').trim();
  // Remove postcode at the end to avoid duplication (it's shown separately)
  s = s.replace(/,?\s*[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}\s*$/i, '').trim().replace(/,+\s*$/, '').trim();
  return s;
}

function shareRoomWA(pid,rn){
  var p=state.properties.find(function(x){return x.id===pid;});
  var r=p&&p.roomList?p.roomList.find(function(x){return x.n===rn;}):null;
  if(!p||!r)return;
  var pc=getPostcode(p.address);
  var media=getMedia(pid,rn);
  var monthly=Math.round(r.price*52/12);
  var galleryUrl = buildGalleryUrl(pid, rn);
  var NL='\n';
  // _waEmoji() — emojis on mobile, plain text on desktop browsers.
  var typeIcon = {Single:'🛏️',Double:'🛏️🛏️',Suite:'✨',Studio:'🏠','Whole House':'🏡'}[r.type||'Single']||'🛏️';
  var msg=_waEmoji('🏠 ')+'*Room Available — '+p.area+'*'+NL;
  msg+='━━━━━━━━━━━━━━━━'+NL+NL;
  msg+=_waEmoji('📍 ')+stripHouseNo(p.address)+', '+pc+NL;
  var _noticeTenantWA = state.tenants.find(function(t){return t.property===p.name&&t.room===r.n&&t.status==='notice_given'&&t.moveOutDate;});
  var _availFromWA = _noticeTenantWA ? new Date(_noticeTenantWA.moveOutDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : null;
  msg+=_waEmoji(typeIcon+' ')+'*'+(r.type||'Room')+' · Room '+r.n+'*'+NL;
  if(_availFromWA) msg+=_waEmoji('📅 ')+'*Available from:* '+_availFromWA+NL;
  msg+=_waEmoji('💷 ')+'*Rent:* £'+r.price+'/week (£'+monthly+'/mo equiv.)'+NL;
  if(p.mapsUrl) msg+=_waEmoji('🗺️ ')+'*Map:* '+p.mapsUrl+NL;
  if(media.notes) msg+=NL+_waEmoji('📝 ')+'*Notes:* '+media.notes+NL;
  if(galleryUrl && media.photos && media.photos.length>0) {
    msg+=NL+_waEmoji('📸 ')+'*Photos ('+(media.photos.length)+'):* '+galleryUrl+NL;
  }
  if(media.video) msg+=_waEmoji('🎥 ')+'*Video tour available — ask us to send it*'+NL;
  msg+=NL+'━━━━━━━━━━━━━━━━'+NL;
  msg+=_waEmoji('📞 ')+'*Contact us now to arrange a FREE viewing!*';
  var url = 'https://wa.me/?text='+encodeURIComponent(_waSanitize(msg));
  var w = window.open(url,'_blank');
  if(!w) window.location.href = url;
}

function shareAllRoomsWA(){
  var v=[];
  state.properties.forEach(function(p){if(!isPropertyActive(p))return;(p.roomList||[]).forEach(function(r){if(isVacantRoomStatus(r)&&!r._hidden)v.push({p:p,r:r});});});
  if(!v.length){alert('No vacant rooms to share.');return;}
  var NL='\n';
  // _waEmoji() — emojis on mobile, plain text on desktop browsers.
  var msg=_waEmoji('🏠 ')+'*Available Rooms — '+listingsOrgDisplayName()+'*'+NL;
  msg+='━━━━━━━━━━━━━━━━'+NL+NL;
  v.forEach(function(item,i){
    var p=item.p;var r=item.r;
    var pc=getPostcode(p.address);
    var monthly=Math.round(r.price*52/12);
    var typeIcon={Single:'🛏️',Double:'🛏️🛏️',Suite:'✨',Studio:'🏠'}[r.type||'Single']||'🛏️';
    var media=getMedia(p.id,r.n);
    msg+=(i+1)+'. '+_waEmoji(typeIcon+' ')+'*'+(r.type||'Room')+' · '+p.area+'*'+NL;
    msg+='   '+_waEmoji('📍 ')+stripHouseNo(p.address)+', '+pc+NL;
    msg+='   '+_waEmoji('💷 ')+'*£'+r.price+'/wk* (£'+monthly+'/mo)'+NL;
    if(p.mapsUrl) msg+='   '+_waEmoji('🗺️ ')+'Map: '+p.mapsUrl+NL;
    if(media.photos&&media.photos.length>0){
      var gurl=buildGalleryUrl(p.id,r.n);
      msg+='   '+_waEmoji('📸 ')+media.photos.length+' photo'+(media.photos.length===1?'':'s')+' available'+NL;
      if(gurl) msg+='   '+_waEmoji('🔗 ')+gurl+NL;
    }
    msg+=NL;
  });
  msg+='━━━━━━━━━━━━━━━━'+NL;
  msg+=_waEmoji('📞 ')+'*Reply or call to book a FREE viewing!*';
  window.open('https://wa.me/?text='+encodeURIComponent(_waSanitize(msg)),'_blank');
}

async function handlePhotoUpload(pid,rn,input){
  // Guard: reject truly empty or undefined pids
  if(!pid || pid === 'undefined' || pid === 'prop' || pid.length < 3) {
    showToast('Please refresh the page and try again', 'error');
    return;
  }
  var files=Array.from(input.files);var media=getMedia(pid,rn);
  var maxPhotos = 4;
  var toUpload = Array.from(files).slice(0, maxPhotos - media.photos.length);
  for(var i=0; i<toUpload.length; i++){
    var file = toUpload[i];
    if(file.size > 5*1024*1024){ showToast('Photo too large (max 5MB)', 'error'); continue; }
    showToast('Uploading...', 'success');
    // Always store locally first for immediate display
    var localReader = new FileReader();
    var fileRef = file;
    localReader.onload = (function(lf, lpid, lrn) { return function(e) {
      var localMedia = getMedia(lpid, lrn);
      // Store a temporary placeholder (no base64 in state to avoid localStorage quota)
      var localEntry = {src:e.target.result, name:lf.name, _localOnly:true};
      localMedia.photos.push(localEntry);
      render(); // show photo immediately from memory
      showToast('Uploading photo...', 'success');
      // Upload to Supabase Storage
      (async function() {
        try {
          var ext = lf.name.split('.').pop().toLowerCase();
          var path = 'rooms/'+lpid+'/'+lrn+'/'+Date.now()+'.'+ext;
          var upload = await supa.storage.from('room-media').upload(path, lf, {upsert:true});
          if(upload.error) throw upload.error;
          var urlData = supa.storage.from('room-media').getPublicUrl(path);
          var url = urlData.data.publicUrl;
          if(url) {
            // Replace temp base64 with permanent Supabase URL
            var idx = localMedia.photos.indexOf(localEntry);
            if(idx >= 0) localMedia.photos[idx] = {src:url, name:lf.name, path:path};
            saveState(); // now saves small URL string, not 4MB base64
            render();
            showToast('Photo uploaded ✓', 'success');
            console.log('Photo synced to Supabase:', url);
          }
        } catch(err) {
          console.warn('Photo upload failed:', err.message);
          showToast('Upload failed: '+(err.message||'check connection'), 'error');
          // Keep local copy only for this session (not saved to localStorage to avoid quota)
          render();
        }
      })();
    };})(fileRef, pid, rn);
    localReader.readAsDataURL(file);
  }
}

function renderRooms(){
  if(typeof syncPropertyRoomsFromTenants==='function')syncPropertyRoomsFromTenants();
  window._roomEidMap = {};  // reset on every render
  var publicRoomsUrl = '/rooms.html' + (_currentOrgId ? ('?org=' + encodeURIComponent(String(_currentOrgId))) : '');
  // All vacant rows in roomList (dashboard view). _hidden = hidden from public page only, still listed here.
  var allV=[];
  state.properties.forEach(function(p){
    if(!isPropertyActive(p)) return;
    (p.roomList||[]).forEach(function(r){
      if(isVacantRoomStatus(r)) allV.push({p:p,r:r});
    });
  });
  var f={area:state.filters.roomArea||'all',type:state.filters.roomType||'all',sort:state.filters.roomSort||'price_asc'};
  var areas=[];allV.forEach(function(x){if(areas.indexOf(x.p.area)<0)areas.push(x.p.area);});
  var filtered=allV.filter(function(x){return(f.area==='all'||x.p.area===f.area)&&(f.type==='all'||roomTypeKeyForFilter(x.r)===f.type);});
  filtered.sort(function(a,b){return f.sort==='price_desc'?b.r.price-a.r.price:f.sort==='area'?a.p.area.localeCompare(b.p.area):a.r.price-b.r.price;});
  var totalVacantPotentialMo = Math.round(allV.reduce(function(s,x){return s+x.r.price;},0)*52/12);
  var avgPerRoom = allV.length ? Math.round(allV.reduce(function(s,x){return s+x.r.price;},0) / allV.length) : 0;
  var propsWithVacancies = state.properties.filter(function(p){return isPropertyActive(p)&&(p.roomList||[]).some(function(r){return isVacantRoomStatus(r);});}).length;
  var publicBtn = '<a href="'+publicRoomsUrl+'" target="_blank" rel="noopener noreferrer" onclick="return openPublicListingsInNewTab(event,'+JSON.stringify(publicRoomsUrl)+')" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;color:var(--gray-700);font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px">🌐</a>';
  var shareBtn = '<button onclick="shareAllRoomsWA()" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Share</button>';
  var html = '';
  html += renderScreenHeader({
    title:'Vacancies',
    subtitle: filtered.length + (filtered.length===1?' vacancy':' vacancies') + ' · ' + propsWithVacancies + ' propert' + (propsWithVacancies===1?'y':'ies'),
    rightActions: [publicBtn, shareBtn]
  });
  html += renderHeroCard({
    icon: '📈',
    label: 'Untapped Potential / Month',
    value: '<span style="color:#fff">' + fmt(totalVacantPotentialMo) + '</span>',
    subtitle: 'If all ' + allV.length + ' vacanc' + (allV.length===1?'y':'ies') + ' were filled'
  });
  html += renderStatRow([
    { label:'Vacant',     value: allV.length, color: allV.length?'orange':'default' },
    { label:'Properties', value: propsWithVacancies, color:'default' },
    { label:'Avg / Room', value: '£' + avgPerRoom.toLocaleString() + '/wk', color:'teal' }
  ]);
  html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  html+='<select class="inp" style="max-width:140px" onchange="state.filters.roomArea=this.value;render()"><option value="all">All Areas</option>'+areas.map(function(a){return '<option value="'+a+'" '+(f.area===a?'selected':'')+'>'+a+'</option>';}).join('')+'</select>';
  html+='<select class="inp" style="max-width:140px" onchange="state.filters.roomSort=this.value;render()"><option value="price_asc">Price up</option><option value="price_desc">Price down</option><option value="area">Area</option></select>';
  html+='</div>';
  // Room-type chips — clicking a chip filters; clicking the active chip again clears the filter.
  html+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;align-items:center">';
  html+='<span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-right:4px">Room type</span>';
  ['Single','Double','Suite','Studio','Whole House'].forEach(function(t){
    var active = f.type === t;
    var bg = active ? 'var(--teal-500,#00B894)' : '#fff';
    var fg = active ? '#fff' : 'var(--gray-700,#374151)';
    var bd = active ? 'var(--teal-500,#00B894)' : 'var(--gray-200,#E5E7EB)';
    var click = "state.filters.roomType=(state.filters.roomType==='"+t+"'?'all':'"+t+"');render()";
    html += '<button type="button" onclick="'+click+'" style="padding:6px 12px;border-radius:999px;border:1px solid '+bd+';background:'+bg+';color:'+fg+';font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">'+t+(active?' ✓':'')+'</button>';
  });
  if (f.type !== 'all') {
    html += '<button type="button" onclick="state.filters.roomType=\'all\';render()" title="Clear room-type filter" style="padding:6px 10px;border-radius:999px;border:1px dashed var(--gray-200,#E5E7EB);background:transparent;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">Clear</button>';
  }
  html+='</div>';
  if(!filtered.length){
    html += renderEmptyState({
      emoji: allV.length ? '🔍' : '🛏️',
      title: allV.length ? 'No vacancies match these filters' : 'No vacancies right now',
      subtitle: allV.length ? 'Try clearing area or type filters.' : 'When a room becomes vacant it will show here.',
      ctaLabel: allV.length ? 'Clear filters' : '',
      ctaOnClick: allV.length ? "state.filters.roomArea='all';state.filters.roomType='all';render()" : ''
    });
    return html;
  }
  // Split into available (not hidden) and unavailable (hidden) — unavailable rooms
  // appear below a divider on the same page instead of vanishing into a Settings-y
  // "hidden" list elsewhere.
  var filteredAvail  = filtered.filter(function(x){return !x.r._hidden;});
  var filteredHidden = filtered.filter(function(x){return  x.r._hidden;});
  if(!filteredAvail.length && filteredHidden.length){
    html+='<div style="text-align:center;padding:24px;color:var(--muted);background:var(--bg);border:1px dashed var(--border);border-radius:12px;margin-bottom:18px;font-size:13px">All matching rooms are currently marked <strong>Unavailable</strong>. Scroll down to bring one back.</div>';
  }
  if(filteredAvail.length){
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">';
  } else {
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;display:none"></div>';
  }
  function renderRoomCard(item){
    var p=item.p;var r=item.r;var pc=getPostcode(p.address);
    var _pid = (p.id && String(p.id).length > 0) ? String(p.id) : (p.name || 'prop' + filtered.indexOf(item));
    var _rn  = (r.n != null && r.n !== '' && !isNaN(r.n)) ? parseInt(r.n) : 0;
    var _eidSafe = _pid.replace(/[^a-zA-Z0-9]/g,'X');
    if(!_eidSafe || _eidSafe.length === 0) _eidSafe = 'p' + filtered.indexOf(item);
    var _eidKey = _eidSafe + '__' + _rn;
    window._roomEidMap = window._roomEidMap || {};
    window._roomEidMap[_eidKey] = {pid:_pid, rn:_rn};
    var _eid = _eidKey;
    var media=getMedia(_pid,_rn);
    var monthly=Math.round(r.price*52/12);
    var typeIcon={Single:'\uD83D\uDECF\uFE0F',Double:'\uD83D\uDECF\uFE0F\uD83D\uDECF\uFE0F',Suite:'\u2728',Studio:'\uD83C\uDFE0','Whole House':'\uD83C\uDFE1','Whole Property':'\uD83C\uDFE1'}[r.type||'Single']||'\uD83D\uDECF\uFE0F';
    var h='';
    h+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column'+(r._hidden?';opacity:.97;box-shadow:inset 0 0 0 1px #FECDD3':'')+'">';

    // Photo strip — horizontal carousel with prev/next arrows + dot indicators
    h+='<div style="position:relative;height:180px;background:#F1F5F9;flex-shrink:0">';
    if(media.photos&&media.photos.length>0){
      h+='<div id="rm-'+_eid+'-strip" style="display:flex;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none">';
      media.photos.forEach(function(ph,pi){
        h+='<div style="flex-shrink:0;width:100%;height:100%;scroll-snap-align:start;position:relative">';
        h+='<img src="'+ph.src+'" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">';
        h+='<button id="rm-'+_eid+'-delpic-'+pi+'" onclick="removeRoomPhotoByEid(this)" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center">&#x2715;</button>';
        h+='</div>';
      });
      h+='</div>';
      if(media.photos.length > 1){
        // Prev / Next arrows — scroll the strip one card width.
        h+='<button aria-label="Previous photo" onclick="(function(btn){var s=document.getElementById(\'rm-'+_eid+'-strip\');if(!s)return;s.scrollBy({left:-s.clientWidth,behavior:\'smooth\'});})(this)" style="position:absolute;top:50%;left:8px;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center">&#x2039;</button>';
        h+='<button aria-label="Next photo" onclick="(function(btn){var s=document.getElementById(\'rm-'+_eid+'-strip\');if(!s)return;s.scrollBy({left:s.clientWidth,behavior:\'smooth\'});})(this)" style="position:absolute;top:50%;right:8px;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center">&#x203A;</button>';
        // Dot indicators
        h+='<div style="position:absolute;bottom:28px;left:0;right:0;display:flex;justify-content:center;gap:5px;pointer-events:none">';
        media.photos.forEach(function(_ph,pi){
          h+='<span style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.6);box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>';
        });
        h+='</div>';
      }
      h+='<div style="position:absolute;bottom:6px;right:8px;font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);padding:2px 7px;border-radius:8px">'+media.photos.length+'/4</div>';
    } else {
      h+='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:6px;color:var(--dim)"><div style="font-size:34px">&#x1F4F7;</div><div style="font-size:12px;font-weight:600">No photos yet</div></div>';
    }
    if(media.photos.length<4){
      h+='<label style="position:absolute;bottom:8px;left:8px;padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.93);border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:4px">';
      h+='&#x1F4F7; Add Photo<input type="file" accept="image/*" multiple style="display:none" id="rm-'+_eid+'-photo" onchange="handleRoomPhotoChange(this)">';
      h+='</label>';
    }
    h+='</div>';

    // Body
    h+='<div style="padding:13px;flex:1;display:flex;flex-direction:column;gap:9px">';

    // Title + price
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    h+='<div><div style="font-size:15px;font-weight:800">'+typeIcon+' '+esc(r.type||'Room')+' &middot; Room '+esc(r.n)+'</div><div style="font-size:11px;color:var(--muted)">'+esc(p.name)+'</div>'
      +(r._hidden?'<div style="margin-top:4px;font-size:10px;font-weight:700;color:#BE123C">Hidden from public page</div>':'')
      +'</div>';
    h+='<div style="text-align:right;flex-shrink:0"><div style="font-size:18px;font-weight:800;color:var(--accent-dark);font-family:monospace">&pound;'+r.price+'<span style="font-size:10px;font-weight:400;color:var(--muted)">/wk</span></div><div style="font-size:10px;color:var(--muted)">&pound;'+monthly+'/mo equiv.</div></div>';
    h+='</div>';

    // Address
    h+='<div style="background:var(--bg);border-radius:9px;padding:9px 11px;font-size:12px">';
    h+='<div style="font-weight:600;margin-bottom:3px">&#x1F4CD; '+esc(p.address)+'</div>';
    h+='<div style="display:flex;gap:10px;flex-wrap:wrap;color:var(--muted)">';
    h+='<span>&#x1F4EE; <strong>'+esc(pc)+'</strong></span><span>'+esc(p.area)+'</span>';
    if(p.mapsUrl) h+='<a href="'+p.mapsUrl+'" target="_blank" style="color:var(--blue);font-weight:600;text-decoration:none">&#x1F5FA; Maps &rarr;</a>';
    h+='</div></div>';

    // Notes
    h+='<div><label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Description</label>';
    h+='<textarea id="rm-'+_eid+'-notes" rows="2" class="inp" style="margin-top:4px;resize:vertical;font-size:12px" placeholder="Bright south-facing room, newly decorated, double bed..." onblur="saveRoomNotesByEid(this)">'+(media.notes||'')+'</textarea></div>';

    // Video
    if(media.video){
      h+='<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border-radius:8px;padding:8px 11px">';
      h+='<span>&#x1F3A5;</span><span style="font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+media.video.name+'</span>';
      h+='<button id="rm-'+_eid+'-delvid" onclick="removeRoomVideoByEid(this)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;cursor:pointer;font-family:inherit;color:var(--muted)">Remove</button>';
      h+='</div>';
    } else {
      h+='<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:1px dashed var(--border);cursor:pointer;font-size:12px;color:var(--muted)">';
      h+='<span>&#x1F3A5;</span><span>Add video tour <span style="font-size:10px">(max 50MB)</span></span>';
      h+='<input type="file" accept="video/*" style="display:none" id="rm-'+_eid+'-video" onchange="handleRoomVideoChange(this)">';
      h+='</label>';
    }

    // Share + availability
    h+='<div style="display:flex;gap:8px;margin-top:auto">';
    h+='<button id="rm-'+_eid+'-avail" onclick="toggleRoomAvailByEid(this)" style="flex:0 0 auto;padding:10px 12px;border-radius:10px;border:1px solid '+(r._hidden?'#FECDD3':'var(--border)')+';background:'+(r._hidden?'#FFF1F2':'var(--bg)')+';color:'+(r._hidden?'#E11D48':'var(--muted)')+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">'+(r._hidden?'👁 Make Available':'🚫 Mark Unavailable')+'</button>';
    h+='<button id="rm-'+_eid+'-share" onclick="shareRoomWAByEid(this)" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;border-radius:10px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F4AC; Share on WhatsApp</button>';
    h+='</div>';

    h+='</div></div>';
    return h;
  }

  filteredAvail.forEach(function(item){ html += renderRoomCard(item); });
  html+='</div>';

  // ── Unavailable section ───────────────────────────────────────────────────
  if(filteredHidden.length){
    html+='<div style="margin:36px 0 18px;padding-top:24px;border-top:2px dashed var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'
      +'<div>'
        +'<div style="font-size:14px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:8px">🚫 Unavailable Rooms <span style="font-size:11px;font-weight:700;color:#E11D48;background:#FFF1F2;border:1px solid #FECDD3;padding:2px 9px;border-radius:999px">'+filteredHidden.length+'</span></div>'
        +'<div style="font-size:12px;color:var(--muted);margin-top:3px">Hidden from the public rooms page. Click <strong>Make Available</strong> to bring one back to the top.</div>'
      +'</div>'
      +'</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">';
    filteredHidden.forEach(function(item){ html += renderRoomCard(item); });
    html+='</div>';
  }

  return html;
}
