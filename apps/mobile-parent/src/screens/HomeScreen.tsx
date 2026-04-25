import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { t } from '@lumora/shared-i18n';
import type { Locale } from '@lumora/shared-i18n';
import { useNavigation } from '@react-navigation/native';

interface Child {
  id: string;
  legalName: string;
  admissionNo: string;
  classLevel: string;
  stream?: string;
  attendanceRate: number;
  feesBalance: string;
  canteenBalance: string;
}

interface HomeScreenProps {
  locale: Locale;
  authToken: string;
  apiBaseUrl: string;
}

export function HomeScreen({ locale, authToken, apiBaseUrl }: HomeScreenProps) {
  const navigation = useNavigation();

  const { data: children, isLoading, refetch, isRefetching } = useQuery<Child[]>({
    queryKey: ['parent-children'],
    queryFn: async () => {
      const resp = await fetch(`${apiBaseUrl}/v1/parent/children`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!resp.ok) throw new Error('Failed to load children');
      return resp.json() as Promise<Child[]>;
    },
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <Text style={styles.heading}>{t(locale, 'parent.myChildren')}</Text>

      {isLoading && <Text style={styles.loading}>{t(locale, 'common.loading')}</Text>}

      {children?.map(child => (
        <View key={child.id} style={styles.card}>
          <Text style={styles.name}>{child.legalName}</Text>
          <Text style={styles.meta}>
            {child.classLevel}{child.stream ? ` – ${child.stream}` : ''} · {child.admissionNo}
          </Text>

          <View style={styles.stats}>
            <Stat label={t(locale, 'attendance.attendanceRate')} value={`${(child.attendanceRate * 100).toFixed(0)}%`} />
            <Stat label={t(locale, 'fees.balance')} value={`TZS ${Number(child.feesBalance).toLocaleString()}`} />
            <Stat label={t(locale, 'parent.canteenBalance')} value={`TZS ${Number(child.canteenBalance).toLocaleString()}`} />
          </View>

          <View style={styles.actions}>
            <ActionButton label={t(locale, 'parent.payFees')} onPress={() => navigation.navigate('Fees' as never, { childId: child.id } as never)} primary />
            <ActionButton label={t(locale, 'parent.viewReport')} onPress={() => navigation.navigate('Grades' as never, { childId: child.id } as never)} />
            <ActionButton label={t(locale, 'parent.attendance')} onPress={() => navigation.navigate('Attendance' as never, { childId: child.id } as never)} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, primary && styles.actionBtnPrimary]} onPress={onPress}>
      <Text style={[styles.actionBtnText, primary && styles.actionBtnTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#1a1a2e' },
  loading: { textAlign: 'center', color: '#666', marginTop: 32 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  name: { fontSize: 18, fontWeight: '600', color: '#1a1a2e' },
  meta: { fontSize: 13, color: '#666', marginTop: 2, marginBottom: 12 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2563eb', alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  actionBtnText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  actionBtnTextPrimary: { color: '#fff' },
});
