import supabase from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ManageServicesScreen() {
  const router = useRouter();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('services').select('*').order('name');
    setServices(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addService() {
    if (!name || !price || !duration) {
      Alert.alert('Missing', 'Name, price and duration are required');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('services').insert({ name, price: Number(price), duration: Number(duration) });
      if (error) throw error;
      setName(''); setPrice(''); setDuration('');
      await load();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not add service');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFD700" />
        </Pressable>
        <Text style={styles.title}>Manage Services</Text>
      </View>

      <View style={styles.formRow}>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#777" />
        <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Price" placeholderTextColor="#777" keyboardType="numeric" />
        <TextInput style={styles.input} value={duration} onChangeText={setDuration} placeholder="Duration (min)" placeholderTextColor="#777" keyboardType="numeric" />
        <Pressable style={[styles.addBtn, busy && { opacity: 0.6 }]} onPress={addService} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Add</Text>}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.svcName}>{item.name}</Text>
              <Text style={styles.svcMeta}>GHS {item.price} • {item.duration} min</Text>
            </View>
          )}
          contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222' },
  title: { color: '#FFD700', fontSize: 20, fontWeight: '800' },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  input: { flex: 1, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, padding: 10, color: '#fff' },
  addBtn: { backgroundColor: '#B22222', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#222', marginHorizontal: 16, marginBottom: 12 },
  svcName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  svcMeta: { color: '#9BA1A6', marginTop: 4 },
});
