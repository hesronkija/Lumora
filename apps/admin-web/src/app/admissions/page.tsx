'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, Badge, Card } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { admissionsPipeline, applications } from '@/lib/demo-data';

const STAGE_TONE = { applied: 'gray', interviewed: 'blue', offered: 'amber', enrolled: 'green' } as const;

export default function AdmissionsPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('admissions')} subtitle="2027 intake pipeline · application → interview → offer → enrollment" />

        <div className="grid gap-4 sm:grid-cols-4">
          {admissionsPipeline.map((s, i) => (
            <Card key={s.stage} className="relative p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.stage}</p>
              <p className="mt-2 text-3xl font-bold">{s.count}</p>
              {i < 3 && <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 text-2xl text-muted-foreground/30 sm:block">→</span>}
            </Card>
          ))}
        </div>

        <Table headers={['Ref', t('name'), 'Applying for', t('guardian'), t('date'), 'Stage']}>
          {applications.map((a) => (
            <tr key={a.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs">{a.ref}</td>
              <td className="px-4 py-3 font-medium">{a.name}</td>
              <td className="px-4 py-3">{a.appliedFor}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.guardianPhone}</td>
              <td className="px-4 py-3">{a.date}</td>
              <td className="px-4 py-3"><Badge tone={STAGE_TONE[a.stage]}>{a.stage}</Badge></td>
            </tr>
          ))}
        </Table>
      </div>
    </AppShell>
  );
}
