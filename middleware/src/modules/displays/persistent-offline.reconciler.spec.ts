import { Test } from '@nestjs/testing';
import { DEVICE_OFFLINE_THRESHOLD_MS } from '@vizora/database';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { PersistentOfflineReconciler } from './persistent-offline.reconciler';

/**
 * The approved policy is narrow, and most of these tests exist to keep it that
 * way rather than to check that a query runs:
 *
 *   detection ENABLED · customer notifications DEFAULT_OFF ·
 *   initial backfill SUPPRESSED · repeat-outage cadence NOT IMPLEMENTED
 *
 * The single most important assertion in this file is that nothing is emitted.
 * The moment this class emits an event the alert-rule engine consumes, a
 * months-old outage becomes a customer email that cannot be recalled.
 */
describe('PersistentOfflineReconciler', () => {
  let reconciler: PersistentOfflineReconciler;
  let findMany: jest.Mock;
  let metrics: {
    persistentOfflineDisplays: { set: jest.Mock };
    persistentOfflineReconcileDuration: { observe: jest.Mock };
    persistentOfflineReconcileFailures: { inc: jest.Mock };
  };

  const rows = (...ids: string[]) => ids.map(id => ({ id }));

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    metrics = {
      persistentOfflineDisplays: { set: jest.fn() },
      persistentOfflineReconcileDuration: { observe: jest.fn() },
      persistentOfflineReconcileFailures: { inc: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PersistentOfflineReconciler,
        { provide: DatabaseService, useValue: { display: { findMany } } },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    reconciler = moduleRef.get(PersistentOfflineReconciler);
    process.env.PERSISTENT_OFFLINE_RECONCILE_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.PERSISTENT_OFFLINE_RECONCILE_ENABLED;
    jest.restoreAllMocks();
  });

  it('does nothing at all when the flag is off — this ships default-off', async () => {
    delete process.env.PERSISTENT_OFFLINE_RECONCILE_ENABLED;
    await reconciler.reconcile();
    expect(findMany).not.toHaveBeenCalled();
    expect(metrics.persistentOfflineDisplays.set).not.toHaveBeenCalled();
  });

  it('emits no events — the whole point of the narrow policy', () => {
    // A structural assertion rather than a behavioural one: the class must not
    // even hold an event emitter, so notification cannot be added by accident.
    const deps = Reflect.getMetadata('design:paramtypes', PersistentOfflineReconciler) ?? [];
    const names = deps.map((d: { name?: string }) => d?.name);
    expect(names).not.toContain('EventEmitter2');
    expect(JSON.stringify(reconciler)).not.toContain('eventEmitter');
  });

  it('excludes operator-disabled displays and honours the shared threshold', async () => {
    const before = Date.now();
    await reconciler.reconcile();

    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe('offline');
    expect(where.isDisabled).toBe(false);
    // Reuses DEVICE_OFFLINE_THRESHOLD_MS rather than duplicating a constant.
    const cutoff = (where.lastHeartbeat.lt as Date).getTime();
    expect(before - cutoff).toBeGreaterThanOrEqual(DEVICE_OFFLINE_THRESHOLD_MS - 5_000);
    expect(before - cutoff).toBeLessThanOrEqual(DEVICE_OFFLINE_THRESHOLD_MS + 5_000);
  });

  it('reports the fleet-wide count as a gauge, so cluster double-firing cannot double it', async () => {
    findMany.mockResolvedValueOnce(rows('a', 'b', 'c'));
    await reconciler.reconcile();
    expect(metrics.persistentOfflineDisplays.set).toHaveBeenCalledWith(3);

    // Second instance of the PM2 cluster runs the same cron in the same window.
    findMany.mockResolvedValueOnce(rows('a', 'b', 'c'));
    await reconciler.reconcile();
    expect(metrics.persistentOfflineDisplays.set).toHaveBeenLastCalledWith(3);
  });

  it('is idempotent across runs — same input, same reported state', async () => {
    findMany.mockResolvedValue(rows('a', 'b'));
    await reconciler.reconcile();
    await reconciler.reconcile();
    await reconciler.reconcile();
    const calls = metrics.persistentOfflineDisplays.set.mock.calls.map(c => c[0]);
    expect(calls).toEqual([2, 2, 2]);
  });

  it('resolves a display implicitly when it drops out of the query', async () => {
    findMany.mockResolvedValueOnce(rows('a', 'b'));
    await reconciler.reconcile();
    // 'b' heartbeats again, or an operator disables it — either way it is gone.
    findMany.mockResolvedValueOnce(rows('a'));
    await reconciler.reconcile();
    expect(metrics.persistentOfflineDisplays.set).toHaveBeenLastCalledWith(1);
  });

  it('logs the first pass as a suppressed backfill, not as new outages', async () => {
    const log = jest.spyOn(reconciler['logger'], 'log').mockImplementation();
    findMany.mockResolvedValueOnce(rows('a', 'b', 'c'));
    await reconciler.reconcile();
    expect(log.mock.calls[0][0]).toMatch(/backfill/i);
    expect(log.mock.calls[0][0]).toMatch(/suppressed/i);
  });

  it('pages through large fleets deterministically', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({ id: `d${String(i).padStart(4, '0')}` }));
    findMany.mockResolvedValueOnce(page1).mockResolvedValueOnce(rows('d0500'));
    await reconciler.reconcile();

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ id: 'asc' });
    // second page continues after the last id of the first, skipping it
    expect(findMany.mock.calls[1][0].cursor).toEqual({ id: 'd0499' });
    expect(findMany.mock.calls[1][0].skip).toBe(1);
    expect(metrics.persistentOfflineDisplays.set).toHaveBeenCalledWith(501);
  });

  it('never throws out of the cron, but counts and names the failure', async () => {
    const error = jest.spyOn(reconciler['logger'], 'error').mockImplementation();
    findMany.mockRejectedValueOnce(new Error('database is down'));

    await expect(reconciler.reconcile()).resolves.toBeUndefined();
    expect(metrics.persistentOfflineReconcileFailures.inc).toHaveBeenCalledTimes(1);
    // A silent failure here is indistinguishable from a healthy fleet.
    expect(error.mock.calls[0][0]).toMatch(/stale/i);
    expect(error.mock.calls[0][0]).toContain('database is down');
  });
});
