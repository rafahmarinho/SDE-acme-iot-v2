---
name: t295-no-unencrypted-confidential-data-storage
description: Encrypt confidential data written to device or shared server locations in ACME IoT (sessions, cached org data, uploaded files) and protect it with access control (Keychain/Keystore, private Supabase Storage buckets).
---

# T295: Avoid storing unencrypted confidential data without access control mechanisms

**Category:** CODE_FIX
**SD Elements:** [T295](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T295/)
**Priority:** 7

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha, arquivos e atualizações em tempo real" (Supabase for PostgreSQL, email/password login, files and real-time updates)
> Source: specs/PRD.md, lines 5-7
> "mostre os últimos dados como leitura offline" (show the latest data as offline read) — Source: specs/PRD.md, line 53

**What the spec implies (naive approach):**
Write offline snapshots and downloaded files as plain JSON/files on the device, and store uploaded files
(firmware images, attachments) in a public Supabase Storage bucket.

**Secure Implementation Pattern:**
```typescript
// Device side: confidential values only in OS-protected storage
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('acme.activeOrg', orgId, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```
```sql
-- supabase/migrations/0002_storage.sql: private bucket + org-scoped access
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);
create policy "org members read attachments" on storage.objects for select
  using (bucket_id = 'attachments'
         and (storage.foldername(name))[1]::uuid in (select org_id from memberships where user_id = auth.uid()));
```

**Implementation Guidance:**
- Separate app secrets (none should ship in the bundle — see T76/T248) from user data.
- User-specific confidential data on device: expo-secure-store (Keychain/Keystore). Larger blobs: encrypt with a key held in SecureStore before writing to `documentDirectory`.
- Server side: all buckets private; access via RLS policies keyed by org folder prefix and short-lived signed URLs.
- Never place confidential files in shared/temp locations; delete temp files after use.

**Success Criteria:**
- [ ] No confidential data written unencrypted to device files
- [ ] All Supabase Storage buckets are private with org-scoped policies
- [ ] File access uses short-lived signed URLs only

**Status:** Pending
