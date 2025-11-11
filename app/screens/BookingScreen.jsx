import supabase from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SHOP_OPEN = 9; // 9 AM
const SHOP_CLOSE = 18; // 6 PM

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const serviceId = Array.isArray(params.serviceId) ? params.serviceId[0] : params.serviceId;

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('shop'); // 'shop' or 'now'
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (active) setUser(sess?.session?.user || null);
        if (!serviceId) {
          setLoading(false);
          return;
        }
        const { data: svcData, error: svcError } = await supabase
          .from('services')
          .select('*')
          .eq('id', serviceId)
          .single();
        if (svcError) throw svcError;
        if (active) setService(svcData);
      } catch (e) {
        Alert.alert('Error', e?.message || 'Failed to load service');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [serviceId]);

  useEffect(() => {
    if (selectedDate && service) {
      loadAvailableSlots();
    } else {
      setAvailableSlots([]);
      setSelectedSlot('');
    }
  }, [selectedDate, service]);

  async function loadAvailableSlots() {
    setLoadingSlots(true);
    try {
      // Fetch appointments for selected date
      const { data: bookings } = await supabase
        .from('appointments')
        .select('time_slot')
        .eq('date', selectedDate)
        .in('status', ['confirmed', 'pending']);

      const bookedSlots = (bookings || []).map(b => b.time_slot);

      // Generate slots from shop hours
      const duration = service.duration || 30;
      const slots = [];
      for (let h = SHOP_OPEN; h < SHOP_CLOSE; h++) {
        ['00', '30'].forEach(m => {
          const time = `${h.toString().padStart(2, '0')}:${m}`;
          // Simple heuristic: if booking starts here, block it
          if (!bookedSlots.includes(time)) {
            slots.push(time);
          }
        });
      }
      setAvailableSlots(slots);
    } catch (e) {
      Alert.alert('Error loading slots', e?.message || 'Try again');
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBooking() {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to book an appointment.');
      router.push('/auth');
      return;
    }
    if (!selectedDate || !selectedSlot) {
      Alert.alert('Missing Info', 'Please select a date and time slot.');
      return;
    }
    setSubmitting(true);
    try {
      if (paymentMethod === 'now') {
        // Do NOT create the booking yet; proceed to checkout for payment
        const draft = {
          user_id: user.id,
          service_id: serviceId,
          date: selectedDate,
          time_slot: selectedSlot,
          amount: Number(service?.price || 0),
          notes,
        };
        router.push({ pathname: '/checkout', params: { bookingDraft: JSON.stringify(draft) } });
        return;
      }

      // Pay at shop: create a pending booking immediately
      const bookingData = {
        user_id: user.id,
        service_id: serviceId,
        date: selectedDate,
        time_slot: selectedSlot,
        status: 'pending',
        notes,
      };
  const { error } = await supabase.from('appointments').insert(bookingData);
      if (error) throw error;
      Alert.alert('Booking Confirmed', 'Your appointment is pending. Pay at the shop.');
      router.replace('/my-appointments');
    } catch (e) {
      Alert.alert('Booking Failed', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#FFD700" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.error}>Service not found</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </Pressable>

        <Text style={styles.title}>Book Appointment</Text>

        {/* Service Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>GHS {service.price}</Text>
            <Text style={styles.metaText}>{service.duration} min</Text>
          </View>
        </View>

        {/* Date Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#888"
            value={selectedDate}
            onChangeText={setSelectedDate}
            keyboardType="default"
          />
          <Text style={styles.hint}>Earliest: {today}</Text>
        </View>

        {/* Time Slots */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Time</Text>
            {loadingSlots && <ActivityIndicator color="#FFD700" style={{ marginVertical: 10 }} />}
            {!loadingSlots && availableSlots.length === 0 && (
              <Text style={styles.emptyText}>No slots available for this date</Text>
            )}
            <View style={styles.slotsGrid}>
              {availableSlots.map(slot => (
                <Pressable
                  key={slot}
                  style={[styles.slotBtn, selectedSlot === slot && styles.slotBtnActive]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextActive]}>
                    {slot}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any special requests or notes..."
            placeholderTextColor="#888"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            <Pressable
              style={[styles.paymentBtn, paymentMethod === 'shop' && styles.paymentBtnActive]}
              onPress={() => setPaymentMethod('shop')}
            >
              <Ionicons name="storefront-outline" size={20} color={paymentMethod === 'shop' ? '#FFD700' : '#888'} />
              <Text style={[styles.paymentText, paymentMethod === 'shop' && styles.paymentTextActive]}>
                Pay At Shop
              </Text>
            </Pressable>
            <Pressable
              style={[styles.paymentBtn, paymentMethod === 'now' && styles.paymentBtnActive]}
              onPress={() => setPaymentMethod('now')}
            >
              <Ionicons name="card-outline" size={20} color={paymentMethod === 'now' ? '#FFD700' : '#888'} />
              <Text style={[styles.paymentText, paymentMethod === 'now' && styles.paymentTextActive]}>
                Pay Now
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleBooking}
          disabled={submitting || !selectedDate || !selectedSlot}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {paymentMethod === 'now' ? 'Proceed to Payment' : 'Confirm Booking'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  backButton: {
    marginBottom: 16,
    backgroundColor: '#111',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  title: { color: '#FFD700', fontSize: 26, fontWeight: '800', marginBottom: 20 },
  summaryCard: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  serviceName: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { color: '#FFD700', fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#FFD700', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  dateInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
  },
  hint: { color: '#888', fontSize: 12, marginTop: 6 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotBtn: {
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  slotBtnActive: { backgroundColor: '#B22222', borderColor: '#B22222' },
  slotText: { color: '#888', fontSize: 14, fontWeight: '600' },
  slotTextActive: { color: '#fff' },
  emptyText: { color: '#888', fontStyle: 'italic' },
  notesInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  paymentOptions: { flexDirection: 'row', gap: 12 },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  paymentBtnActive: { backgroundColor: '#1a1a1a', borderColor: '#FFD700' },
  paymentText: { color: '#888', fontSize: 14, fontWeight: '600' },
  paymentTextActive: { color: '#FFD700' },
  submitBtn: {
    backgroundColor: '#B22222',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#B22222',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
    marginTop: 10,
  },
  submitBtnDisabled: { backgroundColor: '#555' },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  error: { color: '#ff6b6b', textAlign: 'center', marginBottom: 20, fontSize: 14 },
  backBtn: {
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  backBtnText: { color: '#FFD700', fontWeight: '700' },
});