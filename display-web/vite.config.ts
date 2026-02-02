import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Generate single file for easy deployment
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 3003,
    host: true, // Allow external connections for TV testing
  },
  preview: {
    port: 3003,
    host: true,
  },
});
