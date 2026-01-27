# Monitoring & Observability Setup

## 📊 Overview

Vizora Realtime service includes comprehensive monitoring via:
- **Sentry** - Error tracking and performance monitoring
- **Prometheus** - Metrics collection and alerting

## 🔧 Configuration

### 1. Sentry Setup

#### Create Sentry Project
1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project (Node.js)
3. Copy your DSN

#### Configure Environment
Add to `.env`:
```env
SENTRY_DSN=https://your-key@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
RELEASE_VERSION=1.0.0
```

#### What's Tracked
- ✅ Unhandled exceptions
- ✅ HTTP 5xx errors
- ✅ WebSocket connection errors
- ✅ Heartbeat failures
- ✅ Content playback errors
- ✅ Performance traces (10% sample)

#### Ignored Errors
Sentry filters out common non-critical errors:
- Connection timeouts (ETIMEDOUT)
- Network errors (ECONNRESET)
- Invalid JWT tokens
- DNS resolution failures

### 2. Prometheus Setup

#### Metrics Endpoint
Metrics are automatically exposed at:
```
http://localhost:3001/metrics
```

#### Available Metrics

**WebSocket Metrics:**
- `vizora_realtime_ws_connections_total` - Total connections (by org, status)
- `vizora_realtime_ws_connections_active` - Active connections
- `vizora_realtime_ws_messages_total` - Messages processed
- `vizora_realtime_ws_message_duration_seconds` - Message processing time

**Heartbeat Metrics:**
- `vizora_realtime_heartbeat_total` - Total heartbeats (by device, success)
- `vizora_realtime_heartbeat_duration_seconds` - Heartbeat processing time
- `vizora_realtime_heartbeat_errors_total` - Heartbeat failures

**Content Metrics:**
- `vizora_realtime_content_impressions_total` - Content views
- `vizora_realtime_content_errors_total` - Content errors

**Device Metrics:**
- `vizora_realtime_device_status` - Device online status (1=online, 0=offline)
- `vizora_realtime_device_cpu_usage` - Device CPU %
- `vizora_realtime_device_memory_usage` - Device memory %

**HTTP Metrics:**
- `vizora_realtime_http_requests_total` - HTTP requests (by method, path, status)
- `vizora_realtime_http_request_duration_seconds` - Request latency

**Redis Metrics:**
- `vizora_realtime_redis_operations_total` - Redis operations
- `vizora_realtime_redis_operation_duration_seconds` - Redis latency

**System Metrics (default):**
- `process_cpu_user_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_gc_duration_seconds` - Garbage collection time

#### Configure Prometheus Server

Create `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'vizora-realtime'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

Start Prometheus:
```bash
# Via Docker
docker run -d \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Or download and run
./prometheus --config.file=prometheus.yml
```

Access Prometheus UI: http://localhost:9090

## 📈 Grafana Dashboards

### Setup Grafana

```bash
# Via Docker
docker run -d \
  -p 3003:3000 \
  --name=grafana \
  grafana/grafana
```

Access Grafana: http://localhost:3003 (admin/admin)

### Add Prometheus Data Source

1. Configuration → Data Sources → Add data source
2. Select Prometheus
3. URL: `http://localhost:9090`
4. Save & Test

### Import Dashboard

Create a new dashboard with these panels:

#### WebSocket Connections
```promql
vizora_realtime_ws_connections_active
```

#### Heartbeat Success Rate
```promql
rate(vizora_realtime_heartbeat_total{success="true"}[5m]) /
rate(vizora_realtime_heartbeat_total[5m]) * 100
```

#### P95 Latency
```promql
histogram_quantile(0.95, 
  rate(vizora_realtime_http_request_duration_seconds_bucket[5m])
)
```

#### Error Rate
```promql
rate(vizora_realtime_http_requests_total{status=~"5.."}[5m])
```

#### Memory Usage
```promql
process_resident_memory_bytes / 1024 / 1024
```

#### Device Status
```promql
sum(vizora_realtime_device_status == 1)
```

## 🚨 Alerting

### Prometheus Alerts

