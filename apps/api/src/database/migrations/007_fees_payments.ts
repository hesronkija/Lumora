import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // Fee Structures
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('fee_structure', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('class_id').references('id').inTable('class'); // null = applies to all classes
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('CASCADE');
    t.string('name', 200).notNullable(); // e.g. "Day Scholar Std 1-3 Term 1 2025"
    t.enum('student_type', ['day', 'boarder', 'all']).notNullable().defaultTo('all');
    t.jsonb('items').notNullable().defaultTo('[]');
    // items: [{code: 'TUITION', label: 'Tuition Fee', amount: '150000.0000', mandatory: true}, ...]
    t.specificType('total_amount', 'numeric(18,4)').notNullable();
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('invoice', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('CASCADE');
    t.string('invoice_no', 50).notNullable();
    t.jsonb('items').notNullable().defaultTo('[]'); // snapshot of fee items at billing time
    t.specificType('amount', 'numeric(18,4)').notNullable();
    t.specificType('arrears', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('discounts', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('total_due', 'numeric(18,4)').notNullable();
    t.specificType('total_paid', 'numeric(18,4)').notNullable().defaultTo(0);
    t.string('control_no', 20); // 12-digit Luhn-validated control number
    t.enum('status', ['draft', 'issued', 'partial', 'paid', 'overdue', 'void']).notNullable().defaultTo('draft');
    t.timestamp('due_date');
    t.timestamps(true, true);
    t.unique(['tenant_id', 'invoice_no']);
  });

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('payment', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('invoice_id').notNullable().references('id').inTable('invoice').onDelete('RESTRICT');
    t.specificType('amount', 'numeric(18,4)').notNullable();
    t.enum('channel', ['mobile_money', 'bank', 'gepg', 'cash']).notNullable();
    t.string('provider', 50); // 'selcom', 'azampay', 'nmb', 'crdb', 'gepg', 'cash'
    t.string('provider_ref', 200); // telco/bank transaction reference
    t.string('fiscal_receipt_no', 100); // TRA VFD receipt number
    t.string('idempotency_key', 200).notNullable();
    t.enum('status', ['pending', 'completed', 'failed', 'reversed']).notNullable().defaultTo('pending');
    t.string('payer_phone', 20);
    t.string('payer_name', 200);
    t.boolean('dual_control_confirmed').defaultTo(false); // for cash
    t.uuid('confirmed_by').references('id').inTable('user'); // second role for cash
    t.timestamp('paid_at');
    t.timestamps(true, true);
    t.unique(['idempotency_key']); // critical — prevents duplicate payments
  });

  await knex.raw(`CREATE INDEX idx_payment_invoice ON payment (invoice_id)`);
  await knex.raw(`CREATE INDEX idx_payment_control_no ON invoice (control_no) WHERE control_no IS NOT NULL`);

  // ---------------------------------------------------------------------------
  // Reconciliation
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('reconciliation_run', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.date('run_date').notNullable();
    t.enum('status', ['running', 'completed', 'failed']).notNullable().defaultTo('running');
    t.integer('matched').defaultTo(0);
    t.integer('unmatched').defaultTo(0);
    t.integer('ambiguous').defaultTo(0);
    t.timestamp('completed_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('reconciliation_item', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('run_id').notNullable().references('id').inTable('reconciliation_run').onDelete('CASCADE');
    t.string('source', 50).notNullable(); // 'selcom', 'nmb', 'gepg'
    t.string('external_ref', 200).notNullable();
    t.string('control_no', 20);
    t.string('payer_msisdn', 20);
    t.specificType('amount', 'numeric(18,4)').notNullable();
    t.timestamp('txn_date').notNullable();
    t.enum('match_status', ['matched', 'unmatched', 'ambiguous']).notNullable();
    t.uuid('payment_id').references('id').inTable('payment');
    t.jsonb('ai_suggestions').defaultTo('[]'); // A3: LLM suggested matches
    t.boolean('bursar_confirmed').defaultTo(false);
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('reconciliation_item');
  await knex.schema.dropTableIfExists('reconciliation_run');
  await knex.schema.dropTableIfExists('payment');
  await knex.schema.dropTableIfExists('invoice');
  await knex.schema.dropTableIfExists('fee_structure');
}
