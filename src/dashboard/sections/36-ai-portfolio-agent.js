// ── AI PORTFOLIO AGENT ────────────────────────────────────────────────────────
var _agentRunning = false;

function buildPortfolioSnapshot() {
  var active  = state.tenants.filter(function(t){return t.status==='active';});
  var notice  = state.tenants.filter(function(t){return t.status==='notice_given';});
  var arrears = active.filter(function(t){return (t.arrears||0)>0;});
  var arrTotal = arrears.reduce(function(s,t){return s+(t.arrears||0);},0);
  var vacant = [];
  state.properties.forEach(function(p){
    (p.roomList||[]).forEach(function(r){
      if(r.status==='vacant'){
        var days = state.voidDates&&state.voidDates[p.id+'_'+r.n]
          ? Math.floor((new Date()-new Date(state.voidDates[p.id+'_'+r.n]))/86400000) : 0;
        vacant.push({property:p.name,room:r.n,price:r.price||0,days:days});
      }
    });
  });
  var dailyVoidLoss = vacant.reduce(function(s,v){return s+Math.round(v.price/7);},0);
  var now = new Date();
  var llOverdue = (state.landlordPayments||[]).filter(function(p){
    return p.status!=='paid'&&p.dueDateTs&&p.dueDateTs<now.getTime();
  });
  var llOverdueTotal = llOverdue.reduce(function(s,p){return s+p.amount;},0);
  var openMaint   = state.maintenance.filter(function(m){return m.status==='open';});
  var urgentMaint = openMaint.filter(function(m){return m.priority==='urgent';});
  var totalRooms = state.properties.reduce(function(s,p){return s+p.rooms;},0);
  var occRooms   = state.properties.reduce(function(s,p){return s+p.occupied;},0);
  var expectedMo = Math.round(active.reduce(function(s,t){return s+(t.freq==='monthly'?t.rent:t.rent*52/12);},0));
  var landlordMo = state.properties.reduce(function(s,p){return s+p.landlord;},0);
  return {
    date: new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),
    portfolio:{properties:state.properties.length,totalRooms:totalRooms,occupiedRooms:occRooms,
      occupancyPct:Math.round(occRooms/totalRooms*100),vacantRooms:totalRooms-occRooms,
      expectedIncome:expectedMo,landlordCosts:landlordMo,netProfit:expectedMo-landlordMo},
    tenants:{active:active.length,onNotice:notice.length,inArrears:arrears.length,totalArrears:arrTotal,
      arrearsDetails:arrears.slice(0,5).map(function(t){return {name:t.name,property:t.property,arrears:t.arrears};})},
    voids:{count:vacant.length,dailyLoss:dailyVoidLoss,monthlyLoss:dailyVoidLoss*30,
      longestVoids:vacant.sort(function(a,b){return b.days-a.days;}).slice(0,5)},
    landlordPayments:{overdueCount:llOverdue.length,overdueTotal:llOverdueTotal,
      overdueItems:llOverdue.slice(0,5).map(function(p){return {landlord:p.landlordName,property:p.property,amount:p.amount,month:p.monthLabel};})},
    maintenance:{openCount:openMaint.length,urgentCount:urgentMaint.length,
      urgentItems:urgentMaint.slice(0,5).map(function(m){return {property:m.property,issue:m.issue,room:m.room};})}
  };
}

async function runAIAgent(forceRefresh) {
  var cached=localStorage.getItem('pm_agent_cache');
  var cacheTs=+(localStorage.getItem('pm_agent_cache_ts')||0);
  var age=(Date.now()-cacheTs)/3600000;
  if(!forceRefresh&&cached&&age<6){ document.getElementById('ai-agent-output').innerHTML=cached; return; }
  _agentRunning=true;
  document.getElementById('ai-agent-output').innerHTML=renderAgentLoading();
  var snap=buildPortfolioSnapshot();
  var prompt='You are a property management analyst for a South London HMO portfolio. Analyse the following data and return ONLY valid JSON.\n\nPortfolio Snapshot ('+snap.date+'):\n'+JSON.stringify(snap,null,2)+'\n\nReturn ONLY this JSON structure:\n{"score":<0-100>,"scoreLabel":"<Excellent|Good|Needs Attention|Critical>","scoreColor":"<green|amber|red>","summary":"<2 sentences>","insights":[{"icon":"<emoji>","title":"<short>","body":"<1-2 sentences>","priority":"<high|medium|low>"}],"tasks":[{"icon":"<emoji>","task":"<specific action>","urgency":"<urgent|today|this-week>"}]}\n\nRules: exactly 4 insights (arrears, voids, landlord payments, maintenance). 3-5 tasks. Be specific with names and numbers.';
  try {
    var res=await fetchAiMessages({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:prompt}]});
    var data=await res.json();
    if(!res.ok){
      var msg=(data&&data.error&&(typeof data.error==='string'?data.error:data.error.message))||'AI unavailable';
      throw new Error(msg);
    }
    if(data.error){throw new Error(typeof data.error==='string'?data.error:(data.error.message||'AI error'));}
    var text=(data.content||[]).map(function(b){return b.text||'';}).join('');
    text=text.replace(/```json|```/g,'').trim();
    var parsed=JSON.parse(text);
    var html=renderAgentResult(parsed,snap.date);
    localStorage.setItem('pm_agent_cache',html);
    localStorage.setItem('pm_agent_cache_ts',Date.now());
    document.getElementById('ai-agent-output').innerHTML=html;
  } catch(err){
    try{
      runLocalPortfolioAnalysis();
      showToast && showToast('Cloud AI unavailable — showing local summary','warn');
    }catch(_e){
      document.getElementById('ai-agent-output').innerHTML=renderAgentError(err.message);
    }
  }
  _agentRunning=false;
}

