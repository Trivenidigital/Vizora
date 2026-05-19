import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlertRulesService } from './alert-rules.service';
import { DatabaseService } from '../../database/database.service';
import { DEDUP_WINDOW_MS, MIN_OFFLINE_SEC_FLOOR } from './alert-rule.types';

describe('AlertRulesService', () => {
  let service: AlertRulesService;
  let db: any;

  const orgId = 'org-123';
  const otherOrgId = 'org-other';

  beforeEach(() => {
    db = {
      alertRule: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      alertRuleRecipient: {
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      tag: {
        findFirst: jest.fn(),
      },
      displayGroup: {
        findFirst: jest.fn(),
      },
      display: {
        findFirst: jest.fn(),
      },
    };
    service = new AlertRulesService(db as unknown as DatabaseService);
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    const baseDto = {
      name: 'Lobby offline alert',
      triggerEvent: 'device.offline' as const,
      scope: 'all' as const,
      recipients: [{ channel: 'in_app' as const, target: 'user-1' }],
    };

    it('creates a rule with one in_app recipient when target user is in the same org', async () => {
      db.user.findFirst.mockResolvedValue({ id: 'user-1', organizationId: orgId });
      db.alertRule.create.mockResolvedValue({ id: 'rule-1', ...baseDto, organizationId: orgId });

      await service.create(orgId, baseDto);

      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', organizationId: orgId },
      });
      expect(db.alertRule.create).toHaveBeenCalledTimes(1);
    });

    it('rejects in_app recipient whose target user is in another org (cross-tenant guard)', async () => {
      db.user.findFirst.mockResolvedValue(null); // user-from-other-org NOT found in our org

      await expect(service.create(orgId, baseDto)).rejects.toThrow(ForbiddenException);
      expect(db.alertRule.create).not.toHaveBeenCalled();
    });

    it('rejects scope=tag when scopeTagId does not exist in the org', async () => {
      db.tag.findFirst.mockResolvedValue(null);

      await expect(
        service.create(orgId, {
          ...baseDto,
          scope: 'tag',
          scopeTagId: 'tag-doesnt-exist',
          recipients: [{ channel: 'email', target: 'a@b.com' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('accepts scope=tag when Tag exists in the org', async () => {
      db.tag.findFirst.mockResolvedValue({ id: 'tag-1', organizationId: orgId });
      db.alertRule.create.mockResolvedValue({ id: 'rule-1' });

      await service.create(orgId, {
        ...baseDto,
        scope: 'tag',
        scopeTagId: 'tag-1',
        recipients: [{ channel: 'email', target: 'a@b.com' }],
      });

      expect(db.alertRule.create).toHaveBeenCalledTimes(1);
    });

    it('rejects slack_webhook with non-Slack URL at the service layer (belt-and-braces)', async () => {
      await expect(
        service.create(orgId, {
          ...baseDto,
          recipients: [{ channel: 'slack_webhook', target: 'http://internal/foo' }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('clears scope FKs that do not match the chosen scope (only the matching FK is persisted)', async () => {
      db.tag.findFirst.mockResolvedValue({ id: 'tag-1', organizationId: orgId });
      db.alertRule.create.mockResolvedValue({ id: 'rule-1' });

      await service.create(orgId, {
        ...baseDto,
        scope: 'tag',
        scopeTagId: 'tag-1',
        scopeGroupId: 'group-stale',     // should be ignored
        scopeDisplayId: 'display-stale', // should be ignored
        recipients: [{ channel: 'email', target: 'a@b.com' }],
      });

      const dataArg = db.alertRule.create.mock.calls[0][0].data;
      expect(dataArg.scopeTagId).toBe('tag-1');
      expect(dataArg.scopeGroupId).toBeNull();
      expect(dataArg.scopeDisplayId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne / cross-org
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('returns the rule when it exists and belongs to the org', async () => {
      db.alertRule.findFirst.mockResolvedValue({ id: 'rule-1', organizationId: orgId });
      await expect(service.findOne(orgId, 'rule-1')).resolves.toEqual(
        expect.objectContaining({ id: 'rule-1' }),
      );
    });

    it('throws NotFoundException when rule belongs to another org (no leakage of existence)', async () => {
      db.alertRule.findFirst.mockResolvedValue(null); // findFirst filters by orgId
      await expect(service.findOne(orgId, 'rule-other-org')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException on cross-org PATCH', async () => {
      db.alertRule.findFirst.mockResolvedValue(null);
      await expect(service.update(orgId, 'rule-x', { name: 'new' })).rejects.toThrow(NotFoundException);
      expect(db.alertRule.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException on cross-org DELETE', async () => {
      db.alertRule.findFirst.mockResolvedValue(null);
      await expect(service.remove(orgId, 'rule-x')).rejects.toThrow(NotFoundException);
      expect(db.alertRule.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // addRecipient — cross-tenant in_app guard
  // ---------------------------------------------------------------------------
  describe('addRecipient', () => {
    beforeEach(() => {
      db.alertRule.findFirst.mockResolvedValue({ id: 'rule-1', organizationId: orgId });
    });

    it('adds an in_app recipient whose target user is in the same org', async () => {
      db.user.findFirst.mockResolvedValue({ id: 'user-1', organizationId: orgId });
      db.alertRuleRecipient.create.mockResolvedValue({ id: 'rec-1' });

      await service.addRecipient(orgId, 'rule-1', { channel: 'in_app', target: 'user-1' });

      expect(db.alertRuleRecipient.create).toHaveBeenCalledTimes(1);
    });

    it('REJECTS in_app recipient whose target userId belongs to another org', async () => {
      db.user.findFirst.mockResolvedValue(null); // userId not found in THIS org

      await expect(
        service.addRecipient(orgId, 'rule-1', { channel: 'in_app', target: 'user-from-other-org' }),
      ).rejects.toThrow(ForbiddenException);
      expect(db.alertRuleRecipient.create).not.toHaveBeenCalled();
    });
  });

  describe('removeRecipient', () => {
    it('throws NotFoundException when the rule does not belong to the caller org', async () => {
      db.alertRule.findFirst.mockResolvedValue(null);
      await expect(service.removeRecipient(orgId, 'rule-x', 'rec-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the recipient is not on the named rule', async () => {
      db.alertRule.findFirst.mockResolvedValue({ id: 'rule-1', organizationId: orgId });
      db.alertRuleRecipient.findFirst.mockResolvedValue(null);
      await expect(service.removeRecipient(orgId, 'rule-1', 'rec-not-here')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // findActiveForEvent — evaluator query
  // ---------------------------------------------------------------------------
  describe('findActiveForEvent', () => {
    it('queries with isActive=true AND triggerEvent filter, including recipients', async () => {
      db.alertRule.findMany.mockResolvedValue([]);
      await service.findActiveForEvent(orgId, 'device.offline');
      expect(db.alertRule.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, triggerEvent: 'device.offline', isActive: true },
        include: { recipients: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // tryClaimDedupWindow — atomic CAS
  // ---------------------------------------------------------------------------
  describe('tryClaimDedupWindow', () => {
    it('returns true when updateMany reports count=1 (we claimed the window)', async () => {
      db.alertRule.updateMany.mockResolvedValue({ count: 1 });
      const claimed = await service.tryClaimDedupWindow('rule-1', new Date('2026-05-19T10:00:00Z'));
      expect(claimed).toBe(true);
    });

    it('returns false when updateMany reports count=0 (another instance won)', async () => {
      db.alertRule.updateMany.mockResolvedValue({ count: 0 });
      const claimed = await service.tryClaimDedupWindow('rule-1', new Date('2026-05-19T10:00:00Z'));
      expect(claimed).toBe(false);
    });

    it('predicate excludes rows that fired within the 15-min window', async () => {
      db.alertRule.updateMany.mockResolvedValue({ count: 1 });
      const now = new Date('2026-05-19T10:00:00Z');
      await service.tryClaimDedupWindow('rule-1', now);

      const whereArg = db.alertRule.updateMany.mock.calls[0][0].where;
      expect(whereArg.id).toBe('rule-1');
      // OR clause should let us claim if lastFiredAt is null OR older than the window
      expect(whereArg.OR).toHaveLength(2);
      const ltCondition = whereArg.OR.find((c: any) => c.lastFiredAt?.lt);
      expect(ltCondition.lastFiredAt.lt).toEqual(new Date(now.getTime() - DEDUP_WINDOW_MS));
    });
  });

  // ---------------------------------------------------------------------------
  // Constants regression
  // ---------------------------------------------------------------------------
  describe('constants', () => {
    it('MIN_OFFLINE_SEC_FLOOR matches the stale-heartbeat cron threshold (2 min = 120s)', () => {
      expect(MIN_OFFLINE_SEC_FLOOR).toBe(120);
    });

    it('DEDUP_WINDOW_MS is 15 minutes', () => {
      expect(DEDUP_WINDOW_MS).toBe(15 * 60 * 1000);
    });
  });
});
