import type { Knex } from 'knex';

// statutory_rate is global (no tenant_id) — no RLS needed
const TENANT_TABLES = [
  'accounting_period',
  'account',
  'journal_entry',
  'journal_line',
  'bank_statement',
  'bank_statement_line',
  'budget',
  'budget_line',
  'payroll_run',
  'payslip',
];

export async function up(knex: Knex): Promise<void> {
  for (const table of TENANT_TABLES) {
    await knex.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`
      CREATE POLICY tenant_isolation ON "${table}"
        AS RESTRICTIVE TO lumora_app
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    `);
    await knex.raw(`
      CREATE POLICY superuser_bypass ON "${table}"
        AS PERMISSIVE TO lumora_superuser
        USING (true) WITH CHECK (true)
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TENANT_TABLES) {
    await knex.raw(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS superuser_bypass ON "${table}"`).catch(() => null);
  }
}
