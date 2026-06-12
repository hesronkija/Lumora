'use client';

import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, StatCard, Badge, ProgressBar } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { students, invoices, SUBJECTS, fmtTZS } from '@/lib/demo-data';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function StudentProfilePage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const student = students.find((s) => s.id === params.id);
  if (!student) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Student not found.</p>
      </AppShell>
    );
  }
  const idx = students.indexOf(student);
  const invoice = invoices[idx]!;
  const k = idx % 12; const c = Math.floor(idx / 12);
  const subjectScores = SUBJECTS.map((s, i) => ({
    subject: s.name, score: 38 + ((k * 17 + i * 13 + c * 7) % 58),
  }));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <Link href="/students" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> {t('students')}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {student.name.split(' ').map((p) => p[0]).join('')}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
              <p className="text-sm text-muted-foreground">
                {student.admissionNo} · {student.klass} · {student.gender === 'female' ? '♀' : '♂'} · DOB {student.dob}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t('attendance')} value={`${student.attendanceRate}%`} tone={student.attendanceRate >= 90 ? 'good' : 'warn'} sub="last 4 weeks" />
          <StatCard label={t('average')} value={`${student.average}%`} sub={`Position ${student.position} of ${student.classSize}`} />
          <StatCard label={t('balance')} value={fmtTZS(invoice.amount - invoice.paid)} tone={invoice.amount - invoice.paid > 0 ? 'warn' : 'good'} sub={`of ${fmtTZS(invoice.amount)} · Term 2`} />
          <StatCard label={t('guardian')} value={<span className="text-base">{student.guardian}</span>} sub={student.guardianPhone} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="End of Term 1 — subject results"
              subtitle={`Average ${student.average}% · Position ${student.position}/${student.classSize}`}
              action={<Link href={`/students/${student.id}/report-card`} className="text-xs font-medium text-primary hover:underline">Print report card →</Link>}
            />
            <div className="space-y-3 p-5">
              {subjectScores.map((s) => (
                <div key={s.subject}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{s.subject}</span>
                    <span className="font-semibold">{s.score}%</span>
                  </div>
                  <ProgressBar pct={s.score} tone={s.score >= 75 ? 'green' : s.score >= 50 ? 'blue' : s.score >= 41 ? 'amber' : 'red'} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title={`${t('fees')} — Term 2 2026`} subtitle={invoice.invoiceNo} />
            <div className="space-y-4 p-5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('controlNo')}</span><span className="font-mono">{invoice.controlNo}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('amount')}</span><span>{fmtTZS(invoice.amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('paid')}</span><span className="text-emerald-600">{fmtTZS(invoice.paid)}</span></div>
              <div className="flex justify-between border-t pt-3 font-semibold"><span>{t('balance')}</span><span>{fmtTZS(invoice.amount - invoice.paid)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('status')}</span>
                <Badge tone={invoice.status === 'paid' ? 'green' : invoice.status === 'partial' ? 'amber' : 'red'}>{t(invoice.status)}</Badge>
              </div>
              <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Parents pay with the control number via M-Pesa, Tigo Pesa, Airtel Money, NMB or CRDB. Receipts post automatically.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
