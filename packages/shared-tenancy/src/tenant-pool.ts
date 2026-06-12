import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { TenantStorage, type TenantContext } from './tenant-context';

/**
 * Minimal querying surface shared by `pg.Pool`, `TenantAwarePool`
 * and `SystemPool`. Services depend on this shape only.
 */
export interface TenantQueryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<R>>;
  connect(): Promise<PoolClient>;
}

const SYSTEM_CONTEXT: Omit<TenantContext, 'tenantId'> = {
  userId: 'system',
  roles: ['system'],
  scopes: {},
};

/**
 * Runs `fn` with the tenant context forced to the given tenant.
 * Used by webhook handlers, schedulers and workers that act on behalf
 * of a tenant without an authenticated user request.
 */
export function runAsTenant<T>(tenantId: string, fn: () => T): T {
  return TenantStorage.run({ tenantId, ...SYSTEM_CONTEXT }, fn);
}

async function setSessionGUCs(
  client: PoolClient,
  gucs: Record<string, string>,
  local: boolean,
): Promise<void> {
  const entries = Object.entries(gucs);
  const selects = entries
    .map((_, i) => `set_config($${i * 2 + 1}, $${i * 2 + 2}, ${local ? 'true' : 'false'})`)
    .join(', ');
  await client.query(`SELECT ${selects}`, entries.flat());
}

function patchReleaseWithReset(client: PoolClient, gucNames: string[]): PoolClient {
  const anyClient = client as PoolClient & { release: (err?: Error | boolean) => void };
  const originalRelease = anyClient.release.bind(anyClient);
  let released = false;
  anyClient.release = (err?: Error | boolean) => {
    if (released) return;
    released = true;
    if (err) {
      // Connection is being destroyed — no need to reset GUCs.
      originalRelease(err);
      return;
    }
    // RESET the session GUCs before returning the connection to the pool. If
    // the RESET itself fails, the connection may still carry this tenant's
    // GUC — so we DESTROY it (release with an error) rather than hand a
    // contaminated connection to the next borrower. Failing safe beats
    // leaking tenant context across the pool.
    client
      .query(gucNames.map((g) => `RESET ${g}`).join('; '))
      .then(() => originalRelease())
      .catch((resetErr: Error) => originalRelease(resetErr));
  };
  return client;
}

/**
 * Pool wrapper that guarantees every statement executes with the
 * Postgres GUC `app.current_tenant_id` set, so Row-Level Security
 * policies actually fire. This is the ONLY pool application modules
 * should use for tenant data.
 *
 * - `query()`  — wraps the statement in a transaction with `SET LOCAL`-style
 *                GUCs (via `set_config(..., true)`).
 * - `connect()` — returns a dedicated client whose session GUCs are set;
 *                they are RESET automatically when the client is released.
 *
 * Throws immediately when called outside a tenant context: failing closed
 * is the point. System-level work (webhooks, cross-tenant jobs) must use
 * `SystemPool` or `runAsTenant()` explicitly.
 */
export class TenantAwarePool implements TenantQueryable {
  constructor(private readonly pool: Pool) {}

  private context(): TenantContext {
    const ctx = TenantStorage.getOrNull();
    if (!ctx?.tenantId) {
      throw new Error(
        'Tenant-scoped DB access outside a tenant context. ' +
          'Use the SYSTEM pool (DB_POOL_SYSTEM) or runAsTenant() for system work.',
      );
    }
    return ctx;
  }

  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<R>> {
    const ctx = this.context();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await setSessionGUCs(
        client,
        { 'app.current_tenant_id': ctx.tenantId, 'app.current_user_id': ctx.userId ?? '' },
        true,
      );
      const result = await client.query<R>(text, params as unknown[]);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async connect(): Promise<PoolClient> {
    const ctx = this.context();
    const client = await this.pool.connect();
    try {
      await setSessionGUCs(
        client,
        { 'app.current_tenant_id': ctx.tenantId, 'app.current_user_id': ctx.userId ?? '' },
        false,
      );
    } catch (err) {
      client.release(err as Error);
      throw err;
    }
    return patchReleaseWithReset(client, ['app.current_tenant_id', 'app.current_user_id']);
  }
}

/**
 * Pool wrapper for deliberate cross-tenant ("system") access:
 * payment webhooks before tenant resolution, platform provisioning,
 * health checks, reconciliation batch jobs.
 *
 * Sets `app.is_system = 'on'`, which the RLS policies honour explicitly,
 * so every bypass is intentional and auditable in code review
 * (grep for DB_POOL_SYSTEM).
 */
export class SystemPool implements TenantQueryable {
  constructor(private readonly pool: Pool) {}

  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<R>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await setSessionGUCs(client, { 'app.is_system': 'on' }, true);
      const result = await client.query<R>(text, params as unknown[]);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async connect(): Promise<PoolClient> {
    const client = await this.pool.connect();
    try {
      await setSessionGUCs(client, { 'app.is_system': 'on' }, false);
    } catch (err) {
      client.release(err as Error);
      throw err;
    }
    return patchReleaseWithReset(client, ['app.is_system']);
  }
}
