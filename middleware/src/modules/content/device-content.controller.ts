import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  StreamableFile,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../auth/decorators/public.decorator';
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
   * Requires device JWT authentication — the device must belong to the
   * same organization as the content.
   */
  @Get(':id/file')
  @Public() // Bypass user JWT guard — we verify device JWT manually
  async serveFile(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | void> {
    const devicePayload = this.verifyDeviceToken(req);

    const content = await this.contentService.findById(id);

    if (!content || !content.url) {
      throw new NotFoundException('Content not found');
    }

    if (content.organizationId !== devicePayload.organizationId) {
      throw new ForbiddenException('Content not accessible to this device');
    }

    if (content.url.startsWith(MINIO_URL_PREFIX)) {
      const objectKey = content.url.substring(MINIO_URL_PREFIX.length);

      if (!this.storageService.isMinioAvailable()) {
        throw new BadRequestException('Storage service is currently unavailable');
      }

      const stream = await this.storageService.getObject(objectKey);
      res.set({
        'Content-Type': content.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      });
      return new StreamableFile(stream as NodeJS.ReadableStream);
    }

    // For non-MinIO URLs, redirect
    res.redirect(content.url);
    return;
  }
}
