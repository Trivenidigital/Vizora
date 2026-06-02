import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OnEvent } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@vizora/database';
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

  constructor(
    private readonly db: DatabaseService,
    private readonly httpService: HttpService,
  ) {}

  private visibleToUserWhere(
    organizationId: string,
    userId: string,
    extra?: Prisma.NotificationWhereInput,
  ): Prisma.NotificationWhereInput {
    return {
      organizationId,
      dismissedAt: null,
      OR: [{ userId: null }, { userId }],
      ...extra,
    };
  }

  private userScopedWhere(
    organizationId: string,
    userId: string,
    extra?: Prisma.NotificationWhereInput,
  ): Prisma.NotificationWhereInput {
    return {
      organizationId,
      OR: [{ userId: null }, { userId }],
      ...extra,
    };
  }

  /**
   * Create a new notification
   */
  async create(data: CreateNotificationDto & { organizationId: string }) {
    // Validate userId belongs to the same organization
    if (data.userId) {
      const user = await this.db.user.findFirst({
        where: { id: data.userId, organizationId: data.organizationId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
    }

    const notification = await this.db.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        severity: data.severity || 'info',
        metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        organizationId: data.organizationId,
        userId: data.userId,
      },
    });

    this.logger.log(`Created notification: ${notification.id} (${notification.type})`);

    // Broadcast to connected dashboard clients via realtime gateway
    await this.broadcastNotification(data.organizationId, notification);

    return notification;
  }

  /**
   * Find all notifications for an organization with pagination and filters
   */
  async findAll(
    organizationId: string,
    userId: string,
    filters?: NotificationFilters,
    pagination?: PaginationDto,
  ) {
    const { page = 1, limit = 20 } = pagination || {};
    const skip = (page - 1) * limit;

    // Build where clause with validated filters
    const where: Prisma.NotificationWhereInput = this.visibleToUserWhere(
      organizationId,
      userId,
    );

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
  async findOne(organizationId: string, userId: string, id: string) {
    const notification = await this.db.notification.findFirst({
      where: this.visibleToUserWhere(organizationId, userId, { id }),
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  /**
   * Get the count of unread notifications for an organization
   */
  async getUnreadCount(organizationId: string, userId: string): Promise<number> {
    return this.db.notification.count({
      where: this.visibleToUserWhere(organizationId, userId, { read: false }),
    });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(organizationId: string, userId: string, id: string) {
    const result = await this.db.notification.updateMany({
      where: this.visibleToUserWhere(organizationId, userId, { id }),
      data: { read: true },
    });
    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }

    const notification = await this.db.notification.findFirst({
      where: this.visibleToUserWhere(organizationId, userId, { id }),
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    this.logger.log(`Marked notification ${id} as read`);
    return notification;
  }

  /**
   * Mark all notifications as read for an organization
   */
  async markAllAsRead(organizationId: string, userId: string) {
    const result = await this.db.notification.updateMany({
      where: this.visibleToUserWhere(organizationId, userId, { read: false }),
      data: { read: true },
    });

    this.logger.log(`Marked ${result.count} notifications as read for org ${organizationId}`);
    return { updated: result.count };
  }

  /**
   * Dismiss a notification (soft delete)
   */
  async dismiss(organizationId: string, userId: string, id: string) {
    const result = await this.db.notification.updateMany({
      where: this.visibleToUserWhere(organizationId, userId, { id }),
      data: { dismissedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }

    const notification = await this.db.notification.findFirst({
      where: this.userScopedWhere(organizationId, userId, { id }),
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    this.logger.log(`Dismissed notification ${id}`);
    return notification;
  }

  // createDeviceOfflineNotification removed in O7 — the rule-driven evaluator
  // (alert-rules/alert-rule.evaluator.ts) now writes Notification rows
  // directly per-recipient. The device.online path still uses the factory
  // helper below — recovery alerts are out of scope for O7 v1.

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
   * Broadcast a notification to connected dashboard clients via the realtime gateway.
   * Non-critical — if it fails, the notification is still persisted and will appear on next poll.
   */
  private async broadcastNotification(organizationId: string, notification: any): Promise<void> {
    try {
      const secret = process.env.INTERNAL_API_SECRET;
      const realtimeUrl = process.env.REALTIME_URL || 'http://localhost:3002';
      if (secret) {
        await firstValueFrom(
          this.httpService.post(
            `${realtimeUrl}/api/notifications/broadcast`,
            { organizationId, notification },
            { headers: { 'x-internal-api-key': secret }, timeout: 3000 },
          ),
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to broadcast notification via WebSocket: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  /**
   * Event listener: device came online (status transition only, not every heartbeat)
   */
  @OnEvent('device.online')
  async handleDeviceOnline(payload: { deviceId: string; deviceName: string; organizationId: string }) {
    try {
      await this.createDeviceOnlineNotification(payload.deviceId, payload.deviceName, payload.organizationId);
    } catch (error) {
      this.logger.warn(`Failed to create device online notification: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  // device.offline handler removed in O7 — replaced by AlertRuleEvaluator
  // (middleware/src/modules/notifications/alert-rules/alert-rule.evaluator.ts).
  // The createDeviceOfflineNotification helper is also dead; the evaluator
  // inlines the notification creation per matched recipient.

  /**
   * Delete old dismissed notifications for a SINGLE org. The orgId
   * parameter is required and the deleteMany is compound-WHERE-scoped
   * so the cleanup can NEVER cross tenants.
   *
   * R10 notifications scout (CRITICAL): the previous signature accepted
   * only `daysOld` and deleted across all orgs in one call — a single
   * stray invocation from a cron, ops script, or admin UI would wipe
   * dismissed notifications for every customer in one statement. Making
   * `organizationId` a required argument makes that misuse impossible
   * to express. The platform-wide cleanup cron (if it exists) should
   * iterate orgs and call this per-org.
   */
  async cleanupOldNotifications(organizationId: string, daysOld: number = 30) {
    if (!organizationId) {
      throw new Error('cleanupOldNotifications requires an organizationId');
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.db.notification.deleteMany({
      where: {
        organizationId,
        dismissedAt: { not: null, lt: cutoffDate },
      },
    });

    this.logger.log(
      `Cleaned up ${result.count} old dismissed notifications for org ${organizationId}`,
    );
    return { deleted: result.count };
  }
}
