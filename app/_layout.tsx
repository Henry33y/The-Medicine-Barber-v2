import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import supabase from '@/lib/supabaseClient';
import React, { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Ensure AuthSession completes on returning to the app (Expo AuthSession best practice)
WebBrowser.maybeCompleteAuthSession();

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
    const urlListener = async ({ url }: { url: string }) => {
      try {
        console.log('[AuthGate] Deep link opened:', url);
        // Attempt to extract `code` for PKCE exchange
        const extract = (u: string, key: string) => {
          const qIndex = u.indexOf('?');
          const hIndex = u.indexOf('#');
          const pick = (segment?: string) => {
            if (!segment) return null;
            const params = segment.split('&');
            for (const p of params) {
              const [k, v] = p.split('=');
              if (k === key) return decodeURIComponent(v || '');
            }
            return null;
          };
          return pick(qIndex !== -1 ? u.slice(qIndex + 1, hIndex !== -1 ? hIndex : undefined) : undefined)
              || pick(hIndex !== -1 ? u.slice(hIndex + 1) : undefined);
        };
        const code = extract(url, 'code');
        const errorDescription = extract(url, 'error_description');
        if (errorDescription) {
          console.warn('[AuthGate] OAuth error:', errorDescription);
          Alert.alert('Sign-in failed', decodeURIComponent(errorDescription));
          return;
        }
        if (code) {
          console.log('[AuthGate] Exchanging code for session. code length:', code.length);
          // Try both signatures to maximize compatibility across supabase-js versions
          let exchanged = false;
          try {
            const { data, error } = await (supabase as any).auth.exchangeCodeForSession({ authCode: code });
            if (error) throw error;
            if (data?.session?.user) {
              exchanged = true;
              console.log('[AuthGate] Session established (authCode), navigating to /');
              router.replace('/');
              return;
            }
          } catch (e: any) {
            console.warn('[AuthGate] exchange with authCode failed:', e?.message || e);
          }
          if (!exchanged) {
            try {
              const { data, error } = await (supabase as any).auth.exchangeCodeForSession({ code });
              if (error) throw error;
              if (data?.session?.user) {
                console.log('[AuthGate] Session established (code), navigating to /');
                router.replace('/');
                return;
              }
            } catch (e: any) {
              console.warn('[AuthGate] exchange with code failed:', e?.message || e);
              Alert.alert('Sign-in error', e?.message || 'Could not complete sign-in');
              return;
            }
          }
        }

        // No getSessionFromUrl in React Native client; rely on PKCE code exchange only.
      } catch (e: any) {
        console.warn('[AuthGate] Deep link handling failed', e?.message || e);
      }
    };
    const sub = Linking.addEventListener('url', urlListener);
    // Handle cold-start deep links (app launched via link)
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        console.log('[AuthGate] Initial URL detected:', initialUrl);
        urlListener({ url: initialUrl });
      }
    }).catch((e) => console.warn('[AuthGate] getInitialURL failed', e));
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
