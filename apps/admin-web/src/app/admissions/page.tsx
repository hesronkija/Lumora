import { AppShell } from '@/components/layout/app-shell';

export default function AdmissionsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admissions</h1>
          <p className="text-muted-foreground">Manage student applications and enrollment</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard label="Total Applications" value="—" color="blue" />
          <StatusCard label="Pending Review" value="—" color="yellow" />
          <StatusCard label="Enrolled This Term" value="—" color="green" />
        </div>

        <ApplicationsTable />
      </div>
    </AppShell>
  );
}

function StatusCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    green: 'bg-green-50 border-green-200',
  };
  return (
    <div className={`rounded-lg border p-5 ${colorMap[color] ?? ''}`}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function ApplicationsTable() {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Recent Applications</h2>
        <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          New Application
        </button>
      </div>
      <div className="p-4 text-center text-sm text-muted-foreground">
        Applications will appear here once submitted
      </div>
    </div>
  );
}
