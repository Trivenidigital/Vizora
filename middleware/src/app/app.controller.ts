import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { Public } from '../modules/auth/decorators/public.decorator';
import { DatabaseService } from '../modules/database/database.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('health')
  @Public()
  @SkipThrottle()
  async health() {
    try {
      // Check database connectivity
      await this.databaseService.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message,
      };
    }
  }

  @Get('ready')
  @Public()
  @SkipThrottle()
  async ready() {
    // Readiness check for load balancers
    try {
      await this.databaseService.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return { ready: false };
    }
  }
}
