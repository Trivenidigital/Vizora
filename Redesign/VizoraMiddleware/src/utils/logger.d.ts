// Stub type definition for logger.js
declare module '../utils/logger' {
  const logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    // Add other methods if used
  };
  export default logger;
}

declare module './utils/logger' { // Also declare for relative path usage
  const logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  };
  export default logger;
} 