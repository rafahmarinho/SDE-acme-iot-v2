-- =====================================================================================
-- ACME IoT v2 -- RPC functions
-- Countermeasures: T38 (bound parameters only, no dynamic SQL from user input),
-- T2598 (privileged RPCs not executable by clients), T2600 (result-size limits),
-- T349 / T2602 (audit), T19 (security definer only where needed, fixed search_path)
--
-- Rules followed in every function:
--   * set search_path = ''  and fully qualified names
--   * user input is only ever used as a bound parameter -- there is no EXECUTE with
--     string concatenation anywhere in this schema
--   * list-returning functions clamp their limit to <= 100 rows
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Rate limiting primitive for the API (service role only)
-- -------------------------------------------------------------------------------------
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count  integer;
begin
  if p_key is null or length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.api_rate_limits as rl (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rl.count + 1
  returning rl.count into v_count;

  -- opportunistic cleanup of expired windows
  delete from public.api_rate_limits where window_start < now() - interval '1 day';

  return v_count <= p_limit;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Explicit audit entry from the API (service role only; clients cannot forge audit rows)
-- -------------------------------------------------------------------------------------
create or replace function public.log_audit_event(
  p_org uuid, p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}'::jsonb,
  p_actor uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_action !~ '^[a-z_]+(\.[a-z_]+)+$' then
    raise exception 'invalid audit action' using errcode = '22023';
  end if;
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, metadata)
  values (p_org, coalesce(p_actor, (select auth.uid())), p_action, p_target_type, p_target_id,
          coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Device registration by QR / manual code (T573 support): one-time, hashed, expiring,
-- throttled per user, admin/owner only, room must belong to the same organization.
-- -------------------------------------------------------------------------------------
create or replace function public.claim_device(p_org uuid, p_room uuid, p_code text, p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_code public.device_registration_codes%rowtype;
  v_id   uuid;
begin
  if not public.has_role(p_org, array['owner', 'admin']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- brute-force protection: 10 attempts / 15 min per user
  if not public.consume_rate_limit('claim_device:' || (select auth.uid())::text, 10, 900) then
    raise exception 'too many attempts' using errcode = '54000';
  end if;

  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if not exists (select 1 from public.rooms r where r.id = p_room and r.org_id = p_org) then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  select * into v_code
    from public.device_registration_codes c
   where c.code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
     and c.claimed_at is null
     and c.expires_at > now()
   for update;
  if not found then
    raise exception 'invalid or expired code' using errcode = '22023';  -- same error for every failure
  end if;

  update public.device_registration_codes
     set claimed_at = now(), claimed_org_id = p_org
   where code_hash = v_code.code_hash;

  insert into public.devices (org_id, room_id, type, name, serial_hash)
  values (p_org, p_room, v_code.device_type, trim(p_name), v_code.serial_hash)
  returning id into v_id;

  insert into public.device_state (device_id, org_id) values (v_id, p_org);

  insert into public.events (org_id, kind, device_id, actor_id, payload)
  values (p_org, 'device.registered', v_id, (select auth.uid()), jsonb_build_object('type', v_code.device_type));

  return v_id;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Search (T38): parameters are bound; LIKE metacharacters escaped; enum validated;
-- security invoker so RLS and column grants apply; result capped (T2600)
-- -------------------------------------------------------------------------------------
create or replace function public.search_devices(
  p_org uuid, p_query text default null, p_type text default null, p_limit integer default 50)
returns table (id uuid, org_id uuid, room_id uuid, type text, name text, firmware_version text,
               online boolean, battery_pct integer, last_seen_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select d.id, d.org_id, d.room_id, d.type, d.name, d.firmware_version, d.online, d.battery_pct, d.last_seen_at
    from public.devices d
   where d.org_id = p_org
     and (p_query is null
          or (length(p_query) <= 100
              and d.name ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'))
     and (p_type is null
          or (p_type in ('thermostat', 'smart_plug', 'temperature_sensor', 'humidity_sensor', 'occupancy_sensor')
              and d.type = p_type))
   order by d.name, d.id
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- -------------------------------------------------------------------------------------
-- Team screen: members of an org with their email (members only), capped
-- -------------------------------------------------------------------------------------
create or replace function public.org_members(p_org uuid)
returns table (user_id uuid, role text, display_name text, email text, joined_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member(p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.role, p.display_name, u.email::text, m.created_at
      from public.memberships m
      join auth.users u on u.id = m.user_id
      left join public.profiles p on p.user_id = m.user_id
     where m.org_id = p_org
     order by m.created_at
     limit 500;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Simulation reset (PRD: "reiniciar os dados"): service role only. Removes simulation
-- data for ONE org, keeps audit_log and non-simulation events, records the reset (T349).
-- The API must check owner/admin role before calling it and pass the actor id.
-- -------------------------------------------------------------------------------------
create or replace function public.reset_demo_data(p_org uuid, p_actor uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.memberships m
                 where m.org_id = p_org and m.user_id = p_actor and m.role in ('owner', 'admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform set_config('acme.simulation_reset', 'on', true);

  delete from public.readings        where org_id = p_org;
  delete from public.alerts          where org_id = p_org;
  delete from public.automation_runs where org_id = p_org;
  delete from public.events          where org_id = p_org and is_simulation;
  update public.device_state set desired = '{}'::jsonb, reported = '{}'::jsonb, desired_version = 0, updated_at = now()
   where org_id = p_org;
  update public.devices set online = true, battery_pct = 100, last_seen_at = now()
   where org_id = p_org;

  perform set_config('acme.simulation_reset', 'off', true);

  insert into public.events (org_id, kind, actor_id, payload)
  values (p_org, 'simulation.reset', p_actor, '{}'::jsonb);
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  values (p_org, p_actor, 'simulation.reset', 'organization', p_org::text);
end;
$$;

-- -------------------------------------------------------------------------------------
-- Execute privileges (T2598): nothing is callable by anon; privileged RPCs are
-- service-role only.
-- -------------------------------------------------------------------------------------
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.log_audit_event(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.reset_demo_data(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.claim_device(uuid, uuid, text, text) from public, anon;
revoke execute on function public.search_devices(uuid, text, text, integer) from public, anon;
revoke execute on function public.org_members(uuid) from public, anon;

grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.log_audit_event(uuid, text, text, text, jsonb, uuid) to service_role;
grant execute on function public.reset_demo_data(uuid, uuid) to service_role;
grant execute on function public.claim_device(uuid, uuid, text, text) to authenticated;
grant execute on function public.search_devices(uuid, text, text, integer) to authenticated;
grant execute on function public.org_members(uuid) to authenticated;
