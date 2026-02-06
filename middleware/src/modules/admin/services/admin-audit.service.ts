import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface LogActionParams {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  adminUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Log an admin action
   */
  async log(params: LogActionParams) {
    const { adminUserId, action, targetType, targetId, details, ipAddress, userAgent } = params;

    const auditLog = await this.db.adminAuditLog.create({
      data: {
        adminUserId,
        action,
        targetType,
        targetId,
        details,
        ipAddress,
        userAgent,
      },
    });

    this.logger.debug(
      `Admin action: ${action} by ${adminUserId}${targetType ? ` on ${targetType}:${targetId}` : ''}`
    );

    return auditLog;
  }

  /**
   * Find audit logs with filters and pagination
   */
  async findAll(filters: AuditLogFilters = {}) {
    const { adminUserId, action, targetType, targetId, startDate, endDate, page = 1, limit = 50 } = filters;

    const where: Record<string, unknown> = {};

    if (adminUserId) {
      where.adminUserId = adminUserId;
    }

    if (action) {
      where.action = action;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (targetId) {
      where.targetId = targetId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = startDate;
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.db.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.adminAuditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find audit logs by admin user
   */
  async findByAdmin(adminUserId: string, options?: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = options ?? {};
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.db.adminAuditLog.findMany({
        where: { adminUserId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.adminAuditLog.count({ where: { adminUserId } }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find audit logs for a specific target entity
   */
  async findByTarget(targetType: string, targetId: string, options?: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = options ?? {};
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.db.adminAuditLog.findMany({
        where: { targetType, targetId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.adminAuditLog.count({ where: { targetType, targetId } }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
