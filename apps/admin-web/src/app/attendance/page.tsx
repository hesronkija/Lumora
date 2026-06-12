'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, CardHeader, StatCard, Badge, ProgressBar } from '@/components/ui/primitives';
import { BarChart } from '@/components/charts';
import { useI18n } from '@/lib/i18n';
import { students, attendanceByClass, kpis } from '@/lib/demo-data';

export default function AttendancePage() {
  const { t } = useI18n();
  const low = [...students].sort((a, b) => a.attendanceRate - b.attendanceRate).slice(0, 8);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('attendance')} subtitle="Daily register · teachers mark on mobile, offline-first, syncs when network returns" />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="School average" value={`${kpis.attendanceToday}%`} tone="good" sub="last 20 school days" />
          <StatCard label="Sessions taken" value={140} sub="7 classes × 20 days" />
          <StatCard label="Chronic absentees" value={low.filter((s) => s.attendanceRate < 85).length} tone="warn" sub="below 85% — flagged to class teacher" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={t('attendanceByClass')} subtitle="% present · last 4 weeks" />
            <div className="p-5"><BarChart data={attendanceByClass} format={(v) => `${v}%`} /></div>
          </Card>
          <Card>
            <CardHeader title="Lowest attendance" subtitle="Follow-up list for class teachers" />
            <div className="space-y-4 p-5">
              {low.map((s) => (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{s.name} <span className="text-xs text-muted-foreground">({s.klass})</span></span>
                    <Badge tone={s.attendanceRate >= 90 ? 'green' : s.attendanceRate >= 85 ? 'amber' : 'red'}>{s.attendanceRate}%</Badge>
                  </div>
                  <ProgressBar pct={s.attendanceRate} tone={s.attendanceRate >= 90 ? 'green' : s.attendanceRate >= 85 ? 'amber' : 'red'} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
