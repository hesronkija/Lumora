import type { Knex } from 'knex';

/**
 * SECURITY HARDENING — make Row-Level Security actually enforce.
 *
 * The phase 0–4 migrations created policies scoped `TO lumora_app`, a role
 * the application never connected as, and never set FORCE — so the table
 * owner (the role in DATABASE_URL) bypassed RLS entirely. This migration:
 *
 *  1. Drops every existing policy on tenant-scoped tables.
 *  2. Enables + FORCEs RLS on every table that has a tenant_id column,
 *     so the table OWNER is also subject to policies.
 *  3. Creates one canonical PERMISSIVE policy applying TO PUBLIC:
 *       - app.is_system = 'on'  → deliberate system access (webhooks,
 *         provisioning, reconciliation) via the SystemPool wrapper, OR
 *       - tenant_id matches app.current_tenant_id set by TenantAwarePool.
 *  4. Special-cases `tenant` (keyed by id) and `audit_log` (insert-only
 *     for tenants; updates/deletes denied to everyone but system).
 *
 * NOTE: a true Postgres SUPERUSER (or a role with BYPASSRLS) ignores RLS
 * no matter what. Production must connect as a non-superuser role —
 * see docs/runbooks and docker/initdb which create `lumora_app`.
 */

const TENANT_MATCH = `(
  current_setting('app.is_system', true) = 'on'
  OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
)`;

async function dropAllPolicies(knex: Knex, table: string): Promise<void> {
  const { rows } = await knex.raw(
    `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ?`,
    [table],
  );
  for (const row of rows as { policyname: string }[]) {
    await knex.raw(`DROP POLICY IF EXISTS "${row.policyname}" ON "${table}"`);
  }
}

export async function up(knex: Knex): Promise<void> {
  const { rows } = await knex.raw(`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.column_name = 'tenant_id'
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name
  `);
  const tenantTables = (rows as { table_name: string }[]).map((r) => r.table_name);

  for (const table of tenantTables) {
    await dropAllPolicies(knex, table);
    await knex.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);

    if (table === 'audit_log') {
      // Append-only: tenants may INSERT and SELECT their own entries.
      // No UPDATE/DELETE policy exists → denied for everyone under RLS
      // (system included), preserving the audit trail.
      await knex.raw(`
        CREATE POLICY audit_insert ON "audit_log"
          FOR INSERT
          WITH CHECK (
            current_setting('app.is_system', true) = 'on'
            OR tenant_id IS NULL
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          )
      `);
      await knex.raw(`
        CREATE POLICY audit_select ON "audit_log"
          FOR SELECT
          USING (
            current_setting('app.is_system', true) = 'on'
            OR tenant_id IS NULL
            OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          )
      `);
      continue;
    }

    await knex.raw(`
      CREATE POLICY tenant_isolation ON "${table}"
        USING ${TENANT_MATCH}
        WITH CHECK ${TENANT_MATCH}
    `);
  }

  // The tenant table itself is keyed by id, not tenant_id.
  await dropAllPolicies(knex, 'tenant');
  await knex.raw(`ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY`);
  await knex.raw(`ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY`);
  await knex.raw(`
    CREATE POLICY tenant_self ON "tenant"
      USING (
        current_setting('app.is_system', true) = 'on'
        OR id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      )
      WITH CHECK (
        current_setting('app.is_system', true) = 'on'
        OR id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      )
  `);

  // Grant the dedicated non-superuser login role (created by docker/initdb
  // or ops) the privileges it needs. RLS — not GRANTs — is the isolation
  // mechanism; grants are still required for basic access.
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'lumora_app') THEN
        GRANT USAGE ON SCHEMA public TO lumora_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lumora_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lumora_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lumora_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          GRANT USAGE, SELECT ON SEQUENCES TO lumora_app;
      END IF;
    END
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  const { rows } = await knex.raw(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  for (const { tablename } of rows as { tablename: string }[]) {
    await dropAllPolicies(knex, tablename);
    await knex.raw(`ALTER TABLE "${tablename}" NO FORCE ROW LEVEL SECURITY`).catch(() => null);
    await knex.raw(`ALTER TABLE "${tablename}" DISABLE ROW LEVEL SECURITY`).catch(() => null);
  }
}
