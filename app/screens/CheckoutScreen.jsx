import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import supabase from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

// CheckoutScreen
// Accepts a `bookingDraft` param (JSON string) OR individual params (serviceId, date, timeSlot, amount, notes).
// Flow:
// 1. Display summary + Pay button.
// 2. On pay: call Supabase Edge Function `init-paystack` with amount & email to get { authorization_url, reference }.
// 3. Open external browser (simplest, avoids embedding WebView) OR (optional) WebView for in-app.
// 4. After user completes payment Paystack redirects to a callback URL you control (e.g. https://<your-supabase-project>.functions.supabase.co/paystack-callback?reference=xxx) OR you poll verify endpoint via another function `verify-paystack`.
// 5. On successful verification: insert booking & payment records, then navigate to confirmation screen.
// 6. Handle failure/cancel gracefully.
// NOTE: Never expose Paystack secret key here. All sensitive calls happen inside edge functions.

// EXPECTED Supabase Edge Functions (to implement separately):
//   init-paystack.ts
//       - Input: { amountKobo: number, email: string, metadata?: object }
//       - Output: { authorization_url: string, reference: string }
//   verify-paystack.ts
//       - Input: { reference: string }
//       - Output: { status: 'success' | 'failed', gateway_response: string, amountKobo: number }

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Parse bookingDraft param if present
  const bookingDraft = useMemo(() => {
    try {
      const raw = Array.isArray(params.bookingDraft) ? params.bookingDraft[0] : params.bookingDraft;
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[CheckoutScreen] Failed parsing bookingDraft JSON:', e);
    }
    return null;
  }, [params.bookingDraft]);

  const serviceId = bookingDraft?.service_id || (Array.isArray(params.serviceId) ? params.serviceId[0] : params.serviceId);
  const date = bookingDraft?.date || (Array.isArray(params.date) ? params.date[0] : params.date);
  const timeSlot = bookingDraft?.time_slot || (Array.isArray(params.time_slot) ? params.time_slot[0] : params.time_slot);
  const amount = bookingDraft?.amount || (Array.isArray(params.amount) ? parseFloat(params.amount[0]) : Number(params.amount));
  const notes = bookingDraft?.notes || (Array.isArray(params.notes) ? params.notes[0] : params.notes);

  const [service, setService] = useState(null);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [reference, setReference] = useState('');
  const [completed, setCompleted] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const launchedBrowser = useRef(false);

  // Load user & service for summary
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (active) setUser(sess?.session?.user || null);
      if (serviceId) {
        const { data: svc } = await supabase.from('services').select('*').eq('id', serviceId).single();
        if (active) setService(svc || null);
      }
    })();
    return () => { active = false; };
  }, [serviceId]);

  const canPay = !!user && !!service && !!date && !!timeSlot && amount > 0 && !initializing && !verifying && !completed;

  const koboAmount = useMemo(() => Math.round((amount || 0) * 100), [amount]); // Paystack expects amount in kobo

  const beginPayment = useCallback(async () => {
    if (!canPay) return;
    setPaymentError('');
    setInitializing(true);
    try {
      // 1. Initialize transaction via edge function (to implement separately)
      //    In your Supabase functions directory create init-paystack function.
      const { data, error } = await supabase.functions.invoke('init-paystack', {
        body: {
          amountKobo: koboAmount,
          email: user.email,
          metadata: {
            serviceId,
            date,
            timeSlot,
            notes: notes || '',
            userId: user.id,
          },
        },
      });
      if (error) throw error;
      if (!data?.authorization_url || !data?.reference) {
        throw new Error('Invalid init-paystack response');
      }
  setReference(data.reference);

      // 2. Open external browser to Paystack checkout.
      //    For more controlled UX, add react-native-webview and embed it instead.
      launchedBrowser.current = true;
      const supported = await Linking.canOpenURL(data.authorization_url);
      if (supported) {
        await Linking.openURL(data.authorization_url);
        Alert.alert('Payment', 'Complete payment in browser then return here. Tap "Verify Payment" after finishing.');
      } else {
        throw new Error('Cannot open payment URL');
      }
    } catch (e) {
      console.error('[CheckoutScreen] init error', e);
      setPaymentError(e?.message || 'Failed to start payment');
    } finally {
      setInitializing(false);
    }
  }, [canPay, koboAmount, user, serviceId, date, timeSlot, notes]);

  const verifyPayment = useCallback(async () => {
    if (!reference) {
      Alert.alert('Missing Reference', 'Start payment first.');
      return;
    }
    setVerifying(true);
    setPaymentError('');
    try {
      // 3. Verify transaction via edge function.
      const { data, error } = await supabase.functions.invoke('verify-paystack', {
        body: { reference },
      });
      if (error) throw error;
      if (data?.status !== 'success') {
        setPaymentError(data?.gateway_response || 'Payment not successful');
        Alert.alert('Payment Failed', data?.gateway_response || 'Transaction failed');
        return;
      }

      // 4. Insert appointment (confirmed & paid)
      const bookingRow = {
        user_id: user.id,
        service_id: serviceId,
        date,
        time_slot: timeSlot,
        status: 'confirmed',
        payment_status: 'paid',
        notes: notes || '',
      };
      const { data: bookingInserted, error: bookingErr } = await supabase
        .from('appointments')
        .insert(bookingRow)
        .select()
        .single();
      if (bookingErr) throw bookingErr;

      // 5. Record payment metadata
      const paymentRow = {
        appointment_id: bookingInserted.id,
        provider: 'paystack',
        reference,
        amount: amount,
        amount_kobo: koboAmount,
        status: 'success',
      };
      const { error: payErr } = await supabase.from('payments').insert(paymentRow);
      if (payErr) console.warn('[CheckoutScreen] payment insert error', payErr);

      setCompleted(true);
      Alert.alert('Payment Success', 'Your booking is confirmed!', [
        { text: 'OK', onPress: () => router.replace('/my-appointments') },
      ]);
    } catch (e) {
      console.error('[CheckoutScreen] verify error', e);
      setPaymentError(e?.message || 'Verification failed');
      Alert.alert('Verification Error', e?.message || 'Could not verify payment');
    } finally {
      setVerifying(false);
    }
  }, [reference, user, serviceId, date, timeSlot, notes, amount, koboAmount, router]);

  if (!serviceId || !date || !timeSlot || !amount) {
    return (
      <SafeAreaView style={styles.safe}>\n        <View style={styles.center}>\n          <Text style={styles.error}>Missing booking draft data.</Text>\n          <Pressable style={styles.backBtn} onPress={() => router.back()}>\n            <Text style={styles.backBtnText}>Go Back</Text>\n          </Pressable>\n        </View>\n      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFD700" />
        </Pressable>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.subtitle}>Review & Pay securely</Text>

        {/* Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.label}>Service</Text><Text style={styles.value}>{service?.name || '...'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.label}>Date</Text><Text style={styles.value}>{date}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.label}>Time</Text><Text style={styles.value}>{timeSlot}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.label}>Amount</Text><Text style={styles.value}>GHS {amount}</Text></View>
          {notes ? <View style={styles.notesBlock}><Text style={styles.notesLabel}>Notes</Text><Text style={styles.notesValue}>{notes}</Text></View> : null}
        </View>

        {/* Payment Actions */}
        {!completed && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.payBtn, !canPay && styles.payBtnDisabled]}
              disabled={!canPay}
              onPress={beginPayment}
            >
              {initializing ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Pay with Paystack</Text>}
            </Pressable>
            <Pressable
              style={[styles.verifyBtn, (!reference || verifying) && styles.verifyBtnDisabled]}
              disabled={!reference || verifying}
              onPress={verifyPayment}
            >
              {verifying ? <ActivityIndicator color="#FFD700" /> : <Text style={styles.verifyBtnText}>Verify Payment</Text>}
            </Pressable>
          </View>
        )}

        {paymentError ? <Text style={styles.error}>{paymentError}</Text> : null}
        {completed && <Text style={styles.success}>Payment completed ✅</Text>}

        {/* Developer Notes */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Implementation Notes</Text>
          <Text style={styles.infoText}>• Ensure Supabase Edge Functions init-paystack & verify-paystack are deployed.</Text>
          <Text style={styles.infoText}>• Never store Paystack secret in the client.</Text>
          <Text style={styles.infoText}>• Optionally replace external browser with in-app WebView.</Text>
          <Text style={styles.infoText}>• Consider polling verification automatically when app resumes.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222', marginBottom: 16,
  },
  title: { color: '#FFD700', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#888', marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: '#111', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#222', marginBottom: 24 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#888', fontSize: 13 },
  value: { color: '#fff', fontSize: 14, fontWeight: '600' },
  notesBlock: { marginTop: 8 },
  notesLabel: { color: '#888', fontSize: 13, marginBottom: 4 },
  notesValue: { color: '#bbb', fontSize: 13, lineHeight: 18 },
  actions: { gap: 14 },
  payBtn: { backgroundColor: '#B22222', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  payBtnDisabled: { backgroundColor: '#551515' },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  verifyBtn: { backgroundColor: '#111', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700' },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: '#FFD700', fontWeight: '700', fontSize: 15 },
  error: { color: '#ff6b6b', marginTop: 18 },
  success: { color: '#4caf50', marginTop: 18, fontWeight: '700' },
  backBtn: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: '#222', marginTop: 16 },
  backBtnText: { color: '#FFD700', fontWeight: '700' },
  infoBox: { backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#222', marginTop: 30 },
  infoTitle: { color: '#FFD700', fontWeight: '700', marginBottom: 8 },
  infoText: { color: '#777', fontSize: 12, lineHeight: 18 },
});

