import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

export interface ReconciliationActivities {
  getActiveTenants(): Promise<string[]>;
  runTenantReconciliation(args: { tenantId: string; runDate: string }): Promise<{
    runId: string;
    matched: number;
    unmatched: number;
    ambiguous: number;
  }>;
  sendBreakReport(args: {
    tenantId: string;
    runId: string;
    ambiguous: number;
    unmatched: number;
  }): Promise<void>;
}

export const reconciliationActivities: ReconciliationActivities = {
  async getActiveTenants(): Promise<string[]> {
    const { rows } = await pool.query(
      `SELECT id FROM tenant WHERE active = true ORDER BY created_at`,
    );
    return rows.map((r: { id: string }) => r.id);
  },

  async runTenantReconciliation({ tenantId, runDate }): Promise<{
    runId: string;
    matched: number;
    unmatched: number;
    ambiguous: number;
  }> {
    // Import here to avoid circular deps in the Temporal sandbox
    const { ReconciliationService } = await import('../../api-bridge/reconciliation-bridge');
    const svc = new ReconciliationService(pool);
    return svc.runForTenant(tenantId, new Date(runDate));
  },

  async sendBreakReport({ tenantId, runId, ambiguous, unmatched }): Promise<void> {
    // Fetch tenant admin email, then send via Comms module (SES)
    const { rows } = await pool.query(
      `SELECT u.email FROM user u
       JOIN user_role ur ON ur.user_id = u.id
       JOIN role r ON r.id = ur.role_id
       WHERE u.tenant_id = $1 AND r.code IN ('owner', 'bursar')
       LIMIT 3`,
      [tenantId],
    );

    if (!rows.length) return;

    const emails = rows.map((r: { email: string }) => r.email).join(', ');
    console.info(
      `Break report for tenant ${tenantId}: run=${runId}, ambiguous=${ambiguous}, unmatched=${unmatched}. Notify: ${emails}`,
    );
    // Full email dispatch wired when CommsService is available to workers
  },
};
