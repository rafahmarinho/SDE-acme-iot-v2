/**
 * Notification e-mail delivery (T2157), built on fixed templates (T1144).
 * - recipients are verified org members selected by role — never free-form addresses
 * - fixed subjects, CR/LF stripped from every value, no tokens or occupancy data in messages
 * - delivered over HTTPS to an allow-listed provider (or simulated when no provider is configured)
 * - rate-limited per org and template
 * Password-recovery mail is sent by Supabase Auth (custom SMTP with SPF/DKIM/DMARC, single-use links).
 */
import type { Role } from '@acme-iot/shared';
import { supabaseAdmin } from './supabase';
import { featureConfig } from '../services/config';
import { safeOutboundFetch } from '../services/outbound';
import { renderHtml, renderText, subjectFor, type TemplateKey, type TemplateVars } from './templates';

const SENSITIVE_METRICS = new Set(['occupancy']);
const MAX_PER_ORG_TEMPLATE_PER_HOUR = 30;

async function verifiedRecipients(orgId: string, roles: readonly Role[]): Promise<string[]> {
  const admin = supabaseAdmin();
  const { data: members, error } = await admin
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .in('role', roles as string[]);
  if (error || !members) return [];

  const emails: string[] = [];
  for (const m of members as Array<{ user_id: string }>) {
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    const user = data?.user;
    if (user?.email && user.email_confirmed_at) emails.push(user.email);
  }
  return emails;
}

export async function notifyMembers(
  orgId: string,
  roles: readonly Role[],
  key: TemplateKey,
  vars: TemplateVars,
): Promise<{ sent: number; throttled: boolean }> {
  const { data: allowed } = await supabaseAdmin().rpc('consume_rate_limit', {
    p_key: `notify:${orgId}:${key}`,
    p_limit: MAX_PER_ORG_TEMPLATE_PER_HOUR,
    p_window_seconds: 3600,
  });
  if (allowed !== true) return { sent: 0, throttled: true };

  // Do not e-mail presence-related readings; the app shows them to authorized users instead.
  const safeVars: TemplateVars =
    typeof vars.metric === 'string' && SENSITIVE_METRICS.has(vars.metric) ? { ...vars, value: 'a new value' } : vars;

  const recipients = await verifiedRecipients(orgId, roles);
  if (recipients.length === 0) return { sent: 0, throttled: false };

  const { mail } = featureConfig();
  const message = { from: mail.from, subject: subjectFor(key), text: renderText(key, safeVars), html: renderHtml(key, safeVars) };

  if (!mail.providerUrl) {
    // Simulated provider (PRD: external integrations are simulated). Log metadata only, never content.
    console.info(JSON.stringify({ evt: 'mail.simulated', template: key, recipients: recipients.length }));
    return { sent: recipients.length, throttled: false };
  }

  let sent = 0;
  for (const to of recipients) {
    const res = await safeOutboundFetch(mail.providerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(mail.providerToken ? { authorization: `Bearer ${mail.providerToken}` } : {}),
      },
      body: JSON.stringify({ ...message, to }),
      timeoutMs: 8_000,
      maxResponseBytes: 16 * 1024,
    });
    if (res.status >= 200 && res.status < 300) sent++;
  }
  return { sent, throttled: false };
}
