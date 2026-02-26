import Constants from 'expo-constants';

// API configuration — pull from env vars, then app.json extra, then fallback to defaults
const extra = Constants.expoConfig?.extra ?? {};

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:3000',
  realtimeUrl: process.env.EXPO_PUBLIC_REALTIME_URL ?? extra.realtimeUrl ?? 'http://localhost:3002',
} as const;
