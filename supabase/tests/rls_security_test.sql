-- =====================================================================================
-- ACME IoT v2 -- database security tests (pgTAP). Run with: supabase test db
-- Requires seed.sql. Covers T378 (cross-org denial), T2598 (column/RPC privileges),
-- T349 (append-only events/audit), T19 (anon has nothing), T38 (search injection), T2600 (limits)
-- =====================================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- ---------- T19: anon has no table privileges, every table has RLS ----------
select is(
  (select count(*)::int from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'),
  0, 'anon has no privileges on public tables');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'RLS enabled on every public table');

-- ---------- T2598: secret columns and privileged RPCs ----------
select ok(not has_column_privilege('authenticated', 'public.devices', 'serial_hash', 'select'),
  'authenticated cannot select devices.serial_hash');
select ok(not has_column_privilege('authenticated', 'public.firmware_releases', 'storage_path', 'select'),
  'authenticated cannot select firmware_releases.storage_path');
select ok(not has_table_privilege('authenticated', 'public.device_registration_codes', 'select'),
  'registration codes not readable by clients');
select ok(not has_function_privilege('authenticated', 'public.reset_demo_data(uuid, uuid)', 'execute'),
  'reset_demo_data not executable by clients');
select ok(not has_function_privilege('authenticated', 'public.log_audit_event(uuid, text, text, text, jsonb, uuid)', 'execute'),
  'log_audit_event not executable by clients');
select ok(not has_function_privilege('authenticated', 'public.consume_rate_limit(text, integer, integer)', 'execute'),
  'consume_rate_limit not executable by clients');

-- ---------- act as Vera (viewer, Acme) ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

-- T378: cross-org reads return nothing
-- (count(id), not count(*): devices only has column-level SELECT grants)
select is((select count(id)::int from public.devices where org_id = '20000000-0000-4000-8000-000000000001'),
  0, 'viewer cannot see devices of another org');
select is((select count(id)::int from public.events where org_id = '20000000-0000-4000-8000-000000000001'),
  0, 'viewer cannot see events of another org');
select is((select count(id)::int from public.devices), 12, 'viewer sees own org devices only');

-- viewer cannot control devices (update silently affects 0 rows under RLS)
with u as (
  update public.device_state set desired = '{"on": false}'::jsonb
   where device_id = 'd1000000-0000-4000-8000-000000000003' returning 1)
select is((select count(*)::int from u), 0, 'viewer cannot change desired state');

-- viewer cannot read audit log
select is((select count(*)::int from public.audit_log), 0, 'viewer cannot read audit_log');

-- T38: injection payloads in search are treated as data
select is((select count(*)::int from public.search_devices('10000000-0000-4000-8000-000000000001', $$' or 1=1 --$$)),
  0, 'SQL injection payload in search returns no rows');
select is((select count(*)::int from public.search_devices('10000000-0000-4000-8000-000000000001', '%')),
  0, 'LIKE wildcard is escaped');
-- T2600: limit clamped
select is((select count(*)::int from public.search_devices('10000000-0000-4000-8000-000000000001', null, null, 100000)),
  12, 'search limit clamped (<= 100, org has 12)');
-- cross-org search
select is((select count(*)::int from public.search_devices('20000000-0000-4000-8000-000000000001')),
  0, 'search cannot read another org');

-- ---------- act as Oscar (operator, Acme) ----------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

-- T378: operator cannot control a device in another org
with u as (
  update public.device_state set desired = '{"on": false}'::jsonb
   where device_id = 'd2000000-0000-4000-8000-000000000003' returning 1)
select is((select count(*)::int from u), 0, 'operator cannot control another org device');

-- T349: events and audit_log are append-only
select throws_ok(
  $$ delete from public.events where org_id = '10000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'events cannot be deleted by clients');
select throws_ok(
  $$ update public.audit_log set action = 'x.y' $$,
  '42501', null, 'audit_log cannot be updated by clients');

select * from finish();
rollback;
