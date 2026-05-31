import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProvisioningTemplatesController } from './provisioning-templates.controller';
import { ProvisioningTemplatesService } from './provisioning-templates.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ProvisioningTemplatesController],
  providers: [ProvisioningTemplatesService],
  exports: [ProvisioningTemplatesService],
})
export class ProvisioningTemplatesModule {}
