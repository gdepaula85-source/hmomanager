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

  // Scenario pills
  var scBar='';
  if(scenarios.length){
    scBar='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:var(--bg);border-radius:10px;border:1px solid var(--border)"><span style="font-size:11px;font-weight:700;color:var(--muted)">Saved:</span>';
    scenarios.forEach(function(sc){var net2=(sc._grossIncome||0)-(sc._totalCosts||0);
      scBar+='<div style="display:flex;align-items:center;border:1px solid var(--border);border-radius:20px;background:var(--surface);overflow:hidden">'
        +'<button data-scid="'+sc._id+'" onclick="loadDealScenario(this.dataset.scid)" style="padding:5px 12px;border:none;background:transparent;font-size:12px;cursor:pointer;font-family:inherit"><span style="font-weight:600">'+sc._name+'</span> <span style="color:'+(net2>=0?'var(--green)':'var(--red)')+';font-weight:700;font-family:monospace">'+fmt(net2)+'/mo</span></button>'
        +'<button data-scid="'+sc._id+'" onclick="deleteDealScenario(this.dataset.scid)" style="padding:5px 8px;border:none;border-left:1px solid var(--border);background:transparent;color:var(--dim);cursor:pointer;font-size:12px">&times;</button></div>';
    });scBar+='</div>';
  }

  var html='<div class="page-header"><div style="display:flex;align-items:center;gap:12px">'
    +'<button onclick="propViewList()" style="padding:7px 12px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">&larr; Properties</button>'
    +'<div><div class="page-title">Deal Analyzer</div><div class="page-sub">Model any deal before committing</div></div></div>'
    +'<div style="display:flex;gap:8px"><button onclick="saveDealScenario()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Scenario</button>'
    +'<button onclick="resetDealPage()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">Reset</button></div></div>';

  html+=scBar;

  var isWhole=(d.lettingType||'hmo')==='whole';

  // Deal type toggle (R2R / Owned) — single row
  html+='<div style="display:flex;gap:0;background:var(--bg);border:1.5px solid var(--border);border-radius:11px;padding:3px;margin-bottom:18px;width:fit-content">';
  ['r2r','owned'].forEach(function(t){var active=(d.dealType||'r2r')===t;
    html+='<button data-dt="'+t+'" onclick="switchDealType(this.dataset.dt)" style="padding:9px 22px;border-radius:8px;border:none;background:'+(active?'var(--surface)':'transparent')+';box-shadow:'+(active?'0 1px 4px rgba(0,0,0,.1)':'none')+';font-size:13px;font-weight:'+(active?700:500)+';color:'+(active?'var(--text)':'var(--muted)')+';cursor:pointer;font-family:inherit">'+(t==='r2r'?'Rent-to-Rent (R2R)':'Owned / BTL')+'</button>';});
  html+='</div>';

  var rentPeriod=d.rentPeriod||'wk';

  // ── INPUTS ─────────────────────────────────────────────────────────────────
  html+='<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:18px">';

  // Header row: title + whole-property toggle
  html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">';
  html+='<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Deal Inputs</div>';
  html+='<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--muted);">'
    +'<span>Whole Property</span>'
    +'<div data-lt="'+(isWhole?'hmo':'whole')+'" onclick="switchLettingType(this.dataset.lt)" style="width:36px;height:20px;border-radius:10px;background:'+(isWhole?'var(--accent)':'var(--border)')+';position:relative;cursor:pointer;transition:background .2s">'
    +'<div style="width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:2px;left:'+(isWhole?'18px':'2px')+';transition:left .2s"></div></div>'
    +'</label></div>';

  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">';

  // Rooms — greyed + disabled for whole property
  html+='<div style="opacity:'+(isWhole?'0.35':'1')+';pointer-events:'+(isWhole?'none':'auto')+'">'
    +'<label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px">Rooms</label>'
    +'<div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden">'
    +'<span style="padding:0 8px;font-size:12px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:34px;display:flex;align-items:center;flex-shrink:0">#</span>'
    +'<input type="number" id="da-rooms" value="'+(d.rooms||4)+'" oninput="recalcDealPage()" '+(isWhole?'disabled':'')+' style="flex:1;border:none;padding:7px 9px;font-size:13px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%">'
    +'</div></div>';

  html+=isOwned?inp('Purchase Price','da-price',d.price||'','£'):inp('LL Rent /mo','da-llrent',d.llrent||'','£');

  // Rent per room — with wk/mo toggle in the label
  html+='<div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
    +'<label style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">'+(isWhole?'Tenant Rent':'Rent / Room')+'</label>'
    +'<div style="display:flex;gap:0;border:1px solid var(--border);border-radius:6px;overflow:hidden">'
    +'<button onclick="switchRentPeriod(\'wk\')" style="padding:2px 7px;border:none;background:'+(rentPeriod==='wk'?'var(--accent)':'var(--bg)')+';color:'+(rentPeriod==='wk'?'#fff':'var(--muted)')+';font-size:9px;font-weight:700;cursor:pointer;font-family:inherit">wk</button>'
    +'<button onclick="switchRentPeriod(\'mo\')" style="padding:2px 7px;border:none;background:'+(rentPeriod==='mo'?'var(--accent)':'var(--bg)')+';color:'+(rentPeriod==='mo'?'#fff':'var(--muted)')+';font-size:9px;font-weight:700;cursor:pointer;font-family:inherit">mo</button>'
    +'</div></div>'
    +'<div style="display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden">'
    +'<span style="padding:0 8px;font-size:12px;color:var(--muted);background:var(--bg);border-right:1px solid var(--border);height:34px;display:flex;align-items:center;flex-shrink:0">&pound;</span>'
    +'<input type="number" id="da-wkrent" value="'+(d.wkrent||'')+'" oninput="recalcDealPage()" style="flex:1;border:none;padding:7px 9px;font-size:13px;font-family:monospace;background:transparent;outline:none;min-width:0;color:var(--text);width:100%">'
    +'</div></div>';

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
}

