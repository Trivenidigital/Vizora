import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AlertRulesService } from './alert-rules.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { ListAlertRulesQueryDto } from './dto/list-alert-rules-query.dto';

/**
 * O7 — CRUD API for configurable downtime alert rules.
 *
 * RBAC:
 *   - POST (create), GET (list/detail) — any logged-in org user
 *   - PATCH, DELETE, recipient mutations — admin only
 *
 * The admin gate on mutations prevents a non-admin from disabling a
 * critical rule (PATCH isActive=false) or routing alerts to themselves
 * via addRecipient — both effective rule subversion.
 */
@UseGuards(RolesGuard)
@Controller('notifications/alert-rules')
export class AlertRulesController {
  constructor(private readonly service: AlertRulesService) {}

  @Post()
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateAlertRuleDto,
  ) {
    return this.service.create(organizationId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ListAlertRulesQueryDto,
  ) {
    return this.service.findAll(organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.service.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.service.update(organizationId, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.service.remove(organizationId, id);
  }

  @Post(':id/recipients')
  @Roles('admin')
  addRecipient(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: CreateRecipientDto,
  ) {
    return this.service.addRecipient(organizationId, id, dto);
  }

  @Delete(':id/recipients/:recipientId')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRecipient(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Param('recipientId', ParseIdPipe) recipientId: string,
  ) {
    return this.service.removeRecipient(organizationId, id, recipientId);
  }
}
