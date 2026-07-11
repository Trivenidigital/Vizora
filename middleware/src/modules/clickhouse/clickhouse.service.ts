import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import {
  DEVICE_HEALTH_SAMPLES_TABLE,
  DEVICE_HEALTH_SAMPLES_DDL,
  UPTIME_BUCKET_INTERVAL_SQL,
  resolveClickHouseConfig,
  formatClickHouseDateTime,
  parseClickHouseDateTime,
} from './clickhouse.constants';

/**
 * Uptime aggregate for one device over a window, as measured from the durable
 * `device_health_samples` time-series. `upBuckets` is the count of distinct
 * time-buckets that held ≥1 sample (a heartbeat means the device was online in
 * that bucket); `sampleCount === 0` means "no history" → insufficient data.
 */
export interface DeviceHealthUptimeAggregate {
  deviceId: string;
  upBuckets: number;
  sampleCount: number;
  firstSample: Date;
  lastSample: Date;
}

/** Result of a freshness probe. `available:false` = ClickHouse unreachable. */
export interface ClickHouseFreshness {
  available: boolean;
  lastSample: Date | null;
}

/**
 * Read + schema + freshness side of ClickHouse for the middleware.
 *
 * ═══ FAIL-OPEN CONTRACT ═══ (same non-negotiable as the realtime writer)
 * ClickHouse is optional infrastructure. Every query is wrapped: on any error
 * (unreachable, bad response, missing table) the method returns `null` and the
 * caller treats it as "insufficient data" — NEVER a fabricated number, NEVER a
 * thrown error, NEVER a crashed request. The client connects lazily.
 */
