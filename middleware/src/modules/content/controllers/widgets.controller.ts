import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ContentService } from '../content.service';
import { CreateWidgetDto } from '../dto/create-widget.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('content/widgets')
export class WidgetsController {
  constructor(private readonly contentService: ContentService) {}

  @Get('types')
  getWidgetTypes() {
    return this.contentService.getWidgetTypes();
  }

  @Post()
  @Roles('admin', 'manager')
  createWidget(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateWidgetDto,
  ) {
    return this.contentService.createWidget(organizationId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  updateWidget(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateWidgetDto>,
  ) {
    return this.contentService.updateWidget(organizationId, id, dto);
  }

  @Post(':id/refresh')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  refreshWidget(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.refreshWidget(organizationId, id);
  }
}
