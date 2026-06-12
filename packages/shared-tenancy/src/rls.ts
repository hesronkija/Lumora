import type { PoolClient } from 'pg';
import { TenantStorage } from './tenant-context';

/**
 * Sets the Postgres session GUC so RLS policies fire correctly.
 * Must be called at the start of every DB transaction in a tenant request.
 *
 * NOTE: `SET LOCAL x = $1` is NOT valid Postgres (SET takes no bind
 * parameters) — always go through set_config().
 *
 * RLS policies use: current_setting('app.current_tenant_id', true)
 */
export async function setTenantGUC(client: PoolClient, tenantId?: string): Promise<void> {
  const ctx = TenantStorage.getOrNull();
  const id = tenantId ?? ctx?.tenantId;
  if (!id) throw new Error('setTenantGUC: no tenant id available');
  await client.query(
    `SELECT set_config('app.current_tenant_id', $1, true), set_config('app.current_user_id', $2, true)`,
    [id, ctx?.userId ?? 'system'],
  );
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
 *
 * The canonical policy is PERMISSIVE and applies TO PUBLIC, combined with
 * FORCE ROW LEVEL SECURITY, so isolation holds no matter which role the
 * app connects as (except true superusers / BYPASSRLS roles, which must
 * never be used by the application in production).
 */
export const RLS_POLICY_SQL = {
  enableRLS: (table: string) =>
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY; ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,

  createTenantPolicy: (table: string) => `
    CREATE POLICY tenant_isolation ON "${table}"
      USING (
        current_setting('app.is_system', true) = 'on'
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      )
      WITH CHECK (
        current_setting('app.is_system', true) = 'on'
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      );
  `,
};
