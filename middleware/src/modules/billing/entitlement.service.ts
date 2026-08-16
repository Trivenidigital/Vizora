import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { TenantEntitlementNotifier } from './tenant-entitlement.notifier';
import { tierEntitlementFields } from './constants/plans';

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

/**
 * Hard ceiling on EVERY Redis command this service issues, mirroring
 * `CronLeaderService`'s. Each is one round-trip to a local Redis; anything near a
 * second means Redis is not healthy and the right move is to stop waiting.
 *
 * A bare try/catch is NOT enough anywhere here: a rejection costs ~42s (ioredis
 * `maxRetriesPerRequest: 20` + capped backoff) and a blackholed socket never
 * rejects at all. That applies verbatim to `RedisService.set`/`get` — they
 * try/catch a REJECTION but have no timeout — so the heartbeat write and read are
 * bounded too. An unbounded heartbeat write is not a stranded tenant (it is the
 * last thing the run does), but it hangs `advanceLadder` forever, which means
 * `handleGracePeriodExpiry` never reaches its summary/DEGRADED log or its Sentry
 * capture — i.e. it takes out exactly the observability channel the payload
 * exists to feed — and leaks a dangling promise per day.
 */
const REDIS_COMMAND_TIMEOUT_MS = 2000;

/**
 * The last-run heartbeat, parsed. `degraded` is what lets the hourly watchdog
 * distinguish "ran recently and cleanly" from "ran recently and stranded
 * tenants" — without it a run that isolates failures writes a fresh `at` and the
 * watchdog reports FRESH, which is the §12a silent-failure shape the payload was
 * added to close.
 */
export interface LadderHeartbeat {
  at: number;
  degraded: boolean;
  failed: number;
  rungFailures: number;
}

/** Per-rung and aggregate outcome of one ladder run. */
export interface RungOutcome {
  /** Candidates whose episode age has reached this rung's threshold. */
  eligible: number;
  /** Orgs the loop actually ran a body for. MUST equal `eligible` (K19). */
  attempted: number;
  /** Orgs fully processed: CAS won AND every side effect completed. */
  advanced: number;
  /** Orgs whose CAS matched 0 rows — a concurrent run got there first. */
  casLost: number;
  /** Orgs whose processing threw. Isolated: the next org still runs. */
  failed: number;
}

/**
 * Result of `advanceLadder`: the aggregate outcome, a per-rung breakdown, and a
 * count of whole steps (a rung's own machinery, or the un-stamped heal) that
 * threw. `rungFailures` is deliberately NOT folded into `failed` so the per-org
 * accounting identity `advanced + casLost + failed === attempted` keeps holding.
 */
export interface LadderRunResult extends RungOutcome {
  rungFailures: number;
  rungs: Record<string, RungOutcome>;
}

