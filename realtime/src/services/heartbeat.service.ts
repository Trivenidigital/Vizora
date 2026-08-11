import { Injectable, Logger } from '@nestjs/common';
import { DEVICE_OFFLINE_THRESHOLD_MS } from '@vizora/database';
import { RedisService } from './redis.service';
import { ClickHouseService } from './clickhouse.service';
import { DatabaseService } from '../database/database.service';
import {
  HeartbeatData as HeartbeatPayload,
  ImpressionData as ImpressionPayload,
  ContentErrorData,
  DeviceMetrics,
  CurrentContentState,
} from '../types';
import { redactSensitiveTokens } from '../utils/redact-sensitive-url';

interface StoredHeartbeat {
  deviceId: string;
  timestamp: number;
  metrics?: DeviceMetrics;
  currentContent?: CurrentContentState;
  status?: string;
}

interface StoredImpression extends ImpressionPayload {
  deviceId: string;
  timestamp: number;
}

interface StoredError extends ContentErrorData {
  deviceId: string;
  timestamp: number;
}

interface DeviceHealth {
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  metrics?: DeviceMetrics;
  currentContent?: CurrentContentState;
  error?: string;
}

interface DeviceStats {
  impressions: number;
  errors: number;
  recentErrors: StoredError[];
}

/**
 * Longest `appVersion` we will persist. Mirrors the DTO's @MaxLength — the DTO
 * guards the socket boundary, this guards the service for any other caller.
 * The value lands in JSONB, so an unbounded string is an unbounded row.
 */
const MAX_APP_VERSION_LENGTH = 64;

/**
 * Backstop for the app-version dedup cache. Entries are normally evicted by
 * `forgetDevice` on disconnect; this only matters if a disconnect is ever missed.
 * Overflow costs one redundant UPDATE for the evicted device, never correctness.
 */
