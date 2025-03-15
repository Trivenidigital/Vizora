import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { initializeWebSocketServer } from './src/server/websocket';
import type { ViteDevServer } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'websocket-server',
      configureServer(server: ViteDevServer) {
        if (!server.httpServer) return;
        
        server.httpServer.once('listening', () => {
          initializeWebSocketServer(server.httpServer!);
        });
      }
    }
  ],
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0', // This will properly expose the network
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3000',
        ws: true,
        secure: false,
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3001,
    strictPort: true,
    host: true
  }
}); 