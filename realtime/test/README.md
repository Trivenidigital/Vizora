# Vizora Realtime Service - E2E Tests

Comprehensive end-to-end tests for WebSocket display client connectivity.

## 📋 Test Coverage

### ✅ Connection Establishment
- Valid device token authentication
- Initial configuration delivery
- Token validation (missing, invalid, wrong type)
- Redis status updates on connection
- Device room and organization room joining

### 💓 Heartbeat Mechanism
- Heartbeat with metrics and current content
- Redis data updates
- Sequential heartbeat handling
- Pending command delivery with heartbeat response
- Heartbeat interval configuration (15 seconds)

### 📤 Content Push Delivery
- Playlist update push to connected displays
- Command push (reload, restart, etc.)
- Content impression logging
- Content error logging
- Playlist request/response

### 🔄 Reconnection Handling
- Graceful disconnect and reconnect
- Redis status updates on disconnect
- State persistence across reconnections
- Automatic reconnection logic

### 👥 Multiple Concurrent Connections
- Simultaneous device connections
- Concurrent heartbeat handling
- Organization-wide broadcasts
- Device isolation and room management

### ⚠️ Error Scenarios
- Malformed heartbeat data handling
- Network interruption simulation
- Expired token rejection
- Error storage limits (max 10 errors per device)
- Graceful error handling and logging

## 🚀 Running Tests

### Prerequisites
1. **Redis Server** - Must be running on `localhost:6379` (or configure in `.env.test`)
2. **Node.js** - v18+ recommended
3. **Dependencies** - Run `pnpm install` in the realtime directory

### Install Dependencies
```bash
cd realtime
pnpm install
```

### Run E2E Tests
```bash
# Run all E2E tests
pnpm test:e2e

# Run with watch mode (auto-rerun on file changes)
pnpm test:e2e:watch

# Run with coverage report
pnpm test:e2e:cov
```

### Individual Test Suites
```bash
# Run only connection tests
pnpm test:e2e -- -t "Connection Establishment"

# Run only heartbeat tests
pnpm test:e2e -- -t "Heartbeat Mechanism"

# Run only error scenario tests
pnpm test:e2e -- -t "Error Scenarios"
```

## 🔧 Configuration

### Environment Variables
Configure test environment in `.env.test`:

```env
# JWT Secret for device authentication
DEVICE_JWT_SECRET=test-device-secret-key-for-e2e-tests

# Redis connection
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS configuration
CORS_ORIGIN=*
```

### Test Timeouts
- Default timeout: 30 seconds (configured in `jest.e2e.config.js`)
- Individual tests may have shorter timeouts
- Increase if tests are flaky on slow machines

## 📊 Test Structure

```
test/
├── README.md                      # This file
├── setup.ts                       # Global test setup
└── device-gateway.e2e-spec.ts    # Main E2E test suite
```

### Key Test Utilities
- **socket.io-client** - WebSocket client for testing
- **@nestjs/testing** - NestJS testing utilities
- **ts-jest** - TypeScript support for Jest

## 🎯 Test Scenarios Explained

### 1. Connection Establishment
Tests the initial WebSocket handshake, token validation, and device registration.

**Key validations:**
- JWT token verification
- Device type checking
- Redis status updates
- Room joining (device-specific and organization-wide)

### 2. Heartbeat Mechanism
Tests the periodic heartbeat/ping-pong keepalive system.

**Key validations:**
- Heartbeat data processing
- Metrics storage in Redis
- Command queue checking
- 15-second interval configuration

### 3. Content Push Delivery
Tests real-time content delivery to connected displays.

**Key validations:**
- Playlist updates pushed to specific devices
- Commands sent to devices (reload, restart)
- Content impression tracking
- Error logging

### 4. Reconnection Handling
Tests network resilience and state recovery.

**Key validations:**
- Automatic reconnection
- Status updates (online → offline → online)
- State persistence across disconnections

### 5. Multiple Concurrent Connections
Tests scalability and multi-device scenarios.

**Key validations:**
- Simultaneous device connections
- Device isolation (messages go to correct devices)
- Organization broadcasts (all devices in org receive)
- Concurrent operations (heartbeats, commands)

### 6. Error Scenarios
Tests edge cases and error handling.

**Key validations:**
- Graceful handling of malformed data
- Token expiration rejection
- Network interruption handling
- Error storage limits

## 🐛 Debugging Tests

### Enable Detailed Logging
```bash
# Set LOG_LEVEL in .env.test
LOG_LEVEL=debug pnpm test:e2e
```

### Run Single Test File
```bash
pnpm test:e2e test/device-gateway.e2e-spec.ts
```

### Run Specific Test
```bash
pnpm test:e2e -t "should successfully connect with valid device token"
```

### Common Issues

#### ❌ Redis Connection Failed
**Error:** `ECONNREFUSED` or `Redis error`
**Solution:** Ensure Redis is running on `localhost:6379`
```bash
redis-server
```

#### ❌ Port Already in Use
**Error:** `EADDRINUSE`
**Solution:** Tests use random port (`:0`). If still failing, kill processes on port 3000-4000.

#### ❌ Test Timeout
**Error:** `Timeout - Async callback was not invoked`
**Solution:** Increase timeout in test or check if Redis is responding slowly.

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Start Redis
  run: |
    docker run -d -p 6379:6379 redis:7-alpine

- name: Run E2E Tests
  run: |
    cd realtime
    pnpm install
    pnpm test:e2e
```

### Docker Compose for Testing
```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## 📈 Coverage Goals

Target coverage for WebSocket functionality:
- **Statements:** 80%+
- **Branches:** 75%+
- **Functions:** 80%+
- **Lines:** 80%+

Generate coverage report:
```bash
pnpm test:e2e:cov
```

View HTML report:
```bash
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html # Windows
```

## 🤝 Contributing

When adding new WebSocket features:
1. Add corresponding E2E tests
2. Follow existing test structure
3. Ensure all tests pass before PR
4. Update this README if needed

## 📚 Resources

- [NestJS WebSockets Documentation](https://docs.nestjs.com/websockets/gateways)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [socket.io-client API](https://socket.io/docs/v4/client-api/)
