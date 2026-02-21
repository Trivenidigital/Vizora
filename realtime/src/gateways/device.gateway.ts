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
  ScreenshotResponseDto,
  JoinOrganizationDto,
  JoinRoomDto,
  LeaveRoomDto,
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
  jti?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || ['http://localhost:3001'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 2 * 1024 * 1024,
})
export class DeviceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeviceGateway.name);

  // 2.1: In-memory device status cache to avoid redundant DB writes
  private readonly deviceStatusCache: Map<string, string> = new Map();

  // 2.4: Connection rate limiting per IP
  private readonly connectionAttempts: Map<string, { count: number; resetAt: number }> = new Map();

  // 2.5: Device socket deduplication (deviceId -> socketId)
  private readonly deviceSockets: Map<string, string> = new Map();

  // Per-message rate limiting: socketId -> { count, resetAt }
  private readonly messageRates: Map<string, { count: number; resetAt: number }> = new Map();

  // Interval handles for cleanup (stored for proper teardown)
  private cleanupIntervals: ReturnType<typeof setInterval>[] = [];

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
    private heartbeatService: HeartbeatService,
    private playlistService: PlaylistService,
    private notificationService: NotificationService,
    private metricsService: MetricsService,
    private databaseService: DatabaseService,
    private storageService: StorageService,
  ) {
    if (!process.env.API_BASE_URL && process.env.NODE_ENV === 'production') {
      this.logger.warn(
        'API_BASE_URL is not set — device content URLs will default to http://localhost:3000. Set API_BASE_URL for production.',
      );
    }

    // Periodically clean up expired rate limit entries (every 60s)
    this.cleanupIntervals.push(setInterval(() => this.cleanupRateLimitEntries(), 60000));
    // Periodically clean up expired message rate limit entries (every 60s)
    this.cleanupIntervals.push(setInterval(() => this.cleanupMessageRateLimits(), 60000));
  }

  onModuleDestroy() {
    for (const interval of this.cleanupIntervals) {
      clearInterval(interval);
    }
    this.cleanupIntervals = [];
  }

  /**
   * Resolve minio:// URLs to API-served URLs that devices can access.
   */
  private resolveContentUrl(item: any): string {
    const apiBaseUrl = process.env.API_BASE_URL
      || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
    if (item.content?.url?.startsWith('minio://')) {
      return `${apiBaseUrl}/api/v1/device-content/${item.content.id}/file`;
    }
    return item.content?.url || '';
  }

  /**
   * Check per-message rate limit for a socket.
   * Returns true if the message is allowed, false if rate-limited.
   * Limit: 60 messages per minute per socket.
   */
  private checkMessageRateLimit(client: Socket): boolean {
    const now = Date.now();
    const entry = this.messageRates.get(client.id);

    if (entry) {
      if (now > entry.resetAt) {
        this.messageRates.set(client.id, { count: 1, resetAt: now + 60000 });
      } else {
        entry.count++;
        if (entry.count > 60) {
          this.logger.warn(`Message rate limit exceeded for socket ${client.id} (device: ${client.data?.deviceId})`);
          client.emit('error', { message: 'rate_limited', detail: 'Too many messages. Please slow down.' });
          client.disconnect();
          return false;
        }
      }
    } else {
      this.messageRates.set(client.id, { count: 1, resetAt: now + 60000 });
    }

    return true;
  }

  /**
   * Clean up expired message rate limit entries
   */
  private cleanupMessageRateLimits(): void {
    const now = Date.now();
    for (const [socketId, entry] of this.messageRates) {
      if (now > entry.resetAt) {
        this.messageRates.delete(socketId);
      }
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimitEntries(): void {
    const now = Date.now();
    for (const [ip, entry] of this.connectionAttempts) {
      if (now > entry.resetAt) {
        this.connectionAttempts.delete(ip);
      }
    }
  }

  async handleConnection(client: Socket) {
    try {
      // Step 1: Rate limiting
      if (!this.validateConnectionRate(client)) {
        return;
      }

      // Step 2: Authentication (JWT verify + revocation + dedup)
      const payload = await this.authenticateConnection(client);
      if (!payload) {
        return;
      }

      const deviceId = payload.sub;
      const orgId = payload.organizationId;

      // Step 3: Verify device exists in database and belongs to the JWT's org (B.1 + M2)
      const device = await this.databaseService.display.findUnique({
        where: { id: deviceId },
        select: { id: true, organizationId: true },
      });
      if (!device || device.organizationId !== orgId) {
        this.logger.warn(`Connection rejected: Device not found or org mismatch (id: ${deviceId}, jwtOrg: ${orgId}, deviceOrg: ${device?.organizationId})`);
        client.emit('error', { message: 'device_not_found' });
        client.disconnect();
        return;
      }

      // Step 4: Room joins + Redis status
      await this.setupDeviceRooms(client, deviceId, orgId);

      // Step 5: Send initial state (playlist, config, pending commands)
      await this.sendInitialState(client, deviceId, orgId);

      // Step 6: Status broadcast + metrics + notifications
      await this.broadcastDeviceOnline(client, deviceId, orgId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connection error: ${errorMessage}`);
      client.disconnect();
    }
  }

  /**
   * Validate connection rate limiting for the client IP.
   * Returns true if the connection is allowed, false if rate-limited.
   */
  private validateConnectionRate(client: Socket): boolean {
    const clientIp = client.handshake.address;
    const now = Date.now();
    const rateEntry = this.connectionAttempts.get(clientIp);

    if (rateEntry) {
      if (now > rateEntry.resetAt) {
        // Reset window
        this.connectionAttempts.set(clientIp, { count: 1, resetAt: now + 60000 });
      } else {
        rateEntry.count++;
        if (rateEntry.count > 10) {
          this.logger.warn(`Connection rate limited for IP: ${clientIp}`);
          client.emit('error', { message: 'rate_limited' });
          client.disconnect();
          return false;
        }
      }
    } else {
      this.connectionAttempts.set(clientIp, { count: 1, resetAt: now + 60000 });
    }

    return true;
  }

  /**
   * Authenticate the connection: verify JWT, check revocation, deduplicate sockets.
   * Returns the device payload on success, or null if connection was rejected.
   */
  private async authenticateConnection(client: Socket): Promise<DevicePayload | null> {
    const token = client.handshake.auth.token;

    if (!token) {
      this.logger.warn('Connection rejected: No token provided');
      client.disconnect();
      return null;
    }

    // Verify device JWT
    const payload = this.jwtService.verify<DevicePayload>(token, {
      secret: process.env.DEVICE_JWT_SECRET,
      algorithms: ['HS256'],
    });

    if (payload.type !== 'device') {
      this.logger.warn('Connection rejected: Invalid token type');
      client.disconnect();
      return null;
    }

    // Check if the token has been revoked
    if (payload.jti) {
      const isRevoked = await this.redisService.exists(`revoked_token:${payload.jti}`);
      if (isRevoked) {
        this.logger.warn(`Connection rejected: Token revoked (jti: ${payload.jti})`);
        client.disconnect();
        return null;
      }
    }

    const deviceId = payload.sub;

    // 2.5: Device socket deduplication - disconnect old socket if device already connected
    const existingSocketId = this.deviceSockets.get(deviceId);
    if (existingSocketId) {
      const existingSocket = this.server?.sockets?.sockets?.get(existingSocketId);
      if (existingSocket) {
        this.logger.log(`Disconnecting stale socket ${existingSocketId} for device ${deviceId}`);
        existingSocket.disconnect(true);
      }
    }
    this.deviceSockets.set(deviceId, client.id);

    // Store device info in socket data
    client.data.deviceId = deviceId;
    client.data.organizationId = payload.organizationId;
    client.data.deviceIdentifier = payload.deviceIdentifier;

    return payload;
  }

  /**
   * Join device and organization rooms, update Redis and DB status.
   */
  private async setupDeviceRooms(client: Socket, deviceId: string, orgId: string): Promise<void> {
    // Join device-specific room
    await client.join(`device:${deviceId}`);
    // Join organization room
    await client.join(`org:${orgId}`);

    // Update device status in Redis
    await this.redisService.setDeviceStatus(deviceId, {
      status: 'online',
      lastHeartbeat: Date.now(),
      socketId: client.id,
      organizationId: orgId,
    });

    // 2.1: Only write to DB if status actually changed
    const previousStatus = this.deviceStatusCache.get(deviceId);
    if (previousStatus !== 'online') {
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
      }
    }
    this.deviceStatusCache.set(deviceId, 'online');

    this.logger.log(`Device connected: ${deviceId} (${client.id})`);
  }

  /**
   * Send initial state to the device: config, playlist, pending commands.
   */
  private async sendInitialState(client: Socket, deviceId: string, orgId: string): Promise<void> {
    try {
      this.logger.debug(`Fetching playlist for device: ${deviceId}`);
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

      // Extract qrOverlay from display metadata for initial config
      const displayMetadata = (display?.metadata as Record<string, any>) || {};

      // Send initial configuration including qrOverlay
      client.emit('config', {
        heartbeatInterval: 15000, // 15 seconds
        cacheSize: 524288000, // 500MB
        autoUpdate: true,
        qrOverlay: displayMetadata.qrOverlay || null,
      });

      this.logger.debug(`Display found: ${!!display}, hasPlaylist: ${!!display?.currentPlaylist}, playlistId: ${display?.currentPlaylistId || 'none'}`);

      if (display?.currentPlaylist) {
        // Transform playlist to the format expected by the display client
        // Content URLs use the API base path — devices authenticate via
        // Authorization header with their stored JWT, not via URL query params
        const resolvedItems = await Promise.all(
          display.currentPlaylist.items.map(async (item: any) => {
            const resolvedUrl = this.resolveContentUrl(item);
            const baseItem = {
              id: item.id,
              contentId: item.contentId,
              duration: item.duration || 10,
              order: item.order,
              content: item.content ? {
                id: item.content.id,
                name: item.content.name,
                type: item.content.type,
                url: resolvedUrl,
                thumbnail: item.content.thumbnail,
                mimeType: item.content.mimeType,
                duration: item.content.duration,
                metadata: item.content.metadata,
              } : null,
            };

            // Resolve layout content inline so devices receive self-contained data
            if (baseItem.content?.type === 'layout') {
              baseItem.content = await this.resolveLayoutContent(baseItem.content);
            }

            return baseItem;
          }),
        );

        const playlist = {
          id: display.currentPlaylist.id,
          name: display.currentPlaylist.name,
          items: resolvedItems,
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
      const playlistErrorMsg = playlistError instanceof Error ? playlistError.stack || playlistError.message : 'Unknown error';
      this.logger.error(`Failed to fetch playlist for device ${deviceId}: ${playlistErrorMsg}`);
      // Don't fail the connection if playlist fetch fails
    }
  }

  /**
   * Broadcast device online status, handle notifications, and record metrics.
   */
  private async broadcastDeviceOnline(client: Socket, deviceId: string, orgId: string): Promise<void> {
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
          orgId,
        );
        // Emit notification to dashboard
        this.server.to(`org:${orgId}`).emit('notification:new', {
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
    this.metricsService.recordConnection(orgId, 'connected');
    this.metricsService.updateDeviceStatus(deviceId, orgId, 'online');

    // Notify dashboard about device online status
    this.server.to(`org:${orgId}`).emit('device:status', {
      deviceId,
      status: 'online',
      timestamp: new Date().toISOString(),
    });
  }

  async handleDisconnect(client: Socket) {
    // Clean up per-message rate limit entry for this socket
    this.messageRates.delete(client.id);


    try {
      const deviceId = client.data?.deviceId;

      if (deviceId) {
        // 2.5: Only process disconnect if this socket is still the active one for the device
        const activeSocketId = this.deviceSockets.get(deviceId);
        if (activeSocketId && activeSocketId !== client.id) {
          this.logger.debug(`Ignoring disconnect for stale socket ${client.id} (device ${deviceId}, active: ${activeSocketId})`);
          return;
        }
        this.deviceSockets.delete(deviceId);

        // Update status in Redis
        await this.redisService.setDeviceStatus(deviceId, {
          status: 'offline',
          lastHeartbeat: Date.now(),
          socketId: null,
          organizationId: client.data.organizationId,
        });

        // 2.1: Update DB on disconnect (status transition) and clean up cache
        this.deviceStatusCache.delete(deviceId);
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
        this.metricsService.updateDeviceStatus(deviceId, client.data.organizationId, 'offline');

        // Notify dashboard
        this.server
          .to(`org:${client.data.organizationId}`)
          .emit('device:status', {
            deviceId,
            status: 'offline',
            timestamp: new Date().toISOString(),
          });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in handleDisconnect for ${client.data?.deviceId}: ${errorMessage}`);
    }
  }

  @SubscribeMessage('heartbeat')
  @UsePipes(new WsValidationPipe())
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: HeartbeatMessageDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    const deviceId = client.data.deviceId;
    const startTime = Date.now();

    try {
      // Update heartbeat in Redis (cheap, always do this)
      await this.redisService.setDeviceStatus(deviceId, {
        status: 'online',
        lastHeartbeat: Date.now(),
        socketId: client.id,
        organizationId: client.data.organizationId,
        metrics: data.metrics,
        currentContent: data.currentContent,
      });

      // 2.1: Only write to DB when status transitions (e.g., offline -> online)
      const previousStatus = this.deviceStatusCache.get(deviceId);
      if (previousStatus !== 'online') {
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
        }
        this.deviceStatusCache.set(deviceId, 'online');
      }

      // Process heartbeat (store in ClickHouse, etc.)
      await this.heartbeatService.processHeartbeat(deviceId, data);

      // Update device metrics if available
      if (data.metrics) {
        this.metricsService.updateDeviceMetrics(
          client.data.organizationId,
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
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
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
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
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
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
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
    // Resolve minio:// URLs to API-served URLs before sending to device
    // Devices authenticate content requests via Authorization header with their stored JWT
    const resolvedPlaylist = {
      ...playlist,
      items: (playlist.items || []).map((item: any) => {
        const resolvedUrl = this.resolveContentUrl(item);
        return {
          ...item,
          content: item.content ? {
            ...item.content,
            url: resolvedUrl,
          } : item.content,
        };
      }),
    };

    this.server.to(`device:${deviceId}`).emit('playlist:update', {
      playlist: resolvedPlaylist,
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
  @UsePipes(new WsValidationPipe())
  async handleJoinOrganization(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinOrganizationDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    if (!data?.organizationId) {
      return createErrorResponse('Organization ID required');
    }

    // Verify the client belongs to the requested organization
    if (client.data.organizationId !== data.organizationId) {
      this.logger.warn(
        `Client ${client.id} unauthorized to join org room: ${data.organizationId} (belongs to ${client.data.organizationId})`,
      );
      client.emit('error', {
        message: 'Unauthorized: you do not belong to this organization',
      });
      return createErrorResponse('Unauthorized: organization mismatch');
    }

    // Join the organization room
    await client.join(`org:${data.organizationId}`);
    client.data.isDashboard = true;

    this.logger.log(`Dashboard client ${client.id} joined org room: ${data.organizationId}`);

    client.emit('joined:organization', {
      organizationId: data.organizationId,
      timestamp: new Date().toISOString(),
    });

    return createSuccessResponse({ joined: true, organizationId: data.organizationId });
  }

  /**
   * Allow clients to join rooms with authorization checks.
   * - device:{id} rooms: client must be that device, or belong to the device's org
   * - org:{id} rooms: client must belong to that organization
   * - All other room patterns are rejected
   */
  @SubscribeMessage('join:room')
  @UsePipes(new WsValidationPipe())
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    if (!data?.room) {
      return createErrorResponse('Room name required');
    }

    const deviceMatch = data.room.match(/^device:(.+)$/);
    const orgMatch = data.room.match(/^org:(.+)$/);

    if (deviceMatch) {
      const targetDeviceId = deviceMatch[1];
      // Allow if client IS this device
      if (client.data.deviceId === targetDeviceId) {
        await client.join(data.room);
        this.logger.log(`Device ${client.id} joined own room: ${data.room}`);
        return createSuccessResponse({ joined: true, room: data.room });
      }
      // Allow if client belongs to the same organization as the device
      if (client.data.organizationId) {
        try {
          const device = await this.databaseService.display.findUnique({
            where: { id: targetDeviceId },
            select: { organizationId: true },
          });
          if (device && device.organizationId === client.data.organizationId) {
            await client.join(data.room);
            this.logger.log(`Client ${client.id} joined device room: ${data.room} (same org)`);
            return createSuccessResponse({ joined: true, room: data.room });
          }
        } catch (dbError: unknown) {
          const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
          this.logger.warn(`Failed to verify device org for room join: ${errorMessage}`);
        }
      }
      this.logger.warn(`Client ${client.id} unauthorized to join device room: ${data.room}`);
      client.emit('error', { message: 'Unauthorized: cannot join this device room' });
      return createErrorResponse('Unauthorized: cannot join this device room');
    }

    if (orgMatch) {
      const targetOrgId = orgMatch[1];
      if (client.data.organizationId !== targetOrgId) {
        this.logger.warn(`Client ${client.id} unauthorized to join org room: ${data.room}`);
        client.emit('error', { message: 'Unauthorized: you do not belong to this organization' });
        return createErrorResponse('Unauthorized: organization mismatch');
      }
      await client.join(data.room);
      this.logger.log(`Client ${client.id} joined org room: ${data.room}`);
      return createSuccessResponse({ joined: true, room: data.room });
    }

    // Reject unknown room patterns
    this.logger.warn(`Client ${client.id} attempted to join unrecognized room: ${data.room}`);
    client.emit('error', { message: 'Invalid room name' });
    return createErrorResponse('Invalid room name');
  }

  /**
   * Allow clients to leave rooms with authorization check
   */
  @SubscribeMessage('leave:room')
  @UsePipes(new WsValidationPipe())
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveRoomDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    if (!data?.room) {
      return createErrorResponse('Room name required');
    }

    // B.3: Verify client is actually a member of the room before leaving
    if (!client.rooms.has(data.room)) {
      this.logger.warn(`Client ${client.id} attempted to leave room they are not in: ${data.room}`);
      return createErrorResponse('Not a member of this room');
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
  @UsePipes(new WsValidationPipe())
  async handleScreenshotResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ScreenshotResponseDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    const deviceId = client.data.deviceId;
    const organizationId = client.data.organizationId;

    // Reject oversized screenshot data (max 2MB base64)
    if (data.imageData && data.imageData.length > 2 * 1024 * 1024) {
      this.logger.warn(`Screenshot data too large from device ${deviceId}: ${data.imageData.length} chars`);
      return createErrorResponse('Screenshot data too large (max 2MB)');
    }

    // B.5: Validate base64 format before attempting decode
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data.imageData)) {
      this.logger.warn(`Invalid base64 format in screenshot from device ${deviceId}`);
      return createErrorResponse('Invalid base64 format');
    }

    this.logger.log(`Screenshot received from device ${deviceId} (requestId: ${data.requestId})`);

    try {
      // Validate MinIO is available
      if (!this.storageService.isMinioAvailable()) {
        this.logger.error('MinIO not available, cannot save screenshot');
        return createErrorResponse('Storage service unavailable');
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(data.imageData, 'base64');

      // B.4: Validate PNG/JPEG magic numbers
      const pngMagic = [0x89, 0x50, 0x4e, 0x47];
      const jpegMagic = [0xff, 0xd8, 0xff];
      const isPng = imageBuffer.length >= 4 && pngMagic.every((b, i) => imageBuffer[i] === b);
      const isJpeg = imageBuffer.length >= 3 && jpegMagic.every((b, i) => imageBuffer[i] === b);

      if (!isPng && !isJpeg) {
        this.logger.warn(`Screenshot from device ${deviceId} has invalid image format (not PNG or JPEG)`);
        return createErrorResponse('Invalid image format: only PNG and JPEG are accepted');
      }

      // Generate object key
      const objectKey = this.storageService.generateScreenshotKey(organizationId, deviceId);

      // Upload to MinIO
      await this.storageService.uploadScreenshot(imageBuffer, objectKey);

      // Generate presigned URL (valid for 7 days)
      const presignedUrl = await this.storageService.getPresignedUrl(objectKey, 7 * 24 * 3600);

      // Update display record in database (with org check for security)
      await this.databaseService.display.update({
        where: { id: deviceId, organizationId },
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

  /**
   * Send a QR overlay update to a specific device
   */
  async sendQrOverlayUpdate(deviceId: string, qrOverlay: any): Promise<void> {
    this.server.to(`device:${deviceId}`).emit('qr-overlay:update', {
      qrOverlay,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Sent QR overlay update to device: ${deviceId}`);
  }

  /**
   * Resolve layout content by fetching all zone playlists and content inline.
   * Returns a self-contained layout object that devices can render without
   * additional API calls.
   */
  private async resolveLayoutContent(content: any): Promise<any> {
    const metadata = (content.metadata as Record<string, any>) || {};
    const zones = metadata.zones || [];

    const resolvedZones = await Promise.all(
      zones.map(async (zone: any) => {
        const resolved: any = { ...zone };

        // Resolve playlist content for zone
        if (zone.playlistId) {
          try {
            const playlist = await this.databaseService.playlist.findUnique({
              where: { id: zone.playlistId },
              include: {
                items: {
                  include: { content: true },
                  orderBy: { order: 'asc' },
                },
              },
            });

            if (playlist) {
              resolved.playlist = {
                id: playlist.id,
                name: playlist.name,
                items: (playlist.items || []).map((item: any) => {
                  const resolvedUrl = this.resolveContentUrl(item);
                  return {
                    id: item.id,
                    contentId: item.contentId,
                    duration: item.duration || 10,
                    order: item.order,
                    content: item.content ? {
                      id: item.content.id,
                      name: item.content.name,
                      type: item.content.type,
                      url: resolvedUrl,
                      thumbnail: item.content.thumbnail,
                      mimeType: item.content.mimeType,
                      duration: item.content.duration,
                    } : null,
                  };
                }),
              };
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to resolve playlist ${zone.playlistId} for layout zone ${zone.id}: ${errorMessage}`);
          }
        }

        // Resolve single content for zone
        if (zone.contentId) {
          try {
            const zoneContent = await this.databaseService.content.findUnique({
              where: { id: zone.contentId },
            });

            if (zoneContent) {
              const apiBaseUrl = process.env.API_BASE_URL
                || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
              let contentUrl = zoneContent.url || '';
              if (contentUrl.startsWith('minio://')) {
                contentUrl = `${apiBaseUrl}/api/v1/device-content/${zoneContent.id}/file`;
              }

              resolved.content = {
                id: zoneContent.id,
                name: zoneContent.name,
                type: zoneContent.type,
                url: contentUrl,
                thumbnail: zoneContent.thumbnail,
                mimeType: zoneContent.mimeType,
                duration: zoneContent.duration,
              };
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to resolve content ${zone.contentId} for layout zone ${zone.id}: ${errorMessage}`);
          }
        }

        return resolved;
      }),
    );

    return {
      ...content,
      metadata: {
        ...metadata,
        zones: resolvedZones,
      },
    };
  }
}
