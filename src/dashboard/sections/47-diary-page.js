// ── DIARY PAGE — unified calendar & event timeline ────────────────────────────
function renderDiary() {
  var now = new Date();
  var selYear = state.filters.diaryYear || now.getFullYear();
  var selMonth = state.filters.diaryMonth != null ? state.filters.diaryMonth : now.getMonth();
  var view = state.filters.diaryView || 'month';

  // Calendar helpers
  var firstDay = new Date(selYear, selMonth, 1);
  var lastDay = new Date(selYear, selMonth + 1, 0);
  var daysInMonth = lastDay.getDate();
  var startDow = (firstDay.getDay() + 6) % 7; // Monday=0
  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // ── Collect ALL events for this month ──
  var events = [];
  var monthStart = new Date(selYear, selMonth, 1);
  var monthEnd = new Date(selYear, selMonth + 1, 0, 23, 59, 59);

  // 1. Compliance expiry dates
  if (state.propDocs) {
    Object.keys(state.propDocs).forEach(function(pid) {
      var prop = state.properties.find(function(p) { return String(p.id) === String(pid); });
      if (!prop || prop.status === 'archived') return;
      (state.propDocs[pid] || []).forEach(function(doc) {
        if (!doc.expiresAt) return;
        var d = new Date(doc.expiresAt);
        if (d >= monthStart && d <= monthEnd) {
          var days = Math.round((d - now) / 86400000);
          events.push({ date: d, day: d.getDate(), type: 'compliance', color: days < 0 ? 'var(--red)' : days < 30 ? 'var(--amber)' : 'var(--green)',
            title: doc.type + ' — ' + prop.name, detail: days < 0 ? 'EXPIRED ' + Math.abs(days) + 'd ago' : 'Expires in ' + days + 'd',
            icon: '📋' });
        }
      });
    });
  }

  // 2. Maintenance jobs (open/in-progress) — prefer scheduledDate, fallback to logged date
  (state.maintenance || []).forEach(function(m) {
    if (m.status === 'resolved') return;
    var d = null;
    if(m.scheduledDate) {
      var parts = String(m.scheduledDate).split('-');
      if(parts.length===3) d = new Date(+parts[0], +parts[1]-1, +parts[2]);
    }
    if(!d && m.date) d = new Date(m.date);
    if (d && !isNaN(d.getTime()) && d >= monthStart && d <= monthEnd) {
      var timeLbl = m.scheduledTime ? ' @ ' + m.scheduledTime : '';
      events.push({ date: d, day: d.getDate(), type: 'maintenance', color: m.priority === 'urgent' ? 'var(--red)' : 'var(--amber)',
        title: m.issue + timeLbl, detail: m.property + (m.room ? ' · Rm ' + m.room : '') + ' · ' + (m.status||'open').replace('_', ' '),
        icon: '🔧', time: m.scheduledTime||null });
    }
  });

  // 3. Landlord payments due
  (state.landlordPayments || []).forEach(function(p) {
    if (p.status !== 'pending') return;
    var key = p.monthKey || '';
    var parts = key.split('-');
    if (parts.length === 2 && +parts[0] === selYear && +parts[1] === selMonth + 1) {
      events.push({ date: new Date(selYear, selMonth, 1), day: 1, type: 'landlord', color: 'var(--red)',
        title: 'LL Payment — ' + (p.landlordName || 'Unknown'), detail: p.propName + ' · ' + fmt(p.amount),
        icon: '🏦' });
    }
  });

  // 4. Tenant check-in/check-out this month
  (state.tenants || []).forEach(function(t) {
    if (t.startDate || t.checkIn) {
      var d = new Date(t.startDate || t.checkIn);
      if (d >= monthStart && d <= monthEnd) {
        events.push({ date: d, day: d.getDate(), type: 'tenant', color: 'var(--blue)',
          title: t.name + ' — Check In', detail: t.property + (t.room ? ' · Rm ' + t.room : ''),
          icon: '📥' });
      }
    }
    if (t.moveOutDate) {
      var d2 = new Date(t.moveOutDate);
      if (d2 >= monthStart && d2 <= monthEnd) {
        events.push({ date: d2, day: d2.getDate(), type: 'tenant', color: 'var(--amber)',
          title: t.name + ' — Move Out', detail: t.property + (t.room ? ' · Rm ' + t.room : ''),
          icon: '📤' });
      }
    }
  });

  // 5. Manual diary events (from localStorage)
  var diaryKey = 'pm_diary_events_' + (_currentOrgId || 'local');
  var manualEvents = [];
  try { manualEvents = JSON.parse(localStorage.getItem(diaryKey) || '[]'); } catch(e) {}
  manualEvents.forEach(function(ev) {
    var d = new Date(ev.date);
    if (d >= monthStart && d <= monthEnd) {
      // Surface property name in the detail line (when set) so users can scan
      // the upcoming list and immediately see which property an event belongs
      // to without opening the day view.
      var detail = ev.notes || '';
      if (ev.property) detail = '🏠 ' + ev.property + (detail ? ' · ' + detail : '');
      events.push({ date: d, day: d.getDate(), type: 'manual', color: ev.color || 'var(--purple)',
        title: ev.title, detail: detail, icon: '📌', manualId: ev.id });
    }
  });

  // Group events by day
  var eventsByDay = {};
  events.forEach(function(ev) {
    if (!eventsByDay[ev.day]) eventsByDay[ev.day] = [];
    eventsByDay[ev.day].push(ev);
  });

  // ── Counts for sidebar ──
  var compCount = events.filter(function(e) { return e.type === 'compliance'; }).length;
  var maintCount = events.filter(function(e) { return e.type === 'maintenance'; }).length;
  var llCount = events.filter(function(e) { return e.type === 'landlord'; }).length;
  var tenantCount = events.filter(function(e) { return e.type === 'tenant'; }).length;
  var manualCount = events.filter(function(e) { return e.type === 'manual'; }).length;
  var dangerCount = compCount + llCount;
  var statusOk = dangerCount === 0;

  // ── Build HTML ──
  var h = '';

  // Scoped styles for this page (calendar + sidebar)
  h += '<style>'
    + '.diary-grid{display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start}'
    + '@media(max-width:980px){.diary-grid{grid-template-columns:1fr}}'
    + '.diary-cal{padding:22px}'
    + '.diary-cal-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}'
    + '.diary-cal-icon{width:38px;height:38px;border-radius:10px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent-dark);font-size:18px}'
    + '.diary-cal-title{font-size:18px;font-weight:700;color:var(--text);flex:1}'
    + '.diary-cal-nav{display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:3px}'
    + '.diary-cal-nav button{background:none;border:none;width:28px;height:28px;border-radius:6px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center;font-family:inherit;transition:all .15s}'
    + '.diary-cal-nav button:hover{background:var(--surface);color:var(--text)}'
    + '.diary-cal-nav .label{font-size:13px;font-weight:600;color:var(--text);padding:0 8px;min-width:96px;text-align:center}'
    + '.diary-grid-7{display:grid;grid-template-columns:repeat(7,1fr);gap:0}'
    + '.diary-dow{text-align:center;padding:10px 0;font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border)}'
    + '.diary-cell{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:10px 4px 6px;cursor:pointer;border-bottom:1px solid var(--border);border-right:1px solid var(--border);position:relative;transition:background .15s}'
    + '.diary-cell:nth-child(7n){border-right:none}'
    + '.diary-cell:hover{background:var(--accent-light)}'
    + '.diary-cell.muted{color:var(--border2);cursor:default;background:transparent}'
    + '.diary-cell.muted:hover{background:transparent}'
    + '.diary-cell .num{font-size:14px;font-weight:500;color:var(--text);width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%}'
    + '.diary-cell.muted .num{color:var(--border2)}'
    + '.diary-cell.today .num{background:var(--accent);color:#fff;font-weight:700}'
    + '.diary-cell.has-events .num{background:var(--accent-light);color:var(--accent-dark);font-weight:600}'
    + '.diary-cell.today.has-events .num{background:var(--accent);color:#fff}'
    + '.diary-cell .dots{display:flex;gap:3px;margin-top:6px;justify-content:center;align-items:center;min-height:6px}'
    + '.diary-cell .dot{width:5px;height:5px;border-radius:50%}'
    + '.diary-legend{display:flex;flex-wrap:wrap;gap:14px;padding-top:14px;margin-top:6px;border-top:1px solid var(--border)}'
    + '.diary-legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);font-weight:500}'
    + '.diary-legend-item .dot{width:8px;height:8px;border-radius:50%}'
    + '.diary-side{display:flex;flex-direction:column;gap:14px}'
    + '.diary-status{padding:22px;text-align:center}'
    + '.diary-status-shield{width:96px;height:96px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;margin:8px auto 12px;font-size:42px}'
    + '.diary-status-shield.warn{background:var(--red-light)}'
    + '.diary-status-label{font-size:18px;font-weight:800;color:var(--accent-dark);letter-spacing:.02em}'
    + '.diary-status-label.warn{color:var(--red)}'
    + '.diary-side-title{font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px}'
    + '.diary-overview-row{display:flex;align-items:center;gap:12px;padding:9px 0}'
    + '.diary-overview-row+.diary-overview-row{border-top:1px solid var(--border)}'
    + '.diary-overview-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}'
    + '.diary-overview-label{flex:1;font-size:13px;font-weight:500;color:var(--muted)}'
    + '.diary-overview-value{font-size:18px;font-weight:700;color:var(--accent-dark);font-family:"DM Mono",monospace}'
    + '.diary-overview-value.dim{color:var(--dim)}'
    + '.diary-quick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}'
    + '.diary-quick-tile{aspect-ratio:1/1;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;border:none;font-family:inherit;transition:transform .15s,box-shadow .15s;padding:8px}'
    + '.diary-quick-tile:hover{transform:translateY(-2px);box-shadow:var(--shadow-sm)}'
    + '.diary-quick-tile .ico{font-size:20px}'
    + '.diary-quick-tile .lbl{font-size:10px;font-weight:600;color:var(--muted);text-align:center;line-height:1.2}'
    + '.diary-up-row{display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;background:var(--bg);margin-bottom:8px;cursor:pointer;transition:background .15s}'
    + '.diary-up-row:hover{background:var(--accent-light)}'
    + '.diary-up-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}'
    + '.diary-up-body{flex:1;min-width:0}'
    + '.diary-up-title{font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.diary-up-sub{font-size:11px;color:var(--dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.diary-up-date{font-size:11px;font-weight:600;color:var(--accent-dark);background:var(--accent-light);padding:5px 10px;border-radius:8px;flex-shrink:0;white-space:nowrap}'
    + '.diary-up-chev{color:var(--dim);font-size:18px;flex-shrink:0}'
    + '</style>';

  // ── v2 header / hero / stat row ──
  var todayBtn = '<button onclick="state.filters.diaryYear=new Date().getFullYear();state.filters.diaryMonth=new Date().getMonth();render()" style="padding:7px 12px;border-radius:999px;border:1px solid var(--gray-200);background:#fff;font-size:12px;font-weight:600;color:var(--gray-700);cursor:pointer;font-family:inherit">Today</button>';
  var addBtn = '<button onclick="addDiaryEvent()" style="padding:7px 14px;border-radius:999px;border:none;background:var(--teal-500);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ Event</button>';
  h += renderScreenHeader({
    title: 'Diary',
    subtitle: monthNames[selMonth] + ' ' + selYear + ' · ' + events.length + ' event' + (events.length === 1 ? '' : 's'),
    rightActions: [todayBtn, addBtn]
  });
  // Hero — events this month
  var todayDate = new Date();
  var todayCount = events.filter(function(ev){ return ev.date.getDate()===todayDate.getDate() && ev.date.getMonth()===todayDate.getMonth() && ev.date.getFullYear()===todayDate.getFullYear(); }).length;
  var overdueCount = events.filter(function(ev){ return ev.date < todayDate && ev.type === 'compliance'; }).length;
  var heroVariant = events.length === 0 ? 'success' : 'default';
  var heroValue   = events.length === 0 ? 'Nothing scheduled' : (events.length + ' event' + (events.length===1?'':'s'));
  h += renderHeroCard({
    variant: heroVariant,
    icon: '\u{1F4C5}',
    label: monthNames[selMonth] + ' ' + selYear,
    value: '<span style="color:#fff">' + heroValue + '</span>',
    subtitle: events.length === 0 ? 'A peaceful month so far' : (todayCount + ' today · ' + (overdueCount?overdueCount+' overdue · ':'') + events.length + ' total')
  });
  // Stat row
  h += renderStatRow([
    { label: 'Today',    value: todayCount,    color: todayCount?'teal':'dim' },
    { label: 'Overdue',  value: overdueCount,  color: overdueCount?'red':'dim' },
    { label: 'Total',    value: events.length, color: events.length?'default':'dim' }
  ]);

  // ── Two-column layout: calendar + sidebar ──
  h += '<div class="diary-grid">';

  // ── LEFT: Calendar card ──
  h += '<div class="card diary-cal">';
  h += '<div class="diary-cal-head">';
  h += '<div class="diary-cal-icon">&#x1F4C5;</div>';
  h += '<div class="diary-cal-title">' + monthNames[selMonth] + ' ' + selYear + '</div>';
  h += '<div class="diary-cal-nav">';
  h += '<button onclick="navigateDiary(-1)" aria-label="Previous month">&#x25C0;</button>';
  h += '<div class="label">' + monthNames[selMonth].slice(0, 3) + ' ' + selYear + '</div>';
  h += '<button onclick="navigateDiary(1)" aria-label="Next month">&#x25B6;</button>';
  h += '</div></div>';

  // Day-of-week headers
  h += '<div class="diary-grid-7">';
  dayLabels.forEach(function(d) { h += '<div class="diary-dow">' + d + '</div>'; });

  // Prev-month padding
  var prevMonthLast = new Date(selYear, selMonth, 0).getDate();
  for (var p = 0; p < startDow; p++) {
    var prevDay = prevMonthLast - startDow + p + 1;
    h += '<div class="diary-cell muted"><div class="num">' + prevDay + '</div></div>';
  }

  // Current month days
  var today = new Date();
  for (var dd = 1; dd <= daysInMonth; dd++) {
    var isToday = dd === today.getDate() && selMonth === today.getMonth() && selYear === today.getFullYear();
    var dayEvents = eventsByDay[dd] || [];
    var classes = 'diary-cell';
    if (isToday) classes += ' today';
    if (dayEvents.length) classes += ' has-events';
    h += '<div class="' + classes + '" onclick="showDiaryDay(' + selYear + ',' + selMonth + ',' + dd + ')">';
    h += '<div class="num">' + dd + '</div>';
    h += '<div class="dots">';
    if (dayEvents.length) {
      // Distinct colors first, max 3
      var seen = {};
      var unique = [];
      for (var i = 0; i < dayEvents.length && unique.length < 3; i++) {
        if (!seen[dayEvents[i].color]) { seen[dayEvents[i].color] = 1; unique.push(dayEvents[i]); }
      }
      unique.forEach(function(ev) { h += '<div class="dot" style="background:' + ev.color + '"></div>'; });
    }
    h += '</div></div>';
  }

  // Next-month padding
  var totalCells = startDow + daysInMonth;
  var remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (var n = 1; n <= remaining; n++) {
    h += '<div class="diary-cell muted"><div class="num">' + n + '</div></div>';
  }
  h += '</div>'; // .diary-grid-7

  // Legend
  h += '<div class="diary-legend">';
  h += '<div class="diary-legend-item"><div class="dot" style="background:var(--red)"></div>Compliance / Payments</div>';
  h += '<div class="diary-legend-item"><div class="dot" style="background:var(--amber)"></div>Maintenance</div>';
  h += '<div class="diary-legend-item"><div class="dot" style="background:var(--blue)"></div>Tenant Moves</div>';
  h += '<div class="diary-legend-item"><div class="dot" style="background:var(--purple)"></div>Notes</div>';
  h += '</div>';
  h += '</div>'; // .diary-cal

  // ── RIGHT: Sidebar ──
  h += '<div class="diary-side">';

  // Status card
  h += '<div class="card diary-status">';
  h += '<div class="diary-side-title" style="text-align:left;margin-bottom:0">Compliance Status</div>';
  h += '<div class="diary-status-shield' + (statusOk ? '' : ' warn') + '">' + (statusOk ? '&#x1F6E1;&#xFE0F;' : '&#x26A0;&#xFE0F;') + '</div>';
  h += '<div class="diary-status-label' + (statusOk ? '' : ' warn') + '">' + (statusOk ? 'OK' : dangerCount + ' ITEM' + (dangerCount === 1 ? '' : 'S')) + '</div>';
  if (!statusOk) h += '<div style="font-size:11px;color:var(--dim);margin-top:6px">need attention this month</div>';
  h += '</div>';

  // Overview card
  h += '<div class="card" style="padding:18px 20px">';
  h += '<div class="diary-side-title">This Month</div>';
  function ovRow(icon, bg, color, label, count) {
    return '<div class="diary-overview-row">'
      + '<div class="diary-overview-icon" style="background:' + bg + ';color:' + color + '">' + icon + '</div>'
      + '<div class="diary-overview-label">' + label + '</div>'
      + '<div class="diary-overview-value' + (count ? '' : ' dim') + '">' + count + '</div>'
      + '</div>';
  }
  h += ovRow('&#x1F4CB;', 'var(--red-light)', 'var(--red)', 'Compliance', compCount);
  h += ovRow('&#x1F527;', 'var(--amber-light)', 'var(--amber)', 'Maintenance', maintCount);
  h += ovRow('&#x1F3E6;', 'var(--red-light)', 'var(--red)', 'LL Payments', llCount);
  h += ovRow('&#x1F465;', 'var(--blue-light)', 'var(--blue)', 'Tenant Moves', tenantCount);
  h += ovRow('&#x1F4CC;', 'var(--purple-light)', 'var(--purple)', 'Notes', manualCount);
  h += '</div>';

  // Quick Access
  h += '<div class="card" style="padding:18px 20px">';
  h += '<div class="diary-side-title">Quick Access</div>';
  h += '<div class="diary-quick-grid">';
  function qt(bg, ico, lbl, page) {
    return '<button class="diary-quick-tile" style="background:' + bg + '" onclick="state.page=\'' + page + '\';render()"><div class="ico">' + ico + '</div><div class="lbl">' + lbl + '</div></button>';
  }
  h += qt('var(--accent-light)', '&#x1F3E0;', 'Properties', 'properties');
  h += qt('var(--amber-light)', '&#x1F527;', 'Maintenance', 'maintenance');
  h += qt('var(--blue-light)', '&#x1F465;', 'Tenants', 'tenants');
  h += qt('var(--red-light)', '&#x1F4B7;', 'Rent', 'rent');
  h += '</div></div>';

  h += '</div>'; // .diary-side
  h += '</div>'; // .diary-grid

  // ── Upcoming events list (full width) ──
  h += '<div class="card" style="margin-top:18px">';
  h += '<div class="card-header"><div class="card-title">&#x1F4CC; Upcoming Events</div></div>';
  var upcoming = events.slice().sort(function(a, b) { return a.date - b.date; }).slice(0, 8);
  if (!upcoming.length) {
    h += '<div class="empty" style="padding:32px;text-align:center;color:var(--dim)">'
      + '<div style="font-size:32px;margin-bottom:8px">&#x1F4C5;</div>'
      + '<div style="font-size:14px;font-weight:600;margin-bottom:4px;color:var(--text)">No events this month</div>'
      + '<div style="font-size:12px">Compliance dates, maintenance jobs and tenant moves will appear here.</div>'
      + '</div>';
  } else {
    upcoming.forEach(function(ev) {
      var dateStr = ev.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      var iconBg = ev.color === 'var(--red)' ? 'var(--red-light)'
        : ev.color === 'var(--amber)' ? 'var(--amber-light)'
        : ev.color === 'var(--blue)' ? 'var(--blue-light)'
        : ev.color === 'var(--purple)' ? 'var(--purple-light)'
        : 'var(--accent-light)';
      h += '<div class="diary-up-row" onclick="showDiaryDay(' + ev.date.getFullYear() + ',' + ev.date.getMonth() + ',' + ev.date.getDate() + ')">';
      h += '<div class="diary-up-icon" style="background:' + iconBg + '">' + ev.icon + '</div>';
      h += '<div class="diary-up-body">';
      h += '<div class="diary-up-title">' + ev.title + '</div>';
      h += '<div class="diary-up-sub">' + ev.detail + '</div>';
      h += '</div>';
      h += '<div class="diary-up-date">' + dateStr + '</div>';
      h += '<div class="diary-up-chev">&#x203A;</div>';
      h += '</div>';
    });
  }
  h += '</div>';
  h += renderFAB({icon:'+', label:'Add event', onClick:'addDiaryEvent()'});
  return h;
}

