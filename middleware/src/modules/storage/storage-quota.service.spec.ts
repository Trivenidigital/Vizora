import { PayloadTooLargeException } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';

describe('StorageQuotaService', () => {
  let service: StorageQuotaService;
  let db: any;

  beforeEach(() => {
    db = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      content: {
        aggregate: jest.fn(),
      },
    };
    service = new StorageQuotaService(db);
  });

  describe('reserveQuota', () => {
    it('increments usage with one conditional database write', async () => {
      db.$queryRaw.mockResolvedValueOnce([
        { storageUsedBytes: 90n, storageQuotaBytes: 100n },
      ]);

      await service.reserveQuota('org-1', 40);

      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
      expect(db.organization.update).not.toHaveBeenCalled();
    });

    it('throws quota exceeded details when the conditional reservation fails', async () => {
      db.$queryRaw.mockResolvedValueOnce([]);
      db.organization.findUnique.mockResolvedValueOnce({
        storageUsedBytes: 80n,
        storageQuotaBytes: 100n,
      });

      await expect(service.reserveQuota('org-1', 40)).rejects.toThrow(PayloadTooLargeException);
    });
  });

  describe('decrementUsage', () => {
    it('releases usage with one atomic floor-at-zero database write', async () => {
      await service.decrementUsage('org-1', 25);

      expect(db.$executeRaw).toHaveBeenCalledTimes(1);
      expect(db.organization.findUnique).not.toHaveBeenCalled();
      expect(db.organization.update).not.toHaveBeenCalled();
    });

    it('does not write for empty releases', async () => {
      await service.decrementUsage('org-1', 0);

      expect(db.$executeRaw).not.toHaveBeenCalled();
    });
  });
});
