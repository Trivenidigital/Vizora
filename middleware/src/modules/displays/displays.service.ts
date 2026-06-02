import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@vizora/database';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { StorageService } from '../storage/storage.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { UpdateQrOverlayDto } from './dto/update-qr-overlay.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { getDisplayDetailSelect, getDisplayListSelect } from './display-response.select';

/**
 * Hash a token using SHA-256 for secure storage
 * We use SHA-256 instead of bcrypt because:
 * 1. JWT tokens are already cryptographically random
 * 2. We only need to verify exact matches, not password-like comparisons
 * 3. Faster lookup performance for real-time operations
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Circuit breaker configuration for realtime service */
const REALTIME_CIRCUIT_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  successThreshold: 2,
  failureWindow: 60000, // 1 minute
};
const REALTIME_HTTP_TIMEOUT_MS = 15000;

@Injectable()
export class DisplaysService {
  private readonly logger = new Logger(DisplaysService.name);
  private readonly realtimeUrl = process.env.REALTIME_URL || 'http://localhost:3002';

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Returns internal API secret headers, or null if secret is not configured */
  private getInternalApiHeaders(): Record<string, string> | null {
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      this.logger.warn('INTERNAL_API_SECRET is not set — skipping realtime service call');
      return null;
    }
    return { 'x-internal-api-key': secret };
  }

  async create(organizationId: string, createDisplayDto: CreateDisplayDto) {
    const { deviceId, name, ...rest } = createDisplayDto;

    try {
      const display = await this.db.display.create({
        data: {
          ...rest,
          deviceIdentifier: deviceId,
          nickname: name,
          organizationId,
        },
        select: getDisplayDetailSelect(organizationId),
      });
      this.emitDisplayEvent('created', display.id, organizationId);
      return display;
    } catch (error) {
      // Handle unique constraint violation (race condition on deviceIdentifier)
      if (error.code === 'P2002') {
        throw new ConflictException('Display with this device ID already exists');
      }
      throw error;
    }
  }

  private emitDisplayEvent(action: string, entityId: string, organizationId: string) {
    this.eventEmitter.emit(`display.${action}`, { action, entityType: 'display', entityId, organizationId });
  }

  /**
   * @param filters Optional filters applied DB-side. `status` lets MCP
   *   tools (and future REST callers) filter without bringing the
   *   filter client-side and breaking pagination totals — the
   *   reported `total` always matches the filtered result set.
   */
  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { status?: 'online' | 'offline' | 'pairing' | 'error' },
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const where = {
      organizationId,
      ...(filters?.status ? { status: filters.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.db.display.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: getDisplayListSelect(organizationId),
      }),
      this.db.display.count({ where }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const display = await this.db.display.findFirst({
      where: { id, organizationId },
      select: getDisplayDetailSelect(organizationId),
    });

    if (!display) {
      throw new NotFoundException('Display not found');
    }

    return display;
  }

  async update(organizationId: string, id: string, updateDisplayDto: UpdateDisplayDto) {
    await this.findOne(organizationId, id);

    const { deviceId, name, currentPlaylistId, ...rest } = updateDisplayDto;

    if (deviceId) {
      const existing = await this.db.display.findFirst({
        where: {
          deviceIdentifier: deviceId,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Display with this device ID already exists');
      }
    }

    // Validate playlist exists and belongs to same organization if provided
    let playlist = null;
    if (currentPlaylistId !== undefined) {
      if (currentPlaylistId) {
        playlist = await this.db.playlist.findFirst({
          where: {
            id: currentPlaylistId,
            organizationId,
          },
          include: {
            items: {
              include: {
                content: true,
              },
            },
          },
        });

        if (!playlist) {
          throw new NotFoundException('Playlist not found or does not belong to your organization');
        }
      }
    }

    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const updateData = {
      ...rest,
      ...(deviceId && { deviceIdentifier: deviceId }),
      ...(name && { nickname: name }),
      ...(currentPlaylistId !== undefined && { currentPlaylistId }),
    };
    const updateResult = await this.db.display.updateMany({
      where: { id, organizationId },
      data: updateData,
    });
    if (updateResult.count === 0) {
      throw new NotFoundException('Display not found');
    }
    const updatedDisplay = await this.db.display.findUnique({
      where: { id },
      select: getDisplayDetailSelect(organizationId),
    });

    // If playlist was updated, notify the realtime service to push update to device
    // Fire-and-forget - don't block the response if realtime service is down
    if (currentPlaylistId !== undefined && playlist) {
      this.notifyPlaylistUpdate(updatedDisplay.id, playlist).catch(error => {
        this.logger.error(`Failed to notify realtime service, but update succeeded: ${error.message}`);
      });
    }

    this.emitDisplayEvent('updated', id, organizationId);
    return updatedDisplay;
  }

  private async notifyPlaylistUpdate(displayId: string, playlist: unknown): Promise<void> {
    const headers = this.getInternalApiHeaders();
    if (!headers) return;

    const url = `${this.realtimeUrl}/api/push/playlist`;

    // Use circuit breaker with fallback - if circuit is open or call fails, just log
    await this.circuitBreaker.executeWithFallback(
      'realtime-service',
      async () => {
        await firstValueFrom(
          this.httpService.post(url, {
            deviceId: displayId,
            playlist,
          }, { headers, timeout: REALTIME_HTTP_TIMEOUT_MS }),
        );
        this.logger.log(`Notified realtime service of playlist update for display ${displayId}`);
      },
      (error) => {
        // Fallback: log warning but don't block the operation
        if (error) {
          this.logger.warn(
            `Failed to notify realtime service for display ${displayId}: ${error.message}`,
          );
        } else {
          this.logger.warn(
            `Realtime service circuit is open, skipping notification for display ${displayId}`,
          );
        }
      },
      REALTIME_CIRCUIT_CONFIG,
    );
  }

  async updateHeartbeat(
    displayId: string,
    verifiedDevice: { organizationId: string; tokenHash: string },
  ) {
    // Check previous status to detect online transition (avoid notification spam on every heartbeat)
    const display = await this.db.display.findFirst({
      where: { id: displayId },
      select: {
        id: true,
        deviceIdentifier: true,
        status: true,
        nickname: true,
        organizationId: true,
      },
    });
    if (!display) {
      throw new NotFoundException('Device not found');
    }

    const wasOffline = display.status !== 'online';

    const result = await this.db.display.updateMany({
      where: {
        id: displayId,
        organizationId: verifiedDevice.organizationId,
        isDisabled: false,
        jwtToken: verifiedDevice.tokenHash,
      },
      data: {
        lastHeartbeat: new Date(),
        status: 'online',
      },
    });
    if (result.count === 0) {
      throw new UnauthorizedException('Device is not authorized');
    }

    // Emit device.online only on status transition (not every heartbeat)
    if (wasOffline) {
      this.eventEmitter.emit('device.online', {
        deviceId: display.id,
        deviceName: display.nickname || display.deviceIdentifier,
        organizationId: display.organizationId,
      });
    }

    return { success: true };
  }

  /**
   * Detect devices that stopped sending heartbeats and mark them offline.
   * Runs every 2 minutes. A device is considered offline if its last
   * heartbeat was >2 minutes ago and status is still 'online'.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async detectOfflineDevices(): Promise<void> {
    const threshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const staleDevices = await this.db.display.findMany({
      where: {
        status: 'online',
        lastHeartbeat: { lt: threshold },
      },
      select: { id: true, nickname: true, deviceIdentifier: true, organizationId: true },
    });

    if (staleDevices.length === 0) return;

    await this.db.display.updateMany({
      where: { id: { in: staleDevices.map(d => d.id) } },
      data: { status: 'offline' },
    });

    for (const device of staleDevices) {
      this.eventEmitter.emit('device.offline', {
        deviceId: device.id,
        deviceName: device.nickname || device.deviceIdentifier,
        organizationId: device.organizationId,
      });
    }

    this.logger.log(`Marked ${staleDevices.length} device(s) as offline (stale heartbeat)`);
  }

  /**
   * Reset displays stuck in 'pairing' state. A device gets status='pairing'
   * when generatePairingToken() fires (operator started pairing) but
   * transitions to 'online' only when the device makes its first WebSocket
   * connection. If the device loses power or network in between — or the
   * QR code never gets scanned — the row stays 'pairing' forever, which
   * confuses dashboards and prevents the operator from re-pairing the same
   * deviceIdentifier (the existing-display check throws "already paired").
   *
   * Threshold is 30 minutes — generous compared to the 5-min pairing-token
   * TTL but tolerant of legitimate slow first-connect (cold cache, slow
   * 3G, captive portal handshake). Past the threshold we drop status back
   * to 'offline' so the device can be re-paired without operator action.
   *
   * Runs hourly — not every minute, because pairing is a low-frequency
   * operator action and the cost of a 30-60min delay on cleanup is
   * trivial.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async resetStalePairingDevices(): Promise<void> {
    const threshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    const stale = await this.db.display.findMany({
      where: {
        status: 'pairing',
        // Use updatedAt — that's when generatePairingToken touched the row.
        // lastHeartbeat is the wrong field here because a pairing-state
        // device by definition has never heartbeated.
        updatedAt: { lt: threshold },
      },
      select: { id: true, nickname: true, deviceIdentifier: true, organizationId: true },
    });

    if (stale.length === 0) return;

    await this.db.display.updateMany({
      where: { id: { in: stale.map((d) => d.id) } },
      data: { status: 'offline' },
    });

    this.logger.log(
      `Reset ${stale.length} stale 'pairing'-state device(s) to 'offline' (>30min in pairing)`,
    );
  }

  async generatePairingToken(organizationId: string, id: string) {
    const display = await this.findOne(organizationId, id);

    // Generate device JWT token using DEVICE_JWT_SECRET (not the user JWT_SECRET)
    const deviceSecret = process.env.DEVICE_JWT_SECRET;
    if (!deviceSecret || deviceSecret.length < 32) {
      // Server-side misconfiguration — surface to the client as 500 so
      // ops sees it in error tracking without hiding behind a generic
      // unhandled exception (which the global filter would turn into
      // an empty 500 with no useful message in the audit log).
      throw new InternalServerErrorException(
        'DEVICE_JWT_SECRET must be set and be at least 32 characters',
      );
    }

    const pairingToken = this.jwtService.sign(
      {
        sub: display.id,
        deviceIdentifier: display.deviceIdentifier,
        organizationId: display.organizationId,
        type: 'device',
      },
      {
        secret: deviceSecret,
        algorithm: 'HS256',
      },
    );

    // Hash the token before storing in database for security
    // If database is compromised, attacker cannot use the hashed tokens
    const hashedToken = hashToken(pairingToken);

    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const pairingResult = await this.db.display.updateMany({
      where: { id, organizationId },
      data: {
        jwtToken: hashedToken, // Store hash, not plaintext
        pairedAt: new Date(),
        status: 'pairing',
      },
    });
    if (pairingResult.count === 0) {
      throw new NotFoundException('Display not found');
    }

    // Return the actual token to the client (only time it's available)
    return {
      pairingToken,
      expiresIn: '30d',
      displayId: display.id,
      deviceIdentifier: display.deviceIdentifier,
    };
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    // Defense-in-depth: include organizationId in where clause to prevent TOCTOU races
    const result = await this.db.display.deleteMany({
      where: { id, organizationId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Display not found');
    }
    this.emitDisplayEvent('deleted', id, organizationId);
    return { id };
  }

  async getTags(organizationId: string, displayId: string) {
    await this.findOne(organizationId, displayId);

    const displayTags = await this.db.displayTag.findMany({
      where: { displayId, tag: { organizationId } },
      include: { tag: true },
    });

    return displayTags.map((dt) => dt.tag);
  }

  async addTags(organizationId: string, displayId: string, tagIds: string[]) {
    await this.findOne(organizationId, displayId);

    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.length > 0) {
      const tags = await this.db.tag.findMany({
        where: {
          id: { in: uniqueTagIds },
          organizationId,
        },
        select: { id: true },
      });

      if (tags.length !== uniqueTagIds.length) {
        throw new NotFoundException('One or more tags not found');
      }
    }

    // Create DisplayTag entries for each tag, skipping duplicates
    const createPromises = uniqueTagIds.map((tagId) =>
      this.db.displayTag.upsert({
        where: {
          displayId_tagId: { displayId, tagId },
        },
        create: { displayId, tagId },
        update: {},
        include: { tag: true },
      }),
    );

    const results = await Promise.all(createPromises);

    // O4: notify tag-rule evaluator that this display's tag set changed.
    this.eventEmitter.emit('display.tags.changed', { organizationId, displayId });

    return results.map((dt) => dt.tag);
  }

  async removeTags(organizationId: string, displayId: string, tagIds: string[]) {
    await this.findOne(organizationId, displayId);

    await this.db.displayTag.deleteMany({
      where: {
        displayId,
        tagId: { in: tagIds },
      },
    });

    // O4: notify tag-rule evaluator that this display's tag set changed.
    this.eventEmitter.emit('display.tags.changed', { organizationId, displayId });

    return { success: true, removed: tagIds.length };
  }

  async pushContent(
    organizationId: string,
    displayId: string,
    contentId: string,
    duration: number = 5,
  ) {
    // Verify display exists and belongs to organization
    await this.findOne(organizationId, displayId);

    // Fetch content details
    const content = await this.db.content.findFirst({
      where: {
        id: contentId,
        organizationId,
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found or does not belong to your organization');
    }

    // Send raw URL — the realtime gateway resolves minio:// URLs to
    // public API endpoints before forwarding to display clients.
    const contentUrl = content.url;

    const headers = this.getInternalApiHeaders();
    if (!headers) {
      // Service-to-service auth is unconfigured — the client can't fix
      // this, but 503 is the right signal (we're temporarily unable
      // to fulfil the request) and clients/dashboards will back off.
      throw new ServiceUnavailableException(
        'INTERNAL_API_SECRET is not configured — cannot push content to display',
      );
    }

    const url = `${this.realtimeUrl}/api/push/content`;

    // Use circuit breaker with fallback
    const realtimeResult = await this.circuitBreaker.executeWithFallback(
      'realtime-service',
      async () => {
        const response = await firstValueFrom(
          this.httpService.post(url, {
            deviceId: displayId,
            content: {
              id: content.id,
              name: content.name,
              type: content.type,
              url: contentUrl,
              thumbnailUrl: content.thumbnail,
              mimeType: content.mimeType,
              duration: content.duration,
            },
            duration,
          }, { headers, timeout: REALTIME_HTTP_TIMEOUT_MS }),
        );
        this.logger.log(`Pushed content ${contentId} to display ${displayId} for ${duration} min`);
        return response.data as { success?: boolean; message?: string };
      },
      (error) => {
        if (error) {
          this.logger.warn(
            `Failed to push content to display ${displayId}: ${error.message}`,
          );
          throw error;
        } else {
          this.logger.warn(
            `Realtime service circuit is open, cannot push content to display ${displayId}`,
          );
          throw new ServiceUnavailableException('Realtime service temporarily unavailable');
        }
      },
      REALTIME_CIRCUIT_CONFIG,
    );

    if (realtimeResult?.success === false) {
      throw new ServiceUnavailableException(
        realtimeResult.message || 'Realtime service did not deliver content push',
      );
    }

    return { success: true, message: 'Content pushed to display' };
  }

  async bulkDelete(organizationId: string, displayIds: string[]) {
    const result = await this.db.display.deleteMany({
      where: {
        id: { in: displayIds },
        organizationId,
      },
    });
    return { deleted: result.count };
  }

  async bulkAssignPlaylist(organizationId: string, displayIds: string[], playlistId: string) {
    const uniqueDisplayIds = [...new Set(displayIds)];
    // Verify playlist belongs to org (include items for realtime notification)
    const playlist = await this.db.playlist.findFirst({
      where: { id: playlistId, organizationId },
      include: {
        items: {
          include: {
            content: true,
          },
        },
      },
    });
    if (!playlist) {
      throw new NotFoundException('Playlist not found or does not belong to your organization');
    }

    const validDisplayCount = await this.db.display.count({
      where: { id: { in: uniqueDisplayIds }, organizationId },
    });
    if (validDisplayCount !== uniqueDisplayIds.length) {
      throw new NotFoundException('One or more displays not found');
    }

    const result = await this.db.display.updateMany({
      where: {
        id: { in: uniqueDisplayIds },
        organizationId,
      },
      data: { currentPlaylistId: playlistId },
    });

    // Notify each device via realtime gateway (fire-and-forget)
    for (const displayId of uniqueDisplayIds) {
      this.notifyPlaylistUpdate(displayId, playlist).catch(error => {
        this.logger.error(`Failed to notify realtime for display ${displayId}: ${error.message}`);
      });
    }

    return { updated: result.count };
  }

  async bulkAssignGroup(organizationId: string, displayIds: string[], displayGroupId: string) {
    const uniqueDisplayIds = [...new Set(displayIds)];
    // Verify group belongs to org
    const group = await this.db.displayGroup.findFirst({
      where: { id: displayGroupId, organizationId },
    });
    if (!group) {
      throw new NotFoundException('Display group not found or does not belong to your organization');
    }

    const validDisplayCount = await this.db.display.count({
      where: { id: { in: uniqueDisplayIds }, organizationId },
    });
    if (validDisplayCount !== uniqueDisplayIds.length) {
      throw new NotFoundException('One or more displays not found');
    }

    const members = uniqueDisplayIds.map(displayId => ({
      displayId,
      displayGroupId,
    }));

    const result = await this.db.displayGroupMember.createMany({
      data: members,
      skipDuplicates: true,
    });
    return { added: result.count };
  }

  /**
   * Request a screenshot from a remote device
   * Sends a command to the realtime service, which forwards it to the device
   */
  async requestScreenshot(organizationId: string, displayId: string): Promise<{ requestId: string }> {
    // Verify display exists and belongs to organization
    const display = await this.findOne(organizationId, displayId);

    // Check if device is online
    if (display.status !== 'online') {
      throw new ConflictException('Cannot request screenshot from offline device');
    }

    // Generate unique request ID
    const requestId = crypto.randomUUID();

    // Send command to realtime service
    const headers = this.getInternalApiHeaders();
    if (!headers) {
      throw new ServiceUnavailableException(
        'INTERNAL_API_SECRET is not configured — cannot send commands to display',
      );
    }

    const url = `${this.realtimeUrl}/api/internal/command`;

    try {
      await this.circuitBreaker.executeWithFallback(
        'realtime-service',
        async () => {
          const response = await firstValueFrom(
            this.httpService.post(url, {
              deviceId: displayId,
              command: {
                type: 'screenshot',
                payload: { requestId },
              },
            }, { headers, timeout: REALTIME_HTTP_TIMEOUT_MS }),
          );
          if (response.data?.success === false) {
            throw new ServiceUnavailableException(
              response.data?.message || 'Screenshot command was not acknowledged by the realtime service',
            );
          }
          this.logger.log(`Screenshot requested for display ${displayId} (requestId: ${requestId})`);
        },
        (error) => {
          if (error) {
            this.logger.warn(
              `Failed to send screenshot command to display ${displayId}: ${error.message}`,
            );
            throw error;
          } else {
            this.logger.warn(
              `Realtime service circuit is open, cannot send screenshot command to display ${displayId}`,
            );
            throw new ServiceUnavailableException('Realtime service temporarily unavailable');
          }
        },
        REALTIME_CIRCUIT_CONFIG,
      );
    } catch (error) {
      // If the downstream already threw a NestJS HttpException
      // (e.g., the ServiceUnavailableException above), let it propagate
      // so the original status code reaches the client. Wrap unknown
      // errors as 503 (the realtime gateway is the dependency that
      // failed, so we're temporarily unable to satisfy the request).
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to request screenshot: ${errorMessage}`);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Failed to send screenshot request to device');
    }

    return { requestId };
  }

  /**
   * Get the last captured screenshot for a display
   */
  async getLastScreenshot(
    organizationId: string,
    displayId: string,
  ): Promise<{ url: string; capturedAt: Date; width?: number; height?: number } | null> {
    // Verify display exists and belongs to organization
    const display = await this.findOne(organizationId, displayId);

    if (!display.lastScreenshot || !display.lastScreenshotAt) {
      return null;
    }

    // Parse metadata from lastScreenshot field if it's JSON
    // Format: { url: string, width?: number, height?: number }
    let metadata: Record<string, unknown> = {};
    try {
      if (display.lastScreenshot.startsWith('{')) {
        metadata = JSON.parse(display.lastScreenshot);
      } else {
        // Legacy format: just the URL
        metadata = { url: display.lastScreenshot };
      }
    } catch {
      // Invalid JSON, treat as plain URL
      metadata = { url: display.lastScreenshot };
    }

    return {
      url: metadata.url || display.lastScreenshot,
      capturedAt: display.lastScreenshotAt,
      width: metadata.width,
      height: metadata.height,
    };
  }

  /**
   * Save screenshot metadata after a device uploads one
   * Called by the realtime service after receiving screenshot data
   */
  async saveScreenshot(
    displayId: string,
    organizationId: string,
    screenshotUrl: string,
    width?: number,
    height?: number,
  ): Promise<void> {
    const metadata = JSON.stringify({
      url: screenshotUrl,
      ...(width && { width }),
      ...(height && { height }),
    });

    await this.db.display.update({
      where: { id: displayId, organizationId },
      data: {
        lastScreenshot: metadata,
        lastScreenshotAt: new Date(),
      },
    });

    this.logger.log(`Screenshot saved for display ${displayId}: ${screenshotUrl}`);
  }

  async disableDevice(id: string, organizationId: string) {
    // Defense-in-depth: org-scoped write prevents TOCTOU races
    const result = await this.db.display.updateMany({
      where: { id, organizationId },
      data: { isDisabled: true },
    });
    if (result.count === 0) {
      throw new NotFoundException('Display not found');
    }

    // Send disable command to device via realtime gateway (fire-and-forget)
    this.sendDeviceCommand(id, 'disable').catch((error) => {
      this.logger.warn(`Failed to send disable command to device ${id}: ${error.message}`);
    });

    this.emitDisplayEvent('disabled', id, organizationId);
    return { message: 'Device disabled successfully' };
  }

  async enableDevice(id: string, organizationId: string) {
    // Defense-in-depth: org-scoped write prevents TOCTOU races
    const result = await this.db.display.updateMany({
      where: { id, organizationId },
      data: { isDisabled: false },
    });
    if (result.count === 0) {
      throw new NotFoundException('Display not found');
    }

    // Send enable command to device via realtime gateway (fire-and-forget)
    this.sendDeviceCommand(id, 'enable').catch((error) => {
      this.logger.warn(`Failed to send enable command to device ${id}: ${error.message}`);
    });

    this.emitDisplayEvent('enabled', id, organizationId);
    return { message: 'Device enabled successfully' };
  }

  private async sendDeviceCommand(displayId: string, command: string, payload?: Record<string, unknown>): Promise<void> {
    const headers = this.getInternalApiHeaders();
    if (!headers) return;

    const url = `${this.realtimeUrl}/api/internal/command`;

    await this.circuitBreaker.executeWithFallback(
      'realtime-service',
      async () => {
        await firstValueFrom(
          this.httpService.post(url, {
            deviceId: displayId,
            command: {
              type: command,
              payload,
            },
          }, { headers, timeout: REALTIME_HTTP_TIMEOUT_MS }),
        );
        this.logger.log(`Command '${command}' sent to device ${displayId}`);
      },
      (error) => {
        if (error) {
          this.logger.warn(`Failed to send command '${command}' to device ${displayId}: ${error.message}`);
        } else {
          this.logger.warn(`Realtime service circuit is open, cannot send command '${command}' to device ${displayId}`);
        }
      },
      REALTIME_CIRCUIT_CONFIG,
    );
  }

  async updateQrOverlay(
    organizationId: string,
    id: string,
    dto: UpdateQrOverlayDto,
  ): Promise<UpdateQrOverlayDto>;
  async updateQrOverlay(
    organizationId: string,
    id: string,
    dto: UpdateQrOverlayDto,
  ): Promise<UpdateQrOverlayDto> {
    const qrOverlay = {
      enabled: dto.enabled,
      url: dto.url,
      position: dto.position || 'bottom-right',
      size: dto.size || 120,
      opacity: dto.opacity ?? 1,
      margin: dto.margin || 16,
      backgroundColor: dto.backgroundColor || '#ffffff',
      ...(dto.label !== undefined ? { label: dto.label } : {}),
    };

    await this.writeQrOverlay(organizationId, id, qrOverlay);
    return qrOverlay;
  }

  async removeQrOverlay(organizationId: string, id: string): Promise<void> {
    await this.writeQrOverlay(organizationId, id);
  }

  private async writeQrOverlay(
    organizationId: string,
    id: string,
    qrOverlay?: UpdateQrOverlayDto,
  ): Promise<void> {
    const display = await this.findOne(organizationId, id);
    const metadata = (display.metadata as Record<string, unknown>) || {};
    if (qrOverlay) {
      metadata.qrOverlay = qrOverlay;
    } else {
      delete metadata.qrOverlay;
    }

    // Defense-in-depth: include organizationId to prevent TOCTOU races
    const result = await this.db.display.updateMany({
      where: { id, organizationId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
    if (result.count === 0) {
      throw new NotFoundException('Display not found');
    }
  }
}
