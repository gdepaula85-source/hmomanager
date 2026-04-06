// ── loadState: fetch all data from Supabase ───────────────
async function loadState(){
  if(!_currentOrgId){
    // Do not load unscoped data before auth/org resolution.
    console.warn('loadState skipped: org not resolved yet');
    return false;
  }
  setAppBootMessage('Loading your data…');
  try{
    var results = await Promise.all([
      supa.from('landlords').select('*').eq('org_id', _currentOrgId),
      supa.from('properties').select('*').eq('org_id', _currentOrgId),
      supa.from('tenants').select('*').eq('org_id', _currentOrgId),
      supa.from('payments').select('*').eq('org_id', _currentOrgId),
      supa.from('expenses').select('*').eq('org_id', _currentOrgId),
      supa.from('maintenance').select('*').eq('org_id', _currentOrgId),
      supa.from('landlord_payments').select('*').eq('org_id', _currentOrgId),
      supa.from('contractors').select('*').eq('org_id', _currentOrgId),
      supa.from('organisations').select('billing_email,owner_email,name,plan,status,trial_ends_at').eq('id', _currentOrgId).maybeSingle()
    ]);
    var errors = results.filter(function(r){ return r.error; });
    if(errors.length){ console.warn('Supabase load errors:', errors); }
    if (results[8] && results[8].data) {
      state._currentOrg = Object.assign({}, state._currentOrg || {}, results[8].data);
    }
    await mergeOrgEmailSettingsIfAvailable();
    state.landlords        = (results[0].data||[]).map(rowToLandlord);
    state.properties       = (results[1].data||[]).map(rowToProp);
    state.tenants          = (results[2].data||[]).map(rowToTenant);
    state.payments         = (results[3].data||[]).map(rowToPayment);
    state.expenses         = (results[4].data||[]).map(rowToExpense);
    state.maintenance      = (results[5].data||[]).map(rowToMaintenance);
    if(!state.maintExtras) state.maintExtras={};
    state.maintenance.forEach(function(m){
      if(!state.maintExtras[m.id]) state.maintExtras[m.id]={photos:[]};
      var mx=state.maintExtras[m.id];
      if(m.jobCost&&!mx.cost) mx.cost=m.jobCost;
      if(m.invoiceName&&!mx.invoiceName) mx.invoiceName=m.invoiceName;
      if(m.invoiceUrl&&!mx.invoiceUrl) mx.invoiceUrl=m.invoiceUrl;
    });
    state.landlordPayments = (results[6].data||[]).map(rowToLandlordPayment);
    state.contractors      = (results[7].data||[]).map(rowToContractor);
    // Compute t.paid from most recent payment for each tenant
    state.tenants.forEach(function(t){
      var tenantPays = state.payments.filter(function(p){
        return (p.tenantId===t.id||p.tenantName===t.name) && p.status==='paid' && p.paidDate;
      });
      if(tenantPays.length){
        tenantPays.sort(function(a,b){return new Date(b.paidDate)-new Date(a.paidDate);});
        var d = new Date(tenantPays[0].paidDate);
        t.paid = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
      }
    });
    // Restore local-only state from localStorage
    try {
      var localKeys = ['rentSchedule','roomMedia','vault','voidDates','lateFeeConfig','propDocs','companies','config','roles','maintExtras','dealInputs'];
      localKeys.forEach(function(k){
        var raw = localStorage.getItem('pm_local_'+k);
        if(raw) { try{ state[k]=JSON.parse(raw); }catch(e){} }
      });
      // Restore last visited page (so refresh doesn't always go to dashboard)
      var savedPage = localStorage.getItem('pm_local_page');
      if(savedPage && savedPage !== 'dashboard') state.page = savedPage;
    } catch(e) {}
    // Room photos loaded from localStorage cache — full sync runs in background after first render
    // (syncRoomPhotosBackground is called via setTimeout in the render chain)

    // Load property docs from Supabase Storage (refresh signed URLs)
    try {
      if(state.propDocs) {
        Object.keys(state.propDocs).forEach(function(pid){
          (state.propDocs[pid]||[]).forEach(function(doc){
            if(doc.storagePath && !doc.dataUrl) {
              // Refresh expired signed URL silently
              supa.storage.from('property-docs').createSignedUrl(doc.storagePath, 31536000)
                .then(function(r){ if(r.data) { doc.dataUrl=r.data.signedUrl; } })
                .catch(function(){});
            }
          });
        });
      }
      if(state.vault) {
        Object.keys(state.vault).forEach(function(tid){
          (state.vault[tid]||[]).forEach(function(doc){
            if(doc.storagePath && !doc.dataUrl) {
              supa.storage.from('tenant-docs').createSignedUrl(doc.storagePath, 31536000)
                .then(function(r){ if(r.data) { doc.dataUrl=r.data.signedUrl; } })
                .catch(function(){});
            }
          });
        });
      }
    } catch(_de) { console.warn('Doc URL refresh error:', _de); }

    // Migrate roomMedia keys from old numeric ids to new UUID ids
    if(state.roomMedia && Object.keys(state.roomMedia).length > 0) {
      var newMedia = {};
      state.properties.forEach(function(p) {
        // Find old numeric key entries for this property
        Object.keys(state.roomMedia).forEach(function(oldKey) {
          // Check if this is a numeric-id key for this property
          var parts = oldKey.split('_');
          if(parts.length >= 2) {
            var lastNum = parts[parts.length-1];
            var possibleOldId = parts.slice(0,-1).join('_');
            // Try to match by property name (numeric IDs were 1001, 1002 etc)
            var oidNum = parseInt(possibleOldId);
            if(!isNaN(oidNum) && oidNum >= 1000 && oidNum <= 2000) {
              // This looks like an old numeric key - remap to use actual p.id
              // We can't perfectly match but copy under new key too
              var newKey = p.id + '_' + lastNum;
              if(state.roomMedia[oldKey] && state.roomMedia[oldKey].photos && state.roomMedia[oldKey].photos.length > 0) {
                newMedia[newKey] = state.roomMedia[oldKey];
              }
            } else {
              newMedia[oldKey] = state.roomMedia[oldKey];
            }
          }
        });
      });
      if(Object.keys(newMedia).length > 0) state.roomMedia = newMedia;
    }
    // Back-fill propName for landlord payments loaded from Supabase
    state.landlordPayments.forEach(function(lp){
      if((!lp.propName||lp.propName==='') && lp.propId){
        var p = state.properties.find(function(x){return x.id===lp.propId;});
        if(p) lp.propName = p.name;
      }
      if((!lp.landlordName||lp.landlordName==='') && lp.landlordId){
        var ll = state.landlords.find(function(x){return x.id===lp.landlordId;});
        if(ll) lp.landlordName = ll.name;
      }
    });
    console.log('Loaded from Supabase:', state.landlords.length, 'landlords,', state.properties.length, 'props,', state.tenants.length, 'tenants');
    // Re-apply companies/config from localStorage AFTER Supabase load
    // (Supabase doesn't store these, so localStorage is the source of truth)
    ['companies','config'].forEach(function(k){
      try {
        var raw = localStorage.getItem('pm_local_'+k);
        if(raw){
          var parsed = JSON.parse(raw);
          if(parsed) state[k]=parsed;
        }
      } catch(e2){}
    });
    return true;
  }catch(e){
    console.error('loadState error:', e);
    showToast && showToast('Database error — running in offline mode', 'error');
    return false;
  }
}
async function backfillPaymentDueDates() {
  // Fix existing Supabase payments that have due_date=null by using paid_date as proxy
  // This clears phantom outstanding entries caused by null due_date dedup failure
  var toFix = state.payments.filter(function(p) {
    return !p.dueDate && p.paidDate;
  });
  if(toFix.length === 0) {
    showToast('No payments need fixing ✓', 'success');
    return;
  }
  showToast('Fixing ' + toFix.length + ' payments...', 'success');
  var fixed = 0;
  for(var i = 0; i < toFix.length; i++) {
    var p = toFix[i];
    // Use paid_date as due_date proxy — close enough for weekly dedup
    var paidStr = p.paidDate;
    var parts = String(paidStr).replace(/[^0-9\-]/g,'').split('T')[0];
    var isoDate = null;
    // Parse "21 Mar 2026" (en-GB) or ISO "2026-03-21" format
    var _bmonths = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    if(paidStr) {
      var _bdp = String(paidStr).split(' ');
      if(_bdp.length===3 && _bmonths[_bdp[1]]!==undefined) {
        var _bdt = new Date(+_bdp[2], _bmonths[_bdp[1]], +_bdp[0]);
        isoDate = _bdt.getFullYear()+'-'+String(_bdt.getMonth()+1).padStart(2,'0')+'-'+String(_bdt.getDate()).padStart(2,'0');
      } else if(paidStr.match && paidStr.match(/\d{4}-\d{2}-\d{2}/)) {
        isoDate = paidStr.split('T')[0];
      }
    }
    if(!isoDate) continue;
    p.dueDate = isoDate;
    var pp = paidStr.split('T')[0].split('-');
    p._dueDateRaw = isoDate.split('-').length===3 ? new Date(+isoDate.split('-')[0],+isoDate.split('-')[1]-1,+isoDate.split('-')[2]).getTime() : null;
    // Update Supabase
    try {
      await supa.from('payments').update({due_date: isoDate}).eq('id', p.id);
      fixed++;
    } catch(e) {}
  }
  saveState();
  render();
  showToast('Fixed ' + fixed + ' of ' + toFix.length + ' payments ✓', 'success');
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function doLogOut() {
  try { await supa.auth.signOut(); } catch(e) { console.warn('signOut:', e); }
  localStorage.removeItem('pm_local_users');
  window.location.href = 'propmanager-landing.html';
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE  (company profiles, logo, site config, account)
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════
// EMAIL TRIGGER FRAMEWORK
// ══════════════════════════════════════════════════════════════════════
var EMAIL_TRIGGERS = {
  rent_reminder_3day:{id:'rent_reminder_3day',label:'Rent Due — 3 Days Before',type:'tenant',active:false,template:'Hi {name},\n\nReminder: your rent of £{amount} is due on {date}.\n\nThank you,\n{company}'},
  rent_reminder_day: {id:'rent_reminder_day', label:'Rent Due — Day Of',       type:'tenant',active:false,template:'Hi {name},\n\nYour rent of £{amount} is due today. Please arrange payment.\n\nThank you,\n{company}'},
  rent_overdue_3day: {id:'rent_overdue_3day', label:'Rent Overdue — 3 Days',   type:'tenant',active:false,template:'Hi {name},\n\nYour rent of £{amount} due {date} is unpaid. Please contact us urgently.\n\n{company}'},
  rent_overdue_week: {id:'rent_overdue_week', label:'Rent Overdue — 1 Week',   type:'tenant',active:false,template:'Hi {name},\n\nYour rent of £{amount} is 7 days overdue. Please contact us immediately.\n\n{company}'},
  move_in_welcome:   {id:'move_in_welcome',   label:'Move-in Welcome Email',   type:'tenant',active:false,template:'Hi {name},\n\nWelcome to {property}! Your tenancy begins on {date}.\n\n{company}'},
  notice_confirm:    {id:'notice_confirm',    label:'Notice Confirmation',     type:'tenant',active:false,template:'Hi {name},\n\nThis confirms your notice to vacate {property} on {date}.\n\n{company}'},
  compliance_expiry: {id:'compliance_expiry', label:'Compliance Cert Expiry',  type:'manager',active:false,template:'Alert: {doc_type} for {property} expires {date} ({days} days).'},
  weekly_report:     {id:'weekly_report',     label:'Weekly Portfolio Report',  type:'manager',active:false,schedule:'Monday 09:00'},
  monthly_report:    {id:'monthly_report',    label:'Monthly P&L Summary',     type:'manager',active:false,schedule:'1st of month 09:00'},
};

function getEmailConfig(){
  var ls = {};
  try {
    ls = JSON.parse(localStorage.getItem('pm_email_config')||'{}');
  } catch(e) {}
  var o = state._currentOrg || {};
  var db = o.email_settings && typeof o.email_settings === 'object' ? o.email_settings : {};
  return {
    triggers: Object.assign({}, ls.triggers || {}, db.triggers || {}),
    managerEmail: db.managerEmail || ls.managerEmail || '',
  };
}

async function persistEmailSettings(cfg){
  if (!_currentOrgId) {
    showToast && showToast('No organisation loaded', 'error');
    return;
  }
  var clean = {
    triggers: cfg.triggers || {},
    managerEmail: cfg.managerEmail || '',
  };
  var { error } = await supa.from('organisations').update({ email_settings: clean }).eq('id', _currentOrgId);
  if (error) {
    var missingCol = String(error.code || '') === '42703' || String(error.message || '').indexOf('email_settings') !== -1;
    var msg = (error.message || 'Could not save email settings') + (missingCol ? ' Apply db/organisations_email_settings.sql on Supabase, then retry.' : '');
    showToast && showToast(msg, 'error');
    return false;
  }
  if (!state._currentOrg) state._currentOrg = {};
  state._currentOrg.email_settings = clean;
  return true;
}

function renderEmailSettings(){
  var cfg=getEmailConfig();
  var org = state._currentOrg || {};
  var replyHint = (org.billing_email || org.owner_email || 'your organisation billing email in Supabase');
  var html='<div>';
  html+='<div style="background:var(--accent-light);border:1px solid var(--accent);border-radius:12px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
  html+='<div style="font-size:12px;color:var(--accent-dark);line-height:1.45;max-width:520px"><strong>LandlordApp.io email templates</strong> — HTML layouts for welcome, verification, password reset, trial reminders, billing, and reports. Open in a new tab to review or copy into Supabase Auth / Resend.</div>';
  html+='<a href="/landlordapp_emails.html" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;border:1.5px solid var(--accent);background:var(--surface);color:var(--accent-dark);font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0">Open template gallery →</a>';
  html+='</div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Sending (tenant &amp; manager emails)</div>';
  html+='<p style="font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 12px">Rent reminders and reports are sent via your server using <strong>LandlordApp &lt;noreply@landlordapp.io&gt;</strong> (configure <code style="font-size:11px">RESEND_API_KEY</code> on the host). Tenant replies go to: <strong>'+String(replyHint).replace(/</g,'&lt;')+'</strong> (billing email, or owner email, or your account).</p>';
  html+='<div class="field"><label class="field-label">Manager email (weekly / monthly reports)</label><input class="inp" id="ecfg-mgr" placeholder="manager@yourcompany.com" value="'+(cfg.managerEmail||'').replace(/"/g,'&quot;')+'" onchange="saveEmailField(\'managerEmail\',this.value)"></div>';
  html+='</div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:12px">Triggers</div>';
  Object.values(EMAIL_TRIGGERS).forEach(function(tr){
    var on=!!(cfg.triggers&&cfg.triggers[tr.id]);
    html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">';
    html+='<div><div style="font-size:13px;font-weight:500">'+tr.label+'</div>'+(tr.schedule?'<div style="font-size:11px;color:var(--muted)">📅 '+tr.schedule+'</div>':'')+'</div>';
    html+='<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" '+(on?'checked':'')+' data-trid="'+tr.id+'" onchange="toggleEmailTrigger(this.dataset.trid,this.checked)" style="width:16px;height:16px;accent-color:var(--accent)"><span style="font-size:12px;color:'+(on?'var(--green)':'var(--muted)')+'">'+( on?'On':'Off')+'</span></label></div>';
  });
  html+='</div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px">';
  html+='<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Test & Send</div>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:8px">';
  html+='<button onclick="sendTestEmail()" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">✉ Send Test Email</button>';
  html+='<button onclick="runRentReminderEmails(true)" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">🔍 Dry Run</button>';
  html+='<button onclick="runRentReminderEmails(false)" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📨 Send Reminders</button>';
  html+='<button onclick="sendScheduledReport(\'weekly\')" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📊 Weekly Report</button>';
  html+='<button onclick="sendScheduledReport(\'monthly\')" style="padding:9px 14px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">📅 Monthly P&L</button>';
  html+='</div><div style="background:var(--amber-light);border:1px solid #FDE68A;border-radius:9px;padding:9px;margin-top:10px;font-size:11px;color:var(--muted)">⚠ Requires <code style="font-size:11px">RESEND_API_KEY</code> and verified domain on the Node server (<code style="font-size:11px">POST /api/email/send</code>). Auth &amp; billing emails use Supabase / Stripe separately. Gmail may file messages under <strong>Updates</strong>; drag one message to <strong>Primary</strong> and choose “Yes” so future mail lands in the inbox.</div>';
  html+='</div></div>';
  return html;
}

function saveEmailField(key,value){
  var cfg=getEmailConfig();
  cfg[key]=value;
  persistEmailSettings(cfg).then(function(ok){
    if(ok) showToast('Saved','success');
  });
}
function toggleEmailTrigger(id,enabled){
  var cfg=getEmailConfig();
  if(!cfg.triggers)cfg.triggers={};
  cfg.triggers[id]=enabled;
  persistEmailSettings(cfg).then(function(ok){
    if(ok){
      showToast((enabled?'Enabled: ':'Disabled: ')+(EMAIL_TRIGGERS[id]||{label:id}).label,enabled?'success':'info');
      if(typeof render==='function') render();
    }else{
      var inp=document.querySelector('input[data-trid="'+id+'"]');
      if(inp) inp.checked=!enabled;
    }
  });
}

function previewEmailForTenant(triggerId,tenantId){
  var t=state.tenants.find(function(x){return x.id===tenantId;});if(!t)return null;
  var tr=EMAIL_TRIGGERS[triggerId];if(!tr)return null;
  var company=(state.companies&&state.companies[0]&&state.companies[0].name)||'Reservations Direct Limited';
  var body=tr.template.replace(/{name}/g,t.name).replace(/{property}/g,t.property||'').replace(/{amount}/g,'£'+(t.rent||0)).replace(/{company}/g,company).replace(/{date}/g,new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}));
  return {to:t.email,subject:tr.label,body:body};
}

function getCompanyEmailContext(){
  var co=(state.companies&&state.companies[0])||{};
  var org=state._currentOrg||{};
  return {
    companyName:co.name||'Your property manager',
    companyPhone:co.phone||co.tel||'',
    companyEmail:co.email||org.billing_email||org.owner_email||(state.currentUser&&state.currentUser.email)||''
  };
}

async function sendEmail(to,subject,body,kind,extra){
  extra=extra||{};
  if(!_currentOrgId){showToast('No organisation','error');return false;}
  var sr=await supa.auth.getSession();
  var session=sr.data.session;
  if(!session){showToast('Sign in required','error');return false;}
  kind=kind||'tenant';
  var html=extra.html;
  if(!html){
    if(kind==='report'){
      html=buildManagerReportHtml(extra.reportType||'weekly',extra.stats||{},subject,body);
    }else if(kind==='tenant'){
      var cx=getCompanyEmailContext();
      if(extra.tenant){
        if(extra.tenant.firstName)cx.firstName=extra.tenant.firstName;
        if(extra.tenant.companyName)cx.companyName=extra.tenant.companyName;
        if(extra.tenant.companyPhone)cx.companyPhone=extra.tenant.companyPhone;
        if(extra.tenant.companyEmail)cx.companyEmail=extra.tenant.companyEmail;
      }
      html=buildTenantOutboundHtml(subject,body,cx);
    }
  }
  var payload={orgId:_currentOrgId,to:to,subject:subject,text:body,kind:kind};
  if(html)payload.html=html;
  try{
    var resp=await fetch('/api/email/send',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify(payload)
    });
    var data=await resp.json().catch(function(){return {};});
    if(resp.ok){showToast('Email sent to '+to,'success');return true;}
    var msg=(data&&data.error)||(data&&data.message)||JSON.stringify(data).slice(0,120);
    if(/suppression/i.test(String(msg))) {
      msg += ' In Resend: Dashboard → Emails (or Email suppressions) → find '+String(to)+' → Remove from suppression list. Addresses are listed after a bounce or spam complaint.';
    }
    showToast('Email failed: '+msg,'error');
    return false;
  }catch(e){showToast('Email error: '+e.message,'error');return false;}
}

