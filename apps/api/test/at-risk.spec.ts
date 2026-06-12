import { scoreStudent, rankAtRisk, type StudentSignals } from '@lumora/domain-ai';

const base: StudentSignals = {
  studentId: 's1',
  attendanceRate: 0.98,
  gradeTrend: 2,
  latestGradePercent: 78,
  hasArrears: false,
  consecutiveAbsences: 0,
};

describe('at-risk early-warning scoring', () => {
  it('a thriving student scores low', () => {
    const r = scoreStudent(base);
    expect(r.band).toBe('low');
    expect(r.signals).toHaveLength(0);
  });

  it('chronic absence + failing grades + arrears → critical', () => {
    const r = scoreStudent({
      studentId: 's2',
      attendanceRate: 0.2,
      gradeTrend: -30,
      latestGradePercent: 10,
      hasArrears: true,
      consecutiveAbsences: 8,
    });
    expect(r.band).toBe('critical');
    expect(r.signals.length).toBeGreaterThanOrEqual(4);
  });

  it('explains every flag in human-readable language (for the headteacher)', () => {
    const r = scoreStudent({ ...base, attendanceRate: 0.6, consecutiveAbsences: 4 });
    expect(r.signals.join(' ')).toMatch(/Attendance at 60%/);
    expect(r.signals.join(' ')).toMatch(/4 consecutive absence days/);
  });

  it('ranks the most at-risk students first and filters out thriving ones', () => {
    const ranked = rankAtRisk([
      base, // low band — must be filtered out of the headteacher list
      { ...base, studentId: 'worst', attendanceRate: 0.2, latestGradePercent: 15, hasArrears: true },
      { ...base, studentId: 'mid', attendanceRate: 0.5, latestGradePercent: 35, hasArrears: true },
    ]);
    expect(ranked.map((r) => r.studentId)).not.toContain('s1');
    expect(ranked[0]!.studentId).toBe('worst');
    expect(ranked[0]!.score).toBeGreaterThan(ranked[ranked.length - 1]!.score);
  });

  it('score is always within [0, 1]', () => {
    const extreme = scoreStudent({
      studentId: 'x', attendanceRate: 0, gradeTrend: -100,
      latestGradePercent: 0, hasArrears: true, consecutiveAbsences: 100,
    });
    expect(extreme.score).toBeGreaterThan(0.9);
    expect(extreme.score).toBeLessThanOrEqual(1);
  });
});
