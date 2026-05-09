// ── Row → App object mappers ───────────────────────────────
function rowToLandlord(r){
  return {id:r.id,name:r.name||'',phone:r.phone||'',email:r.email||'',
    bank:r.bank||'',sortCode:r.sort_code||'',accountNo:r.account_no||'',notes:r.notes||''};
}
function rowToProp(r){
  var rawSt = r.status != null ? String(r.status).trim().toLowerCase() : '';
  var st = rawSt === 'archived' ? 'archived' : 'active';
  var arch = r.archived_at;
  var archivedDate = arch
    ? (typeof arch === 'string' ? arch.split('T')[0] : '')
    : null;
  return {id:r.id,name:r.name||'',address:r.address||'',postcode:r.postcode||'',
    area:r.area||'',type:r.type||'HMO',rooms:r.rooms||0,occupied:r.occupied||0,
    rent:parseFloat(r.rent)||0,landlord:parseFloat(r.landlord_rent)||0,
    landlordId:r.landlord_id||null,landlordName:r.landlord_name||'',landlordEmail:r.landlord_email||'',
    mapsUrl:r.maps_url||'',notes:r.notes||'',
    companyId:r.company_id||'',
    roomList:Array.isArray(r.room_list)?r.room_list:[],
    ownershipType:r.ownership_type||'managed',
    lettingType:r.letting_type||'hmo',
    bedrooms:r.bedrooms||null,
    mortgage:r.mortgage||null,
    purchaseInfo:r.purchase_info||null,
    // Persisted via the 2026-05 field-fixes migration. Without these in the
    // mapper, edits to "Lease Start Date" or "Landlord Pay Day" never made
    // it back into state on reload — silent data loss.
    leaseStartDate: r.lease_start_date
      ? (typeof r.lease_start_date === 'string' ? r.lease_start_date.split('T')[0] : null)
      : null,
    landlordPayDay: (r.landlord_pay_day != null ? parseInt(r.landlord_pay_day, 10) : null),
    status:st,
    archivedDate:archivedDate||undefined,
    createdAt:r.created_at||null,
    isStrEnabled: !!r.is_str_enabled,
    inspections: Array.isArray(r.inspections) ? r.inspections : [],
    gallery: (r.gallery && typeof r.gallery === 'object')
      ? { photos: Array.isArray(r.gallery.photos) ? r.gallery.photos : [], videos: Array.isArray(r.gallery.videos) ? r.gallery.videos : [] }
      : { photos: [], videos: [] }};
}
function rowToTenant(r){
  // archived_at column added by the 2026-05 field-fixes migration. Without
  // this read, the archived date isn't restored on page load (the tenant
  // appears in the Archived tab but with no archive date).
  var tArch = r.archived_at;
  var tArchDate = tArch ? (typeof tArch === 'string' ? tArch.split('T')[0] : null) : null;
  return {id:r.id,name:r.name||'',property:r.property_name||'',
    archivedDate: tArchDate || undefined,
    propertyId:r.property_id||null,room:r.room_number||null,
    roomType:r.room_type||'Single',rent:parseFloat(r.rent)||0,
    freq:r.freq||'weekly',payDay:r.pay_day||'Monday',
    payDayOfMonth:r.pay_day_of_month||null,method:r.method||'bank',
    status:r.status||'active',arrears:parseFloat(r.arrears)||0,
    deposit:parseFloat(r.deposit)||0,depositStatus:r.deposit_status||'held',
    whatsapp:r.whatsapp||'',email:r.email||'',checkIn:r.move_in||null,
    startDate:r.start_date||null,noticeDate:r.notice_date||null,
    moveOutDate:r.move_out_date||null,notes:r.notes||'',
    paymentHistory:Array.isArray(r.payment_history)?r.payment_history:[],
    portalUsername:r.portal_username||null,
    portalPassword:r.portal_password||null,
    dob:r.dob||null,
    nationality:r.nationality||'',
    signature:r.signature||null,
    signatureSavedAt:r.signature_saved_at||null,
    signatureSignerName:r.signature_signer_name||null,
    signedAgreementType:r.signed_agreement_type||null,
    signedLandlordSig:r.signed_landlord_sig||null,
    signedLandlordName:r.signed_landlord_name||null,
    signedLandlordTitle:r.signed_landlord_title||null,
    signedLandlordDate:r.signed_landlord_date||null,
    signedIp:r.signed_ip||null,
    signedUserAgent:r.signed_user_agent||null,
    signedAgreementPdfPath:r.signed_agreement_pdf_path||null,
    clientId:r.client_id||null,
    previousTenancies:Array.isArray(r.previous_tenancies)?r.previous_tenancies:[]};
}
// Business / individual client owning one or more tenancies. The dashboard
// groups tenants by clientId when type === 'business' so a single rent-to-rent
// company holding 8 properties shows as one row with an expandable portfolio.
function rowToClient(r){
  return {id:r.id,name:r.name||'',type:r.type||'business',
    companyNo:r.company_no||'',contactPerson:r.contact_person||'',
    email:r.email||'',phone:r.phone||'',whatsapp:r.whatsapp||'',
    address:r.address||'',notes:r.notes||'',createdAt:r.created_at||null};
}
function clientToRow(c){
  return {id:c.id,name:c.name||'',type:c.type||'business',
    company_no:c.companyNo||null,contact_person:c.contactPerson||null,
    email:c.email||null,phone:c.phone||null,whatsapp:c.whatsapp||null,
    address:c.address||null,notes:c.notes||null};
}
function rowToPayment(r){
  var dd = r.due_date||null;
  // Parse due_date as local midnight to avoid UTC offset shifting the date (BST = GMT+1)
  var ddRaw = null;
  if(dd) {
    var _ddp = dd.split('T')[0].split('-');
    if(_ddp.length===3) ddRaw = new Date(+_ddp[0], +_ddp[1]-1, +_ddp[2]).getTime();
    else ddRaw = new Date(dd).getTime();
  }
  // Parse paid_date (stored as en-GB "21 Mar 2026" OR ISO) into separate _paidDateRaw for dedup
  var _paidDateRaw = null;
  var _pd = r.paid_date||null;
  if(_pd) {
    var _months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    var _pdp = String(_pd).split(' ');
    if(_pdp.length===3 && _months[_pdp[1]]!==undefined) {
      _paidDateRaw = new Date(+_pdp[2], _months[_pdp[1]], +_pdp[0]).getTime();
    } else {
      var _iso = _pd.split('T')[0].split('-');
      if(_iso.length===3) _paidDateRaw = new Date(+_iso[0],+_iso[1]-1,+_iso[2]).getTime();
    }
  }
  return {id:r.id,tenantId:r.tenant_id||null,tenantName:r.tenant_name||'',
    tenant:r.tenant_name||'',  // alias for renderRent compatibility
    propertyName:r.property_name||'',property:r.property_name||'',
    amount:parseFloat(r.amount)||0,
    method:r.method||'bank',status:r.status||'paid',dueDate:dd,
    _dueDateRaw:ddRaw, _paidDateRaw:_paidDateRaw,
    paidDate:r.paid_date||null,isPartial:r.is_partial||false,
    shortfall:parseFloat(r.shortfall)||0,notes:r.notes||'',
    incomeSource:r.income_source||'rent',
    periodStart:r.period_start||null, periodEnd:r.period_end||null};
}
function rowToExpense(r){
  var cat=r.category||'',desc=r.description||'',propName=r.property_name||'';
  return {id:r.id,category:cat,description:desc,cat:cat,desc:desc,
    amount:parseFloat(r.amount)||0,type:r.type||'',status:r.status||'estimated',
    freq:r.freq||'one-off',recurring:r.recurring||false,startDate:r.start_date||null,
    propertyId:r.property_id||null,propertyName:propName,property:propName,
    receipt:r.receipt_url||null, receiptName:r.receipt_name||null, receiptType:r.receipt_type||null};
}
function rowToMaintenance(r){
  return {id:r.id,property:r.property_name||'',propertyId:r.property_id||null,
    roomNumber:r.room_number||null,location:r.location||'',tenantName:r.tenant_name||'',
    room:r.room_number||null,tenant:r.tenant_name||'',
    issue:r.issue||'',category:r.category||'General',priority:r.priority||'medium',
    status:r.status||'open',notes:r.notes||'',photoUrl:r.photo_url||'',photo:r.photo_url||'',
    date:r.logged_date||null,cat:r.category||'General',
    loggedDate:r.logged_date||null,resolvedDate:r.resolved_date||null,
    scheduledDate:r.scheduled_date||null,scheduledTime:r.scheduled_time||null,
    contractor:r.contractor||'',
    jobCost:parseFloat(r.job_cost)||0,
    invoiceName:r.invoice_name||'',invoiceUrl:r.invoice_url||''};
}
function rowToLandlordPayment(r){
  return {id:r.id,landlordId:r.landlord_id||null,landlordName:r.landlord_name||'',
    propId:r.property_id||null,propName:r.property_name||'',
    monthKey:r.month_key||'',monthLabel:r.month_label||'',
    amount:parseFloat(r.amount)||0,dueDate:r.due_date||null,
    paidDate:r.paid_date||null,status:r.status||'pending',
    method:r.method||'bank',ref:r.ref||''};
}
function rowToContractor(r){
  return {id:r.id,name:r.name||'',trade:r.trade||'General',
    phone:r.phone||'',whatsapp:r.whatsapp||'',email:r.email||'',
    notes:r.notes||'',rating:r.rating||null,
    lastUsed:r.last_used||null,callOutCharge:parseFloat(r.call_out_charge)||0};
}
function contractorToRow(c){
  return {id:c.id,name:c.name||'',trade:c.trade||'General',
    phone:c.phone||'',whatsapp:c.whatsapp||'',email:c.email||'',
    notes:c.notes||'',rating:c.rating||null,
    last_used:c.lastUsed||null,call_out_charge:c.callOutCharge||0};
}

