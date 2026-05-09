var SUPA_URL=window.ENV&&window.ENV.SUPA_URL,SUPA_KEY=window.ENV&&window.ENV.SUPA_KEY;

var allRooms=[], filtered=[], typeFilter='all', areaFilter='', companyWA='', currentRoom=null;
var orgFilter=(new URLSearchParams(window.location.search).get('org')||'').trim();
var listingBrand=null;
var _listingsSession=null;

function applyListingFooter(){
  var el=document.getElementById('footer-brand-line');
  if(!el) return;
  el.textContent='';
  if(!listingBrand||!orgFilter){
    el.appendChild(document.createTextNode('Property listings'));
    return;
  }
  // Prefix with logo if available, else house emoji
  if(listingBrand.logoUrl){
    var img=document.createElement('img');
    img.src=listingBrand.logoUrl;
    img.alt=listingBrand.orgName||'Logo';
    img.style.cssText='width:18px;height:18px;border-radius:4px;object-fit:cover;vertical-align:middle;margin-right:6px';
    el.appendChild(img);
    el.appendChild(document.createTextNode(listingBrand.orgName||'Properties'));
  } else {
    el.appendChild(document.createTextNode('\uD83C\uDFE0 '+(listingBrand.orgName||'Properties')));
  }
  if(listingBrand.tagline){
    el.appendChild(document.createTextNode(' \u00B7 '));
    el.appendChild(document.createTextNode(listingBrand.tagline));
  }
  if(listingBrand.showWhatsappButton&&listingBrand.whatsappDigits){
    el.appendChild(document.createTextNode(' \u00B7 '));
    var a=document.createElement('a');
    a.href='https://wa.me/'+listingBrand.whatsappDigits+'?text='+encodeURIComponent('Hi, I am interested in a property listing. Can you help?');
    a.target='_blank';
    a.rel='noopener noreferrer';
    a.style.cssText='color:var(--wa);font-weight:600;text-decoration:none';
    a.textContent='\uD83D\uDCAC WhatsApp Us';
    el.appendChild(a);
  }
}

function normalizeListingWaDigits(v){
  return String(v==null?'':v).replace(/\D/g,'');
}

function isListingOrgUuid(s){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s||'').trim());
}

function mapRpcBrandRow(row){
  if(!row) return null;
  var digits=normalizeListingWaDigits(row.whatsapp);
  var skipped=!!row.whatsapp_skipped;
  var showWa=digits.length>0&&!skipped;
  return {
    orgName:row.org_name||'Properties',
    tagline:row.tagline||null,
    logoUrl:row.logo_url||null,
    whatsappDigits:showWa?digits:'',
    showWhatsappButton:showWa
  };
}

function listingsDebug(msg, detail){
  try{
    if(!/debug=listings/i.test(window.location.search)) return;
    console.warn('[listings]',msg,detail!=null?detail:'');
  }catch(e){}
}

