import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { v4 as uuidv4 } from 'uuid';

export interface UpdateStudentDto {
  legalName?: string;
  phone?: string;
  medicalNotes?: string;
  photoKey?: string;
}

export interface AddGuardianDto {
  legalName: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  relation: 'father' | 'mother' | 'guardian' | 'sibling' | 'other';
  nida?: string;
  isPrimary?: boolean;
  canPickup?: boolean;
  finResponsible?: boolean;
}

@Injectable()
export class StudentsService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async findById(studentId: string) {
    const { rows } = await this.pool.query(
      `SELECT s.*,
         json_agg(json_build_object(
           'id', g.id, 'name', g.legal_name, 'phone', g.phone,
           'relation', sg.relation, 'isPrimary', sg.is_primary,
           'canPickup', sg.can_pickup, 'finResponsible', sg.fin_responsible
         )) FILTER (WHERE g.id IS NOT NULL) AS guardians
       FROM student s
       LEFT JOIN student_guardian sg ON sg.student_id = s.id
       LEFT JOIN guardian g ON g.id = sg.guardian_id
       WHERE s.id = $1
       GROUP BY s.id`,
      [studentId],
    );
    if (!rows[0]) throw new NotFoundException(`Student ${studentId} not found`);
    return rows[0];
  }

  async search(query: string, limit = 20) {
    const { rows } = await this.pool.query(
      `SELECT id, admission_no, legal_name, dob, gender
       FROM student
       WHERE active = true
         AND (legal_name ILIKE $1 OR admission_no ILIKE $1)
       LIMIT $2`,
      [`%${query}%`, limit],
    );
    return rows;
  }

  async update(studentId: string, dto: UpdateStudentDto) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.legalName !== undefined) { fields.push(`legal_name = $${idx++}`); values.push(dto.legalName); }
    if (dto.medicalNotes !== undefined) { fields.push(`medical_notes = $${idx++}`); values.push(dto.medicalNotes); }
    if (dto.photoKey !== undefined) { fields.push(`photo_key = $${idx++}`); values.push(dto.photoKey); }

    if (fields.length === 0) return this.findById(studentId);

    fields.push(`updated_at = NOW()`);
    values.push(studentId);

    const { rows } = await this.pool.query(
      `UPDATE student SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (!rows[0]) throw new NotFoundException('Student not found');

    await this.audit.log({ action: 'student.update', resource: 'student', resourceId: studentId, after: dto });
    return rows[0];
  }

  async addGuardian(studentId: string, dto: AddGuardianDto) {
    const guardianId = uuidv4();
    await this.pool.query(
      `INSERT INTO guardian (id, tenant_id, legal_name, phone, phone_alt, email, relation, nida)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6,$7)`,
      [guardianId, dto.legalName, dto.phone, dto.phoneAlt ?? null, dto.email ?? null, dto.relation, dto.nida ?? null],
    );

    await this.pool.query(
      `INSERT INTO student_guardian (id, tenant_id, student_id, guardian_id, is_primary, can_pickup, fin_responsible)
       VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6)`,
      [uuidv4(), studentId, guardianId, dto.isPrimary ?? false, dto.canPickup ?? false, dto.finResponsible ?? false],
    );

    await this.audit.log({ action: 'student.add_guardian', resource: 'guardian', resourceId: guardianId, after: dto });
    return { guardianId };
  }

  async getCurrentEnrollments(studentId: string) {
    const { rows } = await this.pool.query(
      `SELECT e.*, c.level, c.stream, ay.label AS academic_year, t.term_number
       FROM enrollment e
       JOIN class c ON c.id = e.class_id
       JOIN academic_year ay ON ay.id = c.academic_year_id
       JOIN term t ON t.id = e.term_id
       WHERE e.student_id = $1 AND e.status = 'active'
       ORDER BY t.start_date DESC`,
      [studentId],
    );
    return rows;
  }
}
