// import { EventEmitter } from 'events';
import EventEmitter from 'eventemitter3';
import { MemoryBankManager } from './MemoryBankManager';

/**
 * Error report interface
 */
export interface ErrorReport {
  /**
   * Unique error key for deduplication
   */
  errorKey: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error stack trace
   */
  stack?: string;
  
  /**
   * Component where the error occurred
   */
  component?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
  
  /**
   * Timestamp when the error occurred
   */
  timestamp: number;
  
  /**
   * Device ID if available
   */
  deviceId?: string;
  
  /**
   * Application version
   */
  appVersion?: string;
  
  /**
   * Count of consecutive occurrences
   */
  count: number;
  
  /**
   * Whether this is a fatal error
   */
  isFatal: boolean;
  
  /**
   * User action that triggered the error, if known
   */
  userAction?: string;
  
  /**
   * Context data about the device/user state
   */
  context?: {
    /**
     * Device connection status
     */
    connected: boolean;
    
    /**
     * Pairing status
     */
    paired: boolean;
    
    /**
     * Browser/platform info
     */
    userAgent: string;
    
    /**
     * Screen resolution
     */
    resolution?: string;
    
    /**
     * Memory usage if available
     */
    memoryUsage?: Record<string, number>;
  };
}

/**
 * Error reporting options
 */
export interface ErrorReportingOptions {
  /**
   * API endpoint for reporting errors
   */
  apiEndpoint?: string;
  
  /**
   * Whether to automatically collect device info
   */
  collectDeviceInfo?: boolean;
  
  /**
   * Whether to automatically report errors to the server
   */
  autoReport?: boolean;
  
  /**
   * Maximum number of errors to keep in memory
   */
  maxStoredErrors?: number;
  
  /**
   * Minimum time between reports for the same error in milliseconds
   * Default: 30000 (30 seconds)
   */
  dedupePeriodMs?: number;
  
  /**
   * Maximum time to store errors in milliseconds
   * Default: 7 days
   */
  errorTtlMs?: number;
  
  /**
   * Whether to enable console logging
   */
  debug?: boolean;
  
  /**
   * Callback to get device information
   */
  getDeviceInfo?: () => Promise<{
    deviceId?: string;
    appVersion?: string;
    userAgent?: string;
    resolution?: string;
    connected?: boolean;
    paired?: boolean;
    memoryUsage?: Record<string, number>;
  }>;
  
  /**
   * Custom error handler
   */
  customErrorHandler?: (error: Error, metadata?: Record<string, any>) => void;
  
  /**
   * Whether to include stack traces
   */
  includeStackTrace?: boolean;
}

/**
 * Error reporting service for capturing errors and sending them to the server
 */
export class ErrorReportingService extends EventEmitter {
  private options: Required<ErrorReportingOptions>;
  private memoryBank: MemoryBankManager;
  private lastReportTimes: Map<string, number> = new Map();
  private pendingReports: Set<string> = new Set();
  private rateLimitUntil: number = 0;
  private reportQueueTimer: number | null = null;
  
  constructor(options: ErrorReportingOptions = {}) {
    super();
    
    // Default options
    this.options = {
      apiEndpoint: '/api/errors/report',
      collectDeviceInfo: true,
      autoReport: true,
      maxStoredErrors: 50,
      dedupePeriodMs: 30000, // 30 seconds
      errorTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      debug: false,
      getDeviceInfo: async () => ({}),
      customErrorHandler: undefined as any,
      includeStackTrace: true,
      ...options
    };
    
    // Initialize memory bank for storing errors
    this.memoryBank = new MemoryBankManager({
      storageKeyPrefix: 'vizora_errors_',
      defaultTtl: this.options.errorTtlMs,
      maxItems: this.options.maxStoredErrors,
      debug: this.options.debug
    });
    
    this.log('ErrorReportingService initialized');
    
    // Start queue processing timer
    this.startQueueProcessing();
  }
  
