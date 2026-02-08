import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PairingService } from './pairing.service';
import { DatabaseService } from '../database/database.service';

// Mock QRCode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQRCode'),
}));

describe('PairingService', () => {
  let service: PairingService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockJwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    // Clear any interval from previous tests
    jest.useFakeTimers();

    mockDatabaseService = {
      display: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as any;

    service = new PairingService(mockDatabaseService, mockJwtService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('requestPairingCode', () => {
    const mockRequestDto = {
      deviceIdentifier: 'device-123',
      nickname: 'Living Room Display',
      metadata: { hostname: 'display-001' },
    };

    it('should generate a pairing code successfully', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result).toHaveProperty('code');
      expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('expiresInSeconds');
      expect(result).toHaveProperty('pairingUrl');
    });

    it('should generate a 6-character alphanumeric code', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result.code).toHaveLength(6);
      expect(result.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });

    it('should exclude ambiguous characters from pairing code', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      // Generate many codes and check none contain ambiguous characters
      const codes = [];
      for (let i = 0; i < 100; i++) {
        const result = await service.requestPairingCode({
          ...mockRequestDto,
          deviceIdentifier: `device-${i}`,
        });
        codes.push(result.code);
      }

      const allCodes = codes.join('');
      // Character set is 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      // Should not contain 0, O, 1, I which are excluded for clarity
      // Also should not contain lowercase letters (all uppercase)
      expect(allCodes).not.toMatch(/[0OI1a-z]/);
    });

    it('should set expiration to 5 minutes', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result.expiresInSeconds).toBe(300); // 5 minutes
    });

    it('should throw if device is already paired', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'existing-display-id',
        jwtToken: 'existing-jwt-token',
      } as any);

      await expect(service.requestPairingCode(mockRequestDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.requestPairingCode(mockRequestDto)).rejects.toThrow(
        'Device is already paired',
      );
    });

    it('should allow unpaired devices (no jwt token)', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'existing-display-id',
        jwtToken: null, // Not paired
      } as any);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result).toHaveProperty('code');
    });

    it('should use default nickname if not provided', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode({
        deviceIdentifier: 'device-123',
        metadata: {},
      } as any);

      expect(result).toHaveProperty('code');
    });

    it('should include QR code data URL', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result.qrCode).toMatch(/^data:image\/png;base64/);
    });

    it('should include pairing URL in result', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode(mockRequestDto);

      expect(result.pairingUrl).toContain(result.code);
      expect(result.pairingUrl).toContain('/dashboard/devices/pair');
    });
  });

  describe('checkPairingStatus', () => {
    const mockCode = 'ABC123';

    beforeEach(async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);
      // Create a pairing request first
      await service.requestPairingCode({
        deviceIdentifier: 'device-123',
        nickname: 'Test Display',
        metadata: {},
      });
    });

    it('should throw NotFoundException for non-existent code', async () => {
      await expect(service.checkPairingStatus('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.checkPairingStatus('NONEXISTENT')).rejects.toThrow(
        'Pairing code not found or expired',
      );
    });

    it('should throw for expired code', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const result = await service.requestPairingCode({
        deviceIdentifier: 'device-456',
        nickname: 'Test',
        metadata: {},
      });

      // Advance time past expiration (5 minutes + 1 second)
      // Note: The cleanup interval may also run, so we accept either error
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Either BadRequestException (expired) or NotFoundException (cleaned up)
      await expect(service.checkPairingStatus(result.code)).rejects.toThrow();
    });

    it('should return pending status for valid unpaired code', async () => {
      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'device-789',
        nickname: 'Test',
        metadata: {},
      });

      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const status = await service.checkPairingStatus(pairingResult.code);

      expect(status.status).toBe('pending');
      expect(status).toHaveProperty('expiresAt');
    });

    it('should return paired status when device is paired', async () => {
      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'device-paired',
        nickname: 'Test',
        metadata: {},
      });

      // completePairing sets plaintextToken on the in-memory request
      mockDatabaseService.display.findUnique.mockResolvedValue(null);
      mockDatabaseService.display.create.mockResolvedValue({
        id: 'display-id',
        nickname: 'Test',
        deviceIdentifier: 'device-paired',
        status: 'pairing',
        organizationId: 'org-123',
      } as any);

      await service.completePairing('org-123', 'user-123', { code: pairingResult.code });

      // Now checkPairingStatus reads the plaintext token from memory
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'display-id',
        organizationId: 'org-123',
      } as any);

      const status = await service.checkPairingStatus(pairingResult.code);

      expect(status.status).toBe('paired');
      expect(status.deviceToken).toBe('mock-jwt-token'); // plaintext token from jwtService.sign mock
      expect(status.displayId).toBe('display-id');
      expect(status.organizationId).toBe('org-123');
    });

    it('should clean up pairing request after successful pairing', async () => {
      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'device-cleanup',
        nickname: 'Test',
        metadata: {},
      });

      // completePairing sets plaintextToken on the in-memory request
      mockDatabaseService.display.findUnique.mockResolvedValue(null);
      mockDatabaseService.display.create.mockResolvedValue({
        id: 'display-id',
        nickname: 'Test',
        deviceIdentifier: 'device-cleanup',
        status: 'pairing',
        organizationId: 'org-123',
      } as any);

      await service.completePairing('org-123', 'user-123', { code: pairingResult.code });

      // Now checkPairingStatus should return paired and clean up
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'display-id',
        organizationId: 'org-123',
      } as any);

      // First check - should return paired and clean up
      await service.checkPairingStatus(pairingResult.code);

      // Second check - should throw not found
      await expect(service.checkPairingStatus(pairingResult.code)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completePairing', () => {
    const organizationId = 'org-123';
    const userId = 'user-123';

    it('should complete pairing for new device', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null) // requestPairingCode check
        .mockResolvedValueOnce(null); // completePairing check

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'new-device',
        nickname: 'New Display',
        metadata: { hostname: 'display-new' },
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-display-id',
        nickname: 'New Display',
        deviceIdentifier: 'new-device',
        status: 'pairing',
      } as any);

      const result = await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
      });

      expect(result.success).toBe(true);
      expect(result.display).toHaveProperty('id');
      expect(mockDatabaseService.display.create).toHaveBeenCalled();
    });

    it('should update existing unpaired device', async () => {
      mockDatabaseService.display.findUnique
        .mockResolvedValueOnce(null) // requestPairingCode check
        .mockResolvedValueOnce({
          id: 'existing-display-id',
          jwtToken: null,
        } as any); // completePairing check

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'existing-device',
        nickname: 'Existing Display',
        metadata: {},
      });

      mockDatabaseService.display.update.mockResolvedValue({
        id: 'existing-display-id',
        nickname: 'Updated Display',
        deviceIdentifier: 'existing-device',
        status: 'pairing',
      } as any);

      const result = await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
        nickname: 'Updated Display',
      });

      expect(result.success).toBe(true);
      expect(mockDatabaseService.display.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent code', async () => {
      await expect(
        service.completePairing(organizationId, userId, { code: 'INVALID' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for expired code', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'expiring-device',
        nickname: 'Test',
        metadata: {},
      });

      // Advance time past expiration
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      await expect(
        service.completePairing(organizationId, userId, { code: pairingResult.code }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate JWT token for device', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'jwt-device',
        nickname: 'JWT Test',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-id',
        nickname: 'JWT Test',
        deviceIdentifier: 'jwt-device',
        status: 'pairing',
      } as any);

      await service.completePairing(organizationId, userId, { code: pairingResult.code });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceIdentifier: 'jwt-device',
          organizationId,
          type: 'device',
        }),
        { expiresIn: '365d' },
      );
    });

    it('should clean up pairing request after device retrieves token', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'cleanup-device',
        nickname: 'Cleanup Test',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-id',
        nickname: 'Cleanup Test',
        deviceIdentifier: 'cleanup-device',
        status: 'pairing',
      } as any);

      await service.completePairing(organizationId, userId, { code: pairingResult.code });

      // After completePairing, the request still exists (has plaintextToken set)
      // checkPairingStatus will return paired and THEN clean up
      mockDatabaseService.display.findUnique.mockResolvedValue({
        id: 'new-id',
        organizationId: 'org-123',
      } as any);

      const status = await service.checkPairingStatus(pairingResult.code);
      expect(status.status).toBe('paired');

      // NOW the code should be cleaned up
      await expect(service.checkPairingStatus(pairingResult.code)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use provided nickname over request nickname', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'nickname-device',
        nickname: 'Original Nickname',
        metadata: {},
      });

      mockDatabaseService.display.create.mockResolvedValue({
        id: 'new-id',
        nickname: 'Custom Nickname',
        deviceIdentifier: 'nickname-device',
        status: 'pairing',
      } as any);

      await service.completePairing(organizationId, userId, {
        code: pairingResult.code,
        nickname: 'Custom Nickname',
      });

      expect(mockDatabaseService.display.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nickname: 'Custom Nickname',
          }),
        }),
      );
    });
  });

  describe('getActivePairings', () => {
    it('should return empty array when no pairings exist', async () => {
      const result = await service.getActivePairings('org-123');

      expect(result).toEqual([]);
    });

    it('should return active pairings', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      await service.requestPairingCode({
        deviceIdentifier: 'device-1',
        nickname: 'Display 1',
        metadata: {},
      });

      await service.requestPairingCode({
        deviceIdentifier: 'device-2',
        nickname: 'Display 2',
        metadata: {},
      });

      const result = await service.getActivePairings('org-123');

      expect(result).toHaveLength(2);
      result.forEach((pairing: any) => {
        expect(pairing).toHaveProperty('code');
        expect(pairing).toHaveProperty('nickname');
        expect(pairing).toHaveProperty('createdAt');
        expect(pairing).toHaveProperty('expiresAt');
      });
    });

    it('should not return expired pairings', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      await service.requestPairingCode({
        deviceIdentifier: 'device-expired',
        nickname: 'Expired Display',
        metadata: {},
      });

      // Advance time past expiration
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      const result = await service.getActivePairings('org-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('cleanup expired requests', () => {
    it('should automatically clean up expired requests', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const pairingResult = await service.requestPairingCode({
        deviceIdentifier: 'auto-cleanup-device',
        nickname: 'Auto Cleanup Test',
        metadata: {},
      });

      // Advance time past expiration plus cleanup interval
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      // Try to check status - should be cleaned up
      await expect(service.checkPairingStatus(pairingResult.code)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unique code generation', () => {
    it('should generate unique codes for multiple requests', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValue(null);

      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        const result = await service.requestPairingCode({
          deviceIdentifier: `device-${i}`,
          nickname: `Display ${i}`,
          metadata: {},
        });
        codes.add(result.code);
      }

      expect(codes.size).toBe(50);
    });
  });
});
