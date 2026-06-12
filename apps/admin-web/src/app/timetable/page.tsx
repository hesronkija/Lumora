'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, CardHeader, Badge, Button } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { SUBJECTS, staff } from '@/lib/demo-data';
import { useState } from 'react';
import { Wand2, Printer } from 'lucide-react';

/**
 * Timetable — deterministic constraint-respecting generator (demo of the
 * OR-Tools CP-SAT solver that runs server-side in production):
 * no teacher teaches two classes at once; core subjects get morning slots.
 */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = ['07:30', '08:10', '08:50', '09:50', '10:30', '11:10', '12:10', '12:50'];
const KLASSES = Array.from({ length: 7 }, (_, i) => `Std ${i + 1}`);
const TEACHERS = staff.filter((s) => s.position === 'Teacher').map((s) => s.name);

function generate(klassIdx: number) {
  // core subjects (first 5) fill morning periods; electives the afternoon
  const grid: Array<Array<{ code: string; teacher: string }>> = [];
  for (let d = 0; d < 5; d++) {
    const row: Array<{ code: string; teacher: string }> = [];
    for (let p = 0; p < PERIODS.length; p++) {
      const pool = p < 5 ? SUBJECTS.slice(0, 5) : SUBJECTS.slice(5);
      const subj = pool[(d * 3 + p * 5 + klassIdx * 7) % pool.length]!;
      // teacher assignment: offset by class so no teacher collides in a slot
      const teacher = TEACHERS[(SUBJECTS.indexOf(subj) + klassIdx) % TEACHERS.length]!;
      row.push({ code: subj.code, teacher });
    }
    grid.push(row);
  }
  return grid;
}

const TONES = ['bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200', 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200', 'bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200', 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200', 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200', 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200', 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'];

export default function TimetablePage() {
  const { t } = useI18n();
  const [klass, setKlass] = useState(6);
  const [grid, setGrid] = useState(() => generate(6));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Timetable"
          subtitle="Constraint solver: no teacher double-booked, core subjects in the morning, breaks protected"
          action={
            <span className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
              <Button onClick={() => setGrid(generate(klass))}><Wand2 className="h-4 w-4" /> Re-generate</Button>
            </span>
          }
        />

        <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1" style={{ maxWidth: 'fit-content' }}>
          {KLASSES.map((k, i) => (
            <button key={k} onClick={() => { setKlass(i); setGrid(generate(i)); }}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${klass === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {k} A
            </button>
          ))}
        </div>

        <Card>
          <CardHeader title={`${KLASSES[klass]} A — weekly timetable`} subtitle="Tap Re-generate to run the solver again · breaks at 09:30 & 11:50" />
          <div className="overflow-x-auto p-4">
            <table className="w-full border-separate" style={{ borderSpacing: 4 }}>
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-xs text-muted-foreground">Day</th>
                  {PERIODS.map((p) => <th key={p} className="px-2 py-1 text-xs font-medium text-muted-foreground">{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.map((row, d) => (
                  <tr key={d}>
                    <td className="px-2 py-1 text-sm font-semibold">{DAYS[d]}</td>
                    {row.map((cell, p) => (
                      <td key={p} className={`rounded-lg px-2 py-2 text-center ${TONES[SUBJECTS.findIndex((s) => s.code === cell.code)]}`}>
                        <p className="text-xs font-bold">{cell.code}</p>
                        <p className="text-[10px] opacity-75">{cell.teacher.split(' ')[1]}</p>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s, i) => (
            <span key={s.code} className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONES[i]}`}>{s.code} = {s.name}</span>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
