import { Redis } from 'ioredis';
import { ErrorCode, VizoraError } from './errors';

interface RateLimitConfig {
  key: string;
  limit: number;
  window: number; // in seconds
}

export class RateLimiter {
  constructor(private redis: Redis) {}

  async isRateLimited(config: RateLimitConfig): Promise<boolean> {
    const { key, limit, window } = config;
    const now = Math.floor(Date.now() / 1000);
    const rateKey = `rate:${key}`;

    const multi = this.redis.multi();
    multi.zremrangebyscore(rateKey, 0, now - window); // Remove old entries
    multi.zadd(rateKey, now, `${now}-${Math.random()}`); // Add current request
    multi.zcard(rateKey); // Get count
    multi.expire(rateKey, window); // Set expiry

    const [, , count] = await multi.exec() as [any, any, [null | Error, number]];
    
    if (count[0]) throw count[0];
    return count[1] > limit;
  }

  async checkRateLimit(config: RateLimitConfig): Promise<void> {
    const isLimited = await this.isRateLimited(config);
    if (isLimited) {
      throw new VizoraError(
        ErrorCode.VALIDATION_ERROR,
        'Rate limit exceeded. Please try again later.'
      );
    }
  }
}

// Rate limit configurations
export const rateLimits = {
  connection: {
    limit: 60,    // 60 connections
    window: 60    // per minute
  },
  contentUpdate: {
    limit: 30,    // 30 updates
    window: 60    // per minute
  },
  pairingAttempt: {
    limit: 10,    // 10 attempts
    window: 60    // per minute
  },
  displayRegistration: {
    limit: 5,     // 5 registrations
    window: 60    // per minute
  }
}; 