import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AcademicService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  // ── Academic Years ──────────────────────────────────────────────────────────

  async createAcademicYear(data: { label: string; startDate: string; endDate: string }) {
    const { rows } = await this.pool.query(
      `INSERT INTO academic_year (id, tenant_id, label, start_date, end_date)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4)
       RETURNING *`,
      [uuidv4(), data.label, data.startDate, data.endDate],
    );
    return rows[0];
  }

  async setCurrentAcademicYear(yearId: string) {
    await this.pool.query(
      `UPDATE academic_year
       SET is_current = (id = $1), updated_at = NOW()
       WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
      [yearId],
    );
  }

  async createTerm(data: {
    academicYearId: string;
    termNumber: number;
    startDate: string;
    endDate: string;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO term (id, tenant_id, academic_year_id, term_number, start_date, end_date)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5)
       RETURNING *`,
      [uuidv4(), data.academicYearId, data.termNumber, data.startDate, data.endDate],
    );
    return rows[0];
  }

  // ── Subjects ────────────────────────────────────────────────────────────────

  async listSubjects() {
    const { rows } = await this.pool.query(`SELECT * FROM subject ORDER BY name`);
    return rows;
  }

  async createSubject(data: { code: string; name: string; levelRange?: string; isCore?: boolean }) {
    const { rows } = await this.pool.query(
      `INSERT INTO subject (id, tenant_id, code, name, level_range, is_core)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5)
       ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [uuidv4(), data.code, data.name, data.levelRange ?? null, data.isCore ?? true],
    );
    return rows[0];
  }

  // ── Classes ─────────────────────────────────────────────────────────────────

  async listClasses(academicYearId?: string) {
    const { rows } = await this.pool.query(
      `SELECT c.*, u.email AS class_teacher_email
       FROM class c
       LEFT JOIN "user" u ON u.id = c.class_teacher_id
       ${academicYearId ? 'WHERE c.academic_year_id = $1' : ''}
       ORDER BY c.level, c.stream`,
      academicYearId ? [academicYearId] : [],
    );
    return rows;
  }

  async createClass(data: {
    academicYearId: string;
    level: string;
    stream?: string;
    classTeacherId?: string;
    capacity?: number;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO class (id, tenant_id, academic_year_id, level, stream, class_teacher_id, capacity)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6)
       RETURNING *`,
      [uuidv4(), data.academicYearId, data.level, data.stream ?? null, data.classTeacherId ?? null, data.capacity ?? 45],
    );
    await this.audit.log({ action: 'class.create', resource: 'class', resourceId: rows[0].id });
    return rows[0];
  }

  // ── Timetable ───────────────────────────────────────────────────────────────

  async getTimetable(classId: string) {
    const { rows } = await this.pool.query(
      `SELECT te.*, s.name AS subject_name, s.code AS subject_code,
         u.email AS teacher_email
       FROM timetable_entry te
       JOIN subject s ON s.id = te.subject_id
       JOIN "user" u ON u.id = te.teacher_id
       WHERE te.class_id = $1
       ORDER BY te.day_of_week, te.start_time`,
      [classId],
    );
    return rows;
  }

  async addTimetableEntry(data: {
    classId: string;
    subjectId: string;
    teacherId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO timetable_entry
        (id, tenant_id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [uuidv4(), data.classId, data.subjectId, data.teacherId, data.dayOfWeek, data.startTime, data.endTime],
    );
    return rows[0];
  }

  // ── Enrollment ──────────────────────────────────────────────────────────────

  async getClassRoster(classId: string, termId: string) {
    const { rows } = await this.pool.query(
      `SELECT s.id, s.admission_no, s.legal_name, s.gender, s.dob,
         e.id AS enrollment_id, e.status AS enrollment_status
       FROM enrollment e
       JOIN student s ON s.id = e.student_id
       WHERE e.class_id = $1 AND e.term_id = $2 AND e.status = 'active'
       ORDER BY s.legal_name`,
      [classId, termId],
    );
    return rows;
  }

  async getCurrentAcademicYear() {
    const { rows } = await this.pool.query(
      `SELECT * FROM academic_year
       WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
         AND is_current = true
       LIMIT 1`,
    );
    if (!rows[0]) throw new NotFoundException('No current academic year set');
    return rows[0];
  }

  async getCurrentTerm() {
    const { rows } = await this.pool.query(
      `SELECT t.*, ay.label AS academic_year
       FROM term t
       JOIN academic_year ay ON ay.id = t.academic_year_id
       WHERE t.tenant_id = current_setting('app.current_tenant_id', true)::uuid
         AND t.is_current = true
       LIMIT 1`,
    );
    if (!rows[0]) throw new NotFoundException('No current term set');
    return rows[0];
  }
}
