import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { DatabaseService } from '../database/database.service';
import {
  HeartbeatData as HeartbeatPayload,
  ImpressionData as ImpressionPayload,
  ContentErrorData,
  DeviceMetrics,
  CurrentContentState,
} from '../types';

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

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);

  constructor(
    private redisService: RedisService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Process device heartbeat
   */
  async processHeartbeat(deviceId: string, data: HeartbeatPayload): Promise<void> {
    try {
      const heartbeat: StoredHeartbeat = {
        deviceId,
        timestamp: Date.now(),
        metrics: data.metrics,
        currentContent: data.currentContent,
      };

      // Store in Redis for quick access
      await this.redisService.set(
        `heartbeat:${deviceId}:latest`,
        JSON.stringify(heartbeat),
        300, // 5 minutes
      );

      // TODO: Queue for ClickHouse insertion
      // This would be done via a job queue (BullMQ) in production
      // await this.queueClickHouseInsert(heartbeat);

      this.logger.debug(`Processed heartbeat for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to process heartbeat for ${deviceId}:`, error);
    }
  }

  /**
   * Log content impression
   */
  async logImpression(deviceId: string, data: ImpressionPayload): Promise<void> {
    try {
      // Store in Redis for quick daily counters
      await this.redisService.increment(
        `stats:device:${deviceId}:impressions:${new Date().toISOString().split('T')[0]}`,
        86400, // 24 hours
      );

      // Persist to PostgreSQL
      try {
        const now = new Date();
        const device = await this.db.display.findUnique({
          where: { id: deviceId },
          select: { organizationId: true },
        });

        if (device) {
          await this.db.contentImpression.create({
            data: {
              organizationId: device.organizationId,
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
      const errorLog: StoredError = {
        deviceId,
        ...data,
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
        status: timeSinceHeartbeat < 60000 ? 'online' : 'offline', // 60 seconds threshold
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
