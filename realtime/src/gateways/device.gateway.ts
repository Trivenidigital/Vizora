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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';

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

      this.logger.log(`Device connected: ${deviceId} (${client.id})`);

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
    } catch (error) {
      this.logger.error('Connection error:', error.message);
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

      this.logger.log(`Device disconnected: ${deviceId} (${client.id})`);

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
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const deviceId = client.data.deviceId;

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

      // Process heartbeat (store in ClickHouse, etc.)
      await this.heartbeatService.processHeartbeat(deviceId, data);

      // Check for pending commands
      const commands = await this.redisService.getDeviceCommands(deviceId);

      return {
        success: true,
        nextHeartbeatIn: 15000,
        commands: commands || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Heartbeat error for ${deviceId}:`, error.message);
      return {
        success: false,
        error: 'Failed to process heartbeat',
      };
    }
  }

  @SubscribeMessage('content:impression')
  async handleContentImpression(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const deviceId = client.data.deviceId;

    try {
      // Log impression for analytics
      await this.heartbeatService.logImpression(deviceId, data);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Impression error for ${deviceId}:`, error.message);
      return {
        success: false,
        error: 'Failed to log impression',
      };
    }
  }

  @SubscribeMessage('content:error')
  async handleContentError(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const deviceId = client.data.deviceId;

    this.logger.error(`Content error on ${deviceId}:`, data);

    try {
      // Log error for analytics
      await this.heartbeatService.logError(deviceId, data);

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error logging failed for ${deviceId}:`, error.message);
      return {
        success: false,
      };
    }
  }

  @SubscribeMessage('playlist:request')
  async handlePlaylistRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const deviceId = client.data.deviceId;

    try {
      // Get current playlist for device
      const playlist = await this.playlistService.getDevicePlaylist(deviceId);

      return {
        success: true,
        playlist,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Playlist request error for ${deviceId}:`, error.message);
      return {
        success: false,
        error: 'Failed to get playlist',
      };
    }
  }

  // Admin methods (called from API)
  async sendPlaylistUpdate(deviceId: string, playlist: any) {
    this.server.to(`device:${deviceId}`).emit('playlist:update', {
      playlist,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Sent playlist update to device: ${deviceId}`);
  }

  async sendCommand(deviceId: string, command: any) {
    this.server.to(`device:${deviceId}`).emit('command', {
      ...command,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Sent command to device: ${deviceId}`, command);
  }

  async broadcastToOrganization(organizationId: string, event: string, data: any) {
    this.server.to(`org:${organizationId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Broadcast ${event} to organization: ${organizationId}`);
  }
}
