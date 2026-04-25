import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';

export const DB_POOL = 'DB_POOL';

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env['DATABASE_URL'],
          ssl: process.env['DATABASE_SSL'] === 'true' ? { rejectUnauthorized: true } : false,
          min: parseInt(process.env['DATABASE_POOL_MIN'] ?? '2', 10),
          max: parseInt(process.env['DATABASE_POOL_MAX'] ?? '20', 10),
        });
        pool.on('error', (err) => {
          console.error('Unexpected DB pool error', err);
        });
        return pool;
      },
    },
  ],
  exports: [DB_POOL],
})
export class DatabaseModule {}
