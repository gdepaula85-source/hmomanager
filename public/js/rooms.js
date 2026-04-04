var SUPA_URL=window.ENV.SUPA_URL,SUPA_KEY=window.ENV.SUPA_KEY;

var allRooms=[], filtered=[], typeFilter='all', areaFilter='', companyWA='', currentRoom=null;

function buildGalleryUrl(pid, rn, pname, addr, type, price, maps, wa){
  var base = window.location.origin+'/gallery.html';
  var q = new URLSearchParams();
  q.set('p',    pid);
  q.set('r',    rn);
  if(pname) q.set('pname', pname);
  if(addr)  q.set('addr',  addr);
  if(type)  q.set('type',  type);
  if(price) q.set('price', price);
  if(maps)  q.set('maps',  maps);
  if(wa)    q.set('wa',    wa);
  return base+'?'+q.toString();
}

// Tomorrow min date
document.getElementById('f-date').min = new Date(Date.now()+86400000).toISOString().split('T')[0];

// Load company WA from localStorage (written by main app on same device)
try {
  var _co = JSON.parse(localStorage.getItem('pm_local_companies')||'[]');
  if(_co.length) { companyWA=(_co[0].whatsapp||_co[0].phone||'').replace(/\D/g,''); }
  if(companyWA) {
    document.getElementById('footer-wa').href='https://wa.me/'+companyWA+'?text='+encodeURIComponent('Hi, I am looking for a property in South London. Can you help?');
  }
} catch(e){}

function stripHouseNo(addr){ return (addr||'').replace(/^\d+[A-Za-z]?[\s,]+/,'').trim(); }

function fmtDate(d){ try{ return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch(e){ return d||''; } }

async function loadData(){
  var rooms=[];
  try {
    // Try Supabase first
    var pRes = await fetch(SUPA_URL+'/rest/v1/properties?select=*',{
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Cache-Control':'no-cache'}
    });
    if(!pRes.ok) throw new Error('HTTP '+pRes.status);
    var props = await pRes.json();
    if(!Array.isArray(props)||!props.length) throw new Error('No properties');

    var tRes = await fetch(SUPA_URL+'/rest/v1/tenants?status=eq.notice_given&select=name,property_name,room_number,move_out_date',{
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
    });
    var noticeTenants = tRes.ok ? await tRes.json() : [];

    props.forEach(function(p){
      // room_list can be an array or JSON string
      var rl = p.room_list;
      if(typeof rl==='string'){ try{ rl=JSON.parse(rl); }catch(e){ rl=[]; } }
      if(!Array.isArray(rl)||!rl.length) return;
      rl.forEach(function(r){
        if(r._hidden) return;
        var available=false, availFrom=null;
        if(r.status==='vacant') { available=true; }
        else if(r.status==='occupied') {
          var nt=Array.isArray(noticeTenants)&&noticeTenants.find(function(t){
            return (t.property_name===p.name)&&(String(t.room_number)===String(r.n))&&t.move_out_date;
          });
          if(nt){ available=true; availFrom=nt.move_out_date; }
        }
        if(!available) return;
        rooms.push({
          pid:p.id, propName:p.name||'', address:p.address||'', area:p.area||p.postcode||'',
          roomN:r.n, type:r.type||'Single', price:r.price||0,
          availFrom:availFrom, mapsUrl:p.maps_url||p.mapsUrl||'',
          monthly:Math.round((r.price||0)*52/12),
          galleryUrl:buildGalleryUrl(p.id, r.n, p.name||'', p.address||'', r.type||'Single', r.price||0, p.maps_url||p.mapsUrl||'', companyWA)
        });
      });
    });
  } catch(err) {
    // Fallback: try localStorage state (works if main app opened on same device)
    try {
      var raw=localStorage.getItem('pm_state');
      if(!raw) throw new Error('no state');
      var st=JSON.parse(raw);
      var lsProps=st.properties||[];
      var lsTenants=st.tenants||[];
      lsProps.forEach(function(p){
        (p.roomList||[]).forEach(function(r){
          if(r._hidden) return;
          var available=false, availFrom=null;
          if(r.status==='vacant'){ available=true; }
          else {
            var nt=lsTenants.find(function(t){return t.property===p.name&&t.room===r.n&&t.status==='notice_given'&&t.moveOutDate;});
            if(nt){ available=true; availFrom=nt.moveOutDate; }
          }
          if(!available) return;
          rooms.push({
            pid:p.id,propName:p.name||'',address:p.address||'',area:p.area||'',
            roomN:r.n,type:r.type||'Single',price:r.price||0,
            availFrom:availFrom,mapsUrl:p.mapsUrl||'',
            monthly:Math.round((r.price||0)*52/12),
            galleryUrl:buildGalleryUrl(p.id, r.n, p.name||'', p.address||'', r.type||'Single', r.price||0, p.mapsUrl||'', companyWA)
          });
        });
      });
    } catch(e2){
      document.getElementById('grid').innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)"><div style="font-size:36px;margin-bottom:12px">&#x26A0;&#xFE0F;</div><div style="font-size:14px;font-weight:600">Could not load listings</div><div style="font-size:12px;margin-top:6px">'+err.message+'</div></div>';
      return;
    }
  }

  allRooms=rooms.sort(function(a,b){return a.price-b.price;});

  // Area dropdown
  var areas=[...new Set(allRooms.map(function(r){return r.area;}))].filter(Boolean).sort();
  var sel=document.getElementById('area-select');
  areas.forEach(function(a){var o=document.createElement('option');o.value=a;o.textContent=a;sel.appendChild(o);});

  // Stats
  var vacant=allRooms.filter(function(r){return !r.availFrom;}).length;
  var soon=allRooms.filter(function(r){return r.availFrom;}).length;
  var minP=allRooms.length?Math.min.apply(null,allRooms.map(function(r){return r.price;})):0;
  document.getElementById('hero-badge').textContent=allRooms.length+' listing'+(allRooms.length===1?'':'s')+' available';
  document.getElementById('stats-bar').innerHTML=
    '<div class="stat"><div class="stat-num">'+allRooms.length+'</div><div class="stat-lbl">Available</div></div>'+
    (vacant?'<div class="stat"><div class="stat-num" style="color:var(--green)">'+vacant+'</div><div class="stat-lbl">Move-in Now</div></div>':'')+
    (soon?'<div class="stat"><div class="stat-num" style="color:#F59E0B">'+soon+'</div><div class="stat-lbl">Coming Soon</div></div>':'')+
    (minP?'<div class="stat"><div class="stat-num">&pound;'+minP+'</div><div class="stat-lbl">From /wk</div></div>':'');

  applyFilters();
}

