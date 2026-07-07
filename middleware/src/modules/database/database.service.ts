import { Injectable, OnModuleInit, OnModuleDestroy, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaClient } from '@vizora/database';
import { getTenantContext } from './tenant-context';
import { evaluateTenantOp, TenantGuardMode } from './tenant-guard';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  /**
   * Tenant-guard mode — the DB-level cross-tenant-write backstop (defense in
   * depth behind the service-layer org-scoped WHERE clauses). Modes:
   *   `log`     observe + warn on cross-tenant ops; NEVER blocks or mutates.
   *   `enforce` reject cross-tenant ops.
   *   `off`     disable the $use hook entirely (no backstop).
   * Default is now `log` in ALL environments (production included) so the
   * backstop actually runs and the soak accumulates — previously it defaulted
   * `off` in production, i.e. the backstop was inert exactly where it mattered
   * (audit S1-1). Promotion to `enforce` in prod stays gated on REVIEWING the
   * log-mode soak: a cross-tenant-looking-but-legitimate query wrongly rejected
   * under enforce is a prod outage, so it must be observed in `log` first.
   * Override with TENANT_GUARD_MODE=off|log|enforce.
   */
  private readonly tenantGuardMode: TenantGuardMode =
    (process.env.TENANT_GUARD_MODE as TenantGuardMode) || 'log';

  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 5000;

  constructor() {
    // Add statement_timeout to prevent runaway queries
    const baseUrl = process.env.DATABASE_URL || '';
    const separator = baseUrl.includes('?') ? '&' : '?';
    const timeoutParam = 'statement_timeout=30000';
    const poolParams = process.env.NODE_ENV === 'production'
      ? `&connection_limit=10&pool_timeout=20`
      : '';
    const finalUrl = `${baseUrl}${separator}${timeoutParam}${poolParams}`;

    super({
      datasources: {
        db: {
          url: finalUrl,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    this.registerTenantGuard();
    await this.connectWithRetry();
  }

  /**
   * Tenant-scoping backstop (docs/design/tenant-scoping-extension.md). Applied
   * in-place via $use so every `this.<model>.<op>()` is intercepted with no
   * call-site changes (Prisma 5). The guard only acts when a concrete tenant
   * context is bound (getTenantContext) and the model is tenant-scoped; `log`
   * mode never mutates or throws. Reads its decision from the pure
   * evaluateTenantOp policy.
   */
  private registerTenantGuard(): void {
    if (this.tenantGuardMode === 'off') return;
    this.logger.log(`Tenant guard active in "${this.tenantGuardMode}" mode`);
    this.$use(async (params, next) => {
      const decision = evaluateTenantOp({
        model: params.model,
        operation: params.action,
        args: params.args,
        context: getTenantContext(),
        mode: this.tenantGuardMode,
      });
      switch (decision.action) {
        case 'inject':
          return next({ ...params, args: decision.args });
        case 'warn':
          this.logger.warn(`[tenant-guard] ${decision.reason}`);
          return next(params);
        case 'reject':
          throw new ForbiddenException(`[tenant-guard] ${decision.reason}`);
        default:
          return next(params);
      }
    });
  }

  private async connectWithRetry(): Promise<void> {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully');
        this.logger.log(`Connection pool: ${process.env.NODE_ENV === 'production' ? '10 connections max' : 'default'}`);
        this.reconnectAttempts = 0;
        return;
      } catch (error) {
        this.reconnectAttempts++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to connect to database (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${errorMessage}`,
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
      this.logger.error('Error disconnecting from database', error);
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}