async function sendTestEmail(){
  var cfg=getEmailConfig();
  var to=(cfg.managerEmail||'').trim()||(state.currentUser&&state.currentUser.email)||'';
  if(!to){showToast('Set Manager email in Settings (below) or sign in with an account that has an email','error');return;}
  var props=state.properties.filter(function(p){return p.status!=='archived';});
  var rooms=props.reduce(function(s,p){return s+p.rooms;},0);
  var occ=props.reduce(function(s,p){return s+p.occupied;},0);
  var income=props.reduce(function(s,p){return s+p.rent;},0);
  var costs=props.reduce(function(s,p){return s+p.landlord;},0);
  var body='Test from LandlordApp\n\n'+props.length+' properties · '+state.tenants.filter(function(t){return t.status==='active';}).length+' tenants\nSent: '+new Date().toLocaleString('en-GB');
  var shortDate=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  await sendEmail(to,'LandlordApp · connection test ('+shortDate+')',body,'report',{
    reportType:'test',
    stats:{
      propsLen:props.length,
      income:income,
      costs:costs,
      net:income-costs,
      occPct:rooms?Math.round(occ/rooms*100):0,
      maintOpen:state.maintenance.filter(function(m){return m.status!=='resolved';}).length,
      nowLabel:new Date().toLocaleString('en-GB')
    }
  });
}

