'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, SearchInput, Badge, StatCard } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { invoices, kpis, fmtTZS, fmtTZSshort } from '@/lib/demo-data';
import { useMemo, useState } from 'react';

const STATUSES = ['All', 'paid', 'partial', 'issued'] as const;

export default function FeesPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('All');

  const filtered = useMemo(
    () => invoices.filter(
      (i) => (status === 'All' || i.status === status) &&
        (i.student.toLowerCase().includes(query.toLowerCase()) || i.controlNo.includes(query) || i.invoiceNo.includes(query.toUpperCase())),
    ),
    [query, status],
  );

  const open = invoices.filter((i) => i.status !== 'paid');

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('fees')} subtitle="Term 2 2026 · Day Scholar structure: TZS 460,000 (Tuition 350k · Meals 90k · Exams 20k)" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Invoiced" value={`TZS ${fmtTZSshort(invoices.reduce((a, i) => a + i.amount, 0))}`} sub={`${invoices.length} invoices`} />
          <StatCard label={t('feesCollected')} value={`TZS ${fmtTZSshort(kpis.collected)}`} tone="good" sub={`${kpis.feesCollectionRate}%`} />
          <StatCard label={t('outstandingArrears')} value={`TZS ${fmtTZSshort(kpis.arrears)}`} tone="warn" sub={`${open.length} open invoices`} />
          <StatCard label="Fully paid" value={invoices.filter((i) => i.status === 'paid').length} sub={`of ${invoices.length} students`} tone="good" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder={t('search')} />
          <div className="flex gap-1 rounded-lg border bg-card p-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {s === 'All' ? t('all') : t(s as 'paid' | 'partial' | 'issued')}
              </button>
            ))}
          </div>
        </div>

        <Table headers={[t('invoiceNo'), t('name'), t('klass'), t('controlNo'), t('amount'), t('paid'), t('balance'), t('status')]}>
          {filtered.map((i) => (
            <tr key={i.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs">{i.invoiceNo}</td>
              <td className="px-4 py-3 font-medium">{i.student}</td>
              <td className="px-4 py-3">{i.klass}</td>
              <td className="px-4 py-3 font-mono text-xs">{i.controlNo}</td>
              <td className="px-4 py-3">{fmtTZS(i.amount)}</td>
              <td className="px-4 py-3 text-emerald-700">{fmtTZS(i.paid)}</td>
              <td className="px-4 py-3 font-medium">{fmtTZS(i.amount - i.paid)}</td>
              <td className="px-4 py-3">
                <Badge tone={i.status === 'paid' ? 'green' : i.status === 'partial' ? 'amber' : 'red'}>{t(i.status)}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </AppShell>
  );
}
