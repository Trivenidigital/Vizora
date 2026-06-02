import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { DisplayGroupsService } from './display-groups.service';
import { DisplayGroupsController } from './display-groups.controller';

@Module({
  imports: [BillingModule],
  controllers: [DisplayGroupsController],
  providers: [DisplayGroupsService],
  exports: [DisplayGroupsService],
})
export class DisplayGroupsModule {}
