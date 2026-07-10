import {
  Module,
  Global,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsAuthMiddleware } from './metrics-auth.middleware';
import { HealthModule } from '../health/health.module';

@Global()
@Module({
  // HealthModule exports ContinuousHealthMonitorService, which MetricsInterceptor
  // (registered here as APP_INTERCEPTOR) injects to feed 5xx counts into the
  // continuous-health error-rate check. No cycle: HealthModule does not depend
  // on MetricsModule.
  imports: [HealthModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Gate the (now @Public) /api/v1/internal/metrics endpoint behind
    // localhost/METRICS_TOKEN. The global prefix is prepended to this route
    // string by Nest, so it matches the served /api/v1/internal/metrics path.
    consumer.apply(MetricsAuthMiddleware).forRoutes('internal/metrics');
  }
}
