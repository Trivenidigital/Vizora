import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DatabaseModule } from '../database/database.module';
import { AlertRulesController } from './alert-rules/alert-rules.controller';
import { AlertRulesService } from './alert-rules/alert-rules.service';
import { AlertRuleEvaluator } from './alert-rules/alert-rule.evaluator';

@Module({
  // MailService is provided via the @Global() MailModule (see mail.module.ts).
  imports: [DatabaseModule, HttpModule],
  controllers: [NotificationsController, AlertRulesController],
  providers: [NotificationsService, AlertRulesService, AlertRuleEvaluator],
  exports: [NotificationsService, AlertRulesService],
})
export class NotificationsModule {}
