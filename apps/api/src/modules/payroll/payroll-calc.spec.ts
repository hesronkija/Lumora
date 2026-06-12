import { PayrollService } from './payroll.service';
import Decimal from 'decimal.js';

/**
 * Statutory payroll math, verified against the Finance Act 2024 resident
 * monthly PAYE table and current contribution orders. All rates flow from
 * the statutory_rate table — the fake pool below serves the same configs
 * the seed installs.
 */
const RATES: Record<string, unknown> = {
  paye_bracket: [
    { from: 0, to: 270000, rate: 0 },
    { from: 270000, to: 520000, rate: 0.08 },
    { from: 520000, to: 760000, rate: 0.2 },
    { from: 760000, to: 1000000, rate: 0.25 },
    { from: 1000000, to: null, rate: 0.3 },
  ],
  nssf_employee: { rate: 0.1 },
  nssf_employer: { rate: 0.1 },
  psssf_employee: { rate: 0.05 },
  psssf_employer: { rate: 0.15 },
  heslb: { rate: 0.15, basis: 'basic' },
  wcf: { rate: 0.006 },
  sdl: { rate: 0.035, min_employees: 10 },
};

const fakePool = {
  query: jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('FROM statutory_rate')) {
      const rateType = params?.[0] as string;
      const config = RATES[rateType];
      return { rows: config ? [{ config }] : [], rowCount: config ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }),
} as never;

const stub = { log: jest.fn() } as never;

describe('PAYE (progressive monthly brackets)', () => {
  const svc = new PayrollService(fakePool, stub, stub);

  it.each([
    [200_000, 0],          // below threshold — no tax
    [270_000, 0],          // exactly at threshold
    [520_000, 20_000],     // 8% of the 250k above 270k
    [760_000, 68_000],     // + 20% of 240k
    [1_000_000, 128_000],  // + 25% of 240k
    [2_000_000, 428_000],  // + 30% of the 1m above 1m
  ])('gross %i TZS → PAYE %i TZS', async (gross, expected) => {
    const paye = await svc.calculatePaye(new Decimal(gross));
    expect(paye.toNumber()).toBeCloseTo(expected, 2);
  });
});

describe('full payslip calculation', () => {
  const svc = new PayrollService(fakePool, stub, stub);

  const input = {
    staffId: 'staff-1',
    pensionFund: 'nssf' as const,
    hasHeslbLoan: true,
    disbursementMethod: 'bank' as const,
    earnings: [
      { code: 'BASIC', label: 'Basic Salary', amount: '800000' },
      { code: 'HOUSE', label: 'Housing Allowance', amount: '200000' },
    ],
  };

  it('computes every statutory line for a 1,000,000 TZS gross', async () => {
    const calc = await svc.calculatePayslip(input, 12);
    expect(calc.gross).toBe('1000000.0000');
    expect(calc.basic).toBe('800000.0000');
    expect(calc.paye).toBe('128000.0000');
    expect(calc.nssfEmployee).toBe('100000.0000'); // 10% gross
    expect(calc.nssfEmployer).toBe('100000.0000');
    expect(calc.heslb).toBe('120000.0000');        // 15% of BASIC
    expect(calc.wcf).toBe('6000.0000');            // 0.6% employer
    expect(calc.sdl).toBe('35000.0000');           // 3.5% employer (≥10 staff)
    expect(calc.totalDeductions).toBe('348000.0000');
    expect(calc.netPay).toBe('652000.0000');
  });

  it('waives SDL below the 10-employee threshold', async () => {
    const calc = await svc.calculatePayslip(input, 7);
    expect(calc.sdl).toBe('0.0000');
  });

  it('uses PSSSF rates for public-sector staff', async () => {
    const calc = await svc.calculatePayslip({ ...input, pensionFund: 'psssf' }, 12);
    expect(calc.nssfEmployee).toBe('50000.0000');  // 5% employee
    expect(calc.nssfEmployer).toBe('150000.0000'); // 15% employer
  });

  it('charges no HESLB for staff without a loan', async () => {
    const calc = await svc.calculatePayslip({ ...input, hasHeslbLoan: false }, 12);
    expect(calc.heslb).toBe('0.0000');
    expect(calc.netPay).toBe('772000.0000');
  });

  it('net pay + deductions always reconstruct gross (no money leaks)', async () => {
    const calc = await svc.calculatePayslip(input, 12);
    const reconstructed = new Decimal(calc.netPay).plus(calc.totalDeductions);
    expect(reconstructed.toFixed(4)).toBe(calc.gross);
  });
});
