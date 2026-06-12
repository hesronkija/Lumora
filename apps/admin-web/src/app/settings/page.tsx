'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, CardHeader, Badge } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { usePreferences, ACCENTS } from '@/lib/preferences';

const INTEGRATIONS = [
  { name: 'Selcom (M-Pesa · Tigo Pesa · Airtel Money)', status: 'Stub — add SELCOM_API_KEY', live: false },
  { name: 'NMB Bank biller', status: 'Stub — add BANK_API_KEY', live: false },
  { name: 'CRDB SimBanking biller', status: 'Stub — add BANK_API_KEY', live: false },
  { name: 'GePG (public schools)', status: 'Awaiting MoF onboarding', live: false },
  { name: 'TRA VFMS fiscal receipts', status: 'Activates when VRN is set', live: false },
  { name: 'Beem SMS', status: 'Stub — add BEEM_API_KEY', live: false },
  { name: 'WhatsApp Business Cloud API', status: 'Planned', live: false },
  { name: 'AI gateway (vLLM, af-south-1)', status: 'Local engine active — set AI_GATEWAY_URL for LLM', live: true },
];

export default function SettingsPage() {
  const { t } = useI18n();
  const { theme, setTheme, accent, setAccent } = usePreferences();
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('settings')} subtitle="Tenant configuration · integrations · compliance posture" />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader title="Appearance" subtitle="Per-device preferences — theme, school accent colour, language (topbar)" />
            <div className="flex flex-wrap items-center gap-6 p-5">
              <div className="flex gap-2">
                {(['light', 'dark'] as const).map((th) => (
                  <button
                    key={th}
                    onClick={() => setTheme(th)}
                    className={`rounded-lg border px-4 py-2 text-sm capitalize transition-colors ${theme === th ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                  >
                    {th}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {ACCENTS.map((a, i) => (
                  <button
                    key={a.name}
                    title={a.name}
                    onClick={() => setAccent(i)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${accent === i ? 'border-foreground' : 'border-transparent'}`}
                    style={{ background: `hsl(${a.h} ${a.s}% ${a.l}%)` }}
                  />
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="School profile" />
            <div className="space-y-3 p-5 text-sm">
              {[
                ['Name', 'Green Valley Primary School'],
                ['Type', 'Private primary'],
                ['Registration', 'PS/DAR/2024/001'],
                ['Subdomain', 'greenvalley.lumora.app'],
                ['Region', 'Dar es Salaam · Kinondoni · Msasani'],
                ['Currency / TZ', 'TZS · Africa/Dar_es_Salaam'],
                ['Languages', 'English + Kiswahili'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Integrations" subtitle="All adapters run in safe stub mode until credentials are configured" />
            <div className="divide-y">
              {INTEGRATIONS.map((i) => (
                <div key={i.name} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.status}</p>
                  </div>
                  <Badge tone={i.live ? 'green' : 'gray'}>{i.live ? 'active' : 'stub'}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Security & compliance" />
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Tenant isolation', 'Postgres RLS — FORCE on every table'],
                ['Webhooks', 'HMAC-SHA256 verified, replay-protected'],
                ['Audit trail', 'Append-only — updates denied at the DB'],
                ['PDPA 2022', 'Consent ledger · DSR export · TZ residency'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-semibold">{k}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
