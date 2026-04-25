/**
 * Gateway-agnostic payment adapter interface.
 * Every payment adapter must implement this contract.
 * The PaymentsService routes to the correct adapter based on the request.
 */

export interface ChargeRequest {
  idempotencyKey: string;
  amount: number; // integer TZS
  currency: 'TZS';
  payerPhone?: string;
  payerName?: string;
  controlNo: string;
  description: string;
  callbackUrl: string;
}

export interface ChargeResult {
  success: boolean;
  providerRef?: string;
  providerTransactionId?: string;
  error?: string;
  requiresRedirect?: boolean;
  redirectUrl?: string;
}

export interface WebhookPayload {
  rawBody: string;
  headers: Record<string, string>;
}

export interface WebhookResult {
  controlNo: string;
  providerRef: string;
  amount: number;
  paidAt: Date;
  payerPhone?: string;
  payerName?: string;
  status: 'completed' | 'failed' | 'reversed';
}

export interface ReconcileBatchRequest {
  fromDate: Date;
  toDate: Date;
}

export interface ReconcileEntry {
  externalRef: string;
  controlNo?: string;
  payerMsisdn?: string;
  amount: number;
  txnDate: Date;
}

export interface IPaymentAdapter {
  readonly channel: 'mobile_money' | 'bank' | 'gepg' | 'cash';
  readonly provider: string;

  createCharge(req: ChargeRequest): Promise<ChargeResult>;
  statusCheck(providerRef: string): Promise<ChargeResult>;
  handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;
  reconcileBatch(req: ReconcileBatchRequest): Promise<ReconcileEntry[]>;
}
