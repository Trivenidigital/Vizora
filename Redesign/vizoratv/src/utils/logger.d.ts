/**
 * Simple Logger Utility
 * Prefixes messages and only logs detailed info in development.
 */
export declare const logger: {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, error?: any, ...args: any[]) => void;
};
