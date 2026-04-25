import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('message', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.string('recipient_ref', 100).notNullable(); // phone / email / user_id
    t.enum('channel', ['sms', 'whatsapp', 'email', 'push']).notNullable();
    t.string('template_key', 100).notNullable(); // e.g. "fees.payment_received"
    t.string('locale', 10).defaultTo('en-TZ');
    t.jsonb('vars').defaultTo('{}'); // template variables
    t.text('rendered_body'); // final rendered content
    t.enum('status', ['queued', 'sent', 'delivered', 'failed']).notNullable().defaultTo('queued');
    t.string('provider_message_id', 200); // e.g. Beem message ID
    t.string('error_message', 500);
    t.integer('retry_count').notNullable().defaultTo(0);
    t.specificType('cost_tzs', 'numeric(10,4)').defaultTo(0); // cost in TZS
    t.timestamp('sent_at');
    t.timestamps(true, true);
  });

  await knex.raw(
    `CREATE INDEX idx_message_tenant ON message (tenant_id, created_at DESC)`,
  );

  // Daily rate budget tracking per tenant
  await knex.schema.createTable('comms_budget', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenant').onDelete('CASCADE');
    t.date('date').notNullable();
    t.enum('channel', ['sms', 'whatsapp', 'email', 'push']).notNullable();
    t.integer('count').notNullable().defaultTo(0);
    t.integer('daily_limit').notNullable().defaultTo(1000);
    t.unique(['tenant_id', 'date', 'channel']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('comms_budget');
  await knex.schema.dropTableIfExists('message');
}
