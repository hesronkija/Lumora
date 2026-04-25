import { Injectable, Inject, ConflictException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { TenantStorage } from '@lumora/shared-tenancy';
import { v4 as uuidv4 } from 'uuid';

export interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

@Injectable()
export class AttendanceService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async takeAttendance(data: {
    classId: string;
    termId: string;
    date: string;
    sessionType?: 'morning' | 'afternoon' | 'full_day';
    takenBy: string;
    records: AttendanceRecord[];
  }) {
    const { tenantId } = TenantStorage.get();

    // Prevent duplicate sessions
    const existing = await this.pool.query(
      `SELECT id FROM attendance_session
       WHERE class_id = $1 AND date = $2 AND session_type = $3`,
      [data.classId, data.date, data.sessionType ?? 'full_day'],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictException('Attendance already taken for this class/date/session');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
      await client.query(`SET LOCAL app.current_user_id = $1`, [data.takenBy]);

      const sessionId = uuidv4();
      await client.query(
        `INSERT INTO attendance_session
          (id, tenant_id, class_id, term_id, date, session_type, taken_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sessionId, tenantId, data.classId, data.termId, data.date, data.sessionType ?? 'full_day', data.takenBy],
      );

      for (const r of data.records) {
        await client.query(
          `INSERT INTO attendance_record (id, tenant_id, session_id, student_id, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), tenantId, sessionId, r.studentId, r.status, r.notes ?? null],
        );
      }

      await client.query('COMMIT');
      return { sessionId, recordCount: data.records.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getAttendanceSummary(studentId: string, termId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ar.status = 'present') AS present,
         COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent,
         COUNT(*) FILTER (WHERE ar.status = 'late') AS late,
         COUNT(*) FILTER (WHERE ar.status = 'excused') AS excused,
         COUNT(*) AS total
       FROM attendance_record ar
       JOIN attendance_session s ON s.id = ar.session_id
       WHERE ar.student_id = $1 AND s.term_id = $2`,
      [studentId, termId],
    );
    return rows[0];
  }

  async getClassAttendance(classId: string, date: string) {
    const { rows } = await this.pool.query(
      `SELECT ar.*, st.legal_name AS student_name, st.admission_no
       FROM attendance_record ar
       JOIN attendance_session s ON s.id = ar.session_id
       JOIN student st ON st.id = ar.student_id
       WHERE s.class_id = $1 AND s.date = $2
       ORDER BY st.legal_name`,
      [classId, date],
    );
    return rows;
  }
}
