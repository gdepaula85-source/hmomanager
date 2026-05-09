// ── DEAL ANALYZER ─────────────────────────────────────────────────────────────
function renderPropertiesDealView() {
  if(!state.dealInputs) state.dealInputs={};
  var d=state.dealInputs._scratch||{};
  var isOwned=(d.dealType||'r2r')==='owned';
  var scenarios=Object.keys(state.dealInputs).filter(function(k){return k!=='_scratch'&&state.dealInputs[k]&&state.dealInputs[k]._name;}).map(function(k){return state.dealInputs[k];});

  // Compact inline input (no card wrapper — just label + input field)
  function inp(label,id,val,pfx){
    return '<div>'
      +'<label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px">'+label+'</label>'
      +'<div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden">'
      +(pfx?'<span style="padding:0 8px;font-size:12px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:34px;display:flex;align-items:center;flex-shrink:0">'+pfx+'</span>':'')
      +'<input type="number" id="'+id+'" value="'+(val!==undefined&&val!==''?val:'')+'" oninput="recalcDealPage()" '
      +'style="flex:1;border:none;padding:7px 9px;font-size:13px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%">'
      +'</div></div>';
  }

  var html='<div class="page-header"><div style="display:flex;align-items:center;gap:12px">'
    +'<button onclick="propViewList()" style="padding:7px 12px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">&larr; Properties</button>'
    +'<div><div class="page-title">Deal Analyzer</div><div class="page-sub">Model any deal before committing</div></div></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap"><button onclick="generateDealAnalyzerPDF(\'view\')" style="padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">👁️ View PDF</button>'
    +'<button onclick="generateDealAnalyzerPDF(\'download\')" style="padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">⬇️ Download PDF</button>'
    +'<button onclick="saveDealScenario()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Scenario</button>'
    +'<button onclick="resetDealPage()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">Reset</button></div></div>';

  var lettingType=d.lettingType||'hmo';
  var isWhole=lettingType==='whole';
  var isSA=lettingType==='sa';
  var loadedId = d._id || '';

  // ── Compact controls row: Saved deals dropdown + R2R/Owned toggle + HMO/Whole/SA toggle ──
  // Previously these lived on three separate rows + a chip bar — they've been
  // consolidated to bring the results card up the page so users see them
  // immediately as they type, with much less empty space at the top.
  html+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">';

  // Saved deals dropdown — only rendered if there are saved scenarios
  if (scenarios.length) {
    html+='<div style="display:flex;align-items:stretch;border:1.5px solid var(--border);border-radius:11px;background:var(--surface);overflow:hidden">';
    html+='<select onchange="loadDealScenario(this.value)" style="border:none;background:transparent;padding:9px 10px 9px 12px;font-size:13px;font-family:inherit;font-weight:600;color:var(--text);cursor:pointer;outline:none;min-width:160px;max-width:240px">';
    html+='<option value=""'+(loadedId?'':' selected')+'>📁 Saved deal…</option>';
    scenarios.forEach(function(sc){
      var net2=(sc._grossIncome||0)-(sc._totalCosts||0);
      var sel = sc._id === loadedId ? ' selected' : '';
      html+='<option value="'+sc._id+'"'+sel+'>'+esc(sc._name)+' ('+fmt(net2)+'/mo)</option>';
    });
    html+='</select>';
    // Trash button — only enabled when a saved scenario is currently loaded
    if (loadedId) {
      html+='<button data-scid="'+loadedId+'" onclick="deleteDealScenario(this.dataset.scid)" title="Delete this saved deal" style="padding:0 12px;border:none;border-left:1px solid var(--border);background:var(--bg);color:var(--muted);cursor:pointer;font-size:13px;font-family:inherit">&times;</button>';
    }
    html+='</div>';
  }

  // Deal type toggle (R2R / Owned)
  html+='<div style="display:flex;gap:0;background:var(--bg);border:1.5px solid var(--border);border-radius:11px;padding:3px;width:fit-content">';
  ['r2r','owned'].forEach(function(t){var active=(d.dealType||'r2r')===t;
    html+='<button data-dt="'+t+'" onclick="switchDealType(this.dataset.dt)" style="padding:7px 16px;border-radius:8px;border:none;background:'+(active?'var(--surface)':'transparent')+';box-shadow:'+(active?'0 1px 4px rgba(0,0,0,.1)':'none')+';font-size:12px;font-weight:'+(active?700:500)+';color:'+(active?'var(--text)':'var(--muted)')+';cursor:pointer;font-family:inherit;white-space:nowrap">'+(t==='r2r'?'Rent-to-Rent (R2R)':'Owned / BTL')+'</button>';});
  html+='</div>';

  // Letting strategy toggle (HMO / Whole / SA)
  html+='<div style="display:flex;gap:0;background:var(--bg);border:1.5px solid var(--border);border-radius:11px;padding:3px;width:fit-content">';
  [{v:'hmo',l:'🏘️ HMO'},{v:'whole',l:'🏡 Whole'},{v:'sa',l:'🛏️ SA / Airbnb'}].forEach(function(t){var active=lettingType===t.v;
    html+='<button data-lt="'+t.v+'" onclick="switchLettingType(this.dataset.lt)" style="padding:7px 14px;border-radius:8px;border:none;background:'+(active?'var(--surface)':'transparent')+';box-shadow:'+(active?'0 1px 4px rgba(0,0,0,.1)':'none')+';font-size:12px;font-weight:'+(active?700:500)+';color:'+(active?'var(--text)':'var(--muted)')+';cursor:pointer;font-family:inherit;white-space:nowrap">'+t.l+'</button>';});
  html+='</div>';

  html+='</div>'; // end compact controls row

  var rentPeriod=d.rentPeriod||'wk';

  // ── INPUTS ─────────────────────────────────────────────────────────────────
  html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:18px">';

  // Header row: title only (letting strategy chosen via 3-way toggle above)
  html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">';
  html+='<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Deal Inputs</div>';
  if(isSA) html+='<div style="font-size:10px;font-weight:600;color:#E04E53;background:#FFF1F2;border:1px solid #FECDD3;padding:3px 8px;border-radius:6px">🛏️ SA mode — nightly-rate income</div>';
  html+='</div>';

  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">';

  // Rooms — only meaningful for HMO. SA + Whole treat the property as one unit.
  var roomsDisabled = isWhole || isSA;
  html+='<div style="opacity:'+(roomsDisabled?'0.35':'1')+';pointer-events:'+(roomsDisabled?'none':'auto')+'">'
    +'<label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px">Rooms</label>'
    +'<div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden">'
    +'<span style="padding:0 8px;font-size:12px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:34px;display:flex;align-items:center;flex-shrink:0">#</span>'
    +'<input type="number" id="da-rooms" value="'+(d.rooms||4)+'" oninput="recalcDealPage()" '+(roomsDisabled?'disabled':'')+' style="flex:1;border:none;padding:7px 9px;font-size:13px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%">'
    +'</div></div>';

  html+=isOwned?inp('Purchase Price','da-price',d.price||'','£'):inp('LL Rent /mo','da-llrent',d.llrent||'','£');

  // Rent field — wk/mo for HMO & Whole, nightly for SA.
  var rentLabel = isSA ? 'Nightly Rate' : (isWhole ? 'Tenant Rent' : 'Rent / Room');
  html+='<div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
    +'<label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">'+rentLabel+'</label>';
  if(!isSA){
    html+='<div style="display:flex;gap:0;border:1px solid var(--border);border-radius:6px;overflow:hidden">'
      +'<button onclick="switchRentPeriod(\'wk\')" style="padding:2px 7px;border:none;background:'+(rentPeriod==='wk'?'var(--accent)':'var(--bg)')+';color:'+(rentPeriod==='wk'?'#fff':'var(--muted)')+';font-size:9px;font-weight:700;cursor:pointer;font-family:inherit">wk</button>'
      +'<button onclick="switchRentPeriod(\'mo\')" style="padding:2px 7px;border:none;background:'+(rentPeriod==='mo'?'var(--accent)':'var(--bg)')+';color:'+(rentPeriod==='mo'?'#fff':'var(--muted)')+';font-size:9px;font-weight:700;cursor:pointer;font-family:inherit">mo</button>'
      +'</div>';
  } else {
    html+='<span style="font-size:9px;font-weight:700;color:#E04E53;text-transform:uppercase;letter-spacing:.04em">/night</span>';
  }
  html+='</div>'
    +'<div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden">'
    +'<span style="padding:0 8px;font-size:12px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:34px;display:flex;align-items:center;flex-shrink:0">&pound;</span>'
    +'<input type="number" id="da-wkrent" value="'+(d.wkrent||'')+'" oninput="recalcDealPage()" placeholder="'+(isSA?'e.g. 120':'')+'" style="flex:1;border:none;padding:7px 9px;font-size:13px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%">'
    +'</div></div>';

  // SA-specific: cleaning fee per month + platform fee %
  if(isSA){
    html+=inp('Cleaning /mo','da-sa-clean',d.saClean||'','£');
    html+=inp('Platform Fee','da-sa-fee',d.saFee||15,'%');
  }

  html+=inp('Occupancy','da-occ',d.occ||85,'%');
  html+=inp('Bills','da-bills',d.bills||'','£');
  html+=inp('Maintenance','da-maint',d.maint||'','£');
  html+=inp('Insurance','da-insur',d.insur||'','£');
  html+=inp('Management','da-mgmt',d.mgmt||'','£');
  html+=inp('Void Allowance','da-void',d.voidCost||'','£');
  html+=inp('Other','da-other',d.other||'','£');
  if(isOwned){
    html+=inp('Deposit %','da-dep',d.dep||25,'%');
    html+=inp('Renovation','da-reno',d.reno||'','£');
    html+=inp('Mortgage Rate','da-mrate',d.mrate||4.5,'%');
    html+=inp('Mortgage Term','da-mterm',d.mterm||25,'yr');
  }
  html+='</div>';
  if(isOwned) html+='<div id="da-calc-mortgage" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></div>';

  // Per-room rents override — HMO only, rooms ≥ 2. Any filled value overrides the flat Rent/Room.
  if(!isWhole && !isSA){
    var roomCount = Math.max(1, Math.min(20, parseInt(d.rooms||4,10)||4));
    var roomRents = Array.isArray(d.roomRents) ? d.roomRents : [];
    if(roomCount >= 2){
      var anyFilled = roomRents.some(function(v){return (+v||0) > 0;});
      html+='<details style="margin-top:12px;background:var(--bg);border:1px dashed var(--border);border-radius:10px;padding:10px 14px"'+(anyFilled?' open':'')+'>'
        +'<summary style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;cursor:pointer;user-select:none">Set individual room rents <span style="font-weight:400;text-transform:none;color:var(--dim)">(optional — overrides the average above)</span></summary>'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:10px">';
      for(var ri=0; ri<roomCount; ri++){
        var rv = roomRents[ri] != null ? roomRents[ri] : '';
        html+='<div>'
          +'<label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px">Room '+(ri+1)+'</label>'
          +'<div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:7px;background:var(--surface);overflow:hidden">'
          +'<span style="padding:0 7px;font-size:11px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:30px;display:flex;align-items:center;flex-shrink:0">&pound;</span>'
          +'<input type="number" data-ri="'+ri+'" class="da-room-rent" value="'+rv+'" oninput="recalcDealPage()" placeholder="—" style="flex:1;border:none;padding:5px 7px;font-size:12px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%">'
          +'</div></div>';
      }
      html+='</div>'
        +'<div style="font-size:10px;color:var(--dim);margin-top:8px">If any rooms have a value, the deal income = sum of filled rooms + average for blanks. Leave all blank to use the flat Rent / Room above.</div>'
        +'</details>';
    }
  }
  html+='</div>';

  // ── RESULTS: full-width below inputs ─────────────────────────────────────────
  html+='<div id="da-results"><div style="padding:32px;text-align:center;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:14px">'
    +'<div style="font-size:28px;margin-bottom:8px">&#x1F9EE;</div>'
    +'<div style="font-size:13px">Fill in the figures above to see the analysis</div></div></div>';

  // AI section
  html+='<div style="margin-top:18px;background:linear-gradient(135deg,#0F0F1A,#1a1a3e);border-radius:14px;overflow:hidden">'
    +'<div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px">'
    +'<div style="display:flex;align-items:center;gap:12px"><div style="font-size:24px">&#x1F916;</div>'
    +'<div><div style="font-size:14px;font-weight:700;color:#fff">AI Deal Analysis</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.45)">Instant verdict — strengths, risks, suggestions</div></div></div>'
    +'<button onclick="runDealAI()" style="padding:9px 20px;border-radius:9px;border:none;background:#00D897;color:#000;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Analyze Deal</button></div>'
    +'<div id="da-ai-out" style="padding:0 20px 16px"></div></div>';

  return html;
}


