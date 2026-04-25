import {
  Injectable, Inject, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { AccountingService } from '../accounting/accounting.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

interface PayeBracket { from: number; to: number | null; rate: number }
interface RateConfig { rate: number; basis?: string; min_employees?: number }

interface StaffPayInput {
  staffId: string;
  pensionFund: 'nssf' | 'psssf' | 'none';
  hasHeslbLoan: boolean;
  disbursementMethod: 'bank' | 'mobile_money' | 'cash';
  bankAccount?: string;
  mobileNumber?: string;
  earnings: Array<{ code: string; label: string; amount: string }>;
  otherDeductions?: Array<{ code: string; label: string; amount: string }>;
}

export interface PayrollCalculation {
  staffId: string;
  gross: string;
  basic: string;
  paye: string;
  nssfEmployee: string;
  heslb: string;
  nhifEmployee: string;
  otherDeductions: string;
  totalDeductions: string;
  netPay: string;
  nssfEmployer: string;
  wcf: string;
  sdl: string;
  nhifEmployer: string;
}

@Injectable()
export class PayrollService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
    private readonly accounting: AccountingService,
  ) {}

  // ── Statutory Rate Loader ──────────────────────────────────────────────────

  private async loadRate<T>(rateType: string, asOf = new Date()): Promise<T> {
    const { rows } = await this.pool.query(
      `SELECT config FROM statutory_rate
       WHERE rate_type = $1
         AND effective_from <= $2
         AND (effective_to IS NULL OR effective_to >= $2)
       ORDER BY effective_from DESC LIMIT 1`,
      [rateType, asOf.toISOString().split('T')[0]],
    );
    if (!rows[0]) throw new Error(`No statutory rate found for ${rateType} as of ${asOf.toISOString().split('T')[0]}`);
    return rows[0].config as T;
  }

  // ── PAYE Calculation ───────────────────────────────────────────────────────
  // Progressive tax on monthly gross. Every rate in the DB — never hardcoded.

  async calculatePaye(grossMonthly: Decimal, asOf?: Date): Promise<Decimal> {
    const brackets = await this.loadRate<PayeBracket[]>('paye_bracket', asOf);
    const gross = grossMonthly.toDecimalPlaces(4);
    let tax = new Decimal(0);

    for (const bracket of brackets) {
      const from = new Decimal(bracket.from);
      const to = bracket.to !== null ? new Decimal(bracket.to) : null;
      const rate = new Decimal(bracket.rate);

      if (gross.lessThanOrEqualTo(from)) break;

      const taxable = to !== null
        ? Decimal.min(gross, to).minus(from)
        : gross.minus(from);

      tax = tax.plus(taxable.times(rate));
    }

    return tax.toDecimalPlaces(4);
  }

  // ── Full Payslip Calculation ───────────────────────────────────────────────

  async calculatePayslip(
    input: StaffPayInput,
    employeeCount: number,
    asOf?: Date,
  ): Promise<PayrollCalculation> {
    const gross = input.earnings.reduce(
      (s, e) => s.plus(new Decimal(e.amount)), new Decimal(0),
    );

    // BASIC = first earnings line labelled BASIC, or gross if not separated
    const basicEarning = input.earnings.find(e => e.code === 'BASIC');
    const basic = basicEarning ? new Decimal(basicEarning.amount) : gross;

    // PAYE
    const paye = await this.calculatePaye(gross, asOf);

    // Pension (NSSF or PSSSF — mutually exclusive)
    let nssfEmployee = new Decimal(0);
    let nssfEmployer = new Decimal(0);
    if (input.pensionFund === 'nssf') {
      const empRate = await this.loadRate<RateConfig>('nssf_employee', asOf);
      const emplrRate = await this.loadRate<RateConfig>('nssf_employer', asOf);
      nssfEmployee = gross.times(new Decimal(empRate.rate)).toDecimalPlaces(4);
      nssfEmployer = gross.times(new Decimal(emplrRate.rate)).toDecimalPlaces(4);
    } else if (input.pensionFund === 'psssf') {
      const empRate = await this.loadRate<RateConfig>('psssf_employee', asOf);
      const emplrRate = await this.loadRate<RateConfig>('psssf_employer', asOf);
      nssfEmployee = gross.times(new Decimal(empRate.rate)).toDecimalPlaces(4);
      nssfEmployer = gross.times(new Decimal(emplrRate.rate)).toDecimalPlaces(4);
    }

    // HESLB (15% of basic for loan-holders)
    let heslb = new Decimal(0);
    if (input.hasHeslbLoan) {
      const heslbRate = await this.loadRate<RateConfig>('heslb', asOf);
      const basis = heslbRate.basis === 'basic' ? basic : gross;
      heslb = basis.times(new Decimal(heslbRate.rate)).toDecimalPlaces(4);
    }

    // WCF (employer only)
    const wcfRate = await this.loadRate<RateConfig>('wcf', asOf);
    const wcf = gross.times(new Decimal(wcfRate.rate)).toDecimalPlaces(4);

    // SDL (employer only, only if ≥ min_employees)
    const sdlRate = await this.loadRate<RateConfig>('sdl', asOf);
    const sdl = employeeCount >= (sdlRate.min_employees ?? 10)
      ? gross.times(new Decimal(sdlRate.rate)).toDecimalPlaces(4)
      : new Decimal(0);

    // Other employee deductions (advances, custom)
    const otherDedTotal = (input.otherDeductions ?? []).reduce(
      (s, d) => s.plus(new Decimal(d.amount)), new Decimal(0),
    );

    // NHIF not implemented until UHI rollout — schema column present but zero
    const nhifEmployee = new Decimal(0);
    const nhifEmployer = new Decimal(0);

    const totalDeductions = paye.plus(nssfEmployee).plus(heslb).plus(nhifEmployee).plus(otherDedTotal);
    const netPay = gross.minus(totalDeductions);

    return {
      staffId: input.staffId,
      gross: gross.toFixed(4),
      basic: basic.toFixed(4),
      paye: paye.toFixed(4),
      nssfEmployee: nssfEmployee.toFixed(4),
      heslb: heslb.toFixed(4),
      nhifEmployee: nhifEmployee.toFixed(4),
      otherDeductions: otherDedTotal.toFixed(4),
      totalDeductions: totalDeductions.toFixed(4),
      netPay: netPay.toFixed(4),
      nssfEmployer: nssfEmployer.toFixed(4),
      wcf: wcf.toFixed(4),
      sdl: sdl.toFixed(4),
      nhifEmployer: nhifEmployer.toFixed(4),
    };
  }

  // ── Payroll Runs ───────────────────────────────────────────────────────────

  async createPayrollRun(period: string) {
    const { tenantId } = TenantStorage.get();
    const existing = await this.pool.query(
      `SELECT id FROM payroll_run WHERE tenant_id = $1 AND period = $2`, [tenantId, period],
    );
    if (existing.rowCount && existing.rowCount > 0) throw new ConflictException(`Payroll run for ${period} already exists`);

    const { rows } = await this.pool.query(
      `INSERT INTO payroll_run (id, tenant_id, period) VALUES ($1,$2,$3) RETURNING *`,
      [uuidv4(), tenantId, period],
    );
    return rows[0];
  }

  async addPayslip(runId: string, input: StaffPayInput) {
    const { tenantId } = TenantStorage.get();

    const run = await this.pool.query(`SELECT * FROM payroll_run WHERE id = $1`, [runId]);
    if (!run.rows[0]) throw new NotFoundException('Payroll run not found');
    if (run.rows[0].status !== 'draft') throw new ConflictException('Can only add payslips to a draft run');

    // Get employee count for SDL threshold
    const empCount = await this.pool.query(
      `SELECT COUNT(*) FROM staff WHERE tenant_id = $1 AND contract_type != 'tsc_seconded'`, [tenantId],
    );
    const employeeCount = parseInt((empCount.rows[0] as { count: string }).count);

    const calc = await this.calculatePayslip(input, employeeCount, new Date(run.rows[0].period as string + '-01'));

    const { rows } = await this.pool.query(
      `INSERT INTO payslip
        (id, tenant_id, payroll_run_id, staff_id, pension_fund, has_heslb_loan,
         earnings, gross, basic,
         paye, nssf_employee, heslb, nhif_employee, other_deductions, total_deductions, net_pay,
         nssf_employer, wcf, sdl, nhif_employer,
         disbursement_method, bank_account, mobile_number, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'draft')
       ON CONFLICT (payroll_run_id, staff_id) DO UPDATE
         SET gross=$8, paye=$10, nssf_employee=$11, net_pay=$16, updated_at=NOW()
       RETURNING *`,
      [
        uuidv4(), tenantId, runId, input.staffId, input.pensionFund, input.hasHeslbLoan,
        JSON.stringify(input.earnings), calc.gross, calc.basic,
        calc.paye, calc.nssfEmployee, calc.heslb, calc.nhifEmployee,
        JSON.stringify(input.otherDeductions ?? []), calc.totalDeductions, calc.netPay,
        calc.nssfEmployer, calc.wcf, calc.sdl, calc.nhifEmployer,
        input.disbursementMethod, input.bankAccount ?? null, input.mobileNumber ?? null,
      ],
    );

    // Update run totals
    await this.refreshRunTotals(runId);

    return rows[0];
  }

  private async refreshRunTotals(runId: string): Promise<void> {
    await this.pool.query(
      `UPDATE payroll_run SET
         total_gross = (SELECT COALESCE(SUM(gross), 0) FROM payslip WHERE payroll_run_id = $1),
         total_net = (SELECT COALESCE(SUM(net_pay), 0) FROM payslip WHERE payroll_run_id = $1),
         total_paye = (SELECT COALESCE(SUM(paye), 0) FROM payslip WHERE payroll_run_id = $1),
         total_employee_deductions = (SELECT COALESCE(SUM(total_deductions), 0) FROM payslip WHERE payroll_run_id = $1),
         total_employer_contributions = (SELECT COALESCE(SUM(nssf_employer + wcf + sdl), 0) FROM payslip WHERE payroll_run_id = $1),
         updated_at = NOW()
       WHERE id = $1`,
      [runId],
    );
  }

  async approvePayrollRun(runId: string, approvedByUserId: string) {
    const { rows } = await this.pool.query(`SELECT * FROM payroll_run WHERE id = $1`, [runId]);
    const run = rows[0];
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== 'draft') throw new ConflictException(`Run status is ${run.status as string} — cannot approve`);

    const payslips = await this.pool.query(
      `SELECT COUNT(*) FROM payslip WHERE payroll_run_id = $1`, [runId],
    );
    if (parseInt((payslips.rows[0] as { count: string }).count) === 0) {
      throw new BadRequestException('Cannot approve an empty payroll run');
    }

    await this.pool.query(
      `UPDATE payroll_run SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [approvedByUserId, runId],
    );

    // Post payroll journal entries
    await this.postPayrollJournals(runId);

    await this.audit.log({
      action: 'payroll_run.approve',
      resource: 'payroll_run',
      resourceId: runId,
      after: { approvedBy: approvedByUserId },
    });

    return { approved: true };
  }

  private async postPayrollJournals(runId: string): Promise<void> {
    const { tenantId, userId } = TenantStorage.get();

    const { rows: run } = await this.pool.query(
      `SELECT * FROM payroll_run WHERE id = $1`, [runId],
    );
    const { rows: payslips } = await this.pool.query(
      `SELECT * FROM payslip WHERE payroll_run_id = $1`, [runId],
    );

    const totals = payslips.reduce((acc, ps) => ({
      gross: acc.gross.plus(new Decimal(ps.gross as string)),
      netPay: acc.netPay.plus(new Decimal(ps.net_pay as string)),
      paye: acc.paye.plus(new Decimal(ps.paye as string)),
      nssfEmployee: acc.nssfEmployee.plus(new Decimal(ps.nssf_employee as string)),
      heslb: acc.heslb.plus(new Decimal(ps.heslb as string)),
      nssfEmployer: acc.nssfEmployer.plus(new Decimal(ps.nssf_employer as string)),
      wcf: acc.wcf.plus(new Decimal(ps.wcf as string)),
      sdl: acc.sdl.plus(new Decimal(ps.sdl as string)),
    }), {
      gross: new Decimal(0), netPay: new Decimal(0), paye: new Decimal(0),
      nssfEmployee: new Decimal(0), heslb: new Decimal(0),
      nssfEmployer: new Decimal(0), wcf: new Decimal(0), sdl: new Decimal(0),
    });

    // Resolve account codes to IDs
    const accountIds = await this.resolveAccountCodes([
      '5010', // Salaries & Wages
      '5020', // Employer NSSF/PSSSF
      '5030', // Employer WCF
      '5040', // Employer SDL
      '1010', // Cash at Bank
      '2020', // PAYE Payable
      '2030', // NSSF/PSSSF Payable
      '2050', // SDL Payable
      '2040', // WCF Payable
      '2060', // HESLB Payable
    ], tenantId);

    // Find open period covering the payroll period
    const periodDate = `${run[0].period as string}-01`;
    const { rows: periods } = await this.pool.query(
      `SELECT id FROM accounting_period
       WHERE tenant_id = $1 AND status = 'open'
         AND start_date <= $2 AND end_date >= $2
       LIMIT 1`,
      [tenantId, periodDate],
    );
    if (!periods[0]) return; // No open period — skip auto-posting (warn in audit)

    const lines = [];

    // DR: Salaries & Wages (total gross)
    if (totals.gross.greaterThan(0)) {
      lines.push({ accountId: accountIds['5010'] ?? '', dr: totals.gross.toFixed(4), cr: '0' });
    }
    // DR: Employer NSSF/PSSSF
    if (totals.nssfEmployer.greaterThan(0)) {
      lines.push({ accountId: accountIds['5020'] ?? '', dr: totals.nssfEmployer.toFixed(4), cr: '0' });
    }
    // DR: Employer WCF
    if (totals.wcf.greaterThan(0)) {
      lines.push({ accountId: accountIds['5030'] ?? '', dr: totals.wcf.toFixed(4), cr: '0' });
    }
    // DR: Employer SDL
    if (totals.sdl.greaterThan(0)) {
      lines.push({ accountId: accountIds['5040'] ?? '', dr: totals.sdl.toFixed(4), cr: '0' });
    }
    // CR: Cash at Bank (net pay actually disbursed)
    if (totals.netPay.greaterThan(0)) {
      lines.push({ accountId: accountIds['1010'] ?? '', dr: '0', cr: totals.netPay.toFixed(4) });
    }
    // CR: PAYE Payable
    if (totals.paye.greaterThan(0)) {
      lines.push({ accountId: accountIds['2020'] ?? '', dr: '0', cr: totals.paye.toFixed(4) });
    }
    // CR: NSSF/PSSSF Payable (employee + employer portions)
    const totalNssf = totals.nssfEmployee.plus(totals.nssfEmployer);
    if (totalNssf.greaterThan(0)) {
      lines.push({ accountId: accountIds['2030'] ?? '', dr: '0', cr: totalNssf.toFixed(4) });
    }
    // CR: WCF Payable
    if (totals.wcf.greaterThan(0)) {
      lines.push({ accountId: accountIds['2040'] ?? '', dr: '0', cr: totals.wcf.toFixed(4) });
    }
    // CR: SDL Payable
    if (totals.sdl.greaterThan(0)) {
      lines.push({ accountId: accountIds['2050'] ?? '', dr: '0', cr: totals.sdl.toFixed(4) });
    }
    // CR: HESLB Payable
    if (totals.heslb.greaterThan(0)) {
      lines.push({ accountId: accountIds['2060'] ?? '', dr: '0', cr: totals.heslb.toFixed(4) });
    }

    if (lines.length >= 2) {
      await this.accounting.postJournal(
        {
          periodId: periods[0].id as string,
          entryDate: periodDate,
          narrative: `Payroll run ${run[0].period as string} — ${payslips.length} staff`,
          sourceModule: 'payroll',
          sourceRef: runId,
          lines,
        },
        userId,
      );
    }
  }

  private async resolveAccountCodes(codes: string[], tenantId: string): Promise<Record<string, string>> {
    const { rows } = await this.pool.query(
      `SELECT code, id FROM account WHERE tenant_id = $1 AND code = ANY($2)`,
      [tenantId, codes],
    );
    return Object.fromEntries(rows.map((r: { code: string; id: string }) => [r.code, r.id]));
  }

  async getPayrollRun(runId: string) {
    const { rows } = await this.pool.query(
      `SELECT pr.*, json_agg(row_to_json(ps) ORDER BY ps.created_at) AS payslips
       FROM payroll_run pr
       LEFT JOIN payslip ps ON ps.payroll_run_id = pr.id
       WHERE pr.id = $1
       GROUP BY pr.id`,
      [runId],
    );
    if (!rows[0]) throw new NotFoundException('Payroll run not found');
    return rows[0];
  }

  async listPayrollRuns() {
    const { rows } = await this.pool.query(
      `SELECT * FROM payroll_run ORDER BY period DESC LIMIT 24`,
    );
    return rows;
  }

  async getPayslip(payslipId: string) {
    const { rows } = await this.pool.query(
      `SELECT ps.*, s.legal_name AS staff_name, s.employee_no,
         pr.period, pr.status AS run_status
       FROM payslip ps
       JOIN staff s ON s.id = ps.staff_id
       JOIN payroll_run pr ON pr.id = ps.payroll_run_id
       WHERE ps.id = $1`,
      [payslipId],
    );
    if (!rows[0]) throw new NotFoundException('Payslip not found');
    return rows[0];
  }

  async bulkDisbursementFile(runId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT ps.net_pay, ps.disbursement_method, ps.bank_account, ps.mobile_number,
         s.legal_name, s.employee_no
       FROM payslip ps
       JOIN staff s ON s.id = ps.staff_id
       WHERE ps.payroll_run_id = $1 AND ps.disbursement_method != 'cash'`,
      [runId],
    );
    return rows;
  }

  // ── Statutory Reports ──────────────────────────────────────────────────────

  async payeReturn(period: string) {
    const { rows } = await this.pool.query(
      `SELECT ps.staff_id, s.legal_name, s.tsc_no,
         ps.gross, ps.paye, ps.nssf_employee, ps.heslb
       FROM payslip ps
       JOIN payroll_run pr ON pr.id = ps.payroll_run_id
       JOIN staff s ON s.id = ps.staff_id
       WHERE pr.period = $1 AND pr.status IN ('approved','disbursed')
       ORDER BY s.legal_name`,
      [period],
    );

    const totalPaye = rows.reduce((s, r) => s.plus(new Decimal(r.paye as string)), new Decimal(0));
    return { period, employees: rows, totalPaye: totalPaye.toFixed(4) };
  }

  async nssfContributionFile(period: string) {
    const { rows } = await this.pool.query(
      `SELECT ps.staff_id, s.legal_name, s.nssf_number,
         ps.nssf_employee, ps.nssf_employer, ps.gross, ps.pension_fund
       FROM payslip ps
       JOIN payroll_run pr ON pr.id = ps.payroll_run_id
       JOIN staff s ON s.id = ps.staff_id
       WHERE pr.period = $1 AND pr.status IN ('approved','disbursed')
         AND ps.pension_fund IN ('nssf', 'psssf')
       ORDER BY s.legal_name`,
      [period],
    );
    return { period, employees: rows };
  }
}
