import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DeviceGateway } from '../gateways/device.gateway';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';
import { MetricsModule } from '../metrics/metrics.module';
import { SentryInterceptor } from '../interceptors/sentry.interceptor';
import { MetricsInterceptor } from '../interceptors/metrics.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      secret: process.env.DEVICE_JWT_SECRET || 'device-jwt-secret-changeme',
      signOptions: { expiresIn: '365d' },
    }),
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DeviceGateway,
    RedisService,
    HeartbeatService,
    PlaylistService,
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
export class AppModule {}
