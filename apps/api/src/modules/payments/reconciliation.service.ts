import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { SelcomAdapter } from './adapters/selcom.adapter';
import { BankAdapter } from './adapters/bank.adapter';
import { GepgAdapter } from './adapters/gepg.adapter';
import type { ReconcileEntry } from './adapters/payment-adapter.interface';
import { v4 as uuidv4 } from 'uuid';
import { runAsTenant } from '@lumora/shared-tenancy';

/**
 * Nightly reconciliation engine.
 * Production deployment: triggered by a Temporal workflow in apps/workers.
 * Dev/test: callable directly via the admin API endpoint.
 *
 * Algorithm per tenant:
 *  1. Pull settlement entries from each adapter for T-1 day.
 *  2. Match by control_no → amount.
 *  3. Auto-post matched entries as completed payments.
 *  4. Quarantine ambiguous entries for bursar review (ai_suggestions populated by A3).
 *  5. Return run summary.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly selcom: SelcomAdapter,
    private readonly gepg: GepgAdapter,
  ) {}

  async runForTenant(tenantId: string, runDate: Date): Promise<{
    runId: string;
    matched: number;
    unmatched: number;
    ambiguous: number;
  }> {
    const fromDate = new Date(runDate);
    fromDate.setDate(fromDate.getDate() - 1);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(fromDate);
    toDate.setHours(23, 59, 59, 999);

    // Works both inside a request and from workers/schedulers: the tenant
    // context is forced explicitly so the TenantAwarePool applies RLS.
    return runAsTenant(tenantId, async () => {
    const client = await this.pool.connect();
    try {

      const { rows: runRows } = await client.query(
        `INSERT INTO reconciliation_run (id, tenant_id, run_date, status)
         VALUES ($1,$2,$3,'running') RETURNING id`,
        [uuidv4(), tenantId, fromDate.toISOString().split('T')[0]],
      );
      const runId = runRows[0].id as string;

      let matched = 0;
      let unmatched = 0;
      let ambiguous = 0;

      const entries = await this.fetchAllEntries({ fromDate, toDate });

      for (const entry of entries) {
        const result = await this.processEntry(client, tenantId, runId, entry);
        if (result === 'matched') matched++;
        else if (result === 'ambiguous') ambiguous++;
        else unmatched++;
      }

      await client.query(
        `UPDATE reconciliation_run
         SET status = 'completed', matched = $1, unmatched = $2, ambiguous = $3, completed_at = NOW()
         WHERE id = $4`,
        [matched, unmatched, ambiguous, runId],
      );

      this.logger.log(`Reconciliation ${runId}: matched=${matched} unmatched=${unmatched} ambiguous=${ambiguous}`);
      return { runId, matched, unmatched, ambiguous };
    } catch (err) {
      this.logger.error(`Reconciliation failed for tenant ${tenantId}:`, err);
      throw err;
    } finally {
      client.release();
    }
    });
  }

  private async fetchAllEntries(req: { fromDate: Date; toDate: Date }): Promise<Array<ReconcileEntry & { source: string }>> {
    const [selcomEntries, gepgEntries] = await Promise.all([
      this.selcom.reconcileBatch(req).then(e => e.map(x => ({ ...x, source: 'selcom' }))),
      this.gepg.reconcileBatch(req).then(e => e.map(x => ({ ...x, source: 'gepg' }))),
    ]);
    return [...selcomEntries, ...gepgEntries];
  }

  private async processEntry(
    client: PoolClient,
    tenantId: string,
    runId: string,
    entry: ReconcileEntry & { source: string },
  ): Promise<'matched' | 'ambiguous' | 'unmatched'> {
    let matchStatus: 'matched' | 'ambiguous' | 'unmatched' = 'unmatched';
    let paymentId: string | null = null;

    if (entry.controlNo) {
      const { rows } = await client.query(
        `SELECT p.id, p.status, p.amount FROM payment p
         JOIN invoice i ON i.id = p.invoice_id
         WHERE i.control_no = $1 AND i.tenant_id = $2 AND p.status = 'pending'`,
        [entry.controlNo, tenantId],
      );

      if (rows.length === 1) {
        const payment = rows[0] as { id: string; amount: string };
        const tolerance = 1; // TZS 1 rounding tolerance
        const diff = Math.abs(entry.amount - parseFloat(payment.amount));
        if (diff <= tolerance) {
          await client.query(
            `UPDATE payment SET status = 'completed', paid_at = $1, provider_ref = $2, updated_at = NOW() WHERE id = $3`,
            [entry.txnDate, entry.externalRef, payment.id],
          );
          paymentId = payment.id;
          matchStatus = 'matched';
        } else {
          matchStatus = 'ambiguous'; // Amount mismatch
        }
      } else if (rows.length > 1) {
        matchStatus = 'ambiguous'; // Multiple candidates
      }
    } else if (entry.payerMsisdn) {
      // Fuzzy match by phone — mark ambiguous for bursar + A3 AI assist
      matchStatus = 'ambiguous';
    }

    await client.query(
      `INSERT INTO reconciliation_item
        (id, tenant_id, run_id, source, external_ref, control_no, payer_msisdn, amount, txn_date, match_status, payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        uuidv4(), tenantId, runId,
        entry.source, entry.externalRef,
        entry.controlNo ?? null, entry.payerMsisdn ?? null,
        entry.amount.toFixed(4), entry.txnDate,
        matchStatus, paymentId,
      ],
    );

    return matchStatus;
  }

  async listRuns(limit = 30) {
    const { rows } = await this.pool.query(
      `SELECT * FROM reconciliation_run ORDER BY run_date DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async listAmbiguousItems(runId?: string) {
    const where = runId ? `AND ri.run_id = $1` : '';
    const params = runId ? [runId] : [];
    const { rows } = await this.pool.query(
      `SELECT ri.*, rr.run_date FROM reconciliation_item ri
       JOIN reconciliation_run rr ON rr.id = ri.run_id
       WHERE ri.match_status = 'ambiguous' ${where}
       ORDER BY ri.created_at DESC`,
      params,
    );
    return rows;
  }

  async confirmAmbiguousItem(itemId: string, paymentId: string) {
    await this.pool.query(
      `UPDATE reconciliation_item
       SET match_status = 'matched', payment_id = $1, bursar_confirmed = true, updated_at = NOW()
       WHERE id = $2`,
      [paymentId, itemId],
    );
    await this.pool.query(
      `UPDATE payment SET status = 'completed', paid_at = NOW() WHERE id = $1`,
      [paymentId],
    );
    return { confirmed: true };
  }
}
