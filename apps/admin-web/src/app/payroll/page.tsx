'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, StatCard, Badge } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { payslips, payrollTotals, fmtTZS, fmtTZSshort } from '@/lib/demo-data';

export default function PayrollPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t('payroll')}
          subtitle="PAYE (Finance Act 2024) · NSSF 10%+10% · SDL 3.5% · WCF 0.6% · HESLB 15% — every rate versioned in the statutory table"
          action={<Badge tone="blue">{t('runPayroll')} · approved</Badge>}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t('grossPay')} value={`TZS ${fmtTZSshort(payrollTotals.gross)}`} sub="12 payslips" />
          <StatCard label="PAYE" value={`TZS ${fmtTZSshort(payrollTotals.paye)}`} sub="due to TRA by 7th" tone="warn" />
          <StatCard label={t('netPay')} value={`TZS ${fmtTZSshort(payrollTotals.net)}`} tone="good" sub="9 bank · 3 mobile money" />
          <StatCard label={t('employerCosts')} value={`TZS ${fmtTZSshort(payrollTotals.employer)}`} sub="NSSF + SDL + WCF" />
        </div>

        <Table headers={[t('name'), t('position'), t('grossPay'), 'PAYE', 'NSSF', 'HESLB', t('deductions'), t('netPay')]}>
          {payslips.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.position}</td>
              <td className="px-4 py-3">{fmtTZS(p.gross)}</td>
              <td className="px-4 py-3">{fmtTZS(p.paye)}</td>
              <td className="px-4 py-3">{fmtTZS(p.nssf)}</td>
              <td className="px-4 py-3">{p.heslb ? fmtTZS(p.heslb) : '—'}</td>
              <td className="px-4 py-3 text-red-600">{fmtTZS(p.deductions)}</td>
              <td className="px-4 py-3 font-semibold text-emerald-700">{fmtTZS(p.net)}</td>
            </tr>
          ))}
          <tr className="bg-muted/40 font-semibold">
            <td className="px-4 py-3" colSpan={2}>{t('total')}</td>
            <td className="px-4 py-3">{fmtTZS(payrollTotals.gross)}</td>
            <td className="px-4 py-3">{fmtTZS(payrollTotals.paye)}</td>
            <td className="px-4 py-3">{fmtTZS(payrollTotals.nssf)}</td>
            <td className="px-4 py-3">—</td>
            <td className="px-4 py-3 text-red-600">{fmtTZS(payrollTotals.gross - payrollTotals.net)}</td>
            <td className="px-4 py-3 text-emerald-700">{fmtTZS(payrollTotals.net)}</td>
          </tr>
        </Table>
      </div>
    </AppShell>
  );
}
