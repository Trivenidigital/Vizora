import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { GeoService } from './services/geo.service';

/**
 * Common module providing shared services across the application.
 * Marked as @Global() so services are available everywhere without explicit imports.
 */
@Global()
@Module({
  providers: [CircuitBreakerService, GeoService],
  exports: [CircuitBreakerService, GeoService],
})
export class CommonModule {}
