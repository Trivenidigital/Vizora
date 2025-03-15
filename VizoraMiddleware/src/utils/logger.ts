import { NODE_ID } from '../config/cluster';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogMetadata {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  nodeId: string;
  metadata?: LogMetadata;
}

export class Logger {
  private static instance: Logger;
  private logHandlers: ((entry: LogEntry) => void)[] = [];

  private constructor() {
    // Add console handler by default
    this.addHandler((entry) => {
      const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
      console.log(`[${entry.timestamp}] [${entry.level}] [${entry.nodeId}] ${entry.message}${metadata}`);
    });
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  addHandler(handler: (entry: LogEntry) => void): void {
    this.logHandlers.push(handler);
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      nodeId: NODE_ID,
      metadata
    };

    this.logHandlers.forEach(handler => handler(entry));
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  // Helper method for logging errors
  logError(error: unknown, context?: string): void {
    if (error instanceof Error) {
      this.error(
        context ? `${context}: ${error.message}` : error.message,
        {
          name: error.name,
          stack: error.stack,
          ...(error as any)
        }
      );
    } else {
      this.error(
        context ? `${context}: Unknown error` : 'Unknown error',
        { error }
      );
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance(); 