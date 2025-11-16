import { router } from 'expo-router';
import { useEffect } from 'react';

// Redirect legacy /booking to /book to avoid tabs route collisions
export default function LegacyBookingRoute() {
  useEffect(() => {
    router.replace('/book');
  }, []);
  return null;
}
