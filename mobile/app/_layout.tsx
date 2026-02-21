import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/stores/auth';
import { colors } from '../src/constants/theme';

export default function RootLayout() {
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ title: 'Sign In', headerShown: false }} />
        <Stack.Screen name="(auth)/register" options={{ title: 'Create Account' }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="device-detail" options={{ title: 'Display Details' }} />
        <Stack.Screen name="content-detail" options={{ title: 'Content Details' }} />
        <Stack.Screen name="playlist-detail" options={{ title: 'Playlist Details' }} />
        <Stack.Screen name="upload" options={{ title: 'Upload Content', presentation: 'modal' }} />
      </Stack>
    </>
  );
}