function recalcDealPage(){
  if(!state.dealInputs)state.dealInputs={};
  if(!document.getElementById('da-rooms'))return;
  function gv(id,def){var el=document.getElementById(id);return el?(parseFloat(el.value)||0):(def||0);}
  var sc=state.dealInputs._scratch||{};
  var dealType=sc.dealType||'r2r';
  var isOwned=dealType==='owned';
  var isWhole=(sc.lettingType||'hmo')==='whole';
  // Always read the actual room count (even when field is disabled in Whole Property mode)
  var inputRooms = Math.max(1, gv('da-rooms', sc.rooms||4));
  // For calc: Whole Property = 1 unit, HMO = actual room count
  var rooms = isWhole ? 1 : inputRooms;
  var wkRent=gv('da-wkrent',0); // same field for both HMO and whole property
  var occ=gv('da-occ',85);
  var llRent=isOwned?0:gv('da-llrent',0),bills=gv('da-bills',0),maint=gv('da-maint',0),insur=gv('da-insur',0),mgmt=gv('da-mgmt',0),voidC=gv('da-void',0),other=gv('da-other',0);
  var price=isOwned?gv('da-price',0):0,dep=isOwned?gv('da-dep',25):0,reno=isOwned?gv('da-reno',0):0,mrate=isOwned?gv('da-mrate',4.5):0,mterm=isOwned?gv('da-mterm',25):0;
  var mortPayment=0;
  if(isOwned&&price&&mrate&&mterm){var loan=price*(1-dep/100),mr=mrate/100/12,n=mterm*12;mortPayment=mr>0?Math.round(loan*mr*Math.pow(1+mr,n)/(Math.pow(1+mr,n)-1)):0;var mcEl=document.getElementById('da-calc-mortgage');if(mcEl)mcEl.innerHTML=mortPayment?'Est. mortgage: <strong>'+fmt(mortPayment)+'/mo</strong>':'';}
  var primaryCost=isOwned?mortPayment:llRent;
  var rentPeriod=sc.rentPeriod||'wk';
  var rentMo=rentPeriod==='mo'?wkRent:wkRent*52/12; // wkRent field holds the value regardless of period
  var grossIncome=isWhole?Math.round(rentMo*occ/100):Math.round(rooms*rentMo*occ/100);
  var runningCosts=bills+maint+insur+mgmt+voidC+other;
  var totalCosts=primaryCost+runningCosts,net=grossIncome-totalCosts,margin=grossIncome>0?Math.round(net/grossIncome*100):0,annualNet=net*12;
  var cashIn=isOwned?Math.max(1,price*dep/100+reno):0;
  var grossYield=(isOwned&&price>0)?+((grossIncome*12/price)*100).toFixed(1):0;
  var netYield=(isOwned&&price>0)?+((annualNet/price)*100).toFixed(1):0;
  var roi=(isOwned&&price>0&&cashIn>100&&annualNet>0)?+(annualNet/cashIn*100).toFixed(1):0;
  var payback=(isOwned&&price>0&&cashIn>100&&net>0)?+(cashIn/net/12).toFixed(1):0;
  var breakEven=(!isOwned&&grossIncome>0)?Math.ceil(totalCosts/(grossIncome/rooms)):0;
  state.dealInputs._scratch={dealType:dealType,lettingType:sc.lettingType||'hmo',rentPeriod:sc.rentPeriod||'wk',rooms:inputRooms,wkrent:wkRent,occ:occ,llrent:llRent,bills:bills,maint:maint,insur:insur,mgmt:mgmt,voidCost:voidC,other:other,price:price,dep:dep,reno:reno,mrate:mrate,mterm:mterm,_grossIncome:grossIncome,_totalCosts:totalCosts};
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
  var MLBLS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],nowM=new Date().getMonth();
  var maxV=Math.max(grossIncome,totalCosts,1)*1.2,W=380,H=120,bW=10,gp=2,gW=bW*2+gp+9,oX=28,oY=8,aH=H-oY-22;
  var svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:120px;display:block">';
  for(var i=0;i<12;i++){var x=oX+i*gW,iH=Math.max(2,Math.round((grossIncome/maxV)*aH)),cH=Math.max(2,Math.round((totalCosts/maxV)*aH));svg+='<rect x="'+x+'" y="'+(oY+aH-iH)+'" width="'+bW+'" height="'+iH+'" fill="#10B981" rx="2" opacity=".9"/><rect x="'+(x+bW+gp)+'" y="'+(oY+aH-cH)+'" width="'+bW+'" height="'+cH+'" fill="'+(totalCosts>grossIncome?'#E8375A':'#F59E0B')+'" rx="2" opacity=".85"/><text x="'+(x+bW)+'" y="'+(H-4)+'" text-anchor="middle" font-size="7.5" fill="#94A3B8">'+MLBLS[(i+nowM)%12]+'</text>';}
  svg+='<rect x="4" y="3" width="8" height="8" fill="#10B981" rx="1"/><text x="14" y="10" font-size="8" fill="#64748B">Income</text><rect x="60" y="3" width="8" height="8" fill="#F59E0B" rx="1"/><text x="70" y="10" font-size="8" fill="#64748B">Costs</text></svg>';
  var chartHtml='<div style="background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">12-Month Projection</div>'+svg+'</div>';
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
function loadDealScenario(id){if(!state.dealInputs||!state.dealInputs[id])return;state.dealInputs._scratch=Object.assign({},state.dealInputs[id]);state.page='properties';state.filters.propView='deal';saveState();render();}
function deleteDealScenario(id){if(!state.dealInputs||!state.dealInputs[id])return;if(!confirm('Delete "'+state.dealInputs[id]._name+'"?'))return;delete state.dealInputs[id];state.filters.propView='deal';saveState();render();}