// Snapshot current DOM input values into _scratch before any mode toggle re-render
// This ensures user's typed values survive the switchLettingType/switchDealType re-render
function _dealSaveInputsToScratch() {
  function gv(id){ var el=document.getElementById(id); return el?(parseFloat(el.value)||0):0; }
  if(!state.dealInputs) state.dealInputs={};
  if(!state.dealInputs._scratch) state.dealInputs._scratch={};
  var sc = state.dealInputs._scratch;
  // Only read fields that are currently visible (not disabled)
  var roomsEl = document.getElementById('da-rooms');
  // Always save the room count — even when disabled, the field value is valid
  if(roomsEl) { var rv = parseFloat(roomsEl.value)||0; if(rv>0) sc.rooms = rv; }
  sc.wkrent   = gv('da-wkrent');
  sc.occ      = gv('da-occ') || 85;
  sc.llrent   = gv('da-llrent');
  sc.bills    = gv('da-bills');
  sc.maint    = gv('da-maint');
  sc.insur    = gv('da-insur');
  sc.mgmt     = gv('da-mgmt');
  sc.voidCost = gv('da-void');
  sc.other    = gv('da-other');
  sc.price    = gv('da-price');
  sc.dep      = gv('da-dep') || 25;
  sc.reno     = gv('da-reno');
  sc.mrate    = gv('da-mrate') || 4.5;
  sc.mterm    = gv('da-mterm') || 25;
  // SA-specific inputs (only present when lettingType==='sa').
  var saCleanEl = document.getElementById('da-sa-clean');
  var saFeeEl   = document.getElementById('da-sa-fee');
  if(saCleanEl) sc.saClean = parseFloat(saCleanEl.value) || 0;
  if(saFeeEl)   sc.saFee   = parseFloat(saFeeEl.value)   || 15;
  // Per-room HMO rent overrides.
  var rrNodes = document.querySelectorAll('.da-room-rent');
  if(rrNodes && rrNodes.length){
    var rr = [];
    Array.prototype.forEach.call(rrNodes, function(n){
      var idx = parseInt(n.dataset.ri,10);
      if(!isNaN(idx)) rr[idx] = parseFloat(n.value) || 0;
    });
    sc.roomRents = rr;
  }
}

