import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BoardingService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  // ── Dorms ──────────────────────────────────────────────────────────────────

  async createDorm(dto: {
    campusId?: string;
    name: string;
    gender: 'male' | 'female' | 'mixed';
    capacity: number;
    matronPatronName?: string;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO dorm (id, tenant_id, campus_id, name, gender, capacity, matron_patron_name)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6)
       RETURNING *`,
      [uuidv4(), dto.campusId ?? null, dto.name, dto.gender, dto.capacity, dto.matronPatronName ?? null],
    );
    await this.audit.log({ action: 'dorm.create', resource: 'dorm', resourceId: rows[0].id });
    return rows[0];
  }

  async listDorms() {
    const { rows } = await this.pool.query(
      `SELECT d.*,
         COUNT(b.id) FILTER (WHERE b.active) AS total_beds,
         COUNT(da.id) FILTER (WHERE da.status = 'active') AS occupied_beds
       FROM dorm d
       LEFT JOIN bed b ON b.dorm_id = d.id
       LEFT JOIN dorm_assignment da ON da.bed_id = b.id
       WHERE d.active = true
       GROUP BY d.id
       ORDER BY d.name`,
    );
    return rows;
  }

  async createBed(dormId: string, bedNo: string) {
    const { rows } = await this.pool.query(
      `INSERT INTO bed (id, tenant_id, dorm_id, bed_no)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3)
       ON CONFLICT (dorm_id, bed_no) DO NOTHING
       RETURNING *`,
      [uuidv4(), dormId, bedNo],
    );
    return rows[0] ?? { dormId, bedNo, status: 'already_exists' };
  }

  async listBeds(dormId: string) {
    const { rows } = await this.pool.query(
      `SELECT b.*,
         da.id AS assignment_id, da.status AS assignment_status,
         s.legal_name AS student_name, s.admission_no
       FROM bed b
       LEFT JOIN dorm_assignment da ON da.bed_id = b.id AND da.status = 'active'
       LEFT JOIN student s ON s.id = da.student_id
       WHERE b.dorm_id = $1 AND b.active = true
       ORDER BY b.bed_no`,
      [dormId],
    );
    return rows;
  }

  // ── Dorm Assignments ───────────────────────────────────────────────────────

  async assignBed(dto: { studentId: string; bedId: string; termId: string; assignedFrom: string }) {
    const { tenantId } = TenantStorage.get();

    // Check student not already assigned in this term
    const existing = await this.pool.query(
      `SELECT id FROM dorm_assignment WHERE student_id = $1 AND term_id = $2 AND status = 'active'`,
      [dto.studentId, dto.termId],
    );
    if (existing.rowCount && existing.rowCount > 0) throw new ConflictException('Student already has an active bed assignment this term');

    const { rows } = await this.pool.query(
      `INSERT INTO dorm_assignment (id, tenant_id, student_id, bed_id, term_id, assigned_from)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [uuidv4(), tenantId, dto.studentId, dto.bedId, dto.termId, dto.assignedFrom],
    );
    await this.audit.log({ action: 'dorm_assignment.create', resource: 'dorm_assignment', resourceId: rows[0].id });
    return rows[0];
  }

  async endAssignment(assignmentId: string, assignedTo: string) {
    const { rows } = await this.pool.query(
      `UPDATE dorm_assignment SET status = 'ended', assigned_to = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [assignedTo, assignmentId],
    );
    if (!rows[0]) throw new NotFoundException('Assignment not found');
    return rows[0];
  }

  async getStudentBoardingStatus(studentId: string) {
    const { rows } = await this.pool.query(
      `SELECT da.*, b.bed_no, d.name AS dorm_name, d.gender AS dorm_gender,
         t.term_number, ay.label AS academic_year
       FROM dorm_assignment da
       JOIN bed b ON b.id = da.bed_id
       JOIN dorm d ON d.id = b.dorm_id
       JOIN term t ON t.id = da.term_id
       JOIN academic_year ay ON ay.id = t.academic_year_id
       WHERE da.student_id = $1
       ORDER BY da.created_at DESC LIMIT 5`,
      [studentId],
    );
    return rows;
  }

  // ── Leave-Out ──────────────────────────────────────────────────────────────

  async requestLeaveOut(dto: {
    studentId: string;
    leaveDate: string;
    returnDate: string;
    reason: string;
    guardianName: string;
    guardianPhone: string;
  }) {
    const { tenantId } = TenantStorage.get();
    const { rows } = await this.pool.query(
      `INSERT INTO leave_out (id, tenant_id, student_id, leave_date, return_date, reason, guardian_name, guardian_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [uuidv4(), tenantId, dto.studentId, dto.leaveDate, dto.returnDate, dto.reason, dto.guardianName, dto.guardianPhone],
    );
    return rows[0];
  }

  async reviewLeaveOut(leaveOutId: string, status: 'approved' | 'rejected', approvedByUserId: string) {
    const { rows } = await this.pool.query(
      `UPDATE leave_out
       SET status = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, approvedByUserId, leaveOutId],
    );
    if (!rows[0]) throw new NotFoundException('Leave-out request not found');
    await this.audit.log({ action: `leave_out.${status}`, resource: 'leave_out', resourceId: leaveOutId });
    return rows[0];
  }

  async recordReturn(leaveOutId: string) {
    const { rows } = await this.pool.query(
      `UPDATE leave_out SET status = 'returned', returned_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [leaveOutId],
    );
    if (!rows[0]) throw new NotFoundException('Leave-out request not found');
    return rows[0];
  }

  async listLeaveOuts(status?: string, studentId?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (status) { conditions.push(`lo.status = $${idx++}`); params.push(status); }
    if (studentId) { conditions.push(`lo.student_id = $${idx++}`); params.push(studentId); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT lo.*, s.legal_name AS student_name, s.admission_no
       FROM leave_out lo
       JOIN student s ON s.id = lo.student_id
       ${where}
       ORDER BY lo.leave_date DESC
       LIMIT 200`,
      params,
    );
    return rows;
  }

  // ── Visitor Log ────────────────────────────────────────────────────────────

  async recordVisitor(dto: {
    studentId: string;
    visitorName: string;
    visitorPhone?: string;
    relation?: string;
    nationalId?: string;
    purpose?: string;
    recordedByUserId: string;
  }) {
    const { tenantId } = TenantStorage.get();
    const { rows } = await this.pool.query(
      `INSERT INTO visitor (id, tenant_id, student_id, visitor_name, visitor_phone, relation, national_id, purpose, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        uuidv4(), tenantId, dto.studentId, dto.visitorName,
        dto.visitorPhone ?? null, dto.relation ?? null,
        dto.nationalId ?? null, dto.purpose ?? null, dto.recordedByUserId,
      ],
    );
    return rows[0];
  }

  async checkOutVisitor(visitorId: string) {
    const { rows } = await this.pool.query(
      `UPDATE visitor SET check_out = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [visitorId],
    );
    if (!rows[0]) throw new NotFoundException('Visitor record not found');
    return rows[0];
  }

  async listVisitors(date?: string, studentId?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (date) { conditions.push(`v.check_in::date = $${idx++}`); params.push(date); }
    if (studentId) { conditions.push(`v.student_id = $${idx++}`); params.push(studentId); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT v.*, s.legal_name AS student_name, s.admission_no
       FROM visitor v
       JOIN student s ON s.id = v.student_id
       ${where}
       ORDER BY v.check_in DESC LIMIT 200`,
      params,
    );
    return rows;
  }

  // ── Sick Bay ───────────────────────────────────────────────────────────────

  async admitToSickBay(dto: {
    studentId: string;
    complaint: string;
    attendedByUserId: string;
  }) {
    const { tenantId } = TenantStorage.get();
    const { rows } = await this.pool.query(
      `INSERT INTO sickbay_visit (id, tenant_id, student_id, complaint, attended_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [uuidv4(), tenantId, dto.studentId, dto.complaint, dto.attendedByUserId],
    );
    return rows[0];
  }

  async updateSickBayVisit(visitId: string, dto: {
    diagnosis?: string;
    treatment?: string;
    medication?: string;
    referredToHospital?: boolean;
    hospitalName?: string;
    guardianNotified?: boolean;
  }) {
    const { rows } = await this.pool.query(
      `UPDATE sickbay_visit SET
         diagnosis = COALESCE($1, diagnosis),
         treatment = COALESCE($2, treatment),
         medication = COALESCE($3, medication),
         referred_to_hospital = COALESCE($4, referred_to_hospital),
         hospital_name = COALESCE($5, hospital_name),
         guardian_notified = COALESCE($6, guardian_notified),
         guardian_notified_at = CASE WHEN $6 = true AND guardian_notified = false THEN NOW() ELSE guardian_notified_at END,
         updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        dto.diagnosis ?? null, dto.treatment ?? null, dto.medication ?? null,
        dto.referredToHospital ?? null, dto.hospitalName ?? null,
        dto.guardianNotified ?? null, visitId,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Sick bay visit not found');
    return rows[0];
  }

  async dischargeSickBay(visitId: string) {
    const { rows } = await this.pool.query(
      `UPDATE sickbay_visit SET discharged_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [visitId],
    );
    if (!rows[0]) throw new NotFoundException('Sick bay visit not found');
    return rows[0];
  }

  async listSickBayVisits(active = false) {
    const { rows } = await this.pool.query(
      `SELECT sv.*, s.legal_name AS student_name, s.admission_no
       FROM sickbay_visit sv
       JOIN student s ON s.id = sv.student_id
       ${active ? 'WHERE sv.discharged_at IS NULL' : ''}
       ORDER BY sv.admitted_at DESC LIMIT 100`,
    );
    return rows;
  }

  async getBoardingDashboard() {
    const [dormStats, leaveStats, visitorStats, sickBayStats] = await Promise.all([
      this.pool.query(`
        SELECT
          COUNT(DISTINCT d.id) AS total_dorms,
          COUNT(b.id) FILTER (WHERE b.active) AS total_beds,
          COUNT(da.id) FILTER (WHERE da.status = 'active') AS occupied_beds
        FROM dorm d
        LEFT JOIN bed b ON b.dorm_id = d.id
        LEFT JOIN dorm_assignment da ON da.bed_id = b.id
        WHERE d.active = true
      `),
      this.pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_leave_outs,
          COUNT(*) FILTER (WHERE status = 'approved' AND leave_date = CURRENT_DATE) AS out_today
        FROM leave_out
      `),
      this.pool.query(`
        SELECT COUNT(*) FILTER (WHERE check_out IS NULL) AS visitors_on_campus
        FROM visitor
        WHERE check_in::date = CURRENT_DATE
      `),
      this.pool.query(`
        SELECT COUNT(*) AS students_in_sickbay
        FROM sickbay_visit
        WHERE discharged_at IS NULL
      `),
    ]);

    return {
      dorms: dormStats.rows[0],
      leaveOut: leaveStats.rows[0],
      visitors: visitorStats.rows[0],
      sickBay: sickBayStats.rows[0],
    };
  }
}
