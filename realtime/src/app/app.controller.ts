import { Controller, Get, Post, Body, HttpStatus, HttpException, UseGuards, Logger } from '@nestjs/common';
import { DeviceGateway } from '../gateways/device.gateway';
import { RedisService } from '../services/redis.service';
import { DatabaseService } from '../database/database.service';
import { InternalApiGuard } from '../guards/internal-api.guard';
import { PushPlaylistRequest, PushContentRequest, DeviceCommandType } from '../types';

interface DependencyHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  timestamp: string;
  uptime: number;
  dependencies: {
    redis: DependencyHealth;
    database: DependencyHealth;
    websocket: DependencyHealth;
  };
}

interface StatusResponse {
  status: string;
  service: string;
  version: string;
  websocket: string;
}

interface PushResponse {
  success: boolean;
  message: string;
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly deviceGateway: DeviceGateway,
    private readonly redisService: RedisService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('health')
  async getHealth(): Promise<HealthResponse> {
    const dependencies = await this.checkDependencies();

    // Determine overall status
    const allHealthy = Object.values(dependencies).every(d => d.status === 'healthy');
    const anyUnhealthy = Object.values(dependencies).some(d => d.status === 'unhealthy');

    const status = allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded';

    return {
      status,
      service: 'realtime-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies,
    };
  }

  @Get('health/live')
  getLiveness(): { status: string } {
    // Liveness probe - just confirms the service is running
    return { status: 'ok' };
  }

  @Get('health/ready')
  async getReadiness(): Promise<{ status: string; ready: boolean }> {
    // Readiness probe - checks if service can accept traffic
    const dependencies = await this.checkDependencies();
    const ready = dependencies.redis.status === 'healthy' &&
                  dependencies.database.status === 'healthy';

    if (!ready) {
      throw new HttpException(
        { status: 'not ready', ready: false },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ready', ready: true };
  }

  private async checkDependencies(): Promise<HealthResponse['dependencies']> {
    // Check Redis
    const redisHealth = await this.checkRedis();

    // Check Database
    const dbHealth = await this.checkDatabase();

    // Check WebSocket (basic check - server exists)
    const wsHealth = this.checkWebSocket();

    return {
      redis: redisHealth,
      database: dbHealth,
      websocket: wsHealth,
    };
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      const healthy = await this.redisService.isHealthy();
      return {
        status: healthy ? 'healthy' : 'unhealthy',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      const healthy = await this.databaseService.isHealthy();
      return {
        status: healthy ? 'healthy' : 'unhealthy',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkWebSocket(): DependencyHealth {
    try {
      // Check if the WebSocket server is available
      const server = this.deviceGateway.server;
      return {
        status: server ? 'healthy' : 'unhealthy',
      };
    } catch {
      return { status: 'unhealthy' };
    }
  }

  @Get('status')
  getStatus(): StatusResponse {
    return {
      status: 'running',
      service: 'Vizora Realtime Gateway',
      version: '1.0.0',
      websocket: 'active',
    };
  }

  @Post('push/playlist')
  @UseGuards(InternalApiGuard)
  async pushPlaylist(@Body() data: PushPlaylistRequest): Promise<PushResponse> {
    await this.deviceGateway.sendPlaylistUpdate(data.deviceId, data.playlist);
    return {
      success: true,
      message: 'Playlist update sent to device',
    };
  }

  @Post('push/content')
  @UseGuards(InternalApiGuard)
  async pushContent(@Body() data: PushContentRequest): Promise<PushResponse> {
    // Resolve minio:// URLs to public API endpoints before sending to device
    const content = { ...data.content };
    this.logger.log(`Push content received - original URL: ${content.url?.substring(0, 80)}`);
    if (content.url && content.url.startsWith('minio://')) {
      const apiBaseUrl = process.env.API_BASE_URL
        || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
      content.url = `${apiBaseUrl}/api/v1/device-content/${content.id}/file`;
      this.logger.log(`Resolved to: ${content.url}`);
    }

    await this.deviceGateway.sendCommand(data.deviceId, {
      type: DeviceCommandType.PUSH_CONTENT,
      payload: {
        content,
        duration: data.duration || 30,
      },
    });
    return {
      success: true,
      message: 'Content pushed to device',
    };
  }

  @Post('internal/command')
  @UseGuards(InternalApiGuard)
  async sendCommand(
    @Body() data: { displayId: string; command: string; payload?: Record<string, unknown> },
  ): Promise<PushResponse> {
    await this.deviceGateway.sendCommand(data.displayId, {
      type: data.command as DeviceCommandType,
      payload: data.payload,
    });
    return {
      success: true,
      message: `Command ${data.command} sent to device`,
    };
  }
}
