# @vizora/common

This package contains shared utilities, services, and types used across the Vizora ecosystem.

## Recent Fixes

### Module Resolution Fix (2025-04-10)

Fixed a critical issue with ES Module resolution that was causing the following error in the middleware:

```
Error loading @vizora/common: Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\srila\Vizora\Redesign\common\dist\sockets\client' imported from C:\Users\srila\Vizora\Redesign\common\dist\index.js
```

The resolution involved:

1. Changing package type from "module" to "commonjs" in package.json
2. Updating tsconfig.json to use CommonJS module resolution
3. Adding missing method signatures to ConnectionManager class:
   - getLatency()
   - getHealthStatus()
4. Adding rxjs dependency for the diagnostics system

This fix allows the middleware to correctly load and use the common package. If you encounter similar issues in the future, consider one of these approaches:

- **Option 1 (implemented):** Use CommonJS module resolution for simplicity
- **Option 2:** Update all imports to include explicit `.js` extensions for ESM compatibility

## Connection Management Enhancements

Recent additions include:

- `ConnectionManagerFactory` - Centralized singleton creation
- `ConnectionHealthMonitor` - Network quality metrics
- `ConnectionDebugger` - Debug UI component
- `ConnectionDebugOverlay` - Minimalist status display for TV
- Diagnostic dump utilities for troubleshooting

## Features

- Shared TypeScript types and interfaces
- WebSocket client implementation
- Content scheduling utilities
- Test utilities and mocks

## Installation

```bash
npm install @vizora/common
```

## Usage

### Types

```typescript
import { Display, Content, Schedule } from '@vizora/common';
```

### WebSocket Client

```typescript
import { VizoraSocketClient } from '@vizora/common';

const client = new VizoraSocketClient('ws://localhost:3000', 'display-001');
await client.connect();

client.on('content:update', (content) => {
  console.log('Content updated:', content);
});
```

### Scheduling Utilities

```typescript
import { isScheduleActive, getActiveSchedules } from '@vizora/common';

const isActive = isScheduleActive(schedule);
const activeSchedules = getActiveSchedules(schedules);
```

### Test Utilities

```typescript
import { mockDisplay, mockContent, mockSchedule } from '@vizora/common';
```

### Import from the package

```typescript
import { getConnectionManager, ConnectionDebugOverlay } from '@vizora/common';

// Get singleton connection manager
const connectionManager = getConnectionManager();

// Use in React components
function MyComponent() {
  return (
    <div>
      {process.env.NODE_ENV !== 'production' && <ConnectionDebugOverlay />}
    </div>
  );
}
```

## Development

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the package:
   ```bash
   npm run build
   ```

### Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## License

MIT 