import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Hard ceiling on the leader-lock SET. Deliberately small: acquiring the lock is
 * a single round-trip to a local Redis, so anything approaching a second means
 * Redis is not healthy, and the correct move is to stop waiting and fail open.
 * Must stay well under the shortest cron period (60s) — a timeout that exceeded
 * it would let ticks overlap.
 */
const LOCK_COMMAND_TIMEOUT_MS = 2000;

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
 * WHAT THIS IS — AND IS NOT (read before reusing it):
 * This is a FAN-OUT lock: it de-duplicates the N simultaneous firings of ONE
 * tick across N cluster instances. It is NOT mutual exclusion across time.
 * Specifically it does NOT:
 *  - prevent overlapping runs of a slow cron. The lock TTL (50s) is shorter than
 *    every cron period bar EVERY_MINUTE, so a run that outlives its TTL leaves
 *    the key expired and the NEXT tick acquires freely while the previous run is
 *    still going. If you need "never two at once over time", this is the wrong
 *    primitive — you want a held-and-released lock with heartbeat renewal.
 *  - guarantee the run happens. If the winner dies mid-run, that run is LOST.
 *    "The next window retries" is cheap for an every-minute cron and expensive
 *    for a daily one: a leader killed mid-run at 08:00 means the trial-lifecycle
 *    job simply does not happen until 08:00 TOMORROW. A PM2 reload landing inside
 *    a daily cron's run is the realistic way to hit this. Closing it needs a
 *    completed-marker key (see backlog); it is deliberately not solved here.
 *
 * Design:
 *  - Redis `SET NX EX`. The lock is LEFT TO EXPIRE (never explicitly released):
 *    the winner claims for `ttlSeconds`, every other instance's `SET NX` fails
 *    and it skips. TTL is set below the shortest cron period (default 50s <
 *    EVERY_MINUTE's 60s) so the next tick can re-acquire; PM2 cluster instances
 *    share the host clock, so both fire within milliseconds and 50s easily
 *    covers that race.
 *  - FAIL-OPEN: if Redis is unavailable, the SET errors, OR the SET does not
 *    answer within `LOCK_COMMAND_TIMEOUT_MS`, the body runs
 *    anyway. A *skipped* cron — above all the entitlement ladder, where a missed
 *    day delays every dunning escalation — is worse than a rare double-fire, and
 *    the money-path crons (B3 ladder) are additionally idempotent by construction
 *    (status-guarded CAS + SET NX dunning claim), so a fail-open double-fire is
 *    absorbed there. Every fail-open is logged at WARN with a running per-cron
 *    count (§12b): when duplicate email goes out, "Redis was down at 08:00" has
 *    to be findable afterwards rather than inferred.
 *  - A per-cron lock (vs. an `NODE_APP_INSTANCE === '0'` guard) survives a single
 *    instance being down: whichever instance is alive fires, wins the lock, and
 *    runs. An instance-0-only guard would skip the run entirely whenever instance
 *    0 is the one restarting.
 *  - Acquire/skip log at LOG level, not debug. `debug` is disabled in production,
 *    which made the lock invisible exactly where it runs: an operator staring at
 *    a worker that stopped logging a cron could not tell "correctly skipped —
 *    the sibling won" from "the cron is dead on this instance". The cost is one
 *    extra line per cron per tick per loser instance, which at 2 instances and
 *    one per-minute wrapped cron is ~1.4k lines/day — bounded, and the ops log
 *    retention in `scripts/ops/lib/log-retention.ts` already caps file size.
 */
@Injectable()
export class CronLeaderService {
  private readonly logger = new Logger(CronLeaderService.name);

  /**
   * Running count of fail-open runs per cron, for the life of the process.
   * Attribution aid (§12b): the WARN line carries it so a log grep answers
   * "was this a one-off blip or has the lock been off all day?" without
   * reconstructing the Redis outage from other services' logs.
   */
  private readonly failOpenCounts = new Map<string, number>();

  constructor(private readonly redis: RedisService) {}

  /** Fail-open runs recorded for `name` so far in this process. */
  getFailOpenCount(name: string): number {
    return this.failOpenCounts.get(name) ?? 0;
  }

  private failOpen(name: string, reason: string): void {
    const count = this.getFailOpenCount(name) + 1;
    this.failOpenCounts.set(name, count);
    this.logger.warn(
      `Cron "${name}" running FAIL-OPEN (no leader lock; may double-run in cluster) — ` +
        `${reason}. Fail-open count for this cron this process: ${count}.`,
    );
  }

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
    // Gate on isAvailable(), NOT on getClient() being null. getClient() returns
    // the ioredis object, which is non-null from the moment `new Redis()` succeeds
    // and is only nulled in disconnect() — so during a real Redis outage the
    // object still exists and this fast path never fires. The command would then
    // enter ioredis's offline queue and reject only after maxRetriesPerRequest:20
    // against the capped backoff in redis.service.ts, i.e. ~42s of dead wait per
    // wrapped cron per tick.
    //
    // isAvailable() only covers outages ioredis has ALREADY OBSERVED, so it is
    // necessary but NOT sufficient — see the timeout below.
    const client = this.redis.getClient();
    if (!client || !this.redis.isAvailable()) {
      this.failOpen(name, 'Redis unavailable');
      await fn();
      return;
    }

    let acquired: 'OK' | null;
    try {
      // Bound the SET. isAvailable() is a snapshot of what ioredis has NOTICED;
      // several real shapes leave it TRUE while the command never completes:
      //   (a) reconnected but the server is still -LOADING a large RDB/AOF,
      //   (b) a TCP blackhole, where no error fires until the kernel retransmit
      //       timeout (~15 min) — the socket looks fine the entire time,
      //   (c) the server blocked on a BGSAVE fork stall.
      // The catch below only catches a REJECTION, not a HANG, so without this
      // race the cron body would be DELAYED — which is precisely the
      // "skipped cron is worse than a double-fire" outcome this class exists to
      // avoid, and becomes a genuinely LOST run if PM2 reloads during the hang
      // (K18). For an EVERY_MINUTE cron a multi-minute hang also piles up
      // invocations that all release together on recovery.
      acquired = await this.raceWithTimeout(
        client.set(`cron:leader:${name}`, this.token(), 'EX', ttlSeconds, 'NX'),
        LOCK_COMMAND_TIMEOUT_MS,
      );
    } catch (err) {
      this.failOpen(
        name,
        `leader lock errored (${err instanceof Error ? err.message : String(err)})`,
      );
      await fn();
      return;
    }

    if (acquired !== 'OK') {
      // Expected path for every instance except the winner. LOG level, not debug:
      // see the docblock — debug is off in prod, which is precisely where the
      // distinction between "skipped correctly" and "cron is dead here" matters.
      this.logger.log(`Cron "${name}" skipped — another instance holds the leader lock.`);
      return;
    }

    this.logger.log(`Cron "${name}" leader lock acquired by ${this.token()} — running.`);
    await fn();
  }

  /** Identifies the winning instance in the lock value (debug/forensics only). */
  private token(): string {
    return `${process.env.NODE_APP_INSTANCE ?? '0'}:${process.pid}`;
  }

  /**
   * Resolve with `promise`, or reject once `ms` elapses.
   *
   * The timer is ALWAYS cleared — an un-cleared timer would keep the event loop
   * alive for its duration on every single tick of every wrapped cron, which
   * Jest's `detectOpenHandles` would (correctly) flag. The losing side of the
   * race is left to settle on its own: the SET may still land afterwards, which
   * is harmless — worst case the lock key gets set by an instance that has
   * already decided to fail open, and it expires on its normal TTL.
   */
  private raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `SET timed out after ${ms}ms — Redis is reachable but not responding ` +
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
}