const APP_VERSION_CACHE_CAP = 10_000;

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);

  /**
   * Last `appVersion` we successfully persisted, per device. Heartbeats arrive
   * every 15s but the version changes only when someone installs a new APK, so
   * this turns a per-heartbeat write into a per-upgrade write. Populated only on
   * a successful UPDATE, so a failed write is retried on the next heartbeat
   * rather than being cached as done.
   */
  private readonly lastPersistedAppVersion = new Map<string, string>();

  constructor(
    private redisService: RedisService,
    private readonly db: DatabaseService,
    private readonly clickhouse: ClickHouseService,
  ) {}

  /**
   * Drop a device's cached app-version. Call on disconnect so the map tracks
   * connected devices rather than every device seen since boot.
   */
  forgetDevice(deviceId: string): void {
    this.lastPersistedAppVersion.delete(deviceId);
  }

  /**
   * Persist the reported app version onto the device row, but only when it
   * changed.
   *
   * Why this exists: the player has always sent `appVersion` in every heartbeat
   * and the server has always thrown it away — the DTO declared it, nothing read
   * it, nothing wrote it, and the device-detail page rendered an "App Version"
   * row from `metadata.appVersion` that could therefore never populate. The
   * practical cost showed up during the 1.3.12 rollout: there was no way to tell
   * which build any screen was running, so "did the update actually install?"
   * could only be answered by asking the customer.
   *
   * Atomicity: `metadata || jsonb_build_object(...)` shallow-merges inside a
   * single statement, so it sets exactly the `appVersion` key and preserves every
   * other key that a concurrent writer may own. The read-modify-write shape
   * (load row → mutate JSON in JS → write whole object back) loses those
   * concurrent writes, which is the bug `FeatureFlagsService.setFlags` was
   * rewritten to fix — same reasoning, same remedy.
   *
   * Fail-open: a failure here is logged and swallowed. Recording telemetry must
   * never be able to fail a heartbeat, because a failed heartbeat is what the
   * middleware's offline scanner turns into a false "device offline".
   */
  private async persistAppVersionIfChanged(
    deviceId: string,
    rawAppVersion: string | undefined,
  ): Promise<void> {
    const appVersion = rawAppVersion?.trim();
    if (!appVersion || appVersion.length > MAX_APP_VERSION_LENGTH) return;
    if (this.lastPersistedAppVersion.get(deviceId) === appVersion) return;

    try {
      await this.db.$executeRaw`
        UPDATE "devices"
        SET "metadata" = COALESCE("metadata", '{}'::jsonb)
                         || jsonb_build_object('appVersion', ${appVersion}::text)
        WHERE "id" = ${deviceId}
      `;

      if (this.lastPersistedAppVersion.size >= APP_VERSION_CACHE_CAP) {
        const oldest = this.lastPersistedAppVersion.keys().next();
        if (!oldest.done) this.lastPersistedAppVersion.delete(oldest.value);
      }
      this.lastPersistedAppVersion.set(deviceId, appVersion);
      this.logger.log(`Device ${deviceId} reported appVersion ${appVersion}`);
    } catch (error) {
      // Deliberately not cached — the next heartbeat retries.
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to persist appVersion for ${deviceId}: ${message}`);
    }
  }

  /**
   * Process device heartbeat
   *
   * @param organizationId Owning org, taken from the authenticated socket. Used
   *   to key the durable ClickHouse time-series. Optional so legacy callers and
   *   tests keep compiling; when absent the ClickHouse sample is skipped (Redis
   *   write is unaffected).
   */
  async processHeartbeat(
    deviceId: string,
    data: HeartbeatPayload,
    organizationId?: string,
  ): Promise<void> {
    try {
      const heartbeat: StoredHeartbeat = {
        deviceId,
        timestamp: Date.now(),
        metrics: data.metrics,
        currentContent: data.currentContent,
      };

      // Store in Redis for quick access (fast, 5-min-TTL live view)
      await this.redisService.set(
        `heartbeat:${deviceId}:latest`,
        JSON.stringify(heartbeat),
        300, // 5 minutes
      );

      // Durable time-series: enqueue a sample for the batched, fire-and-forget
      // ClickHouse writer. Non-blocking and fail-open — a ClickHouse outage
      // never reaches this path (see ClickHouseService fail-open contract).
      if (organizationId) {
        this.clickhouse.enqueueDeviceHealthSample({
          deviceId,
          organizationId,
          cpu: data.metrics?.cpuUsage,
          memory: data.metrics?.memoryUsage,
          temperature: data.metrics?.temperature ?? null,
          status: 'online',
        });
      }

      // Fleet visibility: record which build this screen is actually running.
      // Awaited so a test can assert it, but internally fail-open and a no-op
      // once the version is known, so the steady-state cost is a Map lookup.
      await this.persistAppVersionIfChanged(deviceId, data.appVersion);

      this.logger.debug(`Processed heartbeat for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to process heartbeat for ${deviceId}:`, error);
    }
  }

  /**
   * Log content impression
   */
  async logImpression(
    deviceId: string,
    data: ImpressionPayload,
    organizationId?: string,
  ): Promise<void> {
    try {
      // Store in Redis for quick daily counters
      await this.redisService.increment(
        `stats:device:${deviceId}:impressions:${new Date().toISOString().split('T')[0]}`,
        86400, // 24 hours
      );

      // Persist to PostgreSQL
      try {
        const now = new Date();
        let resolvedOrganizationId = organizationId;

        if (!resolvedOrganizationId) {
          const device = await this.db.display.findUnique({
            where: { id: deviceId },
            select: { organizationId: true },
          });
          resolvedOrganizationId = device?.organizationId;
        }

        if (resolvedOrganizationId) {
          await this.db.contentImpression.create({
            data: {
              organizationId: resolvedOrganizationId,
              contentId: data.contentId,
              displayId: deviceId,
              playlistId: data.playlistId || null,
              duration: data.duration || null,
              completionPercentage: data.completionPercentage || null,
              date: new Date(now.toISOString().split('T')[0]),
              hour: now.getHours(),
            },
          });
        }
      } catch (dbError) {
        this.logger.warn(`Failed to persist impression to DB: ${dbError}`);
      }

      this.logger.debug(`Logged impression for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to log impression for ${deviceId}:`, error);
    }
  }

  /**
   * Log playback error
   */
  async logError(deviceId: string, data: ContentErrorData): Promise<void> {
    try {
      const sanitizedData = redactSensitiveTokens(data);
      const errorLog: StoredError = {
        deviceId,
        ...sanitizedData,
        timestamp: Date.now(),
      };

      // Store in Redis for immediate alerting
      const key = `errors:device:${deviceId}`;
      const errorsJson = await this.redisService.get(key);
      const errors = errorsJson ? JSON.parse(errorsJson) : [];

      errors.push(errorLog);

      // Keep only last 10 errors
      if (errors.length > 10) {
        errors.shift();
      }

      await this.redisService.set(key, JSON.stringify(errors), 3600); // 1 hour

      // TODO: Queue for ClickHouse insertion
      // await this.queueErrorInsert(errorLog);

      this.logger.warn(`Error logged for device ${deviceId}: ${data.errorType}`);
    } catch (error) {
      this.logger.error(`Failed to log error for ${deviceId}:`, error);
    }
  }

  /**
   * Get device health status
   */
  async getDeviceHealth(deviceId: string): Promise<DeviceHealth> {
    try {
      const heartbeatJson = await this.redisService.get(`heartbeat:${deviceId}:latest`);

      if (!heartbeatJson) {
        return {
          status: 'offline',
          lastSeen: null,
        };
      }

      const heartbeat: StoredHeartbeat = JSON.parse(heartbeatJson);
      const timeSinceHeartbeat = Date.now() - heartbeat.timestamp;

      return {
        // Shared offline threshold from @vizora/database — keeps this live read
        // consistent with the middleware offline-detection cron (previously this
        // used 60s while the cron used 120s, so a 60–120s-stale device disagreed
        // across the two views).
        status: timeSinceHeartbeat < DEVICE_OFFLINE_THRESHOLD_MS ? 'online' : 'offline',
        lastSeen: new Date(heartbeat.timestamp).toISOString(),
        metrics: heartbeat.metrics,
        currentContent: heartbeat.currentContent,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get health for ${deviceId}: ${errorMessage}`);
      return {
        status: 'unknown',
        lastSeen: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Get device statistics
   */
  async getDeviceStats(deviceId: string): Promise<DeviceStats> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const impressionsKey = `stats:device:${deviceId}:impressions:${today}`;

      const impressions = await this.redisService.get(impressionsKey);
      const errorsJson = await this.redisService.get(`errors:device:${deviceId}`);
      const errors: StoredError[] = errorsJson ? JSON.parse(errorsJson) : [];

      return {
        impressions: parseInt(impressions || '0', 10),
        errors: errors.length,
        recentErrors: errors.slice(-5),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get stats for ${deviceId}: ${errorMessage}`);
      return {
        impressions: 0,
        errors: 0,
        recentErrors: [],
      };
    }
  }
}
