import { Module } from '@nestjs/common';
import { 
  PrometheusModule,
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/internal/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'vizora_realtime_',
        },
      },
    }),
  ],
  providers: [
    MetricsService,
    // WebSocket Metrics
    makeCounterProvider({
      name: 'ws_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['organization_id', 'status'],
    }),
    makeGaugeProvider({
      name: 'ws_connections_active',
      help: 'Currently active WebSocket connections',
      labelNames: ['organization_id'],
    }),
    makeCounterProvider({
      name: 'ws_messages_total',
      help: 'Total WebSocket messages processed',
      labelNames: ['type'],
    }),
    makeHistogramProvider({
      name: 'ws_message_duration_seconds',
      help: 'WebSocket message processing duration',
      labelNames: ['type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    }),
    // Heartbeat Metrics
    makeCounterProvider({
      name: 'heartbeat_total',
      help: 'Total heartbeats received',
      labelNames: ['success'],
    }),
    makeHistogramProvider({
      name: 'heartbeat_duration_seconds',
      help: 'Heartbeat processing duration',
      labelNames: [],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    }),
    makeCounterProvider({
      name: 'heartbeat_errors_total',
      help: 'Total heartbeat errors',
      labelNames: [],
    }),
    // Content Metrics
    makeCounterProvider({
      name: 'content_impressions_total',
      help: 'Total content impressions',
      labelNames: ['content_id'],
    }),
    makeCounterProvider({
      name: 'content_errors_total',
      help: 'Total content errors',
      labelNames: ['error_type'],
    }),
    // Device Metrics
    makeGaugeProvider({
      name: 'device_status',
      help: 'Device status (1=online, 0=offline, -1=error)',
      labelNames: ['device_id'],
    }),
    makeGaugeProvider({
      name: 'device_cpu_usage',
      help: 'Device CPU usage percentage',
      labelNames: ['device_id'],
    }),
    makeGaugeProvider({
      name: 'device_memory_usage',
      help: 'Device memory usage percentage',
      labelNames: ['device_id'],
    }),
    // HTTP Metrics
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'path'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    }),
    // Redis Metrics
    makeCounterProvider({
      name: 'redis_operations_total',
      help: 'Total Redis operations',
      labelNames: ['operation'],
    }),
    makeHistogramProvider({
      name: 'redis_operation_duration_seconds',
      help: 'Redis operation duration',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    }),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
