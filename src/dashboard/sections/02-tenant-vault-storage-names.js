// ── Tenant document vault: storage object names include doc-type slug (portal + dashboard uploads)
// Format: {SLUG}__tdoc_....{ext}  e.g. RTR__tdoc_123_0_ab.jpeg → "Right to Rent"

var TENANT_VAULT_TYPE_SLUGS = {
  RTR: 'Right to Rent',
  PID: 'Passport / ID',
  POA: 'Proof of Address',
  EREF: 'Employment Reference',
  LREF: 'Landlord Reference',
  TAPP: 'Tenancy Application',
  BANK: 'Bank Statement',
  NI: 'NI Number',
  OTH: 'Other'
};

function tenantDocTypeLabelToSlug(label){
  var map = {
    'Right to Rent': 'RTR',
    'Passport / ID': 'PID',
    'Proof of Address': 'POA',
    'Employment Reference': 'EREF',
    'Landlord Reference': 'LREF',
    'Tenancy Application': 'TAPP',
    'Bank Statement': 'BANK',
    'NI Number': 'NI',
    'Other': 'OTH'
  };
  if (!label) return 'OTH';
  return map[label] || 'OTH';
}

/** Derive display title and type chip from storage file name. */
function parseTenantVaultStorageFileName(fileName){
  if (!fileName || typeof fileName !== 'string') {
    return { vaultDisplayName: '', docType: 'Document', hasTypeSlug: false };
  }
  var m = fileName.match(/^([A-Z0-9]+)__(.+)$/i);
  if (m) {
    var slug = m[1].toUpperCase();
    var docType = TENANT_VAULT_TYPE_SLUGS[slug];
    if (docType) {
      return { vaultDisplayName: docType, docType: docType, hasTypeSlug: true };
    }
  }
  return { vaultDisplayName: '', docType: 'Document', hasTypeSlug: false };
}
