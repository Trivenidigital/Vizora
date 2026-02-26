import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Vizora',
  slug: 'vizora-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'vizora',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0E1A',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.vizora.companion',
    buildNumber: '1',
    infoPlist: {
      NSCameraUsageDescription:
        'Vizora needs camera access to scan QR codes on display screens for pairing.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0E1A',
    },
    package: 'com.vizora.companion',
    versionCode: 1,
    permissions: ['CAMERA'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission:
          'Vizora needs camera access to scan QR codes on display screens for pairing.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Vizora needs photo library access to upload content to your displays.',
        cameraPermission:
          'Vizora needs camera access to take photos for your displays.',
      },
    ],
  ],
  updates: {
    url: 'https://u.expo.dev/vizora-mobile',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    realtimeUrl: process.env.EXPO_PUBLIC_REALTIME_URL ?? 'http://localhost:3002',
    eas: {
      projectId: 'vizora-mobile',
    },
  },
});
