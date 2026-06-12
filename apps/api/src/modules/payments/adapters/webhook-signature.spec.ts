import crypto from 'crypto';
import { verifyHmacWebhook } from './webhook-signature';

const SECRET = 'test-webhook-secret';

function sign(body: string, secret = SECRET, encoding: 'hex' | 'base64' = 'hex'): string {
  return crypto.createHmac('sha256', secret).update(body).digest(encoding);
}

describe('webhook signature verification', () => {
  const rawBody = JSON.stringify({ reference: '482100000017', amount: '150000' });

  it('accepts a correctly signed payload', () => {
    const ok = verifyHmacWebhook(
      { rawBody, headers: { 'x-bank-signature': sign(rawBody) } },
      { header: 'x-bank-signature', secret: SECRET },
    );
    expect(ok).toBe(true);
  });

  it('rejects a tampered body', () => {
    const tampered = rawBody.replace('150000', '999999');
    const ok = verifyHmacWebhook(
      { rawBody: tampered, headers: { 'x-bank-signature': sign(rawBody) } },
      { header: 'x-bank-signature', secret: SECRET },
    );
    expect(ok).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const ok = verifyHmacWebhook(
      { rawBody, headers: { 'x-bank-signature': sign(rawBody, 'attacker-secret') } },
      { header: 'x-bank-signature', secret: SECRET },
    );
    expect(ok).toBe(false);
  });

  it('rejects when the signature header is missing', () => {
    const ok = verifyHmacWebhook(
      { rawBody, headers: {} },
      { header: 'x-bank-signature', secret: SECRET },
    );
    expect(ok).toBe(false);
  });

  it('supports base64 digests and custom message builders (Selcom scheme)', () => {
    const ts = '2026-06-11T12:00:00Z';
    const sig = crypto.createHmac('sha256', SECRET).update(`${ts}${rawBody}`).digest('base64');
    const ok = verifyHmacWebhook(
      { rawBody, headers: { 'x-selcom-signature': sig, 'x-selcom-timestamp': ts } },
      {
        header: 'x-selcom-signature',
        secret: SECRET,
        encoding: 'base64',
        message: (p) => `${p.headers['x-selcom-timestamp']}${p.rawBody}`,
      },
    );
    expect(ok).toBe(true);
  });

  it('FAILS CLOSED in production when no secret is configured', () => {
    const prev = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const ok = verifyHmacWebhook(
        { rawBody, headers: { 'x-bank-signature': sign(rawBody) } },
        { header: 'x-bank-signature', secret: undefined },
      );
      expect(ok).toBe(false);
    } finally {
      process.env['NODE_ENV'] = prev;
    }
  });

  it('FAILS CLOSED when NODE_ENV is unset and no secret is configured', () => {
    const prev = process.env['NODE_ENV'];
    delete process.env['NODE_ENV'];
    try {
      const ok = verifyHmacWebhook(
        { rawBody, headers: {} },
        { header: 'x-bank-signature', secret: undefined },
      );
      expect(ok).toBe(false);
    } finally {
      process.env['NODE_ENV'] = prev;
    }
  });

  it('allows unverified in dev ONLY with the explicit opt-in flag', () => {
    const prevEnv = process.env['NODE_ENV'];
    const prevFlag = process.env['ALLOW_UNSIGNED_WEBHOOKS'];
    process.env['NODE_ENV'] = 'development';
    try {
      process.env['ALLOW_UNSIGNED_WEBHOOKS'] = 'false';
      expect(verifyHmacWebhook({ rawBody, headers: {} }, { header: 'x-bank-signature', secret: undefined })).toBe(false);
      process.env['ALLOW_UNSIGNED_WEBHOOKS'] = 'true';
      expect(verifyHmacWebhook({ rawBody, headers: {} }, { header: 'x-bank-signature', secret: undefined })).toBe(true);
    } finally {
      process.env['NODE_ENV'] = prevEnv;
      if (prevFlag === undefined) delete process.env['ALLOW_UNSIGNED_WEBHOOKS'];
      else process.env['ALLOW_UNSIGNED_WEBHOOKS'] = prevFlag;
    }
  });

  it('tolerates a "sha256=" scheme prefix on the signature header', () => {
    const ok = verifyHmacWebhook(
      { rawBody, headers: { 'x-bank-signature': `sha256=${sign(rawBody)}` } },
      { header: 'x-bank-signature', secret: SECRET },
    );
    expect(ok).toBe(true);
  });
});
