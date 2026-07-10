import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { PLAN_TIERS } from './constants/plans';
import { EntitlementService } from './entitlement.service';

@Injectable()
export class BillingLifecycleService {
  private readonly logger = new Logger(BillingLifecycleService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly mailService: MailService,
    private readonly entitlementService: EntitlementService,
  ) {}

  /**
   * Derive entry-tier display pricing from PLAN_TIERS instead of
   * hardcoding "$6 / ₹399" in email templates. Previously prices
   * here drifted from the actual paid-tier pricing whenever the
   * basic tier changed — customers got a reminder email quoting
   * the wrong number. R9 billing scout.
   */
  private getDisplayPricing(country: string | null): { amount: string; currency: string } {
    const basic = PLAN_TIERS.basic;
    if (country === 'IN') {
      const rupees = Math.round(basic.prices.inr.monthly / 100);
      return { amount: `₹${rupees}`, currency: 'INR' };
    }
    const dollars = Math.round(basic.prices.usd.monthly / 100);
    return { amount: `$${dollars}`, currency: 'USD' };
  }

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
          const pricing = this.getDisplayPricing(org.country);
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
          const pricing = this.getDisplayPricing(org.country);
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
    // B3: delegate to the entitlement degrade ladder. This advances rungs
    // (past_due → publish_locked → suspended → canceled) keyed on
    // entitlementStateSince in UTC days — NOT the old updatedAt cutoff (B8), and
    // NOT a binary suspend-at-7-days. The ladder writes its own run heartbeat.
    try {
      const { advanced } = await this.entitlementService.advanceLadder();
      this.logger.log(`Entitlement ladder run complete (${advanced} advanced)`);
    } catch (error) {
      // A dead ladder job must be observable — surface as error-level so alerting
      // fires, and let the next run retry (the ladder is idempotent).
      this.logger.error(`Entitlement ladder run FAILED: ${error}`);
    }
  }

  /**
   * Watchdog (hourly): if the ladder job hasn't run within its staleness window,
   * a rung is silently not advancing — customers who paid aren't being restored,
   * or unpaid tenants aren't degrading. Surface loudly so ops notices a dead job.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkLadderFreshness(): Promise<void> {
    if (await this.entitlementService.isLadderStale()) {
      this.logger.error(
        'ENTITLEMENT LADDER STALE: the daily rung-advancement job has not run within its ' +
          'staleness window. Rungs are not advancing — investigate the billing cron.',
      );
    }
  }
}
