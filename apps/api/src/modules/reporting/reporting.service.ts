import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { rankAtRisk, type StudentSignals } from '@lumora/domain-ai';

/**
 * Reporting & Compliance module.
 * Covers: NECTA PSLE candidate export, TAMISEMI BEMIS enrollment feed,
 * inspector export bundle, at-risk student dashboard.
 *
 * All exports are in the format prescribed by the respective authority.
 * Full API integration with NECTA is deferred (manual-assisted flow at launch).
 */
@Injectable()
export class ReportingService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  // ── NECTA PSLE Candidate Export ────────────────────────────────────────────
  // Generates the CSV expected by NECTA for Std VII candidate registration.

  async nectaCandidateExport(termId: string, classIds?: string[]) {
    const classFilter = classIds?.length
      ? `AND e.class_id = ANY($2::uuid[])`
      : '';
    const params: unknown[] = [termId];
    if (classIds?.length) params.push(classIds);

    const { rows } = await this.pool.query(
      `SELECT
         s.admission_no,
         s.legal_name,
         s.dob,
         s.gender,
         s.nida,
         t.name AS tenant_name,
         c.level AS class_level,
         c.stream
       FROM enrollment e
       JOIN student s ON s.id = e.student_id
       JOIN class c ON c.id = e.class_id
       JOIN tenant t ON t.id = s.tenant_id
       WHERE e.term_id = $1
         AND c.level = 'std7'
         AND e.status = 'active'
         ${classFilter}
       ORDER BY s.legal_name`,
      params,
    );

    // Format as NECTA CSV template
    const header = 'ADMISSION_NO,FULL_NAME,DATE_OF_BIRTH,GENDER,NIDA,SCHOOL,CLASS,STREAM';
    const lines = rows.map(r =>
      [
        r.admission_no,
        `"${(r.legal_name as string).replace(/"/g, '""')}"`,
        r.dob,
        r.gender,
        r.nida ?? '',
        `"${(r.tenant_name as string).replace(/"/g, '""')}"`,
        r.class_level,
        r.stream ?? '',
      ].join(','),
    );

    return {
      format: 'csv',
      filename: `necta_psle_candidates_${new Date().toISOString().split('T')[0]}.csv`,
      candidateCount: rows.length,
      content: [header, ...lines].join('\n'),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── TAMISEMI BEMIS Export ──────────────────────────────────────────────────
  // Basic Education Management Information System enrollment + staff data feed.

  async bemisEnrollmentExport(academicYearId: string) {
    const [enrollmentRows, staffRows] = await Promise.all([
      this.pool.query(
        `SELECT
           c.level, c.stream, c.gender_type,
           COUNT(e.id) FILTER (WHERE s.gender = 'male')   AS male_count,
           COUNT(e.id) FILTER (WHERE s.gender = 'female') AS female_count,
           COUNT(e.id) AS total
         FROM enrollment e
         JOIN class c ON c.id = e.class_id
         JOIN student s ON s.id = e.student_id
         WHERE c.academic_year_id = $1 AND e.status = 'active'
         GROUP BY c.level, c.stream, c.gender_type
         ORDER BY c.level, c.stream`,
        [academicYearId],
      ),
      this.pool.query(
        `SELECT
           role_ref,
           COUNT(*) FILTER (WHERE gender = 'male')   AS male,
           COUNT(*) FILTER (WHERE gender = 'female') AS female,
           COUNT(*) AS total
         FROM staff
         WHERE contract_type != 'tsc_seconded'
         GROUP BY role_ref
         ORDER BY role_ref`,
      ),
    ]);

    return {
      format: 'json',
      academicYearId,
      generatedAt: new Date().toISOString(),
      enrollment: {
        byClass: enrollmentRows.rows,
        totalStudents: enrollmentRows.rows.reduce((s, r) => s + parseInt(r.total as string), 0),
      },
      staffEstablishment: {
        byRole: staffRows.rows,
        totalStaff: staffRows.rows.reduce((s, r) => s + parseInt(r.total as string), 0),
      },
    };
  }

  // ── Inspector Mode Export ──────────────────────────────────────────────────
  // One-click bundle of all statutory reports for an inspector.

  async inspectorExport(fromDate: string, toDate: string) {
    const [studentCount, staffCount, attendanceSummary, feeCollection, journalCount] = await Promise.all([
      this.pool.query(`SELECT COUNT(*) FROM student WHERE active = true`),
      this.pool.query(`SELECT COUNT(*) FROM staff WHERE active = true`),
      this.pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'present') AS present,
           COUNT(*) FILTER (WHERE status = 'absent') AS absent,
           COUNT(*) FILTER (WHERE status = 'late') AS late
         FROM attendance_record ar
         JOIN attendance_session ats ON ats.id = ar.session_id
         WHERE ats.session_date BETWEEN $1 AND $2`,
        [fromDate, toDate],
      ),
      this.pool.query(
        `SELECT
           COALESCE(SUM(amount), 0) AS collected,
           COUNT(*) AS payment_count
         FROM payment
         WHERE status = 'completed'
           AND paid_at::date BETWEEN $1 AND $2`,
        [fromDate, toDate],
      ),
      this.pool.query(
        `SELECT COUNT(*) FROM journal_entry WHERE entry_date BETWEEN $1 AND $2 AND status = 'posted'`,
        [fromDate, toDate],
      ),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      period: { from: fromDate, to: toDate },
      students: { total: studentCount.rows[0].count },
      staff: { total: staffCount.rows[0].count },
      attendance: attendanceSummary.rows[0],
      feeCollection: feeCollection.rows[0],
      accounting: { journalEntries: journalCount.rows[0].count },
      note: 'Full journal detail available via /accounting/reports/audit-export',
    };
  }

  // ── At-Risk Student Report ─────────────────────────────────────────────────
  // Uses A2 scorer. Returns the dashboard data for headteacher review.

  async atRiskReport(termId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         s.id AS student_id,
         s.legal_name,
         s.admission_no,
         c.level, c.stream,
         -- Attendance rate: last 4 weeks
         COALESCE(
           COUNT(ar.id) FILTER (WHERE ar.status = 'present' AND ats.session_date >= NOW() - INTERVAL '28 days')::float /
           NULLIF(COUNT(ar.id) FILTER (WHERE ats.session_date >= NOW() - INTERVAL '28 days'), 0),
           1
         ) AS attendance_rate,
         -- Consecutive absences
         0 AS consecutive_absences,
         -- Latest grade average
         COALESCE(
           AVG(es.percentage) FILTER (WHERE ex.term_id = $1),
           50
         ) AS latest_grade_percent,
         -- Grade trend (compare to prior term — simplified: 0 if only one term)
         0 AS grade_trend,
         -- Arrears
         EXISTS (
           SELECT 1 FROM invoice inv
           WHERE inv.student_id = s.id
             AND inv.status IN ('partial', 'overdue', 'issued')
             AND inv.total_due > inv.total_paid
         ) AS has_arrears
       FROM enrollment e
       JOIN student s ON s.id = e.student_id
       JOIN class c ON c.id = e.class_id
       LEFT JOIN attendance_record ar ON ar.student_id = s.id
       LEFT JOIN attendance_session ats ON ats.id = ar.session_id
       LEFT JOIN exam_score es ON es.student_id = s.id
       LEFT JOIN exam ex ON ex.id = es.exam_id
       WHERE e.term_id = $1 AND e.status = 'active'
       GROUP BY s.id, s.legal_name, s.admission_no, c.level, c.stream`,
      [termId],
    );

    const signals: StudentSignals[] = rows.map(r => ({
      studentId: r.student_id as string,
      attendanceRate: parseFloat(r.attendance_rate as string) || 1,
      gradeTrend: parseFloat(r.grade_trend as string) || 0,
      latestGradePercent: parseFloat(r.latest_grade_percent as string) || 50,
      hasArrears: r.has_arrears as boolean,
      consecutiveAbsences: parseInt(r.consecutive_absences as string) || 0,
    }));

    const ranked = rankAtRisk(signals);

    // Attach student metadata back
    const studentMap = Object.fromEntries(rows.map(r => [r.student_id as string, r]));
    return ranked.map(score => ({
      ...score,
      student: studentMap[score.studentId],
    }));
  }

  // ── Timetable Slot Management (A9 output) ─────────────────────────────────

  async getTimetable(classId: string, termId: string) {
    const { rows } = await this.pool.query(
      `SELECT ts.*, sub.name AS subject_name, sub.code AS subject_code,
         s.legal_name AS teacher_name
       FROM timetable_slot ts
       JOIN subject sub ON sub.id = ts.subject_id
       LEFT JOIN staff s ON s.id = ts.teacher_staff_id
       WHERE ts.class_id = $1 AND ts.term_id = $2
       ORDER BY
         CASE ts.day_of_week
           WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
           WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
         END,
         ts.period_number`,
      [classId, termId],
    );
    return rows;
  }

  async upsertTimetableSlot(slot: {
    classId: string;
    subjectId: string;
    teacherStaffId?: string;
    termId: string;
    dayOfWeek: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    room?: string;
    aiGenerated?: boolean;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO timetable_slot
        (id, tenant_id, term_id, class_id, subject_id, teacher_staff_id,
         day_of_week, period_number, start_time, end_time, room, ai_generated)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid,
               $2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (class_id, day_of_week, period_number, term_id)
       DO UPDATE SET
         subject_id = $4, teacher_staff_id = $5,
         start_time = $8, end_time = $9, room = $10,
         ai_generated = $11, updated_at = NOW()
       RETURNING *`,
      [
        (await import('uuid')).v4(),
        slot.termId, slot.classId, slot.subjectId, slot.teacherStaffId ?? null,
        slot.dayOfWeek, slot.periodNumber, slot.startTime, slot.endTime,
        slot.room ?? null, slot.aiGenerated ?? false,
      ],
    );
    return rows[0];
  }
}
