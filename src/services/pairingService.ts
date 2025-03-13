import { io, Socket } from 'socket.io-client';

const VIZORA_TV_URL = 'http://localhost:3003';

export interface PairingResponse {
  success: boolean;
  error?: string;
  displayId?: string;
}

class PairingService {
  private socket: Socket | null = null;

  constructor() {
    this.socket = io(VIZORA_TV_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to VizoraTV server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from VizoraTV server');
    });
  }

  async pairWithDisplay(pairingCode: string): Promise<PairingResponse> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({
          success: false,
          error: 'Not connected to VizoraTV server'
        });
        return;
      }

      // Set up a one-time listener for the pairing response
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: 'Pairing request timed out'
        });
      }, 10000); // 10 second timeout

      this.socket.emit('pairing:request', { pairingCode }, (response: any) => {
        clearTimeout(timeout);
        
        if (response.success) {
          resolve({
            success: true,
            displayId: response.displayId
          });
        } else {
          resolve({
            success: false,
            error: response.error || 'Pairing failed'
          });
        }
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const pairingService = new PairingService();




