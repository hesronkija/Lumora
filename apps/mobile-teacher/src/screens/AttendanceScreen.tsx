import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from '@lumora/shared-i18n';
import type { Locale } from '@lumora/shared-i18n';
import { enqueueMark, getPendingCount, flushQueue } from '../offline/attendance-queue';
import { v4 as uuidv4 } from 'uuid';

interface Student {
  id: string;
  legalName: string;
  admissionNo: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface Props {
  sessionId: string;
  classId: string;
  locale: Locale;
  authToken: string;
  apiBaseUrl: string;
  isOnline: boolean;
}

const STATUS_COLOURS: Record<AttendanceStatus, string> = {
  present: '#16a34a',
  absent: '#dc2626',
  late: '#d97706',
  excused: '#6b7280',
};

export function AttendanceScreen({ sessionId, classId, locale, authToken, apiBaseUrl, isOnline }: Props) {
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const qc = useQueryClient();

  const { data: students, isLoading } = useQuery<Student[]>({
    queryKey: ['class-students', classId],
    queryFn: async () => {
      const resp = await fetch(`${apiBaseUrl}/v1/students?classId=${classId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return resp.json() as Promise<Student[]>;
    },
  });

  const mark = useCallback((studentId: string, status: AttendanceStatus) => {
    setMarks(prev => ({ ...prev, [studentId]: status }));
    enqueueMark({
      id: uuidv4(),
      sessionId,
      studentId,
      status,
      markedAt: new Date().toISOString(),
    });
    setPendingCount(getPendingCount());
  }, [sessionId]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isOnline) {
        const result = await flushQueue(apiBaseUrl, authToken);
        return result;
      }
      return { synced: 0, failed: 0, conflicts: [] };
    },
    onSuccess: (result) => {
      setPendingCount(getPendingCount());
      void qc.invalidateQueries({ queryKey: ['class-students', classId] });
      if (result.conflicts.length > 0) {
        Alert.alert('Sync Conflicts', `${result.conflicts.length} records conflicted and need review.`);
      } else {
        Alert.alert(
          isOnline ? 'Submitted' : 'Saved Offline',
          isOnline
            ? `${result.synced} records synced.`
            : `${pendingCount} records saved. Will sync when online.`,
        );
      }
    },
  });

  if (isLoading) return <ActivityIndicator style={styles.loader} />;

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — {pendingCount} marks pending sync</Text>
        </View>
      )}

      <FlatList
        data={students}
        keyExtractor={s => s.id}
        renderItem={({ item }) => (
          <StudentRow
            student={item}
            status={marks[item.id]}
            onMark={(status) => mark(item.id, status)}
            locale={locale}
          />
        )}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity
        style={[styles.submitBtn, submitMutation.isPending && styles.submitBtnDisabled]}
        onPress={() => submitMutation.mutate()}
        disabled={submitMutation.isPending}
      >
        <Text style={styles.submitBtnText}>
          {isOnline ? t(locale, 'attendance.markAttendance') : `Save Offline (${pendingCount})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function StudentRow({
  student, status, onMark, locale,
}: {
  student: Student;
  status?: AttendanceStatus;
  onMark: (status: AttendanceStatus) => void;
  locale: Locale;
}) {
  const statuses: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

  return (
    <View style={styles.row}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{student.legalName}</Text>
        <Text style={styles.admissionNo}>{student.admissionNo}</Text>
      </View>
      <View style={styles.statusButtons}>
        {statuses.map(s => (
          <TouchableOpacity
            key={s}
            style={[
              styles.statusBtn,
              { borderColor: STATUS_COLOURS[s] },
              status === s && { backgroundColor: STATUS_COLOURS[s] },
            ]}
            onPress={() => onMark(s)}
          >
            <Text style={[styles.statusBtnText, status === s && { color: '#fff' }]}>
              {t(locale, `attendance.${s}`).charAt(0)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1 },
  offlineBanner: { backgroundColor: '#fef3c7', paddingVertical: 6, paddingHorizontal: 16 },
  offlineText: { color: '#92400e', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  list: { padding: 12 },
  row: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  admissionNo: { fontSize: 12, color: '#888', marginTop: 1 },
  statusButtons: { flexDirection: 'row', gap: 6 },
  statusBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  statusBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  submitBtn: { margin: 16, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
