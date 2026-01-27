# Load Testing Guide

Comprehensive load and stress testing for the Vizora Realtime service.

## 📋 Test Suites

### 1. WebSocket Load Test (`test:load`)
Simulates **100 concurrent display devices** connecting via WebSocket:
- Concurrent device connections with ramp-up
- Continuous heartbeat sending (every 15s)
- Real metrics and content data
- Connection stability testing
- Latency measurement

### 2. API Load Test (`test:load:api`)
Generates **1000 API requests per second**:
- Mixed endpoint testing (GET, POST, etc.)
- Weighted request distribution
- Throughput measurement
- Latency percentiles (P50, P95, P99)
- Error rate tracking

### 3. Combined Load Test (`test:load:combined`)
Runs **both tests simultaneously**:
- 100 WebSocket devices + 1000 RPS
- Real-world stress scenario
- System-wide performance analysis

## 🚀 Quick Start

### Prerequisites
1. **Server must be running:**
   ```bash
   # In another terminal
   cd realtime
   pnpm serve
   ```

2. **Configure environment:**
   ```bash
   # Edit .env.load-test
   DEVICE_JWT_SECRET=your-actual-secret
   WS_SERVER_URL=http://localhost:3000
   API_BASE_URL=http://localhost:3000
   ```

### Run Tests

```bash
# WebSocket load test (100 devices)
pnpm test:load

# API load test (1000 RPS)
pnpm test:load:api

# Combined test (100 devices + 1000 RPS)
pnpm test:load:combined
```

## ⚙️ Configuration

### Environment Variables

Edit `.env.load-test` to customize:

```env
# Device count (default: 100)
DEVICE_COUNT=100

# API requests per second (default: 1000)
TARGET_RPS=1000

# Test duration in milliseconds (default: 60s)
TEST_DURATION=60000

# Device heartbeat interval (default: 15s)
HEARTBEAT_INTERVAL=15000

# Connection ramp-up time (default: 10s)
RAMP_UP_TIME=10000

# Server URLs
WS_SERVER_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000
```

### Custom Configuration

You can override via command line:

```bash
# Test with 200 devices
DEVICE_COUNT=200 pnpm test:load

# Test with 2000 RPS for 2 minutes
TARGET_RPS=2000 TEST_DURATION=120000 pnpm test:load:api

# Quick smoke test (10 devices, 10 seconds)
DEVICE_COUNT=10 TEST_DURATION=10000 pnpm test:load
```

## 📊 Understanding Results

### WebSocket Load Test Output

```
📊 LOAD TEST RESULTS
═══════════════════════════════════════════════════════════════════

🔌 Connections:
   Total Devices:        100
   Connected:            100 (100.0%)
   Avg Connection Time:  45ms

💓 Heartbeats:
   Total Sent:           400
   Total Acknowledged:   398 (99.5%)
   Heartbeats/sec:       6.7

⚡ Latency:
   Average:              23ms
   Min:                  12ms
   Max:                  156ms
   P95:                  45ms

📨 Messages:
   Total Received:       520
   Messages/sec:         8.7

❌ Errors:
   Total Errors:         2
   Error Rate:           0.50%

⏱️  Duration:
   Test Duration:        60.0s
```

**Key Metrics:**
- **Connected:** Should be 100% for healthy system
- **Heartbeats Acknowledged:** >99% is excellent
- **Average Latency:** <50ms is good, <100ms acceptable
- **P95 Latency:** Should be <100ms
- **Error Rate:** <1% is acceptable

### API Load Test Output

```
📊 API LOAD TEST RESULTS
═══════════════════════════════════════════════════════════════════

⚡ Throughput:
   Target RPS:           1000
   Actual RPS:           987.3
   Achievement:          98.7%
   Total Requests:       59238

⏱️  Latency:
   Average:              34ms
   Min:                  5ms
   Max:                  234ms
   P50 (median):         28ms
   P95:                  67ms
   P99:                  112ms

✅ Status Codes:
   ✅ 200:               57123 (96.4%)
   ✅ 201:               1234 (2.1%)
   ❌ 404:               881 (1.5%)

❌ Errors:
   Total Errors:         881
   Error Rate:           1.49%

⏱️  Duration:
   Test Duration:        60.0s
```

**Key Metrics:**
- **Achievement:** Should be >95% of target RPS
- **P95 Latency:** <100ms is good
- **P99 Latency:** <200ms acceptable
- **Error Rate:** <2% acceptable (some 404s expected for test endpoints)

## 🎯 Performance Targets

### Acceptable Performance
- ✅ 95%+ devices successfully connected
- ✅ 98%+ heartbeat acknowledgment rate
- ✅ <100ms P95 latency
- ✅ <2% error rate
- ✅ >95% of target RPS achieved

### Warning Signs
- ⚠️ <90% connection success rate
- ⚠️ <95% heartbeat acknowledgment
- ⚠️ >150ms P95 latency
- ⚠️ >5% error rate
- ⚠️ <90% of target RPS

### Critical Issues
- ❌ <80% connection success rate
- ❌ <90% heartbeat acknowledgment
- ❌ >300ms P95 latency
- ❌ >10% error rate
- ❌ <80% of target RPS

