var SUPA_URL=window.ENV.SUPA_URL;
var SUPA_KEY=window.ENV.SUPA_KEY;

// ── Parse URL params ──────────────────────────────────────────
var params=new URLSearchParams(location.search);
var pid    = params.get('p')     || params.get('pid')   || '';
var rn     = parseInt(params.get('r') || params.get('rn') || '0', 10);
var pname  = decodeURIComponent(params.get('pname') || '');
var paddr  = decodeURIComponent(params.get('addr')  || '');
var rtype  = decodeURIComponent(params.get('type')  || '');
var price  = params.get('price') || '';
var notes  = decodeURIComponent(params.get('notes') || '');
var mapsUrl= decodeURIComponent(params.get('maps')  || '');
var waNum  = params.get('wa') || '';

var photos=[], lbIdx=0;

// ── Debug helper ──────────────────────────────────────────────
function dbg(msg){
  var el=document.getElementById('debug');
  el.style.display='block';
  el.innerHTML+='<div>'+msg+'</div>';
}

// ── Address helpers ───────────────────────────────────────────
function getPostcode(addr){
  var m=(addr||'').match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}/i);
  return m?m[0].toUpperCase():'';
}
function stripHouseNo(addr){
  return (addr||'').replace(/^\d+[A-Za-z]?[\s,]+/,'').trim();
}

// ── Render header ─────────────────────────────────────────────
function renderHdr(){
  document.getElementById('pname').textContent = pname || 'Available Room';
  var safeAddr = stripHouseNo(paddr);
  if(safeAddr){
    var pc = getPostcode(paddr);
    document.getElementById('paddr').textContent = '\u{1F4CD} '+safeAddr+(pc && !safeAddr.includes(pc) ? ', '+pc : '');
  }
  document.getElementById('rinfo').innerHTML =
    '<div class="badge">\u{1F6CF}\uFE0F '+(rtype||'Room')+(rn?' &middot; Room '+rn:'')+' </div>'+
    (price ? '<br><div class="pbadge">&pound;'+price+'/wk</div>' : '');
  if(mapsUrl) document.getElementById('mlink').innerHTML =
    '<a class="mapslink" href="'+mapsUrl+'" target="_blank">\u{1F5FA}\uFE0F Google Maps</a>';
  if(notes) document.getElementById('narea').innerHTML =
    '<div class="nbox">\u{1F4DD} '+notes+'</div>';

  // CTA
  var ctaMsg = 'Hi, I am interested in '+(rtype||'the room')+(rn?' (Room '+rn+')':'')+(pname?' at '+pname:'')+(price?' \u00a3'+price+'/wk':'')+'. I would like to arrange a viewing.';
  var ctaHref = waNum
    ? 'https://wa.me/'+waNum+'?text='+encodeURIComponent(ctaMsg)
    : 'https://wa.me/?text='+encodeURIComponent(ctaMsg);
  document.getElementById('cta').innerHTML =
    '<div class="cta">'+
    '<div style="font-size:15px;font-weight:800;margin-bottom:5px">Interested in this room?</div>'+
    '<div style="font-size:12px;color:rgba(255,255,255,.8);margin-bottom:14px">Message us on WhatsApp to arrange a FREE viewing'+(price?' &middot; &pound;'+price+'/wk':'')+
    '</div><a class="cta-btn" href="'+ctaHref+'" target="_blank">\u{1F4AC} Message Us</a></div>';
}

// ── Load property from Supabase if not in URL ─────────────────
async function loadProp(){
  if(pname){ renderHdr(); return; }
  if(!pid){ renderHdr(); return; }
  try{
    var r = await fetch(SUPA_URL+'/rest/v1/properties?id=eq.'+encodeURIComponent(pid)+'&select=name,address,maps_url', {
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
    });
    var d = await r.json();
    if(d && d[0]){
      pname  = d[0].name    || '';
      paddr  = d[0].address || '';
      mapsUrl= mapsUrl || d[0].maps_url || '';
    }
  }catch(e){ dbg('loadProp error: '+e.message); }
  renderHdr();
}

