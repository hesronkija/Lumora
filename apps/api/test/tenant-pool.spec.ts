import { TenantAwarePool, SystemPool, TenantStorage, runAsTenant } from '@lumora/shared-tenancy';

const TENANT = '11111111-1111-1111-1111-111111111111';

function makeFakePool() {
  const log: string[] = [];
  let released = 0;
  const client = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      log.push([typeof sql === 'string' ? sql : String(sql), ...(params ?? [])].join(' | '));
      return { rows: [], rowCount: 0 };
    }),
    release: () => { released += 1; },
  };
  const pool = { connect: jest.fn(async () => client), releasedCount: () => released };
  return { pool, client, log };
}

describe('TenantAwarePool (the RLS enforcement wrapper)', () => {
  it('THROWS outside a tenant context — fail closed', async () => {
    const { pool } = makeFakePool();
    const tap = new TenantAwarePool(pool as never);
    await expect(tap.query('SELECT 1')).rejects.toThrow(/outside a tenant context/);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('wraps query in a transaction with the tenant GUC set', async () => {
    const { pool, log } = makeFakePool();
    const tap = new TenantAwarePool(pool as never);
    await TenantStorage.run(
      { tenantId: TENANT, userId: 'u1', roles: [], scopes: {} },
      () => tap.query('SELECT * FROM student'),
    );
    expect(log[0]).toBe('BEGIN');
    expect(log[1]).toContain('set_config');
    expect(log[2]).toContain('FROM student');
    expect(log[3]).toBe('COMMIT');
  });

  it('rolls back when the statement fails', async () => {
    const { pool, client, log } = makeFakePool();
    client.query.mockImplementation(async (sql: string) => {
      log.push(String(sql));
      if (String(sql).includes('boom')) throw new Error('boom');
      return { rows: [], rowCount: 0 };
    });
    const tap = new TenantAwarePool(pool as never);
    await expect(
      TenantStorage.run(
        { tenantId: TENANT, userId: 'u1', roles: [], scopes: {} },
        () => tap.query('SELECT boom'),
      ),
    ).rejects.toThrow('boom');
    expect(log).toContain('ROLLBACK');
    expect(pool.releasedCount()).toBe(1);
  });

  it('connect() sets session GUCs and RESETs them on release', async () => {
    const { pool, client, log } = makeFakePool();
    const tap = new TenantAwarePool(pool as never);
    const c = await TenantStorage.run(
      { tenantId: TENANT, userId: 'u1', roles: [], scopes: {} },
      () => tap.connect(),
    );
    expect(log[0]).toContain('set_config');
    c.release();
    await new Promise((r) => setTimeout(r, 10));
    expect(log.some((s) => s.includes('RESET app.current_tenant_id'))).toBe(true);
    expect(pool.releasedCount()).toBe(1);
  });
});

describe('SystemPool (deliberate cross-tenant access)', () => {
  it('marks the session as system for RLS policies', async () => {
    const { pool, log } = makeFakePool();
    const sp = new SystemPool(pool as never);
    await sp.query('SELECT * FROM invoice WHERE control_no = $1', ['x']);
    expect(log[1]).toContain('set_config');
    expect(log[1]).toContain('app.is_system');
  });
});

describe('runAsTenant', () => {
  it('establishes a tenant context for system jobs', () => {
    expect(TenantStorage.getOrNull()).toBeUndefined();
    runAsTenant(TENANT, () => {
      expect(TenantStorage.getTenantId()).toBe(TENANT);
      expect(TenantStorage.get().roles).toContain('system');
    });
  });
});
