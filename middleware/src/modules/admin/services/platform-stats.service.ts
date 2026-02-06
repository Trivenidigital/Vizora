import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface PlatformOverview {
  totalOrganizations: number;
  totalUsers: number;
  totalDisplays: number;
  onlineDisplays: number;
  totalContent: number;
  totalStorageBytes: number;
  totalRevenue: number;
  activeSubscriptions: number;
}

export interface RevenueStats {
  period: string;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  transactionCount: number;
  byCurrency: Record<string, number>;
  byProvider: Record<string, number>;
}

export interface SignupStats {
  period: string;
  total: number;
  byDay: Array<{ date: string; count: number }>;
  byPlan: Record<string, number>;
}

export interface ChurnStats {
  period: string;
  churned: number;
  churnRate: number;
  byPlan: Record<string, number>;
}

export interface UsageStats {
  displaysOnline: number;
  displaysTotal: number;
  onlinePercentage: number;
  contentItems: number;
  activeSchedules: number;
  apiKeysActive: number;
}

export interface PlanBreakdown {
  plan: string;
  organizationCount: number;
  userCount: number;
  displayCount: number;
  percentage: number;
}

export interface GeographicStats {
  byCountry: Array<{
    country: string;
    organizations: number;
    users: number;
    percentage: number;
  }>;
}

