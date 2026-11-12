-- =====================================================================================
-- ACME IoT v2 -- core schema, row level security, privileges, audit and immutability
-- Countermeasures: T19 (least-privilege DB access), T378 (per-object authorization),
-- T2598 (query/column-level access control), T349 (append-only audit), T2602 (activity logging)
-- Contract: docs/security-contract.md section 1
-- =====================================================================================

create extension if not exists pgcrypto with schema extensions;

-- -------------------------------------------------------------------------------------
-- 0. Default privileges: nothing is reachable by anon/authenticated unless granted below
-- -------------------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- 1. Tenancy
-- -------------------------------------------------------------------------------------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Authorization helpers (security definer so policies do not recurse into memberships RLS)
create or replace function public.has_role(p_org uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create or replace function public.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_role(p_org, array['owner', 'admin', 'operator', 'viewer']);
$$;

create or replace function public.shares_org(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships me
    join public.memberships other on other.org_id = me.org_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user
  );
$$;

create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(display_name) between 1 and 80),
  locale       text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  updated_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- 2. Places and devices
-- -------------------------------------------------------------------------------------
create table public.buildings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index buildings_org_idx on public.buildings (org_id);

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 120),
  created_at  timestamptz not null default now()
);
create index rooms_org_idx on public.rooms (org_id, building_id);

