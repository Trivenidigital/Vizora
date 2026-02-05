import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto, CreateApiKeyResponseDto } from './dto/api-key-response.dto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new API key
   * Returns the plain key ONCE along with metadata
   */
  async create(
    organizationId: string,
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponseDto> {
    // Generate key with recognizable prefix
    const prefix = 'vz_live_';
    const randomPart = crypto.randomBytes(24).toString('base64url');
    const plainKey = `${prefix}${randomPart}`;
    const hashedKey = crypto.createHash('sha256').update(plainKey).digest('hex');

    const apiKey = await this.db.apiKey.create({
      data: {
        name: dto.name,
        prefix,
        hashedKey,
        scopes: dto.scopes || ['read:all'],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        organizationId,
        createdById: userId,
      },
    });

    // Return plain key ONCE along with metadata
    return {
      key: plainKey, // Only returned on creation!
      apiKey: this.toResponse(apiKey),
    };
  }

  /**
   * Find all active API keys for an organization
   */
  async findAll(organizationId: string): Promise<ApiKeyResponseDto[]> {
    const keys = await this.db.apiKey.findMany({
      where: { organizationId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => this.toResponse(k));
  }

  /**
   * Validate an API key and return the key record if valid
   */
  async validateKey(plainKey: string) {
    const prefix = plainKey.slice(0, 8);
    const hashedKey = crypto.createHash('sha256').update(plainKey).digest('hex');

    return this.db.apiKey.findFirst({
      where: {
        prefix,
        hashedKey,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  /**
   * Revoke an API key
   */
  async revoke(organizationId: string, keyId: string) {
    return this.db.apiKey.updateMany({
      where: { id: keyId, organizationId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Update the last used timestamp for an API key
   */
  async updateLastUsed(keyId: string) {
    return this.db.apiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Convert database record to response DTO
   */
  private toResponse(apiKey: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
  }): ApiKeyResponseDto {
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }
}
