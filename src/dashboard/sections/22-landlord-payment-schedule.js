// ── LANDLORD PAYMENT SCHEDULE ──────────────────────────────────────────────
// One-shot utility: bump every property's leaseStartDate to today, drop every
// unpaid landlord-payment row dated before this month, and regenerate from
// scratch. Run from the JS console: resetLandlordPaymentsToToday()
// Paid rows are preserved so historical statements stay intact.
async function resetLandlordPaymentsToToday(opts){
  opts = opts || {};
  var todayISO = formatLocalDateISO(new Date());
  var props = (state.properties||[]).filter(function(p){
    return p && p.status !== 'archived';
  });
  if(!props.length){
    if(typeof showToast === 'function') showToast('No active properties to update','info');
    return 0;
  }
  if(!opts.skipConfirm){
    var ok = confirm('Reset landlord payments?\n\n• Set every property’s lease start to TODAY ('+todayISO+')\n• Delete every UNPAID landlord-payment row dated before this month from Supabase\n• Regenerate the schedule from today forward\n\nPaid rows will NOT be touched. Continue?');
    if(!ok) return 0;
  }
  // 1. Stamp leaseStartDate = today on every active property.
  var p = 0;
  props.forEach(function(prop){
    prop.leaseStartDate = todayISO;
    p++;
  });
  // 2. Identify unpaid entries from prior months (string compare on YYYY-MM
  //    works because monthKey is zero-padded).
  var now = new Date();
  var thisMonthKey = now.getFullYear()+'-'+(now.getMonth()+1<10?'0':'')+(now.getMonth()+1);
  var toDrop = (state.landlordPayments||[]).filter(function(lp){
    if(lp.status === 'paid') return false;
    if(!lp.monthKey) return true;
    return lp.monthKey < thisMonthKey;
  });
  var dropIds = toDrop.map(function(lp){return String(lp.id);}).filter(Boolean);
  // 3. Delete from Supabase BEFORE the local filter — saveState() only upserts,
  //    it never deletes, so without this step the rows come back on refresh.
  if(dropIds.length && typeof supa !== 'undefined' && typeof _currentOrgId !== 'undefined' && _currentOrgId){
    // Chunk to avoid URL length limits on .in()
    for(var i=0; i<dropIds.length; i+=200){
      var chunk = dropIds.slice(i, i+200);
      try {
        var res = await supa.from('landlord_payments')
          .delete()
          .in('id', chunk)
          .eq('org_id', _currentOrgId);
        if(res && res.error) console.warn('landlord_payments delete chunk failed:', res.error.message);
      } catch(e) {
        console.warn('landlord_payments delete threw:', e && e.message);
      }
    }
  }
  // 4. Drop them locally now that the DB delete has been issued.
  state.landlordPayments = (state.landlordPayments||[]).filter(function(lp){
    if(lp.status === 'paid') return true;
    if(!lp.monthKey) return false;
    return lp.monthKey >= thisMonthKey;
  });
  // 5. Regenerate clean — ensureLandlordSchedule reads the new leaseStartDate.
  if(typeof ensureLandlordSchedule === 'function') ensureLandlordSchedule();
  // saveStateImmediate flushes the upsert NOW (default saveState waits 1.5s)
  // so the new leaseStartDate + regenerated rows hit Supabase before any refresh.
  if(typeof saveStateImmediate === 'function') await saveStateImmediate({silentSuccess:true});
  else if(typeof saveState === 'function') saveState();
  if(typeof render === 'function') render();
  if(typeof showToast === 'function') showToast('Reset '+p+' propert'+(p===1?'y':'ies')+', deleted '+dropIds.length+' DB row'+(dropIds.length===1?'':'s')+' ✓','success');
  return {properties:p, droppedRows:dropIds.length, leaseStartDate:todayISO};
}
if(typeof window !== 'undefined') window.resetLandlordPaymentsToToday = resetLandlordPaymentsToToday;

