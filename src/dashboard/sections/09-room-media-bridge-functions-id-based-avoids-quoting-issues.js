// ── Room media bridge functions (id-based, avoids quoting issues) ──
function _parseRoomEid(el) {
  var id = el.id || '';
  if(!id || id === 'rm-') return null; // stale element, ignore silently
  var m = id.match(/^rm-(.+)__(\d+)-/);
  if(!m) return null; // silently ignore non-matching elements
  var eidKey = m[1] + '__' + m[2];
  if(window._roomEidMap && window._roomEidMap[eidKey]) return window._roomEidMap[eidKey];
  return {pid: m[1], rn: parseInt(m[2])};
}
function handleRoomPhotoChange(el) {
  var info = _parseRoomEid(el); if(!info) return;
  handlePhotoUpload(info.pid, info.rn, el);
}
function handleRoomVideoChange(el) {
  var info = _parseRoomEid(el); if(!info) return;
  handleVideoUpload(info.pid, info.rn, el);
}
function toggleRoomAvailByEid(el) {
  var info = _parseRoomEid(el); if(!info) return;
  var p = state.properties.find(function(x){return x.id===info.pid;});
  if(!p||!p.roomList) return;
  var r = p.roomList.find(function(x){return x.n===info.rn;});
  if(!r) return;
  r._hidden = !r._hidden;
  saveState(); render();
  showToast(r._hidden?'Room hidden from listings':'Room visible in listings', r._hidden?'error':'success');
}

function saveRoomNotesByEid(el) {
  var info = _parseRoomEid(el); if(!info) return;
  var noteEl = document.getElementById('rm-'+info.pid+'__'+info.rn+'-notes');
  if(noteEl) { getMedia(info.pid, info.rn).notes = noteEl.value; saveState(); showToast('Notes saved ✓','success'); }
}
function shareRoomWAByEid(el) {
  var info = _parseRoomEid(el); if(!info) return;
  shareRoomWA(info.pid, info.rn);
}
function removeRoomPhotoByEid(el) {
  var info = _parseRoomEid(el); if(!info) return;
  var piMatch = el.id.match(/-delpic-(\d+)$/);
  if(piMatch) removeRoomPhoto(info.pid, info.rn, parseInt(piMatch[1]));
}
function removeRoomVideoByEid(el) {
  var info = _parseRoomEid(el); if(!info) return;
  removeRoomVideo(info.pid, info.rn);
}
function removeRoomPhotoBtn(el){ removeRoomPhoto(el.dataset.pid, parseInt(el.dataset.rn), parseInt(el.dataset.pi)); }
function removeRoomVideoBtn(el){ removeRoomVideo(el.dataset.pid, parseInt(el.dataset.rn)); }
function handlePhotoUploadBtn(el){ handlePhotoUpload(el.dataset.pid, parseInt(el.dataset.rn), el); }
function handleVideoUploadBtn(el){ handleVideoUpload(el.dataset.pid, parseInt(el.dataset.rn), el); }
function shareRoomWABtn(el){ shareRoomWA(el.dataset.pid, parseInt(el.dataset.rn)); }
function saveRoomNotesBtn(el){ saveRoomNotes(el.dataset.pid, parseInt(el.dataset.rn)); }

function goto(page){
  if(!canSee(page))return;
  // Clear search filters when navigating away from their page
  if(page!=='tenants')   state.filters.tenantQ='';
  if(page!=='properties')state.filters.propQ='';
  if(page!=='maintenance')state.filters.maintQ='';
  state.page=page;render();
}

function render() {
  renderNav();
  const pages = {dashboard:renderDashboard,properties:renderProperties,tenants:renderTenants,rent:renderRent,expenses:renderExpenses,maintenance:renderMaintenance,landlords:renderLandlords,rooms:renderRooms,reports:renderReports,settings:renderSettings,users:renderUsers,import:renderImport};
  try {
    document.getElementById('content').innerHTML = pages[state.page]();
  } catch(e) {
    console.error('Render error on page '+state.page+':', e);
    document.getElementById('content').innerHTML = '<div style="padding:40px;text-align:center;color:var(--red)"><div style="font-size:24px">⚠️</div><div style="font-weight:700;margin:8px 0">Page error</div><div style="font-size:12px;color:var(--muted)">'+e.message+'</div><button onclick="render()" style="margin-top:16px;padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg);cursor:pointer;font-family:inherit">Retry</button></div>';
  }
}
