import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { FeesService } from '../fees/fees.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import { SelcomAdapter } from './adapters/selcom.adapter';
import { BankAdapter } from './adapters/bank.adapter';
import { GepgAdapter } from './adapters/gepg.adapter';
import { CashAdapter } from './adapters/cash.adapter';
import { VfmsAdapter } from './adapters/vfms.adapter';
import type { IPaymentAdapter, WebhookPayload } from './adapters/payment-adapter.interface';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

export interface InitiatePaymentDto {
  invoiceId: string;
  amount: string; // decimal string in TZS
  channel: 'mobile_money' | 'bank' | 'gepg' | 'cash';
  provider?: 'selcom' | 'nmb' | 'crdb' | 'gepg' | 'cash';
  payerPhone?: string;
  payerName?: string;
  idempotencyKey: string;
}

export interface ConfirmCashDto {
  paymentId: string;
  confirmedByUserId: string;
}

@Injectable()
export class PaymentsService {
  private readonly adapters: Map<string, IPaymentAdapter>;

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
    private readonly feesService: FeesService,
    private readonly selcom: SelcomAdapter,
    private readonly gepg: GepgAdapter,
    private readonly cash: CashAdapter,
    private readonly vfms: VfmsAdapter,
  ) {
    const nmb = new BankAdapter('nmb');
    const crdb = new BankAdapter('crdb');
    this.adapters = new Map<string, IPaymentAdapter>([
      ['selcom', selcom],
      ['nmb', nmb],
      ['crdb', crdb],
      ['gepg', gepg],
      ['cash', cash],
    ]);
  }

  private getAdapter(channel: string, provider?: string): IPaymentAdapter {
    const key = provider ?? channel;
    const adapter = this.adapters.get(key);
    if (!adapter) throw new BadRequestException(`Unsupported payment provider: ${key}`);
    return adapter;
  }

  async initiatePayment(dto: InitiatePaymentDto) {
    const { tenantId } = TenantStorage.get();

    // Idempotency check
    const existing = await this.pool.query(
      `SELECT * FROM payment WHERE idempotency_key = $1`,
      [dto.idempotencyKey],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return existing.rows[0];
    }

    const invoice = await this.feesService.getInvoice(dto.invoiceId);
    if (invoice.status === 'paid' || invoice.status === 'void') {
      throw new ConflictException(`Invoice is already ${invoice.status as string}`);
    }

    const amount = new Decimal(dto.amount);
    const adapter = this.getAdapter(dto.channel, dto.provider);

    const callbackUrl = `${process.env['API_BASE_URL'] ?? 'http://localhost:3000'}/api/v1/payments/webhook/${adapter.provider}`;

    const chargeResult = await adapter.createCharge({
      idempotencyKey: dto.idempotencyKey,
      amount: amount.toInteger().toNumber(),
      currency: 'TZS',
      payerPhone: dto.payerPhone,
      payerName: dto.payerName,
      controlNo: invoice.control_no as string,
      description: `Fee payment: ${invoice.invoice_no as string}`,
      callbackUrl,
    });

    const { rows } = await this.pool.query(
      `INSERT INTO payment
        (id, tenant_id, invoice_id, amount, channel, provider, provider_ref, idempotency_key, status, payer_phone, payer_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        uuidv4(), tenantId, dto.invoiceId,
        amount.toFixed(4), dto.channel, adapter.provider,
        chargeResult.providerRef ?? null, dto.idempotencyKey,
        chargeResult.success ? 'pending' : 'failed',
        dto.payerPhone ?? null, dto.payerName ?? null,
      ],
    );

    await this.audit.log({
      action: 'payment.initiate',
      resource: 'payment',
      resourceId: rows[0].id,
      after: { channel: dto.channel, amount: amount.toFixed(2), success: chargeResult.success },
    });

    return rows[0];
  }

  async handleWebhook(providerKey: string, payload: WebhookPayload) {
    const adapter = this.adapters.get(providerKey);
    if (!adapter) throw new NotFoundException(`Unknown provider: ${providerKey}`);

    const result = await adapter.handleWebhook(payload);
    if (result.status !== 'completed') return { processed: false, status: result.status };

    // Look up payment by control number
    const { rows: invoiceRows } = await this.pool.query(
      `SELECT * FROM invoice WHERE control_no = $1`,
      [result.controlNo],
    );
    const invoice = invoiceRows[0];
    if (!invoice) return { processed: false, reason: 'invoice_not_found' };

    const { rows: paymentRows } = await this.pool.query(
      `SELECT * FROM payment WHERE provider_ref = $1`,
      [result.providerRef],
    );

    let paymentId: string;
    if (paymentRows[0]) {
      // Update existing pending payment
      await this.pool.query(
        `UPDATE payment SET status = 'completed', paid_at = $1, updated_at = NOW() WHERE id = $2`,
        [result.paidAt, paymentRows[0].id],
      );
      paymentId = paymentRows[0].id as string;
    } else {
      // Webhook arrived without a preceding initiate (e.g. direct bank payment)
      const { rows } = await this.pool.query(
        `INSERT INTO payment
          (id, tenant_id, invoice_id, amount, channel, provider, provider_ref, idempotency_key, status, payer_phone, payer_name, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9,$10,$11)
         RETURNING id`,
        [
          uuidv4(), invoice.tenant_id, invoice.id,
          result.amount.toFixed(4), adapter.channel, adapter.provider,
          result.providerRef, `wh-${result.providerRef}`,
          result.payerPhone ?? null, result.payerName ?? null, result.paidAt,
        ],
      );
      paymentId = rows[0].id as string;
    }

    await this.feesService.updatePaymentBalance(invoice.id as string, new Decimal(result.amount));

    // Issue TRA fiscal receipt for VRN schools (best-effort, non-blocking)
    this.issueFiscalReceiptIfRequired(invoice, result.amount, paymentId, adapter.channel).catch(() => null);

    await this.audit.log({
      action: 'payment.completed',
      resource: 'payment',
      resourceId: paymentId,
      after: { providerRef: result.providerRef, amount: result.amount, paidAt: result.paidAt },
    });

    return { processed: true, paymentId };
  }

  private async issueFiscalReceiptIfRequired(
    invoice: Record<string, unknown>,
    amount: number,
    paymentId: string,
    channel: string,
  ): Promise<void> {
    const { rows: tenantRows } = await this.pool.query(
      `SELECT vrn FROM tenant WHERE id = $1`,
      [invoice['tenant_id']],
    );
    const vrn = tenantRows[0]?.vrn as string | undefined;
    if (!vrn) return; // No VRN = no VFD required

    const receipt = await this.vfms.issueFiscalReceipt({
      tenantVrn: vrn,
      invoiceNo: invoice['invoice_no'] as string,
      amount,
      payerName: 'Guardian',
      paymentChannel: channel as 'mobile_money' | 'bank' | 'cash' | 'gepg',
      items: [{ label: 'School Fees', quantity: 1, unitPrice: amount, taxCode: 'A' }],
    });

    if (receipt) {
      await this.pool.query(
        `UPDATE payment SET fiscal_receipt_no = $1 WHERE id = $2`,
        [receipt.receiptNo, paymentId],
      );
    }
  }

  async confirmCashPayment(dto: ConfirmCashDto) {
    const { rows } = await this.pool.query(
      `SELECT * FROM payment WHERE id = $1 AND channel = 'cash'`,
      [dto.paymentId],
    );
    const payment = rows[0];
    if (!payment) throw new NotFoundException('Cash payment not found');
    if (payment.dual_control_confirmed) throw new ConflictException('Already confirmed');

    await this.pool.query(
      `UPDATE payment
       SET dual_control_confirmed = true, confirmed_by = $1, status = 'completed', paid_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [dto.confirmedByUserId, dto.paymentId],
    );

    await this.feesService.updatePaymentBalance(
      payment.invoice_id as string,
      new Decimal(payment.amount as string),
    );

    await this.audit.log({
      action: 'payment.cash_confirmed',
      resource: 'payment',
      resourceId: dto.paymentId,
      after: { confirmedBy: dto.confirmedByUserId },
    });

    return { confirmed: true };
  }

  async getPayment(paymentId: string) {
    const { rows } = await this.pool.query(
      `SELECT p.*, i.invoice_no, i.control_no, s.legal_name AS student_name
       FROM payment p
       JOIN invoice i ON i.id = p.invoice_id
       JOIN student s ON s.id = i.student_id
       WHERE p.id = $1`,
      [paymentId],
    );
    if (!rows[0]) throw new NotFoundException('Payment not found');
    return rows[0];
  }

  async listPayments(invoiceId?: string, status?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (invoiceId) { conditions.push(`p.invoice_id = $${idx++}`); params.push(invoiceId); }
    if (status) { conditions.push(`p.status = $${idx++}`); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT p.*, i.invoice_no, i.control_no
       FROM payment p
       JOIN invoice i ON i.id = p.invoice_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT 200`,
      params,
    );
    return rows;
  }

  async statusCheck(paymentId: string) {
    const payment = await this.getPayment(paymentId);
    if (payment.status === 'completed' || !payment.provider_ref) return payment;

    const adapter = this.adapters.get(payment.provider as string);
    if (!adapter) return payment;

    const result = await adapter.statusCheck(payment.provider_ref as string);
    if (result.success && payment.status === 'pending') {
      await this.pool.query(
        `UPDATE payment SET status = 'completed', paid_at = NOW() WHERE id = $1`,
        [paymentId],
      );
      return { ...payment, status: 'completed' };
    }
    return payment;
  }
}
