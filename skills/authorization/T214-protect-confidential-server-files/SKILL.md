---
name: t214-protect-confidential-server-files
description: Restrict access to confidential files in Supabase Storage (firmware binaries, uploads) and server-side config with least-privilege bucket policies.
---

# T214: Protect confidential files on operating system or server

**Category:** CODE_FIX
**SD Elements:** [T214](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T214/)
**Priority:** 9

**Spec Context:**
> "...arquivos e atualizações em tempo real." (...files and realtime updates.)
> Source: specs/PRD.md, L5-7
> "...atualizações de firmware com progresso e rollback." (...firmware updates with progress and rollback.)
> Source: specs/PRD.md, L35-37

**What the spec implies (naive approach):**
A single public bucket for all files (firmware, exported reports, attachments) readable by anyone with the URL.

**Secure Implementation Pattern:**
```sql
-- supabase/migrations/0002_storage.sql
insert into storage.buckets (id, name, public) values ('firmware','firmware', false), ('attachments','attachments', false);

create policy "attachments read own org" on storage.objects for select
  using (bucket_id = 'attachments'
         and public.has_role((storage.foldername(name))[1]::uuid, array['owner','admin','operator','viewer']));
create policy "attachments write operators" on storage.objects for insert
  with check (bucket_id = 'attachments'
              and public.has_role((storage.foldername(name))[1]::uuid, array['owner','admin','operator']));
-- firmware bucket: no client policies at all (service role only via API)
```

**Implementation Guidance:**
- Firmware bucket writable/readable only by the API (service role); devices get signed URLs (T50).
- Secrets/config files never stored in Storage; Vercel env vars only.
- Limit upload size and MIME types per bucket (`file_size_limit`, `allowed_mime_types`).

**Success Criteria:**
- [x] No public buckets
- [x] Storage policies scope objects by org folder and role
- [x] Firmware objects inaccessible to client keys

**Status:** Applied
