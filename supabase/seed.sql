-- =====================================================================================
-- ACME IoT v2 -- demo data (local/dev only; never run against production)
-- Two organizations, twenty devices (PRD L43). All people are fictitious (example.com).
--
-- Security notes:
--   * Demo users are created WITHOUT a password (no credentials in source control, T76).
--     Set one locally with "Forgot password" -> open the email in Inbucket
--     (http://localhost:54324), or `supabase auth` admin tooling.
--   * Device serials are stored only as SHA-256 hashes.
-- =====================================================================================

-- ---------- users (fictitious, passwordless) ----------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'olivia.owner@example.com',    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'adam.admin@example.com',      now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'oscar.operator@example.com',  now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'vera.viewer@example.com',     now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'grace.globex@example.com',    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'victor.globex@example.com',   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), null
  from auth.users u
 where u.email like '%@example.com';

-- ---------- organizations, memberships, profiles ----------
insert into public.organizations (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Acme Facilities (Demo)'),
  ('20000000-0000-4000-8000-000000000001', 'Globex Offices (Demo)');

insert into public.memberships (org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'admin'),
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'operator'),
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'viewer'),
  ('20000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'viewer');

insert into public.profiles (user_id, display_name) values
  ('a0000000-0000-4000-8000-000000000001', 'Olivia Owner'),
  ('a0000000-0000-4000-8000-000000000002', 'Adam Admin'),
  ('a0000000-0000-4000-8000-000000000003', 'Oscar Operator'),
  ('a0000000-0000-4000-8000-000000000004', 'Vera Viewer'),
  ('b0000000-0000-4000-8000-000000000001', 'Grace Globex'),
  ('b0000000-0000-4000-8000-000000000002', 'Victor Globex');

insert into public.consents (user_id, purpose, granted, policy_version)
select p.user_id, c.purpose, true, '2026-11'
  from public.profiles p
 cross join (values ('terms'), ('privacy_policy')) as c(purpose);

-- ---------- buildings and rooms ----------
insert into public.buildings (id, org_id, name) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'HQ Tower'),
  ('11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Warehouse North'),
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Globex Campus');