@Injectable()
export class PlatformStatsService {
  private readonly logger = new Logger(PlatformStatsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get platform overview dashboard summary
   */
  async getOverview(): Promise<PlatformOverview> {
    const [
      totalOrganizations,
      totalUsers,
      totalDisplays,
      onlineDisplays,
      totalContent,
      contentStorage,
      revenueData,
      activeSubscriptions,
    ] = await Promise.all([
      this.db.organization.count(),
      this.db.user.count(),
      this.db.display.count(),
      this.db.display.count({ where: { status: 'online' } }),
      this.db.content.count(),
      this.db.content.aggregate({ _sum: { fileSize: true } }),
      this.db.billingTransaction.aggregate({
        where: { status: 'succeeded' },
        _sum: { amount: true },
      }),
      this.db.organization.count({
        where: { subscriptionStatus: 'active' },
      }),
    ]);

    return {
      totalOrganizations,
      totalUsers,
      totalDisplays,
      onlineDisplays,
      totalContent,
      totalStorageBytes: contentStorage._sum.fileSize || 0,
      totalRevenue: revenueData._sum.amount || 0,
      activeSubscriptions,
    };
  }

  /**
   * Get revenue statistics for a period
   */
  async getRevenue(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<RevenueStats> {
    const since = this.getPeriodStart(period);

    const transactions = await this.db.billingTransaction.findMany({
      where: {
        status: 'succeeded',
        createdAt: { gte: since },
      },
      select: {
        amount: true,
        currency: true,
        provider: true,
        type: true,
      },
    });

    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Calculate MRR from subscription transactions
    const subscriptionTxns = transactions.filter((t) => t.type === 'subscription');
    const mrr = subscriptionTxns.reduce((sum, t) => sum + t.amount, 0);
    const arr = mrr * 12;

    // Group by currency
    const byCurrency: Record<string, number> = {};
    transactions.forEach((t) => {
      byCurrency[t.currency] = (byCurrency[t.currency] || 0) + t.amount;
    });

    // Group by provider
    const byProvider: Record<string, number> = {};
    transactions.forEach((t) => {
      byProvider[t.provider] = (byProvider[t.provider] || 0) + t.amount;
    });

    return {
      period,
      mrr,
      arr,
      totalRevenue,
      transactionCount: transactions.length,
      byCurrency,
      byProvider,
    };
  }

  /**
   * Get new organization signups for a period
   */
  async getSignups(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<SignupStats> {
    const since = this.getPeriodStart(period);

    const organizations = await this.db.organization.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        subscriptionTier: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const byDayMap = new Map<string, number>();
    organizations.forEach((org) => {
      const date = org.createdAt.toISOString().split('T')[0];
      byDayMap.set(date, (byDayMap.get(date) || 0) + 1);
    });

    const byDay = Array.from(byDayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // Group by plan
    const byPlan: Record<string, number> = {};
    organizations.forEach((org) => {
      byPlan[org.subscriptionTier] = (byPlan[org.subscriptionTier] || 0) + 1;
    });

    return {
      period,
      total: organizations.length,
      byDay,
      byPlan,
    };
  }

  /**
   * Get churn statistics for a period
   */
  async getChurn(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<ChurnStats> {
    const since = this.getPeriodStart(period);

    // Count organizations that moved to 'canceled' status in the period
    const churnedOrgs = await this.db.organization.findMany({
      where: {
        subscriptionStatus: 'canceled',
        updatedAt: { gte: since },
      },
      select: {
        subscriptionTier: true,
      },
    });

    // Get total active orgs at start of period for churn rate calculation
    const totalActiveOrgs = await this.db.organization.count({
      where: {
        subscriptionStatus: { in: ['active', 'trial'] },
      },
    });

    // Group by plan
    const byPlan: Record<string, number> = {};
    churnedOrgs.forEach((org) => {
      byPlan[org.subscriptionTier] = (byPlan[org.subscriptionTier] || 0) + 1;
    });

    const churnRate = totalActiveOrgs > 0 ? (churnedOrgs.length / totalActiveOrgs) * 100 : 0;

    return {
      period,
      churned: churnedOrgs.length,
      churnRate: Math.round(churnRate * 100) / 100,
      byPlan,
    };
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    const [
      displaysOnline,
      displaysTotal,
      contentItems,
      activeSchedules,
      apiKeysActive,
    ] = await Promise.all([
      this.db.display.count({ where: { status: 'online' } }),
      this.db.display.count(),
      this.db.content.count({ where: { status: 'active' } }),
      this.db.schedule.count({ where: { isActive: true } }),
      this.db.apiKey.count({ where: { revokedAt: null } }),
    ]);

    return {
      displaysOnline,
      displaysTotal,
      onlinePercentage: displaysTotal > 0 ? Math.round((displaysOnline / displaysTotal) * 100) : 0,
      contentItems,
      activeSchedules,
      apiKeysActive,
    };
  }

  /**
   * Get breakdown by subscription plan
   */
  async getByPlan(): Promise<PlanBreakdown[]> {
    const plans = ['free', 'basic', 'pro', 'enterprise'];
    const totalOrgs = await this.db.organization.count();

    const breakdowns = await Promise.all(
      plans.map(async (plan) => {
        const [organizationCount, users, displays] = await Promise.all([
          this.db.organization.count({ where: { subscriptionTier: plan } }),
          this.db.user.count({
            where: { organization: { subscriptionTier: plan } },
          }),
          this.db.display.count({
            where: { organization: { subscriptionTier: plan } },
          }),
        ]);

        return {
          plan,
          organizationCount,
          userCount: users,
          displayCount: displays,
          percentage: totalOrgs > 0 ? Math.round((organizationCount / totalOrgs) * 100) : 0,
        };
      }),
    );

    return breakdowns;
  }

  /**
   * Get geographic distribution of users/orgs
   */
  async getGeographic(): Promise<GeographicStats> {
    const orgs = await this.db.organization.findMany({
      where: { country: { not: null } },
      select: {
        country: true,
        _count: { select: { users: true } },
      },
    });

    // Group by country
    const countryMap = new Map<string, { organizations: number; users: number }>();

    orgs.forEach((org) => {
      const country = org.country || 'Unknown';
      const current = countryMap.get(country) || { organizations: 0, users: 0 };
      countryMap.set(country, {
        organizations: current.organizations + 1,
        users: current.users + org._count.users,
      });
    });

    const totalOrgs = orgs.length;

    const byCountry = Array.from(countryMap.entries())
      .map(([country, data]) => ({
        country,
        organizations: data.organizations,
        users: data.users,
        percentage: totalOrgs > 0 ? Math.round((data.organizations / totalOrgs) * 100) : 0,
      }))
      .sort((a, b) => b.organizations - a.organizations);

    return { byCountry };
  }

  /**
   * Get the start date for a period
   */
  private getPeriodStart(period: 'day' | 'week' | 'month' | 'year'): Date {
    const now = new Date();

    switch (period) {
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setMonth(now.getMonth() - 1));
    }
  }
}
