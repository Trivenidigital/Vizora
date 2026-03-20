import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Daily data retention policy — runs at 3 AM (after analytics cleanup at 2 AM).
   *
   * Purges:
   * 1. Audit logs older than 90 days
   * 2. Dismissed notifications older than 30 days
   * 3. Read (non-dismissed) notifications older than 30 days
   * 4. Expired password reset tokens
   *
   * Note: Content impressions are already cleaned up by AnalyticsService at 2 AM.
   * Note: Redis device commands have a 5-minute TTL and self-expire.
   */
  @Cron('0 3 * * *')
  async runRetentionPolicy() {
    this.logger.log('Starting daily data retention cleanup...');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    try {
      // 1. Purge audit logs older than 90 days
      const deletedAuditLogs = await this.db.auditLog.deleteMany({
        where: { createdAt: { lt: ninetyDaysAgo } },
      });
      this.logger.log(`Purged ${deletedAuditLogs.count} audit logs older than 90 days`);

      // 2. Purge dismissed notifications older than 30 days
      const deletedDismissed = await this.db.notification.deleteMany({
        where: {
          dismissedAt: { not: null, lt: thirtyDaysAgo },
        },
      });
      this.logger.log(`Purged ${deletedDismissed.count} dismissed notifications older than 30 days`);

      // 3. Purge read (non-dismissed) notifications older than 30 days
      const deletedRead = await this.db.notification.deleteMany({
        where: {
          read: true,
          dismissedAt: null,
          createdAt: { lt: thirtyDaysAgo },
        },
      });
      this.logger.log(`Purged ${deletedRead.count} read notifications older than 30 days`);

      // 4. Delete expired password reset tokens
      const deletedTokens = await this.db.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      this.logger.log(`Purged ${deletedTokens.count} expired password reset tokens`);

      this.logger.log(
        `Data retention cleanup complete: ${deletedAuditLogs.count} audit logs, ` +
        `${deletedDismissed.count + deletedRead.count} notifications, ${deletedTokens.count} tokens`,
      );
    } catch (error) {
      this.logger.error('Data retention cleanup failed:', error);
    }
  }
}
