import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../auth/decorators/public.decorator';
import { SkipEnvelope } from '../common/interceptors/response-envelope.interceptor';
import { SkipOutputSanitize } from '../common/interceptors/sanitize.interceptor';
import { ContentService } from './content.service';
import { StorageService } from '../storage/storage.service';
import { DatabaseService } from '../database/database.service';
import { pipeline } from 'node:stream/promises';

const MINIO_URL_PREFIX = 'minio://';
const MAX_DEVICE_CONTENT_FILE_SIZE = 100 * 1024 * 1024;

interface DeviceJwtPayload {
  sub: string;
  deviceIdentifier: string;
  organizationId: string;
  type: 'device';
}

interface ByteRange {
  start: number;
  end: number;
}

type RangeParseResult =
  | { kind: 'none' }
  | { kind: 'range'; range: ByteRange }
  | { kind: 'unsatisfiable' };

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
    private readonly databaseService: DatabaseService,
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

      if (
        payload.type !== 'device' ||
        typeof payload.sub !== 'string' ||
        payload.sub.trim() === '' ||
        typeof payload.deviceIdentifier !== 'string' ||
        payload.deviceIdentifier.trim() === '' ||
        typeof payload.organizationId !== 'string' ||
        payload.organizationId.trim() === ''
      ) {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired device token');
    }
  }

  private parseRangeHeader(rangeHeader: string | undefined, fileSize: number): RangeParseResult {
    if (!rangeHeader) {
      return { kind: 'none' };
    }

    if (rangeHeader.includes(',')) {
      return { kind: 'none' };
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match) {
      return { kind: 'none' };
    }

    const [, rawStart, rawEnd] = match;
    if (!rawStart && !rawEnd) {
      return { kind: 'none' };
    }

    let start: number;
    let end: number;

    if (!rawStart) {
      const suffixLength = Number(rawEnd);
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
        return { kind: 'unsatisfiable' };
      }
      start = Math.max(fileSize - suffixLength, 0);
      end = fileSize - 1;
    } else {
      start = Number(rawStart);
      end = rawEnd ? Number(rawEnd) : fileSize - 1;
    }

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= fileSize
    ) {
      return { kind: 'unsatisfiable' };
    }

    return {
      kind: 'range',
      range: {
        start,
        end: Math.min(end, fileSize - 1),
      },
    };
  }

  private async streamToResponse(stream: NodeJS.ReadableStream, res: Response): Promise<void> {
    try {
      await pipeline(stream, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown stream error';
      this.logger.error(`Failed to stream device content: ${message}`);

      if (!res.headersSent) {
        res.removeHeader('Content-Type');
        res.removeHeader('Content-Length');
        res.removeHeader('Content-Range');
        res.removeHeader('Accept-Ranges');
        res.removeHeader('Cache-Control');
        res.removeHeader('Cross-Origin-Resource-Policy');
        throw new InternalServerErrorException('Failed to stream content file');
      }

      res.destroy(error instanceof Error ? error : undefined);
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
    @Param('id', ParseIdPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Device JWT is mandatory — throws UnauthorizedException if missing/invalid.
    // Verify it BEFORE the DB query so an unauth caller can't probe content
    // IDs for existence via timing or DB error patterns.
    const devicePayload = this.verifyDeviceToken(req);

    const display = await this.databaseService.display.findUnique({
      where: { id: devicePayload.sub },
      select: { id: true, organizationId: true, isDisabled: true },
    });
    if (!display || display.organizationId !== devicePayload.organizationId || display.isDisabled) {
      throw new UnauthorizedException('Device is not authorized');
    }

    const content = await this.contentService.findByIdForDevice(
      id,
      devicePayload.organizationId,
    );

    if (!content || !content.url) {
      throw new NotFoundException('Content not found');
    }

    if (content.url.startsWith(MINIO_URL_PREFIX)) {
      const objectKey = content.url.substring(MINIO_URL_PREFIX.length);
      if (!objectKey.startsWith(`${devicePayload.organizationId}/`)) {
        throw new NotFoundException('Content file not found');
      }

      if (!this.storageService.isMinioAvailable()) {
        throw new BadRequestException('Storage service is currently unavailable');
      }

      const metadata = await this.storageService.getFileMetadata(objectKey);
      if (!metadata) {
        throw new NotFoundException('Content file not found');
      }

      if (metadata.size > MAX_DEVICE_CONTENT_FILE_SIZE) {
        throw new BadRequestException('Content file exceeds maximum size limit (100MB)');
      }

      const mimeType = content.mimeType || metadata.contentType || 'application/octet-stream';
      const range = this.parseRangeHeader(req.headers.range, metadata.size);

      if (range.kind === 'unsatisfiable') {
        res.status(416);
        res.set({
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes */${metadata.size}`,
          'Cache-Control': 'no-store',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        });
        res.end();
        return;
      }

      if (range.kind === 'range') {
        const length = range.range.end - range.range.start + 1;
        const stream = await this.storageService.getObjectRange(
          objectKey,
          range.range.start,
          length,
        );
        res.status(206);
        res.set({
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(length),
          'Content-Range': `bytes ${range.range.start}-${range.range.end}/${metadata.size}`,
          'Cache-Control': 'private, no-store',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        });
        await this.streamToResponse(stream, res);
        return;
      }

      const stream = await this.storageService.getObject(objectKey);
      res.set({
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(metadata.size),
        'Cache-Control': 'private, no-store',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      await this.streamToResponse(stream, res);
      return;
    }

    // For non-MinIO URLs, redirect (CORP header on redirect itself)
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.redirect(content.url);
    return;
  }
}
