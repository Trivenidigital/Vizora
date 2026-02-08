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
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ContentService } from './content.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { StorageService } from '../storage/storage.service';
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

// Prefix used to identify MinIO-stored content
const MINIO_URL_PREFIX = 'minio://';

@UseGuards(RolesGuard)
@Controller('content')
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly thumbnailService: ThumbnailService,
    private readonly fileValidationService: FileValidationService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @Roles('admin', 'manager')
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createContentDto: CreateContentDto,
  ) {
    // Validate URL if provided
    if (createContentDto.url) {
      await this.fileValidationService.validateUrl(createContentDto.url);
    }
    return this.contentService.create(organizationId, createContentDto);
  }

  @Post('upload')
  @Roles('admin', 'manager')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
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

    let fileUrl: string;
    const filename = `${validation.hash}-${safeFilename}`;

    // Try MinIO first, fall back to local storage
    if (this.storageService.isMinioAvailable()) {
      try {
        const objectKey = this.storageService.generateObjectKey(
          organizationId,
          validation.hash,
          safeFilename,
        );
        await this.storageService.uploadFile(file.buffer, objectKey, file.mimetype);
        // Store with minio:// prefix to identify MinIO-stored content
        fileUrl = `${MINIO_URL_PREFIX}${objectKey}`;
        this.logger.debug(`File uploaded to MinIO: ${objectKey}`);
      } catch (error) {
        this.logger.warn(`MinIO upload failed, falling back to local storage: ${error}`);
        // Fall back to local storage
        fileUrl = await this.saveFileLocally(filename, file.buffer);
      }
    } else {
      // MinIO not available, use local storage
      fileUrl = await this.saveFileLocally(filename, file.buffer);
    }

    // Determine the content type from the file mimetype
    const contentType = type || (file.mimetype.startsWith('video/') ? 'video' :
                                 file.mimetype.startsWith('image/') ? 'image' :
                                 file.mimetype === 'application/pdf' ? 'pdf' : 'url');

    // Create content record (fileHash stored in metadata since not in schema)
    const content = await this.contentService.create(organizationId, {
      name: name || safeFilename,
      type: contentType,
      url: fileUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      metadata: { fileHash: validation.hash },
    } as any);

    // Generate thumbnail using the real content ID (only once, after creation)
    if (contentType === 'image') {
      try {
        const thumbnailUrl = await this.thumbnailService.generateThumbnail(
          content.id,
          file.buffer,
          file.mimetype,
        );
        await this.contentService.update(organizationId, content.id, { thumbnail: thumbnailUrl } as any);
        content.thumbnail = thumbnailUrl;
        this.logger.debug(`Thumbnail generated: ${thumbnailUrl}`);
      } catch (error) {
        this.logger.warn(`Thumbnail generation failed during upload: ${error}`);
        // Continue without thumbnail — not a fatal error
      }
    }

    return {
      success: true,
      content,
      fileHash: validation.hash,
    };
  }

  /**
   * Helper to save file to local uploads directory
   */
  private async saveFileLocally(filename: string, buffer: Buffer): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);

    const baseUrl = process.env.API_BASE_URL
      || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('API_BASE_URL must be set in production'); })() : 'http://localhost:3000');
    return `${baseUrl}/uploads/${filename}`;
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('templateOrientation') templateOrientation?: string,
  ) {
    return this.contentService.findAll(organizationId, pagination, { type, status, templateOrientation });
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.findOne(organizationId, id);
  }

  /**
   * Get a download URL for content
   * For MinIO-stored content, generates a presigned URL
   * For local content, returns the direct URL
   */
  @Get(':id/download')
  async getDownloadUrl(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query('expirySeconds') expirySeconds?: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const content = await this.contentService.findOne(organizationId, id);

    if (!content.url) {
      throw new NotFoundException('Content has no associated file');
    }

    // Check if content is stored in MinIO
    if (content.url.startsWith(MINIO_URL_PREFIX)) {
      const objectKey = content.url.substring(MINIO_URL_PREFIX.length);
      const expiry = expirySeconds ? parseInt(expirySeconds, 10) : 3600;

      if (!this.storageService.isMinioAvailable()) {
        throw new BadRequestException('Storage service is currently unavailable');
      }

      try {
        const presignedUrl = await this.storageService.getPresignedUrl(objectKey, expiry);
        return {
          url: presignedUrl,
          expiresIn: expiry,
        };
      } catch (error) {
        this.logger.error(`Failed to generate presigned URL for ${id}: ${error}`);
        throw new BadRequestException('Failed to generate download URL');
      }
    }

    // For local/external URLs, return directly (no expiration)
    return {
      url: content.url,
      expiresIn: 0, // 0 indicates no expiration
    };
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

    let thumbnailUrl: string;

    // For MinIO-stored content, fetch the object directly via StorageService
    // to avoid SSRF validation blocking internal MinIO URLs
    if (content.url.startsWith(MINIO_URL_PREFIX)) {
      const objectKey = content.url.substring(MINIO_URL_PREFIX.length);
      if (!this.storageService.isMinioAvailable()) {
        throw new BadRequestException('Storage service is currently unavailable');
      }
      const stream = await this.storageService.getObject(objectKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      thumbnailUrl = await this.thumbnailService.generateThumbnail(
        content.id,
        buffer,
        content.mimeType || 'image/jpeg',
      );
    } else {
      // For external URLs, fetch via URL (with SSRF protection)
      thumbnailUrl = await this.thumbnailService.generateThumbnailFromUrl(
        content.id,
        content.url,
      );
    }

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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
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

    let fileUrl: string;
    const filename = `${validation.hash}-${safeFilename}`;

    // Try MinIO first, fall back to local storage
    if (this.storageService.isMinioAvailable()) {
      try {
        const objectKey = this.storageService.generateObjectKey(
          organizationId,
          validation.hash,
          safeFilename,
        );
        await this.storageService.uploadFile(file.buffer, objectKey, file.mimetype);
        fileUrl = `${MINIO_URL_PREFIX}${objectKey}`;
        this.logger.debug(`Replacement file uploaded to MinIO: ${objectKey}`);
      } catch (error) {
        this.logger.warn(`MinIO upload failed for replacement, falling back to local: ${error}`);
        fileUrl = await this.saveFileLocally(filename, file.buffer);
      }
    } else {
      fileUrl = await this.saveFileLocally(filename, file.buffer);
    }

    // Determine thumbnail for images
    const contentType = file.mimetype.startsWith('video/') ? 'video' :
                       file.mimetype.startsWith('image/') ? 'image' :
                       file.mimetype === 'application/pdf' ? 'pdf' : 'url';

    // Generate thumbnail directly from buffer for images
    let thumbnailUrl: string | undefined;
    if (contentType === 'image') {
      try {
        thumbnailUrl = await this.thumbnailService.generateThumbnail(
          id,
          file.buffer,
          file.mimetype,
        );
      } catch (error) {
        this.logger.warn(`Thumbnail generation failed during replace: ${error}`);
      }
    }

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
  async setExpiration(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { expiresAt: string; replacementContentId?: string },
  ) {
    const expiresAtDate = new Date(body.expiresAt);
    if (isNaN(expiresAtDate.getTime())) {
      throw new BadRequestException('Invalid expiresAt date');
    }
    if (expiresAtDate <= new Date()) {
      throw new BadRequestException('expiresAt must be in the future');
    }
    return this.contentService.setExpiration(
      organizationId,
      id,
      expiresAtDate,
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
