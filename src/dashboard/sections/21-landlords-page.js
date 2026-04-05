// ── LANDLORDS PAGE ─────────────────────────────────────────────────────────────
function markLandlordPaid(llId, payId) {
  var pay = (state.landlordPayments||[]).find(function(p){return p.id===payId;});
  if(!pay){ console.warn('markLandlordPaid: entry not found for id:', payId, 'total entries:', state.landlordPayments.length); return; }
  pay.status = 'paid';
  pay.paidDate = new Date().toISOString().split('T')[0];
  saveState();
  render();
}
