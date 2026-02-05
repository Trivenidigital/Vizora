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
  UploadedFile,
  UseInterceptors,
  UseGuards,
  MaxFileSizeValidator,
  ParseFilePipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ContentService } from './content.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ReplaceFileDto } from './dto/replace-file.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { BulkUpdateDto, BulkArchiveDto, BulkRestoreDto, BulkDeleteDto, BulkTagDto, BulkDurationDto } from './dto/bulk-operations.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';

@UseGuards(RolesGuard)
@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly thumbnailService: ThumbnailService,
    private readonly fileValidationService: FileValidationService,
  ) {}

  @Post()
  @Roles('admin', 'manager')
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createContentDto: CreateContentDto,
  ) {
    // Validate URL if provided
    if (createContentDto.url) {
      this.fileValidationService.validateUrl(createContentDto.url);
    }
    return this.contentService.create(organizationId, createContentDto);
  }

  @Post('upload')
  @Roles('admin', 'manager')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser('organizationId') organizationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('type') type?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file using magic numbers, size, etc.
    const validation = await this.fileValidationService.validateFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Sanitize filename
    const safeFilename = this.fileValidationService.sanitizeFilename(
      file.originalname,
    );

    // Save file to local uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${validation.hash}-${safeFilename}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    // Use full URL so Electron app can access it via HTTP
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const fileUrl = `${baseUrl}/uploads/${filename}`;

    // Determine the content type from the file mimetype
    const contentType = type || (file.mimetype.startsWith('video/') ? 'video' :
                                 file.mimetype.startsWith('image/') ? 'image' :
                                 file.mimetype === 'application/pdf' ? 'pdf' : 'url');

    // For images, use the image URL as the thumbnail
    const thumbnailUrl = contentType === 'image' ? fileUrl : undefined;

    // Create content record (fileHash stored in metadata since not in schema)
    const content = await this.contentService.create(organizationId, {
      name: name || safeFilename,
      type: contentType,
      url: fileUrl,
      thumbnail: thumbnailUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      metadata: { fileHash: validation.hash },
    } as any);

    return {
      success: true,
      content,
      fileHash: validation.hash,
    };
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
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateContentDto: UpdateContentDto,
  ) {
    return this.contentService.update(organizationId, id, updateContentDto);
  }

  @Post(':id/thumbnail')
  @Roles('admin', 'manager')
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
  @Roles('admin', 'manager')
  archive(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.archive(organizationId, id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.remove(organizationId, id);
  }

  // ============================================================================
  // FILE REPLACEMENT
  // ============================================================================

  @Post(':id/replace')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async replaceFile(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() replaceFileDto: ReplaceFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file
    const validation = await this.fileValidationService.validateFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Sanitize filename
    const safeFilename = this.fileValidationService.sanitizeFilename(
      file.originalname,
    );

    // Save file to local uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${validation.hash}-${safeFilename}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const fileUrl = `${baseUrl}/uploads/${filename}`;

    // Determine thumbnail for images
    const contentType = file.mimetype.startsWith('video/') ? 'video' :
                       file.mimetype.startsWith('image/') ? 'image' :
                       file.mimetype === 'application/pdf' ? 'pdf' : 'url';
    const thumbnailUrl = contentType === 'image' ? fileUrl : undefined;

    const content = await this.contentService.replaceFile(
      organizationId,
      id,
      fileUrl,
      {
        name: replaceFileDto.name,
        keepBackup: replaceFileDto.keepBackup,
        thumbnail: thumbnailUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    );

    return {
      success: true,
      content,
      fileHash: validation.hash,
    };
  }

  @Get(':id/versions')
  getVersionHistory(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.getVersionHistory(organizationId, id);
  }

  @Post(':id/restore')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  restore(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.restore(organizationId, id);
  }

  // ============================================================================
  // CONTENT EXPIRATION
  // ============================================================================

  @Patch(':id/expiration')
  @Roles('admin', 'manager')
  setExpiration(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { expiresAt: string; replacementContentId?: string },
  ) {
    return this.contentService.setExpiration(
      organizationId,
      id,
      new Date(body.expiresAt),
      body.replacementContentId,
    );
  }

  @Delete(':id/expiration')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  clearExpiration(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.clearExpiration(organizationId, id);
  }

  // ============================================================================
  // CONTENT TEMPLATES
  // ============================================================================

  @Post('templates')
  @Roles('admin', 'manager')
  createTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.contentService.createTemplate(organizationId, dto);
  }

  @Patch('templates/:id')
  @Roles('admin', 'manager')
  updateTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.contentService.updateTemplate(organizationId, id, dto);
  }

  @Post('templates/preview')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  previewTemplate(@Body() dto: PreviewTemplateDto) {
    return this.contentService.previewTemplate(dto);
  }

  @Post('templates/validate')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  validateTemplate(@Body() body: { templateHtml: string }) {
    return this.contentService.validateTemplateHtml(body.templateHtml);
  }

  @Get('templates/:id/rendered')
  @Roles('admin', 'manager')
  getRenderedTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.getRenderedTemplate(organizationId, id);
  }

  @Post('templates/:id/refresh')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  refreshTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.triggerTemplateRefresh(organizationId, id);
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  @Post('bulk/update')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkUpdate(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkUpdateDto,
  ) {
    return this.contentService.bulkUpdate(organizationId, dto);
  }

  @Post('bulk/archive')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkArchive(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkArchiveDto,
  ) {
    return this.contentService.bulkArchive(organizationId, dto);
  }

  @Post('bulk/restore')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkRestore(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkRestoreDto,
  ) {
    return this.contentService.bulkRestore(organizationId, dto);
  }

  @Post('bulk/delete')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  bulkDelete(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkDeleteDto,
  ) {
    return this.contentService.bulkDelete(organizationId, dto);
  }

  @Post('bulk/tags')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkAddTags(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkTagDto,
  ) {
    return this.contentService.bulkAddTags(organizationId, dto);
  }

  @Post('bulk/duration')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  bulkSetDuration(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkDurationDto,
  ) {
    return this.contentService.bulkSetDuration(organizationId, dto);
  }
}