async function runRentReminderEmails(dryRun){
  var cfg=getEmailConfig();if(!cfg.triggers){showToast('No triggers configured','error');return;}
  var today=new Date();today.setHours(0,0,0,0);
  var sent=0,skipped=0,log=[];
  state.tenants.filter(function(t){return t.status==='active'&&t.email;}).forEach(function(t){
    (state.rentSchedule||[]).filter(function(s){return s.tenantId===t.id&&s.status==='pending';}).forEach(function(s){
      var dueDate=new Date(s.dueDateRaw);dueDate.setHours(0,0,0,0);
      var d=Math.round((dueDate-today)/86400000);
      var tid=null;
      if(d===3&&cfg.triggers.rent_reminder_3day) tid='rent_reminder_3day';
      if(d===0&&cfg.triggers.rent_reminder_day)  tid='rent_reminder_day';
      if(d===-3&&cfg.triggers.rent_overdue_3day) tid='rent_overdue_3day';
      if(d===-7&&cfg.triggers.rent_overdue_week) tid='rent_overdue_week';
      if(!tid)return;
      var preview=previewEmailForTenant(tid,t.id);
      if(!preview||!preview.to){skipped++;return;}
      log.push({name:t.name,to:preview.to,subject:preview.subject});
      if(!dryRun){
        var firstN=(t.name||'there').trim().split(/\s+/)[0]||'there';
        sendEmail(preview.to,preview.subject,preview.body,'tenant',{tenant:{firstName:firstN}});
      }
      sent++;
    });
  });
  showToast((dryRun?'Dry run: ':'Sent: ')+sent+' emails'+(skipped?' ('+skipped+' skipped)':''),'success');
}

async function sendScheduledReport(type){
  var cfg=getEmailConfig();var to=cfg.managerEmail;
  if(!to){showToast('Set manager email in Settings','error');return;}
  var props=state.properties.filter(function(p){return p.status!=='archived';});
  var rooms=props.reduce(function(s,p){return s+p.rooms;},0);
  var occ=props.reduce(function(s,p){return s+p.occupied;},0);
  var income=props.reduce(function(s,p){return s+p.rent;},0);
  var costs=props.reduce(function(s,p){return s+p.landlord;},0);
  var now=new Date().toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  var shortDate=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  var subject=type==='weekly'
    ?'LandlordApp · your portfolio summary ('+shortDate+')'
    :'LandlordApp · your P&L summary ('+shortDate+')';
  var occPct=rooms?Math.round(occ/rooms*100):0;
  var body=type==='weekly'
    ?'Weekly portfolio snapshot\n'+now+'\n\n'+props.length+' properties · '+occPct+'% occupancy\nIncome: £'+income.toLocaleString()+'/mo · Costs: £'+costs.toLocaleString()+'/mo · Net: £'+(income-costs).toLocaleString()+'/mo\nOpen maintenance: '+state.maintenance.filter(function(m){return m.status!=='resolved';}).length
    :'Monthly P&L\n'+now+'\n\nGross Income: £'+income.toLocaleString()+'\nLandlord Costs: £'+costs.toLocaleString()+'\nNet Profit: £'+(income-costs).toLocaleString()+'\nMargin: '+(income?Math.round((income-costs)/income*100):0)+'%\nOccupancy: '+occPct+'%';
  await sendEmail(to,subject,body,'report',{
    reportType:type,
    stats:{
      propsLen:props.length,
      rooms:rooms,
      occ:occ,
      income:income,
      costs:costs,
      net:income-costs,
      occPct:occPct,
      maintOpen:state.maintenance.filter(function(m){return m.status!=='resolved';}).length,
      nowLabel:now
    }
  });
}

async function startStripeCheckout(plan){
  if(!_currentOrgId){ showToast && showToast('No organisation loaded', 'error'); return; }
  var sr = await supa.auth.getSession();
  var session = sr && sr.data ? sr.data.session : null;
  if(!session){ showToast && showToast('Sign in required', 'error'); return; }
  try{
    var resp = await fetch('/api/stripe/create-checkout-session', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+session.access_token
      },
      body: JSON.stringify({ orgId:_currentOrgId, plan:String(plan||'starter').toLowerCase() })
    });
    var data = await resp.json().catch(function(){ return {}; });
    if(!resp.ok || !data.url){
      showToast && showToast('Checkout failed: '+((data&&data.error)||'Unknown error'), 'error');
      return;
    }
    window.location.href = data.url;
  }catch(e){
    showToast && showToast('Checkout error: '+e.message, 'error');
  }
}

async function openStripeBillingPortal(){
  if(!_currentOrgId){ showToast && showToast('No organisation loaded', 'error'); return; }
  var sr = await supa.auth.getSession();
  var session = sr && sr.data ? sr.data.session : null;
  if(!session){ showToast && showToast('Sign in required', 'error'); return; }
  try{
    var resp = await fetch('/api/stripe/create-portal-session', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+session.access_token
      },
      body: JSON.stringify({ orgId:_currentOrgId })
    });
    var data = await resp.json().catch(function(){ return {}; });
    if(!resp.ok || !data.url){
      showToast && showToast('Could not open billing portal: '+((data&&data.error)||'Unknown error'), 'error');
      return;
    }
    window.location.href = data.url;
  }catch(e){
    showToast && showToast('Billing portal error: '+e.message, 'error');
  }
}

