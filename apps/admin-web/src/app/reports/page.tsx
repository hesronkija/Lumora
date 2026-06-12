'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, StatCard, Card, CardHeader, Table, Badge, Button } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { atRisk, kpis, fmtTZSshort } from '@/lib/demo-data';
import { Download, FileText, ShieldCheck } from 'lucide-react';

const EXPORTS = [
  { name: 'NECTA PSLE candidate register (Std VII)', format: 'CSV — NECTA layout', icon: FileText },
  { name: 'TAMISEMI BEMIS enrollment feed', format: 'CSV — BEMIS schema', icon: FileText },
  { name: 'School inspector bundle', format: 'ZIP — attendance, staffing, finances', icon: ShieldCheck },
  { name: 'PDPA data-subject report', format: 'PDF — per guardian request', icon: ShieldCheck },
];

export default function ReportsPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('reports')} subtitle="Compliance exports + the AI early-warning list" />

        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Enrollment" value={kpis.students} sub="BEMIS-ready" />
          <StatCard label="PSLE candidates" value={12} sub="Std VII · 2026 sitting" />
          <StatCard label="Collections YTD" value={`TZS ${fmtTZSshort(kpis.collected)}`} tone="good" />
          <StatCard label="Flagged students" value={atRisk.length} tone="warn" sub="early-warning review list" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Compliance exports" subtitle="Formats prescribed by each authority" />
            <div className="divide-y">
              {EXPORTS.map((e) => (
                <div key={e.name} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <e.icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.format}</p>
                    </div>
                  </div>
                  <Button variant="outline"><Download className="h-3.5 w-3.5" /> {t('export')}</Button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title={t('atRiskStudents')} subtitle="Attendance × grades × arrears · headteacher reviews every flag" />
            <Table headers={[t('name'), t('klass'), t('riskSignals'), 'Score']}>
              {atRisk.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5">{s.klass}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.signals.join(' · ')}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={s.score >= 0.45 ? 'red' : s.score >= 0.3 ? 'amber' : 'gray'}>{Math.round(s.score * 100)}</Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
