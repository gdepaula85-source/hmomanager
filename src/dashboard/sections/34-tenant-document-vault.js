// ── TENANT DOCUMENT VAULT ──────────────────────────────────────────────────────
async function uploadTenantDoc(tenantId, input) {
  if(!state.vault) state.vault = {};
  if(!state.vault[tenantId]) state.vault[tenantId] = [];
  var docType = (document.getElementById('vault-doc-type-'+tenantId)||{}).value || 'Other';
  var files = Array.from(input.files);
  if(!files.length) return;

  for(var fi=0; fi<files.length; fi++) {
    var file = files[fi];
    if(file.size > 10*1024*1024) { showToast(file.name+' exceeds 10MB limit.','error'); continue; }
    var sizeStr = file.size>1024*1024 ? (file.size/1024/1024).toFixed(1)+'MB' : Math.round(file.size/1024)+'KB';
    var now = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    var docId = 'tdoc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    var ext = file.name.split('.').pop().toLowerCase();
    var path = 'tenants/'+tenantId+'/'+docId+'.'+ext;

    showToast('Uploading '+file.name+'…','success');

    var entry = { id:docId, name:file.name, type:docType, size:sizeStr,
      uploadedAt:now, dataUrl:null, storagePath:null };
    state.vault[tenantId].push(entry);

    var uploaded = false;
    try {
      var {error:upErr} = await supa.storage.from('tenant-docs').upload(path, file, {upsert:true});
      if(upErr) throw upErr;
      // Try public URL first
      var pubData = supa.storage.from('tenant-docs').getPublicUrl(path);
      if(pubData && pubData.data && pubData.data.publicUrl) {
        entry.dataUrl = pubData.data.publicUrl;
        entry.storagePath = path;
        uploaded = true;
      } else {
        var {data:urlData, error:urlErr} = await supa.storage.from('tenant-docs').createSignedUrl(path, 31536000);
        if(!urlErr && urlData && urlData.signedUrl) {
          entry.dataUrl = urlData.signedUrl;
          entry.storagePath = path;
          uploaded = true;
        }
      }
      if(uploaded) {
        showToast(file.name+' uploaded ✓','success');
      } else {
        throw new Error('Could not get download URL');
      }
    } catch(err) {
      console.warn('Tenant doc storage failed, falling back to base64:', err.message);
      try {
        var b64 = await new Promise(function(res,rej){
          var r=new FileReader(); r.onload=function(e){res(e.target.result);}; r.onerror=rej; r.readAsDataURL(file);
        });
        entry.dataUrl = b64;
        entry.storagePath = null;
        showToast(file.name+' saved locally','success');
        uploaded = true;
      } catch(b64err) {
        showToast('Upload failed: '+err.message,'error');
        state.vault[tenantId] = state.vault[tenantId].filter(function(d){return d.id!==docId;});
        continue;
      }
    }
    saveState();
  }
  input.value = '';
  state.tenantDetailTab = 'vault';
  openTenantDetail(tenantId);
}
