import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '../modules/config/config.module';
import { DatabaseModule } from '../modules/database/database.module';
import { RedisModule } from '../modules/redis/redis.module';
import { CommonModule } from '../modules/common/common.module';
import { AuthModule } from '../modules/auth/auth.module';
import { OrganizationsModule } from '../modules/organizations/organizations.module';
import { DisplaysModule } from '../modules/displays/displays.module';
import { DisplayGroupsModule } from '../modules/display-groups/display-groups.module';
import { ContentModule } from '../modules/content/content.module';
import { PlaylistsModule } from '../modules/playlists/playlists.module';
import { SchedulesModule } from '../modules/schedules/schedules.module';
import { HealthModule } from '../modules/health/health.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { UsersModule } from '../modules/users/users.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { FoldersModule } from '../modules/folders/folders.module';
import { ApiKeysModule } from '../modules/api-keys/api-keys.module';
import { BillingModule } from '../modules/billing/billing.module';
import { AdminModule } from '../modules/admin/admin.module';
import { TemplateLibraryModule } from '../modules/template-library/template-library.module';
import { StorageModule } from '../modules/storage/storage.module';
import { MetricsModule } from '../modules/metrics/metrics.module';
import { MailModule } from '../modules/mail/mail.module';
import { SupportModule } from '../modules/support/support.module';

@Module({
  imports: [
    // Environment configuration - validates on startup
    ConfigModule,
    // Scheduled tasks for content expiration, etc.
    ScheduleModule.forRoot(),
    // Event-driven validation monitoring (Tier 2)
    EventEmitterModule.forRoot(),
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
    CommonModule,
    StorageModule,
    MailModule,
    DatabaseModule,
    RedisModule,
    AuthModule,
    OrganizationsModule,
    DisplaysModule,
    DisplayGroupsModule,
    ContentModule,
    PlaylistsModule,
    SchedulesModule,
    HealthModule,
    AnalyticsModule,
    UsersModule,
    NotificationsModule,
    FoldersModule,
    ApiKeysModule,
    BillingModule,
    AdminModule,
    TemplateLibraryModule,
    MetricsModule,
    SupportModule,
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
