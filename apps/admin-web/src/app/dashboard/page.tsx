'use client';

import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, StatCard, Badge } from '@/components/ui/primitives';
import { BarChart, Donut } from '@/components/charts';
import { useI18n } from '@/lib/i18n';
import {
  kpis, collectionByWeek, attendanceByClass, channelMix, payments, atRisk,
  fmtTZS, fmtTZSshort,
} from '@/lib/demo-data';
import { Users, Briefcase, Banknote, AlertTriangle, CalendarCheck, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard')}</h1>
          <p className="text-sm text-muted-foreground">{t('welcome')} · Green Valley Primary School · 2025/2026 · Term 2</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label={t('totalStudents')} value={kpis.students} icon={<Users className="h-4 w-4" />} sub="Std 1 – Std 7" />
          <StatCard label={t('activeStaff')} value={kpis.staff} icon={<Briefcase className="h-4 w-4" />} sub="9 teaching · 3 support" />
          <StatCard label={t('feesCollected')} value={`TZS ${fmtTZSshort(kpis.collected)}`} icon={<Banknote className="h-4 w-4" />} tone="good" sub={`${kpis.feesCollectionRate}% ${t('collectionRate')}`} />
          <StatCard label={t('outstandingArrears')} value={`TZS ${fmtTZSshort(kpis.arrears)}`} icon={<AlertTriangle className="h-4 w-4" />} tone="warn" sub="17 invoices open" />
          <StatCard label={t('attendanceToday')} value={`${kpis.attendanceToday}%`} icon={<CalendarCheck className="h-4 w-4" />} tone="good" />
          <StatCard label={t('collectionRate')} value={`${kpis.feesCollectionRate}%`} icon={<TrendingUp className="h-4 w-4" />} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={t('weeklyCollections')} subtitle="Term 2 · TZS" />
            <div className="p-5">
              <BarChart data={collectionByWeek} format={(v) => fmtTZSshort(v)} />
            </div>
          </Card>
          <Card>
            <CardHeader title={t('paymentChannels')} />
            <div className="flex items-center justify-center p-5">
              <Donut
                data={[
                  { label: 'M-Pesa / Selcom', value: channelMix[0]!.value, color: 'hsl(160 84% 39%)' },
                  { label: 'Bank (NMB/CRDB)', value: channelMix[1]!.value, color: 'hsl(221 83% 53%)' },
                ]}
              />
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title={t('attendanceByClass')} subtitle="% present · last 4 weeks" />
            <div className="p-5">
              <BarChart data={attendanceByClass} height={150} format={(v) => `${v}%`} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t('recentPayments')}
              action={<Link href="/payments" className="text-xs font-medium text-primary hover:underline">{t('viewAll')}</Link>}
            />
            <div className="divide-y">
              {payments.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{p.student}</p>
                    <p className="text-xs text-muted-foreground">{p.provider} · {p.date}</p>
                  </div>
                  <span className="font-semibold text-emerald-600">{fmtTZS(p.amount)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t('atRiskStudents')}
              subtitle="AI early-warning · human review required"
              action={<Link href="/reports" className="text-xs font-medium text-primary hover:underline">{t('viewAll')}</Link>}
            />
            <div className="divide-y">
              {atRisk.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.klass} · {s.signals.join(' · ')}</p>
                  </div>
                  <Badge tone={s.score >= 0.45 ? 'red' : s.score >= 0.3 ? 'amber' : 'gray'}>
                    {Math.round(s.score * 100)}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
