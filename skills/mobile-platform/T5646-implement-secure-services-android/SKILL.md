---
name: t5646-implement-secure-services-android
description: Keep ACME IoT Android services (notifications, any background sync from Expo modules) unexported, minimal and stopped when the app is backgrounded, consistent with the PRD's pause-in-background requirement.
---

# T5646: Implement secure services (Android)

**Category:** CODE_FIX
**SD Elements:** [T5646](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T5646/)
**Priority:** 10

**Spec Context:**
> "pause as atualizações em segundo plano e mostre os últimos dados como leitura offline. Retome as atualizações quando a conexão voltar" (pause updates in the background and show latest data offline. Resume updates when the connection returns)
> Source: specs/PRD.md, lines 51-55
> "Crie automações ... com intervalo entre execuções, histórico e notificações" (automations with cooldown, history and notifications) — Source: specs/PRD.md, lines 31-33

**What the spec implies (naive approach):**
Run a foreground/background service polling devices and posting notifications, declared with an intent-filter
(implicitly exported) so it can be started by anyone.

**Secure Implementation Pattern:**
```typescript
// apps/mobile/src/services/realtime.ts - no background service; lifecycle-driven
import { AppState } from 'react-native';
AppState.addEventListener('change', (state) => {
  if (state === 'active') realtime.resume();
  else realtime.pause(); // unsubscribe channels, stop timers
});
// Automation notifications are produced server-side and delivered as push notifications.
```
```xml
<!-- If any native service exists (via config plugin) -->
<service android:name=".SomeService" android:exported="false" android:foregroundServiceType="dataSync" />
```

**Implementation Guidance:**
- Prefer no custom services; realtime runs only while the app is foregrounded (PRD).
- Automations/alerts execute server-side; mobile receives push notifications (no polling service).
- Any service: `exported="false"`, no intent-filters, explicit intents only, minimal permissions, stop when work is done.
- Push payloads must not contain sensitive data; fetch details after authenticated app open.

**Success Criteria:**
- [ ] No exported services in merged manifest
- [ ] Realtime subscriptions closed when app is backgrounded
- [ ] Push notification payloads contain no PII/secrets

**Status:** Pending
