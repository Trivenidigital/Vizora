# Realtime Server Build Fix

**Date:** January 27, 2026  
**Fixed By:** Mango 🥭

## Problem

The realtime server build was failing with 28 webpack errors related to Sentry profiling native bindings:
```
ERROR in @sentry-internal/node-cpu-profiler/lib/sentry_cpu_profiler-*.node
Module parse failed: Unexpected character '�' (1:0)
You may need an appropriate loader to handle this file type
```

Runtime error:
```
Error: Cannot find module '@sentry-internal/node-cpu-profiler'
```

## Root Cause

Webpack was trying to bundle Sentry's native `.node` binary files, which:
1. Can't be parsed as JavaScript
2. Should be treated as external native bindings
3. Are optional dependencies for profiling

## Solution

### 1. Webpack Configuration (`realtime/webpack.config.js`)

```javascript
const { IgnorePlugin } = require('webpack');

module.exports = {
  externals: [
    'class-transformer/storage',
    '@prisma/client-runtime-utils',
    '@sentry/profiling-node',
    '@sentry-internal/node-cpu-profiler',
    // Externalize all .node files (native bindings)
    function ({ request }, callback) {
      if (/\.node$/.test(request)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    },
  ],
  plugins: [
    // ... existing NxAppWebpackPlugin,
    // Ignore Sentry profiling native bindings
    new IgnorePlugin({
      resourceRegExp: /^@sentry-internal\/node-cpu-profiler$/,
    }),
    new IgnorePlugin({
      resourceRegExp: /\.node$/,
      contextRegExp: /@sentry-internal/,
    }),
  ],
};
```

### 2. Sentry Configuration (`realtime/src/config/sentry.config.ts`)

Made profiling optional with try-catch:

```typescript
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
    // ...
    profilesSampleRate: nodeProfilingIntegration 
      ? parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1')
      : 0,
    integrations,
    // ...
  });
}
```

## Results

✅ **Build:** Compiles successfully with only warnings (source map issues)  
✅ **Runtime:** Server starts without Sentry errors  
✅ **Profiling:** Gracefully degrades when profiling module unavailable

## Remaining Issue

⚠️ **Prometheus Metrics Configuration Error**

The server now crashes with a NestJS dependency injection error:
```
Nest can't resolve dependencies of the MetricsService (PROM_METRIC_WS_CONNECTIONS_TOTAL, ...)
```

**Status:** Separate issue - Prometheus metrics module needs configuration fix  
**Impact:** Server cannot start fully  
**Next Step:** Investigate `MetricsModule` and prometheus metric providers

## Testing

```bash
# Build succeeds
pnpm nx build realtime  

# Server starts (but crashes on Prometheus DI error)
pnpm nx serve realtime  
```

## Files Modified

1. `realtime/webpack.config.js` - Added externals + IgnorePlugin
2. `realtime/src/config/sentry.config.ts` - Made profiling optional

---

**Conclusion:** Webpack/Sentry build issues are **resolved**. Prometheus metrics DI issue needs separate fix.
