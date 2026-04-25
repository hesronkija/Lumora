/**
 * Nightly reconciliation Temporal workflow.
 * Scheduled at 02:00 EAT (23:00 UTC) via Temporal cron schedule.
 *
 * For each active tenant, pulls the previous day's settlement data
 * from all payment adapters and runs the reconciliation engine.
 */

import { proxyActivities } from '@temporalio/workflow';
import type { ReconciliationActivities } from '../activities/reconciliation.activities';

const { getActiveTenants, runTenantReconciliation, sendBreakReport } = proxyActivities<ReconciliationActivities>({
  startToCloseTimeout: '30 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '30 seconds',
    backoffCoefficient: 2,
  },
});

export async function nightlyReconciliationWorkflow(runDate?: string): Promise<void> {
  const date = runDate ? new Date(runDate) : new Date();
  const tenants = await getActiveTenants();

  for (const tenantId of tenants) {
    try {
      const summary = await runTenantReconciliation({ tenantId, runDate: date.toISOString() });

      if (summary.ambiguous > 0 || summary.unmatched > 0) {
        await sendBreakReport({
          tenantId,
          runId: summary.runId,
          ambiguous: summary.ambiguous,
          unmatched: summary.unmatched,
        });
      }
    } catch {
      // Log but don't fail the whole workflow for one tenant's failure
      // Temporal will capture the error in the workflow history
    }
  }
}
