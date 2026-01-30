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
              ttl: 1000,
              limit: 10,
            },
            {
              name: 'medium',
              ttl: 60000,
              limit: 100,
            },
            {
              name: 'long',
              ttl: 3600000,
              limit: 1000,
            },
          ]
        : [
            // DEVELOPMENT/TEST: Very permissive limits
            {
              name: 'short',
              ttl: 1000,
              limit: 1000,
            },
            {
              name: 'medium',
              ttl: 60000,
              limit: 10000,
            },
            {
              name: 'long',
              ttl: 3600000,
              limit: 100000,
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