const emptyOutcome = (): RungOutcome => ({
  eligible: 0,
  attempted: 0,
  advanced: 0,
  casLost: 0,
  failed: 0,
});

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
   * Running count of fail-open dunning claims for the life of the process, so a
   * log grep answers "one-off blip, or has the claim store been down all day?"
   * without reconstructing the outage from other services' logs (§12b).
   */
  private dunningClaimFailOpens = 0;

  /** Fail-open dunning claims recorded so far in this process. */
  getDunningClaimFailOpenCount(): number {
    return this.dunningClaimFailOpens;
  }

  private dunningClaimFailOpen(organizationId: string, key: string, reason: string): void {
    this.dunningClaimFailOpens += 1;
    this.logger.warn(
      `Dunning claim for org ${organizationId} rung ${key} running FAIL-OPEN ` +
        `(sending without dedup; the rung CAS still caps it at one email) — ${reason}. ` +
        `Fail-open count this process: ${this.dunningClaimFailOpens}.`,
    );
  }

  /**
   * Claim a one-time dunning notice for (org, key). Redis SETNX with a TTL past
   * the rung window so the daily ladder job can re-run without re-sending the
   * same escalation email. Returns true only for the first caller.
   *
   * FAIL-OPEN when the claim store is unavailable or unresponsive. This REVERSES
   * the original fail-closed choice (K19), on the code's own semantics:
   *
   *  - The "spam loop" the old comment protected against is ALREADY fully covered
   *    by the status-guarded CAS in `advanceRung`. The email sits DOWNSTREAM of
   *    `res.count === 0 → continue`, so a re-run cannot reach it — which is why
   *    the call site itself concedes the dedup is "belt-and-suspenders".
   *  - Within one run an org appears once, and across cluster instances the CAS
   *    `updateMany` on a single row is atomic, so exactly one instance matches.
   *    Therefore even with Redis 100% down, fail-open yields AT MOST one email
   *    per (org, rung) PER EPISODE. There is no spam loop left to protect
   *    against. (Across episodes it can send more than one — but a customer who
   *    recovered and re-entered dunning has EARNED a second notice. The claim key
   *    carries no episode discriminator under a 40-day TTL, so the fail-CLOSED
   *    path actively suppresses that legitimate second email: backlog K21.)
   *  - Silently dropping a customer's ONLY escalation notice is the §12b failure
   *    mode, not a safe default — and the drop is PERMANENT, because the status
   *    has already flipped and tomorrow's run will not re-attempt the rung.
   *
   * Gate on `isAvailable()`, NOT on `getClient()` being null: getClient() returns
   * the ioredis object, which is non-null from the moment `new Redis()` succeeds
   * and is only nulled in `disconnect()`. During a real outage the old null-check
   * never fired and the command entered ioredis's offline queue instead.
   */
  private async claimDunningNotice(organizationId: string, key: string): Promise<boolean> {
    const client = this.redis.getClient();
    if (!client || !this.redis.isAvailable()) {
      this.dunningClaimFailOpen(organizationId, key, 'Redis unavailable');
      return true;
    }

    const redisKey = `dunning:${organizationId}:${key}`;
    try {
      // isAvailable() is a snapshot of what ioredis has already NOTICED, so it is
      // necessary but not sufficient — a blackholed socket or a -LOADING server
      // leaves it true while the command never settles. Bound it.
      const result = await this.raceWithTimeout(
        client.set(redisKey, '1', 'EX', 40 * 24 * 60 * 60, 'NX'),
        REDIS_COMMAND_TIMEOUT_MS,
      );
      return result === 'OK';
    } catch (err) {
      this.dunningClaimFailOpen(
        organizationId,
        key,
        `claim errored (${err instanceof Error ? err.message : String(err)})`,
      );
      return true;
    }
  }

  /**
   * Resolve with `promise`, or reject once `ms` elapses. Same shape as
   * `CronLeaderService.raceWithTimeout` — the timer is ALWAYS cleared so it never
   * holds the event loop open, and the losing side is left to settle on its own
   * (a SET that lands late is harmless: it only writes the dedup key it was
   * always going to write).
   */
  private raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `Redis command timed out after ${ms}ms — reachable but not responding ` +
                `(LOADING, blackholed socket, or a blocked server)`,
            ),
          ),
        ms,
      );
    });

    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    }) as Promise<T>;
  }

  /**
   * Lazy Sentry capture — middleware boot wires Sentry but tests don't load it,
   * so an import failure must not poison the ladder. Mirrors the ClickHouse
   * watchdog / onboarding precedent. `logger.error` on its own reaches NO human
   * here: `SentryInterceptor` only wraps HTTP requests, and this is a cron.
   */
  private static captureSentry(err: unknown, tags: Record<string, unknown>): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/nestjs');
      Sentry.captureException(err, { tags: { event: 'entitlement_ladder_failed', ...tags } });
    } catch {
      /* Sentry not loaded — silent drop, logger.error already fired */
    }
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
   * Daily ladder advancement. Idempotent per run: the where-clauses are keyed on
   * the CURRENT status, so re-running the same day is a no-op.
   *
   * An org may advance MORE THAN ONE rung in a single run. Iteration is
   * rung-major and rung 2's `findMany` runs after rung 1's flips have already
   * committed — there is no wrapping transaction — so an org that is far enough
   * behind cascades. That cascade is DESIRABLE (it is what makes catch-up work
   * after a missed day), but do not reason about blast radius on the old,
   * incorrect "each org advances at most one rung" assumption.
   *
   * K19 — ISOLATION. Each rung, and each org within a rung, is independently
   * processable: every Prisma call is its own transaction and nothing here opens
   * a `$transaction`, so the DB already commits per org. A failure on one must
   * therefore never abandon the rest. Both loops are individually guarded, and
   * the outcome is returned (and heartbeated) so a DEGRADED run is
   * distinguishable from a clean one.
   *
   * Note what is deliberately NOT done: `writeHeartbeat` is not moved into a bare
   * `finally`. That would launder a failed run into a fresh freshness reading and
   * destroy the only detection signal `checkLadderFreshness` has. With the
   * isolation below, the run reaches the heartbeat anyway — carrying the failure
   * counts with it.
   */
  async advanceLadder(now = new Date()): Promise<LadderRunResult> {
    const rungs: Record<string, RungOutcome> = {};
    let rungFailures = 0;

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
    try {
      await this.db.organization.updateMany({
        where: {
          subscriptionStatus: { in: ['past_due', 'publish_locked', 'suspended'] },
          entitlementStateSince: null,
        },
        data: { entitlementStateSince: now },
      });
    } catch (err) {
      // Isolated like a rung: the heal only affects orgs that are invisible to
      // the rungs anyway, so failing it must not cost the orgs that ARE visible.
      rungFailures += 1;
      this.logger.error(`Entitlement ladder: un-stamped-org heal FAILED: ${err}`);
      EntitlementService.captureSentry(err, { step: 'heal_unstamped' });
    }

    // Every rung runs unconditionally — `runRung` turns a wholesale throw into an
    // empty outcome plus a counted, logged, Sentry-reported step failure, so the
    // rungs after a broken one still get their chance (D2).
    const rung1 = await this.runRung('past_due->publish_locked', () =>
      // Rung 1: past_due → publish_locked (screens still play; no device signal)
      this.advanceRung('past_due', 'publish_locked', LADDER.DAYS_TO_PUBLISH_LOCK, now, null),
    );

    const rung2 = await this.runRung('publish_locked->suspended', () =>
      // Rung 2: publish_locked → suspended (holding screen; emit tenant:suspended)
      this.advanceRung('publish_locked', 'suspended', LADDER.DAYS_TO_SUSPEND, now, 'past_due'),
    );

    // Rung 3: suspended → canceled (downgrade to free; free still serves).
    //
    // This is the HIGHEST-VOLUME route to the free tier — silent non-payment,
    // not an explicit cancellation — so it must write the SAME entitlement set
    // every other downgrade path writes. It used to hardcode
    // `{ subscriptionTier: 'free', screenQuota: 5 }`: no `storageQuotaBytes`, so
    // an ex-Pro org kept a 100GB storage quota forever (StorageQuotaService
    // enforces the stored value verbatim), and a duplicated quota literal that
    // silently diverges the day free's quota changes (A-F3).
    //
    // `billingEventAt` is stamped too: the ladder is an entitlement transition,
    // and without the mark a late-delivered older webhook could sail past the
    // billing ordering guard and undo it (B-M2).
    const rung3 = await this.runRung('suspended->canceled', () =>
      this.advanceRung('suspended', 'canceled', LADDER.DAYS_TO_CANCEL, now, null, {
        ...tierEntitlementFields('free'),
        billingEventAt: now,
      }),
    );

    for (const step of [rung1, rung2, rung3]) {
      rungs[step.label] = step.outcome;
      if (step.stepFailed) rungFailures += 1;
    }

    const aggregate = Object.values(rungs).reduce<RungOutcome>(
      (acc, r) => ({
        eligible: acc.eligible + r.eligible,
        attempted: acc.attempted + r.attempted,
        advanced: acc.advanced + r.advanced,
        casLost: acc.casLost + r.casLost,
        failed: acc.failed + r.failed,
      }),
      emptyOutcome(),
    );

    const result: LadderRunResult = { ...aggregate, rungFailures, rungs };

    await this.writeHeartbeat(now, result);
    if (aggregate.advanced > 0) {
      this.logger.log(`Entitlement ladder advanced ${aggregate.advanced} org(s)`);
    }
    return result;
  }

  /**
   * D2 — per-rung isolation. A throw in the rung MACHINERY (the candidate
   * `findMany`, or a CAS that rejects rather than returning a count) must not
   * kill the rungs after it: iteration is rung-major, so before K19 an abort in
   * rung 1 took out rung 1's tail AND rungs 2 and 3, on top of the heartbeat.
   */
  private async runRung(
    label: string,
    run: () => Promise<RungOutcome>,
  ): Promise<{ label: string; outcome: RungOutcome; stepFailed: boolean }> {
    try {
      return { label, outcome: await run(), stepFailed: false };
    } catch (err) {
      this.logger.error(`Entitlement ladder rung ${label} FAILED wholesale: ${err}`);
      EntitlementService.captureSentry(err, { rung: label });
      return { label, outcome: emptyOutcome(), stepFailed: true };
    }
  }

  private async advanceRung(
    fromStatus: string,
    toStatus: string,
    daysThreshold: number,
    now: Date,
    suspendReason: string | null,
    extraData: Record<string, unknown> = {},
  ): Promise<RungOutcome> {
    const candidates = await this.db.organization.findMany({
      where: { subscriptionStatus: fromStatus, entitlementStateSince: { not: null } },
      select: {
        id: true,
        entitlementStateSince: true,
        users: { where: { role: 'admin' }, take: 1, select: { email: true, firstName: true } },
      },
      // Deterministic order (D6). Heap order is not stable, so without this a
      // repeated partial outage keeps stranding whichever tail Postgres happens
      // to return last, and a forensic replay of "which orgs did the run reach?"
      // is not reproducible.
      orderBy: { id: 'asc' },
    });

    const outcome = emptyOutcome();
    for (const org of candidates) {
      // D1 — per-org isolation. One tenant's failure must not prevent an
      // independently processable tenant from advancing. There is no
      // transactionality argument against this: each Prisma call below is its own
      // transaction, nothing wraps the loop in `$transaction`, and the DB already
      // commits per org — so the ONLY thing an uncaught rejection here bought was
      // abandoning every remaining tenant (and, iteration being rung-major, every
      // remaining rung). `advanced` counts orgs FULLY processed; an org whose CAS
      // landed but whose side effect then threw is counted `failed`, and the log
      // line says which.
      //
      // The try opens ABOVE the age computation deliberately. `entitlementStateSince`
      // is cast `as Date`, so a value that is not one — Prisma handing back a
      // string, or a future `select` dropping the field — throws inside
      // `wholeDaysBetween`. Outside the try that throw would escape to `runRung`
      // and abandon every remaining org in the rung: the exact invariant K19
      // exists to enforce, reintroduced by a cast. Unreachable today given the
      // `not: null` filter; this is defense in depth, and it makes the docblock's
      // claim to cover the loop body literally true.
      let age = -1;
      let counted = false;
      try {
        age = this.wholeDaysBetween(org.entitlementStateSince as Date, now);
        if (age < daysThreshold) continue;

        outcome.eligible += 1;
        outcome.attempted += 1;
        counted = true;

        // Guard the write on the CURRENT status so two concurrent runs (or a retry)
        // can't double-advance — only the first flip wins.
        //
        // LOAD-BEARING FOR CLUSTER MODE. This is the ONLY thing making the daily
        // ladder cron safe against PM2 running two middleware instances, each of
        // which fires every @Cron: `handleGracePeriodExpiry` is deliberately NOT
        // leader-locked precisely because this CAS makes locking redundant. Every
        // downstream side effect — the suspend notifier, the dunning email, the
        // advanced counter — is gated on `res.count === 0 → continue` below. If a
        // future rung transition writes state BEFORE this guard, or bypasses it,
        // that safety disappears silently and customers get duplicate dunning mail.
        // Add a leader lock to the cron in the same change.
        const res = await this.db.organization.updateMany({
          where: { id: org.id, subscriptionStatus: fromStatus },
          data: { subscriptionStatus: toStatus, ...extraData },
        });
        if (res.count === 0) {
          outcome.casLost += 1;
          continue; // already advanced by a concurrent run
        }

        if (toStatus === 'suspended') {
          await this.notifier.emit(org.id, 'suspended', suspendReason ?? 'past_due');
        }

        // Dunning escalation email, deduped per (org, rung) so a job re-run can't
        // re-send. publish_locked and suspended are the owner-action moments; the
        // transition guard already prevents a double-flip, and the dedup key is
        // belt-and-suspenders — which is exactly why `claimDunningNotice` may
        // safely fail OPEN when its store is down (K19). Fire-and-forget; the
        // banner is the always-on channel.
        if (toStatus === 'publish_locked' || toStatus === 'suspended') {
          const admin = org.users?.[0];
          if (admin?.email && (await this.claimDunningNotice(org.id, toStatus))) {
            this.mail
              .sendPaymentFailedEmail(admin.email, admin.firstName || admin.email.split('@')[0])
              .catch((err) => this.logger.warn(`Dunning email failed for org ${org.id}: ${err}`));
          }
        }
        outcome.advanced += 1;
        this.logger.log(`Org ${org.id} ${fromStatus} → ${toStatus} (episode age ${age}d)`);
      } catch (err) {
        // A throw before the eligibility check leaves the org uncounted. Count it
        // as an eligible attempt that failed: it keeps `attempted === eligible`
        // and `advanced + casLost + failed === attempted` exact, and "we could not
        // determine it" is a failure, not a skip.
        if (!counted) {
          outcome.eligible += 1;
          outcome.attempted += 1;
        }
        outcome.failed += 1;
        this.logger.error(
          `Entitlement ladder FAILED for org ${org.id} on rung ${fromStatus} → ${toStatus} ` +
            `(episode age ${age >= 0 ? `${age}d` : 'unknown'}); ` +
            `continuing with the remaining orgs: ${err}`,
        );
        EntitlementService.captureSentry(err, {
          orgId: org.id,
          rung: `${fromStatus}->${toStatus}`,
        });
        continue;
      }
    }
    return outcome;
  }

  /**
   * Record that a run completed, and HOW it completed. The payload carries the
   * run outcome so `checkLadderFreshness` — and a human reading the key — can
   * tell a clean run from a degraded one (D4). Deliberately written only at the
   * END of a run that reached this line, never from a `finally`: a heartbeat
   * written on the failure path would launder a broken run into a fresh
   * freshness reading and destroy the only detection signal there is.
   */
  private async writeHeartbeat(now: Date, result: LadderRunResult): Promise<void> {
    const payload = JSON.stringify({
      at: now.getTime(),
      eligible: result.eligible,
      attempted: result.attempted,
      advanced: result.advanced,
      casLost: result.casLost,
      failed: result.failed,
      rungFailures: result.rungFailures,
      degraded: result.failed > 0 || result.rungFailures > 0,
    });
    try {
      // Bounded: RedisService.set swallows a rejection but never times out (F7).
      await this.raceWithTimeout(
        this.redis.set(HEARTBEAT_KEY, payload, 7 * 24 * 60 * 60),
        REDIS_COMMAND_TIMEOUT_MS,
      );
    } catch (err) {
      this.logger.warn(`Failed to write entitlement ladder heartbeat: ${err}`);
    }
  }

  /**
   * The last-run heartbeat, or null when it is absent, unreadable, or the read
   * itself failed. Null is deliberately indistinguishable from "never ran": every
   * unreadable state must resolve toward STALE, never toward a reassuring FRESH.
   *
   * This is what makes the D4 payload actually reachable. `isLadderStale` only
   * ever consumed `at`; without a reader for `degraded`, a run that stranded
   * three tenants and finished still wrote a recent `at` and the hourly watchdog
   * reported FRESH — the §12a shape the payload was added to close (F1).
   */
  async readHeartbeat(): Promise<LadderHeartbeat | null> {
    let raw: string | null;
    try {
      // Bounded for the same reason as the write: RedisService.get try/catches a
      // rejection but has no timeout, and a hung GET would hang the hourly
      // watchdog itself (F7).
      raw = await this.raceWithTimeout(this.redis.get(HEARTBEAT_KEY), REDIS_COMMAND_TIMEOUT_MS);
    } catch (err) {
      this.logger.warn(`Failed to read entitlement ladder heartbeat: ${err}`);
      return null;
    }
    if (!raw) return null;
    return this.parseHeartbeat(raw);
  }

  /**
   * Parse a heartbeat value. Accepts BOTH the current JSON payload and the
   * bare-millis string written before D4 — a heartbeat from the previous release
   * survives in Redis for up to its 7-day TTL after the deploy, and misreading it
   * as absent would fire a false STALE alert for a day. A legacy value carries no
   * outcome, so it reports `degraded: false`: the outcome is genuinely unknown,
   * and inventing `true` would fire a false DEGRADED alert for that same day.
   */
  private parseHeartbeat(raw: string): LadderHeartbeat | null {
    const legacy = Number(raw);
    if (Number.isFinite(legacy) && legacy > 0) {
      return { at: legacy, degraded: false, failed: 0, rungFailures: 0 };
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.at !== 'number' || !Number.isFinite(parsed.at)) return null;
      return {
        at: parsed.at,
        degraded: parsed.degraded === true,
        failed: typeof parsed.failed === 'number' ? parsed.failed : 0,
        rungFailures: typeof parsed.rungFailures === 'number' ? parsed.rungFailures : 0,
      };
    } catch {
      return null;
    }
  }

  /** True if `heartbeat` is missing or older than the staleness window. */
  isHeartbeatStale(heartbeat: LadderHeartbeat | null, now = new Date()): boolean {
    if (!heartbeat) return true;
    return now.getTime() - heartbeat.at > HEARTBEAT_STALE_MS;
  }

  /** True if the ladder job has not run within the staleness window (or never). */
  async isLadderStale(now = new Date()): Promise<boolean> {
    return this.isHeartbeatStale(await this.readHeartbeat(), now);
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
