import crypto from 'crypto';
import { Logger } from '@nestjs/common';
import type { WebhookPayload } from './payment-adapter.interface';

const logger = new Logger('WebhookSignature');

export interface HmacVerifyOptions {
  /** Header (lower-case) carrying the signature. */
  header: string;
  /** Shared secret. When absent: allow in dev with a warning, REJECT in production. */
  secret: string | undefined;
  /** Digest encoding used by the provider. */
  encoding?: 'hex' | 'base64';
  /**
   * Builds the signed message from the payload.
   * Defaults to the raw body (the most common scheme).
   */
  message?: (payload: WebhookPayload) => string;
}

/**
 * Constant-time HMAC-SHA256 webhook signature verification.
 *
 * Security posture:
 *  - missing secret in production  → reject (fail closed)
 *  - missing secret in dev/test    → accept with a loud warning (stub mode)
 *  - missing/garbled signature     → reject
 */
export function verifyHmacWebhook(payload: WebhookPayload, opts: HmacVerifyOptions): boolean {
  const { header, secret, encoding = 'hex' } = opts;

  if (!secret) {
    if (process.env['NODE_ENV'] === 'production') {
      logger.error(`Webhook secret for header '${header}' is not configured — rejecting.`);
      return false;
    }
    logger.warn(`Webhook secret for '${header}' not configured — accepting unverified (dev only).`);
    return true;
  }

  const provided = payload.headers[header] ?? payload.headers[header.toLowerCase()];
  if (!provided) return false;

  const message = opts.message ? opts.message(payload) : payload.rawBody;
  const expected = crypto.createHmac('sha256', secret).update(message).digest(encoding);

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
