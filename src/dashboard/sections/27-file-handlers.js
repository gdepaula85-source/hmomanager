// ── FILE HANDLERS ─────────────────────────────────────────────────────────────
function cleanPhone(raw) {
  var p = String(raw || '').replace(/[\s\-\(\)]/g, '');
  if(p.startsWith('+44')) p = '44' + p.slice(3);
  else if(p.startsWith('0044')) p = '44' + p.slice(4);
  else if(p.startsWith('07')) p = '44' + p.slice(1);
  else if(p.startsWith('7') && p.length === 10) p = '44' + p;
  return p.replace(/\D/g,'');
}

function cleanPostcode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/,' ');
}

function cleanPropertyName(raw) {
  return String(raw || '').trim().replace(/\s+/g,' ');
}

function hasPropCode(name) {
  // Flag names that end in a number, single letter+number, or known code patterns
  return /[A-Z]?\d+[A-Z]?$/.test(name.trim().split(' ').pop()) ||
         /\b(Q\d+|Rm\d+|casa\s*\d+|flat\s*\d+)\b/i.test(name);
}

function handlePropertiesFile(input) {
  var file = input.files[0];
  if(!file) return;
  var reader = new FileReader();

  reader.onload = function(e) {
    try {
      var rows = [];
      var warnings = [];

      if(file.name.endsWith('.csv')) {
        // Parse CSV
        var text = e.target.result;
        var lines = text.split('\n').filter(function(l){return l.trim();});
        var headers = parseCSVLine(lines[0]);
        for(var i=1;i<lines.length;i++){
          var vals = parseCSVLine(lines[i]);
          var obj = {};
          headers.forEach(function(h,j){ obj[h.trim()] = (vals[j]||'').trim(); });
          rows.push(obj);
        }
      } else {
        // Parse XLSX with SheetJS
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, {defval:''});
      }

      // Map and clean
      var mapped = [];
      rows.forEach(function(r) {
        var name = cleanPropertyName(r['Property Name'] || r['Name'] || r['property'] || '');
        if(!name) return;
        var landlordRent = parseFloat(String(r['Landlord Rent (£)']||r['Landlord Rent']||r['landlord']||0).replace(/[£,]/g,'')) || 0;
        var totalRooms   = parseInt(r['Total Rooms']||r['rooms']||0) || 0;
        var occupied     = parseInt(r['Occupied Rooms']||r['occupied']||0) || 0;
        var income       = parseFloat(String(r['Monthly Income (£)']||r['Monthly Income']||r['rent']||0).replace(/[£,]/g,'')) || 0;
        var postcode     = cleanPostcode(r['Postcode']||r['postcode']||'');
        var address      = String(r['Address']||r['address']||'').trim();
        var landlordName = String(r['Landlord Name']||r['landlord_name']||'').trim();
        var landlordPhone = cleanPhone(r['Landlord Contact']||r['landlord_contact']||r['Landlord Phone']||'');
        var status       = String(r['Status']||'active').toLowerCase();

        if(!totalRooms && !landlordRent) {
          warnings.push(name+': no rooms or rent data');
        }

        mapped.push({
          name: name, address: address, postcode: postcode,
          rooms: totalRooms, occupied: occupied, rent: income,
          landlord: landlordRent, landlordName: landlordName,
          landlordPhone: landlordPhone, status: status,
          area: deriveArea(postcode, address), type: 'HMO'
        });
      });

      _importPreview = {type:'properties', rows:mapped, warnings:warnings};
      render();
    } catch(err) {
      alert('Error reading file: '+err.message);
    }
  };

  if(file.name.endsWith('.csv')) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}

function deriveArea(postcode, address) {
  var southLondon = {
    'SW':'Lambeth','SE':'Lewisham','CR':'Croydon','SW16':'Streatham',
    'SW2':'Brixton','SW9':'Brixton','SW4':'Clapham','SW11':'Clapham',
    'SE5':'Camberwell','SE15':'Peckham','SE22':'Dulwich','SE27':'Norwood',
    'SE26':'Sydenham','SE23':'Forest Hill','SE6':'Catford','SE13':'Lewisham'
  };
  var pc = (postcode||'').replace(' ','');
  var prefix4 = pc.slice(0,4);
  var prefix3 = pc.slice(0,3);
  var prefix2 = pc.slice(0,2);
  return southLondon[prefix4] || southLondon[prefix3] || southLondon[prefix2] || 'Other';
}

function handleTenantsFile(input) {
  var file = input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var text = e.target.result;
      var lines = text.split('\n').filter(function(l){return l.trim();});
      var headers = parseCSVLine(lines[0]);
      var warnings = [];
      var mapped = [];

      for(var i=1;i<lines.length;i++){
        var vals = parseCSVLine(lines[i]);
        var obj = {};
        headers.forEach(function(h,j){ obj[h.trim()] = (vals[j]||'').trim(); });

        var name = (obj['Name']||obj['name']||'').trim();
        if(!name) continue;

        var phone  = cleanPhone(obj['Phone']||obj['phone']||obj['WhatsApp']||'');
        var email  = (obj['Email']||obj['email']||'').trim();
        // Ignore auto-generated emails
        if(email.includes('@tenant.com')) email = '';

        var rentRaw = String(obj['Rent Amount']||obj['Rent']||obj['rent']||'0').replace(/[£,]/g,'');
        var rent    = parseFloat(rentRaw) || 0;
        var freq    = (obj['Rent Frequency']||obj['Frequency']||'weekly').toLowerCase().trim();
        var prop    = cleanPropertyName(obj['Property']||obj['property']||'');
        var room    = parseInt(obj['Room']||obj['room']||1) || 1;
        var checkin = parseDate(obj['Check-in Date']||obj['check_in']||'');
        var status  = (obj['Status']||'active').toLowerCase().trim();
        var flagged = hasPropCode(name);

        mapped.push({
          name:name, whatsapp:phone, email:email,
          rent:rent, freq:freq==='monthly'?'monthly':'weekly',
          property:prop, room:room,
          startDate:checkin,
          status:status==='notice_given'?'notice_given':'active',
          _flagged:flagged
        });
      }

      _importPreview = {type:'tenants', rows:mapped, warnings:warnings};
      render();
    } catch(err) {
      alert('Error reading CSV: '+err.message);
    }
  };
  reader.readAsText(file);
}

function parseDate(raw) {
  if(!raw) return '';
  // DD/MM/YYYY → YYYY-MM-DD
  var m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  // Already ISO
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return '';
}

function parseCSVLine(line) {
  var result = [], cur = '', inQuote = false;
  for(var i=0;i<line.length;i++){
    var ch = line[i];
    if(ch==='"'){ inQuote=!inQuote; continue; }
    if(ch===','&&!inQuote){ result.push(cur); cur=''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}
