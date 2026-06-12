'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, SearchInput, Badge, StatCard, Card, CardHeader } from '@/components/ui/primitives';
import { Donut } from '@/components/charts';
import { useI18n } from '@/lib/i18n';
import { payments, channelMix, fmtTZS, fmtTZSshort } from '@/lib/demo-data';
import { useMemo, useState } from 'react';

export default function PaymentsPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => payments.filter((p) => p.student.toLowerCase().includes(query.toLowerCase()) || p.ref.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const total = payments.reduce((a, p) => a + p.amount, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('payments')} subtitle="M-Pesa · Tigo Pesa · Airtel Money · NMB · CRDB · GePG · Cash — webhooks verified, reconciled nightly" />

        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard label={t('total')} value={`TZS ${fmtTZSshort(total)}`} sub={`${payments.length} completed payments`} tone="good" />
          <StatCard label="Mobile money" value={`TZS ${fmtTZSshort(channelMix[0]!.value)}`} sub="Selcom aggregation" />
          <StatCard label="Bank" value={`TZS ${fmtTZSshort(channelMix[1]!.value)}`} sub="NMB · CRDB" />
          <Card className="p-4">
            <Donut size={110} data={[
              { label: 'Mobile', value: channelMix[0]!.value, color: 'hsl(160 84% 39%)' },
              { label: 'Bank', value: channelMix[1]!.value, color: 'hsl(221 83% 53%)' },
            ]} />
          </Card>
        </div>

        <div className="flex items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder={t('search')} />
          <span className="text-xs text-muted-foreground">{t('reconciliation')}: last run 2026-06-11 02:00 · 72 matched · 0 ambiguous</span>
        </div>

        <Table headers={[t('reference'), t('name'), t('amount'), t('channel'), t('provider'), t('date'), t('status')]}>
          {filtered.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs">{p.ref}</td>
              <td className="px-4 py-3 font-medium">{p.student}</td>
              <td className="px-4 py-3 font-semibold text-emerald-700">{fmtTZS(p.amount)}</td>
              <td className="px-4 py-3">{p.channel}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.provider}</td>
              <td className="px-4 py-3">{p.date}</td>
              <td className="px-4 py-3"><Badge tone="green">{p.status}</Badge></td>
            </tr>
          ))}
        </Table>
      </div>
    </AppShell>
  );
}
