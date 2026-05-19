import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AlertRulesController } from './alert-rules/alert-rules.controller';
import { AlertRulesService } from './alert-rules/alert-rules.service';
import { AlertRuleEvaluator } from './alert-rules/alert-rule.evaluator';

@Module({
  // MailService is provided via the @Global() MailModule (see mail.module.ts).
  // forwardRef on AuthModule because AuthService now depends on
  // AlertRulesService (for seed-default-rule-on-org-registration), and
  // AlertRulesController uses RolesGuard from AuthModule.
  imports: [DatabaseModule, HttpModule, forwardRef(() => AuthModule)],
  controllers: [NotificationsController, AlertRulesController],
  providers: [NotificationsService, AlertRulesService, AlertRuleEvaluator],
  exports: [NotificationsService, AlertRulesService],
})
export class NotificationsModule {}
