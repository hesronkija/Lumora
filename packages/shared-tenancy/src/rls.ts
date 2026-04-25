import type { PoolClient } from 'pg';
import { TenantStorage } from './tenant-context';

/**
 * Sets the Postgres session GUC so RLS policies fire correctly.
 * Must be called at the start of every DB transaction in a tenant request.
 *
 * RLS policies use: current_setting('app.current_tenant_id', true)
 */
export async function setTenantGUC(client: PoolClient, tenantId?: string): Promise<void> {
  const id = tenantId ?? TenantStorage.getTenantId();
  await client.query(`SET LOCAL app.current_tenant_id = $1`, [id]);
  await client.query(`SET LOCAL app.current_user_id = $1`, [TenantStorage.get().userId]);
}

/**
 * Runs a callback within a DB transaction with tenant GUC set.
 * This is the primary way to execute tenant-scoped DB work.
 */
export async function withTenantTx<T>(
  client: PoolClient,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await setTenantGUC(client);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * SQL fragments for RLS policies — import these into migration files.
 */
export const RLS_POLICY_SQL = {
  enableRLS: (table: string) => `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,

  createTenantPolicy: (table: string) => `
    CREATE POLICY tenant_isolation ON ${table}
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
  `,

  bypassForSuperuser: (table: string) => `
    CREATE POLICY superuser_bypass ON ${table}
      TO lumora_superuser
      USING (true)
      WITH CHECK (true);
  `,
};
