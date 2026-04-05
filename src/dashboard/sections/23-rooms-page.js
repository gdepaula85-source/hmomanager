// ── ROOMS PAGE ─────────────────────────────────────────────────────────────────
function getPostcode(a){var m=a&&a.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/i);return m?m[0].toUpperCase():'';}
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
  var typeIcon={'Single':'🛏️','Double':'🛏️🛏️','Suite':'✨','Studio':'🏠','Whole House':'🏡'}[r.type||'Single']||'🛏️';
  var monthly=Math.round(r.price*52/12);
  var galleryUrl = buildGalleryUrl(pid, rn);
  var NL='\n';
  var msg='🏠 *Room Available — '+p.area+'*'+NL+NL;
  msg+='📍 '+stripHouseNo(p.address)+', '+pc+NL;
  // availFrom from item (if called from shareRoomWAByEid, rebuild)
  var _noticeTenantWA = state.tenants.find(function(t){return t.property===p.name&&t.room===r.n&&t.status==='notice_given'&&t.moveOutDate;});
  var _availFromWA = _noticeTenantWA ? new Date(_noticeTenantWA.moveOutDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : null;
  msg+=typeIcon+' *'+(r.type||'Room')+' · Room '+r.n+'*'+NL;
  if(_availFromWA) msg+='📅 *Available from: '+_availFromWA+'*'+NL;
  msg+='💷 *£'+r.price+'/week* (£'+monthly+'/mo equiv.)'+NL;
  if(p.mapsUrl) msg+='🗺️ Google Maps: '+p.mapsUrl+NL;
  if(media.notes) msg+=NL+'📝 '+media.notes+NL;
  if(galleryUrl && media.photos && media.photos.length>0) {
    msg+=NL+'📸 *View '+(media.photos.length)+' photo'+(media.photos.length===1?'':'s')+'*'+NL;
    msg+=galleryUrl+NL;
  }
  if(media.video) msg+='🎥 Video tour available — ask us to send it'+NL;
  msg+='📞 Contact us now to arrange a *FREE viewing*!';
  var url = 'https://wa.me/?text='+encodeURIComponent(msg);
  var w = window.open(url,'_blank');
  if(!w) window.location.href = url;
}

