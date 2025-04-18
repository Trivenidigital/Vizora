/**
 * Simple Logger Utility
 * Prefixes messages and only logs detailed info in development.
 */

// Define severity levels for potential future filtering
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Basic logger configuration (could be expanded)
const config = {
  level: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO, // Log more in dev
  prefix: '[VizoraTV]',
};

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (config.level <= LogLevel.DEBUG) {
      console.debug(`${config.prefix} [DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (config.level <= LogLevel.INFO) {
      // Use different emoji/styling for info
      console.info(`🔵 ${config.prefix} [INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (config.level <= LogLevel.WARN) {
      console.warn(`🟠 ${config.prefix} [WARN] ${message}`, ...args);
    }
  },
  error: (message: string, error?: any, ...args: any[]) => {
    if (config.level <= LogLevel.ERROR) {
      if (error) {
        console.error(`🔴 ${config.prefix} [ERROR] ${message}`, error, ...args);
      } else {
        console.error(`🔴 ${config.prefix} [ERROR] ${message}`, ...args);
      }
    }
  },
};

// Example usage:
// logger.info('Application started');
// logger.error('Failed to load resource', new Error('Network issue'));