function applyFilters(){
  filtered=allRooms.filter(function(r){
    if(typeFilter!=='all'&&r.type!==typeFilter) return false;
    if(areaFilter&&r.area!==areaFilter) return false;
    return true;
  });
  renderGrid();
}
function setType(t,btn){
  typeFilter=t;
  document.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  applyFilters();
}
function setArea(a){ areaFilter=a; applyFilters(); }

function renderGrid(){
  var g=document.getElementById('grid');
  if(!filtered.length){
    g.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)"><div style="font-size:40px;margin-bottom:12px">&#x1F4A4;</div><div style="font-size:14px;font-weight:600">No listings match your filters</div></div>';
    return;
  }
  var TYPE_ICONS={'Single':'&#x1F6CF;&#xFE0F;','Double':'&#x1F6CF;&#xFE0F;&#x1F6CF;&#xFE0F;','Suite':'&#x2728;','Studio':'&#x1F3E0;','Whole House':'&#x1F3E1;'};
  g.innerHTML=filtered.map(function(r){
    var icon=TYPE_ICONS[r.type]||'&#x1F6CF;&#xFE0F;';
    var safeAddr=stripHouseNo(r.address);
    var waMsg=companyWA?'https://wa.me/'+companyWA+'?text='+encodeURIComponent('Hi, I\'m interested in the '+r.type+(r.type==='Whole House'?'':' (Unit '+r.roomN+')')+' in '+safeAddr+(r.area?', '+r.area:'')+'. Can I arrange a viewing?'):'';
    return '<div class="card" data-pid="'+r.pid+'" data-room="'+r.roomN+'">'+
      '<div class="card-photo">'+
        (r.availFrom?'<div class="avail-banner">&#x1F4C5; Available from '+fmtDate(r.availFrom)+'</div>':'')+
        '<div class="card-photo-empty"><span style="font-size:36px">&#x1F3E0;</span></div>'+
      '</div>'+
      '<div class="card-body">'+
        '<div class="card-title">'+icon+' '+r.type+(r.type==='Whole House'?'':' &middot; Unit '+r.roomN)+'</div>'+
        '<div class="card-addr">&#x1F4CD; '+safeAddr+(r.area?' &middot; '+r.area:'')+' </div>'+
        '<div class="card-meta"><span class="chip chip-type">'+r.type+'</span>'+(r.area?'<span class="chip chip-area">'+r.area+'</span>':'')+'</div>'+
        '<div><span class="card-price-num">&pound;'+r.price+'</span> <span style="font-size:12px;color:var(--muted)">/week (&pound;'+r.monthly+'/mo)</span></div>'+
        (r.mapsUrl?'<a href="'+r.mapsUrl+'" target="_blank" style="font-size:12px;color:var(--accent);font-weight:600;text-decoration:none">&#x1F5FA;&#xFE0F; Google Maps</a>':'')+
        '<div class="card-actions">'+
          '<button class="btn-book" onclick="openBooking('+escJson(r)+')">&#x1F4C5; Book Viewing</button>'+
          '<a class="btn-gallery" href="'+r.galleryUrl+'" target="_blank" title="View photos">&#x1F4F8;</a>'+
          (waMsg?'<a class="btn-wa" href="'+waMsg+'" target="_blank" title="WhatsApp enquiry">&#x1F4AC;</a>':'')+
          '<button class="btn-share" onclick="shareRoom('+escJson(r)+',this)" title="Share this room">&#x1F517;</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  // Load real photos async
  loadPhotos();
}

function escJson(o){ return JSON.stringify(o).replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }

async function loadPhotos(){
  for(var i=0;i<filtered.length;i++){
    var r=filtered[i];
    try {
      var res=await fetch(SUPA_URL+'/storage/v1/object/list/room-media',{
        method:'POST',
        headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({prefix:'rooms/'+r.pid+'/'+r.roomN,limit:1,sortBy:{column:'created_at',order:'asc'}})
      });
      var files=await res.json();
      if(Array.isArray(files)&&files.length){
        var imgFile=files.find(function(f){ return f.name && !f.name.startsWith('.') && !/\.(mp4|mov|webm)$/i.test(f.name); });
        if(imgFile){
          var url=SUPA_URL+'/storage/v1/object/public/room-media/rooms/'+r.pid+'/'+r.roomN+'/'+imgFile.name;
          // Use data attributes to find the right card — safe if filters change
          var card=document.querySelector('.card[data-pid="'+r.pid+'"][data-room="'+r.roomN+'"]');
          if(card){
            var photoDiv=card.querySelector('.card-photo');
            var existingImg=photoDiv&&photoDiv.querySelector('img');
            if(photoDiv&&!existingImg){
              var img=document.createElement('img');
              img.src=url; img.alt='Room photo';
              img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
              photoDiv.appendChild(img);
              // Update photo count badge
              var countBadge=photoDiv.querySelector('.card-photo-count');
              if(!countBadge){
                countBadge=document.createElement('div');
                countBadge.className='card-photo-count';
                photoDiv.appendChild(countBadge);
              }
            }
          }
        }
      }
    } catch(e){}
  }
}

function openBooking(r){
  currentRoom=r;
  document.getElementById('modal-lbl').textContent=r.type+(r.type==='Whole House'?'':' \u00b7 Unit '+r.roomN)+' \u00b7 \u00a3'+r.price+'/wk';
  document.getElementById('form-wrap').style.display='block';
  document.getElementById('success-box').style.display='none';
  document.getElementById('form-err').style.display='none';
  document.getElementById('submit-btn').disabled=false;
  document.getElementById('submit-btn').textContent='\uD83D\uDCC5 Request Viewing';
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeModal(){ document.getElementById('modal').classList.remove('open'); document.body.style.overflow=''; currentRoom=null; }

async function submitBooking(){
  var name=document.getElementById('f-name').value.trim();
  var phone=document.getElementById('f-phone').value.trim();
  var date=document.getElementById('f-date').value;
  var errEl=document.getElementById('form-err');
  var btn=document.getElementById('submit-btn');
  if(!name||!phone||!date){ errEl.textContent='Please enter your name, phone, and preferred date.'; errEl.style.display='block'; return; }
  errEl.style.display='none'; btn.disabled=true; btn.textContent='Sending\u2026';
  var r=currentRoom||{};
  var safeAddr=stripHouseNo(r.address||'');
  var dateStr=date?new Date(date).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'';
  var time=document.getElementById('f-time').value;
  var notes=document.getElementById('f-notes').value.trim();
  var email=document.getElementById('f-email').value.trim();
  var msg='\uD83C\uDFE0 *NEW VIEWING REQUEST*\n'
    +'\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n'
    +'\uD83C\uDFE0 *Listing:* '+r.type+(r.type==='Whole House'?'':' \u00b7 Unit '+r.roomN)+'\n'
    +'\uD83D\uDCCD *Property:* '+safeAddr+(r.area?', '+r.area:'')+'\n'
    +'\uD83D\uDCB7 *Price:* \u00a3'+r.price+'/wk\n\n'
    +'\uD83D\uDC64 *Name:* '+name+'\n'
    +'\uD83D\uDCDE *Phone:* '+phone+'\n'
    +(email?'\uD83D\uDCE7 *Email:* '+email+'\n':'')
    +'\uD83D\uDCC5 *Viewing date:* '+dateStr+'\n'
    +(time?'\u23F0 *Time:* '+time+'\n':'')
    +(notes?'\n\uD83D\uDCDD *Notes:* '+notes+'\n':'')
    +'\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n'
    +'_Sent via Reservations Direct Listings Page_';
  var waNum=companyWA||'';
  window.open((waNum?'https://wa.me/'+waNum:' https://wa.me/')+'?text='+encodeURIComponent(msg),'_blank');
  document.getElementById('form-wrap').style.display='none';
  document.getElementById('success-box').style.display='block';
  document.getElementById('success-msg').textContent='Viewing request for the '+r.type+(r.type==='Whole House'?'':' (Unit '+r.roomN+')')+' sent! We\'ll contact you at '+phone+' to confirm.';
}

function showShareToast(msg){
  var el=document.getElementById('share-toast');
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t=setTimeout(function(){ el.classList.remove('show'); }, 2400);
}

function shareRoom(r, btn){
  var safeAddr = stripHouseNo(r.address);
  var title = r.type+(r.type==='Whole House'?'':' (Unit '+r.roomN+')')+' \u00b7 \u00a3'+r.price+'/wk \u00b7 '+safeAddr+(r.area?', '+r.area:'');
  var text  = '\uD83C\uDFE0 '+r.type+' available in '+safeAddr+(r.area?', '+r.area:'')+'\n'
            + '\uD83D\uDCB0 \u00a3'+r.price+'/wk (\u00a3'+r.monthly+'/mo)\n'
            + '\uD83D\uDCC5 '+(r.availFrom?'Available from '+fmtDate(r.availFrom):'Available now')+'\n'
            + '\uD83D\uDCC8 View photos & book a viewing: '+r.galleryUrl;

  // Native share (mobile) — opens share sheet with WhatsApp, iMessage, etc.
  if(navigator.share){
    navigator.share({ title: title, text: text, url: r.galleryUrl })
      .catch(function(){}); // user cancelled — no error needed
    return;
  }

  // Desktop fallback — copy gallery link to clipboard
  var toCopy = r.galleryUrl;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(toCopy).then(function(){
      btn.textContent='\u2713 Copied!';
      btn.classList.add('copied');
      showShareToast('\uD83D\uDD17 Link copied to clipboard');
      setTimeout(function(){ btn.textContent='\uD83D\uDD17'; btn.classList.remove('copied'); }, 2000);
    }).catch(function(){
      fallbackCopy(toCopy, btn);
    });
  } else {
    fallbackCopy(toCopy, btn);
  }
}

function fallbackCopy(text, btn){
  var ta=document.createElement('textarea');
  ta.value=text; ta.style.cssText='position:fixed;top:-999px;left:-999px';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); showShareToast('\uD83D\uDD17 Link copied!'); }catch(e){ showShareToast('\u26A0\uFE0F Could not copy \u2014 try long-pressing the link'); }
  document.body.removeChild(ta);
  if(btn){ btn.textContent='\u2713'; btn.classList.add('copied'); setTimeout(function(){ btn.textContent='\uD83D\uDD17'; btn.classList.remove('copied'); },2000); }
}

loadData();
