import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

export interface ScoreEntry {
  studentId: string;
  subjectId: string;
  marksObtained: number;
  teacherComment?: string;
}

@Injectable()
export class ExamsService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async createExam(data: {
    termId: string;
    classId: string;
    name: string;
    examType: 'cat' | 'mid_term' | 'end_of_term' | 'mock' | 'assessment';
    examDate?: string;
    totalMarks?: number;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO exam (id, tenant_id, term_id, class_id, name, exam_type, exam_date, total_marks)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [uuidv4(), data.termId, data.classId, data.name, data.examType, data.examDate ?? null, data.totalMarks ?? 100],
    );
    return rows[0];
  }

  async enterScores(examId: string, enteredBy: string, scores: ScoreEntry[]) {
    const { tenantId } = TenantStorage.get();

    const exam = await this.pool.query(`SELECT * FROM exam WHERE id = $1`, [examId]);
    if (!exam.rows[0]) throw new NotFoundException('Exam not found');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      for (const score of scores) {
        await client.query(
          `INSERT INTO exam_score
            (id, tenant_id, exam_id, student_id, subject_id, marks_obtained, total_marks, entered_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (exam_id, student_id, subject_id) DO UPDATE
             SET marks_obtained = EXCLUDED.marks_obtained,
                 teacher_comment = EXCLUDED.teacher_comment,
                 entered_by = EXCLUDED.entered_by,
                 updated_at = NOW()`,
          [
            uuidv4(), tenantId, examId, score.studentId, score.subjectId,
            score.marksObtained, exam.rows[0].total_marks, enteredBy,
          ],
        );
      }

      await client.query('COMMIT');
      await this.audit.log({ action: 'exam.scores_entered', resource: 'exam', resourceId: examId, after: { count: scores.length } });
      return { recorded: scores.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async generateReportCards(termId: string, classId: string) {
    const { tenantId } = TenantStorage.get();

    // Get all students in class
    const { rows: students } = await this.pool.query(
      `SELECT s.id, s.legal_name, s.admission_no
       FROM enrollment e JOIN student s ON s.id = e.student_id
       WHERE e.class_id = $1 AND e.term_id = $2 AND e.status = 'active'`,
      [classId, termId],
    );

    // Get exams for this class/term
    const { rows: exams } = await this.pool.query(
      `SELECT id, name, exam_type, total_marks FROM exam WHERE class_id = $1 AND term_id = $2`,
      [classId, termId],
    );

    const examIds = exams.map((e: { id: string }) => e.id);
    if (examIds.length === 0) return { generated: 0, message: 'No exams found for this class/term' };

    // Get all scores
    const { rows: scores } = await this.pool.query(
      `SELECT es.*, s.name AS subject_name
       FROM exam_score es
       JOIN subject s ON s.id = es.subject_id
       WHERE es.exam_id = ANY($1)`,
      [examIds],
    );

    // Calculate averages per student
    const studentScores: Record<string, Decimal[]> = {};
    for (const score of scores) {
      const pct = new Decimal(score.marks_obtained).div(new Decimal(score.total_marks)).mul(100);
      if (!studentScores[score.student_id]) studentScores[score.student_id] = [];
      studentScores[score.student_id]?.push(pct);
    }

    // Rank students
    const ranked = students.map((s: { id: string; legal_name: string; admission_no: string }) => {
      const pcts = studentScores[s.id] ?? [];
      const avg = pcts.length > 0
        ? pcts.reduce((a, b) => a.plus(b), new Decimal(0)).div(pcts.length)
        : new Decimal(0);
      return { ...s, average: avg };
    }).sort((a: { average: Decimal }, b: { average: Decimal }) => b.average.minus(a.average).toNumber());

    // Upsert report cards
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      for (let i = 0; i < ranked.length; i++) {
        const student = ranked[i];
        await client.query(
          `INSERT INTO report_card
            (id, tenant_id, student_id, term_id, class_id, average_marks, position_in_class, total_students_in_class, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
           ON CONFLICT (student_id, term_id) DO UPDATE
             SET average_marks = EXCLUDED.average_marks,
                 position_in_class = EXCLUDED.position_in_class,
                 total_students_in_class = EXCLUDED.total_students_in_class,
                 updated_at = NOW()`,
          [uuidv4(), tenantId, student.id, termId, classId, student.average.toFixed(2), i + 1, ranked.length],
        );
      }

      await client.query('COMMIT');
      await this.audit.log({ action: 'report_card.generate', resource: 'report_card', after: { classId, termId, count: ranked.length } });
      return { generated: ranked.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getReportCard(studentId: string, termId: string) {
    const { rows } = await this.pool.query(
      `SELECT rc.*,
         s.legal_name, s.admission_no, s.dob, s.gender,
         c.level, c.stream,
         t.term_number, ay.label AS academic_year,
         json_agg(json_build_object(
           'subject', sub.name,
           'marks_obtained', es.marks_obtained,
           'total_marks', es.total_marks,
           'teacher_comment', es.teacher_comment
         )) FILTER (WHERE es.id IS NOT NULL) AS scores
       FROM report_card rc
       JOIN student s ON s.id = rc.student_id
       JOIN class c ON c.id = rc.class_id
       JOIN term t ON t.id = rc.term_id
       JOIN academic_year ay ON ay.id = t.academic_year_id
       LEFT JOIN exam_score es ON es.student_id = rc.student_id
       LEFT JOIN subject sub ON sub.id = es.subject_id
       WHERE rc.student_id = $1 AND rc.term_id = $2
       GROUP BY rc.id, s.id, c.id, t.id, ay.id`,
      [studentId, termId],
    );
    if (!rows[0]) throw new NotFoundException('Report card not found');
    return rows[0];
  }

  async publishReportCards(termId: string, classId: string) {
    await this.pool.query(
      `UPDATE report_card SET status = 'published', published_at = NOW(), updated_at = NOW()
       WHERE term_id = $1 AND class_id = $2 AND status = 'draft'`,
      [termId, classId],
    );
    await this.audit.log({ action: 'report_card.publish', resource: 'report_card', after: { classId, termId } });
  }
}
