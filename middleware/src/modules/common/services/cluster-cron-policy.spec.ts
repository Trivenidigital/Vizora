import * as fs from 'fs';
import * as path from 'path';

/**
 * Source-scan guard for the cluster-cron policy (mirrors the shape of the
 * `pm2 flush` scan tests in scripts/ops).
 *
 * PM2 runs the middleware in cluster mode and `@nestjs/schedule` fires every
 * `@Cron` in EVERY instance. Which crons are leader-locked is a DELIBERATE,
 * case-by-case decision, and it is asymmetric: some crons must be locked, and
 * some must NOT be — including two that would silently break if a well-meaning
 * contributor "finished the job" by wrapping everything.
 *
 * This file pins both directions in source, because behaviour tests cannot:
 * a service with no spec (billing-lifecycle had none before this change) or a
 * cron whose double-fire is only a cost problem (validation-monitor) has no
 * natural failing assertion when the wrapper is dropped.
 */

const MODULES_DIR = path.join(__dirname, '..', '..');

function readModuleSource(relPath: string): string {
  const full = path.join(MODULES_DIR, relPath);
  const src = fs.readFileSync(full, 'utf-8');
  expect(src.length).toBeGreaterThan(0);
  return src;
}

/**
 * Source slice for ONE cron: from its `@Cron(<expr>)` decorator to the next
 * `@Cron` (or EOF).
 *
 * Whole-file assertions are useless where a file holds several crons with
 * different dispositions. `billing-lifecycle.service.ts` is the case that
 * matters: it is in LEADER_LOCKED for handleTrialLifecycle, so a whole-file
 * `toContain('runExclusive')` passes trivially and ADDING a lock to
 * handleGracePeriodExpiry — which would make a money-path cron newly dependent
 * on Redis being up, the exact thing this PR argues against — would fail no
 * test at all.
 */
function cronSlice(src: string, cronExpr: string): string {
  const marker = `@Cron(${cronExpr})`;
  const markerIdx = src.indexOf(marker);
  expect(markerIdx).toBeGreaterThanOrEqual(0);

  const lines = src.slice(0, markerIdx).split('\n');
  // Walk back over the contiguous comment/blank block directly above the
  // decorator — that is where the "Deliberately NOT leader-locked" rationale
  // lives, and it belongs to this cron.
  let firstLine = lines.length - 1;
  while (firstLine > 0) {
    const candidate = lines[firstLine - 1].trim();
    const isComment =
      candidate.startsWith('//') ||
      candidate.startsWith('*') ||
      candidate.startsWith('/*') ||
      candidate === '';
    if (!isComment) break;
    firstLine -= 1;
  }

  const start = lines.slice(0, firstLine).join('\n').length;
  const next = src.indexOf('@Cron(', markerIdx + marker.length);
  return src.slice(start, next === -1 ? undefined : next);
}

