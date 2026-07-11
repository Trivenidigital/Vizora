import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DEVICE_OFFLINE_THRESHOLD_MS } from '@vizora/database';
import { DatabaseService } from '../database/database.service';
import { ClickHouseService } from './clickhouse.service';

/**
 * §12a freshness watchdog for the device-health time-series.
 *
 * If displays are actively heartbeating (so the realtime writer SHOULD be
 * producing ClickHouse samples) but no `device_health_samples` row has landed
 * inside the staleness window, the ingestion path has silently broken — a
 * refactor disconnected the writer, the batch flush is wedged, etc. That is
 * exactly the class of silent failure §12a exists to surface, so we fire an
 * out-of-band operator alert (Sentry, mirroring McpAuditService.alertWrite-
 * AuditFailure) rather than let uptime quietly rot.
 *
 * Fail-open: when ClickHouse itself is unreachable we CANNOT tell whether
 * samples stopped, so we skip (debug-log) instead of alert-storming — the
 * CH-down case is handled by graceful degradation elsewhere, not here.
 */
@Injectable()
export class ClickHouseWatchdogService {
  private readonly logger = new Logger(ClickHouseWatchdogService.name);

  /** Alert if no sample has arrived in this long while displays are active. */
  private readonly staleThresholdMs = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly db: DatabaseService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  // Every 15 minutes (second 0). NB: do NOT use `CronExpression.EVERY_15_MINUTES`
  // — @nestjs/schedule's CronExpression enum has no such member (only 10/30),
  // so it resolves to `undefined`, which makes ScheduleModule bootstrap hand an
  // undefined expression to the cron parser and crash the whole app at
  // `app.listen()` (a TypeError that unit tests, which call this method
  // directly, never exercise). An explicit expression is unambiguous and safe.
  @Cron('0 */15 * * * *')
  async checkDeviceHealthFreshness(): Promise<void> {
    try {
      if (!this.clickhouse.isEnabled) return;

      // Displays that heartbeated recently → the writer should be inserting.
      const activeSince = new Date(Date.now() - DEVICE_OFFLINE_THRESHOLD_MS);
      const activeDisplays = await this.db.display.count({
        where: { lastHeartbeat: { gte: activeSince } },
      });
      if (activeDisplays === 0) return; // nothing should be producing samples

      const freshness = await this.clickhouse.getLatestSampleTime();
      if (!freshness.available) {
        // ClickHouse unreachable — cannot confirm samples stopped. Fail-open.
        this.logger.debug('ClickHouse unavailable; skipping device-health freshness check');
        return;
      }

      if (freshness.lastSample === null) {
        this.alertStale(
          `${activeDisplays} display(s) are active but device_health_samples is empty — ` +
            'device-health ingestion appears broken',
          { activeDisplays, lastSampleAgeMinutes: null },
        );
        return;
      }

      const ageMs = Date.now() - freshness.lastSample.getTime();
      if (ageMs > this.staleThresholdMs) {
        this.alertStale(
          `${activeDisplays} display(s) are active but the newest device_health_samples row is ` +
            `${Math.round(ageMs / 60000)}m old — device-health ingestion appears stalled`,
          { activeDisplays, lastSampleAgeMinutes: Math.round(ageMs / 60000) },
        );
      }
    } catch (err) {
      // The watchdog itself must never crash the process.
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Device-health freshness check failed: ${detail}`);
    }
  }

  /**
   * Out-of-band operator alert. Routes through Sentry (already wired in
   * middleware; fans out to whatever channels ops configured) plus a
   * logger.error fallback. Lazy-require Sentry so unit tests don't need it
   * mocked — mirrors McpAuditService.alertWriteAuditFailure.
   */
  private alertStale(message: string, extra: Record<string, unknown>): void {
    this.logger.error(`[device-health-watchdog] ${message}`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nestjs');
      Sentry.captureMessage(`device-health ingestion stale — ${message}`, {
        level: 'error',
        tags: { event: 'device_health_samples_stale' },
        extra,
      });
    } catch {
      /* Sentry not loaded (e.g. unit tests) — logger.error above is the fallback. */
    }
  }
}
