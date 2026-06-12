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
    // Fail CLOSED by default. Unsigned acceptance is only allowed when BOTH a
    // recognised dev/test NODE_ENV is set AND an explicit opt-in flag is on —
    // so a missing/blank NODE_ENV in a misconfigured container never accepts
    // forged callbacks.
    const env = process.env['NODE_ENV'];
    const isDevEnv = env === 'development' || env === 'test';
    const optIn = process.env['ALLOW_UNSIGNED_WEBHOOKS'] === 'true';
    if (isDevEnv && optIn) {
      logger.warn(`Webhook secret for '${header}' not set — accepting unverified (dev opt-in).`);
      return true;
    }
    logger.error(`Webhook secret for header '${header}' is not configured — rejecting.`);
    return false;
  }

  // Strip a known "scheme=" prefix (e.g. "sha256=…"). Restricted to known
  // schemes so we never strip base64 padding ('='), which is significant.
  const rawProvided = payload.headers[header] ?? payload.headers[header.toLowerCase()];
  if (!rawProvided) return false;
  const provided = rawProvided.replace(/^(sha256|sha1|hmac-sha256|hmac)=/i, '').trim();

  const message = opts.message ? opts.message(payload) : payload.rawBody;
  // Compare decoded digest BYTES, not ASCII strings, so hex/base64 casing or
  // representation differences can't cause a spurious mismatch.
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(provided, encoding);
    b = crypto.createHmac('sha256', secret).update(message).digest();
  } catch {
    return false;
  }
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
