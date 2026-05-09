// ── MAINTENANCE helpers (Bundle 1) ────────────────────────────────────────────
// SLA target hours by priority
var MAINT_SLA_HOURS = { urgent: 24, high: 72, medium: 168, low: 336 };
function maintLoggedDate(m){
  if(!m) return null;
  // Prefer scheduledDate if set (job hasn't really started until then)
  if(m.loggedDate) { var d = new Date(m.loggedDate); if(!isNaN(d.getTime())) return d; }
  if(m.date) {
    // m.date is "20 Apr 2026" style, parseable
    var d2 = new Date(m.date); if(!isNaN(d2.getTime())) return d2;
  }
  return null;
}
function maintSlaInfo(m){
  if(!m || m.status === 'resolved') return null;
  var sla = MAINT_SLA_HOURS[m.priority] || MAINT_SLA_HOURS.medium;
  var logged = maintLoggedDate(m); if(!logged) return null;
  var deadline = new Date(logged.getTime() + sla*3600000);
  var now = new Date();
  var hoursLeft = Math.round((deadline - now)/3600000);
  var status = hoursLeft < 0 ? 'overdue' : hoursLeft <= 12 ? 'urgent-soon' : hoursLeft <= 48 ? 'on-track' : 'plenty';
  var label;
  if(hoursLeft < 0) label = Math.abs(hoursLeft) >= 48 ? Math.floor(Math.abs(hoursLeft)/24)+'d overdue' : Math.abs(hoursLeft)+'h overdue';
  else if(hoursLeft < 48) label = hoursLeft+'h left';
  else label = Math.floor(hoursLeft/24)+'d left';
  return {label:label, status:status, deadline:deadline, hoursLeft:hoursLeft};
}
function maintMatchesQ(m, q){
  if(!q) return true;
  q = q.toLowerCase();
  return ((m.issue||'')+' '+(m.property||'')+' '+(m.tenant||'')+' '+(m.contractor||'')+' '+(m.cat||m.category||'')+' '+(m.notes||'')).toLowerCase().indexOf(q) >= 0;
}
function clearMaintFilters(){ state.filters.maintQ=''; state.filters.maintProp=''; state.filters.maintContractor=''; state.filters.maint='all'; render(); }

// ── Recurring maintenance templates (Bundle 2) ───────────────────────────
// Stored in state.config.recurringMaint as array of { id, label, intervalDays, daysAhead, propertyScope, lastSeed }
// On every render, ensureRecurringMaintenance() seeds new jobs for any property where the next due date is within `daysAhead`
function getRecurringMaintTemplates(){
  if(!state.config) state.config={};
  // Hard kill switch — if the user purged via the modal, never reseed templates.
  if(state.config.recurringMaintMasterOff) return [];
  // Defaults ship DISABLED so a fresh org doesn't auto-populate with 4 jobs per property.
  // User opts-in per template via Maintenance → 🔄 Recurring modal.
  if(!state.config.recurringMaint) state.config.recurringMaint = [
    { id:'gas-safety',  label:'Annual Gas Safety Cert', cat:'🔥 Heating / Boiler', intervalDays:365, daysAhead:30, priority:'high',   disabled:true },
    { id:'eicr',        label:'EICR (5-yearly)',         cat:'⚡ Electrical',       intervalDays:1825, daysAhead:60, priority:'medium', disabled:true },
    { id:'fire-alarm',  label:'Fire alarm test',         cat:'🔨 General',          intervalDays:90,  daysAhead:14, priority:'medium', disabled:true },
    { id:'deep-clean',  label:'Quarterly deep clean',    cat:'🔨 General',          intervalDays:90,  daysAhead:14, priority:'low',    disabled:true }
  ];
  return state.config.recurringMaint;
}

