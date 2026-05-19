import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TagRulesService } from './tag-rules.service';

interface DisplayLifecyclePayload {
  organizationId: string;
  displayId: string;
}

/**
 * O4 — Reactive evaluator for tag-rule auto-assignment.
 *
 * Subscribes to:
 *   - `display.tags.changed` (new event emitted by DisplaysService.addTags
 *     and DisplaysService.removeTags after this PR)
 *   - `display.paired` (existing event emitted by PairingService:294 —
 *     covers the case where a newly-paired display already carries tags
 *     from pre-pairing config)
 *
 * Both handlers wrap the service call in a top-level try/catch per the
 * `app.module.ts:42-54` INVARIANT — async @OnEvent handlers MUST swallow
 * errors because EventEmitter2's `ignoreErrors:false` config turns uncaught
 * rejections into process-level errors (= PM2 restart storm).
 *
 * Event delivery is in-process (NestJS EventEmitter2). If `addTags` commits
 * but the process crashes before the event fires, the evaluator never runs
 * and the display stays unassigned. Accepted eventual-consistency tradeoff
 * for v1 — any subsequent tag-change or rule-update on the same display
 * (or its tag) will re-trigger evaluation.
 */
@Injectable()
export class TagRuleEvaluator {
  private readonly logger = new Logger(TagRuleEvaluator.name);

  constructor(private readonly tagRulesService: TagRulesService) {}

  @OnEvent('display.tags.changed', { async: true })
  async onTagsChanged(payload: DisplayLifecyclePayload): Promise<void> {
    try {
      await this.tagRulesService.evaluateForDisplay(payload.organizationId, payload.displayId);
    } catch (err) {
      this.logger.error(
        `Tag-rule evaluation failed for display ${payload.displayId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @OnEvent('display.paired', { async: true })
  async onDisplayPaired(payload: DisplayLifecyclePayload): Promise<void> {
    try {
      await this.tagRulesService.evaluateForDisplay(payload.organizationId, payload.displayId);
    } catch (err) {
      this.logger.error(
        `Tag-rule evaluation failed for newly-paired display ${payload.displayId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
