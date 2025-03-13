import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000, // Explicitly set client port to 3000
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001', // Point to server port 3001
        ws: true
      },
      '/pairing': {
        target: 'http://localhost:3001', // Point to server port 3001
        ws: true
      }
    }
  }
})
