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
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new FeatureFlagService(mockDb as DatabaseService);
  });

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
    it('should update flags and return merged result', async () => {
      // First call for setFlags, second for getFlags
      mockDb.organization.findUnique
        .mockResolvedValueOnce({ ...mockOrg, settings: {} })
        .mockResolvedValueOnce({
          ...mockOrg,
          settings: { featureFlags: { advancedAnalytics: false } },
        });
      mockDb.organization.update.mockResolvedValue({});

      const result = await service.setFlags('org-123', { advancedAnalytics: false });

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          settings: { featureFlags: { advancedAnalytics: false } },
        },
      });
      expect(result.advancedAnalytics).toBe(false);
    });

    it('should ignore unknown flag keys', async () => {
      mockDb.organization.findUnique
        .mockResolvedValueOnce({ ...mockOrg, settings: {} })
        .mockResolvedValueOnce({ ...mockOrg, settings: { featureFlags: {} } });
      mockDb.organization.update.mockResolvedValue({});

      await service.setFlags('org-123', { unknownFlag: true } as any);

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { settings: { featureFlags: {} } },
      });
    });

    it('should ignore non-boolean values', async () => {
      mockDb.organization.findUnique
        .mockResolvedValueOnce({ ...mockOrg, settings: {} })
        .mockResolvedValueOnce({ ...mockOrg, settings: { featureFlags: {} } });
      mockDb.organization.update.mockResolvedValue({});

      await service.setFlags('org-123', { weatherWidget: 'yes' } as any);

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { settings: { featureFlags: {} } },
      });
    });

    it('should preserve existing settings when updating flags', async () => {
      mockDb.organization.findUnique
        .mockResolvedValueOnce({
          ...mockOrg,
          settings: { branding: { color: 'blue' }, featureFlags: { rssWidget: false } },
        })
        .mockResolvedValueOnce({
          ...mockOrg,
          settings: { branding: { color: 'blue' }, featureFlags: { rssWidget: false, weatherWidget: false } },
        });
      mockDb.organization.update.mockResolvedValue({});

      await service.setFlags('org-123', { weatherWidget: false });

      expect(mockDb.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          settings: {
            branding: { color: 'blue' },
            featureFlags: { rssWidget: false, weatherWidget: false },
          },
        },
      });
    });

    it('should throw NotFoundException for unknown org', async () => {
      mockDb.organization.findUnique.mockResolvedValue(null);
      await expect(service.setFlags('bad-id', {})).rejects.toThrow(NotFoundException);
    });
  });
});
