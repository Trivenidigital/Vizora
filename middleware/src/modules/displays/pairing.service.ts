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

@Injectable()
export class PairingService implements OnModuleDestroy {
  private readonly logger = new Logger(PairingService.name);
  private readonly PAIRING_CODE_LENGTH = 6;
  private readonly PAIRING_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly PAIRING_TTL_SECONDS = 300; // 5 minutes
  private readonly PAIRING_READ_BATCH_SIZE = 100;
  private readonly REDIS_KEY_PREFIX = 'pairing:';
  private readonly REDIS_COMPLETION_CLAIM_PREFIX = 'pairing-complete-claim:';
  private readonly REDIS_NEW_DISPLAY_CLAIM_PREFIX =
    'pairing-new-display-claim:';
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly events: EventEmitter2,
    private readonly provisioningTemplatesService: ProvisioningTemplatesService,
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

  private completionClaimKey(code: string): string {
    return `${this.REDIS_COMPLETION_CLAIM_PREFIX}${code}`;
  }

  private newDisplayClaimKey(organizationId: string): string {
    return `${this.REDIS_NEW_DISPLAY_CLAIM_PREFIX}${organizationId}`;
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
    const pairingUrl = `${process.env.WEB_URL || 'http://localhost:3001'}/dashboard/devices/pair?code=${code}`;
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
    };

    const stored = await this.setPairingRequest(code, pairingRequest);
    if (!stored) {
      throw new BadRequestException(
        'Failed to store pairing request. Please try again.',
      );
    }

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
      await this.deletePairingRequest(code);

      return {
        status: 'paired',
        deviceToken: request.plaintextToken,
        deviceId: display?.id,
        organizationId: display?.organizationId,
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
    const { code, nickname, provisioningTemplateId } = completeDto;

    const request = await this.getPairingRequest(code);

    if (!request) {
      throw new NotFoundException('Pairing code not found or expired');
    }

    if (request.plaintextToken || request.organizationId) {
      throw new BadRequestException('Pairing code has already been completed');
    }

    // Check if expired (safety check — Redis TTL should handle this)
    if (new Date() > new Date(request.expiresAt)) {
      await this.deletePairingRequest(code);
      throw new BadRequestException('Pairing code has expired');
    }

    // O6 — Resolve provisioning-template defaults if the operator specified
    // one. Cross-org guard lives inside resolveForPairing (throws NotFound
    // if the template belongs to another org). If unspecified, this resolves
    // to undefined and the Display falls back to Vizora-level defaults.
    const completionClaimToken = await this.claimPairingCompletion(code);
    let newDisplayClaimToken: string | null = null;
    let releaseCompletionClaim = true;

    try {
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
      const devicePayload = {
        sub: existingDisplay?.id || crypto.randomUUID(),
        deviceIdentifier: request.deviceIdentifier,
        organizationId,
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

      const jwtToken = this.jwtService.sign(devicePayload, {
        expiresIn: '90d',
        secret: deviceSecret,
        algorithm: 'HS256',
      });

      // Hash the token before storing in database for security
      // If database is compromised, attacker cannot use the hashed tokens
      const hashedToken = this.hashToken(jwtToken);
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
            id: devicePayload.sub,
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
        releaseCompletionClaim = false;
        throw new InternalServerErrorException(
          'Failed to finalize pairing token handoff',
        );
      }

      return {
        success: true,
        display: {
          id: display.id,
          nickname: display.nickname,
          deviceIdentifier: display.deviceIdentifier,
          status: display.status,
        },
      };
    } finally {
      if (newDisplayClaimToken) {
        await this.releaseNewDisplayPairingClaim(
          organizationId,
          newDisplayClaimToken,
        );
      }
      if (releaseCompletionClaim) {
        await this.releasePairingCompletionClaim(code, completionClaimToken);
      }
    }
  }

  async getActivePairings(
    organizationId: string,
  ): Promise<ActivePairingResponse[]> {
    // Return active pairing requests filtered by organization
    // Only show pending requests for devices that already belong to this org.
    const activePairings: ActivePairingResponse[] = [];

    // Use SCAN to find all pairing keys in Redis
    const keys = await this.scanPairingKeys();
    const records = await this.getPairingRequestRecords(keys);
    const now = new Date();
    const unclaimedRequests: PairingRequest[] = [];

    for (const { request } of records) {
      // Check if expired (safety check)
      if (now >= new Date(request.expiresAt)) {
        continue;
      }

      // Completed records temporarily hold a plaintext device token for the
      // physical display. Do not expose their codes through dashboard list APIs.
      if (request.organizationId === organizationId) {
        continue;
      }

      if (!request.organizationId) {
        unclaimedRequests.push(request);
      }
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
      }
    }

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
        await this.deletePairingRequest(code);
        this.logger.debug(`Cleaned up expired pairing code: ${code}`);
      }
    }
  }
}
