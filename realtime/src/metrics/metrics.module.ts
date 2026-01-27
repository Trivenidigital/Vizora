import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'vizora_realtime_',
        },
      },
      customMetricPrefix: 'vizora_realtime_',
    }),
  ],
  providers: [
    MetricsService,
    // WebSocket Metrics
    {
      provide: 'ws_connections_total',
      useFactory: () => ({
        name: 'ws_connections_total',
        help: 'Total number of WebSocket connections',
        labelNames: ['organization_id', 'status'],
      }),
    },
    {
      provide: 'ws_connections_active',
      useFactory: () => ({
        name: 'ws_connections_active',
        help: 'Currently active WebSocket connections',
        labelNames: ['organization_id'],
      }),
    },
    {
      provide: 'ws_messages_total',
      useFactory: () => ({
        name: 'ws_messages_total',
        help: 'Total WebSocket messages processed',
        labelNames: ['type'],
      }),
    },
    {
      provide: 'ws_message_duration_seconds',
      useFactory: () => ({
        name: 'ws_message_duration_seconds',
        help: 'WebSocket message processing duration',
        labelNames: ['type'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      }),
    },
    // Heartbeat Metrics
    {
      provide: 'heartbeat_total',
      useFactory: () => ({
        name: 'heartbeat_total',
        help: 'Total heartbeats received',
        labelNames: ['device_id', 'success'],
      }),
    },
    {
      provide: 'heartbeat_duration_seconds',
      useFactory: () => ({
        name: 'heartbeat_duration_seconds',
        help: 'Heartbeat processing duration',
        labelNames: ['device_id'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      }),
    },
    {
      provide: 'heartbeat_errors_total',
      useFactory: () => ({
        name: 'heartbeat_errors_total',
        help: 'Total heartbeat errors',
        labelNames: ['device_id'],
      }),
    },
    // Content Metrics
    {
      provide: 'content_impressions_total',
      useFactory: () => ({
        name: 'content_impressions_total',
        help: 'Total content impressions',
        labelNames: ['device_id', 'content_id'],
      }),
    },
    {
      provide: 'content_errors_total',
      useFactory: () => ({
        name: 'content_errors_total',
        help: 'Total content errors',
        labelNames: ['device_id', 'error_type'],
      }),
    },
    // Device Metrics
    {
      provide: 'device_status',
      useFactory: () => ({
        name: 'device_status',
        help: 'Device status (1=online, 0=offline, -1=error)',
        labelNames: ['device_id'],
      }),
    },
    {
      provide: 'device_cpu_usage',
      useFactory: () => ({
        name: 'device_cpu_usage',
        help: 'Device CPU usage percentage',
        labelNames: ['device_id'],
      }),
    },
    {
      provide: 'device_memory_usage',
      useFactory: () => ({
        name: 'device_memory_usage',
        help: 'Device memory usage percentage',
        labelNames: ['device_id'],
      }),
    },
    // HTTP Metrics
    {
      provide: 'http_requests_total',
      useFactory: () => ({
        name: 'http_requests_total',
        help: 'Total HTTP requests',
        labelNames: ['method', 'path', 'status'],
      }),
    },
    {
      provide: 'http_request_duration_seconds',
      useFactory: () => ({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration',
        labelNames: ['method', 'path'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      }),
    },
    // Redis Metrics
    {
      provide: 'redis_operations_total',
      useFactory: () => ({
        name: 'redis_operations_total',
        help: 'Total Redis operations',
        labelNames: ['operation'],
      }),
    },
    {
      provide: 'redis_operation_duration_seconds',
      useFactory: () => ({
        name: 'redis_operation_duration_seconds',
        help: 'Redis operation duration',
        labelNames: ['operation'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      }),
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
