import type { Knex } from 'knex';

/**
 * Payment integrity hardening (follows the security review):
 *  - `created_by` on payment so cash dual-control can require the confirmer
 *    to differ from whoever recorded the cash.
 *  - `amount_mismatch` payment status for webhooks whose reported amount
 *    disagrees with the pending payment — quarantined for the bursar instead
 *    of silently crediting a wrong figure.
 *
 * Knex `t.enum()` on Postgres creates a TEXT column with a named CHECK
 * constraint, so we swap the constraint rather than alter a native enum.
 */
export async function up(knex: Knex): Promise<void> {
  const hasCreatedBy = await knex.schema.hasColumn('payment', 'created_by');
  if (!hasCreatedBy) {
    await knex.schema.alterTable('payment', (t) => {
      t.uuid('created_by').references('id').inTable('user'); // who recorded it (cash/manual)
    });
  }

  await knex.raw(`ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_status_check"`);
  await knex.raw(`
    ALTER TABLE "payment"
    ADD CONSTRAINT "payment_status_check"
    CHECK (status IN ('pending', 'completed', 'failed', 'reversed', 'amount_mismatch'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_status_check"`);
  await knex.raw(`
    ALTER TABLE "payment"
    ADD CONSTRAINT "payment_status_check"
    CHECK (status IN ('pending', 'completed', 'failed', 'reversed'))
  `);
  const hasCreatedBy = await knex.schema.hasColumn('payment', 'created_by');
  if (hasCreatedBy) {
    await knex.schema.alterTable('payment', (t) => t.dropColumn('created_by'));
  }
}
