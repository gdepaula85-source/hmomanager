// ── LANDLORDS PAGE ─────────────────────────────────────────────────────────────
async function markLandlordPaid(llId, payId) {
  var pay = (state.landlordPayments||[]).find(function(p){return p.id===payId;});
  if(!pay){ console.warn('markLandlordPaid: entry not found for id:', payId, 'total entries:', state.landlordPayments.length); return; }
  if (pay.status === 'paid') return; // double-click guard
  var today = new Date().toISOString().split('T')[0];
  // Direct targeted DB update using the natural unique key (property_id + month_key).
  // This is robust against UUID mismatches that can occur after a demo reset
  // or when the autosave creates a row with a different UUID than what's in DB.
  // .select() lets us see how many rows were actually updated — a silent 0-row
  // update can happen if the row was deleted or the property/month no longer exists.
  var res = await supa.from('landlord_payments')
    .update({ status: 'paid', paid_date: today })
    .eq('org_id', _currentOrgId)
    .eq('property_id', String(pay.propId))
    .eq('month_key', String(pay.monthKey))
    .select('id');
  if (res.error) {
    showToast('Failed to mark paid: ' + res.error.message, 'error');
    return;
  }
  if (!res.data || res.data.length === 0) {
    showToast('No matching DB row — try a hard refresh (the schedule may be out of sync)', 'warn');
    return;
  }
  pay.status = 'paid';
  pay.paidDate = today;
  render();
}
