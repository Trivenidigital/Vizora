import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles('admin')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    const { page, limit, ...filters } = query;
    return this.auditLogService.findAll(organizationId, { page, limit }, filters);
  }
}
