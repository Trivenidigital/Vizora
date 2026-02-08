import { Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    minio: HealthCheck;
    memory: HealthCheck;
  };
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis, minio, memory] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMinio(),
      Promise.resolve(this.checkMemory()),
    ]);

    const checks = { database, redis, minio, memory };

    // Determine overall status
    const statuses = Object.values(checks).map(c => c.status);
    const hasUnhealthy = statuses.includes('unhealthy');
    const hasDegraded = statuses.includes('degraded');

    let status: 'ok' | 'degraded' | 'unhealthy';
    if (hasUnhealthy) {
      // Database unhealthy = overall unhealthy
      // Redis unhealthy = degraded (it's optional for basic functionality)
      if (database.status === 'unhealthy') {
        status = 'unhealthy';
      } else {
        status = 'degraded';
      }
    } else if (hasDegraded) {
      status = 'degraded';
    } else {
      status = 'ok';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();

    // If Redis service is not available (not injected)
    if (!this.redis) {
      return {
        status: 'degraded',
        responseTime: 0,
        error: 'Redis service not configured',
        details: { configured: false },
      };
    }

    try {
      const result = await this.redis.healthCheck();

      if (result.healthy) {
        return {
          status: 'healthy',
          responseTime: result.responseTime,
          details: { connected: true },
        };
      }

      return {
        status: 'unhealthy',
        responseTime: result.responseTime,
        error: result.error || 'Redis health check failed',
        details: { connected: false },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis check failed',
        details: { connected: false },
      };
    }
  }

  private async checkMinio(): Promise<HealthCheck> {
    const start = Date.now();

    if (!this.storage) {
      return {
        status: 'degraded',
        responseTime: 0,
        error: 'Storage service not configured',
        details: { configured: false },
      };
    }

    try {
      const result = await this.storage.healthCheck();

      if (result.healthy) {
        return {
          status: 'healthy',
          responseTime: Date.now() - start,
          details: { bucket: result.bucket },
        };
      }

      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: result.error || 'MinIO health check failed',
        details: { bucket: result.bucket },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'MinIO check failed',
      };
    }
  }

  private checkMemory(): HealthCheck {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    const heapUsagePercent = (used.heapUsed / used.heapTotal) * 100;
    const rssMB = Math.round(used.rss / 1024 / 1024);

    // Consider degraded if heap usage > 85%, unhealthy if > 95%
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (heapUsagePercent > 95) {
      status = 'unhealthy';
    } else if (heapUsagePercent > 85) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    const details = {
      heapUsedMB,
      heapTotalMB,
      heapUsagePercent: Math.round(heapUsagePercent * 10) / 10,
      rssMB,
    };

    return {
      status,
      responseTime: 0,
      details,
      ...(status !== 'healthy' && {
        error: `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%)`,
      }),
    };
  }
}