  /**
   * Capture and report an error
   */
  public captureError(
    error: Error | string,
    options: {
      component?: string;
      metadata?: Record<string, any>;
      isFatal?: boolean;
      userAction?: string;
      deviceId?: string;
      appVersion?: string;
    } = {}
  ): string {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;
    
    // Generate error key for deduplication
    const errorKey = this.generateErrorKey(errorMessage, options.component, options.metadata);
    
    // Check if we already have this error
    const existingError = this.memoryBank.retrieve<ErrorReport>(errorKey);
    
    // Create or update error report
    const errorReport: ErrorReport = existingError 
      ? {
          ...existingError,
          count: existingError.count + 1,
          timestamp: Date.now(),
          // Update with new info if provided
          component: options.component || existingError.component,
          metadata: { ...(existingError.metadata || {}), ...(options.metadata || {}) },
          isFatal: options.isFatal ?? existingError.isFatal,
          userAction: options.userAction || existingError.userAction,
          deviceId: options.deviceId || existingError.deviceId,
          appVersion: options.appVersion || existingError.appVersion
        }
      : {
          errorKey,
          message: errorMessage,
          stack: this.options.includeStackTrace ? stack : undefined,
          component: options.component,
          metadata: options.metadata,
          timestamp: Date.now(),
          deviceId: options.deviceId,
          appVersion: options.appVersion,
          count: 1,
          isFatal: options.isFatal ?? false,
          userAction: options.userAction,
          context: undefined // Will be populated when reporting
        };
    
    // Store error report
    this.memoryBank.store(errorKey, errorReport, {
      category: 'errors',
      persistent: true,
      ttl: this.options.errorTtlMs,
      tags: [
        options.isFatal ? 'fatal' : 'non-fatal',
        options.component ? `component:${options.component}` : 'unknown-component'
      ]
    });
    
    // Log error
    this.log(`Captured error: ${errorMessage}`, {
      errorKey,
      component: options.component,
      isFatal: options.isFatal,
      count: errorReport.count
    });
    
    // Emit event
    this.emit('error:captured', errorReport);
    
    // Automatically report if enabled and not rate limited
    if (this.options.autoReport && !this.isRateLimited(errorKey)) {
      this.queueErrorForReporting(errorKey);
    }
    
    // Call custom error handler if provided
    if (typeof this.options.customErrorHandler === 'function') {
      try {
        this.options.customErrorHandler(
          typeof error === 'string' ? new Error(error) : error,
          options.metadata
        );
      } catch (handlerError) {
        this.log('Error in custom error handler', handlerError);
      }
    }
    
    return errorKey;
  }
  
  /**
   * Report a captured error to the server
   */
  public async reportError(errorKey: string): Promise<boolean> {
    // Check if error exists
    const errorReport = this.memoryBank.retrieve<ErrorReport>(errorKey);
    if (!errorReport) {
      this.log(`Error not found: ${errorKey}`);
      return false;
    }
    
    // Check rate limiting
    if (this.isRateLimited(errorKey)) {
      this.log(`Rate limited: ${errorKey}`);
      return false;
    }
    
    // If already being reported, skip
    if (this.pendingReports.has(errorKey)) {
      this.log(`Already reporting: ${errorKey}`);
      return false;
    }
    
    try {
      // Mark as pending
      this.pendingReports.add(errorKey);
      
      // Collect device info if enabled
      let deviceInfo = {};
      if (this.options.collectDeviceInfo && typeof this.options.getDeviceInfo === 'function') {
        try {
          deviceInfo = await this.options.getDeviceInfo();
        } catch (infoError) {
          this.log('Error collecting device info', infoError);
        }
      }
      
      // Update error report with context
      const updatedReport: ErrorReport = {
        ...errorReport,
        context: {
          connected: (deviceInfo as any).connected ?? false,
          paired: (deviceInfo as any).paired ?? false,
          userAgent: (deviceInfo as any).userAgent ?? navigator.userAgent,
          resolution: (deviceInfo as any).resolution,
          memoryUsage: (deviceInfo as any).memoryUsage
        }
      };
      
      // Store updated report
      this.memoryBank.store(errorKey, updatedReport, {
        category: 'errors',
        persistent: true,
        ttl: this.options.errorTtlMs
      });
      
      // Send to server
      const response = await this.sendToServer(updatedReport);
      
      // Update last report time
      this.lastReportTimes.set(errorKey, Date.now());
      
      // Log success
      this.log(`Reported error to server: ${errorKey}`, { 
        status: response.status,
        response: response.data
      });
      
      // Emit event
      this.emit('error:reported', {
        errorKey,
        success: true,
        response: response.data
      });
      
      return true;
    } catch (error) {
      // Log failure
      this.log(`Failed to report error: ${errorKey}`, error);
      
      // Emit event
      this.emit('error:reported', {
        errorKey,
        success: false,
        error
      });
      
      return false;
    } finally {
      // Remove from pending
      this.pendingReports.delete(errorKey);
    }
  }
  
