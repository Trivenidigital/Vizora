import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000, // Explicitly set client port to 3000
    proxy: {
      '/network-scanner': {
        target: 'http://localhost:3002',
        ws: true
      },
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true
      },
      '/pairing': {
        target: 'http://localhost:3002',
        ws: true
      },
      '/api/pairing': {
        target: 'http://localhost:3002',
        ws: true
      },
      '/api/content': {
        target: 'http://localhost:3003',
        ws: true
      }
    },
    headers: {
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-eval' 'unsafe-inline';
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: blob:;
        connect-src 'self' ws: wss: http://localhost:3002 http://localhost:3003;
        font-src 'self';
        object-src 'none';
        media-src 'self';
        frame-src 'none';
        base-uri 'self';
        form-action 'self';
      `.replace(/\s+/g, ' ').trim()
    }
  }
})
