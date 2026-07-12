import { NotFoundException } from '@nestjs/common';
import { FeatureFlagService, FEATURE_FLAGS } from './feature-flags.service';
import { DatabaseService } from '../database/database.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let mockDb: any;

  const mockOrg = {
    id: 'org-123',
    name: 'Test Org',
    settings: null as any,
  };

  beforeEach(() => {
    mockDb = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new FeatureFlagService(mockDb as DatabaseService);
  });

  // Pull the interpolated values out of a Prisma tagged-template
  // `$executeRaw` call: values[0] is the stringified flags payload, [1] is
  // the orgId. (call[0] is the TemplateStringsArray; the rest are the
  // `${...}` bindings in SQL order.)
  const rawFlagsPayload = (callIndex = 0): Record<string, boolean> =>
    JSON.parse(mockDb.$executeRaw.mock.calls[callIndex][1]);

  describe('isEnabled', () => {
    it('should return true for features not explicitly disabled', async () => {
      mockDb.organization.findUnique.mockResolvedValue({ ...mockOrg, settings: {} });
      expect(await service.isEnabled('org-123', 'weatherWidget')).toBe(true);
    });

    it('should return false for explicitly disabled features', async () => {
      mockDb.organization.findUnique.mockResolvedValue({
        ...mockOrg,
        settings: { featureFlags: { weatherWidget: false } },
      });
      expect(await service.isEnabled('org-123', 'weatherWidget')).toBe(false);
    });

    it('should return true for explicitly enabled features', async () => {
      mockDb.organization.findUnique.mockResolvedValue({
        ...mockOrg,
        settings: { featureFlags: { weatherWidget: true } },
      });
      expect(await service.isEnabled('org-123', 'weatherWidget')).toBe(true);
    });

    it('should return true when settings is null', async () => {
      mockDb.organization.findUnique.mockResolvedValue({ ...mockOrg, settings: null });
      expect(await service.isEnabled('org-123', 'weatherWidget')).toBe(true);
    });

    it('should throw NotFoundException for unknown org', async () => {
      mockDb.organization.findUnique.mockResolvedValue(null);
      await expect(service.isEnabled('bad-id', 'weatherWidget')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFlags', () => {
    it('should return all defaults when no flags stored', async () => {
      mockDb.organization.findUnique.mockResolvedValue({ ...mockOrg, settings: {} });
      const flags = await service.getFlags('org-123');

      for (const [key, defaultVal] of Object.entries(FEATURE_FLAGS)) {
        expect(flags[key]).toBe(defaultVal);
      }
    });

    it('should merge stored flags with defaults', async () => {
      mockDb.organization.findUnique.mockResolvedValue({
        ...mockOrg,
        settings: { featureFlags: { advancedAnalytics: false, weatherWidget: false } },
      });
      const flags = await service.getFlags('org-123');

      expect(flags.advancedAnalytics).toBe(false);
      expect(flags.weatherWidget).toBe(false);
      expect(flags.rssWidget).toBe(true); // default
      expect(flags.fleetControl).toBe(true); // default
    });

    it('should throw NotFoundException for unknown org', async () => {
      mockDb.organization.findUnique.mockResolvedValue(null);
      await expect(service.getFlags('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setFlags', () => {
    it('should update flags via a single atomic write and return merged result', async () => {
      mockDb.$executeRaw.mockResolvedValueOnce(1);
      // getFlags reflect-read after the atomic write
      mockDb.organization.findUnique.mockResolvedValueOnce({
        ...mockOrg,
        settings: { featureFlags: { advancedAnalytics: false } },
      });

      const result = await service.setFlags('org-123', { advancedAnalytics: false });

      // Exactly one atomic UPDATE, and NO read-modify-write via
      // organization.update (the lost-update window is gone).
      expect(mockDb.$executeRaw).toHaveBeenCalledTimes(1);
      expect(mockDb.organization.update).not.toHaveBeenCalled();
      expect(rawFlagsPayload()).toEqual({ advancedAnalytics: false });
      expect(result.advancedAnalytics).toBe(false);
    });

    it('should merge atomically at the DB level (jsonb_set + jsonb-merge, not whole-object overwrite)', async () => {
      mockDb.$executeRaw.mockResolvedValueOnce(1);
      mockDb.organization.findUnique.mockResolvedValueOnce({ ...mockOrg, settings: {} });

      await service.setFlags('org-123', { weatherWidget: false });

      const sql = mockDb.$executeRaw.mock.calls[0][0].join('?');
      expect(sql).toContain('jsonb_set');
      expect(sql).toContain("'{featureFlags}'");
      expect(sql).toContain('||'); // merge onto existing featureFlags, preserving siblings
      // orgId is the second interpolated binding
      expect(mockDb.$executeRaw.mock.calls[0][2]).toBe('org-123');
    });

    it('should ignore unknown flag keys', async () => {
      mockDb.$executeRaw.mockResolvedValueOnce(1);
      mockDb.organization.findUnique.mockResolvedValueOnce({ ...mockOrg, settings: { featureFlags: {} } });

      await service.setFlags('org-123', { unknownFlag: true } as any);

      expect(rawFlagsPayload()).toEqual({});
    });

    it('should ignore non-boolean values', async () => {
      mockDb.$executeRaw.mockResolvedValueOnce(1);
      mockDb.organization.findUnique.mockResolvedValueOnce({ ...mockOrg, settings: { featureFlags: {} } });

      await service.setFlags('org-123', { weatherWidget: 'yes' } as any);

      expect(rawFlagsPayload()).toEqual({});
    });

    it('should throw NotFoundException when the atomic UPDATE matches no org', async () => {
      mockDb.$executeRaw.mockResolvedValueOnce(0);
      await expect(service.setFlags('bad-id', {})).rejects.toThrow(NotFoundException);
      expect(mockDb.organization.findUnique).not.toHaveBeenCalled();
    });

    // Lost-update regression: two concurrent writers each toggling a
    // DIFFERENT flag must both survive. The old load→mutate-in-JS→write
    // path had both writers read the same stale `featureFlags` and the
    // last write win, dropping one flag. Here `$executeRaw` models the
    // Postgres `jsonb_set(... || ...)` semantics against a shared store:
    // each call merges its own key onto the current value, so nothing is
    // lost. The real atomicity is enforced by Postgres row-locking during
    // the UPDATE; this test proves the SERVICE no longer does a JS-side
    // read-modify-write that could interleave and clobber.
    it('preserves both writes when two concurrent setFlags target different flags', async () => {
      const store: { featureFlags: Record<string, boolean> } = { featureFlags: {} };

      mockDb.$executeRaw.mockImplementation(async (_strings: any, flagsJson: string) => {
        const incoming = JSON.parse(flagsJson) as Record<string, boolean>;
        store.featureFlags = { ...store.featureFlags, ...incoming };
        return 1;
      });
      mockDb.organization.findUnique.mockImplementation(async () => ({
        ...mockOrg,
        settings: { featureFlags: { ...store.featureFlags } },
      }));

      await Promise.all([
        service.setFlags('org-123', { weatherWidget: false }),
        service.setFlags('org-123', { rssWidget: false }),
      ]);

      const flags = await service.getFlags('org-123');
      expect(flags.weatherWidget).toBe(false);
      expect(flags.rssWidget).toBe(false);
      expect(mockDb.organization.update).not.toHaveBeenCalled();
    });
  });
});
