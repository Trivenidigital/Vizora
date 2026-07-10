import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
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
import { ContentQueryDto } from './dto/content-query.dto';
import { FlagContentDto } from './dto/flag-content.dto';
import {
  SubmitForApprovalDto,
  ApproveContentDto,
  RejectFromApprovalDto,
} from './dto/approval.dto';
import { ReviewContentDto } from './dto/review-content.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { getOwnedMinioObjectKey, MINIO_URL_PREFIX } from '../storage/minio-object-key';
import { SkipEnvelope } from '../common/interceptors/response-envelope.interceptor';
import { SkipOutputSanitize } from '../common/interceptors/sanitize.interceptor';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

const MAX_CONTENT_UPLOAD_SIZE = 100 * 1024 * 1024;
const CONTENT_UPLOAD_TMP_ROOT = path.join(os.tmpdir(), 'vizora-content-uploads');

const contentUploadStorage = diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdir(CONTENT_UPLOAD_TMP_ROOT, { recursive: true }, (error) => {
      callback(error, CONTENT_UPLOAD_TMP_ROOT);
    });
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname)
      .toLowerCase()
      .replace(/[^.\w-]/g, '');
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

const CONTENT_UPLOAD_INTERCEPTOR_OPTIONS = {
  storage: contentUploadStorage,
  limits: { fileSize: MAX_CONTENT_UPLOAD_SIZE },
};

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
  @HttpCode(HttpStatus.CREATED)
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

  // 30/min: the now-LIVE override (PD-4) must clear the dashboard's own bulk-upload
  // cap (MAX_UPLOAD_QUEUE_ITEMS=10, BULK_UPLOAD_CONCURRENCY=3) plus retries and
  // back-to-back batches — 10/min would 429 a single legitimate batch + a retry.
  // (Follow-up: key per-org/user instead of per-IP so shared-NAT admins don't collide.)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('upload')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', CONTENT_UPLOAD_INTERCEPTOR_OPTIONS))
  async uploadFile(
    @CurrentUser('organizationId') organizationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('type') type?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const tempPath = this.getUploadedTempPath(file);
    let tempPathOwnedByThumbnail = false;
    let uploadedObjectKey: string | null = null;
    let quotaReserved = false;

    try {
      const validation = await this.validateUploadedFile(file, tempPath);
      const safeFilename = this.fileValidationService.sanitizeFilename(
        file.originalname,
      );
      const filename = `${validation.hash}-${safeFilename}`;
      let fileUrl: string;

      await this.storageQuotaService.reserveQuota(organizationId, file.size);
      quotaReserved = true;

      // Try MinIO first. In production, fail closed instead of creating
      // unreachable /uploads content when object storage is unhealthy.
      if (this.storageService.isMinioAvailable()) {
        const objectKey = this.storageService.generateObjectKey(
          organizationId,
          validation.hash,
          safeFilename,
        );
        await this.uploadToMinio(file, tempPath, objectKey);
        uploadedObjectKey = objectKey;
        // Store with minio:// prefix to identify MinIO-stored content
        fileUrl = `${MINIO_URL_PREFIX}${objectKey}`;
        this.logger.debug(`File uploaded to MinIO: ${objectKey}`);
      } else if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Storage service is currently unavailable');
      } else {
        // Development fallback only; production middleware no longer serves
        // /uploads, so accepting this path there would create dead content.
        fileUrl = await this.saveFileLocallyFromUpload(organizationId, filename, file, tempPath);
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

      // Generate thumbnail in background (fire-and-forget to avoid blocking upload response)
      if (contentType === 'image') {
        tempPathOwnedByThumbnail = this.scheduleThumbnailGeneration(
          organizationId,
          content.id,
          file,
          tempPath,
          'Background thumbnail generation failed',
          'Thumbnail generated in background',
        );
      }

      return {
        content,
        fileHash: validation.hash,
      };
    } catch (error) {
      let canReleaseQuota = true;
      if (uploadedObjectKey) {
        try {
          await this.storageService.deleteFile(uploadedObjectKey);
        } catch (deleteError) {
          canReleaseQuota = false;
          this.logger.warn(`Failed to clean up uploaded object after upload failure: ${deleteError}`);
        }
      }
      if (canReleaseQuota && quotaReserved) {
        await this.releaseQuotaReservation(organizationId, file.size);
      }
      throw error;
    } finally {
      if (tempPath && !tempPathOwnedByThumbnail) {
        await this.cleanupTempUpload(tempPath);
      }
    }
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

  private async saveFileLocallyFromPath(
    organizationId: string,
    filename: string,
    filePath: string,
  ): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', organizationId);
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const destination = path.join(uploadsDir, filename);
    await fs.promises.copyFile(filePath, destination);

    const baseUrl = process.env.API_BASE_URL
      || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('API_BASE_URL must be set in production'); })() : 'http://localhost:3000');
    return `${baseUrl}/uploads/${organizationId}/${filename}`;
  }

  private async saveFileLocallyFromUpload(
    organizationId: string,
    filename: string,
    file: Express.Multer.File,
    tempPath?: string,
  ): Promise<string> {
    if (tempPath) {
      return this.saveFileLocallyFromPath(organizationId, filename, tempPath);
    }

    if (!file.buffer) {
      throw new BadRequestException('Uploaded file is missing content');
    }

    return this.saveFileLocally(organizationId, filename, file.buffer);
  }

  private getUploadedTempPath(file: Express.Multer.File): string | undefined {
    const uploadPath = (file as Express.Multer.File & { path?: string }).path;
    if (!uploadPath) {
      return undefined;
    }

    const resolvedPath = path.resolve(uploadPath);
    if (!this.isPathInsideUploadTempRoot(resolvedPath)) {
      throw new BadRequestException('Invalid upload temp file');
    }

    return resolvedPath;
  }

  private isPathInsideUploadTempRoot(filePath: string): boolean {
    const root = path.resolve(CONTENT_UPLOAD_TMP_ROOT);
    const resolvedPath = path.resolve(filePath);
    return resolvedPath === root || resolvedPath.startsWith(`${root}${path.sep}`);
  }

  private async validateUploadedFile(
    file: Express.Multer.File,
    tempPath?: string,
  ): Promise<{ valid: boolean; actualType?: string; hash: string }> {
    if (tempPath) {
      return this.fileValidationService.validateFileAtPath(
        tempPath,
        file.originalname,
        file.mimetype,
        file.size,
      );
    }

    if (!file.buffer) {
      throw new BadRequestException('Uploaded file is missing content');
    }

    return this.fileValidationService.validateFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  private async uploadToMinio(
    file: Express.Multer.File,
    tempPath: string | undefined,
    objectKey: string,
  ): Promise<string> {
    if (tempPath) {
      return this.storageService.uploadFileFromPath(
        tempPath,
        objectKey,
        file.mimetype,
        file.size,
      );
    }

    if (!file.buffer) {
      throw new BadRequestException('Uploaded file is missing content');
    }

    return this.storageService.uploadFile(file.buffer, objectKey, file.mimetype);
  }

  private scheduleThumbnailGeneration(
    organizationId: string,
    contentId: string,
    file: Express.Multer.File,
    tempPath: string | undefined,
    failureMessage: string,
    successMessage: string,
  ): boolean {
    const thumbnailPromise = tempPath
      ? this.thumbnailService.generateThumbnailFromPath(contentId, tempPath, file.mimetype)
      : this.thumbnailService.generateThumbnail(contentId, file.buffer, file.mimetype);

    thumbnailPromise
      .then(async (thumbnailUrl) => {
        await this.contentService.update(organizationId, contentId, { thumbnail: thumbnailUrl });
        this.logger.debug(`${successMessage}: ${thumbnailUrl}`);
      })
      .catch((error) => {
        this.logger.warn(`${failureMessage}: ${error}`);
      })
      .finally(() => {
        if (tempPath) {
          void this.cleanupTempUpload(tempPath);
        }
      });

    return Boolean(tempPath);
  }

  private async cleanupTempUpload(tempPath: string): Promise<void> {
    if (!this.isPathInsideUploadTempRoot(tempPath)) {
      this.logger.warn(`Refusing to clean upload temp file outside temp root: ${tempPath}`);
      return;
    }

    try {
      await fs.promises.unlink(tempPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to clean upload temp file ${tempPath}: ${error}`);
      }
    }
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ContentQueryDto,
  ) {
    const { type, status, templateOrientation, search, dateRange, tagNames, tagIds, ...pagination } = query;
    return this.contentService.findAll(organizationId, pagination, {
      type,
      status,
      templateOrientation,
      search,
      dateRange,
      tagNames,
      tagIds,
    });
  }

  @Get('tags')
  listContentTags(@CurrentUser('organizationId') organizationId: string) {
    return this.contentService.listContentTags(organizationId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.contentService.findOne(organizationId, id);
  }

  /**
   * Download a content file.
   *
   * MinIO-stored content is proxied through the middleware: the object is
   * fetched server-side (MinIO is only reachable from the server — in prod its
   * endpoint is bound to localhost and not publicly exposed) and streamed to
   * the caller as an attachment. This replaces the previous presigned-URL
   * response, which handed the browser an unreachable
   * `http://localhost:9000/...` URL in production (PR-7b).
   *
   * Local (`/uploads`) and external URLs are already browser-reachable, so we
   * redirect to them instead of streaming.
   *
   * Auth + org-scoping are enforced by the controller-level RolesGuard /
   * @RequiresSubscription plus the org-prefixed object-key check
   * (getOwnedMinioObjectKey throws if the key is outside the caller's org).
   */
  @Get(':id/download')
  @SkipEnvelope()
  @SkipOutputSanitize()
  async downloadContent(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const content = await this.contentService.findOne(organizationId, id);

    if (!content.url) {
      throw new NotFoundException('Content has no associated file');
    }

    // Throws BadRequestException if the object key is outside the caller's org.
    const objectKey = getOwnedMinioObjectKey(organizationId, content.url);

    if (!objectKey) {
      // Local (/uploads) or external URL — reachable by the browser directly.
      res.redirect(content.url);
      return;
    }

    if (!this.storageService.isMinioAvailable()) {
      throw new ServiceUnavailableException('Storage service is currently unavailable');
    }

    const metadata = await this.storageService.getFileMetadata(objectKey);
    if (!metadata) {
      throw new NotFoundException('Content file not found');
    }

    const stream = await this.storageService.getObject(objectKey);

    res.set({
      'Content-Type': content.mimeType || metadata.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${this.buildDownloadFilename(content.name)}"`,
      'Content-Length': String(metadata.size),
      'Cache-Control': 'private, no-cache',
    });

    await this.streamToResponse(stream, res, id);
  }

  /**
   * Build a header-safe filename for Content-Disposition. Strips quotes,
   * backslashes, and CR/LF so a caller-controlled content name cannot inject
   * response headers.
   */
  private buildDownloadFilename(name?: string | null): string {
    const cleaned = (name || 'download').replace(/[\r\n"\\]/g, '').trim();
    return cleaned.length > 0 ? cleaned : 'download';
  }

  private async streamToResponse(
    stream: NodeJS.ReadableStream,
    res: Response,
    contentId: string,
  ): Promise<void> {
    try {
      await pipeline(stream, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown stream error';
      this.logger.error(`Failed to stream content ${contentId}: ${message}`);

      if (!res.headersSent) {
        res.removeHeader('Content-Type');
        res.removeHeader('Content-Disposition');
        res.removeHeader('Content-Length');
        res.removeHeader('Cache-Control');
        throw new InternalServerErrorException('Failed to stream content file');
      }

      res.destroy(error instanceof Error ? error : undefined);
    }
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() updateContentDto: UpdateContentDto,
  ) {
    return this.contentService.update(organizationId, id, updateContentDto);
  }

  @Post(':id/thumbnail')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async generateThumbnail(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    // Get content
    const content = await this.contentService.findOne(organizationId, id);

    if (content.type !== 'image') {
      return { message: 'Thumbnail generation only supported for images', thumbnail: null };
    }

    let thumbnailUrl: string;

    // For MinIO-stored content, fetch the object directly via StorageService
    // to avoid SSRF validation blocking internal MinIO URLs
    const objectKey = getOwnedMinioObjectKey(organizationId, content.url);
    if (objectKey) {
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

  // ============================================================================
  // CONTENT MODERATION
  // ============================================================================

  @Post(':id/flag')
  @Roles('admin', 'manager', 'viewer')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  flag(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() body: FlagContentDto,
  ) {
    return this.contentService.flagContent(organizationId, id, userId, body.reason);
  }

  @Post(':id/review')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  review(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() body: ReviewContentDto,
  ) {
    return this.contentService.reviewContent(organizationId, id, userId, body.action, body.reason);
  }

  // ============================================================================
  // CONTENT APPROVAL PIPELINE (O10)
  //
  // Distinct from /flag and /review:
  //   - /flag + /review = moderation: any user can flag a previously-active
  //     piece for admin review.
  //   - /submit-for-approval + /approve + /reject = approval: proposer creates
  //     draft, admin gates publication.
  // ============================================================================

  /**
   * Proposer step: move draft → pending_approval. Any logged-in org user.
   */
  @Post(':id/submit-for-approval')
  @Roles('admin', 'manager', 'viewer')
  @HttpCode(HttpStatus.OK)
  submitForApproval(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() body: SubmitForApprovalDto,
  ) {
    return this.contentService.submitForApproval(organizationId, id, userId, body.note);
  }

  /**
   * Approver step: move pending_approval → active. Admin/manager only.
   * Self-approval is rejected at the service layer.
   */
  @Post(':id/approve')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  approveContent(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() body: ApproveContentDto,
  ) {
    return this.contentService.approveContent(organizationId, id, userId, body.note);
  }

  /**
   * Approver step: move pending_approval → rejected. Admin/manager only.
   * Reason is required (>=3 chars; DTO + service both enforce).
   */
  @Post(':id/reject-from-approval')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  rejectFromApproval(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() body: RejectFromApprovalDto,
  ) {
    return this.contentService.rejectFromApproval(organizationId, id, userId, body.reason);
  }

  @Post(':id/archive')
  @Roles('admin', 'manager')
  archive(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.contentService.archive(organizationId, id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.contentService.remove(organizationId, id);
  }

  // ============================================================================
  // FILE REPLACEMENT
  // ============================================================================

  @Post(':id/replace')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', CONTENT_UPLOAD_INTERCEPTOR_OPTIONS))
  async replaceFile(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() replaceFileDto: ReplaceFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const tempPath = this.getUploadedTempPath(file);
    let tempPathOwnedByThumbnail = false;
    let uploadedObjectKey: string | null = null;
    let quotaReservation = 0;
    let quotaReserved = false;

    try {
      // Get existing content to determine net storage change
      const existingContent = await this.contentService.findOne(organizationId, id);
      const oldFileSize = existingContent.fileSize || 0;
      const netIncrease = file.size - oldFileSize;
      const keepBackup = replaceFileDto.keepBackup === true;

      const validation = await this.validateUploadedFile(file, tempPath);
      const safeFilename = this.fileValidationService.sanitizeFilename(
        file.originalname,
      );
      const filename = `${validation.hash}-${safeFilename}`;
      let fileUrl: string;

      // Reserve quota only after validation succeeds so rejected files cannot
      // leave behind accounting reservations. Backup replacements retain the
      // previous file, so the quota increase is the full new file size.
      quotaReservation = keepBackup ? file.size : Math.max(0, netIncrease);
      if (quotaReservation > 0) {
        await this.storageQuotaService.reserveQuota(organizationId, quotaReservation);
        quotaReserved = true;
      }

      // Try MinIO first. In production, fail closed instead of creating
      // unreachable /uploads content when object storage is unhealthy.
      if (this.storageService.isMinioAvailable()) {
        const objectKey = this.storageService.generateObjectKey(
          organizationId,
          validation.hash,
          safeFilename,
        );
        await this.uploadToMinio(file, tempPath, objectKey);
        uploadedObjectKey = objectKey;
        fileUrl = `${MINIO_URL_PREFIX}${objectKey}`;
        this.logger.debug(`Replacement file uploaded to MinIO: ${objectKey}`);
      } else if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Storage service is currently unavailable');
      } else {
        fileUrl = await this.saveFileLocallyFromUpload(organizationId, filename, file, tempPath);
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
          keepBackup,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      );

      // Update storage usage: adjust for the net difference
      if (!keepBackup && netIncrease < 0) {
        await this.storageQuotaService.decrementUsage(organizationId, Math.abs(netIncrease));
      }

      // Generate thumbnail in background (fire-and-forget)
      if (contentType === 'image') {
        tempPathOwnedByThumbnail = this.scheduleThumbnailGeneration(
          organizationId,
          id,
          file,
          tempPath,
          'Background thumbnail generation failed during replace',
          'Replacement thumbnail generated in background',
        );
      }

      return {
        content,
        fileHash: validation.hash,
      };
    } catch (error) {
      let canReleaseQuota = true;
      if (uploadedObjectKey) {
        try {
          await this.storageService.deleteFile(uploadedObjectKey);
        } catch (deleteError) {
          canReleaseQuota = false;
          this.logger.warn(`Failed to clean up replacement object after failure: ${deleteError}`);
        }
      }
      if (canReleaseQuota && quotaReserved && quotaReservation > 0) {
        await this.releaseQuotaReservation(organizationId, quotaReservation);
      }
      throw error;
    } finally {
      if (tempPath && !tempPathOwnedByThumbnail) {
        await this.cleanupTempUpload(tempPath);
      }
    }
  }

  private async releaseQuotaReservation(organizationId: string, bytes: number): Promise<void> {
    try {
      await this.storageQuotaService.decrementUsage(organizationId, bytes);
    } catch (error) {
      this.logger.error(`Failed to release reserved storage quota for ${organizationId}: ${error}`);
    }
  }

  @Get(':id/versions')
  getVersionHistory(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.contentService.getVersionHistory(organizationId, id);
  }

  @Post(':id/restore')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  restore(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
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
    @Param('id', ParseIdPipe) id: string,
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
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.contentService.clearExpiration(organizationId, id);
  }
}