function ensureRecurringMaintenance(){
  var templates = getRecurringMaintTemplates();
  if(!templates.length || !state.properties || !state.maintenance) return;
  // Guard: bail if all templates disabled (default for new orgs)
  if(templates.every(function(t){ return t.disabled; })) return;
  // Throttle: only run once per calendar day per session — prevents the runaway
  // seeding on every render that produced 200+ jobs/day.
  var todayKey = new Date().toISOString().split('T')[0];
  if(state.config && state.config._recurringMaintLastRun === todayKey) return;
  var today = new Date(); today.setHours(0,0,0,0);
  var seeded = 0;
  state.properties.filter(isPropertyActive).forEach(function(prop){
    templates.forEach(function(tpl){
      if(tpl.disabled) return;
      // Find the most recent job matching this template for this property.
      // Match by recurringTpl tag, propertyId, OR by issue+name fallback.
      // (recurringTpl/propertyId may not roundtrip cleanly to DB — use multiple keys.)
      var matching = state.maintenance.filter(function(m){
        if(!m) return false;
        var sameProp = (m.propertyId && prop.id && String(m.propertyId)===String(prop.id))
                    || (m.property && m.property===prop.name);
        if(!sameProp) return false;
        if(m.recurringTpl === tpl.id) return true;
        return m.issue === tpl.label;
      });
      var lastDate = null;
      matching.forEach(function(m){
        var d = m.scheduledDate ? new Date(m.scheduledDate) : (m.date ? new Date(m.date) : null);
        if(d && (!lastDate || d > lastDate)) lastDate = d;
      });
      // Skip if there's already an OPEN/in_progress job for this template (don't double-seed)
      var hasOpen = matching.some(function(m){ return m.status !== 'resolved'; });
      if(hasOpen) return;
      // Compute next due
      var nextDue;
      if(lastDate) {
        nextDue = new Date(lastDate.getTime() + tpl.intervalDays*86400000);
      } else {
        // No history — schedule the first one daysAhead/2 from today so it's not jarring
        nextDue = new Date(today.getTime() + Math.floor(tpl.daysAhead/2)*86400000);
      }
      var daysUntil = Math.round((nextDue - today)/86400000);
      if(daysUntil <= tpl.daysAhead) {
        state.maintenance.push({
          id: crypto.randomUUID(),
          property: prop.name,
          propertyId: prop.id,
          room: null, location: '', tenant: '',
          issue: tpl.label,
          priority: tpl.priority||'medium',
          cat: tpl.cat||'🔨 General',
          status: 'open',
          date: today.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),
          loggedDate: today.toISOString().split('T')[0],
          scheduledDate: nextDue.toISOString().split('T')[0],
          notes: 'Auto-created from recurring template: '+tpl.label,
          recurringTpl: tpl.id,
          contractor: ''
        });
        seeded++;
      }
    });
  });
  // Mark today done regardless — a no-op pass still counts so we don't re-scan all day.
  if(!state.config) state.config={};
  state.config._recurringMaintLastRun = todayKey;
  if(seeded > 0 && typeof saveState === 'function') saveState();
}

// One-click cleanup — removes every auto-seeded job and turns all templates off.
// Use when recurring jobs got out of control (e.g. dedup bug spawned hundreds).
function purgeRecurringMaintenance(){
  if(!confirm('Delete all auto-created recurring maintenance jobs and turn off the recurring engine? This cannot be undone.')) return;
  var before = (state.maintenance||[]).length;
  // Identify rows to delete (need their ids for Supabase delete) before mutating state.
  var toDelete = (state.maintenance||[]).filter(function(m){
    if(!m) return false;
    if(m.recurringTpl) return true;
    if(m.notes && /^Auto-created from recurring template/i.test(m.notes)) return true;
    return false;
  });
  var deleteIds = toDelete.map(function(m){ return String(m.id); }).filter(Boolean);
  state.maintenance = (state.maintenance||[]).filter(function(m){ return !m || (!m.recurringTpl && !(m.notes && /^Auto-created from recurring template/i.test(m.notes))); });
  // Also clear expenses linked to those jobs
  if(state.expenses) state.expenses = state.expenses.filter(function(e){ return !e || deleteIds.indexOf(String(e._maintId||''))<0; });
  // Disable templates AND set master kill switch so reseeding can't restart even if defaults reapply.
  if(!state.config) state.config={};
  (state.config.recurringMaint || []).forEach(function(t){ t.disabled = true; });
  state.config.recurringMaintMasterOff = true;
  state.config._recurringMaintLastRun = new Date().toISOString().split('T')[0];
  // Issue Supabase deletes — saveState only upserts, so without this rows would resurrect on refresh.
  if(typeof supa !== 'undefined' && _currentOrgId && deleteIds.length){
    var BATCH = 200;
    for(var i=0;i<deleteIds.length;i+=BATCH){
      var batch = deleteIds.slice(i,i+BATCH);
      try { supa.from('maintenance').delete().in('id', batch).eq('org_id', _currentOrgId).then(function(){}); } catch(e){}
    }
  }
  if(typeof saveStateImmediate === 'function') saveStateImmediate();
  else if(typeof saveState === 'function') saveState();
  showToast('Removed '+deleteIds.length+' auto-created jobs · recurring engine turned off','success');
  closeModal();
  render();
}