function shareAllRoomsWA(){
  var v=[];
  state.properties.forEach(function(p){(p.roomList||[]).forEach(function(r){if(r.status==='vacant')v.push({p:p,r:r});});});
  if(!v.length){alert('No vacant rooms to share.');return;}
  var NL='\n';
  var msg='🏠 *Available Rooms — Reservations Direct*'+NL;
  msg+='━━━━━━━━━━━━━━━━━━'+NL+NL;
  v.forEach(function(item,i){
    var p=item.p;var r=item.r;
    var pc=getPostcode(p.address);
    var monthly=Math.round(r.price*52/12);
    var typeIcon={Single:'🛏️',Double:'🛏️🛏️',Suite:'✨',Studio:'🏠'}[r.type||'Single']||'🛏️';
    var media=getMedia(p.id,r.n);
    msg+=(i+1)+'. '+typeIcon+' *'+(r.type||'Room')+' · '+p.area+'*'+NL;
    msg+='   📍 '+stripHouseNo(p.address)+', '+pc+NL;
    msg+='   💷 *£'+r.price+'/wk* (£'+monthly+'/mo)'+NL;
    if(p.mapsUrl) msg+='   🗺️ '+p.mapsUrl+NL;
    if(media.photos&&media.photos.length>0){
      var gurl=buildGalleryUrl(p.id,r.n);
      msg+='   📸 '+media.photos.length+' photo'+(media.photos.length===1?'':'s')+' available'+NL;
      if(gurl) msg+='   🔗 '+gurl+NL;
    }
    msg+=NL;
  });
  msg+='━━━━━━━━━━━━━━━━━━'+NL;
  msg+='📞 *Reply or call to book a FREE viewing!*';
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
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
  window._roomEidMap = {};  // reset on every render
  // Build available rooms: vacant + notice_given with moveOutDate (available from date)
  var allV=[], hiddenV=[];
  state.properties.forEach(function(p){
    (p.roomList||[]).forEach(function(r){
      if(r._hidden) {
        hiddenV.push({p:p,r:r}); // collect separately — shown at bottom
        return;
      }
      if(r.status==='vacant') {
        allV.push({p:p,r:r,availFrom:null});
      } else if(r.status==='occupied') {
        // Check if occupying tenant has given notice
        var noticeTenant = state.tenants.find(function(t){
          return t.property===p.name && t.room===r.n && t.status==='notice_given' && t.moveOutDate;
        });
        if(noticeTenant) {
          allV.push({p:p,r:r,availFrom:noticeTenant.moveOutDate,_noticeTenant:noticeTenant});
        }
      }
    });
  });
  var f={area:state.filters.roomArea||'all',type:state.filters.roomType||'all',sort:state.filters.roomSort||'price_asc'};
  var areas=[];allV.forEach(function(x){if(areas.indexOf(x.p.area)<0)areas.push(x.p.area);});
  var filtered=allV.filter(function(x){return(f.area==='all'||x.p.area===f.area)&&(f.type==='all'||(x.r.type||'Single')===f.type);});
  filtered.sort(function(a,b){return f.sort==='price_desc'?b.r.price-a.r.price:f.sort==='area'?a.p.area.localeCompare(b.p.area):a.r.price-b.r.price;});
  var html='<div class="page-header"><div><div class="page-title">Available Rooms</div><div class="page-sub">'+filtered.length+' of '+allV.length+' rooms</div></div>'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    +'<a href="/rooms.html" target="_blank" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px">&#x1F310; Public Page</a>'
    +'<button onclick="shareAllRoomsWA()" style="padding:9px 14px;border-radius:9px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Share All</button>'
    +'</div></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:10px;margin-bottom:16px">';
  var trueVacant = allV.filter(function(x){return !x.availFrom;}).length;
  var comingSoon = allV.filter(function(x){return !!x.availFrom;}).length;
  html+='<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:11px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--red)">'+trueVacant+'</div><div style="font-size:10px;color:var(--red);font-weight:700">VACANT</div></div>';
  html+=(comingSoon?'<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:11px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:#B45309">'+comingSoon+'</div><div style="font-size:10px;color:#B45309;font-weight:700">COMING SOON</div></div>':'');
  html+='<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:11px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--green)">'+fmt(Math.round(allV.filter(function(x){return !x.availFrom;}).reduce(function(s,x){return s+x.r.price;},0)*52/12))+'</div><div style="font-size:10px;color:var(--green);font-weight:700">POTENTIAL/MO</div></div>';
  html+='<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:11px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--blue)">'+state.properties.filter(function(p){return(p.roomList||[]).some(function(r){return r.status==='vacant'&&!r._hidden;});}).length+'</div><div style="font-size:10px;color:var(--blue);font-weight:700">PROPERTIES</div></div>';
  html+='</div>';
  html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">';
  html+='<select class="inp" style="max-width:140px" onchange="state.filters.roomArea=this.value;render()"><option value="all">All Areas</option>'+areas.map(function(a){return '<option value="'+a+'" '+(f.area===a?'selected':'')+'>'+a+'</option>';}).join('')+'</select>';
  html+='<select class="inp" style="max-width:130px" onchange="state.filters.roomType=this.value;render()">'+['all','Single','Double','Suite','Studio'].map(function(t){return '<option value="'+t+'" '+(f.type===t?'selected':'')+'>'+(t==='all'?'All Types':t)+'</option>';}).join('')+'</select>';
  html+='<select class="inp" style="max-width:140px" onchange="state.filters.roomSort=this.value;render()"><option value="price_asc">Price up</option><option value="price_desc">Price down</option><option value="area">Area</option></select>';
  html+='</div>';
  if(!filtered.length){html+='<div style="text-align:center;padding:40px;color:var(--dim)">No rooms match filters</div>';return html;}
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">';
  filtered.forEach(function(item){
    var p=item.p;var r=item.r;var pc=getPostcode(p.address);var media=getMedia(p.id,r.n);
    var availFrom=item.availFrom||null;
    var availFromStr=availFrom?new Date(availFrom).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):null;
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
    var typeIcon={Single:'\uD83D\uDECF\uFE0F',Double:'\uD83D\uDECF\uFE0F\uD83D\uDECF\uFE0F',Suite:'\u2728',Studio:'\uD83C\uDFE0'}[r.type||'Single']||'\uD83D\uDECF\uFE0F';

    html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column">';

    // Photo strip
    html+='<div style="position:relative;height:180px;background:#F1F5F9;flex-shrink:0">';
    if(media.photos&&media.photos.length>0){
      html+='<div style="display:flex;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none">';
      media.photos.forEach(function(ph,pi){
        html+='<div style="flex-shrink:0;width:100%;height:100%;scroll-snap-align:start;position:relative">';
        html+='<img src="'+ph.src+'" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\"none\";this.nextSibling&&(this.nextSibling.style.display=\"flex\")" onload="console.log(\"Photo loaded OK\")">';
        html+='<button id="rm-'+_eid+'-delpic-'+pi+'" onclick="removeRoomPhotoByEid(this)" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center">&#x2715;</button>';
        html+='</div>';
      });
      html+='</div>';
      html+='<div style="position:absolute;bottom:6px;right:8px;font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);padding:2px 7px;border-radius:8px">'+media.photos.length+'/4</div>';
    } else {
      html+='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:6px;color:var(--dim)"><div style="font-size:34px">&#x1F4F7;</div><div style="font-size:12px;font-weight:600">No photos yet</div></div>';
    }
    if(media.photos.length<4){
      html+='<label style="position:absolute;bottom:8px;left:8px;padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.93);border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:4px">';
      html+='&#x1F4F7; Add Photo<input type="file" accept="image/*" multiple style="display:none" id="rm-'+_eid+'-photo" onchange="handleRoomPhotoChange(this)">';
      html+='</label>';
    }
    html+='</div>';

    // Body
    html+='<div style="padding:13px;flex:1;display:flex;flex-direction:column;gap:9px">';

    // Available-from banner (notice given rooms)
    if(availFromStr) {
      html+='<div style="display:flex;align-items:center;gap:7px;background:#FFFBEB;border-bottom:1px solid #FDE68A;padding:8px 13px;font-size:11px;font-weight:700;color:#B45309">'
        +'<span style="font-size:14px">\uD83D\uDCC5</span>'
        +'<span>Available from <strong>'+availFromStr+'</strong></span>'
        +'<span style="margin-left:auto;font-size:10px;background:#FDE68A;color:#92400E;padding:2px 7px;border-radius:6px">NOTICE GIVEN</span>'
        +'</div>';
    }

    // Title + price
    html+='<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    html+='<div><div style="font-size:15px;font-weight:800">'+typeIcon+' '+(r.type||'Room')+' &middot; Room '+r.n+'</div><div style="font-size:11px;color:var(--muted)">'+p.name+'</div></div>';
    html+='<div style="text-align:right;flex-shrink:0"><div style="font-size:18px;font-weight:800;color:var(--accent-dark);font-family:monospace">&pound;'+r.price+'<span style="font-size:10px;font-weight:400;color:var(--muted)">/wk</span></div><div style="font-size:10px;color:var(--muted)">&pound;'+monthly+'/mo equiv.</div></div>';
    html+='</div>';

    // Address
    html+='<div style="background:var(--bg);border-radius:9px;padding:9px 11px;font-size:12px">';
    html+='<div style="font-weight:600;margin-bottom:3px">&#x1F4CD; '+p.address+'</div>';
    html+='<div style="display:flex;gap:10px;flex-wrap:wrap;color:var(--muted)">';
    html+='<span>&#x1F4EE; <strong>'+pc+'</strong></span><span>'+p.area+'</span>';
    if(p.mapsUrl) html+='<a href="'+p.mapsUrl+'" target="_blank" style="color:var(--blue);font-weight:600;text-decoration:none">&#x1F5FA; Maps &rarr;</a>';
    html+='</div></div>';

    // Notes
    html+='<div><label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Description</label>';
    html+='<textarea id="rm-'+_eid+'-notes" rows="2" class="inp" style="margin-top:4px;resize:vertical;font-size:12px" placeholder="Bright south-facing room, newly decorated, double bed..." onblur="saveRoomNotesByEid(this)">'+(media.notes||'')+'</textarea></div>';

    // Video
    if(media.video){
      html+='<div style="display:flex;align-items:center;gap:8px;background:var(--bg);border-radius:8px;padding:8px 11px">';
      html+='<span>&#x1F3A5;</span><span style="font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+media.video.name+'</span>';
      html+='<button id="rm-'+_eid+'-delvid" onclick="removeRoomVideoByEid(this)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);font-size:11px;cursor:pointer;font-family:inherit;color:var(--muted)">Remove</button>';
      html+='</div>';
    } else {
      html+='<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;border:1px dashed var(--border);cursor:pointer;font-size:12px;color:var(--muted)">';
      html+='<span>&#x1F3A5;</span><span>Add video tour <span style="font-size:10px">(max 50MB)</span></span>';
      html+='<input type="file" accept="video/*" style="display:none" id="rm-'+_eid+'-video" onchange="handleRoomVideoChange(this)">';
      html+='</label>';
    }

    // Share button
    html+='<div style="display:flex;gap:8px;margin-top:auto">';
    html+='<button id="rm-'+_eid+'-avail" onclick="toggleRoomAvailByEid(this)" style="flex:0 0 auto;padding:10px 12px;border-radius:10px;border:1px solid '+(r._hidden?'#FECDD3':'var(--border)')+';background:'+(r._hidden?'#FFF1F2':'var(--bg)')+';color:'+(r._hidden?'#E11D48':'var(--muted)')+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">'+(r._hidden?'👁 Make Available':'🚫 Mark Unavailable')+'</button>';
    html+='<button id="rm-'+_eid+'-share" onclick="shareRoomWAByEid(this)" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px;border-radius:10px;border:none;background:#25D366;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F4AC; Share on WhatsApp</button>';
    html+='</div>';

    html+='</div></div>';
  });

  html+='</div>';
  return html;
}
