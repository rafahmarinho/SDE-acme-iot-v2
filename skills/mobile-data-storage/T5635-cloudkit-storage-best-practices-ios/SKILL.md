---
name: t5635-cloudkit-storage-best-practices-ios
description: ACME IoT uses Supabase, not CloudKit, for shared org data; do not introduce CloudKit public/shared databases, and if ever added apply private databases, Apple-ID auth and least-privilege record access.
---

# T5635: Follow best practices for handling CloudKit Storage (iOS)

**Category:** CODE_FIX
**SD Elements:** [T5635](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T5635/)
**Priority:** 9

**Spec Context:**
> "Use versões atuais e estáveis das tecnologias e Supabase para PostgreSQL, login por e-mail e senha, arquivos e atualizações em tempo real." (Use current stable technologies and Supabase for PostgreSQL, email/password login, files and real-time updates.)
> Source: specs/PRD.md, lines 5-7

**What the spec implies (naive approach):**
A developer adds CloudKit to share organization/device data between iOS users (e.g., a public database for
"shared rooms"), bypassing Supabase RLS and org roles.

**Secure Implementation Pattern:**
```typescript
// Shared org data only via Supabase with RLS - single enforcement point for roles
const { data, error } = await supabase
  .from('devices')
  .select('id, name, type, room_id')
  .eq('org_id', activeOrgId); // RLS still enforces membership server-side
```
```json
// app.json: no CloudKit services
{ "expo": { "ios": { "usesIcloudStorage": false } } }
```

**Implementation Guidance:**
- Keep all collaborative/shared data in Supabase where org role RLS (owner/admin/operator/viewer) applies.
- Do not enable CloudKit containers in the iOS entitlements.
- If CloudKit is introduced later: private database for user data, never the public database for org data; authenticate via Apple ID; validate records server-side; encrypt sensitive fields (`encryptedValues`).

**Success Criteria:**
- [ ] iOS build has no CloudKit container entitlement
- [ ] All shared data flows through Supabase with RLS
- [ ] Architecture review gate documented for any future CloudKit use

**Status:** Pending