/** Load footer brand via Supabase RPC (anon) — same host/key as property listings; works without Node /api. */
async function loadListingBrandFromSupabaseRpc(){
  if(!SUPA_URL||!SUPA_KEY||!orgFilter||!isListingOrgUuid(orgFilter)) return null;
  var createFn=getSupabaseCreateClient();
  if(createFn){
    try{
      var client=createFn(SUPA_URL,SUPA_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      var out=await client.rpc('get_organisation_public_brand',{p_org_id:orgFilter.trim()});
      if(out.error){
        listingsDebug('rpc client error',out.error.message||out.error);
      }else{
        var d=out.data;
        var row=Array.isArray(d)?(d.length?d[0]:null):d;
        var mapped=mapRpcBrandRow(row);
        if(mapped) return mapped;
      }
    }catch(e){ listingsDebug('rpc client exception',e.message); }
  }
  try{
    var r=await fetch(SUPA_URL.replace(/\/+$/,'')+'/rest/v1/rpc/get_organisation_public_brand',{
      method:'POST',
      headers:{
        apikey:SUPA_KEY,
        Authorization:'Bearer '+SUPA_KEY,
        'Content-Type':'application/json',
        Accept:'application/json'
      },
      body:JSON.stringify({p_org_id:orgFilter.trim()})
    });
    var data=await r.json().catch(function(){return null;});
    if(!r.ok){
      listingsDebug('rpc http '+r.status,data&&data.message?data.message:data);
      return null;
    }
    var row2=Array.isArray(data)&&data.length?data[0]:null;
    return mapRpcBrandRow(row2);
  }catch(e2){
    listingsDebug('rpc fetch exception',e2.message);
    return null;
  }
}

async function loadListingBrand(){
  companyWA='';
  listingBrand=null;
  if(!orgFilter){
    applyListingFooter();
    document.title='Available rooms';
    return;
  }
  if(!isListingOrgUuid(orgFilter)){
    listingBrand={
      orgName:'Room listings',
      tagline:'Use the link from Rooms \u2192 Public Page (needs ?org=your-org-id in the address bar).',
      whatsappDigits:'',
      showWhatsappButton:false
    };
    companyWA='';
    document.title='Available rooms';
    applyListingFooter();
    return;
  }

  var brand=await loadListingBrandFromSupabaseRpc();
  if(!brand){
    try{
      var r=await fetch((window.location.origin||'')+'/api/public/listings-brand?org='+encodeURIComponent(orgFilter.trim()));
      var j=await r.json().catch(function(){return{};});
      if(r.ok) brand=j;
      else listingsDebug('api /listings-brand',j.error||r.status);
    }catch(e){ listingsDebug('api fetch',e.message); }
  }

  if(brand){
    listingBrand=brand;
    companyWA=brand.whatsappDigits||'';
    document.title=(brand.orgName||'Properties')+' \u2013 Available rooms';
    // Apply org logo as favicon if provided
    if(brand.logoUrl){
      var link=document.querySelector("link[rel~='icon']");
      if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}
      link.href=brand.logoUrl;
      // Replace hero title with logo + orgName
      var hero=document.querySelector('.hero-title');
      if(hero){
        hero.innerHTML='<img src="'+brand.logoUrl+'" alt="'+(brand.orgName||'Logo')+'" style="height:44px;vertical-align:middle;margin-right:12px;border-radius:9px;object-fit:cover"> '+(brand.orgName||'Properties');
      }
    } else if(brand.orgName){
      var hero2=document.querySelector('.hero-title');
      if(hero2) hero2.textContent=brand.orgName;
    }
  }else{
    listingBrand={
      orgName:'Room listings',
      tagline:'Branding did not load. Open this page from Rooms \u2192 Public Page, or run db/organisations_public_listings.sql in Supabase and NOTIFY pgrst reload schema. Add ?debug=listings for console details.',
      whatsappDigits:'',
      showWhatsappButton:false
    };
    document.title='Available rooms';
  }
  applyListingFooter();
}

function openWaSetupModal(){
  var ov=document.getElementById('wa-setup-overlay');
  var err=document.getElementById('wa-setup-err');
  if(err){ err.style.display='none'; err.textContent=''; }
  if(ov){ ov.classList.add('open'); document.body.style.overflow='hidden'; }
}

function closeWaSetupModal(){
  var ov=document.getElementById('wa-setup-overlay');
  if(ov){ ov.classList.remove('open'); document.body.style.overflow=''; }
}

async function waSetupSave(){
  var errEl=document.getElementById('wa-setup-err');
  var inp=document.getElementById('wa-setup-input');
  var digits=(inp&&inp.value||'').replace(/\D/g,'');
  if(!digits){
    if(errEl){ errEl.textContent='Enter a WhatsApp number (with country code, e.g. 44\u2026).'; errEl.style.display='block'; }
    return;
  }
  if(!_listingsSession||!orgFilter) return;
  try{
    var r=await fetch('/api/public/listings-brand',{
      method:'PATCH',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_listingsSession.access_token},
      body:JSON.stringify({orgId:orgFilter,whatsapp:digits})
    });
    var j=await r.json().catch(function(){return{};});
    if(!r.ok) throw new Error(j.error||'Save failed');
    closeWaSetupModal();
    await loadListingBrand();
    applyFilters();
  }catch(e){
    if(errEl){ errEl.textContent=e.message||'Could not save'; errEl.style.display='block'; }
  }
}

async function waSetupSkip(){
  if(!_listingsSession||!orgFilter){ closeWaSetupModal(); return; }
  try{
    await fetch('/api/public/listings-brand',{
      method:'PATCH',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_listingsSession.access_token},
      body:JSON.stringify({orgId:orgFilter,whatsappSkipped:true})
    });
  }catch(e){}
  closeWaSetupModal();
  await loadListingBrand();
  applyFilters();
}

