#!/usr/bin/env python3
"""Apply all dashboard plan edits: AI proxy client, seed, runAfterSupabaseLoad, split state/sections."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASH = ROOT / "public/js/dashboard.js"

def main():
    s = DASH.read_text(encoding="utf-8")

    # 1) fetchAiMessages
    ins = """const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

/** Server-side Anthropic proxy at POST /api/ai/messages (requires Supabase session). */
async function fetchAiMessages(payload) {
  var sr = await supa.auth.getSession();
  var session = sr.data.session;
  if (!session) throw new Error('Not signed in');
  return fetch('/api/ai/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token
    },
    body: JSON.stringify(payload)
  });
}

"""
    if "fetchAiMessages" not in s:
        s = s.replace(
            "const supa = supabase.createClient(SUPA_URL, SUPA_KEY);\n\n// ── Auth & Org provisioning",
            ins + "// ── Auth & Org provisioning",
        )

    # 2) Auth callback
    s = s.replace(
        """      if (!loaded) {
        showToast && showToast('Could not load workspace data.', 'error');
        return;
      }
      if (!canSee(state.page)) state.page = 'dashboard';""",
        """      if (!loaded) {
        showToast && showToast('Could not load workspace data.', 'error');
        return;
      }
      runAfterSupabaseLoad();
      if (!canSee(state.page)) state.page = 'dashboard';""",
    )

    # 3) Replace runDeal block
    a = s.index("function saveDealAIKey")
    b = s.index("// ── Room photo sync")
    new_deal = """async function runDealAI(){
  var outEl=document.getElementById('da-ai-out');if(!outEl)return;
  _dealSaveInputsToScratch();
  var d=(state.dealInputs&&state.dealInputs._scratch)||{};if(!d.rooms&&!d.wkrent){showToast('Enter deal figures first','error');return;}
  var isOwned=d.dealType==='owned',grossIncome=d._grossIncome||0,totalCosts=d._totalCosts||0,net=grossIncome-totalCosts;
  var margin=grossIncome>0?Math.round(net/grossIncome*100):0,cashIn=isOwned?Math.max(1,(d.price||0)*(d.dep||25)/100+(d.reno||0)):0;
  var roi=(cashIn&&net&&(d.price||0)>0)?+(net*12/cashIn*100).toFixed(1):0;
  var grossYield=(isOwned&&(d.price||0)>0)?+((grossIncome*12/d.price)*100).toFixed(1):0;
  var breakEven=(!isOwned&&grossIncome>0)?Math.ceil(totalCosts/(grossIncome/Math.max(1,d.rooms||1))):0;
  outEl.innerHTML='<div style="padding:12px 0;display:flex;align-items:center;gap:10px"><div style="width:20px;height:20px;border:2px solid #00D897;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></div><span style="font-size:12px;color:rgba(255,255,255,.5)">Analyzing...</span></div>';
  var prompt='UK property investment expert. Analyze this '+(isOwned?'BTL':'R2R')+' deal. Return ONLY valid JSON, no markdown.\\nRooms: '+(d.rooms||0)+'\\nWeekly rent/room: '+(d.wkrent||0)+'\\nOccupancy: '+(d.occ||85)+'%\\nGross monthly income: '+grossIncome+'\\nTotal costs: '+totalCosts+'\\nNet monthly: '+net+'\\nMargin: '+margin+'%\\n'+(isOwned?'Purchase: '+(d.price||0)+', Cash in: '+cashIn+', Yield: '+grossYield+'%\\n':'Break-even: '+breakEven+' rooms\\n')+'Return: {"score":0-100,"verdict":"GO|CAUTION|NO-GO","headline":"under 20 words","strengths":["max 3"],"risks":["max 3"],"suggestions":["max 3"]}';
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

"""
    s = s[:a] + new_deal + s[b:]

    s = s.replace('onclick="runLocalDealAnalysis()"', 'onclick="runDealAI()"')

    # Remove first getAgentApiKey block (before AI PORTFOLIO section)
    g1 = s.find("function getAgentApiKey()")
    b1 = s.find("function buildPortfolioSnapshot()", g1)
    if g1 != -1 and b1 != -1:
        s = s[:g1] + s[b1:]

    # Replace runAIAgent
    ra = s.index("async function runAIAgent(forceRefresh) {")
    rk = s.index("function renderAgentKeyPrompt(){")
    new_ra = """async function runAIAgent(forceRefresh) {
  var cached=localStorage.getItem('pm_agent_cache');
  var cacheTs=+(localStorage.getItem('pm_agent_cache_ts')||0);
  var age=(Date.now()-cacheTs)/3600000;
  if(!forceRefresh&&cached&&age<6){ document.getElementById('ai-agent-output').innerHTML=cached; return; }
  _agentRunning=true;
  document.getElementById('ai-agent-output').innerHTML=renderAgentLoading();
  var snap=buildPortfolioSnapshot();
  var prompt='You are a property management analyst for a South London HMO portfolio. Analyse the following data and return ONLY valid JSON.\\n\\nPortfolio Snapshot ('+snap.date+'):\\n'+JSON.stringify(snap,null,2)+'\\n\\nReturn ONLY this JSON structure:\\n{"score":<0-100>,"scoreLabel":"<Excellent|Good|Needs Attention|Critical>","scoreColor":"<green|amber|red>","summary":"<2 sentences>","insights":[{"icon":"<emoji>","title":"<short>","body":"<1-2 sentences>","priority":"<high|medium|low>"}],"tasks":[{"icon":"<emoji>","task":"<specific action>","urgency":"<urgent|today|this-week>"}]}\\n\\nRules: exactly 4 insights (arrears, voids, landlord payments, maintenance). 3-5 tasks. Be specific with names and numbers.';
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

"""
    s = s[:ra] + new_ra + s[rk:]

    s = s.replace(
        """function renderAgentKeyPrompt(){
  return '<div style="padding:18px">'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:12px;line-height:1.6">Enter your Anthropic API key to enable daily AI insights. Your key is stored <strong>only in your browser</strong> — never shared.</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:8px">'
    +'<input id="agent-key-inp" type="password" placeholder="sk-ant-api03-..." class="inp" style="flex:1;font-family:monospace;font-size:12px">'
    +'<button onclick="var k=document.getElementById(\\'agent-key-inp\\').value.trim();if(k){saveAgentApiKey(k);runAIAgent(true);}" '
    +'style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">▶ Run</button>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--dim)">Get your key at <strong>console.anthropic.com</strong> · API → Keys</div>'
    +'</div>';
}""",
        """function renderAgentKeyPrompt(){
  return '<div style="padding:18px">'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:12px;line-height:1.6">AI insights use the <strong>PropManager server</strong>. Ensure <code style="font-size:11px">ANTHROPIC_API_KEY</code> and <code style="font-size:11px">SUPABASE_SERVICE_ROLE_KEY</code> are set on the host, then run the analysis again.</div>'
    +'<button onclick="runAIAgent(true)" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">↻ Retry</button>'
    +'</div>';
}""",
    )

    s = s.replace(
        """    +'<button onclick="runAIAgent(true)" style="padding:7px 14px;border-radius:8px;border:1px solid var(--accent);color:var(--accent);background:var(--accent-light);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">↻ Retry</button>'
    +'<button onclick="saveAgentApiKey(\\'\\');localStorage.removeItem(\\'pm_anthropic_key\\');document.getElementById(\\'ai-agent-output\\').innerHTML=renderAgentKeyPrompt();" style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;color:var(--muted);cursor:pointer;font-family:inherit">🔑 Change Key</button>'""",
        """    +'<button onclick="runAIAgent(true)" style="padding:7px 14px;border-radius:8px;border:1px solid var(--accent);color:var(--accent);background:var(--accent-light);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">↻ Retry</button>'""",
    )

    s = s.replace(
        """  html+='<button onclick="saveAgentApiKey(\\'\\');localStorage.removeItem(\\'pm_anthropic_key\\');localStorage.removeItem(\\'pm_agent_cache\\');document.getElementById(\\'ai-agent-output\\').innerHTML=renderAgentKeyPrompt();" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;color:var(--muted);cursor:pointer;font-family:inherit">🔑 Key</button>';""",
        """  html+='<button onclick="localStorage.removeItem(\\'pm_agent_cache\\');localStorage.removeItem(\\'pm_agent_cache_ts\\');runAIAgent(true)" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;color:var(--muted);cursor:pointer;font-family:inherit">↻ New analysis</button>';""",
    )

    s = s.replace(
        """function renderDashboardAgent(){
  var el=document.getElementById('ai-agent-output');
  if(!el) return;
  var key=getAgentApiKey();
  if(!key){
    // No API key — run local portfolio analysis immediately
    runLocalPortfolioAnalysis();
    return;
  }
  var cached=localStorage.getItem('pm_agent_cache');""",
        """function renderDashboardAgent(){
  var el=document.getElementById('ai-agent-output');
  if(!el) return;
  var cached=localStorage.getItem('pm_agent_cache');""",
    )

    s = s.replace(
        """function runLocalDealAnalysis(){
  var outEl=document.getElementById('da-ai-out');
  if(!outEl) return;
  var result=analyzeLocalDeal();
  outEl.innerHTML=renderLocalDealOutput(result||null);
}""",
        """function runLocalDealAnalysis(){
  runDealAI();
}""",
    )

    # Remove duplicate getAgentApiKey near AI PORTFOLIO AGENT
    g2 = s.find("// ── AI PORTFOLIO AGENT")
    if g2 != -1:
        gk = s.find("function getAgentApiKey()", g2)
        bk = s.find("function buildPortfolioSnapshot()", gk)
        if gk != -1 and bk != -1 and gk < bk:
            s = s[:gk] + s[bk:]

    lines = s.split("\n")
    for i, line in enumerate(lines):
        t = line.strip()
        if t.startswith("properties:["):
            lines[i] = "  properties:[],"
        if t.startswith("tenants:["):
            lines[i] = "  tenants:[],"
        if t.startswith("landlords:[") and i < 45:
            lines[i] = "  landlords:[],"
    s = "\n".join(lines)

    run_after = """function runAfterSupabaseLoad(){
  state.properties.forEach(function(p){
    if(!p.roomList) return;
    p.roomList.forEach(function(r){
      var tenant = state.tenants.find(function(t){
        return t.property===p.name && t.room===r.n && t.status!=='inactive';
      });
      r.status = tenant ? 'occupied' : 'vacant';
      if(tenant && tenant.rent > 0) r.price = tenant.rent;
    });
    p.occupied = p.roomList.filter(function(r){return r.status==='occupied';}).length;
    var occupiedPrices = p.roomList.filter(function(r){return r.status==='occupied'&&r.price>0;}).map(function(r){return r.price;});
    if(occupiedPrices.length) {
      var avgPrice = Math.round(occupiedPrices.reduce(function(s,v){return s+v;},0)/occupiedPrices.length);
      p.roomList.forEach(function(r){if(r.status==='vacant'&&r.price===0) r.price=avgPrice;});
    }
    var propTenants = state.tenants.filter(function(t){return t.property===p.name&&t.status!=='inactive';});
    p.rent = Math.round(propTenants.reduce(function(s,t){
      return s + (t.freq==='monthly' ? t.rent : (t.rent||0)*52/12);
    }, 0));
  });
  rebuildAllSchedules();
  var today = new Date();
  today.setHours(0,0,0,0);
  state.tenants.forEach(function(t) {
    if(t.status === 'notice_given' && t.moveOutDate) {
      var moveOut = new Date(t.moveOutDate);
      moveOut.setHours(0,0,0,0);
      if(moveOut <= today) {
        t.status = 'inactive';
        freeRoom(t.property, t.room);
      }
    }
  });
}

"""

    tail_re = re.compile(
        r"loadState\(\)\.then\(function\(loaded\)\{\nif\(!loaded\) return;\n// ALWAYS resync property occupancy[\s\S]*?\}\); // end loadState\(\)\.then\n"
    )
    s = tail_re.sub(run_after, s, count=1)

    DASH.write_text(s, encoding="utf-8")
    print("Wrote", DASH, "bytes", len(s))

    # Split state + app into src/dashboard/state.js and src/dashboard/sections/*.js
    lines = s.splitlines(keepends=True)
    state_part = "".join(lines[0:44])
    state_part = "export const state = " + state_part[len("const state = ") :]
    (ROOT / "src/dashboard/state.js").write_text(state_part, encoding="utf-8")
    app_part = "".join(lines[44:])
    app_path = ROOT / "public/js/dashboard-app.js"
    app_path.write_text(app_part, encoding="utf-8")
    DASH.unlink()
    subprocess.run(
        ["node", str(ROOT / "scripts/split-dashboard-sections.js")],
        check=True,
        cwd=str(ROOT),
    )
    app_path.unlink(missing_ok=True)
    print("Wrote src/dashboard/state.js + sections/; run npm run build:dashboard")


if __name__ == "__main__":
    main()
