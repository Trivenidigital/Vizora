import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { FeatureFlagService } from './feature-flags.service';
import { OrganizationsController } from './organizations.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, FeatureFlagService],
  exports: [OrganizationsService, FeatureFlagService],
})
export class OrganizationsModule {}
