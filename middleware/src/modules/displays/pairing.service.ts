import { Injectable, BadRequestException, NotFoundException, OnModuleDestroy, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { RequestPairingDto } from './dto/request-pairing.dto';
import { CompletePairingDto } from './dto/complete-pairing.dto';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

interface PairingRequest {
  code: string;
  deviceIdentifier: string;
  nickname: string;
  metadata: any;
  createdAt: string;   // ISO string for JSON serialization
  expiresAt: string;   // ISO string for JSON serialization
  qrCode?: string;
  organizationId?: string;
  plaintextToken?: string;
}

@Injectable()
export class PairingService implements OnModuleDestroy {
  private readonly logger = new Logger(PairingService.name);
  private readonly PAIRING_CODE_LENGTH = 6;
  private readonly PAIRING_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly PAIRING_TTL_SECONDS = 300; // 5 minutes
  private readonly REDIS_KEY_PREFIX = 'pairing:';
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {
    // Cleanup interval as safety net — Redis TTL handles most expiration,
    // but this catches edge cases if Redis is temporarily unavailable.
    this.cleanupIntervalId = setInterval(() => this.cleanupExpiredRequests(), 60000);
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

  private async getPairingRequest(code: string): Promise<PairingRequest | null> {
    try {
      const data = await this.redisService.get(this.redisKey(code));
      if (!data) return null;
      return JSON.parse(data) as PairingRequest;
    } catch (error) {
      this.logger.error(`Failed to get pairing request for code ${code}: ${error}`);
      return null;
    }
  }

  private async setPairingRequest(code: string, request: PairingRequest): Promise<boolean> {
    try {
      const data = JSON.stringify(request);
      return await this.redisService.set(this.redisKey(code), data, this.PAIRING_TTL_SECONDS);
    } catch (error) {
      this.logger.error(`Failed to set pairing request for code ${code}: ${error}`);
      return false;
    }
  }

  private async deletePairingRequest(code: string): Promise<boolean> {
    try {
      return await this.redisService.del(this.redisKey(code));
    } catch (error) {
      this.logger.error(`Failed to delete pairing request for code ${code}: ${error}`);
      return false;
    }
  }

  private async hasPairingRequest(code: string): Promise<boolean> {
    try {
      return await this.redisService.exists(this.redisKey(code));
    } catch (error) {
      this.logger.error(`Failed to check pairing request for code ${code}: ${error}`);
      return false;
    }
  }

  async requestPairingCode(requestDto: RequestPairingDto) {
    const { deviceIdentifier, nickname, metadata } = requestDto;

    // Check if device already exists and is paired
    const existingDisplay = await this.db.display.findUnique({
      where: { deviceIdentifier },
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
    while (await this.hasPairingRequest(code) && attempts < 10) {
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
      throw new BadRequestException('Failed to store pairing request. Please try again.');
    }

    this.logger.log(`Pairing code generated: ${code} for device ${deviceIdentifier}`);

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
      });

      // Pairing complete! Clean up request and return plaintext token
      await this.deletePairingRequest(code);

      return {
        status: 'paired',
        deviceToken: request.plaintextToken,
        displayId: display?.id,
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
    const { code, nickname } = completeDto;

    const request = await this.getPairingRequest(code);

    if (!request) {
      throw new NotFoundException('Pairing code not found or expired');
    }

    // Check if expired (safety check — Redis TTL should handle this)
    if (new Date() > new Date(request.expiresAt)) {
      await this.deletePairingRequest(code);
      throw new BadRequestException('Pairing code has expired');
    }

    // Check if device already exists
    let display = await this.db.display.findUnique({
      where: { deviceIdentifier: request.deviceIdentifier },
    });

    // Generate device JWT token
    const devicePayload = {
      sub: display?.id || crypto.randomUUID(),
      deviceIdentifier: request.deviceIdentifier,
      organizationId,
      type: 'device',
    };

    const deviceSecret = process.env.DEVICE_JWT_SECRET;
    if (!deviceSecret || deviceSecret.length < 32) {
      throw new Error('DEVICE_JWT_SECRET must be set and be at least 32 characters');
    }

    const jwtToken = this.jwtService.sign(devicePayload, {
      expiresIn: '365d', // 1 year
      secret: deviceSecret,
      algorithm: 'HS256',
    });

    // Hash the token before storing in database for security
    // If database is compromised, attacker cannot use the hashed tokens
    const hashedToken = this.hashToken(jwtToken);

    if (display) {
      // Update existing display
      // Set status to 'pairing' - the WebSocket gateway will update to 'online' when device connects
      display = await this.db.display.update({
        where: { id: display.id },
        data: {
          nickname: nickname || request.nickname,
          organizationId,
          jwtToken: hashedToken, // Store hash, not plaintext
          pairedAt: new Date(),
          status: 'pairing',
        },
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
          status: 'pairing',
          location: request.metadata?.hostname || null,
          metadata: request.metadata,
        },
      });
    }

    this.logger.log(`Device paired successfully: ${display.id} to org ${organizationId}`);

    // Store the plaintext token in the Redis request so checkPairingStatus
    // can return it to the device. The DB only has the hashed token.
    // Don't delete the pairing request here - let checkPairingStatus delete it
    // after the device retrieves its token (fixes race condition).
    request.plaintextToken = jwtToken;
    request.organizationId = organizationId;
    await this.setPairingRequest(code, request);

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

  async getActivePairings(organizationId: string) {
    // Return active pairing requests filtered by organization
    // Only show requests that have been completed for this org,
    // or where the device already belongs to this org
    const activePairings: any[] = [];

    // Use SCAN to find all pairing keys in Redis
    const keys = await this.scanPairingKeys();

    for (const key of keys) {
      const code = key.replace(this.REDIS_KEY_PREFIX, '');
      const request = await this.getPairingRequest(code);

      if (!request) continue;

      // Check if expired (safety check)
      if (new Date() >= new Date(request.expiresAt)) {
        continue;
      }

      // If pairing was completed for this org, show it
      if (request.organizationId === organizationId) {
        activePairings.push({
          code,
          nickname: request.nickname,
          createdAt: request.createdAt,
          expiresAt: request.expiresAt,
        });
        continue;
      }

      // If not yet paired to any org, check if device exists in this org
      if (!request.organizationId) {
        const display = await this.db.display.findUnique({
          where: { deviceIdentifier: request.deviceIdentifier },
          select: { organizationId: true },
        });

        // Show if device belongs to this org, or is brand new (no org yet)
        if (!display || display.organizationId === organizationId) {
          activePairings.push({
            code,
            nickname: request.nickname,
            createdAt: request.createdAt,
            expiresAt: request.expiresAt,
          });
        }
      }
    }

    return activePairings;
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
