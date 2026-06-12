'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, SearchInput, Badge, StatCard } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { students, fmtTZS } from '@/lib/demo-data';
import { useMemo, useState } from 'react';
import Link from 'next/link';

const KLASSES = ['All', ...Array.from({ length: 7 }, (_, i) => `Std ${i + 1} A`)];

export default function StudentsPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [klass, setKlass] = useState('All');

  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          (klass === 'All' || s.klass === klass) &&
          (s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.admissionNo.toLowerCase().includes(query.toLowerCase())),
      ),
    [query, klass],
  );

  const girls = students.filter((s) => s.gender === 'female').length;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('students')} subtitle="Student registry · 2025/2026" />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('totalStudents')} value={students.length} />
          <StatCard label="Girls / Boys" value={`${girls} / ${students.length - girls}`} />
          <StatCard label={t('attendanceToday')} value={`${Math.round(students.reduce((a, s) => a + s.attendanceRate, 0) / students.length)}%`} tone="good" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder={t('search')} />
          <select
            value={klass}
            onChange={(e) => setKlass(e.target.value)}
            className="rounded-lg border bg-card px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {KLASSES.map((k) => <option key={k}>{k}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{filtered.length} / {students.length}</span>
        </div>

        <Table headers={['Adm. No', t('name'), t('klass'), t('guardian'), t('phone'), t('attendance'), t('average'), t('fees')]}>
          {filtered.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs">{s.admissionNo}</td>
              <td className="px-4 py-3">
                <Link href={`/students/${s.id}`} className="font-medium text-primary hover:underline">{s.name}</Link>
              </td>
              <td className="px-4 py-3">{s.klass}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.guardian}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.guardianPhone}</td>
              <td className="px-4 py-3">
                <Badge tone={s.attendanceRate >= 92 ? 'green' : s.attendanceRate >= 85 ? 'amber' : 'red'}>{s.attendanceRate}%</Badge>
              </td>
              <td className="px-4 py-3">{s.average}%</td>
              <td className="px-4 py-3">
                <Badge tone={s.feeStatus === 'paid' ? 'green' : s.feeStatus === 'partial' ? 'amber' : 'red'}>
                  {t(s.feeStatus)}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </AppShell>
  );
}
