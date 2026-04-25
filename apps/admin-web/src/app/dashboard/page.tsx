import { AppShell } from '@/components/layout/app-shell';

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Lumora School System</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Students" value="—" />
          <StatCard label="Active Staff" value="—" />
          <StatCard label="Fees Collected (TZS)" value="—" />
          <StatCard label="Outstanding Arrears" value="—" />
        </div>

        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Phase 0 — Foundations complete. Module data will appear here as phases ship.
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
