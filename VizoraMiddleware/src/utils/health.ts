import { Redis } from 'ioredis';
import { NODE_ID } from '../config/cluster';
import { logger } from './logger';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  connections: {
    current: number;
    peak: number;
  };
  redis: {
    status: 'ok' | 'error';
    latency: number;
  };
  lastError?: {
    timestamp: string;
    message: string;
  };
}

export class HealthMonitor {
  private startTime: number;
  private peakConnections: number = 0;
  private lastError?: { timestamp: string; message: string };

  constructor(
    private redis: Redis,
    private getConnectionCount: () => number
  ) {
    this.startTime = Date.now();
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Monitor memory usage
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
        logger.warn('High memory usage detected', {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        });
      }
    }, 60000);

    // Monitor connection peaks
    setInterval(() => {
      const currentConnections = this.getConnectionCount();
      if (currentConnections > this.peakConnections) {
        this.peakConnections = currentConnections;
      }
    }, 5000);
  }

  private async checkRedisHealth(): Promise<{ status: 'ok' | 'error'; latency: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        status: 'ok',
        latency: Date.now() - start
      };
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return {
        status: 'error',
        latency: -1
      };
    }
  }

  async getStatus(): Promise<HealthStatus> {
    const currentConnections = this.getConnectionCount();
    const memoryUsage = process.memoryUsage();
    const redisHealth = await this.checkRedisHealth();

    const status: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      connections: {
        current: currentConnections,
        peak: this.peakConnections
      },
      redis: redisHealth
    };

    if (this.lastError) {
      status.lastError = this.lastError;
    }

    // Determine overall status
    if (redisHealth.status === 'error') {
      status.status = 'error';
    } else if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
      status.status = 'degraded';
    }

    return status;
  }

  recordError(error: Error): void {
    this.lastError = {
      timestamp: new Date().toISOString(),
      message: error.message
    };
    logger.error('System error recorded', { error });
  }

  resetPeakConnections(): void {
    this.peakConnections = this.getConnectionCount();
  }
}

export function createHealthMonitor(redis: Redis, getConnectionCount: () => number): HealthMonitor {
  return new HealthMonitor(redis, getConnectionCount);
} 