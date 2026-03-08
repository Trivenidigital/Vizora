import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { GeoService } from './services/geo.service';
import { DataRetentionService } from './data-retention.service';

/**
 * Common module providing shared services across the application.
 * Marked as @Global() so services are available everywhere without explicit imports.
 */
@Global()
@Module({
  providers: [CircuitBreakerService, GeoService, DataRetentionService],
  exports: [CircuitBreakerService, GeoService],
})
export class CommonModule {}
