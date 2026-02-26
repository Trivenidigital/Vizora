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
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresSubscription } from '../billing/decorators/requires-subscription.decorator';
import { ContentService } from './content.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';
import { StorageService } from '../storage/storage.service';
import { StorageQuotaService } from '../storage/storage-quota.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ReplaceFileDto } from './dto/replace-file.dto';
import { SetContentExpirationDto } from './dto/set-content-expiration.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';

// Prefix used to identify MinIO-stored content
const MINIO_URL_PREFIX = 'minio://';

@UseGuards(RolesGuard)
@RequiresSubscription()
@Controller('content')
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly thumbnailService: ThumbnailService,
    private readonly fileValidationService: FileValidationService,
    private readonly storageService: StorageService,
    private readonly storageQuotaService: StorageQuotaService,
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

    // Check storage quota before processing
    await this.storageQuotaService.checkQuota(organizationId, file.size);

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
        fileUrl = await this.saveFileLocally(organizationId, filename, file.buffer);
      }
    } else {
      // MinIO not available, use local storage
      fileUrl = await this.saveFileLocally(organizationId, filename, file.buffer);
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
    } as CreateContentDto);

    // Track storage usage after successful upload
    await this.storageQuotaService.incrementUsage(organizationId, file.size);

    // Generate thumbnail in background (fire-and-forget to avoid blocking upload response)
    if (contentType === 'image') {
      this.thumbnailService.generateThumbnail(
        content.id,
        file.buffer,
        file.mimetype,
      ).then(async (thumbnailUrl) => {
        await this.contentService.update(organizationId, content.id, { thumbnail: thumbnailUrl });
        this.logger.debug(`Thumbnail generated in background: ${thumbnailUrl}`);
      }).catch((error) => {
        this.logger.warn(`Background thumbnail generation failed: ${error}`);
      });
    }

    return {
      content,
      fileHash: validation.hash,
    };
  }

  /**
   * Helper to save file to local uploads directory, scoped by organizationId.
   */
  private async saveFileLocally(organizationId: string, filename: string, buffer: Buffer): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', organizationId);
    try {
      await fs.promises.access(uploadsDir);
    } catch {
      await fs.promises.mkdir(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const baseUrl = process.env.API_BASE_URL
      || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('API_BASE_URL must be set in production'); })() : 'http://localhost:3000');
    return `${baseUrl}/uploads/${organizationId}/${filename}`;
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
      const expiry = Math.min(parseInt(expirySeconds, 10) || 3600, 86400);

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
    await this.contentService.update(organizationId, id, { thumbnail: thumbnailUrl });

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

    // Get existing content to determine net storage change
    const existingContent = await this.contentService.findOne(organizationId, id);
    const oldFileSize = existingContent.fileSize || 0;
    const netIncrease = file.size - oldFileSize;

    // Check storage quota only if net storage increases
    if (netIncrease > 0) {
      await this.storageQuotaService.checkQuota(organizationId, netIncrease);
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
        fileUrl = await this.saveFileLocally(organizationId, filename, file.buffer);
      }
    } else {
      fileUrl = await this.saveFileLocally(organizationId, filename, file.buffer);
    }

    // Determine thumbnail for images
    const contentType = file.mimetype.startsWith('video/') ? 'video' :
                       file.mimetype.startsWith('image/') ? 'image' :
                       file.mimetype === 'application/pdf' ? 'pdf' : 'url';

    const content = await this.contentService.replaceFile(
      organizationId,
      id,
      fileUrl,
      {
        name: replaceFileDto.name,
        keepBackup: replaceFileDto.keepBackup,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    );

    // Update storage usage: adjust for the net difference
    if (netIncrease > 0) {
      await this.storageQuotaService.incrementUsage(organizationId, netIncrease);
    } else if (netIncrease < 0) {
      await this.storageQuotaService.decrementUsage(organizationId, Math.abs(netIncrease));
    }

    // Generate thumbnail in background (fire-and-forget)
    if (contentType === 'image') {
      this.thumbnailService.generateThumbnail(
        id,
        file.buffer,
        file.mimetype,
      ).then(async (thumbnailUrl) => {
        await this.contentService.update(organizationId, id, { thumbnail: thumbnailUrl });
        this.logger.debug(`Replacement thumbnail generated in background: ${thumbnailUrl}`);
      }).catch((error) => {
        this.logger.warn(`Background thumbnail generation failed during replace: ${error}`);
      });
    }

    return {
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
    @Body() body: SetContentExpirationDto,
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
}
