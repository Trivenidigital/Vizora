import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vizora.display',
  appName: 'Vizora Display',
  webDir: 'dist',
  server: {
    // For development - connect to local server
    // url: 'http://YOUR_DEV_IP:3003',
    // cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1a1a2e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#6366f1',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a2e',
    },
  },
  android: {
    // Android TV specific configurations
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true, // Disable in production
    backgroundColor: '#1a1a2e',
    buildOptions: {
      releaseType: 'APK',
    },
  },
};

export default config;
