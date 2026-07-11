import { Global, Module } from '@nestjs/common';
import { ClickHouseService } from './clickhouse.service';
import { ClickHouseWatchdogService } from './clickhouse-watchdog.service';

/**
 * ClickHouse read + freshness-watchdog surface for the middleware.
 *
 * Global so any module (AnalyticsService today) can inject ClickHouseService
 * without wiring an import. The realtime service has its own writer-side
 * ClickHouseService — the two apps are independently deployed processes, so
 * (matching the existing per-service DatabaseService / RedisService pattern)
 * each owns a thin service over the shared @clickhouse/client, rather than a
 * cross-package NestJS module.
 *
 * DatabaseService is provided by the @Global DatabaseModule, so the watchdog
 * can inject it here without an explicit import.
 */
@Global()
@Module({
  providers: [ClickHouseService, ClickHouseWatchdogService],
  exports: [ClickHouseService],
})
export class ClickHouseModule {}
