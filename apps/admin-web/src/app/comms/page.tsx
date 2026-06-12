'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, StatCard, Card, CardHeader, Table, Badge } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { messagesLog, fmtTZS } from '@/lib/demo-data';

export default function CommsPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('comms')} subtitle="SMS (Beem) · WhatsApp Business · email — consent-tracked, PDPA-compliant opt-outs" />

        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Messages (June)" value={246} sub="3 broadcasts" />
          <StatCard label="Delivery rate" value="98.8%" tone="good" />
          <StatCard label="SMS cost (June)" value={fmtTZS(4200)} sub="~TZS 25 / SMS" />
          <StatCard label="Opt-outs" value={0} tone="good" sub="consent ledger clean" />
        </div>

        <Card>
          <CardHeader title="Broadcast history" subtitle="Every message linked to a template and cost entry" />
          <Table headers={[t('date'), t('channel'), 'Recipients', 'Template', 'Cost', t('status')]}>
            {messagesLog.map((m, i) => (
              <tr key={i} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">{m.date}</td>
                <td className="px-4 py-3"><Badge tone={m.channel === 'SMS' ? 'blue' : 'green'}>{m.channel}</Badge></td>
                <td className="px-4 py-3">{m.to}</td>
                <td className="px-4 py-3 font-medium">{m.template}</td>
                <td className="px-4 py-3">{m.cost ? fmtTZS(m.cost) : 'Free'}</td>
                <td className="px-4 py-3"><Badge tone="green">{m.status}</Badge></td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