create table public.devices (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  room_id          uuid references public.rooms(id) on delete set null,
  type             text not null check (type in ('thermostat', 'smart_plug', 'temperature_sensor',
                                                 'humidity_sensor', 'occupancy_sensor')),
  name             text not null check (length(trim(name)) between 1 and 120),
  serial_hash      text not null check (serial_hash ~ '^[0-9a-f]{64}$'),   -- never the raw serial
  firmware_version text not null default '1.0.0' check (firmware_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  online           boolean not null default true,
  battery_pct      integer check (battery_pct between 0 and 100),
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index devices_org_idx on public.devices (org_id, room_id);

-- One-time registration codes printed on QR labels; only hashes are stored (T50/T573 support)
create table public.device_registration_codes (
  code_hash      text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  device_type    text not null check (device_type in ('thermostat', 'smart_plug', 'temperature_sensor',
                                                      'humidity_sensor', 'occupancy_sensor')),
  serial_hash    text not null check (serial_hash ~ '^[0-9a-f]{64}$'),
  expires_at     timestamptz not null,
  claimed_at     timestamptz,
  claimed_org_id uuid references public.organizations(id) on delete set null
);

create table public.device_state (
  device_id       uuid primary key references public.devices(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  desired         jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(desired) = 'object' and pg_column_size(desired) < 2048),
  reported        jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(reported) = 'object' and pg_column_size(reported) < 4096),
  desired_version integer not null default 0 check (desired_version >= 0),
  updated_at      timestamptz not null default now()
);
create index device_state_org_idx on public.device_state (org_id);

create table public.readings (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  device_id   uuid not null references public.devices(id) on delete cascade,
  metric      text not null check (metric in ('temperature_c', 'humidity_pct', 'occupancy', 'power_w', 'setpoint_c')),
  value       numeric not null,
  recorded_at timestamptz not null default now()
);
create index readings_device_time_idx on public.readings (device_id, recorded_at desc);
create index readings_org_time_idx on public.readings (org_id, recorded_at desc);

-- -------------------------------------------------------------------------------------
-- 3. Automations, alerts, events
-- -------------------------------------------------------------------------------------
create table public.automations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  name             text not null check (length(trim(name)) between 1 and 120),
  condition        jsonb not null check (jsonb_typeof(condition) = 'object' and pg_column_size(condition) < 2048),
  action           jsonb not null check (jsonb_typeof(action) = 'object' and pg_column_size(action) < 2048),
  cooldown_seconds integer not null default 300 check (cooldown_seconds >= 60),
  enabled          boolean not null default true,
  last_run_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index automations_org_idx on public.automations (org_id);

create table public.automation_runs (
  id            bigint generated always as identity primary key,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  status        text not null check (status in ('succeeded', 'skipped_cooldown', 'failed')),
  detail        jsonb not null default '{}'::jsonb check (pg_column_size(detail) < 4096),
  ran_at        timestamptz not null default now()
);
create index automation_runs_org_idx on public.automation_runs (org_id, ran_at desc);

create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  device_id       uuid references public.devices(id) on delete cascade,
  severity        text not null check (severity in ('info', 'warning', 'critical')),
  message         text not null check (length(message) between 1 and 500),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index alerts_org_idx on public.alerts (org_id, created_at desc);

create table public.events (
  id            bigint generated always as identity primary key,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  kind          text not null check (kind ~ '^[a-z_]+(\.[a-z_]+)+$' and length(kind) <= 64),
  device_id     uuid,                         -- no FK: history survives device deletion (append-only)
  actor_id      uuid,                         -- no FK: history survives user deletion
  payload       jsonb not null default '{}'::jsonb check (pg_column_size(payload) < 8192),
  is_simulation boolean not null default false,
  created_at    timestamptz not null default now()
);
create index events_org_time_idx on public.events (org_id, created_at desc);

-- -------------------------------------------------------------------------------------
-- 4. Firmware
-- -------------------------------------------------------------------------------------
create table public.firmware_releases (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  device_type  text not null check (device_type in ('thermostat', 'smart_plug', 'temperature_sensor',
                                                    'humidity_sensor', 'occupancy_sensor')),
  version      text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  storage_path text not null check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.bin$'),  -- server-generated
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  signature    text not null check (length(signature) between 80 and 120),                -- base64 Ed25519
  key_id       text not null check (length(key_id) between 1 and 64),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (org_id, device_type, version)
);

create table public.firmware_rollouts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  release_id       uuid not null references public.firmware_releases(id) on delete cascade,
  device_id        uuid not null references public.devices(id) on delete cascade,
  status           text not null default 'pending'
                   check (status in ('pending', 'downloading', 'installing', 'succeeded', 'failed', 'rolled_back')),
  progress         integer not null default 0 check (progress between 0 and 100),
  previous_version text check (previous_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  updated_at       timestamptz not null default now()
);
create index firmware_rollouts_org_idx on public.firmware_rollouts (org_id, updated_at desc);

-- -------------------------------------------------------------------------------------
-- 5. Integrations (simulated); no secrets stored here (secrets live in Vercel env)
-- -------------------------------------------------------------------------------------
create table public.integrations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  kind        text not null check (kind in ('webhook', 'bms', 'ticketing', 'energy')),
  name        text not null check (length(trim(name)) between 1 and 120),
  target_host text not null check (target_host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
                                   and length(target_host) <= 253),
  enabled     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index integrations_org_idx on public.integrations (org_id);

-- -------------------------------------------------------------------------------------
-- 6. Audit log, consents, rate limits
-- -------------------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid,                         -- no FK: audit survives organization deletion
  actor_id    uuid,                         -- no FK: audit survives user deletion
  action      text not null check (length(action) <= 64),
  target_type text not null check (length(target_type) <= 64),
  target_id   text check (length(target_id) <= 128),
  metadata    jsonb not null default '{}'::jsonb check (pg_column_size(metadata) < 4096),
  created_at  timestamptz not null default now()
);
create index audit_log_org_time_idx on public.audit_log (org_id, created_at desc);

create table public.consents (
  user_id        uuid not null references auth.users(id) on delete cascade,
  purpose        text not null check (purpose in ('terms', 'privacy_policy', 'occupancy_analytics',
                                                  'product_emails', 'diagnostics')),
  granted        boolean not null,
  policy_version text not null check (length(policy_version) between 1 and 32),
  updated_at     timestamptz not null default now(),
  primary key (user_id, purpose)
);

create table public.api_rate_limits (
  key          text not null check (length(key) <= 200),
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);

-- -------------------------------------------------------------------------------------
-- 7. Immutability guards (T349): events and audit_log are append-only
-- -------------------------------------------------------------------------------------
create or replace function public.events_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Only simulation events may be removed, and only inside public.reset_demo_data()
  if tg_op = 'DELETE' then
    if old.is_simulation and coalesce(current_setting('acme.simulation_reset', true), '') = 'on' then
      return old;
    end if;
    -- organization itself is being deleted (FK cascade): allow the cascade
    if not exists (select 1 from public.organizations o where o.id = old.org_id) then
      return old;
    end if;
  end if;
  raise exception 'events are append-only' using errcode = '42501';
end;
$$;

