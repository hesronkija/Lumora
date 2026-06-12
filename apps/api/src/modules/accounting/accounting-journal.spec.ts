import { AccountingService } from './accounting.service';
import { BadRequestException } from '@nestjs/common';
import { TenantStorage } from '@lumora/shared-tenancy';

const TENANT = '11111111-1111-1111-1111-111111111111';

function inTenant<T>(fn: () => Promise<T>): Promise<T> {
  return TenantStorage.run(
    { tenantId: TENANT, userId: 'user-1', roles: ['accountant'], scopes: {} },
    fn,
  );
}

describe('double-entry journal validation', () => {
  const fakeClient = {
    query: jest.fn(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('COUNT(*)')) {
        return { rows: [{ count: '0' }], rowCount: 1 };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO journal_entry')) {
        return { rows: [{ id: 'je-1', entry_no: 'JE/2026/00001' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: jest.fn(),
  };
  const fakePool = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM accounting_period')) {
        return { rows: [{ id: 'p-1', status: 'open' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    connect: jest.fn(async () => fakeClient),
  } as never;
  const audit = { log: jest.fn() } as never;
  const svc = new AccountingService(fakePool, audit);

  const base = {
    periodId: 'p-1',
    entryDate: '2026-06-11',
    narrative: 'Term 2 fees received',
    sourceModule: 'manual' as const,
  };

  it('REJECTS an unbalanced journal (DR ≠ CR)', async () => {
    await expect(
      inTenant(() =>
        svc.postJournal(
          {
            ...base,
            lines: [
              { accountId: 'cash', dr: '500000' },
              { accountId: 'fees-income', cr: '450000' },
            ],
          },
          'user-1',
        ),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('REJECTS a single-line journal', async () => {
    await expect(
      inTenant(() =>
        svc.postJournal({ ...base, lines: [{ accountId: 'cash', dr: '0', cr: '0' }] }, 'user-1'),
      ),
    ).rejects.toThrow(/at least 2 lines/);
  });

  it('posts a balanced journal and writes every line atomically', async () => {
    const result = await inTenant(() =>
      svc.postJournal(
        {
          ...base,
          lines: [
            { accountId: 'cash', dr: '500000' },
            { accountId: 'fees-income', cr: '500000' },
          ],
        },
        'user-1',
      ),
    );
    expect(result).toBeDefined();
    const calls = fakeClient.query.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('BEGIN'))).toBe(true);
    expect(calls.filter((s) => s.includes('INSERT INTO journal_line'))).toHaveLength(2);
    expect(calls.some((s) => s.includes('COMMIT'))).toBe(true);
  });

  it('treats omitted dr/cr as zero (decimal-safe)', async () => {
    await expect(
      inTenant(() =>
        svc.postJournal(
          {
            ...base,
            lines: [
              { accountId: 'a', dr: '0.0001' },
              { accountId: 'b', cr: '0.0001' },
            ],
          },
          'user-1',
        ),
      ),
    ).resolves.toBeDefined();
  });
});
