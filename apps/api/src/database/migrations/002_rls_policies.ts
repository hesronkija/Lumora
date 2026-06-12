import type { Knex } from 'knex';

/**
 * Postgres Row-Level Security policies for tenant isolation.
 * Every table with a tenant_id column gets a policy that restricts
 * access to the current tenant set via the session GUC.
 */
export async function up(knex: Knex): Promise<void> {
  // Create application DB roles
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lumora_app') THEN
        CREATE ROLE lumora_app;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lumora_superuser') THEN
        CREATE ROLE lumora_superuser;
      END IF;
    END
    $$;
  `);

  const tenantTables = ['campus', 'user', 'role', 'user_role', 'consent'];

  for (const table of tenantTables) {
    await knex.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);

    // App role sees only its tenant's rows
    await knex.raw(`
      CREATE POLICY tenant_isolation ON "${table}"
        AS RESTRICTIVE
        TO lumora_app
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    `);

    // Superuser bypasses RLS (for migrations, support ops)
    await knex.raw(`
      CREATE POLICY superuser_bypass ON "${table}"
        AS PERMISSIVE
        TO lumora_superuser
        USING (true)
        WITH CHECK (true)
    `);
  }

  // Audit log — app role can INSERT but never UPDATE/DELETE
  await knex.raw(`ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY`);
  await knex.raw(`
    CREATE POLICY audit_insert_only ON "audit_log"
      AS RESTRICTIVE
      FOR INSERT
      TO lumora_app
      WITH CHECK (true)
  `);
  await knex.raw(`
    CREATE POLICY audit_select_own_tenant ON "audit_log"
      AS PERMISSIVE
      FOR SELECT
      TO lumora_app
      USING (
        tenant_id IS NULL
        OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
      )
  `);
  await knex.raw(`
    CREATE POLICY audit_superuser_bypass ON "audit_log"
      AS PERMISSIVE
      TO lumora_superuser
      USING (true)
      WITH CHECK (true)
  `);

  // Tenant table itself — managed only by superuser
  await knex.raw(`ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY`);
  await knex.raw(`
    CREATE POLICY tenant_own ON "tenant"
      AS RESTRICTIVE
      TO lumora_app
      USING (id = current_setting('app.current_tenant_id', true)::uuid)
      WITH CHECK (id = current_setting('app.current_tenant_id', true)::uuid)
  `);
  await knex.raw(`
    CREATE POLICY tenant_superuser_bypass ON "tenant"
      AS PERMISSIVE
      TO lumora_superuser
      USING (true)
      WITH CHECK (true)
  `);
}

export async function down(knex: Knex): Promise<void> {
  const tables = ['tenant', 'campus', 'user', 'role', 'user_role', 'consent', 'audit_log'];
  for (const table of tables) {
    await knex.raw(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS tenant_isolation ON "${table}"`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS superuser_bypass ON "${table}"`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS audit_insert_only ON "${table}"`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS audit_select_own_tenant ON "${table}"`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS audit_superuser_bypass ON "${table}"`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS tenant_own ON "${table}"`).catch(() => null);
    await knex.raw(`DROP POLICY IF EXISTS tenant_superuser_bypass ON "${table}"`).catch(() => null);
  }
}
