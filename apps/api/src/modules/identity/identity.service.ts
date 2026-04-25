import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { withTenantTx } from '@lumora/shared-tenancy';
import { v4 as uuidv4 } from 'uuid';

export interface CreateUserDto {
  email: string;
  phone?: string;
  locale?: string;
  keycloakId?: string;
}

export interface AssignRoleDto {
  userId: string;
  roleCode: string;
  scopeJson?: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  tenantId: string;
  email: string;
  phone: string | null;
  locale: string;
  active: boolean;
  roles: string[];
  createdAt: Date;
}

@Injectable()
export class IdentityService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async createUser(dto: CreateUserDto): Promise<UserProfile> {
    const client = await this.pool.connect();
    try {
      const result = await withTenantTx(client, async (c) => {
        const { rows: existing } = await c.query(
          `SELECT id FROM "user" WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid AND email = $1`,
          [dto.email],
        );
        if (existing.length > 0) {
          throw new ConflictException(`User with email ${dto.email} already exists`);
        }

        const { rows } = await c.query(
          `INSERT INTO "user" (id, tenant_id, email, phone, locale, keycloak_id, active)
           VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2, $3, $4, $5, true)
           RETURNING id, tenant_id AS "tenantId", email, phone, locale, active, created_at AS "createdAt"`,
          [uuidv4(), dto.email, dto.phone ?? null, dto.locale ?? 'en-TZ', dto.keycloakId ?? null],
        );
        return rows[0] as UserProfile;
      });

      await this.audit.log({
        action: 'user.create',
        resource: 'user',
        resourceId: result.id,
        after: { email: dto.email },
      });

      return { ...result, roles: [] };
    } finally {
      client.release();
    }
  }

  async assignRole(dto: AssignRoleDto): Promise<void> {
    const client = await this.pool.connect();
    try {
      await withTenantTx(client, async (c) => {
        const { rows: roleRows } = await c.query(
          `SELECT id FROM role WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid AND code = $1`,
          [dto.roleCode],
        );
        const role = roleRows[0] as { id: string } | undefined;
        if (!role) throw new NotFoundException(`Role '${dto.roleCode}' not found`);

        await c.query(
          `INSERT INTO user_role (id, tenant_id, user_id, role_id, scope_json)
           VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2, $3, $4)
           ON CONFLICT (user_id, role_id) DO UPDATE SET scope_json = EXCLUDED.scope_json`,
          [uuidv4(), dto.userId, role.id, JSON.stringify(dto.scopeJson ?? {})],
        );
      });

      await this.audit.log({
        action: 'user.assign_role',
        resource: 'user_role',
        resourceId: dto.userId,
        after: { roleCode: dto.roleCode, scopeJson: dto.scopeJson },
      });
    } finally {
      client.release();
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    const { rows } = await this.pool.query(
      `SELECT
         u.id, u.tenant_id AS "tenantId", u.email, u.phone, u.locale, u.active,
         u.created_at AS "createdAt",
         COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
       FROM "user" u
       LEFT JOIN user_role ur ON ur.user_id = u.id
       LEFT JOIN role r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException(`User ${userId} not found`);
    return rows[0] as UserProfile;
  }
}
