import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@vizora/database';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 5000; // 5 seconds

  constructor() {
    // Configure connection pool via DATABASE_URL query params or environment
    // PostgreSQL pool settings: ?connection_limit=10&pool_timeout=30
    const connectionUrl = process.env.DATABASE_URL || '';
    const separator = connectionUrl.includes('?') ? '&' : '?';
    const hasPoolConfig = connectionUrl.includes('connection_limit');

    // Add statement_timeout and default pool config if not specified
    const poolParams = hasPoolConfig ? '' : '&connection_limit=10&pool_timeout=30';
    const finalUrl = `${connectionUrl}${separator}statement_timeout=30000${poolParams}`;

    super({
      datasources: {
        db: {
          url: finalUrl,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    this.logger.log('Database service initialized with connection pooling');
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<void> {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully');
        this.reconnectAttempts = 0; // Reset on success
        return;
      } catch (error) {
        this.reconnectAttempts++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to connect to database (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${errorMessage}`
        );

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.logger.error('Max reconnect attempts reached. Giving up.');
          throw error;
        }

        this.logger.log(`Retrying in ${this.reconnectDelay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database disconnected');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error disconnecting from database: ${errorMessage}`);
    }
  }

  /**
   * Health check method for monitoring
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
