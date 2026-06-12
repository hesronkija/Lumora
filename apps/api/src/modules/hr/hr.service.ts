import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import { v4 as uuidv4 } from 'uuid';

export interface CreateStaffDto {
  employeeNo: string;
  legalName: string;
  gender: 'male' | 'female';
  dob?: string;
  phone?: string;
  email?: string;
  tin?: string;
  nida?: string;
  tscNumber?: string;
  nssfNumber?: string;
  nhifNumber?: string;
  hasHeslbLoan?: boolean;
  pensionFund?: 'nssf' | 'psssf' | 'none';
  contractType?: 'permanent' | 'contract' | 'part_time' | 'volunteer' | 'tsc_seconded';
  position: string;
  department?: string;
  basicSalary?: string;
  allowances?: Array<{ code: string; label: string; amount: string }>;
  bankName?: string;
  bankAccount?: string;
  mobileNumber?: string;
  disbursementMethod?: 'bank' | 'mobile_money' | 'cash';
  employmentStart?: string;
  qualifications?: Array<{ award: string; institution: string; year: number }>;
}

export type UpdateStaffDto = Partial<CreateStaffDto>;

const COLUMN_MAP: Record<string, string> = {
  employeeNo: 'employee_no',
  legalName: 'legal_name',
  gender: 'gender',
  dob: 'dob',
  phone: 'phone',
  email: 'email',
  tin: 'tin',
  nida: 'nida',
  tscNumber: 'tsc_number',
  nssfNumber: 'nssf_number',
  nhifNumber: 'nhif_number',
  hasHeslbLoan: 'has_heslb_loan',
  pensionFund: 'pension_fund',
  contractType: 'contract_type',
  position: 'position',
  department: 'department',
  basicSalary: 'basic_salary',
  allowances: 'allowances',
  bankName: 'bank_name',
  bankAccount: 'bank_account',
  mobileNumber: 'mobile_number',
  disbursementMethod: 'disbursement_method',
  employmentStart: 'employment_start',
  qualifications: 'qualifications',
};

const JSON_FIELDS = new Set(['allowances', 'qualifications']);

@Injectable()
export class HrService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async createStaff(dto: CreateStaffDto) {
    const { tenantId } = TenantStorage.get();

    const dup = await this.pool.query(
      `SELECT id FROM staff WHERE tenant_id = $1 AND employee_no = $2`,
      [tenantId, dto.employeeNo],
    );
    if (dup.rowCount) throw new ConflictException(`Employee number ${dto.employeeNo} already exists`);

    const cols: string[] = ['id', 'tenant_id'];
    const params: unknown[] = [uuidv4(), tenantId];
    for (const [key, col] of Object.entries(COLUMN_MAP)) {
      const value = (dto as unknown as Record<string, unknown>)[key];
      if (value === undefined) continue;
      cols.push(col);
      params.push(JSON_FIELDS.has(key) ? JSON.stringify(value) : value);
    }
    const placeholders = params.map((_, i) => `$${i + 1}`).join(',');

    const { rows } = await this.pool.query(
      `INSERT INTO staff (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`,
      params,
    );
    await this.audit.log({ action: 'staff.create', resource: 'staff', resourceId: rows[0].id, after: { ...dto } });
    return rows[0];
  }

  async listStaff(opts: { active?: boolean; q?: string; department?: string } = {}) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (opts.active !== undefined) { conditions.push(`active = $${i++}`); params.push(opts.active); }
    if (opts.department) { conditions.push(`department = $${i++}`); params.push(opts.department); }
    if (opts.q) { conditions.push(`(legal_name ILIKE $${i} OR employee_no ILIKE $${i})`); params.push(`%${opts.q}%`); i++; }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM staff ${where} ORDER BY legal_name LIMIT 500`, params,
    );
    return rows;
  }

  async getStaff(staffId: string) {
    const { rows } = await this.pool.query(`SELECT * FROM staff WHERE id = $1`, [staffId]);
    if (!rows[0]) throw new NotFoundException('Staff member not found');
    return rows[0];
  }

  async updateStaff(staffId: string, dto: UpdateStaffDto) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(COLUMN_MAP)) {
      const value = (dto as unknown as Record<string, unknown>)[key];
      if (value === undefined) continue;
      sets.push(`${col} = $${i++}`);
      params.push(JSON_FIELDS.has(key) ? JSON.stringify(value) : value);
    }
    if (!sets.length) return this.getStaff(staffId);
    params.push(staffId);
    const { rows } = await this.pool.query(
      `UPDATE staff SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Staff member not found');
    await this.audit.log({ action: 'staff.update', resource: 'staff', resourceId: staffId, after: { ...dto } });
    return rows[0];
  }

  async deactivateStaff(staffId: string, endDate?: string) {
    const { rows } = await this.pool.query(
      `UPDATE staff SET active = false, employment_end = COALESCE($2, NOW()::date), updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [staffId, endDate ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Staff member not found');
    await this.audit.log({ action: 'staff.deactivate', resource: 'staff', resourceId: staffId });
    return { deactivated: true };
  }
}