@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseService.name);
  private client: ClickHouseClient | null = null;
  private readonly enabled: boolean;
  private lastErrorLogAt = 0;
  private readonly errorLogThrottleMs = 60_000;

  constructor() {
    // Default ON; opt out with CLICKHOUSE_ENABLED=false. Never hard-fails boot.
    this.enabled = process.env.CLICKHOUSE_ENABLED !== 'false';
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('ClickHouse disabled (CLICKHOUSE_ENABLED=false) — uptime reads return insufficient data');
      return;
    }
    // Best-effort schema bootstrap; fail-open (docker init.sql is canonical).
    void this.ensureSchema();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        /* ignore — shutting down */
      }
      this.client = null;
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Best-effort idempotent schema creation. Never throws. */
  async ensureSchema(): Promise<void> {
    try {
      const client = this.getClient();
      if (!client) return;
      await client.command({
        query: DEVICE_HEALTH_SAMPLES_DDL,
        clickhouse_settings: { wait_end_of_query: 1 },
      });
    } catch (err) {
      this.logThrottled('Failed to ensure ClickHouse device_health_samples schema', err);
    }
  }

  /**
   * Uptime aggregate for one device since `since`. Returns null when ClickHouse
   * is unavailable or errors (caller → insufficient data). A device with no
   * samples returns an aggregate with `sampleCount: 0`.
   */
  async getDeviceUptimeAggregate(
    organizationId: string,
    deviceId: string,
    since: Date,
  ): Promise<DeviceHealthUptimeAggregate | null> {
    try {
      const client = this.getClient();
      if (!client) return null;
      const resultSet = await client.query({
        query: `
          SELECT
            uniqExact(toStartOfInterval(event_time, ${UPTIME_BUCKET_INTERVAL_SQL})) AS up_buckets,
            count() AS sample_count,
            min(event_time) AS first_sample,
            max(event_time) AS last_sample
          FROM ${DEVICE_HEALTH_SAMPLES_TABLE}
          WHERE organizationId = {organizationId:String}
            AND deviceId = {deviceId:String}
            AND event_time >= {since:DateTime}
        `,
        query_params: {
          organizationId,
          deviceId,
          since: formatClickHouseDateTime(since),
        },
        format: 'JSONEachRow',
      });
      const rows = await resultSet.json<{
        up_buckets: string | number;
        sample_count: string | number;
        first_sample: string;
        last_sample: string;
      }>();
      const row = rows[0];
      if (!row) return { deviceId, upBuckets: 0, sampleCount: 0, firstSample: since, lastSample: since };
      return {
        deviceId,
        upBuckets: Number(row.up_buckets),
        sampleCount: Number(row.sample_count),
        firstSample: parseClickHouseDateTime(row.first_sample),
        lastSample: parseClickHouseDateTime(row.last_sample),
      };
    } catch (err) {
      this.logThrottled(`Failed to query device uptime for ${deviceId}`, err);
      return null;
    }
  }

  /**
   * Uptime aggregates for every device in an org that has samples since `since`.
   * Returns null when ClickHouse is unavailable/errors. Devices with no samples
   * are simply absent from the array (caller marks them insufficient).
   */
  async getOrgUptimeAggregates(
    organizationId: string,
    since: Date,
  ): Promise<DeviceHealthUptimeAggregate[] | null> {
    try {
      const client = this.getClient();
      if (!client) return null;
      const resultSet = await client.query({
        query: `
          SELECT
            deviceId,
            uniqExact(toStartOfInterval(event_time, ${UPTIME_BUCKET_INTERVAL_SQL})) AS up_buckets,
            count() AS sample_count,
            min(event_time) AS first_sample,
            max(event_time) AS last_sample
          FROM ${DEVICE_HEALTH_SAMPLES_TABLE}
          WHERE organizationId = {organizationId:String}
            AND event_time >= {since:DateTime}
          GROUP BY deviceId
        `,
        query_params: {
          organizationId,
          since: formatClickHouseDateTime(since),
        },
        format: 'JSONEachRow',
      });
      const rows = await resultSet.json<{
        deviceId: string;
        up_buckets: string | number;
        sample_count: string | number;
        first_sample: string;
        last_sample: string;
      }>();
      return rows.map((row) => ({
        deviceId: row.deviceId,
        upBuckets: Number(row.up_buckets),
        sampleCount: Number(row.sample_count),
        firstSample: parseClickHouseDateTime(row.first_sample),
        lastSample: parseClickHouseDateTime(row.last_sample),
      }));
    } catch (err) {
      this.logThrottled(`Failed to query org uptime for ${organizationId}`, err);
      return null;
    }
  }

  /**
   * Platform-wide latest sample time, for the freshness watchdog. `available`
   * distinguishes "ClickHouse unreachable" (don't alert — can't tell) from
   * "reachable but no recent samples" (`lastSample: null` → alert-worthy).
   */
  async getLatestSampleTime(): Promise<ClickHouseFreshness> {
    try {
      const client = this.getClient();
      if (!client) return { available: false, lastSample: null };
      // Bounded to the last day so ClickHouse prunes to recent partitions — the
      // watchdog only cares about a <=15-min staleness threshold, so a 1-day
      // window always captures a "fresh" sample while keeping the scan cheap.
      const resultSet = await client.query({
        query: `
          SELECT max(event_time) AS last_sample, count() AS sample_count
          FROM ${DEVICE_HEALTH_SAMPLES_TABLE}
          WHERE event_time >= now() - INTERVAL 1 DAY
        `,
        format: 'JSONEachRow',
      });
      const rows = await resultSet.json<{ last_sample: string; sample_count: string | number }>();
      const row = rows[0];
      if (!row || Number(row.sample_count) === 0) {
        return { available: true, lastSample: null };
      }
      return { available: true, lastSample: parseClickHouseDateTime(row.last_sample) };
    } catch (err) {
      this.logThrottled('Failed to query ClickHouse sample freshness', err);
      return { available: false, lastSample: null };
    }
  }

  /** Readiness probe. Returns false on any error (never throws). */
  async isHealthy(): Promise<boolean> {
    try {
      const client = this.getClient();
      if (!client) return false;
      const result = await client.ping();
      return result.success === true;
    } catch {
      return false;
    }
  }

  /** Lazily create the client. Returns null (never throws) on failure. */
  private getClient(): ClickHouseClient | null {
    if (!this.enabled) return null;
    if (this.client) return this.client;
    try {
      this.client = createClient(resolveClickHouseConfig());
      return this.client;
    } catch (err) {
      this.logThrottled('Failed to create ClickHouse client', err);
      return null;
    }
  }

  private logThrottled(message: string, err: unknown): void {
    const now = Date.now();
    if (now - this.lastErrorLogAt < this.errorLogThrottleMs) return;
    this.lastErrorLogAt = now;
    const detail = err instanceof Error ? err.message : String(err);
    this.logger.warn(`${message}: ${detail} (further ClickHouse errors throttled for 60s)`);
  }
}
