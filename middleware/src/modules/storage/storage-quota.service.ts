import { Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StorageQuotaService {
  private readonly logger = new Logger(StorageQuotaService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get storage usage and quota for an organization.
   */
  async getStorageInfo(organizationId: string) {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { storageUsedBytes: true, storageQuotaBytes: true },
    });
    if (!org) return null;
    return {
      usedBytes: Number(org.storageUsedBytes),
      quotaBytes: Number(org.storageQuotaBytes),
      availableBytes: Number(org.storageQuotaBytes) - Number(org.storageUsedBytes),
      usagePercent: Number(org.storageQuotaBytes) > 0
        ? Math.round((Number(org.storageUsedBytes) / Number(org.storageQuotaBytes)) * 100)
        : 0,
    };
  }

  /**
   * Check if an upload would exceed the org's quota. Throws if it would.
   * Uses a serializable transaction to prevent race conditions where
   * concurrent uploads could both pass the quota check.
   */
  async checkQuota(organizationId: string, fileSizeBytes: number): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { storageUsedBytes: true, storageQuotaBytes: true },
      });
      if (!org) return;

      const usedBytes = Number(org.storageUsedBytes);
      const quotaBytes = Number(org.storageQuotaBytes);

      if (usedBytes + fileSizeBytes > quotaBytes) {
        throw new PayloadTooLargeException({
          message: 'Storage quota exceeded',
          usedBytes,
          quotaBytes,
          availableBytes: quotaBytes - usedBytes,
          requestedBytes: fileSizeBytes,
        });
      }
    });
  }

  /**
   * Increment storage usage after a successful upload.
   */
  async incrementUsage(organizationId: string, bytes: number): Promise<void> {
    await this.db.organization.update({
      where: { id: organizationId },
      data: { storageUsedBytes: { increment: bytes } },
    });
  }

  /**
   * Decrement storage usage after a file deletion.
   */
  async decrementUsage(organizationId: string, bytes: number): Promise<void> {
    // Prevent going below zero
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: { storageUsedBytes: true },
    });
    if (!org) return;
    const currentUsed = Number(org.storageUsedBytes);
    const newUsed = Math.max(0, currentUsed - bytes);
    await this.db.organization.update({
      where: { id: organizationId },
      data: { storageUsedBytes: BigInt(newUsed) },
    });
  }

  /**
   * Recalculate storage usage from actual content records.
   */
  async recalculateUsage(organizationId: string): Promise<number> {
    const result = await this.db.content.aggregate({
      where: { organizationId, status: { not: 'archived' } },
      _sum: { fileSize: true },
    });
    const totalBytes = result._sum.fileSize || 0;
    await this.db.organization.update({
      where: { id: organizationId },
      data: { storageUsedBytes: BigInt(totalBytes) },
    });
    return totalBytes;
  }
}