// ── Load gallery from Supabase Storage ────────────────────────
async function loadGallery(){
  if(!pid){
    document.getElementById('area').innerHTML =
      '<div class="empty"><div style="font-size:48px;margin-bottom:12px">&#x1F517;</div>'+
      '<div style="font-size:14px;font-weight:600">Invalid link &mdash; missing property ID</div></div>';
    return;
  }

  // Build the prefix — Supabase Storage paths are case-sensitive
  // Try the exact prefix that the main app uses when uploading
  var prefix = 'rooms/'+pid+'/'+rn;
  dbg('Fetching storage prefix: '+prefix);

  try{
    var listRes = await fetch(SUPA_URL+'/storage/v1/object/list/room-media', {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer '+SUPA_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prefix: prefix,
        limit: 50,
        offset: 0,
        sortBy: {column:'created_at', order:'asc'}
      })
    });

    if(!listRes.ok){
      var errText = await listRes.text();
      throw new Error('Storage list HTTP '+listRes.status+': '+errText.slice(0,120));
    }

    var files = await listRes.json();
    dbg('Storage returned: '+JSON.stringify(files).slice(0,200));

    if(!Array.isArray(files)){
      throw new Error('Storage response not an array: '+JSON.stringify(files).slice(0,120));
    }

    // Filter: real files only (not folders, not hidden, not .emptyFolderPlaceholder)
    var imgExts = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;
    var vidExts = /\.(mp4|mov|webm|m4v)$/i;

    var imgs = files.filter(function(f){
      return f.name && !f.name.startsWith('.') && imgExts.test(f.name);
    });
    var vids = files.filter(function(f){
      return f.name && vidExts.test(f.name);
    });

    // Also include files that don't have video_ prefix but might be images
    // (some uploads name them by timestamp or UUID)
    if(!imgs.length){
      imgs = files.filter(function(f){
        return f.name && !f.name.startsWith('.') && f.id && !vidExts.test(f.name);
      });
    }

    dbg('Images found: '+imgs.length+' | Videos: '+vids.length);

    photos = imgs.map(function(f){
      return SUPA_URL+'/storage/v1/object/public/room-media/'+prefix+'/'+f.name;
    });

    if(!photos.length){
      document.getElementById('area').innerHTML =
        '<div class="empty">'+
        '<div style="font-size:48px;margin-bottom:12px">&#x1F4F7;</div>'+
        '<div style="font-size:14px;font-weight:600;margin-bottom:6px">No photos yet</div>'+
        '<div style="font-size:12px;opacity:.5">Photos will appear here once uploaded from the main app</div>'+
        '</div>';
    } else {
      var h = '<div class="grid">';
      photos.forEach(function(url,i){
        h += '<div class="card" onclick="openLb('+i+')" data-idx="'+i+'">'+
             '<img src="'+url+'" alt="Photo '+(i+1)+'" loading="lazy" onerror="this.parentNode.style.background=\'#2A1E3F\'">'+
             '<div class="num">'+(i+1)+'/'+photos.length+'</div></div>';
      });
      h += '</div>';
      document.getElementById('area').innerHTML = h;
    }

    // Video
    if(vids.length){
      var vurl = SUPA_URL+'/storage/v1/object/public/room-media/'+prefix+'/'+vids[0].name;
      document.getElementById('varea').innerHTML =
        '<div class="vsect">'+
        '<div class="vtitle">&#x1F3A5; Video Tour</div>'+
        '<div class="vwrap"><video controls playsinline preload="metadata" src="'+vurl+'"></video></div>'+
        '</div>';
    }

  }catch(err){
    dbg('loadGallery error: '+err.message);
    document.getElementById('area').innerHTML =
      '<div class="empty">'+
      '<div style="font-size:48px;margin-bottom:12px">&#x26A0;&#xFE0F;</div>'+
      '<div style="font-size:14px;font-weight:600">Could not load photos</div>'+
      '<div style="font-size:11px;margin-top:8px;opacity:.5">'+err.message+'</div>'+
      '<div style="font-size:11px;margin-top:4px;opacity:.4">Property ID: '+pid+' &middot; Room: '+rn+'</div>'+
      '</div>';
  }
}

// ── Lightbox ──────────────────────────────────────────────────
function buildThumbs(){
  var el = document.getElementById('lb-thumbs');
  el.innerHTML = photos.map(function(url,i){
    return '<div class="lb-thumb'+(i===lbIdx?' active':'')+'" onclick="lbNav2('+i+')">'+
           '<img src="'+url+'" alt="" loading="lazy"></div>';
  }).join('');
}

function openLb(i){
  lbIdx = i;
  document.getElementById('lbimg').src = photos[i];
  document.getElementById('lbc').textContent = (i+1)+' / '+photos.length;
  buildThumbs();
  document.getElementById('lb').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLb(){
  document.getElementById('lb').classList.remove('open');
  document.body.style.overflow = '';
}

function lbNav(d){
  lbIdx = (lbIdx+d+photos.length) % photos.length;
  document.getElementById('lbimg').src = photos[lbIdx];
  document.getElementById('lbc').textContent = (lbIdx+1)+' / '+photos.length;
  // update thumb highlight
  document.querySelectorAll('.lb-thumb').forEach(function(el,i){ el.classList.toggle('active', i===lbIdx); });
  // scroll thumb into view
  var thumbs = document.querySelectorAll('.lb-thumb');
  if(thumbs[lbIdx]) thumbs[lbIdx].scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
}

function lbNav2(i){ lbNav(i - lbIdx); }

// Click outside image closes lightbox
document.getElementById('lb').addEventListener('click', function(e){
  if(e.target === this) closeLb();
});

// Keyboard navigation
document.addEventListener('keydown', function(e){
  if(!document.getElementById('lb').classList.contains('open')) return;
  if(e.key==='ArrowLeft')  lbNav(-1);
  if(e.key==='ArrowRight') lbNav(1);
  if(e.key==='Escape')     closeLb();
});

// ── Touch swipe support ───────────────────────────────────────
var _tx=null;
document.getElementById('lb').addEventListener('touchstart', function(e){ _tx=e.touches[0].clientX; }, {passive:true});
document.getElementById('lb').addEventListener('touchend', function(e){
  if(_tx===null) return;
  var dx = e.changedTouches[0].clientX - _tx;
  _tx = null;
  if(Math.abs(dx) < 40) return;
  lbNav(dx < 0 ? 1 : -1);
}, {passive:true});

// ── Init ──────────────────────────────────────────────────────
loadProp();
loadGallery();
