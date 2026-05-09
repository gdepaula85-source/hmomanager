// ── Additional UK contract templates + picker + renewal flow ────────────────
// Mirrors the structure of 31-tenancy-agreement.js. Every contract:
//   • picks up the saved Authorised Signatory + today's date in the licensor block
//   • exposes a `data-contract-type` so 31b-contract-dispatch.js can route Save/Email/WhatsApp
// All wording is generic UK boilerplate — review with a solicitor before going live.

// Shared helpers ─────────────────────────────────────────────────────────────
function _contractCommonContext(tenantId){
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(!t) return null;
  var p = state.properties.find(function(x){return x.name===t.property;}) || {};
  var co = (state.companies||[])[0] || {};
  var propCoName = co.name || (state.config && (state.config.portfolioName || state.config.siteTitle)) || 'landlordapp.io';
  var propCoAddr = co.address || (p.address || '');
  var today = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  var sigImg   = (state.config && state.config.companySignature) || '';
  var sigName  = (state.config && state.config.companySignatoryName) || '';
  var sigTitle = (state.config && state.config.companySignatoryTitle) || '';
  return { t:t, p:p, co:co, propCoName:propCoName, propCoAddr:propCoAddr, today:today,
           sigImg:sigImg, sigName:sigName, sigTitle:sigTitle };
}

function _contractToolbar(title, tenantName){
  return '<div style="position:sticky;top:0;background:#0F0F1A;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:10;flex-wrap:wrap">'
    + '<span style="color:#fff;font-size:14px;font-weight:700">'+title+' — '+tenantName+'</span>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'+ contractToolbarActions()
    + '<button onclick="closeAgreement()" style="padding:8px 14px;border-radius:8px;border:1px solid #444;background:transparent;color:#fff;font-size:13px;cursor:pointer">✕ Close</button>'
    + '</div></div>';
}

function _licensorSignatureBlock(ctx, role){
  // role: 'LANDLORD' | 'LICENSOR' | 'COMPANY' etc. — used as block heading.
  role = role || 'LANDLORD';
  if(ctx.sigImg){
    return '<div>'
      + '<p style="font-weight:700;font-size:13px;margin-bottom:12px">'+role+'</p>'
      + '<p style="font-size:12px;color:#555;margin-bottom:4px">On behalf of: <strong>'+ctx.propCoName+'</strong></p>'
      + '<div style="border:none;border-bottom:1px solid #000;height:50px;margin:16px 0 6px;display:flex;align-items:flex-end"><img src="'+ctx.sigImg+'" style="max-height:48px;max-width:100%;object-fit:contain"></div>'
      + '<p style="font-size:11px;color:#777">'+ctx.sigName+(ctx.sigTitle?(' &middot; '+ctx.sigTitle):'')+'</p>'
      + '<div style="margin-top:16px;font-size:12px">Date: <strong>'+ctx.today+'</strong></div>'
      + '</div>';
  }
  return '<div>'
    + '<p style="font-weight:700;font-size:13px;margin-bottom:12px">'+role+'</p>'
    + '<p style="font-size:12px;color:#555;margin-bottom:4px">On behalf of: <strong>'+ctx.propCoName+'</strong></p>'
    + '<div style="border:none;border-bottom:1px solid #000;height:50px;margin:16px 0 6px"></div>'
    + '<p style="font-size:11px;color:#777">Authorised Signature</p>'
    + '<div style="margin-top:16px;font-size:12px">Date: ________________________________</div>'
    + '</div>';
}

// Tenant signature block — renders a real canvas (id derived from tenant id so
// multiple agreements in the DOM at once don't collide). Pre-fills with the saved
// t.signature if the tenant has already signed (e.g. via remote-sign flow).
function _tenantSignatureBlock(name, role, tenantId){
  role = role || 'TENANT';
  var t = state.tenants.find(function(x){ return String(x.id) === String(tenantId); });
  var saved = t && t.signature ? t.signature : '';
  var savedDate = '';
  try { if (t && t.signatureSavedAt) savedDate = new Date(t.signatureSavedAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}); } catch(_e){}
  var today = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  var canvasId = 'sig-tenant-canvas-' + (tenantId || 'x');
  return '<div>'
    + '<p style="font-weight:700;font-size:13px;margin-bottom:12px">'+role+'</p>'
    + '<p style="font-size:12px;color:#555;margin-bottom:4px">Full Name: <strong>'+name+'</strong></p>'
    + '<div data-sig-wrap="tenant" style="position:relative;border:1.5px solid #CCC;border-radius:6px;height:80px;margin:14px 0 6px;background:#fff;overflow:hidden">'
    +   '<canvas id="'+canvasId+'" data-tenant-id="'+(tenantId||'')+'" width="600" height="120" style="width:100%;height:100%;cursor:crosshair;touch-action:none;display:block"></canvas>'
    +   (saved
        ? '<img data-sig-preload="tenant" src="'+saved+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none">'
        : '<div data-sig-hint="tenant" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#AAA;font-size:11px;pointer-events:none;font-style:italic">Sign here with your finger or mouse</div>')
    + '</div>'
    + '<div class="no-print" style="display:flex;gap:6px;margin-bottom:8px">'
    +   '<button onclick="clearAgreementSig(\''+canvasId+'\')" type="button" style="font-size:11px;padding:5px 10px;border:1px solid #DDD;background:#fff;border-radius:5px;cursor:pointer;font-family:inherit">Clear</button>'
    +   '<button onclick="saveAgreementSig(\''+canvasId+'\')" type="button" style="font-size:11px;padding:5px 10px;border:1px solid var(--accent,#0F9D58);background:var(--accent-light,#E6F4EA);color:var(--accent-dark,#0B7B3F);border-radius:5px;cursor:pointer;font-family:inherit;font-weight:600">Save signature</button>'
    + '</div>'
    + '<p style="font-size:11px;color:#777">Signature</p>'
    + '<div style="margin-top:12px;font-size:12px">Date: <strong>' + (savedDate || today) + '</strong></div>'
    + '</div>';
}

