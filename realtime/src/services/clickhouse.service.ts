import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, type ClickHouseClient } from '@clickhouse/client';

/**
 * One row of the ClickHouse `device_health_samples` time-series. Column names
 * mirror the DDL exactly so JSONEachRow inserts map 1:1.
 */
export interface DeviceHealthSample {
  deviceId: string;
  organizationId: string;
  cpu: number;
  memory: number;
  temperature: number | null;
  /** Connectivity state at sample time. A heartbeat always means 'online'. */
  status: string;
  /** UTC 'YYYY-MM-DD HH:MM:SS' — ClickHouse DateTime literal. */
  event_time: string;
}

export const DEVICE_HEALTH_SAMPLES_TABLE = 'device_health_samples';

/**
 * Idempotent DDL. `docker/clickhouse/init.sql` is the canonical schema for a
 * fresh stack; this app-side copy is a best-effort fallback so an already-
 * provisioned ClickHouse (whose volume predates this table) still gets it.
 */
export const DEVICE_HEALTH_SAMPLES_DDL = `
CREATE TABLE IF NOT EXISTS ${DEVICE_HEALTH_SAMPLES_TABLE} (
  deviceId String,
  organizationId String,
  cpu Float32,
  memory Float32,
  temperature Nullable(Float32),
  status String,
  event_time DateTime
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (organizationId, deviceId, event_time)
TTL event_time + INTERVAL 90 DAY DELETE
`.trim();

/** Resolve connection config from the environment (never throws). */
export function resolveClickHouseConfig(): {
  url: string;
  username: string;
  password: string;
  database: string;
} {
  const url =
    process.env.CLICKHOUSE_URL ||
    `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`;
  return {
    url,
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'default',
  };
}

/** Format a Date as a UTC ClickHouse DateTime literal ('YYYY-MM-DD HH:MM:SS'). */
export function formatClickHouseDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Batched, fire-and-forget writer for the durable device-health time-series.
 *
 * ═══ FAIL-OPEN CONTRACT (non-negotiable) ═══
 * ClickHouse is optional infrastructure. A ClickHouse outage must NEVER throw
 * into the heartbeat hot path, block live functionality, or crash the process:
 *   - lazy connect        — the client is created on first use, not at boot;
 *   - non-blocking enqueue — `enqueueDeviceHealthSample` only pushes to an
 *                            in-memory ring buffer and returns synchronously.
 *                            The hot path NEVER awaits a ClickHouse write;
 *   - bounded buffer       — capped at `maxBufferSize`; oldest rows drop first
 *                            so memory can't grow without limit while CH is down;
 *   - swallowed errors     — every insert/DDL/ping error is caught + logged
 *                            (throttled), never propagated;
 *   - drop-on-failure      — a failed flush discards its batch rather than
 *                            retry-storming. History is lost; the app is not.
 * If ClickHouse is unreachable the app runs exactly as before, minus history.
 */
@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseService.name);
  private client: ClickHouseClient | null = null;
  private readonly enabled: boolean;

  private buffer: DeviceHealthSample[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing = false;
  private lastErrorLogAt = 0;

  // Tunables — kept small; this is not a high-throughput analytics ingester.
  private readonly maxBufferSize = 10_000;
  private readonly flushBatchThreshold = 200;
  private readonly flushIntervalMs = 5_000;
  private readonly errorLogThrottleMs = 60_000;

  constructor() {
    // Default ON; opt out with CLICKHOUSE_ENABLED=false (e.g. dev without the
    // docker `analytics` profile). Never hard-fails on missing config.
    this.enabled = process.env.CLICKHOUSE_ENABLED !== 'false';
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log(
        'ClickHouse disabled (CLICKHOUSE_ENABLED=false) — device-health samples will not be persisted',
      );
      return;
    }
    // Best-effort schema bootstrap; fail-open (docker init.sql is canonical).
    void this.ensureSchema();
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    // Don't keep the event loop alive purely for the flush timer.
    this.flushTimer.unref?.();
    this.logger.log('ClickHouse device-health writer initialized');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Best-effort final flush so a graceful shutdown doesn't lose the buffer.
    await this.flush();
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        /* ignore — shutting down */
      }
      this.client = null;
    }
  }

  /**
   * Enqueue a device-health sample. Synchronous, non-blocking, never throws.
   * This is the ONLY method the heartbeat hot path calls.
   */
  enqueueDeviceHealthSample(sample: {
    deviceId: string;
    organizationId: string;
    cpu?: number | null;
    memory?: number | null;
    temperature?: number | null;
    status?: string;
    eventTime?: Date;
  }): void {
    if (!this.enabled) return;
    try {
      if (this.buffer.length >= this.maxBufferSize) {
        // Bounded buffer: drop the oldest sample to keep the memory ceiling.
        this.buffer.shift();
      }
      this.buffer.push({
        deviceId: sample.deviceId,
        organizationId: sample.organizationId,
        cpu: Number.isFinite(sample.cpu as number) ? (sample.cpu as number) : 0,
        memory: Number.isFinite(sample.memory as number) ? (sample.memory as number) : 0,
        temperature: Number.isFinite(sample.temperature as number)
          ? (sample.temperature as number)
          : null,
        status: sample.status || 'online',
        event_time: formatClickHouseDateTime(sample.eventTime ?? new Date()),
      });
      if (this.buffer.length >= this.flushBatchThreshold) {
        void this.flush();
      }
    } catch {
      /* Never throw into the heartbeat path. */
    }
  }

  /**
   * Drain the buffer into ClickHouse in a single batched insert. Guarded so
   * overlapping timer/threshold flushes don't double-insert. Fail-open.
   */
  async flush(): Promise<void> {
    if (!this.enabled || this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      const client = this.getClient();
      if (!client) return; // client creation failed — batch dropped (fail-open)
      await client.insert({
        table: DEVICE_HEALTH_SAMPLES_TABLE,
        format: 'JSONEachRow',
        values: batch,
      });
    } catch (err) {
      // Fail-open: drop the batch rather than grow unbounded / retry-storm.
      this.logThrottled(
        `Failed to flush ${batch.length} device-health samples to ClickHouse`,
        err,
      );
    } finally {
      this.flushing = false;
    }
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
