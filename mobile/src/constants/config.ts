import Constants from 'expo-constants';

// API configuration — pull from app.json extra or fallback to defaults
const extra = Constants.expoConfig?.extra ?? {};

export const config = {
  apiUrl: extra.apiUrl ?? 'http://localhost:3000',
  realtimeUrl: extra.realtimeUrl ?? 'http://localhost:3002',
} as const;
