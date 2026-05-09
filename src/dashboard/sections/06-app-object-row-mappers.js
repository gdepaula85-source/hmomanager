// ── App object → Row mappers ───────────────────────────────
function landlordToRow(l){
  return {id:l.id,name:l.name||'',phone:l.phone||'',email:l.email||'',
    bank:l.bank||'',sort_code:l.sortCode||'',account_no:l.accountNo||'',notes:l.notes||''};
}
function propToRow(p){
  var isArch = p.status === 'archived';
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
    purchase_info:p.purchaseInfo||null,
    // Persisted via the 2026-05 field-fixes migration. These were missing from
    // the write side for months — every edit to lease start date / pay day was
    // silently dropped on save and reverted on the next reload.
    lease_start_date: p.leaseStartDate || null,
    landlord_pay_day: (p.landlordPayDay != null && p.landlordPayDay !== '') ? parseInt(p.landlordPayDay, 10) : null,
    status:isArch?'archived':'active',
    archived_at:isArch&&(p.archivedDate||null)?String(p.archivedDate).split('T')[0]:null,
    is_str_enabled: !!p.isStrEnabled,
    inspections: Array.isArray(p.inspections) ? p.inspections : [],
    gallery: (p.gallery && typeof p.gallery === 'object')
      ? { photos: Array.isArray(p.gallery.photos) ? p.gallery.photos : [], videos: Array.isArray(p.gallery.videos) ? p.gallery.videos : [] }
      : { photos: [], videos: [] }};
}
function tenantToRow(t){
  // archived_at column added by the 2026-05 field-fixes migration. Without
  // this on the write side, archive dates set in the UI never persist —
  // archiveTenant updates state.archivedDate but the next save drops it.
  return {id:t.id,name:t.name||'',property_id:t.propertyId||null,
    archived_at: t.archivedDate || null,
    property_name:t.property||'',room_number:t.room||null,room_type:t.roomType||'Single',
    rent:t.rent||0,freq:t.freq||'weekly',pay_day:t.payDay||null,
    pay_day_of_month:t.payDayOfMonth||null,method:t.method||'bank',
    status:t.status||'active',arrears:t.arrears||0,deposit:t.deposit||0,
    deposit_status:t.depositStatus||'held',whatsapp:t.whatsapp||'',
    email:t.email||'',move_in:t.checkIn||null,start_date:t.startDate||null,
    notice_date:t.noticeDate||null,move_out_date:t.moveOutDate||null,
    notes:t.notes||'',payment_history:t.paymentHistory||[],portal_username:t.portalUsername||null,portal_password:t.portalPassword||null,
    previous_tenancies:t.previousTenancies||[],
    dob:t.dob||null, nationality:t.nationality||null,
    signature:t.signature||null, signature_saved_at:t.signatureSavedAt||null,
    client_id:t.clientId||null};
}
function paymentToRow(p){
  return {id:p.id,tenant_id:p.tenantId||null,tenant_name:p.tenantName||'',
    property_name:p.propertyName||p.property||'',amount:p.amount||0,method:p.method||'bank',
    status:p.status||'paid',due_date:p.dueDate||null,paid_date:p.paidDate||null,
    is_partial:p.isPartial||false,shortfall:p.shortfall||0,notes:p.notes||'',
    income_source:p.incomeSource||'rent',
    period_start:p.periodStart||null, period_end:p.periodEnd||null};
}
function expenseToRow(e){
  return {id:e.id,category:e.category||e.cat||'',description:e.description||e.desc||'',
    amount:e.amount||0,type:e.type||'',status:e.status||'estimated',
    freq:e.freq||'one-off',recurring:e.recurring||false,start_date:e.startDate||null,
    property_id:e.propertyId||null,property_name:e.propertyName||e.property||'',
    receipt_url:e.receipt||null, receipt_name:e.receiptName||null, receipt_type:e.receiptType||null};
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
    scheduled_date:m.scheduledDate||null,scheduled_time:m.scheduledTime||null,
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
function companyToRow(c){
  return {id:c.id,name:c.name||'',company_no:c.companyNo||'',
    vat_no:c.vatNo||'',director:c.director||'',address:c.address||'',
    email:c.email||'',phone:c.phone||'',whatsapp:c.whatsapp||'',
    color:c.color||'#6366F1'};
}
