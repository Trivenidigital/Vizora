import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

interface HeartbeatData {
  deviceId: string;
  timestamp: number;
  metrics?: {
    cpuUsage?: number;
    memoryUsage?: number;
    storageUsed?: number;
    networkLatency?: number;
  };
  currentContent?: {
    contentId?: string;
    playlistId?: string;
    position?: number;
  };
  status?: string;
}

interface ImpressionData {
  contentId: string;
  playlistId?: string;
  duration: number;
  completed: boolean;
  timestamp: number;
}

interface ErrorData {
  contentId?: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  timestamp: number;
}

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);

  constructor(private redisService: RedisService) {}

  /**
   * Process device heartbeat
   */
  async processHeartbeat(deviceId: string, data: any): Promise<void> {
    try {
      const heartbeat: HeartbeatData = {
        deviceId,
        timestamp: Date.now(),
        metrics: data.metrics,
        currentContent: data.currentContent,
        status: data.status,
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
  async logImpression(deviceId: string, data: ImpressionData): Promise<void> {
    try {
      const impression = {
        deviceId,
        ...data,
        timestamp: Date.now(),
      };

      // Store in Redis list for batch processing
      await this.redisService.increment(
        `stats:device:${deviceId}:impressions:${new Date().toISOString().split('T')[0]}`,
        86400, // 24 hours
      );

      // TODO: Queue for ClickHouse insertion
      // await this.queueImpressionInsert(impression);

      this.logger.debug(`Logged impression for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to log impression for ${deviceId}:`, error);
    }
  }

  /**
   * Log playback error
   */
  async logError(deviceId: string, data: ErrorData): Promise<void> {
    try {
      const errorLog = {
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
  async getDeviceHealth(deviceId: string): Promise<any> {
    try {
      const heartbeatJson = await this.redisService.get(`heartbeat:${deviceId}:latest`);

      if (!heartbeatJson) {
        return {
          status: 'offline',
          lastSeen: null,
        };
      }

      const heartbeat: HeartbeatData = JSON.parse(heartbeatJson);
      const timeSinceHeartbeat = Date.now() - heartbeat.timestamp;

      return {
        status: timeSinceHeartbeat < 60000 ? 'online' : 'offline', // 60 seconds threshold
        lastSeen: new Date(heartbeat.timestamp).toISOString(),
        metrics: heartbeat.metrics,
        currentContent: heartbeat.currentContent,
      };
    } catch (error) {
      this.logger.error(`Failed to get health for ${deviceId}:`, error);
      return {
        status: 'unknown',
        error: error.message,
      };
    }
  }

  /**
   * Get device statistics
   */
  async getDeviceStats(deviceId: string): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const impressionsKey = `stats:device:${deviceId}:impressions:${today}`;

      const impressions = await this.redisService.get(impressionsKey);
      const errorsJson = await this.redisService.get(`errors:device:${deviceId}`);
      const errors = errorsJson ? JSON.parse(errorsJson) : [];

      return {
        impressions: parseInt(impressions || '0', 10),
        errors: errors.length,
        recentErrors: errors.slice(-5),
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for ${deviceId}:`, error);
      return {
        impressions: 0,
        errors: 0,
        recentErrors: [],
      };
    }
  }
}
