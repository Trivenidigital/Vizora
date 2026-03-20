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

    let auditCount = 0;
    let notifCount = 0;
    let tokenCount = 0;

    // 1. Purge audit logs older than 90 days
    try {
      const result = await this.db.auditLog.deleteMany({
        where: { createdAt: { lt: ninetyDaysAgo } },
      });
      auditCount = result.count;
      this.logger.log(`Purged ${auditCount} audit logs older than 90 days`);
    } catch (err) {
      this.logger.error(`Failed to purge audit logs: ${err instanceof Error ? err.message : err}`);
    }

    // 2. Purge dismissed notifications older than 30 days
    try {
      const deletedDismissed = await this.db.notification.deleteMany({
        where: {
          dismissedAt: { not: null, lt: thirtyDaysAgo },
        },
      });
      notifCount += deletedDismissed.count;
      this.logger.log(`Purged ${deletedDismissed.count} dismissed notifications older than 30 days`);
    } catch (err) {
      this.logger.error(`Failed to purge dismissed notifications: ${err instanceof Error ? err.message : err}`);
    }

    // 3. Purge read (non-dismissed) notifications older than 30 days
    try {
      const deletedRead = await this.db.notification.deleteMany({
        where: {
          read: true,
          dismissedAt: null,
          createdAt: { lt: thirtyDaysAgo },
        },
      });
      notifCount += deletedRead.count;
      this.logger.log(`Purged ${deletedRead.count} read notifications older than 30 days`);
    } catch (err) {
      this.logger.error(`Failed to purge read notifications: ${err instanceof Error ? err.message : err}`);
    }

    // 4. Delete expired password reset tokens
    try {
      const result = await this.db.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      tokenCount = result.count;
      this.logger.log(`Purged ${tokenCount} expired password reset tokens`);
    } catch (err) {
      this.logger.error(`Failed to purge expired tokens: ${err instanceof Error ? err.message : err}`);
    }

    this.logger.log(
      `Data retention cleanup complete: ${auditCount} audit logs, ` +
      `${notifCount} notifications, ${tokenCount} tokens`,
    );
  }
}
