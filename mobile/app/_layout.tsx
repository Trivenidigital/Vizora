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
        <Stack.Screen name="(main)/devices" options={{ title: 'Displays', headerShown: false }} />
        <Stack.Screen
          name="(main)/scan"
          options={{ title: 'Scan QR Code', presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="(main)/pair-confirm"
          options={{ title: 'Confirm Pairing', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
