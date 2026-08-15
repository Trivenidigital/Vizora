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
