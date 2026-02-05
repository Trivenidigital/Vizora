import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';
import { NotificationService } from '../services/notification.service';
import { MetricsService } from '../metrics/metrics.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { WsValidationPipe } from './pipes/ws-validation.pipe';
import {
  HeartbeatMessageDto,
  ContentImpressionDto,
  ContentErrorDto,
  PlaylistRequestDto,
  createSuccessResponse,
  createErrorResponse,
} from './dto';
import {
  Playlist,
  DeviceCommand,
  BroadcastData,
} from '../types';
import * as Sentry from '@sentry/nestjs';

interface DevicePayload {
  sub: string; // device ID
  deviceIdentifier: string;
  organizationId: string;
  type: 'device';
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class DeviceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeviceGateway.name);

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
    private heartbeatService: HeartbeatService,
    private playlistService: PlaylistService,
    private notificationService: NotificationService,
    private metricsService: MetricsService,
    private databaseService: DatabaseService,
    private storageService: StorageService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;

      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      // Verify device JWT
      const payload = this.jwtService.verify<DevicePayload>(token, {
        secret: process.env.DEVICE_JWT_SECRET,
      });

      if (payload.type !== 'device') {
        this.logger.warn('Connection rejected: Invalid token type');
        client.disconnect();
        return;
      }

      const deviceId = payload.sub;

      // Store device info in socket data
      client.data.deviceId = deviceId;
      client.data.organizationId = payload.organizationId;
      client.data.deviceIdentifier = payload.deviceIdentifier;

      // Join device-specific room
      await client.join(`device:${deviceId}`);
      // Join organization room
      await client.join(`org:${payload.organizationId}`);

      // Update device status in Redis
      await this.redisService.setDeviceStatus(deviceId, {
        status: 'online',
        lastHeartbeat: Date.now(),
        socketId: client.id,
        organizationId: payload.organizationId,
      });

      // Also update in database so dashboard sees current status
      try {
        await this.databaseService.display.update({
          where: { id: deviceId },
          data: {
            status: 'online',
            lastHeartbeat: new Date(),
          },
        });
      } catch (dbError: unknown) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        this.logger.warn(`Failed to update database for device ${deviceId}: ${errorMessage}`);
        // Don't fail the connection if database update fails
      }

      this.logger.log(`Device connected: ${deviceId} (${client.id})`);

      // Cancel any pending offline notification for this device
      const wasOfflineLong = await this.notificationService.wasDeviceOfflineLong(deviceId);
      await this.notificationService.cancelOfflineNotification(deviceId);

      // If the device was offline for > 2 minutes, create an "online" notification
      if (wasOfflineLong) {
        try {
          const device = await this.databaseService.display.findUnique({
            where: { id: deviceId },
            select: { nickname: true, deviceIdentifier: true },
          });
          const deviceName = device?.nickname || device?.deviceIdentifier || deviceId;
          await this.notificationService.createOnlineNotification(
            deviceId,
            deviceName,
            payload.organizationId,
          );
          // Emit notification to dashboard
          this.server.to(`org:${payload.organizationId}`).emit('notification:new', {
            type: 'device_online',
            deviceId,
            deviceName,
            timestamp: new Date().toISOString(),
          });
        } catch (notifError) {
          this.logger.warn(`Failed to create online notification for device ${deviceId}`);
        }
      }

      // Record metrics
      this.metricsService.recordConnection(payload.organizationId, 'connected');
      this.metricsService.updateDeviceStatus(deviceId, 'online');

      // Notify dashboard about device online status
      this.server.to(`org:${payload.organizationId}`).emit('device:status', {
        deviceId,
        status: 'online',
        timestamp: new Date().toISOString(),
      });

      // Send initial configuration
      client.emit('config', {
        heartbeatInterval: 15000, // 15 seconds
        cacheSize: 524288000, // 500MB
        autoUpdate: true,
      });

      // Fetch and send current playlist to device on connection
      try {
        const display = await this.databaseService.display.findUnique({
          where: { id: deviceId },
          include: {
            currentPlaylist: {
              include: {
                items: {
                  include: {
                    content: true,
                  },
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
            },
          },
        });

        if (display?.currentPlaylist) {
          // Transform playlist to the format expected by the display client
          const playlist = {
            id: display.currentPlaylist.id,
            name: display.currentPlaylist.name,
            items: display.currentPlaylist.items.map((item: any) => ({
              id: item.id,
              contentId: item.contentId,
              duration: item.duration || 10,
              order: item.order,
              content: item.content ? {
                id: item.content.id,
                name: item.content.name,
                type: item.content.type,
                url: item.content.url,
                thumbnail: item.content.thumbnail,
                mimeType: item.content.mimeType,
                duration: item.content.duration,
              } : null,
            })),
            totalDuration: display.currentPlaylist.items.reduce(
              (sum: number, item: any) => sum + (item.duration || 10),
              0
            ),
            loopPlaylist: true,
          };

          client.emit('playlist:update', {
            playlist,
            timestamp: new Date().toISOString(),
          });

          this.logger.log(`Sent current playlist to device: ${deviceId} (playlist: ${display.currentPlaylist.name})`);
        } else {
          this.logger.log(`Device ${deviceId} has no assigned playlist`);
        }
      } catch (playlistError: unknown) {
        const playlistErrorMsg = playlistError instanceof Error ? playlistError.message : 'Unknown error';
        this.logger.warn(`Failed to fetch playlist for device ${deviceId}: ${playlistErrorMsg}`);
        // Don't fail the connection if playlist fetch fails
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connection error: ${errorMessage}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const deviceId = client.data.deviceId;

    if (deviceId) {
      // Update status in Redis
      await this.redisService.setDeviceStatus(deviceId, {
        status: 'offline',
        lastHeartbeat: Date.now(),
        socketId: null,
        organizationId: client.data.organizationId,
      });

      // Also update in database so dashboard sees current status
      let deviceName = deviceId;
      try {
        const device = await this.databaseService.display.update({
          where: { id: deviceId },
          data: {
            status: 'offline',
            lastHeartbeat: new Date(),
          },
          select: { nickname: true, deviceIdentifier: true },
        });
        deviceName = device?.nickname || device?.deviceIdentifier || deviceId;
      } catch (dbError: unknown) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        this.logger.warn(`Failed to update database for device ${deviceId}: ${errorMessage}`);
      }

      // Schedule an offline notification (will fire after 2 minutes if device doesn't reconnect)
      try {
        await this.notificationService.scheduleOfflineNotification(
          deviceId,
          deviceName,
          client.data.organizationId,
        );
      } catch (notifError) {
        this.logger.warn(`Failed to schedule offline notification for device ${deviceId}`);
      }

      this.logger.log(`Device disconnected: ${deviceId} (${client.id})`);

      // Record metrics
      this.metricsService.recordConnection(client.data.organizationId, 'disconnected');
      this.metricsService.updateDeviceStatus(deviceId, 'offline');

      // Notify dashboard
      this.server
        .to(`org:${client.data.organizationId}`)
        .emit('device:status', {
          deviceId,
          status: 'offline',
          timestamp: new Date().toISOString(),
        });
    }
  }

  @SubscribeMessage('heartbeat')
  @UsePipes(new WsValidationPipe())
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: HeartbeatMessageDto,
  ) {
    const deviceId = client.data.deviceId;
    const startTime = Date.now();

    try {
      // Update heartbeat in Redis
      await this.redisService.setDeviceStatus(deviceId, {
        status: 'online',
        lastHeartbeat: Date.now(),
        socketId: client.id,
        organizationId: client.data.organizationId,
        metrics: data.metrics,
        currentContent: data.currentContent,
      });

      // Also update database so dashboard shows current status
      try {
        await this.databaseService.display.update({
          where: { id: deviceId },
          data: {
            status: 'online',
            lastHeartbeat: new Date(),
          },
        });
      } catch (dbError: unknown) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        this.logger.warn(`Failed to update database for device ${deviceId}: ${errorMessage}`);
        // Don't fail the heartbeat if database update fails
      }

      // Process heartbeat (store in ClickHouse, etc.)
      await this.heartbeatService.processHeartbeat(deviceId, data);

      // Update device metrics if available
      if (data.metrics) {
        this.metricsService.updateDeviceMetrics(
          deviceId,
          data.metrics.cpuUsage || 0,
          data.metrics.memoryUsage || 0,
        );
      }

      // Check for pending commands
      const commands = await this.redisService.getDeviceCommands(deviceId);

      // Record successful heartbeat with duration
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordHeartbeat(deviceId, true, duration);

      return createSuccessResponse({
        nextHeartbeatIn: 15000,
        commands: commands || [],
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Heartbeat error for ${deviceId}: ${errorMessage}`);

      // Record failed heartbeat
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordHeartbeat(deviceId, false, duration);

      // Report to Sentry
      Sentry.captureException(error, {
        tags: { deviceId, event: 'heartbeat' },
      });

      return createErrorResponse('Failed to process heartbeat');
    }
  }

  @SubscribeMessage('content:impression')
  @UsePipes(new WsValidationPipe())
  async handleContentImpression(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ContentImpressionDto,
  ) {
    const deviceId = client.data.deviceId;

    try {
      // Log impression for analytics
      await this.heartbeatService.logImpression(deviceId, data);

      // Record metrics
      this.metricsService.recordImpression(deviceId, data.contentId);

      return createSuccessResponse();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Impression error for ${deviceId}: ${errorMessage}`);
      Sentry.captureException(error, {
        tags: { deviceId, event: 'content:impression' },
      });
      return createErrorResponse('Failed to log impression');
    }
  }

  @SubscribeMessage('content:error')
  @UsePipes(new WsValidationPipe())
  async handleContentError(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ContentErrorDto,
  ) {
    const deviceId = client.data.deviceId;

    this.logger.warn(`Content error on ${deviceId}: ${data.errorType} - ${data.contentId}`);

    try {
      // Log error for analytics
      await this.heartbeatService.logError(deviceId, data);

      // Record metrics
      this.metricsService.recordContentError(deviceId, data.errorType);

      // Report content errors to Sentry
      Sentry.captureMessage(`Content error on device ${deviceId}`, {
        level: 'warning',
        tags: {
          deviceId,
          errorType: data.errorType,
          contentId: data.contentId,
        },
        extra: {
          errorMessage: data.errorMessage,
          errorCode: data.errorCode,
          context: data.context,
        },
      });

      return createSuccessResponse();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error logging failed for ${deviceId}: ${errorMessage}`);
      Sentry.captureException(error, {
        tags: { deviceId, event: 'content:error' },
      });
      return createErrorResponse('Failed to log error');
    }
  }

  @SubscribeMessage('playlist:request')
  @UsePipes(new WsValidationPipe())
  async handlePlaylistRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlaylistRequestDto,
  ) {
    const deviceId = client.data.deviceId;

    try {
      // Get current playlist for device
      const playlist = await this.playlistService.getDevicePlaylist(
        deviceId,
        data?.forceRefresh,
      );

      return createSuccessResponse({ playlist });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Playlist request error for ${deviceId}: ${errorMessage}`);
      return createErrorResponse('Failed to get playlist');
    }
  }

  // Admin methods (called from API)
  async sendPlaylistUpdate(deviceId: string, playlist: Playlist): Promise<void> {
    this.server.to(`device:${deviceId}`).emit('playlist:update', {
      playlist,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Sent playlist update to device: ${deviceId}`);
  }

  async sendCommand(deviceId: string, command: DeviceCommand): Promise<void> {
    this.server.to(`device:${deviceId}`).emit('command', {
      ...command,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Sent command ${command.type} to device: ${deviceId}`);
  }

  async broadcastToOrganization(organizationId: string, event: string, data: BroadcastData): Promise<void> {
    this.server.to(`org:${organizationId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Broadcast ${event} to organization: ${organizationId}`);
  }

  /**
   * Allow dashboard clients to join organization rooms
   * This enables them to receive device status updates
   */
  @SubscribeMessage('join:organization')
  async handleJoinOrganization(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { organizationId: string },
  ) {
    if (!data?.organizationId) {
      return createErrorResponse('Organization ID required');
    }

    // Join the organization room
    await client.join(`org:${data.organizationId}`);
    client.data.organizationId = data.organizationId;
    client.data.isDashboard = true;

    this.logger.log(`Dashboard client ${client.id} joined org room: ${data.organizationId}`);

    // Emit confirmation
    client.emit('joined:organization', {
      organizationId: data.organizationId,
      timestamp: new Date().toISOString(),
    });

    return createSuccessResponse({ joined: true, organizationId: data.organizationId });
  }

  /**
   * Allow clients to join arbitrary rooms
   */
  @SubscribeMessage('join:room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (!data?.room) {
      return createErrorResponse('Room name required');
    }

    await client.join(data.room);
    this.logger.log(`Client ${client.id} joined room: ${data.room}`);

    return createSuccessResponse({ joined: true, room: data.room });
  }

  /**
   * Allow clients to leave rooms
   */
  @SubscribeMessage('leave:room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (!data?.room) {
      return createErrorResponse('Room name required');
    }

    await client.leave(data.room);
    this.logger.log(`Client ${client.id} left room: ${data.room}`);

    return createSuccessResponse({ left: true, room: data.room });
  }

  /**
   * Handle screenshot response from device
   * Device sends base64-encoded image data which we upload to MinIO
   */
  @SubscribeMessage('screenshot:response')
  async handleScreenshotResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      requestId: string;
      imageData: string;
      width: number;
      height: number;
      timestamp: string;
    },
  ) {
    const deviceId = client.data.deviceId;
    const organizationId = client.data.organizationId;

    this.logger.log(`Screenshot received from device ${deviceId} (requestId: ${data.requestId})`);

    try {
      // Validate MinIO is available
      if (!this.storageService.isMinioAvailable()) {
        this.logger.error('MinIO not available, cannot save screenshot');
        return createErrorResponse('Storage service unavailable');
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(data.imageData, 'base64');

      // Generate object key
      const objectKey = this.storageService.generateScreenshotKey(organizationId, deviceId);

      // Upload to MinIO
      await this.storageService.uploadScreenshot(imageBuffer, objectKey);

      // Generate presigned URL (valid for 7 days)
      const presignedUrl = await this.storageService.getPresignedUrl(objectKey, 7 * 24 * 3600);

      // Update display record in database
      await this.databaseService.display.update({
        where: { id: deviceId },
        data: {
          lastScreenshot: JSON.stringify({
            url: presignedUrl,
            width: data.width,
            height: data.height,
          }),
          lastScreenshotAt: new Date(),
        },
      });

      this.logger.log(`Screenshot saved for device ${deviceId}: ${objectKey}`);

      // Emit screenshot:ready event to organization room so dashboard can update
      this.server.to(`org:${organizationId}`).emit('screenshot:ready', {
        deviceId,
        requestId: data.requestId,
        url: presignedUrl,
        width: data.width,
        height: data.height,
        capturedAt: data.timestamp,
        timestamp: new Date().toISOString(),
      });

      return createSuccessResponse({ saved: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to save screenshot for ${deviceId}: ${errorMessage}`);
      Sentry.captureException(error, {
        tags: { deviceId, event: 'screenshot:response' },
      });
      return createErrorResponse('Failed to save screenshot');
    }
  }
}
