import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { TemplateLibraryService } from './template-library.service';
import { SkipOutputSanitize } from '../common/interceptors/sanitize.interceptor';
import { SearchTemplatesDto } from './dto/search-templates.dto';
import { CloneTemplateDto } from './dto/clone-template.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@UseGuards(RolesGuard)
@Controller('template-library')
export class TemplateLibraryController {
  constructor(private readonly templateLibraryService: TemplateLibraryService) {}

  @Get()
  @Roles('admin', 'manager', 'viewer')
  search(@Query() dto: SearchTemplatesDto) {
    return this.templateLibraryService.search(dto);
  }

  @Get('categories')
  @Roles('admin', 'manager', 'viewer')
  getCategories() {
    return this.templateLibraryService.getCategories();
  }

  @Get('featured')
  @Roles('admin', 'manager', 'viewer')
  getFeatured() {
    return this.templateLibraryService.getFeatured();
  }

  @Get('seasonal')
  @Roles('admin', 'manager', 'viewer')
  getSeasonal() {
    return this.templateLibraryService.getSeasonal();
  }

  @Post()
  @Roles('admin')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templateLibraryService.createTemplateForOrg(dto, organizationId);
  }

  @Get(':id')
  @Roles('admin', 'manager', 'viewer')
  findOne(@Param('id') id: string) {
    return this.templateLibraryService.findOne(id);
  }

  @Get(':id/preview')
  @Roles('admin', 'manager', 'viewer')
  @SkipOutputSanitize()
  getPreview(@Param('id') id: string) {
    return this.templateLibraryService.getPreview(id);
  }

  @Post(':id/clone')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  clone(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CloneTemplateDto,
  ) {
    return this.templateLibraryService.clone(id, organizationId, dto);
  }

  @Patch(':id/featured')
  @Roles('admin')
  @UseGuards(SuperAdminGuard)
  setFeatured(
    @Param('id') id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    return this.templateLibraryService.setFeatured(id, isFeatured);
  }

  @Patch(':id')
  @Roles('admin')
  @UseGuards(SuperAdminGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateLibraryService.updateTemplate(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.templateLibraryService.deleteTemplate(id);
  }
}
