import { Worker, NativeConnection } from '@temporalio/worker';
import { reconciliationActivities } from './activities/reconciliation.activities';

async function main() {
  const connection = await NativeConnection.connect({
    address: process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env['TEMPORAL_NAMESPACE'] ?? 'lumora',
    taskQueue: 'reconciliation',
    workflowsPath: require.resolve('./workflows/nightly-reconciliation.workflow'),
    activities: reconciliationActivities,
  });

  console.info('Lumora workers started. Task queue: reconciliation');
  await worker.run();
}

main().catch((err) => {
  console.error('Worker fatal error:', err);
  process.exit(1);
});
