import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportClassifierService } from './support-classifier.service';
import { SupportKnowledgeService } from './support-knowledge.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [SupportController],
  providers: [SupportService, SupportClassifierService, SupportKnowledgeService],
  exports: [SupportService],
})
export class SupportModule {}
