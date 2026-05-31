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
import {
  DeviceJwtPayload,
  getDeviceTokenFromRequest,
  hashDeviceToken,
  verifyCurrentDeviceToken,
} from '../common/device-token-auth.util';

const MINIO_URL_PREFIX = 'minio://';
const MAX_DEVICE_CONTENT_FILE_SIZE = 100 * 1024 * 1024;
const DEVICE_TOKEN_AUTH_CACHE_TTL_MS = 5_000;
const DEVICE_CONTENT_CACHE_TTL_MS = 10_000;
const DEVICE_OBJECT_METADATA_CACHE_TTL_MS = 10_000;
const DEVICE_TOKEN_AUTH_CACHE_MAX_ENTRIES = 1_000;
const DEVICE_CONTENT_CACHE_MAX_ENTRIES = 1_000;
const DEVICE_OBJECT_METADATA_CACHE_MAX_ENTRIES = 1_000;
const SUCCESSFUL_MEDIA_CACHE_CONTROL = 'private, no-store';

type DeviceContentRecord = NonNullable<
  Awaited<ReturnType<ContentService['findByIdForDevice']>>
>;

type ObjectMetadata = NonNullable<
  Awaited<ReturnType<StorageService['getFileMetadata']>>
>;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CachedDeviceAuth {
  payload: DeviceJwtPayload;
  tokenHash: string;
}

interface CachedLookup<T> {
  value: T;
  cacheHit: boolean;
  cacheKey: string;
}

interface ResolvedMinioContent {
  kind: 'minio';
  objectKey: string;
  contentCacheKey: string;
  contentCacheHit: boolean;
  metadataCacheKey: string;
  metadataCacheHit: boolean;
  mimeType: string;
  metadata: ObjectMetadata;
  range: RangeParseResult;
}

interface ResolvedRedirectContent {
  kind: 'redirect';
  url: string;
}

