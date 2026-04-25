import { Injectable } from '@nestjs/common';
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
 * Cash payment adapter.
 * No external API — records bursar-entered cash receipts with dual-control.
 * The second role confirmation is enforced at the PaymentsService level.
 */
@Injectable()
export class CashAdapter implements IPaymentAdapter {
  readonly channel = 'cash' as const;
  readonly provider = 'cash';

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    // Cash charges are created directly by the bursar in the UI — no external call
    return { success: true, providerRef: `CASH-${req.idempotencyKey}` };
  }

  async statusCheck(providerRef: string): Promise<ChargeResult> {
    return { success: true, providerRef };
  }

  async handleWebhook(_payload: WebhookPayload): Promise<WebhookResult> {
    throw new Error('Cash adapter does not handle webhooks');
  }

  async reconcileBatch(_req: ReconcileBatchRequest): Promise<ReconcileEntry[]> {
    return []; // Cash is recorded in real time; no batch reconciliation needed
  }
}
