# Load Testing Suite - Summary

## 🎯 What We Built

Comprehensive load testing infrastructure for Vizora Realtime service with:
- ✅ **100 concurrent WebSocket devices**
- ✅ **1000 API requests per second**
- ✅ Combined stress testing
- ✅ Detailed metrics and reporting

## 📦 Files Created

### Test Scripts

1. **`test/load-test.ts`** (11.5KB)
   - WebSocket load testing
   - 100 concurrent device connections
   - Heartbeat simulation
   - Metrics: latency, throughput, errors
   - Configurable ramp-up and duration

2. **`test/api-load-test.ts`** (10.1KB)
   - API endpoint load testing
   - 1000 requests/sec target
   - Mixed endpoint distribution
   - Latency percentiles (P50, P95, P99)
   - Status code tracking

3. **`test/combined-load-test.ts`** (3.8KB)
   - Runs both tests simultaneously
   - Real-world stress scenario
   - Comprehensive system validation

4. **`test/smoke-test.ts`** (2.2KB)
   - Quick validation (5 devices, 50 RPS)
   - Pre-load-test sanity check
   - Fast feedback loop

### Configuration

5. **`.env.load-test`**
   - Centralized configuration
   - Easy customization
   - Production/staging support

6. **`test/LOAD-TEST-README.md`** (9.4KB)
   - Complete documentation
   - Usage examples
   - Troubleshooting guide
   - Performance targets
   - CI/CD integration

### Package Updates

7. **`package.json`** (updated)
   ```json
   "scripts": {
     "test:load": "...load-test.ts",
     "test:load:api": "...api-load-test.ts", 
     "test:load:combined": "...combined-load-test.ts"
   },
   "devDependencies": {
     "ts-node": "^10.9.0",
     "axios": "^1.6.0"
   }
   ```

## 🚀 Quick Start

### 1. Configure
```bash
cd realtime
cp .env.load-test.sample .env.load-test
# Edit .env.load-test with your settings
```

### 2. Start Server
```bash
# Terminal 1
pnpm serve
```

### 3. Run Tests
```bash
# Terminal 2

# Quick smoke test (5 devices, 50 RPS, 10s)
pnpm test:smoke

# WebSocket load test (100 devices)
pnpm test:load

# API load test (1000 RPS)
pnpm test:load:api

# Combined test (100 devices + 1000 RPS)
pnpm test:load:combined
```

## 📊 Sample Output

### WebSocket Test
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
   P95:                  45ms
```

### API Test
```
📊 API LOAD TEST RESULTS
═══════════════════════════════════════════════════════════════════

⚡ Throughput:
   Target RPS:           1000
   Actual RPS:           987.3
   Achievement:          98.7%

⏱️  Latency:
   Average:              34ms
   P50 (median):         28ms
   P95:                  67ms
   P99:                  112ms
```

## 🎯 Performance Targets

### ✅ Acceptable
- 95%+ connection success
- 98%+ heartbeat ack rate  
- <100ms P95 latency
- <2% error rate
- >95% of target RPS

### ⚠️ Warning
- <90% connection success
- <95% heartbeat ack
- >150ms P95 latency
- >5% error rate

### ❌ Critical
- <80% connection success
- >300ms P95 latency
- >10% error rate

## ⚙️ Configuration Options

### Environment Variables

```bash
# Device count
DEVICE_COUNT=100

# API requests per second
TARGET_RPS=1000

# Test duration (ms)
TEST_DURATION=60000

# Heartbeat interval (ms)
HEARTBEAT_INTERVAL=15000

# Connection ramp-up time (ms)
RAMP_UP_TIME=10000

# Server URLs
WS_SERVER_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000
```

### Override Examples

```bash
# Test with 200 devices
DEVICE_COUNT=200 pnpm test:load

# Test with 2000 RPS
TARGET_RPS=2000 pnpm test:load:api

# 5-minute soak test
TEST_DURATION=300000 pnpm test:load:combined

# Quick test (10 devices, 10 seconds)
DEVICE_COUNT=10 TEST_DURATION=10000 pnpm test:load
```

## 📈 Progressive Testing

Start small and scale up:

```bash
# Phase 1: Baseline
DEVICE_COUNT=10 TARGET_RPS=100 pnpm test:load:combined

