import supabase from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LiveMap from '@/components/LiveMap';


export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [nextAppt, setNextAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [servicesCount, setServicesCount] = useState(null);
  const [error, setError] = useState('');
  const [upsertingProfile, setUpsertingProfile] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const sessionRes = await supabase.auth.getSession();
        const user = sessionRes.data.session?.user;
        if (user) {
          const [{ data: profData }, { data: svcData }, { data: bookingData }] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('services').select('id'),
            supabase
              .from('appointments')
              .select('id, date, time_slot, service:services(name)')
              .eq('user_id', user.id)
              .eq('status', 'confirmed')
              .gte('date', new Date().toISOString().slice(0, 10))
              .order('date', { ascending: true })
              .order('time_slot', { ascending: true })
              .limit(1),
          ]);
          if (active) {
            setProfile(profData || null);
            setServicesCount(svcData?.length || 0);
            setNextAppt(bookingData?.[0] || null);
          }
          if (active && !profData && !upsertingProfile) {
            setUpsertingProfile(true);
            const md = user.user_metadata || {};
            const emailPrefix = (user.email || '').split('@')[0] || '';
            const guessName = (md.full_name || md.name || emailPrefix)
              .replace(/[_\-.]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .replace(/\b\w/g, c => c.toUpperCase());
            try {
              await supabase.from('profiles').upsert({ id: user.id, full_name: guessName, email: user.email }, { onConflict: 'id' });
              const { data: newProf } = await supabase.from('profiles').select('*').eq('id', user.id).single();
              if (active) setProfile(newProf || null);
            } catch (_e) {
              // ignore
            } finally {
              if (active) setUpsertingProfile(false);
            }
          }
        }
      } catch (e) {
        if (active) setError(e?.message || 'Failed to load');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [upsertingProfile]);

  // Derive display name
  const [sessionUser, setSessionUser] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(res => setSessionUser(res.data.session?.user || null));
  }, []);
  const displayName = (
    profile?.full_name ||
    sessionUser?.user_metadata?.full_name ||
    sessionUser?.user_metadata?.name ||
    (sessionUser?.email ? sessionUser.email.split('@')[0] : null) ||
    'Guest'
  );

  const shopHours = 'Mon - Sat: 9:00 AM - 6:00 PM';
  const shopAddress = 'Underwood ST, Kwashieman, Ghana';
  const phoneNumber = '+233201791199';

  // Local path of uploaded sketch (developer: transform this path as needed)
  const sketchLocalPath = 'file:///mnt/data/a50545fd-f91d-4b63-896b-e324bf9ed945.jpg';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hey {displayName}</Text>
            <Text style={styles.tagline}>Ready for a fresh cut?</Text>
          </View>
          <Pressable style={styles.profileBtn} onPress={() => router.push('/profile')}>
            <Ionicons name="person-circle" size={40} color="#FFD700" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Big CTA */}
          <Pressable
            style={styles.cta}
            onPress={() => {
              console.log('[Home] CTA pressed -> /services');
              router.push('/services');
            }}
          >
            <Text style={styles.ctaText}>Book Appointment</Text>
          </Pressable>

          {/* Info Tabs Row */}
          <View style={styles.infoTabs}>
            <Pressable style={styles.infoTab} onPress={() => Alert.alert('Hours', shopHours)}>
              <Text style={styles.infoLabel}>Hours</Text>
              <Text style={styles.infoValSmall}>{shopHours}</Text>
            </Pressable>
            <Pressable style={styles.infoTab} onPress={() => { Linking.openURL('https://maps.google.com/?q=' + encodeURIComponent(shopAddress)); }}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValSmall}>{shopAddress}</Text>
            </Pressable>
            <Pressable style={styles.infoTab} onPress={() => router.push('/services')}>
              <Text style={styles.infoLabel}>Services</Text>
              <Text style={styles.infoValSmall}>{servicesCount ?? '—'}</Text>
            </Pressable>
          </View>

          {/* Next Appointment large card */}
          <View style={styles.nextCard}>
            <Text style={styles.sectionTitle}>Next Appointment</Text>
            {loading ? (
              <ActivityIndicator color="#FFD700" />
            ) : nextAppt ? (
              <>
                <Text style={styles.apptText}>
                  {nextAppt.date} · {nextAppt.time_slot}
                  {'\n'}
                  {nextAppt.service?.name || 'Service'}
                </Text>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={async () => {
                    try {
                      const { data: sess } = await supabase.auth.getSession();
                      const uid = sess?.session?.user?.id;
                      if (!uid) return;
                      const { error: cancelErr } = await supabase
                        .from('appointments')
                        .update({ status: 'cancelled' })
                        .eq('id', nextAppt.id)
                        .eq('user_id', uid);
                      if (cancelErr) throw cancelErr;
                      setNextAppt(null);
                      Alert.alert('Appointment cancelled');
                    } catch (e) {
                      Alert.alert('Failed to cancel', e.message || 'Try again later');
                    }
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.empty}>No upcoming appointments</Text>
            )}
          </View>

          {/* Two large buttons side-by-side */}
          <View style={styles.dualRow}>
            <Pressable style={styles.largeAction} onPress={() => router.push('/my-appointments')}>
              <Ionicons name="calendar" size={28} color="#FFD700" />
              <Text style={styles.largeActionTitle}>My Appointments</Text>
              <Text style={styles.largeActionSub}>View & manage</Text>
            </Pressable>

            <Pressable style={styles.largeAction} onPress={() => Linking.openURL(`tel:${phoneNumber}`)}>
              <Ionicons name="call" size={28} color="#FFD700" />
              <Text style={styles.largeActionTitle}>Call Shop</Text>
              <Text style={styles.largeActionSub}>Tap to dial</Text>
            </Pressable>
          </View>

          {/* Map placeholder (using uploaded sketch image) */}
          <View style={styles.mapCard}>
               <Text style={styles.mapTitle}>Map</Text>
               <LiveMap />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          {/* Bottom spacing so content isn't hidden behind nav */}
          <View style={{ height: 80 }} />
        </ScrollView>

      </View>
     
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 6,
  },
  greeting: { color: '#FFD700', fontSize: 22, fontWeight: '800' },
  tagline: { color: '#fff', fontSize: 13, marginTop: 4 },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 20,
  },

  /* CTA */
  cta: {
    backgroundColor: '#B22222',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#B22222',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: 0.3 },

  /* Info tabs */
  infoTabs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  infoTab: {
    flex: 1,
    backgroundColor: '#111',
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    minHeight: 68,
  },
  infoLabel: { color: '#FFD700', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  infoValSmall: { color: '#ddd', fontSize: 11 },

  /* Next appointment */
  nextCard: {
    backgroundColor: '#111',
    padding: 18,
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#222',
    minHeight: 110,
    justifyContent: 'space-between',
  },
  sectionTitle: { color: '#FFD700', fontWeight: '700', marginBottom: 8, fontSize: 16 },
  apptText: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  empty: { color: '#555', fontStyle: 'italic' },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFD700',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  cancelBtnText: { color: '#FFD700', fontWeight: '700' },

  /* Dual actions */
  dualRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  largeAction: {
    flex: 1,
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },
  largeActionTitle: { color: '#FFD700', fontSize: 14, fontWeight: '800', marginTop: 8 },
  largeActionSub: { color: '#bbb', fontSize: 11 },

  /* Map */
  mapCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  mapTitle: { color: '#FFD700', fontWeight: '700', padding: 12 },
  mapImage: { width: '100%', height: 180, opacity: 0.95 },

  navItem: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: '#FFD700', fontSize: 11, marginTop: 2 },
  navLabelInactive: { color: '#888', fontSize: 11, marginTop: 2 },

  error: { color: '#ff6b6b', marginTop: 12, textAlign: 'center' },
});
