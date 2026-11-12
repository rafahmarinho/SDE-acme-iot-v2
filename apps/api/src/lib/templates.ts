/**
 * Fixed, logic-less notification templates (T1144).
 * Users choose a template KEY; they never author template text. Values are substituted literally
 * (no evaluation), length-capped, and HTML-escaped for the HTML part.
 */

export const TEMPLATES = {
  'automation.triggered': {
    subject: 'ACME IoT: automation triggered',
    text: 'Automation "{automation}" ran in {room}: {metric} on {device} reached {value}.',
  },
  'device.offline': {
    subject: 'ACME IoT: device offline',
    text: 'Device {device} in {room} went offline.',
  },
  'battery.low': {
    subject: 'ACME IoT: low battery',
    text: 'Device {device} battery is at {value}%.',
  },
  'firmware.failed': {
    subject: 'ACME IoT: firmware update rolled back',
    text: 'Firmware {version} could not be installed on {device} and was rolled back.',
  },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;
export type TemplateVars = Partial<Record<'automation' | 'room' | 'metric' | 'device' | 'value' | 'version', string | number>>;

const MAX_VAR_LENGTH = 120;

/** Removes control characters (incl. CR/LF, preventing header injection) and caps length. */
export function sanitizeValue(value: string | number): string {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, MAX_VAR_LENGTH);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain substitution: `{{7*7}}` or `${...}` inside a device name is rendered literally. */
export function renderText(key: TemplateKey, vars: TemplateVars): string {
  return TEMPLATES[key].text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = (vars as Record<string, string | number | undefined>)[name];
    return v === undefined ? '' : sanitizeValue(v);
  });
}

export function renderHtml(key: TemplateKey, vars: TemplateVars): string {
  return `<p>${escapeHtml(renderText(key, vars))}</p><p>Open the ACME IoT app for details.</p>`;
}

export function subjectFor(key: TemplateKey): string {
  return TEMPLATES[key].subject; // fixed subjects: no user data in headers
}
