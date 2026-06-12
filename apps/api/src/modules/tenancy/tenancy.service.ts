import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL_SYSTEM } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';
import { ROLES } from '@lumora/shared-auth';

export interface CreateTenantDto {
  name: string;
  kind: 'public_primary' | 'private' | 'international';
  subdomain: string;
  registrationNo?: string;
  vrn?: string;
}

export interface Tenant {
  id: string;
  name: string;
  kind: string;
  subdomain: string;
  active: boolean;
  createdAt: Date;
}

@Injectable()
export class TenancyService {
  constructor(
    // Tenant provisioning is a platform-level operation that happens before
    // a tenant context exists — it must use the system pool deliberately.
    @Inject(DB_POOL_SYSTEM) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async provision(dto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.pool.query(
      `SELECT id FROM tenant WHERE subdomain = $1`,
      [dto.subdomain],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictException(`Subdomain '${dto.subdomain}' is already taken`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const tenantId = uuidv4();
      const { rows } = await client.query<Tenant>(
        `INSERT INTO tenant (id, name, kind, subdomain, registration_no, vrn, active, config)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         RETURNING id, name, kind, subdomain, active, created_at AS "createdAt"`,
        [
          tenantId,
          dto.name,
          dto.kind,
          dto.subdomain,
          dto.registrationNo ?? null,
          dto.vrn ?? null,
          JSON.stringify({ timezone: 'Africa/Dar_es_Salaam', currency: 'TZS' }),
        ],
      );

      // Seed system roles for the new tenant
      for (const code of ROLES) {
        await client.query(
          `INSERT INTO role (id, tenant_id, code, name, system_role)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (tenant_id, code) DO NOTHING`,
          [
            uuidv4(),
            tenantId,
            code,
            code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          ],
        );
      }

      await client.query('COMMIT');

      const tenant = rows[0];
      if (!tenant) throw new Error('Insert did not return tenant row');

      await this.audit.log({
        action: 'tenant.provision',
        resource: 'tenant',
        resourceId: tenant.id,
        after: { name: dto.name, kind: dto.kind, subdomain: dto.subdomain },
      });

      return tenant;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(tenantId: string): Promise<Tenant> {
    const { rows } = await this.pool.query<Tenant>(
      `SELECT id, name, kind, subdomain, active, created_at AS "createdAt"
       FROM tenant WHERE id = $1`,
      [tenantId],
    );
    if (!rows[0]) throw new NotFoundException(`Tenant ${tenantId} not found`);
    return rows[0];
  }
}
