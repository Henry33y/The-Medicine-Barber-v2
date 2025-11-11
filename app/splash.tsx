import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

export default function SplashScreen() {
  const router = useRouter() as any;

  useEffect(() => {
    const timer = setTimeout(() => {
  router.replace('/auth');
    }, 1800);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/partial-react-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>The Medicine Barber</Text>
      <Text style={styles.tagline}>Look Sharp. Feel Sharp.</Text>
      <ActivityIndicator size="small" color="#FFD700" style={{ marginTop: 28 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: { width: 160, height: 160, marginBottom: 24 },
  title: { color: '#FFD700', fontSize: 26, fontWeight: '700' },
  tagline: { color: '#fff', fontSize: 14, marginTop: 8, letterSpacing: 0.5 },
});
