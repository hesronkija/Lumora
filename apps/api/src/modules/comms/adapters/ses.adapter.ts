import { Injectable, Logger } from '@nestjs/common';

export interface EmailRequest {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface EmailResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * AWS SES email adapter.
 * In production, uses IAM role credentials. In dev, logs to console.
 */
@Injectable()
export class SesAdapter {
  private readonly logger = new Logger(SesAdapter.name);

  async send(req: EmailRequest): Promise<EmailResult> {
    if (process.env['NODE_ENV'] === 'development') {
      this.logger.debug(`[SES STUB] Email to ${req.to}: ${req.subject}`);
      return { success: true, providerMessageId: `stub-email-${Date.now()}` };
    }

    // Production: use @aws-sdk/client-ses
    // Kept as stub to avoid adding AWS SDK dependency before credentials are configured
    try {
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
      const client = new SESClient({ region: process.env['SES_REGION'] ?? 'af-south-1' });

      const result = await client.send(
        new SendEmailCommand({
          Source: process.env['SES_FROM_ADDRESS'] ?? 'noreply@lumora.app',
          Destination: { ToAddresses: [req.to] },
          Message: {
            Subject: { Data: req.subject },
            Body: {
              Html: { Data: req.htmlBody },
              ...(req.textBody && { Text: { Data: req.textBody } }),
            },
          },
        }),
      );

      return { success: true, ...(result.MessageId ? { providerMessageId: result.MessageId } : {}) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SES error';
      return { success: false, error: msg };
    }
  }
}