// Re-enable recurring engine after a purge (for advanced users who want it back).
function reEnableRecurringMaintenance(){
  if(!state.config) state.config={};
  state.config.recurringMaintMasterOff = false;
  if(typeof saveState === 'function') saveState();
  showToast('Recurring engine re-enabled — open the Recurring modal to turn templates on','success');
}

function openRecurringMaintModal(){
  var masterOff = !!(state.config && state.config.recurringMaintMasterOff);
  var templates = masterOff ? [] : getRecurringMaintTemplates();
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:620px">'
    +'<div class="modal-header"><span class="modal-title">🔄 Recurring Maintenance</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body" style="max-height:65vh;overflow-y:auto">'
    +(masterOff
      ? '<div style="padding:14px 16px;background:var(--red-light);border:1px solid var(--red);border-radius:10px;margin-bottom:14px;font-size:13px;color:var(--red);line-height:1.5"><strong>Recurring engine is OFF.</strong> No jobs will be auto-created. <button onclick="reEnableRecurringMaintenance();closeModal();openRecurringMaintModal()" style="margin-left:8px;padding:5px 10px;border-radius:6px;border:1px solid var(--red);background:#fff;color:var(--red);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Turn back on</button></div>'
      : '<p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">Auto-creates a maintenance job for every active property when it\'s due. The job appears in your normal Open queue and on the Diary calendar with the scheduled date.</p>')
    +templates.map(function(t,i){
      return '<div style="display:grid;grid-template-columns:1fr 90px 90px 90px;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">'
        +'<div><div style="font-size:13px;font-weight:700">'+esc(t.label)+'</div><div style="font-size:10px;color:var(--muted)">'+esc(t.cat||'')+' · '+t.priority+'</div></div>'
        +'<div><label style="font-size:9px;color:var(--muted);text-transform:uppercase">Every (days)</label><input type="number" min="1" step="1" value="'+t.intervalDays+'" data-i="'+i+'" oninput="setRecurringMaintField(this.dataset.i,\'intervalDays\',this.value)" style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);font-family:monospace"></div>'
        +'<div><label style="font-size:9px;color:var(--muted);text-transform:uppercase">Lead time</label><input type="number" min="1" step="1" value="'+t.daysAhead+'" data-i="'+i+'" oninput="setRecurringMaintField(this.dataset.i,\'daysAhead\',this.value)" style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);font-family:monospace"></div>'
        +'<div><label style="font-size:9px;color:var(--muted);text-transform:uppercase">Active</label><label class="switch" style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:'+(t.disabled?'var(--muted)':'var(--green)')+'"><input type="checkbox" '+(t.disabled?'':'checked')+' data-i="'+i+'" onchange="setRecurringMaintField(this.dataset.i,\'disabled\',!this.checked)"> '+(t.disabled?'Off':'On')+'</label></div>'
      +'</div>';
    }).join('')
    +'<div style="margin-top:14px;padding:10px 12px;background:var(--blue-light);border-radius:8px;font-size:12px;color:var(--blue);line-height:1.5">💡 <strong>Lead time</strong> = how many days BEFORE the due date a job is auto-created. Set Gas Safety to 30 = job appears 30 days before the cert expires.</div>'
    +'</div>'
    +'<div class="modal-footer" style="justify-content:space-between"><button onclick="purgeRecurringMaintenance()" class="btn" style="background:var(--red-light);color:var(--red);border:1px solid var(--red)">🗑️ Delete all auto-created</button><div style="display:flex;gap:8px"><button onclick="if(state.config)state.config._recurringMaintLastRun=null;ensureRecurringMaintenance();closeModal();render();showToast(\'Recurring jobs refreshed\',\'success\')" class="btn btn-secondary">🔄 Run now</button><button onclick="closeModal()" class="btn btn-primary">Done</button></div></div>'
    +'</div></div>';
}
function setRecurringMaintField(i, field, value){
  var t = getRecurringMaintTemplates()[i];
  if(!t) return;
  if(field === 'intervalDays' || field === 'daysAhead') value = parseInt(value,10) || 1;
  t[field] = value;
  saveState();
}

