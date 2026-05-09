-- demo_seed_schedule.sql
-- ⚠️  SUPERSEDED by db/demo_seed_v2.sql (38 properties / ~140 tenants, hourly cron).
-- Kept for reference only — re-running this will REGRESS the demo to 5/12.
-- Schedules demo_seed.sql to run daily at 03:00 UTC via pg_cron.
-- Supabase has pg_cron available; you just need to enable the extension once.
--
-- Run on piufcteaqmxemidfdoim AFTER you've verified demo_seed.sql runs cleanly by hand.

-- 1. Enable the extension (Supabase Dashboard → Database → Extensions also works).
create extension if not exists pg_cron;

-- 2. Wrap the seed logic in a function so pg_cron can call it by name.
create or replace function public.refresh_demo_org()
returns void
language plpgsql
security definer
as $fn$
declare
  demo_org uuid := '00000000-0000-0000-0000-00000000d3d0';
  co1 uuid := '00000000-0000-0000-0000-00000000c001';
  ll1 uuid := '00000000-0000-0000-0000-0000000011a1';
  ll2 uuid := '00000000-0000-0000-0000-0000000011a2';
  ll3 uuid := '00000000-0000-0000-0000-0000000011a3';
  p1  uuid := '00000000-0000-0000-0000-0000000000a1';
  p2  uuid := '00000000-0000-0000-0000-0000000000a2';
  p3  uuid := '00000000-0000-0000-0000-0000000000a3';
  p4  uuid := '00000000-0000-0000-0000-0000000000a4';
  p5  uuid := '00000000-0000-0000-0000-0000000000a5';
  _today date := current_date;
