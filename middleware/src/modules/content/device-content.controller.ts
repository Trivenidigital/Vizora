import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../auth/decorators/public.decorator';
import { SkipEnvelope } from '../common/interceptors/response-envelope.interceptor';
import { SkipOutputSanitize } from '../common/interceptors/sanitize.interceptor';
import { ContentService } from './content.service';
import { StorageService } from '../storage/storage.service';

const MINIO_URL_PREFIX = 'minio://';

interface DeviceJwtPayload {
  sub: string;
  deviceIdentifier: string;
  organizationId: string;
  type: 'device';
}

/**
 * Controller for serving content files to display devices.
 * Uses a dedicated route prefix to avoid conflict with ContentController.
 * Requires device JWT authentication to prevent unauthorized access (IDOR).
 */
@Controller('device-content')
export class DeviceContentController {
  private readonly logger = new Logger(DeviceContentController.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly storageService: StorageService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Verify a device JWT token from the Authorization header or query parameter.
   * Query parameter is needed because img.src and video.src cannot send headers.
   */
  private verifyDeviceToken(req: Request): DeviceJwtPayload {
    const authHeader = req.headers.authorization;
    const queryToken = (req.query as Record<string, string | undefined>)?.token;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : queryToken;
    if (!token) {
      throw new UnauthorizedException('Device authentication required');
    }

    try {
      const payload = this.jwtService.verify<DeviceJwtPayload>(token, {
        secret: process.env.DEVICE_JWT_SECRET,
        algorithms: ['HS256'],
      });

      if (payload.type !== 'device') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired device token');
    }
  }

  /**
   * Serve content file directly (streams from MinIO).
   * Requires device JWT authentication to prevent unauthorized access.
   */
  @Get(':id/file')
  @Public()
  @SkipEnvelope()
  @SkipOutputSanitize()
  async serveFile(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const content = await this.contentService.findById(id);

    if (!content || !content.url) {
      throw new NotFoundException('Content not found');
    }

    // Device JWT is mandatory — throws UnauthorizedException if missing/invalid
    const devicePayload = this.verifyDeviceToken(req);
    if (content.organizationId !== devicePayload.organizationId) {
      throw new ForbiddenException('Content not accessible to this device');
    }

    if (content.url.startsWith(MINIO_URL_PREFIX)) {
      const objectKey = content.url.substring(MINIO_URL_PREFIX.length);

      if (!this.storageService.isMinioAvailable()) {
        throw new BadRequestException('Storage service is currently unavailable');
      }

      const stream = await this.storageService.getObject(objectKey);

      // Buffer the entire file to send with Content-Length.
      // Chunked streaming was causing truncated responses via nginx.
      const maxFileSize = 100 * 1024 * 1024; // 100MB limit
      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        totalSize += chunk.length;
        if (totalSize > maxFileSize) {
          throw new BadRequestException('Content file exceeds maximum size limit (100MB)');
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      res.set({
        'Content-Type': content.mimeType || 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=86400',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      res.end(buffer);
      return;
    }

    // For non-MinIO URLs, redirect (CORP header on redirect itself)
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.redirect(content.url);
    return;
  }
}
