import { Controller, Get, Post, Body } from '@nestjs/common';
import { DeviceGateway } from '../gateways/device.gateway';
import { PushPlaylistRequest } from '../types';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
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
  constructor(private readonly deviceGateway: DeviceGateway) {}

  @Get('health')
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'realtime-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
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
  async pushPlaylist(@Body() data: PushPlaylistRequest): Promise<PushResponse> {
    await this.deviceGateway.sendPlaylistUpdate(data.deviceId, data.playlist);
    return {
      success: true,
      message: 'Playlist update sent to device',
    };
  }
}
