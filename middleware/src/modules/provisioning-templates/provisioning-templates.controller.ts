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
  UseGuards,
} from '@nestjs/common';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProvisioningTemplatesService } from './provisioning-templates.service';
import { CreateProvisioningTemplateDto } from './dto/create-provisioning-template.dto';
import { UpdateProvisioningTemplateDto } from './dto/update-provisioning-template.dto';

/**
 * O6 — Provisioning template CRUD. RBAC: mutations require admin; GETs
 * open to any logged-in org user (matches O4/O7 controller pattern).
 */
@UseGuards(RolesGuard)
@Controller('provisioning-templates')
export class ProvisioningTemplatesController {
  constructor(private readonly service: ProvisioningTemplatesService) {}

  @Post()
  @Roles('admin')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateProvisioningTemplateDto,
  ) {
    return this.service.create(organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser('organizationId') organizationId: string) {
    return this.service.findAll(organizationId);
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
    @Body() dto: UpdateProvisioningTemplateDto,
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
}
