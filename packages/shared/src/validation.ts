/**
 * Allow-list validation schemas shared by API and client (T42, T536, T2139).
 *
 * Rules:
 *  - User choices (scenario, sort, filters, device type) map to closed enums — never to file paths,
 *    dynamic imports, or SQL identifiers (T42).
 *  - Every string/array has an upper bound so payloads stay small (T536).
 *  - `.strict()` rejects unknown keys (mass-assignment protection).
 */
import { z } from 'zod';
import { ROLES } from './permissions';

export const uuid = z.string().uuid();

/** Manual device code, e.g. `K7QM-2HXP-9ZRA` (32-char alphabet without I/O/0/1). */
export const registrationCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/, 'invalid registration code');

export const DEVICE_TYPES = [
  'thermostat',
  'smart_plug',
  'temperature_sensor',
  'humidity_sensor',
  'occupancy_sensor',
] as const;
export const deviceType = z.enum(DEVICE_TYPES);

const name = z.string().trim().min(1).max(120);

export const registerDeviceInput = z
  .object({
    orgId: uuid,
    roomId: uuid,
    code: registrationCode,
    name,
  })
  .strict();

/** Thermostat setpoint in °C — range-checked (T42). */
export const setpointCommand = z
  .object({
    kind: z.literal('setpoint'),
    celsius: z.number().finite().min(5).max(35),
  })
  .strict();

export const plugCommand = z
  .object({
    kind: z.literal('plug'),
    on: z.boolean(),
  })
  .strict();

export const deviceCommand = z.discriminatedUnion('kind', [setpointCommand, plugCommand]);

const METRICS = ['temperature', 'humidity', 'occupancy', 'power', 'battery'] as const;
const OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq'] as const;

const automationCondition = z
  .object({
    deviceId: uuid,
    metric: z.enum(METRICS),
    operator: z.enum(OPERATORS),
    value: z.number().finite().min(-50).max(10_000),
  })
  .strict();

const automationAction = z
  .object({
    deviceId: uuid,
    command: deviceCommand,
  })
  .strict();

export const automationInput = z
  .object({
    orgId: uuid,
    name,
    conditions: z.array(automationCondition).min(1).max(20),
    actions: z.array(automationAction).min(1).max(20),
    cooldownSeconds: z.number().int().min(60).max(86_400),
    notify: z.boolean().default(true),
    enabled: z.boolean().default(true),
  })
  .strict();

export const SORT_FIELDS = ['name', 'created_at', 'battery_pct', 'last_seen_at'] as const;

/** Paginated list query: bounded page size, closed sort/filter enums (T42, T2600). */
export const listQuery = z
  .object({
    orgId: uuid,
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(200).optional(),
    sort: z.enum(SORT_FIELDS).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
    type: deviceType.optional(),
    q: z.string().trim().max(80).optional(),
  })
  .strict();

const semver = z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,6}$/, 'version must be MAJOR.MINOR.PATCH');

export const firmwareReleaseInput = z
  .object({
    orgId: uuid,
    deviceType,
    version: semver,
    /** Storage object path inside the private `firmware` bucket, produced by the API — never a URL. */
    storagePath: z.string().regex(/^[0-9a-f-]{36}\/[a-z0-9_.-]{1,100}$/),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    notes: z.string().max(2_000).optional(),
  })
  .strict();

export const firmwareRolloutInput = z
  .object({
    orgId: uuid,
    releaseId: uuid,
    deviceIds: z.array(uuid).min(1).max(100),
  })
  .strict();

export const SCENARIOS = ['device-offline', 'low-battery', 'reconnect', 'firmware-update'] as const;
export const simulationInput = z
  .object({
    orgId: uuid,
    action: z.enum(['scenario', 'advance', 'reset']),
    scenario: z.enum(SCENARIOS).optional(),
    steps: z.number().int().min(1).max(60).default(1),
  })
  .strict();

export const profileInput = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    locale: z.enum(['en']).default('en'),
  })
  .strict();

export const CONSENT_PURPOSES = ['essential', 'occupancy_analytics', 'product_emails'] as const;
export const consentInput = z
  .object({
    purpose: z.enum(CONSENT_PURPOSES),
    granted: z.boolean(),
    policyVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const teamMemberInput = z
  .object({
    orgId: uuid,
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(ROLES),
  })
  .strict();

export type RegisterDeviceInput = z.infer<typeof registerDeviceInput>;
export type DeviceCommand = z.infer<typeof deviceCommand>;
export type AutomationInput = z.infer<typeof automationInput>;
export type ListQuery = z.infer<typeof listQuery>;
export type FirmwareReleaseInput = z.infer<typeof firmwareReleaseInput>;
export type FirmwareRolloutInput = z.infer<typeof firmwareRolloutInput>;
export type SimulationInput = z.infer<typeof simulationInput>;
export type ProfileInput = z.infer<typeof profileInput>;
export type ConsentInput = z.infer<typeof consentInput>;
export type TeamMemberInput = z.infer<typeof teamMemberInput>;
