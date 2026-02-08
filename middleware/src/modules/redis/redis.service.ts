import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 10) {
            this.logger.error('Redis max retry attempts (10) exceeded');
            return null; // Stop retrying — triggers 'end' event
          }
          const delay = Math.min(times * 200, 5000); // Exponential backoff, max 5s
          this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times}/10)`);
          return delay;
        },
        lazyConnect: true, // Don't connect immediately
        enableReadyCheck: true,
      });

      // Set up event handlers
      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('✅ Redis connected successfully');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.logger.error(`Redis error: ${error.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        this.logger.log('Redis reconnecting...');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        this.logger.error('Redis connection ended (max retries exceeded or disconnected)');
      });

      // Attempt to connect
      await this.client.connect();
    } catch (error) {
      this.isConnected = false;
      this.logger.warn(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't throw - Redis is optional for basic functionality
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Redis disconnected');
      } catch (error) {
        this.logger.error('Error disconnecting from Redis', error);
      }
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is connected and responsive
   */
  async ping(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error(`Redis ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Health check with response time measurement
   */
  async healthCheck(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const start = Date.now();

    if (!this.client) {
      return {
        healthy: false,
        responseTime: Date.now() - start,
        error: 'Redis client not initialized',
      };
    }

    try {
      const result = await this.client.ping();
      return {
        healthy: result === 'PONG',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis ping failed',
      };
    }
  }

  /**
   * Get the Redis client (for advanced operations)
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Basic cache operations

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}: ${error}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}: ${error}`);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}: ${error}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key ${key}: ${error}`);
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Redis INCR error for key ${key}: ${error}`);
      return 0;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      this.logger.error(`Redis EXPIRE error for key ${key}: ${error}`);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) return -2;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Redis TTL error for key ${key}: ${error}`);
      return -2;
    }
  }
}
