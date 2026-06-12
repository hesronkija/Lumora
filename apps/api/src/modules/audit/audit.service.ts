import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL, DB_POOL_SYSTEM } from '../../database/database.module';
import { TenantStorage } from '@lumora/shared-tenancy';
import { v4 as uuidv4 } from 'uuid';

export interface AuditEntry {
  action: string;
  resource: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(DB_POOL_SYSTEM) private readonly systemPool: Pool,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    const ctx = TenantStorage.getOrNull();
    // Platform-level actions (e.g. tenant provisioning) happen outside a
    // tenant context and are recorded through the system pool.
    const pool = ctx?.tenantId ? this.pool : this.systemPool;
    await pool.query(
      `INSERT INTO audit_log
        (id, tenant_id, actor_id, action, resource, resource_id, before, after, ip, user_agent, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        uuidv4(),
        ctx?.tenantId ?? null,
        ctx?.userId ?? null,
        entry.action,
        entry.resource,
        entry.resourceId ?? null,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
      ],
    );
  }
}