function _renderContractPage(htmlBody, contractType, tenantId){
  var existing = document.getElementById('agreement-overlay');
  if(existing) existing.remove();
  var div = document.createElement('div');
  div.innerHTML = htmlBody;
  document.body.appendChild(div.firstChild);
  // Wire every tenant signature canvas in the new overlay (one per agreement).
  setTimeout(function(){
    var canvases = document.querySelectorAll('#agreement-overlay canvas[id^="sig-tenant-canvas"]');
    Array.prototype.forEach.call(canvases, function(c){
      if (typeof initAgreementSignature === 'function') initAgreementSignature(c.id);
    });
  }, 30);
}

function _factsTable(rows){
  var html = '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">';
  rows.forEach(function(r,i){
    html += '<tr style="background:'+(i%2?'#f9f9f9':'#fff')+'">'
      + '<td style="padding:9px 14px;border:1px solid #ddd;font-weight:700;width:38%">'+r[0]+'</td>'
      + '<td style="padding:9px 14px;border:1px solid #ddd">'+(r[1]||'—')+'</td></tr>';
  });
  return html + '</table>';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. COMPANY LET AGREEMENT
// For corporate tenants. Company is the legal tenant; named occupiers live there.
// Falls outside the Housing Act 1988 (no AST protection).
// ─────────────────────────────────────────────────────────────────────────────
function generateCompanyLet(tenantId){
  var ctx = _contractCommonContext(tenantId); if(!ctx) return;
  var t = ctx.t, p = ctx.p;
  var rent = t.rent || 0;
  var freq = t.freq || 'monthly';
  var roomDesc = (p.lettingType === 'whole') ? 'the whole property' : ('Room ' + (t.room||'?'));
  var propAddr = (p.address || p.name || '—');
  var startDate = t.startDate || t.moveIn || ctx.today;
  var endDate = t.endDate || '6 months from start';
  var deposit = t.deposit || 0;

  var S = [];
  S.push('<div id="agreement-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto">');
  S.push(_contractToolbar('Company Let Agreement', t.name));
  S.push('<div id="agreement-doc-body" data-contract-type="company_let" data-tenant-id="'+t.id+'" style="max-width:760px;margin:0 auto;padding:48px 36px;font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#111;background:#fff">');

  // Header
  S.push('<div style="text-align:center;margin-bottom:36px;padding-bottom:24px;border-bottom:3px double #000">');
  S.push('<div style="font-size:24px;font-weight:800;letter-spacing:-.5px;font-family:Arial,sans-serif;text-transform:uppercase">'+ctx.propCoName+'</div>');
  S.push('<div style="font-size:11px;color:#555;margin-top:4px">'+ctx.propCoAddr+' · Property Management</div>');
  S.push('<div style="margin-top:20px;font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Company Let Agreement</div>');
  S.push('<div style="font-size:11px;color:#666;margin-top:6px">A non-Housing-Act tenancy granted to a body corporate as tenant</div></div>');

  S.push('<p style="margin-bottom:18px">This Agreement is made on <strong>'+ctx.today+'</strong> between:</p>');
  S.push('<p style="margin-bottom:14px"><strong>(1) '+ctx.propCoName+'</strong> of '+ctx.propCoAddr+' (the "<strong>Landlord</strong>"); and</p>');
  S.push('<p style="margin-bottom:24px"><strong>(2) '+t.name+'</strong> (the "<strong>Tenant Company</strong>"), being a body corporate. The Tenant Company\'s named occupier(s) shall reside at the Property under this Agreement.</p>');

  S.push(_factsTable([
    ['Property',          roomDesc + ', ' + propAddr],
    ['Term',              startDate + ' to ' + endDate],
    ['Rent',              '£' + rent + ' per ' + (freq==='monthly'?'month':'week') + ', payable in advance'],
    ['Deposit',           '£' + deposit + ' held by the Landlord as security for the Tenant Company\'s obligations'],
    ['Permitted Use',     'Residential occupation by the Tenant Company\'s nominated employee(s) / contractor(s) only'],
    ['Notice to Quit',    'One (1) month\'s written notice from either party after the fixed term'],
  ]));

  function clause(num,title,body){
    S.push('<h2 style="font-size:14px;font-weight:700;margin:28px 0 10px;text-transform:uppercase;letter-spacing:.04em;color:#0F0F1A;border-bottom:1px solid #ddd;padding-bottom:5px">'+num+'. '+title+'</h2>');
    S.push('<div style="font-size:13px;line-height:1.7">'+body+'</div>');
  }

  clause(1,'Grant of tenancy',
    '<p>The Landlord grants and the Tenant Company accepts a tenancy of the Property for the Term on the terms set out in this Agreement. The parties acknowledge that, because the Tenant Company is a body corporate and not an individual occupying as their only or principal home, this tenancy is <strong>not an Assured Shorthold Tenancy</strong> within the meaning of the Housing Act 1988.</p>');

  clause(2,'Permitted occupiers',
    '<p>The Property may only be occupied by individuals nominated in writing by the Tenant Company to the Landlord (each a "Permitted Occupier"). The Tenant Company shall ensure each Permitted Occupier complies with the Tenant Company\'s obligations under this Agreement.</p>');

  clause(3,'Rent and deposit',
    '<p>Rent of <strong>£'+rent+'</strong> per '+(freq==='monthly'?'month':'week')+' is payable in advance by bank transfer to the account notified by the Landlord. Time is of the essence in respect of payment.</p>'+
    '<p>The Deposit will be held by the Landlord. As this is a non-Housing-Act tenancy, the Tenancy Deposit Schemes do not apply; however, the Landlord will return the Deposit (less any agreed deductions for unpaid rent, dilapidations, or unpaid utility bills) within 14 days of the end of the tenancy.</p>');

  clause(4,'Tenant Company obligations',
    '<ul style="margin-left:20px;line-height:1.8">'+
    '<li>To pay the Rent on time without deduction, set-off, or counterclaim.</li>'+
    '<li>To use the Property only for residential occupation by the Permitted Occupiers.</li>'+
    '<li>To keep the Property in good repair (fair wear and tear excepted).</li>'+
    '<li>To not assign, sublet, or part with possession of the Property without the Landlord\'s prior written consent.</li>'+
    '<li>To insure the Tenant Company\'s contents and personal effects (the Landlord insures the structure).</li>'+
    '<li>To pay all utilities, council tax, broadband, and TV licence in respect of the Property unless explicitly stated otherwise above.</li>'+
    '<li>To allow the Landlord access on 24 hours\' notice for inspection, repair, or viewings.</li>'+
    '</ul>');

  clause(5,'Landlord obligations',
    '<ul style="margin-left:20px;line-height:1.8">'+
    '<li>To keep the structure and exterior of the Property in repair (Landlord and Tenant Act 1985 s.11).</li>'+
    '<li>To maintain installations for water, gas, electricity, sanitation, space and water heating.</li>'+
    '<li>To carry out an annual gas safety check and provide a copy to the Tenant Company.</li>'+
    '<li>To ensure the Property has a valid EPC and (where required) HMO licence.</li>'+
    '</ul>');

  clause(6,'Termination',
    '<p>After the fixed term, this Agreement continues on the same terms as a contractual periodic tenancy until terminated by either party giving at least <strong>one month\'s written notice</strong> ending on a rent payment date.</p>'+
    '<p>The Landlord may terminate immediately for material breach (including non-payment of rent for more than 14 days, or unlawful use of the Property). As this is a common-law tenancy, possession is recovered through the High Court / county court without the need for a Section 21 Notice.</p>');

  clause(7,'Governing law',
    '<p>This Agreement is governed by the laws of England and Wales and the parties submit to the exclusive jurisdiction of the courts of England and Wales.</p>');

  // Execution
  S.push('<div style="margin-top:48px;page-break-inside:avoid">');
  S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin-bottom:24px">EXECUTION</h2>');
  S.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">');
  S.push(_tenantSignatureBlock(t.name,'TENANT COMPANY (signed by an authorised director)',t.id));
  S.push(_licensorSignatureBlock(ctx,'LANDLORD'));
  S.push('</div></div>');

  S.push('<div style="margin-top:40px;padding-top:16px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#999">'+ctx.propCoName+' · Company Let Agreement · Prepared '+ctx.today+' · Common-law tenancy outside the Housing Act 1988</div>');

  S.push('</div></div>');
  _renderContractPage(S.join(''), 'company_let', t.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LODGER AGREEMENT (resident landlord)
// Licence to occupy a room with shared facilities while the landlord lives on
// the premises. Excluded from Protection from Eviction Act 1977.
// ─────────────────────────────────────────────────────────────────────────────
function generateLodgerAgreement(tenantId){
  var ctx = _contractCommonContext(tenantId); if(!ctx) return;
  var t = ctx.t, p = ctx.p;
  var rent = t.rent || 0;
  var freq = t.freq || 'weekly';
  var roomDesc = 'Room ' + (t.room||'?');
  var propAddr = (p.address || p.name || '—');
  var startDate = t.startDate || t.moveIn || ctx.today;
  var deposit = t.deposit || 0;

  var S = [];
  S.push('<div id="agreement-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto">');
  S.push(_contractToolbar('Lodger Agreement', t.name));
  S.push('<div id="agreement-doc-body" data-contract-type="lodger" data-tenant-id="'+t.id+'" style="max-width:760px;margin:0 auto;padding:48px 36px;font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#111;background:#fff">');

  S.push('<div style="text-align:center;margin-bottom:36px;padding-bottom:24px;border-bottom:3px double #000">');
  S.push('<div style="font-size:24px;font-weight:800;text-transform:uppercase;font-family:Arial,sans-serif">'+ctx.propCoName+'</div>');
  S.push('<div style="font-size:11px;color:#555;margin-top:4px">'+ctx.propCoAddr+'</div>');
  S.push('<div style="margin-top:20px;font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Lodger Agreement</div>');
  S.push('<div style="font-size:11px;color:#666;margin-top:6px">A licence to occupy with a resident landlord</div></div>');

  S.push('<p style="margin-bottom:18px">This Lodger Agreement is made on <strong>'+ctx.today+'</strong> between:</p>');
  S.push('<p style="margin-bottom:14px"><strong>(1) '+ctx.propCoName+'</strong> of '+ctx.propCoAddr+' (the "<strong>Householder</strong>"), being the resident landlord of the Property; and</p>');
  S.push('<p style="margin-bottom:24px"><strong>(2) '+t.name+'</strong> (the "<strong>Lodger</strong>").</p>');

  S.push(_factsTable([
    ['Property',          propAddr],
    ['Lodger\'s room',    roomDesc],
    ['Shared facilities', 'Kitchen, bathroom, living areas (as currently used by the Householder)'],
    ['Start date',        startDate],
    ['Rent',              '£' + rent + ' per ' + (freq==='monthly'?'month':'week') + ', payable in advance'],
    ['Deposit',           deposit ? '£'+deposit+' (returned at end of stay, less any deductions)' : 'No deposit'],
    ['Notice',            'One (1) week\'s written notice from either side, ending on a rent payment date'],
    ['Includes',          'All bills (gas, electric, water, broadband, council tax) unless stated otherwise'],
  ]));

  function clause(num,title,body){
    S.push('<h2 style="font-size:14px;font-weight:700;margin:28px 0 10px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:5px">'+num+'. '+title+'</h2>');
    S.push('<div style="font-size:13px;line-height:1.7">'+body+'</div>');
  }

  clause(1,'Nature of this agreement',
    '<p>The Lodger occupies the Property as a <strong>licensee, not a tenant</strong>. The Householder retains exclusive possession of the Property and shares the kitchen and other living areas with the Lodger. As the Householder is resident at the Property, the Lodger is an <strong>excluded occupier</strong> under section 3A of the Protection from Eviction Act 1977 — a court order is not required to recover possession.</p>');

  clause(2,'Rent and deposit',
    '<p>The Lodger shall pay <strong>£'+rent+'</strong> per '+(freq==='monthly'?'month':'week')+' in advance. Rent is payable by bank transfer or cash receipted by the Householder.</p>'+
    (deposit ? '<p>A deposit of <strong>£'+deposit+'</strong> is held by the Householder. Because this is a licence (not a tenancy), the Tenancy Deposit Schemes do not apply. The deposit will be returned within 7 days of the Lodger vacating, less any reasonable deductions for unpaid rent or damage beyond fair wear and tear.</p>' : ''));

  clause(3,'Lodger obligations',
    '<ul style="margin-left:20px;line-height:1.8">'+
    '<li>Pay the Rent on time without deduction.</li>'+
    '<li>Keep the room and shared facilities clean and tidy.</li>'+
    '<li>Not cause nuisance to the Householder or neighbours.</li>'+
    '<li>Not smoke or vape inside the Property.</li>'+
    '<li>Not bring pets without the Householder\'s written consent.</li>'+
    '<li>Not have overnight guests without the Householder\'s written consent.</li>'+
    '<li>Not assign or part with this licence; it is personal to the Lodger.</li>'+
    '<li>Respect quiet hours between 11pm and 7am.</li>'+
    '</ul>');

  clause(4,'Householder obligations',
    '<ul style="margin-left:20px;line-height:1.8">'+
    '<li>Keep the Property safe and in good repair.</li>'+
    '<li>Hold a valid annual gas safety certificate (provided to the Lodger on request).</li>'+
    '<li>Provide reasonable use of shared kitchen, bathroom, and living areas.</li>'+
    '<li>Pay all utilities and council tax included in the Rent above.</li>'+
    '</ul>');

  clause(5,'Termination',
    '<p>Either party may end this agreement by giving the other <strong>one (1) week\'s written notice</strong> ending on a rent payment date. On expiry, the Lodger will vacate the Property, leaving the room clean and undamaged, and return all keys.</p>'+
    '<p>The Householder may terminate this agreement immediately for serious breach (non-payment of rent for more than 7 days, theft, violence, or material damage).</p>');

  clause(6,'Governing law',
    '<p>This agreement is governed by the laws of England and Wales.</p>');

  // Execution
  S.push('<div style="margin-top:48px;page-break-inside:avoid">');
  S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin-bottom:24px">SIGNED</h2>');
  S.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">');
  S.push(_tenantSignatureBlock(t.name,'LODGER',t.id));
  S.push(_licensorSignatureBlock(ctx,'HOUSEHOLDER'));
  S.push('</div></div>');

  S.push('<div style="margin-top:40px;padding-top:16px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#999">'+ctx.propCoName+' · Lodger Agreement · Prepared '+ctx.today+' · Excluded occupier — Protection from Eviction Act 1977 s.3A</div>');

  S.push('</div></div>');
  _renderContractPage(S.join(''), 'lodger', t.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ROOM LETTING AGREEMENT (HMO single-room AST)
// AST for a single room in a licensed HMO with shared kitchen / bathroom.
// ─────────────────────────────────────────────────────────────────────────────
function generateRoomLettingAgreement(tenantId){
  var ctx = _contractCommonContext(tenantId); if(!ctx) return;
  var t = ctx.t, p = ctx.p;
  var rent = t.rent || 0;
  var freq = t.freq || 'weekly';
  var roomDesc = 'Room ' + (t.room||'?');
  var propAddr = (p.address || p.name || '—');
  var startDate = t.startDate || t.moveIn || ctx.today;
  var endDate = t.endDate || '6 months from start';
  var deposit = t.deposit || 0;
  var depScheme = t.depositScheme || 'an authorised tenancy deposit scheme';

  var S = [];
  S.push('<div id="agreement-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto">');
  S.push(_contractToolbar('Room Letting Agreement', t.name));
  S.push('<div id="agreement-doc-body" data-contract-type="room_letting" data-tenant-id="'+t.id+'" style="max-width:760px;margin:0 auto;padding:48px 36px;font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#111;background:#fff">');

  S.push('<div style="text-align:center;margin-bottom:36px;padding-bottom:24px;border-bottom:3px double #000">');
  S.push('<div style="font-size:24px;font-weight:800;text-transform:uppercase;font-family:Arial,sans-serif">'+ctx.propCoName+'</div>');
  S.push('<div style="font-size:11px;color:#555;margin-top:4px">'+ctx.propCoAddr+'</div>');
  S.push('<div style="margin-top:20px;font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Room Letting Agreement</div>');
  S.push('<div style="font-size:11px;color:#666;margin-top:6px">Assured Shorthold Tenancy of a single room in a House in Multiple Occupation</div></div>');

  S.push('<p style="margin-bottom:18px">This AST Room Letting Agreement is made on <strong>'+ctx.today+'</strong> between:</p>');
  S.push('<p style="margin-bottom:14px"><strong>(1) '+ctx.propCoName+'</strong> of '+ctx.propCoAddr+' (the "<strong>Landlord</strong>"); and</p>');
  S.push('<p style="margin-bottom:24px"><strong>(2) '+t.name+'</strong> (the "<strong>Tenant</strong>").</p>');

  S.push(_factsTable([
    ['Property (HMO)',    propAddr],
    ['Room let',          roomDesc + ' — exclusive possession of this room only'],
    ['Shared facilities', 'Kitchen, bathroom(s), and any other communal areas with other tenants of the HMO'],
    ['Term',              startDate + ' to ' + endDate],
    ['Rent',              '£' + rent + ' per ' + (freq==='monthly'?'month':'week') + ', payable in advance'],
    ['Deposit',           deposit ? '£'+deposit+' protected in '+depScheme+' within 30 days' : 'No deposit'],
    ['HMO licence',       (p.hmoLicence || 'Held by the Landlord and available on request')],
    ['Notice',            'After the fixed term: at least one (1) month\'s written notice'],
  ]));

  function clause(num,title,body){
    S.push('<h2 style="font-size:14px;font-weight:700;margin:28px 0 10px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:5px">'+num+'. '+title+'</h2>');
    S.push('<div style="font-size:13px;line-height:1.7">'+body+'</div>');
  }

  clause(1,'Grant of tenancy',
    '<p>The Landlord lets and the Tenant takes <strong>exclusive possession of '+roomDesc+'</strong> at the Property for the Term, together with the right (in common with other tenants of the HMO) to use the shared kitchen, bathroom, and communal areas. This is an Assured Shorthold Tenancy under the Housing Act 1988 (as amended).</p>');

  clause(2,'Rent',
    '<p>Rent of <strong>£'+rent+'</strong> per '+(freq==='monthly'?'month':'week')+' is payable in advance by bank transfer. Late rent received more than 3 days after the due date may attract a fee of £25 (Tenant Fees Act 2019 compliant). All bills (gas, electric, water, council tax, broadband) are included unless stated otherwise.</p>');

  clause(3,'Deposit',
    deposit
      ? '<p>The Deposit of <strong>£'+deposit+'</strong> will be protected in '+depScheme+' within 30 days, and prescribed information served on the Tenant. It will be returned, less any agreed deductions, within 10 days of the Tenant vacating and the parties agreeing the deductions.</p>'
      : '<p>No deposit is taken under this Agreement.</p>');

  clause(4,'Tenant\'s obligations',
    '<ul style="margin-left:20px;line-height:1.8">'+
    '<li>Use the room only as a private residence for the named Tenant.</li>'+
    '<li>Keep the room and shared facilities clean and tidy.</li>'+
    '<li>Not smoke, vape, or use illegal drugs in the Property.</li>'+
    '<li>Not have overnight guests for more than 2 nights per month without the Landlord\'s consent.</li>'+
    '<li>Not assign or sublet the room.</li>'+
    '<li>Not keep pets without written consent.</li>'+
    '<li>Comply with the Landlord\'s house rules, the HMO licence conditions, and any management plan in place.</li>'+
    '<li>Allow the Landlord access on 24 hours\' written notice (immediate access in emergency).</li>'+
    '<li>Pay any unpaid utilities or council tax that fall outside the inclusive items above.</li>'+
    '</ul>');

  clause(5,'Landlord\'s obligations',
    '<ul style="margin-left:20px;line-height:1.8">'+
    '<li>Maintain the HMO licence (where required) and comply with all licence conditions.</li>'+
    '<li>Keep the structure, fixtures, and shared facilities in good repair (Landlord and Tenant Act 1985 s.11).</li>'+
    '<li>Provide an annual gas safety certificate, an EICR every 5 years, and working smoke / CO alarms on every storey.</li>'+
    '<li>Insure the Property structure (Tenant insures their own contents).</li>'+
    '</ul>');

  clause(6,'Termination',
    '<p>After the fixed term this tenancy continues as a contractual periodic tenancy until terminated. Either party may terminate by giving at least <strong>one month\'s written notice</strong>. The Landlord must serve a valid Section 21 Notice before commencing possession proceedings.</p>'+
    '<p>The Landlord may seek possession on Section 8 grounds (non-payment, antisocial behaviour, etc.) at any time.</p>');

  clause(7,'How to Rent guide',
    '<p>The Tenant acknowledges receipt of the current "How to Rent" booklet, EPC, gas safety certificate, and (where applicable) the deposit prescribed information. The Tenant has had the opportunity to read this Agreement and ask questions before signing.</p>');

  // Execution
  S.push('<div style="margin-top:48px;page-break-inside:avoid">');
  S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin-bottom:24px">EXECUTION</h2>');
  S.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">');
  S.push(_tenantSignatureBlock(t.name,'TENANT',t.id));
  S.push(_licensorSignatureBlock(ctx,'LANDLORD / AGENT'));
  S.push('</div></div>');

  S.push('<div style="margin-top:40px;padding-top:16px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#999">'+ctx.propCoName+' · Room Letting Agreement (HMO AST) · Prepared '+ctx.today+' · Housing Act 1988</div>');

  S.push('</div></div>');
  _renderContractPage(S.join(''), 'room_letting', t.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TENANCY RENEWAL
// Extends an existing tenant. Pushes the previous term into t.previousTenancies
// (preserving payment history, which is keyed by tenant_id and stays attached),
// then updates the live tenant row with new dates / rent.
// ─────────────────────────────────────────────────────────────────────────────
function openTenancyRenewalModal(tenantId){
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(!t){ showToast && showToast('Tenant not found','error'); return; }
  var oldStart = t.startDate || t.moveIn || '';
  var oldEnd   = t.endDate || '';
  var today    = new Date().toISOString().split('T')[0];
  var defaultNewStart = oldEnd && oldEnd > today ? oldEnd : today;
  var defaultNewEnd   = (function(){
    var d = new Date(defaultNewStart); d.setMonth(d.getMonth()+12);
    return d.toISOString().split('T')[0];
  })();
  var html = ''
    + '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:480px">'
    + '<div class="modal-header"><span class="modal-title">🔁 Renew Tenancy — '+t.name+'</span>'
    + '<button class="modal-close" onclick="closeModal()">×</button></div>'
    + '<div class="modal-body">'
    + '<p style="font-size:12px;color:var(--gray-500);margin:0 0 14px;line-height:1.5">Extending an existing tenancy. The previous term will be archived in the tenant\'s history; payments and arrears stay attached. New dates and rent take effect from the start of the renewal.</p>'
    + '<div style="background:var(--gray-50);border-radius:8px;padding:10px 12px;font-size:11px;color:var(--gray-700);margin-bottom:14px"><strong>Current term:</strong> '+(oldStart||'—')+' → '+(oldEnd||'open-ended')+' &middot; £'+(t.rent||0)+' / '+(t.freq==='monthly'?'mo':'wk')+'</div>'
    + '<div class="field"><label class="field-label">New start date</label><input class="inp" id="renew-start" type="date" value="'+defaultNewStart+'"></div>'
    + '<div class="field"><label class="field-label">New end date</label><input class="inp" id="renew-end" type="date" value="'+defaultNewEnd+'"></div>'
    + '<div class="field"><label class="field-label">Rent (£)</label><input class="inp" id="renew-rent" type="number" min="0" value="'+(t.rent||0)+'"></div>'
    + '<div class="field"><label class="field-label">Frequency</label>'
    +   '<select class="inp" id="renew-freq">'
    +     '<option value="weekly" '+(t.freq==='weekly'?'selected':'')+'>Weekly</option>'
    +     '<option value="monthly" '+(t.freq==='monthly'?'selected':'')+'>Monthly</option>'
    +   '</select></div>'
    + '<div class="field"><label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="renew-genpdf" checked> Generate renewal agreement PDF after saving</label></div>'
    + '</div>'
    + '<div class="modal-footer">'
    +   '<button onclick="closeModal()" class="btn btn-secondary">Cancel</button>'
    +   '<button onclick="confirmTenancyRenewal(\''+t.id+'\')" class="btn btn-primary">Save renewal</button>'
    + '</div></div></div>';
  var holder = document.getElementById('modal-container');
  if (holder) holder.innerHTML = html;
}

function confirmTenancyRenewal(tenantId){
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(!t){ showToast && showToast('Tenant not found','error'); return; }
  var newStart = (document.getElementById('renew-start')||{}).value;
  var newEnd   = (document.getElementById('renew-end')||{}).value;
  var newRent  = parseFloat((document.getElementById('renew-rent')||{}).value)||0;
  var newFreq  = (document.getElementById('renew-freq')||{}).value || t.freq || 'weekly';
  var doPdf    = !!(document.getElementById('renew-genpdf')||{}).checked;
  if(!newStart){ showToast && showToast('New start date required','error'); return; }
  // Archive previous term in history (matches the convention saveTenantDetail uses on move-out).
  if(!t.previousTenancies) t.previousTenancies = [];
  t.previousTenancies.push({
    property: t.property,
    room: t.room,
    moveIn: t.startDate || t.moveIn || null,
    moveOut: newStart, // previous term ends the day the renewal starts
    rent: t.rent,
    freq: t.freq,
    archivedAt: new Date().toISOString(),
    reason: 'renewal'
  });
  // Apply renewal in place — payment history is keyed by tenant_id and stays linked.
  t.startDate = newStart;
  t.moveIn    = newStart;
  t.endDate   = newEnd || null;
  t.rent      = newRent;
  t.freq      = newFreq;
  if (typeof rebuildTenantSchedule === 'function') rebuildTenantSchedule(t.id);
  if (typeof saveStateImmediate === 'function') saveStateImmediate({silentSuccess:true});
  closeModal();
  showToast && showToast('Tenancy renewed ✓','success');
  if (doPdf) {
    setTimeout(function(){ generateTenancyRenewal(t.id); }, 200);
  } else {
    render();
  }
}

function generateTenancyRenewal(tenantId){
  var ctx = _contractCommonContext(tenantId); if(!ctx) return;
  var t = ctx.t, p = ctx.p;
  var prev = (t.previousTenancies || []).slice(-1)[0] || {};
  var roomDesc = (p.lettingType === 'whole') ? 'the whole property' : ('Room ' + (t.room||'?'));
  var propAddr = (p.address || p.name || '—');

  var S = [];
  S.push('<div id="agreement-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto">');
  S.push(_contractToolbar('Tenancy Renewal', t.name));
  S.push('<div id="agreement-doc-body" data-contract-type="renewal" data-tenant-id="'+t.id+'" style="max-width:760px;margin:0 auto;padding:48px 36px;font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#111;background:#fff">');

  S.push('<div style="text-align:center;margin-bottom:36px;padding-bottom:24px;border-bottom:3px double #000">');
  S.push('<div style="font-size:24px;font-weight:800;text-transform:uppercase;font-family:Arial,sans-serif">'+ctx.propCoName+'</div>');
  S.push('<div style="font-size:11px;color:#555;margin-top:4px">'+ctx.propCoAddr+'</div>');
  S.push('<div style="margin-top:20px;font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Tenancy Renewal Agreement</div>');
  S.push('<div style="font-size:11px;color:#666;margin-top:6px">An extension of the existing tenancy on amended terms</div></div>');

  S.push('<p style="margin-bottom:18px">This Renewal Agreement is made on <strong>'+ctx.today+'</strong> between <strong>'+ctx.propCoName+'</strong> (the "Landlord") and <strong>'+t.name+'</strong> (the "Tenant"), in respect of the tenancy of '+roomDesc+', '+propAddr+'.</p>');

  S.push('<h2 style="font-size:14px;font-weight:700;margin:24px 0 10px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:5px">Previous term</h2>');
  S.push(_factsTable([
    ['Started',  prev.moveIn || '—'],
    ['Ended',    prev.moveOut || '—'],
    ['Rent',     prev.rent != null ? '£'+prev.rent+' / '+((prev.freq||'weekly')==='monthly'?'mo':'wk') : '—'],
  ]));

  S.push('<h2 style="font-size:14px;font-weight:700;margin:24px 0 10px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:5px">Renewed term</h2>');
  S.push(_factsTable([
    ['New start date', t.startDate || '—'],
    ['New end date',   t.endDate || 'open-ended'],
    ['Rent',           '£' + (t.rent||0) + ' / ' + ((t.freq||'weekly')==='monthly'?'mo':'wk')],
    ['Property',       roomDesc + ', ' + propAddr],
    ['Other terms',    'All other terms of the original tenancy agreement remain unchanged'],
  ]));

  S.push('<h2 style="font-size:14px;font-weight:700;margin:24px 0 10px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:5px">Confirmation</h2>');
  S.push('<p style="font-size:13px;line-height:1.7">By signing below, both parties confirm that the original tenancy is renewed on the terms above, with all other clauses of the original tenancy agreement (including obligations, deposit treatment, and notice periods) carrying through unchanged. Payment history, deposits, and any outstanding arrears from the previous term remain valid and attached to this Tenant.</p>');

  // Execution
  S.push('<div style="margin-top:40px;page-break-inside:avoid">');
  S.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">');
  S.push(_tenantSignatureBlock(t.name,'TENANT',t.id));
  S.push(_licensorSignatureBlock(ctx,'LANDLORD / AGENT'));
  S.push('</div></div>');

  S.push('<div style="margin-top:40px;padding-top:16px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#999">'+ctx.propCoName+' · Tenancy Renewal · Prepared '+ctx.today+'</div>');

  S.push('</div></div>');
  _renderContractPage(S.join(''), 'renewal', t.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONTRACT PICKER
// Single entry-point opened from the tenant detail view.
// ─────────────────────────────────────────────────────────────────────────────
function openContractPicker(tenantId){
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(!t){ showToast && showToast('Tenant not found','error'); return; }
  var has = !!(t.previousTenancies && t.previousTenancies.length) || !!(t.startDate || t.moveIn);
  var options = [
    { v:'ast',              icon:'📄', title:'AST — Assured Shorthold Tenancy', sub:'Standard 6 / 12 month tenancy under the Housing Act 1988', fn:'generateAgreement' },
    { v:'room_letting',     icon:'🛏️', title:'Room Letting (HMO AST)',          sub:'Single room in a licensed HMO with shared kitchen / bathroom', fn:'generateRoomLettingAgreement' },
    { v:'company_let',      icon:'🏢', title:'Company Let',                     sub:'Tenant is a body corporate — outside the Housing Act', fn:'generateCompanyLet' },
    { v:'lodger',           icon:'🏡', title:'Lodger Agreement',                sub:'Resident-landlord licence — excluded occupier', fn:'generateLodgerAgreement' },
    { v:'excluded_licence', icon:'📋', title:'Excluded Licence',                sub:'Standard company document · 1 week notice · canvas signature', fn:'generateExcludedLicence' },
  ];
  if (has) {
    options.push({ v:'renewal', icon:'🔁', title:'Renew Tenancy', sub:'Extend the existing tenancy on new dates / rent', fn:'openTenancyRenewalModal' });
  }
  var html = ''
    + '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:520px">'
    + '<div class="modal-header"><span class="modal-title">📄 Generate Agreement — '+t.name+'</span>'
    + '<button class="modal-close" onclick="closeModal()">×</button></div>'
    + '<div class="modal-body">'
    + '<p style="font-size:12px;color:var(--gray-500);margin:0 0 14px;line-height:1.5">Pick the contract type. Your Authorised Signatory (Settings → Branding) signs every agreement automatically with today\'s date. Once you open the agreement you can send it to the tenant for remote signing from the toolbar.</p>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + options.map(function(o){
        return '<button onclick="closeModal();' + o.fn + '(\''+t.id+'\')" '
          + 'style="display:flex;align-items:center;gap:12px;padding:14px;background:#fff;border:1.5px solid var(--gray-200);border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;width:100%;transition:border-color .15s"'
          + ' onmouseover="this.style.borderColor=\'var(--teal-500)\'" onmouseout="this.style.borderColor=\'var(--gray-200)\'">'
          + '<span style="font-size:22px;flex-shrink:0">'+o.icon+'</span>'
          + '<div style="flex:1;min-width:0">'
          +   '<div style="font-size:13px;font-weight:700;color:var(--gray-900)">'+o.title+'</div>'
          +   '<div style="font-size:11px;color:var(--gray-500);margin-top:2px">'+o.sub+'</div>'
          + '</div>'
          + '<span style="color:var(--gray-300);font-size:18px">›</span>'
          + '</button>';
      }).join('')
    + '</div>'
    + '<div style="margin-top:14px;padding:10px 12px;background:var(--amber-50);border:1px solid var(--amber-100);border-radius:8px;font-size:11px;color:var(--amber-700);line-height:1.4">⚠ Templates are generic UK boilerplate. Have your solicitor review the wording before relying on any of them in a real tenancy.</div>'
    + '</div>'
    + '<div class="modal-footer"><button onclick="closeModal()" class="btn btn-secondary">Cancel</button></div>'
    + '</div></div>';
  var holder = document.getElementById('modal-container');
  if (holder) holder.innerHTML = html;
}
