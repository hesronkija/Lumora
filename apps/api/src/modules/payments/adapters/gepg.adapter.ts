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
 * Government Electronic Payment Gateway (GePG) adapter.
 * Required for ALL public primary schools collecting GoT-designated fees.
 * MoF onboarding: https://gepg.go.tz — obtain SP Code, API key.
 * Control numbers are issued by GePG (not generated locally).
 *
 * Onboarding has multi-week lead time — start in Phase 0.
 */
@Injectable()
export class GepgAdapter implements IPaymentAdapter {
  readonly channel = 'gepg' as const;
  readonly provider = 'gepg';
  private readonly logger = new Logger(GepgAdapter.name);

  private get isStub(): boolean {
    return !process.env['GEPG_SP_CODE'] || process.env['NODE_ENV'] === 'test';
  }

  async createCharge(req: ChargeRequest): Promise<ChargeResult> {
    if (this.isStub) {
      this.logger.debug(`[GEPG STUB] Bill request for control no ${req.controlNo}`);
      return { success: true, providerRef: `gepg-stub-${Date.now()}` };
    }

    // POST to GePG /payment/billsubmit with SP code + bill details
    // GePG returns a bill reference number; parent uses control number to pay via any GePG channel
    this.logger.log(`GePG createCharge not implemented — awaiting MoF onboarding`);
    return { success: false, error: 'GePG onboarding pending' };
  }

  async statusCheck(providerRef: string): Promise<ChargeResult> {
    if (this.isStub) return { success: true, providerRef };
    return { success: false, error: 'Not implemented' };
  }

  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    // GePG sends XML callback; parse accordingly
    const body = JSON.parse(payload.rawBody) as {
      control_number: string;
      psp_receipt_number: string;
      paid_amount: string;
      payer_cell_num: string;
      payer_name: string;
      payer_email: string;
      payment_date: string;
    };

    return {
      controlNo: body.control_number,
      providerRef: body.psp_receipt_number,
      amount: parseInt(body.paid_amount, 10),
      paidAt: new Date(body.payment_date),
      payerPhone: body.payer_cell_num,
      payerName: body.payer_name,
      status: 'completed',
    };
  }

  async reconcileBatch(_req: ReconcileBatchRequest): Promise<ReconcileEntry[]> {
    if (this.isStub) return [];
    // Fetch GePG reconciliation file from MoF SFTP endpoint
    this.logger.warn('GePG reconcileBatch not yet implemented');
    return [];
  }

  /**
   * Request a control number from GePG for a GoT fee.
   * Called before invoice issuance for public primary students.
   */
  async requestControlNumber(data: {
    spCode: string;
    billRef: string;
    amount: number;
    payerName: string;
    payerPhone: string;
    expiryDate: string;
  }): Promise<string | null> {
    if (this.isStub) {
      return `GEPG${data.billRef.replace(/\D/g, '').padStart(8, '0')}`;
    }
    // TODO: Implement GePG control number request when SP code onboarding completes
    this.logger.warn('GePG requestControlNumber: awaiting MoF onboarding');
    return null;
  }
}