// Navigation
function navigateDiary(dir) {
  var m = state.filters.diaryMonth != null ? state.filters.diaryMonth : new Date().getMonth();
  var y = state.filters.diaryYear || new Date().getFullYear();
  m += dir;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  state.filters.diaryMonth = m;
  state.filters.diaryYear = y;
  render();
}

// Show day events in a modal — synchronous, scans all 5 event sources
function showDiaryDay(year, month, day) {
  var d = new Date(year, month, day);
  var dateStr = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  function _matchDay(dd) { return dd && dd.getDate() === day && dd.getMonth() === month && dd.getFullYear() === year; }

  // Collect ALL events for this day synchronously
  var evs = [];

  // 1. Compliance expiry
  if (state.propDocs) {
    Object.keys(state.propDocs).forEach(function(pid) {
      var prop = state.properties.find(function(p) { return String(p.id) === String(pid); });
      if (!prop) return;
      (state.propDocs[pid] || []).forEach(function(doc) {
        if (!doc.expiresAt) return;
        if (_matchDay(new Date(doc.expiresAt))) {
          var days = Math.round((new Date(doc.expiresAt) - new Date()) / 86400000);
          evs.push({ icon: '📋', title: doc.type, detail: prop.name, color: days < 0 ? 'var(--red)' : 'var(--amber)' });
        }
      });
    });
  }

  // 2. Maintenance — prefer scheduled date, fallback to logged date
  (state.maintenance || []).forEach(function(m) {
    if (m.status === 'resolved') return;
    var d = null;
    if(m.scheduledDate) {
      var sp = String(m.scheduledDate).split('-');
      if(sp.length===3) d = new Date(+sp[0], +sp[1]-1, +sp[2]);
    }
    if(!d && m.date) d = new Date(m.date);
    if (_matchDay(d)) {
      var t = m.scheduledTime ? ' @ ' + m.scheduledTime : '';
      evs.push({ icon: '🔧', title: m.issue + t, detail: m.property + (m.room ? ' · Rm ' + m.room : ''), color: m.priority === 'urgent' ? 'var(--red)' : 'var(--amber)' });
    }
  });

  // 3. Landlord payments due (1st of month)
  if (day === 1) {
    (state.landlordPayments || []).forEach(function(p) {
      if (p.status !== 'pending') return;
      var parts = (p.monthKey || '').split('-');
      if (parts.length === 2 && +parts[0] === year && +parts[1] === month + 1) {
        evs.push({ icon: '🏦', title: 'LL Payment — ' + (p.landlordName || ''), detail: (p.propName || '') + ' · ' + fmt(p.amount), color: 'var(--red)' });
      }
    });
  }

  // 4. Tenant moves
  (state.tenants || []).forEach(function(t) {
    if (t.startDate || t.checkIn) { if (_matchDay(new Date(t.startDate || t.checkIn))) evs.push({ icon: '📥', title: t.name + ' — Check In', detail: t.property, color: 'var(--blue)' }); }
    if (t.moveOutDate) { if (_matchDay(new Date(t.moveOutDate))) evs.push({ icon: '📤', title: t.name + ' — Move Out', detail: t.property, color: 'var(--amber)' }); }
  });

  // 5. Manual diary events
  var diaryKey = 'pm_diary_events_' + (_currentOrgId || 'local');
  try {
    JSON.parse(localStorage.getItem(diaryKey) || '[]').forEach(function(ev) {
      if (_matchDay(new Date(ev.date))) {
        var detailBits = [];
        if (ev.time) detailBits.push(ev.time);
        if (ev.property) detailBits.push('🏠 ' + ev.property);
        if (ev.notes) detailBits.push(ev.notes);
        evs.push({ icon: '📌', title: ev.title, detail: detailBits.join(' · '), color: ev.color || 'var(--purple)', manualId: ev.id });
      }
    });
  } catch(e) {}

  // Build event list HTML
  var evHtml = '';
  if (!evs.length) {
    evHtml = '<div style="text-align:center;padding:16px;color:var(--dim)">No events on this day</div>';
  } else {
    evs.forEach(function(ev) {
      evHtml += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">';
      evHtml += '<div style="width:4px;height:28px;border-radius:2px;background:' + ev.color + ';flex-shrink:0"></div>';
      evHtml += '<div style="font-size:18px;flex-shrink:0">' + ev.icon + '</div>';
      evHtml += '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">' + ev.title + '</div>';
      if (ev.detail) evHtml += '<div style="font-size:11px;color:var(--dim)">' + ev.detail + '</div>';
      evHtml += '</div>';
      if (ev.manualId) evHtml += '<button onclick="deleteDiaryEvent(\'' + ev.manualId + '\');closeModal()" style="padding:3px 7px;border-radius:5px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:9px;cursor:pointer;font-family:inherit;flex-shrink:0">&#x2715;</button>';
      evHtml += '</div>';
    });
  }

  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:440px">'
    + '<div class="modal-header"><span class="modal-title">' + dateStr + '</span><button class="modal-close" onclick="closeModal()">&#x00D7;</button></div>'
    + '<div class="modal-body">'
    + '<div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px">' + evs.length + ' event' + (evs.length !== 1 ? 's' : '') + '</div>'
    + evHtml
    + '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">'
    + '<button onclick="closeModal();addDiaryEvent(' + year + ',' + month + ',' + day + ')" class="btn btn-primary" style="width:100%;justify-content:center">&#x2795; Add Event</button>'
    + '</div></div></div></div>';
}

