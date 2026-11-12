/**
 * POST /api/sim/integration — simulated external integration endpoint.
 * Accepts only signed calls from the API (system signature + "simulator" principal + single-use,
 * T558); returns canned, non-sensitive sample data. Disabled unless ENABLE_SIMULATION=true.
 */
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../src/lib/env';
import { HttpError, json, route } from '../../src/lib/http';
import { assertSingleUse, requireSimulatorPrincipal } from '../../src/services/replay';
import { INTEGRATION_KINDS } from '../../src/services/integrationCatalog';

const Body = z.object({ kind: z.enum(INTEGRATION_KINDS) }).strict();

const handler = route(
  { methods: ['POST'], auth: 'device', maxBodyBytes: 1_024, rateLimit: { limit: 120, windowSec: 60 } },
  async (ctx) => {
    if (!env.enableSimulation) throw new HttpError(404, 'not_found');
    requireSimulatorPrincipal(ctx);
    await assertSingleUse(ctx);

    let input: z.infer<typeof Body>;
    try {
      input = Body.parse(JSON.parse(ctx.bodyText));
    } catch {
      throw new HttpError(400, 'invalid_body');
    }

    const sample: Record<string, string | number> =
      input.kind === 'weather_feed'
        ? { outdoorCelsius: randomInt(-5, 36), condition: 'clear' }
        : input.kind === 'energy_tariff'
          ? { pricePerKwhCents: randomInt(10, 45), period: 'standard' }
          : { status: 'accepted' };
    return json({ ok: true, kind: input.kind, sample });
  },
);

export { handler as POST, handler as OPTIONS };
