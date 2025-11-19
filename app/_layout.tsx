import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import supabase from '@/lib/supabaseClient';
import React, { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const unstable_settings = {
  anchor: '(tabs)',
};

WebBrowser.maybeCompleteAuthSession();

function AuthGate() {
  const router = useRouter() as any;
  const pathname = usePathname();

  const [, setChecked] = useState(false);
  const [, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const hasUser = !!data.session?.user;
      const guestId = await AsyncStorage.getItem('guest_id');
      const isGuest = !!guestId;

      setSignedIn(hasUser || isGuest);
      setChecked(true);

      if (!hasUser && !isGuest && pathname !== '/auth') {
        router.replace('/auth');
        return;
      }

      if (hasUser && (pathname === '/auth' || pathname === '/splash')) {
        router.replace('/');
        return;
      }

      // Guests are allowed to stay on /auth
    }

    check();

    /* --- Auth Listener --- */
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const hasUser = !!session?.user;
        const guestId = await AsyncStorage.getItem('guest_id');
        const isGuest = !!guestId;

        setSignedIn(hasUser || isGuest);

        if (hasUser && (pathname === '/auth' || pathname === '/splash')) {
          router.replace('/');
        }
      }
    );

    /* --- Deep Link Handler --- */
    const urlListener = async ({ url }: { url: string }) => {
      try {
        const getParam = (u: string, key: string) => {
          const parsed = new URL(u);
          return parsed.searchParams.get(key);
        };

        const code = getParam(url, 'code');
        const error = getParam(url, 'error_description');

        if (error) {
          Alert.alert('Sign-in failed', decodeURIComponent(error));
          return;
        }

        if (code) {
          let success = false;

          try {
            const { data } = await (supabase as any).auth.exchangeCodeForSession({
              authCode: code,
            });
            if (data?.session?.user) {
              success = true;
              router.replace('/');
              return;
            }
          } catch {}

          if (!success) {
            try {
              const { data } = await (supabase as any).auth.exchangeCodeForSession({
                code,
              });
              if (data?.session?.user) {
                router.replace('/');
                return;
              }
            } catch (e: any) {
              Alert.alert('Sign-in error', e?.message || 'Could not complete sign-in');
            }
          }
        }
      } catch (e) {
        console.warn('Deep link error:', e);
      }
    };

    const sub = Linking.addEventListener('url', urlListener);

    Linking.getInitialURL()
      .then((initial) => {
        if (initial) urlListener({ url: initial });
      })
      .catch((e) => console.warn('getInitialURL error:', e));

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      sub.remove();
    };
  }, [pathname, router]);

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
