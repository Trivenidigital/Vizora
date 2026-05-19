import { ForbiddenException, GatewayTimeoutException, NotFoundException } from '@nestjs/common';
import { TagRulesService } from './tag-rules.service';
import { DatabaseService } from '../database/database.service';
import { REEVAL_TIMEOUT_MS } from './tag-rule.types';

describe('TagRulesService', () => {
  let service: TagRulesService;
  let db: any;
  let events: any;

  const orgId = 'org-123';
  const tagId = 'tag-1';
  const playlistId = 'playlist-1';

  beforeEach(() => {
    db = {
      tagAssignmentRule: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tag: { findFirst: jest.fn() },
      playlist: { findFirst: jest.fn() },
      display: { findFirst: jest.fn(), updateMany: jest.fn() },
      displayTag: { findMany: jest.fn() },
    };
    events = { emit: jest.fn() };
    service = new TagRulesService(db as unknown as DatabaseService, events);
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const baseDto = { name: 'lobby auto', tagId, playlistId };

    it('happy path — creates the rule with defaults + sweeps the tag', async () => {
      db.tag.findFirst.mockResolvedValue({ id: tagId, organizationId: orgId });
      db.playlist.findFirst.mockResolvedValue({ id: playlistId, organizationId: orgId });
      db.tagAssignmentRule.create.mockResolvedValue({ id: 'rule-1', tagId, organizationId: orgId, isActive: true });
      db.displayTag.findMany.mockResolvedValue([]); // no tagged displays — sweep is no-op

      await service.create(orgId, baseDto);

      expect(db.tagAssignmentRule.create).toHaveBeenCalledTimes(1);
      expect(db.displayTag.findMany).toHaveBeenCalledTimes(1); // sweep ran
    });

    it('rejects tagId from another org (cross-tenant guard)', async () => {
      db.tag.findFirst.mockResolvedValue(null); // tag not in caller's org
      await expect(service.create(orgId, baseDto)).rejects.toThrow(ForbiddenException);
      expect(db.tagAssignmentRule.create).not.toHaveBeenCalled();
    });

    it('rejects playlistId from another org (cross-tenant guard)', async () => {
      db.tag.findFirst.mockResolvedValue({ id: tagId, organizationId: orgId });
      db.playlist.findFirst.mockResolvedValue(null); // playlist not in caller's org
      await expect(service.create(orgId, baseDto)).rejects.toThrow(ForbiddenException);
      expect(db.tagAssignmentRule.create).not.toHaveBeenCalled();
    });

    it('skips sweep when isActive=false', async () => {
      db.tag.findFirst.mockResolvedValue({ id: tagId, organizationId: orgId });
      db.playlist.findFirst.mockResolvedValue({ id: playlistId, organizationId: orgId });
      db.tagAssignmentRule.create.mockResolvedValue({ id: 'rule-1', tagId, organizationId: orgId, isActive: false });

      await service.create(orgId, { ...baseDto, isActive: false });

      expect(db.displayTag.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne / cross-org
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('returns the rule when in the caller org', async () => {
      db.tagAssignmentRule.findFirst.mockResolvedValue({ id: 'rule-1', organizationId: orgId });
      await expect(service.findOne(orgId, 'rule-1')).resolves.toEqual(expect.objectContaining({ id: 'rule-1' }));
    });

    it('throws NotFound when rule belongs to another org', async () => {
      db.tagAssignmentRule.findFirst.mockResolvedValue(null);
      await expect(service.findOne(orgId, 'rule-foreign')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const before = { id: 'rule-1', organizationId: orgId, name: 'old', tagId, playlistId, isActive: true, priority: 100 };

    beforeEach(() => {
      db.tagAssignmentRule.findFirst.mockResolvedValue(before);
      db.displayTag.findMany.mockResolvedValue([]);
    });

    it('throws NotFound on cross-org PATCH', async () => {
      db.tagAssignmentRule.findFirst.mockResolvedValue(null);
      await expect(service.update(orgId, 'rule-x', { name: 'y' })).rejects.toThrow(NotFoundException);
      expect(db.tagAssignmentRule.update).not.toHaveBeenCalled();
    });

    it('priority-only update STILL triggers a sweep (PR-review fix)', async () => {
      db.tagAssignmentRule.update.mockResolvedValue({ ...before, priority: 50 });
      await service.update(orgId, 'rule-1', { priority: 50 });
      expect(db.displayTag.findMany).toHaveBeenCalledTimes(1); // sweep ran
    });

    it('name-only update does NOT trigger sweep (cosmetic)', async () => {
      db.tagAssignmentRule.update.mockResolvedValue({ ...before, name: 'renamed' });
      await service.update(orgId, 'rule-1', { name: 'renamed' });
      expect(db.displayTag.findMany).not.toHaveBeenCalled();
    });

    it('tagId change sweeps BOTH the old tag (if active) and the new tag', async () => {
      db.tag.findFirst.mockResolvedValue({ id: 'tag-NEW', organizationId: orgId });
      db.tagAssignmentRule.update.mockResolvedValue({ ...before, tagId: 'tag-NEW' });
      await service.update(orgId, 'rule-1', { tagId: 'tag-NEW' });
      expect(db.displayTag.findMany).toHaveBeenCalledTimes(2); // old tag + new tag
    });

    it('isActive false→true triggers sweep', async () => {
      const beforeInactive = { ...before, isActive: false };
      db.tagAssignmentRule.findFirst.mockResolvedValue(beforeInactive);
      db.tagAssignmentRule.update.mockResolvedValue({ ...beforeInactive, isActive: true });
      await service.update(orgId, 'rule-1', { isActive: true });
      expect(db.displayTag.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('throws NotFound on cross-org DELETE', async () => {
      db.tagAssignmentRule.findFirst.mockResolvedValue(null);
      await expect(service.remove(orgId, 'rule-x')).rejects.toThrow(NotFoundException);
      expect(db.tagAssignmentRule.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // evaluateForDisplay
  // ---------------------------------------------------------------------------
  describe('evaluateForDisplay', () => {
    const displayId = 'display-1';

    it('skips when display does not exist in this org', async () => {
      db.display.findFirst.mockResolvedValue(null);
      const result = await service.evaluateForDisplay(orgId, displayId);
      expect(result).toBe(false);
    });

    it('skips when currentPlaylistId is already set (first-write-wins)', async () => {
      db.display.findFirst.mockResolvedValue({ id: displayId, currentPlaylistId: 'manual-X', tags: [{ tagId }] });
      const result = await service.evaluateForDisplay(orgId, displayId);
      expect(result).toBe(false);
      expect(db.display.updateMany).not.toHaveBeenCalled();
    });

    it('skips when display has no tags', async () => {
      db.display.findFirst.mockResolvedValue({ id: displayId, currentPlaylistId: null, tags: [] });
      const result = await service.evaluateForDisplay(orgId, displayId);
      expect(result).toBe(false);
    });

    it('picks lowest priority rule (tie broken by oldest createdAt)', async () => {
      db.display.findFirst.mockResolvedValue({ id: displayId, currentPlaylistId: null, tags: [{ tagId }] });
      db.tagAssignmentRule.findMany.mockResolvedValue([
        // findMany already returns in [priority ASC, createdAt ASC] order via orderBy
        { id: 'rule-high', tagId, playlistId: 'p-high', priority: 10 },
        { id: 'rule-low', tagId, playlistId: 'p-low', priority: 100 },
      ]);
      db.display.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.evaluateForDisplay(orgId, displayId);

      expect(result).toBe(true);
      expect(db.display.updateMany).toHaveBeenCalledWith({
        where: { id: displayId, organizationId: orgId, currentPlaylistId: null },
        data: { currentPlaylistId: 'p-high' },
      });
    });

    it('skips a rule whose playlistId is null (post-SetNull) and falls through to next', async () => {
      db.display.findFirst.mockResolvedValue({ id: displayId, currentPlaylistId: null, tags: [{ tagId }] });
      db.tagAssignmentRule.findMany.mockResolvedValue([
        { id: 'rule-broken', tagId, playlistId: null, priority: 10 }, // playlist deleted
        { id: 'rule-ok', tagId, playlistId: 'p-good', priority: 50 },
      ]);
      db.display.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.evaluateForDisplay(orgId, displayId);

      expect(result).toBe(true);
      expect(db.display.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { currentPlaylistId: 'p-good' },
        }),
      );
    });

    it('returns false when updateMany predicate misses (another writer won)', async () => {
      db.display.findFirst.mockResolvedValue({ id: displayId, currentPlaylistId: null, tags: [{ tagId }] });
      db.tagAssignmentRule.findMany.mockResolvedValue([
        { id: 'rule-1', tagId, playlistId, priority: 50 },
      ]);
      db.display.updateMany.mockResolvedValue({ count: 0 }); // raced and lost

      const result = await service.evaluateForDisplay(orgId, displayId);

      expect(result).toBe(false);
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('emits display.playlist.assigned event on success with source=tag_rule', async () => {
      db.display.findFirst.mockResolvedValue({ id: displayId, currentPlaylistId: null, tags: [{ tagId }] });
      db.tagAssignmentRule.findMany.mockResolvedValue([
        { id: 'rule-1', tagId, playlistId, priority: 50 },
      ]);
      db.display.updateMany.mockResolvedValue({ count: 1 });

      await service.evaluateForDisplay(orgId, displayId);

      expect(events.emit).toHaveBeenCalledWith('display.playlist.assigned', {
        organizationId: orgId,
        displayId,
        playlistId,
        ruleId: 'rule-1',
        source: 'tag_rule',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // reEvaluateRule (POST :id/re-evaluate)
  // ---------------------------------------------------------------------------
  describe('reEvaluateRule', () => {
    it('throws GatewayTimeoutException with partial counts when sweep exceeds REEVAL_TIMEOUT_MS', async () => {
      db.tagAssignmentRule.findFirst.mockResolvedValue({ id: 'rule-1', organizationId: orgId, tagId, isActive: true });
      db.displayTag.findMany.mockResolvedValue([
        { displayId: 'd1' },
        { displayId: 'd2' },
        { displayId: 'd3' },
      ]);
      // Each evaluateForDisplay returns quickly with no work
      db.display.findFirst.mockResolvedValue(null);

      // Mock Date.now to step past the threshold on the second access (inside the loop)
      const start = 1_000_000;
      let calls = 0;
      const spy = jest.spyOn(Date, 'now').mockImplementation(() => {
        calls++;
        // First call (loop init) sees start; subsequent calls are post-timeout
        return calls === 1 ? start : start + REEVAL_TIMEOUT_MS + 1000;
      });

      try {
        await expect(service.reEvaluateRule(orgId, 'rule-1')).rejects.toThrow(GatewayTimeoutException);
      } finally {
        spy.mockRestore();
      }
    });

    it('GatewayTimeoutException response carries { scanned, assigned, total } partial counts', async () => {
      db.tagAssignmentRule.findFirst.mockResolvedValue({ id: 'rule-1', organizationId: orgId, tagId, isActive: true });
      db.displayTag.findMany.mockResolvedValue([
        { displayId: 'd1' },
        { displayId: 'd2' },
        { displayId: 'd3' },
      ]);
      db.display.findFirst.mockResolvedValue(null);

      const start = 1_000_000;
      let calls = 0;
      const spy = jest.spyOn(Date, 'now').mockImplementation(() => {
        calls++;
        return calls === 1 ? start : start + REEVAL_TIMEOUT_MS + 1000;
      });

      try {
        try {
          await service.reEvaluateRule(orgId, 'rule-1');
          fail('Expected GatewayTimeoutException');
        } catch (err) {
          expect(err).toBeInstanceOf(GatewayTimeoutException);
          const body = (err as GatewayTimeoutException).getResponse() as Record<string, unknown>;
          expect(body).toMatchObject({
            scanned: expect.any(Number),
            assigned: expect.any(Number),
            total: 3,
          });
        }
      } finally {
        spy.mockRestore();
      }
    });

    it('returns { scanned: 0, assigned: 0 } when the rule is inactive (no sweep)', async () => {
      db.tagAssignmentRule.findFirst.mockResolvedValue({ id: 'rule-1', organizationId: orgId, tagId, isActive: false });
      const result = await service.reEvaluateRule(orgId, 'rule-1');
      expect(result).toEqual({ scanned: 0, assigned: 0 });
      expect(db.displayTag.findMany).not.toHaveBeenCalled();
    });
  });
});
