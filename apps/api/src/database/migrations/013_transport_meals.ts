import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // Transport
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('bus', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('registration_no', 20).notNullable();
    t.string('make_model', 100);
    t.integer('capacity').notNullable();
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('route', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('bus_id').references('id').inTable('bus');
    t.uuid('driver_staff_id').references('id').inTable('staff'); // staff record for the driver
    t.string('name', 150).notNullable(); // e.g. "Arusha CBD – School Gate AM"
    t.enum('direction', ['inbound', 'outbound', 'both']).notNullable().defaultTo('both');
    t.time('departure_time');
    t.specificType('monthly_fee', 'numeric(18,4)').notNullable().defaultTo(0);
    t.specificType('term_fee', 'numeric(18,4)').notNullable().defaultTo(0);
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('pickup_point', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('route_id').notNullable().references('id').inTable('route').onDelete('CASCADE');
    t.string('name', 150).notNullable();
    t.integer('stop_order').notNullable();
    t.time('estimated_time');
    t.decimal('latitude', 10, 7);
    t.decimal('longitude', 10, 7);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('route_assignment', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.uuid('route_id').notNullable().references('id').inTable('route').onDelete('RESTRICT');
    t.uuid('pickup_point_id').references('id').inTable('pickup_point');
    t.uuid('term_id').notNullable().references('id').inTable('term').onDelete('RESTRICT');
    t.enum('status', ['active', 'cancelled']).notNullable().defaultTo('active');
    t.timestamps(true, true);
    t.unique(['student_id', 'term_id', 'route_id']);
  });

  // ---------------------------------------------------------------------------
  // Meals / Canteen
  // ---------------------------------------------------------------------------
  await knex.schema.createTable('meal_plan', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('name', 100).notNullable(); // "Full Board", "Day Scholar Lunch"
    t.jsonb('meal_types').notNullable().defaultTo('["lunch"]');
    // meal_types: ["breakfast","lunch","dinner","morning_tea","afternoon_tea"]
    t.specificType('daily_rate', 'numeric(18,4)').notNullable();
    t.specificType('term_rate', 'numeric(18,4)').notNullable().defaultTo(0);
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('canteen_wallet', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('student_id').notNullable().references('id').inTable('student').onDelete('CASCADE');
    t.uuid('meal_plan_id').references('id').inTable('meal_plan');
    t.specificType('balance', 'numeric(18,4)').notNullable().defaultTo(0);
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
    t.unique(['student_id']); // one wallet per student
  });

  await knex.schema.createTable('canteen_transaction', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.uuid('wallet_id').notNullable().references('id').inTable('canteen_wallet').onDelete('RESTRICT');
    t.enum('type', ['credit', 'debit']).notNullable();
    t.specificType('amount', 'numeric(18,4)').notNullable();
    t.specificType('balance_after', 'numeric(18,4)').notNullable();
    t.string('description', 300);
    t.enum('meal_type', ['breakfast', 'lunch', 'dinner', 'morning_tea', 'afternoon_tea', 'topup', 'refund']).notNullable();
    t.date('txn_date').notNullable().defaultTo(knex.fn.now());
    t.uuid('recorded_by').references('id').inTable('user');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('canteen_transaction');
  await knex.schema.dropTableIfExists('canteen_wallet');
  await knex.schema.dropTableIfExists('meal_plan');
  await knex.schema.dropTableIfExists('route_assignment');
  await knex.schema.dropTableIfExists('pickup_point');
  await knex.schema.dropTableIfExists('route');
  await knex.schema.dropTableIfExists('bus');
}
