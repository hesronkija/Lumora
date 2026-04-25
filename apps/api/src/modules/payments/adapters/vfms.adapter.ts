import { Injectable, Logger } from '@nestjs/common';

/**
 * TRA Virtual Fiscal Management System (VFMS) adapter.
 * Required for private schools that hold a VRN (VAT Registration Number).
 * Each taxable payment generates a VFD fiscal receipt (PDF + SMS).
 *
 * TRA VFMS API: https://vfms.tra.go.tz (credentials obtained via TRA office).
 * Public primary GoT fees via GePG typically do not require VFD — verify per school VRN status.
 */
@Injectable()
export class VfmsAdapter {
  private readonly logger = new Logger(VfmsAdapter.name);

  private get isStub(): boolean {
    return !process.env['VFMS_SERIAL_NO'] || process.env['NODE_ENV'] === 'test';
  }

  private get baseUrl(): string {
    return process.env['VFMS_BASE_URL'] ?? 'https://vfms.tra.go.tz/api/v1';
  }

  /**
   * Issue a VFD fiscal receipt for a completed payment.
   * Returns the TRA receipt number (stored on the payment record).
   */
  async issueFiscalReceipt(data: {
    tenantVrn: string;
    invoiceNo: string;
    amount: number; // integer TZS
    payerName: string;
    payerPhone?: string;
    paymentChannel: 'mobile_money' | 'bank' | 'cash' | 'gepg';
    items: Array<{ label: string; quantity: number; unitPrice: number; taxCode: string }>;
  }): Promise<{ receiptNo: string; receiptUrl?: string } | null> {
    if (this.isStub) {
      const receiptNo = `TRA-STUB-${Date.now()}`;
      this.logger.debug(`[VFMS STUB] Issued receipt ${receiptNo} for invoice ${data.invoiceNo}`);
      return { receiptNo };
    }

    try {
      const resp = await fetch(`${this.baseUrl}/receipts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'TIN': process.env['VFMS_TIN'] ?? '',
          'SERIAL-NO': process.env['VFMS_SERIAL_NO'] ?? '',
          'EFD-TOKEN': process.env['VFMS_TOKEN'] ?? '',
        },
        body: JSON.stringify({
          vrn: data.tenantVrn,
          invoice_no: data.invoiceNo,
          amount: data.amount,
          payer_name: data.payerName,
          payer_phone: data.payerPhone ?? '',
          payment_channel: data.paymentChannel,
          items: data.items,
        }),
      });

      if (!resp.ok) {
        this.logger.error(`VFMS receipt issuance failed: ${resp.status}`);
        return null;
      }

      const result = (await resp.json()) as { receipt_no: string; receipt_url?: string };
      return { receiptNo: result.receipt_no, receiptUrl: result.receipt_url };
    } catch (err) {
      this.logger.error(`VFMS error: ${err instanceof Error ? err.message : 'unknown'}`);
      return null;
    }
  }
}