Create `alerts.yml`:
```yaml
groups:
  - name: vizora_realtime
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(vizora_realtime_http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} per second"

      # Heartbeat failures
      - alert: HeartbeatFailures
        expr: rate(vizora_realtime_heartbeat_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High heartbeat failure rate"

      # High latency
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(vizora_realtime_http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency above 500ms"

      # Connection drops
      - alert: ConnectionDrops
        expr: rate(vizora_realtime_ws_connections_total{status="disconnected"}[5m]) > 1
        for: 5m
        labels:
          severity: info
        annotations:
          summary: "High connection drop rate"

      # Memory usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes > 1073741824
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Memory usage above 1GB"
```

### Alertmanager Configuration

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack'

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: 'Vizora Realtime Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}: {{ .Annotations.description }}{{ end }}'
```

### Sentry Alerts

Configure in Sentry dashboard:
1. Alerts → Create Alert Rule
2. Conditions:
   - Errors > 10 in 5 minutes
   - Performance degradation
   - High transaction duration
3. Actions:
   - Send email
   - Slack notification
   - PagerDuty (optional)

## 🔍 Querying Metrics

### Useful Prometheus Queries

**Active Devices:**
```promql
sum(vizora_realtime_device_status == 1)
```

**Heartbeat Rate:**
```promql
rate(vizora_realtime_heartbeat_total[1m])
```

**Average Latency:**
```promql
rate(vizora_realtime_http_request_duration_seconds_sum[5m]) /
rate(vizora_realtime_http_request_duration_seconds_count[5m])
```

**Top Error Endpoints:**
```promql
topk(5, rate(vizora_realtime_http_requests_total{status=~"5.."}[5m]))
```

**Memory Growth:**
```promql
deriv(process_resident_memory_bytes[1h])
```

## 📱 Production Checklist

### Sentry
- [ ] Set production DSN
- [ ] Configure release tracking
- [ ] Set up alerts
- [ ] Enable user feedback
- [ ] Configure source maps

### Prometheus
- [ ] Configure scrape interval (15s recommended)
- [ ] Set up retention (15d minimum)
- [ ] Enable remote write (for long-term storage)
- [ ] Configure service discovery
- [ ] Set up backup/HA

### Grafana
- [ ] Create comprehensive dashboards
- [ ] Set up user access
- [ ] Configure notifications
- [ ] Enable SSL
- [ ] Set up backup

### Alerting
- [ ] Configure Alertmanager
- [ ] Set up notification channels (Slack, email, PagerDuty)
- [ ] Define escalation policies
- [ ] Test alert delivery
- [ ] Document on-call procedures

## 🎯 Monitoring Best Practices

1. **Set Baselines:** Run load tests to establish normal metrics
2. **Alert Fatigue:** Start with high thresholds, tune down gradually
3. **Dashboards:** Create dashboards for different audiences (ops, devs, business)
4. **Documentation:** Document what each alert means and how to resolve it
5. **Regular Review:** Review and update alerts monthly
6. **Incident Response:** Use metrics to diagnose issues during incidents
7. **Capacity Planning:** Use trends to predict scaling needs

## 🔗 Resources

- [Sentry Docs](https://docs.sentry.io/)
- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [NestJS Prometheus](https://github.com/willsoto/nestjs-prometheus)
- [Sentry NestJS](https://docs.sentry.io/platforms/javascript/guides/nestjs/)

## 🆘 Troubleshooting

### Sentry Not Receiving Events
1. Check DSN is correct
2. Verify `NODE_ENV` (dev events are filtered by default)
3. Check network connectivity to sentry.io
4. Enable `SENTRY_DEBUG=true`

### Prometheus Metrics Not Showing
1. Verify service is running on correct port
2. Check `/metrics` endpoint is accessible
3. Verify Prometheus scrape config
4. Check Prometheus targets page

### High Memory Usage
1. Check for memory leaks in logs
2. Monitor GC metrics
3. Review connection pool sizes
4. Consider horizontal scaling

---

**Status:** ✅ Monitoring configured and ready to use!
