import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Generate single file for Capacitor
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 3003,
    host: true,
  },
  preview: {
    port: 3003,
    host: true,
  },
  define: {
    // Environment variables for production
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://api.vizora.io'),
    'import.meta.env.VITE_REALTIME_URL': JSON.stringify(process.env.VITE_REALTIME_URL || 'wss://realtime.vizora.io'),
    'import.meta.env.VITE_DASHBOARD_URL': JSON.stringify(process.env.VITE_DASHBOARD_URL || 'https://dashboard.vizora.io'),
  },
});
