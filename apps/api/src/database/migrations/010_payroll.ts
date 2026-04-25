import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // Statutory Rates (versioned by effective_from — never hard-code rates)
  // Rates change every Finance Act / contribution order.
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('statutory_rate', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.enum('rate_type', [
      'paye_bracket',   // PAYE tax bracket
      'nssf_employee',  // NSSF employee contribution %
      'nssf_employer',
      'psssf_employee', // PSSSF (public sector) employee %
      'psssf_employer',
      'wcf',            // Workers Compensation Fund employer %
      'sdl',            // Skills Development Levy employer %
      'heslb',          // HESLB loan repayment %
      'nhif',           // NHIF (both sides, pre-UHI)
    ]).notNullable();
    t.date('effective_from').notNullable();
    t.date('effective_to'); // null = current
    t.jsonb('config').notNullable();
    // PAYE config: [{ from: 0, to: 270000, rate: 0 }, { from: 270001, to: 520000, rate: 0.08 }, ...]
    // Other config: { rate: 0.10, basis: 'gross' }
    t.text('source'); // "Finance Act 2024" or "NSSF Contribution Order 2020"
    t.timestamps(true, true);
  });

  // ---------------------------------------------------------------------------
  // Payroll Runs
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('payroll_run', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('period', 7).notNullable(); // YYYY-MM
    t.enum('status', ['draft', 'processing', 'approved', 'disbursed', 'cancelled']).notNullable().defaultTo('draft');
    t.specificType('total_gross', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('total_net', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('total_paye', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('total_employee_deductions', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('total_employer_contributions', 'numeric(18,4)').notNullable().defaultTo(0);
    t.uuid('approved_by').references('id').inTable('user');
    t.timestamp('approved_at');
    t.timestamp('disbursed_at');
    t.timestamps(true, true);
    t.unique(['tenant_id', 'period']);
  });

  // ---------------------------------------------------------------------------
  // Payslips
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('payslip', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('payroll_run_id').notNullable().references('id').inTable('payroll_run').onDelete('RESTRICT');
    t.uuid('staff_id').notNullable().references('id').inTable('staff').onDelete('RESTRICT');
    // Employment type determines which pension fund applies
    t.enum('pension_fund', ['nssf', 'psssf', 'none']).notNullable().defaultTo('nssf');
    t.boolean('has_heslb_loan').notNullable().defaultTo(false);
    // Earnings: basic, house allowance, transport allowance, overtime, bonus, etc.
    t.jsonb('earnings').notNullable().defaultTo('[]');
    // earnings: [{code, label, amount}]
    t.specificType('gross', 'numeric(18,4)').notNullable();
    t.specificType('basic', 'numeric(18,4)').notNullable();
    // Deductions (employee side)
    t.specificType('paye', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('nssf_employee', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('heslb', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('nhif_employee', 'numeric(18,4)').notNullable().defaultTo(0);
    t.jsonb('other_deductions').notNullable().defaultTo('[]');
    // other_deductions: [{code, label, amount}]
    t.specificType('total_deductions', 'numeric(18,4)').notNullable();
    t.specificType('net_pay', 'numeric(18,4)').notNullable();
    // Employer contributions (not deducted from employee, but recorded)
    t.specificType('nssf_employer', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('wcf', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('sdl', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('nhif_employer', 'numeric(18,4)').notNullable().defaultTo(0);
    // Disbursement
    t.enum('disbursement_method', ['bank', 'mobile_money', 'cash']).notNullable().defaultTo('bank');
    t.string('bank_account', 30);
    t.string('mobile_number', 15);
    t.string('pdf_key', 500); // S3 key for payslip PDF
    t.enum('status', ['draft', 'approved', 'paid']).notNullable().defaultTo('draft');
    t.timestamps(true, true);
    t.unique(['payroll_run_id', 'staff_id']);
  });

  // Seed statutory rates from Finance Act 2024/25 posture
  await knex('statutory_rate').insert([
    {
      id: knex.raw('uuid_generate_v4()'),
      rate_type: 'paye_bracket',
      effective_from: '2024-07-01',
      effective_to: null,
      config: JSON.stringify([
        { from: 0,       to: 270000,   rate: 0 },
        { from: 270001,  to: 520000,   rate: 0.08 },
        { from: 520001,  to: 760000,   rate: 0.20 },
        { from: 760001,  to: 1000000,  rate: 0.25 },
        { from: 1000001, to: null,     rate: 0.30 },
      ]),
      source: 'Finance Act 2024',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: knex.raw('uuid_generate_v4()'),
      rate_type: 'nssf_employee',
      effective_from: '2020-01-01',
      config: JSON.stringify({ rate: 0.10, basis: 'gross' }),
      source: 'NSSF Contribution Order 2020',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: knex.raw('uuid_generate_v4()'),
      rate_type: 'nssf_employer',
      effective_from: '2020-01-01',
      config: JSON.stringify({ rate: 0.10, basis: 'gross' }),
      source: 'NSSF Contribution Order 2020',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: knex.raw('uuid_generate_v4()'),
      rate_type: 'psssf_employee',
      effective_from: '2018-01-01',
      config: JSON.stringify({ rate: 0.05, basis: 'gross' }),
      source: 'PSSSF Act 2017',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: knex.raw('uuid_generate_v4()'),
      rate_type: 'psssf_employer',
      effective_from: '2018-01-01',
      config: JSON.stringify({ rate: 0.15, basis: 'gross' }),
      source: 'PSSSF Act 2017',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: knex.raw('uuid_generate_v4()'),
      rate_type: 'wcf',
      effective_from: '2021-01-01',
      config: JSON.stringify({ rate: 0.006, basis: 'gross' }),
      source: 'WCF Contribution Order 2021',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: knex.raw('uuid_generate_v4()'),
      rate_type: 'sdl',
      effective_from: '2020-01-01',
      config: JSON.stringify({ rate: 0.035, basis: 'gross', min_employees: 10 }),
      source: 'Vocational Education and Training Act (SDL)',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: knex.raw('uuid_generate_v4()'),
      rate_type: 'heslb',
      effective_from: '2016-07-01',
      config: JSON.stringify({ rate: 0.15, basis: 'basic' }),
      source: 'HESLB Loan Repayment Order 2016',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payslip');
  await knex.schema.dropTableIfExists('payroll_run');
  await knex.schema.dropTableIfExists('statutory_rate');
}
