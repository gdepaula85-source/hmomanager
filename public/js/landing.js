// ── Load live pricing from Supabase plan_config ──────────────────
(function(){
  var SUPA_URL=window.ENV.SUPA_URL;
  var SUPA_KEY=window.ENV.SUPA_KEY;
  var DEFAULTS={starter:49,professional:89,business:149};
  fetch(SUPA_URL+'/rest/v1/app_config?key=eq.plan_config&select=value',{
    headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Cache-Control':'no-cache'}
  })
  .then(function(r){return r.json();})
  .then(function(rows){
    if(!rows||!rows[0]||!rows[0].value) return;
    var cfg=JSON.parse(rows[0].value);
    ['starter','professional','business'].forEach(function(plan){
      var el=document.getElementById('price-'+plan);
      if(el&&cfg[plan]&&cfg[plan].price!=null) el.textContent=cfg[plan].price;
    });
  })
  .catch(function(){}); // silently fall back to defaults if offline
})();

// Cursor
const cursor = document.getElementById('cursor');
const cursorRing = document.getElementById('cursor-ring');
let mx=0,my=0,rx=0,ry=0;
const isTouch = 'ontouchstart' in window;
if(isTouch){
  cursor.style.display='none';
  cursorRing.style.display='none';
} else {
  document.body.style.cursor='none';
  document.addEventListener('mousemove',e=>{ mx=e.clientX;my=e.clientY;cursor.style.left=mx+'px';cursor.style.top=my+'px'; });
  (function animRing(){ rx+=(mx-rx)*.12;ry+=(my-ry)*.12;cursorRing.style.left=rx+'px';cursorRing.style.top=ry+'px';requestAnimationFrame(animRing); })();
  document.querySelectorAll('a,button').forEach(el=>{
    el.addEventListener('mouseenter',()=>{cursor.style.transform='translate(-50%,-50%) scale(2.5)';cursorRing.style.opacity='0';});
    el.addEventListener('mouseleave',()=>{cursor.style.transform='translate(-50%,-50%) scale(1)';cursorRing.style.opacity='1';});
  });
}

// Nav scroll
window.addEventListener('scroll',()=>{ document.getElementById('nav').classList.toggle('scrolled',window.scrollY>40); });

// Counter animation
function animCount(id,target,duration){
  const el=document.getElementById(id);
  let startTime=null;
  const step=ts=>{ if(!startTime)startTime=ts; const p=Math.min((ts-startTime)/duration,1); const e=1-Math.pow(1-p,3); el.textContent=Math.round(e*target); if(p<1)requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
setTimeout(()=>{
  animCount('counter-props',62,1800);
  animCount('counter-tenants',177,2000);
  animCount('counter-income',141,1600);
  animCount('counter-rooms',193,1400);
},600);

// Chart bars
const chartData=[
  {m:'Oct',i:195,c:152,p:43},{m:'Nov',i:201,c:155,p:46},
  {m:'Dec',i:198,c:151,p:47},{m:'Jan',i:204,c:158,p:46},
  {m:'Feb',i:207,c:159,p:48},{m:'Mar',i:141,c:115,p:26}
];
const maxV=210;
const cb=document.getElementById('chart-bars');
if(cb){
  chartData.forEach((d,i)=>{
    const ih=Math.round(d.i/maxV*100),ch=Math.round(d.c/maxV*100),ph=Math.round(d.p/maxV*100);
    const g=document.createElement('div');
    g.className='bar-group';
    g.innerHTML=`<div style="display:flex;align-items:flex-end;gap:2px;height:80px;width:100%"><div class="bar-income" style="height:${ih}%;animation-delay:${i*.1+.2}s"></div><div class="bar-cost" style="height:${ch}%;animation-delay:${i*.1+.3}s"></div><div class="bar-profit" style="height:${ph}%;animation-delay:${i*.1+.4}s"></div></div><div class="bar-lbl">${d.m}</div>`;
    cb.appendChild(g);
  });
}

// Scroll reveal
const io=new IntersectionObserver(entries=>{ entries.forEach(e=>{ if(e.isIntersecting)e.target.classList.add('visible'); }); },{threshold:0.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// Metric bars + donut
const mio=new IntersectionObserver(entries=>{ entries.forEach(e=>{ if(e.isIntersecting){ e.target.querySelectorAll('.metric-bar-fill').forEach(b=>b.classList.add('animated')); const d=e.target.querySelector('#donut-fill');if(d)setTimeout(()=>d.classList.add('animated'),300); mio.unobserve(e.target); } }); },{threshold:0.3});
document.querySelectorAll('.metrics-section,.metrics-grid').forEach(el=>mio.observe(el));

// Hero typing
const heroSub=document.querySelector('.hero-sub');
if(heroSub){
  const orig=heroSub.textContent; heroSub.textContent=''; let i=0;
  const type=()=>{ if(i<orig.length){heroSub.textContent+=orig[i++];setTimeout(type,16);} };
  setTimeout(type,900);
}