function renderMaintenance() {
  const f = state.filters.maint || 'open';
  const view = state.filters.maintView || 'requests'; // 'requests' | 'contractors' | 'kanban'
  const mq = (state.filters.maintQ||'').trim();
  const mProp = state.filters.maintProp||'';
  const mCont = state.filters.maintContractor||'';
  // Apply search/filters first
  var dataAll = state.maintenance.filter(function(m){
    if(mProp && m.property !== mProp) return false;
    if(mCont && (m.contractor||'') !== mCont) return false;
    if(!maintMatchesQ(m, mq)) return false;
    return true;
  });
  const data = f==='all' ? dataAll : dataAll.filter(m=>m.status===f);
  const contractors = state.contractors || [];

  const TRADES = ['General','Plumbing','Electrical','Heating','Structural','Cleaning','Pest Control','Locks / Security','Garden','White Goods','Broadband / WiFi','Other'];

  // ── Contractor directory view ─────────────────────────────────────────────
  const contractorsView = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-size:15px;font-weight:700">${contractors.length} Contractor${contractors.length!==1?'s':''}</div>
        <div style="font-size:12px;color:var(--muted)">Your trusted trades directory</div>
      </div>
      <button onclick="openAddContractorModal()" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add Contractor</button>
    </div>
    ${contractors.length === 0
      ? renderEmptyState({
          emoji: '🔧',
          title: 'No contractors yet',
          subtitle: 'Add your trusted plumbers, electricians and trades — then send maintenance jobs directly via WhatsApp or email.',
          ctaLabel: '+ Add first contractor',
          ctaOnClick: 'openAddContractorModal()'
        })
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${contractors.map(c => {
            const tradeColors = {
              'Plumbing':'var(--blue)','Plumbing-bg':'var(--blue-light)',
              'Electrical':'var(--amber)','Electrical-bg':'var(--amber-light)',
              'Heating':'#EF4444','Heating-bg':'#FEF2F2',
              'Structural':'var(--muted)','Structural-bg':'var(--bg)',
              'Cleaning':'var(--green)','Cleaning-bg':'var(--green-light)',
              'General':'var(--purple)','General-bg':'var(--purple-light)',
            };
            const tc = tradeColors[c.trade] || 'var(--muted)';
            const tbg= tradeColors[c.trade+'-bg'] || 'var(--bg)';
            const waHref = c.whatsapp ? `https://wa.me/${String(c.whatsapp||'').replace(/\D/g,'')}` : '';
            const mailHref = c.email ? `mailto:${c.email}` : '';
            const stars = c.rating ? '★'.repeat(c.rating)+'☆'.repeat(5-c.rating) : '';
            return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div>
                  <div style="font-size:15px;font-weight:700;margin-bottom:3px">${esc(c.name)}</div>
                  <span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:10px;background:${tbg};color:${tc}">${c.trade}</span>
                  ${stars?`<span style="font-size:11px;color:var(--amber);margin-left:6px">${stars}</span>`:''}
                </div>
                <div style="display:flex;gap:6px">
                  <button onclick="openContractorProfile('${c.id}')" style="padding:5px 12px;border-radius:7px;border:1.5px solid var(--accent);background:var(--accent-light);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--accent-dark)">View Profile</button>
                  <button onclick="openEditContractorModal('${c.id}')" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;cursor:pointer;font-family:inherit;color:var(--muted)">Edit</button>
                </div>
              </div>
              ${c.phone?`<div style="font-size:12px;color:var(--muted);margin-bottom:4px">📞 ${esc(c.phone)}</div>`:''}
              ${c.email?`<div style="font-size:12px;color:var(--muted);margin-bottom:4px">✉️ ${esc(c.email)}</div>`:''}
              ${c.callOutCharge?`<div style="font-size:12px;color:var(--muted);margin-bottom:4px">💷 Call-out: £${esc(c.callOutCharge)}</div>`:''}
              ${c.notes?`<div style="font-size:11px;color:var(--dim);background:var(--bg);padding:6px 9px;border-radius:7px;margin:8px 0">${esc(c.notes)}</div>`:''}
              ${c.lastUsed?`<div style="font-size:11px;color:var(--dim);margin-bottom:4px">Last used: ${new Date(c.lastUsed).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>`:''}
              ${(()=>{
                var jobs=state.maintenance.filter(function(m){return m.contractor===c.name;});
                var spend=state.expenses.filter(function(e){return e.desc&&e.desc.includes('['+c.name+']');}).reduce(function(s,e){return s+e.amount;},0);
                if(!jobs.length) return '';
                return '<div style="display:flex;gap:6px;margin-bottom:8px">'
                  +'<span style="font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:10px">'+jobs.length+' job'+(jobs.length>1?'s':'')+'</span>'
                  +(spend>0?'<span style="font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:10px">£'+spend.toLocaleString()+'</span>':'')
                  +'</div>';
              })()}
              <div style="display:flex;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                ${waHref?`<a href="${waHref}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;border-radius:8px;background:#F0FDF4;border:1px solid #BBF7D0;color:#16A34A;font-size:12px;font-weight:700;text-decoration:none">💬 WhatsApp</a>`:''}
                ${mailHref?`<a href="${mailHref}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;border-radius:8px;background:var(--blue-light);border:1px solid #BFDBFE;color:var(--blue);font-size:12px;font-weight:700;text-decoration:none">✉️ Email</a>`:''}
                ${!waHref&&!mailHref?`<span style="font-size:11px;color:var(--dim)">No contact details</span>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>`}`;

  // ── Kanban view (Bundle 1) ───────────────────────────────────────────────
  function kanbanCard(m){
    var sla = maintSlaInfo(m);
    var slaCols = { 'overdue':['#FEF2F2','var(--red)'], 'urgent-soon':['#FFFBEB','#92400E'], 'on-track':['#F0F9FF','var(--blue)'], 'plenty':['#F0FDF4','var(--green)'] };
    var slaPill = sla ? (function(){var c=slaCols[sla.status];return '<span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:5px;background:'+c[0]+';color:'+c[1]+'">⏰ '+sla.label+'</span>';})() : '';
    var priorityCol = m.priority==='urgent'?'var(--red)':m.priority==='high'?'var(--amber)':m.priority==='medium'?'var(--blue)':'var(--muted)';
    return '<div onclick="openEditMaintModal(\''+m.id+'\')" class="kanban-card" style="background:#fff;border:1px solid var(--border);border-left:3px solid '+priorityCol+';border-radius:9px;padding:10px 11px;cursor:pointer;transition:all .2s;box-shadow:0 1px 2px rgba(0,0,0,.04)">'
      +'<div style="font-size:12px;font-weight:700;line-height:1.35;margin-bottom:6px;color:var(--text)">'+esc(m.issue||'Maintenance')+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📍 '+esc(m.property||'')+(m.room?' · Rm '+esc(m.room):'')+'</div>'
      +(m.contractor?'<div style="font-size:10px;color:var(--blue);font-weight:600;margin-bottom:6px">👷 '+esc(m.contractor)+'</div>':'')
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">'
        +slaPill
        +(m.scheduledDate?'<span style="font-size:9px;color:var(--muted)">📅 '+(new Date(m.scheduledDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}))+(m.scheduledTime?' '+m.scheduledTime:'')+'</span>':'')
      +'</div>'
      +'<div style="display:flex;gap:4px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);flex-wrap:wrap">'
        +(m.status==='open'?'<button onclick="event.stopPropagation();updMaint(\''+m.id+'\',\'in_progress\')" style="font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid var(--blue);background:var(--blue-light);color:var(--blue);font-weight:700;cursor:pointer;font-family:inherit">▶ Start</button>':'')
        +(m.status==='in_progress'?'<button onclick="event.stopPropagation();updMaint(\''+m.id+'\',\'open\')" style="font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-weight:700;cursor:pointer;font-family:inherit">◀ Reopen</button>':'')
        +(m.status!=='resolved'?'<button onclick="event.stopPropagation();updMaint(\''+m.id+'\',\'resolved\')" style="font-size:10px;padding:3px 8px;border-radius:5px;border:none;background:var(--green);color:#fff;font-weight:700;cursor:pointer;font-family:inherit">✓ Resolve</button>':'<button onclick="event.stopPropagation();updMaint(\''+m.id+'\',\'open\')" style="font-size:10px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-weight:700;cursor:pointer;font-family:inherit">↺ Reopen</button>')
      +'</div>'
    +'</div>';
  }
  var kanbanCols = [
    { key:'open',        title:'🔴 Open',        color:'var(--red)',    bg:'#FEF2F2', items: dataAll.filter(function(m){return m.status==='open';}) },
    { key:'in_progress', title:'🟡 In Progress', color:'var(--amber)',  bg:'#FFFBEB', items: dataAll.filter(function(m){return m.status==='in_progress';}) },
    { key:'resolved',    title:'🟢 Resolved',    color:'var(--green)',  bg:'#F0FDF4', items: dataAll.filter(function(m){return m.status==='resolved';}).slice(0,15) }
  ];
  const kanbanView = '<div class="kanban-board" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:flex-start">'
    + kanbanCols.map(function(col){
        return '<div class="kanban-col" style="background:'+col.bg+';border:1px solid var(--border);border-radius:12px;padding:12px;min-height:300px">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:0 2px">'
            +'<div style="font-size:13px;font-weight:800;color:'+col.color+'">'+col.title+'</div>'
            +'<span style="font-size:11px;font-weight:800;background:'+col.color+';color:#fff;padding:2px 8px;border-radius:10px">'+col.items.length+'</span>'
          +'</div>'
          +'<div style="display:flex;flex-direction:column;gap:8px">'
            +(col.items.length?col.items.map(kanbanCard).join(''):'<div style="font-size:11px;color:var(--muted);text-align:center;padding:24px 12px;border:1.5px dashed var(--border);border-radius:9px;background:rgba(255,255,255,.6)">No '+col.title.toLowerCase().replace(/[^a-z ]/g,'').trim()+' jobs</div>')
            +(col.key==='resolved'&&dataAll.filter(function(m){return m.status==='resolved';}).length>15?'<div style="font-size:11px;color:var(--muted);text-align:center;padding:6px">+ '+(dataAll.filter(function(m){return m.status==='resolved';}).length-15)+' more resolved</div>':'')
          +'</div>'
        +'</div>';
      }).join('')
    + '</div>'
    + '<style>@media(max-width:900px){.kanban-board{grid-template-columns:1fr !important}}.kanban-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);transform:translateY(-1px)}</style>';

  // ── Maintenance requests view ─────────────────────────────────────────────
  var _totalMaintSpent = state.maintenance.reduce(function(s,m){ var mx=(state.maintExtras&&state.maintExtras[m.id])||{}; return s+(parseFloat(mx.cost)||0); },0);
  var _urgentOpen = state.maintenance.filter(m=>m.priority==='urgent'&&m.status!=='resolved').length;
  var _avgResolveTime = (function(){ var resolved=state.maintenance.filter(function(m){return m.status==='resolved'&&m.date&&m.resolvedDate;}); if(!resolved.length) return '—'; var total=resolved.reduce(function(s,m){ var a=new Date(m.date),b=new Date(m.resolvedDate); return s+Math.max(0,Math.round((b-a)/86400000)); },0); return Math.round(total/resolved.length)+'d'; })();
  const requestsView = `
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:14px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      ${['open','in_progress','all','resolved'].map(v=>{
        var active = f===v;
        var label = v==='in_progress'?'In Progress':v==='all'?'All':v[0].toUpperCase()+v.slice(1);
        return `<button onclick="state.filters.maint='${v}';render()" style="padding:7px 14px;border-radius:999px;white-space:nowrap;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;flex-shrink:0;border:1px solid ${active?'var(--teal-300)':'var(--gray-200)'};background:${active?'var(--teal-50)':'#fff'};color:${active?'var(--teal-700)':'var(--gray-700)'}">${label}</button>`;
      }).join('')}
    </div>
    <div class="maint-grid">
      ${data.map(m => {
        const waNum = (m.tenant
          ? (state.tenants.find(t=>t.name===m.tenant&&t.status!=='inactive')||{}).whatsapp
          : null) || '';
        const mx = (state.maintExtras && state.maintExtras[m.id]) || {};
        const allPhotos = [m.photo].filter(Boolean).concat((mx.photos||[]).map(function(p){return p.src;}));
        const sla = maintSlaInfo(m);
        const slaColors = { 'overdue':['#FEF2F2','var(--red)','#FCA5A5'], 'urgent-soon':['#FFFBEB','#92400E','#FDE68A'], 'on-track':['#F0F9FF','var(--blue)','#BFDBFE'], 'plenty':['#F0FDF4','var(--green)','#A7F3D0'] };
        const slaBadge = sla ? (function(){ var c=slaColors[sla.status]; return `<span title="SLA deadline: ${sla.deadline.toLocaleString('en-GB')}" style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:7px;background:${c[0]};color:${c[1]};border:1px solid ${c[2]}">⏰ ${sla.label}</span>`; })() : '';
        return `<div class="maint-card${m.priority==='urgent'&&m.status!=='resolved'?' urgent-open':''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div style="display:flex;gap:5px;flex-wrap:wrap">${badge(m.priority)} ${badge(m.status.replace('_',' '))} ${slaBadge}</div>
            <button data-mid="${m.id}" onclick="openEditMaintModal(this.dataset.mid)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--muted);flex-shrink:0;margin-left:6px">Edit</button>
            <button data-mid="${m.id}" onclick="deleteMaintenanceJob(this.dataset.mid)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--red);background:var(--red-light);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--red);flex-shrink:0;margin-left:4px">✕</button>
          </div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">${esc(m.issue)}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px">${esc(m.property)}${m.room?' · Room '+esc(m.room):''}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px">Tenant: ${m.tenant?esc(m.tenant):'—'}</div>
          <div style="font-size:11px;color:var(--dim);margin-bottom:8px">Logged: ${m.date} · ${m.cat}</div>
          ${allPhotos.length?`<div style="display:grid;grid-template-columns:${allPhotos.length>1?'1fr 1fr':'1fr'};gap:4px;margin-bottom:10px">${allPhotos.map(function(src){return '<img src="'+src+'" style="width:100%;height:90px;object-fit:cover;border-radius:7px">';}).join('')}</div>`:''}
          ${m.notes?`<div style="font-size:12px;color:var(--muted);background:var(--bg);padding:7px 10px;border-radius:7px;margin-bottom:10px">Notes: ${esc(m.notes)}</div>`:''}
          ${m.contractor?`<div style="font-size:11px;color:var(--blue);background:var(--blue-light);padding:5px 9px;border-radius:7px;margin-bottom:8px;font-weight:600">👷 ${esc(m.contractor)}</div>`:''}
          ${mx.cost||mx.invoiceName?`<div style="display:flex;align-items:center;gap:8px;background:var(--green-light);border:1px solid #A7F3D0;border-radius:8px;padding:7px 10px;margin-bottom:8px">${mx.cost?'<span style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace">£'+mx.cost+'</span><span style="font-size:11px;color:var(--muted)"> job cost</span>':''}${mx.invoiceName?'<a href="'+(mx.invoiceUrl||'#')+'" download="'+mx.invoiceName+'" style="margin-left:auto;font-size:11px;font-weight:700;color:var(--blue);text-decoration:none">Invoice</a>':''}</div>`:''}
          ${m.status!=='resolved'
            ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
                ${m.status==='open'?btn('&#x25B6; Start',`updMaint('${m.id}','in_progress')`,'secondary',true):''}
                ${btn('✓ Resolve',`updMaint('${m.id}','resolved')`,m.status==='open'?'secondary':'primary',true)}
                <button data-mid="${m.id}" onclick="shareMaintWA(event,this.dataset.mid)" style="padding:5px 10px;border-radius:8px;border:1px solid #25D366;background:#F0FDF4;color:#16A34A;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">WA</button>
                <button data-mid="${m.id}" onclick="sendToContractorModal(this.dataset.mid)" style="padding:5px 10px;border-radius:8px;border:1px solid var(--blue);background:var(--blue-light);color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Contractor</button>
              </div>`
            : `<span style="font-size:12px;color:var(--green);font-weight:600">Resolved</span>`}
        </div>`;
      }).join('')}
      ${data.length===0?('<div style="grid-column:1/-1">'+renderEmptyState({emoji:'✨',title:'Nothing to fix',subtitle:'No open maintenance requests across your portfolio.',ctaLabel:'+ Log a request',ctaOnClick:'openModal(\'addMaint\')'})+'</div>'):''}
    </div>`;

  // Auto-seed recurring maintenance jobs on each render (idempotent — only seeds when due)
  if(typeof ensureRecurringMaintenance === 'function') ensureRecurringMaintenance();

  // ── v2 header / hero / stat row ──
  const _openCount   = state.maintenance.filter(m=>m.status==='open').length;
  const _activeCount = state.maintenance.filter(m=>m.status==='in_progress').length;
  const _allClear = (_openCount + _activeCount) === 0;

  const _hdrActions = [
    // Refresh: data is loaded once at app boot — without this, jobs added by
    // another team member on a different device only appear after a full reload.
    '<button onclick="refreshMaintenance()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit" title="Refresh from DB (pulls jobs added by other devices)">⟳</button>',
    '<button onclick="openRecurringMaintModal()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit" title="Recurring schedules">🔁</button>',
    '<button onclick="shareAllMaintWA()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit" title="Share all open">📲</button>',
    '<button onclick="openModal(\'addMaint\')" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Log</button>'
  ];

  let _topHtml = '';
  _topHtml += renderScreenHeader({
    title: 'Maintenance',
    subtitle: _allClear ? 'All clear · No urgent issues' : (_openCount + ' open · ' + _urgentOpen + ' urgent · ' + _activeCount + ' in progress'),
    rightActions: _hdrActions
  });
  _topHtml += renderHeroCard(_allClear ? {
    variant: 'success',
    icon: '✓',
    label: 'Maintenance Status',
    value: '<span style="color:#fff">All Clear</span>',
    subtitle: '0 open · 0 urgent · 0 in progress'
  } : {
    icon: '🔧',
    label: 'Open Issues',
    value: '<span style="color:#fff">' + _openCount + '</span>',
    subtitle: _urgentOpen + ' urgent · ' + _activeCount + ' in progress'
  });
  _topHtml += renderStatRow([
    { label:'Open',      value: _openCount,   color: _openCount?'red':'dim' },
    { label:'Active',    value: _activeCount, color: _activeCount?'amber':'dim' },
    { label:'Spent YTD', value: fmt(_totalMaintSpent), color: _totalMaintSpent>0?'blue':'dim' }
  ]);
  _topHtml += renderTabs({
    tabs: [
      { id:'requests',    label:'Requests',    icon:'🔧', count: state.maintenance.filter(m=>m.status!=='resolved').length || null },
      { id:'kanban',      label:'Kanban',      icon:'📋' },
      { id:'contractors', label:'Contractors', icon:'👷', count: contractors.length || null }
    ],
    activeId: view,
    onChangeTpl: 'state.filters.maintView=\'%ID%\';render()'
  });

  return _topHtml + `
    ${(view==='requests'||view==='kanban')?`
    <!-- Search + filters (Bundle 1) -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <div style="position:relative;flex:1;min-width:220px">
        <input class="inp" type="search" placeholder="🔍 Search issue, property, tenant, contractor…" value="${esc(mq)}" oninput="state.filters.maintQ=this.value;clearTimeout(window._mQ);window._mQ=setTimeout(render,200)" style="padding-right:32px">
        ${mq?`<button onclick="state.filters.maintQ='';render()" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:16px;font-family:inherit">×</button>`:''}
      </div>
      <select class="filter-select" onchange="state.filters.maintProp=this.value;render()">
        <option value="">All properties</option>
        ${[...new Set(state.maintenance.map(function(m){return m.property;}).filter(Boolean))].sort().map(function(p){return '<option value="'+esc(p)+'" '+(mProp===p?'selected':'')+'>'+esc(p)+'</option>';}).join('')}
      </select>
      <select class="filter-select" onchange="state.filters.maintContractor=this.value;render()">
        <option value="">All contractors</option>
        <option value="" disabled>──────────</option>
        ${[...new Set(state.maintenance.map(function(m){return m.contractor;}).filter(Boolean))].sort().map(function(c){return '<option value="'+esc(c)+'" '+(mCont===c?'selected':'')+'>'+esc(c)+'</option>';}).join('')}
      </select>
      ${(mq||mProp||mCont||(f&&f!=='all'&&f!=='open'))?`<button onclick="clearMaintFilters()" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Clear filters</button>`:''}
    </div>
    `:''}
    ${view === 'contractors' ? contractorsView : view === 'kanban' ? kanbanView : requestsView}` + renderFAB({icon:'+', label: view==='contractors' ? 'Add contractor' : 'Log maintenance', onClick: view==='contractors' ? 'openAddContractorModal()' : "openModal('addMaint')"});
}

/** Re-fetch maintenance + contractor rows from DB and merge into state.
 *  Used when another team member adds a job on a different device — the app
 *  loads data once at boot, so without this the new job is invisible until reload. */
async function refreshMaintenance(){
  if (!_currentOrgId) { showToast('Not signed in', 'error'); return; }
  showToast('Refreshing maintenance…', 'info');
  try {
    var results = await Promise.all([
      supa.from('maintenance').select('*').eq('org_id', _currentOrgId),
      supa.from('contractors').select('*').eq('org_id', _currentOrgId),
    ]);
    if (results[0].error) { showToast('Refresh failed: ' + results[0].error.message, 'error'); return; }
    state.maintenance = (results[0].data || []).map(rowToMaintenance);
    if (!results[1].error && Array.isArray(results[1].data)) {
      state.contractors = results[1].data.map(rowToContractor);
    }
    // Reset diff snapshot for these tables so the next save baselines off DB-truth
    // (otherwise the next save would push the just-fetched rows back up unchanged).
    if (typeof _resetSaveSnapshot === 'function') _resetSaveSnapshot();
    render();
    showToast('Maintenance refreshed (' + state.maintenance.length + ' jobs)', 'success');
  } catch(e) {
    showToast('Refresh error: ' + (e.message || 'unknown'), 'error');
  }
}
if (typeof window !== 'undefined') window.refreshMaintenance = refreshMaintenance;
