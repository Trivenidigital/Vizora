import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ParseIdPipe } from '../../common/pipes/parse-id.pipe';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ContentService } from '../content.service';
import { CreateWidgetDto } from '../dto/create-widget.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('content/widgets')
export class WidgetsController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @Roles('admin', 'manager', 'viewer')
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.contentService.findAllWidgets(organizationId, pagination);
  }

  @Get('types')
  @Roles('admin', 'manager', 'viewer')
  getWidgetTypes() {
    return this.contentService.getWidgetTypes();
  }

  @Get('weather/preview')
  @Roles('admin', 'manager', 'viewer')
  getWeatherPreview(
    @Query('location') location: string,
    @Query('units') units: string = 'metric',
  ) {
    // Whitelist units to prevent parameter injection (e.g., "metric&appid=STOLEN")
    if (!['metric', 'imperial', 'standard'].includes(units)) {
      units = 'metric';
    }
    // Sanitize location to prevent URL injection
    const sanitizedLocation = encodeURIComponent(location || 'New York');
    return this.contentService.getWeatherPreview(decodeURIComponent(sanitizedLocation), units);
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
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: Partial<CreateWidgetDto>,
  ) {
    return this.contentService.updateWidget(organizationId, id, dto);
  }

  @Post(':id/refresh')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  refreshWidget(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.contentService.refreshWidget(organizationId, id);
  }
}
