import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
   * Atomic CAS-style claim of the 15-min dedup window for a specific
   * (rule, device) pair.
   *
   * PR-review fix: dedup is per-device, not per-rule. A single rule scoped
   * to `all` matching 20 offline devices must alert for EACH device, not
   * just the first. Prior implementation used one `lastFiredAt` per rule
   * which silently suppressed N-1 of N concurrent outages.
   *
   * Two-step pattern handles three states + the race cleanly:
   *
   *   1. Try to update an existing AlertRuleFire row whose lastFiredAt is
   *      older than the window. `updateMany` returns count=1 if we claimed,
   *      count=0 if the row exists but is still fresh, OR no row exists yet.
   *   2. If count=0, attempt to create the row. If it already exists
   *      (P2002 from the unique (alertRuleId, deviceId) index), another
   *      instance created it just now — they win the race; we suppress.
   *
   * Outcomes:
   *   - row missing, no race          → update miss → create succeeds → true
   *   - row missing, lost race        → update miss → create P2002    → false
   *   - row exists, lastFiredAt stale → update hit                    → true
   *   - row exists, lastFiredAt fresh → update miss → create P2002    → false
   *
   * PM2 cluster safety: the unique index serializes concurrent creates;
   * the updateMany predicate serializes concurrent updates. Exactly one
   * instance dispatches per (rule, device, window).
   */
  async tryClaimDedupWindow(
    ruleId: string,
    deviceId: string,
    now: Date,
  ): Promise<boolean> {
    const threshold = new Date(now.getTime() - DEDUP_WINDOW_MS);

    const updated = await this.db.alertRuleFire.updateMany({
      where: { alertRuleId: ruleId, deviceId, lastFiredAt: { lt: threshold } },
      data: { lastFiredAt: now },
    });
    if (updated.count === 1) return true;

    try {
      await this.db.alertRuleFire.create({
        data: { alertRuleId: ruleId, deviceId, lastFiredAt: now },
      });
      return true;
    } catch (err) {
      // P2002 = Prisma unique-constraint violation. Either we lost the
      // create race with another instance, OR the row was created+fresh
      // between our updateMany and our create. Both cases: do not dispatch.
      if (this.isUniqueConstraintError(err)) return false;
      throw err;
    }
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }

  /**
   * Seed the default downtime alert rule for a single org.
   *
   * Called from two places:
   *   - The post-migration backfill script (`packages/database/scripts/
   *     seed-default-alert-rules.ts`) — iterates over every existing org
   *     and calls this once per org.
   *   - `AuthService.register` — every NEW org registered post-deploy gets
   *     the same default rule, so customer-1 / customer-2 / etc. don't lose
   *     offline alerts after the hard-coded handler is removed.
   *
   * Idempotent — the unique `(organizationId, name)` index makes a re-call
   * a no-op (P2002 caught and converted to a return-without-error).
   *
   * `adminUserIds` should be the list of admin users for the org. The
   * default rule routes in-app notifications to each. If the list is empty,
   * the rule is still created (zero recipients = silent no-op until an
   * admin is added via the dedicated endpoint).
   */
  async seedDefaultRuleForOrg(
    organizationId: string,
    adminUserIds: string[],
  ): Promise<void> {
    try {
      await this.db.alertRule.create({
        data: {
          organizationId,
          name: 'Default offline alert (auto-migrated)',
          triggerEvent: 'device.offline',
          isActive: true,
          scope: 'all',
          minOfflineSec: 120,
          recipients: {
            create: adminUserIds.map((uid) => ({ channel: 'in_app', target: uid })),
          },
        },
      });
    } catch (err) {
      // Idempotency: re-runs are safe.
      if (this.isUniqueConstraintError(err)) return;
      throw err;
    }
  }

  /**
   * Hourly heal: backfill the default downtime alert rule for any org
   * that is missing it.
   *
   * Why this exists: `seedDefaultRuleForOrg` is called fire-and-forget
   * from `AuthService.register` (the seed must not block registration).
   * If the seed fails — DB transient error, Prisma client mid-restart,
   * Redis/connection blip — the new org silently loses offline alerts.
   * This cron is the safety-net: every hour, find orgs that have zero
   * rows in alert_rules matching the seeded name and re-attempt the
   * seed for each.
   *
   * The query uses Prisma's `none:` predicate on the back-relation,
   * which compiles to a single LEFT JOIN with WHERE NULL — O(orgs)
   * not O(orgs × rules). Per-org work is bounded by the admin-user
   * lookup + one INSERT (or a no-op P2002 if the rule appeared in
   * the meantime).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async healMissingDefaultRules(): Promise<void> {
    // R10 alert-rules scout: page through orgs in batches instead of
    // loading the entire set into memory. At a few thousand orgs the
    // unpaginated findMany would spike memory + force a long-running
    // transaction; at tens of thousands it's an OOM risk every hour.
    // Per-batch processing also lets us interleave Prisma + heal work
    // so a single bad org doesn't gate the rest.
    const PAGE_SIZE = 100;
    let cursor: string | undefined;
    let healed = 0;
    let failed = 0;
    let totalSeen = 0;

    /* eslint-disable no-constant-condition */
    while (true) {
      const orgsNeedingRule = await this.db.organization.findMany({
        where: {
          alertRules: {
            none: { name: 'Default offline alert (auto-migrated)' },
          },
        },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
        take: PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (orgsNeedingRule.length === 0) break;
      totalSeen += orgsNeedingRule.length;

      for (const org of orgsNeedingRule) {
        try {
          const admins = await this.db.user.findMany({
            where: { organizationId: org.id, role: 'admin' },
            select: { id: true },
          });
          await this.seedDefaultRuleForOrg(
            org.id,
            admins.map((a) => a.id),
          );
          healed++;
        } catch (err) {
          failed++;
          this.logger.error(
            `Heal cron: failed to seed default alert rule for org ${org.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      cursor = orgsNeedingRule[orgsNeedingRule.length - 1].id;
      if (orgsNeedingRule.length < PAGE_SIZE) break;
    }
    /* eslint-enable no-constant-condition */

    if (totalSeen === 0) {
      this.logger.debug('Heal cron: all orgs have the default downtime alert rule');
      return;
    }
    this.logger.log(
      `Heal cron: healed ${healed}, failed ${failed} of ${totalSeen} orgs needing default downtime alert rule`,
    );
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
