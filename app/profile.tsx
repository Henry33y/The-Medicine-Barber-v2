import supabase from '@/lib/supabaseClient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id;
        if (!uid) return;
        const { data: prof } = await supabase.from('profiles').select('full_name, phone').eq('id', uid).single();
        if (active && prof) {
          setFullName(prof.full_name || '');
          setPhone(prof.phone || '');
        }
      } catch {}
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  async function save() {
    try {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) return;
      const { error } = await supabase.from('profiles').upsert({ id: uid, full_name: fullName.trim(), phone: phone.trim() }, { onConflict: 'id' });
      if (error) throw error;
      Alert.alert('Saved');
      router.back();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again later');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}> 
      <View style={styles.container}>
        <Text style={styles.title}>Edit Profile</Text>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
          placeholderTextColor="#888"
          style={styles.input}
        />
        <Text style={styles.label}>Phone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="e.g. +1234567890"
          placeholderTextColor="#888"
          style={styles.input}
        />
        <Pressable style={styles.saveBtn} onPress={save} disabled={loading || !fullName.trim()}>
          <Text style={styles.saveText}>{loading ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, padding: 20 },
  title: { color: '#FFD700', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  label: { color: '#bbb', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#111', borderColor: '#222', borderWidth: 1, borderRadius: 10, color: '#fff', padding: 12 },
  saveBtn: { marginTop: 20, backgroundColor: '#B22222', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '800' },
});