  /**
   * Queue an error for reporting
   */
  public queueErrorForReporting(errorKey: string): void {
    if (this.isRateLimited(errorKey)) {
      this.log(`Not queuing rate-limited error: ${errorKey}`);
      return;
    }
    
    if (!this.pendingReports.has(errorKey)) {
      this.pendingReports.add(errorKey);
      this.log(`Queued error for reporting: ${errorKey}`);
    }
  }
  
  /**
   * Get all captured errors
   */
  public getAllErrors(): ErrorReport[] {
    const errorKeys = this.memoryBank.keys({ category: 'errors' });
    return errorKeys
      .map(key => this.memoryBank.retrieve<ErrorReport>(key))
      .filter(report => report !== null) as ErrorReport[];
  }
  
  /**
   * Clear all errors
   */
  public clearAllErrors(): void {
    this.memoryBank.clear({ category: 'errors' });
    this.lastReportTimes.clear();
    this.pendingReports.clear();
    this.log('Cleared all errors');
    this.emit('errors:cleared');
  }
  
  /**
   * Check if globally rate limited
   */
  public isGloballyRateLimited(): boolean {
    return Date.now() < this.rateLimitUntil;
  }
  
  /**
   * Check if a specific error is rate limited
   */
  public isRateLimited(errorKey: string): boolean {
    // Check global rate limit
    if (this.isGloballyRateLimited()) {
      return true;
    }
    
    // Check error-specific rate limit
    const lastReportTime = this.lastReportTimes.get(errorKey) || 0;
    return Date.now() - lastReportTime < this.options.dedupePeriodMs;
  }
  
  /**
   * Set global rate limit
   */
  public setGlobalRateLimit(durationMs: number): void {
    this.rateLimitUntil = Date.now() + durationMs;
    this.log(`Set global rate limit for ${durationMs}ms, until ${new Date(this.rateLimitUntil).toISOString()}`);
    this.emit('rate-limit:set', { 
      durationMs, 
      until: this.rateLimitUntil 
    });
  }
  
  /**
   * Clear global rate limit
   */
  public clearGlobalRateLimit(): void {
    this.rateLimitUntil = 0;
    this.log('Cleared global rate limit');
    this.emit('rate-limit:cleared');
  }
  
