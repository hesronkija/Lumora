import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  // ---------------------------------------------------------------------------
  // Tenants
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('tenant', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.string('name', 255).notNullable();
    t.enum('kind', ['public_primary', 'private', 'international']).notNullable();
    t.string('registration_no', 100);
    t.string('vrn', 50); // TRA VAT Registration Number
    t.string('motto', 500);
    t.string('logo_key', 500); // S3 object key
    t.string('primary_color', 7).defaultTo('#1a56db');
    t.string('subdomain', 100).unique(); // e.g. greenvalley.lumora.app
    t.boolean('active').notNullable().defaultTo(true);
    t.jsonb('config').defaultTo('{}');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('campus', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('address_ward', 200);
    t.string('address_district', 200);
    t.string('address_region', 200);
    t.specificType('gps', 'point'); // lat/lng
    t.boolean('is_primary').defaultTo(false);
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // Users & Roles
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('user', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('keycloak_id', 36).unique(); // Keycloak sub
    t.string('email', 320).notNullable();
    t.string('phone', 20);
    t.string('locale', 10).defaultTo('en-TZ');
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('last_login_at');
    t.timestamps(true, true);
    t.unique(['tenant_id', 'email']);
  });

  await knex.schema.createTable('role', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('code', 50).notNullable();
    t.string('name', 100).notNullable();
    t.boolean('system_role').defaultTo(false); // system roles cannot be deleted
    t.unique(['tenant_id', 'code']);
  });

  await knex.schema.createTable('user_role', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE');
    t.uuid('role_id').notNullable().references('id').inTable('role').onDelete('CASCADE');
    t.jsonb('scope_json').defaultTo('{}'); // ABAC scopes e.g. {"class_id": "uuid"}
    t.unique(['user_id', 'role_id']);
  });

  // ---------------------------------------------------------------------------
  // Audit Log — append-only; no UPDATE/DELETE permitted via RLS
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('audit_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').references('id').inTable('tenant'); // nullable for system actions
    t.uuid('actor_id'); // user.id; nullable for system/anonymous
    t.string('action', 100).notNullable(); // e.g. "student.create"
    t.string('resource', 100).notNullable(); // e.g. "student"
    t.uuid('resource_id');
    t.jsonb('before');
    t.jsonb('after');
    t.specificType('ip', 'inet');
    t.string('user_agent', 500);
    t.timestamp('at').notNullable().defaultTo(knex.fn.now());
  });

  // Partial index for quick per-tenant queries
  await knex.raw(
    `CREATE INDEX idx_audit_log_tenant ON audit_log (tenant_id, at DESC) WHERE tenant_id IS NOT NULL`,
  );

  // ---------------------------------------------------------------------------
  // Consent Ledger — PDPA 2022
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('consent', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('subject_ref', 100).notNullable(); // user.id or phone or email
    t.enum('channel', ['sms', 'whatsapp', 'email', 'push']).notNullable();
    t.enum('status', ['opted_in', 'opted_out', 'pending']).notNullable().defaultTo('pending');
    t.string('evidence', 500); // how consent was captured
    t.timestamp('consented_at');
    t.timestamp('revoked_at');
    t.timestamps(true, true);
    t.unique(['tenant_id', 'subject_ref', 'channel']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('consent');
  await knex.schema.dropTableIfExists('audit_log');
  await knex.schema.dropTableIfExists('user_role');
  await knex.schema.dropTableIfExists('role');
  await knex.schema.dropTableIfExists('user');
  await knex.schema.dropTableIfExists('campus');
  await knex.schema.dropTableIfExists('tenant');
}
