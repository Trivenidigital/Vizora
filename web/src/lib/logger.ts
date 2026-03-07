// Dev-guarded logger — strips console.log/warn in production builds
// Uses wrapper functions (not .bind) so that test spies on console.* are captured correctly.
const isProduction = process.env.NODE_ENV === 'production';

export const devLog = isProduction
  ? (() => {}) as (...args: unknown[]) => void
  : (...args: unknown[]) => console.log(...args);
export const devWarn = isProduction
  ? (() => {}) as (...args: unknown[]) => void
  : (...args: unknown[]) => console.warn(...args);
export const devError = (...args: unknown[]) => console.error(...args); // Always log errors
