import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { TenantStorage } from '@lumora/shared-tenancy';
import { BeemAdapter } from './adapters/beem.adapter';
import { SesAdapter } from './adapters/ses.adapter';
import { v4 as uuidv4 } from 'uuid';
import Handlebars from 'handlebars';

export interface SendMessageDto {
  recipientRef: string;
  channel: 'sms' | 'whatsapp' | 'email' | 'push';
  templateKey: string;
  locale?: string;
  vars?: Record<string, unknown>;
}

@Injectable()
export class CommsService {
  private readonly templates = new Map<string, string>([
    // Built-in templates — locale:channel:key
    ['en-TZ:sms:system.welcome', 'Welcome to {{schoolName}}, {{name}}! Log in at {{url}}'],
    ['en-TZ:sms:fees.payment_received', 'Payment of TZS {{amount}} received for {{studentName}}. Receipt: {{receiptNo}}. Thank you — {{schoolName}}'],
    ['en-TZ:email:system.welcome', '<h2>Welcome to {{schoolName}}</h2><p>Dear {{name}},</p><p>Your account is ready.</p>'],
  ]);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly beem: BeemAdapter,
    private readonly ses: SesAdapter,
  ) {}

  async send(dto: SendMessageDto): Promise<{ messageId: string }> {
    const { tenantId } = TenantStorage.get();
    const locale = dto.locale ?? 'en-TZ';

    // Check consent
    const hasConsent = await this.checkConsent(tenantId, dto.recipientRef, dto.channel);
    if (!hasConsent) {
      throw new BadRequestException(
        `Recipient ${dto.recipientRef} has not opted in to ${dto.channel}`,
      );
    }

    // Check daily rate budget
    await this.checkAndIncrementBudget(tenantId, dto.channel);

    // Render template
    const templateKey = `${locale}:${dto.channel}:${dto.templateKey}`;
    const template = this.templates.get(templateKey);
    if (!template) {
      throw new BadRequestException(`Template not found: ${templateKey}`);
    }
    const rendered = Handlebars.compile(template)(dto.vars ?? {});

    // Send
    const messageId = uuidv4();
    let providerMessageId: string | undefined;
    let status: 'sent' | 'failed' = 'failed';
    let error: string | undefined;
    let costTzs = 0;

    if (dto.channel === 'sms') {
      const result = await this.beem.send({ to: dto.recipientRef, body: rendered });
      status = result.success ? 'sent' : 'failed';
      providerMessageId = result.providerMessageId;
      error = result.error;
      costTzs = result.costTzs;
    } else if (dto.channel === 'email') {
      const result = await this.ses.send({
        to: dto.recipientRef,
        subject: `Message from your school`,
        htmlBody: rendered,
      });
      status = result.success ? 'sent' : 'failed';
      providerMessageId = result.providerMessageId;
      error = result.error;
    }

    // Record in DB
    await this.pool.query(
      `INSERT INTO message
        (id, tenant_id, recipient_ref, channel, template_key, locale, vars, rendered_body,
         status, provider_message_id, error_message, cost_tzs, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        messageId, tenantId, dto.recipientRef, dto.channel, dto.templateKey,
        locale, JSON.stringify(dto.vars ?? {}), rendered, status,
        providerMessageId ?? null, error ?? null, costTzs,
      ],
    );

    return { messageId };
  }

  async recordConsent(
    subjectRef: string,
    channel: 'sms' | 'whatsapp' | 'email' | 'push',
    status: 'opted_in' | 'opted_out',
    evidence: string,
  ): Promise<void> {
    const { tenantId } = TenantStorage.get();
    await this.pool.query(
      `INSERT INTO consent (id, tenant_id, subject_ref, channel, status, evidence, consented_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (tenant_id, subject_ref, channel) DO UPDATE
         SET status = EXCLUDED.status,
             evidence = EXCLUDED.evidence,
             consented_at = CASE WHEN EXCLUDED.status = 'opted_in' THEN NOW() ELSE consent.consented_at END,
             revoked_at = CASE WHEN EXCLUDED.status = 'opted_out' THEN NOW() ELSE NULL END`,
      [uuidv4(), tenantId, subjectRef, channel, status, evidence],
    );
  }

  private async checkConsent(tenantId: string, subjectRef: string, channel: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT status FROM consent
       WHERE tenant_id = $1 AND subject_ref = $2 AND channel = $3`,
      [tenantId, subjectRef, channel],
    );
    return rows[0]?.status === 'opted_in';
  }

  private async checkAndIncrementBudget(tenantId: string, channel: string): Promise<void> {
    const { rows } = await this.pool.query(
      `INSERT INTO comms_budget (id, tenant_id, date, channel, count, daily_limit)
       VALUES ($1, $2, CURRENT_DATE, $3, 1, 1000)
       ON CONFLICT (tenant_id, date, channel) DO UPDATE
         SET count = comms_budget.count + 1
       RETURNING count, daily_limit`,
      [uuidv4(), tenantId, channel],
    );
    const row = rows[0] as { count: number; daily_limit: number } | undefined;
    if (row && row.count > row.daily_limit) {
      throw new BadRequestException(
        `Daily ${channel} budget exceeded for this tenant`,
      );
    }
  }
}
