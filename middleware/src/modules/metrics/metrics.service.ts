import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register: client.Registry;

  readonly httpRequestsTotal: client.Counter<string>;
  readonly httpRequestDuration: client.Histogram<string>;
  readonly httpErrorsTotal: client.Counter<string>;

  // Webhook delivery audit — see WebhooksService.recordAttempt.
  // Two counters by design:
  //   - webhookDeliveriesTotal — every attempted dispatch, labeled by
  //     status (success | failure | blocked) and event. Used for
  //     dashboards + as a freshness signal: if this counter stalls
  //     while customers have active webhooks, dispatch is broken.
  //   - webhookAuditFailuresTotal — audit row insert failed (table
  //     missing, FK drift, transient DB issue). Recorded separately
  //     so the operator can alert on ANY non-zero value (per the
  //     CLAUDE.md §12 silent-failure prevention rule — audit losing
  //     rows must surface immediately).
  readonly webhookDeliveriesTotal: client.Counter<string>;
  readonly webhookAuditFailuresTotal: client.Counter<string>;

  constructor() {
    this.register = new client.Registry();

    client.collectDefaultMetrics({ register: this.register });

    this.httpRequestsTotal = new client.Counter({
      name: 'vizora_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.register],
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'vizora_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register],
    });

    this.httpErrorsTotal = new client.Counter({
      name: 'vizora_http_errors_total',
      help: 'Total number of HTTP error responses (4xx + 5xx)',
      labelNames: ['method', 'path', 'status'],
      registers: [this.register],
    });

    this.webhookDeliveriesTotal = new client.Counter({
      name: 'vizora_webhook_deliveries_total',
      help: 'Webhook delivery attempts, by outcome status and event name',
      labelNames: ['status', 'event'],
      registers: [this.register],
    });

    this.webhookAuditFailuresTotal = new client.Counter({
      name: 'vizora_webhook_audit_failures_total',
      help: 'Webhook delivery audit row insert failed — alert on any non-zero value (silent-failure prevention)',
      labelNames: ['event'],
      registers: [this.register],
    });
  }

  onModuleInit() {
    this.register.setDefaultLabels({ app: 'vizora-middleware' });
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}
