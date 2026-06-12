'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, StatCard, Badge, Card, CardHeader } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { accounts, journal, fmtTZS, fmtTZSshort } from '@/lib/demo-data';

export default function AccountingPage() {
  const { t } = useI18n();
  const income = accounts.filter((a) => a.type === 'Income').reduce((s, a) => s + a.balance, 0);
  const expense = accounts.filter((a) => a.type === 'Expense').reduce((s, a) => s + a.balance, 0);
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('accounting')} subtitle="Double-entry general ledger · every payment, payroll run and reversal posts a balanced journal" />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Income (Term 2)" value={`TZS ${fmtTZSshort(income)}`} tone="good" sub="Fee income invoiced" />
          <StatCard label="Expenses" value={`TZS ${fmtTZSshort(expense)}`} sub="Salaries · utilities · transport" />
          <StatCard label="Surplus" value={`TZS ${fmtTZSshort(income - expense)}`} tone={income > expense ? 'good' : 'bad'} sub="before depreciation" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Chart of accounts" subtitle="Trial balance extract" />
            <Table headers={['Code', 'Account', 'Type', t('balance')]}>
              {accounts.map((a) => (
                <tr key={a.code} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{a.code}</td>
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={a.type === 'Asset' ? 'blue' : a.type === 'Income' ? 'green' : a.type === 'Liability' ? 'amber' : 'gray'}>{a.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5">{fmtTZS(a.balance)}</td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card>
            <CardHeader title="Recent journal entries" subtitle="DR always equals CR — enforced by the API" />
            <Table headers={['Entry', t('date'), 'Narrative', 'Source', 'DR = CR']}>
              {journal.map((j) => (
                <tr key={j.no} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{j.no}</td>
                  <td className="px-4 py-2.5">{j.date}</td>
                  <td className="px-4 py-2.5">{j.narrative}</td>
                  <td className="px-4 py-2.5"><Badge tone={j.source === 'payments' ? 'green' : j.source === 'payroll' ? 'blue' : 'gray'}>{j.source}</Badge></td>
                  <td className="px-4 py-2.5">{fmtTZS(j.dr)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
