---
name: t50-indirect-object-refs-for-files
description: Access Supabase Storage files (firmware images, attachments) via database records and short-lived signed URLs, never raw user-supplied paths.
---

# T50: Use indirect object reference maps if accessing files

**Category:** CODE_FIX
**SD Elements:** [T50](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T50/)
**Priority:** 8

**Spec Context:**
> "...Supabase para PostgreSQL, login por e-mail e senha, arquivos e atualizações em tempo real." (...Supabase for PostgreSQL, email/password login, files and realtime updates.)
> Source: specs/PRD.md, L5-7
> "...atualizações de firmware com progresso e rollback." (...firmware updates with progress and rollback.)
> Source: specs/PRD.md, L35-37

**What the spec implies (naive approach):**
`GET /api/files?path=org-b/firmware/thermo-2.1.bin` downloading whatever bucket path the client sends, or public buckets.

**Secure Implementation Pattern:**
```ts
// apps/api/api/firmware/[releaseId]/download.ts
const releaseId = UuidSchema.parse(req.query.releaseId);    // indirect reference
const { data: rel } = await supabaseForRequest(token)
  .from('firmware_releases').select('storage_path, org_id').eq('id', releaseId).maybeSingle();
if (!rel) throw new HttpError(404);                          // RLS enforced org access
const { data } = await supabaseAdmin.storage.from('firmware')
  .createSignedUrl(rel.storage_path, 60);                    // 60s, server-chosen path
res.json({ url: data!.signedUrl });
```

**Implementation Guidance:**
- Buckets private; object paths generated server-side (`{org_id}/{uuid}`), never from filenames.
- Clients reference files by record id; path resolution happens server-side after authorization.
- Store original filename only as metadata, sanitized for display.

**Success Criteria:**
- [ ] No endpoint accepts a storage path from the client
- [ ] All buckets private; downloads via signed URLs ≤ 5 min
- [ ] Cross-org file id returns 404

**Status:** Applied
