import { router } from 'expo-router';
import { useEffect } from 'react';

// Hide this route from tabs and deep links; keep as a silent redirect if reached
export const unstable_settings = { href: null };

export default function LegacyBookingTab() {
  useEffect(() => {
    router.replace('/booking');
  }, []);
  return null;
}
