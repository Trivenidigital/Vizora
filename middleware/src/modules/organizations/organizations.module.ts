import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { FeatureFlagService, FeatureFlagGuard } from './feature-flags.service';
import { OrganizationsController } from './organizations.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, FeatureFlagService, FeatureFlagGuard],
  exports: [OrganizationsService, FeatureFlagService, FeatureFlagGuard],
})
export class OrganizationsModule {}
