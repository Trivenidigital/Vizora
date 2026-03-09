import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ContentService } from '../content.service';
import { CreateLayoutDto } from '../dto/create-layout.dto';
import { UpdateLayoutDto } from '../dto/update-layout.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('content/layouts')
export class LayoutsController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @Roles('admin', 'manager', 'viewer')
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.contentService.findAllLayouts(organizationId, pagination);
  }

  @Get('presets')
  @Roles('admin', 'manager', 'viewer')
  getLayoutPresets() {
    return this.contentService.getLayoutPresets();
  }

  @Post()
  @Roles('admin', 'manager')
  createLayout(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateLayoutDto,
  ) {
    return this.contentService.createLayout(organizationId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  updateLayout(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLayoutDto,
  ) {
    return this.contentService.updateLayout(organizationId, id, dto);
  }

  @Get(':id/resolved')
  @Roles('admin', 'manager', 'viewer')
  getResolvedLayout(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contentService.getResolvedLayout(organizationId, id);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  deleteLayout(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contentService.remove(organizationId, id);
  }
}
