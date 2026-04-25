/**
 * Offline attendance queue for teacher mobile app.
 *
 * Attendance marked offline is stored in MMKV with a pending queue.
 * On network reconnect (NetInfo event), the queue flushes to the API.
 * Server-authoritative: if the server rejects a record, it's flagged for review.
 *
 * Sync model: server wins. Offline records that conflict with server state
 * (e.g., session already closed) are surfaced to the teacher to resolve.
 */

import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'attendance-queue' });

export interface PendingAttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
  markedAt: string; // ISO timestamp
  retryCount: number;
}

export interface FlushResult {
  synced: number;
  failed: number;
  conflicts: PendingAttendanceRecord[];
}

export function enqueueMark(record: Omit<PendingAttendanceRecord, 'retryCount'>): void {
  const queue = getPendingQueue();
  // Replace if same student + session already queued
  const idx = queue.findIndex(r => r.studentId === record.studentId && r.sessionId === record.sessionId);
  if (idx >= 0) {
    queue[idx] = { ...record, retryCount: 0 };
  } else {
    queue.push({ ...record, retryCount: 0 });
  }
  storage.set('pending', JSON.stringify(queue));
}

export function getPendingQueue(): PendingAttendanceRecord[] {
  const raw = storage.getString('pending');
  return raw ? (JSON.parse(raw) as PendingAttendanceRecord[]) : [];
}

export function clearSynced(ids: string[]): void {
  const queue = getPendingQueue().filter(r => !ids.includes(r.id));
  storage.set('pending', JSON.stringify(queue));
}

export function getPendingCount(): number {
  return getPendingQueue().length;
}

export async function flushQueue(apiBaseUrl: string, authToken: string): Promise<FlushResult> {
  const queue = getPendingQueue();
  if (!queue.length) return { synced: 0, failed: 0, conflicts: [] };

  const synced: string[] = [];
  const conflicts: PendingAttendanceRecord[] = [];
  let failed = 0;

  for (const record of queue) {
    try {
      const resp = await fetch(`${apiBaseUrl}/v1/attendance/mark-offline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: record.sessionId,
          studentId: record.studentId,
          status: record.status,
          note: record.note,
          markedAt: record.markedAt,
        }),
      });

      if (resp.ok) {
        synced.push(record.id);
      } else if (resp.status === 409) {
        conflicts.push(record);
      } else {
        failed++;
        // Increment retry count; drop after 5 retries
        record.retryCount++;
        if (record.retryCount >= 5) synced.push(record.id); // give up
      }
    } catch {
      failed++;
    }
  }

  clearSynced(synced);
  return { synced: synced.length, failed, conflicts };
}
