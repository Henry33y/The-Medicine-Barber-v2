import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
// Admin tab gating can be added later when auth context is available

export default function TabLayout() {
  // const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#0b0b0b',
          borderTopColor: '#222',
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#9BA1A6',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: -2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'content-cut' : 'content-cut'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-appointments"
        options={{
          title: 'My Appointments',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
