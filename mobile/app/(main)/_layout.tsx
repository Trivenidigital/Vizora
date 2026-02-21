import { Tabs } from 'expo-router';
import { colors, fontSize } from '../../src/constants/theme';

export default function MainTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Displays',
          tabBarIcon: ({ color }) => (
            <TabIcon label="📺" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          title: 'Content',
          tabBarIcon: ({ color }) => (
            <TabIcon label="📁" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: 'Playlists',
          tabBarIcon: ({ color }) => (
            <TabIcon label="📋" color={color} />
          ),
        }}
      />
      {/* Hide non-tab screens from tab bar */}
      <Tabs.Screen name="scan" options={{ href: null }} />
      <Tabs.Screen name="pair-confirm" options={{ href: null }} />
    </Tabs>
  );
}

import { Text } from 'react-native';

function TabIcon({ label }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}
