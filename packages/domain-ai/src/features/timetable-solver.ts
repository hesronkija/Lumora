/**
 * A9: Timetable Constraint Solver
 * Phase 5 — CP-SAT via OR-Tools Python service (services/inference-ocr hosts it).
 * Academic head accepts or tweaks the output — human-in-loop.
 *
 * TypeScript client sends constraints; Python service returns slot assignments;
 * results are written to timetable_slot via ReportingService.upsertTimetableSlot.
 *
 * Fallback: if solver service is down, returns a round-robin heuristic.
 */

export interface TimetableConstraint {
  classId: string;
  subjectId: string;
  teacherStaffId: string;
  periodsPerWeek: number;     // required periods
  preferMorning?: boolean;    // soft constraint
  avoidDays?: string[];       // days teacher is unavailable
}

export interface TimetableSlotAssignment {
  classId: string;
  subjectId: string;
  teacherStaffId: string;
  dayOfWeek: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  aiGenerated: true;
}

export interface SolverRequest {
  termId: string;
  constraints: TimetableConstraint[];
  periodsPerDay: number;       // e.g. 8
  schoolDays: string[];        // ['monday','tuesday','wednesday','thursday','friday']
  periodDurationMinutes: number; // e.g. 40
  firstPeriodStart: string;    // e.g. '07:30'
}

export interface SolverResult {
  status: 'optimal' | 'feasible' | 'infeasible' | 'error' | 'fallback';
  slots: TimetableSlotAssignment[];
  conflicts: string[];         // human-readable constraint violations (if infeasible)
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Heuristic fallback: round-robin distribution across days */
function heuristicSolve(req: SolverRequest): SolverResult {
  const slots: TimetableSlotAssignment[] = [];
  const [sh, sm] = req.firstPeriodStart.split(':').map(Number);
  const startMinutes = (sh ?? 7) * 60 + (sm ?? 30);

  for (const constraint of req.constraints) {
    let placed = 0;
    let dayIdx = 0;
    let period = 1;

    while (placed < constraint.periodsPerWeek) {
      const day = req.schoolDays[dayIdx % req.schoolDays.length];
      if (!day) break;

      if (!constraint.avoidDays?.includes(day)) {
        const slotStart = startMinutes + (period - 1) * req.periodDurationMinutes;
        const slotEnd = slotStart + req.periodDurationMinutes;

        slots.push({
          classId: constraint.classId,
          subjectId: constraint.subjectId,
          teacherStaffId: constraint.teacherStaffId,
          dayOfWeek: day,
          periodNumber: period,
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd),
          aiGenerated: true,
        });
        placed++;
      }

      dayIdx++;
      if (dayIdx % req.schoolDays.length === 0) period++;
      if (period > req.periodsPerDay) break;
    }
  }

  return { status: 'fallback', slots, conflicts: [] };
}

/** Calls the OR-Tools CP-SAT solver service */
export async function solveTimetable(req: SolverRequest): Promise<SolverResult> {
  const solverUrl = process.env['TIMETABLE_SOLVER_URL'] ?? 'http://inference-ocr:8081/timetable';

  try {
    const resp = await fetch(solverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(60_000), // solver may take up to 60s for large schools
    });

    if (!resp.ok) return heuristicSolve(req);

    const data = (await resp.json()) as SolverResult;
    return data;
  } catch {
    return heuristicSolve(req);
  }
}
