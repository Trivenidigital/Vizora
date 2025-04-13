import { EventEmitter } from '../utils/EventEmitter';

interface NetworkInfo {
  online: boolean;
  type?: string;
  downlink?: number;
  rtt?: number;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  saveData?: boolean;
}

/**
 * NetworkStatus monitors network connectivity and connection quality.
 * It emits events when network status changes.
 */
class NetworkStatus extends EventEmitter {
  private online: boolean = navigator.onLine;
  private connectionInfo: NetworkInfo = { online: navigator.onLine };
  private monitoringActive: boolean = false;
  private pollingIntervalId: number | null = null;
  private checkIntervalMs: number = 30000; // 30 seconds
  
  constructor() {
    super();
    
    this.initialize();
  }
  
  /**
   * Initialize network status monitoring
   */
  private initialize(): void {
    // Set up event listeners for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Initial check
    this.checkConnection();
    
    // Start monitoring if supported
    this.startMonitoring();
  }
  
  /**
   * Start monitoring network quality if supported
   */
  private startMonitoring(): void {
    if (this.monitoringActive) return;
    
    // Check for NetworkInformation API support
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      
      if (conn) {
        // Listen for connection changes
        conn.addEventListener('change', this.handleConnectionChange);
        
        // Get initial connection info
        this.updateConnectionInfo();
        
        this.monitoringActive = true;
        console.log('Network quality monitoring started');
      }
    }
    
    // Fallback to polling for browsers without NetworkInformation API
    if (!this.monitoringActive) {
      this.pollingIntervalId = window.setInterval(() => {
        this.checkConnection();
      }, this.checkIntervalMs);
      
      console.log('Network polling monitoring started');
      this.monitoringActive = true;
    }
  }
  
  /**
   * Stop monitoring network quality
   */
  stopMonitoring(): void {
    if (!this.monitoringActive) return;
    
    // Remove connection event listener if supported
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      
      if (conn) {
        conn.removeEventListener('change', this.handleConnectionChange);
      }
    }
    
    // Clear polling interval
    if (this.pollingIntervalId !== null) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    this.monitoringActive = false;
    console.log('Network monitoring stopped');
  }
  
  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    if (!this.online) {
      this.online = true;
      this.connectionInfo.online = true;
      
      console.log('Network connection restored');
      this.emit('online', this.connectionInfo);
      this.emit('statusChange', this.connectionInfo);
      
      // Perform a connection check to update other metrics
      this.checkConnection();
    }
  };
  
  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    if (this.online) {
      this.online = false;
      this.connectionInfo.online = false;
      
      console.log('Network connection lost');
      this.emit('offline', this.connectionInfo);
      this.emit('statusChange', this.connectionInfo);
    }
  };
  
  /**
   * Handle connection change event
   */
  private handleConnectionChange = (): void => {
    const oldInfo = { ...this.connectionInfo };
    this.updateConnectionInfo();
    
    // Check if there's a meaningful change in connection quality
    if (
      oldInfo.type !== this.connectionInfo.type ||
      oldInfo.effectiveType !== this.connectionInfo.effectiveType ||
      Math.abs((oldInfo.downlink || 0) - (this.connectionInfo.downlink || 0)) > 0.5
    ) {
      console.log('Network quality changed:', this.connectionInfo);
      this.emit('qualityChange', this.connectionInfo);
      this.emit('statusChange', this.connectionInfo);
    }
  };
  
  /**
   * Update connection info from NetworkInformation API
   */
  private updateConnectionInfo(): void {
    const conn = (navigator as any).connection;
    
    if (conn) {
      this.connectionInfo = {
        online: this.online,
        type: conn.type,
        downlink: conn.downlink,
        rtt: conn.rtt,
        effectiveType: conn.effectiveType,
        saveData: conn.saveData
      };
    }
  }
  
  /**
   * Check connection status and quality
   */
  private checkConnection(): void {
    // Update online status
    const wasOnline = this.online;
    this.online = navigator.onLine;
    
    // Update connection info if NetworkInformation API is available
    if ('connection' in navigator) {
      this.updateConnectionInfo();
    }
    
    // Emit events if online status changed
    if (wasOnline !== this.online) {
      if (this.online) {
        this.emit('online', this.connectionInfo);
      } else {
        this.emit('offline', this.connectionInfo);
      }
      
      this.emit('statusChange', this.connectionInfo);
    }
  }
  
  /**
   * Get current network status
   */
  getStatus(): NetworkInfo {
    return { ...this.connectionInfo };
  }
  
  /**
   * Check if the network is online
   */
  isOnline(): boolean {
    return this.online;
  }
  
  /**
   * Check if the network connection is good enough for streaming
   */
  isGoodForStreaming(): boolean {
    // Consider good if we have a 4g connection or downlink > 1.5 Mbps
    return (
      this.online &&
      (this.connectionInfo.effectiveType === '4g' || (this.connectionInfo.downlink || 0) > 1.5)
    );
  }
  
  /**
   * Estimate connection quality from 0 (poor) to 1 (excellent)
   */
  getConnectionQuality(): number {
    if (!this.online) return 0;
    
    // Base quality on effective type
    switch (this.connectionInfo.effectiveType) {
      case '4g':
        return 0.9;
      case '3g':
        return 0.6;
      case '2g':
        return 0.3;
      case 'slow-2g':
        return 0.1;
      default:
        // Fallback to downlink-based calculation
        const downlink = this.connectionInfo.downlink || 0;
        if (downlink > 5) return 1.0;
        if (downlink > 2) return 0.8;
        if (downlink > 1) return 0.6;
        if (downlink > 0.5) return 0.4;
        if (downlink > 0.1) return 0.2;
        return 0.1;
    }
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopMonitoring();
    
    // Remove event listeners
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

// Export singleton instance
export const networkStatus = new NetworkStatus(); 