import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // Accounting Periods
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('accounting_period', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('label', 50).notNullable(); // e.g. "2025-01", "2025-T1"
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.enum('status', ['open', 'closed']).notNullable().defaultTo('open');
    t.timestamp('closed_at');
    t.uuid('closed_by').references('id').inTable('user');
    t.timestamps(true, true);
    t.unique(['tenant_id', 'label']);
  });

  // ---------------------------------------------------------------------------
  // Chart of Accounts
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('account', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('parent_id').references('id').inTable('account');
    t.string('code', 20).notNullable();
    t.string('name', 200).notNullable();
    t.enum('type', ['asset', 'liability', 'equity', 'income', 'expense']).notNullable();
    t.enum('normal_balance', ['debit', 'credit']).notNullable();
    t.boolean('is_control').defaultTo(false); // AR, AP — don't post directly
    t.boolean('active').defaultTo(true);
    t.integer('sort_order').defaultTo(0);
    t.timestamps(true, true);
    t.unique(['tenant_id', 'code']);
  });

  // ---------------------------------------------------------------------------
  // Journal Entries (immutable once posted; corrections via reversing entries)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('journal_entry', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('period_id').notNullable().references('id').inTable('accounting_period').onDelete('RESTRICT');
    t.string('entry_no', 30).notNullable(); // JE/2025/00001
    t.date('entry_date').notNullable();
    t.text('narrative').notNullable();
    t.enum('source_module', ['payments', 'payroll', 'manual', 'bank_recon', 'reversal']).notNullable();
    t.string('source_ref', 200); // payment_id, payslip_id, etc.
    t.enum('status', ['draft', 'posted', 'reversed']).notNullable().defaultTo('posted');
    t.uuid('reversed_by').references('id').inTable('journal_entry'); // reversal links back
    t.uuid('posted_by').references('id').inTable('user');
    t.timestamps(true, true);
    t.unique(['tenant_id', 'entry_no']);
  });

  await knex.schema.createTable('journal_line', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('journal_entry_id').notNullable().references('id').inTable('journal_entry').onDelete('CASCADE');
    t.uuid('account_id').notNullable().references('id').inTable('account').onDelete('RESTRICT');
    t.specificType('dr', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('cr', 'numeric(18,4)').notNullable().defaultTo(0);
    t.string('description', 500);
    t.timestamps(true, true);
  });

  await knex.raw(`
    CREATE INDEX idx_journal_line_account ON journal_line (account_id, tenant_id);
    CREATE INDEX idx_journal_line_entry ON journal_line (journal_entry_id);
    CREATE INDEX idx_journal_entry_period ON journal_entry (period_id, tenant_id);
  `);

  // ---------------------------------------------------------------------------
  // Bank Statements (for bank reconciliation)
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('bank_statement', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('account_id').notNullable().references('id').inTable('account'); // the bank account GL code
    t.string('bank_name', 100).notNullable();
    t.date('statement_date').notNullable();
    t.specificType('opening_balance', 'numeric(18,4)').notNullable();
    t.specificType('closing_balance', 'numeric(18,4)').notNullable();
    t.enum('status', ['imported', 'reconciling', 'reconciled']).defaultTo('imported');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('bank_statement_line', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('statement_id').notNullable().references('id').inTable('bank_statement').onDelete('CASCADE');
    t.date('txn_date').notNullable();
    t.string('description', 500);
    t.string('ref', 100);
    t.specificType('debit', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('credit', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('balance', 'numeric(18,4)').notNullable();
    t.boolean('cleared').defaultTo(false);
    t.uuid('journal_line_id').references('id').inTable('journal_line'); // matched GL line
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // Budgets
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('budget', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('period_id').notNullable().references('id').inTable('accounting_period').onDelete('RESTRICT');
    t.string('name', 200).notNullable(); // "2025 Term 1 Budget"
    t.enum('status', ['draft', 'approved']).notNullable().defaultTo('draft');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('budget_line', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('budget_id').notNullable().references('id').inTable('budget').onDelete('CASCADE');
    t.uuid('account_id').notNullable().references('id').inTable('account').onDelete('RESTRICT');
    t.specificType('amount', 'numeric(18,4)').notNullable();
    t.text('note');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('budget_line');
  await knex.schema.dropTableIfExists('budget');
  await knex.schema.dropTableIfExists('bank_statement_line');
  await knex.schema.dropTableIfExists('bank_statement');
  await knex.schema.dropTableIfExists('journal_line');
  await knex.schema.dropTableIfExists('journal_entry');
  await knex.schema.dropTableIfExists('account');
  await knex.schema.dropTableIfExists('accounting_period');
}
