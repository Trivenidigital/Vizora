import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import {
  AgentRunsService,
  computeCostMicrodollars,
} from './agent-runs.service';
import { DatabaseService } from '../database/database.service';

describe('computeCostMicrodollars (pure helper)', () => {
  it('returns null when any input is missing', () => {
    expect(computeCostMicrodollars(undefined, 100, 0.15, 0.6)).toBeNull();
    expect(computeCostMicrodollars(100, undefined, 0.15, 0.6)).toBeNull();
    expect(computeCostMicrodollars(100, 100, undefined, 0.6)).toBeNull();
    expect(computeCostMicrodollars(100, 100, 0.15, undefined)).toBeNull();
  });

  it('matches the design example: 5000 in × 0.15 + 800 out × 0.60 = 1230 microdollars', () => {
    expect(computeCostMicrodollars(5000, 800, 0.15, 0.6)).toBe(1230);
  });

  it('rounds to nearest microdollar', () => {
    // 333 × 0.15 = 49.95 ; 333 × 0.6 = 199.8 ; sum = 249.75 → round → 250.
    expect(computeCostMicrodollars(333, 333, 0.15, 0.6)).toBe(250);
  });

  it('handles zero tokens cleanly', () => {
    expect(computeCostMicrodollars(0, 0, 0.15, 0.6)).toBe(0);
  });
});

