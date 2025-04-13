import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: [
        'express',
        'socket.io',
        'winston',
        'msw',
        'msw/node',
        'http',
        'path',
        '@vizora/common'
      ]
    },
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@vizora/common': resolve(__dirname, '../common/src')
    }
  },
  ssr: {
    target: 'node',
    format: 'esm'
  }
}); 