import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { ThumbnailService } from './thumbnail.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly thumbnailService: ThumbnailService,
  ) {}

  @Post()
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createContentDto: CreateContentDto,
  ) {
    return this.contentService.create(organizationId, createContentDto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.contentService.findAll(organizationId, pagination, { type, status });
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateContentDto: UpdateContentDto,
  ) {
    return this.contentService.update(organizationId, id, updateContentDto);
  }

  @Post(':id/thumbnail')
  @HttpCode(HttpStatus.OK)
  async generateThumbnail(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    // Get content
    const content = await this.contentService.findOne(organizationId, id);
    
    if (content.type !== 'image') {
      return { message: 'Thumbnail generation only supported for images', thumbnail: null };
    }

    // Generate thumbnail from URL
    const thumbnailUrl = await this.thumbnailService.generateThumbnailFromUrl(
      content.id,
      content.url,
    );

    // Update content with thumbnail URL
    await this.contentService.update(organizationId, id, { thumbnail: thumbnailUrl } as any);

    return { thumbnail: thumbnailUrl };
  }

  @Post(':id/archive')
  archive(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.archive(organizationId, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.remove(organizationId, id);
  }
}
