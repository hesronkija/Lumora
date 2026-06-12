import type { Knex } from 'knex';

/**
 * Links guardians to login accounts so the parent portal / parent assistant
 * can resolve "my children" from the authenticated user. Also ensures the
 * new column is covered by the existing RLS policy (it is — policies are
 * row-scoped, not column-scoped).
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('guardian', 'user_id');
  if (has) return; // idempotent — partial earlier run
  await knex.schema.alterTable('guardian', (t) => {
    t.uuid('user_id').references('id').inTable('user');
    t.index(['user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('guardian', (t) => {
    t.dropColumn('user_id');
  });
}
