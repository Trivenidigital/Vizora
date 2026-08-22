import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
  ConflictException,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { ProvisioningTemplatesService } from '../provisioning-templates/provisioning-templates.service';
import { DisplaysService } from './displays.service';
import { deviceTokenGraceKey } from '../common/device-token-auth.util';
import { resolvePublicAppUrl } from '../common/utils/public-app-url';
import { RequestPairingDto } from './dto/request-pairing.dto';
import { CompletePairingDto } from './dto/complete-pairing.dto';
import type { Prisma } from '@vizora/database';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

interface PairingRequest {
  code: string;
  deviceIdentifier: string;
  nickname: string;
  metadata: Record<string, unknown>;
  createdAt: string; // ISO string for JSON serialization
  expiresAt: string; // ISO string for JSON serialization
  qrCode?: string;
  activePairingOrganizationId?: string;
  organizationId?: string;
  plaintextToken?: string;
}

interface ActivePairingResponse {
  code: string;
  nickname: string;
  createdAt: string;
  expiresAt: string;
}

interface PairingRequestRecord {
  code: string;
  request: PairingRequest;
}

const PAIRING_TOKEN_CHECK_SELECT = {
  jwtToken: true,
  organizationId: true,
} as const satisfies Prisma.DisplaySelect;

const PAIRING_STATUS_SELECT = {
  id: true,
  organizationId: true,
} as const satisfies Prisma.DisplaySelect;

const PAIRING_EXISTING_DISPLAY_SELECT = {
  id: true,
  location: true,
  organizationId: true,
} as const satisfies Prisma.DisplaySelect;

const PAIRING_RESULT_SELECT = {
  id: true,
  nickname: true,
  deviceIdentifier: true,
  status: true,
} as const satisfies Prisma.DisplaySelect;

const PAIRING_REBIND_TARGET_SELECT = {
  id: true,
  organizationId: true,
  deviceIdentifier: true,
  isDisabled: true,
} as const satisfies Prisma.DisplaySelect;

const PAIRING_IDENTIFIER_HOLDER_SELECT = {
  id: true,
  organizationId: true,
} as const satisfies Prisma.DisplaySelect;

/**
 * REPAIR — prefix stamped onto the `deviceIdentifier` of a row whose identifier
 * a rebind takes over. See `PairingService.rebindPairingSession` for the rule.
 */
export const RETIRED_DEVICE_IDENTIFIER_PREFIX = 'retired:';

/** Prisma unique-constraint violation. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';
/** Prisma "record to update not found". */
const PRISMA_RECORD_NOT_FOUND = 'P2025';

function prismaErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: string }).code
    : undefined;
}

