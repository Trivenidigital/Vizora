import { io, Socket } from 'socket.io-client';

interface PairingSession {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'paired' | 'expired';
  deviceInfo?: any;
}

interface PairingResponse {
  success: boolean;
  session?: PairingSession;
  error?: string;
}

class PairingService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(session: PairingSession) => void>> = new Map();

  constructor() {
    this.connect();
  }

  private connect() {
    // Connect to the pairing server
    this.socket = io({
      path: '/pairing',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('Connected to pairing server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from pairing server');
    });

    this.socket.on('pairingUpdate', (session: PairingSession) => {
      this.notifyListeners(session);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }

  /**
   * Create a new pairing session
   */
  async createPairingSession(): Promise<PairingSession> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Not connected to pairing server'));
        return;
      }

      this.socket.emit('createPairingSession', {}, (response: PairingResponse) => {
        if (response.success && response.session) {
          resolve(response.session);
        } else {
          reject(new Error(response.error || 'Failed to create pairing session'));
        }
      });
    });
  }

  /**
   * Check the status of a pairing session
   */
  async checkPairingStatus(code: string): Promise<PairingSession> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Not connected to pairing server'));
        return;
      }

      this.socket.emit('checkPairingStatus', { code }, (response: PairingResponse) => {
        if (response.success && response.session) {
          resolve(response.session);
        } else {
          reject(new Error(response.error || 'Invalid or expired code'));
        }
      });
    });
  }

  /**
   * Subscribe to updates for a pairing session
   */
  subscribeToPairing(code: string, callback: (session: PairingSession) => void): () => void {
    if (!this.socket || !this.socket.connected) {
      console.error('Not connected to pairing server');
      return () => {};
    }

    // Add the listener
    if (!this.listeners.has(code)) {
      this.listeners.set(code, new Set());
      
      // Tell the server we're subscribing
      this.socket.emit('subscribeToPairing', { code });
    }
    
    this.listeners.get(code)?.add(callback);

    // Return unsubscribe function
    return () => {
      const codeListeners = this.listeners.get(code);
      if (codeListeners) {
        codeListeners.delete(callback);
        
        if (codeListeners.size === 0) {
          this.listeners.delete(code);
          
          // Tell the server we're unsubscribing
          this.socket?.emit('unsubscribeFromPairing', { code });
        }
      }
    };
  }

  /**
   * Pair a device with a session code
   */
  async pairDevice(code: string, deviceInfo: any): Promise<PairingSession> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Not connected to pairing server'));
        return;
      }

      this.socket.emit('pairDevice', { code, deviceInfo }, (response: PairingResponse) => {
        if (response.success && response.session) {
          resolve(response.session);
        } else {
          reject(new Error(response.error || 'Failed to pair device'));
        }
      });
    });
  }

  private notifyListeners(session: PairingSession) {
    const listeners = this.listeners.get(session.code);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(session);
        } catch (error) {
          console.error('Error in pairing listener:', error);
        }
      });
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }
}

// Create a singleton instance
const pairingService = new PairingService();

export default pairingService;
