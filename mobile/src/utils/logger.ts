/**
 * Simple logger utility. In production, this can be extended to
 * send errors to a service like Sentry or Datadog.
 */
export const logger = {
  warn: (message: string, error?: unknown) => {
    if (__DEV__) {
      console.warn(`[Vizora] ${message}`, error ?? '');
    }
  },
  error: (message: string, error?: unknown) => {
    if (__DEV__) {
      console.error(`[Vizora] ${message}`, error ?? '');
    }
    // TODO: Send to crash reporting service in production
  },
};