function recalcDealPage(){
  if(!state.dealInputs)state.dealInputs={};
  if(!document.getElementById('da-rooms'))return;
  function gv(id,def){var el=document.getElementById(id);return el?(parseFloat(el.value)||0):(def||0);}
  var sc=state.dealInputs._scratch||{};
  var dealType=sc.dealType||'r2r';
  var isOwned=dealType==='owned';
  var lettingType=sc.lettingType||'hmo';
  var isWhole=lettingType==='whole';
  var isSA=lettingType==='sa';
  // Always read the actual room count (even when field is disabled in Whole / SA mode)
  var inputRooms = Math.max(1, gv('da-rooms', sc.rooms||4));
  // For calc: Whole / SA treat the property as 1 revenue unit.
  var rooms = (isWhole||isSA) ? 1 : inputRooms;
  var wkRent=gv('da-wkrent',0); // HMO/Whole: weekly or monthly per field. SA: nightly.
  var occ=gv('da-occ',85);
  var llRent=isOwned?0:gv('da-llrent',0),bills=gv('da-bills',0),maint=gv('da-maint',0),insur=gv('da-insur',0),mgmt=gv('da-mgmt',0),voidC=gv('da-void',0),other=gv('da-other',0);
  var saClean=isSA?gv('da-sa-clean',0):0, saFee=isSA?gv('da-sa-fee',15):0;
  var price=isOwned?gv('da-price',0):0,dep=isOwned?gv('da-dep',25):0,reno=isOwned?gv('da-reno',0):0,mrate=isOwned?gv('da-mrate',4.5):0,mterm=isOwned?gv('da-mterm',25):0;
  // Per-room rent overrides (HMO only). Any filled value overrides that room's share.
  var roomRents = [];
  if(!isWhole && !isSA){
    var nodes = document.querySelectorAll('.da-room-rent');
    Array.prototype.forEach.call(nodes, function(n){
      var idx = parseInt(n.dataset.ri,10);
      if(!isNaN(idx)) roomRents[idx] = parseFloat(n.value) || 0;
    });
  }
  var mortPayment=0;
  if(isOwned&&price&&mrate&&mterm){var loan=price*(1-dep/100),mr=mrate/100/12,n=mterm*12;mortPayment=mr>0?Math.round(loan*mr*Math.pow(1+mr,n)/(Math.pow(1+mr,n)-1)):0;var mcEl=document.getElementById('da-calc-mortgage');if(mcEl)mcEl.innerHTML=mortPayment?'Est. mortgage: <strong>'+fmt(mortPayment)+'/mo</strong>':'';}
  var primaryCost=isOwned?mortPayment:llRent;
  var rentPeriod=sc.rentPeriod||'wk';
  var rentMo = isSA ? 0 : (rentPeriod==='mo' ? wkRent : wkRent*52/12);
  // Gross income per model:
  //  · SA:    nightly × 30.44 × occupancy%
  //  · Whole: monthly rent × occupancy%
  //  · HMO:   (sum of per-room overrides + avg for blanks) × occupancy%
  var grossIncome;
  if(isSA){
    grossIncome = Math.round(wkRent * 30.44 * occ/100);
  } else if(isWhole){
    grossIncome = Math.round(rentMo * occ/100);
  } else {
    var filled = roomRents.filter(function(v){return (+v||0) > 0;});
    if(filled.length){
      var sumFilled = filled.reduce(function(s,v){return s+(+v||0);},0);
      var blanks = Math.max(0, inputRooms - filled.length);
      // Blanks use the flat Rent/Room figure as the fallback per-room rate.
      var weeklySum = sumFilled + blanks*wkRent;
      var monthlySum = rentPeriod==='mo' ? weeklySum : weeklySum*52/12;
      grossIncome = Math.round(monthlySum * occ/100);
    } else {
      grossIncome = Math.round(rooms * rentMo * occ/100);
    }
  }
  var runningCosts=bills+maint+insur+mgmt+voidC+other;
  // SA: platform fee is % of gross, cleaning is a fixed monthly add-on on top of running costs.
  var saPlatformCost = isSA ? Math.round(grossIncome * saFee/100) : 0;
  if(isSA){ runningCosts += saClean + saPlatformCost; }
  var totalCosts=primaryCost+runningCosts,net=grossIncome-totalCosts,margin=grossIncome>0?Math.round(net/grossIncome*100):0,annualNet=net*12;
  var cashIn=isOwned?Math.max(1,price*dep/100+reno):0;
  var grossYield=(isOwned&&price>0)?+((grossIncome*12/price)*100).toFixed(1):0;
  var netYield=(isOwned&&price>0)?+((annualNet/price)*100).toFixed(1):0;
  var roi=(isOwned&&price>0&&cashIn>100&&annualNet>0)?+(annualNet/cashIn*100).toFixed(1):0;
  var payback=(isOwned&&price>0&&cashIn>100&&net>0)?+(cashIn/net/12).toFixed(1):0;
  var breakEven=(!isOwned&&!isSA&&grossIncome>0&&rooms>0)?Math.ceil(totalCosts/(grossIncome/rooms)):0;
  state.dealInputs._scratch={dealType:dealType,lettingType:lettingType,rentPeriod:sc.rentPeriod||'wk',rooms:inputRooms,wkrent:wkRent,occ:occ,llrent:llRent,bills:bills,maint:maint,insur:insur,mgmt:mgmt,voidCost:voidC,other:other,price:price,dep:dep,reno:reno,mrate:mrate,mterm:mterm,saClean:saClean,saFee:saFee,roomRents:roomRents,_grossIncome:grossIncome,_totalCosts:totalCosts};
  clearTimeout(window._dealSaveTimer);window._dealSaveTimer=setTimeout(function(){saveState();},800);
  function col(v,g,a){return v>=g?'var(--green)':v>=a?'var(--amber)':'var(--red)';}
  var nc=net>=0?'var(--green)':'var(--red)';
  function kpic(lbl,val,c,sub){return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+lbl+'</div><div style="font-size:22px;font-weight:800;font-family:monospace;color:'+c+'">'+val+'</div>'+(sub?'<div style="font-size:10px;color:var(--dim);margin-top:3px">'+sub+'</div>':'')+'</div>';}
  var kpiHtml='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">'+kpic('Monthly Net',fmt(net),nc)+kpic('Annual Net',fmt(annualNet),nc);
  if(!isOwned){
    kpiHtml+=kpic('Profit Margin',margin+'%',col(margin,20,10),'net / income');
    if(isWhole){
      var voidMonths=net>0&&totalCosts>0?Math.floor(net*12/totalCosts*10)/10:0;
      kpiHtml+=kpic('Void Buffer',voidMonths>0?voidMonths+' mo':'—',col(voidMonths,3,1),'months surplus covers void');
    } else {
      kpiHtml+=kpic('Break-even',breakEven?breakEven+' rooms':'—',breakEven&&breakEven<=Math.floor(rooms*0.75)?'var(--green)':'var(--amber)','rooms to cover costs');
    }
  }
  else{kpiHtml+=kpic('Gross Yield',grossYield>0?grossYield+'%':'—',col(grossYield,8,5),'annual rent / price')+kpic('Net Yield',netYield>0?netYield+'%':'—',col(netYield,5,3))+kpic('Cash ROI',roi>0?roi+'%':'—',col(roi,10,5),'net / cash in')+kpic('Payback',payback>0?payback+' yrs':'—',payback&&payback<10?'var(--green)':'var(--amber)');}
  kpiHtml+='</div>';
  var bp=grossIncome>0?Math.min(100,Math.round(totalCosts/grossIncome*100)):100;
  var plHtml='<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Monthly P&L</div>'
    +'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--muted)">Gross income ('+occ+'% occ.)</span><span style="font-size:13px;font-weight:700;color:var(--green);font-family:monospace">'+fmt(grossIncome)+'</span></div>'
    +(isOwned?'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--muted)">Mortgage</span><span style="font-size:13px;font-weight:700;color:var(--red);font-family:monospace">- '+fmt(mortPayment)+'</span></div>':'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--muted)">Landlord rent</span><span style="font-size:13px;font-weight:700;color:var(--red);font-family:monospace">- '+fmt(llRent)+'</span></div>')
    +'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--muted)">Running costs</span><span style="font-size:13px;font-weight:700;color:var(--amber);font-family:monospace">- '+fmt(runningCosts)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 14px;background:'+(net>=0?'var(--green-light)':'var(--red-light)')+';margin:6px -14px -14px;border-radius:0 0 11px 11px"><span style="font-size:13px;font-weight:700">Net Profit / Loss</span><span style="font-size:16px;font-weight:800;color:'+nc+';font-family:monospace">'+fmt(net)+'/mo</span></div></div>';
  var barHtml='<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:8px"><span>Cost ratio: '+bp+'%</span><span>Income: '+fmt(grossIncome)+'/mo</span></div><div style="height:12px;border-radius:6px;background:var(--green-light);overflow:hidden"><div style="height:100%;width:'+bp+'%;background:'+(bp>90?'var(--red)':bp>70?'var(--amber)':'var(--green)')+';border-radius:6px;transition:width .4s"></div></div><div style="text-align:right;font-size:10px;color:var(--muted);margin-top:5px">'+(bp<70?'Healthy margin':bp<90?'Tight margin':'Loss-making')+'</div></div>';
  // 12-month cumulative profit chart (Option D). Replaces the old static
  // "12 identical bars" chart with a running-total view: each bar = cumulative
  // net profit at end of that month, applying the same 3%/2% growth and
  // inflation rates the 5-year table uses. For owned deals the cumulative
  // starts at -cashIn (deposit + reno) so red bars near the start visualise
  // "still in the hole on cash-in" and the crossover to green = the deal has
  // paid you back. R2R deals start at £0 and climb green throughout. No
  // pulsing animations, no break-even text labels — just clean bars.
  var cfCashIn = isOwned ? Math.max(0, price*dep/100 + reno) : 0;
  var cfMG = Math.pow(1.03, 1/12), cfMI = Math.pow(1.02, 1/12);
  var cfRows = [], cfCum = -cfCashIn;
  for (var cfm = 0; cfm < 12; cfm++) {
    var cfInc = grossIncome * Math.pow(cfMG, cfm);
    var cfCst = totalCosts   * Math.pow(cfMI, cfm);
    cfCum += (cfInc - cfCst);
    cfRows.push(cfCum);
  }
  // Y-range: covers cumulative min (negative for owned) up through max,
  // with 8% padding either side so bars never touch the chart edge.
  var cfMin = Math.min.apply(null, cfRows.concat([0, -cfCashIn]));
  var cfMax = Math.max.apply(null, cfRows.concat([0, 100]));
  var cfSpan = cfMax - cfMin; cfMin -= cfSpan*0.08; cfMax += cfSpan*0.08;
  // Find the first month where cumulative crosses from negative to positive
  // (only meaningful for owned deals with a real cash-in).
  var cfBeIdx = -1;
  for (var cfb = 0; cfb < cfRows.length; cfb++) {
    if (cfRows[cfb] >= 0 && (cfb === 0 ? cfCashIn > 0 : cfRows[cfb-1] < 0)) { cfBeIdx = cfb; break; }
  }
  function cfFmt(v){ var n = Math.round(v); var s = n<0?'-':''; var a = Math.abs(n); if (a>=1e6) return s+'£'+(a/1e6).toFixed(1)+'m'; if (a>=1000) return s+'£'+Math.round(a/1000)+'k'; return s+'£'+a; }
  function cfFmtFull(v){ var n = Math.round(v); var s = n<0?'-':''; return s + '£' + Math.abs(n).toLocaleString(); }

  var W = 820, H = 240, axisW = 64, padR = 16, padT = 28, padB = 36;
  var plotW = W - axisW - padR, plotH = H - padT - padB;
  function cfY(v){ return padT + plotH - ((v - cfMin) / (cfMax - cfMin)) * plotH; }
  var slotW = plotW / 12, barW = Math.min(38, slotW * 0.62), barOff = (slotW - barW)/2;
  var zeroY = cfY(0);

  var svg = '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block">';
  // Self-contained gradients + animation classes via inline <defs><style> — no
  // global CSS dependency; works wherever the chart is rendered.
  svg += '<defs>'
    + '<linearGradient id="daProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#10B981"/><stop offset="100%" stop-color="#A7F3D0"/></linearGradient>'
    + '<linearGradient id="daLoss"   x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FECACA"/><stop offset="100%" stop-color="#EF4444"/></linearGradient>'
    + '<style>'
    +   '.da-bar{transform-origin:bottom;animation:daGrow .9s cubic-bezier(.22,1,.36,1) both}'
    +   '.da-bar.neg{transform-origin:top}'
    +   '.da-d0{animation-delay:.05s}.da-d1{animation-delay:.10s}.da-d2{animation-delay:.15s}'
    +   '.da-d3{animation-delay:.20s}.da-d4{animation-delay:.25s}.da-d5{animation-delay:.30s}'
    +   '.da-d6{animation-delay:.35s}.da-d7{animation-delay:.40s}.da-d8{animation-delay:.45s}'
    +   '.da-d9{animation-delay:.50s}.da-d10{animation-delay:.55s}.da-d11{animation-delay:.60s}'
    +   '@keyframes daGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}'
    +   '.da-fade{opacity:0;animation:daFade .8s ease-out forwards;animation-delay:.85s}'
    +   '@keyframes daFade{to{opacity:1}}'
    + '</style>'
    + '</defs>';
  // Y-axis: top, zero (heavier dashed grey baseline), bottom
  [cfMax, 0, cfMin].forEach(function(v){
    var yy = cfY(v);
    var isZero = v === 0;
    svg += '<line x1="'+axisW+'" y1="'+yy+'" x2="'+(W-padR)+'" y2="'+yy+'" stroke="'+(isZero?'#94A3B8':'#E5E7EB')+'" stroke-width="1" '+(isZero?'stroke-dasharray="6 4"':'stroke-dasharray="3 3"')+'/>';
    svg += '<text x="'+(axisW-8)+'" y="'+(yy+3)+'" text-anchor="end" font-size="10" font-weight="'+(isZero?700:400)+'" fill="'+(isZero?'#475569':'#64748B')+'">'+cfFmt(v)+'</text>';
  });
  // Vertical guide where bars cross from red→green (line only, no text label)
  if (cfBeIdx >= 0) {
    var beX = axisW + cfBeIdx * slotW + slotW/2;
    svg += '<line class="da-fade" x1="'+beX+'" y1="'+padT+'" x2="'+beX+'" y2="'+(H-padB+4)+'" stroke="#0D9488" stroke-width="1" stroke-dasharray="4 3" opacity=".55"/>';
  }
  // 12 bars
  cfRows.forEach(function(cv, ix){
    var slotX = axisW + ix * slotW;
    var bx = slotX + barOff;
    var positive = cv >= 0;
    var topY = positive ? cfY(cv) : zeroY;
    var botY = positive ? zeroY    : cfY(cv);
    var h = botY - topY; if (h < 1) h = 1;
    var fill = positive ? 'url(#daProfit)' : 'url(#daLoss)';
    var cls = 'da-bar da-d'+ix + (positive ? '' : ' neg');
    svg += '<rect class="'+cls+'" x="'+bx+'" y="'+topY+'" width="'+barW+'" height="'+h+'" fill="'+fill+'" rx="3"/>';
  });
  // Year-end cumulative value — static label above (or below, if negative) last bar
  var cfLast = cfRows[11];
  var cfLastX = axisW + 11 * slotW + slotW/2;
  var cfLastY = cfY(cfLast);
  var cfLblY = cfLast >= 0 ? cfLastY - 10 : cfLastY + 16;
  svg += '<text class="da-fade" x="'+cfLastX+'" y="'+cfLblY+'" text-anchor="middle" font-size="12" font-weight="800" fill="'+(cfLast>=0?'#0D9488':'#B91C1C')+'">'+cfFmtFull(cfLast)+'</text>';
  // Month labels — every other month + month 12, kept lightweight
  for (var ml = 0; ml < 12; ml++){
    if (ml % 2 !== 0 && ml !== 11) continue;
    var mlx = axisW + ml*slotW + slotW/2;
    svg += '<text x="'+mlx+'" y="'+(H-12)+'" text-anchor="middle" font-size="10" fill="#64748B">M'+(ml+1)+'</text>';
  }
  svg += '</svg>';
  var chartHtml = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;margin-bottom:16px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">'
    +   '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">12-Month Projection · Cumulative profit</div>'
    +   '<div style="font-size:10px;color:var(--dim)">3% income growth · 2% cost inflation</div>'
    + '</div>'
    + svg
    + '</div>';
  var yr5='<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;overflow:hidden;margin-bottom:4px"><div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">5-Year Outlook <span style="font-weight:400;text-transform:none">(3% growth, 2% cost inflation)</span></div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--bg)"><th style="padding:6px 12px;text-align:left;color:var(--muted);font-size:10px;text-transform:uppercase">Year</th><th style="padding:6px 12px;text-align:right;color:var(--muted);font-size:10px;text-transform:uppercase">Income</th><th style="padding:6px 12px;text-align:right;color:var(--muted);font-size:10px;text-transform:uppercase">Costs</th><th style="padding:6px 12px;text-align:right;color:var(--muted);font-size:10px;text-transform:uppercase">Net</th></tr></thead><tbody>';
  for(var yr=1;yr<=5;yr++){var yi=Math.round(grossIncome*12*Math.pow(1.03,yr-1)),yc=Math.round(totalCosts*12*Math.pow(1.02,yr-1)),yn=yi-yc;yr5+='<tr style="border-top:1px solid var(--border);background:'+(yr%2?'var(--bg)':'var(--surface)')+'"><td style="padding:6px 12px;font-weight:600">Year '+yr+'</td><td style="padding:6px 12px;text-align:right;color:var(--green);font-family:monospace">'+fmt(yi)+'</td><td style="padding:6px 12px;text-align:right;color:var(--red);font-family:monospace">'+fmt(yc)+'</td><td style="padding:6px 12px;text-align:right;font-weight:700;color:'+(yn>=0?'var(--green)':'var(--red)')+';font-family:monospace">'+fmt(yn)+'</td></tr>';}
  yr5+='</tbody></table></div>';
  var resEl=document.getElementById('da-results');
  if(resEl)resEl.innerHTML=kpiHtml+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+plHtml+barHtml+'</div>'+chartHtml+yr5;
  // Auto-update local analysis on every input change
  clearTimeout(window._localAnalysisTimer);
  window._localAnalysisTimer=setTimeout(function(){
    var aiOut=document.getElementById('da-ai-out');
    if(aiOut){
      var result=analyzeLocalDeal();
      if(result) aiOut.innerHTML=renderLocalDealOutput(result);
    }
  },600);
}


