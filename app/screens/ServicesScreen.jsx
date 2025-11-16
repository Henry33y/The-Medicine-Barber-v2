import supabase from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ServicesScreen() {
  const router = useRouter();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadServices() {
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .order('name', { ascending: true });
      if (fetchError) throw fetchError;
      setServices(data || []);
    } catch (e) {
      setError(e?.message || 'Failed to load services');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    loadServices();
  }

  function renderService({ item }) {
    const hasImage = !!item.image_url;
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          {hasImage ? (
            <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="cut" size={32} color="#FFD700" />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.serviceName}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.serviceDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaPrice}>GHS {item.price}</Text>
              <Text style={styles.metaDuration}>{item.duration} min</Text>
            </View>
          </View>
        </View>
        <Pressable
          style={styles.bookBtn}
          onPress={() => {
            console.log('[ServicesScreen] Booking service:', item.id);
            router.push({ pathname: '/book', params: { serviceId: item.id } });
          }}
        >
          <Text style={styles.bookBtnText}>Book Now</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Our Services</Text>
        {loading && !refreshing && <ActivityIndicator color="#FFD700" style={{ marginTop: 20 }} />}
        {error && !loading ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && (
          <FlatList
            data={services}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderService}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="cut-outline" size={48} color="#555" />
                <Text style={styles.emptyText}>No services available</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, padding: 20 },
  title: { color: '#FFD700', fontSize: 26, fontWeight: '800', marginBottom: 16 },
  listContent: { paddingBottom: 20 },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardContent: { flexDirection: 'row', marginBottom: 12 },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#222',
    marginRight: 14,
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardInfo: { flex: 1, justifyContent: 'center' },
  serviceName: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  serviceDesc: { color: '#bbb', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaPrice: { color: '#FFD700', fontSize: 14, fontWeight: '700' },
  metaDuration: { color: '#888', fontSize: 12 },
  bookBtn: {
    backgroundColor: '#B22222',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#B22222',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
  error: { color: '#ff6b6b', textAlign: 'center', marginTop: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#555', marginTop: 12, fontSize: 14 },
});

