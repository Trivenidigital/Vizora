import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TagRulesController } from './tag-rules.controller';
import { TagRulesService } from './tag-rules.service';
import { TagRuleEvaluator } from './tag-rule.evaluator';

@Module({
  imports: [DatabaseModule],
  controllers: [TagRulesController],
  providers: [TagRulesService, TagRuleEvaluator],
  exports: [TagRulesService],
})
export class TagRulesModule {}
