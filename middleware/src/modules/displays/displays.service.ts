import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
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

const MINIO_URL_PREFIX = 'minio://';

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
  ) {}

  async create(organizationId: string, createDisplayDto: CreateDisplayDto) {
    const { deviceId, name, ...rest } = createDisplayDto;

    try {
      return await this.db.display.create({
        data: {
          ...rest,
          deviceIdentifier: deviceId,
          nickname: name,
          organizationId,
        },
      });
    } catch (error) {
      // Handle unique constraint violation (race condition on deviceIdentifier)
      if (error.code === 'P2002') {
        throw new ConflictException('Display with this device ID already exists');
      }
      throw error;
    }
  }

  async findAll(organizationId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.display.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
      this.db.display.count({ where: { organizationId } }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const display = await this.db.display.findFirst({
      where: { id, organizationId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        groups: {
          include: {
            displayGroup: true,
          },
        },
        schedules: {
          where: { isActive: true },
          include: {
            playlist: true,
          },
        },
      },
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

    const updatedDisplay = await this.db.display.update({
      where: { id },
      data: {
        ...rest,
        ...(deviceId && { deviceIdentifier: deviceId }),
        ...(name && { nickname: name }),
        ...(currentPlaylistId !== undefined && { currentPlaylistId }),
      },
    });

    // If playlist was updated, notify the realtime service to push update to device
    // Fire-and-forget - don't block the response if realtime service is down
    if (currentPlaylistId !== undefined && playlist) {
      this.notifyPlaylistUpdate(updatedDisplay.id, playlist).catch(error => {
        this.logger.error(`Failed to notify realtime service, but update succeeded: ${error.message}`);
      });
    }

    return updatedDisplay;
  }

  private async notifyPlaylistUpdate(displayId: string, playlist: unknown): Promise<void> {
    const url = `${this.realtimeUrl}/api/push/playlist`;

    // Use circuit breaker with fallback - if circuit is open or call fails, just log
    await this.circuitBreaker.executeWithFallback(
      'realtime-service',
      async () => {
        await firstValueFrom(
          this.httpService.post(url, {
            deviceId: displayId,
            playlist,
          }, {
            headers: { 'x-internal-api-key': process.env.INTERNAL_API_SECRET || '' },
          }),
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

  async updateHeartbeat(deviceIdentifier: string) {
    return this.db.display.update({
      where: { deviceIdentifier },
      data: {
        lastHeartbeat: new Date(),
        status: 'online',
      },
    });
  }

  async generatePairingToken(organizationId: string, id: string) {
    const display = await this.findOne(organizationId, id);

    // Generate device JWT token using DEVICE_JWT_SECRET (not the user JWT_SECRET)
    const deviceSecret = process.env.DEVICE_JWT_SECRET;
    if (!deviceSecret || deviceSecret.length < 32) {
      throw new Error('DEVICE_JWT_SECRET must be set and be at least 32 characters');
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

    // Update display with hashed token
    await this.db.display.update({
      where: { id },
      data: {
        jwtToken: hashedToken, // Store hash, not plaintext
        pairedAt: new Date(),
        status: 'pairing',
      },
    });

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
    return this.db.display.delete({
      where: { id },
    });
  }

  async getTags(organizationId: string, displayId: string) {
    await this.findOne(organizationId, displayId);

    const displayTags = await this.db.displayTag.findMany({
      where: { displayId },
      include: { tag: true },
    });

    return displayTags.map((dt) => dt.tag);
  }

  async addTags(organizationId: string, displayId: string, tagIds: string[]) {
    await this.findOne(organizationId, displayId);

    // Create DisplayTag entries for each tag, skipping duplicates
    const createPromises = tagIds.map((tagId) =>
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

    return { success: true, removed: tagIds.length };
  }

  async pushContent(
    organizationId: string,
    displayId: string,
    contentId: string,
    duration: number = 30,
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

    // Resolve minio:// URLs to presigned HTTP URLs before sending to device
    let contentUrl = content.url;
    if (contentUrl && contentUrl.startsWith(MINIO_URL_PREFIX) && this.storageService.isMinioAvailable()) {
      try {
        const objectKey = contentUrl.substring(MINIO_URL_PREFIX.length);
        contentUrl = await this.storageService.getPresignedUrl(objectKey, 3600);
        this.logger.log(`Resolved minio:// URL to presigned URL for content ${contentId}`);
      } catch (error) {
        this.logger.warn(`Failed to resolve minio:// URL for content ${contentId}: ${error.message}`);
      }
    }

    const url = `${this.realtimeUrl}/api/push/content`;

    // Use circuit breaker with fallback
    await this.circuitBreaker.executeWithFallback(
      'realtime-service',
      async () => {
        await firstValueFrom(
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
          }, {
            headers: { 'x-internal-api-key': process.env.INTERNAL_API_SECRET || '' },
          }),
        );
        this.logger.log(`Pushed content ${contentId} to display ${displayId} for ${duration}s`);
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
          throw new Error('Realtime service temporarily unavailable');
        }
      },
      REALTIME_CIRCUIT_CONFIG,
    );

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
    // Verify playlist belongs to org
    const playlist = await this.db.playlist.findFirst({
      where: { id: playlistId, organizationId },
    });
    if (!playlist) {
      throw new NotFoundException('Playlist not found or does not belong to your organization');
    }

    const result = await this.db.display.updateMany({
      where: {
        id: { in: displayIds },
        organizationId,
      },
      data: { currentPlaylistId: playlistId },
    });
    return { updated: result.count };
  }

  async bulkAssignGroup(organizationId: string, displayIds: string[], displayGroupId: string) {
    // Verify group belongs to org
    const group = await this.db.displayGroup.findFirst({
      where: { id: displayGroupId, organizationId },
    });
    if (!group) {
      throw new NotFoundException('Display group not found or does not belong to your organization');
    }

    const members = displayIds.map(displayId => ({
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
    const url = `${this.realtimeUrl}/api/internal/command`;

    try {
      await this.circuitBreaker.executeWithFallback(
        'realtime-service',
        async () => {
          await firstValueFrom(
            this.httpService.post(url, {
              displayId,
              command: 'screenshot',
              payload: { requestId },
            }, {
              headers: { 'x-internal-api-key': process.env.INTERNAL_API_SECRET || '' },
            }),
          );
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
            throw new Error('Realtime service temporarily unavailable');
          }
        },
        REALTIME_CIRCUIT_CONFIG,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to request screenshot: ${errorMessage}`);
      throw new Error('Failed to send screenshot request to device');
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
    let metadata: any = {};
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

  async updateQrOverlay(organizationId: string, id: string, dto: UpdateQrOverlayDto) {
    const display = await this.findOne(organizationId, id);
    const metadata = (display.metadata as Record<string, any>) || {};
    metadata.qrOverlay = {
      enabled: dto.enabled,
      url: dto.url,
      position: dto.position || 'bottom-right',
      size: dto.size || 120,
      opacity: dto.opacity ?? 1,
      margin: dto.margin || 16,
      backgroundColor: dto.backgroundColor || '#ffffff',
      label: dto.label,
    };

    return this.db.display.update({
      where: { id },
      data: { metadata: metadata as any },
    });
  }

  async removeQrOverlay(organizationId: string, id: string) {
    const display = await this.findOne(organizationId, id);
    const metadata = (display.metadata as Record<string, any>) || {};
    delete metadata.qrOverlay;

    return this.db.display.update({
      where: { id },
      data: { metadata: metadata as any },
    });
  }
}
