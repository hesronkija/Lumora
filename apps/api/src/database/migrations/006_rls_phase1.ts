import type { Knex } from 'knex';

const TENANT_TABLES = [
  'student', 'guardian', 'student_guardian',
  'application', 'application_document',
  'academic_year', 'term', 'subject', 'class', 'enrollment', 'timetable_entry',
  'attendance_session', 'attendance_record',
  'exam', 'exam_score', 'report_card',
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
