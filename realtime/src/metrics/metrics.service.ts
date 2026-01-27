import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram, Summary } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    // WebSocket Metrics
    @InjectMetric('ws_connections_total')
    public wsConnectionsTotal: Counter<string>,

    @InjectMetric('ws_connections_active')
    public wsConnectionsActive: Gauge<string>,

    @InjectMetric('ws_messages_total')
    public wsMessagesTotal: Counter<string>,

    @InjectMetric('ws_message_duration_seconds')
    public wsMessageDuration: Histogram<string>,

    // Heartbeat Metrics
    @InjectMetric('heartbeat_total')
    public heartbeatTotal: Counter<string>,

    @InjectMetric('heartbeat_duration_seconds')
    public heartbeatDuration: Histogram<string>,

    @InjectMetric('heartbeat_errors_total')
    public heartbeatErrorsTotal: Counter<string>,

    // Content Metrics
    @InjectMetric('content_impressions_total')
    public contentImpressionsTotal: Counter<string>,

    @InjectMetric('content_errors_total')
    public contentErrorsTotal: Counter<string>,

    // Device Metrics
    @InjectMetric('device_status')
    public deviceStatus: Gauge<string>,

    @InjectMetric('device_cpu_usage')
    public deviceCpuUsage: Gauge<string>,

    @InjectMetric('device_memory_usage')
    public deviceMemoryUsage: Gauge<string>,

    // API Metrics
    @InjectMetric('http_requests_total')
    public httpRequestsTotal: Counter<string>,

    @InjectMetric('http_request_duration_seconds')
    public httpRequestDuration: Histogram<string>,

    // Redis Metrics
    @InjectMetric('redis_operations_total')
    public redisOperationsTotal: Counter<string>,

    @InjectMetric('redis_operation_duration_seconds')
    public redisOperationDuration: Histogram<string>,
  ) {}

  /**
   * Record WebSocket connection
   */
  recordConnection(organizationId: string, status: 'connected' | 'disconnected') {
    this.wsConnectionsTotal.inc({ organization_id: organizationId, status });
    
    if (status === 'connected') {
      this.wsConnectionsActive.inc({ organization_id: organizationId });
    } else {
      this.wsConnectionsActive.dec({ organization_id: organizationId });
    }
  }

  /**
   * Record WebSocket message
   */
  recordMessage(type: string, durationSeconds: number) {
    this.wsMessagesTotal.inc({ type });
    this.wsMessageDuration.observe({ type }, durationSeconds);
  }

  /**
   * Record heartbeat
   */
  recordHeartbeat(deviceId: string, success: boolean, durationSeconds: number) {
    this.heartbeatTotal.inc({ device_id: deviceId, success: success.toString() });
    this.heartbeatDuration.observe({ device_id: deviceId }, durationSeconds);
    
    if (!success) {
      this.heartbeatErrorsTotal.inc({ device_id: deviceId });
    }
  }

  /**
   * Record content impression
   */
  recordImpression(deviceId: string, contentId: string) {
    this.contentImpressionsTotal.inc({ device_id: deviceId, content_id: contentId });
  }

  /**
   * Record content error
   */
  recordContentError(deviceId: string, errorType: string) {
    this.contentErrorsTotal.inc({ device_id: deviceId, error_type: errorType });
  }

  /**
   * Update device status
   */
  updateDeviceStatus(deviceId: string, status: 'online' | 'offline' | 'error') {
    const statusValue = status === 'online' ? 1 : status === 'offline' ? 0 : -1;
    this.deviceStatus.set({ device_id: deviceId }, statusValue);
  }

  /**
   * Update device metrics
   */
  updateDeviceMetrics(deviceId: string, cpuUsage: number, memoryUsage: number) {
    this.deviceCpuUsage.set({ device_id: deviceId }, cpuUsage);
    this.deviceMemoryUsage.set({ device_id: deviceId }, memoryUsage);
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method: string, path: string, status: number, durationSeconds: number) {
    this.httpRequestsTotal.inc({ method, path, status: status.toString() });
    this.httpRequestDuration.observe({ method, path }, durationSeconds);
  }

  /**
   * Record Redis operation
   */
  recordRedisOperation(operation: string, durationSeconds: number) {
    this.redisOperationsTotal.inc({ operation });
    this.redisOperationDuration.observe({ operation }, durationSeconds);
  }
}
