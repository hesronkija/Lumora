import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // Dorms & Beds
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('dorm', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('campus_id').references('id').inTable('campus');
    t.string('name', 100).notNullable();
    t.enum('gender', ['male', 'female', 'mixed']).notNullable();
    t.integer('capacity').notNullable();
    t.string('matron_patron_name', 200);
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('bed', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('dorm_id').notNullable().references('id').inTable('dorm').onDelete('CASCADE');
    t.string('bed_no', 20).notNullable(); // e.g. "A-12"
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
    t.unique(['dorm_id', 'bed_no']);
  });

  // ---------------------------------------------------------------------------
  // Dorm Assignments (one active assignment per student per term)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('dorm_assignment', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.uuid('bed_id').notNullable().references('id').inTable('bed').onDelete('RESTRICT');
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('RESTRICT');
    t.date('assigned_from').notNullable();
    t.date('assigned_to');
    t.enum('status', ['active', 'ended', 'cancelled']).notNullable().defaultTo('active');
    t.timestamps(true, true);
  });

  // Prevent double-booking a bed in the same term
  await knex.raw(`
    CREATE UNIQUE INDEX uq_bed_active_term
      ON dorm_assignment (bed_id, term_id)
      WHERE status = 'active'
  `);

  // ---------------------------------------------------------------------------
  // Leave-Out Requests
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('leave_out', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.date('leave_date').notNullable();
    t.date('return_date').notNullable();
    t.text('reason').notNullable();
    t.string('guardian_name', 200).notNullable();
    t.string('guardian_phone', 20).notNullable();
    t.enum('status', ['pending', 'approved', 'rejected', 'returned']).notNullable().defaultTo('pending');
    t.uuid('approved_by').references('id').inTable('user');
    t.timestamp('approved_at');
    t.timestamp('returned_at');
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // Visitor Log
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('visitor', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.string('visitor_name', 200).notNullable();
    t.string('visitor_phone', 20);
    t.string('relation', 100);
    t.string('national_id', 50);
    t.timestamp('check_in').notNullable().defaultTo(knex.fn.now());
    t.timestamp('check_out');
    t.string('purpose', 300);
    t.uuid('recorded_by').references('id').inTable('user');
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // Sick Bay / Health Records
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('sickbay_visit', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.timestamp('admitted_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('discharged_at');
    t.text('complaint').notNullable();
    t.text('diagnosis');
    t.text('treatment');
    t.text('medication');
    t.boolean('referred_to_hospital').defaultTo(false);
    t.string('hospital_name', 200);
    t.boolean('guardian_notified').defaultTo(false);
    t.timestamp('guardian_notified_at');
    t.uuid('attended_by').references('id').inTable('user'); // nurse / matron
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sickbay_visit');
  await knex.schema.dropTableIfExists('visitor');
  await knex.schema.dropTableIfExists('leave_out');
  await knex.schema.dropTableIfExists('dorm_assignment');
  await knex.schema.dropTableIfExists('bed');
  await knex.schema.dropTableIfExists('dorm');
}
