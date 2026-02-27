import { Test, TestingModule } from '@nestjs/testing';
import { PairingController } from './pairing.controller';
import { PairingService } from './pairing.service';

describe('PairingController', () => {
  let controller: PairingController;
  let mockPairingService: jest.Mocked<PairingService>;

  beforeEach(async () => {
    mockPairingService = {
      requestPairingCode: jest.fn(),
      checkPairingStatus: jest.fn(),
      completePairing: jest.fn(),
      getActivePairings: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PairingController],
      providers: [{ provide: PairingService, useValue: mockPairingService }],
    }).compile();

    controller = module.get<PairingController>(PairingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestPairingCode', () => {
    const requestDto = {
      deviceIdentifier: 'device-abc123',
      nickname: 'Living Room Display',
      metadata: { hostname: 'display-001' },
    };

    it('should request a pairing code (public endpoint)', async () => {
      const expectedResult = {
        code: 'ABC123',
        qrCode: 'data:image/png;base64,mockQR',
        expiresAt: new Date().toISOString(),
        expiresInSeconds: 300,
        pairingUrl: 'http://localhost:3001/dashboard/devices/pair?code=ABC123',
      };
      mockPairingService.requestPairingCode.mockResolvedValue(expectedResult);

      const result = await controller.requestPairingCode(requestDto);

      expect(result).toEqual(expectedResult);
      expect(mockPairingService.requestPairingCode).toHaveBeenCalledWith(requestDto);
    });

    it('should handle minimal request dto', async () => {
      const minimalDto = { deviceIdentifier: 'device-123' };
      mockPairingService.requestPairingCode.mockResolvedValue({
        code: 'XYZ789',
        expiresInSeconds: 300,
      } as any);

      const result = await controller.requestPairingCode(minimalDto as any);

      expect(result).toHaveProperty('code');
    });
  });

  describe('checkPairingStatus', () => {
    it('should check pairing status for pending code (public endpoint)', async () => {
      const expectedResult = {
        status: 'pending',
        expiresAt: new Date().toISOString(),
      };
      mockPairingService.checkPairingStatus.mockResolvedValue(expectedResult);

      const result = await controller.checkPairingStatus('ABC123');

      expect(result).toEqual(expectedResult);
      expect(mockPairingService.checkPairingStatus).toHaveBeenCalledWith('ABC123');
    });

    it('should return paired status when device is paired', async () => {
      const expectedResult = {
        status: 'paired',
        deviceToken: 'jwt-token-123',
        deviceId: 'display-123',
        organizationId: 'org-123',
      };
      mockPairingService.checkPairingStatus.mockResolvedValue(expectedResult);

      const result = await controller.checkPairingStatus('ABC123');

      expect(result).toEqual(expectedResult);
      expect(result.status).toBe('paired');
    });

    it('should work with uppercase code', async () => {
      mockPairingService.checkPairingStatus.mockResolvedValue({ status: 'pending' } as any);

      await controller.checkPairingStatus('ABC123');

      expect(mockPairingService.checkPairingStatus).toHaveBeenCalledWith('ABC123');
    });
  });

  describe('completePairing', () => {
    const organizationId = 'org-123';
    const userId = 'user-123';
    const completeDto = {
      code: 'ABC123',
      nickname: 'Custom Display Name',
    };

    it('should complete pairing (authenticated endpoint)', async () => {
      const expectedResult = {
        success: true,
        display: {
          id: 'display-123',
          nickname: 'Custom Display Name',
          deviceIdentifier: 'device-abc123',
          status: 'pairing',
        },
      };
      mockPairingService.completePairing.mockResolvedValue(expectedResult);

      const result = await controller.completePairing(organizationId, userId, completeDto);

      expect(result).toEqual(expectedResult);
      expect(mockPairingService.completePairing).toHaveBeenCalledWith(
        organizationId,
        userId,
        completeDto,
      );
    });

    it('should complete pairing without custom nickname', async () => {
      const dtoWithoutNickname = { code: 'ABC123' };
      mockPairingService.completePairing.mockResolvedValue({ success: true } as any);

      const result = await controller.completePairing(organizationId, userId, dtoWithoutNickname);

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('getActivePairings', () => {
    const organizationId = 'org-123';

    it('should return active pairings (authenticated endpoint)', async () => {
      const expectedResult = [
        {
          code: 'ABC123',
          nickname: 'Display 1',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
        {
          code: 'XYZ789',
          nickname: 'Display 2',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
      ];
      mockPairingService.getActivePairings.mockResolvedValue(expectedResult);

      const result = await controller.getActivePairings(organizationId);

      expect(result).toEqual(expectedResult);
      expect(mockPairingService.getActivePairings).toHaveBeenCalledWith(organizationId);
    });

    it('should return empty array when no active pairings', async () => {
      mockPairingService.getActivePairings.mockResolvedValue([]);

      const result = await controller.getActivePairings(organizationId);

      expect(result).toEqual([]);
    });
  });
});
