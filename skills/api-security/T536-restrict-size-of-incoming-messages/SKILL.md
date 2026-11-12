---
name: t536-restrict-size-of-incoming-messages
description: Enforce per-endpoint request body size limits in the Vercel API (device commands, automations, firmware upload, simulation) and on calls to downstream simulated device services.
---

# T536: Restrict the size of incoming messages in services

**Category:** CODE_FIX
**SD Elements:** [T536](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T536/)
**Priority:** 8

**Spec Context:**
> "...com uma API TypeScript na Vercel." (with a TypeScript API on Vercel)
> Source: specs/PRD.md, line 19
> "Crie automações simples de condição e ação..." (create simple condition/action automations) — lines 31-33

**What the spec implies (naive approach):**
Handlers do `JSON.parse(await req.text())` with no limit, so a huge automation rule or simulation
payload exhausts function memory/time; firmware uploads go through the API body unrestricted.

**Secure Implementation Pattern:**
```ts
// apps/api/src/middleware/bodyLimit.ts
import type { VercelRequest } from '@vercel/node';

export async function readJson<T>(req: VercelRequest, maxBytes: number): Promise<T> {
  const len = Number(req.headers['content-length'] ?? 0);
  if (len > maxBytes) throw Object.assign(new Error('Payload too large'), { status: 413 });
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > maxBytes) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}
export const LIMITS = { command: 2_048, automation: 16_384, simulation: 8_192 } as const;
// apps/api/api/devices/[id]/command.ts:  export const config = { api: { bodyParser: false } };
```

**Implementation Guidance:**
- Define limits per route in one place (`LIMITS`); return 413 on violation.
- Also cap array lengths (e.g. max 20 conditions/actions per automation) in the zod schema.
- Firmware binaries: upload directly to Supabase Storage with signed upload URLs and a bucket
  `file_size_limit`; the API only receives metadata.
- Validate response sizes from simulated device services before parsing.

**Success Criteria:**
- [x] Every API route uses `readJson` with an explicit limit.
- [x] Oversized requests return 413 without being parsed.
- [ ] Storage bucket for firmware has a size limit.

**Status:** Applied
**Applied in:** apps/api/src/lib/http.ts (`BODY_LIMITS`, streaming size check before parse → 413, default 16 KiB), packages/shared/src/validation.ts (array/string caps). Bucket file_size_limit: Layer A.
