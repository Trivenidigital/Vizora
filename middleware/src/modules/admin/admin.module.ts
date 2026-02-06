import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AdminController } from './admin.controller';

// Services
import { PlansService } from './services/plans.service';
import { PromotionsService } from './services/promotions.service';
import { SystemConfigService } from './services/system-config.service';
import { AdminAuditService } from './services/admin-audit.service';
import { OrganizationsAdminService } from './services/organizations-admin.service';
import { UsersAdminService } from './services/users-admin.service';
import { PlatformHealthService } from './services/platform-health.service';
import { PlatformStatsService } from './services/platform-stats.service';
import { SecurityAdminService } from './services/security-admin.service';
import { AnnouncementsService } from './services/announcements.service';

// Guards
import { SuperAdminGuard } from './guards/super-admin.guard';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [AdminController],
  providers: [
    // Services
    PlansService,
    PromotionsService,
    SystemConfigService,
    AdminAuditService,
    OrganizationsAdminService,
    UsersAdminService,
    PlatformHealthService,
    PlatformStatsService,
    SecurityAdminService,
    AnnouncementsService,
    // Guards
    SuperAdminGuard,
  ],
  exports: [
    PlansService,
    PromotionsService,
    SystemConfigService,
    AnnouncementsService,
  ],
})
export class AdminModule {}
