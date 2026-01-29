import * as Sentry from '@sentry/nestjs';

// Profiling is optional - it may not be available in bundled/webpack builds
let nodeProfilingIntegration: any = null;
try {
  const profilingModule = require('@sentry/profiling-node');
  nodeProfilingIntegration = profilingModule.nodeProfilingIntegration;
} catch (e) {
  console.warn('⚠️  Sentry profiling not available (optional)');
}

export function initializeSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️  Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  const integrations: any[] = [];
  
  // Add profiling integration if available
  if (nodeProfilingIntegration) {
    integrations.push(nodeProfilingIntegration());
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance Monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // Profiling (only if available)
    profilesSampleRate: nodeProfilingIntegration 
      ? parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1')
      : 0,
    integrations,

    // Release tracking
    release: process.env.RELEASE_VERSION || 'unknown',

    // Error filtering
    ignoreErrors: [
      // Ignore common non-critical errors
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'jwt expired',
      'jwt malformed',
    ],

    beforeSend(event, hint) {
      // Don't send errors in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
        return null;
      }

      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
      }

      return event;
    },
  });

  console.log('✅ Sentry initialized');
}
