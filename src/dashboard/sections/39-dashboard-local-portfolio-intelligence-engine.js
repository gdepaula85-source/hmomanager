// ── DASHBOARD: local portfolio intelligence engine ────────────────────────────
function runLocalPortfolioAnalysis() {
  var el=document.getElementById('ai-agent-output');
  if(!el) return;

  var props=state.properties||[];
  var tenants=(state.tenants||[]).filter(function(t){return t.status!=='inactive';});
  var maint=state.maintenance||[];

  // Core metrics
  var totalRooms=props.reduce(function(s,p){return s+p.rooms;},0);
  var occupiedRooms=props.reduce(function(s,p){return s+p.occupied;},0);
  var vacantRooms=totalRooms-occupiedRooms;
  var occupancyPct=totalRooms?Math.round(occupiedRooms/totalRooms*100):0;
  var totalIncome=props.reduce(function(s,p){return s+p.rent;},0);
  var totalLLCost=props.reduce(function(s,p){return s+p.landlord;},0);
  var totalNet=totalIncome-totalLLCost;
  var portfolioMargin=totalIncome>0?Math.round(totalNet/totalIncome*100):0;
  var avgRentPerRoom=occupiedRooms>0?Math.round(totalIncome/occupiedRooms):0;
  var voidLoss=vacantRooms*avgRentPerRoom;

  var lossProps=props.filter(function(p){return p.rent<p.landlord&&p.rent>0;});
  var profitProps=props.filter(function(p){return p.rent>=p.landlord&&p.rent>0;});
  var noIncomeProps=props.filter(function(p){return p.rent===0;});

  var urgentMaint=maint.filter(function(m){return m.priority==='urgent'&&m.status!=='resolved';});
  var openMaint=maint.filter(function(m){return m.status!=='resolved';});

  var arrearsTenants=tenants.filter(function(t){return t.arrears>0;});
  var totalArrears=arrearsTenants.reduce(function(s,t){return s+(t.arrears||0);},0);

  var noticeTenants=tenants.filter(function(t){return t.status==='notice';});

  // Top loss makers
  var topLosses=lossProps.slice().sort(function(a,b){return (a.rent-a.landlord)-(b.rent-b.landlord);}).slice(0,3);

  // Score
  var score=50;
  if(occupancyPct>=90){score+=18;}else if(occupancyPct>=85){score+=10;}else if(occupancyPct>=75){score+=2;}else if(occupancyPct<65){score-=15;}
  if(portfolioMargin>=25){score+=18;}else if(portfolioMargin>=20){score+=10;}else if(portfolioMargin>=15){score+=4;}else if(portfolioMargin<10){score-=12;}
  if(urgentMaint.length===0){score+=5;}else{score-=Math.min(20,urgentMaint.length*6);}
  if(totalArrears===0){score+=5;}else if(totalArrears<1000){score-=2;}else if(totalArrears<5000){score-=8;}else{score-=15;}
  if(lossProps.length===0){score+=8;}else{score-=Math.min(18,lossProps.length*3);}
  score=Math.max(10,Math.min(98,score));
  var scoreColor=score>=70?'var(--green)':score>=45?'var(--amber)':'var(--red)';
  var scoreLabel=score>=70?'Healthy':score>=45?'Needs Attention':'Critical';

  // Build insights
  var alerts=[],insights=[],actions=[];

  // Urgent maintenance
  if(urgentMaint.length>0){alerts.push({c:'var(--red)',icon:'&#x1F6A8;',t:urgentMaint.length+' urgent maintenance job'+(urgentMaint.length>1?'s':'')+': '+urgentMaint.map(function(m){return m.property.split(' ')[0];}).join(', ')});}

  // Arrears
  if(totalArrears>0){alerts.push({c:'var(--amber)',icon:'&#x26A0;&#xFE0F;',t:arrearsTenants.length+' tenant'+(arrearsTenants.length>1?'s':'')+' in arrears — total '+fmt(totalArrears)});}

  // Notice tenants
  if(noticeTenants.length>0){alerts.push({c:'var(--blue)',icon:'&#x1F4CB;',t:noticeTenants.length+' tenant'+(noticeTenants.length>1?'s':'')+' have given notice — plan re-letting now to avoid voids'});}

  // Occupancy insight
  if(occupancyPct>=90){insights.push({c:'var(--green)',t:'Occupancy at '+occupancyPct+'% is excellent — above the 90% target. Portfolio running near full capacity.'});}
  else if(occupancyPct>=85){insights.push({c:'var(--green)',t:'Occupancy at '+occupancyPct+'% is on target. '+vacantRooms+' vacant room'+(vacantRooms>1?'s':'')+' represent '+fmt(voidLoss)+'/mo in lost income.'});}
  else{insights.push({c:'var(--amber)',t:'Occupancy at '+occupancyPct+'% is below target. '+vacantRooms+' vacant rooms are costing '+fmt(voidLoss)+'/mo — prioritise re-letting.'});}

  // Margin insight
  if(portfolioMargin>=20){insights.push({c:'var(--green)',t:'Portfolio gross margin of '+portfolioMargin+'% is strong — keeping '+portfolioMargin+'p in every £1 of rent.'});}
  else if(portfolioMargin>=12){insights.push({c:'var(--amber)',t:'Gross margin of '+portfolioMargin+'% is acceptable. Review LL rent on renewal properties to push above 20%.'});}
  else{insights.push({c:'var(--red)',t:'Gross margin of '+portfolioMargin+'% is very thin. Urgent review of LL rents and room rates needed.'});}

  // Net profit
  if(totalNet>0){insights.push({c:'var(--green)',t:'Portfolio net (before expenses) is '+fmt(totalNet)+'/mo ('+fmt(totalNet*12)+'/yr) across '+props.length+' properties.'});}

  // Loss-making properties
  if(lossProps.length>0){
    var totalLoss=Math.abs(lossProps.reduce(function(s,p){return s+(p.rent-p.landlord);},0));
    var msg=lossProps.length+' propert'+(lossProps.length>1?'ies are':'y is')+' loss-making — combined '+fmt(totalLoss)+'/mo loss.';
    if(topLosses.length>0) msg+=' Worst: '+topLosses[0].name+' ('+fmt(Math.abs(topLosses[0].rent-topLosses[0].landlord))+'/mo).';
    insights.push({c:'var(--red)',t:msg});
    actions.push('Review LL rent terms on '+topLosses.map(function(p){return p.name.split(' ')[0];}).join(', ')+' — these are running at a loss');
  }

  // Open maintenance
  if(openMaint.length>0){actions.push(openMaint.length+' open maintenance job'+(openMaint.length>1?'s':'')+' — resolve to protect tenant satisfaction and property condition');}

  // Void action
  if(vacantRooms>0){actions.push('Fill '+vacantRooms+' vacant room'+(vacantRooms>1?'s':'')+' — each empty room costs ~'+fmt(avgRentPerRoom)+'/mo in lost rent');}

  // Arrears action
  if(totalArrears>2000){actions.push('Chase '+fmt(totalArrears)+' in arrears — contact '+arrearsTenants.map(function(t){return t.name.split(' ')[0];}).join(', ')+'  directly');}

  // Render
  var html='<div style="padding:14px 18px">';

  // Score bar
  html+='<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">'
    +'<div style="width:56px;height:56px;border-radius:50%;border:3px solid '+scoreColor+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'
    +'<div style="text-align:center"><div style="font-size:18px;font-weight:800;color:'+scoreColor+'">'+score+'</div></div></div>'
    +'<div style="flex:1"><div style="font-size:14px;font-weight:700;color:'+scoreColor+';margin-bottom:2px">Portfolio Health: '+scoreLabel+'</div>'
    +'<div style="font-size:11px;color:var(--muted)">'+props.length+' properties · '+occupancyPct+'% occupied · '+fmt(totalNet)+'/mo net · '+openMaint.length+' open jobs</div>'
    +'<div style="margin-top:6px;height:6px;border-radius:3px;background:var(--border);overflow:hidden"><div style="height:100%;width:'+score+'%;background:'+scoreColor+';border-radius:3px;transition:width .5s"></div></div>'
    +'</div>'
    +'<button onclick="runLocalPortfolioAnalysis()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:11px;color:var(--muted);cursor:pointer;font-family:inherit;flex-shrink:0">&#x21BB; Refresh</button>'
    +'</div>';

  // Alerts
  if(alerts.length>0){
    html+='<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">';
    alerts.forEach(function(a){
      html+='<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-left:3px solid '+a.c+';border-radius:8px">'
        +'<span style="color:'+a.c+';flex-shrink:0">'+a.icon+'</span>'
        +'<span style="font-size:12px;color:var(--text)">'+a.t+'</span></div>';
    });
    html+='</div>';
  }

  // Insights
  if(insights.length>0){
    html+='<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Analysis</div>';
    html+='<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px">';
    insights.forEach(function(ins){
      html+='<div style="display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--text);line-height:1.5">'
        +'<span style="color:'+ins.c+';flex-shrink:0;margin-top:2px">&#x25CF;</span>'+ins.t+'</div>';
    });
    html+='</div>';
  }

  // Actions
  if(actions.length>0){
    html+='<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Recommended Actions</div>';
    html+='<div style="display:flex;flex-direction:column;gap:5px">';
    actions.forEach(function(act,i){
      html+='<div style="display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--text);line-height:1.5">'
        +'<span style="background:var(--accent);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;flex-shrink:0;margin-top:2px">'+(i+1)+'</span>'+act+'</div>';
    });
    html+='</div>';
  }

  html+='<div style="margin-top:10px;font-size:10px;color:var(--dim)">Local analysis — runs offline, no API required</div>';
  html+='</div>';

  el.innerHTML=html;
}

function renderDashboardAgent(){
  var el=document.getElementById('ai-agent-output');
  if(!el) return;
  var cached=localStorage.getItem('pm_agent_cache');
  var cacheTs=+(localStorage.getItem('pm_agent_cache_ts')||0);
  if(cached&&(Date.now()-cacheTs)/3600000<6){el.innerHTML=cached;return;}
  runAIAgent(false);
}
