import { Module } from '@nestjs/common';
import { DisplayGroupsService } from './display-groups.service';
import { DisplayGroupsController } from './display-groups.controller';

@Module({
  controllers: [DisplayGroupsController],
  providers: [DisplayGroupsService],
  exports: [DisplayGroupsService],
})
export class DisplayGroupsModule {}
