-- =====================================================================================
-- ACME IoT v2 -- Realtime publication and database activity logging
-- Countermeasures: T378 (realtime scoped by RLS), T2602 (database/server activity logs)
-- =====================================================================================

-- Realtime "Postgres Changes" evaluates RLS per subscriber, so members only receive rows of
-- their own organizations. Only tables the UI needs live are published; audit_log,
-- memberships, integrations, consents and rate limits are NOT published.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.device_state, public.readings, public.alerts, public.events, public.firmware_rollouts;
  end if;
end;
$$;

-- pgaudit: log DDL and role/privilege changes at the database level (complements the
-- application audit_log written by triggers in 0001_init.sql). Guarded so local stacks
-- without the extension or privileges do not fail the migration.
do $$
begin
  create extension if not exists pgaudit;
  execute 'alter role postgres set pgaudit.log to ''ddl, role''';
exception when others then
  raise notice 'pgaudit not configured here (%); enable it in the Supabase dashboard', sqlerrm;
end;
$$;
