import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
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
}