function renderSettings() {
  var companies = state.companies || [];
  var cfg = state.config || {};
  var org = state._currentOrg || {};

  // Compute hiddenV locally (was previously leaked from renderRooms scope)
  var hiddenV = [];
  if(window._roomEidMap === undefined) window._roomEidMap = {};
  (state.properties||[]).forEach(function(p){
    (p.roomList||[]).forEach(function(r){
      if(r._hidden) hiddenV.push({p:p, r:r});
    });
  });

  // ── Plan config ───────────────────────────────────────────────
  var PLANS = {
    trial:        { label:'Free Trial',    price:0,   color:'#F5A623', bg:'#FFFBEB', border:'#FDE68A', props:5,  seats:3  },
    starter:      { label:'Starter',       price:49,  color:'#3B82F6', bg:'#EFF6FF', border:'#BFDBFE', props:15, seats:3  },
    professional: { label:'Professional',  price:89,  color:'#10B981', bg:'#ECFDF5', border:'#A7F3D0', props:25, seats:5  },
    business:     { label:'Business',      price:149, color:'#8B5CF6', bg:'#F5F3FF', border:'#DDD6FE', props:60, seats:15 },
  };
  var plan     = org.plan || 'trial';
  var status   = org.status || 'trial';
  var planCfg  = PLANS[plan] || PLANS.trial;
  var trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  var daysLeft = trialEnd ? Math.ceil((trialEnd - new Date()) / 86400000) : null;
  var isTrial  = status === 'trial';

  // Usage counts
  var propCount   = state.properties.length;
  var tenantCount = state.tenants.filter(function(t){return t.status!=='inactive';}).length;
  var userCount   = (state.users||[]).filter(function(u){return u.status==='active';}).length;

  function usagePct(used, max){ return max ? Math.min(100, Math.round(used/max*100)) : 0; }
  function usageColor(pct){ return pct>=90?'var(--red)':pct>=70?'var(--amber)':'var(--green)'; }
  function usageBar(used, max){
    var pct = usagePct(used, max);
    return '<div style="height:5px;border-radius:3px;background:var(--border);overflow:hidden;margin-top:5px">'
      +'<div style="height:100%;width:'+pct+'%;background:'+usageColor(pct)+';border-radius:3px;transition:width .4s"></div></div>';
  }

  // Plan limit check
  var _planLimits={'free':3,'trial':5,'starter':15,'professional':25,'business':60,'enterprise':9999};
  var _curPlan=(org.plan||cfg.plan||'trial').toLowerCase();
  var _planLimit=_planLimits[_curPlan]||5;
  var _propCount=(state.properties||[]).filter(function(p){return p.status!=='archived';}).length;
  var _limitWarn=_propCount>_planLimit
    ?'<div style="background:#FEF3C7;border:1.5px solid #F59E0B;border-radius:12px;padding:14px 18px;margin-bottom:0;display:flex;align-items:center;gap:12px">'
     +'<span style="font-size:22px">⚠️</span>'
     +'<div><div style="font-size:13px;font-weight:700;color:#92400E">Plan Limit Exceeded</div>'
     +'<div style="font-size:12px;color:#78350F">You have <strong>'+_propCount+'</strong> properties but your <strong>'+_curPlan.charAt(0).toUpperCase()+_curPlan.slice(1)+'</strong> plan allows up to <strong>'+_planLimit+'</strong>. Consider upgrading or archiving unused properties.</div></div></div>'
    :'';
  var html = '<div class="page-header">'
    + '<div><div class="page-title">&#x2699;&#xFE0F; Settings</div>'
    + '<div class="page-sub">Subscription, branding &amp; company profiles</div></div>'
    + '</div>';

  // ── Subscription panel ────────────────────────────────────────
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">';
  html += '<div>';
  html += '<div style="font-size:15px;font-weight:700;margin-bottom:4px">&#x1F4B3; Subscription</div>';
  html += '<div style="display:flex;align-items:center;gap:8px">';
  html += '<span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:6px;background:'+planCfg.bg+';color:'+planCfg.color+';border:1px solid '+planCfg.border+'">'+planCfg.label+'</span>';
  if(isTrial && daysLeft !== null) {
    var trialColor = daysLeft <= 3 ? 'var(--red)' : daysLeft <= 7 ? 'var(--amber)' : 'var(--green)';
    html += '<span style="font-size:12px;color:'+trialColor+';font-weight:700">'+
      (daysLeft > 0 ? daysLeft+' days remaining' : 'Trial expired')+
    '</span>';
  } else if(status === 'active') {
    html += '<span style="font-size:12px;color:var(--green);font-weight:600">&#x2713; Active</span>';
  }
  html += '</div></div>';
  // Upgrade / manage button
  if(isTrial) {
    html += '<button onclick="startStripeCheckout(\'starter\')" '
      + 'style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B06; Upgrade Plan</button>';
  } else {
    html += '<button onclick="openStripeBillingPortal()" '
      + 'style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Manage plan</button>';
  }
  html += '</div>';

  // Plan details row
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">';
  // Properties usage
  html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Properties</div>';
  html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:'+usageColor(usagePct(propCount,planCfg.props))+'">'+propCount+' <span style="font-size:13px;color:var(--muted);font-weight:400">/ '+planCfg.props+'</span></div>';
  html += usageBar(propCount, planCfg.props);
  html += '</div>';
  // Tenants usage
  html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Active Tenants</div>';
  html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:var(--text)">'+tenantCount+'</div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:5px">'+(plan==='starter'?'Up to 75':plan==='trial'?'Up to 30':'Unlimited')+'</div>';
  html += '</div>';
  // Users / seats
  html += '<div style="background:var(--bg);border-radius:9px;padding:12px">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Users (seats)</div>';
  html += '<div style="font-size:18px;font-weight:800;font-family:monospace;color:'+usageColor(usagePct(userCount,planCfg.seats))+'">'+userCount+' <span style="font-size:13px;color:var(--muted);font-weight:400">/ '+planCfg.seats+'</span></div>';
  html += usageBar(userCount, planCfg.seats);
  html += '</div>';
  html += '</div>';

  // Pricing & upgrade options (shown during trial or on lower plans)
  if(isTrial || plan === 'starter') {
    html += '<div style="border-top:1px solid var(--border);padding-top:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Available Plans</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
    [['starter','Starter','£49/mo','15 properties · 3 users'],
     ['professional','Professional','£89/mo','25 properties · 5 users'],
     ['business','Business','£149/mo','60 properties · 15 users']].forEach(function(p){
      var isCurrent = p[0] === plan && !isTrial;
      html += '<div style="border:1.5px solid '+(isCurrent?'var(--accent)':'var(--border)')+';border-radius:9px;padding:12px;background:'+(isCurrent?'var(--accent-light)':'var(--bg)')+'">';
      html += '<div style="font-size:12px;font-weight:700;color:'+(isCurrent?'var(--accent-dark)':'var(--text)')+'">'+p[1]+'</div>';
      html += '<div style="font-size:16px;font-weight:800;font-family:monospace;margin:4px 0">'+p[2]+'</div>';
      html += '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">'+p[3]+'</div>';
      if(!isCurrent) {
        html += '<button onclick="startStripeCheckout(\''+p[0]+'\')" style="display:block;width:100%;text-align:center;padding:6px;border-radius:7px;border:none;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Upgrade</button>';
      } else {
        html += '<div style="text-align:center;font-size:12px;font-weight:700;color:var(--accent-dark)">&#x2713; Current plan</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  }

  html += '</div>';

  // ── Branding ─────────────────────────────────────────────────────────────
  html += '<div style="font-size:15px;font-weight:700;margin-bottom:12px">&#x1F3A8; Branding</div>';
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:20px">';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  // Logo upload
  html += '<div class="field"><label class="field-label">Company Logo</label>';
  if(cfg.logoUrl) {
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
    html += '<img src="'+cfg.logoUrl+'" style="width:56px;height:56px;border-radius:10px;object-fit:contain;background:var(--bg);border:1px solid var(--border);padding:4px">';
    html += '<button onclick="removeLogo()" style="padding:5px 10px;border-radius:7px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:11px;cursor:pointer;font-family:inherit">Remove</button></div>';
  }
  html += '<label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border:2px dashed var(--border);border-radius:9px;cursor:pointer;background:var(--bg)">';
  html += '<span style="font-size:20px">&#x1F4F7;</span>';
  html += '<span style="font-size:12px;color:var(--muted)">Upload logo (PNG/JPG)</span>';
  html += '<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none" onchange="uploadLogo(this)">';
  html += '</label></div>';
  // Portfolio name
  html += '<div class="field"><label class="field-label">Portfolio Name (sidebar)</label>';
  html += '<input class="inp" id="cfg-portname" value="'+(cfg.portfolioName||'South London HMOs')+'">';
  html += '<div class="field" style="margin-top:10px"><label class="field-label">Site Title (browser tab)</label>';
  html += '<input class="inp" id="cfg-sitetitle" value="'+(cfg.siteTitle||'PropManager')+'"></div>';
  html += '</div>';
  html += '</div>';
  html += '<button onclick="saveBranding()" style="margin-top:14px;padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Branding</button>';
  html += '</div>';

  // ── Company Profiles ─────────────────────────────────────────────────────
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  html += '<div style="font-size:15px;font-weight:700">&#x1F3E2; Company Profiles</div>';
  html += '<button onclick="openAddCompanyModal()" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add Company</button>';
  html += '</div>';

  if(companies.length === 0) {
    html += '<div style="background:var(--surface);border:2px dashed var(--border);border-radius:14px;padding:36px;text-align:center;color:var(--dim);margin-bottom:20px">'
      + '<div style="font-size:36px;margin-bottom:10px">&#x1F3E2;</div>'
      + '<div style="font-size:14px;font-weight:700;margin-bottom:6px">No companies yet</div>'
      + '<div style="font-size:12px">Add your limited company profiles. Then assign properties to each one via the Properties page.</div>'
      + '</div>';
  } else {
    companies.forEach(function(co) {
      var props = state.properties.filter(function(p){return p.companyId===co.id;});
      var tenants = state.tenants.filter(function(t){
        return t.status!=='inactive' && props.some(function(p){return p.name===t.property;});
      });
      var mo = Math.round(tenants.reduce(function(s,t){return s+(t.freq==='monthly'?t.rent:t.rent*52/12);},0));
      var ll = props.reduce(function(s,p){return s+(p.landlord||0);},0);
      var net = mo-ll;
      html += '<div style="background:var(--surface);border:2px solid '+(co.color||'#6366F1')+';border-radius:14px;padding:18px;margin-bottom:12px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
      html += '<div>'
        +'<div style="font-size:16px;font-weight:800;margin-bottom:3px">&#x1F3E2; '+co.name+'</div>'
        +'<div style="font-size:12px;color:var(--muted)">Co No: '+(co.companyNo||'&mdash;')+' &nbsp;&middot;&nbsp; VAT: '+(co.vatNo||'&mdash;')+'</div>'
        +'<div style="font-size:12px;color:var(--muted)">Director: '+(co.director||'&mdash;')+'</div>'
        +(co.address?'<div style="font-size:12px;color:var(--muted)">&#x1F4CD; '+co.address+'</div>':'')
        +(co.email||co.phone?'<div style="font-size:12px;color:var(--muted)">'+(co.email?'&#x2709; '+co.email:'')+(co.phone?' &middot; &#x1F4DE; '+co.phone:'')+(co.whatsapp?' &middot; &#x1F4AC; '+co.whatsapp:'')+'</div>':'')
        +'</div>';
      html += '<button data-coid="'+co.id+'" onclick="openEditCompanyModal(this.dataset.coid)" '
        +'style="padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">&#x270F; Edit</button>';
      html += '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:10px">';
      ['Properties:'+props.length+':var(--muted)',
       'Tenants:'+tenants.length+':var(--muted)',
       'Income/mo:&pound;'+mo.toLocaleString()+':var(--green)',
       'LL Cost/mo:&pound;'+ll.toLocaleString()+':var(--amber)',
       'Net/mo:&pound;'+net.toLocaleString()+':'+(net>=0?'var(--green)':'var(--red)')
      ].forEach(function(s){
        var p=s.split(':');
        html+='<div style="background:var(--bg);border-radius:8px;padding:8px 10px">'
          +'<div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:3px">'+p[0]+'</div>'
          +'<div style="font-size:18px;font-weight:800;color:'+p[2]+'">'+p[1]+'</div></div>';
      });
      html += '</div>';
      if(props.length){
        html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:5px">Assigned Properties</div>';
        html+='<div style="display:flex;flex-wrap:wrap;gap:5px">';
        props.forEach(function(p){html+='<span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 8px">'+p.name+'</span>';});
        html+='</div>';
      } else {
        html+='<div style="font-size:11px;color:var(--dim);font-style:italic">No properties assigned — edit a property and select this company.</div>';
      }
      html+='</div>';
    });
  }

  // ── Account ───────────────────────────────────────────────────────────────
  html += '<div style="font-size:15px;font-weight:700;margin-bottom:12px;margin-top:8px">&#x1F464; Account</div>';
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px">';
  html += '<div style="font-size:13px;color:var(--muted);margin-bottom:14px">Logged in as <strong>'+state.currentUser.name+'</strong>';
  if(state.currentUser.email) html += ' ('+state.currentUser.email+')';
  html += '</div>';
  html += '<button onclick="doLogOut()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">&rarr; Log Out</button>';
  html += '</div>';

  // ── Hidden / Unavailable Rooms section ──────────────────────────────────
  if(hiddenV.length) {
    html += '<div style="margin-top:28px;border-top:2px dashed var(--border);padding-top:20px">';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
    html += '<span style="font-size:14px;font-weight:700;color:var(--muted)">🚫 Marked Unavailable ('+hiddenV.length+')</span>';
    html += '<span style="font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:3px 10px;border-radius:8px">Hidden from listings</span>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">';
    hiddenV.forEach(function(item){
      var p=item.p, r=item.r;
      var _eid = 'rm-'+p.id+'_'+r.n;
      window._roomEidMap[_eid]={pid:p.id, rn:r.n};
      html += '<div style="background:var(--bg);border:1.5px dashed var(--border);border-radius:12px;padding:14px;opacity:.75;display:flex;align-items:center;justify-content:space-between;gap:10px">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:13px;font-weight:700;color:var(--muted)">'+p.name+' · Rm '+r.n+'</div>';
      html += '<div style="font-size:12px;color:var(--dim)">'+(r.type||'Room')+' · £'+r.price+'/wk</div>';
      html += '</div>';
      html += '<button id="'+_eid+'-avail" onclick="toggleRoomAvailByEid(this)" title="Click to make this room available in listings" ';
      html += 'style="padding:8px 12px;border-radius:9px;border:1.5px solid var(--green);background:var(--green-light);color:var(--green);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">';
      html += '👁 Make Available</button>';
      html += '</div>';
    });
    html += '</div></div>';
  }

    if(_limitWarn) html += '<div class="card" style="padding:0;background:transparent;box-shadow:none;border:none">'+_limitWarn+'</div>';
  html += '<div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px">';
  html += '<div><div style="font-size:14px;font-weight:700">⇅ Import & Export</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Upload CSV/XLSX or export all data</div></div>';
  html += '<button onclick="openDataModal(\'properties\')" style="padding:9px 16px;border-radius:9px;border:1.5px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Open Data Manager</button></div>';
  html += '<div class="card"><div style="font-size:14px;font-weight:700;margin-bottom:16px">📧 Email & Notifications</div>'+renderEmailSettings()+'</div>';
return html;
}

function uploadLogo(input) {
  var file = input.files[0];
  if(!file) return;
  if(file.size > 500*1024){ showToast('Logo must be under 500KB','error'); return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    if(!state.config) state.config={};
    state.config.logoUrl = e.target.result;
    saveState(); render();
    // Also update topbar logo immediately
    showToast('Logo saved ✓','success');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  if(!state.config) return;
  state.config.logoUrl = '';
  saveState(); render();
}

function saveBranding() {
  if(!state.config) state.config={};
  var pn = document.getElementById('cfg-portname');
  var st = document.getElementById('cfg-sitetitle');
  if(pn) state.config.portfolioName = pn.value.trim();
  if(st) state.config.siteTitle     = st.value.trim();
  // Update live
  var sbSub = document.getElementById('sb-sub-txt');
  if(sbSub && state.config.portfolioName) sbSub.textContent = state.config.portfolioName;
  if(state.config.siteTitle) document.title = state.config.siteTitle;
  saveState();
  showToast('Branding saved ✓','success');
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY CRUD
// ─────────────────────────────────────────────────────────────────────────────
function openAddCompanyModal() {
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:460px">'
    +'<div class="modal-header"><span class="modal-title">&#x1F3E2; New Company</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label class="field-label">Company Name *</label><input class="inp" id="co-name" placeholder="e.g. Reservations Direct Limited"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Company Number</label><input class="inp" id="co-regno" placeholder="12345678"></div>'
    +'<div class="field"><label class="field-label">VAT Number</label><input class="inp" id="co-vat" placeholder="GB123456789"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">Director / Partner</label><input class="inp" id="co-director" placeholder="Gleydson De Paula"></div>'
    +'<div class="field"><label class="field-label">Registered Address</label><input class="inp" id="co-address" placeholder="123 High Street, London, SW1A 1AA"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="co-email" type="email" placeholder="info@company.co.uk"></div>'
    +'<div class="field"><label class="field-label">Phone</label><input class="inp" id="co-phone" type="tel" placeholder="07911 000000"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">WhatsApp Number <span style="font-size:11px;color:var(--muted)">(used on Tenant Portal contact button)</span></label><input class="inp" id="co-wa" type="tel" placeholder="447911000000 (include country code)"></div>'
    +'<div class="field"><label class="field-label">Brand Colour</label><input class="inp" id="co-color" type="color" value="#6366F1" style="height:40px;padding:4px 8px;cursor:pointer"></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button onclick="saveNewCompany()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Company</button>'
    +'</div></div></div>';
}

function openEditCompanyModal(cid) {
  var co=(state.companies||[]).find(function(c){return c.id===cid;});
  if(!co) return;
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:460px">'
    +'<div class="modal-header"><span class="modal-title">&#x270F; Edit Company</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<input type="hidden" id="co-edit-id" value="'+co.id+'">'
    +'<div class="field"><label class="field-label">Company Name *</label><input class="inp" id="co-name" value="'+co.name+'"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Company Number</label><input class="inp" id="co-regno" value="'+(co.companyNo||co.regNo||'')+'"></div>'
    +'<div class="field"><label class="field-label">VAT Number</label><input class="inp" id="co-vat" value="'+(co.vatNo||'')+'"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">Director / Partner</label><input class="inp" id="co-director" value="'+(co.director||'')+'"></div>'
    +'<div class="field"><label class="field-label">Registered Address</label><input class="inp" id="co-address" value="'+(co.address||'')+'"></div>'
    +'<div class="row-2">'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="co-email" value="'+(co.email||'')+'"></div>'
    +'<div class="field"><label class="field-label">Phone</label><input class="inp" id="co-phone" value="'+(co.phone||'')+'"></div>'
    +'</div>'
    +'<div class="field"><label class="field-label">WhatsApp Number <span style="font-size:11px;color:var(--muted)">(used on Tenant Portal contact button)</span></label><input class="inp" id="co-wa" type="tel" value="'+(co.whatsapp||co.phone||'')+'" placeholder="447911000000"></div>'
    +'<div class="field"><label class="field-label">Brand Colour</label><input class="inp" id="co-color" type="color" value="'+(co.color||'#6366F1')+'" style="height:40px;padding:4px 8px;cursor:pointer"></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button data-dcoid="'+co.id+'" onclick="deleteCompany(this.dataset.dcoid)" style="padding:9px 18px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Delete</button>'
    +'<button onclick="saveEditCompany()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save Changes</button>'
    +'</div></div></div>';
}

function saveNewCompany() {
  var name=(document.getElementById('co-name').value||'').trim();
  if(!name){showToast('Company name required','error');return;}
  if(!state.companies) state.companies=[];
  state.companies.push({
    id:'co_'+Date.now(), name:name,
    companyNo:(document.getElementById('co-regno').value||'').trim(),
    vatNo:    (document.getElementById('co-vat').value||'').trim(),
    director: (document.getElementById('co-director').value||'').trim(),
    address:  (document.getElementById('co-address').value||'').trim(),
    email:    (document.getElementById('co-email').value||'').trim(),
    phone:    (document.getElementById('co-phone').value||'').trim(),
    whatsapp: (document.getElementById('co-wa').value||'').trim().replace(/\D/g,''),
    color:    document.getElementById('co-color').value
  });
  saveState(); closeModal(); render();
  showToast('Company saved ✓','success');
}

function saveEditCompany() {
  var cid=document.getElementById('co-edit-id').value;
  var co=(state.companies||[]).find(function(c){return c.id===cid;});
  if(!co) return;
  co.name      =(document.getElementById('co-name').value||'').trim();
  co.companyNo =(document.getElementById('co-regno').value||'').trim();
  co.vatNo     =(document.getElementById('co-vat').value||'').trim();
  co.director  =(document.getElementById('co-director').value||'').trim();
  co.address   =(document.getElementById('co-address').value||'').trim();
  co.email     =(document.getElementById('co-email').value||'').trim();
  co.phone     =(document.getElementById('co-phone').value||'').trim();
  co.whatsapp  =(document.getElementById('co-wa').value||'').trim().replace(/\D/g,'');
  co.color     =document.getElementById('co-color').value;
  saveState(); closeModal(); render();
  showToast('Company updated ✓','success');
}

function deleteCompany(cid) {
  if(!confirm('Delete this company? Properties will become unassigned.')) return;
  state.companies=(state.companies||[]).filter(function(c){return c.id!==cid;});
  state.properties.forEach(function(p){if(p.companyId===cid) p.companyId='';});
  saveState(); closeModal(); render();
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS — invite, edit, delete
// ─────────────────────────────────────────────────────────────────────────────
function openInviteUserModal() {
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:440px"><div class="modal-header">'
    +'<span class="modal-title">&#x2709; Invite User</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<div style="background:var(--accent-light);border:1px solid var(--accent);border-radius:9px;padding:11px 13px;margin-bottom:14px;font-size:12px;color:var(--accent-dark)">'
    +'&#x2139;&#xFE0F; An invite email is sent. The user clicks the link and is logged in automatically.'
    +'</div>'
    +'<div class="field"><label class="field-label">Email Address *</label>'
    +'<input class="inp" id="inv-email" type="email" placeholder="fred@reservationsdirect.co.uk"></div>'
    +'<div class="field"><label class="field-label">Full Name</label>'
    +'<input class="inp" id="inv-name" placeholder="Fred Mensah"></div>'
    +'<div class="field"><label class="field-label">Role</label>'
    +'<select class="inp" id="inv-role">'
    +'<option value="viewer">&#x1F441;&#xFE0F; Viewer</option>'
    +'<option value="maintenance">&#x1F527; Maintenance</option>'
    +'<option value="manager">&#x1F4BC; Manager</option>'
    +'<option value="admin">&#x1F451; Admin</option>'
    +'</select></div>'
    +'<div id="inv-status" style="display:none;padding:10px 12px;border-radius:9px;font-size:13px;font-weight:600;margin-top:8px"></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button id="inv-btn" onclick="sendInvite()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Send Invite</button>'
    +'</div></div></div>';
}

async function sendInvite() {
  var email=(document.getElementById('inv-email').value||'').trim();
  var name =(document.getElementById('inv-name').value||'').trim();
  var role = document.getElementById('inv-role').value;
  var statusEl=document.getElementById('inv-status');
  var btn=document.getElementById('inv-btn');
  if(!email){showToast('Email required','error');return;}
  btn.disabled=true; btn.textContent='Sending…';
  statusEl.style.display='none';
  try {
    var {error}=await supa.auth.signInWithOtp({
      email:email,
      options:{emailRedirectTo:window.location.origin+'/index.html',data:{full_name:name,role:role}}
    });
    if(error) throw error;
    var initials=name?name.split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2):email.slice(0,2).toUpperCase();
    if(!state.users.find(function(u){return u.email===email;})){
      state.users.push({id:crypto.randomUUID(),name:name||email,initials:initials,email:email,phone:'',role:role,status:'pending',lastLogin:'Never'});
      saveState();
    }
    statusEl.style.cssText='display:block;background:#D1FAE5;border:1px solid #A7F3D0;color:#065F46;padding:10px 12px;border-radius:9px;font-size:13px';
    statusEl.innerHTML='&#x2713; Invite sent to '+email;
    btn.textContent='Sent ✓'; btn.style.background='var(--green)';
    setTimeout(function(){closeModal();render();},2000);
  } catch(e){
    statusEl.style.cssText='display:block;background:#FEE2E2;border:1px solid #FECDD3;color:#B91C1C;padding:10px 12px;border-radius:9px;font-size:13px';
    statusEl.textContent='Error: '+(e.message||'Could not send invite');
    btn.disabled=false; btn.textContent='Send Invite';
  }
}

function editUserModal(uid) {
  var u=state.users.find(function(x){return String(x.id)===String(uid);});
  if(!u) return;
  var allRoles=Object.keys(state.roles);
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:420px"><div class="modal-header">'
    +'<span class="modal-title">&#x270F; Edit User</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body">'
    +'<input type="hidden" id="edit-uid" value="'+u.id+'">'
    +'<div class="field"><label class="field-label">Full Name</label>'
    +'<input class="inp" id="edit-name" value="'+u.name+'"></div>'
    +'<div class="field"><label class="field-label">Email</label>'
    +'<input class="inp" id="edit-email" type="email" value="'+(u.email||'')+'"></div>'
    +'<div class="field"><label class="field-label">Phone</label>'
    +'<input class="inp" id="edit-phone" value="'+(u.phone||'')+'"></div>'
    +'<div class="field"><label class="field-label">Role</label>'
    +'<select class="inp" id="edit-role">'
    +allRoles.map(function(rk){return '<option value="'+rk+'" '+(u.role===rk?'selected':'')+'>'+state.roles[rk].icon+' '+state.roles[rk].label+'</option>';}).join('')
    +'</select></div>'
    +'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>'
    +'<button onclick="saveEditUser()" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save</button>'
    +'</div></div></div>';
}

function saveEditUser() {
  var uid=document.getElementById('edit-uid').value;
  var u=state.users.find(function(x){return String(x.id)===String(uid);});
  if(!u) return;
  u.name =(document.getElementById('edit-name').value||'').trim()||u.name;
  u.email=(document.getElementById('edit-email').value||'').trim();
  u.phone=(document.getElementById('edit-phone').value||'').trim();
  u.role = document.getElementById('edit-role').value;
  u.initials=u.name.split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
  if(String(u.id)===String(state.currentUser.id)){
    state.currentUser.name=u.name; state.currentUser.role=u.role; state.currentUser.initials=u.initials;
  }
  saveState(); closeModal(); render();
  showToast('User updated ✓','success');
}

async function deleteUserBtn(el) {
  var uid=el.dataset.uid;
  var u=state.users.find(function(x){return String(x.id)===String(uid);});
  if(!u||!confirm('Permanently delete '+u.name+'? This cannot be undone.')) return;
  state.users=state.users.filter(function(x){return String(x.id)!==String(uid);});
  try{await supa.from('org_members').delete().eq('user_id',String(uid));}catch(e){console.warn(e);}
  saveState();render();
  showToast('User permanently removed','success');
}

function updateUserRoleByEl(sel) { updateUserRole(sel.dataset.uruid, sel.value); }


// ─────────────────────────────────────────────────────────────────────────────
// DOC PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
function previewDoc(docId) {
  var doc = null;
  if(state.vault) { Object.values(state.vault).forEach(function(arr){ arr.forEach(function(d){ if(d.id===docId||d.name===docId) doc=d; }); }); }
  if(!doc && state.propDocs) { Object.values(state.propDocs).forEach(function(arr){ arr.forEach(function(d){ if(d.id===docId||d.name===docId) doc=d; }); }); }
  if(!doc || !doc.dataUrl) { showToast('No preview available','error'); return; }
  var isPdf = doc.name && doc.name.match(/\.pdf$/i);
  var isImg = doc.name && doc.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  var isSupaUrl = doc.dataUrl && doc.dataUrl.indexOf('supabase.co') >= 0;
  if(isSupaUrl){
    document.getElementById('modal-container').innerHTML =
      '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
      +'<div class="modal" style="max-width:460px"><div class="modal-header">'
      +'<span class="modal-title">'+doc.name+'</span>'
      +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
      +'<div class="modal-body" style="text-align:center;padding:32px 24px">'
      +'<div style="font-size:52px;margin-bottom:16px">'+(isPdf?'&#x1F4C4;':isImg?'&#x1F5BC;&#xFE0F;':'&#x1F4CB;')+'</div>'
      +'<div style="font-size:15px;font-weight:700;margin-bottom:6px">'+doc.name+'</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:24px">'+(doc.type||'Document')+(doc.size?' &middot; '+doc.size:'')+'</div>'
      +'<div style="display:flex;gap:10px;justify-content:center">'
      +'<a href="'+doc.dataUrl+'" target="_blank" style="padding:11px 24px;border-radius:10px;background:var(--accent);color:#fff;font-size:14px;font-weight:700;text-decoration:none">Open / View</a>'
      +'<a href="'+doc.dataUrl+'" download="'+doc.name+'" style="padding:11px 24px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;font-weight:700;text-decoration:none">Download</a>'
      +'</div></div>'
      +'<div class="modal-footer"><button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;cursor:pointer;font-family:inherit">Close</button></div>'
      +'</div></div>';
    return;
  }
  var inner = isPdf
    ? '<iframe src="'+doc.dataUrl+'" style="width:100%;height:70vh;border:none;border-radius:8px"></iframe>'
    : isImg
      ? '<img src="'+doc.dataUrl+'" style="max-width:100%;max-height:70vh;border-radius:8px;display:block;margin:0 auto">'
      : '<div style="padding:40px;text-align:center;color:var(--muted)">Preview not available for this file type.<br><a href="'+doc.dataUrl+'" download="'+doc.name+'" style="color:var(--blue)">Download instead ↓</a></div>';
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()" style="align-items:flex-start;padding-top:40px">'
    +'<div class="modal" style="max-width:900px;width:95vw">'
    +'<div class="modal-header"><span class="modal-title">👁 '+doc.name+'</span>'
    +'<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    +'<div class="modal-body" style="padding:16px">'+inner+'</div>'
    +'<div class="modal-footer">'
    +'<button onclick="closeModal()" style="padding:9px 18px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Close</button>'
    +'<a href="'+doc.dataUrl+'" download="'+doc.name+'" style="padding:9px 18px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;text-decoration:none">↓ Download</a>'
    +'</div></div></div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — MAINTENANCE
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// CONTRACTORS
// ─────────────────────────────────────────────────────────────────────────────
const CONTRACTOR_TRADES = ['General','Plumbing','Electrical','Heating','Structural','Cleaning','Pest Control','Locks / Security','Garden','White Goods','Broadband / WiFi','Other'];


function openContractorProfile(id) {
  var c=(state.contractors||[]).find(function(x){return x.id===id;});if(!c)return;
  var jobs=state.maintenance.filter(function(m){return m.contractor===c.name;});
  jobs.sort(function(a,b){return new Date(b.date||0)-new Date(a.date||0);});
  var totalPaid=0,openJobs=0,resolvedJobs=0,invoices=[];
  jobs.forEach(function(m){
    var mx=(state.maintExtras&&state.maintExtras[m.id])||{};
    if(mx.cost)totalPaid+=mx.cost;
    if(m.status==='resolved')resolvedJobs++;else openJobs++;
    if(mx.invoiceName)invoices.push({job:m.issue,name:mx.invoiceName,url:mx.invoiceUrl||'#',cost:mx.cost||0,date:m.date,property:m.property});
  });
  var stars=c.rating?'★'.repeat(c.rating)+'☆'.repeat(5-c.rating):'—';
  var tc={'Plumbing':'var(--blue)','Electrical':'var(--amber)','Heating':'#EF4444','Cleaning':'var(--green)'}[c.trade]||'var(--muted)';
  function sc(s){return s==='resolved'?'var(--green)':s==='in_progress'?'var(--amber)':'var(--red)';}
  function sl(s){return s==='in_progress'?'In Progress':s==='resolved'?'Resolved':'Open';}
  var html='<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:640px">'
    +'<div class="modal-header" style="background:linear-gradient(135deg,#0F0F1A,#1a1a3e)">'
    +'<div style="display:flex;align-items:center;gap:14px;width:100%">'
    +'<div style="width:48px;height:48px;border-radius:50%;background:'+tc+';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">👷</div>'
    +'<div style="flex:1"><div style="font-size:16px;font-weight:800;color:#fff">'+c.name+'</div>'
    +'<div style="display:flex;gap:8px;margin-top:3px">'
    +'<span style="font-size:11px;font-weight:700;color:'+tc+';background:rgba(255,255,255,.1);padding:2px 9px;border-radius:10px">'+c.trade+'</span>'
    +(c.rating?'<span style="font-size:12px;color:#F59E0B">'+stars+'</span>':'')
    +'</div></div>'
    +'<button class="modal-close" onclick="closeModal()" style="color:#fff">&times;</button></div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border)">'
    +[['Total Spent',totalPaid?'£'+totalPaid.toLocaleString():'£0','var(--red)'],
      ['Total Jobs',jobs.length,'var(--text)'],
      ['Open',openJobs,openJobs?'var(--amber)':'var(--green)'],
      ['Invoices',invoices.length,'var(--blue)']
    ].map(function(k){return '<div style="padding:14px;text-align:center;border-right:1px solid var(--border)"><div style="font-size:18px;font-weight:800;font-family:monospace;color:'+k[2]+'">'+k[1]+'</div><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-top:2px">'+k[0]+'</div></div>';}).join('')
    +'</div>'
    +'<div style="overflow-y:auto;max-height:60vh">'
    +'<div style="padding:16px 20px;border-bottom:1px solid var(--border)">'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Contact</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px">'
    +(c.phone?'<a href="tel:'+c.phone+'" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;color:var(--text);text-decoration:none">📞 '+c.phone+'</a>':'')
    +(c.whatsapp?'<a href="https://wa.me/'+c.whatsapp.replace(/\D/g,'')+'" target="_blank" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid #BBF7D0;background:#F0FDF4;font-size:12px;font-weight:600;color:#16A34A;text-decoration:none">💬 WhatsApp</a>':'')
    +(c.email?'<a href="mailto:'+c.email+'" style="display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9px;border:1px solid #BFDBFE;background:var(--blue-light);font-size:12px;font-weight:600;color:var(--blue);text-decoration:none">✉ '+c.email+'</a>':'')
    +(c.callOutCharge?'<span style="padding:8px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:12px;font-weight:600;color:var(--muted)">💷 £'+c.callOutCharge+' call-out</span>':'')
    +'</div>'+(c.notes?'<div style="margin-top:10px;font-size:12px;color:var(--muted);background:var(--bg);padding:8px 12px;border-radius:8px">'+c.notes+'</div>':'')
    +'</div>';
  if(invoices.length){
    html+='<div style="padding:16px 20px;border-bottom:1px solid var(--border)">';
    html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Invoices & Receipts</div>';
    invoices.forEach(function(inv){
      html+='<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--blue-light);border:1px solid #BFDBFE;border-radius:9px;margin-bottom:6px">'
        +'<div style="font-size:20px">📄</div>'
        +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+inv.name+'</div>'
        +'<div style="font-size:11px;color:var(--muted)">'+inv.job+' · '+inv.property+'</div></div>'
        +(inv.cost?'<span style="font-size:13px;font-weight:800;color:var(--red);font-family:monospace;flex-shrink:0">£'+inv.cost+'</span>':'')
        +'<a href="'+inv.url+'" download="'+inv.name+'" style="padding:5px 10px;border-radius:7px;border:1.5px solid var(--blue);background:#fff;font-size:11px;font-weight:700;color:var(--blue);text-decoration:none;flex-shrink:0">Download</a></div>';
    });
    html+='</div>';
  }
  html+='<div style="padding:16px 20px">';
  html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Job History ('+jobs.length+')</div>';
  if(!jobs.length){html+='<div style="text-align:center;padding:24px;color:var(--dim);font-size:13px">No jobs assigned yet</div>';}
  else{jobs.forEach(function(m){
    var mx=(state.maintExtras&&state.maintExtras[m.id])||{};
    html+='<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">'
      +'<div style="width:10px;height:10px;border-radius:50%;background:'+sc(m.status)+';flex-shrink:0;margin-top:4px"></div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="font-size:13px;font-weight:700">'+m.issue+'</div>'
      +(mx.cost?'<div style="font-size:13px;font-weight:800;color:var(--red);font-family:monospace;flex-shrink:0">£'+mx.cost+'</div>':'')
      +'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+m.property+(m.room?' · Room '+m.room:'')+'</div>'
      +'<div style="display:flex;gap:7px;margin-top:5px;flex-wrap:wrap">'
      +'<span style="font-size:10px;font-weight:700;color:'+sc(m.status)+';padding:2px 8px;border-radius:10px;border:1px solid '+sc(m.status)+'">'+sl(m.status)+'</span>'
      +(m.cat?'<span style="font-size:10px;color:var(--dim)">'+m.cat+'</span>':'')
      +(m.date?'<span style="font-size:10px;color:var(--dim)">'+m.date+'</span>':'')
      +'</div>'
      +(m.notes?'<div style="font-size:11px;color:var(--muted);margin-top:4px;padding:5px 8px;background:var(--bg);border-radius:6px">'+m.notes+'</div>':'')
      +(mx.invoiceName?'<div style="margin-top:5px"><a href="'+(mx.invoiceUrl||'#')+'" download="'+mx.invoiceName+'" style="font-size:11px;font-weight:600;color:var(--blue)">📄 '+mx.invoiceName+'</a></div>':'')
      +'</div></div>';
  });}
  html+='</div></div>';
  html+='<div class="modal-footer" style="justify-content:space-between">'
    +'<button onclick="openEditContractorModal(\''+id+'\');closeModal()" style="padding:9px 16px;border-radius:9px;border:1px solid var(--border);background:var(--bg);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--muted)">✏️ Edit Profile</button>'
    +'<button onclick="closeModal()" style="padding:9px 20px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Close</button>'
    +'</div></div></div>';
  document.getElementById('modal-container').innerHTML=html;
}

function openAddContractorModal() {
  var tradeOpts = CONTRACTOR_TRADES.map(function(t){ return '<option>'+t+'</option>'; }).join('');
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:500px">'
    +'<div class="modal-header"><span class="modal-title">➕ Add Contractor</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="row-2"><div class="field"><label class="field-label">Name *</label><input class="inp" id="cx-name" placeholder="e.g. Bob Smith Plumbing"></div>'
    +'<div class="field"><label class="field-label">Trade</label><select class="inp" id="cx-trade">'+tradeOpts+'</select></div></div>'
    +'<div class="row-2"><div class="field"><label class="field-label">Phone</label><input class="inp" id="cx-phone" type="tel" placeholder="07911000000"></div>'
    +'<div class="field"><label class="field-label">WhatsApp number</label><input class="inp" id="cx-wa" type="tel" placeholder="447911000000"></div></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="cx-email" type="email" placeholder="contractor@email.com"></div>'
    +'<div class="row-2"><div class="field"><label class="field-label">Call-out charge (£)</label><input class="inp" id="cx-callout" type="number" placeholder="0"></div>'
    +'<div class="field"><label class="field-label">Rating (1–5)</label><select class="inp" id="cx-rating"><option value="">—</option>'
    +'<option value="5">★★★★★ Excellent</option><option value="4">★★★★☆ Good</option><option value="3">★★★☆☆ OK</option><option value="2">★★☆☆☆ Poor</option><option value="1">★☆☆☆☆ Avoid</option>'
    +'</select></div></div>'
    +'<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="cx-notes" rows="2" placeholder="Specialisms, areas covered, payment terms…" style="resize:vertical"></textarea></div>'
    +'<div class="modal-footer">'
    +btn('Cancel','closeModal()','secondary')
    +btn('Add Contractor','saveContractor(null)','primary')
    +'</div></div></div></div>';
}

function openEditContractorModal(id) {
  var c = (state.contractors||[]).find(function(x){ return x.id===id; });
  if(!c) return;
  var tradeOpts = CONTRACTOR_TRADES.map(function(t){ return '<option '+(t===c.trade?'selected':'')+'>'+t+'</option>'; }).join('');
  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    +'<div class="modal" style="max-width:500px">'
    +'<div class="modal-header"><span class="modal-title">✏️ Edit Contractor</span><button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="row-2"><div class="field"><label class="field-label">Name *</label><input class="inp" id="cx-name" value="'+c.name+'"></div>'
    +'<div class="field"><label class="field-label">Trade</label><select class="inp" id="cx-trade">'+tradeOpts+'</select></div></div>'
    +'<div class="row-2"><div class="field"><label class="field-label">Phone</label><input class="inp" id="cx-phone" type="tel" value="'+(c.phone||'')+'"></div>'
    +'<div class="field"><label class="field-label">WhatsApp number</label><input class="inp" id="cx-wa" type="tel" value="'+(c.whatsapp||'')+'"></div></div>'
    +'<div class="field"><label class="field-label">Email</label><input class="inp" id="cx-email" type="email" value="'+(c.email||'')+'"></div>'
    +'<div class="row-2"><div class="field"><label class="field-label">Call-out charge (£)</label><input class="inp" id="cx-callout" type="number" value="'+(c.callOutCharge||'')+'"></div>'
    +'<div class="field"><label class="field-label">Rating (1–5)</label><select class="inp" id="cx-rating"><option value="">—</option>'
    +[5,4,3,2,1].map(function(n){ return '<option value="'+n+'" '+(c.rating===n?'selected':'')+'>'+'★'.repeat(n)+'☆'.repeat(5-n)+' '+(n===5?'Excellent':n===4?'Good':n===3?'OK':n===2?'Poor':'Avoid')+'</option>'; }).join('')
    +'</select></div></div>'
    +'<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="cx-notes" rows="2" style="resize:vertical">'+(c.notes||'')+'</textarea></div>'
    +'<div class="modal-footer" style="justify-content:space-between">'
    +'<button onclick="deleteContractor(\''+id+'\')" style="padding:9px 16px;border-radius:9px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">🗑 Delete</button>'
    +'<div style="display:flex;gap:8px">'+btn('Cancel','closeModal()','secondary')+btn('Save Changes','saveContractor(\''+id+'\')','primary')+'</div>'
    +'</div></div></div></div>';
}

function saveContractor(id) {
  var name = (document.getElementById('cx-name')||{value:''}).value.trim();
  if(!name){ alert('Please enter a contractor name.'); return; }
  var c = {
    id:   id || crypto.randomUUID(),
    name: name,
    trade:        (document.getElementById('cx-trade')||{value:'General'}).value,
    phone:        (document.getElementById('cx-phone')||{value:''}).value.trim(),
    whatsapp:     (document.getElementById('cx-wa')||{value:''}).value.trim().replace(/\s+/g,'').replace(/^\+/,''),
    email:        (document.getElementById('cx-email')||{value:''}).value.trim(),
    callOutCharge:+(document.getElementById('cx-callout')||{value:0}).value||0,
    rating:       +((document.getElementById('cx-rating')||{value:''}).value)||null,
    notes:        (document.getElementById('cx-notes')||{value:''}).value.trim(),
    lastUsed:     id ? ((state.contractors||[]).find(function(x){return x.id===id;})||{}).lastUsed : null,
  };
  if(!state.contractors) state.contractors = [];
  if(id) {
    var idx = state.contractors.findIndex(function(x){ return x.id===id; });
    if(idx>=0) state.contractors[idx] = c; else state.contractors.push(c);
  } else {
    state.contractors.push(c);
  }
  closeModal();
  saveState();
  render();
}

function deleteContractor(id) {
  if(!confirm('Delete this contractor?')) return;
  state.contractors = (state.contractors||[]).filter(function(c){ return c.id!==id; });
  closeModal();
  saveState();
  render();
}
