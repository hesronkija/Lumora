import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // Academic structure
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('academic_year', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('label', 20).notNullable(); // e.g. "2024/2025"
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.boolean('is_current').defaultTo(false);
    t.timestamps(true, true);
    t.unique(['tenant_id', 'label']);
  });

  await knex.schema.createTable('term', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('academic_year_id').notNullable().references('id').inTable('academic_year').onDelete('CASCADE');
    t.integer('term_number').notNullable(); // 1, 2, 3
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.boolean('is_current').defaultTo(false);
    t.timestamps(true, true);
    t.unique(['tenant_id', 'academic_year_id', 'term_number']);
  });

  await knex.schema.createTable('subject', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('code', 20).notNullable(); // e.g. MATH, ENG, KIS
    t.string('name', 100).notNullable();
    t.string('level_range', 50); // e.g. "Std1-Std7" or "all"
    t.boolean('is_core').defaultTo(true);
    t.timestamps(true, true);
    t.unique(['tenant_id', 'code']);
  });

  await knex.schema.createTable('class', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('academic_year_id').notNullable().references('id').inTable('academic_year').onDelete('CASCADE');
    t.string('level', 20).notNullable(); // e.g. "Std 1", "Std 7", "Form 1"
    t.string('stream', 10); // e.g. "A", "B", "Gold"
    t.uuid('class_teacher_id').references('id').inTable('user');
    t.integer('capacity').defaultTo(45);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('enrollment', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.uuid('class_id').notNullable().references('id').inTable('class').onDelete('CASCADE');
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('CASCADE');
    t.enum('status', ['active', 'transferred', 'withdrawn', 'completed']).notNullable().defaultTo('active');
    t.timestamps(true, true);
    t.unique(['student_id', 'term_id']); // one enrollment per student per term
  });

  await knex.schema.createTable('timetable_entry', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('class_id').notNullable().references('id').inTable('class').onDelete('CASCADE');
    t.uuid('subject_id').notNullable().references('id').inTable('subject').onDelete('CASCADE');
    t.uuid('teacher_id').notNullable().references('id').inTable('user').onDelete('CASCADE');
    t.integer('day_of_week').notNullable(); // 1=Mon...5=Fri
    t.time('start_time').notNullable();
    t.time('end_time').notNullable();
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('attendance_session', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('class_id').notNullable().references('id').inTable('class').onDelete('CASCADE');
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('CASCADE');
    t.date('date').notNullable();
    t.enum('session_type', ['morning', 'afternoon', 'full_day']).notNullable().defaultTo('full_day');
    t.uuid('taken_by').notNullable().references('id').inTable('user');
    t.timestamp('taken_at').notNullable().defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.unique(['class_id', 'date', 'session_type']);
  });

  await knex.schema.createTable('attendance_record', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('session_id').notNullable().references('id').inTable('attendance_session').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.enum('status', ['present', 'absent', 'late', 'excused']).notNullable().defaultTo('present');
    t.text('notes');
    t.unique(['session_id', 'student_id']);
  });

  // ---------------------------------------------------------------------------
  // Exams & Grading
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('exam', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('CASCADE');
    t.uuid('class_id').notNullable().references('id').inTable('class').onDelete('CASCADE');
    t.string('name', 100).notNullable(); // e.g. "Mid-Term Test", "End of Term"
    t.enum('exam_type', ['cat', 'mid_term', 'end_of_term', 'mock', 'assessment']).notNullable();
    t.date('exam_date');
    t.integer('total_marks').notNullable().defaultTo(100);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('exam_score', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('exam_id').notNullable().references('id').inTable('exam').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.uuid('subject_id').notNullable().references('id').inTable('subject').onDelete('CASCADE');
    t.specificType('marks_obtained', 'numeric(6,2)');
    t.specificType('total_marks', 'numeric(6,2)').notNullable();
    t.string('grade', 5); // A, B, C, D, E or TZ primary grade
    t.text('teacher_comment');
    t.uuid('entered_by').references('id').inTable('user');
    t.timestamps(true, true);
    t.unique(['exam_id', 'student_id', 'subject_id']);
  });

  await knex.schema.createTable('report_card', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('CASCADE');
    t.uuid('class_id').notNullable().references('id').inTable('class').onDelete('CASCADE');
    t.specificType('average_marks', 'numeric(5,2)');
    t.integer('position_in_class');
    t.integer('total_students_in_class');
    t.text('class_teacher_comment');
    t.text('headteacher_comment');
    t.string('pdf_key', 500); // S3 key once generated
    t.enum('status', ['draft', 'published']).notNullable().defaultTo('draft');
    t.timestamp('published_at');
    t.timestamps(true, true);
    t.unique(['student_id', 'term_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('report_card');
  await knex.schema.dropTableIfExists('exam_score');
  await knex.schema.dropTableIfExists('exam');
  await knex.schema.dropTableIfExists('attendance_record');
  await knex.schema.dropTableIfExists('attendance_session');
  await knex.schema.dropTableIfExists('timetable_entry');
  await knex.schema.dropTableIfExists('enrollment');
  await knex.schema.dropTableIfExists('class');
  await knex.schema.dropTableIfExists('subject');
  await knex.schema.dropTableIfExists('term');
  await knex.schema.dropTableIfExists('academic_year');
}