function rowToCompany(r){
  return {id:r.id,name:r.name||'',companyNo:r.company_no||'',vatNo:r.vat_no||'',
    director:r.director||'',address:r.address||'',email:r.email||'',
    phone:r.phone||'',whatsapp:r.whatsapp||'',color:r.color||'#6366F1'};
}
function rowToDoc(r){
  return {id:r.id,propertyId:r.property_id||null,name:r.name||'',type:r.type||'',
    size:r.size||'',expiresAt:r.expires_at||null,storagePath:r.storage_path||'',
    uploadedAt:r.uploaded_at||null,dataUrl:r.data_url||''};
}
function docToRow(d){
  return {id:d.id,property_id:d.propertyId||null,name:d.name||'',type:d.type||'',
    size:d.size||'',expires_at:d.expiresAt||null,storage_path:d.storagePath||'',
    data_url:d.dataUrl||''};
}
function rowToVaultDoc(r){
  return {id:r.id,tenantId:r.tenant_id||null,name:r.name||'',type:r.type||'',
    size:r.size||'',storagePath:r.storage_path||'',
    uploadedAt:r.uploaded_at||null,dataUrl:r.data_url||''};
}
function vaultDocToRow(d){
  return {id:d.id,tenant_id:d.tenantId||null,name:d.name||'',type:d.type||'',
    size:d.size||'',storage_path:d.storagePath||'',
    data_url:d.dataUrl||''};
}
