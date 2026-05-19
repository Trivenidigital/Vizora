import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { ListAlertRulesQueryDto } from './dto/list-alert-rules-query.dto';
import {
  Channel,
  DEDUP_WINDOW_MS,
  SLACK_WEBHOOK_REGEX,
  TriggerEvent,
} from './alert-rule.types';

/**
 * O7 — CRUD + evaluator helpers for configurable downtime alert rules.
 *
 * All operations are scoped to an organizationId. Cross-org access produces
 * `NotFoundException` (the rule is considered not to exist from the caller's
 * perspective — no leakage of existence).
 *
 * Cross-tenant validation for `in_app` recipients (the target userId MUST
 * belong to the same org as the rule) is enforced here, NOT at the DTO
 * layer, because the DTO doesn't know the caller's organizationId. This is
 * a deliberate trust boundary — a hostile org admin must not be able to
 * route `in_app` notifications to another org's user.
 */
@Injectable()
export class AlertRulesService {
  private readonly logger = new Logger(AlertRulesService.name);

  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(organizationId: string, dto: CreateAlertRuleDto) {
    // Cross-tenant validation BEFORE any DB write so we don't half-create
    for (const recipient of dto.recipients) {
      await this.validateRecipient(organizationId, recipient);
    }

    // Existence checks for scope FKs — fail-fast on bad scopeTagId / scopeGroupId / scopeDisplayId
    await this.validateScope(organizationId, dto.scope, {
      scopeTagId: dto.scopeTagId,
      scopeGroupId: dto.scopeGroupId,
      scopeDisplayId: dto.scopeDisplayId,
    });

    return this.db.alertRule.create({
      data: {
        organizationId,
        name: dto.name,
        triggerEvent: dto.triggerEvent,
        isActive: dto.isActive ?? true,
        scope: dto.scope,
        scopeTagId: dto.scope === 'tag' ? dto.scopeTagId : null,
        scopeGroupId: dto.scope === 'group' ? dto.scopeGroupId : null,
        scopeDisplayId: dto.scope === 'display' ? dto.scopeDisplayId : null,
        minOfflineSec: dto.minOfflineSec ?? undefined,
        recipients: {
          create: dto.recipients.map((r) => ({
            channel: r.channel,
            target: r.target,
          })),
        },
      },
      include: { recipients: true },
    });
  }

