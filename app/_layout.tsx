import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import supabase from '@/lib/supabaseClient';
import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthGate() {
  const router = useRouter() as any;
  const pathname = usePathname();
  // Local markers (could be used for loading UI later). Intentionally unused for now.
  const [, setChecked] = useState(false);
  const [, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const hasUser = !!data.session?.user;
      console.log('[AuthGate] Initial session check. hasUser:', hasUser, 'pathname:', pathname);
      setSignedIn(hasUser);
      setChecked(true);
      if (!hasUser && pathname !== '/auth' && pathname !== '/splash') {
        console.log('[AuthGate] Redirecting to /auth');
        router.replace('/auth');
      }
      if (hasUser && (pathname === '/auth' || pathname === '/splash')) {
        console.log('[AuthGate] Authenticated user leaving gate path → /');
        router.replace('/');
      }
    }
    check();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const hasUser = !!session?.user;
      console.log('[AuthGate] onAuthStateChange.', event, 'hasUser:', hasUser);
      setSignedIn(hasUser);
      if (!hasUser && event === 'SIGNED_OUT') {
        console.log('[AuthGate] Redirecting to /auth (SIGNED_OUT)');
        router.replace('/auth');
        return;
      }
      if (hasUser && event === 'SIGNED_IN') {
        if (pathname === '/auth' || pathname === '/splash') {
          console.log('[AuthGate] Signed in on gate path → /');
          router.replace('/');
        }
      }
    });
    const urlListener = ({ url }: { url: string }) => {
      console.log('[AuthGate] Deep link opened:', url);
    };
    const sub = Linking.addEventListener('url', urlListener);
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      sub.remove();
    };
  }, [pathname, router]);

  // Optionally could show a tiny placeholder while checking
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
  <Stack.Screen name="splash" options={{ headerShown: false }} />
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      <AuthGate />
    </ThemeProvider>
  );
}