describe('AgentRunsService', () => {
  let service: AgentRunsService;
  let db: {
    agentRun: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      aggregate: jest.Mock;
    };
  };

  beforeEach(async () => {
    db = {
      agentRun: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        AgentRunsService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = mod.get(AgentRunsService);
  });

  describe('recordRun', () => {
    it('persists a row with computed durationMs and returns its id', async () => {
      db.agentRun.create.mockResolvedValue({ id: 'cuid_r1' });
      const startedAt = '2026-05-08T10:00:00.000Z';
      const finishedAt = '2026-05-08T10:00:30.000Z';
      const result = await service.recordRun({
        skillName: 'vizora-customer-lifecycle',
        startedAt,
        finishedAt,
        exitCode: 0,
        outcome: 'success',
      });
      expect(result.id).toBe('cuid_r1');
      expect(db.agentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          skillName: 'vizora-customer-lifecycle',
          startedAt: new Date(startedAt),
          finishedAt: new Date(finishedAt),
          durationMs: 30000,
          outcome: 'success',
          // Cost / tokens / model NOT written here — sidecar fills them later.
        }),
        select: { id: true },
      });
      // Sanity: cost columns are absent from the create payload.
      const createArgs = db.agentRun.create.mock.calls[0][0].data;
      expect(createArgs.tokensIn).toBeUndefined();
      expect(createArgs.costMicrodollars).toBeNull();
    });

    it('truncates errorExcerpt to 1024 chars', async () => {
      db.agentRun.create.mockResolvedValue({ id: 'cuid_r2' });
      await service.recordRun({
        skillName: 'vizora-test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 1,
        outcome: 'api_error',
        errorExcerpt: 'X'.repeat(2000),
      });
      const passed = db.agentRun.create.mock.calls[0][0].data.errorExcerpt;
      expect(passed.length).toBe(1024);
    });

    it('persists budget_aborted with no exitCode override (caller sends 0)', async () => {
      db.agentRun.create.mockResolvedValue({ id: 'cuid_r3' });
      await service.recordRun({
        skillName: 'vizora-test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        outcome: 'budget_aborted',
        preflightBalanceUsd: 0.05,
      });
      expect(db.agentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcome: 'budget_aborted',
          preflightBalanceUsd: 0.05,
        }),
        select: { id: true },
      });
    });

    it('persists runner-measured costMicrodollars when supplied at record time', async () => {
      db.agentRun.create.mockResolvedValue({ id: 'cuid_cost' });
      await service.recordRun({
        skillName: 'vizora-costed',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        outcome: 'success',
        preflightBalanceUsd: 1.23456789,
        costMicrodollars: 1800,
      });

      expect(db.agentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          costMicrodollars: 1800,
          preflightBalanceUsd: 1.23456789,
        }),
        select: { id: true },
      });
    });
  });

  describe('enrichRun', () => {
    it('throws NotFoundException when id is unknown', async () => {
      db.agentRun.findUnique.mockResolvedValue(null);
      await expect(
        service.enrichRun('missing', { tokensIn: 1, tokensOut: 1, model: 'openai/gpt-4o-mini' }),
      ).rejects.toThrow(NotFoundException);
      expect(db.agentRun.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when row is past 5-min freeze window', async () => {
      const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);
      db.agentRun.findUnique.mockResolvedValue({
        id: 'r1',
        finishedAt: sixMinAgo,
        enrichedAt: null,
      });
      await expect(
        service.enrichRun('r1', { tokensIn: 100, tokensOut: 50, model: 'openai/gpt-4o-mini' }),
      ).rejects.toThrow(ConflictException);
      expect(db.agentRun.updateMany).not.toHaveBeenCalled();
    });

    it('writes cost + rate snapshot + enrichedAt when model is in MODEL_RATES', async () => {
      const recent = new Date(Date.now() - 30 * 1000);
      db.agentRun.findUnique.mockResolvedValue({ id: 'r2', finishedAt: recent, enrichedAt: null });
      db.agentRun.updateMany.mockResolvedValue({ count: 1 });
      const out = await service.enrichRun('r2', {
        tokensIn: 5000,
        tokensOut: 800,
        model: 'openai/gpt-4o-mini',
      });
      expect(out).toEqual({ id: 'r2', enriched: true });
      expect(db.agentRun.updateMany).toHaveBeenCalledWith({
        where: { id: 'r2', enrichedAt: null },
        data: expect.objectContaining({
          tokensIn: 5000,
          tokensOut: 800,
          model: 'openai/gpt-4o-mini',
          rateInUsdPerMt: 0.15,
          rateOutUsdPerMt: 0.6,
          costMicrodollars: 1230,
          enrichedAt: expect.any(Date),
        }),
      });
    });

    it('returns enriched=false when MVCC race loses (count=0)', async () => {
      const recent = new Date(Date.now() - 30 * 1000);
      db.agentRun.findUnique.mockResolvedValue({ id: 'r3', finishedAt: recent, enrichedAt: null });
      db.agentRun.updateMany.mockResolvedValue({ count: 0 });
      const out = await service.enrichRun('r3', {
        tokensIn: 100,
        tokensOut: 50,
        model: 'openai/gpt-4o-mini',
      });
      expect(out).toEqual({ id: 'r3', enriched: false });
    });

    it('writes null cost when model is unknown (rate not in table)', async () => {
      const recent = new Date(Date.now() - 30 * 1000);
      db.agentRun.findUnique.mockResolvedValue({ id: 'r4', finishedAt: recent, enrichedAt: null });
      db.agentRun.updateMany.mockResolvedValue({ count: 1 });
      await service.enrichRun('r4', {
        tokensIn: 100,
        tokensOut: 50,
        model: 'mystery/model-future',
      });
      expect(db.agentRun.updateMany).toHaveBeenCalledWith({
        where: { id: 'r4', enrichedAt: null },
        data: expect.objectContaining({
          model: 'mystery/model-future',
          rateInUsdPerMt: null,
          rateOutUsdPerMt: null,
          costMicrodollars: null,
        }),
      });
    });

    it('honors agent-supplied rate override even when model is in MODEL_RATES', async () => {
      // The sidecar may pass explicit rates from `hermes insights` (which
      // already accounts for prompt caching, etc.) — those win over MODEL_RATES.
      const recent = new Date(Date.now() - 30 * 1000);
      db.agentRun.findUnique.mockResolvedValue({ id: 'r5', finishedAt: recent, enrichedAt: null });
      db.agentRun.updateMany.mockResolvedValue({ count: 1 });
      await service.enrichRun('r5', {
        tokensIn: 1000,
        tokensOut: 100,
        model: 'openai/gpt-4o-mini',
        rateInUsdPerMt: 0.075, // 50% prompt-cache discount
        rateOutUsdPerMt: 0.6,
      });
      expect(db.agentRun.updateMany).toHaveBeenCalledWith({
        where: { id: 'r5', enrichedAt: null },
        data: expect.objectContaining({
          rateInUsdPerMt: 0.075,
          rateOutUsdPerMt: 0.6,
          costMicrodollars: 135, // 1000 × 0.075 + 100 × 0.6 = 75 + 60 = 135
        }),
      });
    });

    it('applies outcomeRefinement when sidecar downgrades success → tool_error', async () => {
      const recent = new Date(Date.now() - 30 * 1000);
      db.agentRun.findUnique.mockResolvedValue({ id: 'r6', finishedAt: recent, enrichedAt: null });
      db.agentRun.updateMany.mockResolvedValue({ count: 1 });
      await service.enrichRun('r6', {
        tokensIn: 100,
        tokensOut: 50,
        model: 'openai/gpt-4o-mini',
        outcomeRefinement: 'tool_error',
      });
      expect(db.agentRun.updateMany).toHaveBeenCalledWith({
        where: { id: 'r6', enrichedAt: null },
        data: expect.objectContaining({ outcome: 'tool_error' }),
      });
    });

    it('REGRESSION (PR-review R1 I3): outcome-only refinement with no token data sets enrichedAt and is idempotent', async () => {
      // Bug: previous predicate `tokensIn IS NULL` failed for outcome-only
      // PATCHes — they wrote tokensIn: null again, leaving the predicate true.
      // Fix: enrichedAt set on first PATCH; subsequent PATCHes find it non-null
      // and the predicate fails (count=0, treated as benign no-op).
      const recent = new Date(Date.now() - 30 * 1000);
      db.agentRun.findUnique.mockResolvedValue({ id: 'r7', finishedAt: recent, enrichedAt: null });
      db.agentRun.updateMany.mockResolvedValue({ count: 1 });
      // First call: outcome refinement only, no token data.
      await service.enrichRun('r7', { outcomeRefinement: 'no_work' });
      expect(db.agentRun.updateMany).toHaveBeenCalledWith({
        where: { id: 'r7', enrichedAt: null },
        data: expect.objectContaining({
          outcome: 'no_work',
          enrichedAt: expect.any(Date),
          tokensIn: null,
          tokensOut: null,
        }),
      });
    });

    it('REGRESSION (PR-review R1 I6): omitted outcomeRefinement does NOT include outcome key in update data', async () => {
      // Bug: relying on Prisma's "undefined key omits field" was implicit.
      // Fix: conditional spread — outcome is only in data if outcomeRefinement
      // is non-null.
      const recent = new Date(Date.now() - 30 * 1000);
      db.agentRun.findUnique.mockResolvedValue({ id: 'r8', finishedAt: recent, enrichedAt: null });
      db.agentRun.updateMany.mockResolvedValue({ count: 1 });
      await service.enrichRun('r8', { tokensIn: 100, tokensOut: 50 });
      const dataArg = db.agentRun.updateMany.mock.calls[0][0].data;
      expect('outcome' in dataArg).toBe(false);
    });

    it('preserves runner-measured cost when sidecar has no token-derived cost', async () => {
      const recent = new Date(Date.now() - 30 * 1000);
      db.agentRun.findUnique.mockResolvedValue({
        id: 'r-cost',
        finishedAt: recent,
        enrichedAt: null,
        costMicrodollars: 1800,
      });
      db.agentRun.updateMany.mockResolvedValue({ count: 1 });

      await service.enrichRun('r-cost', { outcomeRefinement: 'no_work' });

      const dataArg = db.agentRun.updateMany.mock.calls[0][0].data;
      expect('costMicrodollars' in dataArg).toBe(false);
      expect(dataArg).toEqual(expect.objectContaining({ outcome: 'no_work' }));
    });
  });

  describe('getTodaySpendUsd', () => {
    it('sums costMicrodollars for the current UTC day and converts to USD', async () => {
      db.agentRun.aggregate.mockResolvedValue({
        _sum: { costMicrodollars: 2_500_000 }, // $2.50
      });
      const usd = await service.getTodaySpendUsd();
      expect(usd).toBe(2.5);
      // Verify the aggregate query targets startOfUtcDay correctly.
      const args = db.agentRun.aggregate.mock.calls[0][0];
      expect(args._sum).toEqual({ costMicrodollars: true });
      const cutoff = args.where.startedAt.gte as Date;
      expect(cutoff.getUTCHours()).toBe(0);
      expect(cutoff.getUTCMinutes()).toBe(0);
      expect(cutoff.getUTCSeconds()).toBe(0);
    });

    it('returns 0 when no rows match (null sum)', async () => {
      db.agentRun.aggregate.mockResolvedValue({ _sum: { costMicrodollars: null } });
      const usd = await service.getTodaySpendUsd();
      expect(usd).toBe(0);
    });
  });

  describe('sweepOrphans', () => {
    it('marks rows older than 10 minutes as runner_crash and sets enrichedAt', async () => {
      db.agentRun.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.sweepOrphans();
      expect(result.marked).toBe(3);
      const args = db.agentRun.updateMany.mock.calls[0][0];
      expect(args.where).toEqual(
        expect.objectContaining({
          enrichedAt: null,
          createdAt: { lt: expect.any(Date) },
          outcome: { notIn: ['runner_crash', 'budget_aborted'] },
        }),
      );
      expect(args.data).toEqual(
        expect.objectContaining({
          outcome: 'runner_crash',
          errorExcerpt: expect.stringContaining('orphan'),
          // Sweep also marks enrichedAt to prevent re-orphan-sweeping.
          enrichedAt: expect.any(Date),
        }),
      );
      // Cutoff should be ~10 min in the past.
      const cutoff = args.where.createdAt.lt as Date;
      const ageMs = Date.now() - cutoff.getTime();
      expect(ageMs).toBeGreaterThanOrEqual(10 * 60 * 1000 - 1000);
      expect(ageMs).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
    });

    it('returns 0 when no orphans found', async () => {
      db.agentRun.updateMany.mockResolvedValue({ count: 0 });
      expect((await service.sweepOrphans()).marked).toBe(0);
    });
  });

  describe('recordRun + callerType (PR-review R2 I5)', () => {
    it('persists callerType when provided by guard', async () => {
      db.agentRun.create.mockResolvedValue({ id: 'cuid_r9' });
      await service.recordRun(
        {
          skillName: 'vizora-test',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          exitCode: 0,
          outcome: 'success',
        },
        'sidecar',
      );
      expect(db.agentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ callerType: 'sidecar' }),
        select: { id: true },
      });
    });

    it('persists callerType=null when omitted (no guard, e.g., older callers)', async () => {
      db.agentRun.create.mockResolvedValue({ id: 'cuid_r10' });
      await service.recordRun({
        skillName: 'vizora-test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        outcome: 'success',
      });
      expect(db.agentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ callerType: null }),
        select: { id: true },
      });
    });
  });
});