insert into public.rooms (id, org_id, building_id, name) values
  ('11100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Lobby'),
  ('11100000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Conference Room A'),
  ('11100000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'Loading Bay'),
  ('11100000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'Cold Storage'),
  ('21100000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Open Office'),
  ('21100000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Server Room');

-- ---------- 20 devices: 12 in Acme, 8 in Globex ----------
insert into public.devices (id, org_id, room_id, type, name, serial_hash, firmware_version, online, battery_pct, last_seen_at)
select d.id::uuid, d.org_id::uuid, d.room_id::uuid, d.type, d.name,
       encode(extensions.digest('DEMO-SERIAL-' || d.id, 'sha256'), 'hex'),
       '1.0.0', d.online, d.battery, now() - (d.seen_min || ' minutes')::interval
  from (values
    ('d1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000001', 'thermostat',         'Lobby Thermostat',          true,  null, 1),
    ('d1000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000001', 'occupancy_sensor',   'Lobby Occupancy',           true,  88,   1),
    ('d1000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000001', 'smart_plug',         'Lobby Display Plug',        true,  null, 2),
    ('d1000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000002', 'thermostat',         'Conf A Thermostat',         true,  null, 1),
    ('d1000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000002', 'humidity_sensor',    'Conf A Humidity',           true,  64,   3),
    ('d1000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000002', 'occupancy_sensor',   'Conf A Occupancy',          true,  12,   2),
    ('d1000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000003', 'smart_plug',         'Dock Heater Plug',          true,  null, 1),
    ('d1000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000003', 'temperature_sensor', 'Dock Temperature',          false, 41,   95),
    ('d1000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000004', 'temperature_sensor', 'Cold Storage Temp 1',       true,  77,   1),
    ('d1000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000004', 'temperature_sensor', 'Cold Storage Temp 2',       true,  8,    4),
    ('d1000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000004', 'humidity_sensor',    'Cold Storage Humidity',     true,  93,   2),
    ('d1000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000004', 'thermostat',         'Cold Storage Thermostat',   true,  null, 1),
    ('d2000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '21100000-0000-4000-8000-000000000001', 'thermostat',         'Office Thermostat',         true,  null, 1),
    ('d2000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '21100000-0000-4000-8000-000000000001', 'occupancy_sensor',   'Office Occupancy',          true,  70,   1),
    ('d2000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '21100000-0000-4000-8000-000000000001', 'smart_plug',         'Coffee Machine Plug',       true,  null, 1),
    ('d2000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '21100000-0000-4000-8000-000000000001', 'humidity_sensor',    'Office Humidity',           true,  55,   2),
    ('d2000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '21100000-0000-4000-8000-000000000002', 'temperature_sensor', 'Rack Temperature',          true,  81,   1),
    ('d2000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', '21100000-0000-4000-8000-000000000002', 'thermostat',         'Server Room Thermostat',    true,  null, 1),
    ('d2000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', '21100000-0000-4000-8000-000000000002', 'smart_plug',         'Rack Fan Plug',             false, null, 240),
    ('d2000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', '21100000-0000-4000-8000-000000000002', 'humidity_sensor',    'Server Room Humidity',      true,  15,   3)
  ) as d(id, org_id, room_id, type, name, online, battery, seen_min);

-- desired vs reported state
insert into public.device_state (device_id, org_id, desired, reported)
select d.id, d.org_id,
       case d.type when 'thermostat' then '{"setpoint_c": 21.5}'::jsonb
                   when 'smart_plug' then '{"on": true}'::jsonb
                   else '{}'::jsonb end,
       case d.type when 'thermostat' then '{"setpoint_c": 21.0, "temperature_c": 22.3}'::jsonb
                   when 'smart_plug' then '{"on": true, "power_w": 42}'::jsonb
                   when 'temperature_sensor' then '{"temperature_c": 4.2}'::jsonb
                   when 'humidity_sensor' then '{"humidity_pct": 48}'::jsonb
                   else '{"occupancy": 3}'::jsonb end
  from public.devices d;

-- a little telemetry history (simulation data)
insert into public.readings (org_id, device_id, metric, value, recorded_at)
select d.org_id, d.id,
       case d.type when 'humidity_sensor' then 'humidity_pct'
                   when 'occupancy_sensor' then 'occupancy'
                   when 'smart_plug' then 'power_w'
                   else 'temperature_c' end,
       case d.type when 'humidity_sensor' then 45 + (g % 10)
                   when 'occupancy_sensor' then g % 6
                   when 'smart_plug' then 40 + (g % 5)
                   else 20 + (g % 4) * 0.5 end,
       now() - (g * 15 || ' minutes')::interval
  from public.devices d
 cross join generate_series(1, 12) as g;

-- automations (cooldown >= 60 s enforced by constraint)
insert into public.automations (org_id, name, condition, action, cooldown_seconds) values
  ('10000000-0000-4000-8000-000000000001', 'Cold storage too warm',
   '{"device_id":"d1000000-0000-4000-8000-000000000009","metric":"temperature_c","op":">","value":6}',
   '{"type":"notify","severity":"critical"}', 600),
  ('10000000-0000-4000-8000-000000000001', 'Empty conference room eco mode',
   '{"device_id":"d1000000-0000-4000-8000-000000000006","metric":"occupancy","op":"=","value":0}',
   '{"type":"setpoint","device_id":"d1000000-0000-4000-8000-000000000004","setpoint_c":18}', 900),
  ('20000000-0000-4000-8000-000000000001', 'Rack overheating',
   '{"device_id":"d2000000-0000-4000-8000-000000000005","metric":"temperature_c","op":">","value":30}',
   '{"type":"plug","device_id":"d2000000-0000-4000-8000-000000000007","on":true}', 300);

-- alerts
insert into public.alerts (org_id, device_id, severity, message) values
  ('10000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000008', 'warning',  'Device offline for more than 1 hour'),
  ('10000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000010', 'warning',  'Low battery (8%)'),
  ('20000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000007', 'critical', 'Rack fan plug offline'),
  ('20000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000008', 'warning',  'Low battery (15%)');

-- seed events are simulation events (removable by reset_demo_data)
insert into public.events (org_id, kind, device_id, payload, is_simulation)
select d.org_id, 'device.seen', d.id, '{}'::jsonb, true from public.devices d;