async function runDealAI(){
  var outEl=document.getElementById('da-ai-out');if(!outEl)return;
  _dealSaveInputsToScratch();
  var d=(state.dealInputs&&state.dealInputs._scratch)||{};if(!d.rooms&&!d.wkrent){showToast('Enter deal figures first','error');return;}
  var isOwned=d.dealType==='owned',grossIncome=d._grossIncome||0,totalCosts=d._totalCosts||0,net=grossIncome-totalCosts;
  var margin=grossIncome>0?Math.round(net/grossIncome*100):0,cashIn=isOwned?Math.max(1,(d.price||0)*(d.dep||25)/100+(d.reno||0)):0;
  var roi=(cashIn&&net&&(d.price||0)>0)?+(net*12/cashIn*100).toFixed(1):0;
  var grossYield=(isOwned&&(d.price||0)>0)?+((grossIncome*12/d.price)*100).toFixed(1):0;
  var breakEven=(!isOwned&&grossIncome>0)?Math.ceil(totalCosts/(grossIncome/Math.max(1,d.rooms||1))):0;
  outEl.innerHTML='<div style="padding:12px 0;display:flex;align-items:center;gap:10px"><div style="width:20px;height:20px;border:2px solid #00D897;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></div><span style="font-size:12px;color:rgba(255,255,255,.5)">Analyzing...</span></div>';
  var prompt='UK property investment expert. Analyze this '+(isOwned?'BTL':'R2R')+' deal. Return ONLY valid JSON, no markdown.\nRooms: '+(d.rooms||0)+'\nWeekly rent/room: '+(d.wkrent||0)+'\nOccupancy: '+(d.occ||85)+'%\nGross monthly income: '+grossIncome+'\nTotal costs: '+totalCosts+'\nNet monthly: '+net+'\nMargin: '+margin+'%\n'+(isOwned?'Purchase: '+(d.price||0)+', Cash in: '+cashIn+', Yield: '+grossYield+'%\n':'Break-even: '+breakEven+' rooms\n')+'Return: {"score":0-100,"verdict":"GO|CAUTION|NO-GO","headline":"under 20 words","strengths":["max 3"],"risks":["max 3"],"suggestions":["max 3"]}';
  function liDeal(arr,icon,c){return(arr||[]).map(function(s){return '<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:rgba(255,255,255,.75);margin-bottom:5px;line-height:1.45"><span style="color:'+c+';flex-shrink:0;margin-top:1px">'+icon+'</span>'+s+'</div>';}).join('');}
  function applyCloudResult(r){
    var vCol=r.verdict==='GO'?'#00D897':r.verdict==='CAUTION'?'#F5A623':'#FF4D6A';
    outEl.innerHTML='<div style="padding:12px 0"><div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08)"><div style="width:52px;height:52px;border-radius:50%;border:2.5px solid '+vCol+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><div style="font-size:18px;font-weight:800;color:'+vCol+'">'+r.score+'</div></div><div><div style="font-size:15px;font-weight:800;color:'+vCol+';margin-bottom:3px">'+r.verdict+'</div><div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.4">'+r.headline+'</div></div></div>'+(r.strengths&&r.strengths.length?'<div style="margin-bottom:10px">'+liDeal(r.strengths,'&#x2713;','#00D897')+'</div>':'')+(r.risks&&r.risks.length?'<div style="margin-bottom:10px">'+liDeal(r.risks,'!','#FF4D6A')+'</div>':'')+(r.suggestions&&r.suggestions.length?'<div>'+liDeal(r.suggestions,'&#x2192;','#F5A623')+'</div>':'')+'</div>';
  }
  try{
    var res=await fetchAiMessages({model:'claude-sonnet-4-20250514',max_tokens:700,messages:[{role:'user',content:prompt}]});
    var data=await res.json();
    if(!res.ok){
      var msg=(data&&data.error&&(typeof data.error==='string'?data.error:data.error.message))||'AI unavailable';
      throw new Error(msg);
    }
    if(data.error)throw new Error(typeof data.error==='string'?data.error:(data.error.message||'AI error'));
    var txt=(data.content||[]).map(function(b){return b.text||'';}).join('').replace(/```json|```/g,'').trim();
    var r=JSON.parse(txt);
    applyCloudResult(r);
  }catch(err){
    var localResult=analyzeLocalDeal();
    outEl.innerHTML=renderLocalDealOutput(localResult);
    if(localResult)showToast('Showing local analysis — '+err.message,'warn');
    else outEl.innerHTML='<div style="padding:8px 0;font-size:12px;color:#FF4D6A">'+err.message+'</div>';
  }
}
