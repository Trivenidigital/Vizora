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
  private subscriptions: Map<string, Set<(channel: string, message: string) => void>> = new Map();
  private messageHandler: ((channel: string, message: string) => void) | null = null;
  private isConnected = false;
  private readonly maxRetryAttempts = 10;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Enhanced retry strategy with exponential backoff and max retries
    const retryStrategy = (times: number): number | null => {
      if (times > this.maxRetryAttempts) {
        this.logger.error(`Redis max retry attempts (${this.maxRetryAttempts}) exceeded`);
        // Return null to stop retrying (will trigger 'end' event)
        return null;
      }
      const delay = Math.min(times * 100, 5000); // Max 5 second delay
      this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times}/${this.maxRetryAttempts})`);
      return delay;
    };

    this.redis = new Redis(redisUrl, {
      retryStrategy,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.subscriber = new Redis(redisUrl, {
      retryStrategy,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    // Connection event handlers for main client
    this.redis.on('connect', () => {
      this.logger.log('Redis connecting...');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      this.logger.log('Redis connected and ready');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });

    this.redis.on('end', () => {
      this.isConnected = false;
      this.logger.error('Redis connection ended (max retries exceeded or disconnected)');
    });

    // Subscriber event handlers
    this.subscriber.on('error', (error) => {
      this.logger.error(`Redis subscriber error: ${error.message}`);
    });

    this.subscriber.on('ready', () => {
      this.logger.log('Redis subscriber ready');
    });
  }

  async onModuleDestroy() {
    this.logger.log('Cleaning up Redis connections...');
    // Clean up all subscriptions first
    await this.unsubscribeAll();
    // Then close connections
    await this.redis.quit();
    await this.subscriber.quit();
    this.logger.log('Redis connections closed');
  }

  /**
   * Set device status in Redis
   */
  async setDeviceStatus(deviceId: string, status: DeviceStatus): Promise<void> {
    const key = `device:status:${deviceId}`;
    const ttl = status.status === 'offline' ? 86400 : 60; // 24h for offline, 60s for online
    await this.redis.setex(key, ttl, JSON.stringify(status));
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
   *
   * `ttlSeconds` is the pushed command's REMAINING life (`deviceCommandRemainingTtlSeconds`).
   * The key's TTL is only ever raised to it, never shortened, so the queue lives exactly as
   * long as its youngest command: NX sets it on a key with no TTL yet (GT alone would not —
   * Redis treats a non-volatile key as infinite), GT extends it only when larger. A
   * requeued old command therefore cannot extend the queue, and a fresh command pushed
   * onto an old queue is not reaped early. RPUSH and both EXPIREs run in one MULTI, so a
   * crash cannot leave a TTL-less key. Requires Redis >= 7.
   *
   * The TTL is garbage collection only — the real invariant is the per-command age check
   * against the command's creation time (`DEVICE_COMMAND_MAX_AGE_MS`), which the gateway
   * enforces before every emit and every requeue.
   */
  async addDeviceCommand(deviceId: string, command: DeviceCommand, ttlSeconds: number): Promise<void> {
    const key = `device:commands:${deviceId}`;
    const ttl = Math.max(1, Math.ceil(ttlSeconds));
    const results = await this.redis
      .multi()
      .rpush(key, JSON.stringify(command))
      .expire(key, ttl, 'NX')
      .expire(key, ttl, 'GT')
      .exec();
    // exec() RESOLVES with per-command errors (e.g. WRONGTYPE) rather than rejecting, and
    // with null when the transaction was aborted. Either way the command was not stored —
    // throw, so a caller never counts a lost command as queued.
    if (!results) {
      throw new Error(`addDeviceCommand: MULTI aborted for device ${deviceId}`);
    }
    const failed = results.find(([error]) => error);
    if (failed) {
      throw failed[0];
    }
  }

  /**
   * Get pending commands for a device (atomic read + delete)
   *
   * Each entry is parsed on its own: an unparseable or non-object entry is dropped with a
   * WARN (device id + index only — never the raw content) and the rest are kept. A single
   * bad entry used to throw AFTER the DEL and lose the whole batch.
   */
  async getDeviceCommands(deviceId: string): Promise<DeviceCommand[]> {
    const key = `device:commands:${deviceId}`;
    const multi = this.redis.multi();
    multi.lrange(key, 0, -1);
    multi.del(key);
    const results = await multi.exec();
    if (!results || !results[0] || !results[0][1]) return [];
    const entries = results[0][1] as string[];
    const commands: DeviceCommand[] = [];
    entries.forEach((entry, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(entry);
      } catch {
        this.logger.warn(`Dropping unparseable queued command for device ${deviceId} at index ${index}`);
        return;
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.logger.warn(`Dropping non-object queued command for device ${deviceId} at index ${index}`);
        return;
      }
      commands.push(parsed as DeviceCommand);
    });
    return commands;
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
   * Store a pending playlist for an offline device.
   * When the device reconnects, sendInitialState() delivers this
   * instead of the DB query (it's fresher — represents a missed update).
   */
  async setPendingPlaylist(deviceId: string, playlist: Playlist, version = ''): Promise<void> {
    const key = `device:pending-playlist:${deviceId}`;
    // Stored as { playlist, version } so the resolver's version travels WITH the content
    // it describes. It used to be recomputed at replay time from the serialized playlist,
    // which no longer carries playlist.updatedAt or item.updatedAt — so the recomputed
    // stamp could never equal the resolver's, and every replay provoked a needless
    // reconcile. A version has to be carried, not re-derived from something with its
    // inputs stripped.
    await this.redis.setex(key, 1800, JSON.stringify({ playlist, version })); // 30 minutes
  }

  async deletePendingPlaylist(deviceId: string): Promise<void> {
    const key = `device:pending-playlist:${deviceId}`;
    await this.redis.del(key);
  }

  /**
   * Get and consume a pending playlist for a device (atomic read + delete).
   * Returns null if no pending playlist exists.
   *
   * Note: Uses MULTI/EXEC which is atomic on single-node Redis. If migrating
   * to Redis Cluster, consider replacing with a Lua script for guaranteed
   * atomicity. On transient Redis errors, EXEC rolls back and the key
   * survives — the next reconnect attempt will find it.
   */
  async getPendingPlaylist(deviceId: string): Promise<{ playlist: Playlist; version: string } | null> {
    const key = `device:pending-playlist:${deviceId}`;
    const multi = this.redis.multi();
    multi.get(key);
    multi.del(key);
    const results = await multi.exec();
    if (!results || !results[0] || !results[0][1]) return null;
    try {
      const parsed = JSON.parse(results[0][1] as string);
      // Entries written before the { playlist, version } shape are bare playlists. They
      // drain within the 30-minute TTL, so this only spans a deploy: deliver them with an
      // empty version (the device then takes its legacy signature path) rather than
      // dropping an operator's queued assignment on the floor.
      if (parsed && typeof parsed === 'object' && 'playlist' in parsed) {
        return { playlist: parsed.playlist as Playlist, version: typeof parsed.version === 'string' ? parsed.version : '' };
      }
      return { playlist: parsed as Playlist, version: '' };
    } catch {
      return null;
    }
  }

  /**
   * Publish event to channel
   */
  async publish<T = unknown>(channel: string, message: T): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to channel - returns unsubscribe function to prevent memory leaks
   */
  async subscribe<T = unknown>(channel: string, callback: (message: T) => void): Promise<() => void> {
    // Initialize the global message handler if not exists (single handler for all channels)
    if (!this.messageHandler) {
      this.messageHandler = (ch: string, message: string) => {
        const handlers = this.subscriptions.get(ch);
        if (handlers) {
          handlers.forEach((handler) => handler(ch, message));
        }
      };
      this.subscriber.on('message', this.messageHandler);
    }

    // Create channel-specific handler
    const handler = (ch: string, message: string) => {
      if (ch === channel) {
        try {
          const data = JSON.parse(message) as T;
          callback(data);
        } catch (error) {
          this.logger.error('Failed to parse message:', error);
        }
      }
    };

    // Track the subscription
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.subscriptions.get(channel)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(handler);
        // Unsubscribe from Redis channel if no more handlers
        if (handlers.size === 0) {
          this.subscriptions.delete(channel);
          this.subscriber.unsubscribe(channel).catch((err) => {
            this.logger.error(`Failed to unsubscribe from ${channel}:`, err);
          });
        }
      }
    };
  }

  /**
   * Unsubscribe from all channels - for cleanup
   */
  async unsubscribeAll(): Promise<void> {
    for (const channel of this.subscriptions.keys()) {
      await this.subscriber.unsubscribe(channel);
    }
    this.subscriptions.clear();
    if (this.messageHandler) {
      this.subscriber.removeListener('message', this.messageHandler);
      this.messageHandler = null;
    }
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
   * Atomically set a key only if it does not already exist (SET NX EX).
   * Returns true if this call created the key, false if it already existed.
   * Used to claim a single-writer lock / cooldown (e.g. device-token refresh).
   */
  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
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

  /**
   * Get the underlying Redis client for advanced operations
   */
  getRedis(): Redis {
    return this.redis;
  }

  /**
   * Health check for Redis connection
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; status: string } {
    return {
      connected: this.isConnected,
      status: this.redis.status,
    };
  }
}
