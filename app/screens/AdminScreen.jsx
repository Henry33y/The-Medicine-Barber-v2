import supabase from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const { data: sess } = await supabase.auth.getSession();
      const u = sess?.session?.user || null;
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setRows([]);
        return;
      }
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', u.id)
        .single();
      if (pErr) throw pErr;
      const admin = prof?.role === 'admin';
      setIsAdmin(admin);
      if (!admin) {
        setRows([]);
        return;
      }

      const { data: appts, error: aErr } = await supabase
        .from('appointments')
        .select('id, date, time_slot, status, payment_status, service_id, user_id, service:services(name, price, duration), customer:profiles(full_name, phone)')
        .eq('date', today)
        .order('time_slot', { ascending: true });
      if (aErr) throw aErr;
      setRows(appts || []);
    } catch (e) {
      setError(e?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  const markStatus = async (item, newStatus) => {
    try {
      setBusyId(item.id);
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', item.id);
      if (error) throw error;
      await loadData();
    } catch (e) {
      Alert.alert('Update failed', e?.message || 'Please try again');
    } finally {
      setBusyId(null);
    }
  };

  const recordCashPayment = async (item) => {
    const amount = item?.service?.price ?? 0;
    Alert.alert(
      'Record Cash Payment',
      `Mark GHS ${amount} as paid in cash?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setBusyId(item.id);
              // Insert payment row (if payments table exists)
              const paymentRow = {
                appointment_id: item.id,
                provider: 'cash',
                reference: `cash-${item.id}-${Date.now()}`,
                amount,
                amount_kobo: Math.round(amount * 100),
                status: 'success',
              };
              try {
                await supabase.from('payments').insert(paymentRow);
              } catch (pe) {
                // Non-fatal if payments table not present
                console.warn('[Admin] payments insert skipped/failed', pe?.message);
              }
              // Update appointment payment_status
              const { error } = await supabase
                .from('appointments')
                .update({ payment_status: 'paid' })
                .eq('id', item.id);
              if (error) throw error;
              await loadData();
              Alert.alert('Recorded', 'Cash payment recorded successfully');
            } catch (e) {
              Alert.alert('Failed', e?.message || 'Could not record payment');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const canMarkServed = item.status !== 'completed';
    const canMarkNoShow = item.status !== 'no-show';
    const canMarkPaid = item.payment_status !== 'paid';

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.time}>{item.time_slot}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.pill, styles.pillMuted]}>
              <Text style={styles.pillText}>{item.status}</Text>
            </View>
            <View style={[styles.pill, item.payment_status === 'paid' ? styles.pillPaid : styles.pillPending]}>
              <Text style={styles.pillText}>{item.payment_status || 'unpaid'}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.name}>{item.customer?.full_name || 'Customer'}</Text>
        <Text style={styles.service}>{item.service?.name || 'Service'} • GHS {item.service?.price ?? '—'}</Text>
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, (!canMarkServed || busyId === item.id) && styles.btnDisabled]}
            disabled={!canMarkServed || busyId === item.id}
            onPress={() => markStatus(item, 'completed')}
          >
            {busyId === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Served</Text>}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDanger, (!canMarkNoShow || busyId === item.id) && styles.btnDisabled]}
            disabled={!canMarkNoShow || busyId === item.id}
            onPress={() => markStatus(item, 'no-show')}
          >
            <Text style={styles.btnText}>No-show</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnOutline, (!canMarkPaid || busyId === item.id) && styles.btnDisabled]}
            disabled={!canMarkPaid || busyId === item.id}
            onPress={() => recordCashPayment(item)}
          >
            <Text style={styles.btnOutlineText}>Cash Paid</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#FFD700" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}> 
          <Ionicons name="alert-circle-outline" size={48} color="#ff6b6b" />
          <Text style={styles.deniedTitle}>Access denied</Text>
          <Text style={styles.deniedText}>You must be an admin to view this page.</Text>
          <Pressable style={styles.primary} onPress={() => router.replace('/') }>
            <Text style={styles.primaryText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}> 
        <Text style={styles.title}>Today • {today}</Text>
        <Pressable style={styles.linkBtn} onPress={() => router.push('/manage-services')}>
          <Ionicons name="construct-outline" size={18} color="#FFD700" />
          <Text style={styles.linkBtnText}>Manage Services</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); loadData(); }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={56} color="#555" />
            <Text style={styles.emptyTitle}>No appointments today</Text>
            <Text style={styles.emptyText}>New bookings will appear here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#FFD700', fontSize: 20, fontWeight: '800' },
  list: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  card: { backgroundColor: '#111', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#222', marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { color: '#fff', fontWeight: '800', fontSize: 16 },
  statusRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  pillMuted: { borderColor: '#444', backgroundColor: '#222' },
  pillPaid: { borderColor: '#4caf50', backgroundColor: '#103214' },
  pillPending: { borderColor: '#FFD700', backgroundColor: '#3a300f' },
  name: { color: '#fff', marginTop: 8, marginBottom: 4, fontWeight: '700' },
  service: { color: '#9BA1A6' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  btnPrimary: { backgroundColor: '#1f4a1f' },
  btnDanger: { backgroundColor: '#4a1f1f' },
  btnOutline: { backgroundColor: '#111', borderWidth: 1, borderColor: '#FFD700' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnOutlineText: { color: '#FFD700', fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 10 },
  emptyText: { color: '#777' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  deniedTitle: { color: '#ff6b6b', fontWeight: '800', fontSize: 18 },
  deniedText: { color: '#bbb' },
  primary: { backgroundColor: '#B22222', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginTop: 6 },
  primaryText: { color: '#fff', fontWeight: '800' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#222' },
  linkBtnText: { color: '#FFD700', fontWeight: '700' },
  error: { color: '#ff6b6b', textAlign: 'center', marginTop: 8 },
});
