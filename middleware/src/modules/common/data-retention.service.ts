import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly db: DatabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredRecords() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Delete expired password reset tokens
    const deletedTokens = await this.db.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Delete read notifications older than 30 days
    const deletedNotifications = await this.db.notification.deleteMany({
      where: { read: true, createdAt: { lt: thirtyDaysAgo } },
    });

    this.logger.log(
      `Data retention cleanup: ${deletedTokens.count} expired tokens, ${deletedNotifications.count} old notifications`,
    );
  }
}
