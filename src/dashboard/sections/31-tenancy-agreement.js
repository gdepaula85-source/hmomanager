// ── TENANCY AGREEMENT ──────────────────────────────────────────────────────────
function generateAgreement(tenantId) {
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(!t) return;
  var p    = state.properties.find(function(x){return x.name===t.property;});
  var room = p&&p.roomList ? p.roomList.find(function(r){return r.n===t.room;}) : null;
  var ll   = state.landlords.find(function(x){return x.name===p.landlordName;}) || {};
  var co   = (state.companies&&state.companies[0]) || {};

  var today  = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  var moveIn = t.startDate ? new Date(t.startDate).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}) : (t.moveIn||'—');
  // 6-month initial fixed term end date
  var fixedEnd = '';
  try {
    var fd = new Date(t.startDate||t.moveIn||Date.now());
    fd.setMonth(fd.getMonth()+6);
    fixedEnd = fd.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  } catch(e){}

  var propAddr   = p ? (p.address||p.name) : t.property;
  var deposit    = t.deposit || t.rent*2;
  var depScheme  = t.depositScheme || 'DPS';
  var depRef     = t.depositRef || '(to be confirmed within 30 days)';
  var rentAmt    = '£'+t.rent+' per '+(t.freq==='weekly'?'week':'month');
  var payDay     = t.freq==='monthly' ? ('the '+(t.payDayOfMonth||1)+(t.payDayOfMonth===1?'st':t.payDayOfMonth===2?'nd':t.payDayOfMonth===3?'rd':'th')+' day of each month') : ('every '+(t.payDay||'Monday'));
  var payMethod  = t.method==='bank'?'Bank Transfer (BACS)':'Cash';
  var roomDesc   = 'Room '+t.room+(room?' ('+room.type+')':'');
  var propCoName = co.name || (state.config && (state.config.portfolioName || state.config.siteTitle)) || 'landlordapp.io';
  var propCoAddr = co.address || (p.address || '(Company address — set in Settings → Companies)');

  var S = [];

  // ── Overlay wrapper ───────────────────────────────────────────────────────
  S.push('<div id="agreement-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto">');

  // Sticky toolbar
  S.push('<div style="position:sticky;top:0;background:#0F0F1A;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:10;print-color-adjust:exact">');
  S.push('<span style="color:#fff;font-size:14px;font-weight:700">AST Agreement — '+t.name+'</span>');
  S.push('<div style="display:flex;gap:8px">');
  S.push(contractToolbarActions());
  S.push('<button onclick="closeAgreement()" style="padding:8px 14px;border-radius:8px;border:1px solid #444;background:transparent;color:#fff;font-size:13px;cursor:pointer">✕ Close</button>');
  S.push('</div></div>');

  // ── Document body ─────────────────────────────────────────────────────────
  S.push('<div id="agreement-doc-body" data-contract-type="ast" data-tenant-id="'+t.id+'" style="max-width:760px;margin:0 auto;padding:48px 36px;font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#111;background:#fff">');

  // Company letterhead
  S.push('<div style="text-align:center;margin-bottom:36px;padding-bottom:24px;border-bottom:3px double #000">');
  S.push('<div style="font-size:24px;font-weight:800;letter-spacing:-.5px;font-family:Arial,sans-serif;text-transform:uppercase">'+propCoName+'</div>');
  S.push('<div style="font-size:11px;color:#555;margin-top:4px">'+propCoAddr+' · Property Management</div>');
  S.push('<div style="margin-top:20px;font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:2px">Assured Shorthold Tenancy Agreement</div>');
  S.push('<div style="font-size:11px;color:#777;margin-top:6px">Pursuant to the Housing Act 1988 as amended by the Housing Act 1996</div>');
  S.push('<div style="font-size:11px;color:#777;margin-top:2px">Agreement date: <strong>'+today+'</strong></div>');
  S.push('</div>');

  // Parties
  S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin:24px 0 10px">THE PARTIES</h2>');
  S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:4px;padding:14px 18px;margin-bottom:20px">');
  S.push('<div style="display:grid;grid-template-columns:180px 1fr;gap:0">');
  var parties=[
    ['Landlord / Licensor', propCoName+' (the "Landlord")'],
    ['Landlord Address', propCoAddr],
    ['Tenant', t.name+' (the "Tenant")'],
    ['Tenant Email', t.email||'—'],
    ['Tenant Phone', t.whatsapp||'—'],
  ];
  parties.forEach(function(r){
    S.push('<div style="padding:5px 0;border-bottom:1px solid #E8EBF0;font-weight:700;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em">'+r[0]+'</div>');
    S.push('<div style="padding:5px 0;border-bottom:1px solid #E8EBF0;font-size:13px">'+r[1]+'</div>');
  });
  S.push('</div></div>');

  // Key terms
  S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin:24px 0 10px">KEY TERMS</h2>');
  S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:4px;padding:14px 18px;margin-bottom:24px">');
  S.push('<div style="display:grid;grid-template-columns:180px 1fr;gap:0">');
  var terms=[
    ['Property', propAddr],
    ['Room', roomDesc],
    ['Tenancy Type', 'Assured Shorthold Tenancy'],
    ['Start Date', moveIn],
    ['Initial Fixed Term', '6 months (to '+fixedEnd+')'],
    ['After Fixed Term', 'Periodic monthly tenancy (1 month notice each side)'],
    ['Weekly Rent', '£'+t.rent+' per week'],
    ['Monthly Equivalent', '£'+Math.round(t.rent*52/12)+' per month'],
    ['Rent Frequency', t.freq==='weekly'?'Weekly':'Monthly'],
    ['Payment Due', payDay],
    ['Payment Method', payMethod],
    ['Deposit', '£'+deposit],
    ['Deposit Scheme', depScheme],
    ['Deposit Reference', depRef],
  ];
  terms.forEach(function(r){
    S.push('<div style="padding:5px 0;border-bottom:1px solid #E8EBF0;font-weight:700;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em">'+r[0]+'</div>');
    S.push('<div style="padding:5px 0;border-bottom:1px solid #E8EBF0;font-size:13px">'+r[1]+'</div>');
  });
  S.push('</div></div>');

  // Important notice
  S.push('<div style="background:#EFF6FF;border:2px solid #3B82F6;border-radius:4px;padding:14px 18px;margin-bottom:24px">');
  S.push('<div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#1D4ED8">ℹ PRESCRIBED INFORMATION — HOUSING ACT 1988</div>');
  S.push('<div style="font-size:12px;line-height:1.6;color:#1e3a5f">');
  S.push('This is an <strong>Assured Shorthold Tenancy (AST)</strong> under sections 19A and 20 of the Housing Act 1988 as amended. ');
  S.push('The Tenant has full statutory rights including the right to a section 21 notice before possession can be sought after the fixed term. ');
  S.push('The deposit will be protected in a government-approved scheme within 30 days of receipt. ');
  S.push('The Tenant is entitled to receive Prescribed Information about the deposit scheme within that period.');
  S.push('</div></div>');

  // Clauses
  var clauses = [
    ['1. DEMISE',
      '<p>The Landlord lets and the Tenant takes the property known as <strong>'+roomDesc+', '+propAddr+'</strong> (the "Property") for use as a private residential dwelling for the period described above.</p>'+
      '<p>The Tenant shall have exclusive use of the room and shared use of communal facilities including kitchen, bathrooms, and living areas (if any).</p>'],

    ['2. TERM AND CONTINUATION',
      '<p>The tenancy is granted for an <strong>initial fixed term of 6 months</strong> commencing <strong>'+moveIn+'</strong> and expiring <strong>'+fixedEnd+'</strong>.</p>'+
      '<p>After the fixed term, if neither party serves notice, the tenancy shall continue as a <strong>statutory periodic tenancy</strong> on a monthly basis under section 5 of the Housing Act 1988.</p>'+
      '<p>During the periodic tenancy, either party may terminate by giving at least <strong>one month\'s written notice</strong> expiring on a rent payment date. The Landlord must serve a valid Section 21 Notice before commencing possession proceedings.</p>'],

    ['3. RENT',
      '<p>The Tenant agrees to pay rent of <strong>'+rentAmt+'</strong>, payable in advance <strong>'+payDay+'</strong> by <strong>'+payMethod+'</strong>.</p>'+
      '<p>Rent is due on time without deduction, set-off, or counterclaim. The Landlord reserves the right to charge a late payment fee of £25 for rent received more than 3 days after the due date.</p>'+
      '<p>The Landlord may review and increase the rent after the fixed term by serving a <strong>Section 13 Notice</strong> (Form 4) giving at least one month\'s notice. The Tenant has the right to refer any rent increase to the First-tier Tribunal (Property Chamber).</p>'],

    ['4. DEPOSIT',
      '<p>A deposit of <strong>£'+deposit+'</strong> is payable before or upon commencement of the tenancy. The Landlord will protect this deposit in the <strong>'+depScheme+'</strong> scheme within 30 days.</p>'+
      '<p>The Prescribed Information regarding the deposit scheme will be provided to the Tenant within 30 days of receipt of the deposit.</p>'+
      '<p>The deposit may be used to cover: unpaid rent; damage beyond fair wear and tear; missing items from the inventory; costs of cleaning if the property is not left in an equivalent state of cleanliness.</p>'+
      '<p>The deposit will be returned, less any agreed deductions, within 10 days of the Tenant vacating and the parties agreeing the deductions. The Landlord will not make deductions without evidence.</p>'],

    ['5. TENANT\'S OBLIGATIONS',
      '<p>The Tenant agrees to:</p>'+
      '<ol style="margin:8px 0 0 20px;padding:0;line-height:2">'+
      '<li>Pay the rent on time as specified above.</li>'+
      '<li>Pay any bills for which the Tenant is expressly responsible under this agreement.</li>'+
      '<li>Keep the room and shared areas in a clean and tidy condition.</li>'+
      '<li>Report any defects, damage, or maintenance issues to the Landlord promptly in writing.</li>'+
      '<li>Not cause or permit any damage to the property beyond fair wear and tear.</li>'+
      '<li>Not sublet, assign, or permit any other person to occupy the property without prior written consent.</li>'+
      '<li>Not keep any animals or pets at the property without prior written consent.</li>'+
      '<li>Not smoke or permit smoking anywhere inside the property.</li>'+
      '<li>Not carry on any business, trade, or profession at the property without prior written consent.</li>'+
      '<li>Not make any alterations, additions, or improvements to the property without prior written consent.</li>'+
      '<li>Allow the Landlord or their agents access to the property on giving at least <strong>24 hours\' written notice</strong> (except in emergency).</li>'+
      '<li>Comply with all reasonable house rules and policies notified by the Landlord from time to time.</li>'+
      '<li>Not cause nuisance or annoyance to neighbouring occupiers or other residents.</li>'+
      '<li>Ensure bins are put out on collection days as directed.</li>'+
      '</ol>'],

    ['6. LANDLORD\'S OBLIGATIONS',
      '<p>The Landlord agrees to:</p>'+
      '<ol style="margin:8px 0 0 20px;padding:0;line-height:2">'+
      '<li>Allow the Tenant quiet enjoyment of the property without interference.</li>'+
      '<li>Maintain the structure and exterior of the property in good repair (section 11, Landlord and Tenant Act 1985).</li>'+
      '<li>Keep in repair and proper working order installations for the supply of water, gas, electricity, and sanitation.</li>'+
      '<li>Ensure the property meets all fire, gas, and electrical safety requirements including annual gas safety certificate and 5-yearly EICR.</li>'+
      '<li>Provide an Energy Performance Certificate (EPC) with a minimum rating of E or above.</li>'+
      '<li>Protect the deposit in a government-approved scheme and provide Prescribed Information within 30 days.</li>'+
      '<li>Give proper notice before entering the property.</li>'+
      '</ol>'],

    ['7. UTILITIES AND COUNCIL TAX',
      '<p>Unless otherwise agreed in writing, the rent <strong>includes</strong> the following: gas, electricity, water, and broadband.</p>'+
      '<p><strong>Council Tax</strong> is the responsibility of the Landlord as the property is an HMO. If the property ceases to qualify as an HMO or the Tenant is the sole occupant, the Tenant shall be responsible for Council Tax in their name.</p>'+
      '<p>The Landlord reserves the right to implement a fair usage policy for utilities. Excessive consumption will be notified in writing and may be charged to the Tenant at cost.</p>'],

    ['8. REPAIRS AND MAINTENANCE',
      '<p>The Tenant must notify the Landlord in writing (including WhatsApp) of any defect or disrepair requiring attention as soon as reasonably practicable after it comes to their attention.</p>'+
      '<p>The Tenant shall be liable for any damage caused by their failure to report a defect promptly where that failure results in increased repair costs.</p>'+
      '<p>The Landlord will respond to urgent repairs (total loss of heating, water, or security) within 24 hours. Non-urgent repairs will be addressed within 14 days.</p>'],

    ['9. ALTERATIONS AND DECORATION',
      '<p>The Tenant must not carry out any alterations, redecoration, or improvements to the property without the prior written consent of the Landlord. The Tenant must restore the property to its original condition at the end of the tenancy if alterations were permitted.</p>'],

    ['10. ASSIGNMENT AND SUBLETTING',
      '<p>The Tenant must not assign this tenancy, sublet the whole or any part of the property, or take in a lodger or paying guest without the prior written consent of the Landlord. Any purported assignment or subletting without consent shall be void and may be grounds for possession.</p>'],

    ['11. END OF TENANCY',
      '<p>On termination of this tenancy, the Tenant shall:</p>'+
      '<ol style="margin:8px 0 0 20px;padding:0;line-height:2">'+
      '<li>Vacate the property and return all keys by 12:00 noon on the termination date.</li>'+
      '<li>Remove all personal belongings. Items left will be disposed of after 7 days without liability.</li>'+
      '<li>Leave the room and all communal areas in the same clean condition as at the start, allowing for fair wear and tear.</li>'+
      '<li>Leave all fixtures, fittings, and appliances provided in good working order.</li>'+
      '<li>Provide a forwarding address for correspondence.</li>'+
      '</ol>'],

    ['12. POSSESSION PROCEEDINGS',
      '<p>The Landlord may seek possession of the property by serving the appropriate notice under the Housing Act 1988 (as amended by the Housing Act 1996 and Deregulation Act 2015):</p>'+
      '<ul style="margin:8px 0 0 20px;padding:0;line-height:2">'+
      '<li><strong>Section 21 Notice:</strong> No-fault basis, giving at least 2 months\' notice after the fixed term expires. Cannot be served in the first 4 months of the tenancy.</li>'+
      '<li><strong>Section 8 Notice:</strong> On specified grounds (e.g. rent arrears of 2+ months — Ground 8, 10, 11), with the appropriate notice period.</li>'+
      '</ul>'],

    ['13. HOUSE RULES',
      '<p>The following rules apply to all occupants and guests:</p>'+
      '<ul style="margin:8px 0 0 20px;padding:0;line-height:2">'+
      '<li><strong>Quiet hours:</strong> 11:00pm to 7:00am on all days.</li>'+
      '<li><strong>No smoking</strong> anywhere inside the property including all rooms, hallways, and stairwells.</li>'+
      '<li>All communal areas (kitchen, bathrooms, hallways) must be kept clean and tidy at all times.</li>'+
      '<li>No overnight guests without prior agreement from the Landlord.</li>'+
      '<li>No illegal drugs or activities of any kind on the premises.</li>'+
      '<li>No items to be stored in communal hallways or blocking fire escape routes.</li>'+
      '<li>Waste to be separated correctly and bins presented on collection days.</li>'+
      '</ul>'],

    ['14. DATA PROTECTION',
      '<p>The Landlord will process the Tenant\'s personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. Personal data will be used solely for the purposes of managing this tenancy, complying with legal obligations, and protecting the Landlord\'s legitimate interests. The Tenant has the right to access, rectify, or erase their data by contacting the Landlord in writing.</p>'],

    ['15. GOVERNING LAW',
      '<p>This agreement is governed by and construed in accordance with the <strong>law of England and Wales</strong>. Any disputes arising from this agreement shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>'+
      '<p>Before commencing any court proceedings, the parties agree to attempt to resolve any dispute informally, and if unsuccessful, via the relevant redress scheme or the First-tier Tribunal (Property Chamber) where applicable.</p>'],
  ];

  clauses.forEach(function(clause){
    S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin:28px 0 10px">'+clause[0]+'</h2>');
    S.push(clause[1]);
  });

  // Inventory / check-in
  S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin:28px 0 10px">16. INVENTORY</h2>');
  S.push('<p>An inventory of the furniture, furnishings, and fittings provided by the Landlord shall be prepared at the start of the tenancy and signed by both parties. The inventory forms part of this agreement. The Tenant should check the inventory carefully and report any discrepancies within 48 hours of moving in.</p>');
  S.push('<div style="background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:14px 18px;margin-top:10px">');
  S.push('<p style="font-weight:700;font-size:12px;margin-bottom:8px">ROOM '+t.room+' INVENTORY (complete at check-in):</p>');
  ['Bed frame', 'Mattress', 'Wardrobe', 'Chest of drawers / storage', 'Desk / chair', 'Curtains / blinds', 'Smoke detector working', 'Carbon monoxide detector (if applicable)'].forEach(function(item){
    S.push('<div style="display:grid;grid-template-columns:1fr 80px 80px 80px;gap:8px;padding:4px 0;border-bottom:1px solid #eee;font-size:12px">');
    S.push('<span>'+item+'</span><span style="text-align:center;color:#555">Good / Fair / Poor</span><span style="text-align:center;color:#555">_______</span><span></span>');
    S.push('</div>');
  });
  S.push('</div>');

  // Signatures
  S.push('<div style="margin-top:48px;page-break-inside:avoid">');
  S.push('<h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #bbb;padding-bottom:5px;margin-bottom:24px">EXECUTION</h2>');
  S.push('<p style="font-size:12px;margin-bottom:24px">By signing below, both parties confirm they have read, understood, and agreed to the terms of this Assured Shorthold Tenancy Agreement.</p>');
  S.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">');
  // Tenant signature — real canvas. Pre-fills with t.signature if previously saved.
  S.push('<div>');
  S.push('<p style="font-weight:700;font-size:13px;margin-bottom:12px">TENANT</p>');
  S.push('<p style="font-size:12px;color:#555;margin-bottom:4px">Full Name: <strong>'+t.name+'</strong></p>');
  S.push('<div data-sig-wrap="tenant" style="position:relative;border:1.5px solid #CCC;border-radius:6px;height:80px;margin:14px 0 6px;background:#fff;overflow:hidden">');
  S.push('  <canvas id="sig-tenant-canvas" data-tenant-id="'+t.id+'" width="600" height="120" style="width:100%;height:100%;cursor:crosshair;touch-action:none;display:block"></canvas>');
  if (t.signature) {
    S.push('  <img data-sig-preload="tenant" src="'+t.signature+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none">');
  } else {
    S.push('  <div data-sig-hint="tenant" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#AAA;font-size:11px;pointer-events:none;font-style:italic">Sign here with your finger or mouse</div>');
  }
  S.push('</div>');
  S.push('<div class="no-print" style="display:flex;gap:6px;margin-bottom:8px">');
  S.push('  <button onclick="clearAgreementSig(\'sig-tenant-canvas\')" type="button" style="font-size:11px;padding:5px 10px;border:1px solid #DDD;background:#fff;border-radius:5px;cursor:pointer;font-family:inherit">Clear</button>');
  S.push('  <button onclick="saveAgreementSig(\'sig-tenant-canvas\')" type="button" style="font-size:11px;padding:5px 10px;border:1px solid var(--accent,#0F9D58);background:var(--accent-light,#E6F4EA);color:var(--accent-dark,#0B7B3F);border-radius:5px;cursor:pointer;font-family:inherit;font-weight:600">Save to tenant profile</button>');
  S.push('</div>');
  S.push('<p style="font-size:11px;color:#777">Signature</p>');
  S.push('<div style="margin-top:16px;font-size:12px">Date: <strong>'+today+'</strong></div>');
  S.push('</div>');
  // Landlord signature — auto-fills from saved Authorised Signatory if configured.
  var savedSig      = (state.config && state.config.companySignature) || '';
  var savedSigName  = (state.config && state.config.companySignatoryName) || '';
  var savedSigTitle = (state.config && state.config.companySignatoryTitle) || '';
  S.push('<div>');
  S.push('<p style="font-weight:700;font-size:13px;margin-bottom:12px">LANDLORD / AGENT</p>');
  S.push('<p style="font-size:12px;color:#555;margin-bottom:4px">On behalf of: <strong>'+propCoName+'</strong></p>');
  if (savedSig) {
    S.push('<div style="border:none;border-bottom:1px solid #000;height:50px;margin:16px 0 6px;display:flex;align-items:flex-end;justify-content:flex-start"><img src="'+savedSig+'" style="max-height:48px;max-width:100%;object-fit:contain"></div>');
    S.push('<p style="font-size:11px;color:#777">'+savedSigName+(savedSigTitle?(' &middot; '+savedSigTitle):'')+'</p>');
    S.push('<div style="margin-top:16px;font-size:12px">Date: <strong>'+today+'</strong></div>');
  } else {
    S.push('<div style="border:none;border-bottom:1px solid #000;height:50px;margin:16px 0 6px"></div>');
    S.push('<p style="font-size:11px;color:#777">Authorised Signature</p>');
    S.push('<div style="margin-top:16px;font-size:12px">Date: ________________________________</div>');
  }
  S.push('</div>');
  S.push('</div>'); // grid

  // Witness
  S.push('<div style="margin-top:32px;padding:14px 18px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px">');
  S.push('<p style="font-weight:700;font-size:12px;margin-bottom:10px">WITNESS (optional but recommended)</p>');
  S.push('<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;font-size:12px">');
  ['Name','Signature','Date'].forEach(function(f){
    S.push('<div><p style="color:#555;font-size:11px;margin-bottom:4px">'+f+'</p><div style="border-bottom:1px solid #999;height:28px"></div></div>');
  });
  S.push('</div></div>');
  S.push('</div>'); // execution

  // Footer
  S.push('<div style="margin-top:40px;padding-top:16px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#999">');
  S.push(propCoName+' · Assured Shorthold Tenancy Agreement · Prepared '+today+' · Housing Act 1988 (as amended)');
  S.push('</div>');

  S.push('</div></div>'); // doc body + overlay

  var existing = document.getElementById('agreement-overlay');
  if(existing) existing.remove();
  var div = document.createElement('div');
  div.innerHTML = S.join('');
  document.body.appendChild(div.firstChild);
  // Wire any signature canvases that were rendered.
  setTimeout(function(){ initAgreementSignature('sig-tenant-canvas'); }, 50);
}

