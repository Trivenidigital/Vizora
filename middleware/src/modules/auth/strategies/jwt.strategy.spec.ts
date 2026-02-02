import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { DatabaseService } from '../../database/database.service';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'a'.repeat(AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH);

    mockDatabaseService = {
      user: {
        findUnique: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create strategy with valid JWT_SECRET', () => {
      expect(() => new JwtStrategy(mockDatabaseService)).not.toThrow();
    });

    it('should throw error when JWT_SECRET is undefined', () => {
      delete process.env.JWT_SECRET;

      expect(() => new JwtStrategy(mockDatabaseService)).toThrow(
        `JWT_SECRET must be at least ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`,
      );
    });

    it('should throw error when JWT_SECRET is empty', () => {
      process.env.JWT_SECRET = '';

      expect(() => new JwtStrategy(mockDatabaseService)).toThrow(
        `JWT_SECRET must be at least ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`,
      );
    });

    it('should throw error when JWT_SECRET is too short', () => {
      process.env.JWT_SECRET = 'short';

      expect(() => new JwtStrategy(mockDatabaseService)).toThrow(
        `JWT_SECRET must be at least ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`,
      );
    });

    it(`should accept JWT_SECRET with exactly ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`, () => {
      process.env.JWT_SECRET = 'a'.repeat(AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH);

      expect(() => new JwtStrategy(mockDatabaseService)).not.toThrow();
    });

    it(`should accept JWT_SECRET longer than ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`, () => {
      process.env.JWT_SECRET = 'a'.repeat(AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH + 100);

      expect(() => new JwtStrategy(mockDatabaseService)).not.toThrow();
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      strategy = new JwtStrategy(mockDatabaseService);
    });

    describe('device tokens', () => {
      const devicePayload: JwtPayload = {
        sub: 'device-123',
        email: '',
        organizationId: 'org-123',
        role: '',
        type: 'device',
      };

      it('should return device user object for device tokens', async () => {
        const result = await strategy.validate(devicePayload);

        expect(result).toEqual({
          id: 'device-123',
          deviceId: 'device-123',
          organizationId: 'org-123',
          type: 'device',
        });
      });

      it('should not query database for device tokens', async () => {
        await strategy.validate(devicePayload);

        expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
      });
    });

    describe('user tokens', () => {
      const userPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        role: 'admin',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        role: 'admin',
        isActive: true,
        organization: {
          id: 'org-123',
          name: 'Test Organization',
        },
      };

      it('should return user object for valid user tokens', async () => {
        mockDatabaseService.user.findUnique.mockResolvedValue(mockUser as any);

        const result = await strategy.validate(userPayload);

        expect(result).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          organizationId: mockUser.organizationId,
          role: mockUser.role,
          organization: mockUser.organization,
        });
      });

      it('should query database with correct parameters', async () => {
        mockDatabaseService.user.findUnique.mockResolvedValue(mockUser as any);

        await strategy.validate(userPayload);

        expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          include: { organization: true },
        });
      });

      it('should throw UnauthorizedException when user not found', async () => {
        mockDatabaseService.user.findUnique.mockResolvedValue(null);

        await expect(strategy.validate(userPayload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(userPayload)).rejects.toThrow(
          'User not found or inactive',
        );
      });

      it('should throw UnauthorizedException when user is inactive', async () => {
        mockDatabaseService.user.findUnique.mockResolvedValue({
          ...mockUser,
          isActive: false,
        } as any);

        await expect(strategy.validate(userPayload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(userPayload)).rejects.toThrow(
          'User not found or inactive',
        );
      });

      it('should include organization in returned user object', async () => {
        const userWithOrg = {
          ...mockUser,
          organization: {
            id: 'org-123',
            name: 'Test Org',
            subscriptionTier: 'pro',
          },
        };
        mockDatabaseService.user.findUnique.mockResolvedValue(userWithOrg as any);

        const result = await strategy.validate(userPayload);

        expect(result.organization).toEqual(userWithOrg.organization);
      });
    });

    describe('token type handling', () => {
      it('should treat undefined type as user token', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          type: undefined,
        };

        mockDatabaseService.user.findUnique.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          isActive: true,
          organization: { id: 'org-123', name: 'Test Org' },
        } as any);

        await strategy.validate(payload);

        expect(mockDatabaseService.user.findUnique).toHaveBeenCalled();
      });

      it('should treat "user" type as user token', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          type: 'user',
        };

        mockDatabaseService.user.findUnique.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          isActive: true,
          organization: { id: 'org-123', name: 'Test Org' },
        } as any);

        await strategy.validate(payload);

        expect(mockDatabaseService.user.findUnique).toHaveBeenCalled();
      });

      it('should only skip user validation for exactly "device" type', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          type: 'Device', // Capital D
        };

        mockDatabaseService.user.findUnique.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          isActive: true,
          organization: { id: 'org-123', name: 'Test Org' },
        } as any);

        await strategy.validate(payload);

        // Should query database because type is "Device" not "device"
        expect(mockDatabaseService.user.findUnique).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should propagate database errors', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
        };

        mockDatabaseService.user.findUnique.mockRejectedValue(new Error('Database error'));

        await expect(strategy.validate(payload)).rejects.toThrow('Database error');
      });

      it('should handle concurrent validation requests', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
        };

        mockDatabaseService.user.findUnique.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          isActive: true,
          organization: { id: 'org-123', name: 'Test Org' },
        } as any);

        // Simulate concurrent requests
        const results = await Promise.all([
          strategy.validate(payload),
          strategy.validate(payload),
          strategy.validate(payload),
        ]);

        expect(results).toHaveLength(3);
        expect(mockDatabaseService.user.findUnique).toHaveBeenCalledTimes(3);
      });
    });
  });
});

describe('extractJwtFromCookieOrHeader', () => {
  // Note: This function is not exported, so we test it indirectly through the strategy
  // In a real scenario, you might want to export it for direct testing

  describe('integration with strategy', () => {
    let mockDatabaseService: jest.Mocked<DatabaseService>;

    beforeEach(() => {
      process.env.JWT_SECRET = 'a'.repeat(AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH);
      mockDatabaseService = {
        user: {
          findUnique: jest.fn(),
        },
      } as any;
    });

    it('should be configured to extract JWT from cookies and headers', () => {
      // The strategy is configured with extractJwtFromCookieOrHeader
      // This test verifies the strategy can be created with this configuration
      const strategy = new JwtStrategy(mockDatabaseService);
      expect(strategy).toBeDefined();
    });
  });
});
