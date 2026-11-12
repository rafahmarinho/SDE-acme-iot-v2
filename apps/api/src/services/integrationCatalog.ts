/**
 * Fixed catalog of simulated external integrations (PRD: "integrações externas simuladas").
 * Admins pick a catalog KIND — they never supply URLs, so integrations cannot be pointed at internal
 * or attacker-controlled hosts (T1365). Every catalog entry is served by the HTTP simulator.
 */
import { featureConfig } from './config';

export const INTEGRATION_KINDS = ['weather_feed', 'energy_tariff', 'ticketing', 'webhook_relay'] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export const CATALOG: Record<IntegrationKind, { label: string; path: string }> = {
  weather_feed: { label: 'Weather feed (simulated)', path: '/api/sim/integration' },
  energy_tariff: { label: 'Energy tariff (simulated)', path: '/api/sim/integration' },
  ticketing: { label: 'Facilities ticketing (simulated)', path: '/api/sim/integration' },
  webhook_relay: { label: 'Webhook relay (simulated)', path: '/api/sim/integration' },
};

/** Server-derived endpoint for a catalog entry. */
export function endpointFor(kind: IntegrationKind): URL {
  return new URL(CATALOG[kind].path, featureConfig().deviceSimBaseUrl);
}

export function targetHostFor(kind: IntegrationKind): string {
  return endpointFor(kind).hostname;
}