function renderAgentKeyPrompt(){
  return '<div style="padding:18px">'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:12px;line-height:1.6">AI insights use the <strong>PropManager server</strong>. Ensure <code style="font-size:11px">ANTHROPIC_API_KEY</code> and <code style="font-size:11px">SUPABASE_SERVICE_ROLE_KEY</code> are set on the host, then run the analysis again.</div>'
    +'<button onclick="runAIAgent(true)" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">↻ Retry</button>'
    +'</div>';
}

function renderAgentLoading(){
  return '<div style="padding:28px;text-align:center">'
    +'<div style="font-size:32px;margin-bottom:12px">🤖</div>'
    +'<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">Analysing your portfolio…</div>'
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:18px">Reviewing tenants · payments · voids · maintenance</div>'
    +'<div style="display:flex;justify-content:center;gap:6px">'
    +'<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);opacity:.3;animation:kf-pulse 1.2s .0s infinite ease-in-out"></div>'
    +'<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);opacity:.3;animation:kf-pulse 1.2s .2s infinite ease-in-out"></div>'
    +'<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);opacity:.3;animation:kf-pulse 1.2s .4s infinite ease-in-out"></div>'
    +'</div></div>';
}

function renderAgentError(msg){
  return '<div style="padding:16px">'
    +'<div style="font-size:13px;color:var(--red);font-weight:700;margin-bottom:6px">⚠️ Could not connect to AI</div>'
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:12px;font-family:monospace;background:var(--bg);padding:8px;border-radius:7px">'+msg+'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button onclick="runAIAgent(true)" style="padding:7px 14px;border-radius:8px;border:1px solid var(--accent);color:var(--accent);background:var(--accent-light);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">↻ Retry</button>'
    +'</div></div>';
}

function renderAgentResult(d,dateStr){
  var scoreColors={green:'var(--green)',amber:'var(--amber)',red:'var(--red)'};
  var scoreBgs={green:'var(--green-light)',amber:'var(--amber-light)',red:'var(--red-light)'};
  var urgencyColors={urgent:'var(--red)',today:'var(--amber)','this-week':'var(--blue)'};
  var priorityBorders={high:'#FECDD3',medium:'#FDE68A',low:'var(--border)'};
  var col=scoreColors[d.scoreColor]||'var(--blue)';
  var bg=scoreBgs[d.scoreColor]||'var(--blue-light)';
  var html='';
  // Score + summary
  html+='<div style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);background:'+bg+'">';
  html+='<div style="text-align:center;min-width:72px">';
  html+='<div style="font-size:32px;font-weight:800;color:'+col+';font-family:monospace;line-height:1">'+d.score+'</div>';
  html+='<div style="font-size:10px;font-weight:800;color:'+col+';text-transform:uppercase;letter-spacing:.04em;margin-top:2px">'+d.scoreLabel+'</div>';
  html+='</div>';
  html+='<div><div style="font-size:10px;color:var(--muted);margin-bottom:4px">'+dateStr+'</div>';
  html+='<div style="font-size:12px;color:var(--text);line-height:1.6">'+d.summary+'</div></div>';
  html+='</div>';
  // Insights
  html+='<div style="padding:14px 16px;border-bottom:1px solid var(--border)">';
  html+='<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">📊 Insights</div>';
  html+='<div style="display:flex;flex-direction:column;gap:8px">';
  (d.insights||[]).forEach(function(ins){
    html+='<div style="background:var(--surface);border:1px solid '+(priorityBorders[ins.priority]||'var(--border)')+';border-radius:10px;padding:10px 12px">';
    html+='<div style="font-size:12px;font-weight:700;margin-bottom:3px">'+ins.icon+' '+ins.title+'</div>';
    html+='<div style="font-size:12px;color:var(--muted);line-height:1.5">'+ins.body+'</div>';
    html+='</div>';
  });
  html+='</div></div>';
  // Tasks
  html+='<div style="padding:14px 16px">';
  html+='<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">✅ Action Items</div>';
  html+='<div style="display:flex;flex-direction:column;gap:6px">';
  (d.tasks||[]).forEach(function(task){
    var uc=urgencyColors[task.urgency]||'var(--muted)';
    html+='<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:var(--surface);border-radius:9px;border:1px solid var(--border)">';
    html+='<span style="font-size:16px;flex-shrink:0">'+task.icon+'</span>';
    html+='<div style="flex:1;font-size:12px;color:var(--text);line-height:1.5">'+task.task+'</div>';
    html+='<span style="font-size:10px;font-weight:700;color:'+uc+';flex-shrink:0;text-transform:uppercase;white-space:nowrap">'+task.urgency.replace('-',' ')+'</span>';
    html+='</div>';
  });
  html+='</div>';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">';
  html+='<div style="font-size:10px;color:var(--dim)">Auto-refreshes every 6h · Powered by Claude AI</div>';
  html+='<div style="display:flex;gap:6px">';
  html+='<button onclick="localStorage.removeItem(\'pm_agent_cache\');localStorage.removeItem(\'pm_agent_cache_ts\');runAIAgent(true)" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;color:var(--muted);cursor:pointer;font-family:inherit">↻ New analysis</button>';
  html+='<button onclick="runAIAgent(true)" style="padding:5px 12px;border-radius:7px;border:none;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">↻ Refresh</button>';
  html+='</div></div></div>';
  return html;
}


// ══════════════════════════════════════════════════════════════════════════════
// LOCAL AI — no API, no internet. Rules-based analysis using live portfolio data
// ══════════════════════════════════════════════════════════════════════════════