@Injectable()
export class PairingService implements OnModuleDestroy {
  private readonly logger = new Logger(PairingService.name);
  private readonly PAIRING_CODE_LENGTH = 6;
  private readonly PAIRING_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly PAIRING_TTL_SECONDS = 300; // 5 minutes
  private readonly PAIRING_READ_BATCH_SIZE = 100;
  private readonly REDIS_KEY_PREFIX = 'pairing:';
  private readonly REDIS_ACTIVE_ORG_INDEX_PREFIX = 'pairing-active-org:';
  private readonly REDIS_COMPLETION_CLAIM_PREFIX = 'pairing-complete-claim:';
  private readonly REDIS_NEW_DISPLAY_CLAIM_PREFIX =
    'pairing-new-display-claim:';
  private readonly REDIS_REBIND_CLAIM_PREFIX = 'pairing-rebind-claim:';
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly events: EventEmitter2,
    private readonly provisioningTemplatesService: ProvisioningTemplatesService,
    private readonly displaysService: DisplaysService,
  ) {
    // Cleanup interval as safety net — Redis TTL handles most expiration,
    // but this catches edge cases if Redis is temporarily unavailable.
    this.cleanupIntervalId = setInterval(
      () => this.cleanupExpiredRequests(),
      60000,
    );
  }

  onModuleDestroy() {
    // Clean up interval to prevent memory leak
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      this.logger.log('Pairing cleanup interval cleared');
    }
  }

  private redisKey(code: string): string {
    return `${this.REDIS_KEY_PREFIX}${code}`;
  }

  private activeOrgPairingIndexKey(organizationId: string): string {
    return `${this.REDIS_ACTIVE_ORG_INDEX_PREFIX}${organizationId}`;
  }

  private completionClaimKey(code: string): string {
    return `${this.REDIS_COMPLETION_CLAIM_PREFIX}${code}`;
  }

  private newDisplayClaimKey(organizationId: string): string {
    return `${this.REDIS_NEW_DISPLAY_CLAIM_PREFIX}${organizationId}`;
  }

  private rebindClaimKey(displayId: string): string {
    return `${this.REDIS_REBIND_CLAIM_PREFIX}${displayId}`;
  }

  private async getPairingRequest(
    code: string,
  ): Promise<PairingRequest | null> {
    try {
      const data = await this.redisService.get(this.redisKey(code));
      if (!data) return null;
      return this.parsePairingRequest(data, code);
    } catch (error) {
      this.logger.error(
        `Failed to get pairing request for code ${code}: ${error}`,
      );
      return null;
    }
  }

  private parsePairingRequest(
    data: string,
    code: string,
  ): PairingRequest | null {
    try {
      return JSON.parse(data) as PairingRequest;
    } catch (error) {
      this.logger.error(
        `Failed to parse pairing request for code ${code}: ${error}`,
      );
      return null;
    }
  }

  private async setPairingRequest(
    code: string,
    request: PairingRequest,
  ): Promise<boolean> {
    try {
      const data = JSON.stringify(request);
      return await this.redisService.set(
        this.redisKey(code),
        data,
        this.PAIRING_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set pairing request for code ${code}: ${error}`,
      );
      return false;
    }
  }

  private async deletePairingRequest(code: string): Promise<boolean> {
    try {
      return await this.redisService.del(this.redisKey(code));
    } catch (error) {
      this.logger.error(
        `Failed to delete pairing request for code ${code}: ${error}`,
      );
      return false;
    }
  }

  private async setActiveOrgPairingIndex(
    organizationId: string | undefined,
    code: string,
    expiresAt: Date,
  ): Promise<void> {
    if (!organizationId) return;

    const client = this.redisService.getClient();
    if (!client) return;

    try {
      const indexKey = this.activeOrgPairingIndexKey(organizationId);
      await client.zadd(indexKey, expiresAt.getTime(), code);
      await client.expire(indexKey, this.PAIRING_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `Failed to index active pairing code ${code} for org ${organizationId}: ${error}`,
      );
    }
  }

  private async deleteActiveOrgPairingIndex(
    organizationId: string | undefined,
    code: string,
  ): Promise<void> {
    if (!organizationId) return;
    await this.removeActiveOrgPairingCodes(organizationId, [code]);
  }

  private async removeActiveOrgPairingCodes(
    organizationId: string,
    codes: string[],
  ): Promise<void> {
    if (codes.length === 0) return;

    const client = this.redisService.getClient();
    if (!client) return;

    try {
      await client.zrem(this.activeOrgPairingIndexKey(organizationId), ...codes);
    } catch (error) {
      this.logger.warn(
        `Failed to remove active pairing codes for org ${organizationId}: ${error}`,
      );
    }
  }

  private async getActiveOrgPairingCodes(
    organizationId: string,
    now: Date,
  ): Promise<string[]> {
    const client = this.redisService.getClient();
    if (!client) return [];

    try {
      const indexKey = this.activeOrgPairingIndexKey(organizationId);
      const nowMs = now.getTime();
      await client.zremrangebyscore(indexKey, '-inf', nowMs);
      return await client.zrangebyscore(indexKey, nowMs + 1, '+inf');
    } catch (error) {
      this.logger.error(
        `Failed to read active pairing index for org ${organizationId}: ${error}`,
      );
      return [];
    }
  }

  private async claimPairingCompletion(code: string): Promise<string> {
    const client = this.redisService.getClient();
    if (!client) {
      throw new BadRequestException(
        'Pairing service unavailable. Please try again.',
      );
    }

    const claimToken = crypto.randomUUID();
    try {
      const result = await client.set(
        this.completionClaimKey(code),
        claimToken,
        'EX',
        this.PAIRING_TTL_SECONDS,
        'NX',
      );

      if (result !== 'OK') {
        throw new BadRequestException(
          'Pairing code is already being completed',
        );
      }

      return claimToken;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to claim pairing completion for code ${code}: ${error}`,
      );
      throw new BadRequestException(
        'Pairing service unavailable. Please try again.',
      );
    }
  }

  private async releasePairingCompletionClaim(
    code: string,
    claimToken: string,
  ): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) return;

    try {
      await client.eval(
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
        1,
        this.completionClaimKey(code),
        claimToken,
      );
    } catch (error) {
      this.logger.error(
        `Failed to release pairing completion claim for code ${code}: ${error}`,
      );
    }
  }

  private async claimNewDisplayPairing(
    organizationId: string,
  ): Promise<string> {
    const client = this.redisService.getClient();
    if (!client) {
      throw new BadRequestException(
        'Pairing service unavailable. Please try again.',
      );
    }

    const claimToken = crypto.randomUUID();
    try {
      const result = await client.set(
        this.newDisplayClaimKey(organizationId),
        claimToken,
        'EX',
        this.PAIRING_TTL_SECONDS,
        'NX',
      );

      if (result !== 'OK') {
        throw new ConflictException(
          'Another display pairing is already being completed for this organization',
        );
      }

      return claimToken;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(
        `Failed to claim new display pairing for org ${organizationId}: ${error}`,
      );
      throw new BadRequestException(
        'Pairing service unavailable. Please try again.',
      );
    }
  }

  private async releaseNewDisplayPairingClaim(
    organizationId: string,
    claimToken: string,
  ): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) return;

    try {
      await client.eval(
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
        1,
        this.newDisplayClaimKey(organizationId),
        claimToken,
      );
    } catch (error) {
      this.logger.error(
        `Failed to release new display pairing claim for org ${organizationId}: ${error}`,
      );
    }
  }

  /**
   * REPAIR — serialize rebinds PER TARGET DISPLAY.
   *
   * `claimPairingCompletion` is keyed by pairing CODE, so it already makes one
   * code complete exactly once; it does nothing about two DIFFERENT codes (two
   * TVs, two admins) racing onto the SAME display row. Last-write-wins there
   * would hand both admins a success while only one TV ends up holding the
   * stored credential — the other screen would poll, receive a token, and be
   * rejected forever. Same SET NX EX primitive as the other two claims, and
   * the same fail-CLOSED posture: no Redis, no rebind.
   */
  private async claimRebindTarget(displayId: string): Promise<string> {
    const client = this.redisService.getClient();
    if (!client) {
      throw new BadRequestException(
        'Pairing service unavailable. Please try again.',
      );
    }

    const claimToken = crypto.randomUUID();
    try {
      const result = await client.set(
        this.rebindClaimKey(displayId),
        claimToken,
        'EX',
        this.PAIRING_TTL_SECONDS,
        'NX',
      );

      if (result !== 'OK') {
        throw new ConflictException(
          'This display is already being re-paired. Please try again.',
        );
      }

      return claimToken;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(
        `Failed to claim rebind for display ${displayId}: ${error}`,
      );
      throw new BadRequestException(
        'Pairing service unavailable. Please try again.',
      );
    }
  }

  private async releaseRebindTargetClaim(
    displayId: string,
    claimToken: string,
  ): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) return;

    try {
      await client.eval(
        'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
        1,
        this.rebindClaimKey(displayId),
        claimToken,
      );
    } catch (error) {
      this.logger.error(
        `Failed to release rebind claim for display ${displayId}: ${error}`,
      );
    }
  }

  private async hasPairingRequest(code: string): Promise<boolean> {
    try {
      return await this.redisService.exists(this.redisKey(code));
    } catch (error) {
      this.logger.error(
        `Failed to check pairing request for code ${code}: ${error}`,
      );
      return false;
    }
  }

  async requestPairingCode(requestDto: RequestPairingDto) {
    const { deviceIdentifier, nickname, metadata } = requestDto;

    // Check if device already exists and is paired
    const existingDisplay = await this.db.display.findUnique({
      where: { deviceIdentifier },
      select: PAIRING_TOKEN_CHECK_SELECT,
    });

    if (existingDisplay && existingDisplay.jwtToken) {
      throw new BadRequestException(
        'Device is already paired. Please unpair first.',
      );
    }

    // Generate unique 6-character alphanumeric code
    let code = this.generatePairingCode();
    let attempts = 0;

    // Ensure code is unique
    while ((await this.hasPairingRequest(code)) && attempts < 10) {
      code = this.generatePairingCode();
      attempts++;
    }

    if (attempts >= 10) {
      throw new BadRequestException('Unable to generate unique pairing code');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.PAIRING_EXPIRY_MS);

    // Generate QR code
    const pairingUrl = `${resolvePublicAppUrl()}/dashboard/devices/pair?code=${code}`;
    let qrCodeDataUrl: string | undefined;

    try {
      qrCodeDataUrl = await QRCode.toDataURL(pairingUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error) {
      this.logger.error('Failed to generate QR code:', error);
      // Continue without QR code
    }

    // Store pairing request in Redis with TTL
    const pairingRequest: PairingRequest = {
      code,
      deviceIdentifier,
      nickname: nickname || 'Unnamed Display',
      metadata,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      qrCode: qrCodeDataUrl,
      activePairingOrganizationId: existingDisplay?.organizationId,
    };

    const stored = await this.setPairingRequest(code, pairingRequest);
    if (!stored) {
      throw new BadRequestException(
        'Failed to store pairing request. Please try again.',
      );
    }
    await this.setActiveOrgPairingIndex(
      pairingRequest.activePairingOrganizationId,
      code,
      expiresAt,
    );

    this.logger.log(
      `Pairing code generated: ${code} for device ${deviceIdentifier}`,
    );

    return {
      code,
      qrCode: qrCodeDataUrl,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: Math.floor(this.PAIRING_EXPIRY_MS / 1000),
      pairingUrl,
    };
  }

  async checkPairingStatus(code: string) {
    const request = await this.getPairingRequest(code);

    if (!request) {
      throw new NotFoundException('Pairing code not found or expired');
    }

    // Check if expired (safety check — Redis TTL should handle this)
    if (new Date() > new Date(request.expiresAt)) {
      await this.deleteActiveOrgPairingIndex(
        request.activePairingOrganizationId,
        code,
      );
      await this.deletePairingRequest(code);
      throw new BadRequestException('Pairing code has expired');
    }

    // Check if pairing has been completed (plaintextToken is set by completePairing)
    // We return the plaintext token from the Redis request, NOT from the DB,
    // because the DB now stores only the hashed token for security.
    if (request.plaintextToken) {
      const display = await this.db.display.findUnique({
        where: { deviceIdentifier: request.deviceIdentifier },
        select: PAIRING_STATUS_SELECT,
      });

      // Pairing complete! Clean up request and return plaintext token
      await this.deleteActiveOrgPairingIndex(
        request.activePairingOrganizationId,
        code,
      );
      await this.deletePairingRequest(code);

      return {
        status: 'paired',
        deviceToken: request.plaintextToken,
        deviceId: display?.id,
        organizationId: display?.organizationId,
        // Device Revocation Contract v1.1 item 1: the device binds its cache and
        // persisted playlist to `tenantId` and refuses to render on mismatch.
        // The backend's tenant identity IS organizationId — this is a wire-boundary
        // alias, NOT a model rename (the device reads the literal key `tenantId`).
        tenantId: display?.organizationId,
      };
    }

    return {
      status: 'pending',
      expiresAt: request.expiresAt,
    };
  }

  async completePairing(
    organizationId: string,
    userId: string,
    completeDto: CompletePairingDto,
  ) {
    const { code, nickname, provisioningTemplateId, targetDisplayId } =
      completeDto;

    // REPAIR — a provisioning template writes defaultOrientation /
    // defaultTimezone / defaultPlaylistId, i.e. exactly the tenant
    // configuration a rebind exists to preserve. Refuse the combination
    // rather than silently letting one of the two intents win.
    if (targetDisplayId && provisioningTemplateId) {
      throw new BadRequestException(
        'provisioningTemplateId cannot be combined with targetDisplayId — re-pairing preserves the existing display configuration',
      );
    }

    const request = await this.getPairingRequest(code);

    if (!request) {
      throw new NotFoundException('Pairing code not found or expired');
    }

    if (request.plaintextToken || request.organizationId) {
      await this.deleteActiveOrgPairingIndex(
        request.activePairingOrganizationId,
        code,
      );
      throw new BadRequestException('Pairing code has already been completed');
    }

    // Check if expired (safety check — Redis TTL should handle this)
    if (new Date() > new Date(request.expiresAt)) {
      await this.deleteActiveOrgPairingIndex(
        request.activePairingOrganizationId,
        code,
      );
      await this.deletePairingRequest(code);
      throw new BadRequestException('Pairing code has expired');
    }

    // O6 — Resolve provisioning-template defaults if the operator specified
    // one. Cross-org guard lives inside resolveForPairing (throws NotFound
    // if the template belongs to another org). If unspecified, this resolves
    // to undefined and the Display falls back to Vizora-level defaults.
    const completionClaimToken = await this.claimPairingCompletion(code);
    let newDisplayClaimToken: string | null = null;
    let rebindClaimToken: string | null = null;
    let releaseCompletionClaim = true;

    try {
      // REPAIR — rebind an existing logical display onto this live session.
      // Deliberately BEFORE the deviceIdentifier lookup below: on this path the
      // target row is named by the admin, not found by identifier, and neither
      // `claimNewDisplayPairing` nor `enforceScreenQuota` may run — a rebind
      // consumes no new screen, so a tenant sitting exactly at its limit must
      // still be able to recover a broken display.
      if (targetDisplayId) {
        rebindClaimToken = await this.claimRebindTarget(targetDisplayId);

        const minted = this.mintDeviceToken({
          displayId: targetDisplayId,
          deviceIdentifier: request.deviceIdentifier,
          organizationId,
        });

        const rebound = await this.rebindPairingSession({
          organizationId,
          userId,
          targetDisplayId,
          deviceIdentifier: request.deviceIdentifier,
          hashedToken: minted.hashedToken,
          metadata: request.metadata,
          nickname,
          location: completeDto.location,
        });

        return await this.finalizePairing({
          code,
          request,
          organizationId,
          display: rebound.display,
          jwtToken: minted.token,
          onFinalizeFailure: () => {
            releaseCompletionClaim = false;
          },
        });
      }

      const provisioningDefaults = provisioningTemplateId
        ? await this.provisioningTemplatesService.resolveForPairing(
            organizationId,
            provisioningTemplateId,
          )
        : undefined;

      // Check if device already exists
      const existingDisplay = await this.db.display.findUnique({
        where: { deviceIdentifier: request.deviceIdentifier },
        select: PAIRING_EXISTING_DISPLAY_SELECT,
      });

      if (
        existingDisplay &&
        existingDisplay.organizationId !== organizationId
      ) {
        throw new NotFoundException('Pairing code not found or expired');
      }

      if (!existingDisplay) {
        newDisplayClaimToken =
          await this.claimNewDisplayPairing(organizationId);
        await this.enforceScreenQuota(organizationId);
      }

      // Generate device JWT token
      const minted = this.mintDeviceToken({
        displayId: existingDisplay?.id || crypto.randomUUID(),
        deviceIdentifier: request.deviceIdentifier,
        organizationId,
      });
      const jwtToken = minted.token;
      // Hash the token before storing in database for security
      // If database is compromised, attacker cannot use the hashed tokens
      const hashedToken = minted.hashedToken;
      let display: Prisma.DisplayGetPayload<{
        select: typeof PAIRING_RESULT_SELECT;
      }>;

      if (existingDisplay) {
        // Update existing display
        // Set status to 'pairing' - the WebSocket gateway will update to 'online' when device connects
        display = await this.db.display.update({
          where: { id: existingDisplay.id },
          data: {
            nickname: nickname || request.nickname,
            organizationId,
            jwtToken: hashedToken, // Store hash, not plaintext
            pairedAt: new Date(),
            lastHeartbeat: new Date(),
            status: 'pairing',
            location: completeDto.location || existingDisplay.location,
            // O6 — apply provisioning-template defaults. Spread last so they
            // override the Vizora-level defaults but NOT explicit fields above.
            ...(provisioningDefaults ?? {}),
          },
          select: PAIRING_RESULT_SELECT,
        });
      } else {
        // Create new display
        // Set status to 'pairing' - the WebSocket gateway will update to 'online' when device connects
        display = await this.db.display.create({
          data: {
            id: minted.displayId,
            deviceIdentifier: request.deviceIdentifier,
            nickname: nickname || request.nickname,
            organizationId,
            jwtToken: hashedToken, // Store hash, not plaintext
            pairedAt: new Date(),
            lastHeartbeat: new Date(),
            status: 'pairing',
            location: request.metadata?.hostname || null,
            metadata: request.metadata,
            // O6 — apply provisioning-template defaults. Spread last so they
            // override the Display model's Prisma defaults (orientation=
            // 'landscape', timezone='UTC') with the operator's preference.
            ...(provisioningDefaults ?? {}),
          },
          select: PAIRING_RESULT_SELECT,
        });
      }

      return await this.finalizePairing({
        code,
        request,
        organizationId,
        display,
        jwtToken,
        onFinalizeFailure: () => {
          releaseCompletionClaim = false;
        },
      });
    } finally {
      if (newDisplayClaimToken) {
        await this.releaseNewDisplayPairingClaim(
          organizationId,
          newDisplayClaimToken,
        );
      }
      if (rebindClaimToken && targetDisplayId) {
        await this.releaseRebindTargetClaim(targetDisplayId, rebindClaimToken);
      }
      if (releaseCompletionClaim) {
        await this.releasePairingCompletionClaim(code, completionClaimToken);
      }
    }
  }

  /**
   * Mint the device credential. `sub` is ALWAYS the id of the Display row the
   * credential belongs to — on the rebind path that is the preserved logical
   * display, never a freshly generated id.
   */
  private mintDeviceToken(params: {
    displayId: string;
    deviceIdentifier: string;
    organizationId: string;
  }): { displayId: string; token: string; hashedToken: string } {
    const devicePayload = {
      sub: params.displayId,
      deviceIdentifier: params.deviceIdentifier,
      organizationId: params.organizationId,
      type: 'device',
    };

    const deviceSecret = process.env.DEVICE_JWT_SECRET;
    if (!deviceSecret || deviceSecret.length < 32) {
      // Server-side misconfiguration — surface as 500 with a clear
      // message so ops sees the cause in error tracking rather than
      // an empty 500 from a swallowed generic Error.
      throw new InternalServerErrorException(
        'DEVICE_JWT_SECRET must be set and be at least 32 characters',
      );
    }

    const token = this.jwtService.sign(devicePayload, {
      expiresIn: '90d',
      secret: deviceSecret,
      algorithm: 'HS256',
    });

    return {
      displayId: params.displayId,
      token,
      hashedToken: this.hashToken(token),
    };
  }

  /**
   * Shared tail of both pairing paths: log, emit, and hand the plaintext token
   * to the physical display through the Redis pairing record its poller reads.
   */
  private async finalizePairing(params: {
    code: string;
    request: PairingRequest;
    organizationId: string;
    display: Prisma.DisplayGetPayload<{ select: typeof PAIRING_RESULT_SELECT }>;
    jwtToken: string;
    onFinalizeFailure: () => void;
  }) {
    const { code, request, organizationId, display, jwtToken } = params;

    this.logger.log(
      `Device paired successfully: ${display.id} to org ${organizationId}`,
    );

    // Emit domain event for onboarding tracking. Fire-and-forget; listener
    // (OnboardingService.onDisplayPaired) has its own try/catch.
    this.events.emit('display.paired', {
      organizationId,
      displayId: display.id,
    });

    // Store the plaintext token in the Redis request so checkPairingStatus
    // can return it to the device. The DB only has the hashed token.
    // Don't delete the pairing request here - let checkPairingStatus delete it
    // after the device retrieves its token (fixes race condition).
    request.plaintextToken = jwtToken;
    request.organizationId = organizationId;
    const finalized = await this.setPairingRequest(code, request);
    if (!finalized) {
      await this.deleteActiveOrgPairingIndex(
        request.activePairingOrganizationId,
        code,
      );
      params.onFinalizeFailure();
      throw new InternalServerErrorException(
        'Failed to finalize pairing token handoff',
      );
    }
    await this.deleteActiveOrgPairingIndex(
      request.activePairingOrganizationId,
      code,
    );

    return {
      success: true,
      display: {
        id: display.id,
        nickname: display.nickname,
        deviceIdentifier: display.deviceIdentifier,
        status: display.status,
      },
    };
  }

  /**
   * REPAIR — rebind a live pairing session onto an EXISTING Display row.
   *
   * Why this exists: when a display's stored credential is permanently
   * rejected the only field recovery is clearing app storage on the TV, which
   * makes it mint a brand-new `deviceIdentifier`. The old completePairing then
   * took the `!existingDisplay` branch and CREATED a row — losing the logical
   * identity, losing the playlist assignment, orphaning the old row, and
   * leaving that orphan counting against `enforceScreenQuota` until a tenant at
   * its limit could no longer recover at all.
   *
   * PRESERVED (never written here): `id`, `organizationId`, `currentPlaylistId`,
   * schedules, groups, tags, impressions/analytics, orientation, timezone,
   * description, the quota slot — every field that belongs to the logical
   * screen rather than the box behind it. `nickname` and `location` are
   * preserved too unless the admin explicitly supplies a replacement; the
   * DEVICE-supplied `request.nickname` is deliberately NOT used, because the
   * TV's self-reported name must not overwrite what the operator named the
   * screen.
   *
   * REPLACED: everything describing the new physical client — `jwtToken`,
   * `deviceIdentifier`, `metadata`, `pairedAt`, `lastHeartbeat`, `status`, and
   * the stale `socketId` / `unpairedAt` session state.
   *
   * ATOMICITY: identifier takeover + rebind + audit are one transaction, so a
   * DB failure leaves the original display exactly as it was and creates no
   * ghost row. Nothing outside the transaction is dispatched until it commits.
   *
   * WINNER RULES (all deterministic, all negatively tested):
   *  - target must exist, belong to the caller's org, and NOT be `isDisabled`.
   *    The disabled exclusion is load-bearing twice: a disabled row is revoked
   *    per the revocation contract, so minting a credential for it would hand
   *    the TV a token that `auth/check` answers 410 to; and disabled rows do
   *    not count toward `screenQuota`, so rebinding onto one and then enabling
   *    it would be a quota bypass. A concurrent delete or disable therefore
   *    wins if it commits first, and the rebind fails cleanly; a rebind that
   *    commits first wins and the later disable simply revokes as usual.
   *  - the write is a `updateMany` compare-and-set carrying the same predicate,
   *    so Postgres — not a read-then-write — arbitrates between the two PM2
   *    cluster instances.
   */
  private async rebindPairingSession(params: {
    organizationId: string;
    userId: string;
    targetDisplayId: string;
    deviceIdentifier: string;
    hashedToken: string;
    metadata: Record<string, unknown>;
    nickname?: string;
    location?: string;
  }): Promise<{
    display: Prisma.DisplayGetPayload<{ select: typeof PAIRING_RESULT_SELECT }>;
  }> {
    const {
      organizationId,
      userId,
      targetDisplayId,
      deviceIdentifier,
      hashedToken,
    } = params;

    const notFound = () => new NotFoundException('Display not found');

    let result: {
      display: Prisma.DisplayGetPayload<{
        select: typeof PAIRING_RESULT_SELECT;
      }>;
      previousDeviceIdentifier: string;
      retiredDisplayId: string | null;
    };

    try {
      result = await this.db.$transaction(async (tx) => {
        const target = await tx.display.findFirst({
          where: { id: targetDisplayId, organizationId, isDisabled: false },
          select: PAIRING_REBIND_TARGET_SELECT,
        });

        if (!target) {
          // Missing, deleted, disabled or another tenant's row — all answer the
          // same way so a rebind cannot be used to probe for display ids.
          throw notFound();
        }

        const retiredDisplayId = await this.releaseDeviceIdentifier(
          tx,
          deviceIdentifier,
          target.id,
          organizationId,
        );

        const now = new Date();
        const rebound = await tx.display.updateMany({
          where: { id: target.id, organizationId, isDisabled: false },
          data: {
            deviceIdentifier,
            jwtToken: hashedToken, // Store hash, not plaintext
            pairedAt: now,
            lastHeartbeat: now,
            status: 'pairing',
            // Stale session state from the client this row used to be bound to.
            socketId: null,
            unpairedAt: null,
            // `metadata` describes the physical box (OS, model, version), so it
            // follows the new client — but only when the session actually
            // carried one; otherwise leave what is there rather than nulling it.
            ...(params.metadata
              ? { metadata: params.metadata as Prisma.InputJsonValue }
              : {}),
            ...(params.nickname ? { nickname: params.nickname } : {}),
            ...(params.location ? { location: params.location } : {}),
          },
        });

        if (rebound.count !== 1) {
          // Lost the compare-and-set to a concurrent delete/disable.
          throw notFound();
        }

        const display = await tx.display.findUniqueOrThrow({
          where: { id: target.id },
          select: PAIRING_RESULT_SELECT,
        });

        // Audit inside the transaction so "it happened" and "it was recorded"
        // cannot disagree. Identifiers only — no token, no hash, no code.
        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            displayId: target.id,
            action: 'display_repaired',
            entityType: 'display',
            entityId: target.id,
            changes: {
              event: 'pairing_rebind',
              previousDeviceIdentifier: target.deviceIdentifier,
              newDeviceIdentifier: deviceIdentifier,
              retiredDisplayId,
            },
          },
        });

        return {
          display,
          previousDeviceIdentifier: target.deviceIdentifier,
          retiredDisplayId,
        };
      });
    } catch (error) {
      if (prismaErrorCode(error) === PRISMA_RECORD_NOT_FOUND) {
        throw notFound();
      }
      if (prismaErrorCode(error) === PRISMA_UNIQUE_VIOLATION) {
        // `deviceIdentifier` is @unique and the takeover above lost a race
        // (or the incoming identifier collides with a reserved retired name).
        // Surface a conflict the operator can act on, never a raw P2002.
        throw new ConflictException(
          'That device identifier is already in use. Restart pairing on the display and try again.',
        );
      }
      throw error;
    }

    // Committed. Everything below is best-effort cleanup of the OLD credential
    // and must never fail the rebind.
    await this.invalidateOldDeviceCredential(
      targetDisplayId,
      result.retiredDisplayId,
    );

    this.logger.log(
      `display_repaired display=${targetDisplayId} org=${organizationId} actor=${userId} ` +
        `previousDeviceIdentifier=${result.previousDeviceIdentifier} ` +
        `retiredDisplay=${result.retiredDisplayId ?? 'none'}`,
    );

    return { display: result.display };
  }

  /**
   * REPAIR — `Display.deviceIdentifier` is `@unique`, so a rebind must deal
   * with the case where ANOTHER row already holds the identifier the TV is
   * pairing with. That is exactly the ghost this feature exists to clean up:
   * a clear-and-pair created a second row for the same physical box.
   *
   * The rule, chosen for being deterministic, non-destructive and completable
   * inside the pairing code's 5-minute life:
   *
   *  - holder IS the target                → nothing to do (plain re-pair).
   *  - holder is in ANOTHER org            → refuse, with the same opaque
   *    "not found" the rest of the pairing flow uses for cross-tenant hits.
   *    We never touch another tenant's row.
   *  - holder is a different row, same org → RETIRE it: rename its identifier
   *    to a reserved `retired:<id>` form, clear its credential and socket, and
   *    disable it. Nothing is deleted, so the operator keeps the row and its
   *    history and can delete it deliberately; disabling releases the quota
   *    slot the ghost was holding, and clearing the credential means the box
   *    can never authenticate as two displays at once. Refusing instead would
   *    have been simpler but sends the admin away to delete a row and come
   *    back — usually after the code has expired.
   *
   * `retired:<id>` is unique by construction (the row's own primary key) and
   * stable across repeats, so retiring the same ghost twice is idempotent.
   * A crafted identifier that collides with a reserved name still cannot slip
   * through: the unique index rejects it and the caller maps P2002 to a 409.
   */
  private async releaseDeviceIdentifier(
    tx: Prisma.TransactionClient,
    deviceIdentifier: string,
    targetDisplayId: string,
    organizationId: string,
  ): Promise<string | null> {
    const holder = await tx.display.findUnique({
      where: { deviceIdentifier },
      select: PAIRING_IDENTIFIER_HOLDER_SELECT,
    });

    if (!holder || holder.id === targetDisplayId) {
      return null;
    }

    if (holder.organizationId !== organizationId) {
      throw new NotFoundException('Pairing code not found or expired');
    }

    await tx.display.update({
      where: { id: holder.id },
      data: {
        deviceIdentifier: `${RETIRED_DEVICE_IDENTIFIER_PREFIX}${holder.id}`,
        jwtToken: null,
        socketId: null,
        isDisabled: true,
        status: 'offline',
        unpairedAt: new Date(),
      },
    });

    return holder.id;
  }

  /**
   * REPAIR — make the credential the row held BEFORE the rebind unusable, with
   * no new machinery.
   *
   * Two existing mechanisms already do the work; this only makes sure neither
   * is left holding the old credential alive:
   *
   *  1. `Display.jwtToken` is the single authority. The rebind replaced it, so
   *     `isCurrentDeviceToken` fails for the old token and `GET
   *     /devices/auth/check` answers `410 DEVICE_REVOKED` from the next probe
   *     on. Nothing extra needed there.
   *  2. The device-JWT rotation grace record (`device:token:grace:<id>`) is the
   *     one thing that can revive a superseded token. It is already inert after
   *     a rebind — acceptance requires `next === Display.jwtToken`, which the
   *     rebind just changed — but we delete it anyway so there is no window
   *     where a concurrent rotation's record and the new hash could agree.
   *
   * Then the socket: `DisplaysService.sendDeviceRevoked` is the EXISTING
   * revocation channel (broadcast `device:revoked` to the device room +
   * force-disconnect). Fire-and-forget, exactly like every other caller —
   * and safe if it arrives late: the contract makes the device confirm via
   * `auth/check` before purging, so the NEW client, whose token is current,
   * gets a 200 and keeps its credential.
   */
  private async invalidateOldDeviceCredential(
    targetDisplayId: string,
    retiredDisplayId: string | null,
  ): Promise<void> {
    const displayIds = retiredDisplayId
      ? [targetDisplayId, retiredDisplayId]
      : [targetDisplayId];

    for (const displayId of displayIds) {
      try {
        await this.redisService.del(deviceTokenGraceKey(displayId));
      } catch (error) {
        this.logger.warn(
          `Failed to clear device token grace record for ${displayId}: ${error}`,
        );
      }

      this.displaysService
        .sendDeviceRevoked(displayId, 'repaired')
        .catch((error: Error) => {
          this.logger.warn(
            `Failed to send device:revoked for ${displayId}: ${error.message}`,
          );
        });
    }
  }

  async getActivePairings(
    organizationId: string,
  ): Promise<ActivePairingResponse[]> {
    // Return active pairing requests filtered by organization
    // Only show pending requests for devices that already belong to this org.
    const activePairings: ActivePairingResponse[] = [];

    const now = new Date();
    const codes = await this.getActiveOrgPairingCodes(organizationId, now);
    const keys = codes.map((code) => this.redisKey(code));
    const records = await this.getPairingRequestRecords(keys);
    const recordCodes = new Set(records.map(({ code }) => code));
    const staleCodes = codes.filter((code) => !recordCodes.has(code));
    const unclaimedRequests: PairingRequest[] = [];

    for (const { code, request } of records) {
      // Check if expired (safety check)
      if (now >= new Date(request.expiresAt)) {
        staleCodes.push(code);
        continue;
      }

      // Completed records temporarily hold a plaintext device token for the
      // physical display. Do not expose their codes through dashboard list APIs.
      if (request.plaintextToken || request.organizationId) {
        staleCodes.push(code);
        continue;
      }

      if (request.activePairingOrganizationId !== organizationId) {
        staleCodes.push(code);
        continue;
      }

      unclaimedRequests.push(request);
    }

    const displayOrganizationsByDevice =
      await this.getDisplayOrganizationsByDevice(unclaimedRequests);

    for (const request of unclaimedRequests) {
      const displayOrganizationId = displayOrganizationsByDevice.get(
        request.deviceIdentifier,
      );

      // Show unclaimed requests only when the device is already owned by
      // this org. Brand-new unclaimed requests are visible only to the
      // physical display polling its own code, not to every tenant dashboard.
      if (displayOrganizationId === organizationId) {
        activePairings.push({
          code: request.code,
          nickname: request.nickname,
          createdAt: request.createdAt,
          expiresAt: request.expiresAt,
        });
      } else {
        staleCodes.push(request.code);
      }
    }

    await this.removeActiveOrgPairingCodes(organizationId, staleCodes);

    return activePairings;
  }

  private async getPairingRequestRecords(
    keys: string[],
  ): Promise<PairingRequestRecord[]> {
    if (keys.length === 0) return [];

    const client = this.redisService.getClient();

    if (client) {
      try {
        const records: PairingRequestRecord[] = [];

        for (
          let index = 0;
          index < keys.length;
          index += this.PAIRING_READ_BATCH_SIZE
        ) {
          const batchKeys = keys.slice(
            index,
            index + this.PAIRING_READ_BATCH_SIZE,
          );
          const values = await client.mget(...batchKeys);

          values.forEach((data, valueIndex) => {
            if (!data) return;

            const key = batchKeys[valueIndex];
            const code = key.replace(this.REDIS_KEY_PREFIX, '');
            const request = this.parsePairingRequest(data, code);

            if (request) {
              records.push({ code, request });
            }
          });
        }

        return records;
      } catch (error) {
        this.logger.error(`Failed to batch get pairing requests: ${error}`);
      }
    }

    const records: PairingRequestRecord[] = [];
    for (const key of keys) {
      const code = key.replace(this.REDIS_KEY_PREFIX, '');
      const request = await this.getPairingRequest(code);

      if (request) {
        records.push({ code, request });
      }
    }

    return records;
  }

  private async getDisplayOrganizationsByDevice(
    requests: PairingRequest[],
  ): Promise<Map<string, string>> {
    const deviceIdentifiers = Array.from(
      new Set(
        requests.map((request) => request.deviceIdentifier).filter(Boolean),
      ),
    );

    if (deviceIdentifiers.length === 0) {
      return new Map();
    }

    const displays = await this.db.display.findMany({
      where: {
        deviceIdentifier: {
          in: deviceIdentifiers,
        },
      },
      select: { deviceIdentifier: true, organizationId: true },
    });

    return new Map(
      displays.map((display) => [
        display.deviceIdentifier,
        display.organizationId,
      ]),
    );
  }

  private async enforceScreenQuota(organizationId: string): Promise<void> {
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
      select: {
        screenQuota: true,
        _count: {
          select: { displays: { where: { isDisabled: false } } },
        },
      },
    });

    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    if (org.screenQuota === -1) {
      return;
    }

    const currentCount = org._count.displays;
    if (currentCount >= org.screenQuota) {
      throw new ForbiddenException(
        `Screen quota exceeded. You have ${currentCount}/${org.screenQuota} screens. Please upgrade your plan to add more screens.`,
      );
    }
  }

  /**
   * Scan Redis for all pairing keys using SCAN (non-blocking).
   * Returns an array of full Redis key strings.
   */
  private async scanPairingKeys(): Promise<string[]> {
    const client = this.redisService.getClient();
    if (!client) return [];

    const keys: string[] = [];
    try {
      let cursor = '0';
      do {
        const [nextCursor, batch] = await client.scan(
          cursor,
          'MATCH',
          `${this.REDIS_KEY_PREFIX}*`,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');
    } catch (error) {
      this.logger.error(`Failed to scan pairing keys: ${error}`);
    }

    return keys;
  }

  /**
   * Hash a token using SHA-256 for secure storage.
   * Matches the hashing in displays.service.ts.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generatePairingCode(): string {
    // Generate 6-character alphanumeric code (uppercase only for clarity)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters
    let code = '';

    for (let i = 0; i < this.PAIRING_CODE_LENGTH; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      code += chars[randomIndex];
    }

    return code;
  }

  /**
   * Safety-net cleanup. Redis TTL handles most expiration automatically,
   * but this catches keys that might linger due to Redis issues.
   */
  private async cleanupExpiredRequests() {
    const keys = await this.scanPairingKeys();

    for (const key of keys) {
      const code = key.replace(this.REDIS_KEY_PREFIX, '');
      const request = await this.getPairingRequest(code);

      if (request && new Date() > new Date(request.expiresAt)) {
        await this.deleteActiveOrgPairingIndex(
          request.activePairingOrganizationId,
          code,
        );
        await this.deletePairingRequest(code);
        this.logger.debug(`Cleaned up expired pairing code: ${code}`);
      }
    }
  }
}
