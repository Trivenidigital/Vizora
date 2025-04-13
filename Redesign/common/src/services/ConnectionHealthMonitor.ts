/**
 * ConnectionHealthMonitor
 * 
 * Monitors connection health metrics like latency, stability, and transport quality.
 * Can be attached to any ConnectionManager instance.
 */

import { ConnectionManager } from './ConnectionManager';
import { emitDiagnosticEvent, ConnectionDiagnosticEventType } from '../devtools/ConnectionStateObservable';

export interface ConnectionHealthMetrics {
  roundTripMs: number | null;
  stability: 'good' | 'fair' | 'poor' | 'lost';
  packetLoss: number; // percentage of lost pings
  serverTimeOffset: number | null; // time offset between client and server in ms
  transport: string;
  lastUpdated: number;
  averageLatency: number | null;
  latencyHistory: number[];
  jitter: number | null; // variation in latency
}

export interface ConnectionHealthConfig {
  pingInterval: number; // ms between pings
  stabilityThresholds: {
    good: number; // max ms for 'good' stability
    fair: number; // max ms for 'fair' stability
    poor: number; // max ms for 'poor' stability
  };
  historySize: number; // number of latency measurements to keep
  enabled: boolean;
}

const DEFAULT_CONFIG: ConnectionHealthConfig = {
  pingInterval: 10000, // 10 seconds
  stabilityThresholds: {
    good: 100, // 0-100ms is good
    fair: 200, // 101-200ms is fair
    poor: 500, // 201-500ms is poor, >500ms is lost
  },
  historySize: 20, // keep last 20 measurements
  enabled: true
};

export class ConnectionHealthMonitor {
  private manager: ConnectionManager;
  private config: ConnectionHealthConfig;
  private pingInterval: any;
  private metrics: ConnectionHealthMetrics;
  private pingCount: number = 0;
  private successfulPings: number = 0;
  private lastServerTime: number | null = null;
  
  constructor(manager: ConnectionManager, config: Partial<ConnectionHealthConfig> = {}) {
    this.manager = manager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize metrics
    this.metrics = {
      roundTripMs: null,
      stability: 'lost',
      packetLoss: 0,
      serverTimeOffset: null,
      transport: 'unknown',
      lastUpdated: Date.now(),
      averageLatency: null,
      latencyHistory: [],
      jitter: null
    };
    
    if (this.config.enabled) {
      this.start();
    }
  }
  
  /**
   * Start monitoring connection health
   */
  public start(): void {
    if (this.pingInterval) {
      // Already started
      return;
    }
    
    // Set up interval for regular pings
    this.pingInterval = setInterval(() => {
      this.measureLatency();
    }, this.config.pingInterval);
    
    // Do an initial measurement
    setTimeout(() => {
      this.measureLatency();
    }, 100);
    
    // Update transport type when connected
    this.manager.on('connect', () => {
      setTimeout(() => {
        this.updateTransportInfo();
      }, 500); // Give time for transport to upgrade
    });
    
    // Also track transport upgrades
    const socket = this.manager.getSocket();
    if (socket?.io) {
      try {
        // @ts-ignore: Internal Socket.IO API
        socket.io.on('upgrade', () => {
          setTimeout(() => {
            this.updateTransportInfo();
          }, 100);
        });
      } catch (e) {
        // Ignore errors if io property doesn't exist
      }
    }
  }
  
  /**
   * Stop monitoring connection health
   */
  public stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Get current health metrics
   */
  public getMetrics(): ConnectionHealthMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Update transport information
   */
  private updateTransportInfo(): void {
    const socket = this.manager.getSocket();
    if (!socket) {
      this.metrics.transport = 'disconnected';
      return;
    }
    
    try {
      // @ts-ignore: Internal Socket.IO API
      const transport = socket.io?.engine?.transport?.name;
      if (transport) {
        this.metrics.transport = transport;
      }
    } catch (e) {
      // Ignore errors accessing transport
    }
  }
  
