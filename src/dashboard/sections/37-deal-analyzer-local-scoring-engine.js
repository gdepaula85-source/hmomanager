// ── DEAL ANALYZER: local scoring engine ───────────────────────────────────────
function analyzeLocalDeal() {
  var d=(state.dealInputs&&state.dealInputs._scratch)||{};
  var isWhole=(d.lettingType||'hmo')==='whole';
  // Return null only if there is genuinely no data entered
  if(!d.wkrent && !d._grossIncome) return null;
  if(!isWhole && !d.rooms && !d.wkrent) return null;
  var isOwned=d.dealType==='owned';
  var grossIncome=d._grossIncome||0;
  var totalCosts=d._totalCosts||0;
  var net=grossIncome-totalCosts;
  var rooms=Math.max(1,d.rooms||1);
  var margin=grossIncome>0?Math.round(net/grossIncome*100):0;
  var annualNet=net*12;
  var cashIn=isOwned?Math.max(1,(d.price||0)*(d.dep||25)/100+(d.reno||0)):0;
  var grossYield=(isOwned&&(d.price||0)>0)?+((grossIncome*12/d.price)*100).toFixed(1):0;
  var netYield=(isOwned&&(d.price||0)>0)?+((annualNet/d.price)*100).toFixed(1):0;
  var roi=(isOwned&&cashIn>100&&annualNet>0)?+(annualNet/cashIn*100).toFixed(1):0;
  var payback=(isOwned&&cashIn>100&&net>0)?+(cashIn/net/12).toFixed(1):0;
  var beRooms=(!isOwned&&grossIncome>0)?Math.ceil(totalCosts/(grossIncome/rooms)):0;
  var beRatio=rooms>0?beRooms/rooms:1;
  var runCosts=(d.bills||0)+(d.maint||0)+(d.insur||0)+(d.mgmt||0)+(d.voidCost||0)+(d.other||0);

  var score=50,strengths=[],risks=[],suggestions=[];

  if(!isOwned) {
    // ── R2R scoring ──────────────────────────────────────────────────────────
    if(margin>=25){score+=20;strengths.push('Strong '+margin+'% profit margin — well above the 20% R2R benchmark');}
    else if(margin>=20){score+=12;strengths.push('Good '+margin+'% margin — meets the R2R 20% target');}
    else if(margin>=12){score+=2;suggestions.push('Margin of '+margin+'% is workable but tight — negotiate LL rent down or raise room rates to reach 20%+');}
    else if(margin>=0){score-=12;risks.push('Margin of '+margin+'% is dangerously thin — any void will push this into a loss');}
    else{score-=30;risks.push('Negative margin of '+margin+'% — costs already exceed income at current occupancy');}

    // Break-even
    if(beRooms>0){
      if(beRatio<=0.55){score+=15;strengths.push('Low break-even at '+beRooms+'/'+rooms+' rooms — good downside protection if rooms go void');}
      else if(beRatio<=0.70){score+=8;strengths.push('Manageable break-even at '+beRooms+'/'+rooms+' rooms');}
      else if(beRatio<=0.85){score-=5;risks.push('High break-even at '+beRooms+'/'+rooms+' rooms — limited void buffer');}
      else{score-=18;risks.push('Very high break-even at '+beRooms+'/'+rooms+' rooms — one empty room pushes into the red');}
    }

    // Void allowance
    if(!(d.voidCost>0))suggestions.push('Add a void allowance of at least '+fmt(Math.round(grossIncome*0.08))+'/mo (8%) — empty periods will happen');
    else if(d.voidCost>0&&d.voidCost<grossIncome*0.05)suggestions.push('Void allowance of '+fmt(d.voidCost)+'/mo may be low — consider '+fmt(Math.round(grossIncome*0.08))+'/mo (8%)');

    // Maintenance reserve
    if(!(d.maint>0))suggestions.push('No maintenance reserve — budget at least '+fmt(rooms*50)+'/mo (£50/room) for repairs and upkeep');

    // Room rate sense check (South London HMO)
    if(!isWhole&&(d.wkrent||0)>0){
      if(d.wkrent<120)risks.push('Weekly rate of £'+d.wkrent+'/room is below South London HMO market (typically £130–180/wk) — verify comparables');
      else if(d.wkrent>=130&&d.wkrent<=180){score+=5;strengths.push('Room rate of £'+d.wkrent+'/wk is within typical South London HMO range');}
      else if(d.wkrent>220)risks.push('Weekly rate of £'+d.wkrent+'/room is high — confirm rooms will let at this price before committing');
    }

    // LL rent as % of income
    var llRent=d.llrent||0;
    if(llRent>0&&grossIncome>0){
      var llPct=Math.round(llRent/grossIncome*100);
      if(llPct>85){score-=10;risks.push('LL rent is '+llPct+'% of gross income — leaves almost no margin for costs or voids');}
      else if(llPct<=70){score+=5;strengths.push('LL rent at '+llPct+'% of gross income leaves good headroom for running costs');}
    }

  } else {
    // ── Owned/BTL scoring ────────────────────────────────────────────────────
    if(grossYield>=10){score+=20;strengths.push('Excellent gross yield of '+grossYield+'% — well above the 8% BTL benchmark');}
    else if(grossYield>=8){score+=12;strengths.push('Good gross yield of '+grossYield+'%');}
    else if(grossYield>=6){score+=2;suggestions.push('Yield of '+grossYield+'% is modest — South London HMO conversions can achieve 8%+');}
    else if(grossYield>=4){score-=8;risks.push('Low yield of '+grossYield+'% — property may struggle to cash-flow after all costs');}
    else if(grossYield>0){score-=20;risks.push('Very low yield of '+grossYield+'% — returns do not justify the capital at risk');}

    if(roi>=12){score+=18;strengths.push('Strong cash ROI of '+roi+'% — good return on invested capital');}
    else if(roi>=8){score+=10;strengths.push('Good cash ROI of '+roi+'%');}
    else if(roi>=5){score+=2;}
    else if(roi>0){score-=8;risks.push('Cash ROI of '+roi+'% is below typical BTL expectations of 8–12%');}

    if((d.dep||25)>=25){score+=5;strengths.push('25%+ deposit unlocks better mortgage rates and reduces LTV risk');}
    else if((d.dep||25)<20){risks.push('Deposit below 20% — restricted mortgage options and higher interest costs likely');}

    if((d.mrate||4.5)>5.5){score-=5;risks.push('Mortgage rate of '+d.mrate+'% is high — stress-test cashflow at 7% in case of remortgage');}
    else if((d.mrate||4.5)<=4){score+=5;strengths.push('Mortgage rate of '+d.mrate+'% is favourable — lock in as long as possible');}

    if((d.reno||0)>0){
      var renoRatio=(d.reno/(d.price||1));
      if(renoRatio>0.15)risks.push('Renovation of '+fmt(d.reno)+' is '+(renoRatio*100).toFixed(0)+'% of purchase price — get independent contractor quotes before committing');
      else{score+=3;strengths.push('Renovation budget of '+fmt(d.reno)+' is reasonable relative to purchase price');}
    }

    if(payback>0&&payback<8){score+=8;strengths.push('Payback period of '+payback+' years — solid return of invested cash');}
    else if(payback>=12){risks.push('Long payback period of '+payback+' years — capital tied up for a long time');}

    // Void/maintenance checks
    if(!(d.voidCost>0))suggestions.push('Add void allowance of at least '+fmt(Math.round(grossIncome*0.06))+'/mo — empty periods reduce yield significantly');
    if(!(d.maint>0))suggestions.push('Include maintenance reserve of £50–75/room/month for an HMO property');
  }

  // Net profit check
  if(net<0){score=Math.max(5,score-30);risks.push('Deal produces a loss of '+fmt(Math.abs(net))+'/mo at '+d.occ+'% occupancy — only viable at 100% occupancy');}
  else if(net>0&&net<200){score=Math.max(10,score-8);suggestions.push('Net of '+fmt(net)+'/mo is very thin — a single void or repair bill will flip this to a loss');}
  else if(net>=1000){score+=5;}

  score=Math.max(5,Math.min(98,score));
  var verdict=score>=65?'GO':score>=40?'CAUTION':'NO-GO';
  var headline=verdict==='GO'
    ?(isOwned?'Strong deal — '+grossYield+'% yield with '+roi+'% cash ROI on '+fmt(cashIn)+' invested':'Good deal — '+margin+'% margin, break-even at '+beRooms+' of '+rooms+' rooms')
    :verdict==='CAUTION'
    ?(isOwned?'Proceed carefully — returns are moderate, stress-test all costs':'Marginal deal — thin margin leaves little room for error')
    :(isOwned?'Reconsider — capital could work harder elsewhere':'Not recommended at current terms — costs are too high relative to income');

  return {score:score,verdict:verdict,headline:headline,strengths:strengths.slice(0,3),risks:risks.slice(0,3),suggestions:suggestions.slice(0,3)};
}
