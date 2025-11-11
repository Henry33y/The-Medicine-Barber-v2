import { router } from 'expo-router';
import { useEffect } from 'react';

// Legacy route shim: if this path is ever reached, redirect to the new top-level /booking
export default function LegacyBookingTab() {
  useEffect(() => {
    router.replace('/booking');
  }, []);
  return null;
}
