import { Injectable, Logger } from '@nestjs/common';
import type {
  IPaymentAdapter,
  ChargeRequest,
  ChargeResult,
  WebhookPayload,
  WebhookResult,
  ReconcileBatchRequest,
  ReconcileEntry,
} from './payment-adapter.interface';

/**
 * Bank adapter covering NMB Direct Banking API and CRDB SimBanking biller.
 * Each bank requires a separate onboarding contract.
 * In dev/test, all calls are stubbed with realistic responses.
 *
 * Bank push flow: school issues control number → parent pays via bank channel
 * (internet banking, branch, USSD) → bank posts a webhook callback.
 */
@Injectable()
export class BankAdapter implements IPaymentAdapter {
  readonly channel = 'bank' as const;
  readonly provider: string;
  private readonly logger = new Logger(BankAdapter.name);

  constructor(provider: 'nmb' | 'crdb' = 'nmb') {
    this.provider = provider;
  }

  private get isStub(): boolean {
    return !process.env['BANK_API_KEY'] || process.env['NODE_ENV'] === 'test';
  }

  private get baseUrl(): string {
    const urls: Record<string, string> = {
      nmb: process.env['NMB_BASE_URL'] ?? 'https://api.nmbtz.com/v1',
      crdb: process.env['CRDB_BASE_URL'] ?? 'https://openapi.crdbbank.co.tz/v1',
    };
    return urls[this.provider] ?? urls['nmb']!;
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    if (this.isStub) {
      this.logger.debug(`[${this.provider.toUpperCase()} STUB] Register biller ref ${req.controlNo}, amount ${req.amount} TZS`);
      return { success: true, providerRef: `${this.provider}-stub-${Date.now()}` };
    }

    try {
      const resp = await fetch(`${this.baseUrl}/biller/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env['BANK_API_KEY'] ?? ''}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': req.idempotencyKey,
        },
        body: JSON.stringify({
          reference: req.controlNo,
          amount: req.amount,
          currency: 'TZS',
          description: req.description,
          callback_url: req.callbackUrl,
          payer_name: req.payerName ?? '',
          payer_phone: req.payerPhone ?? '',
        }),
      });
      const data = (await resp.json()) as { status: string; reference?: string; error?: string };
      if (data.status !== 'success') {
        return { success: false, error: data.error ?? `${this.provider} registration failed` };
      }
      return { success: true, providerRef: data.reference };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async statusCheck(providerRef: string): Promise<ChargeResult> {
    if (this.isStub) return { success: true, providerRef };
    const resp = await fetch(`${this.baseUrl}/biller/status?reference=${providerRef}`, {
      headers: { Authorization: `Bearer ${process.env['BANK_API_KEY'] ?? ''}` },
    });
    const data = (await resp.json()) as { status: string };
    return { success: data.status === 'paid', providerRef };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    const body = JSON.parse(payload.rawBody) as {
      reference: string;
      bank_ref: string;
      amount: string;
      payer_account: string;
      payer_name: string;
      transaction_date: string;
      status: string;
    };

    return {
      controlNo: body.reference,
      providerRef: body.bank_ref,
      amount: Math.round(parseFloat(body.amount)),
      paidAt: new Date(body.transaction_date),
      payerPhone: body.payer_account,
      payerName: body.payer_name,
      status: body.status === 'completed' ? 'completed' : 'failed',
    };
  }

  async reconcileBatch(_req: ReconcileBatchRequest): Promise<ReconcileEntry[]> {
    if (this.isStub) return [];
    // Production: fetch MT940 statement or CSV from bank SFTP/API for the date range
    this.logger.warn(`${this.provider} reconcileBatch: MT940 import not yet implemented`);
    return [];
  }
}