  async findAll(organizationId: string, query?: ListAlertRulesQueryDto) {
    return this.db.alertRule.findMany({
      where: {
        organizationId,
        ...(query?.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query?.triggerEvent ? { triggerEvent: query.triggerEvent } : {}),
      },
      include: { recipients: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const rule = await this.db.alertRule.findFirst({
      where: { id, organizationId },
      include: { recipients: true },
    });
    if (!rule) {
      throw new NotFoundException(`Alert rule ${id} not found`);
    }
    return rule;
  }

  async update(organizationId: string, id: string, dto: UpdateAlertRuleDto) {
    // Existence + cross-org guard
    await this.findOne(organizationId, id);

    if (dto.scope) {
      await this.validateScope(organizationId, dto.scope, {
        scopeTagId: dto.scopeTagId,
        scopeGroupId: dto.scopeGroupId,
        scopeDisplayId: dto.scopeDisplayId,
      });
    }

    return this.db.alertRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.triggerEvent !== undefined ? { triggerEvent: dto.triggerEvent } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.scope !== undefined ? { scope: dto.scope } : {}),
        ...(dto.scope === 'tag' ? { scopeTagId: dto.scopeTagId, scopeGroupId: null, scopeDisplayId: null } : {}),
        ...(dto.scope === 'group' ? { scopeGroupId: dto.scopeGroupId, scopeTagId: null, scopeDisplayId: null } : {}),
        ...(dto.scope === 'display' ? { scopeDisplayId: dto.scopeDisplayId, scopeTagId: null, scopeGroupId: null } : {}),
        ...(dto.scope === 'all' ? { scopeTagId: null, scopeGroupId: null, scopeDisplayId: null } : {}),
        ...(dto.minOfflineSec !== undefined ? { minOfflineSec: dto.minOfflineSec } : {}),
      },
      include: { recipients: true },
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    // Existence + cross-org guard
    await this.findOne(organizationId, id);
    // Recipients cascade-delete via Prisma FK.
    await this.db.alertRule.delete({ where: { id } });
  }

  async addRecipient(organizationId: string, ruleId: string, dto: CreateRecipientDto) {
    // Existence + cross-org guard
    await this.findOne(organizationId, ruleId);
    await this.validateRecipient(organizationId, dto);

    return this.db.alertRuleRecipient.create({
      data: {
        alertRuleId: ruleId,
        channel: dto.channel,
        target: dto.target,
      },
    });
  }

  async removeRecipient(
    organizationId: string,
    ruleId: string,
    recipientId: string,
  ): Promise<void> {
    // Existence + cross-org guard for the rule
    await this.findOne(organizationId, ruleId);

    // Verify the recipient is actually on this rule (defense against ID-mismatch)
    const recipient = await this.db.alertRuleRecipient.findFirst({
      where: { id: recipientId, alertRuleId: ruleId },
    });
    if (!recipient) {
      throw new NotFoundException(`Recipient ${recipientId} not found on rule ${ruleId}`);
    }

    await this.db.alertRuleRecipient.delete({ where: { id: recipientId } });
  }

  // ---------------------------------------------------------------------------
  // Evaluator helpers
  // ---------------------------------------------------------------------------

  /**
   * Evaluator query: load active rules for an org + triggerEvent including
   * their recipients (we need recipients to dispatch).
   */
  async findActiveForEvent(organizationId: string, triggerEvent: TriggerEvent) {
    return this.db.alertRule.findMany({
      where: { organizationId, triggerEvent, isActive: true },
      include: { recipients: true },
    });
  }

  /**
   * Atomic CAS-style claim of the 15-min dedup window.
   *
   * Returns true if THIS caller successfully claimed the window (and should
   * dispatch), false if another instance (PM2 cluster) already claimed it
   * within the window.
   *
   * Implementation: `updateMany` with a predicate `lastFiredAt < threshold OR
   * lastFiredAt IS NULL`. The `count` field tells us if the row was actually
   * updated. Count === 1 means we won the race; count === 0 means we lost.
   */
  async tryClaimDedupWindow(ruleId: string, now: Date): Promise<boolean> {
    const threshold = new Date(now.getTime() - DEDUP_WINDOW_MS);
    const result = await this.db.alertRule.updateMany({
      where: {
        id: ruleId,
        OR: [{ lastFiredAt: null }, { lastFiredAt: { lt: threshold } }],
      },
      data: { lastFiredAt: now },
    });
    return result.count === 1;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Per-channel validation called from `create` and `addRecipient`.
   *
   * - in_app:         target userId MUST belong to the same org. Cross-tenant
   *                   leak prevention — a hostile org-A admin must not route
   *                   `in_app` notifications to an org-B userId.
   * - email:          shape validated at DTO; no additional check.
   * - slack_webhook:  regex re-validated at the DTO too, but belt-and-braces.
   */
  private async validateRecipient(
    organizationId: string,
    dto: { channel: Channel; target: string },
  ): Promise<void> {
    if (dto.channel === 'in_app') {
      const user = await this.db.user.findFirst({
        where: { id: dto.target, organizationId },
      });
      if (!user) {
        throw new ForbiddenException(
          `in_app target userId ${dto.target} does not belong to this organization`,
        );
      }
      return;
    }

    if (dto.channel === 'slack_webhook') {
      if (!SLACK_WEBHOOK_REGEX.test(dto.target)) {
        throw new ForbiddenException('slack_webhook target failed allowlist');
      }
      return;
    }

    // email — DTO has already validated shape via class-validator.
  }

  /**
   * Per-scope existence + cross-org check. Catches typos / stale IDs at
   * write time rather than at evaluate time (where we'd silently skip).
   */
  private async validateScope(
    organizationId: string,
    scope: string,
    ids: { scopeTagId?: string; scopeGroupId?: string; scopeDisplayId?: string },
  ): Promise<void> {
    if (scope === 'tag' && ids.scopeTagId) {
      const tag = await this.db.tag.findFirst({
        where: { id: ids.scopeTagId, organizationId },
      });
      if (!tag) throw new NotFoundException(`Tag ${ids.scopeTagId} not found in this organization`);
    }
    if (scope === 'group' && ids.scopeGroupId) {
      const group = await this.db.displayGroup.findFirst({
        where: { id: ids.scopeGroupId, organizationId },
      });
      if (!group) {
        throw new NotFoundException(`DisplayGroup ${ids.scopeGroupId} not found in this organization`);
      }
    }
    if (scope === 'display' && ids.scopeDisplayId) {
      const display = await this.db.display.findFirst({
        where: { id: ids.scopeDisplayId, organizationId },
      });
      if (!display) {
        throw new NotFoundException(`Display ${ids.scopeDisplayId} not found in this organization`);
      }
    }
  }
}
