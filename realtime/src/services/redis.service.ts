import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import {
  DeviceStatus,
  DeviceCommand,
  Playlist,
} from '../types';

// Re-export DeviceStatus for backwards compatibility
export type { DeviceStatus } from '../types';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis;
  private subscriber: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.subscriber = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis error:', error.message);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
    await this.subscriber.quit();
  }

  /**
   * Set device status in Redis
   */
  async setDeviceStatus(deviceId: string, status: DeviceStatus): Promise<void> {
    const key = `device:status:${deviceId}`;
    await this.redis.setex(key, 60, JSON.stringify(status)); // 60 second TTL
  }

  /**
   * Get device status from Redis
   */
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus | null> {
    const key = `device:status:${deviceId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Get all devices for an organization
   * Uses SCAN instead of KEYS to avoid blocking Redis in production
   */
  async getOrganizationDevices(organizationId: string): Promise<string[]> {
    const pattern = 'device:status:*';
    const devices: string[] = [];

    // Use SCAN with cursor-based iteration for production safety
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100, // Process 100 keys per iteration
      );
      cursor = nextCursor;

      // Process keys in parallel for efficiency
      if (keys.length > 0) {
        const values = await this.redis.mget(...keys);

        for (let i = 0; i < keys.length; i++) {
          const data = values[i];
          if (data) {
            try {
              const status: DeviceStatus = JSON.parse(data);
              if (status.organizationId === organizationId) {
                const deviceId = keys[i].replace('device:status:', '');
                devices.push(deviceId);
              }
            } catch {
              // Skip invalid JSON entries
              this.logger.warn(`Invalid JSON in key ${keys[i]}`);
            }
          }
        }
      }
    } while (cursor !== '0');

    return devices;
  }

  /**
   * Store commands for a device
   */
  async addDeviceCommand(deviceId: string, command: DeviceCommand): Promise<void> {
    const key = `device:commands:${deviceId}`;
    await this.redis.lpush(key, JSON.stringify(command));
    await this.redis.expire(key, 300); // 5 minutes
  }

  /**
   * Get pending commands for a device
   */
  async getDeviceCommands(deviceId: string): Promise<DeviceCommand[]> {
    const key = `device:commands:${deviceId}`;
    const commands = await this.redis.lrange(key, 0, -1);

    // Clear commands after retrieving
    await this.redis.del(key);

    return commands.map((cmd) => JSON.parse(cmd) as DeviceCommand);
  }

  /**
   * Cache playlist for a device
   */
  async cachePlaylist(deviceId: string, playlist: Playlist): Promise<void> {
    const key = `playlist:${deviceId}`;
    await this.redis.setex(key, 3600, JSON.stringify(playlist)); // 1 hour
  }

  /**
   * Get cached playlist
   */
  async getCachedPlaylist(deviceId: string): Promise<Playlist | null> {
    const key = `playlist:${deviceId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as Playlist;
  }

  /**
   * Publish event to channel
   */
  async publish<T = unknown>(channel: string, message: T): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to channel
   */
  async subscribe<T = unknown>(channel: string, callback: (message: T) => void): Promise<void> {
    await this.subscriber.subscribe(channel);

    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const data = JSON.parse(message) as T;
          callback(data);
        } catch (error) {
          this.logger.error('Failed to parse message:', error);
        }
      }
    });
  }

  /**
   * Increment counter
   */
  async increment(key: string, ttl?: number): Promise<number> {
    const value = await this.redis.incr(key);

    if (ttl) {
      await this.redis.expire(key, ttl);
    }

    return value;
  }

  /**
   * Get value
   */
  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  /**
   * Set value with optional TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Delete key
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Delete keys matching pattern
   * Uses SCAN instead of KEYS to avoid blocking Redis in production
   */
  async deletePattern(pattern: string): Promise<void> {
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    if (deletedCount > 0) {
      this.logger.log(`Deleted ${deletedCount} keys matching pattern: ${pattern}`);
    }
  }
}
