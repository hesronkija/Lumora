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
import crypto from 'crypto';

/**
 * Selcom (Tanzania's largest mobile money aggregator) adapter.
 * Covers Mpesa, Tigo Pesa, Airtel Money, Halotel via a single API.
 * API docs: https://developers.selcom.net/docs
 *
 * Onboarding required: commercial agreement with Selcom; get API key + secret.
 * In dev/staging, all calls are stubbed with realistic responses.
 */
@Injectable()
export class SelcomAdapter implements IPaymentAdapter {
  readonly channel = 'mobile_money' as const;
  readonly provider = 'selcom';
  private readonly logger = new Logger(SelcomAdapter.name);

  private get baseUrl(): string {
    return process.env['SELCOM_BASE_URL'] ?? 'https://apigw.selcommobile.com/v1';
  }

  private buildSignature(timestamp: string, body: string): string {
    const hmac = crypto.createHmac('sha256', process.env['SELCOM_API_SECRET'] ?? 'dev-secret');
    return hmac.update(`${timestamp}${body}`).digest('base64');
  }

  private get isStub(): boolean {
    return !process.env['SELCOM_API_KEY'] || process.env['NODE_ENV'] === 'test';
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    if (this.isStub) {
      this.logger.debug(`[SELCOM STUB] Charge ${req.amount} TZS to ${req.payerPhone ?? 'unknown'}, ref: ${req.controlNo}`);
      return {
        success: true,
        providerRef: `stub-selcom-${Date.now()}`,
        requiresRedirect: false,
      };
    }

    const timestamp = new Date().toISOString();
    const body = JSON.stringify({
      utilityref: req.controlNo,
      transid: req.idempotencyKey,
      amount: req.amount.toString(),
      channel: 'MOBILEAPP',
      msisdn: req.payerPhone,
      name: req.payerName ?? '',
      paytype: 'MOBILEAPP',
      currency: 'TZS',
      callback_url: req.callbackUrl,
      buyer_email: '',
      country_code: 'TZ',
      manualmap: false,
    });

    try {
      const resp = await fetch(`${this.baseUrl}/checkout/create-order-minimal`, {
        method: 'POST',
        headers: {
          'API-KEY': process.env['SELCOM_API_KEY'] ?? '',
          Timestamp: timestamp,
          Authorization: `HMAC ${this.buildSignature(timestamp, body)}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      const data = (await resp.json()) as { result: string; message?: string; transid?: string };
      if (data.result !== 'SUCCESS') {
        return { success: false, error: data.message ?? 'Selcom error' };
      }
      return { success: true, providerRef: data.transid };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  async statusCheck(providerRef: string): Promise<ChargeResult> {
    if (this.isStub) return { success: true, providerRef };
    // GET /checkout/order-status?transid=xxx
    const resp = await fetch(`${this.baseUrl}/checkout/order-status?transid=${providerRef}`, {
      headers: { 'API-KEY': process.env['SELCOM_API_KEY'] ?? '' },
    });
    const data = (await resp.json()) as { result: string };
    return { success: data.result === 'SUCCESS', providerRef };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    const body = JSON.parse(payload.rawBody) as {
      utilityref: string;
      transid: string;
      amount: string;
      msisdn: string;
      name: string;
      resultcode: string;
      reference: string;
      transaction_date: string;
    };

    return {
      controlNo: body.utilityref,
      providerRef: body.transid,
      amount: parseInt(body.amount, 10),
      paidAt: new Date(body.transaction_date),
      payerPhone: body.msisdn,
      payerName: body.name,
      status: body.resultcode === '000' ? 'completed' : 'failed',
    };
  }

  async reconcileBatch(_req: ReconcileBatchRequest): Promise<ReconcileEntry[]> {
    if (this.isStub) return [];
    // In production: fetch Selcom settlement report CSV/JSON for the date range
    // and map to ReconcileEntry[]
    this.logger.warn('Selcom reconcileBatch not yet implemented — returning empty');
    return [];
  }
}
