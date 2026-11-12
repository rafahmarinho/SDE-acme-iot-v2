---
name: t36-escape-untrusted-output
description: Context-aware output encoding for user- and device-supplied data (device names, room names, automation text, event messages) in the Expo web build and emails.
---

# T36: Escape untrusted data in HTML, HTML attributes, CSS, and JavaScript

**Category:** CODE_FIX
**SD Elements:** [T36](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T36/)
**Priority:** 8

**Spec Context:**
> "Crie telas de dashboard, prédios, salas, cadastro e detalhe de dispositivos, automações, alertas, eventos..." (Create dashboard, buildings, rooms, device registration/detail, automations, alerts, events screens...)
> Source: specs/PRD.md, L23-25
> "...busca, filtros..." (...search, filters...)
> Source: specs/PRD.md, L11

**What the spec implies (naive approach):**
Rendering device names, event messages or search terms via `dangerouslySetInnerHTML` on web (e.g. to highlight search matches) or building HTML strings for the 3D dashboard labels and notification emails.

**Secure Implementation Pattern:**
```tsx
// React Native <Text> escapes by default — keep it that way.
<Text>{device.name}</Text>

// Search highlight WITHOUT innerHTML:
function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return <Text>{text}</Text>;
  return <Text>{text.slice(0, i)}<Text style={s.hit}>{text.slice(i, i + q.length)}</Text>{text.slice(i + q.length)}</Text>;
}

// HTML emails/notifications: use a template engine with auto-escaping
import { escape } from 'html-escaper';
const html = `<p>Alert in ${escape(room.name)}: ${escape(alert.message)}</p>`;
```

**Implementation Guidance:**
- Ban `dangerouslySetInnerHTML` via ESLint (`react/no-danger`).
- 3D labels (three.js/expo-gl): use text geometry/sprites, never HTML overlays from raw strings.
- Treat device-reported fields (simulated) as untrusted too.
- Add CSP (T66) as defense in depth.

**Success Criteria:**
- [ ] No `dangerouslySetInnerHTML`/`innerHTML` with untrusted data
- [ ] Device name `<img src=x onerror=alert(1)>` renders as text on web and in emails

**Status:** Pending
