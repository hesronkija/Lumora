'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, CardHeader, Badge, Button } from '@/components/ui/primitives';
import { Sparkline } from '@/components/charts';
import { kpis, atRisk, collectionByWeek, attendanceByClass, payments, fmtTZSshort } from '@/lib/demo-data';
import { useI18n } from '@/lib/i18n';
import { Sun, AlertTriangle, TrendingUp, TrendingDown, Send, CheckCircle2 } from 'lucide-react';

/**
 * SHULE PULSE — the headteacher's morning briefing. One screen, 60 seconds,
 * auto-generated nightly from real data and sent as an SMS-length digest.
 * No competitor ships this: not a dashboard you study — a briefing you read.
 */

const sms = (lang: 'en' | 'sw') =>
  lang === 'sw'
    ? `Shule Pulse 12/06: Mahudhurio 92% (Std 4 ↓86%). Ada: 33.4M/38.6M (87%). Madeni 5.2M. Wanafunzi 3 wanahitaji ufuatiliaji leo. Salio benki linatosha mishahara ya Juni.`
    : `Shule Pulse 12/06: Attendance 92% (Std 4 dipped to 86%). Fees 33.4M/38.6M (87%). Arrears 5.2M. 3 students need follow-up today. Bank balance covers June payroll.`;

export default function PulsePage() {
  const { lang } = useI18n();
  const worstClass = [...attendanceByClass].sort((a, b) => a.value - b.value)[0]!;
  const todayActions = [
    { icon: AlertTriangle, tone: 'amber', text: `${worstClass.label} attendance dipped to ${worstClass.value}% — ask the class teacher before assembly`, sw: `Mahudhurio ya ${worstClass.label} yameshuka hadi ${worstClass.value}% — muulize mwalimu wa darasa kabla ya asembli` },
    { icon: AlertTriangle, tone: 'red', text: `${atRisk.slice(0, 3).map((s) => s.name.split(' ')[0]).join(', ')} moved up the early-warning list — review flagged signals`, sw: `${atRisk.slice(0, 3).map((s) => s.name.split(' ')[0]).join(', ')} wamepanda kwenye orodha ya tahadhari — pitia viashiria` },
    { icon: TrendingDown, tone: 'amber', text: `Collections slowed: week 6 is TZS ${fmtTZSshort(collectionByWeek[5]!.value)} vs ${fmtTZSshort(collectionByWeek[3]!.value)} in week 4 — send the fee reminder broadcast`, sw: `Makusanyo yamepungua wiki hii — tuma ukumbusho wa ada` },
    { icon: CheckCircle2, tone: 'green', text: `June payroll is fully covered by the current bank balance — approve by the 25th`, sw: `Mishahara ya Juni inalipika kwa salio la sasa — idhinisha kabla ya tarehe 25` },
  ] as const;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Shule Pulse"
          subtitle="Your 60-second morning briefing — generated nightly, sent to your phone at 06:30"
          action={<Button variant="outline"><Send className="h-4 w-4" /> Send test SMS</Button>}
        />

        {/* The briefing */}
        <Card className="border-l-4 border-l-primary">
          <div className="flex items-start gap-4 p-6">
            <Sun className="mt-1 h-8 w-8 text-amber-500" />
            <div>
              <p className="text-sm text-muted-foreground">Friday, 12 June 2026 · Term 2, week 8 · Green Valley Primary</p>
              <h2 className="mt-1 text-xl font-bold">
                {lang === 'sw' ? 'Habari za asubuhi, Mwalimu Mkuu. Mambo manne yanahitaji macho yako leo.' : 'Good morning, Headteacher. Four things need your eyes today.'}
              </h2>
            </div>
          </div>
          <div className="divide-y border-t">
            {todayActions.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5">
                <a.icon className={`h-5 w-5 shrink-0 ${a.tone === 'red' ? 'text-red-500' : a.tone === 'amber' ? 'text-amber-500' : 'text-emerald-500'}`} />
                <p className="text-sm">{lang === 'sw' ? a.sw : a.text}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Vital signs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Attendance', value: `${kpis.attendanceToday}%`, trend: [94, 93, 92, 93, 91, 92], up: false },
            { label: 'Collection rate', value: `${kpis.feesCollectionRate}%`, trend: [62, 70, 76, 81, 85, 87], up: true },
            { label: 'Arrears', value: `TZS ${fmtTZSshort(kpis.arrears)}`, trend: [14, 12, 10, 8, 6.4, 5.2], up: true },
            { label: 'Flagged students', value: String(atRisk.length), trend: [16, 15, 14, 13, 12, 12], up: true },
          ].map((v) => (
            <Card key={v.label} className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{v.label}</p>
                <p className="mt-1 text-2xl font-bold">{v.value}</p>
              </div>
              <div className="text-right">
                <Sparkline values={v.trend} />
                {v.up ? <TrendingUp className="ml-auto h-4 w-4 text-emerald-500" /> : <TrendingDown className="ml-auto h-4 w-4 text-amber-500" />}
              </div>
            </Card>
          ))}
        </div>

        {/* The SMS version */}
        <Card>
          <CardHeader title="The SMS that goes to your phone" subtitle="160 characters — works on any phone, no app, no internet" />
          <div className="p-5">
            <div className="max-w-md rounded-2xl rounded-tl-sm bg-muted p-4 text-sm leading-relaxed">
              {sms(lang)}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Owners with multiple schools receive one Pulse per school. Bursar and class teachers get role-specific versions.
            </p>
          </div>
        </Card>

        {/* Recent money movement */}
        <Card>
          <CardHeader title="Overnight money movement" subtitle="Payments that arrived since yesterday's Pulse" />
          <div className="divide-y">
            {payments.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span>{p.student} <span className="text-xs text-muted-foreground">· {p.provider}</span></span>
                <Badge tone="green">+ TZS {fmtTZSshort(p.amount)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
