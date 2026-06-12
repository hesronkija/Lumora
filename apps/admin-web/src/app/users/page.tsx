'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Table, Badge, Card, CardHeader, Button, SearchInput } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { useMemo, useState } from 'react';
import { UserPlus, ShieldCheck } from 'lucide-react';

/**
 * Users & Roles — how a school gets its people into the system.
 * The Owner (or Headteacher/HR) creates accounts and assigns roles;
 * money-touching roles get mandatory MFA via Keycloak.
 */

const ROLE_INFO: Array<{ code: string; name: string; sw: string; access: string; mfa?: boolean; readonly?: boolean }> = [
  { code: 'owner', name: 'Owner / Director', sw: 'Mmiliki', access: 'Everything, including settings & billing', mfa: true },
  { code: 'headteacher', name: 'Headteacher', sw: 'Mwalimu Mkuu', access: 'All academic + approvals, AI drafts, reports', mfa: true },
  { code: 'second_master', name: 'Second Master/Mistress', sw: 'Makamu Mwalimu Mkuu', access: 'Academic + discipline (assign as headteacher role)' },
  { code: 'bursar', name: 'Bursar', sw: 'Mhasibu wa Ada', access: 'Fees, payments, cash dual-control, reconciliation', mfa: true },
  { code: 'accountant', name: 'Accountant', sw: 'Mhasibu', access: 'General ledger, journals, budgets, statements', mfa: true },
  { code: 'hr', name: 'HR Officer', sw: 'Afisa Utumishi', access: 'Staff records, contracts, payroll input' },
  { code: 'teacher', name: 'Teacher', sw: 'Mwalimu', access: 'Own classes: attendance, scores, AI comment drafts' },
  { code: 'class_teacher', name: 'Class Teacher', sw: 'Mwalimu wa Darasa', access: 'Teacher + own-class register and report cards' },
  { code: 'matron', name: 'Matron / Patron', sw: 'Mlezi wa Bweni', access: 'Dorms, leave-outs, visitors, sick bay' },
  { code: 'nurse', name: 'School Nurse', sw: 'Muuguzi', access: 'Sick bay, medical notes (confidential)' },
  { code: 'driver', name: 'Driver', sw: 'Dereva', access: 'Own route manifest and pickups' },
  { code: 'parent', name: 'Parent / Guardian', sw: 'Mzazi/Mlezi', access: 'Own children only: fees, results, attendance, chat' },
  { code: 'student', name: 'Student', sw: 'Mwanafunzi', access: 'Own timetable and results (secondary phase)' },
  { code: 'auditor', name: 'External Auditor', sw: 'Mkaguzi', access: 'Read-only across finance, time-boxed', readonly: true },
];

const DEMO_USERS = [
  { name: 'Upendo Mahenge', email: 'headteacher@greenvalley.sc.tz', roles: ['owner', 'headteacher'], mfa: true, active: true },
  { name: 'Joseph Kileo', email: 'bursar@greenvalley.sc.tz', roles: ['bursar'], mfa: true, active: true },
  { name: 'Rehema Senzige', email: 'accounts@greenvalley.sc.tz', roles: ['accountant'], mfa: true, active: true },
  { name: 'Elia Mrema', email: 'e.mrema@greenvalley.sc.tz', roles: ['teacher', 'class_teacher'], mfa: false, active: true },
  { name: 'Mariam Kondo', email: 'm.kondo@greenvalley.sc.tz', roles: ['teacher', 'class_teacher'], mfa: false, active: true },
  { name: 'Zainabu Salim', email: 'matron@greenvalley.sc.tz', roles: ['matron'], mfa: false, active: true },
  { name: 'Hassan Mtui', email: 'transport@greenvalley.sc.tz', roles: ['driver'], mfa: false, active: true },
];

export default function UsersPage() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const users = useMemo(
    () => DEMO_USERS.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.includes(q.toLowerCase())),
    [q],
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t('users')}
          subtitle="The Owner/Headteacher/HR creates every account and assigns roles. Parents are auto-invited by SMS when linked to a student."
          action={<Button><UserPlus className="h-4 w-4" /> Invite user</Button>}
        />

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="School users" subtitle="Money-touching roles require MFA (enforced by Keycloak)" />
            <div className="p-4 pb-0"><SearchInput value={q} onChange={setQ} placeholder={t('search')} /></div>
            <Table headers={[t('name'), 'Email', 'Roles', 'MFA', t('status')]}>
              {users.map((u) => (
                <tr key={u.email} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <Badge key={r} tone={r === 'owner' ? 'violet' : r === 'bursar' || r === 'accountant' ? 'amber' : 'blue'}>{r}</Badge>)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{u.mfa ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3"><Badge tone="green">{t('active')}</Badge></td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Role library" subtitle="What each role can see and do" />
            <div className="max-h-[560px] divide-y overflow-y-auto">
              {ROLE_INFO.map((r) => (
                <div key={r.code} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{r.name}</p>
                    <span className="text-xs text-muted-foreground">· {r.sw}</span>
                    {r.mfa && <Badge tone="amber">MFA</Badge>}
                    {r.readonly && <Badge tone="gray">read-only</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.access}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
