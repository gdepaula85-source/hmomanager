-- demo_seed_v2.sql
-- Richer demo seed: 38 properties (28 HMOs · 8 whole-let · 2 SA-only), ~140 tenants
-- (~93% occupancy, ~75% monthly · 25% weekly), 15 landlords, 10 contractors,
-- ~25 maintenance jobs, ~15 recurring expenses, 4 months of historical paid rent,
-- 4 months of paid landlord_payments, ~12 SA/Airbnb payouts.
--
-- Identity & docs (added 2026-05): about half of tenants now have ID-document +
-- selfie photo URLs, dob and nationality; the same half also get a signed
-- tenancy agreement entry (tenant_docs) and signed_landlord metadata. About
-- half of properties get a full HMO compliance stack (Gas / EICR / EPC / FRA
-- / Licence) inserted into property_docs.
--
-- Replaces public.refresh_demo_org() — the new HOURLY cron picks up the new
-- function definition automatically. Calls the function once at the end so
-- the demo data is refreshed immediately on test/prod.
--
-- Run on test (piufcteaqmxemidfdoim) and prod (kzumoubhxdoqqcucdact).

create or replace function public.refresh_demo_org()
returns void
language plpgsql
security definer
as $fn$
declare
  demo_org uuid := '00000000-0000-0000-0000-00000000d3d0';
  co1     uuid := '00000000-0000-0000-0000-00000000c001';
  _today  date := current_date;

  -- 15 landlord uuids (fixed so refs stay stable across resets)
  ll1  uuid := '00000000-0000-0000-0000-0000000011a1';
  ll2  uuid := '00000000-0000-0000-0000-0000000011a2';
  ll3  uuid := '00000000-0000-0000-0000-0000000011a3';
  ll4  uuid := '00000000-0000-0000-0000-0000000011a4';
  ll5  uuid := '00000000-0000-0000-0000-0000000011a5';
  ll6  uuid := '00000000-0000-0000-0000-0000000011a6';
  ll7  uuid := '00000000-0000-0000-0000-0000000011a7';
  ll8  uuid := '00000000-0000-0000-0000-0000000011a8';
  ll9  uuid := '00000000-0000-0000-0000-0000000011a9';
  ll10 uuid := '00000000-0000-0000-0000-0000000011aa';
  ll11 uuid := '00000000-0000-0000-0000-0000000011ab';
  ll12 uuid := '00000000-0000-0000-0000-0000000011ac';
  ll13 uuid := '00000000-0000-0000-0000-0000000011ad';
  ll14 uuid := '00000000-0000-0000-0000-0000000011ae';
  ll15 uuid := '00000000-0000-0000-0000-0000000011af';

  -- Tenant name pools — diverse mix matching real UK HMO tenant demographics.
  fnames text[] := array[
    'Alex','Sofia','Daniel','Emma','Rajiv','Nora','Oliver','Yasmin','Harry','Lena',
    'Finn','Aiko','Mia','Tomasz','Aisha','Ethan','Priya','Marcus','Hannah','Karim',
    'Olivia','Joel','Chloe','Amir','Grace','Lukasz','Megan','Tariq','Isla','Elliot',
    'Jasmine','Reuben','Beatrice','Diego','Saoirse','Kwame','Ines','Vikram','Nadia','Caleb',
    'Hugo','Maya','Theo','Layla','Idris','Eva','Noah','Anika','Felix','Ruby'
  ];
  lnames text[] := array[
    'Morgan','Chen','Reyes','Becker','Patel','Vasquez','Tan','Ali','Jensen','Costa',
    'Tanaka','Kowalski','Hassan','Wright','Singh','Okafor','Walsh','Brennan','Yusuf','Mendoza',
    'Abara','Thompson','Khan','Sinclair','Ross','Adeyemi','Petrova','Murphy','Carrington','Iqbal',
    'Howard','Bennett','Romano','McKenzie','Owusu','Bianchi','Chowdhury','Lewis','Park','Holloway',
    'Davies','Nguyen','Foster','Maguire','Sokolov','Beltran','Ahmadi','Fitzgerald','Cole','Edwards'
  ];

  -- Day-of-month options for monthly tenants
  pay_days int[] := array[1,1,1,5,15,15,28];
  -- Day-of-week options for weekly tenants
  pay_dows text[] := array['Monday','Friday','Friday','Monday'];

  -- Placeholder ID-document and selfie photo URLs — cycle through these by
  -- modulo so the demo has varied imagery without storage uploads. The
  -- dashboard tenant detail modal reads these via the [ID_PHOTO]/[SELFIE]
  -- markers in t.notes (see 16-property-detail-modal.js).
  id_photos text[] := array[
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400',
    'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=400',
    'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=400',
    'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400',
    'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400',
    'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=400'
  ];
  selfies text[] := array[
    'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400',
    'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
  ];
  -- Diverse nationality pool — assigned to ~half of tenants so the Profile
  -- tab shows realistic identity data.
  nats text[] := array[
    'British','Irish','Brazilian','Portuguese','Spanish','Italian','Polish',
    'Romanian','German','French','Indian','Pakistani','Bangladeshi','Nigerian',
    'Ghanaian','South African','American','Canadian','Australian','Filipino',
    'Chinese','Japanese','Korean'
  ];

  this_notes      text;
  this_dob        date;
  this_nat        text;

  prop_rec record;
  ten_rec record;
  i int;
  m int;       -- month offset (0 = current, 1..3 = back)
  w int;       -- week offset for weekly tenants
  rooms_filled int;
  fname text; lname text;
  full_name text; safe_email text;
  this_rent numeric;
  this_freq text;
  this_pdom int;
  this_pdow text;
  this_method text;
  this_dep numeric;
  this_status text;
  this_arrears numeric;
  start_offset int;
  paid_when date;
  due_when  date;
  current_paid_count int := 0;
  m_key text;
  m_label text;
  m_due  date;
  m_paid date;
  rand_seed int;

