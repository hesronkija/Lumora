'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, SearchInput, Badge, StatCard } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { staff, fmtTZS } from '@/lib/demo-data';
import { useMemo, useState } from 'react';

export default function HrPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => staff.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.position.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('hr')} subtitle="Staff registry · contracts · statutory numbers (TIN, NSSF, TSC)" />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('activeStaff')} value={staff.length} sub="9 teaching · 3 support" />
          <StatCard label="Departments" value={5} sub="Academics · Finance · Admin · Transport · Boarding" />
          <StatCard label="HESLB deductees" value={staff.filter((s) => s.hasHeslb).length} sub="15% of basic, auto-deducted" />
        </div>

        <SearchInput value={query} onChange={setQuery} placeholder={t('search')} />

        <Table headers={['Emp. No', t('name'), t('position'), 'Department', 'Basic salary', 'Pension', 'Disbursement', t('status')]}>
          {filtered.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs">{s.employeeNo}</td>
              <td className="px-4 py-3 font-medium">{s.name}</td>
              <td className="px-4 py-3">{s.position}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.department}</td>
              <td className="px-4 py-3">{fmtTZS(s.basicSalary)}</td>
              <td className="px-4 py-3">{s.pensionFund}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.disbursement}</td>
              <td className="px-4 py-3"><Badge tone="green">{t('active')}</Badge></td>
            </tr>
          ))}
        </Table>
      </div>
    </AppShell>
  );
}