function getSupabaseCreateClient(){
  try{
    if(typeof supabase!=='undefined'&&supabase&&typeof supabase.createClient==='function') return supabase.createClient.bind(supabase);
    if(window.supabase&&typeof window.supabase.createClient==='function') return window.supabase.createClient.bind(window.supabase);
  }catch(e){}
  return null;
}

async function resolveListingsAuthSession(){
  var createFn=getSupabaseCreateClient();
  if(createFn&&SUPA_URL&&SUPA_KEY){
    var client=createFn(SUPA_URL,SUPA_KEY,{auth:{persistSession:true,storage:localStorage,autoRefreshToken:true,detectSessionInUrl:true}});
    var session=(await client.auth.getSession()).data.session;
    if(!session){
      var ref=await client.auth.refreshSession();
      if(ref&&ref.data) session=ref.data.session;
    }
    if(session&&orgFilter){
      try{ sessionStorage.removeItem('pm_listings_bearer_'+orgFilter); }catch(e){}
      return session;
    }
  }
  if(orgFilter){
    try{
      var k='pm_listings_bearer_'+orgFilter;
      var tok=sessionStorage.getItem(k);
      if(tok){
        sessionStorage.removeItem(k);
        return {access_token:tok};
      }
    }catch(e){}
  }
  return null;
}

async function maybeWhatsAppSetupModal(){
  if(!orgFilter||!SUPA_URL||!SUPA_KEY) return;
  try{
    var session=await resolveListingsAuthSession();
    if(!session||!session.access_token) return;
    _listingsSession=session;
    var r=await fetch('/api/public/listings-brand/admin?org='+encodeURIComponent(orgFilter),{
      headers:{Authorization:'Bearer '+session.access_token}
    });
    var j=await r.json().catch(function(){return{};});
    if(!j.member||!j.needsPrompt) return;
    openWaSetupModal();
  }catch(e){}
}

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

function stripHouseNo(addr){ return (addr||'').replace(/^\d+[A-Za-z]?[\s,]+/,'').trim(); }

function fmtDate(d){ try{ return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch(e){ return d||''; } }

async function loadData(){
  var rooms=[];
  try {
    // Try Supabase first
    if(!orgFilter) throw new Error('Missing organisation scope');
    var pRes = await fetch(SUPA_URL+'/rest/v1/properties?select=*&org_id=eq.'+encodeURIComponent(orgFilter)+'&status=neq.archived',{
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Cache-Control':'no-cache'}
    });
    if(!pRes.ok) throw new Error('HTTP '+pRes.status);
    var props = await pRes.json();
    if(!Array.isArray(props)||!props.length) throw new Error('No properties');

    var tRes = await fetch(SUPA_URL+'/rest/v1/tenants?status=eq.notice_given&org_id=eq.'+encodeURIComponent(orgFilter)+'&select=name,property_name,room_number,move_out_date',{
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
      // H12 FIX: Escape error message + use correct variable name (was err, should be e2)
      var safeErrMsg = String(e2 && e2.message || 'Unknown error').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var loadErrLbl = (typeof window.t === 'function') ? window.t('load.error') : 'Could not load listings';
      document.getElementById('grid').innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)"><div style="font-size:36px;margin-bottom:12px">&#x26A0;&#xFE0F;</div><div style="font-size:14px;font-weight:600">'+loadErrLbl+'</div><div style="font-size:12px;margin-top:6px">'+safeErrMsg+'</div></div>';
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
  // Listing count badge — translated via the i18n shim's pluralisation helper
  // so it reads "5 anúncios disponíveis" / "5 anuncios disponibles" / "5 listings available"
  // depending on the current locale (with proper singular/plural).
  var _heroBadge = document.getElementById('hero-badge');
  if (_heroBadge) _heroBadge.textContent = (typeof window.tn === 'function')
    ? window.tn('listings.count', allRooms.length)
    : (allRooms.length + ' listing' + (allRooms.length===1?'':'s') + ' available');
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
    var emptyLbl = (typeof window.t === 'function') ? window.t('grid.empty') : 'No listings match your filters';
    g.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)"><div style="font-size:40px;margin-bottom:12px">&#x1F4A4;</div><div style="font-size:14px;font-weight:600">'+emptyLbl+'</div></div>';
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
          '<button class="btn-wa-share" onclick="shareRoomWhatsApp('+escJson(r)+')" title="Share via WhatsApp">&#x1F4AC;</button>'+
          '<button class="btn-share" onclick="shareRoom('+escJson(r)+',this)" title="Copy / Share link">&#x1F517;</button>'+
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
        body:JSON.stringify({prefix:'rooms/'+r.pid+'/'+r.roomN,limit:24,sortBy:{column:'created_at',order:'asc'}})
      });
      var files=await res.json();
      if(!Array.isArray(files)||!files.length) continue;
      var validFiles=files.filter(function(f){ return f.name && !f.name.startsWith('.'); });
      if(!validFiles.length) continue;
      var card=document.querySelector('.card[data-pid="'+r.pid+'"][data-room="'+r.roomN+'"]');
      if(!card) continue;
      var photoDiv=card.querySelector('.card-photo');
      if(!photoDiv||photoDiv.dataset.loaded) continue;
      photoDiv.dataset.loaded='1';
      buildCardCarousel(photoDiv, validFiles, r);
    } catch(e){}
  }
}

