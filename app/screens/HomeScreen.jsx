import supabase from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
          // If profile row is missing, attempt a friendly upsert using available metadata
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
              // Re-fetch profile after upsert
              const { data: newProf } = await supabase.from('profiles').select('*').eq('id', user.id).single();
              if (active) setProfile(newProf || null);
            } catch (_e) {
              // Non-fatal; user can edit profile manually
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

  // Derive a friendly display name from profile, user metadata (Google), or email prefix.
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
  const shopAddress = '123 Barber Lane, Accra, Ghana';
  const phoneNumber = '+233550325368';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Image source={require('@/assets/images/partial-react-logo.png')} style={styles.heroBg} />
          <View style={styles.heroOverlay} />
          <Text style={styles.greeting}>Hey {displayName}</Text>
          <Text style={styles.tagline}>Ready for a fresh cut?</Text>
          <Pressable style={styles.cta} onPress={() => { console.log('[Home] CTA pressed -> /services'); router.push('/services'); }}>
            <Text style={styles.ctaText}>Book Appointment</Text>
          </Pressable>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Hours</Text>
            <Text style={styles.infoValue}>{shopHours}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>{shopAddress}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Services</Text>
            <Text style={styles.infoValue}>{servicesCount ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Next Appointment</Text>
          {loading ? (
            <ActivityIndicator color="#FFD700" />
          ) : nextAppt ? (
            <>
              <Text style={styles.apptText}>
                {nextAppt.date} · {nextAppt.time_slot}{'\n'}{nextAppt.service?.name || 'Service'}
              </Text>
              <Pressable
                style={styles.secondaryBtn}
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
                <Text style={styles.secondaryBtnText}>Cancel Appointment</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.empty}>No upcoming appointments</Text>
          )}
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionCard} onPress={() => { console.log('[Home] Go to /my-appointments'); router.push('/my-appointments'); }}>
            <Text style={styles.actionTitle}>My Appointments</Text>
            <Text style={styles.actionSub}>View & manage</Text>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={() => Linking.openURL(`tel:${phoneNumber}`)}>
            <Text style={styles.actionTitle}>Call Shop</Text>
            <Text style={styles.actionSub}>Tap to dial</Text>
          </Pressable>
          <Pressable
            style={styles.actionCard}
            onPress={() => Linking.openURL('https://maps.google.com/?q=' + encodeURIComponent(shopAddress))}
          >
            <Text style={styles.actionTitle}>Location</Text>
            <Text style={styles.actionSub}>Open Maps</Text>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={() => { console.log('[Home] Go to /profile'); router.push('/profile'); }}>
            <Text style={styles.actionTitle}>Edit Profile</Text>
            <Text style={styles.actionSub}>Name & contact</Text>
          </Pressable>
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#111',
    padding: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  heroBg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.08, resizeMode: 'cover' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  greeting: { color: '#FFD700', fontSize: 26, fontWeight: '800' },
  tagline: { color: '#fff', marginTop: 4, marginBottom: 18, fontSize: 15 },
  cta: {
    backgroundColor: '#B22222',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#B22222',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  infoItem: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    minWidth: 110,
  },
  infoLabel: { color: '#888', fontSize: 11, marginBottom: 4, letterSpacing: 0.5 },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sectionCard: {
    backgroundColor: '#111',
    padding: 18,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionTitle: { color: '#FFD700', fontWeight: '700', marginBottom: 10, fontSize: 16 },
  apptText: { color: '#fff', lineHeight: 20 },
  empty: { color: '#555', fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  actionCard: {
    flex: 1,
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    justifyContent: 'center',
  },
  actionTitle: { color: '#FFD700', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  actionSub: { color: '#bbb', fontSize: 11 },
  error: { color: '#ff6b6b', marginTop: 12, textAlign: 'center' },
});