// Add manual diary event
function addDiaryEvent(year, month, day) {
  var defaultDate = '';
  if (year != null && month != null && day != null) {
    var dd = new Date(year, month, day);
    defaultDate = dd.toISOString().split('T')[0];
  } else {
    defaultDate = new Date().toISOString().split('T')[0];
  }

  document.getElementById('modal-container').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">'
    + '<div class="modal" style="max-width:440px">'
    + '<div class="modal-header"><span class="modal-title">Add Diary Event</span><button class="modal-close" onclick="closeModal()">&#x00D7;</button></div>'
    + '<div class="modal-body">'
    + '<div class="field"><label class="field-label">Event Title</label><input class="inp" id="diary-title" placeholder="e.g. Property viewing, Gas inspection..."></div>'
    + '<div class="field"><label class="field-label">Property <span style="font-size:11px;color:var(--muted);font-weight:400">(optional)</span></label>'
    +   '<select class="inp" id="diary-property">'
    +     '<option value="">— Portfolio-wide / no specific property —</option>'
    +     (state.properties||[]).filter(typeof isPropertyActive==='function'?isPropertyActive:function(){return true;}).map(function(p){return '<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>';}).join('')
    +   '</select>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    + '<div class="field"><label class="field-label">Date</label><input class="inp" id="diary-date" type="date" value="' + defaultDate + '"></div>'
    + '<div class="field"><label class="field-label">Time (optional, 24h)</label><input class="inp" id="diary-time" type="time" lang="en-GB" step="60"></div></div>'
    + '<div class="field"><label class="field-label">Notes</label><textarea class="inp" id="diary-notes" rows="2" placeholder="Optional details..." style="resize:vertical"></textarea></div>'
    + '<div class="field"><label class="field-label">Color</label>'
    + '<div style="display:flex;gap:8px">'
    + '<label style="cursor:pointer"><input type="radio" name="diary-color" value="var(--purple)" checked style="display:none"><div style="width:28px;height:28px;border-radius:50%;background:var(--purple);border:3px solid var(--purple)"></div></label>'
    + '<label style="cursor:pointer"><input type="radio" name="diary-color" value="var(--blue)" style="display:none"><div style="width:28px;height:28px;border-radius:50%;background:var(--blue);border:3px solid transparent"></div></label>'
    + '<label style="cursor:pointer"><input type="radio" name="diary-color" value="var(--green)" style="display:none"><div style="width:28px;height:28px;border-radius:50%;background:var(--green);border:3px solid transparent"></div></label>'
    + '<label style="cursor:pointer"><input type="radio" name="diary-color" value="var(--amber)" style="display:none"><div style="width:28px;height:28px;border-radius:50%;background:var(--amber);border:3px solid transparent"></div></label>'
    + '<label style="cursor:pointer"><input type="radio" name="diary-color" value="var(--red)" style="display:none"><div style="width:28px;height:28px;border-radius:50%;background:var(--red);border:3px solid transparent"></div></label>'
    + '</div></div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button onclick="closeModal()" class="btn btn-secondary">Cancel</button>'
    + '<button onclick="saveDiaryEvent()" class="btn btn-primary">Save Event</button>'
    + '</div></div></div>';
}

