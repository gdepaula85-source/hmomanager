// ── PAYMENT EDIT ──────────────────────────────────────────────────────────────
function openEditPaymentModal(payId){
  var idStr=String(payId);
  var p=state.payments.find(function(x){return String(x.id)===idStr;});
  var sc=!p?state.rentSchedule.find(function(x){return String(x.id)===idStr;}):null;
  var entry=p||sc;if(!entry)return;
  var tenantName=entry.tenant||entry.tenantName||'';
  var amount=entry.amount||0;
  var method=p?(p.paidMethod||p.method||'bank'):(sc?(sc.method||'bank'):'bank');
  var propRoom=(entry.property||entry.propertyName||'')+(entry.room?' - Rm '+(entry.room||''):'');
  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:400px">'
    +'<div class="modal-header"><span class="modal-title">Fix Payment</span><button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px"><div style="font-size:13px;font-weight:700">'+tenantName+'</div><div style="font-size:12px;color:var(--muted)">'+propRoom+'</div></div>'
    +'<div class="field"><label class="field-label">Amount (£)</label><input class="inp" id="ep-amount" type="number" step="0.01" min="0" value="'+amount+'"></div>'
    +'<div class="field"><label class="field-label">Method</label>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid '+(method==='bank'?'var(--accent)':'var(--border)')+';cursor:pointer"><input type="radio" name="ep-method" value="bank"'+(method==='bank'?' checked':'')+' style="accent-color:var(--accent)"> Bank</label>'
    +'<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:2px solid '+(method==='cash'?'var(--accent)':'var(--border)')+';cursor:pointer"><input type="radio" name="ep-method" value="cash"'+(method==='cash'?' checked':'')+' style="accent-color:var(--accent)"> Cash</label>'
    +'</div></div>'
    +'<div style="margin-top:8px;padding:12px;background:var(--red-light);border:1px solid #FECDD3;border-radius:10px">'
    +'<div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:4px">Revert to Unpaid</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Marks this entry as outstanding again.</div>'
    +'<button data-pid="'+idStr+'" onclick="revertPayment(this.dataset.pid)" style="padding:7px 14px;border-radius:8px;border:1px solid var(--red);background:#fff;color:var(--red);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Revert to Outstanding</button>'
    +'</div></div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button data-pid="'+idStr+'" onclick="saveEditPayment(this.dataset.pid)" style="padding:9px 20px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Fix</button>'
    +'</div></div></div>';
}
function saveEditPayment(payId){
  var idStr=String(payId),found=false;
  var newAmt=parseFloat(document.getElementById('ep-amount').value)||0;
  var newMeth=(document.querySelector('input[name="ep-method"]:checked')||{value:'bank'}).value;
  state.payments=state.payments.map(function(p){if(String(p.id)===idStr){found=true;return Object.assign({},p,{amount:newAmt,method:newMeth,paidMethod:newMeth});}return p;});
  if(!found){var sc=state.rentSchedule.find(function(x){return String(x.id)===idStr;});if(sc){sc.amount=newAmt;sc.method=newMeth;sc.paidMethod=newMeth;}}
  saveState();closeModal();render();showToast('Payment updated','success');
}
function revertPayment(payId){
  var idStr=String(payId);
  if(!confirm('Revert this payment to outstanding?')) return;
  state.payments=state.payments.filter(function(p){return String(p.id)!==idStr;});
  var sc=state.rentSchedule.find(function(x){return String(x.id)===idStr;});
  if(sc){sc.status='pending';delete sc.paidDate;delete sc.paidMethod;}
  saveState();closeModal();render();showToast('Payment reverted','success');
}