function buildCardCarousel(photoDiv, files, r){
  var media=files.map(function(f){
    var url=SUPA_URL+'/storage/v1/object/public/room-media/rooms/'+r.pid+'/'+r.roomN+'/'+f.name;
    var isVideo=/\.(mp4|mov|webm)$/i.test(f.name);
    return { url: url, isVideo: isVideo };
  });
  // Hide placeholder
  var placeholder=photoDiv.querySelector('.card-photo-empty');
  if(placeholder) placeholder.style.display='none';

  // Build media elements
  media.forEach(function(m, idx){
    var el;
    if(m.isVideo){
      el=document.createElement('video');
      el.src=m.url; el.muted=true; el.loop=true; el.playsInline=true; el.preload='metadata';
    } else {
      el=document.createElement('img');
      el.src=m.url; el.alt='Room photo '+(idx+1); el.loading='lazy';
    }
    el.className='card-carousel-media'+(idx===0?' active':'');
    photoDiv.appendChild(el);
  });

  if(media.length===1) {
    // Single item — no arrows/dots, just show the count badge with total
    var countBadge=document.createElement('div');
    countBadge.className='card-photo-count';
    countBadge.innerHTML=media[0].isVideo?'&#x1F3A5; 1 video':'&#x1F4F7; 1 photo';
    photoDiv.appendChild(countBadge);
    return;
  }

  // Multi-item — add arrows, dots, counter
  var state={ idx:0, total:media.length };

  var prev=document.createElement('button');
  prev.className='card-carousel-arrow prev';
  prev.setAttribute('aria-label','Previous photo');
  prev.innerHTML='&#x2039;';
  prev.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();go(state.idx-1);});

  var next=document.createElement('button');
  next.className='card-carousel-arrow next';
  next.setAttribute('aria-label','Next photo');
  next.innerHTML='&#x203A;';
  next.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();go(state.idx+1);});

  var dots=document.createElement('div');
  dots.className='card-carousel-dots';
  for(var d=0;d<media.length;d++){
    var s=document.createElement('span');
    if(d===0) s.className='active';
    (function(i){ s.addEventListener('click',function(e){e.stopPropagation();go(i);}); })(d);
    dots.appendChild(s);
  }

  var countBadge2=document.createElement('div');
  countBadge2.className='card-photo-count';
  var videoCount=media.filter(function(m){return m.isVideo;}).length;
  var photoCount=media.length-videoCount;
  countBadge2.innerHTML='<span id="_ccnt"></span>';

  photoDiv.appendChild(prev);
  photoDiv.appendChild(next);
  photoDiv.appendChild(dots);
  photoDiv.appendChild(countBadge2);

  function updateCount(){
    countBadge2.textContent=(state.idx+1)+' / '+state.total + (videoCount?' · '+photoCount+' \uD83D\uDCF7 '+videoCount+' \uD83C\uDFA5':'');
  }
  function go(i){
    state.idx=(i+state.total)%state.total;
    var all=photoDiv.querySelectorAll('.card-carousel-media');
    all.forEach(function(el,j){
      el.classList.toggle('active', j===state.idx);
      if(el.tagName==='VIDEO'){ if(j===state.idx){ try{el.play()}catch(e){} } else { el.pause(); } }
    });
    var allDots=dots.querySelectorAll('span');
    allDots.forEach(function(s,j){ s.classList.toggle('active', j===state.idx); });
    updateCount();
  }
  updateCount();

  // Swipe support (mobile)
  var tStartX=0;
  photoDiv.addEventListener('touchstart',function(e){tStartX=e.touches[0].clientX;},{passive:true});
  photoDiv.addEventListener('touchend',function(e){
    var dx=e.changedTouches[0].clientX-tStartX;
    if(Math.abs(dx)>40) go(state.idx + (dx<0?1:-1));
  },{passive:true});
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
    +'_Sent via '+(listingBrand&&listingBrand.orgName?listingBrand.orgName:'listings page')+'_';
  var waNum=companyWA||'';
  if(!waNum){
    errEl.textContent='WhatsApp is not configured for this page. Please use another way to contact the agent.';
    errEl.style.display='block';
    btn.disabled=false;
    btn.textContent='\uD83D\uDCC5 Request Viewing';
    return;
  }
  window.open('https://wa.me/'+waNum+'?text='+encodeURIComponent(msg),'_blank');
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

