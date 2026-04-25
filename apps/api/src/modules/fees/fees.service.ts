import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import { generateControlNumber, validateControlNumber } from '../payments/control-number';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

export interface FeeItem {
  code: string;
  label: string;
  amount: string; // decimal string
  mandatory: boolean;
}

export interface CreateFeeStructureDto {
  name: string;
  termId: string;
  classId?: string;
  studentType?: 'day' | 'boarder' | 'all';
  items: FeeItem[];
}

export interface GenerateInvoiceDto {
  studentId: string;
  termId: string;
  feeStructureId: string;
  discounts?: { code: string; amount: string; reason: string }[];
}

@Injectable()
export class FeesService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  // ── Fee Structures ──────────────────────────────────────────────────────────

  async createFeeStructure(dto: CreateFeeStructureDto) {
    const total = dto.items
      .reduce((sum, item) => sum.plus(new Decimal(item.amount)), new Decimal(0))
      .toFixed(4);

    const { rows } = await this.pool.query(
      `INSERT INTO fee_structure (id, tenant_id, term_id, class_id, name, student_type, items, total_amount)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        uuidv4(), dto.termId, dto.classId ?? null, dto.name,
        dto.studentType ?? 'all', JSON.stringify(dto.items), total,
      ],
    );
    await this.audit.log({ action: 'fee_structure.create', resource: 'fee_structure', resourceId: rows[0].id });
    return rows[0];
  }

  async listFeeStructures(termId?: string) {
    const { rows } = await this.pool.query(
      `SELECT fs.*, t.term_number, c.level, c.stream
       FROM fee_structure fs
       LEFT JOIN term t ON t.id = fs.term_id
       LEFT JOIN class c ON c.id = fs.class_id
       WHERE fs.active = true
         ${termId ? 'AND fs.term_id = $1' : ''}
       ORDER BY fs.name`,
      termId ? [termId] : [],
    );
    return rows;
  }

  // ── Invoices ────────────────────────────────────────────────────────────────

  async generateInvoice(dto: GenerateInvoiceDto) {
    const { tenantId } = TenantStorage.get();

    // Check for existing invoice this term
    const existing = await this.pool.query(
      `SELECT id FROM invoice WHERE student_id = $1 AND term_id = $2 AND status != 'void'`,
      [dto.studentId, dto.termId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return existing.rows[0]; // idempotent
    }

    const { rows: fsRows } = await this.pool.query(
      `SELECT * FROM fee_structure WHERE id = $1`,
      [dto.feeStructureId],
    );
    const fs = fsRows[0];
    if (!fs) throw new NotFoundException('Fee structure not found');

    // Calculate arrears from prior terms
    const { rows: arrearRows } = await this.pool.query(
      `SELECT COALESCE(SUM(total_due - total_paid), 0) AS arrears
       FROM invoice
       WHERE student_id = $1 AND status NOT IN ('void', 'paid')`,
      [dto.studentId],
    );
    const arrears = new Decimal((arrearRows[0] as { arrears: string }).arrears ?? '0');

    // Calculate discounts
    const discountTotal = (dto.discounts ?? []).reduce(
      (sum, d) => sum.plus(new Decimal(d.amount)),
      new Decimal(0),
    );

    const amount = new Decimal(fs.total_amount as string);
    const totalDue = amount.plus(arrears).minus(discountTotal);

    // Generate invoice number and control number
    const count = await this.pool.query(
      `SELECT COUNT(*) FROM invoice WHERE tenant_id = $1`,
      [tenantId],
    );
    const seq = parseInt((count.rows[0] as { count: string }).count) + 1;
    const invoiceNo = `INV/${new Date().getFullYear()}/${seq.toString().padStart(5, '0')}`;

    // Tenant prefix = last 4 digits of tenant UUID
    const tenantPrefix = tenantId.replace(/-/g, '').slice(-4);
    const controlNo = generateControlNumber(tenantPrefix, seq);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const { rows } = await client.query(
        `INSERT INTO invoice
          (id, tenant_id, student_id, term_id, invoice_no, items, amount, arrears, discounts, total_due, control_no, status, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'issued', NOW() + INTERVAL '30 days')
         RETURNING *`,
        [
          uuidv4(), tenantId, dto.studentId, dto.termId, invoiceNo,
          JSON.stringify(fs.items), amount.toFixed(4), arrears.toFixed(4),
          discountTotal.toFixed(4), totalDue.toFixed(4), controlNo,
        ],
      );

      await client.query('COMMIT');
      await this.audit.log({
        action: 'invoice.generate',
        resource: 'invoice',
        resourceId: rows[0].id,
        after: { invoiceNo, totalDue: totalDue.toFixed(2) },
      });

      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getInvoice(invoiceId: string) {
    const { rows } = await this.pool.query(
      `SELECT inv.*, s.legal_name AS student_name, s.admission_no,
         t.term_number, ay.label AS academic_year
       FROM invoice inv
       JOIN student s ON s.id = inv.student_id
       JOIN term t ON t.id = inv.term_id
       JOIN academic_year ay ON ay.id = t.academic_year_id
       WHERE inv.id = $1`,
      [invoiceId],
    );
    if (!rows[0]) throw new NotFoundException('Invoice not found');
    return rows[0];
  }

  async getStudentInvoices(studentId: string) {
    const { rows } = await this.pool.query(
      `SELECT inv.*, t.term_number, ay.label AS academic_year
       FROM invoice inv
       JOIN term t ON t.id = inv.term_id
       JOIN academic_year ay ON ay.id = t.academic_year_id
       WHERE inv.student_id = $1
       ORDER BY inv.created_at DESC`,
      [studentId],
    );
    return rows;
  }

  async getInvoiceByControlNo(controlNo: string) {
    if (!validateControlNumber(controlNo)) throw new NotFoundException('Invalid control number');
    const { rows } = await this.pool.query(
      `SELECT * FROM invoice WHERE control_no = $1`,
      [controlNo],
    );
    if (!rows[0]) throw new NotFoundException('Invoice not found for control number');
    return rows[0];
  }

  async updatePaymentBalance(invoiceId: string, amountPaid: Decimal): Promise<void> {
    await this.pool.query(
      `UPDATE invoice
       SET total_paid = total_paid + $1,
           status = CASE
             WHEN total_paid + $1 >= total_due THEN 'paid'
             WHEN total_paid + $1 > 0 THEN 'partial'
             ELSE status
           END,
           updated_at = NOW()
       WHERE id = $2`,
      [amountPaid.toFixed(4), invoiceId],
    );
  }
}
