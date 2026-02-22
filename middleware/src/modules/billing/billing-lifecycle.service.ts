import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class BillingLifecycleService {
  private readonly logger = new Logger(BillingLifecycleService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Daily job: expire trials and send reminders
   * Runs every day at 8:00 AM UTC
   */
  @Cron('0 8 * * *')
  async handleTrialLifecycle(): Promise<void> {
    this.logger.log('Running trial lifecycle check...');

    await Promise.allSettled([
      this.expireTrials(),
      this.sendTrialReminders(10),
      this.sendTrialReminders(5),
      this.sendTrialReminders(2),
    ]);

    this.logger.log('Trial lifecycle check complete');
  }

  /**
   * Auto-expire trials that have passed their trialEndsAt date
   */
  async expireTrials(): Promise<void> {
    const now = new Date();

    const expiredOrgs = await this.db.organization.findMany({
      where: {
        subscriptionStatus: 'trial',
        trialEndsAt: { lte: now },
      },
      select: {
        id: true,
        name: true,
        country: true,
        users: {
          where: { role: 'admin' },
          take: 1,
          select: { email: true, firstName: true },
        },
      },
    });

    if (expiredOrgs.length === 0) return;

    this.logger.log(`Found ${expiredOrgs.length} expired trials to process`);

    for (const org of expiredOrgs) {
      try {
        await this.db.organization.update({
          where: { id: org.id },
          data: { subscriptionStatus: 'canceled' },
        });

        // Send trial expired email
        const admin = org.users[0];
        if (admin?.email) {
          const pricing = org.country === 'IN'
            ? { amount: '\u20B9399', currency: 'INR' }
            : { amount: '$6', currency: 'USD' };
          await this.mailService.sendTrialExpiredEmail(
            admin.email,
            admin.firstName || admin.email.split('@')[0],
            pricing,
          );
        }

        this.logger.log(`Expired trial for org ${org.id} (${org.name})`);
      } catch (error) {
        this.logger.error(`Failed to expire trial for org ${org.id}: ${error}`);
      }
    }
  }

  /**
   * Send trial reminder emails at the specified days-before-expiry
   */
  async sendTrialReminders(daysBeforeExpiry: number): Promise<void> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);

    // Find orgs whose trial ends on the target date (within that day)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const orgs = await this.db.organization.findMany({
      where: {
        subscriptionStatus: 'trial',
        trialEndsAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        name: true,
        country: true,
        users: {
          where: { role: 'admin' },
          take: 1,
          select: { email: true, firstName: true },
        },
      },
    });

    if (orgs.length === 0) return;

    this.logger.log(`Sending ${daysBeforeExpiry}-day trial reminder to ${orgs.length} orgs`);

    for (const org of orgs) {
      try {
        const admin = org.users[0];
        if (admin?.email) {
          const pricing = org.country === 'IN'
            ? { amount: '\u20B9399', currency: 'INR' }
            : { amount: '$6', currency: 'USD' };
          await this.mailService.sendTrialReminderEmail(
            admin.email,
            admin.firstName || admin.email.split('@')[0],
            daysBeforeExpiry,
            pricing,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to send trial reminder for org ${org.id}: ${error}`);
      }
    }
  }

  /**
   * Daily job: handle grace period expiry for past_due subscriptions
   * Runs every day at 9:00 AM UTC
   */
  @Cron('0 9 * * *')
  async handleGracePeriodExpiry(): Promise<void> {
    this.logger.log('Checking grace period expirations...');

    // Find organizations that have been past_due for more than 7 days
    const gracePeriodCutoff = new Date();
    gracePeriodCutoff.setDate(gracePeriodCutoff.getDate() - 7);

    const pastDueOrgs = await this.db.organization.findMany({
      where: {
        subscriptionStatus: 'past_due',
        updatedAt: { lte: gracePeriodCutoff },
      },
      include: {
        users: {
          where: { role: 'admin' },
          take: 1,
          select: { email: true, firstName: true },
        },
      },
    });

    for (const org of pastDueOrgs) {
      try {
        await this.db.organization.update({
          where: { id: org.id },
          data: {
            subscriptionStatus: 'canceled',
            subscriptionTier: 'free',
            screenQuota: 5,
            stripeSubscriptionId: null,
            razorpaySubscriptionId: null,
          },
        });

        this.logger.log(`Grace period expired for org ${org.id}, downgraded to free`);
      } catch (error) {
        this.logger.error(`Failed to process grace period for org ${org.id}: ${error}`);
      }
    }
  }
}