describe('cluster cron policy', () => {
  // ---------------------------------------------------------------------
  // MUST be leader-locked.
  // ---------------------------------------------------------------------
  const LEADER_LOCKED: Array<{ file: string; lockName: string; why: string }> = [
    {
      file: 'billing/billing-lifecycle.service.ts',
      lockName: 'billing-trial-lifecycle',
      why: 'trial reminder emails have NO dedup — a double-fire mails every customer twice',
    },
    {
      file: 'content/template-refresh.service.ts',
      lockName: 'content-template-refresh',
      why: 'doubles outbound calls to customer data sources + OpenWeather quota every minute, and races on the metadata blob',
    },
    {
      file: 'common/data-retention.service.ts',
      lockName: 'common-data-retention',
      why: 'doubles the lock/WAL pressure of the heaviest scheduled DB job',
    },
    {
      file: 'analytics/analytics.service.ts',
      lockName: 'analytics-cleanup-impressions',
      why: 'concurrent batch deletes interleave and exit the loop early, leaving rows behind',
    },
    {
      file: 'clickhouse/clickhouse-watchdog.service.ts',
      lockName: 'clickhouse-health-freshness',
      why: 'duplicate Sentry ops alerts every 15 min for the duration of a stall',
    },
    {
      file: 'health/validation-monitor.service.ts',
      lockName: 'health-hourly-validation',
      why: '~400 redundant queries per hour against live tables',
    },
    {
      file: 'content/content.service.ts',
      lockName: 'content-expiration',
      why:
        'a redundant identical fleet push to every device plus a duplicate content.expired emit ' +
        'every hour — wasteful-but-real-work, the same profile as data-retention',
    },
  ];

  describe.each(LEADER_LOCKED)('$file is leader-locked', ({ file, lockName, why }) => {
    it(`calls runExclusive — required because ${why}`, () => {
      const src = readModuleSource(file);
      expect(src).toContain('runExclusive');
    });

    it(`uses the stable lock key "${lockName}"`, () => {
      // The key is the coordination contract between instances. Renaming it in
      // one place (or letting two crons share a key) silently changes which
      // crons contend, so pin it.
      const src = readModuleSource(file);
      expect(src).toContain(`'${lockName}'`);
    });
  });

  it('no two crons share a leader-lock key', () => {
    const keys = LEADER_LOCKED.map((c) => c.lockName);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // ---------------------------------------------------------------------
  // MUST NOT be leader-locked — these break if wrapped.
  // ---------------------------------------------------------------------
  const MUST_RUN_PER_INSTANCE: Array<{ file: string; why: string }> = [
    {
      file: 'health/continuous-health-monitor.service.ts',
      why:
        'it probes THIS worker and stores the result in per-instance in-memory state that only ' +
        'this worker\'s /health endpoints serve. Leader-locking it leaves the loser answering ' +
        'health reads from a permanently empty buffer — and the crashed instance is exactly the ' +
        'one that would stop reporting.',
    },
    {
      file: 'displays/persistent-offline.reconciler.ts',
      why:
        'it sets an in-process Prometheus gauge and each PM2 worker serves its OWN ' +
        '/internal/metrics. Leader-locking it freezes the loser\'s gauge forever, so half of all ' +
        'scrapes read a stale number that looks like real data.',
    },
  ];

  describe.each(MUST_RUN_PER_INSTANCE)('$file must run in every instance', ({ file, why }) => {
    it('does NOT call runExclusive', () => {
      const src = readModuleSource(file);
      expect(src).not.toContain('runExclusive');
      // The message is the point of this test — it has to reach whoever is
      // mid-edit and about to "finish the job".
      if (src.includes('runExclusive')) {
        throw new Error(`${file} must NOT be leader-locked: ${why}`);
      }
    });

    it('carries a comment explaining why, so the reason survives the next refactor', () => {
      const src = readModuleSource(file);
      expect(src).toContain('do NOT leader-lock');
    });
  });

  // ---------------------------------------------------------------------
  // Method-scoped: the money-path crons that share a file with a LOCKED cron.
  // ---------------------------------------------------------------------
  describe('billing-lifecycle: only the trial cron is locked', () => {
    const FILE = 'billing/billing-lifecycle.service.ts';

    it("handleTrialLifecycle IS locked (it is the file's only locked cron)", () => {
      const slice = cronSlice(readModuleSource(FILE), "'0 8 * * *'");
      expect(slice).toContain("runExclusive('billing-trial-lifecycle'");
    });

    it('handleGracePeriodExpiry is NOT locked — the ladder CAS already dedupes it', () => {
      // Locking it would give a money-path cron a new dependency on Redis being
      // up, buying nothing advanceRung's status-guarded updateMany does not
      // already guarantee.
      const slice = cronSlice(readModuleSource(FILE), "'0 9 * * *'");
      expect(slice).not.toContain('runExclusive');
      expect(slice).toContain('Deliberately NOT leader-locked');
      expect(slice).toContain('advanceRung');
    });

    it('the unlocked rationale credits the CAS ALONE, never the dunning SET NX (K19)', () => {
      // The verdict is unchanged — the CAS carries it — but the CITED MECHANISM
      // was wrong, and wrong in a load-bearing way: `claimDunningNotice` sits
      // DOWNSTREAM of `res.count === 0 → continue`, so it guarantees nothing the
      // CAS does not, and until K19 that same unguarded SET was what ABORTED the
      // run mid-fleet during a Redis outage. A future reader must not re-derive
      // "the ladder is safe unlocked" from a claim that is itself a failure mode.
      const slice = cronSlice(readModuleSource(FILE), "'0 9 * * *'");
      expect(slice).toContain('the CAS ALONE');
      expect(slice).toContain('K19');
      expect(slice).toContain('claimDunningNotice');
      expect(slice).toContain('It never');
      // The retracted phrasing must not come back.
      expect(slice).not.toContain('additionally deduped per');
    });

    it('checkLadderFreshness is NOT locked — a duplicate log line is the whole harm', () => {
      // A watchdog that goes silent because its lock backend is down is strictly
      // worse than one that shouts twice.
      const slice = cronSlice(readModuleSource(FILE), 'CronExpression.EVERY_HOUR');
      expect(slice).not.toContain('runExclusive');
      expect(slice).toContain('Deliberately NOT leader-locked');
    });
  });

  describe('displays: neither cron is locked', () => {
    const FILE = 'displays/displays.service.ts';

    it('detectOfflineDevices is NOT locked — tryClaimDedupWindow absorbs the duplicate event', () => {
      const slice = cronSlice(readModuleSource(FILE), 'CronExpression.EVERY_MINUTE');
      expect(slice).not.toContain('runExclusive');
      expect(slice).toContain('tryClaimDedupWindow');
    });

    it('resetStalePairingDevices is NOT locked — idempotent updateMany, no event', () => {
      const slice = cronSlice(readModuleSource(FILE), 'CronExpression.EVERY_HOUR');
      expect(slice).not.toContain('runExclusive');
      expect(slice).toContain('Deliberately NOT leader-locked');
    });
  });

  // ---------------------------------------------------------------------
  // Deliberately unlocked because something else already dedupes them.
  // ---------------------------------------------------------------------
  const DELIBERATELY_UNLOCKED: Array<{ file: string; mechanism: string }> = [
    { file: 'displays/displays.service.ts', mechanism: 'tryClaimDedupWindow' },
    { file: 'notifications/alert-rules/alert-rules.service.ts', mechanism: 'P2002' },
    { file: 'notifications/alert-rules/alert-rule.evaluator.ts', mechanism: 'CAS' },
  ];

  describe.each(DELIBERATELY_UNLOCKED)('$file states why it is unlocked', ({ file, mechanism }) => {
    it('carries a "Deliberately NOT leader-locked" comment naming the mechanism', () => {
      const src = readModuleSource(file);
      expect(src).toContain('Deliberately NOT leader-locked');
      expect(src).toContain(mechanism);
    });
  });

  // ---------------------------------------------------------------------
  // The CAS that makes the billing ladder safe WITHOUT a lock.
  // ---------------------------------------------------------------------
  it('entitlement.advanceRung still guards its write on the current status', () => {
    // handleGracePeriodExpiry is deliberately unlocked ONLY because this CAS
    // exists. If it disappears, the ladder needs a lock in the same change.
    const src = readModuleSource('billing/entitlement.service.ts');
    expect(src).toContain('subscriptionStatus: fromStatus');
    expect(src).toContain('res.count === 0');
    expect(src).toContain('LOAD-BEARING FOR CLUSTER MODE');
  });

  it('expireTrials claims the row with a status-guarded updateMany, not a bare update', () => {
    const src = readModuleSource('billing/billing-lifecycle.service.ts');
    expect(src).toContain("where: { id: org.id, subscriptionStatus: 'trial' }");
    expect(src).toContain('claimed.count === 0');
  });
});