begin
  -- ── 1. Wipe existing demo data in dependency order ────────────────────────
  delete from public.landlord_payments where org_id = demo_org;
  delete from public.payments           where org_id = demo_org;
  delete from public.maintenance        where org_id = demo_org;
  delete from public.expenses           where org_id = demo_org;
  begin delete from public.tenant_docs   where org_id = demo_org; exception when undefined_table then null; end;
  begin delete from public.property_docs where org_id = demo_org; exception when undefined_table then null; end;
  begin delete from public.contractors   where org_id = demo_org; exception when undefined_table then null; end;
  delete from public.tenants            where org_id = demo_org;
  delete from public.properties         where org_id = demo_org;
  delete from public.landlords          where org_id = demo_org;
  delete from public.companies          where org_id = demo_org;

  -- ── 2. Organisation ───────────────────────────────────────────────────────
  insert into public.organisations (id, name, owner_email, plan, status, billing_override, billing_override_note, stripe_subscription_id, currency, currency_symbol, language, date_format)
  values (demo_org, 'LandlordApp Demo', 'demo@landlordapp.io', 'business', 'active', 'free',
          'Demo account — auto-resets daily', 'manual', 'GBP', '£', 'en-GB', 'DD MMM YYYY')
  on conflict (id) do update set
    name=excluded.name, plan=excluded.plan, status=excluded.status,
    billing_override=excluded.billing_override, billing_override_note=excluded.billing_override_note,
    stripe_subscription_id=excluded.stripe_subscription_id;

  -- ── 3. Operating company ─────────────────────────────────────────────────
  insert into public.companies (id, org_id, name, company_no, director, address, email, phone, color)
  values (co1, demo_org, 'Demo Properties Ltd', '12345678', 'Demo Director',
          '1 Demo Street, London E1 6AN', 'hello@demoproperties.example', '+442073060000', '#6366F1');

  -- ── 4. Landlords (15) ────────────────────────────────────────────────────
  insert into public.landlords (id, org_id, name, phone, email, bank, sort_code, account_no, notes) values
    (ll1,  demo_org, 'James Whitfield',     '+447700900001', 'james@whitfield.example',     'Barclays',   '20-00-00', '12345678', '3 properties · prefers monthly BACS.'),
    (ll2,  demo_org, 'Priya Shah',          '+447700900002', 'priya@shah.example',          'Santander',  '09-01-00', '23456789', 'Single-property landlord, very hands-on.'),
    (ll3,  demo_org, 'Marcus Okonkwo',      '+447700900003', 'marcus@okonkwo.example',      'Monzo',      '04-00-04', '34567890', 'Brixton portfolio.'),
    (ll4,  demo_org, 'Helena Kovač',        '+447700900004', 'helena@kovac.example',        'HSBC',       '40-02-50', '45678901', 'Borough + Dulwich portfolio.'),
    (ll5,  demo_org, 'Ade Lawson',          '+447700900005', 'ade@lawson.example',          'NatWest',    '60-23-77', '56789012', 'North London — Holloway, New Cross.'),
    (ll6,  demo_org, 'Niamh Doherty',       '+447700900006', 'niamh@doherty.example',       'Lloyds',     '30-91-04', '67890123', 'South London single-let + HMO.'),
    (ll7,  demo_org, 'Saif Rahman',         '+447700900007', 'saif@rahman.example',         'Starling',   '60-83-71', '78901234', 'East London — Bethnal Green to Whitechapel.'),
    (ll8,  demo_org, 'Aoife Carrington',    '+447700900008', 'aoife@carrington.example',    'Co-op',      '08-92-50', '89012345', 'Hackney + Walworth.'),
    (ll9,  demo_org, 'Liam McGrath',        '+447700900009', 'liam@mcgrath.example',        'Halifax',    '11-00-12', '90123456', 'Manchester — Hulme + Fallowfield, 3 properties.'),
    (ll10, demo_org, 'Wei Zhang',           '+447700900010', 'wei@zhang.example',           'Barclays',   '20-77-50', '01234567', 'Manchester — Rusholme + Didsbury.'),
    (ll11, demo_org, 'Bukola Adeyinka',     '+447700900011', 'bukola@adeyinka.example',     'TSB',        '30-00-00', '11223344', 'Manchester — Fallowfield + Longsight.'),
    (ll12, demo_org, 'Catriona Black',      '+447700900012', 'catriona@black.example',      'Nationwide', '07-04-00', '22334455', 'Birmingham — Selly Oak + Edgbaston.'),
    (ll13, demo_org, 'Imran Mahmood',       '+447700900013', 'imran@mahmood.example',       'HSBC',       '40-15-77', '33445566', 'Birmingham — Edgbaston + Moseley.'),
    (ll14, demo_org, 'Sebastian Lindgren',  '+447700900014', 'sebastian@lindgren.example',  'Santander',  '09-02-00', '44556677', 'Leeds — Hyde Park + Headingley student lets.'),
    (ll15, demo_org, 'Maria Romão',         '+447700900015', 'maria@romao.example',         'Monzo',      '04-00-05', '55667788', 'Leeds — Hyde Park HMO.');

  -- ── 5. Contractors (10) ──────────────────────────────────────────────────
  -- Note: contractors.id is text (not uuid) per the schema.
  insert into public.contractors (id, org_id, name, trade, phone, whatsapp, email, notes, rating, last_used, call_out_charge) values
    ('demo-c01', demo_org, 'Steve Riggs',      'Plumber',          '+447700910001', '+447700910001', 'steve@rigg-plumbing.example',     'Fast, reliable, charges fairly.',           5, _today - 6,   65),
    ('demo-c02', demo_org, 'Marek Plichta',    'Electrician',      '+447700910002', '+447700910002', 'marek@plichta-elec.example',      'NICEIC certified.',                          5, _today - 14,  85),
    ('demo-c03', demo_org, 'Patel Gas Ltd',    'Gas Engineer',     '+447700910003', '+447700910003', 'office@patelgas.example',         'Gas Safe certified — annuals + emergency.', 4, _today - 2,   95),
    ('demo-c04', demo_org, 'BrightCleans',     'Cleaner',          '+447700910004', '+447700910004', 'hello@brightcleans.example',      'End-of-tenancy + recurring weekly.',         4, _today - 1,   0),
    ('demo-c05', demo_org, 'Locksmiths 24/7',  'Locksmith',        '+447700910005', '+447700910005', 'callout@locksmiths247.example',   '24h emergency callout.',                     4, _today - 38,  120),
    ('demo-c06', demo_org, 'Kasia Decor',      'Decorator',        '+447700910006', '+447700910006', 'kasia@decorlondon.example',       'Painting + plastering.',                     5, _today - 22,  0),
    ('demo-c07', demo_org, 'Handyman Hub',     'Handyman',         '+447700910007', '+447700910007', 'jobs@handymanhub.example',        'Small jobs, day rate.',                       4, _today - 9,   45),
    ('demo-c08', demo_org, 'Green Garden Co',  'Gardener',         '+447700910008', '+447700910008', 'team@greengarden.example',        'Quarterly garden maintenance.',              3, _today - 60,  0),
    ('demo-c09', demo_org, 'Roof Right',       'Roofer',           '+447700910009', '+447700910009', 'enquiries@roofright.example',     'Pricey but thorough — keep for storms.',     4, _today - 95,  150),
    ('demo-c10', demo_org, 'PestStop UK',      'Pest Control',     '+447700910010', '+447700910010', 'office@peststop.example',         'Mice / rats / bedbugs — same-week visits.', 4, _today - 18,  85);

  -- ── 6. Properties (38 total) ─────────────────────────────────────────────
  -- Built into a temp table first so we can compute room_list jsonb procedurally
  -- and reuse the same metadata for downstream tenant + payment generation.
  drop table if exists _seed_props;
  create temp table _seed_props (
    pid           uuid,
    name          text,
    address       text,
    postcode      text,
    area          text,
    city          text,
    rooms         int,
    occupied      int,
    total_rent    numeric,
    landlord_rent numeric,
    llid          uuid,
    llname        text,
    ptype         text,
    ownership     text,
    letting       text,
    bedrooms      int,
    str_enabled   bool,
    notes         text,
    room_list     jsonb
  ) on commit drop;

  insert into _seed_props (pid, name, address, postcode, area, city, rooms, occupied, total_rent, landlord_rent, llid, llname, ptype, ownership, letting, bedrooms, str_enabled, notes) values
    -- ── London (22) ──
    (gen_random_uuid(), '27 Vassall Road',         '27 Vassall Road, London SW9 6TA',          'SW9 6TA',  'Oval',            'London',     4, 4, 3250, 1900, ll1, 'James Whitfield',    'HMO',        'managed', 'hmo',   null, false, 'Four-room converted HMO, Article 4 area.'),
    (gen_random_uuid(), '4 Grange Park Road',      '4 Grange Park Road, London CR7 8QA',       'CR7 8QA',  'Thornton Heath',  'London',     1, 1, 900,  650,  ll2, 'Priya Shah',         'HMO',        'managed', 'hmo',   null, false, 'Single en-suite studio.'),
    (gen_random_uuid(), '22 Elm Grove',            '22 Elm Grove, London SE15 5DB',            'SE15 5DB', 'Peckham',         'London',     3, 3, 2400, 1400, ll1, 'James Whitfield',    'HMO',        'managed', 'hmo',   null, false, 'Three-room HMO above shop.'),
    (gen_random_uuid(), '31 Vassall Road',         '31 Vassall Road, London SW9 6TA',          'SW9 6TA',  'Oval',            'London',     1, 1, 1800, 0,    null, '',                  'Single Let', 'owned',   'whole', 2,    true,  'Owned whole-let, hybrid AST + occasional Airbnb.'),
    (gen_random_uuid(), '88 Brixton Road',         '88 Brixton Road, London SW9 6BZ',          'SW9 6BZ',  'Brixton',         'London',     5, 5, 4250, 2500, ll3, 'Marcus Okonkwo',     'HMO',        'managed', 'hmo',   null, false, 'Five-room HMO, communal lounge.'),
    (gen_random_uuid(), '14 Tabard Street',        '14 Tabard Street, London SE1 4LA',         'SE1 4LA',  'Borough',         'London',     4, 4, 3400, 2050, ll4, 'Helena Kovač',       'HMO',        'managed', 'hmo',   null, false, 'Borough HMO, walking distance to London Bridge.'),
    (gen_random_uuid(), '56 Camberwell Grove',     '56 Camberwell Grove, London SE5 8JE',      'SE5 8JE',  'Camberwell',      'London',     6, 5, 5100, 3050, ll1, 'James Whitfield',    'HMO',        'managed', 'hmo',   null, false, 'Six-room Victorian HMO, one room currently between tenants.'),
    (gen_random_uuid(), '102 Holloway Road',       '102 Holloway Road, London N7 8JE',         'N7 8JE',   'Holloway',        'London',     5, 5, 4150, 2500, ll5, 'Ade Lawson',         'HMO',        'managed', 'hmo',   null, false, 'North London HMO above commercial unit.'),
    (gen_random_uuid(), '7 Strathleven Road',      '7 Strathleven Road, London SW2 5JZ',       'SW2 5JZ',  'Brixton',         'London',     1, 1, 2100, 1500, ll6, 'Niamh Doherty',      'Single Let', 'managed', 'whole', 2,    false, 'Two-bed flat, family let.'),
    (gen_random_uuid(), '33 Lordship Lane',        '33 Lordship Lane, London SE22 8EW',        'SE22 8EW', 'East Dulwich',    'London',     4, 4, 3300, 1980, ll4, 'Helena Kovač',       'HMO',        'managed', 'hmo',   null, false, 'Above bakery, professional sharers.'),
    (gen_random_uuid(), '19 Coldharbour Lane',     '19 Coldharbour Lane, London SE5 9NS',      'SE5 9NS',  'Camberwell',      'London',     5, 4, 4150, 2480, ll3, 'Marcus Okonkwo',     'HMO',        'managed', 'hmo',   null, false, 'Five-room HMO, one room between tenants.'),
    (gen_random_uuid(), '240 New Cross Road',      '240 New Cross Road, London SE14 5UJ',      'SE14 5UJ', 'New Cross',       'London',     6, 6, 4950, 2950, ll5, 'Ade Lawson',         'HMO',        'managed', 'hmo',   null, false, 'Six-room HMO near Goldsmiths.'),
    (gen_random_uuid(), '67 Lewisham Way',         '67 Lewisham Way, London SE4 1UW',          'SE4 1UW',  'Brockley',        'London',     4, 4, 3300, 1980, ll4, 'Helena Kovač',       'HMO',        'managed', 'hmo',   null, false, 'Four-room HMO, recently refurbished.'),
    (gen_random_uuid(), '15 Tooting High Street',  '15 Tooting High Street, London SW17 0QS',  'SW17 0QS', 'Tooting',         'London',     5, 5, 4150, 2480, ll6, 'Niamh Doherty',      'HMO',        'managed', 'hmo',   null, false, 'Tooting HMO above retail.'),
    (gen_random_uuid(), '8 Edith Road',            '8 Edith Road, London W14 0SR',             'W14 0SR',  'Hammersmith',     'London',     1, 1, 2400, 0,    null, '',                  'Single Let', 'owned',   'whole', 2,    true,  'Owned 2-bed flat, occasional STR.'),
    (gen_random_uuid(), '41 Roman Road',           '41 Roman Road, London E2 0HU',             'E2 0HU',   'Bethnal Green',   'London',     4, 4, 3300, 1980, ll7, 'Saif Rahman',        'HMO',        'managed', 'hmo',   null, false, 'East London HMO, market-side.'),
    (gen_random_uuid(), '28 Stoke Newington Rd',   '28 Stoke Newington Road, London N16 7XJ',  'N16 7XJ',  'Stoke Newington', 'London',     5, 4, 4250, 2550, ll7, 'Saif Rahman',        'HMO',        'managed', 'hmo',   null, false, 'Five-room HMO, one room turning over.'),
    (gen_random_uuid(), '73 Mile End Road',        '73 Mile End Road, London E1 4UN',          'E1 4UN',   'Whitechapel',     'London',     6, 5, 5100, 3050, ll7, 'Saif Rahman',        'HMO',        'managed', 'hmo',   null, false, 'Six-room HMO, one between tenants.'),
    (gen_random_uuid(), '12 Chatsworth Road',      '12 Chatsworth Road, London E5 0LR',        'E5 0LR',   'Lower Clapton',   'London',     4, 4, 3400, 2050, ll8, 'Aoife Carrington',   'HMO',        'managed', 'hmo',   null, false, 'Four-room HMO above café.'),
    (gen_random_uuid(), '5 Greenwich High Road',   '5 Greenwich High Road, London SE10 8JL',   'SE10 8JL', 'Greenwich',       'London',     1, 1, 2200, 0,    null, '',                  'Single Let', 'owned',   'whole', 3,    false, 'Owned 3-bed terrace, family let.'),
    (gen_random_uuid(), '29 Walworth Road',        '29 Walworth Road, London SE17 1RW',        'SE17 1RW', 'Walworth',        'London',     5, 5, 4150, 2500, ll8, 'Aoife Carrington',   'HMO',        'managed', 'hmo',   null, false, 'Five-room HMO, fully let.'),
    (gen_random_uuid(), '84 Old Kent Road',        '84 Old Kent Road, London SE15 1NL',        'SE15 1NL', 'Peckham',         'London',     1, 1, 2800, 0,    null, '',                  'Single Let', 'owned',   'whole', 2,    true,  'Owned 2-bed, dedicated SA / Airbnb only.'),

    -- ── Manchester (8) ──
    (gen_random_uuid(), '9 Argyll Street',         '9 Argyll Street, Manchester M15 1EA',      'M15 1EA',  'Hulme',           'Manchester', 4, 3, 2325, 1800, ll9,  'Liam McGrath',      'HMO',        'managed', 'hmo',   null, true,  'Manchester HMO, one SA-enabled room for flex.'),
    (gen_random_uuid(), '27 Lloyd Street',         '27 Lloyd Street, Manchester M14 7HU',      'M14 7HU',  'Fallowfield',     'Manchester', 5, 5, 2900, 1750, ll9,  'Liam McGrath',      'HMO',        'managed', 'hmo',   null, false, 'Student HMO, Fallowfield.'),
    (gen_random_uuid(), '14 Wilmslow Road',        '14 Wilmslow Road, Manchester M14 5TP',     'M14 5TP',  'Rusholme',        'Manchester', 6, 5, 3450, 2050, ll10, 'Wei Zhang',         'HMO',        'managed', 'hmo',   null, false, 'Six-room HMO on Curry Mile.'),
    (gen_random_uuid(), '88 Burton Road',          '88 Burton Road, Manchester M20 1HD',       'M20 1HD',  'West Didsbury',   'Manchester', 4, 3, 2400, 1450, ll10, 'Wei Zhang',         'HMO',        'managed', 'hmo',   null, false, 'Four-room HMO, one between tenants.'),
    (gen_random_uuid(), '33 Wellington Road',      '33 Wellington Road, Manchester M14 6EQ',   'M14 6EQ',  'Fallowfield',     'Manchester', 5, 5, 2950, 1780, ll9,  'Liam McGrath',      'HMO',        'managed', 'hmo',   null, false, 'Five-room HMO, professionals + students mix.'),
    (gen_random_uuid(), '6 Whitworth Street',      '6 Whitworth Street, Manchester M1 3GW',    'M1 3GW',   'Centre',          'Manchester', 1, 1, 1450, 0,    null, '',                  'Single Let', 'owned',   'whole', 2,    false, 'Owned 2-bed apartment, professional couple.'),
    (gen_random_uuid(), '21 Egerton Road',         '21 Egerton Road, Manchester M14 6XS',      'M14 6XS',  'Fallowfield',     'Manchester', 4, 4, 2400, 1450, ll11, 'Bukola Adeyinka',   'HMO',        'managed', 'hmo',   null, false, 'Four-room HMO, well-maintained.'),
    (gen_random_uuid(), '47 Stockport Road',       '47 Stockport Road, Manchester M12 4DA',    'M12 4DA',  'Longsight',       'Manchester', 5, 5, 2750, 1650, ll11, 'Bukola Adeyinka',   'HMO',        'managed', 'hmo',   null, false, 'Five-room HMO.'),

    -- ── Birmingham (5) ──
    (gen_random_uuid(), '18 Selly Oak Road',       '18 Selly Oak Road, Birmingham B29 6JE',    'B29 6JE',  'Selly Oak',       'Birmingham', 5, 5, 2750, 1650, ll12, 'Catriona Black',    'HMO',        'managed', 'hmo',   null, false, 'Student HMO, Selly Oak.'),
    (gen_random_uuid(), '42 Harborne Road',        '42 Harborne Road, Birmingham B15 3EA',     'B15 3EA',  'Edgbaston',       'Birmingham', 6, 5, 3300, 1980, ll12, 'Catriona Black',    'HMO',        'managed', 'hmo',   null, false, 'Six-room HMO, one room turning over.'),
    (gen_random_uuid(), '9 Bristol Road',          '9 Bristol Road, Birmingham B5 7TR',        'B5 7TR',   'Edgbaston',       'Birmingham', 4, 3, 2300, 1380, ll13, 'Imran Mahmood',     'HMO',        'managed', 'hmo',   null, false, 'Four-room HMO, one between tenants.'),
    (gen_random_uuid(), '56 Pershore Road',        '56 Pershore Road, Birmingham B5 7NX',      'B5 7NX',   'Edgbaston',       'Birmingham', 1, 1, 1200, 0,    null, '',                  'Single Let', 'owned',   'whole', 3,    false, 'Owned 3-bed terrace, family let.'),
    (gen_random_uuid(), '22 Alcester Road',        '22 Alcester Road, Birmingham B13 8BG',     'B13 8BG',  'Moseley',         'Birmingham', 5, 5, 2750, 1650, ll13, 'Imran Mahmood',     'HMO',        'managed', 'hmo',   null, false, 'Moseley HMO, professionals.'),

    -- ── Leeds (3) ──
    (gen_random_uuid(), '11 Hyde Park Road',       '11 Hyde Park Road, Leeds LS6 1PY',         'LS6 1PY',  'Hyde Park',       'Leeds',      5, 4, 2500, 1500, ll14, 'Sebastian Lindgren', 'HMO',       'managed', 'hmo',   null, false, 'Student HMO, one room turning over.'),
    (gen_random_uuid(), '35 Brudenell Road',       '35 Brudenell Road, Leeds LS6 1HA',         'LS6 1HA',  'Headingley',      'Leeds',      6, 6, 3000, 1800, ll14, 'Sebastian Lindgren', 'HMO',       'managed', 'hmo',   null, false, 'Six-bed Headingley student let.'),
    (gen_random_uuid(), '8 Cardigan Road',         '8 Cardigan Road, Leeds LS6 3AB',           'LS6 3AB',  'Hyde Park',       'Leeds',      4, 3, 2080, 1240, ll15, 'Maria Romão',        'HMO',       'managed', 'hmo',   null, false, 'Four-room HMO, one between tenants.');

  -- Compute room_list jsonb for every property. Each room row has {n,type,price,status}
  -- and whole-property rows additionally carry isWholeProperty=true.
  update _seed_props sp set room_list = (
    select jsonb_agg(
      case
        when sp.letting = 'whole' then jsonb_build_object(
          'n', n,
          'type', 'Whole Property',
          'price', sp.total_rent,
          'status', case when n <= sp.occupied then 'occupied' else 'vacant' end,
          'isWholeProperty', true
        )
        else jsonb_build_object(
          'n', n,
          'type', case when sp.rooms = 1 then 'Studio' else 'Single' end,
          'price', round(sp.total_rent / greatest(sp.rooms, 1)),
          'status', case when n <= sp.occupied then 'occupied' else 'vacant' end
        )
      end
      order by n
    )
    from generate_series(1, sp.rooms) g(n)
  );

  -- Now insert into the real properties table.
  insert into public.properties (id, org_id, name, address, postcode, area, type, rooms, occupied, rent, landlord_rent, landlord_id, landlord_name, maps_url, notes, company_id, room_list, ownership_type, letting_type, bedrooms, status, is_str_enabled)
  select
    sp.pid, demo_org, sp.name, sp.address, sp.postcode, sp.area, sp.ptype,
    sp.rooms, sp.occupied, sp.total_rent, sp.landlord_rent, sp.llid, sp.llname,
    'https://maps.google.com/?q=' || replace(sp.address, ' ', '+'),
    sp.notes, co1, sp.room_list, sp.ownership, sp.letting, sp.bedrooms, 'active', sp.str_enabled
  from _seed_props sp;

  -- ── 7. Tenants — fill occupied rooms procedurally ────────────────────────
  -- Loops every property × occupied room count and creates a tenant per room,
  -- pulling first/last names from the diverse pools above. Mix of monthly
  -- (~75%) and weekly (~25%) tenants distributed deterministically.
  drop table if exists _seed_tenants;
  create temp table _seed_tenants (
    tid          uuid,
    pid          uuid,
    pname        text,
    rnumber      int,
    rtype        text,
    rent         numeric,
    freq         text,
    pay_dom      int,
    pay_dow      text,
    method       text,
    start_date   date,
    is_arrears   bool
  ) on commit drop;

  rooms_filled := 0;
  for prop_rec in select * from _seed_props order by name loop
    for i in 1..prop_rec.occupied loop
      rooms_filled := rooms_filled + 1;
      fname := fnames[1 + ((rooms_filled * 7)  % array_length(fnames, 1))];
      lname := lnames[1 + ((rooms_filled * 13) % array_length(lnames, 1))];
      full_name := fname || ' ' || lname;
      safe_email := lower(regexp_replace(fname, '\W', '', 'g')) || '.' ||
                    lower(regexp_replace(lname, '[^a-zA-Z0-9]', '', 'g')) ||
                    rooms_filled::text || '@example.com';

      -- Decide rent + freq.
      if prop_rec.letting = 'whole' then
        this_rent := prop_rec.total_rent;
        this_freq := 'monthly';
        this_pdom := pay_days[1 + (rooms_filled % array_length(pay_days, 1))];
        this_pdow := 'Monday';
      else
        this_rent := round(prop_rec.total_rent / greatest(prop_rec.rooms, 1));
        -- Every 4th tenant pays weekly (so ~25% of the book is weekly).
        if (rooms_filled % 4) = 0 then
          this_freq := 'weekly';
          -- Convert monthly rent to weekly equivalent (rent_pcm * 12 / 52)
          this_rent := round(this_rent * 12.0 / 52.0);
          this_pdow := pay_dows[1 + (rooms_filled % array_length(pay_dows, 1))];
          this_pdom := null;
        else
          this_freq := 'monthly';
          this_pdom := pay_days[1 + (rooms_filled % array_length(pay_days, 1))];
          this_pdow := 'Monday';
        end if;
      end if;

      -- Method mix: bank dominates, occasional cash / standing_order.
      this_method := case (rooms_filled % 7)
        when 0 then 'cash'
        when 3 then 'standing_order'
        else        'bank'
      end;

      -- Deposit: 5 weeks of weekly rent or 5 weeks-equivalent of monthly (i.e. roughly 1.15× monthly).
      if this_freq = 'weekly' then
        this_dep := round(this_rent * 5);
      else
        this_dep := round(this_rent * 1.15);
      end if;

      -- Start date offset: spread tenancies across the last 12 months so
      -- tenancy ages look realistic ("how long have they been here?")
      start_offset := 30 + ((rooms_filled * 19) % 330);

      -- ~3% of tenants in arrears (target: 4 across ~140 → 1 in every 35)
      this_status  := 'active';
      this_arrears := 0;
      if (rooms_filled % 35) = 0 then
        this_arrears := this_rent;
      end if;

      -- Identity data — about half of tenants get an ID + selfie photo
      -- (every odd rooms_filled), and about a third also get DOB +
      -- nationality. The rest stay sparse so the demo shows a realistic mix
      -- of "fully onboarded" vs "still missing details" tenants.
      this_notes := null;
      this_dob   := null;
      this_nat   := null;
      if (rooms_filled % 2) = 1 then
        this_notes :=
          E'[ID_PHOTO]: ' || id_photos[1 + (rooms_filled % array_length(id_photos, 1))]
          || E'\n[SELFIE]: ' || selfies[1 + (rooms_filled % array_length(selfies, 1))]
          || E'\nRight to Rent verified on file.';
      elsif (rooms_filled % 3) = 0 then
        -- Selfie-only for another slice — partially onboarded tenants.
        this_notes := E'[SELFIE]: ' || selfies[1 + (rooms_filled % array_length(selfies, 1))];
      end if;
      if (rooms_filled % 3) <> 1 then
        this_nat := nats[1 + (rooms_filled % array_length(nats, 1))];
        -- DOB centred around 1985–2000 (approx) so tenants look 25–40 today.
        this_dob := (make_date(1985, 1, 1) + ((rooms_filled * 73) % 5500))::date;
      end if;

      insert into _seed_tenants
        (tid, pid, pname, rnumber, rtype, rent, freq, pay_dom, pay_dow, method, start_date, is_arrears)
      values
        (gen_random_uuid(), prop_rec.pid, prop_rec.name, i,
         case when prop_rec.letting='whole' then 'Whole Property' when prop_rec.rooms=1 then 'Studio' else 'Single' end,
         this_rent, this_freq, this_pdom, this_pdow, this_method,
         _today - start_offset, this_arrears > 0);

      insert into public.tenants
        (id, org_id, name, property_id, property_name, room_number, room_type, rent, freq,
         pay_day, pay_day_of_month, method, status, arrears, deposit, deposit_status,
         whatsapp, email, start_date, move_in, notes, dob, nationality)
      values
        ((select tid from _seed_tenants where pid = prop_rec.pid and rnumber = i),
         demo_org, full_name, prop_rec.pid, prop_rec.name, i,
         case when prop_rec.letting='whole' then 'Whole Property' when prop_rec.rooms=1 then 'Studio' else 'Single' end,
         this_rent, this_freq, this_pdow, this_pdom, this_method, this_status, this_arrears,
         this_dep, 'held',
         '+44770099' || lpad(rooms_filled::text, 4, '0'),
         safe_email, _today - start_offset, _today - start_offset,
         this_notes, this_dob, this_nat);
    end loop;
  end loop;

  -- ── 8. Historical rent payments — 4 months of paid history ───────────────
  -- For each MONTHLY tenant: 4 paid payments (months -3, -2, -1, 0)
  --                          but the current month is only paid for ~70% of
  --                          tenants; the rest are scheduled or overdue.
  -- For each WEEKLY tenant:  16 paid weekly payments anchored to today, with
  --                          the most recent week scheduled or overdue.
  for ten_rec in select * from _seed_tenants loop
    if ten_rec.freq = 'monthly' then
      -- Months -3, -2, -1: always paid.
      for m in 1..3 loop
        m_due  := (date_trunc('month', _today) - (m || ' months')::interval + ((coalesce(ten_rec.pay_dom,1) - 1) || ' days')::interval)::date;
        m_paid := m_due + (((rooms_filled + m) % 4))::int;  -- paid 0–3 days after due
        insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date, paid_date)
        values (gen_random_uuid(), demo_org, ten_rec.tid, '', ten_rec.pname, ten_rec.rent, 'bank', 'paid', m_due, m_paid);
      end loop;

      -- Current month (m=0):
      m_due := (date_trunc('month', _today) + ((coalesce(ten_rec.pay_dom,1) - 1) || ' days')::interval)::date;
      if ten_rec.is_arrears then
        -- Arrears tenant: due date already passed, status overdue, no paid_date.
        insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date)
        values (gen_random_uuid(), demo_org, ten_rec.tid, '', ten_rec.pname, ten_rec.rent, 'bank', 'overdue',
                least(_today - 5, m_due));
      elsif _today >= m_due then
        -- Due date passed this month — paid for ~85% of non-arrears tenants.
        if (current_paid_count % 7) <> 0 then
          insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date, paid_date)
          values (gen_random_uuid(), demo_org, ten_rec.tid, '', ten_rec.pname, ten_rec.rent, 'bank', 'paid',
                  m_due, m_due + (current_paid_count % 3));
        else
          insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date)
          values (gen_random_uuid(), demo_org, ten_rec.tid, '', ten_rec.pname, ten_rec.rent, 'bank', 'overdue', m_due);
        end if;
      else
        -- Due date hasn't arrived yet — scheduled.
        insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date)
        values (gen_random_uuid(), demo_org, ten_rec.tid, '', ten_rec.pname, ten_rec.rent, 'bank', 'scheduled', m_due);
      end if;
      current_paid_count := current_paid_count + 1;

    else
      -- Weekly tenants: 16 historical paid weeks + current week.
      for w in 1..16 loop
        m_due  := _today - (w * 7);
        m_paid := m_due + ((w % 3))::int;
        insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date, paid_date)
        values (gen_random_uuid(), demo_org, ten_rec.tid, '', ten_rec.pname, ten_rec.rent, 'bank', 'paid', m_due, m_paid);
      end loop;
      -- Current week: arrears or scheduled.
      if ten_rec.is_arrears then
        insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date)
        values (gen_random_uuid(), demo_org, ten_rec.tid, '', ten_rec.pname, ten_rec.rent, 'bank', 'overdue', _today - 4);
      else
        insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date)
        values (gen_random_uuid(), demo_org, ten_rec.tid, '', ten_rec.pname, ten_rec.rent, 'bank', 'scheduled', _today + 3);
      end if;
    end if;
  end loop;

  -- Patch tenant_name on every payment in one shot (avoids per-row sub-selects above)
  update public.payments p set tenant_name = t.name
    from public.tenants t
   where p.org_id = demo_org and p.tenant_id = t.id and (p.tenant_name is null or p.tenant_name = '');

  -- ── 9. Landlord payments — 4 months of paid history per managed property ─
  -- For every property with a landlord_id, generate one landlord_payment per
  -- month for the last 4 months. Months -3..-1 are paid; current month is paid
  -- for ~60% of properties (mix of paid + pending = realistic in-month state).
  for prop_rec in select * from _seed_props where llid is not null and landlord_rent > 0 loop
    for m in 0..3 loop
      m_due   := (date_trunc('month', _today) - (m || ' months')::interval + interval '5 days')::date;
      m_key   := to_char(m_due, 'YYYY-MM');
      m_label := to_char(m_due, 'Mon YYYY');
      if m = 0 then
        -- Current month: 60% paid, 40% pending.
        if ((position(prop_rec.name in (prop_rec.name || prop_rec.area))::int + length(prop_rec.name)) % 5) < 3 then
          insert into public.landlord_payments (id, org_id, landlord_id, landlord_name, property_id, property_name, month_key, month_label, amount, due_date, paid_date, status, method, ref)
          values (gen_random_uuid(), demo_org, prop_rec.llid, prop_rec.llname, prop_rec.pid, prop_rec.name,
                  m_key, m_label, prop_rec.landlord_rent, m_due, least(_today, m_due + 1), 'paid', 'bank',
                  'BACS-' || to_char(_today, 'YYYYMM') || '-' || substr(prop_rec.pid::text, 1, 4));
        else
          insert into public.landlord_payments (id, org_id, landlord_id, landlord_name, property_id, property_name, month_key, month_label, amount, due_date, status, method)
          values (gen_random_uuid(), demo_org, prop_rec.llid, prop_rec.llname, prop_rec.pid, prop_rec.name,
                  m_key, m_label, prop_rec.landlord_rent, m_due, 'pending', 'bank');
        end if;
      else
        -- Past months: all paid, paid_date 1–4 days after due.
        insert into public.landlord_payments (id, org_id, landlord_id, landlord_name, property_id, property_name, month_key, month_label, amount, due_date, paid_date, status, method, ref)
        values (gen_random_uuid(), demo_org, prop_rec.llid, prop_rec.llname, prop_rec.pid, prop_rec.name,
                m_key, m_label, prop_rec.landlord_rent, m_due, m_due + ((m + length(prop_rec.name)) % 4)::int, 'paid', 'bank',
                'BACS-' || m_key || '-' || substr(prop_rec.pid::text, 1, 4));
      end if;
    end loop;
  end loop;

  -- ── 10. Maintenance jobs (~25, mix of statuses) ──────────────────────────
  -- Use a compact list of jobs, distributed across properties via deterministic
  -- modulo so the same demo always produces the same maintenance backlog.
  insert into public.maintenance (id, org_id, property_id, property_name, room_number, issue, category, priority, status, notes, logged_date, scheduled_date, resolved_date, contractor, job_cost)
  select
    gen_random_uuid(), demo_org, sp.pid, sp.name,
    case when row_number() over () % 3 = 0 then ((row_number() over ())::int % greatest(sp.rooms,1)) + 1 else null end,
    issue,
    cat,
    priority,
    status,
    notes,
    logged_date,
    scheduled_date,
    resolved_date,
    contractor,
    job_cost
  from (
    -- 8 open
    values
      ('Leaking shower in en-suite',   '🔧 Plumbing',         'high',   'open',        'Tenant reported dripping overnight.', _today - 2,  _today + 3,  null::date,       null::text,         null::numeric),
      ('Boiler losing pressure',       '🔥 Heating / Boiler',  'high',   'open',        'Pressure dropping daily — needs repair.', _today - 4, _today + 2, null::date, 'Patel Gas Ltd', null::numeric),
      ('Communal light flickering',    '⚡ Electrical',        'medium', 'open',        'Possible new ballast.',                _today - 5,  _today + 8,  null::date,       null,               null::numeric),
      ('Front door lock sticking',     '🔨 General',           'medium', 'open',        'Multiple tenants reporting.',          _today - 1,  _today + 5,  null::date,       null,               null::numeric),
      ('Mould patch in bathroom',      '🔨 General',           'low',    'open',        'Tenant cleaned but reappearing — extractor fan likely.', _today - 6, _today + 12, null::date, null, null::numeric),
      ('Window seal failure',          '🔨 General',           'medium', 'open',        'Single-pane condensation between glass.', _today - 8, _today + 14, null::date, null, null::numeric),
      ('Pest control — mice',          '🐀 Pest',              'high',   'open',        'Sighting in kitchen — call out today.', _today - 1, _today + 1, null::date, 'PestStop UK', null::numeric),
      ('Smoke alarm battery beep',     '⚡ Electrical',        'low',    'open',        'Multiple alarms on hallway run.',      _today,      _today + 6,  null::date,       null,               null::numeric),
      -- 6 in_progress
      ('Annual gas safety certificate','🔥 Heating / Boiler',  'high',   'in_progress', 'Engineer booked.',                     _today - 7,  _today + 1,  null::date,       'Patel Gas Ltd',     null::numeric),
      ('EICR 5-year inspection',       '⚡ Electrical',        'high',   'in_progress', 'Marek booked next week.',              _today - 12, _today + 4,  null::date,       'Marek Plichta',     null::numeric),
      ('Deep clean before turnover',   '🧹 Cleaning',          'medium', 'in_progress', 'BrightCleans booked.',                 _today - 1,  _today + 2,  null::date,       'BrightCleans',      null::numeric),
      ('Damp patch on hall wall',      '🔨 General',           'medium', 'in_progress', 'Plasterer assessing damp source.',     _today - 9,  _today + 5,  null::date,       'Kasia Decor',       null::numeric),
      ('Drain unblocking',             '🔧 Plumbing',          'medium', 'in_progress', 'Steve booked tomorrow.',               _today - 2,  _today + 1,  null::date,       'Steve Riggs',       null::numeric),
      ('Garden cleanup — quarterly',   '🌳 Garden',            'low',    'in_progress', 'Quarterly visit due.',                 _today - 3,  _today + 7,  null::date,       'Green Garden Co',   null::numeric),
      -- 11 resolved (spread across last 4 months)
      ('Fridge replacement',           '🔧 Appliance',         'medium', 'resolved',    'Beko replacement installed.',          _today - 28, _today - 22, _today - 21,      'Handyman Hub',      210),
      ('Toilet flush handle',          '🔧 Plumbing',          'low',    'resolved',    'Replaced under guarantee.',            _today - 36, _today - 33, _today - 33,      'Steve Riggs',       65),
      ('Washing machine fault',        '🔧 Appliance',         'medium', 'resolved',    'Pump replaced.',                       _today - 50, _today - 46, _today - 45,      'Handyman Hub',      140),
      ('Locked-out callout',           '🔨 General',           'high',   'resolved',    'Emergency callout, key cut.',          _today - 38, _today - 38, _today - 38,      'Locksmiths 24/7',   120),
      ('Roof slipped tile',            '🔨 General',           'medium', 'resolved',    'After winter storm.',                  _today - 95, _today - 93, _today - 90,      'Roof Right',        320),
      ('Carpet replacement, hallway',  '🔨 General',           'medium', 'resolved',    'After move-out damage — deposit deduction.', _today - 70, _today - 65, _today - 64, 'Handyman Hub', 380),
      ('Repaint room after turnover',  '🔨 General',           'low',    'resolved',    'Single coat refresh.',                 _today - 42, _today - 38, _today - 36,      'Kasia Decor',       180),
      ('Radiator bleed — cold spots',  '🔥 Heating / Boiler',  'low',    'resolved',    'Bled all rads, topped pressure.',      _today - 80, _today - 78, _today - 78,      'Steve Riggs',       45),
      ('Kitchen tap dripping',         '🔧 Plumbing',          'low',    'resolved',    'Washer replaced.',                     _today - 58, _today - 56, _today - 55,      'Steve Riggs',       45),
      ('Replace oven element',         '🔧 Appliance',         'medium', 'resolved',    'Bottom heating element gone.',         _today - 22, _today - 19, _today - 19,      'Handyman Hub',      95),
      ('Fence panel storm damage',     '🌳 Garden',            'medium', 'resolved',    'Two panels replaced.',                 _today - 102, _today - 99, _today - 97,     'Green Garden Co',   240)
  ) as j(issue, cat, priority, status, notes, logged_date, scheduled_date, resolved_date, contractor, job_cost)
  cross join lateral (
    select pid, name, rooms from _seed_props order by random() limit 1
  ) sp
  ;

  -- ── 11. Recurring expenses ───────────────────────────────────────────────
  insert into public.expenses (id, org_id, type, category, description, amount, freq, recurring, status, start_date, property_id, property_name) values
    (gen_random_uuid(), demo_org, 'property', 'Energy – Gas',          'British Gas — portfolio average',           120, 'monthly', true,  'confirmed', _today - 90, null, ''),
    (gen_random_uuid(), demo_org, 'property', 'Energy – Electric',     'Octopus — communal supply (HMOs)',          145, 'monthly', true,  'confirmed', _today - 85, null, ''),
    (gen_random_uuid(), demo_org, 'property', 'Water',                  'Thames Water + United Utilities',           180, 'monthly', true,  'confirmed', _today - 80, null, ''),
    (gen_random_uuid(), demo_org, 'property', 'Council Tax',           'Council Tax — communal',                     220, 'monthly', true,  'confirmed', _today - 75, null, ''),
    (gen_random_uuid(), demo_org, 'property', 'Internet / Broadband',  'BT / Virgin — portfolio',                    310, 'monthly', true,  'confirmed', _today - 70, null, ''),
    (gen_random_uuid(), demo_org, 'property', 'TV Licence',            'TV Licence × 6 communal areas',               58, 'monthly', true,  'confirmed', _today - 65, null, ''),
    (gen_random_uuid(), demo_org, 'staff',    'Cleaning',              'Weekly cleaner (BrightCleans) — portfolio', 240, 'weekly',  true,  'confirmed', _today - 60, null, ''),
    (gen_random_uuid(), demo_org, 'staff',    'Gardening',             'Quarterly garden — Green Garden Co',         180, 'quarterly', true, 'estimated', _today - 100, null, ''),
    (gen_random_uuid(), demo_org, 'overhead', 'Insurance',             'Landlord insurance — portfolio',             95,  'monthly', true,  'confirmed', _today - 55, null, ''),
    (gen_random_uuid(), demo_org, 'overhead', 'Software & Tools',      'Accountancy software',                       30,  'monthly', true,  'confirmed', _today - 50, null, ''),
    (gen_random_uuid(), demo_org, 'overhead', 'Software & Tools',      'LandlordApp.io',                             89,  'monthly', true,  'confirmed', _today - 45, null, ''),
    (gen_random_uuid(), demo_org, 'overhead', 'Accountancy',           'Quarterly accountancy fee',                  450, 'quarterly', true, 'estimated', _today - 95, null, ''),
    (gen_random_uuid(), demo_org, 'property', 'Compliance',            'Annual Gas Safety + EICR portfolio',         620, 'yearly',  true,  'estimated', _today - 200, null, ''),
    (gen_random_uuid(), demo_org, 'property', 'Maintenance reserve',   'Reactive jobs allowance (avg)',              380, 'monthly', false, 'estimated', _today - 30, null, ''),
    (gen_random_uuid(), demo_org, 'overhead', 'Phone',                 'Business mobile + landline',                 38,  'monthly', true,  'confirmed', _today - 60, null, '');

  -- ── 12. Short-Term-Let / Airbnb income on STR-enabled properties ─────────
  -- Generate 3 historical SA payouts per STR property over the last 4 months.
  for prop_rec in select * from _seed_props where str_enabled = true loop
    for m in 0..3 loop
      m_due := (date_trunc('month', _today) - (m || ' months')::interval + interval '8 days')::date;
      insert into public.payments (id, org_id, property_name, amount, method, status, paid_date, notes)
      values (gen_random_uuid(), demo_org, prop_rec.name,
              case prop_rec.area
                when 'Hammersmith' then 1450
                when 'Peckham'     then 1820
                when 'Oval'        then 1280
                when 'Hulme'       then 720
                else 1100
              end + ((m * 47) % 200),
              'bank', 'paid', m_due, 'Airbnb payout');
    end loop;
  end loop;

  -- ── 13. Tenant documents — signed contracts + ID copies for ~half of
  -- tenants. The dashboard's Tenant Vault renders these from the tenant_docs
  -- table; storage_path is illustrative (no actual file lives in storage,
  -- the Vault preview falls back gracefully when the URL is missing).
  -- Selection: every tenant whose row_number is even gets the contract; every
  -- third tenant additionally gets a passport scan + proof of address.
  begin
    with ranked as (
      select id, name, start_date,
             row_number() over (order by start_date, name) as rn
        from public.tenants
       where org_id = demo_org
    )
    insert into public.tenant_docs (id, tenant_id, name, type, size, storage_path, org_id, uploaded_at)
    select 'demo-doc-agreement-' || r.id::text, r.id::text,
           'Tenancy Agreement — signed.pdf', 'Tenancy Agreement',
           (180 + (r.rn % 30))::text || ' KB',
           demo_org::text || '/' || r.id::text || '/agreement.pdf',
           demo_org, (r.start_date + 1)::timestamptz
      from ranked r where (r.rn % 2) = 0;

    with ranked as (
      select id, name, start_date,
             row_number() over (order by start_date, name) as rn
        from public.tenants
       where org_id = demo_org
    )
    insert into public.tenant_docs (id, tenant_id, name, type, size, storage_path, org_id, uploaded_at)
    select 'demo-doc-passport-' || r.id::text, r.id::text,
           'Right to Rent — passport scan.pdf', 'Passport / ID',
           (480 + (r.rn % 80))::text || ' KB',
           demo_org::text || '/' || r.id::text || '/passport.pdf',
           demo_org, (r.start_date + 2)::timestamptz
      from ranked r where (r.rn % 3) = 0;

    with ranked as (
      select id, name, start_date,
             row_number() over (order by start_date, name) as rn
        from public.tenants
       where org_id = demo_org
    )
    insert into public.tenant_docs (id, tenant_id, name, type, size, storage_path, org_id, uploaded_at)
    select 'demo-doc-poa-' || r.id::text, r.id::text,
           'Proof of Address — utility bill.pdf', 'Proof of Address',
           (90 + (r.rn % 20))::text || ' KB',
           demo_org::text || '/' || r.id::text || '/proof-of-address.pdf',
           demo_org, (r.start_date + 3)::timestamptz
      from ranked r where (r.rn % 4) = 0;
  exception when undefined_table then null;
  end;

  -- Mark "agreement signed" metadata on the same ~half of tenants so the
  -- Profile / Actions tab shows landlord-side signature info without
  -- needing the heavy signature_png / agreement_html columns.
  with ranked as (
    select id, start_date,
           row_number() over (order by start_date, name) as rn
      from public.tenants
     where org_id = demo_org
  )
  update public.tenants t
     set signed_landlord_name  = 'Demo Director',
         signed_landlord_title = 'Director, Demo Properties Ltd',
         signed_landlord_date  = (r.start_date + interval '1 day'),
         signed_agreement_type = 'Assured Shorthold Tenancy'
    from ranked r
   where t.id = r.id and (r.rn % 2) = 0;

  -- ── 14. Property compliance documents — ~half of properties get a stack
  -- of typical HMO compliance certificates (Gas, EICR, EPC, FRA, Licence).
  -- Expiries spread so dashboards highlight a mix of "expiring soon" and
  -- "valid for years". Selection: every odd-row property gets the full stack.
  begin
    with ranked as (
      select id::uuid as pid, name, area,
             row_number() over (order by name) as rn
        from public.properties
       where org_id = demo_org
    ),
    pdocs(rn_mod, suffix, doc_name, doc_type, doc_size, expires_offset, ago_days) as (
      values
        (1, 'gas',     'Gas Safety Certificate.pdf',         'Gas Safety', '220 KB', 60,   45),
        (1, 'eicr',    'EICR — 5-year electrical.pdf',      'EICR',       '480 KB', 1095, 95),
        (1, 'epc',     'EPC — Band C.pdf',                    'EPC',        '180 KB', 1825, 120),
        (1, 'fra',     'Fire Risk Assessment.pdf',            'FRA',        '310 KB', 365,  40),
        (1, 'licence', 'HMO Licence — Council issued.pdf',  'Licence',    '320 KB', 540,  10)
    )
    insert into public.property_docs (id, property_id, name, type, size, expires_at, storage_path, org_id, uploaded_at)
    select
      'demo-pdoc-' || r.pid::text || '-' || pd.suffix,
      r.pid::text,
      pd.doc_name, pd.doc_type, pd.doc_size,
      _today + pd.expires_offset,
      demo_org::text || '/' || r.pid::text || '/' || pd.suffix || '.pdf',
      demo_org,
      (now() - (pd.ago_days || ' days')::interval)
    from ranked r cross join pdocs pd
    where (r.rn % 2) = pd.rn_mod;
  exception when undefined_table then null;
  end;
end
$fn$;

-- Run the seed once now so test/prod see the new data immediately.
select public.refresh_demo_org();

-- Re-create the HOURLY cron schedule (idempotent — safe to re-run).
-- Switched from daily to hourly so visitors always see fresh rent collection
-- data — the daily reset meant the demo looked stale by mid-afternoon UK time.
-- Both old job names are unscheduled so this section is safe to re-run after
-- the daily → hourly cutover.
-- If pg_cron isn't enabled yet, this section is a no-op via the do-block guard.
do $sched$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'refresh_demo_org_daily') then
      perform cron.unschedule('refresh_demo_org_daily');
    end if;
    if exists (select 1 from cron.job where jobname = 'refresh_demo_org_hourly') then
      perform cron.unschedule('refresh_demo_org_hourly');
    end if;
    perform cron.schedule('refresh_demo_org_hourly', '0 * * * *', $sql$select public.refresh_demo_org();$sql$);
  end if;
end
$sched$;

-- Force PostgREST to refresh its schema cache for the new function.
notify pgrst, 'reload schema';
