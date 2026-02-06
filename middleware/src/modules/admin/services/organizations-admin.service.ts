import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma } from '@vizora/database';

export interface OrgFiltersDto {
  search?: string;
  status?: string;
  subscriptionTier?: string;
  skip?: number;
  take?: number;
  sortBy?: 'createdAt' | 'name' | 'screenQuota';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateOrgAdminDto {
  name?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  screenQuota?: number;
  trialEndsAt?: Date | null;
  country?: string;
  billingEmail?: string;
}

export interface OrgStats {
  userCount: number;
  displayCount: number;
  contentCount: number;
  playlistCount: number;
  onlineDisplays: number;
  totalStorageBytes: number;
  lastActivity: Date | null;
}

@Injectable()
export class OrganizationsAdminService {
  private readonly logger = new Logger(OrganizationsAdminService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * List all organizations with search, pagination, and sorting
   */
  async findAll(filters: OrgFiltersDto): Promise<{
    data: any[];
    total: number;
    skip: number;
    take: number;
  }> {
    const where: Prisma.OrganizationWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { billingEmail: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) {
      where.subscriptionStatus = filters.status;
    }

    if (filters.subscriptionTier) {
      where.subscriptionTier = filters.subscriptionTier;
    }

    const skip = filters.skip ?? 0;
    const take = filters.take ?? 20;
    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';

    const [data, total] = await Promise.all([
      this.db.organization.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              users: true,
              displays: true,
              content: true,
              playlists: true,
            },
          },
        },
      }),
      this.db.organization.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  /**
   * Get full organization details
   */
  async findOne(id: string) {
    const org = await this.db.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            displays: true,
            content: true,
            playlists: true,
            schedules: true,
            apiKeys: true,
            billingTransactions: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return org;
  }

  /**
   * Update organization details (plan, status, quotas, etc.)
   */
  async update(id: string, dto: UpdateOrgAdminDto) {
    await this.findOne(id);

    const updated = await this.db.organization.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Admin updated organization ${id}: ${JSON.stringify(dto)}`);
    return updated;
  }

  /**
   * Extend trial period by specified number of days
   */
  async extendTrial(id: string, days: number) {
    if (days <= 0) {
      throw new BadRequestException('Days must be positive');
    }

    const org = await this.findOne(id);

    // Calculate new trial end date
    const currentEnd = org.trialEndsAt ? new Date(org.trialEndsAt) : new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + days);

    const updated = await this.db.organization.update({
      where: { id },
      data: {
        trialEndsAt: newEnd,
        subscriptionStatus: 'trial',
      },
    });

    this.logger.log(`Extended trial for org ${id} by ${days} days (until ${newEnd.toISOString()})`);
    return updated;
  }

  /**
   * Suspend an organization
   */
  async suspend(id: string, reason: string) {
    const org = await this.findOne(id);

    if (org.subscriptionStatus === 'suspended') {
      throw new BadRequestException('Organization is already suspended');
    }

    // Store suspension reason in settings
    const currentSettings = (org.settings as Record<string, any>) || {};
    const updatedSettings = {
      ...currentSettings,
      suspendedAt: new Date().toISOString(),
      suspendedReason: reason,
      previousStatus: org.subscriptionStatus,
    };

    const updated = await this.db.organization.update({
      where: { id },
      data: {
        subscriptionStatus: 'suspended',
        settings: updatedSettings,
      },
    });

    this.logger.log(`Suspended organization ${id}: ${reason}`);
    return updated;
  }

  /**
   * Unsuspend (reactivate) an organization
   */
  async unsuspend(id: string) {
    const org = await this.findOne(id);

    if (org.subscriptionStatus !== 'suspended') {
      throw new BadRequestException('Organization is not suspended');
    }

    const currentSettings = (org.settings as Record<string, any>) || {};
    const previousStatus = currentSettings.previousStatus || 'active';

    // Clean up suspension info from settings
    const { suspendedAt, suspendedReason, previousStatus: _, ...cleanedSettings } = currentSettings;

    const updated = await this.db.organization.update({
      where: { id },
      data: {
        subscriptionStatus: previousStatus,
        settings: Object.keys(cleanedSettings).length > 0 ? cleanedSettings : null,
      },
    });

    this.logger.log(`Unsuspended organization ${id}, restored to ${previousStatus}`);
    return updated;
  }

  /**
   * GDPR-compliant deletion - cascade delete all organization data
   */
  async delete(id: string) {
    const org = await this.findOne(id);

    // Prisma cascade will handle related records due to onDelete: Cascade
    await this.db.organization.delete({
      where: { id },
    });

    this.logger.warn(`DELETED organization ${id} (${org.name}) and all related data`);
    return { deleted: true, organizationId: id, organizationName: org.name };
  }

  /**
   * Get detailed statistics for an organization
   */
  async getStats(id: string): Promise<OrgStats> {
    const org = await this.findOne(id);

    const [
      userCount,
      displayCount,
      contentCount,
      playlistCount,
      onlineDisplays,
      contentStats,
      lastAudit,
    ] = await Promise.all([
      this.db.user.count({ where: { organizationId: id } }),
      this.db.display.count({ where: { organizationId: id } }),
      this.db.content.count({ where: { organizationId: id } }),
      this.db.playlist.count({ where: { organizationId: id } }),
      this.db.display.count({ where: { organizationId: id, status: 'online' } }),
      this.db.content.aggregate({
        where: { organizationId: id },
        _sum: { fileSize: true },
      }),
      this.db.auditLog.findFirst({
        where: { organizationId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      userCount,
      displayCount,
      contentCount,
      playlistCount,
      onlineDisplays,
      totalStorageBytes: contentStats._sum.fileSize || 0,
      lastActivity: lastAudit?.createdAt || null,
    };
  }

  /**
   * Add an internal admin note to an organization
   */
  async addNote(id: string, note: string, adminUserId: string) {
    const org = await this.findOne(id);

    const currentSettings = (org.settings as Record<string, any>) || {};
    const adminNotes = currentSettings.adminNotes || [];

    const newNote = {
      id: `note-${Date.now()}`,
      note,
      addedBy: adminUserId,
      addedAt: new Date().toISOString(),
    };

    const updatedSettings = {
      ...currentSettings,
      adminNotes: [...adminNotes, newNote],
    };

    const updated = await this.db.organization.update({
      where: { id },
      data: {
        settings: updatedSettings,
      },
    });

    this.logger.log(`Added admin note to org ${id} by ${adminUserId}`);
    return { organization: updated, note: newNote };
  }
}
