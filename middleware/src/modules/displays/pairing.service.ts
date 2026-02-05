import { Injectable, BadRequestException, NotFoundException, OnModuleDestroy, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { RequestPairingDto } from './dto/request-pairing.dto';
import { CompletePairingDto } from './dto/complete-pairing.dto';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

interface PairingRequest {
  code: string;
  deviceIdentifier: string;
  nickname: string;
  metadata: any;
  createdAt: Date;
  expiresAt: Date;
  qrCode?: string;
}

@Injectable()
export class PairingService implements OnModuleDestroy {
  private readonly logger = new Logger(PairingService.name);
  private pairingRequests = new Map<string, PairingRequest>();
  private readonly PAIRING_CODE_LENGTH = 6;
  private readonly PAIRING_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {
    // Clean up expired pairing requests every minute
    this.cleanupIntervalId = setInterval(() => this.cleanupExpiredRequests(), 60000);
  }

  onModuleDestroy() {
    // Clean up interval to prevent memory leak
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      this.logger.log('Pairing cleanup interval cleared');
    }
    // Clear any pending pairing requests
    this.pairingRequests.clear();
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
    while (this.pairingRequests.has(code) && attempts < 10) {
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

    // Store pairing request
    const pairingRequest: PairingRequest = {
      code,
      deviceIdentifier,
      nickname: nickname || 'Unnamed Display',
      metadata,
      createdAt: now,
      expiresAt,
      qrCode: qrCodeDataUrl,
    };

    this.pairingRequests.set(code, pairingRequest);

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
    const request = this.pairingRequests.get(code);

    if (!request) {
      throw new NotFoundException('Pairing code not found or expired');
    }

    // Check if expired
    if (new Date() > request.expiresAt) {
      this.pairingRequests.delete(code);
      throw new BadRequestException('Pairing code has expired');
    }

    // Check if device has been paired
    const display = await this.db.display.findUnique({
      where: { deviceIdentifier: request.deviceIdentifier },
    });

    // Device is paired if it has a JWT token (regardless of online/offline status)
    // This allows devices to receive their token immediately after web dashboard completes pairing
    if (display && display.jwtToken) {
      // Pairing complete! Clean up request
      this.pairingRequests.delete(code);

      return {
        status: 'paired',
        deviceToken: display.jwtToken,
        displayId: display.id,
        organizationId: display.organizationId,
      };
    }

    return {
      status: 'pending',
      expiresAt: request.expiresAt.toISOString(),
    };
  }

  async completePairing(
    organizationId: string,
    userId: string,
    completeDto: CompletePairingDto,
  ) {
    const { code, nickname } = completeDto;

    const request = this.pairingRequests.get(code);

    if (!request) {
      throw new NotFoundException('Pairing code not found or expired');
    }

    // Check if expired
    if (new Date() > request.expiresAt) {
      this.pairingRequests.delete(code);
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

    const jwtToken = this.jwtService.sign(devicePayload, {
      expiresIn: '365d', // 1 year
    });

    if (display) {
      // Update existing display
      // Set status to 'pairing' - the WebSocket gateway will update to 'online' when device connects
      display = await this.db.display.update({
        where: { id: display.id },
        data: {
          nickname: nickname || request.nickname,
          organizationId,
          jwtToken,
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
          jwtToken,
          pairedAt: new Date(),
          status: 'pairing',
          location: request.metadata?.hostname || null,
          metadata: request.metadata,
        },
      });
    }

    this.logger.log(`Device paired successfully: ${display.id} to org ${organizationId}`);

    // Note: Don't delete the pairing request here.
    // Let checkPairingStatus delete it after the device retrieves its token.
    // This fixes the race condition where the device polls and gets 404
    // before it can retrieve its token.

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
    // Return active pairing requests (without device identifiers for security)
    const activePairings: any[] = [];

    for (const [code, request] of this.pairingRequests.entries()) {
      if (new Date() < request.expiresAt) {
        activePairings.push({
          code,
          nickname: request.nickname,
          createdAt: request.createdAt,
          expiresAt: request.expiresAt,
        });
      }
    }

    return activePairings;
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

  private cleanupExpiredRequests() {
    const now = new Date();
    const expiredCodes: string[] = [];

    for (const [code, request] of this.pairingRequests.entries()) {
      if (now > request.expiresAt) {
        expiredCodes.push(code);
      }
    }

    expiredCodes.forEach((code) => {
      this.pairingRequests.delete(code);
      this.logger.debug(`Cleaned up expired pairing code: ${code}`);
    });
  }
}
