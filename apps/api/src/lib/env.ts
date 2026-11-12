/**
 * Validated server environment (T76, T248, T69, T21, T2599, T49).
 *
 * - Every secret comes from Vercel project env vars (marked "Sensitive"); nothing is hard-coded.
 * - Validation runs at cold start: missing, weak or non-HTTPS values stop the function from serving.
 * - URLs are parsed and reduced to their origin; no connection string is ever built from request data.
 * - This module must never be imported by apps/mobile (see apps/api/eslint.config.js and supabase.ts).
 */
import { z } from 'zod';
import { CRYPTO_POLICY, requireHttpsOrigin } from '@acme-iot/shared';

const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

const secret = (name: string) =>
  z
    .string({ required_error: `${name} is required` })
    .refine((v) => Buffer.byteLength(v, 'utf8') >= CRYPTO_POLICY.minSecretBytes, {
      message: `${name} must be at least ${CRYPTO_POLICY.minSecretBytes} bytes of random data`,
    })
    .refine((v) => !/^(changeme|secret|password|test|example|<.*>)/i.test(v), {
      message: `${name} looks like a placeholder value`,
    });

const pem = (name: string, kind: 'PRIVATE' | 'PUBLIC') =>
  z
    .string({ required_error: `${name} is required` })
    .transform((v) => v.replace(/\\n/g, '\n'))
    .refine((v) => v.includes(`-----BEGIN ${kind} KEY-----`), { message: `${name} must be a PEM ${kind.toLowerCase()} key` });

const httpsOrigin = (name: string) =>
  z.string({ required_error: `${name} is required` }).transform((v, ctx) => {
    try {
      return requireHttpsOrigin(v, name, isProduction);
    } catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message });
      return z.NEVER;
    }
  });

const Schema = z.object({
  SUPABASE_URL: httpsOrigin('SUPABASE_URL'),
  SUPABASE_ANON_KEY: z.string().min(20, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  DEVICE_SIM_BASE_URL: httpsOrigin('DEVICE_SIM_BASE_URL'),
  DEVICE_SIM_SHARED_SECRET: secret('DEVICE_SIM_SHARED_SECRET'),
  FIRMWARE_SIGNING_PRIVATE_KEY: pem('FIRMWARE_SIGNING_PRIVATE_KEY', 'PRIVATE'),
  FIRMWARE_SIGNING_PUBLIC_KEY: pem('FIRMWARE_SIGNING_PUBLIC_KEY', 'PUBLIC'),
  FIRMWARE_SIGNING_KEY_ID: z.string().regex(/^[a-z0-9-]{3,40}$/).default('fw-2026-01'),
  ALLOWED_ORIGINS: z.string().transform((v, ctx) => {
    const origins = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const out: string[] = [];
    for (const o of origins) {
      if (o === '*' || o.includes('*')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ALLOWED_ORIGINS must list exact origins (no wildcards)' });
        return z.NEVER;
      }
      try {
        const origin = requireHttpsOrigin(o, 'ALLOWED_ORIGINS entry', isProduction);
        if (origin !== o.replace(/\/$/, '')) throw new Error('ALLOWED_ORIGINS entries must be bare origins');
        out.push(origin);
      } catch (e) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message });
        return z.NEVER;
      }
    }
    return out;
  }),
  ENABLE_SIMULATION: z.enum(['true', 'false']).default('false'),
  DEBUG_ERRORS: z.enum(['true', 'false']).default('false'),
});

export type Env = z.infer<typeof Schema> & { isProduction: boolean; debugErrors: boolean; enableSimulation: boolean };

function load(): Env {
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    // Only variable names and rule messages are reported — never the values (T248).
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid server configuration: ${problems}`);
  }
  const e = parsed.data;
  return {
    ...e,
    isProduction,
    // Debug error details are impossible in production, whatever the flag says (T49).
    debugErrors: !isProduction && e.DEBUG_ERRORS === 'true',
    enableSimulation: e.ENABLE_SIMULATION === 'true',
  };
}

export const env: Env = load();
