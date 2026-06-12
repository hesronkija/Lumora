'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, CardHeader, ProgressBar, Badge, Button, Table } from '@/components/ui/primitives';
import { fmtTZS, fmtTZSshort } from '@/lib/demo-data';
import { HeartHandshake, Plus } from 'lucide-react';

/**
 * HARAMBEE — community fundraising, done transparently.
 * Tanzanian schools constantly raise money (lab, bus, classroom block) but
 * track pledges in exercise books. Lumora gives each campaign its own
 * control number, real-time thermometer, pledge tracking, and a public
 * page parents can check — accountability no competitor offers.
 */

const CAMPAIGNS = [
  {
    name: 'Science Laboratory Block', sw: 'Jengo la Maabara',
    target: 45_000_000, raised: 28_400_000, pledged: 6_500_000,
    donors: 63, deadline: '2026-12-01', controlNo: '000148000223',
    recent: [
      { name: 'Mzazi Mushi (Std 5A)', amount: 250_000, via: 'M-Pesa' },
      { name: 'Anonymous', amount: 1_000_000, via: 'NMB' },
      { name: 'Duka la Vitabu Msasani', amount: 500_000, via: 'CRDB' },
    ],
  },
  {
    name: 'School Bus Fund', sw: 'Mfuko wa Basi la Shule',
    target: 85_000_000, raised: 12_750_000, pledged: 18_000_000,
    donors: 41, deadline: '2027-06-30', controlNo: '000148000231',
    recent: [
      { name: 'Alumni Class of 2015', amount: 2_400_000, via: 'Bank' },
      { name: 'Mzazi Lyimo (Std 2A)', amount: 150_000, via: 'Tigo Pesa' },
    ],
  },
] as const;

export default function HarambeePage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Harambee"
          subtitle="Community fundraising with bank-grade accountability — every shilling lands on a campaign control number and posts to the ledger"
          action={<Button><Plus className="h-4 w-4" /> New campaign</Button>}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {CAMPAIGNS.map((c) => {
            const pct = Math.round((c.raised / c.target) * 100);
            const pledgePct = Math.round(((c.raised + c.pledged) / c.target) * 100);
            return (
              <Card key={c.name}>
                <CardHeader
                  title={<span className="flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-rose-500" /> {c.name}</span>}
                  subtitle={`${c.sw} · deadline ${c.deadline} · pay via control no. ${c.controlNo}`}
                  action={<Badge tone={pct >= 60 ? 'green' : pct >= 30 ? 'amber' : 'red'}>{pct}%</Badge>}
                />
                <div className="space-y-4 p-5">
                  <div>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-semibold">TZS {fmtTZSshort(c.raised)} raised</span>
                      <span className="text-muted-foreground">of TZS {fmtTZSshort(c.target)}</span>
                    </div>
                    <ProgressBar pct={pct} tone={pct >= 60 ? 'green' : 'amber'} />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      + TZS {fmtTZSshort(c.pledged)} pledged ({pledgePct}% with pledges) · {c.donors} donors
                    </p>
                  </div>
                  <div className="rounded-lg border">
                    <p className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent contributions</p>
                    {c.recent.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span>{r.name} <span className="text-xs text-muted-foreground">· {r.via}</span></span>
                        <span className="font-semibold text-emerald-600">{fmtTZS(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Parents see a live public page for this campaign — receipts are automatic, and the committee
                    sees the same numbers as the bursar. Hakuna mchezo.
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader title="Why this matters" subtitle="The trust problem, solved" />
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {[
              ['Dedicated control numbers', 'Contributions can never mix with school fees — separate ledger account per campaign.'],
              ['Live transparency', 'Every parent sees the same thermometer and donor list the committee sees. Anonymity respected on request.'],
              ['Automatic receipts', 'SMS receipt for every contribution; full statement exportable for the parents\' meeting.'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-semibold">{k}</p>
                <p className="mt-1 text-xs text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
