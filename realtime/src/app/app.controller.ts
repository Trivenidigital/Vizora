import { Controller, Get, Post, Body, HttpStatus, HttpException, UseGuards, Logger, BadRequestException } from '@nestjs/common';
import { DeviceGateway } from '../gateways/device.gateway';
import { RedisService } from '../services/redis.service';
import { DatabaseService } from '../database/database.service';
import { InternalApiGuard } from '../guards/internal-api.guard';
import { PushPlaylistRequest, PushContentRequest, DeviceCommandType } from '../types';
import { PushPlaylistDto, PushContentDto, BroadcastCommandDto, InternalCommandDto } from '../dto/internal-api.dto';

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
  async pushPlaylist(@Body() data: PushPlaylistDto): Promise<PushResponse> {
    const result = await this.deviceGateway.sendPlaylistUpdate(data.deviceId, data.playlist);
    if (!result.delivered) {
      // Gateway already queues for 'no_sockets' and 'ack_timeout' internally,
      // but if a future reason is added without queuing, this is a safety net.
      this.logger.warn(`Playlist delivery failed for device ${data.deviceId}: ${result.reason ?? 'unknown'}`);
      return {
        success: false,
        message: `Playlist delivery failed: ${result.reason ?? 'unknown'}`,
      };
    }
    return {
      success: true,
      message: 'Playlist update sent to device',
    };
  }

  @Post('push/content')
  @UseGuards(InternalApiGuard)
  async pushContent(@Body() data: PushContentDto): Promise<PushResponse> {
    // Resolve minio:// URLs to public API endpoints before sending to device
    const content = { ...data.content } as Record<string, any>;
    this.logger.log(`Push content received - original URL: ${String(content.url ?? '').substring(0, 80)}`);
    if (content.url && typeof content.url === 'string' && content.url.startsWith('minio://')) {
      const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      content.url = `${apiBaseUrl}/api/v1/device-content/${content.id}/file`;
      this.logger.log(`Resolved to: ${content.url}`);
    }

    const result = await this.deviceGateway.sendCommand(data.deviceId, {
      type: DeviceCommandType.PUSH_CONTENT,
      payload: {
        content,
        duration: data.duration || 5,
      },
    });
    if (!result.delivered) {
      this.logger.warn(`Content push failed for device ${data.deviceId}: ${result.reason ?? 'unknown'}`);
      return {
        success: false,
        message: `Content push failed: ${result.reason ?? 'unknown'}`,
      };
    }
    return {
      success: true,
      message: 'Content pushed to device',
    };
  }

  @Post('commands/broadcast')
  @UseGuards(InternalApiGuard)
  async broadcastCommand(
    @Body() data: BroadcastCommandDto,
  ) {
    const commandWithTimestamp = {
      ...data.command,
      timestamp: new Date().toISOString(),
    };

    const results = await Promise.allSettled(
      data.deviceIds.map(async (deviceId) => {
        const room = this.deviceGateway.server.sockets.adapter.rooms.get(`device:${deviceId}`);
        const isOnline = room && room.size > 0;
        this.deviceGateway.server.to(`device:${deviceId}`).emit('command', commandWithTimestamp);
        if (!isOnline) {
          await this.redisService.addDeviceCommand(deviceId, commandWithTimestamp);
        }
        return isOnline;
      }),
    );
    const devicesOnline = results.filter(r => r.status === 'fulfilled' && r.value).length;

    return { devicesOnline };
  }

  @Post('notifications/broadcast')
  @UseGuards(InternalApiGuard)
  async broadcastNotification(
    @Body() data: { organizationId: string; notification: any },
  ): Promise<PushResponse> {
    if (!data.organizationId || typeof data.organizationId !== 'string') {
      throw new BadRequestException('organizationId is required and must be a string');
    }
    if (!data.notification || typeof data.notification !== 'object') {
      throw new BadRequestException('notification is required and must be an object');
    }
    this.deviceGateway.server
      .to(`org:${data.organizationId}`)
      .emit('notification:new', data.notification);
    this.logger.log(`Broadcasted notification to org:${data.organizationId}`);
    return {
      success: true,
      message: 'Notification broadcasted to organization',
    };
  }

  @Post('internal/command')
  @UseGuards(InternalApiGuard)
  async sendCommand(
    @Body() data: InternalCommandDto,
  ): Promise<PushResponse> {
    const result = await this.deviceGateway.sendCommand(data.deviceId, data.command);
    if (!result.delivered) {
      this.logger.warn(`Command delivery failed for device ${data.deviceId}: ${result.reason ?? 'unknown'}`);
      return {
        success: false,
        message: `Command delivery failed: ${result.reason ?? 'unknown'}`,
      };
    }
    return {
      success: true,
      message: `Command ${data.command.type} sent to device`,
    };
  }
}
