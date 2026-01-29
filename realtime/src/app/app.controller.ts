import { Controller, Get, Post, Body } from '@nestjs/common';
import { DeviceGateway } from '../gateways/device.gateway';

@Controller()
export class AppController {
  constructor(private readonly deviceGateway: DeviceGateway) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'realtime-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('status')
  getStatus() {
    return {
      status: 'running',
      service: 'Vizora Realtime Gateway',
      version: '1.0.0',
      websocket: 'active',
    };
  }

  @Post('push/playlist')
  async pushPlaylist(@Body() data: { deviceId: string; playlist: any }) {
    await this.deviceGateway.sendPlaylistUpdate(data.deviceId, data.playlist);
    return {
      success: true,
      message: 'Playlist update sent to device',
    };
  }
}
