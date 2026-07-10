import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Cluster-safe cron leader election.
 *
 * PM2 runs the middleware in cluster mode (multiple instances) and
 * `@nestjs/schedule` fires every `@Cron` in EVERY instance — so, uncoordinated,
 * a cron runs once per instance per tick. That double-advances state and
 * double-sends email (e.g. duplicate trial reminders, and — but for the B3
 * ladder's own idempotency — double dunning). This wraps a cron body in a
 * per-cron Redis lock so exactly ONE instance runs it per window.
 *
 * Design:
 *  - Redis `SET NX EX`. The lock is LEFT TO EXPIRE (never explicitly released):
 *    the winner claims for `ttlSeconds`, every other instance's `SET NX` fails
 *    and it skips. TTL is set below the shortest cron period (default 50s <
 *    EVERY_MINUTE's 60s) so the next tick can re-acquire; PM2 cluster instances
 *    share the host clock, so both fire within milliseconds and 50s easily
 *    covers that race. If the winner crashes mid-run the lock expires and the
 *    next window retries.
 *  - FAIL-OPEN: if Redis is unavailable (or the SET errors) the body runs
 *    anyway. A *skipped* cron — above all the entitlement ladder, where a missed
 *    day delays every dunning escalation — is worse than a rare double-fire, and
 *    the money-path crons (B3 ladder) are additionally idempotent by construction
 *    (status-guarded CAS + SET NX dunning claim), so a fail-open double-fire is
 *    absorbed there.
 *  - A per-cron lock (vs. an `NODE_APP_INSTANCE === '0'` guard) survives a single
 *    instance being down: whichever instance is alive fires, wins the lock, and
 *    runs. An instance-0-only guard would skip the run entirely whenever instance
 *    0 is the one restarting.
 */
@Injectable()
export class CronLeaderService {
  private readonly logger = new Logger(CronLeaderService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Run `fn` only on the instance that wins the leader lock for `name` this tick.
   *
   * @param name  stable per-cron identifier (the Redis key suffix). Must be unique
   *              per cron across the app.
   * @param fn    the cron body. Its own errors propagate (this wrapper never
   *              swallows them) — keep the caller's existing try/catch.
   * @param ttlSeconds  lock lifetime; MUST be < the cron's period. Default 50s is
   *              correct for every current cron (all fire at most once/minute).
   *              Only override for a faster cron.
   */
  async runExclusive(
    name: string,
    fn: () => Promise<void>,
    ttlSeconds = 50,
  ): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      this.logger.warn(
        `Redis unavailable — running cron "${name}" fail-open (no leader lock; possible double-run in cluster).`,
      );
      await fn();
      return;
    }

    let acquired: 'OK' | null;
    try {
      acquired = await client.set(`cron:leader:${name}`, this.token(), 'EX', ttlSeconds, 'NX');
    } catch (err) {
      this.logger.warn(
        `Leader lock for "${name}" errored (${err instanceof Error ? err.message : String(err)}) — running fail-open.`,
      );
      await fn();
      return;
    }

    if (acquired !== 'OK') {
      // Expected path for every instance except the winner — debug-level to avoid
      // N-1 log lines per tick.
      this.logger.debug(`Cron "${name}" skipped — another instance holds the leader lock.`);
      return;
    }

    await fn();
  }

  /** Identifies the winning instance in the lock value (debug/forensics only). */
  private token(): string {
    return `${process.env.NODE_APP_INSTANCE ?? '0'}:${process.pid}`;
  }
}
