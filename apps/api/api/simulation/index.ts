/**
 * GET  /api/simulation?orgId= — whether the simulation area is available to the caller (T49).
 * POST /api/simulation — choose scenarios, advance the simulation, reset demo data (PRD).
 * Owner/admin only; scenario names are a closed enum (T42). Disabled unless ENABLE_SIMULATION=true.
 */
import { rolesFor, simulationInput, uuid } from '@acme-iot/shared';
import { z } from 'zod';
import { env } from '../../src/lib/env';
import { HttpError, json, readJson, readQuery, route } from '../../src/lib/http';
import { requireRole } from '../../src/middleware/auth';
import { audit } from '../../src/lib/audit';
import { advance, reset, runScenario } from '../../src/services/simulation';

const statusQuery = z.object({ orgId: uuid }).strict();

const handler = route(
  { methods: ['GET', 'POST'], auth: 'user', maxBodyBytes: 1_024, rateLimit: { limit: 30, windowSec: 60 } },
  async (ctx) => {
    if (ctx.req.method === 'GET') {
      const { orgId } = readQuery(ctx, statusQuery);
      await requireRole(ctx, orgId, [...rolesFor('simulation.advance')]);
      return json({ data: { enabled: env.enableSimulation } });
    }

    if (!env.enableSimulation) throw new HttpError(404, 'not_found');
    const input = await readJson(ctx, simulationInput);

    switch (input.action) {
      case 'scenario': {
        if (!input.scenario) throw new HttpError(400, 'scenario_required');
        await requireRole(ctx, input.orgId, [...rolesFor('simulation.advance')]);
        const result = await runScenario(input.orgId, input.scenario);
        await audit(ctx, input.orgId, 'simulation.scenario', 'organization', input.orgId, { scenario: input.scenario });
        return json({ data: result });
      }
      case 'advance': {
        await requireRole(ctx, input.orgId, [...rolesFor('simulation.advance')]);
        const result = await advance(input.orgId, input.steps);
        await audit(ctx, input.orgId, 'simulation.advance', 'organization', input.orgId, { steps: input.steps });
        return json({ data: result });
      }
      case 'reset': {
        await requireRole(ctx, input.orgId, [...rolesFor('simulation.reset')]);
        if (!ctx.user) throw new HttpError(401, 'unauthorized');
        await reset(input.orgId, ctx.user.id); // reset_demo_data writes its own audit record
        return json({ data: { ok: true } });
      }
    }
  },
);

export { handler as GET, handler as POST, handler as OPTIONS };