create trigger events_immutable
  before update or delete on public.events
  for each row execute function public.events_guard();

create or replace function public.audit_log_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.audit_log_guard();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_guard();
create trigger events_no_truncate
  before truncate on public.events
  for each statement execute function public.audit_log_guard();

-- -------------------------------------------------------------------------------------
-- 8. Activity logging (T2602): data-change audit with actor, org, target, changed columns.
--    Values are NOT copied into the audit row (no PII/secrets in logs).
-- -------------------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row     jsonb;
  v_old     jsonb;
  v_changed text[] := '{}';
  v_org     uuid;
  v_meta    jsonb;
begin
  if coalesce(current_setting('acme.simulation_reset', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    select coalesce(array_agg(k order by k), '{}')
      into v_changed
      from jsonb_object_keys(v_row) as k
     where v_row -> k is distinct from v_old -> k;
  end if;

  v_org := case when tg_table_name = 'organizations'
                then (v_row ->> 'id')::uuid
                else (v_row ->> 'org_id')::uuid end;

  v_meta := jsonb_build_object('changed_columns', to_jsonb(v_changed));
  if tg_table_name = 'memberships' then
    v_meta := v_meta || jsonb_build_object('user_id', v_row ->> 'user_id', 'role', v_row ->> 'role');
  elsif tg_table_name = 'firmware_rollouts' then
    v_meta := v_meta || jsonb_build_object('status', v_row ->> 'status', 'release_id', v_row ->> 'release_id');
  end if;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, metadata)
  values (v_org, (select auth.uid()), tg_table_name || '.' || lower(tg_op), tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'device_id', v_row ->> 'user_id'), v_meta);
  return null;
end;
$$;

create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function public.audit_row_change();
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function public.audit_row_change();
create trigger buildings_audit after insert or update or delete on public.buildings
  for each row execute function public.audit_row_change();
create trigger rooms_audit after insert or update or delete on public.rooms
  for each row execute function public.audit_row_change();
create trigger devices_audit after insert or delete or update of name, room_id, firmware_version on public.devices
  for each row execute function public.audit_row_change();
create trigger automations_audit after insert or update or delete on public.automations
  for each row execute function public.audit_row_change();
create trigger integrations_audit after insert or update or delete on public.integrations
  for each row execute function public.audit_row_change();
create trigger firmware_releases_audit after insert or update or delete on public.firmware_releases
  for each row execute function public.audit_row_change();
create trigger firmware_rollouts_audit after insert or update of status on public.firmware_rollouts
  for each row execute function public.audit_row_change();

-- Control commands (desired state changes) are recorded as events (T349)
create or replace function public.device_state_command_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('acme.simulation_reset', true), '') = 'on' then
    return null;
  end if;
  if new.desired is distinct from old.desired then
    insert into public.events (org_id, kind, device_id, actor_id, payload)
    values (new.org_id, 'device.command', new.device_id, (select auth.uid()),
            jsonb_build_object('desired', new.desired, 'desired_version', new.desired_version));
  end if;
  return null;
end;
$$;

create trigger device_state_command_events after update of desired on public.device_state
  for each row execute function public.device_state_command_event();

-- Never leave an organization without an owner
create or replace function public.guard_last_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- organization deletion cascades its memberships: nothing to protect
  if not exists (select 1 from public.organizations o where o.id = old.org_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (select 1 from public.memberships m
                   where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id) then
      raise exception 'organization must keep at least one owner' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger memberships_last_owner before update or delete on public.memberships
  for each row execute function public.guard_last_owner();

-- -------------------------------------------------------------------------------------
-- 9. Row level security (T378): enabled on EVERY table, one policy per operation
-- -------------------------------------------------------------------------------------
alter table public.organizations             enable row level security;
alter table public.memberships               enable row level security;
alter table public.profiles                  enable row level security;
alter table public.buildings                 enable row level security;
alter table public.rooms                     enable row level security;
alter table public.devices                   enable row level security;
alter table public.device_registration_codes enable row level security;  -- no client policies
alter table public.device_state              enable row level security;
alter table public.readings                  enable row level security;
alter table public.automations               enable row level security;
alter table public.automation_runs           enable row level security;
alter table public.alerts                    enable row level security;
alter table public.events                    enable row level security;
alter table public.firmware_releases         enable row level security;
alter table public.firmware_rollouts         enable row level security;
alter table public.integrations              enable row level security;
alter table public.audit_log                 enable row level security;
alter table public.consents                  enable row level security;
alter table public.api_rate_limits           enable row level security;  -- no client policies

-- organizations: created by the API (service role) together with the owner membership
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_role(id, array['owner'])) with check (public.has_role(id, array['owner']));