function saveDiaryEvent() {
  var title = (document.getElementById('diary-title').value || '').trim();
  var date = document.getElementById('diary-date').value;
  var notes = (document.getElementById('diary-notes').value || '').trim();
  var colorEl = document.querySelector('input[name="diary-color"]:checked');
  var color = colorEl ? colorEl.value : 'var(--purple)';

  if (!title) { showToast('Please enter a title', 'error'); return; }
  if (!date) { showToast('Please select a date', 'error'); return; }

  var diaryKey = 'pm_diary_events_' + (_currentOrgId || 'local');
  var events = [];
  try { events = JSON.parse(localStorage.getItem(diaryKey) || '[]'); } catch(e) {}
  var time = (document.getElementById('diary-time') || {}).value || '';
  var property = (document.getElementById('diary-property') || {}).value || '';
  events.push({ id: crypto.randomUUID(), title: title, date: date, time: time, notes: notes, color: color, property: property, created: new Date().toISOString() });
  localStorage.setItem(diaryKey, JSON.stringify(events));

  closeModal();
  showToast('Event added ✓', 'success');
  render();
}

function deleteDiaryEvent(eventId) {
  var diaryKey = 'pm_diary_events_' + (_currentOrgId || 'local');
  var events = [];
  try { events = JSON.parse(localStorage.getItem(diaryKey) || '[]'); } catch(e) {}
  events = events.filter(function(e) { return e.id !== eventId; });
  localStorage.setItem(diaryKey, JSON.stringify(events));
  showToast('Event removed', 'success');
  render();
}