// Generates one entry per PROPERTY per month — so each can be paid independently
function ensureLandlordSchedule() {
  if(!state.landlordPayments) state.landlordPayments = [];
  // Purge any old bundle-style entries (created before per-property migration)
  state.landlordPayments = state.landlordPayments.filter(function(p){
    return p.propId !== undefined && p.propId !== null;
  });
  var now = new Date();
  // Purge entries for months before earliest tenant start date at each property
  state.landlordPayments = state.landlordPayments.filter(function(lp){
    if(lp.status === 'paid') return true; // never purge paid entries
    var prop = state.properties.find(function(p){ return p.id === lp.propId; });
    if(!prop) return false;
    var propTenants = state.tenants.filter(function(t){ return t.property === prop.name && t.status !== 'inactive'; });
    var earliest = null;
    propTenants.forEach(function(t){
      var sd = t.startDate || t.checkIn || t.moveIn;
      if(sd){ var d = new Date(sd); if(!isNaN(d.getTime()) && (!earliest || d < earliest)) earliest = d; }
    });
    var propCreated = null;
    if(prop.createdAt) {
      var pc2 = new Date(prop.createdAt);
      if(!isNaN(pc2.getTime())) propCreated = pc2;
    }
    // leaseStartDate is the explicit user-set anchor — wins over both createdAt and earliest tenant.
    var leaseStart = null;
    if(prop.leaseStartDate) {
      var ls2 = new Date(prop.leaseStartDate);
      if(!isNaN(ls2.getTime())) leaseStart = ls2;
    }
    var parts = (lp.monthKey||'').split('-');
    if(parts.length !== 2) return true;
    var entryMonth = new Date(+parts[0], +parts[1]-1, 1);
    // Lower bound = lease start (if set) else max(property created, earliest tenant) else current month.
    var lb;
    if(leaseStart) lb = new Date(leaseStart.getFullYear(), leaseStart.getMonth(), 1);
    else if(earliest) lb = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    else if(propCreated) lb = new Date(propCreated.getFullYear(), propCreated.getMonth(), 1);
    else lb = new Date(now.getFullYear(), now.getMonth(), 1);
    if(!leaseStart && propCreated) {
      var pcM = new Date(propCreated.getFullYear(), propCreated.getMonth(), 1);
      if(pcM > lb) lb = pcM;
    }
    return entryMonth >= lb;
  });
  // Generate for last 3 months, current month, next 2 months
  var months = [];
  for(var offset=-3; offset<=2; offset++) {
    var d = new Date(now.getFullYear(), now.getMonth()+offset, 1);
    var y = d.getFullYear(), m = d.getMonth();
    var key = y+'-'+(m+1<10?'0':'')+(m+1);
    var label = d.toLocaleDateString('en-GB',{month:'short',year:'numeric'});
    months.push({key:key, label:label, ts: d.getTime()});
  }

  state.landlords.forEach(function(ll) {
    var llProps = state.properties.filter(function(p){
      return propertyLinkedToLandlord(p, ll) && p.landlord>0 && isPropertyActive(p);
    });
    if(!llProps.length) return;

    llProps.forEach(function(prop) {
      // Determine earliest start date — use earliest tenant's startDate/checkIn
      var propTenants = state.tenants.filter(function(t){return t.property===prop.name && t.status!=='inactive';});
      var earliestStart = null;
      propTenants.forEach(function(t){
        var sd = t.startDate || t.checkIn || t.moveIn;
        if(sd) {
          var d = new Date(sd);
          if(!isNaN(d.getTime()) && (!earliestStart || d < earliestStart)) earliestStart = d;
        }
      });
      // Property created_at acts as a hard lower bound — no landlord rent due before the property existed
      var propCreated = null;
      if(prop.createdAt) {
        var pc = new Date(prop.createdAt);
        if(!isNaN(pc.getTime())) propCreated = pc;
      }
      // Lease start date overrides everything — explicit user input.
      var leaseStartGen = null;
      if(prop.leaseStartDate) {
        var ls = new Date(prop.leaseStartDate);
        if(!isNaN(ls.getTime())) leaseStartGen = ls;
      }
      // Landlord rent due day priority:
      //   1. prop.landlordPayDay (explicit user setting from the property modal)
      //   2. leaseStartDate's day-of-month (legacy/implicit)
      //   3. 1st of the month (default)
      // landlordPayDay was added so users can change the recurring rent due
      // day WITHOUT having to also change the lease start date — they're now
      // independent fields.
      var payDay;
      if (prop.landlordPayDay && prop.landlordPayDay >= 1 && prop.landlordPayDay <= 31) {
        payDay = prop.landlordPayDay;
      } else if (leaseStartGen) {
        payDay = leaseStartGen.getDate();
      } else {
        payDay = 1;
      }

      months.forEach(function(mo) {
        // Skip months before the property was created, or before the earliest tenant started
        // If no tenants, only generate current + future months
        var moStart = new Date(mo.ts);
        var currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Lower bound priority: leaseStartDate > earliest tenant start > propCreated > current month
        var lowerBound = currentMonthStart;
        if(leaseStartGen) {
          lowerBound = new Date(leaseStartGen.getFullYear(), leaseStartGen.getMonth(), 1);
        } else if(earliestStart) {
          lowerBound = new Date(earliestStart.getFullYear(), earliestStart.getMonth(), 1);
          if(propCreated) {
            var pcMonth = new Date(propCreated.getFullYear(), propCreated.getMonth(), 1);
            if(pcMonth > lowerBound) lowerBound = pcMonth;
          }
        } else if(propCreated) {
          lowerBound = new Date(propCreated.getFullYear(), propCreated.getMonth(), 1);
        } else {
          // No anchors at all → only current + future
          if(moStart < currentMonthStart) return;
        }
        if(moStart < lowerBound) return;
        // One entry per property per month — keyed by landlordId + propId + monthKey
        var exists = state.landlordPayments.find(function(p){
          return p.landlordId===ll.id && p.propId===prop.id && p.monthKey===mo.key;
        });
        // If the lease start day has been changed since the row was generated,
        // reflect the new pay day on existing PENDING rows. Paid rows keep
        // whatever due date was historically recorded.
        if (exists && exists.status !== 'paid') {
          var expectedDueDate = payDay + ' ' + mo.label;
          if (exists.dueDate !== expectedDueDate) exists.dueDate = expectedDueDate;
        }
        if(!exists) {
          state.landlordPayments.push({
            id: crypto.randomUUID(),
            landlordId: ll.id,
            landlordName: ll.name,
            propId: prop.id,
            monthKey: mo.key,
            monthLabel: mo.label,
            propName: prop.name,
            property: prop.name,
            amount: prop.landlord,
            dueDate: payDay + ' ' + mo.label,
            dueDateTs: mo.ts,
            paidDate: null,
            method: 'bank',
            status: 'pending',
            ref: 'LP-'+mo.key+'-'+prop.id
          });
        }
      });
    });
  });
}


/** Delete all PENDING (unpaid) landlord payment rows from months before the current month,
 *  from both the DB and in-memory state. Does NOT touch paid records or future months.
 *  Called by the "🧹 Clear overdue" button on the Landlord page. */
async function _clearOverdueLandlordPayments() {
  var now = new Date();
  var thisMonthKey = now.getFullYear() + '-' + (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1);
  var toRemove = (state.landlordPayments || []).filter(function(lp) {
    return lp.status !== 'paid' && lp.monthKey && lp.monthKey < thisMonthKey;
  });
  if (!toRemove.length) { showToast('No overdue pending payments to clear', 'success'); return; }
  var mks = toRemove.map(function(lp){ return lp.monthKey; }).filter(function(mk,i,a){ return a.indexOf(mk)===i; }).sort();
  if (!confirm('Clear ' + toRemove.length + ' overdue pending payment' + (toRemove.length===1?'':'s') + ' for ' + mks.join(', ') + '?\n\nPaid records are not affected. This cannot be undone.')) return;
  // DB delete by month_key + status (handles UUID mismatches from demo resets)
  try {
    var res = await supa.from('landlord_payments')
      .delete()
      .eq('org_id', _currentOrgId)
      .eq('status', 'pending')
      .in('month_key', mks);
    if (res.error) { showToast('DB delete failed: ' + res.error.message, 'error'); return; }
  } catch(e) { showToast('Delete error: ' + (e.message || 'unknown'), 'error'); return; }
  // Remove from in-memory state
  state.landlordPayments = (state.landlordPayments || []).filter(function(lp) {
    return lp.status === 'paid' || !lp.monthKey || lp.monthKey >= thisMonthKey;
  });
  render();
  showToast('Cleared ' + toRemove.length + ' overdue payment' + (toRemove.length===1?'':'s'), 'success');
}

