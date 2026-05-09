// ── ROOM MEDIA HELPERS ─────────────────────────────────────────────────────────
function saveRoomNotes(pid, rn) {
  var el = document.getElementById('room-notes-'+pid+'-'+rn);
  if(el) getMedia(pid, rn).notes = el.value;
}
async function removeRoomPhoto(pid, rn, idx) {
  var media = getMedia(pid, rn);
  var photo = media.photos[idx];
  if(photo && photo.path) {
    try { await supa.storage.from('room-media').remove([photo.path]); }
    catch(e) { console.warn('Could not delete from storage:', e); }
  }
  media.photos.splice(idx, 1);
  saveState();
  render();
}
function removeRoomVideo(pid, rn) {
  getMedia(pid, rn).video = null;
  saveState();
  render();
}
async function handleVideoUpload(pid, rn, input) {
  var file = input.files[0]; if(!file) return;
  if(file.size > 50*1024*1024) { showToast('Video too large (max 50MB)', 'error'); return; }
  showToast('Uploading video...', 'success');
  try {
    var ext = file.name.split('.').pop();
    var path = 'rooms/'+pid+'/'+rn+'/video_'+Date.now()+'.'+ext;
    var upload = await supa.storage.from('room-media').upload(path, file, {upsert:true});
    if(upload.error) throw upload.error;
    var urlData = supa.storage.from('room-media').getPublicUrl(path);
    var url = urlData.data.publicUrl;
    getMedia(pid,rn).video = {src:url, name:file.name, path:path};
    saveState(); render();
    showToast('Video uploaded ✓', 'success');
  } catch(err) {
    console.error('Video upload failed:', err);
    showToast('Upload failed: '+(err.message||err), 'error');
  }
}
