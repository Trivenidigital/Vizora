import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../redis/redis.service';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockRedisService: jest.Mocked<RedisService>;
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

    mockRedisService = {
      exists: jest.fn().mockResolvedValue(false),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
    } as any;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create strategy with valid JWT_SECRET', () => {
      expect(() => new JwtStrategy(mockDatabaseService, mockRedisService)).not.toThrow();
    });

    it('should throw error when JWT_SECRET is undefined', () => {
      delete process.env.JWT_SECRET;

      expect(() => new JwtStrategy(mockDatabaseService, mockRedisService)).toThrow(
        `JWT_SECRET must be at least ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`,
      );
    });

    it('should throw error when JWT_SECRET is empty', () => {
      process.env.JWT_SECRET = '';

      expect(() => new JwtStrategy(mockDatabaseService, mockRedisService)).toThrow(
        `JWT_SECRET must be at least ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`,
      );
    });

    it('should throw error when JWT_SECRET is too short', () => {
      process.env.JWT_SECRET = 'short';

      expect(() => new JwtStrategy(mockDatabaseService, mockRedisService)).toThrow(
        `JWT_SECRET must be at least ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`,
      );
    });

    it(`should accept JWT_SECRET with exactly ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`, () => {
      process.env.JWT_SECRET = 'a'.repeat(AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH);

      expect(() => new JwtStrategy(mockDatabaseService, mockRedisService)).not.toThrow();
    });

    it(`should accept JWT_SECRET longer than ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`, () => {
      process.env.JWT_SECRET = 'a'.repeat(AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH + 100);

      expect(() => new JwtStrategy(mockDatabaseService, mockRedisService)).not.toThrow();
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      strategy = new JwtStrategy(mockDatabaseService, mockRedisService);
    });

    describe('device tokens', () => {
      const devicePayload: JwtPayload = {
        sub: 'device-123',
        email: '',
        organizationId: 'org-123',
        role: '',
        type: 'device',
      };

      it('should reject device tokens with UnauthorizedException', async () => {
        await expect(strategy.validate(devicePayload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(devicePayload)).rejects.toThrow(
          'Device tokens are not valid for user authentication',
        );
      });

      it('should not query database for device tokens', async () => {
        await strategy.validate(devicePayload).catch(() => {});

        expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
      });
    });

    describe('MFA tokens (auth #2)', () => {
      it('rejects an mfa_challenge token as an access token', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'u@e.com',
          organizationId: 'org-123',
          role: 'admin',
          type: 'mfa_challenge',
        };
        await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(payload)).rejects.toThrow(
          'MFA tokens are not valid for user authentication',
        );
        expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
      });

      it('rejects an mfa_enrollment token as an access token', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'u@e.com',
          organizationId: 'org-123',
          role: 'admin',
          type: 'mfa_enrollment',
        };
        await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
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
        firstName: 'Test',
        lastName: 'User',
        organizationId: 'org-123',
        role: 'admin',
        isActive: true,
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          storageUsedBytes: BigInt(0),
          storageQuotaBytes: BigInt(1073741824),
        },
      };

      it('should return user object for valid user tokens', async () => {
        mockDatabaseService.user.findUnique.mockResolvedValue(mockUser as any);

        const result = await strategy.validate(userPayload);

        expect(result).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          organizationId: mockUser.organizationId,
          role: mockUser.role,
          organization: {
            id: 'org-123',
            name: 'Test Organization',
            storageUsedBytes: 0,
            storageQuotaBytes: 1073741824,
          },
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
            storageUsedBytes: BigInt(500),
            storageQuotaBytes: BigInt(2000),
          },
        };
        mockDatabaseService.user.findUnique.mockResolvedValue(userWithOrg as any);

        const result = await strategy.validate(userPayload);

        expect(result.organization).toEqual({
          id: 'org-123',
          name: 'Test Org',
          subscriptionTier: 'pro',
          storageUsedBytes: 500,
          storageQuotaBytes: 2000,
        });
      });

      it('should preserve isSuperAdmin from the database path for /auth/me consumers', async () => {
        mockDatabaseService.user.findUnique.mockResolvedValue({
          ...mockUser,
          isSuperAdmin: true,
        } as any);

        const result = await strategy.validate(userPayload);

        expect(result.isSuperAdmin).toBe(true);
        const cachedPayload = JSON.parse(mockRedisService.set.mock.calls[0][1] as string);
        expect(cachedPayload.isSuperAdmin).toBe(true);
      });

      it('should preserve isSuperAdmin from the Redis cache path for /auth/me consumers', async () => {
        mockRedisService.get.mockResolvedValue(JSON.stringify({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          avatar: null,
          organizationId: mockUser.organizationId,
          role: mockUser.role,
          isActive: true,
          isSuperAdmin: true,
          organization: {
            id: 'org-123',
            name: 'Test Organization',
            storageUsedBytes: 0,
            storageQuotaBytes: 1073741824,
          },
        }));

        const result = await strategy.validate(userPayload);

        expect(result.isSuperAdmin).toBe(true);
        expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
      });
    });

    describe('token revocation', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        organizationId: 'org-123',
        role: 'admin',
        isActive: true,
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          storageUsedBytes: BigInt(0),
          storageQuotaBytes: BigInt(1073741824),
        },
      };

      it('should throw UnauthorizedException for revoked token', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          jti: 'revoked-jti-123',
        };

        mockRedisService.exists.mockResolvedValue(true);

        await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
        await expect(strategy.validate(payload)).rejects.toThrow('Token has been revoked');
      });

      it('should not query database for revoked tokens', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          jti: 'revoked-jti-123',
        };

        mockRedisService.exists.mockResolvedValue(true);

        await strategy.validate(payload).catch(() => {});

        expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
      });

      it('should check revocation with correct Redis key', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          jti: 'my-jti-456',
        };

        mockRedisService.exists.mockResolvedValue(false);
        mockDatabaseService.user.findUnique.mockResolvedValue(mockUser as any);

        await strategy.validate(payload);

        expect(mockRedisService.exists).toHaveBeenCalledWith('revoked_token:my-jti-456');
      });

      it('should allow valid non-revoked token with jti', async () => {
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
          jti: 'valid-jti-789',
        };

        mockRedisService.exists.mockResolvedValue(false);
        mockDatabaseService.user.findUnique.mockResolvedValue(mockUser as any);

        const result = await strategy.validate(payload);

        expect(result).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          organizationId: mockUser.organizationId,
          role: mockUser.role,
          organization: {
            id: 'org-123',
            name: 'Test Organization',
            storageUsedBytes: 0,
            storageQuotaBytes: 1073741824,
          },
        });
      });

      it('should skip the per-token jti revocation check when jti is not present, but still run the per-user revocation check', async () => {
        // jti-less tokens still get the user_revoked: check applied —
        // that's the all-user invalidation path (deactivation /
        // self-delete). The jti check is the specific-token path.
        const payload: JwtPayload = {
          sub: 'user-123',
          email: 'test@example.com',
          organizationId: 'org-123',
          role: 'admin',
        };

        mockDatabaseService.user.findUnique.mockResolvedValue(mockUser as any);

        await strategy.validate(payload);

        expect(mockRedisService.exists).toHaveBeenCalledTimes(1);
        expect(mockRedisService.exists).toHaveBeenCalledWith('user_revoked:user-123');
      });

      it('rejects the request when the user_revoked: flag is set for the payload.sub', async () => {
        // Admin deactivation / self-delete set this flag; the request
        // must fail closed even if the per-jti revocation key isn't set.
        const payload: JwtPayload = {
          sub: 'user-deactivated',
          email: 'x@y.com',
          organizationId: 'org-123',
          role: 'admin',
          jti: 'jti-abc',
        };

        mockRedisService.exists.mockImplementation((key: string) =>
          Promise.resolve(key === 'user_revoked:user-deactivated'),
        );

        await expect(strategy.validate(payload)).rejects.toThrow('User account is no longer active');
      });
    });

    describe('password-change session invalidation (pwd_changed:)', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        organizationId: 'org-123',
        role: 'admin',
        isActive: true,
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          storageUsedBytes: BigInt(0),
          storageQuotaBytes: BigInt(1073741824),
        },
      };

      const basePayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        role: 'admin',
      };

      // exists() stays false (no jti/user revocation). get() returns the
      // change-timestamp for `pwd_changed:` and null for the user_auth cache,
      // so each test exercises the DB path unless it asserts a rejection first.
      const withPwdChangedAt = (ts: number) =>
        mockRedisService.get.mockImplementation((key: string) =>
          Promise.resolve(key.startsWith('pwd_changed:') ? String(ts) : null),
        );

      beforeEach(() => {
        mockDatabaseService.user.findUnique.mockResolvedValue(mockUser as any);
      });

      it('rejects a token minted BEFORE the last password change', async () => {
        withPwdChangedAt(2_000_000);
        await expect(
          strategy.validate({ ...basePayload, iat: 1_999_999 }),
        ).rejects.toThrow('Session expired — please log in again');
      });

      it('does not hit the database for a pre-change (rejected) token', async () => {
        withPwdChangedAt(2_000_000);
        await strategy.validate({ ...basePayload, iat: 1_999_999 }).catch(() => {});
        expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
      });

      it('passes a token minted AFTER the last password change', async () => {
        withPwdChangedAt(2_000_000);
        const result = await strategy.validate({ ...basePayload, iat: 2_000_001 });
        expect(result).toMatchObject({ id: 'user-123' });
      });

      it('passes a token minted in the SAME second as the change (strict <, no lockout)', async () => {
        withPwdChangedAt(2_000_000);
        const result = await strategy.validate({ ...basePayload, iat: 2_000_000 });
        expect(result).toMatchObject({ id: 'user-123' });
      });

      it('passes when no pwd_changed: marker exists', async () => {
        mockRedisService.get.mockResolvedValue(null);
        const result = await strategy.validate({ ...basePayload, iat: 2_000_000 });
        expect(result).toMatchObject({ id: 'user-123' });
      });

      it('passes when the token carries no iat (check is a safe no-op)', async () => {
        withPwdChangedAt(2_000_000);
        const result = await strategy.validate(basePayload); // no iat
        expect(result).toMatchObject({ id: 'user-123' });
      });

      it('checks pwd_changed BEFORE the user_auth cache (cache cannot skip invalidation)', async () => {
        // A cache HIT would normally short-circuit; the pwd_changed check runs
        // first, so a stale cached user with a pre-change token is still rejected.
        mockRedisService.get.mockImplementation((key: string) => {
          if (key.startsWith('pwd_changed:')) return Promise.resolve('2000000');
          if (key.startsWith('user_auth:')) return Promise.resolve(JSON.stringify(mockUser));
          return Promise.resolve(null);
        });
        await expect(
          strategy.validate({ ...basePayload, iat: 1_999_999 }),
        ).rejects.toThrow('Session expired — please log in again');
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
          firstName: 'Test',
          lastName: 'User',
          organizationId: 'org-123',
          role: 'admin',
          isActive: true,
          organization: { id: 'org-123', name: 'Test Org', storageUsedBytes: BigInt(0), storageQuotaBytes: BigInt(0) },
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
          firstName: 'Test',
          lastName: 'User',
          organizationId: 'org-123',
          role: 'admin',
          isActive: true,
          organization: { id: 'org-123', name: 'Test Org', storageUsedBytes: BigInt(0), storageQuotaBytes: BigInt(0) },
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
          firstName: 'Test',
          lastName: 'User',
          organizationId: 'org-123',
          role: 'admin',
          isActive: true,
          organization: { id: 'org-123', name: 'Test Org', storageUsedBytes: BigInt(0), storageQuotaBytes: BigInt(0) },
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
          firstName: 'Test',
          lastName: 'User',
          organizationId: 'org-123',
          role: 'admin',
          isActive: true,
          organization: { id: 'org-123', name: 'Test Org', storageUsedBytes: BigInt(0), storageQuotaBytes: BigInt(0) },
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
    let mockRedisService: jest.Mocked<RedisService>;

    beforeEach(() => {
      process.env.JWT_SECRET = 'a'.repeat(AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH);
      mockDatabaseService = {
        user: {
          findUnique: jest.fn(),
        },
      } as any;
      mockRedisService = {
        exists: jest.fn().mockResolvedValue(false),
      } as any;
    });

    it('should be configured to extract JWT from cookies and headers', () => {
      // The strategy is configured with extractJwtFromCookieOrHeader
      // This test verifies the strategy can be created with this configuration
      const strategy = new JwtStrategy(mockDatabaseService, mockRedisService);
      expect(strategy).toBeDefined();
    });
  });
});
