// ── Shared render for local deal output ────────────────────────────────────────
function renderLocalDealOutput(r) {
  if(!r) return '<div style="padding:12px 0;font-size:12px;color:rgba(255,255,255,.5)">Enter deal figures above first</div>';
  var vCol=r.verdict==='GO'?'#00D897':r.verdict==='CAUTION'?'#F5A623':'#FF4D6A';
  function li(arr,icon,c){return(arr||[]).map(function(s){return '<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:rgba(255,255,255,.78);margin-bottom:5px;line-height:1.5"><span style="color:'+c+';flex-shrink:0;margin-top:1px">'+icon+'</span>'+s+'</div>';}).join('');}
  return '<div style="padding:12px 0">'
    +'<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08)">'
    +'<div style="width:54px;height:54px;border-radius:50%;border:2.5px solid '+vCol+';display:flex;align-items:center;justify-content:center;flex-shrink:0;flex-direction:column">'
    +'<div style="font-size:16px;font-weight:800;color:'+vCol+'">'+r.score+'</div></div>'
    +'<div><div style="font-size:15px;font-weight:800;color:'+vCol+';margin-bottom:3px">'+r.verdict+'</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.72);line-height:1.4">'+r.headline+'</div></div></div>'
    +(r.strengths.length?'<div style="margin-bottom:8px">'+li(r.strengths,'&#x2713;','#00D897')+'</div>':'')
    +(r.risks.length?'<div style="margin-bottom:8px">'+li(r.risks,'!','#FF4D6A')+'</div>':'')
    +(r.suggestions.length?'<div>'+li(r.suggestions,'&#x2192;','#F5A623')+'</div>':'')
    +'<div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,.25)">Local analysis — no API required</div>'
    +'</div>';
}

function runLocalDealAnalysis(){
  runDealAI();
}
