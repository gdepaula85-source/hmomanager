// ── DASHBOARD ─────────────────────────────────────────────────────────────────
/** Which calendar month a paid payment belongs in for "Collected" KPIs — paid date first, not rent due date. */
function _paymentCalendarDateForCollected(p) {
  if (!p) return new Date(0);
  if (p._paidDateRaw) return new Date(p._paidDateRaw);
  var months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  var pd = p.paidDate || p.date;
  if (pd && typeof pd === 'string') {
    var parts = String(pd).trim().split(/\s+/);
    if (parts.length === 3 && months[parts[1]] !== undefined) {
      var d = new Date(+parts[2], months[parts[1]], +parts[0]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (p._dueDateRaw) return new Date(p._dueDateRaw);
  if (p.dueDate) {
    var iso = String(p.dueDate).split('T')[0].split('-');
    if (iso.length === 3) return new Date(+iso[0], +iso[1]-1, +iso[2]);
  }
  return typeof getDueDateObj === 'function' ? getDueDateObj(p) : new Date();
}

/** Keep dashboard month in sync with the rolling MONTHS list (last key = current calendar month). */
function ensureDashboardMonth() {
  if (!MONTHS || !MONTHS.length) return;
  var keys = MONTHS.map(function(m) { return m.key; });
  if (!state.dashMonth || keys.indexOf(state.dashMonth) < 0) {
    state.dashMonth = keys[keys.length - 1];
  }
}

function getMonthStats(monthKey) {
  var mo = MONTHS.find(function(m){return m.key===monthKey;});
  if(!mo) return null;
  var dashCo = (state.filters && state.filters.dashCompany) || '';
  var dashProps = (dashCo ? state.properties.filter(function(p){return p.companyId===dashCo;}) : state.properties.slice()).filter(isPropertyActive);
  var propNames = {};
  dashProps.forEach(function(p){ propNames[p.name]=1; });
  function inDashScope(pay) {
    if (!dashCo) return true;
    var pn = pay.propertyName || pay.property || '';
    return !!propNames[pn];
  }
  var pool = getFullPaymentPool();
  var pays = pool.filter(function(p){if(!inDashScope(p))return false;var d=getDueDateObj(p);return d>=mo.from&&d<=mo.to;});
  var collectedPays = pool.filter(function(p){
    if (!isPaidStatus(p.status)) return false;
    if (!inDashScope(p)) return false;
    var d = _paymentCalendarDateForCollected(p);
    return d>=mo.from && d<=mo.to;
  });
  var income = collectedPays.reduce(function(s,p){return s+p.amount;},0);
  // Only count a property's landlord cost in months on/after its
  // leaseStartDate (or createdAt fallback). Otherwise a property added today
  // shows full landlord cost in past months when the lease didn't yet exist.
  var landlord = dashProps.reduce(function(s,p){
    var anchorRaw = p.leaseStartDate || p.createdAt;
    if(anchorRaw){
      var anchor = new Date(anchorRaw);
      if(!isNaN(anchor.getTime())){
        var anchorMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        if(anchorMonth > mo.to) return s;
      }
    }
    return s + (p.landlord||0);
  },0);
  // H6 FIX: Filter expenses by month date range and company scope
  var opex = state.expenses.filter(function(e){
    if(dashCo && e.companyId && e.companyId !== dashCo) return false;
    if(e.startDate){ var d=new Date(e.startDate); return d>=mo.from && d<=mo.to; }
    return false;
  }).reduce(function(s,e){return s+e.amount;},0);
  var occ = dashProps.reduce(function(s,p){return s+p.occupied;},0);
  var rooms = dashProps.reduce(function(s,p){return s+p.rooms;},0);
  var schedOutstanding = (state.rentSchedule||[]).filter(function(s){
    if(s.status==='paid') return false;
    if(!s.dueDateRaw) return false;
    var d = new Date(s.dueDateRaw);
    return d>=mo.from && d<=mo.to;
  }).length;
  // Use the shared isBillableTenant predicate so Dashboard ↔ Properties never disagree.
  // ALSO require the tenant's property to match an active property in scope —
  // otherwise orphan tenants (where t.property no longer matches any p.name)
  // inflate Dashboard income vs Properties (which sums per-property and can't
  // see orphans). Adds STR / Airbnb monthly income on top.
  var expectedTenantIncome = state.tenants.filter(function(t){
    if (!t || !propNames[t.property]) return false;   // strict scope match
    return isBillableTenant(t);
  }).reduce(function(s,t){ return s + tenantMonthlyRent(t); }, 0);
  var expectedStrIncome = dashProps.reduce(function(s,p){
    return s + ((typeof getPropStrMonthlyIncome === 'function') ? getPropStrMonthlyIncome(p) : 0);
  }, 0);
  var expectedIncome = Math.round(expectedTenantIncome + expectedStrIncome);
  var expectedGross = expectedIncome - landlord;
  var expectedNet   = expectedIncome - landlord - opex;
  return {income:income, landlord:landlord, opex:opex, profit:income-landlord-opex,
          occ:occ, rooms:rooms, outstanding:schedOutstanding, pays:pays, collectedPays:collectedPays,
          label:mo.label, expectedIncome:expectedIncome,
          expectedGross:expectedGross, expectedNet:expectedNet};
}

function showChartTip(e, text) {
  var tip = document.getElementById('chart-tip');
  if(!tip) return;
  var lines = text.split('|');
  tip.innerHTML = lines.map(function(l,i){return i===0?'<strong>'+l+'</strong>':l;}).join('<br>');
  tip.style.display = 'block';
  tip.style.left = Math.min(e.clientX+10, window.innerWidth-150)+'px';
  tip.style.top = (e.clientY-70)+'px';
}
function hideChartTip(){var tip=document.getElementById('chart-tip');if(tip)tip.style.display='none';}

function renderDashboard() {
  ensureDashboardMonth();
  // Refresh cached p.rent / p.occupied so the headline matches the Properties page.
  if (typeof recalcProperty === 'function') (state.properties||[]).forEach(recalcProperty);
  var selMonth = state.dashMonth;
  var ms = getMonthStats(selMonth);
  if (!ms && MONTHS && MONTHS.length) {
    state.dashMonth = MONTHS[MONTHS.length - 1].key;
    ms = getMonthStats(state.dashMonth);
  }
  var s = getStats();

  // Build 6-month trend from real payment data
  var dashCoTrend = (state.filters && state.filters.dashCompany) || '';
  var trendPropNames = {};
  if (dashCoTrend) {
    state.properties.filter(function(p){return p.companyId===dashCoTrend&&isPropertyActive(p);}).forEach(function(p){ trendPropNames[p.name]=1; });
  }
  function inTrendScope(p) {
    if (!dashCoTrend) return true;
    var pn = p.propertyName || p.property || '';
    return !!trendPropNames[pn];
  }
  var trend = MONTHS.map(function(mo) {
    var pool = getFullPaymentPool();
    var inc = pool
      .filter(function(p){
        if (!isPaidStatus(p.status) || !inTrendScope(p)) return false;
        var d = _paymentCalendarDateForCollected(p);
        return d>=mo.from&&d<=mo.to;
      })
      .reduce(function(s,p){return s+p.amount;},0);
    var trendBase = dashCoTrend
      ? state.properties.filter(function(p){return p.companyId===dashCoTrend&&isPropertyActive(p);})
      : state.properties.filter(isPropertyActive);
    // Same gate as getMonthStats — only count landlord cost for properties whose
    // lease (or createdAt fallback) had started by the end of this trend month.
    var land = trendBase.reduce(function(s,p){
      var anchorRaw = p.leaseStartDate || p.createdAt;
      if(anchorRaw){
        var anchor = new Date(anchorRaw);
        if(!isNaN(anchor.getTime())){
          var anchorMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
          if(anchorMonth > mo.to) return s;
        }
      }
      return s + (p.landlord||0);
    },0);
    // H7 FIX: Filter expenses by month for trend chart
    var opex = state.expenses.filter(function(e){
      if(dashCoTrend && e.companyId && e.companyId !== dashCoTrend) return false;
      if(e.startDate){ var d=new Date(e.startDate); return d>=mo.from && d<=mo.to; }
      return false;
    }).reduce(function(s,e){return s+e.amount;},0);
    var costs= land+opex;
    return {m:mo.label.split(' ')[0], key:mo.key, i:inc, c:costs, p:inc-costs, label:mo.label};
  });
  var maxV = Math.max.apply(null, trend.map(function(t){return Math.max(t.i,t.c);}));
  if(maxV===0) maxV=1;

  var lossProps = state.properties.filter(function(p){return isPropertyActive(p)&&net(p)<0;});
  var staffT = state.expenses.filter(function(e){return e.type==='staff';}).reduce(function(a,e){return a+e.amount;},0);
  var propT  = state.expenses.filter(function(e){return e.type==='property';}).reduce(function(a,e){return a+e.amount;},0);
  var overT  = state.expenses.filter(function(e){return e.type==='overhead';}).reduce(function(a,e){return a+e.amount;},0);

  var html = '';
  var dashCo = state.filters.dashCompany||'';

  // ── Stats / metrics ──
  var collectedAmt = (ms.collectedPays||[]).reduce(function(a,p){return a+p.amount;},0);
  var activeTenantCount = state.tenants.filter(function(t){
    if (t.status !== 'active') return false;
    var pr = state.properties.find(function(x){ return x.name === t.property; });
    return !pr || pr.status !== 'archived';
  }).length;
  var noticeCount = state.tenants.filter(function(t){return t.status==='notice_given';}).length;
  var occUi = getPortfolioOccupancyUi();
  var activeProps = (state.properties||[]).filter(function(p){return p && p.status!=='archived';});
  var ownedCount = activeProps.filter(function(p){return p.ownershipType==='owned';}).length;
  var managedCount = activeProps.length - ownedCount;
  var marginPct = ms.expectedIncome > 0 ? Math.round(ms.expectedNet/ms.expectedIncome*100) : 0;
  var heroSubtitle = fmt(ms.expectedIncome) + ' income · ' + marginPct + '% margin';
  var occColor = occUi.displayPct >= 80 ? 'emerald' : occUi.displayPct >= 65 ? 'amber' : 'orange';

  // ── Header (compact: title + subtitle, two right-aligned pills) ──
  // Compact selectors styled as pills sit in the header right slot.
  var coOpts = '<option value="">All Companies</option>' + (state.companies||[]).map(function(c){return '<option value="'+c.id+'" '+(dashCo===c.id?'selected':'')+'>'+esc(c.name)+'</option>';}).join('');
  var moOpts = MONTHS.map(function(mo){return '<option value="'+mo.key+'" '+(selMonth===mo.key?'selected':'')+'>'+mo.label+'</option>';}).join('');
  var pillStyle = 'padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer';
  var coPill = '<select aria-label="Company" onchange="state.filters.dashCompany=this.value;render()" style="'+pillStyle+'">' + coOpts + '</select>';
  var moPill = '<select aria-label="Month" onchange="state.dashMonth=this.value;render()" style="'+pillStyle+';min-width:120px">' + moOpts + '</select>';
  html += renderScreenHeader({
    title: 'Dashboard',
    subtitle: heroSubtitle,
    rightActions: [coPill, moPill]
  });

  // ── Hero: Net Profit / Mo ──
  html += renderHeroCard({
    icon: '📈',
    label: 'Net Profit / Mo',
    value: '<span style="color:#fff">' + fmt(ms.expectedNet) + '</span>',
    subtitle: 'After all costs · ' + ms.label
  });

  // ── Stat row: Properties · Tenants · Occupancy ──
  html += renderStatRow([
    { label:'Properties', value: activeProps.length, color:'default', subtitle: ownedCount + ' owned · ' + managedCount + ' managed' },
    { label:'Tenants',    value: activeTenantCount, color:'teal',    subtitle: noticeCount ? noticeCount + ' on notice' : 'all active' },
    { label:'Occupancy',  value: occUi.displayPct + '%', color: occColor, subtitle: occUi.occupiedRooms + ' / ' + occUi.totalRooms + ' rooms' }
  ]);

  // ── Collected card with progress ──
  var collectedPct = ms.expectedIncome > 0 ? Math.min(100, Math.round(collectedAmt/ms.expectedIncome*100)) : 0;
  html += '<div style="background:var(--surface);border-radius:var(--radius-lg);padding:14px 16px;box-shadow:var(--shadow-card);margin-bottom:14px">'
    +  '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">'
    +    '<div><div style="font-size:11px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.04em">Collected (' + ms.label + ')</div>'
    +    '<div style="font-size:22px;font-weight:700;color:var(--emerald-600);font-family:\'DM Mono\',monospace">' + fmt(collectedAmt) + '</div></div>'
    +    '<div style="text-align:right"><div style="font-size:11px;color:var(--gray-500)">vs ' + fmt(ms.expectedIncome) + ' expected</div>'
    +    '<div style="font-size:13px;font-weight:700;color:var(--gray-900)">' + collectedPct + '%</div></div>'
    +  '</div>'
    +  '<div style="height:8px;background:var(--gray-100);border-radius:999px;overflow:hidden"><div style="height:100%;width:' + collectedPct + '%;background:var(--emerald-500);border-radius:999px;transition:width .4s ease"></div></div>'
    +  '<div style="font-size:11px;color:var(--gray-500);margin-top:6px">' + (ms.collectedPays||[]).length + ' payments</div>'
    + '</div>';

  // Filter properties by company for downstream blocks (chart IIFE etc. read these by these names).
  var dashProps = (dashCo ? state.properties.filter(function(p){return p.companyId===dashCo;}) : state.properties.slice()).filter(isPropertyActive);
  var propNames = {};
  dashProps.forEach(function(p){ propNames[p.name]=1; });

  // Quick actions
  html += '<div class="quick-actions">';
  html += '<button class="qa-btn" onclick="openModal(\'addProp\')">&#x2795; Add Property</button>';
  html += '<button class="qa-btn" onclick="openModal(\'addTenant\')">&#x1F465; Add Tenant</button>';
  html += '<button class="qa-btn" onclick="goto(\'rent\')">&#x1F4B7; Record Payment</button>';
  html += '<button class="qa-btn" onclick="openModal(\'addMaint\')">&#x1F527; Log Maintenance</button>';
  html += '<button class="qa-btn" onclick="goto(\'reports\')">&#x1F4CA; Export Report</button>';
  html += '</div>';

  // Tooltip div
  html += '<div id="chart-tip" style="display:none;position:fixed;background:var(--text);color:#fff;padding:8px 12px;border-radius:9px;font-size:12px;font-weight:600;z-index:999;pointer-events:none;line-height:1.6;min-width:130px"></div>';

  // 6-month chart + P&L — equal width
  html += '<div class="grid-2"><div class="card">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div class="card-title" style="margin:0">&#x1F4CA; 6-Month Cash Flow</div></div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-bottom:14px">Tap a column to drill into that month · current month fills as you log payments</div>';

  // ── Column chart — Option A: stacked income / cost bars per month ──
  // Past months: gradient-filled bars (data is final).
  // Live month: teal-gradient bar with a pulsing glow + dashed outline that
  //   shows the EXPECTED income ceiling (so the empty space inside the dashed
  //   box visualises what's still to be collected this month).
  // Empty months: a small dashed "horizon line" at the bottom — communicates
  //   "no data yet" without faking a bar like the previous version did when
  //   the seed was thin.
  // Animation: each bar grows from scaleY(0) over ~1s with a 100ms stagger.
  (function(){
    // Build expected income for the current month from active tenants — gives
    // the dashed-outline ceiling that the live month "fills up" toward.
    var liveMonthExpected = (function(){
      var sum = 0;
      (state.tenants||[]).forEach(function(t){
        if (!t || !propNames[t.property]) return;
        if (typeof isBillableTenant === 'function' && !isBillableTenant(t)) return;
        sum += (typeof tenantMonthlyRent === 'function') ? tenantMonthlyRent(t) : ((t.freq==='monthly'?t.rent:(t.rent||0)*52/12));
      });
      sum += dashProps.reduce(function(s,p){
        return s + ((typeof getPropStrMonthlyIncome === 'function') ? getPropStrMonthlyIncome(p) : 0);
      }, 0);
      return Math.round(sum);
    })();
    // Expected costs for the live month: recurring monthly expenses + sum of
    // landlord rents on managed properties. Floors at the actual logged-cost
    // value so the dashed outline never sits below the solid bar.
    var liveMonthExpectedCosts = (function(){
      var sum = 0;
      (state.expenses||[]).forEach(function(e){
        if (!e || !e.recurring) return;
        if (dashCo && e.companyId && e.companyId !== dashCo) return;
        if ((e.freq||'') === 'monthly') sum += (+e.amount||0);
        else if ((e.freq||'') === 'weekly')  sum += (+e.amount||0) * 52 / 12;
        else if ((e.freq||'') === 'quarterly') sum += (+e.amount||0) / 3;
        else if ((e.freq||'') === 'yearly')    sum += (+e.amount||0) / 12;
      });
      sum += dashProps.reduce(function(s,p){ return s + (+p.landlord || 0); }, 0);
      return Math.round(sum);
    })();
    // Y-axis range covers the largest of: actual income/cost across all months,
    // and live-month expected ceilings.
    var maxAbs = Math.max(
      liveMonthExpected,
      liveMonthExpectedCosts,
      Math.max.apply(null, trend.map(function(x){ return Math.max(x.i, x.c); }).concat([1]))
    );
    var niceMax = (function(v){
      if (v <= 0) return 1000;
      var pow = Math.pow(10, Math.floor(Math.log10(v)));
      var top = Math.ceil(v / pow) * pow;
      return Math.ceil(top * 1.05 / pow) * pow;
    })(maxAbs);
    var ticks = [niceMax, niceMax * 0.75, niceMax * 0.5, niceMax * 0.25, 0];
    function fmtTick(v){
      if (v >= 1e6) return '£' + (v/1e6).toFixed(1) + 'm';
      if (v >= 1000) return '£' + Math.round(v/1000) + 'k';
      return '£' + v;
    }
    // A wider viewBox gives bars proper breathing room. Two grouped bars per
    // month (Income, Costs) — Profit moved off the chart because it's already
    // surfaced in the P&L card next to it.
    var W = 540, H = 220, axisW = 48, padR = 12, padT = 16, padB = 30;
    var plotW = W - axisW - padR;
    var plotH = H - padT - padB;
    var slotW = plotW / trend.length;
    var groupBarsW = Math.min(40, slotW * 0.62);
    var groupGap = 5;
    var barW = (groupBarsW - groupGap) / 2;

    var svg = '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;font-family:Inter,system-ui,sans-serif">';
    // Inline keyframes + classes so the chart is self-contained — no global CSS dependency.
    svg += '<defs>'
      + '<linearGradient id="cfIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#10B981"/><stop offset="100%" stop-color="#A7F3D0"/></linearGradient>'
      + '<linearGradient id="cfCost"   x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EF4444"/><stop offset="100%" stop-color="#FECACA"/></linearGradient>'
      + '<linearGradient id="cfLive"   x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#14B8A6"/><stop offset="100%" stop-color="#0D9488"/></linearGradient>'
      + '<style>'
      +   '.cf-bar{transform-origin:bottom;animation:cfGrow 1s cubic-bezier(.22,1,.36,1) both}'
      +   '.cf-d0{animation-delay:.05s}.cf-d1{animation-delay:.15s}.cf-d2{animation-delay:.25s}'
      +   '.cf-d3{animation-delay:.35s}.cf-d4{animation-delay:.45s}.cf-d5{animation-delay:.55s}'
      +   '@keyframes cfGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}'
      +   '.cf-live{animation:cfPulse 2.2s ease-in-out infinite}'
      +   '@keyframes cfPulse{0%,100%{filter:drop-shadow(0 0 0 rgba(20,184,166,0))}50%{filter:drop-shadow(0 0 6px rgba(20,184,166,.55))}}'
      +   '.cf-exp{stroke-dasharray:240;stroke-dashoffset:240;animation:cfDash 1.3s ease-out forwards;animation-delay:.7s}'
      +   '@keyframes cfDash{to{stroke-dashoffset:0}}'
      + '</style>'
      + '</defs>';
    // Y-axis ticks
    ticks.forEach(function(v){
      var ratio = niceMax > 0 ? v / niceMax : 0;
      var y = padT + plotH - ratio * plotH;
      svg += '<line x1="'+axisW+'" y1="'+y+'" x2="'+(W - padR)+'" y2="'+y+'" stroke="#E5E7EB" stroke-width="1" '+(v===0?'':'stroke-dasharray="3 3"')+' />';
      svg += '<text x="'+(axisW - 6)+'" y="'+(y + 3)+'" text-anchor="end" font-size="9" fill="#64748B">'+fmtTick(v)+'</text>';
    });
    // Bars per month
    trend.forEach(function(t, i){
      var slotX = axisW + i * slotW;
      var groupX = slotX + (slotW - groupBarsW) / 2;
      var isSel = t.key === selMonth;
      var hI = niceMax > 0 ? (Math.max(0, t.i) / niceMax) * plotH : 0;
      var hC = niceMax > 0 ? (Math.max(0, t.c) / niceMax) * plotH : 0;
      var yI = padT + plotH - hI;
      var yC = padT + plotH - hC;
      var profit = t.p;
      var tip = t.label
        + '|&#x1F4B0; Income: ' + fmt(Math.round(t.i))
        + '|&#x1F4B8; Costs: '  + fmt(Math.round(t.c))
        + '|' + (profit >= 0 ? '&#x2705;' : '&#x274C;') + ' Profit: ' + fmt(Math.round(Math.abs(profit)));
      svg += '<g style="cursor:pointer" onclick="state.dashMonth=\''+t.key+'\';render()" onmouseover="showChartTip(event,\''+tip+'\')" onmouseout="hideChartTip()">';
      svg += '<rect x="'+slotX+'" y="'+padT+'" width="'+slotW+'" height="'+plotH+'" fill="transparent"/>';
      // Income bar — teal gradient on the live month, mint gradient on past months.
      if (hI > 0) {
        var fillI = isSel ? 'url(#cfLive)' : 'url(#cfIncome)';
        var clsI = 'cf-bar cf-d'+i + (isSel ? ' cf-live' : '');
        svg += '<rect class="'+clsI+'" x="'+groupX+'" y="'+yI+'" width="'+barW+'" height="'+hI+'" fill="'+fillI+'" rx="3"/>';
      }
      // Cost bar — coral gradient.
      if (hC > 0) {
        svg += '<rect class="cf-bar cf-d'+i+'" x="'+(groupX+barW+groupGap)+'" y="'+yC+'" width="'+barW+'" height="'+hC+'" fill="url(#cfCost)" rx="3"/>';
      }
      // Live-month expected outlines — show what each bar SHOULD reach by month-end.
      if (isSel && liveMonthExpected > 0) {
        var hE = (Math.max(t.i, liveMonthExpected)/niceMax)*plotH;
        var yE = padT + plotH - hE;
        svg += '<rect class="cf-exp" x="'+groupX+'" y="'+yE+'" width="'+barW+'" height="'+hE+'" fill="none" stroke="#10B981" stroke-width="1.5" stroke-dasharray="3 3" rx="3"/>';
      }
      if (isSel && liveMonthExpectedCosts > 0) {
        var hEC = (Math.max(t.c, liveMonthExpectedCosts)/niceMax)*plotH;
        var yEC = padT + plotH - hEC;
        svg += '<rect class="cf-exp" x="'+(groupX+barW+groupGap)+'" y="'+yEC+'" width="'+barW+'" height="'+hEC+'" fill="none" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="3 3" rx="3"/>';
      }
      // Empty placeholder for past months with no data — small dashed horizon line.
      if (hI === 0 && hC === 0 && !isSel) {
        svg += '<rect x="'+groupX+'" y="'+(padT+plotH-5)+'" width="'+groupBarsW+'" height="5" fill="none" stroke="#E2E8F0" stroke-dasharray="2 3" rx="2"/>';
      }
      var labelX = groupX + groupBarsW / 2;
      svg += '<text x="'+labelX+'" y="'+(H - 12)+'" text-anchor="middle" font-size="11" font-weight="'+(isSel?700:500)+'" fill="'+(isSel?'#0D9488':'#374151')+'">'+t.m+(isSel?' · live':'')+'</text>';
      svg += '</g>';
    });
    svg += '</svg>';
    html += svg;
  })();

  html += '<div style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap;align-items:center">';
  html += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--gray-500)"><div style="width:12px;height:12px;border-radius:3px;background:linear-gradient(180deg,#10B981,#A7F3D0)"></div>Income</div>';
  html += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--gray-500)"><div style="width:12px;height:12px;border-radius:3px;background:linear-gradient(180deg,#EF4444,#FECACA)"></div>Costs</div>';
  html += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--gray-500)"><div style="width:12px;height:12px;border-radius:3px;background:linear-gradient(180deg,#14B8A6,#0D9488)"></div>Live month</div>';
  html += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--gray-500)"><div style="width:12px;height:12px;border-radius:3px;border:1.5px dashed #10B981;background:transparent"></div>Expected (this month)</div>';
  html += '</div></div>';

  // P&L card
  html += '<div class="card"><div class="card-title">&#x1F4BC; P&amp;L &mdash; '+ms.label+'</div>';
  html += '<div class="pl-row"><span class="pl-label">Total Income</span><span class="pl-val" style="color:var(--green)">'+fmt(ms.income)+'</span></div>';
  html += '<div class="pl-row"><span class="pl-label">Landlord Rent</span><span class="pl-val" style="color:var(--red)">&mdash; '+fmt(ms.landlord)+'</span></div>';
  html += '<div class="pl-row"><span class="pl-label">Staff &amp; Labour</span><span class="pl-val" style="color:var(--amber)">&mdash; '+fmt(staffT)+'</span></div>';
  html += '<div class="pl-row"><span class="pl-label">Property Costs</span><span class="pl-val" style="color:var(--amber)">&mdash; '+fmt(propT)+'</span></div>';
  html += '<div class="pl-row"><span class="pl-label">Overhead</span><span class="pl-val" style="color:var(--muted)">&mdash; '+fmt(overT)+'</span></div>';
  html += '<div class="pl-row"><span style="font-size:14px;font-weight:700">Net Profit</span><span style="font-size:16px;font-weight:700;font-family:monospace;color:'+(ms.profit>=0?'var(--green)':'var(--red)')+'">'+fmt(ms.profit)+'</span></div>';
  html += '</div></div>';

  // ── AI Agent + Compliance side by side (first) ──
  html += '<div class="grid-2">';
  html += '<div class="ai-card">';
  html += '<div style="display:flex;align-items:center;gap:8px;padding:16px 18px 0"><div class="ai-pulse"></div><div style="font-size:13px;font-weight:700;color:#E2E8F0">&#x1F916; Portfolio Intelligence Agent</div></div>';
  html += '<div id="ai-agent-output"></div>';
  html += '</div>';
  // Compliance compact
  html += '<div class="card" style="padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div class="card-title" style="font-size:13px;margin:0">&#x1F4C5; Compliance</div><button class="card-action" onclick="goto(\'properties\')" style="font-size:11px">View all</button></div>';
  html += renderComplianceWidget();
  html += '</div></div>';

  // Loss-making + maintenance (after AI/compliance)
  html += '<div class="grid-2">';
  html += '<div class="card" style="'+(lossProps.length>0?'border-color:#FECDD3':'')+'"><div class="card-title" style="color:'+(lossProps.length>0?'var(--red)':'var(--text)')+'">&#x26A0;&#xFE0F; Loss-Making ('+lossProps.length+')</div>';
  if(!lossProps.length){html+='<div style="font-size:13px;color:var(--green)">&#x2713; All properties profitable</div>';}
  else{lossProps.slice(0,6).forEach(function(p){html+='<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:12px;font-weight:600">'+esc(p.name)+'</div><div style="font-size:11px;color:var(--muted)">'+p.occupied+'/'+p.rooms+' rooms</div></div><span class="mono" style="font-size:12px;font-weight:700;color:var(--red)">'+fmt(net(p))+'</span></div>';});if(lossProps.length>6)html+='<div style="font-size:11px;color:var(--muted);padding-top:6px">+'+(lossProps.length-6)+' more</div>';}
  html += '</div>';
  html += '<div class="card"><div class="card-title" style="color:var(--amber)">&#x1F527; Open Maintenance</div>';
  if(!s.openM.length){html+='<div style="font-size:13px;color:var(--green)">&#x2713; No open issues</div>';}
  else{s.openM.slice(0,5).forEach(function(m){html+='<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:12px;font-weight:600">'+esc(m.issue)+'</div><div style="font-size:11px;color:var(--muted)">'+esc(m.property)+' &middot; Rm '+esc(m.room)+'</div></div>'+badge(m.priority)+'</div>';});}
  html += '</div></div>';

  html += '<div class="card" style="margin-top:14px">'+renderVoidTracker()+'</div>';
  html += '<div class="card" style="margin-top:14px">'+renderDepositSummary()+'</div>';

  return html;
}


// renderProperties: canonical impl lives in src/dashboard/app.js. The orphan
// copy that previously lived here overrode app.js at bundle time (last-wins)
// and silently killed every Properties-page feature added after it — SA filter,
// compliance strip, SA income on cards, Airbnb badge, Media tab counter. Removed.
