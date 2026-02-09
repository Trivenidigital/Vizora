import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication, Logger } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'ioredis';
import Redis from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(private app: INestApplication) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      this.logger.error(`Redis adapter pub client error: ${err.message}`);
    });

    subClient.on('error', (err) => {
      this.logger.error(`Redis adapter sub client error: ${err.message}`);
    });

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Redis IO adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
