import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

interface AuditLogFilters {
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(organizationId: string, pagination: PaginationDto, filters: AuditLogFilters) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.userId) where.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [data, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.db.auditLog.count({ where }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }
}