  /**
   * Process the queue of pending reports
   */
  public async processQueue(): Promise<number> {
    // Skip if globally rate limited
    if (this.isGloballyRateLimited()) {
      this.log('Skipping queue processing due to global rate limit');
      return 0;
    }
    
    // Get pending reports
    const pendingKeys = [...this.pendingReports];
    if (pendingKeys.length === 0) {
      return 0;
    }
    
    this.log(`Processing ${pendingKeys.length} pending reports`);
    
    // Process each report
    let successCount = 0;
    
    for (const errorKey of pendingKeys) {
      // Skip if rate limited
      if (this.isRateLimited(errorKey)) {
        continue;
      }
      
      // Report error
      const success = await this.reportError(errorKey);
      if (success) {
        successCount++;
      }
      
      // If we hit a rate limit, stop processing
      if (this.isGloballyRateLimited()) {
        this.log('Stopping queue processing due to rate limit');
        break;
      }
      
      // Small delay between reports
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.log(`Processed ${successCount} of ${pendingKeys.length} reports`);
    
    return successCount;
  }
  
  /**
   * Clean up and dispose
   */
  public dispose(): void {
    // Stop queue processing
    if (this.reportQueueTimer !== null) {
      window.clearInterval(this.reportQueueTimer);
      this.reportQueueTimer = null;
    }
    
    // Clean up memory bank
    this.memoryBank.dispose();
    
    this.log('ErrorReportingService disposed');
    this.emit('disposed');
  }
  
  /**
   * Generate a unique error key for deduplication
   */
  private generateErrorKey(message: string, component?: string, metadata?: Record<string, any>): string {
    // Create a simplified error message by removing variable parts
    // Remove timestamps, IDs, memory addresses, etc.
    let simplifiedMessage = message
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, 'TIMESTAMP') // ISO timestamps
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'UUID') // UUIDs
      .replace(/\b[0-9a-f]{24}\b/gi, 'ID') // MongoDB ObjectIDs
      .replace(/0x[0-9a-f]+/gi, 'ADDRESS') // Memory addresses
      .replace(/\b\d+(\.\d+)?(ms|s)\b/g, 'TIME') // Time durations
      .replace(/\b\d{10,13}\b/g, 'TIMESTAMP') // Unix timestamps
      .replace(/\bat\s+[\w\s\.$]+\s+\([^)]+\)/g, 'STACK_LOCATION') // Stack trace locations
      .slice(0, 100); // Limit length
    
    // Add component if available
    if (component) {
      simplifiedMessage = `${component}:${simplifiedMessage}`;
    }
    
    // If metadata has a unique identifier relevant to the error, include it
    let metadataKey = '';
    if (metadata) {
      if (metadata.action) metadataKey += `:action=${metadata.action}`;
      if (metadata.code) metadataKey += `:code=${metadata.code}`;
      if (metadata.status) metadataKey += `:status=${metadata.status}`;
    }
    
    // Create a hash-like identifier for the error
    let hash = 0;
    const str = simplifiedMessage + metadataKey;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const hashStr = Math.abs(hash).toString(36);
    
    return `error:${hashStr}`;
  }
  
  /**
   * Send error report to server
   */
  private async sendToServer(errorReport: ErrorReport): Promise<{ status: number; data: any }> {
    try {
      // Create fetch request options
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorReport)
      };
      
      // Send request
      const response = await fetch(this.options.apiEndpoint, options);
      
      // Parse response
      const responseData = await response.json();
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
        
        this.setGlobalRateLimit(retryMs);
      }
      
      return {
        status: response.status,
        data: responseData
      };
    } catch (error) {
      this.log('Error sending to server', error);
      throw error;
    }
  }
  
  /**
   * Start queue processing timer
   */
  private startQueueProcessing(): void {
    // Clear any existing timer
    if (this.reportQueueTimer !== null) {
      window.clearInterval(this.reportQueueTimer);
    }
    
    // Start new timer (process queue every 10 seconds)
    this.reportQueueTimer = window.setInterval(() => {
      this.processQueue().catch(error => {
        this.log('Error processing queue', error);
      });
    }, 10000);
    
    this.log('Started report queue processing');
  }
  
  /**
   * Log message if debug is enabled
   */
  private log(message: string, data?: any): void {
    if (this.options.debug) {
      console.log(`[ErrorReporter] ${message}`, data);
    }
  }
} 