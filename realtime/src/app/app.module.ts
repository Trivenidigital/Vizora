import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { DeviceGateway } from '../gateways/device.gateway';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';
import { NotificationService } from '../services/notification.service';
import { MetricsModule } from '../metrics/metrics.module';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { MetricsInterceptor } from '../interceptors/metrics.interceptor';
import { MetricsAuthMiddleware } from '../metrics/metrics-auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      secret: process.env.DEVICE_JWT_SECRET,
      signOptions: { expiresIn: '365d' },
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    StorageModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DeviceGateway,
    RedisService,
    HeartbeatService,
    PlaylistService,
    NotificationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsAuthMiddleware).forRoutes('internal/metrics');
  }
}
