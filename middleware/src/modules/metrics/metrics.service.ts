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

  // Persistent-offline reconciliation (internal operational signal only — this
  // path deliberately sends no customer notifications; see
  // docs/plans/2026-08-02-persistent-offline-monitoring.md).
  //
  // A GAUGE, not a counter, and deliberately unlabelled by organisation:
  //   - gauge, because middleware runs two PM2 cluster instances and the cron
  //     fires in each, so `set()` must be idempotent where `inc()` would double;
  //   - unlabelled, because a per-org label would expose cross-tenant fleet
  //     detail through /internal/metrics, which is exactly the exposure this
  //     design was written to avoid.
  readonly persistentOfflineDisplays: client.Gauge<string>;
  readonly persistentOfflineReconcileDuration: client.Histogram<string>;
  readonly persistentOfflineReconcileFailures: client.Counter<string>;

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

    this.persistentOfflineDisplays = new client.Gauge({
      name: 'vizora_persistent_offline_displays',
      help: 'Displays offline beyond the shared threshold, fleet-wide, excluding operator-disabled ones',
      registers: [this.register],
    });

    this.persistentOfflineReconcileDuration = new client.Histogram({
      name: 'vizora_persistent_offline_reconcile_duration_seconds',
      help: 'Wall time of one persistent-offline reconciliation pass',
      registers: [this.register],
    });

    this.persistentOfflineReconcileFailures = new client.Counter({
      name: 'vizora_persistent_offline_reconcile_failures_total',
      help: 'Persistent-offline reconciliation threw — alert on any non-zero value; the offline count is stale while this climbs',
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
