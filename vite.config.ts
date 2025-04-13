import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

// Function to create entry points and filter out problematic files
const createEntryPoints = () => {
  const entry = {
    index: path.resolve(__dirname, 'index.html'),
  };
  
  return entry;
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['qrcode.react'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      exclude: [/test/, /__test__/, /node_modules\/@vizora\/common\/.*\/test/],
      include: [],
    },
    rollupOptions: {
      external: [
        /test/,
        /__test__/,
        /@testing-library/,
        /vitest/,
        /\.test\./,
        /\.spec\./,
        /\/tests\//,
        './pages/QRCodeScreen.tsx', // Explicitly exclude this file
      ],
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/legacy/**',
      '**/__tests__/**',
      '../common/**/tests/**',
      '../common/**/__tests__/**',
      './src/tests/legacy/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/setup.ts',
      ],
    },
    testTimeout: 10000,
    pool: 'forks',
    isolate: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true
      }
    }
  }
}); 