// ── Shared signature canvas helpers ──────────────────────────────────────────
// Used by both 31-tenancy-agreement and 32-excluded-licence-agreement so the
// drawing logic exists in one place and works on desktop + mobile.
function initAgreementSignature(canvasId){
  var canvas = document.getElementById(canvasId);
  if(!canvas) return;
  if(canvas.__sigInit) return; // idempotent — modal re-renders re-call init
  canvas.__sigInit = true;
  var ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#0F0F1A';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var drawing = false, lastX = 0, lastY = 0;
  function pos(e){
    var r = canvas.getBoundingClientRect();
    var sx = canvas.width / r.width;
    var sy = canvas.height / r.height;
    var cx = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    var cy = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    return { x:(cx - r.left)*sx, y:(cy - r.top)*sy };
  }
  function start(e){
    e.preventDefault();
    drawing = true;
    var p = pos(e); lastX = p.x; lastY = p.y;
    // Hide the placeholder hint and any pre-filled image as soon as drawing starts.
    var wrap = canvas.parentElement;
    if(wrap){
      var hint = wrap.querySelector('[data-sig-hint]');     if(hint) hint.style.display='none';
      var pre  = wrap.querySelector('[data-sig-preload]');  if(pre)  pre.style.display='none';
    }
  }
  function move(e){
    if(!drawing) return;
    e.preventDefault();
    var p = pos(e);
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
    lastX = p.x; lastY = p.y;
  }
  function stop(){ drawing = false; }
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove',  move,  {passive:false});
  canvas.addEventListener('touchend',   stop);
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup',   stop);
}

