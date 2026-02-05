import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

export interface NotificationFilters {
  read?: boolean;
  severity?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new notification
   */
  async create(data: CreateNotificationDto & { organizationId: string }) {
    const notification = await this.db.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        severity: data.severity || 'info',
        metadata: data.metadata as any,
        organizationId: data.organizationId,
        userId: data.userId,
      },
    });

    this.logger.log(`Created notification: ${notification.id} (${notification.type})`);
    return notification;
  }

  /**
   * Find all notifications for an organization with pagination and filters
   */
  async findAll(
    organizationId: string,
    filters?: NotificationFilters,
    pagination?: PaginationDto,
  ) {
    const { page = 1, limit = 20 } = pagination || {};
    const skip = (page - 1) * limit;

    // Build where clause with validated filters
    const where: any = { organizationId };

    if (filters?.read !== undefined) {
      where.read = filters.read;
    }

    // Validate severity filter
    const validSeverities = ['info', 'warning', 'critical'];
    if (filters?.severity && validSeverities.includes(filters.severity)) {
      where.severity = filters.severity;
    }

    const [data, total] = await Promise.all([
      this.db.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.notification.count({ where }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  /**
   * Get a single notification by ID
   */
  async findOne(organizationId: string, id: string) {
    const notification = await this.db.notification.findFirst({
      where: { id, organizationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  /**
   * Get the count of unread notifications for an organization
   */
  async getUnreadCount(organizationId: string): Promise<number> {
    return this.db.notification.count({
      where: {
        organizationId,
        read: false,
        dismissedAt: null,
      },
    });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(organizationId: string, id: string) {
    await this.findOne(organizationId, id);

    const notification = await this.db.notification.update({
      where: { id },
      data: { read: true },
    });

    this.logger.log(`Marked notification ${id} as read`);
    return notification;
  }

  /**
   * Mark all notifications as read for an organization
   */
  async markAllAsRead(organizationId: string) {
    const result = await this.db.notification.updateMany({
      where: { organizationId, read: false },
      data: { read: true },
    });

    this.logger.log(`Marked ${result.count} notifications as read for org ${organizationId}`);
    return { updated: result.count };
  }

  /**
   * Dismiss a notification (soft delete)
   */
  async dismiss(organizationId: string, id: string) {
    await this.findOne(organizationId, id);

    const notification = await this.db.notification.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });

    this.logger.log(`Dismissed notification ${id}`);
    return notification;
  }

  /**
   * Factory helper: Create a device offline notification
   */
  async createDeviceOfflineNotification(
    deviceId: string,
    deviceName: string,
    organizationId: string,
  ) {
    return this.create({
      title: 'Device Offline',
      message: `Device "${deviceName}" has gone offline.`,
      type: 'device_offline',
      severity: 'warning',
      metadata: { deviceId, deviceName },
      organizationId,
    });
  }

  /**
   * Factory helper: Create a device online notification
   */
  async createDeviceOnlineNotification(
    deviceId: string,
    deviceName: string,
    organizationId: string,
  ) {
    return this.create({
      title: 'Device Online',
      message: `Device "${deviceName}" is back online.`,
      type: 'device_online',
      severity: 'info',
      metadata: { deviceId, deviceName },
      organizationId,
    });
  }

  /**
   * Factory helper: Create a content expired notification
   */
  async createContentExpiredNotification(
    contentId: string,
    contentName: string,
    organizationId: string,
  ) {
    return this.create({
      title: 'Content Expired',
      message: `Content "${contentName}" has expired and been removed from playlists.`,
      type: 'content_expired',
      severity: 'warning',
      metadata: { contentId, contentName },
      organizationId,
    });
  }

  /**
   * Factory helper: Create a system notification
   */
  async createSystemNotification(
    title: string,
    message: string,
    organizationId: string,
    severity: 'info' | 'warning' | 'critical' = 'info',
  ) {
    return this.create({
      title,
      message,
      type: 'system',
      severity,
      organizationId,
    });
  }

  /**
   * Delete old dismissed notifications (cleanup job)
   */
  async cleanupOldNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.db.notification.deleteMany({
      where: {
        dismissedAt: { not: null, lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old dismissed notifications`);
    return { deleted: result.count };
  }
}
