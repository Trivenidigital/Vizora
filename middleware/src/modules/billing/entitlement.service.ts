import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { TenantEntitlementNotifier } from './tenant-entitlement.notifier';

/**
 * B3 — entitlement degrade ladder (design: docs/design/entitlement-state-machine.md v2).
 *
 *   past_due ──7d──▶ publish_locked ──14d──▶ suspended ──30d──▶ canceled
 *   (screens play,   (screens play,          (holding screen,   (free tier)
 *    dunning 0/3/7)   no new publish)          tenant:suspended)
 *
 * Thresholds are measured in whole UTC days from `entitlementStateSince` — the
 * timestamp of when the current degradation episode began (set on entry to
 * past_due, cleared on recovery). It is NOT `updatedAt`, so an unrelated org
 * write cannot reset the grace clock (fixes B8).
 *
 * The device signal (`tenant:suspended`) fires ONLY at the `suspended` rung, so
 * dunning escalates through the dashboard (publish-lock) before the storefront.
 */

// Whole days from episode start (entitlementStateSince) to each rung.
export const LADDER = {
  DAYS_TO_PUBLISH_LOCK: 7,
  DAYS_TO_SUSPEND: 14,
  DAYS_TO_CANCEL: 30,
} as const;

const HEARTBEAT_KEY = 'entitlement:ladder:last-run';
const HEARTBEAT_STALE_MS = 26 * 60 * 60 * 1000; // > 24h cadence + slack

