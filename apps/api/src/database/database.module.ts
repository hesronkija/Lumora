import { Module, Global, OnApplicationShutdown, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { TenantAwarePool, SystemPool } from '@lumora/shared-tenancy';

/**
 * DB access tokens.
 *
 * DB_POOL        — TenantAwarePool. Every query runs with the tenant GUC set,
 *                  so Postgres RLS enforces isolation. Throws outside a tenant
 *                  context (fail closed). USE THIS in all domain modules.
 *
 * DB_POOL_SYSTEM — SystemPool. Deliberate cross-tenant access for webhooks,
 *                  provisioning, health checks and batch jobs. Sets
 *                  app.is_system='on' which RLS policies honour explicitly.
 *
 * PG_POOL        — Raw pg.Pool. Internal only (shutdown, advanced cases).
 */
export const DB_POOL = 'DB_POOL';
export const DB_POOL_SYSTEM = 'DB_POOL_SYSTEM';
export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const pool = new Pool({
          connectionString: process.env['DATABASE_URL'],
          ssl: process.env['DATABASE_SSL'] === 'true' ? { rejectUnauthorized: true } : false,
          min: parseInt(process.env['DATABASE_POOL_MIN'] ?? '2', 10),
          max: parseInt(process.env['DATABASE_POOL_MAX'] ?? '20', 10),
        });
        pool.on('error', (err) => {
          // eslint-disable-next-line no-console
          console.error('Unexpected DB pool error', err);
        });
        return pool;
      },
    },
    {
      provide: DB_POOL,
      useFactory: (pool: Pool) => new TenantAwarePool(pool),
      inject: [PG_POOL],
    },
    {
      provide: DB_POOL_SYSTEM,
      useFactory: (pool: Pool) => new SystemPool(pool),
      inject: [PG_POOL],
    },
  ],
  exports: [DB_POOL, DB_POOL_SYSTEM, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}