function renderLandlords() {
  ensureLandlordSchedule();
  var lls   = state.landlords || [];
  var lpays = state.landlordPayments || [];
  var selLL = state.filters.landlords || 'all';

  // Current month key (e.g. "2026-05") used for "Due This Week" tab and as
  // the default selection for the month dropdown.
  var _now = new Date();
  var _curMonthKey = _now.getFullYear() + '-' + (_now.getMonth()+1<10?'0':'') + (_now.getMonth()+1);

  // ── Month filter ─────────────────────────────────────────────────────────────
  // Default to CURRENT MONTH (was "All Time"). If the user explicitly picks
  // "All Time" from the dropdown, that's stored as the literal string 'all'.
  var rawMonth = state.filters.landlordMonth;
  var selMonth = (rawMonth == null) ? _curMonthKey : (rawMonth === 'all' ? '' : rawMonth);
  var filteredPays = lpays;
  if(selMonth) {
    var mo = MONTHS.find(function(m){return m.key===selMonth;});
    if(mo) {
      filteredPays = lpays.filter(function(p){
        if(!p.dueDate) return false;
        var d = new Date(p.dueDate.replace(/ /g,'-'));
        return d >= mo.from && d <= mo.to;
      });
    }
  }

  // Free-text search across landlord name + linked property names.
  var llQ = String(state.filters.landlordQ || '').toLowerCase().trim();

  // ── Company filter — apply FIRST so KPIs reflect selected company ───────────
  var selLLCo = state.filters.landlordCompany||'';
  if(selLLCo){
    var _coProps=state.properties.filter(function(p){return p.companyId===selLLCo;}).map(function(p){return p.name;});
    lls=lls.filter(function(ll){return state.properties.some(function(p){
      return propertyLinkedToLandlord(p, ll)&&isPropertyActive(p)&&_coProps.indexOf(p.name)>=0;
    });});
    // Also filter payments to only those for this company's landlords
    var _coLLNames = lls.map(function(ll){return ll.name;});
    filteredPays = filteredPays.filter(function(p){
      return _coLLNames.indexOf(p.landlordName)>=0 ||
             _coProps.indexOf(p.propName)>=0 ||
             _coProps.indexOf(p.property)>=0;
    });
  }

  // ── Summary KPIs (now from filtered set) ────────────────────────────────────
  var totalOwed    = filteredPays.filter(function(p){return p.status==='pending';}).reduce(function(s,p){return s+p.amount;},0);
  var totalPaidAll = filteredPays.filter(function(p){return p.status==='paid';}).reduce(function(s,p){return s+p.amount;},0);
  var pendingCount = filteredPays.filter(function(p){return p.status==='pending';}).length;
  var totalMonthly = lls.reduce(function(s,ll){
    var llProps = (state.properties||[]).filter(function(p){
      return propertyLinkedToLandlord(p, ll) && isPropertyActive(p) && (!selLLCo || p.companyId===selLLCo);
    });
    return s + llProps.reduce(function(ss,p){return ss+p.landlord;},0);
  },0);
  // ── v2 header / hero / alert / stat row (replaces legacy page-header + 3-card grid) ──
  var subLabel = lls.length + ' landlord' + (lls.length===1?'':'s');
  // Month dropdown — value 'all' = explicitly "All Time" (different from never-set),
  // empty value default not used here because we always have a real month or 'all'.
  var monthPill = '<select onchange="state.filters.landlordMonth=this.value;render()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer">'
    + '<option value="all"' + (rawMonth==='all'?' selected':'') + '>All Time</option>'
    + MONTHS.map(function(m){return '<option value="'+m.key+'" '+(selMonth===m.key?'selected':'')+'>'+m.label+'</option>';}).join('')
    + '</select>';
  var coPill = '<select onchange="state.filters.landlordCompany=this.value;render()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-family:inherit;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;max-width:140px">'
    + '<option value="">All Co.</option>'
    + (state.companies||[]).map(function(c){return '<option value="'+c.id+'" '+(selLLCo===c.id?'selected':'')+'>'+esc(c.name)+'</option>';}).join('')
    + '</select>';
  var addBtn = '<button onclick="openAddLandlordModal()" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Add</button>';
  var html = '';
  html += renderScreenHeader({ title:'Landlords', subtitle: subLabel, rightActions: [coPill, monthPill, addBtn] });
  html += renderHeroCard({
    icon: '🏦',
    label: 'Monthly Rent Due to Landlords',
    value: '<span style="color:#fff">' + fmt(totalMonthly) + '</span>',
    subtitle: lls.length + ' landlords · paid monthly'
  });
  if (totalOwed > 0) {
    html += renderAlertCard({
      severity: 'danger',
      icon: '⚠',
      title: fmt(totalOwed) + ' outstanding',
      subtitle: pendingCount + ' payment' + (pendingCount===1?'':'s') + ' pending — tap to action',
      onClick: 'state.filters.landlordTab=\'overdue\';state.filters.landlordsView=\'all\';render()'
    });
    // Quick-access to purge any stale overdue records that shouldn't still be pending
    html += '<div style="margin:-8px 0 4px;text-align:right">'
      + '<button onclick="_clearOverdueLandlordPayments()" style="font-size:11px;color:var(--muted);background:transparent;border:none;cursor:pointer;font-family:inherit;padding:4px 8px;text-decoration:underline">🧹 Clear overdue (last month &amp; earlier)</button>'
      + '</div>';
  }
  // ── Tab strip + search box ────────────────────────────────────────────────
  // Tabs replace the old "pending only" chip toggle with proper segmented
  // controls. State key: state.filters.landlordTab. Defaults to 'all'.
  // Backward-compat: legacy state.filters.landlordsView==='pending' maps to 'overdue'.
  var llTab = state.filters.landlordTab;
  if (!llTab && state.filters.landlordsView === 'pending') llTab = 'overdue';
  if (!llTab) llTab = 'all';

  // Compute tab counts
  var _now2 = new Date();
  var _weekFromNow = new Date(_now2.getFullYear(), _now2.getMonth(), _now2.getDate()+7).getTime();
  var _todayMs = new Date(_now2.getFullYear(), _now2.getMonth(), _now2.getDate()).getTime();
  function _payDueMs(p){ if(!p.dueDate) return 0; var d=new Date(p.dueDate); return isNaN(d.getTime())?0:d.getTime(); }
  var overduePays = filteredPays.filter(function(p){ return p.status==='pending' && _payDueMs(p) < _todayMs; });
  var dueWeekPays = filteredPays.filter(function(p){ var ms=_payDueMs(p); return p.status==='pending' && ms >= _todayMs && ms <= _weekFromNow; });
  var paidPays    = filteredPays.filter(function(p){ return p.status==='paid'; });
  var overdueLLIds = {}, dueWeekLLIds = {}, paidLLIds = {};
  overduePays.forEach(function(p){ if(p.landlordId) overdueLLIds[p.landlordId]=true; });
  dueWeekPays.forEach(function(p){ if(p.landlordId) dueWeekLLIds[p.landlordId]=true; });
  paidPays.forEach(function(p){ if(p.landlordId) paidLLIds[p.landlordId]=true; });

  var tabDefs = [
    { id:'all',     label:'All',          count:lls.length },
    { id:'overdue', label:'Overdue',      count:Object.keys(overdueLLIds).length, danger:true },
    { id:'dueweek', label:'Due this week', count:Object.keys(dueWeekLLIds).length },
    { id:'paid',    label:'Paid',         count:Object.keys(paidLLIds).length }
  ];
  html += '<div style="display:flex;gap:0;border-bottom:1px solid var(--gray-200);margin:0 0 12px 0;flex-wrap:wrap">';
  tabDefs.forEach(function(t){
    var active = llTab === t.id;
    var countCol = t.danger && t.count > 0 ? 'var(--red)' : 'var(--gray-500)';
    html += '<button onclick="state.filters.landlordTab=\''+t.id+'\';state.filters.landlordsView=\'all\';render()" '
      + 'style="padding:10px 18px;background:transparent;border:none;border-bottom:2px solid '+(active?'var(--accent)':'transparent')
      + ';font-size:13px;font-weight:'+(active?700:500)
      + ';color:'+(active?'var(--accent-dark, var(--accent))':'var(--gray-500)')
      + ';cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px">'
      + t.label
      + (t.count>0 ? '<span style="font-size:10px;font-weight:700;background:'+(t.danger?'var(--red-light)':'var(--gray-100)')+';color:'+countCol+';padding:1px 7px;border-radius:999px">'+t.count+'</span>' : '')
      + '</button>';
  });
  html += '</div>';

  // Search input
  html += '<div style="margin-bottom:14px">'
    + '<input class="inp" type="search" placeholder="🔍 Search landlord or property…" value="'+esc(llQ)+'" '
    + 'oninput="state.filters.landlordQ=this.value;clearTimeout(window._llQ);window._llQ=setTimeout(render,200)" '
    + 'style="max-width:380px">'
    + '</div>';

  html += renderStatRow([
    { label:'Landlords', value: lls.length,    color:'default' },
    { label:'Pending',   value: pendingCount,  color: pendingCount?'red':'default' },
    { label:'Paid YTD',  value: fmt(totalPaidAll), color: totalPaidAll>0?'emerald':'default' }
  ]);

  // ── Apply tab + search filter to the landlord list ────────────────────────
  if (llTab === 'overdue')      lls = lls.filter(function(ll){ return overdueLLIds[ll.id]; });
  else if (llTab === 'dueweek') lls = lls.filter(function(ll){ return dueWeekLLIds[ll.id]; });
  else if (llTab === 'paid')    lls = lls.filter(function(ll){ return paidLLIds[ll.id] && !overdueLLIds[ll.id] && !dueWeekLLIds[ll.id]; });

  if (llQ) {
    lls = lls.filter(function(ll){
      if ((ll.name||'').toLowerCase().indexOf(llQ) >= 0) return true;
      // Match on any linked property name
      var props = (state.properties||[]).filter(function(p){ return propertyLinkedToLandlord(p, ll); });
      return props.some(function(p){ return (p.name||'').toLowerCase().indexOf(llQ) >= 0; });
    });
  }

  // ── Rent Dues table — flat list of due landlord payments at the top ───────
  // Mirrors the Rent page's flat list view: every pending payment shown as a
  // sortable table row with a one-click Mark Paid button. Honors the same
  // tab + search filters as the landlord cards below. Sorts by due date
  // ascending so most overdue rows surface first.
  var dueRows;
  if (llTab === 'paid') {
    dueRows = filteredPays.filter(function(p){ return p.status === 'paid'; });
  } else {
    dueRows = filteredPays.filter(function(p){ return p.status === 'pending'; });
    if (llTab === 'overdue') {
      dueRows = dueRows.filter(function(p){ return _payDueMs(p) > 0 && _payDueMs(p) < _todayMs; });
    } else if (llTab === 'dueweek') {
      dueRows = dueRows.filter(function(p){ var ms = _payDueMs(p); return ms >= _todayMs && ms <= _weekFromNow; });
    }
  }
  if (llQ) {
    dueRows = dueRows.filter(function(p){
      var n = (p.landlordName || '').toLowerCase();
      var pn = (p.propName || p.property || '').toLowerCase();
      return n.indexOf(llQ) >= 0 || pn.indexOf(llQ) >= 0;
    });
  }
  dueRows.sort(function(a, b){ return _payDueMs(a) - _payDueMs(b); });

  if (dueRows.length) {
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:18px">';
    html += '<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--bg)">';
    html += '<div style="font-size:12px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Rent Dues · ' + dueRows.length + '</div>';
    html += '<div style="font-size:11px;color:var(--muted)">Sorted by due date</div>';
    html += '</div>';
    html += '<div class="ll-dues-table-wrap" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:560px">';
    html += '<thead><tr>'
      + '<th style="text-align:left;padding:9px 12px;font-weight:700;color:var(--muted);background:var(--bg)">Landlord</th>'
      + '<th style="text-align:left;padding:9px 12px;font-weight:700;color:var(--muted);background:var(--bg)">Property</th>'
      + '<th style="text-align:right;padding:9px 12px;font-weight:700;color:var(--muted);background:var(--bg)">Amount</th>'
      + '<th style="text-align:left;padding:9px 12px;font-weight:700;color:var(--muted);background:var(--bg)">Due Date</th>'
      + '<th style="text-align:right;padding:9px 12px;font-weight:700;color:var(--muted);background:var(--bg)">Action</th>'
      + '</tr></thead><tbody>';
    dueRows.forEach(function(p){
      var prop = (state.properties||[]).find(function(x){ return x.id === p.propId; });
      var propName = prop ? prop.name : (p.propName || p.property || '—');
      var addr = prop ? (prop.address || '') : '';
      var dueMs = _payDueMs(p);
      var isOverdue = p.status === 'pending' && dueMs > 0 && dueMs < _todayMs;
      var dueColor = isOverdue ? 'var(--red)' : 'var(--text)';
      var dueLabel = p.dueDate || p.monthLabel || '—';
      html += '<tr style="border-top:1px solid var(--border)' + (isOverdue ? ';background:#FFF8F8' : '') + '">';
      html += '<td style="padding:9px 12px;font-weight:600">' + esc(p.landlordName || '—') + '</td>';
      html += '<td style="padding:9px 12px">';
      if (prop) {
        html += '<button onclick="event.stopPropagation();openPropDetail(\'' + prop.id + '\')" style="background:transparent;border:none;color:var(--accent-dark, var(--text));text-align:left;cursor:pointer;font-family:inherit;padding:0;font-size:12px;font-weight:600;text-decoration:underline">' + esc(propName) + '</button>';
      } else {
        html += '<span style="font-weight:600;color:var(--muted)">' + esc(propName) + '</span>';
      }
      if (addr && addr !== propName) html += '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + esc(addr) + '</div>';
      html += '</td>';
      html += '<td style="padding:9px 12px;text-align:right;font-family:monospace;font-weight:700;color:' + (p.status==='paid'?'var(--green)':dueColor) + '">' + fmt(p.amount) + '</td>';
      html += '<td style="padding:9px 12px;color:' + dueColor + ';font-weight:' + (isOverdue ? 700 : 500) + '">' + esc(dueLabel) + (isOverdue ? ' · <span style="color:var(--red)">OVERDUE</span>' : '') + '</td>';
      html += '<td style="padding:9px 12px;text-align:right">';
      if (p.status === 'paid') {
        html += '<span style="font-size:11px;color:var(--green);font-weight:700;white-space:nowrap">✓ Paid' + (p.paidDate ? ' ' + esc(p.paidDate) : '') + '</span>';
      } else {
        html += '<button onclick="markLandlordPaid(\'' + (p.landlordId || '') + '\',\'' + p.id + '\')" style="padding:6px 12px;border-radius:8px;border:none;background:' + (isOverdue ? 'var(--red)' : '#10B981') + ';color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">' + (isOverdue ? 'Pay Now' : 'Mark Paid') + '</button>';
      }
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="ll-dues-mobile">';
    dueRows.forEach(function(p){
      var prop = (state.properties||[]).find(function(x){ return x.id === p.propId; });
      var propName = prop ? prop.name : (p.propName || p.property || '—');
      var addr = prop ? (prop.address || '') : '';
      var dueMs = _payDueMs(p);
      var isOverdue = p.status === 'pending' && dueMs > 0 && dueMs < _todayMs;
      var dueLabel = p.dueDate || p.monthLabel || '—';
      html += '<div class="ll-due-card' + (isOverdue ? ' is-overdue' : '') + '">';
      html += '<div class="ll-due-card-top">';
      html += '<div class="ll-due-card-title">' + esc(p.landlordName || '—') + '</div>';
      html += '<div class="ll-due-card-amount">' + fmt(p.amount) + '</div>';
      html += '</div>';
      html += '<div class="ll-due-card-prop">';
      if (prop) {
        html += '<button onclick="event.stopPropagation();openPropDetail(\'' + prop.id + '\')">' + esc(propName) + '</button>';
      } else {
        html += '<span>' + esc(propName) + '</span>';
      }
      if (addr && addr !== propName) html += '<small>' + esc(addr) + '</small>';
      html += '</div>';
      html += '<div class="ll-due-card-bottom">';
      html += '<span class="ll-due-date">' + esc(dueLabel) + (isOverdue ? ' · OVERDUE' : '') + '</span>';
      if (p.status === 'paid') {
        html += '<span class="ll-due-paid">✓ Paid' + (p.paidDate ? ' ' + esc(p.paidDate) : '') + '</span>';
      } else {
        html += '<button onclick="markLandlordPaid(\'' + (p.landlordId || '') + '\',\'' + p.id + '\')" class="ll-due-pay-btn" style="background:' + (isOverdue ? 'var(--red)' : '#10B981') + '">' + (isOverdue ? 'Pay Now' : 'Mark Paid') + '</button>';
      }
      html += '</div></div>';
    });
    html += '</div></div>';
  }

  html += '<div class="ll-grid">';
  if (!lls.length) {
    html += '<div style="padding:32px;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--muted);grid-column:1/-1">'
      +    '<div style="font-size:28px;margin-bottom:6px">✅</div>'
      +    '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">' + (llTab !== 'all' || llQ ? 'No matches' : 'No landlords yet') + '</div>'
      +    '<div style="font-size:12px">' + (llTab !== 'all' || llQ ? 'Try a different filter or clear the search.' : 'Click + Add to add your first landlord.') + '</div>'
      + '</div></div>';
    return html;
  }
  // Sort landlords: those with pending payments first, then by pending amount desc
  var sortedLls = lls.slice().sort(function(a, b) {
    var aPend = filteredPays.filter(function(p){return p.landlordId===a.id&&p.status==='pending';});
    var bPend = filteredPays.filter(function(p){return p.landlordId===b.id&&p.status==='pending';});
    // Pending first
    if(aPend.length && !bPend.length) return -1;
    if(!aPend.length && bPend.length) return 1;
    // Both pending: sort by earliest due date (most overdue first)
    if(aPend.length && bPend.length) {
      var aEarliest = Math.min.apply(null, aPend.map(function(p){return new Date(p.dueDate).getTime();}));
      var bEarliest = Math.min.apply(null, bPend.map(function(p){return new Date(p.dueDate).getTime();}));
      return aEarliest - bEarliest;
    }
    // Both fully paid: sort alphabetically
    return (a.name||'').localeCompare(b.name||'');
  });

  sortedLls.forEach(function(ll) {
    var llProps    = (state.properties||[]).filter(function(p){return propertyLinkedToLandlord(p, ll);});
    var llMonthly  = llProps.filter(isPropertyActive).reduce(function(s,p){return s+p.landlord;},0);
    var llPending  = filteredPays.filter(function(p){return p.landlordId===ll.id&&p.status==='pending';});
    var llPaid     = filteredPays.filter(function(p){return p.landlordId===ll.id&&p.status==='paid';});
    var initials   = ll.name.split(' ').map(function(w){return w[0];}).join('').slice(0,2);
    var hasPending = llPending.length > 0;

    html += '<div class="ll-card" style="border-color:'+(hasPending?'#FDE68A':'var(--border)')+'">';

    // Card header — click to open detail
    html += '<div class="ll-card-head" onclick="openLandlordDetail(\''+ll.id+'\')">';
    html += '<div style="width:42px;height:42px;border-radius:11px;background:var(--accent-light);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--accent-dark)">'+initials+'</div>';
    html += '<div class="ll-card-meta">';
    html += '<div class="ll-card-name">'+esc(ll.name)+'</div>';
    html += '<div class="ll-card-sub">'+esc(ll.phone)+' · '+llProps.length+' propert'+(llProps.length===1?'y':'ies')+'</div>';
    html += '</div>';
    html += '<div class="ll-card-amount">';
    html += '<div class="ll-card-amount-val">'+fmt(llMonthly)+'</div>';
    html += '<div class="ll-card-amount-sub">per month</div>';
    html += '</div>';
    html += '</div>';

    // Properties mini-list
    if(llProps.length) {
      html += '<div style="padding:0 16px 10px;display:flex;flex-wrap:wrap;gap:5px">';
      llProps.forEach(function(p){
        // Property name pills now open the property detail modal — previously
        // they were inert <span>s. event.stopPropagation prevents the parent
        // landlord-card click (which opens the landlord modal) from firing.
        html += '<button onclick="event.stopPropagation();openPropDetail(\''+p.id+'\')" '
          + 'style="font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 8px;color:var(--accent-dark, var(--text));cursor:pointer;font-family:inherit" '
          + 'title="Open property">'+esc(p.name)+'</button>';
      });
      html += '</div>';
    }

    // ── Payment schedule: per-property rows, grouped by month ───────────────
    var llAllPays = filteredPays.filter(function(p){return p.landlordId===ll.id;});
    var nowMs = new Date().getTime();

    // Group payments by monthKey, sorted overdue→upcoming→paid
    var monthKeys = [];
    llAllPays.forEach(function(p){ if(monthKeys.indexOf(p.monthKey)<0) monthKeys.push(p.monthKey); });
    monthKeys.sort(function(a,b){
      var aMs = new Date(a+'-01').getTime();
      var bMs = new Date(b+'-01').getTime();
      // Check if any pending in this month
      var aPend = llAllPays.some(function(p){return p.monthKey===a&&p.status!=='paid';});
      var bPend = llAllPays.some(function(p){return p.monthKey===b&&p.status!=='paid';});
      var aOver = aPend && aMs < nowMs;
      var bOver = bPend && bMs < nowMs;
      if(aOver && !bOver) return -1;
      if(!aOver && bOver) return 1;
      if(aPend && !bPend) return -1;
      if(!aPend && bPend) return 1;
      return aMs - bMs;
    });

    if(monthKeys.length) {
      var nowMonthKey=new Date().toISOString().slice(0,7);
      // Show overdue (past) + current + up to 3 upcoming unpaid months.
      // Paid months (any period) and future months beyond the 3 nearest are hidden.
      var futurePendingMonths=monthKeys.filter(function(k){
        return k>nowMonthKey && llAllPays.some(function(p){return p.monthKey===k&&p.status!=='paid';});
      }).sort();
      var visKeys=monthKeys.filter(function(mk){
        if(mk>nowMonthKey) return futurePendingMonths.indexOf(mk)<3;
        return llAllPays.some(function(p){return p.monthKey===mk&&p.status!=='paid';});
      }).sort();
      var hiddenCount=monthKeys.filter(function(mk){
        return visKeys.indexOf(mk)<0;
      }).length;
      html += '<div style="border-top:1px solid var(--border)">';
      visKeys.forEach(function(mk) {
        var mPays = llAllPays.filter(function(p){return p.monthKey===mk;});
        var mMs   = new Date(mk+'-01').getTime();
        var mLabel = mPays[0].monthLabel;
        var allPaid = mPays.every(function(p){return p.status==='paid';});
        var anyOverdue = mPays.some(function(p){return p.status!=='paid' && mMs < nowMs;});
        var mTotal = mPays.reduce(function(s,p){return s+p.amount;},0);
        var paidTotal = mPays.filter(function(p){return p.status==='paid';}).reduce(function(s,p){return s+p.amount;},0);

        // Month header row
        var headBg = allPaid ? 'var(--green-light)' : anyOverdue ? '#FFF1F2' : 'var(--bg)';
        var headIcon = allPaid ? '✅' : anyOverdue ? '⚠️' : '📅';
        var headColor = allPaid ? 'var(--green)' : anyOverdue ? 'var(--red)' : 'var(--text)';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:'+headBg+';border-bottom:1px solid var(--border)">';
        html += '<span>'+headIcon+'</span>';
        html += '<span style="font-size:12px;font-weight:800;color:'+headColor+';flex:1">'+mLabel+'</span>';
        html += '<span style="font-size:11px;color:var(--muted);font-family:monospace">';
        if(!allPaid && paidTotal>0) html += fmt(paidTotal)+' / ';
        html += fmt(mTotal)+'</span>';
        html += '</div>';

        // Property rows within this month
        var mSorted = mPays.slice().sort(function(a,b){
          if(a.status==='paid' && b.status!=='paid') return 1;
          if(a.status!=='paid' && b.status==='paid') return -1;
          return (a.property||'').localeCompare(b.property||'');
        });
        mSorted.forEach(function(pay) {
          var isPaid    = pay.status === 'paid';
          var isOverdue = !isPaid && mMs < nowMs;
          var amtColor  = isPaid ? 'var(--green)' : isOverdue ? 'var(--red)' : 'var(--amber)';

          html += '<div class="ll-pay-row" style="background:'+(isPaid?'transparent':isOverdue?'#FFF8F8':'transparent')+'">';
          html += '<div class="ll-pay-main">';
          html += '<div style="font-size:12px;font-weight:600;color:'+(isPaid?'var(--muted)':'var(--text)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(pay.propName||pay.property||(state.properties.find(function(x){return x.id===pay.propId;})||{}).name||'Unknown')+'</div>';
          if(isPaid) {
            html += '<div style="font-size:10px;color:var(--green)">Paid '+pay.paidDate+'</div>';
          } else {
            html += '<div style="font-size:10px;font-weight:'+(isOverdue?'600':'500')+';color:'+(isOverdue?'var(--red)':'var(--amber)')+'">'+( isOverdue?'⚠ Due ':'📅 Due ')+(pay.dueDate||pay.monthLabel)+'</div>';
          }
          html += '</div>';
          html += '<span style="font-size:12px;font-weight:700;color:'+amtColor+';font-family:monospace;flex-shrink:0">'+fmt(pay.amount)+'</span>';
          if(!isPaid) {
            html += '<button onclick="markLandlordPaid(\'' + ll.id + '\',\''+pay.id+'\')" style="padding:5px 10px;border-radius:7px;border:none;background:'+(isOverdue?'var(--red)':'#10B981')+';color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap">'+(isOverdue?'Pay Now':'Pay ✓')+'</button>';
          } else {
            html += '<span style="font-size:10px;color:var(--green);font-weight:700">✓</span>';
          }
          html += '</div>';
        });
      });
      // Always show the 'View full history' link (paid + future months are all hidden)
      if(hiddenCount>0||llAllPays.some(function(p){return p.status==='paid';})){
        var hiddenAll=hiddenCount;
        if(hiddenAll>0){
          html+='<div style="padding:8px 14px;text-align:center;border-top:1px solid var(--border)">'
            +'<button onclick="openLandlordDetail(\''+ll.id+'\')" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:inherit">'
            +'📋 '+hiddenAll+' month'+(hiddenAll>1?'s':'')+' hidden · View full history</button></div>';
        }
      }
      // If nothing overdue at all, show a clean 'all up to date' badge
      if(!visKeys.length){
        html += '<div style="padding:12px 14px;display:flex;align-items:center;gap:8px;border-top:1px solid var(--border)">'
          +'<span style="font-size:18px">✅</span>'
          +'<span style="font-size:12px;color:var(--green);font-weight:600">All payments up to date</span>'
          +(monthKeys.length?'<button onclick="openLandlordDetail(\''+ll.id+'\')" style="margin-left:auto;font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:inherit">View history</button>':'')
          +'</div>';
      }
      html += '</div>';
    }

    // Edit button
    html += '<div style="padding:10px 14px;border-top:1px solid var(--border)">';
    html += '<button onclick="openLandlordDetail(\''+ll.id+'\')" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">✏️ Edit Profile</button>';
    html += '</div>';

    html += '</div>'; // card
  });
  html += '</div>'; // grid
  html += renderFAB({icon:'+', label:'Add landlord', onClick:'openAddLandlordModal()'});
  return html;
}

function openAddLandlordModal(){
  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:500px">'
    +'<div class="modal-header"><span class="modal-title">+ Add Landlord</span><button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label class="field-label">Name *</label><input class="inp" id="ll-name" placeholder="e.g. John Smith"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Phone</label><input class="inp" id="ll-phone" type="tel" placeholder="07911000000"></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="ll-email" type="email" placeholder="landlord@email.com"></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Bank Name</label><input class="inp" id="ll-bank" placeholder="e.g. Barclays"></div>'
    +'<div class="field"><label class="field-label">Sort Code</label><input class="inp" id="ll-sort" placeholder="00-00-00"></div></div>'
    +'<div class="field"><label class="field-label">Account No.</label><input class="inp" id="ll-acc" placeholder="12345678"></div>'
    +'<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="ll-notes" rows="2" placeholder="Payment terms, preferences…" style="resize:vertical"></textarea></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button onclick="saveNewLandlord()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Add Landlord</button>'
    +'</div></div></div>';
}

function saveNewLandlord(){
  var name=(document.getElementById('ll-name')||{value:''}).value.trim();
  if(!name){alert('Please enter a landlord name.');return;}
  var ll={id:crypto.randomUUID(),name:name,
    phone:(document.getElementById('ll-phone')||{value:''}).value.trim(),
    email:(document.getElementById('ll-email')||{value:''}).value.trim(),
    bank:(document.getElementById('ll-bank')||{value:''}).value.trim(),
    sortCode:(document.getElementById('ll-sort')||{value:''}).value.trim(),
    accountNo:(document.getElementById('ll-acc')||{value:''}).value.trim(),
    notes:(document.getElementById('ll-notes')||{value:''}).value.trim(),properties:[]};
  if(!state.landlords) state.landlords=[];
  state.landlords.push(ll);
  closeModal();saveState();render();
  showToast('Landlord added: '+ll.name,'success');
}

function deleteLandlord(id){
  if (!requirePerm('canDelete', 'delete a landlord')) return;
  var ll=state.landlords.find(function(x){return String(x.id)===String(id);});if(!ll)return;
  var linkedProps=state.properties.filter(function(p){return propertyLinkedToLandlord(p, ll);});
  var msg='Delete '+ll.name+'?';
  if(linkedProps.length) msg+='\n\n⚠ Linked to '+linkedProps.length+' propert'+(linkedProps.length>1?'ies':'y')+'. Link will be removed.';
  msg+='\n\nThis cannot be undone.';
  if(!confirm(msg)) return;
  linkedProps.forEach(function(p){
    delete p.landlordName;
    delete p.landlordPhone;
    delete p.landlordId;
  });
  state.landlords=state.landlords.filter(function(x){return String(x.id)!==String(id);});
  try{supa.from('landlords').delete().eq('id',String(id)).eq('org_id',_currentOrgId).then(function(){});}catch(e){}
  closeModal();saveState();render();
  showToast('Landlord deleted','success');
}

function openLandlordDetail(id){
  var ll=state.landlords.find(function(x){return String(x.id)===String(id);});if(!ll)return;
  var lpays=(state.landlordPayments||[]).filter(function(p){return p.landlordId===id;});
  var llProps=state.properties.filter(function(p){return propertyLinkedToLandlord(p, ll);});
  var pendingPays=lpays.filter(function(p){return p.status!=='paid';});
  var paidPays=lpays.filter(function(p){return p.status==='paid';}).sort(function(a,b){return (b.dueDate||'').localeCompare(a.dueDate||'');}).slice(0,6);
  var shownPays=pendingPays.concat(paidPays);
  document.getElementById('modal-container').innerHTML=
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:560px"><div class="modal-header"><span class="modal-title">'+esc(ll.name)+'</span><button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body" style="max-height:70vh;overflow-y:auto">'
    +'<div class="field"><label class="field-label">Name</label><input class="inp" id="ll-name" value="'+esc(ll.name)+'"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Phone</label><input class="inp" id="ll-phone" value="'+(ll.phone||'')+'"></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="ll-email" value="'+(ll.email||'')+'"></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div class="field"><label class="field-label">Bank</label><input class="inp" id="ll-bank" value="'+(ll.bank||'')+'"></div>'
    +'<div class="field"><label class="field-label">Sort Code</label><input class="inp" id="ll-sort" value="'+(ll.sortCode||'')+'"></div></div>'
    +'<div class="field"><label class="field-label">Account No.</label><input class="inp" id="ll-acc" value="'+(ll.accountNo||'')+'"></div>'
    +'<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="ll-notes" rows="2">'+(ll.notes||'')+'</textarea></div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin:12px 0 6px">Linked Properties</div>'
    +(llProps.length?llProps.map(function(p){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 10px;background:var(--bg);border-radius:7px;margin-bottom:4px"><span>'+esc(p.name)+'</span><span style="font-weight:700;color:var(--red);font-family:monospace">'+fmt(p.landlord)+'/mo</span></div>';}).join(''):'<div style="font-size:12px;color:var(--dim);padding:4px 0">No properties linked</div>')
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin:12px 0 6px">Payment History (overdue + last 6 paid)</div>'
    +(shownPays.length?shownPays.map(function(p){
        var propName=p.propName||(state.properties.find(function(x){return x.id===p.propId;})||{}).name||p.property||'—';
        var isPaid=p.status==='paid';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px">'
          +'<div><div style="font-weight:600;color:var(--text)">'+propName+'</div>'
          +'<div style="font-size:10px;color:var(--muted)">'+p.monthLabel+(isPaid?' · Paid '+p.paidDate:(p.dueDate?' · Due '+p.dueDate:''))+'</div></div>'
          +'<span style="font-weight:700;font-family:monospace;color:'+(isPaid?'var(--green)':'var(--amber)')+'">'+fmt(p.amount)+'</span>'
          +'</div>';
      }).join(''):'<div style="font-size:12px;color:var(--dim)">No payments yet</div>')
    +'</div>'
    +'<div class="modal-footer" style="justify-content:space-between;flex-wrap:wrap;gap:8px">'
    +'<button data-llid="'+id+'" onclick="deleteLandlord(this.dataset.llid)" style="padding:9px 16px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">🗑 Delete</button>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button data-llid="'+id+'" onclick="generateLandlordStatementPDF(this.dataset.llid)" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">📄 Statement PDF</button>'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button data-llid="'+id+'" onclick="saveLandlordDetail(this.dataset.llid)" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save Changes</button>'
    +'</div></div></div></div>';
}

function saveLandlordDetail(id){
  if (!requirePerm('canEdit', 'edit landlord details')) return;
  var ll=state.landlords.find(function(x){return String(x.id)===String(id);});if(!ll)return;
  var g=function(eid){var el=document.getElementById(eid);return el?el.value:null;};
  ['ll-name','ll-phone','ll-email','ll-bank','ll-sort','ll-acc','ll-notes'].forEach(function(eid){var v=g(eid);if(v!==null){var map={'ll-name':'name','ll-phone':'phone','ll-email':'email','ll-bank':'bank','ll-sort':'sortCode','ll-acc':'accountNo','ll-notes':'notes'};ll[map[eid]]=v;}});
  closeModal();saveState();render();
  showToast('Landlord updated','success');
}
