import supabase, { signInWithGoogle } from '@/lib/supabaseClient';
import { AntDesign } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    ImageBackground,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
	const router = useRouter();

	// Toggle to show/hide Google sign-in button without removing logic
	const SHOW_GOOGLE_SIGNIN = true;
	React.useEffect(() => {
		// Ensure AuthSession completes on return
		WebBrowser.maybeCompleteAuthSession();
	}, []);

	const [mode, setMode] = useState('login'); // 'login' | 'signup'
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	function validate() {
		if (!email || !password) return 'Email and password are required';
		if (!emailRegex.test(email)) return 'Please enter a valid email address';
		if (password.length < 6) return 'Password should be at least 6 characters';
		return '';
	}

	async function handleLogin() {
		const msg = validate();
		if (msg) return setError(msg);
		setError('');
		setLoading(true);
		try {
			const { data, error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) throw error;
			if (data?.session?.user) router.replace('/');
		} catch (e) {
			setError(e.message || 'Login failed');
		} finally {
			setLoading(false);
		}
	}

	async function handleSignup() {
		const msg = validate();
		if (msg) return setError(msg);
		setError('');
		setLoading(true);
			try {
				// For email confirmations, ensure the verification link returns to our app, not Site URL
								const isExpoGo = Constants?.appOwnership === 'expo';
								const scheme = Constants?.expoConfig?.scheme || 'medicinebarber';
								const emailRedirectTo = isExpoGo
									? makeRedirectUri({ path: 'auth', useProxy: true })
									: makeRedirectUri({ path: 'auth', useProxy: false, scheme, preferLocalhost: false });
								if (isExpoGo) {
									if (!String(emailRedirectTo).startsWith('https://auth.expo.io/')) {
										console.warn('[AuthScreen] Warning: Email redirect is not using Expo proxy:', emailRedirectTo);
									} else {
										console.log('[AuthScreen] Add this URL in Supabase → Auth → Redirect URLs:', emailRedirectTo);
									}
								}
				const { data, error } = await supabase.auth.signUp({
					email,
					password,
					options: { emailRedirectTo },
				});
			if (error) throw error;
			if (data?.user) router.replace('/');
		} catch (e) {
			setError(e.message || 'Signup failed');
		} finally {
			setLoading(false);
		}
	}

	async function handleGoogle() {
		setError('');
		setLoading(true);
		try {
				console.log('[AuthScreen] Starting Google sign-in');
				const { data, error } = await signInWithGoogle();
				console.log('[AuthScreen] Google sign-in result:', { data, error });
				if (error) throw error;
				// On Expo, supabase-js may not open the browser automatically; open it explicitly.
												if (data?.url) {
														const isExpoGo = Constants?.appOwnership === 'expo';
														const scheme = Constants?.expoConfig?.scheme || 'medicinebarber';
														const returnUrl = isExpoGo
															? makeRedirectUri({ path: 'auth', useProxy: true })
															: makeRedirectUri({ path: 'auth', useProxy: false, scheme, preferLocalhost: false });
														if (isExpoGo) {
															console.log('[AuthScreen] OAuth returnUrl (Expo proxy):', returnUrl);
															console.log('[AuthScreen] Add this to Supabase → Auth → Redirect URLs');
														}
							console.log('[AuthScreen] Opening OAuth browser. authUrl:', data.url, 'returnUrl:', returnUrl);
														const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
														console.log('[AuthScreen] AuthSession result:', JSON.stringify(result));
														if (result.type === 'success' && result.url) {
															const extract = (u, key) => {
																const qIndex = u.indexOf('?');
																const hIndex = u.indexOf('#');
																const pick = (seg) => {
																	if (!seg) return null;
																	const params = seg.split('&');
																	for (const p of params) {
																		const [k, v] = p.split('=');
																		if (k === key) return decodeURIComponent(v || '');
																	}
																	return null;
																};
																return pick(qIndex !== -1 ? u.slice(qIndex + 1, hIndex !== -1 ? hIndex : undefined) : undefined)
																	|| pick(hIndex !== -1 ? u.slice(hIndex + 1) : undefined);
															};
															  console.log('[AuthScreen] Returned URL:', result.url);
															  const errorDescription = extract(result.url, 'error_description');
															if (errorDescription) {
																console.warn('[AuthScreen] OAuth error:', errorDescription);
																throw new Error(decodeURIComponent(errorDescription));
															}
															const code = extract(result.url, 'code');
															if (!code) {
																console.warn('[AuthScreen] No code param found in return URL');
															}
															if (code) {
																console.log('[AuthScreen] Exchanging code for session');
																// Try both signatures for compatibility
																try {
																	const { data: ex1, error: exErr1 } = await (supabase).auth.exchangeCodeForSession({ authCode: code });
																	if (exErr1) throw exErr1;
																	if (ex1?.session?.user) {
																		router.replace('/');
																		return;
																	}
																} catch (e) {
																	console.warn('[AuthScreen] exchange (authCode) failed:', e?.message || e);
																}
																try {
																	const { data: ex2, error: exErr2 } = await (supabase).auth.exchangeCodeForSession({ code });
																	if (exErr2) throw exErr2;
																	if (ex2?.session?.user) {
																		router.replace('/');
																		return;
																	}
																} catch (e) {
																	console.warn('[AuthScreen] exchange (code) failed:', e?.message || e);
																	throw e;
																}
															}
														}
						}
			// On native, user completes flow in browser; session listener should handle redirect.
		} catch (e) {
			setError(e.message || 'Google sign-in failed');
				console.warn('[AuthScreen] Google sign-in failed:', e);
		} finally {
			setLoading(false);
		}
	}

		async function handleGuest() {
			setError('');
			setLoading(true);
			const guestId = 'guest-' + Math.random().toString(36).slice(2, 10);
			// Lazy attempt to store guest id if AsyncStorage installed; swallow errors silently.
				try {
					// Dynamic require; avoid static resolution to keep this optional.
					const AsyncStorage = require('@react-native-async-storage' + '/async-storage').default;
				await AsyncStorage.setItem('guest_id', guestId);
			} catch (_err) {
				// Ignore if not available
			}
			router.replace('/');
			setLoading(false);
		}

	const onSubmit = mode === 'login' ? handleLogin : handleSignup;

	return (
		<ImageBackground
			source={require('@/assets/images/partial-react-logo.png')}
			imageStyle={{ opacity: 0.06 }}
			style={styles.bg}
		>
			<View style={styles.overlay} />
			<View style={styles.container}>
				<Text style={styles.title}>The Medicine Barber</Text>
				<Text style={styles.subtitle}>Look Sharp. Feel Sharp.</Text>

				{/* Toggle */}
				<View style={styles.toggleRow}>
					<Pressable
						onPress={() => setMode('login')}
						style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
					>
						<Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Login</Text>
					</Pressable>
					<Pressable
						onPress={() => setMode('signup')}
						style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
					>
						<Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>Sign Up</Text>
					</Pressable>
				</View>

				{/* Form */}
				<TextInput
					placeholder="Email"
					placeholderTextColor="#aaa"
					keyboardType="email-address"
					autoCapitalize="none"
					style={styles.input}
					value={email}
					onChangeText={setEmail}
				/>
				<TextInput
					placeholder="Password"
					placeholderTextColor="#aaa"
					secureTextEntry
					style={styles.input}
					value={password}
					onChangeText={setPassword}
				/>
				{!!error && <Text style={styles.error}>{error}</Text>}

				<Pressable style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
					{loading ? (
						<ActivityIndicator color="#fff" />)
						: (
						<Text style={styles.primaryBtnText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
					)}
				</Pressable>

				{SHOW_GOOGLE_SIGNIN && (
					<Pressable style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
						<AntDesign name="google" size={18} color="#000" style={{ marginRight: 8 }} />
						<Text style={styles.googleBtnText}>Sign in with Google</Text>
					</Pressable>
				)}

				<Pressable style={styles.guestBtn} onPress={handleGuest} disabled={loading}>
					<Text style={styles.guestBtnText}>Continue as Guest</Text>
				</Pressable>
			</View>
		</ImageBackground>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: '#000' },
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.85)',
	},
	container: { flex: 1, padding: 24, justifyContent: 'center' },
	title: { color: '#FFD700', fontSize: 28, fontWeight: '800', textAlign: 'center' },
	subtitle: { color: '#fff', textAlign: 'center', marginBottom: 24, marginTop: 6 },
	toggleRow: {
		flexDirection: 'row',
		backgroundColor: '#111',
		borderRadius: 10,
		padding: 4,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: '#222',
	},
	toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
	toggleBtnActive: { backgroundColor: '#B22222' },
	toggleText: { color: '#bbb', fontWeight: '600' },
	toggleTextActive: { color: '#fff' },
	input: {
		backgroundColor: '#111',
		borderWidth: 1,
		borderColor: '#333',
		borderRadius: 10,
		padding: 12,
		color: '#fff',
		marginBottom: 12,
	},
	primaryBtn: {
		backgroundColor: '#B22222',
		padding: 14,
		borderRadius: 10,
		alignItems: 'center',
		marginTop: 6,
	},
	primaryBtnText: { color: '#fff', fontWeight: '700' },
	googleBtn: {
		backgroundColor: '#fff',
		padding: 12,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		flexDirection: 'row',
		marginTop: 12,
	},
	googleBtnText: { color: '#000', fontWeight: '700' },
	guestBtn: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 16 },
	guestBtnText: { color: '#FFD700', fontWeight: '600' },
	error: { color: '#ff6b6b', marginTop: 6, marginBottom: 6 },
});

