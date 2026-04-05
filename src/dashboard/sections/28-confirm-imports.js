// ── CONFIRM IMPORTS ───────────────────────────────────────────────────────────
function confirmImportProperties() {
  var rows = _importPreview.rows;
  var imported = 0, skipped = 0;

  rows.forEach(function(r) {
    var exists = state.properties.some(function(p){return p.name.trim().toLowerCase()===r.name.trim().toLowerCase();});
    if(exists){ skipped++; return; }

    // Auto-create landlord if not exists
    if(r.landlordName && !state.landlords.find(function(ll){return ll.name.trim().toLowerCase()===r.landlordName.trim().toLowerCase();})) {
      state.landlords.push({
        id: crypto.randomUUID(),
        name: r.landlordName, phone: r.landlordPhone,
        email:'', bank:'', sortCode:'', accountNo:'', notes:'', properties:[]
      });
    }

    // Build roomList
    var roomList = [];
    for(var i=1;i<=r.rooms;i++){
      roomList.push({n:i, type:'Single', price:0, status: i<=r.occupied?'occupied':'vacant'});
    }

    state.properties.push({
      id: crypto.randomUUID(),
      name: r.name, address: r.address,
      postcode: r.postcode, area: r.area, type: r.type,
      rooms: r.rooms, occupied: r.occupied,
      rent: r.rent, landlord: r.landlord,
      landlordName: r.landlordName,
      mapsUrl: r.postcode ? 'https://maps.google.com/?q='+encodeURIComponent(r.address||r.name) : '',
      roomList: roomList, notes: ''
    });
    imported++;
  });

  _importPreview = null;
  _importTab = 'properties';
  alert('✅ Import complete!\n\n'+imported+' properties imported\n'+skipped+' skipped (already exist)\n\nLandlords auto-created: '+state.landlords.length);
  state.page = 'properties';
  render();
}

function confirmImportTenants() {
  var rows = _importPreview.rows;
  var imported = 0, skipped = 0;

  rows.forEach(function(r) {
    var exists = state.tenants.some(function(t){return t.name.trim().toLowerCase()===r.name.trim().toLowerCase()&&t.whatsapp===r.whatsapp;});
    if(exists){ skipped++; return; }

    var id = crypto.randomUUID();
    state.tenants.push({
      id: id, name: r.name, property: r.property, room: r.room,
      rent: r.rent, freq: r.freq,
      payDay: r.freq==='weekly'?'Monday':null,
      payDayOfMonth: r.freq==='monthly'?1:null,
      method:'bank', status:r.status,
      paid:'—', arrears:0, whatsapp:r.whatsapp,
      email:r.email, deposit:r.rent*2, depositStatus:'held',
      moveIn:r.startDate, startDate:r.startDate,
      noticeDate:null, moveOutDate:null, paymentHistory:[]
    });
    // Mark room as occupied and set room price from tenant rent
    if(r.property && r.room) occupyRoom(r.property, r.room, r.rent);
    imported++;
  });

  rebuildAllSchedules();
  _importPreview = null;
  alert('✅ Import complete!\n\n'+imported+' tenants imported\n'+skipped+' skipped (already exist)');
  state.page = 'tenants';
  render();
}
