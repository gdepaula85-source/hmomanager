// ── MAINTENANCE EDIT ──────────────────────────────────────────────────────────
function openEditMaintModal(id) {
  var m=state.maintenance.find(function(x){return String(x.id)===String(id);});
  if(!m) return;
  if(!state.maintExtras) state.maintExtras={};
  if(!state.maintExtras[id]) state.maintExtras[id]={photos:[]};
  var mx=state.maintExtras[id];
  var CATS=['Plumbing','Electrical','Heating / Boiler','Windows / Doors','Damp / Mould','Kitchen','Bathroom','Appliances','Pest Control - Bed Bugs','Pest Control - Cockroaches','Pest Control - Mice','Pest Control - Rats','General'];
  var catOpts=CATS.map(function(c){return '<option '+(c===(m.cat||m.category||'General')?'selected':'')+'>'+c+'</option>';}).join('');
  var photosHtml='';
  if(m.photo) photosHtml+='<div style="position:relative;display:inline-block;margin:3px"><img src="'+m.photo+'" style="width:76px;height:76px;object-fit:cover;border-radius:7px"><span style="position:absolute;bottom:2px;left:2px;font-size:8px;background:rgba(0,0,0,.55);color:#fff;border-radius:3px;padding:1px 4px">Original</span></div>';
  (mx.photos||[]).forEach(function(ph,i){
    photosHtml+='<div data-eid="emph'+i+'" style="position:relative;display:inline-block;margin:3px"><img src="'+ph.src+'" style="width:76px;height:76px;object-fit:cover;border-radius:7px"><button data-mid="'+id+'" data-idx="'+i+'" onclick="removeMaintExtraPhoto(this.dataset.mid,this.dataset.idx);var _p=this.parentNode;if(_p)_p.remove()" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.65);border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1;padding:0">&times;</button></div>';
  });
  var invHtml='';
  if(mx.invoiceName) invHtml='<div id="em-inv-curr" style="display:flex;align-items:center;gap:7px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:8px;padding:8px 10px;margin-bottom:6px"><span style="font-size:11px;font-weight:600;color:var(--blue);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+mx.invoiceName+'</span><button data-mid="'+id+'" onclick="clearMaintInvoice(this.dataset.mid)" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0">Remove</button></div>';
  invHtml+='<div id="em-inv-prev" style="display:none;align-items:center;gap:7px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:8px;padding:8px 10px;margin-bottom:6px"><span id="em-inv-name" style="font-size:11px;font-weight:600;color:var(--blue);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span><button onclick="clearPendingInvoicePreview()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0">Remove</button></div>';
  window._pendingMaintInvoice=null;
  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:500px">'
    +'<div class="modal-header"><span class="modal-title">Edit Maintenance Job</span><button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label class="field-label">Issue Description</label><textarea class="inp" id="em-issue" rows="2" style="resize:vertical">'+esc(m.issue)+'</textarea></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Category</label><select class="inp" id="em-cat">'+catOpts+'</select></div>'
    +'<div class="field"><label class="field-label">Priority</label><select class="inp" id="em-pri">'
    +'<option value="urgent"'+(m.priority==='urgent'?' selected':'')+'>Urgent</option>'
    +'<option value="high"'+(m.priority==='high'?' selected':'')+'>High</option>'
    +'<option value="medium"'+(m.priority==='medium'?' selected':'')+'>Medium</option>'
    +'<option value="low"'+(m.priority==='low'?' selected':'')+'>Low</option>'
    +'</select></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Status</label><select class="inp" id="em-status">'
    +'<option value="open"'+(m.status==='open'?' selected':'')+'>Open</option>'
    +'<option value="in_progress"'+(m.status==='in_progress'?' selected':'')+'>In Progress</option>'
    +'<option value="resolved"'+(m.status==='resolved'?' selected':'')+'>Resolved</option>'
    +'</select></div>'
    +'<div class="field"><label class="field-label">Assign Contractor</label><select class="inp" id="em-contractor">'
    +'<option value="">— None —</option>'
    +((state.contractors||[]).map(function(c){return '<option value="'+esc(c.name)+'"'+(m.contractor===c.name?' selected':'')+'>'+esc(c.name)+(c.trade?' ('+esc(c.trade)+')':'')+'</option>';}).join(''))
    +'</select></div></div>'
    +'<div class="field"><label class="field-label">Notes</label><input class="inp" id="em-notes" value="'+(m.notes||'').replace(/"/g,'&quot;')+'" placeholder="Access details, follow-up notes"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Job Cost (£)</label><input class="inp" id="em-cost" type="number" step="0.01" min="0" placeholder="0.00" value="'+(mx.cost||'')+'"></div>'
    +'<div class="field"><label class="field-label">Invoice / Receipt</label>'
    +'<input type="file" id="em-inv-inp" accept="image/*,.pdf" style="display:none" onchange="previewMaintInvoice(this)">'
    +invHtml
    +'<button onclick="clickMaintInvInput()" style="display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:8px;border:2px dashed var(--border);background:var(--bg);cursor:pointer;width:100%;font-family:inherit;font-size:12px;color:var(--muted)">+ Upload Invoice</button>'
    +'</div></div>'
    +'<div class="field"><label class="field-label">Photos</label>'
    +'<div id="em-photos-grid" style="line-height:0;margin-bottom:8px">'+photosHtml+'</div>'
    +'<input type="file" id="em-photos-inp" accept="image/*" multiple data-mid="'+id+'" style="display:none" onchange="addMaintExtraPhotos(this)">'
    +'<button onclick="clickMaintPhotosInput()" style="display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:8px;border:2px dashed var(--border);background:var(--bg);cursor:pointer;width:100%;font-family:inherit;font-size:12px;color:var(--muted)">+ Add Photos</button>'
    +'</div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" class="btn btn-secondary">Cancel</button>'
    +'<button data-mid="'+id+'" onclick="saveEditMaint(this.dataset.mid)" class="btn btn-primary">Save Changes</button>'
    +'</div></div></div>';
}
function saveEditMaint(id) {
  var m=state.maintenance.find(function(x){return String(x.id)===String(id);});if(!m)return;
  var issue=(document.getElementById('em-issue').value||'').trim();if(issue)m.issue=issue;
  m.cat=document.getElementById('em-cat').value;m.category=m.cat;
  m.priority=document.getElementById('em-pri').value;
  var ns=document.getElementById('em-status').value;
  if(ns==='resolved'&&m.status!=='resolved')m.resolvedDate=new Date().toISOString().split('T')[0];
  m.status=ns;m.notes=document.getElementById('em-notes').value;
  var _cEl=document.getElementById('em-contractor');if(_cEl)m.contractor=_cEl.value;
  if(!state.maintExtras)state.maintExtras={};
  if(!state.maintExtras[id])state.maintExtras[id]={photos:[]};
  var mx=state.maintExtras[id],prevCost=mx.cost||0;
  var cv=parseFloat(document.getElementById('em-cost').value)||0;
  if(cv>0)mx.cost=Math.round(cv*100)/100;else delete mx.cost;
  if(window._pendingMaintInvoice){mx.invoiceUrl=window._pendingMaintInvoice.url;mx.invoiceName=window._pendingMaintInvoice.name;window._pendingMaintInvoice=null;}
  if(cv>0&&cv!==prevCost){
    if(!state.expenses)state.expenses=[];
    state.expenses=state.expenses.filter(function(e){return e._maintId!==id;});
    var _prop=state.properties.find(function(p){return p.name===m.property;});
    var _desc=m.issue+(m.room?' (Room '+m.room+')':'')+' - '+(m.cat||'General')+(m.contractor?' ['+m.contractor+']':'');
    var _propAddr=_prop?((_prop.address&&_prop.address!==_prop.name)?_prop.address:_prop.name):m.property||'';
    state.expenses.push({id:crypto.randomUUID(),_maintId:id,
      category:'Maintenance',cat:'Maintenance',description:_desc,desc:_desc,
      amount:cv,type:'actual',status:'actual',freq:'one-off',recurring:false,
      startDate:new Date().toISOString().split('T')[0],
      propertyId:_prop?_prop.id:null,propertyName:_propAddr,property:_propAddr});
    showToast('Job updated - cost added to Expenses','success');
  } else {showToast('Job updated','success');}
  saveState();closeModal();render();
}
function previewMaintInvoice(input){
  var file=input.files[0];if(!file)return;
  if(file.size>2*1024*1024){showToast('File too large - max 2MB','error');input.value='';return;}
  var pd=document.getElementById('em-inv-prev'),ne=document.getElementById('em-inv-name');
  if(pd)pd.style.display='flex';if(ne)ne.textContent=file.name;
  var reader=new FileReader();
  reader.onload=function(e){window._pendingMaintInvoice={url:e.target.result,name:file.name};};
  reader.readAsDataURL(file);
}
function addMaintExtraPhotos(input){
  var maintId=input.dataset.mid;
  if(!state.maintExtras)state.maintExtras={};
  if(!state.maintExtras[maintId])state.maintExtras[maintId]={photos:[]};
  var mx=state.maintExtras[maintId],grid=document.getElementById('em-photos-grid');
  Array.from(input.files).forEach(function(file){
    if(file.size>3*1024*1024){showToast('Photo too large (max 3MB) - skipped','error');return;}
    var reader=new FileReader();
    reader.onload=function(e){
      var photo={src:e.target.result,name:file.name};
      mx.photos.push(photo);
      if(grid){
        var idx=mx.photos.length-1;
        var div=document.createElement('div');
        div.id='emph'+idx;div.style.cssText='position:relative;display:inline-block;margin:3px';
        var btn=document.createElement('button');
        btn.dataset.mid=maintId;btn.dataset.idx=String(idx);
        btn.innerHTML='&times;';
        btn.style.cssText='position:absolute;top:2px;right:2px;background:rgba(0,0,0,.65);border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1;padding:0';
        btn.onclick=function(){removeMaintExtraPhoto(this.dataset.mid,this.dataset.idx);var el=document.getElementById('emph'+this.dataset.idx);if(el)el.remove();};
        var img=document.createElement('img');img.src=photo.src;img.style.cssText='width:76px;height:76px;object-fit:cover;border-radius:7px';
        div.appendChild(img);div.appendChild(btn);grid.appendChild(div);
      }
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}
function removeMaintExtraPhoto(maintId,idx){
  if(state.maintExtras&&state.maintExtras[maintId])state.maintExtras[maintId].photos.splice(Number(idx),1);
}

function clearPendingInvoicePreview(){var pd=document.getElementById('em-inv-prev');if(pd)pd.style.display='none';var inp=document.getElementById('em-inv-inp');if(inp)inp.value='';window._pendingMaintInvoice=null;}
function clickMaintInvInput(){var el=document.getElementById('em-inv-inp');if(el)el.click();}
function clickMaintPhotosInput(){var el=document.getElementById('em-photos-inp');if(el)el.click();}
function clearMaintInvoice(maintId){
  if(state.maintExtras&&state.maintExtras[maintId]){delete state.maintExtras[maintId].invoiceUrl;delete state.maintExtras[maintId].invoiceName;}
  var el=document.getElementById('em-inv-curr');if(el)el.style.display='none';saveState();
}
