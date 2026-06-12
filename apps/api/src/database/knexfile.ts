import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const config: Knex.Config = {
  client: 'pg',
  // Migrations run as the schema owner; the app itself connects as the
  // non-superuser `lumora_app` role so Row-Level Security is enforced.
  connection: (process.env['DATABASE_URL_ADMIN'] ?? process.env['DATABASE_URL'])!,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    extension: 'ts',
  },
};

export default config;
