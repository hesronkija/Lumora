import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // AI Feature Registry (per tenant, per feature toggle)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('ai_feature', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('feature_code', 50).notNullable(); // 'A1_report_card_comments', etc.
    t.boolean('enabled').notNullable().defaultTo(false);
    t.jsonb('config').notNullable().defaultTo('{}');
    t.timestamps(true, true);
    t.unique(['tenant_id', 'feature_code']);
  });

  // ---------------------------------------------------------------------------
  // AI Request Log (no prompt body stored — hash only, PDPA compliance)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('ai_request', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('feature_code', 50).notNullable();
    t.uuid('user_id').references('id').inTable('user');
    t.string('model', 100).notNullable();
    t.string('prompt_hash', 64).notNullable(); // SHA-256 of scrubbed prompt
    t.integer('tokens_in').notNullable().defaultTo(0);
    t.integer('tokens_out').notNullable().defaultTo(0);
    t.integer('latency_ms').notNullable().defaultTo(0);
    t.jsonb('safety_flags').notNullable().defaultTo('[]');
    t.timestamp('at').notNullable().defaultTo(knex.fn.now());
  });

  // ---------------------------------------------------------------------------
  // AI Generations (output + human review lifecycle)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('ai_generation', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('ai_request_id').notNullable().references('id').inTable('ai_request').onDelete('CASCADE');
    t.string('output_ref', 500); // e.g. S3 key or inline text key
    t.enum('status', ['drafted', 'human_accepted', 'human_rejected', 'edited']).notNullable().defaultTo('drafted');
    t.jsonb('diff').defaultTo('null'); // diff between draft and human-edited version
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // AI Cost Ledger (per tenant per period per feature)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('ai_cost_ledger', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('period', 7).notNullable(); // YYYY-MM
    t.string('feature_code', 50).notNullable();
    t.integer('tokens').notNullable().defaultTo(0);
    t.specificType('tzs_cost', 'numeric(18,4)').notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.unique(['tenant_id', 'period', 'feature_code']);
  });

  // ---------------------------------------------------------------------------
  // AI Consent (voice capture, interview recording)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('ai_consent', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('subject_ref', 200).notNullable(); // student_id, staff_id, or guardian_id
    t.string('scope', 100).notNullable(); // 'voice_capture', 'interview_recording'
    t.enum('status', ['granted', 'revoked']).notNullable().defaultTo('granted');
    t.timestamp('at').notNullable().defaultTo(knex.fn.now());
    t.text('evidence'); // consent form reference
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // Timetable Slots (output of A9 CP-SAT solver or manual entry)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('timetable_slot', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('CASCADE');
    t.uuid('class_id').notNullable().references('id').inTable('class').onDelete('CASCADE');
    t.uuid('subject_id').notNullable().references('id').inTable('subject').onDelete('CASCADE');
    t.uuid('teacher_staff_id').references('id').inTable('staff');
    t.enum('day_of_week', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']).notNullable();
    t.integer('period_number').notNullable(); // 1-8 typically
    t.time('start_time').notNullable();
    t.time('end_time').notNullable();
    t.string('room', 50);
    t.boolean('ai_generated').defaultTo(false); // true = placed by A9 solver
    t.timestamps(true, true);
    t.unique(['class_id', 'day_of_week', 'period_number', 'term_id']);
  });

  // RLS for all new tables (tenant-scoped)
  const tenantTables = ['ai_feature', 'ai_request', 'ai_generation', 'ai_cost_ledger', 'ai_consent', 'timetable_slot'];
  for (const table of tenantTables) {
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
  const tables = ['timetable_slot', 'ai_consent', 'ai_cost_ledger', 'ai_generation', 'ai_request', 'ai_feature'];
  for (const t of tables) await knex.schema.dropTableIfExists(t);
}
