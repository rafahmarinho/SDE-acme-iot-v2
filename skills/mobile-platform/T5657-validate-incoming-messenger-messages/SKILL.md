---
name: t5657-validate-incoming-messenger-messages
description: Validate every inbound message the ACME IoT app receives - Android IPC/intents, push notification data and Supabase Realtime payloads - by source and schema before updating UI state.
---

# T5657: Validate Incoming Messenger Messages (Android)

**Category:** CODE_FIX
**SD Elements:** [T5657](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T5657/)
**Priority:** 8

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha, arquivos e atualizações em tempo real" (Supabase ... files and real-time updates) — Source: specs/PRD.md, lines 5-7
> "Mostre o estado desejado e o estado informado pelo dispositivo." (Show the desired state and the state reported by the device.) — Source: specs/PRD.md, line 31
> "histórico e notificações" (history and notifications) — Source: specs/PRD.md, line 33

**What the spec implies (naive approach):**
Trust Realtime events, push notification `data` and any Android intent extras as-is, rendering reported state or
navigating to whatever route a notification says.

**Secure Implementation Pattern:**
```typescript
import { z } from 'zod';
const ReportedState = z.object({
  device_id: z.string().uuid(),
  reported: z.object({ setpoint: z.number().min(5).max(35).optional(), power: z.boolean().optional() }).strict(),
  reported_at: z.string().datetime(),
});
channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'device_state' }, (msg) => {
  const parsed = ReportedState.safeParse(msg.new);
  if (!parsed.success) return; // drop malformed
  store.applyReported(parsed.data);
});
// Push notification taps: allow-listed routes only
const NotifData = z.object({ kind: z.enum(['alert', 'automation']), id: z.string().uuid() });
```

**Implementation Guidance:**
- Validate source: Realtime only from the authenticated Supabase channel (RLS-filtered); push only via expo-notifications; no exported Android components accepting Messenger/Intent messages (T5645/T5646).
- Validate content with strict schemas; ignore unknown fields; bound numeric ranges.
- Never navigate/act on unvalidated notification data; actions require user confirmation (T170).
- Wrap handlers to avoid crashes from malformed messages.

**Success Criteria:**
- [ ] All Realtime and push payloads validated by schema before use
- [ ] Malformed messages are dropped without crashes
- [ ] No exported component receives arbitrary messages

**Status:** Pending
