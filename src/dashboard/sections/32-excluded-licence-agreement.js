// ── EXCLUDED LICENCE AGREEMENT ───────────────────────────────────────────────
function closeAgreement() {
  var el = document.getElementById('agreement-overlay');
  if(el) el.remove();
}

function generateExcludedLicence(tenantId) {
  var t = state.tenants.find(function(x){return x.id===tenantId;});
  if(!t) return;
  var p = state.properties.find(function(x){return x.name===t.property;});
  var room = p&&p.roomList ? p.roomList.find(function(r){return r.n===t.room;}) : null;
  var today    = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  var moveIn   = t.startDate ? new Date(t.startDate).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}) : (t.moveIn||'—');
  var propAddr = p ? (p.address||p.name) : t.property;
  var deposit  = t.deposit || t.rent*2;
  var payDay   = t.freq==='monthly' ? (t.payDayOfMonth+'th of each month') : ('every '+(t.payDay||'Friday'));

  var S = [];
  S.push('<div id="agreement-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto">');

  // Header bar
  S.push('<div style="position:sticky;top:0;background:#0F0F1A;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:10">');
  S.push('<span style="color:#fff;font-size:14px;font-weight:700">Excluded Licence Agreement — '+t.name+'</span>');
  S.push('<div style="display:flex;gap:8px">');
  S.push('<button onclick="window.print()" style="padding:8px 16px;border-radius:8px;border:none;background:#10B981;color:#fff;font-size:13px;font-weight:700;cursor:pointer">🖨 Print / PDF</button>');
  S.push('<button onclick="closeAgreement()" style="padding:8px 14px;border-radius:8px;border:1px solid #444;background:transparent;color:#fff;font-size:13px;cursor:pointer">✕ Close</button>');
  S.push('</div></div>');

  // Document body
  S.push('<div style="max-width:740px;margin:0 auto;padding:40px 28px;font-family:Georgia,serif;font-size:13px;line-height:1.7;color:#1a1a1a">');

  // Company header
  S.push('<div style="text-align:center;margin-bottom:30px;border-bottom:3px solid #0F0F1A;padding-bottom:20px">');
  S.push('<div style="font-size:22px;font-weight:800;letter-spacing:-.5px;font-family:Arial,sans-serif">RESERVATIONS DIRECT LIMITED</div>');
  S.push('<div style="font-size:12px;color:#555;margin-top:4px">Company No. · Registered in England & Wales</div>');
  S.push('<div style="font-size:18px;font-weight:700;margin-top:16px;text-transform:uppercase;letter-spacing:1px">Excluded Licence Agreement</div>');
  S.push('<div style="font-size:12px;color:#777;margin-top:4px">Licence to Occupy — Not an Assured Shorthold Tenancy</div>');
  S.push('</div>');

  // Key details table
  S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:6px;padding:4px 16px;margin-bottom:24px">');
  var rows = [
    ['Licensor', 'Reservations Direct Limited ("the Company")'],
    ['Licensee', t.name],
    ['Property Address', propAddr],
    ['Room', 'Room '+t.room+(room?' — '+room.type:'')],
    ['Licence Fee', '£'+t.rent+' per '+(t.freq==='weekly'?'week':'month')+', payable '+payDay],
    ['Deposit', '£'+deposit],
    ['Payment Method', t.method==='bank'?'Bank Transfer':'Cash'],
    ['Commencement Date', moveIn],
    ['Date of Agreement', today],
  ];
  rows.forEach(function(r){
    S.push('<div style="display:flex;gap:12px;padding:7px 0;border-bottom:1px solid #DDE1E7">');
    S.push('<span style="font-weight:700;min-width:160px;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:.04em">'+r[0]+'</span>');
    S.push('<span style="font-size:13px">'+r[1]+'</span>');
    S.push('</div>');
  });
  S.push('</div>');

  // Important notice box
  S.push('<div style="background:#FFF3CD;border:2px solid #FFC107;border-radius:6px;padding:14px 18px;margin-bottom:24px">');
  S.push('<div style="font-weight:700;font-size:13px;margin-bottom:6px">⚠ IMPORTANT NOTICE TO LICENSEE</div>');
  S.push('<div style="font-size:12px;line-height:1.6">This agreement is an <strong>Excluded Licence</strong> and is <strong>NOT</strong> an Assured Shorthold Tenancy. ');
  S.push('The Licensee does not have exclusive possession of the property and does not have the security of tenure afforded to tenants under the Housing Act 1988. ');
  S.push('The Licensor retains the right to access all areas of the property at all times. ');
  S.push('The Licensee is strongly advised to seek independent legal advice before signing this agreement.</div>');
  S.push('</div>');

  // Clauses
  var clauses = [
    ['1. GRANT OF LICENCE',
      'The Company grants the Licensee a personal, non-exclusive licence to occupy Room '+t.room+' at the above property for the purposes of residential accommodation only. This licence does not create a tenancy or any other interest in land. The Licensee acknowledges that they do not have exclusive possession of the property or any part thereof.'],

    ['2. LICENCE FEE',
      'The Licensee shall pay a licence fee of <strong>£'+t.rent+' per '+(t.freq==='weekly'?'week':'month')+'</strong>, payable in advance <strong>'+payDay+'</strong> by <strong>'+(t.method==='bank'?'bank transfer':'cash')+'</strong>. '
      +'Bank details will be provided by the Company. Payments must be made on time without deduction or set-off. '
      +'Late payment may result in immediate termination of this licence.'],

    ['3. DEPOSIT',
      'The Licensee shall pay a deposit of <strong>£'+deposit+'</strong> prior to or on the commencement date. The deposit will be held by the Company and may be used to offset any unpaid licence fees, damage beyond fair wear and tear, or cleaning costs at the end of the licence. '
      +'The Company will return the deposit within 14 days of the Licensee vacating, subject to any deductions. '
      +'<em>Note: As this is a licence and not a tenancy, the deposit is not required by law to be protected in a tenancy deposit scheme.</em>'],

    ['4. DURATION AND NOTICE',
      'This licence commences on <strong>'+moveIn+'</strong> and continues on a rolling basis until terminated. '
      +'<strong>Either party may terminate this licence by giving not less than ONE (1) WEEK\u2019s written notice.</strong> '
      +'Notice may be given in writing, by email, or by WhatsApp message to the other party’s last known contact details. '
      +'The Company may terminate this licence immediately and without notice in the event of breach of any term of this agreement, non-payment of the licence fee, or behaviour that is harmful to other occupants or the property.'],

    ['5. LICENSEE OBLIGATIONS',
      'The Licensee agrees to: (a) pay the licence fee on time; (b) keep their room and all shared areas clean and tidy; '
      +'(c) not damage the property or its contents; (d) not sublet or allow any other person to occupy the room; '
      +'(e) not keep pets without prior written consent; (f) not smoke inside the property; '
      +'(g) report all maintenance issues promptly to the Company; (h) not make any alterations to the property; '
      +'(i) comply with all reasonable house rules issued by the Company from time to time; '
      +'(j) allow the Company access to the property at all times, with reasonable notice where practicable.'],

    ['6. HOUSE RULES',
      'Quiet hours are from <strong>11pm to 7am</strong>. No smoking anywhere inside the property. '
      +'Shared areas including kitchen, bathrooms and communal spaces must be kept clean at all times. '
      +'No unauthorised guests staying overnight. No illegal activities of any kind. '
      +'All bins must be put out on collection day. Failure to comply with house rules may result in immediate termination.'],

    ['7. COMPANY OBLIGATIONS',
      'The Company agrees to: (a) provide the Licensee with quiet enjoyment of the room insofar as is consistent with this licence; '
      +'(b) maintain the structure and fabric of the property in good repair; (c) ensure utilities (unless otherwise agreed) are maintained; '
      +'(d) carry out repairs within a reasonable time of being notified.'],

    ['8. UTILITIES AND SERVICES',
      'Unless separately agreed in writing, the licence fee includes contribution towards gas, electricity, and water. '
      +'The Licensee is responsible for their own council tax registration if required. Internet access may be provided at the Company’s discretion.'],

    ['9. EXCLUSION OF LIABILITY',
      'The Company shall not be liable for any loss, theft, or damage to the Licensee’s personal belongings. '
      +'The Licensee is strongly advised to obtain personal contents insurance. The Company’s liability is limited to the return of the deposit where applicable.'],

    ['10. GOVERNING LAW',
      'This agreement is governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.'],
  ];

  clauses.forEach(function(cl){
    S.push('<div style="margin-bottom:18px">');
    S.push('<div style="font-size:13px;font-weight:700;text-transform:uppercase;border-bottom:1px solid #CCC;padding-bottom:5px;margin-bottom:8px;letter-spacing:.04em">'+cl[0]+'</div>');
    S.push('<div style="font-size:13px;line-height:1.75">'+cl[1]+'</div>');
    S.push('</div>');
  });

  // Signature block
  var sigDate = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  var sigIsoDate = new Date().toISOString().split('T')[0];
  S.push('<div style="margin-top:40px;border-top:2px solid #0F0F1A;padding-top:24px">');
  S.push('<div style="font-weight:700;font-size:13px;margin-bottom:20px;text-transform:uppercase;letter-spacing:.04em">Signatures</div>');
  S.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px">');

  // ── Licensor (Company) signature block ──
  S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:8px;padding:18px">');
  S.push('<div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:10px">For and on behalf of the Licensor</div>');
  S.push('<div style="font-size:14px;font-weight:800;margin-bottom:14px">Reservations Direct Limited</div>');

  // Signature canvas area
  S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:6px">Signature</div>');
  S.push('<div id="sig-canvas-wrap" style="border:2px solid #CCC;border-radius:6px;background:#fff;margin-bottom:10px;position:relative">');
  S.push('<canvas id="sig-canvas" width="280" height="90" style="display:block;cursor:crosshair;touch-action:none;width:100%"></canvas>');
  S.push('<button onclick="clearSignature()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.1);border:none;border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer;color:#555">Clear</button>');
  S.push('</div>');

  // Name print field
  S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:5px">Name (print)</div>');
  S.push('<input id="sig-name" type="text" placeholder="Full name of signatory" style="width:100%;padding:8px 10px;border:1.5px solid #CCC;border-radius:6px;font-size:13px;font-family:inherit;margin-bottom:10px">');

  // Date with auto-fill button
  S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:5px">Date</div>');
  S.push('<div style="display:flex;gap:8px;align-items:center">');
  S.push('<input id="sig-date" type="date" value="'+sigIsoDate+'" style="flex:1;padding:8px 10px;border:1.5px solid #CCC;border-radius:6px;font-size:13px;font-family:inherit">');
  S.push('<button onclick="document.getElementById(\'sig-date\').value=new Date().toISOString().split(\'T\')[0]" style="padding:8px 12px;border-radius:6px;border:1px solid #10B981;background:#ECFDF5;color:#065F46;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit">Today</button>');
  S.push('</div>');
  S.push('</div>');

  // ── Licensee signature block ──
  S.push('<div style="background:#F8F9FC;border:1px solid #DDE1E7;border-radius:8px;padding:18px">');
  S.push('<div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:10px">Licensee</div>');
  S.push('<div style="font-size:14px;font-weight:800;margin-bottom:14px">'+t.name+'</div>');
  S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:6px">Signature</div>');
  S.push('<div style="border:2px solid #CCC;border-radius:6px;height:90px;background:#fff;margin-bottom:10px;display:flex;align-items:center;justify-content:center;color:#AAA;font-size:12px">Licensee signs here</div>');
  S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:5px">Name (print)</div>');
  S.push('<div style="border-bottom:1.5px solid #CCC;height:28px;margin-bottom:10px"></div>');
  S.push('<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:5px">Date</div>');
  S.push('<div style="border-bottom:1.5px solid #CCC;height:28px"></div>');
  S.push('</div>');

  S.push('</div>');

  // Print button with "embed signature" instruction
  S.push('<div style="margin-top:20px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:12px 16px;font-size:12px;color:#1E40AF">');
  S.push('💡 <strong>Before printing:</strong> Sign in the box above, enter your name and confirm the date, then click Print / PDF. Your signature will appear in the printed document.');
  S.push('</div>');

  // Footer
  S.push('<div style="margin-top:32px;padding-top:16px;border-top:1px solid #EEE;text-align:center;font-size:11px;color:#888">');
  S.push('Reservations Direct Limited · Excluded Licence Agreement · Generated '+today+' · Page 1 of 1');
  S.push('</div>');

  S.push('</div></div>');

  // Render
  var existing = document.getElementById('agreement-overlay');
  if(existing) existing.remove();
  var div = document.createElement('div');
  div.innerHTML = S.join('');
  document.body.appendChild(div.firstChild);

  // Init signature canvas
  setTimeout(function(){
    var canvas = document.getElementById('sig-canvas');
    if(!canvas) return;
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var lastX = 0, lastY = 0;

    function getPos(e) {
      var r = canvas.getBoundingClientRect();
      var scaleX = canvas.width / r.width;
      var scaleY = canvas.height / r.height;
      if(e.touches) {
        return {x:(e.touches[0].clientX-r.left)*scaleX, y:(e.touches[0].clientY-r.top)*scaleY};
      }
      return {x:(e.clientX-r.left)*scaleX, y:(e.clientY-r.top)*scaleY};
    }

    ctx.strokeStyle = '#0F0F1A';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function start(e){ e.preventDefault(); drawing=true; var p=getPos(e); lastX=p.x; lastY=p.y; }
    function move(e){ e.preventDefault(); if(!drawing) return; var p=getPos(e); ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y); ctx.stroke(); lastX=p.x; lastY=p.y; }
    function stop(){ drawing=false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, {passive:false});
    canvas.addEventListener('touchmove', move, {passive:false});
    canvas.addEventListener('touchend', stop);
  }, 100);
}

function clearSignature() {
  var canvas = document.getElementById('sig-canvas');
  if(canvas) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
}
