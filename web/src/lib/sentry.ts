/**
 * Sentry integration stub
 * Ready for @sentry/nextjs when NEXT_PUBLIC_SENTRY_DSN is configured.
 * Does nothing if DSN is not set — safe to import anywhere.
 */

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  // When ready, install @sentry/nextjs and replace this stub:
  // import * as Sentry from '@sentry/nextjs';
  // Sentry.init({ dsn, tracesSampleRate: 0.1 });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  // When @sentry/nextjs is installed:
  // import * as Sentry from '@sentry/nextjs';
  // Sentry.captureException(error, { extra: context });
  console.error('[Sentry stub] Would report:', error, context);
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  // When @sentry/nextjs is installed:
  // import * as Sentry from '@sentry/nextjs';
  // Sentry.captureMessage(message, level);
  console.log(`[Sentry stub] Would report (${level}):`, message);
}
