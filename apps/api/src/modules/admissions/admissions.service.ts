import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { AuditService } from '../audit/audit.service';
import { withTenantTx } from '@lumora/shared-tenancy';
import { v4 as uuidv4 } from 'uuid';

export interface CreateApplicationDto {
  applicantName: string;
  applicantDob: string; // ISO date
  applicantGender: 'male' | 'female' | 'other';
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  applyingForClass: string;
  academicYear: string;
}

export interface ReviewApplicationDto {
  applicationId: string;
  status: 'offered' | 'rejected';
  reviewedBy: string;
  rejectionReason?: string;
}

export interface EnrollFromApplicationDto {
  applicationId: string;
  classId: string;
  termId: string;
  admissionNo: string;
}

@Injectable()
export class AdmissionsService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async createApplication(dto: CreateApplicationDto) {
    const client = await this.pool.connect();
    try {
      const result = await withTenantTx(client, async (c) => {
        const count = await c.query(
          `SELECT COUNT(*) FROM application WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
        );
        const seq = (parseInt((count.rows[0] as { count: string }).count) + 1).toString().padStart(4, '0');
        const year = new Date().getFullYear();
        const applicationNo = `APP/${year}/${seq}`;

        const { rows } = await c.query(
          `INSERT INTO application
            (id, tenant_id, application_no, applicant_name, applicant_dob, applicant_gender,
             guardian_name, guardian_phone, guardian_email, applying_for_class, academic_year, status)
           VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
           RETURNING *`,
          [
            uuidv4(), applicationNo,
            dto.applicantName, dto.applicantDob, dto.applicantGender,
            dto.guardianName, dto.guardianPhone, dto.guardianEmail ?? null,
            dto.applyingForClass, dto.academicYear,
          ],
        );
        return rows[0];
      });

      await this.audit.log({ action: 'application.create', resource: 'application', resourceId: result.id, after: result });
      return result;
    } finally {
      client.release();
    }
  }

  async submitApplication(applicationId: string) {
    const { rows } = await this.pool.query(
      `UPDATE application SET status = 'submitted', updated_at = NOW()
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [applicationId],
    );
    if (!rows[0]) throw new NotFoundException('Application not found or not in draft state');
    await this.audit.log({ action: 'application.submit', resource: 'application', resourceId: applicationId });
    return rows[0];
  }

  async reviewApplication(dto: ReviewApplicationDto) {
    const { rows } = await this.pool.query(
      `UPDATE application
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
           rejection_reason = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [dto.status, dto.reviewedBy, dto.rejectionReason ?? null, dto.applicationId],
    );
    if (!rows[0]) throw new NotFoundException('Application not found');
    await this.audit.log({
      action: `application.${dto.status}`,
      resource: 'application',
      resourceId: dto.applicationId,
      after: { status: dto.status },
    });
    return rows[0];
  }

  async enrollFromApplication(dto: EnrollFromApplicationDto) {
    const client = await this.pool.connect();
    try {
      return await withTenantTx(client, async (c) => {
        const { rows: appRows } = await c.query(
          `SELECT * FROM application WHERE id = $1 AND status = 'offered'`,
          [dto.applicationId],
        );
        const app = appRows[0];
        if (!app) throw new NotFoundException('Application not found or not in offered state');

        // Check for duplicate admission number
        const { rows: dupRows } = await c.query(
          `SELECT id FROM student WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid AND admission_no = $1`,
          [dto.admissionNo],
        );
        if (dupRows.length > 0) throw new ConflictException(`Admission number ${dto.admissionNo} already exists`);

        const studentId = uuidv4();
        await c.query(
          `INSERT INTO student
            (id, tenant_id, admission_no, legal_name, dob, gender, active)
           VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2, $3, $4, $5, true)`,
          [studentId, dto.admissionNo, app.applicant_name, app.applicant_dob, app.applicant_gender],
        );

        await c.query(
          `INSERT INTO enrollment
            (id, tenant_id, student_id, class_id, term_id, status)
           VALUES ($1, current_setting('app.current_tenant_id', true)::uuid, $2, $3, $4, 'active')`,
          [uuidv4(), studentId, dto.classId, dto.termId],
        );

        await c.query(
          `UPDATE application SET status = 'enrolled', student_id = $1, updated_at = NOW() WHERE id = $2`,
          [studentId, dto.applicationId],
        );

        await this.audit.log({
          action: 'application.enroll',
          resource: 'student',
          resourceId: studentId,
          after: { admissionNo: dto.admissionNo, applicationId: dto.applicationId },
        });

        return { studentId, admissionNo: dto.admissionNo };
      });
    } finally {
      client.release();
    }
  }

  async listApplications(status?: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM application
       ${status ? `WHERE status = $1` : ''}
       ORDER BY created_at DESC`,
      status ? [status] : [],
    );
    return rows;
  }

  async getApplication(id: string) {
    const { rows } = await this.pool.query(
      `SELECT a.*, array_agg(row_to_json(d)) FILTER (WHERE d.id IS NOT NULL) AS documents
       FROM application a
       LEFT JOIN application_document d ON d.application_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Application not found');
    return rows[0];
  }
}
