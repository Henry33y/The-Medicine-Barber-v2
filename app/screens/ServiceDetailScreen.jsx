import supabase from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ServiceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const serviceId = Array.isArray(params.serviceId) ? params.serviceId[0] : params.serviceId;

  const [service, setService] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!serviceId) {
        setLoading(false);
        return;
      }
      try {
        setError('');
        // Fetch service details
        const { data: svcData, error: svcError } = await supabase
          .from('services')
          .select('*')
          .eq('id', serviceId)
          .single();
        if (svcError) throw svcError;
        if (active) setService(svcData);

        // Fetch reviews (if appointments table has rating/review fields)
        const { data: reviewData } = await supabase
          .from('appointments')
          .select('id, rating, review, created_at, profiles(full_name)')
          .eq('service_id', serviceId)
          .not('rating', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5);
        if (active) setReviews(reviewData || []);
      } catch (e) {
        if (active) setError(e?.message || 'Failed to load service details');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [serviceId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#FFD700" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (error || !service) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.error}>{error || 'Service not found'}</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasImage = !!service.image_url;
  const addOns = service.add_ons || []; // Assuming add_ons is a JSON array in DB

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </Pressable>

        {/* Hero Image */}
        {hasImage ? (
          <Image source={{ uri: service.image_url }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Ionicons name="cut" size={64} color="#FFD700" />
          </View>
        )}

        {/* Service Info */}
        <View style={styles.infoSection}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="cash-outline" size={20} color="#FFD700" />
              <Text style={styles.metaText}>GHS {service.price}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={20} color="#FFD700" />
              <Text style={styles.metaText}>{service.duration} min</Text>
            </View>
          </View>

          {service.description ? (
            <View style={styles.descCard}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descText}>{service.description}</Text>
            </View>
          ) : null}

          {/* Add-ons */}
          {addOns.length > 0 && (
            <View style={styles.addOnsCard}>
              <Text style={styles.sectionTitle}>Common Add-Ons</Text>
              {addOns.map((addon, idx) => (
                <View key={idx} style={styles.addonItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFD700" />
                  <Text style={styles.addonText}>{addon}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={styles.reviewsCard}>
              <Text style={styles.sectionTitle}>Recent Reviews</Text>
              {reviews.map((rev) => (
                <View key={rev.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewAuthor}>
                      {rev.profiles?.full_name || 'Anonymous'}
                    </Text>
                    <View style={styles.ratingRow}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < rev.rating ? 'star' : 'star-outline'}
                          size={14}
                          color="#FFD700"
                        />
                      ))}
                    </View>
                  </View>
                  {rev.review ? <Text style={styles.reviewText}>{rev.review}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <Pressable
            style={styles.ctaBtn}
            onPress={() => {
              console.log('[ServiceDetail] Navigate to booking with service:', serviceId);
              router.push({ pathname: '/booking', params: { serviceId } });
            }}
          >
            <Text style={styles.ctaBtnText}>Choose Time</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scrollContent: { paddingBottom: 40 },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: 280,
    backgroundColor: '#111',
  },
  heroPlaceholder: {
    width: '100%',
    height: 280,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  infoSection: { padding: 20 },
  serviceName: { color: '#FFD700', fontSize: 28, fontWeight: '800', marginBottom: 12 },
  metaRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  descCard: {
    backgroundColor: '#111',
    padding: 18,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionTitle: { color: '#FFD700', fontSize: 17, fontWeight: '700', marginBottom: 10 },
  descText: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  addOnsCard: {
    backgroundColor: '#111',
    padding: 18,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  addonItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  addonText: { color: '#fff', fontSize: 14 },
  reviewsCard: {
    backgroundColor: '#111',
    padding: 18,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  reviewItem: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewAuthor: { color: '#fff', fontSize: 14, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', gap: 2 },
  reviewText: { color: '#bbb', fontSize: 13, lineHeight: 18 },
  ctaSection: { paddingHorizontal: 20 },
  ctaBtn: {
    backgroundColor: '#B22222',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#B22222',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },
  error: { color: '#ff6b6b', textAlign: 'center', marginBottom: 20, fontSize: 14 },
  backBtn: {
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  backBtnText: { color: '#FFD700', fontWeight: '700' },
});