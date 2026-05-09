// ── Property Media tab — up to 20 photos + 2 videos per property ─────────────
// Files upload to the existing `property-docs` Supabase Storage bucket under
// properties/{pid}/gallery/photos/ and properties/{pid}/gallery/videos/.
// URLs + metadata persist in properties.gallery (JSONB column). Hard caps are
// client-enforced: _PROP_MEDIA_MAX_PHOTOS / _PROP_MEDIA_MAX_VIDEOS.

var _PROP_MEDIA_MAX_PHOTOS = 20;
var _PROP_MEDIA_MAX_VIDEOS = 2;
var _PROP_MEDIA_MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB per video

function _propGallery(p) {
  if (!p.gallery || typeof p.gallery !== 'object') p.gallery = { photos: [], videos: [] };
  if (!Array.isArray(p.gallery.photos)) p.gallery.photos = [];
  if (!Array.isArray(p.gallery.videos)) p.gallery.videos = [];
  return p.gallery;
}

function renderPropMediaTab(p) {
  var g = _propGallery(p);
  var photoCount = g.photos.length;
  var videoCount = g.videos.length;
  var pLeft = _PROP_MEDIA_MAX_PHOTOS - photoCount;
  var vLeft = _PROP_MEDIA_MAX_VIDEOS - videoCount;

  var html = '';

  // ── Photos section ────────────────────────────────────────────────────────
  html += '<div style="margin-bottom:18px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">';
  html += '<div>';
  html += '<div style="font-size:13px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:8px">🖼️ Photos <span style="font-size:11px;font-weight:700;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:999px">'+photoCount+' / '+_PROP_MEDIA_MAX_PHOTOS+'</span></div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:3px">Property gallery for listings, inspections, and landlord statements.</div>';
  html += '</div>';
  if (pLeft > 0) {
    html += '<button onclick="document.getElementById(\'pm-photos-input-'+p.id+'\').click()" style="padding:8px 14px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Upload photos ('+pLeft+' left)</button>';
    html += '<input type="file" id="pm-photos-input-'+p.id+'" accept="image/*" multiple style="display:none" onchange="uploadPropertyMedia(\''+p.id+'\',\'photos\',this)">';
  } else {
    html += '<span style="font-size:11px;color:var(--amber);font-weight:700">Limit reached · delete one to upload more</span>';
  }
  html += '</div>';
  if (!photoCount) {
    html += '<div style="background:var(--bg);border:1.5px dashed var(--border);border-radius:10px;padding:26px;text-align:center;color:var(--muted)">';
    html += '<div style="font-size:32px;margin-bottom:8px">📷</div>';
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:4px">No photos yet</div>';
    html += '<div style="font-size:11px">Upload up to '+_PROP_MEDIA_MAX_PHOTOS+' images — hallway, kitchen, bathroom, each room.</div>';
    html += '</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">';
    g.photos.forEach(function(ph, idx) {
      html += '<div style="position:relative;aspect-ratio:1;border-radius:9px;overflow:hidden;border:1px solid var(--border);background:#F1F5F9">';
      if (ph.url) {
        html += '<a href="'+ph.url+'" target="_blank" rel="noopener" style="display:block;width:100%;height:100%"><img src="'+ph.url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy"></a>';
      } else {
        html += '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;color:var(--dim)">📷</div>';
      }
      html += '<button onclick="deletePropertyMedia(\''+p.id+'\',\'photos\','+idx+')" title="Remove" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.65);color:#fff;font-size:12px;cursor:pointer;font-family:inherit">×</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // ── Videos section ────────────────────────────────────────────────────────
  html += '<div style="margin-top:22px;padding-top:18px;border-top:1px solid var(--border)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">';
  html += '<div>';
  html += '<div style="font-size:13px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:8px">🎬 Videos <span style="font-size:11px;font-weight:700;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:999px">'+videoCount+' / '+_PROP_MEDIA_MAX_VIDEOS+'</span></div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:3px">Short walkthroughs — typically under 60 seconds. Max 100 MB each.</div>';
  html += '</div>';
  if (vLeft > 0) {
    html += '<button onclick="document.getElementById(\'pm-videos-input-'+p.id+'\').click()" style="padding:8px 14px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Upload video ('+vLeft+' left)</button>';
    html += '<input type="file" id="pm-videos-input-'+p.id+'" accept="video/*" style="display:none" onchange="uploadPropertyMedia(\''+p.id+'\',\'videos\',this)">';
  } else {
    html += '<span style="font-size:11px;color:var(--amber);font-weight:700">Limit reached · delete one to upload more</span>';
  }
  html += '</div>';
  if (!videoCount) {
    html += '<div style="background:var(--bg);border:1.5px dashed var(--border);border-radius:10px;padding:22px;text-align:center;color:var(--muted);font-size:12px">No videos yet.</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">';
    g.videos.forEach(function(v, idx) {
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;position:relative">';
      if (v.url) {
        html += '<video src="'+v.url+'" controls preload="metadata" style="width:100%;aspect-ratio:16/9;background:#000;display:block"></video>';
      } else {
        html += '<div style="aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:24px">🎬</div>';
      }
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px">';
      html += '<span style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">'+(v.name||'video')+'</span>';
      html += '<button onclick="deletePropertyMedia(\''+p.id+'\',\'videos\','+idx+')" style="padding:4px 10px;border-radius:7px;border:1px solid #FECDD3;background:#FFF1F2;color:#E11D48;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Remove</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // ── Footnote ──
  html += '<div style="margin-top:16px;font-size:10px;color:var(--dim);line-height:1.55">';
  html += 'Photos and videos upload directly to your Supabase <code>property-docs</code> bucket. ';
  html += 'Public URLs are stored on the property record — remove a file here and it is also removed from storage.';
  html += '</div>';

  return html;
}

async function uploadPropertyMedia(propId, kind, inputEl) {
  var p = state.properties.find(function(x) { return String(x.id) === String(propId); });
  if (!p) return;
  // _currentOrgId is a top-level var populated by auth bootstrap — not on window.
  var orgId = (typeof _currentOrgId !== 'undefined') ? _currentOrgId : (window._currentOrgId || null);
  if (!(typeof supa !== 'undefined' && supa && orgId)) {
    showToast && showToast('Not connected to Supabase — cannot upload', 'error');
    return;
  }
  var g = _propGallery(p);
  var files = Array.prototype.slice.call(inputEl.files || []);
  if (!files.length) return;

  var max = kind === 'photos' ? _PROP_MEDIA_MAX_PHOTOS : _PROP_MEDIA_MAX_VIDEOS;
  var already = g[kind].length;
  if (already >= max) {
    showToast && showToast('Limit of ' + max + ' ' + kind + ' reached', 'warn');
    inputEl.value = '';
    return;
  }
  if (already + files.length > max) {
    showToast && showToast('Only ' + (max - already) + ' ' + kind + ' slot(s) left — extras skipped', 'warn');
    files = files.slice(0, max - already);
  }

  var successes = 0;
  var errors = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (kind === 'videos' && f.size > _PROP_MEDIA_MAX_VIDEO_BYTES) {
      errors.push(f.name + ': over 100 MB');
      continue;
    }
    var ext = (f.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || (kind === 'photos' ? 'jpg' : 'mp4');
    var base = (f.name.replace(/\.[^.]+$/, '') || 'file').replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 40);
    var uid = Math.random().toString(36).slice(2, 8);
    var path = 'properties/' + p.id + '/gallery/' + kind + '/' + uid + '-' + base + '.' + ext;
    try {
      showToast && showToast('Uploading ' + (i+1) + '/' + files.length + '…', 'success');
      var up = await supa.storage.from('property-docs').upload(path, f, { upsert: false, contentType: f.type || (kind === 'photos' ? 'image/jpeg' : 'video/mp4') });
      if (up && up.error) { errors.push(f.name + ': ' + (up.error.message || 'upload failed')); continue; }
      var pub = supa.storage.from('property-docs').getPublicUrl(path);
      g[kind].push({
        name: f.name,
        url: (pub.data && pub.data.publicUrl) || null,
        storagePath: path,
        uploadedAt: new Date().toISOString(),
        sizeBytes: f.size
      });
      successes++;
    } catch (e) {
      console.warn('Property media upload threw:', e);
      errors.push(f.name + ': ' + (e.message || 'upload failed'));
    }
  }
  inputEl.value = '';
  if (successes) {
    if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
    else saveState();
  }
  if (errors.length) {
    showToast && showToast(successes + ' uploaded, ' + errors.length + ' failed — check Console', 'warn');
    console.warn('Property media errors:', errors);
  } else if (successes) {
    showToast && showToast(successes + ' ' + kind.slice(0,-1) + (successes===1?'':'s') + ' uploaded', 'success');
  }
  // Re-render the modal on the same tab so the new tiles appear.
  state.propDetailTab = 'media';
  if (typeof openPropDetail === 'function') openPropDetail(p.id);
}

async function deletePropertyMedia(propId, kind, index) {
  var p = state.properties.find(function(x) { return String(x.id) === String(propId); });
  if (!p) return;
  var g = _propGallery(p);
  var item = g[kind][index];
  if (!item) return;
  if (!confirm('Remove this ' + kind.slice(0,-1) + '?')) return;
  // Best-effort storage delete — if it fails (already gone, permission), we still remove the record.
  try {
    if (item.storagePath && window.supa) {
      await supa.storage.from('property-docs').remove([item.storagePath]);
    }
  } catch (e) { console.warn('Media storage remove failed:', e); }
  g[kind].splice(index, 1);
  if (typeof saveStateImmediate === 'function') saveStateImmediate({ silentSuccess: true });
  else saveState();
  showToast && showToast('Removed', 'success');
  state.propDetailTab = 'media';
  if (typeof openPropDetail === 'function') openPropDetail(p.id);
}

if (typeof window !== 'undefined') {
  window.renderPropMediaTab   = renderPropMediaTab;
  window.uploadPropertyMedia  = uploadPropertyMedia;
  window.deletePropertyMedia  = deletePropertyMedia;
}
