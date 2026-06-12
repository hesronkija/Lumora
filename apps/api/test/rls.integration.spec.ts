/**
 * INTEGRATION — proves Row-Level Security actually isolates tenants.
 *
 * Requires a migrated database and is skipped unless TEST_DATABASE_URL is
 * set (pointing at the schema owner / superuser connection). The test
 * creates a non-superuser login (`lumora_app_login`) and verifies the
 * world through its eyes, exactly as the API connects in production.
 */
import { Pool } from 'pg';

const url = process.env['TEST_DATABASE_URL'];
const d = url ? describe : describe.skip;

const A = 'aaaaaaaa-1111-1111-1111-111111111111';
const B = 'bbbbbbbb-2222-2222-2222-222222222222';

d('Row-Level Security tenant isolation (live Postgres)', () => {
  let admin: Pool;
  let app: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: url });
    await admin.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='lumora_app_login') THEN
        CREATE ROLE lumora_app_login LOGIN PASSWORD 'lumora_app' IN ROLE lumora_app;
      END IF; END $$;`);
    await admin.query('GRANT USAGE ON SCHEMA public TO lumora_app');
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lumora_app');
    await admin.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lumora_app');

    await admin.query(`INSERT INTO tenant (id,name,kind,subdomain,active,config) VALUES
      ($1,'RLS School A','private','rls-a',true,'{}'),
      ($2,'RLS School B','private','rls-b',true,'{}')
      ON CONFLICT (id) DO NOTHING`, [A, B]);
    await admin.query(`INSERT INTO student (id,tenant_id,admission_no,legal_name,gender,dob,active)
      VALUES (uuid_generate_v4(),$1,'RLS-A-001','Amani Juma','male','2014-01-01',true),
             (uuid_generate_v4(),$2,'RLS-B-001','Neema Joseph','female','2014-06-01',true)
      ON CONFLICT DO NOTHING`, [A, B]);

    app = new Pool({
      connectionString: url.replace(/\/\/[^@]+@/, '//lumora_app_login:lumora_app@'),
    });
  });

  afterAll(async () => {
    await admin.query(`DELETE FROM audit_log WHERE tenant_id IN ($1,$2)`, [A, B]);
    await admin.query(`DELETE FROM student WHERE tenant_id IN ($1,$2)`, [A, B]);
    await admin.query(`DELETE FROM role WHERE tenant_id IN ($1,$2)`, [A, B]);
    await admin.query(`DELETE FROM tenant WHERE id IN ($1,$2)`, [A, B]);
    await admin.end();
    await app.end();
  });

  async function asTenant<T>(tenantId: string, sql: string, params: unknown[] = []): Promise<T[]> {
    const c = await app.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.current_tenant_id',$1,true)`, [tenantId]);
      const r = await c.query(sql, params);
      await c.query('COMMIT');
      return r.rows as T[];
    } catch (err) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      c.release();
    }
  }

  it('tenant A sees only its own students', async () => {
    const rows = await asTenant<{ admission_no: string }>(A,
      `SELECT admission_no FROM student WHERE admission_no LIKE 'RLS-%'`);
    expect(rows.map((r) => r.admission_no)).toEqual(['RLS-A-001']);
  });

  it('tenant B cannot see tenant A rows even with an explicit predicate', async () => {
    const rows = await asTenant(B,
      `SELECT * FROM student WHERE admission_no = 'RLS-A-001'`);
    expect(rows).toHaveLength(0);
  });

  it('no tenant context ⇒ zero rows (fail closed)', async () => {
    const c = await app.connect();
    try {
      const r = await c.query(`SELECT * FROM student WHERE admission_no LIKE 'RLS-%'`);
      expect(r.rows).toHaveLength(0);
    } finally {
      c.release();
    }
  });

  it('a tenant cannot INSERT rows into another tenant', async () => {
    await expect(
      asTenant(B, `INSERT INTO student (id,tenant_id,admission_no,legal_name,gender,dob,active)
        VALUES (uuid_generate_v4(),$1,'RLS-EVIL','Intruder','male','2014-01-01',true)`, [A]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('a tenant cannot UPDATE another tenant´s rows (0 rows affected)', async () => {
    const c = await app.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.current_tenant_id',$1,true)`, [B]);
      const r = await c.query(`UPDATE student SET legal_name='HACKED' WHERE admission_no='RLS-A-001'`);
      await c.query('COMMIT');
      expect(r.rowCount).toBe(0);
    } finally {
      c.release();
    }
  });

  it('audit_log is append-only: UPDATE and DELETE are denied for everyone', async () => {
    await admin.query(`INSERT INTO audit_log (id,tenant_id,action,resource)
      VALUES (uuid_generate_v4(),$1,'test.append_only','test')`, [A]);
    // even the system context cannot rewrite history
    const c = await app.connect();
    try {
      await c.query(`SELECT set_config('app.is_system','on',false)`);
      const upd = await c.query(`UPDATE audit_log SET action='tampered' WHERE action='test.append_only'`);
      expect(upd.rowCount).toBe(0);
      const del = await c.query(`DELETE FROM audit_log WHERE action='test.append_only'`);
      expect(del.rowCount).toBe(0);
    } finally {
      c.release();
    }
  });

  it('system context can resolve invoices across tenants (webhook path)', async () => {
    const c = await app.connect();
    try {
      await c.query(`SELECT set_config('app.is_system','on',false)`);
      const r = await c.query(`SELECT count(*)::int AS n FROM tenant WHERE id IN ($1,$2)`, [A, B]);
      expect(r.rows[0].n).toBe(2);
    } finally {
      c.release();
    }
  });
});
