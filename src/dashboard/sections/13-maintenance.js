// ── MAINTENANCE ───────────────────────────────────────────────────────────────
function renderMaintenance() {
  const f = state.filters.maint || 'open';
  const view = state.filters.maintView || 'requests'; // 'requests' | 'contractors'
  const data = f==='all' ? state.maintenance : state.maintenance.filter(m=>m.status===f);
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
      ? `<div style="background:var(--surface);border:2px dashed var(--border);border-radius:14px;padding:48px;text-align:center;color:var(--muted)">
          <div style="font-size:36px;margin-bottom:12px">🔧</div>
          <div style="font-size:14px;font-weight:700;margin-bottom:6px">No contractors yet</div>
          <div style="font-size:12px">Add your trusted plumbers, electricians, and other trades.<br>You can then send maintenance jobs directly to them via WhatsApp or email.</div>
          <button onclick="openAddContractorModal()" style="margin-top:16px;padding:10px 22px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add first contractor</button>
         </div>`
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
            const waHref = c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g,'')}` : '';
            const mailHref = c.email ? `mailto:${c.email}` : '';
            const stars = c.rating ? '★'.repeat(c.rating)+'☆'.repeat(5-c.rating) : '';
            return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div>
                  <div style="font-size:15px;font-weight:700;margin-bottom:3px">${c.name}</div>
                  <span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:10px;background:${tbg};color:${tc}">${c.trade}</span>
                  ${stars?`<span style="font-size:11px;color:var(--amber);margin-left:6px">${stars}</span>`:''}
                </div>
                <div style="display:flex;gap:6px">
                  <button onclick="openContractorProfile('${c.id}')" style="padding:5px 12px;border-radius:7px;border:1.5px solid var(--accent);background:var(--accent-light);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--accent-dark)">View Profile</button>
                  <button onclick="openEditContractorModal('${c.id}')" style="padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;cursor:pointer;font-family:inherit;color:var(--muted)">Edit</button>
                </div>
              </div>
              ${c.phone?`<div style="font-size:12px;color:var(--muted);margin-bottom:4px">📞 ${c.phone}</div>`:''}
              ${c.email?`<div style="font-size:12px;color:var(--muted);margin-bottom:4px">✉️ ${c.email}</div>`:''}
              ${c.callOutCharge?`<div style="font-size:12px;color:var(--muted);margin-bottom:4px">💷 Call-out: £${c.callOutCharge}</div>`:''}
              ${c.notes?`<div style="font-size:11px;color:var(--dim);background:var(--bg);padding:6px 9px;border-radius:7px;margin:8px 0">${c.notes}</div>`:''}
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

  // ── Maintenance requests view ─────────────────────────────────────────────
  const requestsView = `
    <div class="kpi-grid kpi-3" style="margin-bottom:22px">
      ${kpi('Open', state.maintenance.filter(m=>m.status==='open').length, 'Awaiting action', '#E8375A', '🔴')}
      ${kpi('In Progress', state.maintenance.filter(m=>m.status==='in_progress').length, 'Being handled', '#F59E0B', '🟡')}
      ${kpi('Resolved', state.maintenance.filter(m=>m.status==='resolved').length, 'Completed', '#10B981', '✅')}
    </div>
    <div class="filters">
      ${['open','in_progress','all','resolved'].map(v=>`<button class="filter-btn ${f===v?'active':''}" onclick="state.filters.maint='${v}';render()">${v==='in_progress'?'In Progress':v==='all'?'All':v[0].toUpperCase()+v.slice(1)}</button>`).join('')}
    </div>
    <div class="maint-grid">
      ${data.map(m => {
        const waNum = (m.tenant
          ? (state.tenants.find(t=>t.name===m.tenant&&t.status!=='inactive')||{}).whatsapp
          : null) || '';
        const mx = (state.maintExtras && state.maintExtras[m.id]) || {};
        const allPhotos = [m.photo].filter(Boolean).concat((mx.photos||[]).map(function(p){return p.src;}));
        return `<div class="maint-card${m.priority==='urgent'&&m.status!=='resolved'?' urgent-open':''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div style="display:flex;gap:5px;flex-wrap:wrap">${badge(m.priority)} ${badge(m.status.replace('_',' '))}</div>
            <button data-mid="${m.id}" onclick="openEditMaintModal(this.dataset.mid)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--border);background:var(--bg);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--muted);flex-shrink:0;margin-left:6px">Edit</button>
            <button data-mid="${m.id}" onclick="deleteMaintenanceJob(this.dataset.mid)" style="padding:4px 9px;border-radius:7px;border:1px solid var(--red);background:var(--red-light);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--red);flex-shrink:0;margin-left:4px">✕</button>
          </div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">${m.issue}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px">${m.property}${m.room?' · Room '+m.room:''}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px">Tenant: ${m.tenant||'—'}</div>
          <div style="font-size:11px;color:var(--dim);margin-bottom:8px">Logged: ${m.date} · ${m.cat}</div>
          ${allPhotos.length?`<div style="display:grid;grid-template-columns:${allPhotos.length>1?'1fr 1fr':'1fr'};gap:4px;margin-bottom:10px">${allPhotos.map(function(src){return '<img src="'+src+'" style="width:100%;height:90px;object-fit:cover;border-radius:7px">';}).join('')}</div>`:''}
          ${m.notes?`<div style="font-size:12px;color:var(--muted);background:var(--bg);padding:7px 10px;border-radius:7px;margin-bottom:10px">Notes: ${m.notes}</div>`:''}
          ${m.contractor?`<div style="font-size:11px;color:var(--blue);background:var(--blue-light);padding:5px 9px;border-radius:7px;margin-bottom:8px;font-weight:600">👷 ${m.contractor}</div>`:''}
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
      ${data.length===0?'<div class="empty" style="grid-column:1/-1">No maintenance requests found</div>':''}
    </div>`;

  return `
    <div class="page-header">
      <div><div class="page-title">Maintenance</div><div class="page-sub">${state.maintenance.filter(m=>m.status!=='resolved').length} open · ${state.maintenance.filter(m=>m.priority==='urgent'&&m.status!=='resolved').length} urgent</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button onclick="shareAllMaintWA()" style="padding:9px 14px;border-radius:9px;border:1px solid #25D366;background:#F0FDF4;color:#16A34A;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📲 Share All Open</button>
        ${btn('+ Log Request',"openModal('addMaint')")}
      </div>
    </div>
    <!-- View tabs: Requests / Contractors -->
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px">
      <button onclick="state.filters.maintView='requests';render()" style="padding:10px 20px;border:none;border-bottom:2px solid ${view==='requests'?'var(--accent)':'transparent'};background:transparent;font-size:13px;font-weight:${view==='requests'?700:500};color:${view==='requests'?'var(--accent-dark)':'var(--muted)'};cursor:pointer;font-family:inherit">
        🔧 Requests <span style="font-size:11px;background:${state.maintenance.filter(m=>m.status!=='resolved').length?'var(--red)':'var(--border)'};color:${state.maintenance.filter(m=>m.status!=='resolved').length?'#fff':'var(--muted)'};padding:1px 6px;border-radius:10px;margin-left:4px">${state.maintenance.filter(m=>m.status!=='resolved').length}</span>
      </button>
      <button onclick="state.filters.maintView='contractors';render()" style="padding:10px 20px;border:none;border-bottom:2px solid ${view==='contractors'?'var(--accent)':'transparent'};background:transparent;font-size:13px;font-weight:${view==='contractors'?700:500};color:${view==='contractors'?'var(--accent-dark)':'var(--muted)'};cursor:pointer;font-family:inherit">
        👷 Contractors <span style="font-size:11px;background:var(--bg);color:var(--muted);padding:1px 6px;border-radius:10px;margin-left:4px;border:1px solid var(--border)">${contractors.length}</span>
      </button>
    </div>
    ${view === 'contractors' ? contractorsView : requestsView}`;
}
