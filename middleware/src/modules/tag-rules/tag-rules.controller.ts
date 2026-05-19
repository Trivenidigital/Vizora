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
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TagRulesService } from './tag-rules.service';
import { CreateTagRuleDto } from './dto/create-tag-rule.dto';
import { UpdateTagRuleDto } from './dto/update-tag-rule.dto';
import { ListTagRulesQueryDto } from './dto/list-tag-rules-query.dto';

/**
 * O4 — CRUD API for tag-assignment rules.
 *
 * RBAC (same shape as O7 alert-rules):
 *   - GET endpoints: any logged-in org user
 *   - POST / PATCH / DELETE / re-evaluate: @Roles('admin')
 *
 * POST is admin-gated because rule creation directly affects which
 * playlist plays on every display matching the tag — a non-admin should
 * not be able to globally redirect content.
 */
@UseGuards(RolesGuard)
@Controller('tag-rules')
export class TagRulesController {
  constructor(private readonly service: TagRulesService) {}

  @Post()
  @Roles('admin')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateTagRuleDto,
  ) {
    return this.service.create(organizationId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ListTagRulesQueryDto,
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
    @Body() dto: UpdateTagRuleDto,
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

  @Post(':id/re-evaluate')
  @Roles('admin')
  reEvaluate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.service.reEvaluateRule(organizationId, id);
  }
}