type ResolvedDeviceContent = ResolvedMinioContent | ResolvedRedirectContent;

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
  private readonly deviceAuthCache = new Map<string, CacheEntry<CachedDeviceAuth>>();
  private readonly deviceAuthLoads = new Map<string, Promise<CachedDeviceAuth>>();
  private readonly contentCache = new Map<string, CacheEntry<DeviceContentRecord>>();
  private readonly contentLoads = new Map<string, Promise<DeviceContentRecord | null>>();
  private readonly objectMetadataCache = new Map<string, CacheEntry<ObjectMetadata>>();
  private readonly objectMetadataLoads = new Map<string, Promise<ObjectMetadata | null>>();
  private readonly cachedObjectOpenLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly contentService: ContentService,
    private readonly storageService: StorageService,
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {}

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

  private getCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setCacheValue<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
    expiresAt: number,
    maxEntries: number,
  ): void {
    const now = Date.now();
    if (expiresAt <= now) {
      cache.delete(key);
      return;
    }

    if (!cache.has(key) && cache.size >= maxEntries) {
      for (const [cacheKey, entry] of cache) {
        if (entry.expiresAt <= now) {
          cache.delete(cacheKey);
        }
      }
    }

    while (!cache.has(key) && cache.size >= maxEntries) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      cache.delete(oldestKey);
    }

    cache.set(key, { value, expiresAt });
  }

  private getAuthCacheExpiresAt(payload: DeviceJwtPayload, now: number): number {
    const exp = (payload as DeviceJwtPayload & { exp?: unknown }).exp;
    const ttlExpiresAt = now + DEVICE_TOKEN_AUTH_CACHE_TTL_MS;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) {
      return ttlExpiresAt;
    }

    return Math.min(ttlExpiresAt, exp * 1000);
  }

  private async verifyDeviceTokenCached(req: Request): Promise<CachedLookup<CachedDeviceAuth>> {
    const token = getDeviceTokenFromRequest(req, { allowQueryToken: true });
    const tokenHash = hashDeviceToken(token);
    const cached = this.getCacheValue(this.deviceAuthCache, tokenHash);
    if (cached) {
      return { value: cached, cacheHit: true, cacheKey: tokenHash };
    }

    let load = this.deviceAuthLoads.get(tokenHash);
    if (!load) {
      load = verifyCurrentDeviceToken({
        jwtService: this.jwtService,
        databaseService: this.databaseService,
        token,
      }).then(({ payload, tokenHash: verifiedHash }) => ({
        payload,
        tokenHash: verifiedHash,
      }));
      this.deviceAuthLoads.set(tokenHash, load);
    }

    try {
      const value = await load;
      this.setCacheValue(
        this.deviceAuthCache,
        tokenHash,
        value,
        this.getAuthCacheExpiresAt(value.payload, Date.now()),
        DEVICE_TOKEN_AUTH_CACHE_MAX_ENTRIES,
      );
      return { value, cacheHit: false, cacheKey: tokenHash };
    } finally {
      if (this.deviceAuthLoads.get(tokenHash) === load) {
        this.deviceAuthLoads.delete(tokenHash);
      }
    }
  }

  private async getContentForDeviceCached(
    id: string,
    organizationId: string,
  ): Promise<CachedLookup<DeviceContentRecord | null>> {
    const cacheKey = `${organizationId}:${id}`;
    const cached = this.getCacheValue(this.contentCache, cacheKey);
    if (cached) {
      return { value: cached, cacheHit: true, cacheKey };
    }

    let load = this.contentLoads.get(cacheKey);
    if (!load) {
      load = this.contentService.findByIdForDevice(id, organizationId);
      this.contentLoads.set(cacheKey, load);
    }

    try {
      const value = await load;
      if (value && value.url) {
        this.setCacheValue(
          this.contentCache,
          cacheKey,
          value,
          Date.now() + DEVICE_CONTENT_CACHE_TTL_MS,
          DEVICE_CONTENT_CACHE_MAX_ENTRIES,
        );
      }
      return { value, cacheHit: false, cacheKey };
    } finally {
      if (this.contentLoads.get(cacheKey) === load) {
        this.contentLoads.delete(cacheKey);
      }
    }
  }

  private async getObjectMetadataCached(
    objectKey: string,
  ): Promise<CachedLookup<ObjectMetadata | null>> {
    const cached = this.getCacheValue(this.objectMetadataCache, objectKey);
    if (cached) {
      return { value: cached, cacheHit: true, cacheKey: objectKey };
    }

    let load = this.objectMetadataLoads.get(objectKey);
    if (!load) {
      load = this.storageService.getFileMetadata(objectKey);
      this.objectMetadataLoads.set(objectKey, load);
    }

    try {
      const value = await load;
      if (value) {
        this.setCacheValue(
          this.objectMetadataCache,
          objectKey,
          value,
          Date.now() + DEVICE_OBJECT_METADATA_CACHE_TTL_MS,
          DEVICE_OBJECT_METADATA_CACHE_MAX_ENTRIES,
        );
      }
      return { value, cacheHit: false, cacheKey: objectKey };
    } finally {
      if (this.objectMetadataLoads.get(objectKey) === load) {
        this.objectMetadataLoads.delete(objectKey);
      }
    }
  }

  private async resolveDeviceContent(
    id: string,
    organizationId: string,
    req: Request,
    allowCachedMetadataMissRetry = true,
  ): Promise<ResolvedDeviceContent> {
    const contentLookup = await this.getContentForDeviceCached(id, organizationId);
    const content = contentLookup.value;

    if (!content || !content.url) {
      throw new NotFoundException('Content not found');
    }

    if (!content.url.startsWith(MINIO_URL_PREFIX)) {
      return { kind: 'redirect', url: content.url };
    }

    const objectKey = content.url.substring(MINIO_URL_PREFIX.length);
    if (!objectKey.startsWith(`${organizationId}/`)) {
      throw new NotFoundException('Content file not found');
    }

    if (!this.storageService.isMinioAvailable()) {
      throw new BadRequestException('Storage service is currently unavailable');
    }

    const metadataLookup = await this.getObjectMetadataCached(objectKey);
    const metadata = metadataLookup.value;
    if (!metadata) {
      this.contentCache.delete(contentLookup.cacheKey);
      this.objectMetadataCache.delete(metadataLookup.cacheKey);
      if (allowCachedMetadataMissRetry && contentLookup.cacheHit) {
        return this.resolveDeviceContent(id, organizationId, req, false);
      }
      throw new NotFoundException('Content file not found');
    }

    if (metadata.size > MAX_DEVICE_CONTENT_FILE_SIZE) {
      throw new BadRequestException('Content file exceeds maximum size limit (100MB)');
    }

    return {
      kind: 'minio',
      objectKey,
      contentCacheKey: contentLookup.cacheKey,
      contentCacheHit: contentLookup.cacheHit,
      metadataCacheKey: metadataLookup.cacheKey,
      metadataCacheHit: metadataLookup.cacheHit,
      mimeType: content.mimeType || metadata.contentType || 'application/octet-stream',
      metadata,
      range: this.parseRangeHeader(req.headers.range, metadata.size),
    };
  }

  private invalidateCachedMediaContext(context: ResolvedMinioContent): void {
    this.contentCache.delete(context.contentCacheKey);
    this.objectMetadataCache.delete(context.metadataCacheKey);
  }

  private isLikelyMissingObjectError(error: unknown): boolean {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
    const message = error instanceof Error ? error.message : String(error);
    return (
      /^(NoSuchKey|NoSuchObject|NotFound)$/i.test(code) ||
      /not found|no such key|specified key does not exist/i.test(message)
    );
  }

  private shouldRetryStaleCachedObject(
    context: ResolvedMinioContent,
    error: unknown,
  ): boolean {
    return (
      (context.contentCacheHit || context.metadataCacheHit) &&
      this.isLikelyMissingObjectError(error)
    );
  }

  private isCachedMediaContextStillCurrent(context: ResolvedMinioContent): boolean {
    if (context.contentCacheHit) {
      const cachedContent = this.getCacheValue(this.contentCache, context.contentCacheKey);
      if (
        !cachedContent ||
        cachedContent.url !== `${MINIO_URL_PREFIX}${context.objectKey}`
      ) {
        return false;
      }
    }

    if (context.metadataCacheHit) {
      const cachedMetadata = this.getCacheValue(
        this.objectMetadataCache,
        context.metadataCacheKey,
      );
      if (!cachedMetadata) {
        return false;
      }
    }

    return true;
  }

  private async withCachedObjectOpenLock<T>(
    objectKey: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const previous = this.cachedObjectOpenLocks.get(objectKey) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);
    this.cachedObjectOpenLocks.set(objectKey, queued);

    await previous.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.cachedObjectOpenLocks.get(objectKey) === queued) {
        this.cachedObjectOpenLocks.delete(objectKey);
      }
    }
  }

  private async openMinioStream(context: ResolvedMinioContent): Promise<NodeJS.ReadableStream> {
    if (context.range.kind === 'range') {
      const length = context.range.range.end - context.range.range.start + 1;
      return this.storageService.getObjectRange(
        context.objectKey,
        context.range.range.start,
        length,
      );
    }

    return this.storageService.getObject(context.objectKey);
  }

  private async openMinioStreamWithStaleRecovery(
    id: string,
    organizationId: string,
    req: Request,
    context: ResolvedMinioContent,
  ): Promise<{ resolved: ResolvedDeviceContent; stream: NodeJS.ReadableStream | null }> {
    const openWithRetry = async (
      current: ResolvedMinioContent,
    ): Promise<{ resolved: ResolvedDeviceContent; stream: NodeJS.ReadableStream | null }> => {
      try {
        return { resolved: current, stream: await this.openMinioStream(current) };
      } catch (error) {
        if (!this.shouldRetryStaleCachedObject(current, error)) {
          throw error;
        }

        this.invalidateCachedMediaContext(current);
        const refreshed = await this.resolveDeviceContent(id, organizationId, req);
        if (refreshed.kind !== 'minio' || refreshed.range.kind === 'unsatisfiable') {
          return { resolved: refreshed, stream: null };
        }

        return {
          resolved: refreshed,
          stream: await this.openMinioStream(refreshed),
        };
      }
    };

    if (!context.contentCacheHit && !context.metadataCacheHit) {
      return openWithRetry(context);
    }

    return this.withCachedObjectOpenLock(context.objectKey, async () => {
      if (!this.isCachedMediaContextStillCurrent(context)) {
        const refreshed = await this.resolveDeviceContent(id, organizationId, req);
        if (refreshed.kind !== 'minio' || refreshed.range.kind === 'unsatisfiable') {
          return { resolved: refreshed, stream: null };
        }
        return openWithRetry(refreshed);
      }

      return openWithRetry(context);
    });
  }

  private async writeResolvedContent(
    resolved: ResolvedDeviceContent,
    stream: NodeJS.ReadableStream | null,
    res: Response,
  ): Promise<void> {
    if (resolved.kind === 'redirect') {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.redirect(resolved.url);
      return;
    }

    if (resolved.range.kind === 'unsatisfiable') {
      res.status(416);
      res.set({
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${resolved.metadata.size}`,
        'Cache-Control': 'no-store',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      res.end();
      return;
    }

    if (!stream) {
      throw new InternalServerErrorException('Content stream was not opened');
    }

    if (resolved.range.kind === 'range') {
      const length = resolved.range.range.end - resolved.range.range.start + 1;
      res.status(206);
      res.set({
        'Content-Type': resolved.mimeType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(length),
        'Content-Range': `bytes ${resolved.range.range.start}-${resolved.range.range.end}/${resolved.metadata.size}`,
        'Cache-Control': SUCCESSFUL_MEDIA_CACHE_CONTROL,
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      await this.streamToResponse(stream, res);
      return;
    }

    res.set({
      'Content-Type': resolved.mimeType,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(resolved.metadata.size),
      'Cache-Control': SUCCESSFUL_MEDIA_CACHE_CONTROL,
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    await this.streamToResponse(stream, res);
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
    const { value: deviceAuth } = await this.verifyDeviceTokenCached(req);
    let resolved = await this.resolveDeviceContent(
      id,
      deviceAuth.payload.organizationId,
      req,
    );
    let stream: NodeJS.ReadableStream | null = null;

    if (resolved.kind === 'minio' && resolved.range.kind !== 'unsatisfiable') {
      const opened = await this.openMinioStreamWithStaleRecovery(
        id,
        deviceAuth.payload.organizationId,
        req,
        resolved,
      );
      resolved = opened.resolved;
      stream = opened.stream;
    }

    await this.writeResolvedContent(resolved, stream, res);
  }
}
