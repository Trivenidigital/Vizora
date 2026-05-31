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
      alertRuleFire: {
        create: jest.fn(),
        updateMany: jest.fn(),
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
  // tryClaimDedupWindow — atomic CAS, per-(rule, device)
  // ---------------------------------------------------------------------------
  describe('tryClaimDedupWindow', () => {
    const ruleId = 'rule-1';
    const deviceA = 'device-A';
    const deviceB = 'device-B';
    const now = new Date('2026-05-19T10:00:00Z');

    it('updateMany count=1 (existing stale row claimed) → returns true', async () => {
      db.alertRuleFire.updateMany.mockResolvedValue({ count: 1 });

      const claimed = await service.tryClaimDedupWindow(ruleId, deviceA, now);

      expect(claimed).toBe(true);
      expect(db.alertRuleFire.create).not.toHaveBeenCalled();
    });

    it('updateMany count=0 AND create succeeds (no prior row) → returns true', async () => {
      db.alertRuleFire.updateMany.mockResolvedValue({ count: 0 });
      db.alertRuleFire.create.mockResolvedValue({ id: 'fire-1' });

      const claimed = await service.tryClaimDedupWindow(ruleId, deviceA, now);

      expect(claimed).toBe(true);
      expect(db.alertRuleFire.create).toHaveBeenCalledWith({
        data: { alertRuleId: ruleId, deviceId: deviceA, lastFiredAt: now },
      });
    });

    it('updateMany count=0 AND create throws P2002 (lost race / fresh row) → returns false', async () => {
      db.alertRuleFire.updateMany.mockResolvedValue({ count: 0 });
      const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      db.alertRuleFire.create.mockRejectedValue(p2002);

      const claimed = await service.tryClaimDedupWindow(ruleId, deviceA, now);

      expect(claimed).toBe(false);
    });

    it('updateMany count=0 AND create throws non-P2002 → re-throws (real error)', async () => {
      db.alertRuleFire.updateMany.mockResolvedValue({ count: 0 });
      db.alertRuleFire.create.mockRejectedValue(new Error('connection refused'));

      await expect(service.tryClaimDedupWindow(ruleId, deviceA, now)).rejects.toThrow(
        'connection refused',
      );
    });

    it('claims are independent per (rule, device) — same rule, two devices both claim', async () => {
      db.alertRuleFire.updateMany.mockResolvedValueOnce({ count: 1 });
      const claimedA = await service.tryClaimDedupWindow(ruleId, deviceA, now);

      db.alertRuleFire.updateMany.mockResolvedValueOnce({ count: 0 });
      db.alertRuleFire.create.mockResolvedValueOnce({ id: 'fire-B' });
      const claimedB = await service.tryClaimDedupWindow(ruleId, deviceB, now);

      expect(claimedA).toBe(true);
      expect(claimedB).toBe(true);
    });

    it('updateMany predicate uses lastFiredAt < (now - DEDUP_WINDOW_MS)', async () => {
      db.alertRuleFire.updateMany.mockResolvedValue({ count: 1 });

      await service.tryClaimDedupWindow(ruleId, deviceA, now);

      const where = db.alertRuleFire.updateMany.mock.calls[0][0].where;
      expect(where.alertRuleId).toBe(ruleId);
      expect(where.deviceId).toBe(deviceA);
      expect(where.lastFiredAt.lt).toEqual(new Date(now.getTime() - DEDUP_WINDOW_MS));
    });
  });

  // ---------------------------------------------------------------------------
  // seedDefaultRuleForOrg — used by post-migration script AND by AuthService
  // for new-org auto-seeding. Idempotent.
  // ---------------------------------------------------------------------------
  describe('seedDefaultRuleForOrg', () => {
    it('creates a default rule with one in_app recipient per admin', async () => {
      db.alertRule.create.mockResolvedValue({ id: 'rule-1' });

      await service.seedDefaultRuleForOrg(orgId, ['admin-1', 'admin-2']);

      expect(db.alertRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgId,
          name: 'Default offline alert (auto-migrated)',
          triggerEvent: 'device.offline',
          isActive: true,
          scope: 'all',
          minOfflineSec: 120,
          recipients: {
            create: [
              { channel: 'in_app', target: 'admin-1' },
              { channel: 'in_app', target: 'admin-2' },
            ],
          },
        }),
      });
    });

    it('creates the rule with zero recipients when adminUserIds is empty', async () => {
      db.alertRule.create.mockResolvedValue({ id: 'rule-1' });

      await service.seedDefaultRuleForOrg(orgId, []);

      const dataArg = db.alertRule.create.mock.calls[0][0].data;
      expect(dataArg.recipients.create).toEqual([]);
    });

    it('is idempotent — re-seed catches P2002 and returns without error', async () => {
      const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      db.alertRule.create.mockRejectedValue(p2002);

      await expect(service.seedDefaultRuleForOrg(orgId, ['admin-1'])).resolves.toBeUndefined();
    });

    it('rethrows non-P2002 errors', async () => {
      db.alertRule.create.mockRejectedValue(new Error('connection refused'));

      await expect(service.seedDefaultRuleForOrg(orgId, ['admin-1'])).rejects.toThrow(
        'connection refused',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Heal cron — backfills the default rule for orgs that missed the seed
  // ---------------------------------------------------------------------------
  describe('healMissingDefaultRules', () => {
    beforeEach(() => {
      db.organization = { findMany: jest.fn() };
      db.user.findMany = jest.fn();
    });

    it('no-ops when all orgs already have the default rule', async () => {
      db.organization.findMany.mockResolvedValue([]);

      await service.healMissingDefaultRules();

      // Pagination cursor + take added — query now includes orderBy/take but the
      // where + select shape is preserved.
      expect(db.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            alertRules: {
              none: { name: 'Default offline alert (auto-migrated)' },
            },
          },
          select: { id: true, name: true },
          orderBy: { id: 'asc' },
          take: 100,
        }),
      );
      expect(db.alertRule.create).not.toHaveBeenCalled();
    });

    it('seeds the default rule for every org that is missing it', async () => {
      db.organization.findMany.mockResolvedValue([
        { id: 'org-a', name: 'Org A' },
        { id: 'org-b', name: 'Org B' },
      ]);
      db.user.findMany
        .mockResolvedValueOnce([{ id: 'admin-a1' }, { id: 'admin-a2' }])
        .mockResolvedValueOnce([{ id: 'admin-b1' }]);
      db.alertRule.create.mockResolvedValue({});

      await service.healMissingDefaultRules();

      expect(db.alertRule.create).toHaveBeenCalledTimes(2);
      // Per-org admin lookup is scoped to the org and to role='admin'.
      expect(db.user.findMany).toHaveBeenNthCalledWith(1, {
        where: { organizationId: 'org-a', role: 'admin' },
        select: { id: true },
      });
      expect(db.user.findMany).toHaveBeenNthCalledWith(2, {
        where: { organizationId: 'org-b', role: 'admin' },
        select: { id: true },
      });
    });

    it('continues healing remaining orgs when one seed fails', async () => {
      db.organization.findMany.mockResolvedValue([
        { id: 'org-fails', name: 'Org Fails' },
        { id: 'org-ok', name: 'Org OK' },
      ]);
      db.user.findMany.mockResolvedValue([{ id: 'admin' }]);
      // First create rejects with a non-idempotent error; second succeeds.
      db.alertRule.create
        .mockRejectedValueOnce(new Error('transient DB blip'))
        .mockResolvedValueOnce({});

      await service.healMissingDefaultRules();

      // Both orgs attempted — failure in the first did not abort the second.
      expect(db.alertRule.create).toHaveBeenCalledTimes(2);
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
