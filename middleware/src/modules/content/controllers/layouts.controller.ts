import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ContentService } from '../content.service';
import { CreateLayoutDto } from '../dto/create-layout.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('content/layouts')
export class LayoutsController {
  constructor(private readonly contentService: ContentService) {}

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
    @Param('id') id: string,
    @Body() dto: Partial<CreateLayoutDto>,
  ) {
    return this.contentService.updateLayout(organizationId, id, dto);
  }

  @Get(':id/resolved')
  @Roles('admin', 'manager', 'viewer')
  getResolvedLayout(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.getResolvedLayout(organizationId, id);
  }
}