function propViewList(){state.filters.propView='list';render();}
function propViewDeal(){
  // Always open Deal Analyzer with a blank slate
  if(!state.dealInputs) state.dealInputs={};
  state.dealInputs._scratch={};
  state.filters.propView='deal';
  render();
}
function switchRentPeriod(period){
  if(!state.dealInputs)state.dealInputs={};
  if(!state.dealInputs._scratch)state.dealInputs._scratch={};
  _dealSaveInputsToScratch();
  state.dealInputs._scratch.rentPeriod=period;
  state.filters.propView='deal';
  render();
  setTimeout(recalcDealPage,50);
};
function switchLettingType(lt){
  if(!state.dealInputs)state.dealInputs={};
  if(!state.dealInputs._scratch)state.dealInputs._scratch={};
  // Preserve all current input values before re-rendering
  _dealSaveInputsToScratch();
  state.dealInputs._scratch.lettingType=lt;
  state.filters.propView='deal';
  saveState();render();
  setTimeout(recalcDealPage,50);
}
function switchDealType(t){
  if(!state.dealInputs)state.dealInputs={};
  if(!state.dealInputs._scratch)state.dealInputs._scratch={};
  _dealSaveInputsToScratch();
  state.dealInputs._scratch.dealType=t;
  state.filters.propView='deal';
  saveState();render();
  setTimeout(recalcDealPage,50);
}
function resetDealPage(){if(!state.dealInputs)state.dealInputs={};delete state.dealInputs._scratch;state.filters.propView='deal';saveState();render();}
function saveDealScenario(){if(!state.dealInputs||!state.dealInputs._scratch){showToast('Enter some figures first','error');return;}var name=prompt('Name this scenario:');if(!name)return;var id='sc_'+Date.now();state.dealInputs[id]=Object.assign({},state.dealInputs._scratch,{_name:name,_id:id});state.filters.propView='deal';saveState();render();showToast('Saved: '+name,'success');}
function loadDealScenario(id){
  if(!state.dealInputs) return;
  // Empty value (user picked the "📁 Saved deal…" placeholder in the dropdown)
  // — unlink from any currently-loaded scenario but keep the inputs intact so
  // the user can keep working without losing what they've typed.
  if(!id){
    if(state.dealInputs._scratch){
      delete state.dealInputs._scratch._id;
      delete state.dealInputs._scratch._name;
    }
    saveState();
    render();
    return;
  }
  if(!state.dealInputs[id]) return;
  state.dealInputs._scratch=Object.assign({},state.dealInputs[id]);
  state.page='properties';state.filters.propView='deal';saveState();render();
}
function deleteDealScenario(id){if(!state.dealInputs||!state.dealInputs[id])return;if(!confirm('Delete "'+state.dealInputs[id]._name+'"?'))return;delete state.dealInputs[id];state.filters.propView='deal';saveState();render();}


// Deal AI is now LOCAL-ONLY. The cloud Claude path was removed to avoid per-call
// API spend; the rules-based scoring engine in section 37 (analyzeLocalDeal /
// renderLocalDealOutput) is the single code path. No "AI unavailable" toast.
async function runDealAI(){
  var outEl=document.getElementById('da-ai-out');if(!outEl)return;
  _dealSaveInputsToScratch();
  var d=(state.dealInputs&&state.dealInputs._scratch)||{};
  if(!d.rooms&&!d.wkrent){showToast('Enter deal figures first','error');return;}
  var localResult=analyzeLocalDeal();
  if(localResult){
    outEl.innerHTML=renderLocalDealOutput(localResult);
  } else {
    outEl.innerHTML='<div style="padding:8px 0;font-size:12px;color:rgba(255,255,255,.6)">Add a few more figures to see a verdict.</div>';
  }
}
