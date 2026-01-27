# 📊 Monitoring & Observability - Summary

## ✅ What We Configured

### 1. Sentry Integration (Error Tracking)

**Files Created:**
- `src/config/sentry.config.ts` - Sentry initialization
- `src/interceptors/sentry.interceptor.ts` - Global error interceptor

**Features:**
- ✅ Automatic error capture (5xx errors + exceptions)
- ✅ Performance monitoring (10% trace sampling)
- ✅ Request context tracking
- ✅ User context (device ID, org ID)
- ✅ Error filtering (ignores common non-critical errors)
- ✅ Environment-aware (dev/staging/production)

**Configuration:**
```env
SENTRY_DSN=https://your-key@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
RELEASE_VERSION=1.0.0
```

### 2. Prometheus Metrics (Performance Monitoring)

**Files Created:**
- `src/metrics/metrics.module.ts` - Metrics module setup
- `src/metrics/metrics.service.ts` - Metrics collection service
- `src/interceptors/metrics.interceptor.ts` - HTTP metrics interceptor

**Metrics Exposed:**

**WebSocket:**
- `ws_connections_total` - Total connections
- `ws_connections_active` - Active connections
- `ws_messages_total` - Messages processed
- `ws_message_duration_seconds` - Message processing time

**Heartbeat:**
- `heartbeat_total` - Total heartbeats
- `heartbeat_duration_seconds` - Processing time
- `heartbeat_errors_total` - Failures

**Content:**
- `content_impressions_total` - Content views
- `content_errors_total` - Content errors

**Device:**
- `device_status` - Device online/offline status
- `device_cpu_usage` - CPU usage %
- `device_memory_usage` - Memory usage %

**HTTP:**
- `http_requests_total` - Request count
- `http_request_duration_seconds` - Latency

**Redis:**
- `redis_operations_total` - Operation count
- `redis_operation_duration_seconds` - Latency

**Endpoint:** `http://localhost:3001/metrics`

### 3. Configuration Files

**Prometheus:**
- `prometheus.yml` - Scrape configuration
- `alerts.yml` - 20+ alert rules
- `alertmanager.yml` - Notification routing

**Grafana:**
- `grafana-dashboard.json` - Pre-built dashboard

**Docker:**
- `docker-compose.monitoring.yml` - Full monitoring stack

### 4. Code Integration

**Updated Files:**
- `src/app/app.module.ts` - Added interceptors
- `src/main.ts` - Sentry initialization
- `src/gateways/device.gateway.ts` - Metrics tracking

## 🚀 Quick Start

### 1. Configure Environment

Edit `.env`:
```bash
# Sentry (get DSN from sentry.io)
SENTRY_DSN=https://your-key@sentry.io/project-id

# Optional: Adjust sampling
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### 2. Start Monitoring Stack

```bash
# Start Prometheus + Grafana + Redis
docker-compose -f docker-compose.monitoring.yml up -d

# Or manually:
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3003 (admin/admin)
# Alertmanager: http://localhost:9093
```

### 3. Start Application

```bash
cd realtime
pnpm nx serve realtime
```

### 4. Access Dashboards

- **Metrics:** http://localhost:3001/metrics
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3003
- **Alertmanager:** http://localhost:9093

## 📈 Available Metrics Examples

### Active WebSocket Connections
```
vizora_realtime_ws_connections_active 42
```

### Request Latency (P95)
```promql
histogram_quantile(0.95, 
  rate(vizora_realtime_http_request_duration_seconds_bucket[5m])
)
```

### Heartbeat Success Rate
```promql
rate(vizora_realtime_heartbeat_total{success="true"}[5m]) /
rate(vizora_realtime_heartbeat_total[5m]) * 100
```

### Device Status
```promql
sum(vizora_realtime_device_status == 1)
```

## 🚨 Alert Rules

**20+ pre-configured alerts including:**
- High error rate (>5% for 5min)
- High latency (P95 >500ms)
- Connection drops
- Heartbeat failures
- Memory usage (>1GB warning, >2GB critical)
- Service down
- Content errors
- Redis latency

## 📊 Grafana Dashboard

**10 panels showing:**
1. Active WebSocket Connections
2. Total Devices Online
3. Request Rate
4. Error Rate
5. HTTP Request Latency (P95)
6. WebSocket Connection Rate
7. Heartbeat Success Rate
8. Memory Usage
9. HTTP Requests by Status
10. Content Errors by Type

## 🔧 Customization

### Add Custom Metric

```typescript
// In metrics.service.ts
@InjectMetric('my_custom_metric')
public myCustomMetric: Counter<string>;

// Use it
this.metricsService.myCustomMetric.inc({ label: 'value' });
```

### Add Custom Alert

Edit `alerts.yml`:
```yaml
- alert: MyCustomAlert
  expr: my_custom_metric > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Custom alert fired"
```

### Configure Slack Notifications

Edit `alertmanager.yml`:
```yaml
global:
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

receivers:
  - name: 'slack'
    slack_configs:
      - channel: '#alerts'
```

## 📚 Documentation

- **Setup Guide:** `MONITORING-SETUP.md` (detailed instructions)
- **Environment Example:** `.env.example`
- **Prometheus Config:** `prometheus.yml`
- **Alert Rules:** `alerts.yml`
- **Docker Stack:** `docker-compose.monitoring.yml`

## ✅ Testing Monitoring

### Test Metrics Endpoint
```bash
curl http://localhost:3001/metrics
```

### Trigger Test Alert
```bash
# Generate errors
for i in {1..100}; do
  curl http://localhost:3001/api/nonexistent
done
```

### Check Prometheus
```bash
# Open Prometheus UI
open http://localhost:9090

# Query metrics
vizora_realtime_http_requests_total
```

### View Grafana Dashboard
```bash
# Open Grafana
open http://localhost:3003

# Login: admin/admin
# Navigate to Dashboards → Vizora Realtime Service
```

## 🎯 Production Checklist

- [ ] Set production Sentry DSN
- [ ] Configure alert notifications (Slack/Email/PagerDuty)
- [ ] Set up Grafana access control
- [ ] Enable Prometheus remote write (long-term storage)
- [ ] Configure retention policies
- [ ] Set up backup for Grafana dashboards
- [ ] Test alert delivery
- [ ] Document runbooks for each alert
- [ ] Set up on-call rotation
- [ ] Enable SSL for Grafana

## 💡 Best Practices

1. **Baseline Performance:** Run load tests to establish normal metrics
2. **Tune Alerts:** Start with high thresholds, adjust based on noise
3. **Regular Reviews:** Review metrics and alerts weekly
4. **Incident Response:** Use metrics to diagnose issues
5. **Capacity Planning:** Monitor trends for scaling decisions
6. **Documentation:** Keep runbooks updated

## 🔗 Resources

- [Sentry Docs](https://docs.sentry.io/)
- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [Alert Best Practices](https://prometheus.io/docs/practices/alerting/)

---

**Status:** ✅ Monitoring fully configured and ready for production!
