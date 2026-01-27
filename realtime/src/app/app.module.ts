import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DeviceGateway } from '../gateways/device.gateway';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      secret: process.env.DEVICE_JWT_SECRET || 'device-jwt-secret-changeme',
      signOptions: { expiresIn: '365d' },
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DeviceGateway,
    RedisService,
    HeartbeatService,
    PlaylistService,
  ],
})
export class AppModule {}
