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
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Map<string, Set<(session: PairingSession) => void>> = new Map();
  private apiBaseUrl: string;

  constructor() {
    // Determine the API base URL based on environment
    this.apiBaseUrl = import.meta.env.PROD 
      ? window.location.origin 
      : '';
  }

  /**
   * Create a new pairing session
   */
  async createPairingSession(): Promise<PairingSession> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/pairing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'createSession' }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: PairingResponse = await response.json();
      
      if (data.success && data.session) {
        return data.session;
      } else {
        throw new Error(data.error || 'Failed to create pairing session');
      }
    } catch (error) {
      console.error('Error creating pairing session:', error);
      throw new Error('Failed to create pairing session. Please try again.');
    }
  }

  /**
   * Check the status of a pairing session
   */
  async checkPairingStatus(code: string): Promise<PairingSession> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/pairing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'checkStatus', code }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: PairingResponse = await response.json();
      
      if (data.success && data.session) {
        return data.session;
      } else {
        throw new Error(data.error || 'Invalid or expired code');
      }
    } catch (error) {
      console.error('Error checking pairing status:', error);
      throw new Error('Failed to check pairing status. Please try again.');
    }
  }

  /**
   * Subscribe to updates for a pairing session
   * Uses polling since WebSockets aren't available in serverless
   */
  subscribeToPairing(code: string, callback: (session: PairingSession) => void): () => void {
    // Add the listener
    if (!this.listeners.has(code)) {
      this.listeners.set(code, new Set());
      
      // Start polling for updates
      const interval = setInterval(async () => {
        try {
          const session = await this.checkPairingStatus(code);
          this.notifyListeners(session);
          
          // If session is paired or expired, stop polling
          if (session.status === 'paired' || session.status === 'expired') {
            this.unsubscribeFromPairing(code);
          }
        } catch (error) {
          console.error('Error polling pairing status:', error);
        }
      }, 3000); // Poll every 3 seconds
      
      this.pollingIntervals.set(code, interval);
    }
    
    this.listeners.get(code)?.add(callback);

    // Return unsubscribe function
    return () => {
      this.unsubscribeFromPairing(code, callback);
    };
  }

  /**
   * Unsubscribe from pairing updates
   */
  private unsubscribeFromPairing(code: string, callback?: (session: PairingSession) => void) {
    if (callback) {
      // Remove specific callback
      const codeListeners = this.listeners.get(code);
      if (codeListeners) {
        codeListeners.delete(callback);
        
        if (codeListeners.size === 0) {
          this.listeners.delete(code);
          this.stopPolling(code);
        }
      }
    } else {
      // Remove all callbacks for this code
      this.listeners.delete(code);
      this.stopPolling(code);
    }
  }

  /**
   * Stop polling for a specific code
   */
  private stopPolling(code: string) {
    const interval = this.pollingIntervals.get(code);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(code);
    }
  }

  /**
   * Pair a device with a session code
   */
  async pairDevice(code: string, deviceInfo: any): Promise<PairingSession> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/pairing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'pairDevice', code, deviceInfo }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: PairingResponse = await response.json();
      
      if (data.success && data.session) {
        return data.session;
      } else {
        throw new Error(data.error || 'Failed to pair device');
      }
    } catch (error) {
      console.error('Error pairing device:', error);
      throw new Error('Failed to pair device. Please try again.');
    }
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
    // Clear all polling intervals
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals.clear();
    this.listeners.clear();
  }
}

// Create a singleton instance
const pairingService = new PairingService();

export default pairingService;
