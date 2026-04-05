// ── USERS PAGE ─────────────────────────────────────────────────────────────────
function renderUsers() {
  var allRoles = Object.keys(state.roles);
  var activeCount = state.users.filter(function(u){return u.status==='active'&&u.status!=='deleted';}).length;

  var html = '<div class="page-header"><div><div class="page-title">Users</div>'
    + '<div class="page-sub">'+activeCount+' active &middot; '+state.users.length+' total</div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button onclick="openInviteUserModal()" style="padding:9px 16px;border-radius:9px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">&#x2709; Invite User</button>'
    + '<button onclick="exportData()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--accent);background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B07; Export</button>'
    + '<button onclick="document.getElementById(\'import-file-input\').click()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--blue);background:var(--blue-light);color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x2B06; Import</button>'
    + '<input type="file" id="import-file-input" accept=".json" style="display:none" onchange="importData(this)">'
    + '<button onclick="clearSavedState()" style="padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:12px;cursor:pointer;font-family:inherit">Reset Demo</button>'
    + '<button onclick="backfillPaymentDueDates()" style="padding:9px 14px;border-radius:9px;border:1px solid #F59E0B;background:#FFFBEB;color:#92400E;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">&#x1F527; Fix Dates</button>'
    + '</div></div>';

  state.users.filter(function(u){return u.status!=='deleted';}).forEach(function(u) {
    var r = state.roles[u.role]||{label:u.role,color:'#64748B',bg:'#F8FAFC',icon:'?'};
    var isMe = String(u.id)===String(state.currentUser.id);
    var isPending = u.status==='pending';
    html += '<div style="background:var(--surface);border:1px solid '+(isMe?'var(--accent)':'var(--border)')+';border-radius:12px;padding:14px;margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
      + '<div style="width:40px;height:40px;border-radius:10px;background:'+r.bg+';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:'+r.color+'">'+u.initials+'</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:700">'+u.name
      + (isMe?' <span style="font-size:10px;color:var(--accent-dark);background:var(--accent-light);padding:2px 7px;border-radius:8px">You</span>':'')
      + (isPending?' <span style="font-size:10px;color:var(--amber);background:#FFFBEB;padding:2px 7px;border-radius:8px">&#x23F3; Pending invite</span>':'')
      + '</div>'
      + '<div style="font-size:11px;color:var(--muted)">'+(u.email||'')+(u.phone?' &middot; '+u.phone:'')+(u.lastLogin?' &middot; Last: '+u.lastLogin:'')+'</div>'
      + '</div>'
      + '<span style="font-size:10px;font-weight:700;color:'+r.color+';background:'+r.bg+';padding:3px 9px;border-radius:8px;white-space:nowrap">'+r.icon+' '+r.label+'</span>'
      + '</div>'
      + '<div style="display:flex;gap:7px;flex-wrap:wrap">'
      + '<select data-uruid="'+u.id+'" onchange="updateUserRoleByEl(this)" style="flex:1;min-width:140px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-family:inherit;font-size:12px;font-weight:600"'+(isMe?' disabled':'')+' >'
      + allRoles.map(function(rk){return '<option value="'+rk+'" '+(u.role===rk?'selected':'')+'>'+state.roles[rk].icon+' '+state.roles[rk].label+'</option>';}).join('')
      + '</select>'
      + (!isMe?'<button data-uid="'+u.id+'" onclick="editUserModal(this.dataset.uid)" style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;cursor:pointer;font-family:inherit">&#x270F; Edit</button>':'')
      + (!isMe?'<button data-uid="'+u.id+'" onclick="toggleUserStatusBtn(this)" style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:12px;cursor:pointer;font-family:inherit">'+(u.status==='active'?'Deactivate':'Activate')+'</button>':'')
      + (!isMe?'<button data-uid="'+u.id+'" onclick="deleteUserBtn(this)" style="padding:7px 12px;border-radius:8px;border:1px solid var(--red);background:var(--red-light);color:var(--red);font-size:12px;cursor:pointer;font-family:inherit">Delete</button>':'')
      + (!isMe?'<button data-uid="'+u.id+'" onclick="switchUserBtn(this)" style="padding:7px 12px;border-radius:8px;border:none;background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Switch &rarr;</button>':'')
      + '</div></div>';
  });

  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:16px;margin-top:8px">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:14px">Role Permissions</div>';
  html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Page Access</div>';
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<thead><tr><th style="text-align:left;padding:7px 8px;color:var(--muted);border-bottom:1px solid var(--border)">Page</th>';
  allRoles.forEach(function(rk){var r=state.roles[rk];html+='<th style="text-align:center;padding:7px 8px;color:'+r.color+';border-bottom:1px solid var(--border)">'+r.icon+' '+r.label+'</th>';});
  html += '</tr></thead><tbody>';
  NAV.forEach(function(nav,ni){html+='<tr'+(ni%2?' style="background:var(--bg)"':'')+'>'+
    '<td style="padding:7px 8px;border-bottom:1px solid var(--border)">'+nav.icon+' '+nav.label+'</td>';
    allRoles.forEach(function(rk){var has=state.roles[rk].pages.indexOf(nav.id)>=0,locked=rk==='admin'||nav.id==='dashboard';
      html+='<td style="text-align:center;padding:7px 8px;border-bottom:1px solid var(--border)"><input type="checkbox"'+(has?' checked':'')+(locked?' disabled':'')+' data-rk="'+rk+'" data-pg="'+nav.id+'" onchange="toggleRolePage(this.dataset.rk,this.dataset.pg)" style="width:15px;height:15px;accent-color:var(--accent);cursor:'+(locked?'not-allowed':'pointer')+'"></td>';
    });html+='</tr>';});
  html += '</tbody></table></div>';
  html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;margin-top:16px">Action Permissions</div>';
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<thead><tr><th style="text-align:left;padding:7px 8px;color:var(--muted);border-bottom:1px solid var(--border)">Permission</th>';
  allRoles.forEach(function(rk){var r=state.roles[rk];html+='<th style="text-align:center;padding:7px 8px;color:'+r.color+';border-bottom:1px solid var(--border)">'+r.icon+' '+r.label+'</th>';});
  html += '</tr></thead><tbody>';
  [['canViewFinancials','Financials'],['canMarkPaid','Mark Paid'],['canAddTenant','Add Tenants'],['canEdit','Edit'],['canDelete','Delete'],['canManageUsers','Manage Users']].forEach(function(perm,pi){html+='<tr'+(pi%2?' style="background:var(--bg)"':'')+'>'+
    '<td style="padding:7px 8px;border-bottom:1px solid var(--border)">'+perm[1]+'</td>';
    allRoles.forEach(function(rk){var has=!!state.roles[rk][perm[0]],locked=rk==='admin';
      html+='<td style="text-align:center;padding:7px 8px;border-bottom:1px solid var(--border)"><input type="checkbox"'+(has?' checked':'')+(locked?' disabled':'')+' data-rk="'+rk+'" data-pm="'+perm[0]+'" onchange="toggleRolePerm(this.dataset.rk,this.dataset.pm)" style="width:15px;height:15px;accent-color:var(--accent);cursor:'+(locked?'not-allowed':'pointer')+'"></td>';
    });html+='</tr>';});
  html += '</tbody></table></div></div>';
  return html;
}

