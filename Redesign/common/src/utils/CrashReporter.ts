/**
 * CrashReporter - Handles application crashes and error logging
 * 
 * This utility provides automatic error tracking by hooking into window.onerror
 * and window.onunhandledrejection. It logs crashes with timestamps and can
 * invoke a fallback UI when crashes occur.
 */

// Type definition for error handlers
type ErrorHandler = (error: Error, errorInfo?: Record<string, any>) => void;

// Interface for CrashReporter configuration
interface CrashReporterConfig {
  applicationName?: string;
  version?: string;
  enableConsoleLogging?: boolean;
  maxErrorsStored?: number;
  onError?: ErrorHandler;
}

// Error data structure with additional context
interface ErrorData {
  timestamp: number;
  message: string;
  stack?: string;
  type: 'error' | 'rejection' | 'react';
  componentStack?: string;
  url?: string;
  source?: string;
  additionalInfo?: Record<string, any>;
}

/**
 * CrashReporter class for handling application errors and crashes
 */
export class CrashReporter {
  private static instance: CrashReporter;
  private config: CrashReporterConfig;
  private errorLog: ErrorData[] = [];
  private originalOnError: OnErrorEventHandler | null = null;
  private originalOnUnhandledRejection: ((this: Window, ev: PromiseRejectionEvent) => any) | null = null;
  private errorHandlers: ErrorHandler[] = [];
  private isInitialized = false;

  /**
   * Create a new CrashReporter instance
   * @param config Configuration options
   */
  private constructor(config: CrashReporterConfig = {}) {
    this.config = {
      applicationName: 'VizoraApp',
      version: '1.0.0',
      enableConsoleLogging: true,
      maxErrorsStored: 50,
      ...config
    };
  }

  /**
   * Get the CrashReporter singleton instance
   * @param config Configuration options (only used if instance doesn't exist)
   * @returns CrashReporter instance
   */
  public static getInstance(config?: CrashReporterConfig): CrashReporter {
    if (!CrashReporter.instance) {
      CrashReporter.instance = new CrashReporter(config);
    }
    return CrashReporter.instance;
  }

  /**
   * Initialize the crash reporter and set up global error handlers
   */
  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    console.log('[CrashReporter] Initializing...');

    // Store original handlers
    this.originalOnError = window.onerror;
    this.originalOnUnhandledRejection = window.onunhandledrejection;

    // Set up global error handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError(error || new Error(message as string), {
        type: 'error',
        source: `${source}:${lineno}:${colno}`
      });
      // Call original handler if it exists
      if (this.originalOnError) {
        return this.originalOnError(message, source, lineno, colno, error);
      }
      return false; // Prevent default browser handling
    };

    // Set up unhandled promise rejection handler
    // Explicitly type the event handler function using WindowEventHandlers
    const rejectionHandler: WindowEventHandlers['onunhandledrejection'] = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason) || 'Unhandled promise rejection');
      this.handleError(error, { type: 'rejection' });
      // Call original handler if it exists
      if (this.originalOnUnhandledRejection) {
        // Use .call to ensure correct `this` context if necessary
        this.originalOnUnhandledRejection.call(window, event);
      }
    };
    window.onunhandledrejection = rejectionHandler;

    this.isInitialized = true;
    console.log('[CrashReporter] Initialized successfully');
  }

  /**
   * Clean up and restore original error handlers
   */
  public destroy(): void {
    if (!this.isInitialized || typeof window === 'undefined') {
        return;
    }
    console.log('[CrashReporter] Destroying...');
    // Restore original handlers safely
    window.onerror = this.originalOnError;
    // Cast to any as a workaround for complex type mismatch
    window.onunhandledrejection = this.originalOnUnhandledRejection as any;
    this.isInitialized = false;
    console.log('[CrashReporter] Destroyed');
  }

  /**
   * Register a custom error handler
   * @param handler Function to call when errors occur
   */
  public registerErrorHandler(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Unregister a previously registered error handler
   * @param handler Handler function to remove
   */
  public unregisterErrorHandler(handler: ErrorHandler): void {
    this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
  }

  /**
   * Manually report an error
   * @param error Error object
   * @param additionalInfo Additional context about the error
   */
  public reportError(error: Error, additionalInfo?: Record<string, any>): void {
    this.handleError(error, { additionalInfo, type: 'error' });
  }

  /**
   * Handle errors by logging and notifying handlers
   * @param error Error object
   * @param context Additional context information
   */
  private handleError(error: Error, context: Record<string, any> = {}): void {
    const errorData: ErrorData = {
      timestamp: Date.now(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      type: context.type || 'error',
      url: context.url || (typeof window !== 'undefined' ? window.location.href : undefined),
      source: context.source,
      additionalInfo: context.additionalInfo || {}
    };

    // Add to error log, maintaining max size
    this.errorLog.push(errorData);
    if (this.errorLog.length > this.config.maxErrorsStored!) {
      this.errorLog.shift();
    }

    // Log to console if enabled
    if (this.config.enableConsoleLogging) {
      this.logErrorToConsole(errorData);
    }

    // Notify error handlers
    this.notifyErrorHandlers(error, errorData);

    // Notify global handler if configured
    if (this.config.onError) {
      this.config.onError(error, errorData);
    }
  }

  /**
   * Format and log error to console
   * @param errorData Error data to log
   */
  private logErrorToConsole(errorData: ErrorData): void {
    const timestamp = new Date(errorData.timestamp).toISOString();
    const errorType = errorData.type.charAt(0).toUpperCase() + errorData.type.slice(1);
    
    console.group(`[CrashReporter] ${errorType} at ${timestamp}`);
    console.error(errorData.message);
    
    if (errorData.stack) {
      console.error('Stack trace:');
      console.error(errorData.stack);
    }
    
    if (errorData.componentStack) {
      console.error('Component stack:');
      console.error(errorData.componentStack);
    }
    
    if (Object.keys(errorData.additionalInfo || {}).length > 0) {
      console.log('Additional information:', errorData.additionalInfo);
    }
    
    console.groupEnd();
  }

  /**
   * Notify all registered error handlers
   * @param error Original error object
   * @param errorData Processed error data
   */
  private notifyErrorHandlers(error: Error, errorData: ErrorData): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error, errorData);
      } catch (handlerError) {
        console.error('[CrashReporter] Error in error handler:', handlerError);
      }
    });
  }

  /**
   * Get the current error log
   * @returns Array of recorded errors
   */
  public getErrorLog(): ErrorData[] {
    return [...this.errorLog];
  }

  /**
   * Clear the error log
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Generate a diagnostic report with system information
   * @returns Object containing diagnostic information
   */
  public generateDiagnosticReport(): Record<string, any> {
    const report: Record<string, any> = {
      timestamp: new Date().toISOString(),
      application: this.config.applicationName,
      version: this.config.version,
      errors: this.getErrorLog(),
      environment: {}
    };

    // Add browser/environment information if available
    if (typeof window !== 'undefined') {
      const nav = window.navigator;
      report.environment = {
        userAgent: nav.userAgent,
        platform: nav.platform,
        language: nav.language,
        cookiesEnabled: nav.cookieEnabled,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        url: window.location.href,
        referrer: document.referrer
      };
    }

    return report;
  }
}

// Export a default instance
export const crashReporter = CrashReporter.getInstance(); 