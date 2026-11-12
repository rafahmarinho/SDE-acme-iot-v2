-- =====================================================================================
-- ACME IoT v2 -- Storage buckets and policies
-- Countermeasures: T214 (protect confidential files), T50 (indirect object references)
--
-- * Every bucket is PRIVATE (public = false). There are no public URLs.
-- * firmware: NO client policies at all. Only the API (service role) uploads objects at
--   server-generated paths "{org_id}/{release_id}.bin" and hands out short-lived signed
--   URLs (<= 300 s) after an RLS-checked lookup of firmware_releases by id.
-- * avatars: path "{user_id}/{uuid}.{png|jpg}"; a user writes only their own folder and
--   can read avatars of people who share an organization with them.
-- * Size and MIME type are restricted per bucket.
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('firmware', 'firmware', false, 33554432, array['application/octet-stream']),      -- 32 MiB
  ('avatars',  'avatars',  false, 2097152,  array['image/png', 'image/jpeg'])         -- 2 MiB
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------------
-- avatars
-- ---------------------------------------------------------------------------------
create policy avatars_select on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.shares_org(((storage.foldername(name))[1])::uuid)
    )
  );

create policy avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg)$'          -- server-style names only
  );

create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------
-- firmware: intentionally no policies for anon/authenticated.
-- With RLS enabled on storage.objects (Supabase default), client keys cannot list,
-- read, write or delete firmware objects. The service role bypasses RLS and is used
-- only by apps/api (firmware upload + signed URL issuance).
-- ---------------------------------------------------------------------------------
