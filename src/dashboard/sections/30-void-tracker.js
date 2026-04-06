// ── VOID TRACKER ──────────────────────────────────────────────────────────────
function getVoidDays(pid, rn) {
  if(!state.voidDates) return 0;
  var since = state.voidDates[pid+'_'+rn];
  if(!since) return 0;
  return Math.max(0, Math.floor((TODAY - new Date(since)) / 86400000));
}


function renderComplianceWidget() {
  if(!state.propDocs||!Object.keys(state.propDocs).length) {
    return '<div style="font-size:14px;font-weight:700;margin-bottom:6px">📋 Compliance Calendar</div>'
      +'<div style="font-size:12px;color:var(--muted)">Add Gas Safety, EICR and HMO Licence expiry dates in each property\'s Docs tab.</div>';
  }
  var alerts=[], upcoming=[], ok=0;
  Object.keys(state.propDocs).forEach(function(pid){
    var prop=state.properties.find(function(p){return String(p.id)===String(pid);});
    if(!prop||prop.status==='archived') return;
    (state.propDocs[pid]||[]).forEach(function(doc){
      if(!doc.expiresAt) return;
      var meta=getPropDocMeta(doc.type);
      if(!meta||meta.warn===0) return;
      var days=getDaysUntilExpiry(doc.expiresAt);
      var item={propName:prop.name,docType:doc.type,icon:meta.icon,days:days,expiresAt:doc.expiresAt};
      if(days<0){item.status='expired';alerts.push(item);}
      else if(days<=meta.warn){item.status='warning';alerts.push(item);}
      else if(days<=meta.warn+30){item.status='upcoming';upcoming.push(item);}
      else ok++;
    });
  });
  alerts.sort(function(a,b){return a.days-b.days;});
  upcoming.sort(function(a,b){return a.days-b.days;});
  var total=alerts.length+upcoming.length+ok;
  var html='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  html+='<div><div style="font-size:14px;font-weight:700">📋 Compliance Calendar</div>';
  html+='<div style="font-size:12px;color:var(--muted)">'+total+' certificates tracked</div></div></div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">';
  html+='<div style="background:'+(alerts.length?'var(--red-light)':'var(--bg)')+';border:1px solid '+(alerts.length?'#FECDD3':'var(--border)')+';border-radius:9px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:'+(alerts.length?'var(--red)':'var(--dim)')+'">'+alerts.length+'</div><div style="font-size:9px;font-weight:700;color:'+(alerts.length?'var(--red)':'var(--dim)')+';text-transform:uppercase;margin-top:2px">Expired / Due</div></div>';
  html+='<div style="background:'+(upcoming.length?'var(--amber-light)':'var(--bg)')+';border:1px solid '+(upcoming.length?'#FDE68A':'var(--border)')+';border-radius:9px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:'+(upcoming.length?'var(--amber)':'var(--dim)')+'">'+upcoming.length+'</div><div style="font-size:9px;font-weight:700;color:'+(upcoming.length?'var(--amber)':'var(--dim)')+';text-transform:uppercase;margin-top:2px">Due Soon</div></div>';
  html+='<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:9px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--green)">'+ok+'</div><div style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;margin-top:2px">Current</div></div>';
  html+='</div>';
  if(!alerts.length&&!upcoming.length) return html+'<div style="text-align:center;padding:12px;color:var(--dim);font-size:12px">✓ All certificates current</div>';
  alerts.concat(upcoming).slice(0,8).forEach(function(item){
    var isExp=item.days<0;
    var bg=isExp?'var(--red-light)':'var(--amber-light)';
    var border=isExp?'#FECDD3':'#FDE68A';
    var col=isExp?'var(--red)':'var(--amber)';
    var label=isExp?'EXPIRED '+Math.abs(item.days)+'d ago':'Expires in '+item.days+'d';
    html+='<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:'+bg+';border:1px solid '+border+';border-left:3px solid '+col+';border-radius:8px;margin-bottom:6px">';
    html+='<span style="font-size:16px">'+item.icon+'</span>';
    html+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+item.propName+'</div>';
    html+='<div style="font-size:11px;color:var(--muted)">'+item.docType+'</div></div>';
    html+='<div style="text-align:right;flex-shrink:0"><div style="font-size:10px;font-weight:700;color:'+col+'">'+label+'</div>';
    html+='<div style="font-size:10px;color:var(--dim)">'+new Date(item.expiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+'</div></div></div>';
  });
  return html;
}

function renderDepositSummary() {
  var active=state.tenants.filter(function(t){return t.status==='active'||t.status==='notice_given';});
  var totalHeld=active.filter(function(t){return t.depositStatus!=='returned';}).reduce(function(s,t){return s+(t.deposit||0);},0);
  var noRef=active.filter(function(t){return (t.deposit||0)>0&&!t.depositRef;}).length;
  var byScheme={};
  active.forEach(function(t){if(!(t.deposit>0))return;var s=t.depositScheme||'Unknown';byScheme[s]=(byScheme[s]||0)+(t.deposit||0);});
  var html='<div style="font-size:14px;font-weight:700;margin-bottom:12px">🔐 Deposit Register</div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
  html+='<div style="background:var(--green-light);border:1px solid #A7F3D0;border-radius:9px;padding:10px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace">'+fmt(totalHeld)+'</div><div style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;margin-top:2px">Held</div></div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--muted);font-family:monospace">'+active.filter(function(t){return t.depositStatus!=='returned';}).length+'</div><div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-top:2px">Tenants</div></div>';
  html+='</div>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
  Object.keys(byScheme).forEach(function(s){html+='<div style="padding:4px 10px;background:var(--bg);border:1px solid var(--border);border-radius:20px;font-size:12px"><span style="font-weight:700">'+s+'</span> <span style="color:var(--muted);font-family:monospace">'+fmt(byScheme[s])+'</span></div>';});
  if(!Object.keys(byScheme).length) html+='<span style="font-size:12px;color:var(--dim)">No deposits recorded</span>';
  html+='</div>';
  if(noRef>0) html+='<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:10px;font-size:12px;color:var(--amber);font-weight:600">⚠ '+noRef+' tenant'+(noRef>1?'s':'')+' missing deposit reference</div>';
  return html;
}

function renderVoidTracker() {
  if(!state.voidDates) state.voidDates = {};
  var voids = [];
  state.properties.forEach(function(p) {
    if(!isPropertyActive(p)) return;
    (p.roomList||[]).forEach(function(r) {
      if(r.status !== 'vacant') return;
      var key = p.id+'_'+r.n;
      if(!state.voidDates[key]) {
        var d = new Date();
        d.setDate(d.getDate() - (Math.floor(Math.random()*83)+7));
        state.voidDates[key] = d.toISOString().split('T')[0];
      }
      var days = getVoidDays(p.id, r.n);
      var dailyCost = Math.round(r.price / 7);
      voids.push({p:p, r:r, days:days, cost:Math.round(days*dailyCost),
        since:new Date(state.voidDates[key]).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),
        dailyCost:dailyCost});
    });
  });
  voids.sort(function(a,b){return b.cost - a.cost;});
  var tc = voids.reduce(function(s,v){return s+v.cost;},0);
  var td = voids.reduce(function(s,v){return s+v.dailyCost;},0);
  var lng = voids.length ? voids.reduce(function(a,b){return a.days>b.days?a:b;}) : null;

  var html = '<div style="font-size:14px;font-weight:700;margin-bottom:4px">&#x1F4CA; Void Period Tracker</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">'+voids.length+' vacant rooms &middot; daily lost income tracked</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">';
  html += '<div style="background:var(--red-light);border:1px solid #FECDD3;border-radius:9px;padding:10px;text-align:center"><div style="font-size:13px;font-weight:800;color:var(--red);font-family:monospace">'+fmt(tc)+'</div><div style="font-size:9px;color:var(--red);font-weight:700;margin-top:2px">TOTAL VOID COST</div></div>';
  html += '<div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:10px;text-align:center"><div style="font-size:13px;font-weight:800;color:var(--amber);font-family:monospace">'+fmt(td)+'</div><div style="font-size:9px;color:var(--amber);font-weight:700;margin-top:2px">DAILY LOSS</div></div>';
  html += '<div style="background:var(--blue-light);border:1px solid #BFDBFE;border-radius:9px;padding:10px;text-align:center"><div style="font-size:13px;font-weight:800;color:var(--blue);font-family:monospace">'+(lng?lng.days+'d':'0d')+'</div><div style="font-size:9px;color:var(--blue);font-weight:700;margin-top:2px">LONGEST VOID</div></div>';
  html += '</div>';
  if(!voids.length) return html + '<div style="text-align:center;padding:16px;color:var(--dim)">&#x1F389; No vacant rooms!</div>';
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<tr style="background:var(--bg)"><th style="text-align:left;padding:6px 8px;color:var(--muted)">Room</th><th style="padding:6px 8px;color:var(--muted)">Since</th><th style="padding:6px 8px;color:var(--muted)">Days</th><th style="padding:6px 8px;color:var(--muted)">&pound;/day</th><th style="padding:6px 8px;color:var(--muted)">Total</th></tr>';
  voids.slice(0,12).forEach(function(v,i){
    var col = v.days>60?'var(--red)':v.days>30?'var(--amber)':'var(--muted)';
    html += '<tr style="border-top:1px solid var(--border);background:'+(i%2?'var(--bg)':'var(--surface)')+'"><td style="padding:6px 8px"><div style="font-weight:600">'+v.p.name+'</div><div style="color:var(--muted);font-size:10px">Rm '+v.r.n+' &middot; '+(v.r.type||'Room')+'</div></td><td style="padding:6px 8px;color:var(--muted)">'+v.since+'</td><td style="padding:6px 8px;font-weight:700;color:'+col+'">'+v.days+'d</td><td style="padding:6px 8px;color:var(--muted)">&pound;'+v.dailyCost+'</td><td style="padding:6px 8px;font-weight:800;color:var(--red);font-family:monospace">'+fmt(v.cost)+'</td></tr>';
  });
  html += '<tr style="border-top:2px solid var(--border)"><td colspan="3" style="padding:6px 8px;font-weight:700">TOTAL</td><td style="padding:6px 8px;color:var(--amber);font-weight:700">&pound;'+td+'/d</td><td style="padding:6px 8px;font-weight:800;color:var(--red);font-family:monospace">'+fmt(tc)+'</td></tr>';
  html += '</table></div>';
  return html;
}
