import { io, Socket } from 'socket.io-client';
import QRCode from 'qrcode';

export interface PairingSession {
  id: string;
  status: 'pending' | 'paired' | 'expired';
  pairingCode: string;
  deviceName?: string;
  deviceIP?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface PairingOptions {
  useQRCode?: boolean;
  manualIP?: string;
}

class PairingService {
  private socket: Socket | null = null;
  private currentSession: PairingSession | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    this.socket = io('http://localhost:3002');
    
    this.socket.on('connect', () => {
      console.log('Connected to pairing server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from pairing server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  public async startPairing(options: PairingOptions = {}): Promise<{ qrCode: string | null; pairingCode: string }> {
    if (!this.socket) {
      throw new Error('Not connected to pairing server');
    }

    try {
      const response = await fetch('http://localhost:3002/api/pairing/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error('Failed to start pairing session');
      }

      const session = await response.json();
      this.currentSession = session;

      let qrCode: string | null = null;
      if (options.useQRCode) {
        const qrData = JSON.stringify({
          ip: options.manualIP || 'auto-discover',
          code: session.pairingCode,
        });
        qrCode = await QRCode.toDataURL(qrData);
      }

      return { qrCode, pairingCode: session.pairingCode };
    } catch (error) {
      throw new Error('Failed to start pairing: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public async checkPairingStatus(): Promise<PairingSession> {
    if (!this.currentSession) {
      throw new Error('No active pairing session');
    }

    try {
      const response = await fetch(`http://localhost:3002/api/pairing/status/${this.currentSession.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to check pairing status');
      }

      const session = await response.json();
      this.currentSession = session;
      return session;
    } catch (error) {
      throw new Error('Failed to check pairing status: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public async pairDevice(code: string): Promise<PairingSession> {
    if (!this.currentSession) {
      throw new Error('No active pairing session');
    }

    try {
      const response = await fetch('http://localhost:3002/api/pairing/pair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.currentSession.id,
          code,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to pair device');
      }

      const session = await response.json();
      this.currentSession = session;
      return session;
    } catch (error) {
      throw new Error('Failed to pair device: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentSession = null;
  }
}

export default new PairingService();



