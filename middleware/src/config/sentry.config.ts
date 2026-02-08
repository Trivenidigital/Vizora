import * as Sentry from '@sentry/node';

export function initializeSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Performance Monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Release tracking
    release: process.env.SENTRY_RELEASE || undefined,

    // Error filtering
    ignoreErrors: [
      // Network errors
      'ECONNRESET',
      'ECONNABORTED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'EPIPE',
      // JWT errors (expected client errors)
      'jwt expired',
      'jwt malformed',
      'invalid token',
      'jwt must be provided',
      // Common non-critical errors
      'ENOENT',
      'PayloadTooLargeError',
    ],

    beforeSend(event, hint) {
      // Strip sensitive data from request
      if (event.request) {
        // Remove cookies
        delete event.request.cookies;

        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-csrf-token'];
        }

        // Remove request body to prevent leaking sensitive data
        delete event.request.data;
      }

      // Strip user-sensitive fields if present
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }

      return event;
    },
  });

  console.log('Sentry initialized for middleware service');
}
