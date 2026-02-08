import {
  Controller,
  Get,
  Post,
  Patch,
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
import { Public } from '../auth/decorators/public.decorator';
import { TemplateLibraryService } from './template-library.service';
import { SearchTemplatesDto } from './dto/search-templates.dto';
import { CloneTemplateDto } from './dto/clone-template.dto';

@UseGuards(RolesGuard)
@Controller('template-library')
export class TemplateLibraryController {
  constructor(private readonly templateLibraryService: TemplateLibraryService) {}

  @Get()
  search(@Query() dto: SearchTemplatesDto) {
    return this.templateLibraryService.search(dto);
  }

  @Get('categories')
  getCategories() {
    return this.templateLibraryService.getCategories();
  }

  @Get('featured')
  getFeatured() {
    return this.templateLibraryService.getFeatured();
  }

  @Get('seasonal')
  getSeasonal() {
    return this.templateLibraryService.getSeasonal();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templateLibraryService.findOne(id);
  }

  @Get(':id/preview')
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
  setFeatured(
    @Param('id') id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    return this.templateLibraryService.setFeatured(id, isFeatured);
  }
}
