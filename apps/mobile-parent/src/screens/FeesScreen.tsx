import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from '@lumora/shared-i18n';
import type { Locale } from '@lumora/shared-i18n';

interface Invoice {
  id: string;
  invoiceNo: string;
  controlNo: string;
  totalDue: string;
  totalPaid: string;
  status: string;
  termNumber: number;
  academicYear: string;
  dueDate: string;
}

interface Props {
  childId: string;
  locale: Locale;
  authToken: string;
  apiBaseUrl: string;
}

export function FeesScreen({ childId, locale, authToken, apiBaseUrl }: Props) {
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', childId],
    queryFn: async () => {
      const resp = await fetch(`${apiBaseUrl}/v1/fees/students/${childId}/invoices`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return resp.json() as Promise<Invoice[]>;
    },
  });

  const payMutation = useMutation({
    mutationFn: async ({ invoiceId, channel }: { invoiceId: string; channel: 'mobile_money' | 'bank' }) => {
      const resp = await fetch(`${apiBaseUrl}/v1/payments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          channel,
          amount: invoices?.find(i => i.id === invoiceId)?.totalDue,
          idempotencyKey: `${invoiceId}-${Date.now()}`,
        }),
      });
      if (!resp.ok) throw new Error('Payment initiation failed');
      return resp.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['invoices', childId] });
      Alert.alert('Payment Initiated', t(locale, 'fees.payNow'));
    },
    onError: () => Alert.alert('Error', t(locale, 'common.error')),
  });

  const statusColor = (status: string) => {
    const colours: Record<string, string> = {
      paid: '#16a34a', partial: '#d97706', overdue: '#dc2626',
      issued: '#2563eb', draft: '#6b7280', void: '#9ca3af',
    };
    return colours[status] ?? '#6b7280';
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>{t(locale, 'fees.title')}</Text>

      {isLoading && <Text style={styles.loading}>{t(locale, 'common.loading')}</Text>}

      {invoices?.map(inv => {
        const balance = (parseFloat(inv.totalDue) - parseFloat(inv.totalPaid)).toFixed(2);
        const isPending = ['issued', 'partial', 'overdue'].includes(inv.status);

        return (
          <View key={inv.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.invoiceNo}>{inv.invoiceNo}</Text>
              <Text style={[styles.status, { color: statusColor(inv.status) }]}>
                {t(locale, `fees.status.${inv.status}`)}
              </Text>
            </View>

            <Text style={styles.term}>
              {inv.academicYear} · Term {inv.termNumber}
            </Text>

            <View style={styles.amounts}>
              <AmountLine label={t(locale, 'fees.totalDue')} value={`TZS ${Number(inv.totalDue).toLocaleString()}`} />
              <AmountLine label={t(locale, 'fees.totalPaid')} value={`TZS ${Number(inv.totalPaid).toLocaleString()}`} />
              <AmountLine label={t(locale, 'fees.balance')} value={`TZS ${Number(balance).toLocaleString()}`} highlight={parseFloat(balance) > 0} />
            </View>

            <Text style={styles.controlNo}>{t(locale, 'fees.controlNo')}: {inv.controlNo}</Text>

            {isPending && (
              <View style={styles.payButtons}>
                <TouchableOpacity
                  style={[styles.payBtn, styles.mpesaBtn]}
                  onPress={() => payMutation.mutate({ invoiceId: inv.id, channel: 'mobile_money' })}
                  disabled={payMutation.isPending}
                >
                  <Text style={styles.payBtnText}>{t(locale, 'fees.payViaMpesa')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => payMutation.mutate({ invoiceId: inv.id, channel: 'bank' })}
                  disabled={payMutation.isPending}
                >
                  <Text style={styles.payBtnText}>{t(locale, 'fees.payViaBank')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function AmountLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.amountRow}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={[styles.amountValue, highlight && styles.amountHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#1a1a2e' },
  loading: { textAlign: 'center', color: '#666', marginTop: 32 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNo: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  status: { fontSize: 13, fontWeight: '700' },
  term: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 10 },
  amounts: { marginBottom: 8 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  amountLabel: { fontSize: 13, color: '#666' },
  amountValue: { fontSize: 13, color: '#1a1a2e', fontWeight: '500' },
  amountHighlight: { color: '#dc2626', fontWeight: '700' },
  controlNo: { fontSize: 12, color: '#888', marginBottom: 12, fontFamily: 'monospace' },
  payButtons: { flexDirection: 'row', gap: 8 },
  payBtn: { flex: 1, backgroundColor: '#f0f9ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2563eb' },
  mpesaBtn: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  payBtnText: { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
});
