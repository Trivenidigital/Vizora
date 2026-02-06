import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface CreateAnnouncementDto {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'critical' | 'maintenance';
  targetAudience?: 'all' | 'admins' | 'specific_plans';
  targetPlans?: string[];
  startsAt: Date;
  expiresAt?: Date;
  isDismissible?: boolean;
  linkUrl?: string;
  linkText?: string;
}

export interface UpdateAnnouncementDto extends Partial<CreateAnnouncementDto> {
  isActive?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  targetAudience: string;
  targetPlans: string[];
  startsAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  isDismissible: boolean;
  linkUrl: string | null;
  linkText: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all announcements
   */
  async findAll(): Promise<Announcement[]> {
    return this.db.systemAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get currently active announcements
   */
  async findActive(): Promise<Announcement[]> {
    const now = new Date();

    return this.db.systemAnnouncement.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: [
        { type: 'desc' }, // critical first
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get active announcements for a specific user/plan
   */
  async findActiveForPlan(plan: string, isAdmin: boolean = false): Promise<Announcement[]> {
    const now = new Date();

    const announcements = await this.db.systemAnnouncement.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: [
        { type: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Filter by audience
    return announcements.filter((ann) => {
      if (ann.targetAudience === 'all') return true;
      if (ann.targetAudience === 'admins' && isAdmin) return true;
      if (ann.targetAudience === 'specific_plans') {
        return ann.targetPlans.includes(plan);
      }
      return false;
    });
  }

  /**
   * Get a single announcement by ID
   */
  async findOne(id: string): Promise<Announcement> {
    const announcement = await this.db.systemAnnouncement.findUnique({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    return announcement;
  }

  /**
   * Create a new announcement
   */
  async create(dto: CreateAnnouncementDto, adminUserId: string): Promise<Announcement> {
    // Validate dates
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('Expiration date must be after start date');
    }

    // Validate target plans if specific_plans audience
    if (dto.targetAudience === 'specific_plans' && (!dto.targetPlans || dto.targetPlans.length === 0)) {
      throw new BadRequestException('Target plans required when audience is specific_plans');
    }

    const announcement = await this.db.systemAnnouncement.create({
      data: {
        title: dto.title,
        message: dto.message,
        type: dto.type || 'info',
        targetAudience: dto.targetAudience || 'all',
        targetPlans: dto.targetPlans || [],
        startsAt: new Date(dto.startsAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isDismissible: dto.isDismissible ?? true,
        linkUrl: dto.linkUrl,
        linkText: dto.linkText,
        createdBy: adminUserId,
        isActive: false, // Start as inactive, use publish() to activate
      },
    });

    this.logger.log(`Created announcement: ${announcement.title} (${announcement.id})`);
    return announcement;
  }

  /**
   * Update an announcement
   */
  async update(id: string, dto: UpdateAnnouncementDto): Promise<Announcement> {
    await this.findOne(id);

    // Validate dates if both provided
    if (dto.startsAt && dto.expiresAt && new Date(dto.expiresAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('Expiration date must be after start date');
    }

    const updateData: any = { ...dto };

    if (dto.startsAt) {
      updateData.startsAt = new Date(dto.startsAt);
    }
    if (dto.expiresAt) {
      updateData.expiresAt = new Date(dto.expiresAt);
    }

    const updated = await this.db.systemAnnouncement.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Updated announcement: ${updated.title} (${updated.id})`);
    return updated;
  }

  /**
   * Delete an announcement
   */
  async delete(id: string): Promise<{ deleted: boolean; id: string }> {
    const announcement = await this.findOne(id);

    await this.db.systemAnnouncement.delete({
      where: { id },
    });

    this.logger.log(`Deleted announcement: ${announcement.title} (${id})`);
    return { deleted: true, id };
  }

  /**
   * Publish (activate) an announcement
   */
  async publish(id: string): Promise<Announcement> {
    const announcement = await this.findOne(id);

    if (announcement.isActive) {
      throw new BadRequestException('Announcement is already published');
    }

    const updated = await this.db.systemAnnouncement.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`Published announcement: ${updated.title} (${updated.id})`);
    return updated;
  }

  /**
   * Unpublish (deactivate) an announcement
   */
  async unpublish(id: string): Promise<Announcement> {
    const announcement = await this.findOne(id);

    if (!announcement.isActive) {
      throw new BadRequestException('Announcement is already unpublished');
    }

    const updated = await this.db.systemAnnouncement.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Unpublished announcement: ${updated.title} (${updated.id})`);
    return updated;
  }
}
