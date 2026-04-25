import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { Public } from '../../common/guards/auth.guard';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  @Get()
  @Public()
  async check() {
    const dbOk = await this.pool
      .query('SELECT 1')
      .then(() => true)
      .catch(() => false);

    return {
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'error',
      ts: new Date().toISOString(),
    };
  }
}
