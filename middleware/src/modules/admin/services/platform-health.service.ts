import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../redis/redis.service';
import * as http from 'http';

export interface ServiceStatus {
  name: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  error?: string;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: { healthy: boolean; responseTime: number; error?: string };
    redis: { healthy: boolean; responseTime: number; error?: string };
    middleware: ServiceStatus;
    web: ServiceStatus;
    realtime: ServiceStatus;
  };
  timestamp: string;
}

export interface ErrorRateStats {
  period: string;
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  byType: Record<string, number>;
}

export interface UptimeHistory {
  date: string;
  uptimePercent: number;
  downtime: number; // minutes
}

@Injectable()
export class PlatformHealthService {
  private readonly logger = new Logger(PlatformHealthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get aggregated health status of all services
   */
  async getOverallHealth(): Promise<HealthStatus> {
    const [dbHealth, redisHealth, middlewareStatus, webStatus, realtimeStatus] =
      await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkServicePort('middleware', 3000),
        this.checkServicePort('web', 3001),
        this.checkServicePort('realtime', 3002),
      ]);

    const services = {
      database: dbHealth,
      redis: redisHealth,
      middleware: middlewareStatus,
      web: webStatus,
      realtime: realtimeStatus,
    };

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!dbHealth.healthy) {
      overall = 'unhealthy';
    } else if (!redisHealth.healthy || middlewareStatus.status !== 'healthy') {
      overall = 'degraded';
    }

    return {
      overall,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check database connectivity and query time
   */
  async checkDatabase(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const start = Date.now();

    try {
      await this.db.$queryRaw`SELECT 1`;
      return {
        healthy: true,
        responseTime: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        healthy: false,
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  async checkRedis(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    return this.redis.healthCheck();
  }

  /**
   * Check if a service is responding on its port
   */
  async checkServicePort(name: string, port: number, timeout = 5000): Promise<ServiceStatus> {
    const start = Date.now();

    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/health',
          method: 'GET',
          timeout,
        },
        (res) => {
          const responseTime = Date.now() - start;
          resolve({
            name,
            port,
            status: res.statusCode === 200 ? 'healthy' : 'unhealthy',
            responseTime,
          });
        },
      );

      req.on('error', (error) => {
        resolve({
          name,
          port,
          status: 'unhealthy',
          responseTime: Date.now() - start,
          error: error.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          name,
          port,
          status: 'unhealthy',
          responseTime: timeout,
          error: 'Connection timeout',
        });
      });

      req.end();
    });
  }

  /**
   * Get status of all services (middleware, web, realtime)
   */
  async getServiceStatus(): Promise<ServiceStatus[]> {
    return Promise.all([
      this.checkServicePort('middleware', 3000),
      this.checkServicePort('web', 3001),
      this.checkServicePort('realtime', 3002),
    ]);
  }

  /**
   * Get error rates for the specified time period
   * Note: Currently returns mock data - can be enhanced with actual logging integration
   */
  async getErrorRates(hours: number = 24): Promise<ErrorRateStats> {
    // In a real implementation, this would query from:
    // 1. Application logs (ClickHouse, ELK, etc.)
    // 2. AdminAuditLog for specific error events
    // 3. Redis counters for rate limiting errors

    // For now, query AdminAuditLog for error-related actions
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const [totalActions, errorActions] = await Promise.all([
      this.db.adminAuditLog.count({
        where: { createdAt: { gte: since } },
      }),
      this.db.adminAuditLog.count({
        where: {
          createdAt: { gte: since },
          action: { contains: 'error' },
        },
      }),
    ]);

    // Mock additional stats
    const mockTotalRequests = totalActions * 100 + Math.floor(Math.random() * 1000);
    const mockErrorCount = errorActions * 10 + Math.floor(Math.random() * 50);

    return {
      period: `${hours}h`,
      totalRequests: mockTotalRequests,
      errorCount: mockErrorCount,
      errorRate: mockTotalRequests > 0 ? (mockErrorCount / mockTotalRequests) * 100 : 0,
      byType: {
        '4xx': Math.floor(mockErrorCount * 0.7),
        '5xx': Math.floor(mockErrorCount * 0.3),
        timeout: Math.floor(mockErrorCount * 0.1),
      },
    };
  }

  /**
   * Get uptime history for the specified number of days
   * Note: Returns mock data - can be enhanced with actual monitoring integration
   */
  async getUptimeHistory(days: number = 7): Promise<UptimeHistory[]> {
    // In a real implementation, this would:
    // 1. Query from an uptime monitoring service (UptimeRobot, Pingdom, etc.)
    // 2. Calculate from stored health check results
    // 3. Use Redis for recent metrics

    const history: UptimeHistory[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate realistic mock data (99.5-100% uptime)
      const uptimePercent = 99.5 + Math.random() * 0.5;
      const downtime = Math.round((100 - uptimePercent) * 14.4); // minutes in a day

      history.push({
        date: date.toISOString().split('T')[0],
        uptimePercent: Math.round(uptimePercent * 100) / 100,
        downtime,
      });
    }

    return history.reverse();
  }
}
