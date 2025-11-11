import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import supabase from '@/lib/supabaseClient';

export default function MyAppointmentsScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [servicesMap, setServicesMap] = useState(new Map());
  const [cancellingId, setCancellingId] = useState(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const { data: sess } = await supabase.auth.getSession();
      const currentUser = sess?.session?.user || null;
      setUser(currentUser);
      if (!currentUser) {
        setBookings([]);
        setServicesMap(new Map());
        return;
      }
      const { data: rows, error: qErr } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: false })
        .order('time_slot', { ascending: true });
      if (qErr) throw qErr;
      const list = rows || [];

      // Fetch related services
      const ids = Array.from(new Set(list.map(b => b.service_id).filter(Boolean)));
      let svcMap = new Map();
      if (ids.length) {
        const { data: svcs, error: sErr } = await supabase
          .from('services')
          .select('id,name,price,duration')
          .in('id', ids);
        if (sErr) throw sErr;
        svcMap = new Map((svcs || []).map(s => [s.id, s]));
      }

      setBookings(list);
      setServicesMap(svcMap);
    } catch (e) {
      setError(e?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const upcoming = useMemo(() => bookings.filter(b => b.status === 'confirmed' && (b.date >= today)), [bookings, today]);
  const past = useMemo(() => bookings.filter(b => !(b.status === 'confirmed' && (b.date >= today))), [bookings, today]);

  const sections = useMemo(() => (
    [
      { title: 'Upcoming', data: upcoming },
      { title: 'Past', data: past },
    ]
  ), [upcoming, past]);

  const statusStyles = (status) => {
    switch (status) {
      case 'confirmed':
        return { bg: '#113a1a', fg: '#4caf50' };
      case 'pending':
        return { bg: '#3a300f', fg: '#FFD700' };
      case 'cancelled':
        return { bg: '#3a1111', fg: '#ff6b6b' };
      case 'completed':
        return { bg: '#222', fg: '#9BA1A6' };
      default:
        return { bg: '#222', fg: '#9BA1A6' };
    }
  };

  const handleCancel = async (booking) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingId(booking.id);
              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', booking.id);
              if (error) throw error;

              // Optional refund flow if paid
              // If you stored a payment reference with the booking, you can trigger a refund edge function here
              if (booking.payment_status === 'paid' && booking.payment_reference) {
                try {
                  await supabase.functions.invoke('refund-paystack', { body: { reference: booking.payment_reference } });
                } catch (rfErr) {
                  console.warn('[MyAppointments] refund error', rfErr);
                }
              }

              await loadData();
              Alert.alert('Cancelled', 'Your appointment has been cancelled.');
            } catch (e) {
              Alert.alert('Cancel Failed', e?.message || 'Please try again.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const svc = servicesMap.get(item.service_id);
    const stylesFor = statusStyles(item.status);
    const showCancel = item.status === 'confirmed' && item.date >= today;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.serviceName}>{svc?.name || 'Service'}</Text>
          <View style={[styles.statusPill, { backgroundColor: stylesFor.bg, borderColor: stylesFor.fg }] }>
            <Text style={[styles.statusText, { color: stylesFor.fg }]}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={16} color="#9BA1A6" />
          <Text style={styles.metaText}>{item.date} • {item.time_slot}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="cash-outline" size={16} color="#9BA1A6" />
          <Text style={styles.metaText}>GHS {svc?.price ?? '—'}</Text>
        </View>
        {showCancel && (
          <Pressable
            style={[styles.cancelBtn, cancellingId === item.id && styles.cancelBtnDisabled]}
            onPress={() => handleCancel(item)}
            disabled={cancellingId === item.id}
          >
            {cancellingId === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Booking</Text>
            )}
          </Pressable>
        )}
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

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}> 
          <Text style={styles.info}>Please log in to view your appointments.</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/auth')}>
            <Text style={styles.primaryText}>Go to Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = upcoming.length === 0 && past.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={56} color="#555" />
          <Text style={styles.emptyTitle}>No appointments yet</Text>
          <Text style={styles.emptyText}>When you book a service, it will show up here.</Text>
          <Pressable style={styles.primary} onPress={() => router.push('/services')}>
            <Text style={styles.primaryText}>Browse Services</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  listContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { color: '#FFD700', fontWeight: '800', fontSize: 18, marginTop: 8, marginBottom: 10, paddingHorizontal: 2 },
  card: { backgroundColor: '#111', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#222', marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  serviceName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  metaText: { color: '#9BA1A6', fontSize: 13 },
  cancelBtn: { backgroundColor: '#B22222', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  cancelBtnDisabled: { opacity: 0.6 },
  cancelBtnText: { color: '#fff', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  info: { color: '#bbb', marginBottom: 16 },
  primary: { backgroundColor: '#B22222', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '800' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#777', textAlign: 'center' },
  error: { color: '#ff6b6b', textAlign: 'center', margin: 12 },
});
