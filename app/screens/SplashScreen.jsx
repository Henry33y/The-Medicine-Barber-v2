import supabase, { getSession } from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await getSession();
      const session = data?.session;
      if (!mounted) return;
      if (session?.user) {
  router.replace('/');
      } else {
        router.replace('/auth');
      }
      setChecking(false);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
  router.replace('/');
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>The Medicine Barber</Text>
        <Text style={styles.tagline}>Look Sharp. Feel Sharp.</Text>
        {checking && <ActivityIndicator color="#FFD700" style={{ marginTop: 24 }} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logo: { width: 160, height: 160, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFD700' },
  tagline: { fontSize: 15, color: '#fff', marginTop: 8, letterSpacing: 0.5 },
});

