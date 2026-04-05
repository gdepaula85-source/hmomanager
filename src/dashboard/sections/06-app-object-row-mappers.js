// ── App object → Row mappers ───────────────────────────────
function landlordToRow(l){
  return {id:l.id,name:l.name||'',phone:l.phone||'',email:l.email||'',
    bank:l.bank||'',sort_code:l.sortCode||'',account_no:l.accountNo||'',notes:l.notes||''};
}
function propToRow(p){
  return {id:p.id,name:p.name||'',address:p.address||'',postcode:p.postcode||'',
    area:p.area||'',type:p.type||'HMO',rooms:p.rooms||0,occupied:p.occupied||0,
    rent:p.rent||0,landlord_rent:p.landlord||0,landlord_id:p.landlordId||null,
    landlord_name:p.landlordName||'',maps_url:p.mapsUrl||'',notes:p.notes||'',
    company_id:p.companyId||null,
    room_list:p.roomList||[],
    ownership_type:p.ownershipType||'managed',
    letting_type:p.lettingType||'hmo',
    bedrooms:p.bedrooms||null,
    mortgage:p.mortgage||null,
    purchase_info:p.purchaseInfo||null};
}
function tenantToRow(t){
  return {id:t.id,name:t.name||'',property_id:t.propertyId||null,
    property_name:t.property||'',room_number:t.room||null,room_type:t.roomType||'Single',
    rent:t.rent||0,freq:t.freq||'weekly',pay_day:t.payDay||null,
    pay_day_of_month:t.payDayOfMonth||null,method:t.method||'bank',
    status:t.status||'active',arrears:t.arrears||0,deposit:t.deposit||0,
    deposit_status:t.depositStatus||'held',whatsapp:t.whatsapp||'',
    email:t.email||'',move_in:t.checkIn||null,start_date:t.startDate||null,
    notice_date:t.noticeDate||null,move_out_date:t.moveOutDate||null,
    notes:t.notes||'',payment_history:t.paymentHistory||[],portal_username:t.portalUsername||null,portal_password:t.portalPassword||null,
    previous_tenancies:t.previousTenancies||[]};
}
function paymentToRow(p){
  return {id:p.id,tenant_id:p.tenantId||null,tenant_name:p.tenantName||'',
    property_name:p.propertyName||'',amount:p.amount||0,method:p.method||'bank',
    status:p.status||'paid',due_date:p.dueDate||null,paid_date:p.paidDate||null,
    is_partial:p.isPartial||false,shortfall:p.shortfall||0,notes:p.notes||''};
}
function expenseToRow(e){
  return {id:e.id,category:e.category||'',description:e.description||'',
    amount:e.amount||0,type:e.type||'',status:e.status||'estimated',
    freq:e.freq||'one-off',recurring:e.recurring||false,start_date:e.startDate||null,
    property_id:e.propertyId||null,property_name:e.propertyName||''};
}
function maintenanceToRow(m){
  var mx=(state.maintExtras&&state.maintExtras[m.id])||{};
  return {id:m.id,property_id:m.propertyId||null,property_name:m.property||'',
    room_number:m.roomNumber||m.room||null,location:m.location||'',
    tenant_name:m.tenantName||m.tenant||'',
    issue:m.issue||'',category:m.category||m.cat||'General',
    priority:m.priority||'medium',
    status:m.status||'open',notes:m.notes||'',
    photo_url:m.photoUrl||m.photo||'',
    logged_date:m.loggedDate||m.date||null,resolved_date:m.resolvedDate||null,
    contractor:m.contractor||null,
    job_cost:mx.cost||m.jobCost||null,
    invoice_name:mx.invoiceName||m.invoiceName||null,
    invoice_url:mx.invoiceUrl||m.invoiceUrl||null};
}
function landlordPaymentToRow(lp){
  return {id:lp.id,landlord_id:lp.landlordId||null,landlord_name:lp.landlordName||'',
    property_id:lp.propId||null,property_name:lp.propName||'',
    month_key:lp.monthKey||'',month_label:lp.monthLabel||'',
    amount:lp.amount||0,due_date:lp.dueDate||null,paid_date:lp.paidDate||null,
    status:lp.status||'pending',method:lp.method||'bank',ref:lp.ref||''};
}