@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly notifier: TenantEntitlementNotifier,
    private readonly mail: MailService,
  ) {}

  /**
   * Claim a one-time dunning notice for (org, key). Redis SETNX with a TTL past
   * the rung window so the daily ladder job can re-run without re-sending the same
   * escalation email. Returns true only for the first caller. Fail-safe: if Redis
   * is unavailable we return false (skip the email) rather than risk a spam loop —
   * the banner remains the always-on channel.
   */
  private async claimDunningNotice(organizationId: string, key: string): Promise<boolean> {
    const client = this.redis.getClient();
    if (!client) return false;
    const redisKey = `dunning:${organizationId}:${key}`;
    const result = await client.set(redisKey, '1', 'EX', 40 * 24 * 60 * 60, 'NX');
    return result === 'OK';
  }

  private wholeDaysBetween(from: Date, to: Date): number {
    // UTC-day difference, floored — a rung is reached only after N *full* days.
    return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  }

  /**
   * Begin (or restart) the degradation episode: set past_due and stamp the
   * episode start. Idempotent — re-entering past_due while already past_due does
   * NOT reset the clock (guarded on the current status), so a repeated
   * payment-failed webhook can't extend grace indefinitely.
   */
  async beginPastDue(organizationId: string, now = new Date()): Promise<void> {
    const updated = await this.db.organization.updateMany({
      where: {
        id: organizationId,
        subscriptionStatus: { in: ['active', 'trial'] },
      },
      data: { subscriptionStatus: 'past_due', entitlementStateSince: now },
    });
    if (updated.count > 0) {
      this.logger.log(`Org ${organizationId} entered past_due (episode start ${now.toISOString()})`);
    }
  }

  /**
   * Recovery on payment: any rung → active. Emits tenant:resumed ONLY if the org
   * had reached `suspended` (earlier rungs sent no device signal, so none is
   * needed to undo). Clears the episode clock.
   */
  async recover(organizationId: string): Promise<void> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionStatus: true },
    });
    if (!org) return;
    const wasSuspended = org.subscriptionStatus === 'suspended';

    await this.db.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: 'active', entitlementStateSince: null },
    });

    if (wasSuspended) {
      await this.notifier.emit(organizationId, 'resumed', 'payment_recovered');
      this.logger.log(`Org ${organizationId} recovered from suspended → active (tenant:resumed)`);
    }
  }

  /**
   * Daily ladder advancement. Idempotent per run: each org advances at most one
   * rung based on its episode age, and the where-clauses are keyed on the CURRENT
   * status so re-running the same day is a no-op. Writes a heartbeat so a dead job
   * is not silent (see isLadderStale).
   */
  async advanceLadder(now = new Date()): Promise<{ advanced: number }> {
    let advanced = 0;

    // Heal un-stamped dunning orgs. An org can enter a dunning rung via a path
    // that never stamps the episode clock: handleSubscriptionUpdated writes
    // subscriptionStatus directly (billing.service), and Stripe does not
    // guarantee webhook ordering — a `customer.subscription.updated(past_due)`
    // can land BEFORE `invoice.payment_failed` runs beginPastDue, whose
    // updateMany is guarded on status IN (active,trial) and so no-ops once the
    // status is already past_due. Result: entitlementStateSince stays null, and
    // advanceRung's `entitlementStateSince: { not: null }` filter never sees the
    // org → it holds full (post-#6 SubscriptionActiveGuard) access in the rung
    // FOREVER, and dunning never enforces. Stamp any un-stamped dunning org from
    // first-sight (fail-closed; the grace clock simply starts now).
    await this.db.organization.updateMany({
      where: {
        subscriptionStatus: { in: ['past_due', 'publish_locked', 'suspended'] },
        entitlementStateSince: null,
      },
      data: { entitlementStateSince: now },
    });

    // Rung 1: past_due → publish_locked (screens still play; no device signal)
    advanced += await this.advanceRung(
      'past_due',
      'publish_locked',
      LADDER.DAYS_TO_PUBLISH_LOCK,
      now,
      null,
    );

    // Rung 2: publish_locked → suspended (holding screen; emit tenant:suspended)
    advanced += await this.advanceRung(
      'publish_locked',
      'suspended',
      LADDER.DAYS_TO_SUSPEND,
      now,
      'past_due',
    );

    // Rung 3: suspended → canceled (downgrade to free; free still serves)
    advanced += await this.advanceRung(
      'suspended',
      'canceled',
      LADDER.DAYS_TO_CANCEL,
      now,
      null,
      { subscriptionTier: 'free', screenQuota: 5 },
    );

    await this.writeHeartbeat(now);
    if (advanced > 0) this.logger.log(`Entitlement ladder advanced ${advanced} org(s)`);
    return { advanced };
  }

  private async advanceRung(
    fromStatus: string,
    toStatus: string,
    daysThreshold: number,
    now: Date,
    suspendReason: string | null,
    extraData: Record<string, unknown> = {},
  ): Promise<number> {
    const candidates = await this.db.organization.findMany({
      where: { subscriptionStatus: fromStatus, entitlementStateSince: { not: null } },
      select: {
        id: true,
        entitlementStateSince: true,
        users: { where: { role: 'admin' }, take: 1, select: { email: true, firstName: true } },
      },
    });

    let count = 0;
    for (const org of candidates) {
      const age = this.wholeDaysBetween(org.entitlementStateSince as Date, now);
      if (age < daysThreshold) continue;

      // Guard the write on the CURRENT status so two concurrent runs (or a retry)
      // can't double-advance — only the first flip wins.
      const res = await this.db.organization.updateMany({
        where: { id: org.id, subscriptionStatus: fromStatus },
        data: { subscriptionStatus: toStatus, ...extraData },
      });
      if (res.count === 0) continue; // already advanced by a concurrent run
      count += 1;

      if (toStatus === 'suspended') {
        await this.notifier.emit(org.id, 'suspended', suspendReason ?? 'past_due');
      }

      // Dunning escalation email, deduped per (org, rung) so a job re-run can't
      // re-send. publish_locked and suspended are the owner-action moments; the
      // transition guard already prevents a double-flip, and the dedup key is
      // belt-and-suspenders. Fire-and-forget; the banner is the always-on channel.
      if (toStatus === 'publish_locked' || toStatus === 'suspended') {
        const admin = org.users?.[0];
        if (admin?.email && (await this.claimDunningNotice(org.id, toStatus))) {
          this.mail
            .sendPaymentFailedEmail(admin.email, admin.firstName || admin.email.split('@')[0])
            .catch((err) => this.logger.warn(`Dunning email failed for org ${org.id}: ${err}`));
        }
      }
      this.logger.log(`Org ${org.id} ${fromStatus} → ${toStatus} (episode age ${age}d)`);
    }
    return count;
  }

  private async writeHeartbeat(now: Date): Promise<void> {
    try {
      await this.redis.set(HEARTBEAT_KEY, String(now.getTime()), 7 * 24 * 60 * 60);
    } catch (err) {
      this.logger.warn(`Failed to write entitlement ladder heartbeat: ${err}`);
    }
  }

  /** True if the ladder job has not run within the staleness window (or never). */
  async isLadderStale(now = new Date()): Promise<boolean> {
    const raw = await this.redis.get(HEARTBEAT_KEY);
    if (!raw) return true;
    return now.getTime() - Number(raw) > HEARTBEAT_STALE_MS;
  }

  /**
   * Banner data for the dashboard (state, days remaining to the next rung, and
   * whether publishing is locked). The React banner renders this; the pay link is
   * a static dashboard route the frontend owns.
   */
  async getBannerState(
    organizationId: string,
    now = new Date(),
  ): Promise<{
    status: string;
    publishLocked: boolean;
    daysUntilNextRung: number | null;
    nextRung: string | null;
  }> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionStatus: true, entitlementStateSince: true },
    });
    if (!org) return { status: 'unknown', publishLocked: false, daysUntilNextRung: null, nextRung: null };

    const publishLocked = org.subscriptionStatus === 'publish_locked' || org.subscriptionStatus === 'suspended';
    let daysUntilNextRung: number | null = null;
    let nextRung: string | null = null;

    if (org.entitlementStateSince) {
      const age = this.wholeDaysBetween(org.entitlementStateSince, now);
      if (org.subscriptionStatus === 'past_due') {
        nextRung = 'publish_locked';
        daysUntilNextRung = Math.max(0, LADDER.DAYS_TO_PUBLISH_LOCK - age);
      } else if (org.subscriptionStatus === 'publish_locked') {
        nextRung = 'suspended';
        daysUntilNextRung = Math.max(0, LADDER.DAYS_TO_SUSPEND - age);
      } else if (org.subscriptionStatus === 'suspended') {
        nextRung = 'canceled';
        daysUntilNextRung = Math.max(0, LADDER.DAYS_TO_CANCEL - age);
      }
    }

    return { status: org.subscriptionStatus, publishLocked, daysUntilNextRung, nextRung };
  }
}