# Phase 2: Medium
DEVICE_COUNT=50 TARGET_RPS=500 pnpm test:load:combined

# Phase 3: Target
DEVICE_COUNT=100 TARGET_RPS=1000 pnpm test:load:combined

# Phase 4: Stress
DEVICE_COUNT=200 TARGET_RPS=2000 pnpm test:load:combined
```

## 🔍 What Each Test Validates

### WebSocket Load Test
- ✅ JWT authentication at scale
- ✅ Concurrent connection handling
- ✅ Heartbeat mechanism reliability
- ✅ Message delivery performance
- ✅ Connection stability
- ✅ Redis integration under load

### API Load Test
- ✅ HTTP request handling
- ✅ Rate limiting behavior
- ✅ Response time consistency
- ✅ Error handling under stress
- ✅ Endpoint performance mix
- ✅ Database query performance

### Combined Test
- ✅ System-wide stress
- ✅ Resource contention handling
- ✅ Real-world scenario simulation
- ✅ Full stack validation

## 🛠️ Features

### Real-Time Metrics
- Live progress display
- Request/response tracking
- Latency measurement (avg, min, max, P50, P95, P99)
- Error rate monitoring
- Throughput calculation

### Detailed Reporting
- Connection statistics
- Heartbeat acknowledgment rates
- Status code distribution
- Endpoint breakdown
- Performance analysis

### Configurable Load
- Adjustable device count
- Target RPS setting
- Custom test duration
- Ramp-up control
- Endpoint weights

### Production-Ready
- Graceful connection handling
- Clean disconnection
- Redis cleanup
- Error recovery
- Timeout handling

## 🔧 Troubleshooting

### Common Issues

**Low connection rate:**
```bash
# Slower ramp-up
RAMP_UP_TIME=30000 pnpm test:load
```

**High latency:**
- Check server resources (CPU, memory)
- Monitor Redis: `redis-cli --latency`
- Review server logs

**Low RPS:**
```bash
# Reduce target
TARGET_RPS=500 pnpm test:load:api
```

## 🎓 Use Cases

### Pre-Deployment Validation
Run before production deployments to ensure performance:
```bash
pnpm test:load:combined
```

### Capacity Planning
Find system limits:
```bash
DEVICE_COUNT=500 TARGET_RPS=5000 pnpm test:load:combined
```

### Performance Regression Testing
Compare results over time to detect regressions.

### Stress Testing
Test failure modes:
```bash
DEVICE_COUNT=1000 TARGET_RPS=10000 pnpm test:load:combined
```

### Soak Testing
Long-duration stability:
```bash
TEST_DURATION=1800000 pnpm test:load:combined  # 30 minutes
```

## 📊 Metrics Explained

### Latency
- **Average:** Mean response time
- **P50 (Median):** 50% of requests faster than this
- **P95:** 95% of requests faster than this (key SLA metric)
- **P99:** 99% of requests faster than this

### Throughput
- **Actual RPS:** Requests completed per second
- **Achievement:** % of target RPS reached
- **Heartbeats/sec:** Device heartbeat rate

### Reliability
- **Connection Success:** % of devices connected
- **Heartbeat Ack:** % of heartbeats acknowledged
- **Error Rate:** % of failed requests

## 🚀 Next Steps

1. **Run smoke test** to validate setup:
   ```bash
   pnpm test:smoke
   ```

2. **Baseline test** with current capacity:
   ```bash
   pnpm test:load:combined
   ```

3. **Document results** for future comparison

4. **Scale up** to find system limits

5. **Integrate with CI/CD** for automated testing

## 📚 Resources

- [Load Test README](./test/LOAD-TEST-README.md) - Detailed guide
- [E2E Test README](./test/README.md) - Functional tests
- [API Documentation](../docs/api.md) - Endpoint reference

## ✨ Summary

Created a complete load testing suite that:
- ✅ Simulates 100 concurrent WebSocket devices
- ✅ Generates 1000 API requests per second
- ✅ Provides detailed performance metrics
- ✅ Supports progressive load testing
- ✅ Integrates with CI/CD pipelines
- ✅ Includes comprehensive documentation
- ✅ Ready to use out of the box

Perfect for validating system performance before production! 🎉
