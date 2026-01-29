import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '../modules/config/config.module';
import { DatabaseModule } from '../modules/database/database.module';
import { AuthModule } from '../modules/auth/auth.module';
import { OrganizationsModule } from '../modules/organizations/organizations.module';
import { DisplaysModule } from '../modules/displays/displays.module';
import { ContentModule } from '../modules/content/content.module';
import { PlaylistsModule } from '../modules/playlists/playlists.module';
import { SchedulesModule } from '../modules/schedules/schedules.module';
import { HealthModule } from '../modules/health/health.module';

@Module({
  imports: [
    // Environment configuration - validates on startup
    ConfigModule,
    // Rate limiting - RELAXED for development/testing, STRICT for production
    ThrottlerModule.forRoot(
      process.env.NODE_ENV === 'production'
        ? [
            // PRODUCTION: Strict limits
            {
              name: 'short',
              ttl: 1000, // 1 second
              limit: 10, // 10 requests per second
            },
            {
              name: 'medium',
              ttl: 60000, // 1 minute  
              limit: 100, // 100 requests per minute
            },
            {
              name: 'long',
              ttl: 3600000, // 1 hour
              limit: 1000, // 1000 requests per hour
            },
          ]
        : [
            // DEVELOPMENT/TEST: Very permissive limits
            {
              name: 'short',
              ttl: 1000, // 1 second
              limit: 1000, // 1000 requests per second (no real limit)
            },
            {
              name: 'medium',
              ttl: 60000, // 1 minute  
              limit: 10000, // 10k requests per minute (no real limit)
            },
            {
              name: 'long',
              ttl: 3600000, // 1 hour
              limit: 100000, // 100k requests per hour (no real limit)
            },
          ]
    ),
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    DisplaysModule,
    ContentModule,
    PlaylistsModule,
    SchedulesModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
