/**
 * Shared ClickHouse constants + helpers for the middleware read/watchdog side.
 * Mirrors realtime/src/services/clickhouse.service.ts (the writer). Kept in
 * sync by hand — both are idempotent (CREATE TABLE IF NOT EXISTS) and
 * `docker/clickhouse/init.sql` is the canonical schema for a fresh stack.
 */

export const DEVICE_HEALTH_SAMPLES_TABLE = 'device_health_samples';

/** Uptime bucket size. A bucket counts as "up" if it holds ≥1 health sample. */
export const UPTIME_BUCKET_MS = 5 * 60 * 1000; // 5 minutes

/** ClickHouse INTERVAL clause matching UPTIME_BUCKET_MS (used in toStartOfInterval). */
export const UPTIME_BUCKET_INTERVAL_SQL = 'INTERVAL 5 MINUTE';

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

/** Parse a ClickHouse DateTime string ('YYYY-MM-DD HH:MM:SS', UTC) into a Date. */
export function parseClickHouseDateTime(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`);
}
