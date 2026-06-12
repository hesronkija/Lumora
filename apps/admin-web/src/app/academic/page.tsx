'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, StatCard, Card, CardHeader, Badge } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { students, SUBJECTS } from '@/lib/demo-data';

export default function AcademicPage() {
  const { t } = useI18n();
  const classes = Array.from({ length: 7 }, (_, c) => {
    const cls = students.slice(c * 12, c * 12 + 12);
    return {
      level: `Std ${c + 1}`, stream: 'A', students: cls.length,
      girls: cls.filter((s) => s.gender === 'female').length,
      avg: Math.round((cls.reduce((a, s) => a + s.average, 0) / cls.length) * 10) / 10,
      teacher: ['Elia Mrema', 'Mariam Kondo', 'Peter Mselle', 'Agnes Mallya', 'Samson Nnko', 'Lucy Mboya', 'Elia Mrema'][c],
    };
  });
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('academic')} subtitle="2025/2026 · Term 2 (20 Apr – 26 Jun) · TIE primary curriculum" />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Classes" value={7} sub="Std 1 – Std 7 · single stream" />
          <StatCard label="Subjects" value={SUBJECTS.length} sub="5 core + 3 elective" />
          <StatCard label="Terms" value="3" sub="Current: Term 2" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Classes" subtitle="Class teachers & enrolment" />
            <Table headers={[t('klass'), 'Class teacher', t('students'), 'Girls/Boys', t('average')]}>
              {classes.map((c) => (
                <tr key={c.level} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{c.level} {c.stream}</td>
                  <td className="px-4 py-2.5">{c.teacher}</td>
                  <td className="px-4 py-2.5">{c.students}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.girls}/{c.students - c.girls}</td>
                  <td className="px-4 py-2.5">{c.avg}%</td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card>
            <CardHeader title="Subjects" subtitle="TIE / NECTA aligned" />
            <Table headers={['Code', 'Subject', 'Type']}>
              {SUBJECTS.map((s, i) => (
                <tr key={s.code} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5"><Badge tone={i < 5 ? 'blue' : 'gray'}>{i < 5 ? 'Core' : 'Elective'}</Badge></td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
