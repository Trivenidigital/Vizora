import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface DeviceStatus {
  status: 'online' | 'offline' | 'pairing' | 'error';
  lastHeartbeat: number;
  socketId: string | null;
  organizationId: string;
  metrics?: any;
  currentContent?: any;
}

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
   */
  async getOrganizationDevices(organizationId: string): Promise<string[]> {
    const pattern = 'device:status:*';
    const keys = await this.redis.keys(pattern);

    const devices: string[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const status: DeviceStatus = JSON.parse(data);
        if (status.organizationId === organizationId) {
          const deviceId = key.replace('device:status:', '');
          devices.push(deviceId);
        }
      }
    }

    return devices;
  }

  /**
   * Store commands for a device
   */
  async addDeviceCommand(deviceId: string, command: any): Promise<void> {
    const key = `device:commands:${deviceId}`;
    await this.redis.lpush(key, JSON.stringify(command));
    await this.redis.expire(key, 300); // 5 minutes
  }

  /**
   * Get pending commands for a device
   */
  async getDeviceCommands(deviceId: string): Promise<any[]> {
    const key = `device:commands:${deviceId}`;
    const commands = await this.redis.lrange(key, 0, -1);

    // Clear commands after retrieving
    await this.redis.del(key);

    return commands.map((cmd) => JSON.parse(cmd));
  }

  /**
   * Cache playlist for a device
   */
  async cachePlaylist(deviceId: string, playlist: any): Promise<void> {
    const key = `playlist:${deviceId}`;
    await this.redis.setex(key, 3600, JSON.stringify(playlist)); // 1 hour
  }

  /**
   * Get cached playlist
   */
  async getCachedPlaylist(deviceId: string): Promise<any | null> {
    const key = `playlist:${deviceId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Publish event to channel
   */
  async publish(channel: string, message: any): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(channel);

    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const data = JSON.parse(message);
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
}
