---
name: t2602-log-database-and-server-activities
description: Log security-relevant database and API activity (data changes, config/role changes, failed authz, firmware rollouts, simulation resets) with metadata, using Supabase logs/pgaudit plus structured API logs.
---

# T2602: Log typical database and server activities and related metadata

**Category:** CODE_FIX
**SD Elements:** [T2602](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T2602/)
**Priority:** 8

**Spec Context:**
> "Os resultados devem aparecer nas telas e continuar salvos após recarregar a aplicação."
> (Results must appear on screens and remain saved after reloading the app.)
> Source: specs/PRD.md, lines 45-47
> "...atualizações de firmware com progresso e rollback." — lines 35-37

**What the spec implies (naive approach):**
Persisting state but no record of who changed device settings, roles, automations or rolled out
firmware — leaving incidents uninvestigable.

**Secure Implementation Pattern:**
```ts
// apps/api/src/lib/log.ts — structured JSON logs (Vercel log drain)
export function audit(evt: {
  action: string; actorId: string; orgId: string; target?: string; outcome: 'ok' | 'denied' | 'error';
  meta?: Record<string, unknown>;
}) {
  console.log(JSON.stringify({ level: 'audit', ts: new Date().toISOString(), ...evt }));
}
// usage
audit({ action: 'device.command', actorId: user.id, orgId, target: deviceId, outcome: 'ok', meta: { cmd: 'plug.off' } });
```
```sql
-- data-change trigger feeding public.events (see T349)
create trigger devices_audit after insert or update or delete on public.devices
  for each row execute function public.audit_row_change();
```

**Implementation Guidance:**
- Log: logins/failed authz (Supabase Auth logs), role/membership changes, device commands,
  automation create/update/run, firmware upload/rollout/rollback, simulation reset, config changes.
- Include actor, org, target, timestamp, request id, outcome. Never log tokens, passwords or PII beyond ids.
- Enable `pgaudit` (Supabase extension) for DDL and role changes; configure a log drain from Vercel and Supabase.

**Success Criteria:**
- [x] Each security-relevant action produces an audit log entry.
- [x] Logs contain no secrets.
- [ ] Log drain/retention configured.

**Status:** Applied
