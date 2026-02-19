import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.vizora.display',
  appName: 'Vizora Display',
  webDir: 'dist',
  server: {
    // For development - connect to local server
    // url: 'http://YOUR_DEV_IP:3003',
    cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true, // Enable native HTTP handling
    },
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
    allowMixedContent: isDev, // Allow ws:// from https:// in development only
    captureInput: true,
    webContentsDebuggingEnabled: isDev, // Chrome DevTools debugging in development only
    backgroundColor: '#1a1a2e',
    buildOptions: {
      releaseType: 'APK',
    },
  },
};

export default config;