function updateUserRole(uid, role) {
  var u=state.users.find(function(x){return String(x.id)===String(uid);});
  if(!u) return;
  u.role=role;
  if(String(u.id)===String(state.currentUser.id)){state.currentUser.role=role;if(!canSee(state.page))state.page='dashboard';}
  saveState(); render();
}
function toggleRolePage(rk,pg){if(rk==='admin'||pg==='dashboard')return;var r=state.roles[rk];if(!r)return;var i=r.pages.indexOf(pg);if(i>=0)r.pages.splice(i,1);else r.pages.push(pg);if(String(state.currentUser.role)===rk&&!canSee(state.page))state.page='dashboard';saveState();render();}
function toggleRolePerm(rk,pm){if(rk==='admin')return;var r=state.roles[rk];if(!r)return;r[pm]=!r[pm];saveState();render();}
function toggleUserStatus(uid) {
  var u=state.users.find(function(x){return String(x.id)===String(uid);});
  if(!u||String(u.id)===String(state.currentUser.id)) return;
  u.status=u.status==='active'?'inactive':'active';
  saveState(); render();
}
function openAddUserModal() { openInviteUserModal(); }
function saveNewUser() {
  var name=(document.getElementById('nu-name')||{value:''}).value.trim(); if(!name) return;
  var initials=name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
  state.users.push({id:crypto.randomUUID(),name:name,initials:initials,
    email:(document.getElementById('nu-email')||{value:''}).value,
    phone:(document.getElementById('nu-phone')||{value:''}).value,
    role:(document.getElementById('nu-role')||{value:'viewer'}).value,
    status:'active',lastLogin:'Never'});
  saveState(); closeModal(); render();
}