  /**
   * Measure current latency to the server
   * @returns Promise resolving to the measured latency in ms, or null if failed
   */
  public async measureLatency(): Promise<number | null> {
    const socket = this.manager.getSocket();
    if (!socket || !this.manager.isConnected()) {
      // Update metrics to reflect disconnected state
      this.metrics.roundTripMs = null;
      this.metrics.stability = 'lost';
      this.metrics.lastUpdated = Date.now();
      return null;
    }
    
    this.pingCount++;
    
    try {
      // Send ping with timestamp
      const startTime = Date.now();
      const result = await new Promise<number | null>((resolve) => {
        // @ts-ignore: Internal Socket.IO API
        socket.emit('ping', { clientTime: startTime }, (response: any) => {
          const endTime = Date.now();
          const roundTrip = endTime - startTime;
          
          // If server returned its timestamp, calculate offset
          if (response && response.serverTime) {
            this.lastServerTime = response.serverTime;
            this.metrics.serverTimeOffset = response.serverTime - startTime - (roundTrip / 2);
          }
          
          resolve(roundTrip);
        });
        
        // Set a timeout for when ping fails
        setTimeout(() => {
          resolve(null);
        }, 5000);
      });
      
      // If ping was successful
      if (result !== null) {
        this.successfulPings++;
        
        // Update metrics
        this.metrics.roundTripMs = result;
        this.metrics.latencyHistory.push(result);
        
        // Keep history size limited
        if (this.metrics.latencyHistory.length > this.config.historySize) {
          this.metrics.latencyHistory.shift();
        }
        
        // Calculate average latency
        if (this.metrics.latencyHistory.length > 0) {
          this.metrics.averageLatency = this.metrics.latencyHistory.reduce((sum, val) => sum + val, 0) / 
                                        this.metrics.latencyHistory.length;
          
          // Calculate jitter (variation in latency)
          if (this.metrics.latencyHistory.length > 1) {
            let totalVariation = 0;
            for (let i = 1; i < this.metrics.latencyHistory.length; i++) {
              totalVariation += Math.abs(this.metrics.latencyHistory[i] - this.metrics.latencyHistory[i-1]);
            }
            this.metrics.jitter = totalVariation / (this.metrics.latencyHistory.length - 1);
          }
        }
        
        // Calculate packet loss
        this.metrics.packetLoss = (this.pingCount - this.successfulPings) / this.pingCount * 100;
        
        // Determine stability based on latency
        if (result <= this.config.stabilityThresholds.good) {
          this.metrics.stability = 'good';
        } else if (result <= this.config.stabilityThresholds.fair) {
          this.metrics.stability = 'fair';
        } else if (result <= this.config.stabilityThresholds.poor) {
          this.metrics.stability = 'poor';
        } else {
          this.metrics.stability = 'lost';
        }
        
        // Update last updated time
        this.metrics.lastUpdated = Date.now();
        
        // Update transport info
        this.updateTransportInfo();
        
        // Emit diagnostic event
        emitDiagnosticEvent({
          type: ConnectionDiagnosticEventType.CONNECTED,
          payload: {
            latency: result,
            stability: this.metrics.stability,
            transport: this.metrics.transport
          },
          timestamp: Date.now()
        });
        
        return result;
      } else {
        // Failed ping
        this.metrics.stability = 'lost';
        this.metrics.packetLoss = (this.pingCount - this.successfulPings) / this.pingCount * 100;
        this.metrics.lastUpdated = Date.now();
        return null;
      }
    } catch (e) {
      console.error('Error measuring latency:', e);
      return null;
    }
  }
  
  /**
   * Calculate health score based on all metrics
   * @returns A health score from 0-100
   */
  public getHealthScore(): number {
    if (!this.manager.isConnected() || this.metrics.roundTripMs === null) {
      return 0;
    }
    
    // Base score on stability
    let score: number;
    switch (this.metrics.stability) {
      case 'good': score = 90; break;
      case 'fair': score = 70; break;
      case 'poor': score = 40; break;
      case 'lost': score = 10; break;
      default: score = 0;
    }
    
    // Reduce for packet loss
    score -= this.metrics.packetLoss * 0.5;
    
    // Reduce for high jitter if present
    if (this.metrics.jitter !== null && this.metrics.jitter > 50) {
      score -= Math.min(20, this.metrics.jitter / 10);
    }
    
    // Bonus for websocket transport
    if (this.metrics.transport === 'websocket') {
      score += 5;
    }
    
    // Ensure within 0-100 range
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Reset health metrics for a new connection
   */
  public reset(): void {
    this.pingCount = 0;
    this.successfulPings = 0;
    this.metrics = {
      roundTripMs: null,
      stability: 'lost',
      packetLoss: 0,
      serverTimeOffset: null,
      transport: 'unknown',
      lastUpdated: Date.now(),
      averageLatency: null,
      latencyHistory: [],
      jitter: null
    };
  }
}

// Singleton instance
let defaultHealthMonitor: ConnectionHealthMonitor | null = null;

/**
 * Get the default health monitor instance
 */
export function getConnectionHealthMonitor(manager?: ConnectionManager): ConnectionHealthMonitor {
  if (!defaultHealthMonitor && manager) {
    defaultHealthMonitor = new ConnectionHealthMonitor(manager);
  }
  
  if (!defaultHealthMonitor) {
    throw new Error('ConnectionHealthMonitor not initialized. Provide a ConnectionManager instance first.');
  }
  
  return defaultHealthMonitor;
}

/**
 * Set the default health monitor instance
 */
export function setConnectionHealthMonitor(monitor: ConnectionHealthMonitor): void {
  defaultHealthMonitor = monitor;
} 