-- memberships: admins manage non-owner members; only owners manage owners
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_member(org_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (public.has_role(org_id, array['owner'])
              or (public.has_role(org_id, array['admin']) and role in ('admin', 'operator', 'viewer')));
create policy memberships_update on public.memberships for update to authenticated
  using (public.has_role(org_id, array['owner'])
         or (public.has_role(org_id, array['admin']) and role <> 'owner'))
  with check (public.has_role(org_id, array['owner'])
              or (public.has_role(org_id, array['admin']) and role <> 'owner'));
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.has_role(org_id, array['owner'])
         or (public.has_role(org_id, array['admin']) and role <> 'owner'));

-- profiles: own row writable; visible to people sharing an org
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_org(user_id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- buildings / rooms: members read, admins write
create policy buildings_select on public.buildings for select to authenticated using (public.is_member(org_id));
create policy buildings_insert on public.buildings for insert to authenticated
  with check (public.has_role(org_id, array['owner', 'admin']));
create policy buildings_update on public.buildings for update to authenticated
  using (public.has_role(org_id, array['owner', 'admin'])) with check (public.has_role(org_id, array['owner', 'admin']));
create policy buildings_delete on public.buildings for delete to authenticated
  using (public.has_role(org_id, array['owner', 'admin']));

create policy rooms_select on public.rooms for select to authenticated using (public.is_member(org_id));
create policy rooms_insert on public.rooms for insert to authenticated
  with check (public.has_role(org_id, array['owner', 'admin'])
              and exists (select 1 from public.buildings b where b.id = building_id and b.org_id = rooms.org_id));
create policy rooms_update on public.rooms for update to authenticated
  using (public.has_role(org_id, array['owner', 'admin']))
  with check (public.has_role(org_id, array['owner', 'admin'])
              and exists (select 1 from public.buildings b where b.id = building_id and b.org_id = rooms.org_id));
create policy rooms_delete on public.rooms for delete to authenticated
  using (public.has_role(org_id, array['owner', 'admin']));

-- devices: inserted only through public.claim_device(); admins rename/move/delete
create policy devices_select on public.devices for select to authenticated using (public.is_member(org_id));
create policy devices_update on public.devices for update to authenticated
  using (public.has_role(org_id, array['owner', 'admin']))
  with check (public.has_role(org_id, array['owner', 'admin'])
              and (room_id is null or exists (select 1 from public.rooms r where r.id = room_id and r.org_id = devices.org_id)));
create policy devices_delete on public.devices for delete to authenticated
  using (public.has_role(org_id, array['owner', 'admin']));

-- device_state: members read; operators+ change the desired state (reported is service-role only)
create policy device_state_select on public.device_state for select to authenticated using (public.is_member(org_id));
create policy device_state_update on public.device_state for update to authenticated
  using (public.has_role(org_id, array['owner', 'admin', 'operator']))
  with check (public.has_role(org_id, array['owner', 'admin', 'operator']));

-- telemetry and history: read-only for members, written by the API/simulator (service role)
create policy readings_select on public.readings for select to authenticated using (public.is_member(org_id));
create policy automation_runs_select on public.automation_runs for select to authenticated using (public.is_member(org_id));
create policy events_select on public.events for select to authenticated using (public.is_member(org_id));
create policy firmware_releases_select on public.firmware_releases for select to authenticated using (public.is_member(org_id));
create policy firmware_rollouts_select on public.firmware_rollouts for select to authenticated using (public.is_member(org_id));

-- automations: members read, admins manage
create policy automations_select on public.automations for select to authenticated using (public.is_member(org_id));
create policy automations_insert on public.automations for insert to authenticated
  with check (public.has_role(org_id, array['owner', 'admin']));
create policy automations_update on public.automations for update to authenticated
  using (public.has_role(org_id, array['owner', 'admin'])) with check (public.has_role(org_id, array['owner', 'admin']));
create policy automations_delete on public.automations for delete to authenticated
  using (public.has_role(org_id, array['owner', 'admin']));

-- alerts: members read, operators+ acknowledge
create policy alerts_select on public.alerts for select to authenticated using (public.is_member(org_id));
create policy alerts_update on public.alerts for update to authenticated
  using (public.has_role(org_id, array['owner', 'admin', 'operator']))
  with check (public.has_role(org_id, array['owner', 'admin', 'operator'])
              and (acknowledged_by is null or acknowledged_by = (select auth.uid())));

-- integrations: admins only (configuration surface)
create policy integrations_select on public.integrations for select to authenticated
  using (public.has_role(org_id, array['owner', 'admin']));
create policy integrations_insert on public.integrations for insert to authenticated
  with check (public.has_role(org_id, array['owner', 'admin']));
create policy integrations_update on public.integrations for update to authenticated
  using (public.has_role(org_id, array['owner', 'admin'])) with check (public.has_role(org_id, array['owner', 'admin']));
create policy integrations_delete on public.integrations for delete to authenticated
  using (public.has_role(org_id, array['owner', 'admin']));

-- audit_log: owners/admins read; nobody writes directly (triggers / log_audit_event only)
create policy audit_log_select on public.audit_log for select to authenticated
  using (org_id is not null and public.has_role(org_id, array['owner', 'admin']));

-- consents: each user manages only their own consent records
create policy consents_select on public.consents for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert on public.consents for insert to authenticated with check (user_id = (select auth.uid()));
create policy consents_update on public.consents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- -------------------------------------------------------------------------------------
-- 10. Privileges (T19 / T2598): anon gets nothing; authenticated gets explicit
--     table/column grants (RLS still applies); secret columns are never granted.
-- -------------------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;

grant select, delete on public.memberships to authenticated;
grant insert (org_id, user_id, role) on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;

grant select on public.profiles to authenticated;
grant insert (user_id, display_name, locale) on public.profiles to authenticated;
grant update (display_name, locale, updated_at) on public.profiles to authenticated;

grant select, delete on public.buildings to authenticated;
grant insert (org_id, name) on public.buildings to authenticated;
grant update (name) on public.buildings to authenticated;

grant select, delete on public.rooms to authenticated;
grant insert (org_id, building_id, name) on public.rooms to authenticated;
grant update (name, building_id) on public.rooms to authenticated;

-- devices: serial_hash is NOT selectable by clients
grant select (id, org_id, room_id, type, name, firmware_version, online, battery_pct, last_seen_at, created_at)
  on public.devices to authenticated;
grant update (name, room_id) on public.devices to authenticated;
grant delete on public.devices to authenticated;

grant select on public.device_state to authenticated;
grant update (desired, desired_version, updated_at) on public.device_state to authenticated;

grant select on public.readings to authenticated;
grant select on public.automation_runs to authenticated;
grant select on public.events to authenticated;

grant select, delete on public.automations to authenticated;
grant insert (org_id, name, condition, action, cooldown_seconds, enabled) on public.automations to authenticated;
grant update (name, condition, action, cooldown_seconds, enabled) on public.automations to authenticated;

grant select on public.alerts to authenticated;
grant update (acknowledged_at, acknowledged_by) on public.alerts to authenticated;

-- firmware: storage_path is server-internal (T50); signature/sha256 visible for verification
grant select (id, org_id, device_type, version, sha256, signature, key_id, created_by, created_at)
  on public.firmware_releases to authenticated;
grant select on public.firmware_rollouts to authenticated;

grant select, delete on public.integrations to authenticated;
grant insert (org_id, kind, name, target_host, enabled) on public.integrations to authenticated;
grant update (name, target_host, enabled) on public.integrations to authenticated;

grant select on public.audit_log to authenticated;

grant select on public.consents to authenticated;
grant insert (user_id, purpose, granted, policy_version) on public.consents to authenticated;
grant update (granted, policy_version, updated_at) on public.consents to authenticated;

-- device_registration_codes, api_rate_limits: no client privileges at all
-- service_role (server-only key, Vercel env) keeps full access for API jobs
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Helper functions used inside RLS policies must be executable by authenticated
grant execute on function public.has_role(uuid, text[]) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.shares_org(uuid) to authenticated;
