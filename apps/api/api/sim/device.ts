/**
 * POST /api/sim/device — the HTTP device simulator (PRD: "Use serviços HTTP para simular a comunicação").
 *
 * Accepts commands only from the API: route({ auth: 'device' }) verifies the system signature
 * (middleware/systemAuth.ts), the principal must be "simulator", and each signature is single-use
 * (T558). Firmware jobs are verified by the simulated device before install (T197).
 * Disabled unless ENABLE_SIMULATION=true (T49).
 */
import { z } from 'zod';
import { env } from '../../src/lib/env';
import { HttpError, json, route } from '../../src/lib/http';
import { assertSingleUse, requireSimulatorPrincipal } from '../../src/services/replay';
import { applyCommand, installFirmware, rollbackFirmware } from '../../src/services/deviceSimulator';
import { DEVICE_MODELS } from '../../src/lib/firmwareSigning';

const uuid = z.string().uuid();

const Manifest = z
  .object({
    body: z
      .object({
        version: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/),
        model: z.enum(DEVICE_MODELS),
        size: z.number().int().positive(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        releasedAt: z.string().datetime(),
        keyId: z.string().max(40),
      })
      .strict(),
    signature: z.string().max(200),
  })
  .strict();

const SimRequest = z.discriminatedUnion('op', [
  z
    .object({
      deviceId: uuid,
      op: z.literal('command'),
      desired: z.record(z.union([z.string().max(64), z.number().finite(), z.boolean()])),
      desiredVersion: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({ deviceId: uuid, op: z.literal('firmware'), rolloutId: uuid, manifest: Manifest, downloadUrl: z.string().url().max(2_048) })
    .strict(),
  z.object({ deviceId: uuid, op: z.literal('rollback'), rolloutId: uuid }).strict(),
]);

const handler = route(
  { methods: ['POST'], auth: 'device', maxBodyBytes: 8 * 1024, rateLimit: { limit: 300, windowSec: 60 } },
  async (ctx) => {
    if (!env.enableSimulation) throw new HttpError(404, 'not_found');
    requireSimulatorPrincipal(ctx);
    await assertSingleUse(ctx);

    let msg: z.infer<typeof SimRequest>;
    try {
      msg = SimRequest.parse(JSON.parse(ctx.bodyText));
    } catch {
      throw new HttpError(400, 'invalid_body');
    }

    switch (msg.op) {
      case 'command':
        return json(await applyCommand(msg.deviceId, msg.desired, msg.desiredVersion));
      case 'firmware':
        return json(await installFirmware(msg.deviceId, msg.rolloutId, msg.manifest, msg.downloadUrl));
      case 'rollback':
        return json(await rollbackFirmware(msg.deviceId, msg.rolloutId));
    }
  },
);

export { handler as POST, handler as OPTIONS };
