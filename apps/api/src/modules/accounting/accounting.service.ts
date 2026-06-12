import {
  Injectable, Inject, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

export interface AccountDto {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  normalBalance: 'debit' | 'credit';
  parentId?: string;
  isControl?: boolean;
  sortOrder?: number;
}

export interface JournalLineDto {
  accountId: string;
  dr?: string; // decimal string; omitted ⇒ '0'
  cr?: string;
  description?: string;
}

export interface PostJournalDto {
  periodId: string;
  entryDate: string; // ISO date
  narrative: string;
  sourceModule: 'payments' | 'payroll' | 'manual' | 'bank_recon' | 'reversal';
  sourceRef?: string;
  lines: JournalLineDto[];
}

@Injectable()
export class AccountingService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  // ── Chart of Accounts ──────────────────────────────────────────────────────

  async createAccount(dto: AccountDto) {
    const { rows } = await this.pool.query(
      `INSERT INTO account (id, tenant_id, code, name, type, normal_balance, parent_id, is_control, sort_order)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        uuidv4(), dto.code, dto.name, dto.type, dto.normalBalance,
        dto.parentId ?? null, dto.isControl ?? false, dto.sortOrder ?? 0,
      ],
    );
    await this.audit.log({ action: 'account.create', resource: 'account', resourceId: rows[0].id });
    return rows[0];
  }

  async listAccounts(type?: string) {
    const { rows } = await this.pool.query(
      `SELECT a.*, p.code AS parent_code, p.name AS parent_name
       FROM account a LEFT JOIN account p ON p.id = a.parent_id
       WHERE a.active = true ${type ? 'AND a.type = $1' : ''}
       ORDER BY a.sort_order, a.code`,
      type ? [type] : [],
    );
    return rows;
  }

  async seedDefaultChartOfAccounts() {
    const { tenantId } = TenantStorage.get();

    const exists = await this.pool.query(
      `SELECT 1 FROM account WHERE tenant_id = $1 LIMIT 1`, [tenantId],
    );
    if (exists.rowCount && exists.rowCount > 0) return { seeded: false, reason: 'accounts_exist' };

    const accounts: AccountDto[] = [
      // Assets
      { code: '1000', name: 'Current Assets', type: 'asset', normalBalance: 'debit', sortOrder: 10 },
      { code: '1010', name: 'Cash at Bank', type: 'asset', normalBalance: 'debit', sortOrder: 11 },
      { code: '1020', name: 'Petty Cash', type: 'asset', normalBalance: 'debit', sortOrder: 12 },
      { code: '1100', name: 'Accounts Receivable (Fees)', type: 'asset', normalBalance: 'debit', isControl: true, sortOrder: 13 },
      { code: '1200', name: 'Prepaid Expenses', type: 'asset', normalBalance: 'debit', sortOrder: 14 },
      { code: '1500', name: 'Fixed Assets', type: 'asset', normalBalance: 'debit', sortOrder: 20 },
      { code: '1510', name: 'Land & Buildings', type: 'asset', normalBalance: 'debit', sortOrder: 21 },
      { code: '1520', name: 'Furniture & Equipment', type: 'asset', normalBalance: 'debit', sortOrder: 22 },
      // Liabilities
      { code: '2000', name: 'Current Liabilities', type: 'liability', normalBalance: 'credit', sortOrder: 30 },
      { code: '2010', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit', isControl: true, sortOrder: 31 },
      { code: '2020', name: 'PAYE Payable', type: 'liability', normalBalance: 'credit', sortOrder: 32 },
      { code: '2030', name: 'NSSF/PSSSF Payable', type: 'liability', normalBalance: 'credit', sortOrder: 33 },
      { code: '2040', name: 'WCF Payable', type: 'liability', normalBalance: 'credit', sortOrder: 34 },
      { code: '2050', name: 'SDL Payable', type: 'liability', normalBalance: 'credit', sortOrder: 35 },
      { code: '2060', name: 'HESLB Payable', type: 'liability', normalBalance: 'credit', sortOrder: 36 },
      { code: '2070', name: 'Fees Received in Advance', type: 'liability', normalBalance: 'credit', sortOrder: 37 },
      // Equity
      { code: '3000', name: 'Fund Balances', type: 'equity', normalBalance: 'credit', sortOrder: 40 },
      { code: '3010', name: 'Opening Fund Balance', type: 'equity', normalBalance: 'credit', sortOrder: 41 },
      { code: '3020', name: 'Retained Surplus/(Deficit)', type: 'equity', normalBalance: 'credit', sortOrder: 42 },
      // Income
      { code: '4000', name: 'School Fees', type: 'income', normalBalance: 'credit', sortOrder: 50 },
      { code: '4010', name: 'Tuition Fees', type: 'income', normalBalance: 'credit', sortOrder: 51 },
      { code: '4020', name: 'Boarding Fees', type: 'income', normalBalance: 'credit', sortOrder: 52 },
      { code: '4030', name: 'Transport Fees', type: 'income', normalBalance: 'credit', sortOrder: 53 },
      { code: '4100', name: 'Other Income', type: 'income', normalBalance: 'credit', sortOrder: 55 },
      // Expenses
      { code: '5000', name: 'Personnel Costs', type: 'expense', normalBalance: 'debit', sortOrder: 60 },
      { code: '5010', name: 'Salaries & Wages', type: 'expense', normalBalance: 'debit', sortOrder: 61 },
      { code: '5020', name: 'Employer NSSF/PSSSF', type: 'expense', normalBalance: 'debit', sortOrder: 62 },
      { code: '5030', name: 'Employer WCF', type: 'expense', normalBalance: 'debit', sortOrder: 63 },
      { code: '5040', name: 'Employer SDL', type: 'expense', normalBalance: 'debit', sortOrder: 64 },
      { code: '5100', name: 'Operating Expenses', type: 'expense', normalBalance: 'debit', sortOrder: 70 },
      { code: '5110', name: 'Utilities', type: 'expense', normalBalance: 'debit', sortOrder: 71 },
      { code: '5120', name: 'Office & Teaching Supplies', type: 'expense', normalBalance: 'debit', sortOrder: 72 },
      { code: '5130', name: 'Repairs & Maintenance', type: 'expense', normalBalance: 'debit', sortOrder: 73 },
      { code: '5140', name: 'Communication', type: 'expense', normalBalance: 'debit', sortOrder: 74 },
      { code: '5200', name: 'Finance Costs', type: 'expense', normalBalance: 'debit', sortOrder: 80 },
    ];

    for (const acc of accounts) {
      await this.pool.query(
        `INSERT INTO account (id, tenant_id, code, name, type, normal_balance, is_control, sort_order, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (tenant_id, code) DO NOTHING`,
        [uuidv4(), tenantId, acc.code, acc.name, acc.type, acc.normalBalance, acc.isControl ?? false, acc.sortOrder ?? 0],
      );
    }

    return { seeded: true, count: accounts.length };
  }

  // ── Accounting Periods ─────────────────────────────────────────────────────

  async createPeriod(dto: { label: string; startDate: string; endDate: string }) {
    const { rows } = await this.pool.query(
      `INSERT INTO accounting_period (id, tenant_id, label, start_date, end_date)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4)
       RETURNING *`,
      [uuidv4(), dto.label, dto.startDate, dto.endDate],
    );
    return rows[0];
  }

  async listPeriods() {
    const { rows } = await this.pool.query(
      `SELECT * FROM accounting_period ORDER BY start_date DESC`,
    );
    return rows;
  }

  async closePeriod(periodId: string, closedByUserId: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM accounting_period WHERE id = $1`, [periodId],
    );
    if (!rows[0]) throw new NotFoundException('Period not found');
    if (rows[0].status === 'closed') throw new ConflictException('Period already closed');

    // Verify double-entry balance before closing
    const { rows: balCheck } = await this.pool.query(
      `SELECT
         COALESCE(SUM(jl.dr), 0) - COALESCE(SUM(jl.cr), 0) AS imbalance
       FROM journal_line jl
       JOIN journal_entry je ON je.id = jl.journal_entry_id
       WHERE je.period_id = $1 AND je.status = 'posted'`,
      [periodId],
    );
    const imbalance = new Decimal((balCheck[0] as { imbalance: string }).imbalance ?? '0');
    if (!imbalance.isZero()) {
      throw new BadRequestException(`Period cannot be closed: DR-CR imbalance of TZS ${imbalance.toFixed(2)}`);
    }

    await this.pool.query(
      `UPDATE accounting_period SET status = 'closed', closed_at = NOW(), closed_by = $1, updated_at = NOW() WHERE id = $2`,
      [closedByUserId, periodId],
    );
    await this.audit.log({ action: 'period.close', resource: 'accounting_period', resourceId: periodId });
    return { closed: true };
  }

  // ── Journal Entries ────────────────────────────────────────────────────────

  async postJournal(dto: PostJournalDto, postedByUserId: string) {
    const { tenantId } = TenantStorage.get();

    // Validate double-entry balance
    const totalDr = dto.lines.reduce((s, l) => s.plus(new Decimal(l.dr || '0')), new Decimal(0));
    const totalCr = dto.lines.reduce((s, l) => s.plus(new Decimal(l.cr || '0')), new Decimal(0));
    if (!totalDr.equals(totalCr)) {
      throw new BadRequestException(`Journal does not balance: DR ${totalDr.toFixed(4)} ≠ CR ${totalCr.toFixed(4)}`);
    }
    if (dto.lines.length < 2) throw new BadRequestException('Journal must have at least 2 lines');

    const period = await this.pool.query(
      `SELECT * FROM accounting_period WHERE id = $1`, [dto.periodId],
    );
    if (!period.rows[0]) throw new NotFoundException('Accounting period not found');
    if (period.rows[0].status === 'closed') throw new ConflictException('Accounting period is closed');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Sequential entry number
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) FROM journal_entry WHERE tenant_id = $1`, [tenantId],
      );
      const seq = parseInt((countRows[0] as { count: string }).count) + 1;
      const entryNo = `JE/${new Date(dto.entryDate).getFullYear()}/${seq.toString().padStart(5, '0')}`;

      const { rows: jeRows } = await client.query(
        `INSERT INTO journal_entry
          (id, tenant_id, period_id, entry_no, entry_date, narrative, source_module, source_ref, status, posted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'posted',$9)
         RETURNING *`,
        [uuidv4(), tenantId, dto.periodId, entryNo, dto.entryDate, dto.narrative, dto.sourceModule, dto.sourceRef ?? null, postedByUserId],
      );
      const je = jeRows[0];

      for (const line of dto.lines) {
        await client.query(
          `INSERT INTO journal_line (id, tenant_id, journal_entry_id, account_id, dr, cr, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [uuidv4(), tenantId, je.id, line.accountId, line.dr || '0', line.cr || '0', line.description ?? null],
        );
      }

      await client.query('COMMIT');
      await this.audit.log({
        action: 'journal.post',
        resource: 'journal_entry',
        resourceId: je.id,
        after: { entryNo, totalDr: totalDr.toFixed(2) },
      });
      return je;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async reverseJournal(journalEntryId: string, reversalDate: string, postedByUserId: string) {
    const { rows } = await this.pool.query(
      `SELECT je.*, array_agg(row_to_json(jl)) AS lines
       FROM journal_entry je
       JOIN journal_line jl ON jl.journal_entry_id = je.id
       WHERE je.id = $1
       GROUP BY je.id`,
      [journalEntryId],
    );
    const original = rows[0];
    if (!original) throw new NotFoundException('Journal entry not found');
    if (original.status === 'reversed') throw new ConflictException('Already reversed');

    const { rows: periodRows } = await this.pool.query(
      `SELECT id FROM accounting_period
       WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
         AND status = 'open'
         AND start_date <= $1 AND end_date >= $1`,
      [reversalDate],
    );
    if (!periodRows[0]) throw new BadRequestException('No open period covers the reversal date');

    const lines: JournalLineDto[] = (original.lines as Array<{ account_id: string; dr: string; cr: string }>).map(l => ({
      accountId: l.account_id,
      dr: l.cr, // swap DR/CR
      cr: l.dr,
    }));

    const reversal = await this.postJournal(
      {
        periodId: periodRows[0].id as string,
        entryDate: reversalDate,
        narrative: `Reversal of ${original.entry_no as string}: ${original.narrative as string}`,
        sourceModule: 'reversal',
        sourceRef: journalEntryId,
        lines,
      },
      postedByUserId,
    );

    await this.pool.query(
      `UPDATE journal_entry SET status = 'reversed', reversed_by = $1 WHERE id = $2`,
      [reversal.id, journalEntryId],
    );

    return reversal;
  }

  async listJournalEntries(periodId?: string, limit = 50, offset = 0) {
    const where = periodId ? `AND je.period_id = $3` : '';
    const params: unknown[] = [limit, offset];
    if (periodId) params.push(periodId);
    const { rows } = await this.pool.query(
      `SELECT je.*, ap.label AS period_label
       FROM journal_entry je
       JOIN accounting_period ap ON ap.id = je.period_id
       WHERE je.status != 'draft' ${where}
       ORDER BY je.entry_date DESC, je.entry_no DESC
       LIMIT $1 OFFSET $2`,
      params,
    );
    return rows;
  }

  async getJournalEntry(id: string) {
    const { rows } = await this.pool.query(
      `SELECT je.*, ap.label AS period_label,
         json_agg(json_build_object(
           'id', jl.id, 'account_id', jl.account_id,
           'account_code', a.code, 'account_name', a.name,
           'dr', jl.dr, 'cr', jl.cr, 'description', jl.description
         ) ORDER BY jl.id) AS lines
       FROM journal_entry je
       JOIN accounting_period ap ON ap.id = je.period_id
       JOIN journal_line jl ON jl.journal_entry_id = je.id
       JOIN account a ON a.id = jl.account_id
       WHERE je.id = $1
       GROUP BY je.id, ap.label`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Journal entry not found');
    return rows[0];
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async trialBalance(periodId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         a.code, a.name, a.type, a.normal_balance,
         COALESCE(SUM(jl.dr), 0) AS total_dr,
         COALESCE(SUM(jl.cr), 0) AS total_cr,
         CASE a.normal_balance
           WHEN 'debit'  THEN COALESCE(SUM(jl.dr), 0) - COALESCE(SUM(jl.cr), 0)
           WHEN 'credit' THEN COALESCE(SUM(jl.cr), 0) - COALESCE(SUM(jl.dr), 0)
         END AS balance
       FROM account a
       LEFT JOIN journal_line jl ON jl.account_id = a.id
       LEFT JOIN journal_entry je ON je.id = jl.journal_entry_id
         AND je.period_id = $1 AND je.status = 'posted'
       WHERE a.active = true
       GROUP BY a.id, a.code, a.name, a.type, a.normal_balance, a.sort_order
       ORDER BY a.sort_order, a.code`,
      [periodId],
    );

    const totalDr = rows.reduce((s, r) => s.plus(new Decimal(r.total_dr as string)), new Decimal(0));
    const totalCr = rows.reduce((s, r) => s.plus(new Decimal(r.total_cr as string)), new Decimal(0));

    return {
      accounts: rows,
      totalDr: totalDr.toFixed(4),
      totalCr: totalCr.toFixed(4),
      balanced: totalDr.equals(totalCr),
    };
  }

  async incomeStatement(periodId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         a.code, a.name, a.type,
         CASE a.normal_balance
           WHEN 'credit' THEN COALESCE(SUM(jl.cr), 0) - COALESCE(SUM(jl.dr), 0)
           WHEN 'debit'  THEN COALESCE(SUM(jl.dr), 0) - COALESCE(SUM(jl.cr), 0)
         END AS amount
       FROM account a
       LEFT JOIN journal_line jl ON jl.account_id = a.id
       LEFT JOIN journal_entry je ON je.id = jl.journal_entry_id
         AND je.period_id = $1 AND je.status = 'posted'
       WHERE a.type IN ('income', 'expense') AND a.active = true
       GROUP BY a.id, a.code, a.name, a.type, a.normal_balance, a.sort_order
       ORDER BY a.sort_order, a.code`,
      [periodId],
    );

    const income = rows.filter(r => r.type === 'income')
      .reduce((s, r) => s.plus(new Decimal(r.amount as string)), new Decimal(0));
    const expense = rows.filter(r => r.type === 'expense')
      .reduce((s, r) => s.plus(new Decimal(r.amount as string)), new Decimal(0));

    return {
      lines: rows,
      totalIncome: income.toFixed(4),
      totalExpense: expense.toFixed(4),
      surplus: income.minus(expense).toFixed(4),
    };
  }

  async balanceSheet(asOfDate: string) {
    const { rows } = await this.pool.query(
      `SELECT
         a.code, a.name, a.type,
         CASE a.normal_balance
           WHEN 'debit'  THEN COALESCE(SUM(jl.dr), 0) - COALESCE(SUM(jl.cr), 0)
           WHEN 'credit' THEN COALESCE(SUM(jl.cr), 0) - COALESCE(SUM(jl.dr), 0)
         END AS balance
       FROM account a
       LEFT JOIN journal_line jl ON jl.account_id = a.id
       LEFT JOIN journal_entry je ON je.id = jl.journal_entry_id
         AND je.entry_date <= $1 AND je.status = 'posted'
       WHERE a.type IN ('asset', 'liability', 'equity') AND a.active = true
       GROUP BY a.id, a.code, a.name, a.type, a.normal_balance, a.sort_order
       ORDER BY a.sort_order, a.code`,
      [asOfDate],
    );

    const totalAssets = rows.filter(r => r.type === 'asset')
      .reduce((s, r) => s.plus(new Decimal(r.balance as string)), new Decimal(0));
    const totalLiabilities = rows.filter(r => r.type === 'liability')
      .reduce((s, r) => s.plus(new Decimal(r.balance as string)), new Decimal(0));
    const totalEquity = rows.filter(r => r.type === 'equity')
      .reduce((s, r) => s.plus(new Decimal(r.balance as string)), new Decimal(0));

    return {
      lines: rows,
      totalAssets: totalAssets.toFixed(4),
      totalLiabilities: totalLiabilities.toFixed(4),
      totalEquity: totalEquity.toFixed(4),
      balanced: totalAssets.equals(totalLiabilities.plus(totalEquity)),
      asOfDate,
    };
  }

  // ── Budget & Variance ──────────────────────────────────────────────────────

  async createBudget(dto: { periodId: string; name: string; lines: Array<{ accountId: string; amount: string; note?: string }> }) {
    const { tenantId } = TenantStorage.get();
    const { rows } = await this.pool.query(
      `INSERT INTO budget (id, tenant_id, period_id, name) VALUES ($1,$2,$3,$4) RETURNING *`,
      [uuidv4(), tenantId, dto.periodId, dto.name],
    );
    const budget = rows[0];

    for (const line of dto.lines) {
      await this.pool.query(
        `INSERT INTO budget_line (id, tenant_id, budget_id, account_id, amount, note)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuidv4(), tenantId, budget.id, line.accountId, line.amount, line.note ?? null],
      );
    }

    return budget;
  }

  async budgetVariance(budgetId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         a.code, a.name, a.type,
         bl.amount AS budgeted,
         COALESCE(
           CASE a.normal_balance
             WHEN 'debit'  THEN SUM(jl.dr) - SUM(jl.cr)
             WHEN 'credit' THEN SUM(jl.cr) - SUM(jl.dr)
           END, 0
         ) AS actual,
         bl.amount - COALESCE(
           CASE a.normal_balance
             WHEN 'debit'  THEN SUM(jl.dr) - SUM(jl.cr)
             WHEN 'credit' THEN SUM(jl.cr) - SUM(jl.dr)
           END, 0
         ) AS variance
       FROM budget_line bl
       JOIN budget b ON b.id = bl.budget_id
       JOIN account a ON a.id = bl.account_id
       LEFT JOIN journal_line jl ON jl.account_id = a.id
       LEFT JOIN journal_entry je ON je.id = jl.journal_entry_id
         AND je.period_id = b.period_id AND je.status = 'posted'
       WHERE bl.budget_id = $1
       GROUP BY a.id, a.code, a.name, a.type, a.normal_balance, bl.amount
       ORDER BY a.sort_order, a.code`,
      [budgetId],
    );
    return rows;
  }

  // ── Bank Reconciliation ────────────────────────────────────────────────────

  async importBankStatement(dto: {
    accountId: string;
    bankName: string;
    statementDate: string;
    openingBalance: string;
    closingBalance: string;
    lines: Array<{
      txnDate: string;
      description: string;
      ref?: string;
      debit: string;
      credit: string;
      balance: string;
    }>;
  }) {
    const { tenantId } = TenantStorage.get();
    const { rows } = await this.pool.query(
      `INSERT INTO bank_statement (id, tenant_id, account_id, bank_name, statement_date, opening_balance, closing_balance)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uuidv4(), tenantId, dto.accountId, dto.bankName, dto.statementDate, dto.openingBalance, dto.closingBalance],
    );
    const stmt = rows[0];

    for (const line of dto.lines) {
      await this.pool.query(
        `INSERT INTO bank_statement_line (id, tenant_id, statement_id, txn_date, description, ref, debit, credit, balance)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [uuidv4(), tenantId, stmt.id, line.txnDate, line.description, line.ref ?? null, line.debit, line.credit, line.balance],
      );
    }

    // Auto-match uncleared statement lines to journal lines by amount + date
    await this.autoMatchBankLines(stmt.id as string);

    return stmt;
  }

  private async autoMatchBankLines(statementId: string): Promise<void> {
    const { rows: lines } = await this.pool.query(
      `SELECT * FROM bank_statement_line WHERE statement_id = $1 AND cleared = false`, [statementId],
    );

    for (const line of lines) {
      const amount = new Decimal((line.credit as string || '0')).minus(new Decimal(line.debit as string || '0'));
      const { rows: matches } = await this.pool.query(
        `SELECT jl.id FROM journal_line jl
         JOIN journal_entry je ON je.id = jl.journal_entry_id
         JOIN bank_statement bs ON bs.account_id = jl.account_id AND bs.id = $1
         WHERE ABS(jl.dr - jl.cr - $2) < 1
           AND je.entry_date BETWEEN $3::date - 3 AND $3::date + 3
           AND jl.id NOT IN (SELECT COALESCE(journal_line_id, uuid_nil()) FROM bank_statement_line WHERE journal_line_id IS NOT NULL)
         LIMIT 1`,
        [statementId, amount.toFixed(4), line.txn_date],
      );

      if (matches[0]) {
        await this.pool.query(
          `UPDATE bank_statement_line SET cleared = true, journal_line_id = $1 WHERE id = $2`,
          [matches[0].id, line.id],
        );
      }
    }
  }

  async getUnreconciledLines(statementId: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM bank_statement_line WHERE statement_id = $1 AND cleared = false ORDER BY txn_date`,
      [statementId],
    );
    return rows;
  }

  async clearBankLine(lineId: string, journalLineId: string) {
    await this.pool.query(
      `UPDATE bank_statement_line SET cleared = true, journal_line_id = $1, updated_at = NOW() WHERE id = $2`,
      [journalLineId, lineId],
    );
    return { cleared: true };
  }

  // ── Audit Export ───────────────────────────────────────────────────────────

  async auditExport(fromDate: string, toDate: string) {
    const { rows: entries } = await this.pool.query(
      `SELECT je.*,
         json_agg(json_build_object(
           'account_code', a.code, 'account_name', a.name,
           'dr', jl.dr, 'cr', jl.cr
         ) ORDER BY jl.id) AS lines
       FROM journal_entry je
       JOIN journal_line jl ON jl.journal_entry_id = je.id
       JOIN account a ON a.id = jl.account_id
       WHERE je.entry_date BETWEEN $1 AND $2 AND je.status = 'posted'
       GROUP BY je.id
       ORDER BY je.entry_date, je.entry_no`,
      [fromDate, toDate],
    );
    return {
      exportedAt: new Date().toISOString(),
      fromDate,
      toDate,
      entryCount: entries.length,
      entries,
    };
  }
}
