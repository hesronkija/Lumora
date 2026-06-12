'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, StatCard, Badge, Card, CardHeader } from '@/components/ui/primitives';
import { BarChart } from '@/components/charts';
import { useI18n } from '@/lib/i18n';
import { students, SUBJECTS } from '@/lib/demo-data';
import { useState } from 'react';

const KLASSES = Array.from({ length: 7 }, (_, i) => `Std ${i + 1} A`);

export default function ExamsPage() {
  const { t } = useI18n();
  const [klass, setKlass] = useState('Std 7 A');
  const cls = students.filter((s) => s.klass === klass).sort((a, b) => a.position - b.position);
  const classAvgBySubject = SUBJECTS.map((subj, si) => {
    const c = KLASSES.indexOf(klass);
    let sum = 0;
    for (let k = 0; k < 12; k++) sum += 38 + ((k * 17 + si * 13 + c * 7) % 58);
    return { label: subj.code, value: Math.round(sum / 12) };
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('exams')} subtitle="End of Term 1 · 2026 · positions ranked automatically · report cards published to parents" />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Exams held" value={7} sub="End of Term 1 — all classes" />
          <StatCard label="Scores entered" value={672} sub="84 students × 8 subjects" />
          <StatCard label="Report cards" value={84} tone="good" sub="published 2026-03-27" />
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1" style={{ maxWidth: 'fit-content' }}>
          {KLASSES.map((k) => (
            <button key={k} onClick={() => setKlass(k)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${klass === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {k}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={`Class ranking — ${klass}`} subtitle="End of Term 1" />
            <Table headers={['#', t('name'), t('average'), 'Grade']}>
              {cls.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-semibold">{s.position}</td>
                  <td className="px-4 py-2.5">{s.name}</td>
                  <td className="px-4 py-2.5">{s.average}%</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={s.average >= 81 ? 'green' : s.average >= 61 ? 'blue' : s.average >= 41 ? 'amber' : 'red'}>
                      {s.average >= 81 ? 'A' : s.average >= 61 ? 'B' : s.average >= 41 ? 'C' : 'D'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card>
            <CardHeader title="Subject averages" subtitle={klass} />
            <div className="p-5"><BarChart data={classAvgBySubject} format={(v) => `${v}%`} /></div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