function clearAgreementSig(canvasId){
  var canvas = document.getElementById(canvasId);
  if(!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  // Also wipe any preloaded signature image so the user is starting fresh.
  var wrap = canvas.parentElement;
  if(wrap){
    var pre = wrap.querySelector('[data-sig-preload]'); if(pre) pre.remove();
    var hint = wrap.querySelector('[data-sig-hint]');   if(hint) hint.style.display='';
  }
}

function saveAgreementSig(canvasId){
  var canvas = document.getElementById(canvasId);
  if(!canvas){ if(typeof showToast==='function') showToast('Signature box not found','error'); return; }
  var tid = canvas.dataset.tenantId;
  var t   = state.tenants.find(function(x){ return String(x.id) === String(tid); });
  if(!t){ if(typeof showToast==='function') showToast('Tenant not found','error'); return; }
  // Detect if anything was drawn — a fully transparent canvas exports a tiny dataURL (~96 bytes).
  // Use getImageData to check for any non-zero alpha pixels.
  var w = canvas.width, h = canvas.height;
  var pixels = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  var hasInk = false;
  for(var i = 3; i < pixels.length; i += 4){ if(pixels[i] !== 0){ hasInk = true; break; } }
  if(!hasInk){ if(typeof showToast==='function') showToast('Please sign in the box first','error'); return; }
  var dataUrl = canvas.toDataURL('image/png');
  t.signature = dataUrl;
  t.signatureSavedAt = new Date().toISOString();
  if(typeof saveState === 'function') saveState();
  if(typeof showToast === 'function') showToast('Signature saved to tenant profile','success');
}

// Legacy alias kept so old print buttons in 32-excluded-licence-agreement still work.
function clearSignature(){ clearAgreementSig('sig-canvas'); }

// ── Remote signing: dashboard → token → share link ──────────────────────────
// Calls POST /api/tenants/:id/sign-token (auth via the user's supabase JWT),
// then opens a modal with copy / WhatsApp / email actions for the returned URL.
async function sendTenantSigningLink(tenantId, contractType){
  var t = state.tenants.find(function(x){ return String(x.id) === String(tenantId); });
  if(!t){ if(typeof showToast==='function') showToast('Tenant not found','error'); return; }
  if(typeof showToast==='function') showToast('Generating signing link…','info');
  // Capture a snapshot of the open agreement so the tenant sees what they're
  // signing on the public sign page. Strip the live signature canvases — those
  // are interactive controls only, not part of the document.
  var agreementHtml = '';
  try {
    var docBody = document.querySelector('#agreement-overlay [data-contract-type][data-tenant-id]');
    if (docBody && String(docBody.getAttribute('data-tenant-id')) === String(tenantId)) {
      var clone = docBody.cloneNode(true);
      // Remove tenant-side canvas blocks + their action buttons (they'll be re-rendered live in the sign page).
      Array.prototype.forEach.call(clone.querySelectorAll('canvas[id^="sig-tenant-canvas"]'), function(c){
        var wrap = c.closest('[data-sig-wrap="tenant"]') || c.parentNode;
        if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      });
      Array.prototype.forEach.call(clone.querySelectorAll('.no-print'), function(n){ n.remove(); });
      // Cap at ~400KB to avoid bloating the row.
      agreementHtml = clone.outerHTML.slice(0, 400 * 1024);
    }
  } catch(_e) {}
  try {
    var sess = await supa.auth.getSession();
    var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
    if(!jwt){ if(typeof showToast==='function') showToast('Please sign in again','error'); return; }
    var resp = await fetch('/api/tenants/' + encodeURIComponent(tenantId) + '/sign-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify({ contractType: contractType || 'ast', agreementHtml: agreementHtml })
    });
    var data = await resp.json().catch(function(){ return {}; });
    if(!resp.ok){
      if(typeof showToast==='function') showToast(data.error || 'Could not generate link', 'error');
      return;
    }
    _openSigningShareModal(t, data.url, data.expiresAt);
  } catch(e){
    if(typeof showToast==='function') showToast('Network error — try again','error');
  }
}

