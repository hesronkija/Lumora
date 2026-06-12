import { Injectable, Logger } from '@nestjs/common';

export interface SmsRequest {
  to: string; // E.164 format e.g. +255712345678
  body: string;
}

export interface SmsResult {
  success: boolean;
  providerMessageId?: string;
  costTzs: number;
  error?: string;
}

/**
 * Beem Africa SMS adapter.
 * API docs: https://apisms.beem.africa/v1/send
 */
@Injectable()
export class BeemAdapter {
  private readonly logger = new Logger(BeemAdapter.name);

  private get baseUrl(): string {
    return process.env['BEEM_BASE_URL'] ?? 'https://apisms.beem.africa/v1';
  }

  private get authHeader(): string {
    const key = process.env['BEEM_API_KEY'] ?? '';
    const secret = process.env['BEEM_SECRET_KEY'] ?? '';
    return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
  }

  private get senderName(): string {
    return process.env['BEEM_SENDER_NAME'] ?? 'LUMORA';
  }

  async send(req: SmsRequest): Promise<SmsResult> {
    if (process.env['NODE_ENV'] === 'development' && !process.env['BEEM_API_KEY']) {
      this.logger.debug(`[BEEM STUB] SMS to ${req.to}: ${req.body}`);
      return { success: true, providerMessageId: `stub-${Date.now()}`, costTzs: 25 };
    }

    try {
      const response = await fetch(`${this.baseUrl}/send`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_addr: this.senderName,
          encoding: 0,
          message: req.body,
          recipients: [{ recipient_id: '1', dest_addr: req.to }],
        }),
      });

      const data = (await response.json()) as {
        successful: boolean;
        message_id?: string;
        error?: string;
      };

      if (!response.ok || !data.successful) {
        return { success: false, error: data.error ?? 'Beem API error', costTzs: 0 };
      }

      return {
        success: true,
        ...(data.message_id ? { providerMessageId: data.message_id } : {}),
        costTzs: 25, // ~TZS 25 per SMS; will be reconciled with Beem billing
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Beem send failed: ${msg}`);
      return { success: false, error: msg, costTzs: 0 };
    }
  }
}