## 🔍 Troubleshooting

### Low Connection Success Rate

**Problem:** Less than 95% of devices connecting

**Possible causes:**
- Server capacity limits
- Too fast ramp-up (try increasing `RAMP_UP_TIME`)
- Network/firewall issues
- Redis connection limits

**Solutions:**
```bash
# Slower ramp-up
RAMP_UP_TIME=30000 pnpm test:load

# Fewer devices
DEVICE_COUNT=50 pnpm test:load
```

### High Latency

**Problem:** P95 latency >100ms

**Possible causes:**
- Server CPU/memory bottleneck
- Redis performance issues
- Database query optimization needed
- Network latency

**Solutions:**
- Profile server with monitoring tools
- Check Redis performance: `redis-cli --latency`
- Optimize database queries
- Scale horizontally

### Low RPS Achievement

**Problem:** Actual RPS <90% of target

**Possible causes:**
- Server at capacity
- Client machine overloaded (running tests)
- Network bandwidth limits

**Solutions:**
```bash
# Lower target
TARGET_RPS=500 pnpm test:load:api

# Shorter test duration
TEST_DURATION=30000 pnpm test:load:api

# Run from different machine/region
```

### High Error Rate

**Problem:** >5% error rate

**Possible causes:**
- Server crashes/restarts
- Rate limiting triggered
- Resource exhaustion
- Code bugs

**Solutions:**
- Check server logs
- Monitor server resources (CPU, memory, connections)
- Review error types in test output
- Add rate limiting exemptions for load tests

## 📈 Scaling Tests

### Progressive Load Testing

Start small and scale up:

```bash
# Phase 1: Baseline (10 devices, 100 RPS)
DEVICE_COUNT=10 TARGET_RPS=100 TEST_DURATION=30000 pnpm test:load:combined

# Phase 2: Medium (50 devices, 500 RPS)
DEVICE_COUNT=50 TARGET_RPS=500 TEST_DURATION=60000 pnpm test:load:combined

# Phase 3: Target (100 devices, 1000 RPS)
DEVICE_COUNT=100 TARGET_RPS=1000 TEST_DURATION=60000 pnpm test:load:combined

# Phase 4: Stress (200 devices, 2000 RPS)
DEVICE_COUNT=200 TARGET_RPS=2000 TEST_DURATION=60000 pnpm test:load:combined
```

### Long-Duration Tests

Test stability over time:

```bash
# 5-minute test
TEST_DURATION=300000 pnpm test:load:combined

# 30-minute soak test
TEST_DURATION=1800000 pnpm test:load:combined
```

## 🛠️ Advanced Usage

### Custom Endpoint Testing

Edit `test/api-load-test.ts` to customize endpoints:

```typescript
endpoints: [
  {
    method: 'GET',
    path: '/api/custom-endpoint',
    weight: 0.5,  // 50% of requests
  },
  {
    method: 'POST',
    path: '/api/webhook',
    weight: 0.3,  // 30% of requests
    body: { event: 'test' },
    headers: { 'X-API-Key': 'test-key' },
  },
]
```

### Monitoring During Tests

Open multiple terminals:

**Terminal 1:** Run server
```bash
cd realtime && pnpm serve
```

**Terminal 2:** Run load test
```bash
pnpm test:load:combined
```

**Terminal 3:** Monitor server logs
```bash
tail -f logs/server.log
```

**Terminal 4:** Monitor Redis
```bash
redis-cli MONITOR
```

**Terminal 5:** Monitor system resources
```bash
# Linux/Mac
htop

# Windows
Task Manager or:
Get-Process | Where-Object {$_.ProcessName -eq "node"}
```

## 🎯 CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Start Redis
        run: docker run -d -p 6379:6379 redis:7-alpine
      
      - name: Install dependencies
        run: |
          cd realtime
          pnpm install
      
      - name: Start server
        run: |
          cd realtime
          pnpm serve &
          sleep 10
      
      - name: Run load tests
        run: |
          cd realtime
          pnpm test:load:combined
        env:
          DEVICE_COUNT: 100
          TARGET_RPS: 1000
          TEST_DURATION: 60000
```

## 📚 Best Practices

1. **Start Small:** Begin with low numbers and scale up
2. **Monitor Everything:** Watch server logs, metrics, and resources
3. **Test Regularly:** Run load tests before major releases
4. **Set Baselines:** Record performance metrics for comparison
5. **Test Production-Like:** Use similar configurations to production
6. **Clean Up:** Ensure Redis and connections are cleaned up after tests
7. **Document Results:** Keep records of load test outcomes

## 🔗 Related Documentation

- [E2E Test README](./README.md)
- [Vizora Architecture Docs](../docs/)
- [Deployment Guide](../docs/deployment.md)

## 💡 Tips

- Run load tests on a separate machine from the server for accurate results
- Use production-like data volumes
- Test during off-peak hours if using shared infrastructure
- Compare results over time to detect performance regressions
- Consider geographic distribution (test from multiple regions)

---

Happy load testing! 🚀
