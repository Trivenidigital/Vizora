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
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { PreviewTemplateDto } from '../dto/preview-template.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SkipOutputSanitize } from '../../common/interceptors/sanitize.interceptor';

@UseGuards(RolesGuard)
@Controller('content/templates')
export class TemplatesController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @Roles('admin', 'manager')
  createTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.contentService.createTemplate(organizationId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  updateTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.contentService.updateTemplate(organizationId, id, dto);
  }

  @Post('preview')
  @Roles('admin', 'manager')
  @SkipOutputSanitize()
  @HttpCode(HttpStatus.OK)
  previewTemplate(@Body() dto: PreviewTemplateDto) {
    return this.contentService.previewTemplate(dto);
  }

  @Post('validate')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  validateTemplate(@Body('templateHtml') templateHtml: string) {
    return this.contentService.validateTemplateHtml(templateHtml);
  }

  @Get(':id/rendered')
  @Roles('admin', 'manager')
  @SkipOutputSanitize()
  getRenderedTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.getRenderedTemplate(organizationId, id);
  }

  @Post(':id/refresh')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  refreshTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.triggerTemplateRefresh(organizationId, id);
  }
}
