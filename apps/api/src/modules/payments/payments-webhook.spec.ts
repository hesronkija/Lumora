import crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SelcomAdapter } from './adapters/selcom.adapter';
import { GepgAdapter } from './adapters/gepg.adapter';
import { CashAdapter } from './adapters/cash.adapter';
import { VfmsAdapter } from './adapters/vfms.adapter';

const TENANT = '11111111-1111-1111-1111-111111111111';
const SECRET = 'selcom-test-secret';

function selcomSigned(body: Record<string, unknown>) {
  const rawBody = JSON.stringify(body);
  const ts = '2026-06-11T09:00:00Z';
  const sig = crypto.createHmac('sha256', SECRET).update(`${ts}${rawBody}`).digest('base64');
  return { rawBody, headers: { 'x-selcom-signature': sig, 'x-selcom-timestamp': ts } };
}

describe('payment webhook pipeline', () => {
  let dbRows: Record<string, unknown[]>;
  const mkPool = () => ({
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM invoice')) return { rows: dbRows['invoice'] ?? [], rowCount: (dbRows['invoice'] ?? []).length };
      if (sql.includes('SELECT * FROM payment WHERE provider_ref')) return { rows: dbRows['payment'] ?? [], rowCount: (dbRows['payment'] ?? []).length };
      if (sql.includes('INSERT INTO payment')) return { rows: [{ id: 'pay-new' }], rowCount: 1 };
      if (sql.includes('SELECT vrn FROM tenant')) return { rows: [{ vrn: null }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }),
  });
  let pool: ReturnType<typeof mkPool>;
  let systemPool: ReturnType<typeof mkPool>;
  const audit = { log: jest.fn() } as never;
  const fees = { updatePaymentBalance: jest.fn(), getInvoice: jest.fn() } as never;
  let svc: PaymentsService;

  beforeEach(() => {
    process.env['SELCOM_API_SECRET'] = SECRET;
    dbRows = {
      invoice: [{ id: 'inv-1', tenant_id: TENANT, invoice_no: 'INV/2026/00001', control_no: '482100000017' }],
      payment: [],
    };
    pool = mkPool();
    systemPool = mkPool();
    svc = new PaymentsService(
      pool as never, systemPool as never, audit, fees,
      new SelcomAdapter(), new GepgAdapter(), new CashAdapter(), new VfmsAdapter(),
    );
  });

  afterEach(() => { delete process.env['SELCOM_API_SECRET']; });

  const happyBody = {
    utilityref: '482100000017', transid: 'TX123', amount: '150000',
    msisdn: '255712345678', name: 'Mzazi Mfano', resultcode: '000',
    reference: 'ref-1', transaction_date: '2026-06-11 09:00:00',
  };

  it('REJECTS an unsigned webhook with 401', async () => {
    await expect(
      svc.handleWebhook('selcom', { rawBody: JSON.stringify(happyBody), headers: {} }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('REJECTS a webhook signed with the wrong secret', async () => {
    const ts = '2026-06-11T09:00:00Z';
    const rawBody = JSON.stringify(happyBody);
    const badSig = crypto.createHmac('sha256', 'evil').update(`${ts}${rawBody}`).digest('base64');
    await expect(
      svc.handleWebhook('selcom', { rawBody, headers: { 'x-selcom-signature': badSig, 'x-selcom-timestamp': ts } }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('processes a correctly signed completed payment', async () => {
    const res = await svc.handleWebhook('selcom', selcomSigned(happyBody));
    expect(res).toMatchObject({ processed: true });
    expect(fees.updatePaymentBalance).toHaveBeenCalledWith('inv-1', expect.anything());
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment.completed' }));
  });

  it('is idempotent: a replayed webhook never double-credits the invoice', async () => {
    dbRows['payment'] = [{ id: 'pay-1', status: 'completed' }];
    const res = await svc.handleWebhook('selcom', selcomSigned(happyBody));
    expect(res).toMatchObject({ processed: true, replay: true });
    expect(fees.updatePaymentBalance).not.toHaveBeenCalled();
  });

  it('ignores failed-status callbacks without touching the ledger', async () => {
    const res = await svc.handleWebhook('selcom', selcomSigned({ ...happyBody, resultcode: '999' }));
    expect(res).toMatchObject({ processed: false, status: 'failed' });
    expect(fees.updatePaymentBalance).not.toHaveBeenCalled();
  });

  it('answers invoice_not_found for an unknown control number', async () => {
    dbRows['invoice'] = [];
    const res = await svc.handleWebhook('selcom', selcomSigned(happyBody));
    expect(res).toMatchObject({ processed: false, reason: 'invoice_not_found' });
  });

  it('rejects webhooks for unknown providers', async () => {
    await expect(svc.handleWebhook('paypal', { rawBody: '{}', headers: {} })).rejects.toThrow(/Unknown provider/);
  });
});
