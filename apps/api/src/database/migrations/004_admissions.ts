import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // Student Registry
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('student', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('admission_no', 50).notNullable(); // e.g. GV/2024/001
    t.string('legal_name', 200).notNullable();
    t.date('dob').notNullable();
    t.enum('gender', ['male', 'female', 'other']).notNullable();
    t.string('nida', 30); // National ID (for secondary age students)
    t.string('birth_cert_no', 50);
    t.string('photo_key', 500); // S3 key
    t.string('nationality', 100).defaultTo('Tanzanian');
    t.string('religion', 100);
    t.text('medical_notes');
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
    t.unique(['tenant_id', 'admission_no']);
  });

  await knex.schema.createTable('guardian', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('legal_name', 200).notNullable();
    t.string('phone', 20).notNullable();
    t.string('phone_alt', 20);
    t.string('email', 320);
    t.enum('relation', ['father', 'mother', 'guardian', 'sibling', 'other']).notNullable();
    t.string('nida', 30);
    t.string('occupation', 200);
    t.jsonb('custody_rules').defaultTo('{}');
    t.uuid('user_id').references('id').inTable('user'); // linked portal account
    t.timestamps(true, true);
  });

  await knex.schema.createTable('student_guardian', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.uuid('guardian_id').notNullable().references('id').inTable('guardian').onDelete('CASCADE');
    t.boolean('is_primary').defaultTo(false);
    t.boolean('can_pickup').defaultTo(false);
    t.boolean('fin_responsible').defaultTo(false); // receives fee invoices
    t.unique(['student_id', 'guardian_id']);
  });

  // ---------------------------------------------------------------------------
  // Admissions
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('application', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('application_no', 50).notNullable();
    t.string('applicant_name', 200).notNullable();
    t.date('applicant_dob').notNullable();
    t.enum('applicant_gender', ['male', 'female', 'other']).notNullable();
    t.string('guardian_name', 200).notNullable();
    t.string('guardian_phone', 20).notNullable();
    t.string('guardian_email', 320);
    t.string('applying_for_class', 50).notNullable(); // e.g. "Std 1"
    t.string('academic_year', 9).notNullable(); // e.g. "2024/2025"
    t.enum('status', ['draft', 'submitted', 'under_review', 'offered', 'enrolled', 'rejected', 'withdrawn'])
      .notNullable().defaultTo('draft');
    t.text('notes');
    t.uuid('reviewed_by').references('id').inTable('user');
    t.timestamp('reviewed_at');
    t.text('rejection_reason');
    t.uuid('student_id').references('id').inTable('student'); // set on enrollment
    t.timestamps(true, true);
    t.unique(['tenant_id', 'application_no']);
  });

  await knex.schema.createTable('application_document', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('application_id').notNullable().references('id').inTable('application').onDelete('CASCADE');
    t.string('doc_type', 100).notNullable(); // 'birth_cert', 'transcript', 'passport_photo', etc.
    t.string('s3_key', 500).notNullable();
    t.string('original_filename', 255).notNullable();
    t.string('mime_type', 100).notNullable();
    t.jsonb('ocr_extracted').defaultTo('{}'); // A5 OCR output
    t.boolean('ocr_confirmed').defaultTo(false); // staff-confirmed
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('application_document');
  await knex.schema.dropTableIfExists('application');
  await knex.schema.dropTableIfExists('student_guardian');
  await knex.schema.dropTableIfExists('guardian');
  await knex.schema.dropTableIfExists('student');
}
