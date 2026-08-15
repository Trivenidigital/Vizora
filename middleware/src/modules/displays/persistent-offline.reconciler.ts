import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DEVICE_OFFLINE_THRESHOLD_MS } from '@vizora/database';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';

/** Page size for the cross-org scan. Never load the whole fleet at once. */
const PAGE_SIZE = 500;

/**
 * Periodic reconciliation of *persistent* offline state.
 *
 * WHY THIS EXISTS. `DisplaysService.detectOfflineDevices()` is transition-based:
 * it fires `device.offline` on the edge `online -> offline`, which the alert-rule
 * engine turns into per-tenant email. That is correct, and it is NOT outage
 * coverage — it emits nothing for a display that was already offline before the
 * monitor started, a missed transition, a rule misconfigured at transition time,
 * or an outage that simply persists. Production showed the gap plainly on
 * 2026-08-02: 24 displays offline, 0 online, 2 alert-rule firings in total.
 *
 * SCOPE IS DELIBERATELY NARROW (approved policy, 2026-08-03):
 *   PERSISTENT_OFFLINE_DETECTION   = ENABLED
 *   CUSTOMER_NOTIFICATIONS         = DEFAULT_OFF
 *   INITIAL_BACKFILL_NOTIFICATIONS = SUPPRESSED
 *   REPEATED_OUTAGE_NOTIFICATIONS  = NOT_IMPLEMENTED_YET
 *
 * So this class emits NO events. It deliberately does not touch the alert-rule
 * engine, because the moment it emits something that engine consumes, a
 * months-old outage becomes a customer email — and the first send cannot be
 * retracted. Escalating this to customer notification is a separate, explicit
 * decision. Transition alerting is left exactly as it is.
 *
 * TWO BOUNDARIES, recorded because both are easy to overstate later:
 *
 * 1. This is AGGREGATE DETECTION, not incident reconciliation. It queries,
 *    logs and sets a gauge. It creates no durable incident, sends nothing, and
 *    implements no reminder cadence. Those are deferred product capabilities,
 *    not oversights.
 *
 * 2. The gauge is a DATABASE-STATE COUNT, not an actionable-customer-outage
 *    count. It includes orgs classified as internal-test (`Vizora QA`) and
 *    retired (`Vizora LLC`), whose data was deliberately left untouched by that
 *    classification. Fine for an internal technical metric. Do NOT later
 *    present it as "N real customer outages" — it is not that number.
 *
 * ACTIVATION GATE — read before adding incident writes or notifications:
 *
 *    Middleware runs two PM2 cluster instances and this cron fires in BOTH.
 *    That is harmless today only because the job is read-only and the gauge
 *    uses set(). The moment a side effect is added — an incident row, an
 *    email, a webhook — two instances will produce duplicates. Before that
 *    change, require ONE of: leader election (CronLeaderService, PR #228),
 *    distributed locking, or side effects that are independently idempotent.
 *    Do not rely on the current safety; it is a property of read-only-ness,
 *    not of the scheduler.
 *
 * @see docs/plans/2026-08-02-persistent-offline-monitoring.md
 */
@Injectable()
export class PersistentOfflineReconciler {
  private readonly logger = new Logger(PersistentOfflineReconciler.name);

  /**
   * Display ids seen as persistently offline on the previous run. Derived
   * state, not a source of truth: every run recomputes the set from the
   * database, so "resolution" is simply falling out of the query — which
   * happens when the display heartbeats again OR is disabled by an operator.
   * Held in memory on purpose; it needs no migration and nothing depends on it
   * surviving a restart.
   */
  private previous = new Set<string>();

  private firstRunComplete = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly metrics: MetricsService,
  ) {}

  private get enabled(): boolean {
    return process.env.PERSISTENT_OFFLINE_RECONCILE_ENABLED === 'true';
  }

  /**
   * Raw cron string, NOT `CronExpression.EVERY_15_MINUTES`.
   *
   * That enum member does not exist; referencing it yields `@Cron(undefined)`,
   * which throws inside `app.listen()` and crash-looped middleware in
   * production once already (incident #247). Do not "tidy" this into the enum.
   */
  /**
   * MUST run in EVERY instance — do NOT leader-lock this one.
   *
   * The output is an in-process Prometheus gauge, and each PM2 worker serves its
   * OWN `/internal/metrics`. Under a leader lock the loser never sets its gauge,
   * so half of all scrapes would read a value frozen at whatever it held when the
   * lock was introduced — a permanently stale number that looks like real data.
   * The cron is a pure read plus a gauge set: running it in both instances costs
   * one extra query per 15 minutes and is the only way both scrape targets stay
   * truthful.
   */
  @Cron('*/15 * * * *')
  async reconcile(): Promise<void> {
    if (!this.enabled) return;

    const startedAt = Date.now();
    try {
      const current = await this.scan();

      // Diff against the previous run purely to log transitions. On the very
      // first run everything looks "new" — that is the backfill, and it is
      // logged as a count only, never per-display and never notified.
      const newlyOffline = [...current].filter(id => !this.previous.has(id));
      const recovered = [...this.previous].filter(id => !current.has(id));

      if (!this.firstRunComplete) {
        this.logger.log(
          `Persistent-offline backfill: ${current.size} display(s) already offline beyond threshold. ` +
            `Notifications suppressed by policy.`,
        );
        this.firstRunComplete = true;
      } else if (newlyOffline.length > 0 || recovered.length > 0) {
        this.logger.log(
          `Persistent-offline reconcile: +${newlyOffline.length} newly persistent, ` +
            `-${recovered.length} recovered, ${current.size} total.`,
        );
      }

      this.previous = current;

      // A GAUGE, not a counter, and that is load-bearing: middleware runs two
      // instances in PM2 cluster mode and CronLeaderService (PR #228) is not
      // merged, so this method fires once per instance per interval. `set()` is
      // idempotent under that; `inc()` would silently double every number.
      this.metrics.persistentOfflineDisplays.set(current.size);
      this.metrics.persistentOfflineReconcileDuration.observe((Date.now() - startedAt) / 1000);
    } catch (err) {
      // Never throw out of a cron. But never be silent either — a swallowed
      // failure here is exactly how a broken monitor looks identical to a
      // healthy one.
      this.metrics.persistentOfflineReconcileFailures.inc();
      this.logger.error(
        `Persistent-offline reconcile FAILED — the offline count is now stale: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * All displays that are offline beyond the shared threshold, across every
   * organisation. This runs in-process against the database, so it is not a
   * cross-tenant API surface and needs no tenant-crossing authorization.
   *
   * Excludes `isDisabled` displays: an operator has deliberately taken those out
   * of service and alerting on them is noise by construction. That rule already
   * applies in fleet-manager and schedule-doctor; it applies here too.
   */
  private async scan(): Promise<Set<string>> {
    const threshold = new Date(Date.now() - DEVICE_OFFLINE_THRESHOLD_MS);
    const found = new Set<string>();
    let cursor: string | undefined;

    for (;;) {
      const batch = await this.db.display.findMany({
        where: {
          status: 'offline',
          isDisabled: false,
          lastHeartbeat: { lt: threshold },
        },
        select: { id: true },
        orderBy: { id: 'asc' }, // deterministic paging, stable dedup
        take: PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (batch.length === 0) break;
      for (const d of batch) found.add(d.id);
      if (batch.length < PAGE_SIZE) break;
      cursor = batch[batch.length - 1].id;
    }

    return found;
  }
}