// Re-render the agreement that was actually sent for signing, with the
// landlord-side snapshot (taken at token-issue time) AND the tenant signature
// + date the tenant submitted. This is what the user sees when they click
// "View agreement" on a signed tenant from the dashboard.
async function viewSignedAgreement(tenantId){
  var t = state.tenants.find(function(x){ return String(x.id) === String(tenantId); });
  // Use signature_saved_at (kept in slim loadState) as the existence check —
  // the actual base64 signature is lazy-loaded below since it can be ~100KB
  // per tenant and we keep it out of the boot fetch.
  if(!t || !t.signatureSavedAt){ if(typeof showToast==='function') showToast('No signed agreement on file','error'); return; }
  if(!t.signedAgreementType){
    // Fallback to the simple signature-only viewer for legacy records (signed
    // before agreement-type tracking was added).
    return _viewTenantSignature(tenantId);
  }
  // Lazy-load the heavy fields (signature PNG, landlord signature PNG,
  // agreement HTML snapshot). First open per session = one round-trip; cached
  // for the rest of the session.
  if (typeof _loadTenantHeavyFields === 'function') {
    try { await _loadTenantHeavyFields(tenantId); } catch(_e) {}
  }
  // Temporarily override state.config.companySignature* with the snapshot so
  // the agreement re-renders the EXACT landlord side the tenant saw, even if
  // the user later changed Settings.
  var cfg = state.config = state.config || {};
  var prevSig = cfg.companySignature, prevName = cfg.companySignatoryName, prevTitle = cfg.companySignatoryTitle;
  var snapDate;
  try { snapDate = t.signedLandlordDate ? new Date(t.signedLandlordDate).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : null; } catch(_e){ snapDate = null; }
  if (t.signedLandlordSig)   cfg.companySignature       = t.signedLandlordSig;
  if (t.signedLandlordName)  cfg.companySignatoryName   = t.signedLandlordName;
  if (t.signedLandlordTitle) cfg.companySignatoryTitle  = t.signedLandlordTitle;
  // Pin "today" inside the agreement to the original signing date so date
  // stamps line up. We do this by stubbing toLocaleDateString on a Date copy
  // — but simplest: set window._signedRenderToday so templates can prefer it.
  // (Not all templates respect it; the saved t.signature image still renders
  // and t.signatureSavedAt shows beside it via the existing tenant block.)
  try {
    var fn = ({
      ast: 'generateAgreement',
      excluded_licence: 'generateExcludedLicence',
      company_let: 'generateCompanyLet',
      lodger: 'generateLodgerAgreement',
      room_letting: 'generateRoomLettingAgreement',
      renewal: 'openTenancyRenewalModal'
    })[t.signedAgreementType] || 'generateAgreement';
    if (typeof window[fn] === 'function') window[fn](tenantId);
    // Banner across the top of the overlay so it's clear this is a SIGNED COPY.
    setTimeout(function(){
      var overlay = document.getElementById('agreement-overlay');
      if(!overlay) return;
      var banner = document.createElement('div');
      banner.id = 'signed-banner';
      banner.style.cssText = 'background:#ECFDF5;border-bottom:1px solid #A7F3D0;color:#065F46;padding:12px 18px;font-size:13px;display:flex;flex-direction:column;gap:6px';
      var sigDateTime = '';
      try { sigDateTime = new Date(t.signatureSavedAt).toLocaleString('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch(_e){}
      var topLine = '<div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px"><span>✓</span><span>Signed copy — Tenant signed ' + (sigDateTime || 'on file') + (snapDate ? ' · Landlord signed ' + snapDate : '') + '</span></div>';
      // Audit-trail line surfaces IP + device. Both are captured at signing
      // time and stored on the tenant row — this is what makes the e-sig
      // legally defensible if challenged.
      var auditBits = [];
      if (t.signedIp)         auditBits.push('IP ' + t.signedIp);
      if (t.signedUserAgent)  auditBits.push('Device ' + (t.signedUserAgent || '').split(' ')[0]);
      var auditLine = auditBits.length
        ? '<div style="font-size:11px;color:#059669;font-weight:500">Audit: ' + auditBits.join(' · ') + ' · Captured under Electronic Communications Act 2000, s.7</div>'
        : '';
      banner.innerHTML = topLine + auditLine;
      var toolbar = overlay.querySelector('div[style*="position:sticky"]');
      if (toolbar && toolbar.parentNode) toolbar.parentNode.insertBefore(banner, toolbar.nextSibling);
      else overlay.insertBefore(banner, overlay.firstChild);
    }, 60);
  } finally {
    // Restore live config — defer slightly so the templates finish reading first.
    setTimeout(function(){
      cfg.companySignature      = prevSig;
      cfg.companySignatoryName  = prevName;
      cfg.companySignatoryTitle = prevTitle;
    }, 200);
  }
}

// Streams the stored signed-agreement PDF from /api/signed-agreement/:id/pdf
// and triggers a browser download. Server-proxied so the bucket can stay
// private and we never leak signed-URL expiry into the UI.
async function downloadSignedAgreementPdf(tenantId){
  var t = state.tenants.find(function(x){ return String(x.id) === String(tenantId); });
  if(!t || !t.signedAgreementPdfPath){
    if(typeof showToast==='function') showToast('No signed PDF on file yet','error');
    return;
  }
  try {
    var sess = await supa.auth.getSession();
    var jwt = sess && sess.data && sess.data.session && sess.data.session.access_token;
    if(!jwt){ if(typeof showToast==='function') showToast('Please sign in again','error'); return; }
    var r = await fetch('/api/signed-agreement/' + encodeURIComponent(tenantId) + '/pdf', {
      headers: { Authorization: 'Bearer ' + jwt }
    });
    if(!r.ok){
      var msg = 'Download failed';
      try { var j = await r.json(); if(j && j.error) msg = j.error; } catch(_){}
      if(typeof showToast==='function') showToast(msg,'error');
      return;
    }
    var blob = await r.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'signed-agreement-' + (t.name || 'tenant').replace(/[^a-z0-9]+/gi,'-').toLowerCase() + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  } catch(e){
    if(typeof showToast==='function') showToast('Network error — try again','error');
  }
}

// View a tenant's saved signature in a modal — quick way to confirm it's stored.
async function _viewTenantSignature(tenantId){
  var t = state.tenants.find(function(x){ return String(x.id) === String(tenantId); });
  if(!t || !t.signatureSavedAt){ if(typeof showToast==='function') showToast('No signature on file','error'); return; }
  // Lazy-load the base64 signature now — kept out of boot fetch for perf.
  if (typeof _loadTenantHeavyFields === 'function') {
    try { await _loadTenantHeavyFields(tenantId); } catch(_e) {}
  }
  if (!t.signature) { if(typeof showToast==='function') showToast('Signature failed to load — try again','error'); return; }
  var when = '';
  try { when = new Date(t.signatureSavedAt).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch(e){}
  var html = ''
    + '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:520px">'
    + '<div class="modal-header"><span class="modal-title">✓ Signature on file — ' + (t.name||'') + '</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    + '<div class="modal-body">'
    +   (when ? '<div style="font-size:12px;color:var(--gray-500);margin-bottom:12px">Signed ' + when + '</div>' : '')
    +   '<div style="border:1px solid var(--gray-200);border-radius:10px;padding:14px;background:#fff;text-align:center"><img src="' + t.signature + '" style="max-width:100%;max-height:240px;object-fit:contain"></div>'
    + '</div>'
    + '<div class="modal-footer"><button onclick="closeModal()" class="btn btn-secondary">Close</button></div>'
    + '</div></div>';
  var holder = document.getElementById('modal-container');
  if(holder) holder.innerHTML = html;
}

function _openSigningShareModal(t, url, expiresAt){
  var expiry = '';
  try { expiry = new Date(expiresAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); } catch(e){}
  // Stash the link + tenant id on a window-level slot so the Email/WhatsApp
  // buttons can read them without HTML-escaping a JSON blob into onclick.
  window._signLinkCtx = { tenantId: t.id, url: url, expiry: expiry };
  // _waSanitize strips any 4-byte emojis from tenant names that would mangle to � on WhatsApp.
  var waText = _waSanitize('Hi ' + (t.name || '') + ', please sign your tenancy agreement here: ' + url + ' (link expires ' + (expiry || 'soon') + ')');
  var waHref = 'https://wa.me/' + (t.whatsapp || '').replace(/\D/g,'') + '?text=' + encodeURIComponent(waText);
  // z-index 100001 sits above the agreement overlay (z-index 99999), so the
  // share modal pops to the front when triggered from inside an open agreement.
  var html = ''
    + '<div class="modal-overlay" style="z-index:100001" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:480px">'
    + '<div class="modal-header"><span class="modal-title">📤 Signing link for ' + (t.name||'') + '</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    + '<div class="modal-body">'
    +   '<p style="font-size:13px;color:var(--gray-700);margin-bottom:12px;line-height:1.5">Send this private link to the tenant. Anyone with the link can sign — it expires on <strong>' + (expiry || '—') + '</strong> and can only be used once. The tenant sees the full agreement before signing.</p>'
    +   '<div style="display:flex;gap:6px;margin-bottom:14px">'
    +     '<input id="sign-link-url" readonly value="' + url + '" style="flex:1;padding:10px 12px;border:1px solid var(--gray-200);border-radius:9px;font-family:\'DM Mono\',monospace;font-size:12px;background:var(--gray-50);color:var(--gray-700);outline:none" onclick="this.select()">'
    +     '<button onclick="(function(){var el=document.getElementById(\'sign-link-url\');el.select();document.execCommand(\'copy\');showToast&&showToast(\'Link copied\',\'success\');})()" class="btn btn-secondary" style="padding:10px 14px">Copy</button>'
    +   '</div>'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +     (t.whatsapp ? '<a href="' + waHref + '" target="_blank" rel="noopener" class="btn" style="background:#25D366;color:#fff;justify-content:center;text-decoration:none">📱 WhatsApp</a>' : '<button class="btn btn-secondary" disabled style="justify-content:center;opacity:.5">📱 No WhatsApp</button>')
    +     (t.email    ? '<button id="sign-email-btn" onclick="_sendSigningLinkEmail()" class="btn btn-primary" style="justify-content:center">✉️ Email tenant</button>'             : '<button class="btn btn-secondary" disabled style="justify-content:center;opacity:.5">✉️ No email on file</button>')
    +   '</div>'
    + '</div>'
    + '<div class="modal-footer"><button onclick="closeModal()" class="btn btn-secondary">Close</button></div>'
    + '</div></div>';
  var holder = document.getElementById('modal-container');
  if(holder) holder.innerHTML = html;
}

// Sends a branded signing-link email through the existing Resend pipe
// (POST /api/email/send). Replaces the old mailto: link, which silently no-op'd
// when the user had no default mail client.
async function _sendSigningLinkEmail(){
  var ctx = window._signLinkCtx;
  if(!ctx || !ctx.tenantId || !ctx.url){ if(typeof showToast==='function') showToast('Missing link context','error'); return; }
  var t = state.tenants.find(function(x){ return String(x.id) === String(ctx.tenantId); });
  if(!t || !t.email){ if(typeof showToast==='function') showToast('Tenant has no email','error'); return; }
  var btn = document.getElementById('sign-email-btn');
  if(btn){ btn.disabled = true; btn.textContent = 'Sending…'; }
  var first = (t.name || '').split(' ')[0] || 'there';
  var subject = 'Please sign your tenancy agreement';
  var body = 'Please sign your tenancy agreement using the secure link below.\n\n'
    + 'The link expires on ' + (ctx.expiry || 'soon') + ' and can only be used once.\n\n'
    + 'Open agreement: ' + ctx.url + '\n\n'
    + 'Thanks for choosing us.';
  // sendEmail handles the HTML wrap via buildTenantOutboundHtml — picks up
  // the saved company name, phone, email from Settings → Email config.
  var ok = false;
  try {
    if (typeof sendEmail === 'function') {
      ok = await sendEmail(t.email, subject, body, 'tenant-comms', {
        firstName: first,
        templateId: 'sign_agreement',
        signLinkUrl: ctx.url,
        signLinkExpiry: ctx.expiry || ''
      });
    }
  } catch(e) {
    if(typeof showToast==='function') showToast('Email error: ' + e.message, 'error');
  }
  if(btn){ btn.disabled = false; btn.textContent = ok ? '✓ Sent' : '✉️ Email tenant'; }
  if(ok && typeof closeModal === 'function') setTimeout(closeModal, 800);
}