begin
  delete from public.landlord_payments where org_id = demo_org;
  delete from public.payments           where org_id = demo_org;
  delete from public.maintenance        where org_id = demo_org;
  delete from public.expenses           where org_id = demo_org;
  begin delete from public.tenant_docs   where org_id = demo_org; exception when undefined_table then null; end;
  begin delete from public.property_docs where org_id = demo_org; exception when undefined_table then null; end;
  delete from public.tenants            where org_id = demo_org;
  delete from public.properties         where org_id = demo_org;
  delete from public.landlords          where org_id = demo_org;
  delete from public.companies          where org_id = demo_org;

  insert into public.organisations (id, name, owner_email, plan, status, billing_override, billing_override_note, stripe_subscription_id, currency, currency_symbol, language, date_format)
  values (demo_org, 'LandlordApp Demo', 'demo@landlordapp.io', 'business', 'active', 'free',
          'Demo account — auto-resets daily', 'manual', 'GBP', '£', 'en-GB', 'DD MMM YYYY')
  on conflict (id) do update set
    name=excluded.name, plan=excluded.plan, status=excluded.status,
    billing_override=excluded.billing_override, billing_override_note=excluded.billing_override_note,
    stripe_subscription_id=excluded.stripe_subscription_id;

  insert into public.companies (id, org_id, name, company_no, director, address, email, phone, color)
  values (co1, demo_org, 'Demo Properties Ltd', '12345678', 'Demo Director',
          '1 Demo Street, London E1 6AN', 'hello@demoproperties.example', '+442073060000', '#6366F1');

  insert into public.landlords (id, org_id, name, phone, email, bank, sort_code, account_no, notes) values
    (ll1, demo_org, 'James Whitfield', '+447700900001', 'james@whitfield.example', 'Barclays',  '20-00-00', '12345678', 'Owns 2 HMOs, prefers monthly BACS.'),
    (ll2, demo_org, 'Priya Shah',      '+447700900002', 'priya@shah.example',      'Santander', '09-01-00', '23456789', 'Single-property landlord, very hands-on.'),
    (ll3, demo_org, 'Marcus Okonkwo',  '+447700900003', 'marcus@okonkwo.example',  'Monzo',     '04-00-04', '34567890', 'Manchester portfolio.');

  insert into public.properties (id, org_id, name, address, postcode, area, type, rooms, occupied, rent, landlord_rent, landlord_id, landlord_name, maps_url, notes, company_id, room_list, ownership_type, letting_type, bedrooms, status, is_str_enabled) values
    (p1, demo_org, '27 Vassall Road',    '27 Vassall Road, London SW9 6TA',    'SW9 6TA',  'Oval',           'HMO',        4,4,3250,1900, ll1,'James Whitfield','https://maps.google.com/?q=27+Vassall+Road','Four-room converted HMO.', co1,
      '[{"n":1,"type":"Single","price":800,"status":"occupied"},{"n":2,"type":"Single","price":825,"status":"occupied"},{"n":3,"type":"Double","price":775,"status":"occupied"},{"n":4,"type":"Double","price":850,"status":"occupied"}]'::jsonb,
      'managed','hmo',null,'active',false),
    (p2, demo_org, '4 Grange Park Road', '4 Grange Park Road, London CR7 8QA', 'CR7 8QA',  'Thornton Heath', 'HMO',        1,1,900,650,  ll2,'Priya Shah',      'https://maps.google.com/?q=4+Grange+Park+Road','Single en-suite studio.', co1,
      '[{"n":1,"type":"Studio","price":900,"status":"occupied"}]'::jsonb,
      'managed','hmo',null,'active',false),
    (p3, demo_org, '22 Elm Grove',       '22 Elm Grove, London SE15 5DB',      'SE15 5DB', 'Peckham',        'HMO',        3,3,2400,1400, ll1,'James Whitfield','https://maps.google.com/?q=22+Elm+Grove','Three-room HMO above shop.', co1,
      '[{"n":1,"type":"Single","price":790,"status":"occupied"},{"n":2,"type":"Single","price":810,"status":"occupied"},{"n":3,"type":"Single","price":800,"status":"occupied"}]'::jsonb,
      'managed','hmo',null,'active',false),
    (p4, demo_org, '31 Vassall Road',    '31 Vassall Road, London SW9 6TA',    'SW9 6TA',  'Oval',           'Single Let', 1,1,1800,0,    null,'',               'https://maps.google.com/?q=31+Vassall+Road','Owned whole-let, hybrid STR.', co1,
      '[{"n":1,"type":"Whole Property","price":1800,"status":"occupied","isWholeProperty":true}]'::jsonb,
      'owned','whole',2,'active',true),
    (p5, demo_org, '9 Argyll Street',    '9 Argyll Street, Manchester M15 1EA','M15 1EA',  'Hulme',          'HMO',        4,3,2325,1800, ll3,'Marcus Okonkwo', 'https://maps.google.com/?q=9+Argyll+Street','Manchester HMO.', co1,
      '[{"n":1,"type":"Single","price":775,"status":"occupied"},{"n":2,"type":"Single","price":775,"status":"occupied"},{"n":3,"type":"Single","price":775,"status":"occupied"},{"n":4,"type":"Single","price":775,"status":"vacant"}]'::jsonb,
      'managed','hmo',null,'active',true);

  insert into public.tenants (id, org_id, name, property_id, property_name, room_number, room_type, rent, freq, pay_day_of_month, method, status, deposit, whatsapp, email, start_date, move_in) values
    (gen_random_uuid(),demo_org,'Alex Morgan',   p1,'27 Vassall Road',1,'Single',800,'monthly',1, 'bank','active',1600,'+447700900101','alex.m@example.com',  _today-120,_today-120),
    (gen_random_uuid(),demo_org,'Sofia Chen',    p1,'27 Vassall Road',2,'Single',825,'monthly',1, 'bank','active',1650,'+447700900102','sofia.c@example.com', _today-85, _today-85),
    (gen_random_uuid(),demo_org,'Daniel Reyes',  p1,'27 Vassall Road',3,'Double',775,'monthly',15,'bank','active',1550,'+447700900103','d.reyes@example.com', _today-60, _today-60),
    (gen_random_uuid(),demo_org,'Emma Becker',   p1,'27 Vassall Road',4,'Double',850,'monthly',1, 'bank','active',1700,'+447700900104','emma.b@example.com',  _today-30, _today-30),
    (gen_random_uuid(),demo_org,'Rajiv Patel',   p2,'4 Grange Park Road',1,'Studio',900,'monthly',1,'bank','active',1800,'+447700900105','r.patel@example.com', _today-200,_today-200),
    (gen_random_uuid(),demo_org,'Nora Vasquez',  p3,'22 Elm Grove',1,'Single',790,'monthly',1, 'bank','active',1580,'+447700900106','nora.v@example.com',  _today-140,_today-140),
    (gen_random_uuid(),demo_org,'Oliver Tan',    p3,'22 Elm Grove',2,'Single',810,'monthly',15,'cash','active',1620,'+447700900107','o.tan@example.com',   _today-95, _today-95),
    (gen_random_uuid(),demo_org,'Yasmin Ali',    p3,'22 Elm Grove',3,'Single',800,'monthly',1, 'bank','active',1600,'+447700900108','y.ali@example.com',   _today-45, _today-45),
    (gen_random_uuid(),demo_org,'Harry Jensen',  p4,'31 Vassall Road',1,'Whole Property',1800,'monthly',1,'bank','active',3600,'+447700900109','harry.j@example.com', _today-300,_today-300),
    (gen_random_uuid(),demo_org,'Lena Costa',    p5,'9 Argyll Street',1,'Single',775,'monthly',1, 'bank','active',1550,'+447700900110','lena.c@example.com',  _today-110,_today-110),
    (gen_random_uuid(),demo_org,'Finn O''Brien', p5,'9 Argyll Street',2,'Single',775,'monthly',15,'bank','active',1550,'+447700900111','finn.o@example.com',  _today-65, _today-65),
    (gen_random_uuid(),demo_org,'Aiko Tanaka',   p5,'9 Argyll Street',3,'Single',775,'monthly',1, 'bank','active',1550,'+447700900112','aiko.t@example.com',  _today-20, _today-20);

  insert into public.maintenance (id, org_id, property_id, property_name, room_number, issue, category, priority, status, notes, logged_date, scheduled_date) values
    (gen_random_uuid(),demo_org,p1,'27 Vassall Road',3,   'Leaking shower in Room 3',    '🔧 Plumbing',         'high',  'open',        'Tenant reported dripping overnight.', _today-2,_today+3),
    (gen_random_uuid(),demo_org,p1,'27 Vassall Road',null,'Annual Gas Safety Certificate','🔥 Heating / Boiler', 'high',  'in_progress', 'Certified engineer booked.',          _today-7,_today+1),
    (gen_random_uuid(),demo_org,p3,'22 Elm Grove',null,   'Communal light flickering',    '⚡ Electrical',        'medium','open',        'May need new ballast.',               _today-5,_today+10),
    (gen_random_uuid(),demo_org,p4,'31 Vassall Road',null,'Deep clean before turnover',   '🔨 General',           'low',   'open',        'Airbnb turnover clean.',              _today-1,_today+14),
    (gen_random_uuid(),demo_org,p5,'9 Argyll Street',4,   'Fridge replacement',           '🔧 Appliance',         'medium','resolved',    'Beko replacement installed.',         _today-28,_today-20);

  insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date, paid_date, income_source)
  select gen_random_uuid(), demo_org, t.id, t.name, t.property_name, t.rent, t.method, 'paid', _today-15, _today-14, 'rent'
  from public.tenants t where t.org_id = demo_org;

  insert into public.payments (id, org_id, tenant_id, tenant_name, property_name, amount, method, status, due_date, income_source)
  select gen_random_uuid(), demo_org, t.id, t.name, t.property_name, t.rent, t.method,
         case when t.name = 'Oliver Tan' then 'overdue' else 'scheduled' end,
         case when t.name = 'Oliver Tan' then _today-3 else _today+15 end,
         'rent'
  from public.tenants t where t.org_id = demo_org;

  insert into public.expenses (id, org_id, type, category, description, amount, freq, recurring, status, start_date, property_id, property_name) values
    (gen_random_uuid(),demo_org,'property','Energy – Gas',       'British Gas – 27 Vassall',   120,'monthly',true, 'confirmed',_today-5,  p1,'27 Vassall Road'),
    (gen_random_uuid(),demo_org,'property','Water',              'Thames Water – Elm Grove',   45, 'monthly',true, 'confirmed',_today-10, p3,'22 Elm Grove'),
    (gen_random_uuid(),demo_org,'property','Internet / Broadband','BT – Argyll Street',        55, 'monthly',true, 'confirmed',_today-7,  p5,'9 Argyll Street'),
    (gen_random_uuid(),demo_org,'staff',   'Cleaning',           'Weekly cleaner (portfolio)', 200,'weekly', true, 'estimated',_today-3,  null,''),
    (gen_random_uuid(),demo_org,'overhead','Software & Tools',   'Accountancy software',       30, 'monthly',true, 'confirmed',_today-12, null,'');

  insert into public.payments (id, org_id, property_name, amount, method, status, paid_date, income_source, period_start, period_end, notes) values
    (gen_random_uuid(),demo_org,'31 Vassall Road',1120,'bank','paid',_today-8,'airbnb',date_trunc('month',_today)::date,(date_trunc('month',_today)+interval '14 days')::date,'Airbnb payout — first half of month.');
end
$fn$;

-- 3. Remove any previous schedule to keep things idempotent, then create a fresh one.
select cron.unschedule('refresh_demo_org_daily') where exists (select 1 from cron.job where jobname='refresh_demo_org_daily');
select cron.schedule('refresh_demo_org_daily', '0 3 * * *', $$select public.refresh_demo_org();$$);

-- 4. Verify:
-- select * from cron.job;                         -- should show refresh_demo_org_daily at '0 3 * * *'
-- select public.refresh_demo_org();               -- run on demand any time to test
-- select count(*) from public.properties where org_id = '00000000-0000-0000-0000-00000000d3d0';
