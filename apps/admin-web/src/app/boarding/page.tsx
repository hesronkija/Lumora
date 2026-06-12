'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, StatCard, Card, CardHeader, ProgressBar, Badge } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { dorms } from '@/lib/demo-data';

export default function BoardingPage() {
  const { t } = useI18n();
  const totalCap = dorms.reduce((a, d) => a + d.capacity, 0);
  const occupied = dorms.reduce((a, d) => a + d.occupied, 0);
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('boarding')} subtitle="Dorms · leave-outs · visitors · sick bay — boarder safety with a full audit trail" />

        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Capacity" value={totalCap} sub="2 houses" />
          <StatCard label="Boarders" value={occupied} tone="good" sub={`${Math.round((occupied / totalCap) * 100)}% occupancy`} />
          <StatCard label="Leave-outs (this weekend)" value={6} sub="all guardian-approved" />
          <StatCard label="Sick bay" value={1} tone="warn" sub="1 student under observation" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {dorms.map((d) => (
            <Card key={d.name}>
              <CardHeader title={d.name} subtitle={`${d.gender} · Matron/Patron: ${d.matron}`} action={<Badge tone={d.occupied / d.capacity > 0.9 ? 'amber' : 'green'}>{d.occupied}/{d.capacity}</Badge>} />
              <div className="p-5">
                <ProgressBar pct={(d.occupied / d.capacity) * 100} tone={d.occupied / d.capacity > 0.9 ? 'amber' : 'green'} />
                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Beds free</p><p className="font-semibold">{d.capacity - d.occupied}</p></div>
                  <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Visitors today</p><p className="font-semibold">2</p></div>
                  <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Open leave-outs</p><p className="font-semibold">3</p></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
