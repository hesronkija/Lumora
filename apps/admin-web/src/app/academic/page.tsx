import { AppShell } from '@/components/layout/app-shell';

export default function AcademicPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic</h1>
          <p className="text-muted-foreground">Classes, subjects, timetable and enrollment</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            title="Classes"
            description="Manage class levels, streams, and class teachers"
            action="Manage Classes"
          />
          <SectionCard
            title="Subjects"
            description="Subject catalog and curriculum mapping"
            action="Manage Subjects"
          />
          <SectionCard
            title="Timetable"
            description="Weekly timetable per class"
            action="View Timetable"
          />
          <SectionCard
            title="Academic Year & Terms"
            description="Configure academic calendar"
            action="Configure"
          />
        </div>
      </div>
    </AppShell>
  );
}

function SectionCard({ title, description, action }: { title: string; description: string; action: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <button className="text-sm text-primary hover:underline">{action} →</button>
    </div>
  );
}