// ── Page-level share (whole /rooms page) ─────────────────────
function sharePage(btn){
  var url = window.location.href;
  var title = (listingBrand && listingBrand.orgName || 'Available rooms') + ' — Property listings';
  var text  = '\uD83C\uDFE0 ' + (listingBrand && listingBrand.orgName || 'Available properties') + '\n'
            + (allRooms && allRooms.length ? allRooms.length + ' room' + (allRooms.length===1?'':'s') + ' available — book a viewing online:\n' : '')
            + url;
  if(navigator.share){
    navigator.share({ title: title, text: text, url: url }).catch(function(){});
    return;
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(function(){
      if(btn){btn.textContent='\u2713 Link copied!';setTimeout(function(){btn.innerHTML='\uD83D\uDD17 Share page';},2000);}
      showShareToast('\uD83D\uDD17 Page link copied');
    }).catch(function(){ window.prompt('Copy this link:', url); });
  } else {
    window.prompt('Copy this link:', url);
  }
}

function sharePageWhatsApp(e){
  if(e) e.preventDefault();
  var url = window.location.href;
  var text = '\uD83C\uDFE0 ' + (listingBrand && listingBrand.orgName || 'Available properties') + '\n'
           + (allRooms && allRooms.length ? allRooms.length + ' room' + (allRooms.length===1?'':'s') + ' currently available — no agency fees.\n\n' : '\n')
           + url;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// Per-card WhatsApp share: opens WhatsApp share sheet with a prefilled room description + gallery link
function shareRoomWhatsApp(r){
  var safeAddr = stripHouseNo(r.address);
  var text = '\uD83C\uDFE0 ' + r.type + (r.type==='Whole House'?'':' (Unit '+r.roomN+')') + ' — ' + safeAddr + (r.area?', '+r.area:'') + '\n'
           + '\uD83D\uDCB0 \u00a3' + r.price + '/wk (\u00a3' + r.monthly + '/mo)\n'
           + '\uD83D\uDCC5 ' + (r.availFrom?'Available from '+fmtDate(r.availFrom):'Available now') + '\n\n'
           + '\uD83D\uDCF8 Photos & book a viewing: ' + r.galleryUrl;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
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

async function boot(){
  await loadListingBrand();
  await loadData();
  await maybeWhatsAppSetupModal();
}
boot();

// Register a re-render hook with the i18n shim so toggling the language pill
// updates dynamic strings (listing-count badge, grid empty state, etc.) —
// not just the static data-i18n elements.
if (typeof window.onRoomsLangChange === 'function') {
  window.onRoomsLangChange(function(){
    var badge = document.getElementById('hero-badge');
    if (badge && typeof allRooms !== 'undefined' && allRooms && typeof window.tn === 'function'){
      badge.textContent = window.tn('listings.count', allRooms.length);
    }
    if (typeof renderGrid === 'function' && typeof filtered !== 'undefined') renderGrid();
  });
}
