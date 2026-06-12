'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, StatCard, Card, CardHeader, Table, Badge } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { routes, fmtTZS } from '@/lib/demo-data';

export default function TransportPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('transport')} subtitle="Bus routes · pickup points · canteen meal wallets" />

        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Routes" value={routes.length} sub="morning + afternoon" />
          <StatCard label="Students on transport" value={routes.reduce((a, r) => a + r.students, 0)} />
          <StatCard label="Meal wallets active" value={61} sub="canteen tap-to-pay" />
          <StatCard label="Wallet top-ups (May)" value={fmtTZS(1_830_000)} tone="good" />
        </div>

        <Card>
          <CardHeader title="Bus routes" subtitle="Live driver assignment & loading" />
          <Table headers={['Route', 'Driver', 'Bus', 'Pickup points', t('students'), t('status')]}>
            {routes.map((r) => (
              <tr key={r.name} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.driver}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.bus}</td>
                <td className="px-4 py-3">{r.pickups}</td>
                <td className="px-4 py-3">{r.students}</td>
                <td className="px-4 py-3"><Badge tone="green">{t('active')}</Badge></td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
