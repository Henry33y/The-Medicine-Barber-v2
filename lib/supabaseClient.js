import { createClient } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';

// Environment variables (Expo: use EXPO_PUBLIC_ prefix or extra in app.json)
const extra = (Constants?.expoConfig?.extra) || (Constants?.manifest?.extra) || {};
const SUPABASE_URL =
	process.env.EXPO_PUBLIC_SUPABASE_URL ||
	extra.EXPO_PUBLIC_SUPABASE_URL ||
	process.env.SUPABASE_URL;
// Support both ANON_KEY and KEY variants
const SUPABASE_ANON_KEY =
	process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
	process.env.EXPO_PUBLIC_SUPABASE_KEY ||
	extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
	extra.EXPO_PUBLIC_SUPABASE_KEY ||
	process.env.SUPABASE_ANON_KEY ||
	process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.warn(
		'[supabaseClient] Missing Supabase credentials. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_KEY).'
	);
} else {
	// Avoid logging the key; only log URL for debugging.
	console.log('[supabaseClient] Initialized with URL:', SUPABASE_URL);
}

// Create client; enable session persistence & auto refresh.
const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
	},
});

export default supabase;

// Helper wrappers returning { data, error } consistently.
export async function signInWithGoogle() {
	// Uses PKCE flow in Expo environment (web or native).
	const isExpoGo = Constants?.appOwnership === 'expo';
	const scheme = Constants?.expoConfig?.scheme || 'medicinebarber';

	// Prefer AuthSession to compute the correct proxy URL for the current account
	const redirectTo = isExpoGo
		? makeRedirectUri({ path: 'auth', useProxy: true })
		: makeRedirectUri({ path: 'auth', useProxy: false, scheme, preferLocalhost: false });

	// Dev hint: warn if running in Expo Go without the proxy URL pattern
	if (isExpoGo) {
		console.log('[supabaseClient] OAuth redirect (Expo proxy):', redirectTo);
		console.log('[supabaseClient] Add this to Supabase → Auth → Redirect URLs');
	}

	console.log('[supabaseClient] Google OAuth redirectTo:', redirectTo, 'isExpoGo:', isExpoGo);
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo,
			skipBrowserRedirect: true,
			queryParams: {
				access_type: 'offline',
				prompt: 'consent',
			},
		},
	});
	if (error) {
		console.warn('[supabaseClient] Google OAuth error:', error.message, error);
	} else {
		console.log('[supabaseClient] Google OAuth launched. Data:', data);
	}
	return { data, error };
}

export async function signOut() {
	const { error } = await supabase.auth.signOut();
	return { data: !error, error };
}

export async function getSession() {
	const { data, error } = await supabase.auth.getSession();
	return { data, error };
}

