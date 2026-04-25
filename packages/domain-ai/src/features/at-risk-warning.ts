/**
 * A2: At-Risk Student Early Warning
 * Phase 3 — classical ML (no LLM; no PII leaves region).
 *
 * Computes a risk score (0–1) per student based on:
 *   - Attendance rate (last 4 weeks)
 *   - Grade trend (last 2 terms)
 *   - Fee arrears presence
 *
 * Deliberately uses gradient-boosting-style heuristics in TypeScript
 * (not an external ML framework) for Phase 3. Year-2 plan: train an
 * XGBoost/LightGBM model on historical data for better calibration.
 *
 * Human-in-loop: headteacher reviews the list and decides follow-up action.
 */

export interface StudentSignals {
  studentId: string;
  attendanceRate: number;   // 0–1, last 4 weeks
  gradeTrend: number;       // positive = improving, negative = declining (percentage points)
  latestGradePercent: number; // 0–100
  hasArrears: boolean;
  consecutiveAbsences: number; // days
}

export interface RiskScore {
  studentId: string;
  score: number;            // 0–1, higher = more at risk
  band: 'low' | 'medium' | 'high' | 'critical';
  signals: string[];        // human-readable reasons
}

const WEIGHTS = {
  attendance: 0.40,
  gradeTrend: 0.25,
  gradeLevel: 0.20,
  arrears: 0.10,
  consecutiveAbsences: 0.05,
};

export function scoreStudent(signals: StudentSignals): RiskScore {
  const reasons: string[] = [];

  // Attendance component (1 = absent always, 0 = perfect)
  const attendanceRisk = 1 - signals.attendanceRate;
  if (signals.attendanceRate < 0.75) {
    reasons.push(`Attendance at ${(signals.attendanceRate * 100).toFixed(0)}% (below 75% threshold)`);
  }

  // Grade trend component (−30 pp drop → 1.0 risk; +10 pp improvement → 0.0)
  const trendRisk = Math.max(0, Math.min(1, -signals.gradeTrend / 30));
  if (signals.gradeTrend < -10) {
    reasons.push(`Grades dropped ${Math.abs(signals.gradeTrend).toFixed(0)} pp since last term`);
  }

  // Grade level component (below 40% = at-risk)
  const gradeLevelRisk = Math.max(0, Math.min(1, (50 - signals.latestGradePercent) / 50));
  if (signals.latestGradePercent < 40) {
    reasons.push(`Current grade average ${signals.latestGradePercent.toFixed(0)}% (below 40%)`);
  }

  // Arrears
  const arrearsRisk = signals.hasArrears ? 1 : 0;
  if (signals.hasArrears) reasons.push('Outstanding fee arrears');

  // Consecutive absences
  const absenceRisk = Math.min(1, signals.consecutiveAbsences / 10);
  if (signals.consecutiveAbsences >= 3) {
    reasons.push(`${signals.consecutiveAbsences} consecutive absence days`);
  }

  const score =
    attendanceRisk * WEIGHTS.attendance +
    trendRisk * WEIGHTS.gradeTrend +
    gradeLevelRisk * WEIGHTS.gradeLevel +
    arrearsRisk * WEIGHTS.arrears +
    absenceRisk * WEIGHTS.consecutiveAbsences;

  const band: RiskScore['band'] =
    score >= 0.75 ? 'critical' :
    score >= 0.50 ? 'high' :
    score >= 0.25 ? 'medium' : 'low';

  return { studentId: signals.studentId, score: parseFloat(score.toFixed(3)), band, signals: reasons };
}

export function rankAtRisk(students: StudentSignals[]): RiskScore[] {
  return students
    .map(scoreStudent)
    .filter(r => r.band !== 'low')
    .sort((a, b) => b.score - a.score);
}
