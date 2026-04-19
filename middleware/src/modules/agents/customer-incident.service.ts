import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateCustomerIncidentDto } from './dto/create-customer-incident.dto';

/**
 * Sole writer to `CustomerIncident` (D2).
 * All queries scoped by `organizationId` (D8, D14).
 */
@Injectable()
export class CustomerIncidentService {
  constructor(private readonly db: DatabaseService) {}

  async create(organizationId: string, dto: CreateCustomerIncidentDto) {
    return this.db.customerIncident.create({
      data: {
        organizationId,
        agent: dto.agent,
        type: dto.type,
        severity: dto.severity,
        target: dto.target,
        targetId: dto.targetId,
        message: dto.message,
        remediation: dto.remediation,
      },
    });
  }

  async resolve(orgId: string, id: string) {
    return this.db.customerIncident.updateMany({
      where: { id, organizationId: orgId },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
  }

  async listOpenForOrg(orgId: string, page = 1, limit = 10) {
    const safeLimit = Math.max(1, Math.min(100, limit));
    const safePage = Math.max(1, page);
    const [incidents, total] = await Promise.all([
      this.db.customerIncident.findMany({
        where: { organizationId: orgId, status: 'open' },
        orderBy: { detectedAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.db.customerIncident.count({
        where: { organizationId: orgId, status: 'open' },
      }),
    ]);
    return { incidents, page: safePage, limit: safeLimit, total };
  }
}
