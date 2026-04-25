import pino from 'pino';

const PII_KEYS = new Set([
  'password',
  'password_hash',
  'phone',
  'email',
  'nida',
  'tsc_no',
  'mfa_secret',
  'token',
  'authorization',
  'cookie',
]);

function redactPii(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PII_KEYS.has(k.toLowerCase())) {
      result[k] = '[REDACTED]';
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = redactPii(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  formatters: {
    log(obj) {
      return redactPii(obj as Record<string, unknown>);
    },
  },
  ...(process.env['NODE_ENV'] === 'development' && {
    transport: { target: 'pino-pretty' },
  }),
});
