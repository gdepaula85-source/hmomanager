// ── EXPORT / IMPORT ──────────────────────────────────────────────────────────

function uploadPropDocFromInput(input){uploadPropDoc(input.id.replace('pvault-input-',''),input);}

async function uploadPropDoc(propId, input) {
  if(!state.propDocs) state.propDocs = {};
  if(!state.propDocs[propId]) state.propDocs[propId] = [];
  var typeEl  = document.getElementById('pdoc-type-'+propId);
  var expEl   = document.getElementById('pdoc-expires-'+propId);
  var docType   = typeEl ? typeEl.value : 'Other';
  var expiresAt = expEl ? expEl.value : '';
  var files = Array.from(input.files);
  if(!files.length) return;
  for(var fi=0;fi<files.length;fi++){
    var file=files[fi];
    if(file.size>20*1024*1024){showToast(file.name+' exceeds 20MB.','error');continue;}
    var sizeStr=file.size>1024*1024?(file.size/1024/1024).toFixed(1)+'MB':Math.round(file.size/1024)+'KB';
    var now=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    var docId='pdoc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    var ext=file.name.split('.').pop().toLowerCase();
    var path='properties/'+String(propId)+'/'+docId+'.'+ext;
    showToast('Uploading…','success');
    var entry={id:docId,name:file.name,type:docType,size:sizeStr,uploadedAt:now,expiresAt:expiresAt||null,dataUrl:null,storagePath:null};
    state.propDocs[propId].push(entry);
    try {
      var up=await supa.storage.from('property-docs').upload(path,file,{upsert:true});
      if(up.error) throw up.error;
      var pub=supa.storage.from('property-docs').getPublicUrl(path);
      if(pub.data&&pub.data.publicUrl){
        entry.dataUrl=pub.data.publicUrl;entry.storagePath=path;
      } else {
        var sig=await supa.storage.from('property-docs').createSignedUrl(path,31536000);
        if(sig.error||!sig.data||!sig.data.signedUrl) throw new Error('Cannot get URL — check storage policy');
        entry.dataUrl=sig.data.signedUrl;entry.storagePath=path;
      }
      showToast(file.name+' uploaded ✓','success');
    } catch(err){
      console.warn('Storage failed, using base64:',err.message);
      try{
        entry.dataUrl=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(e){res(e.target.result);};r.onerror=rej;r.readAsDataURL(file);});
        entry.storagePath=null;
        showToast(file.name+' saved locally','success');
      } catch(e2){
        showToast('Upload failed: '+err.message,'error');
        state.propDocs[propId]=state.propDocs[propId].filter(function(d){return d.id!==docId;});
        continue;
      }
    }
    saveState();
  }
  input.value='';state.propDetailTab='docs';openPropDetail(propId);
}

function removePropDoc(propId,docId){
  if(!state.propDocs||!state.propDocs[propId]) return;
  var doc=state.propDocs[propId].find(function(d){return d.id===docId;});
  if(doc&&doc.storagePath) supa.storage.from('property-docs').remove([doc.storagePath]).catch(function(){});
  state.propDocs[propId]=state.propDocs[propId].filter(function(d){return d.id!==docId;});
  saveState();state.propDetailTab='docs';openPropDetail(propId);
}
