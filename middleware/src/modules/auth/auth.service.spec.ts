import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException, ForbiddenException, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { GeoService } from '../common/services/geo.service';
import * as bcrypt from 'bcryptjs';

/**
 * Mock google-auth-library's OAuth2Client — we test our business logic,
 * not Google's signature verification (which the library handles internally).
 * Tests can override `mockVerifyIdToken` implementation per-test.
 */
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

/**
 * Helper: build a fake Google ID token payload. The actual token string is
 * opaque — the verifyIdToken mock returns this payload directly.
 */
function buildGooglePayload(payloadOverrides: Record<string, unknown> = {}) {
  return {
    iss: 'accounts.google.com',
    aud: 'test-google-client-id',
    email: 'googleuser@gmail.com',
    email_verified: true,
    given_name: 'Google',
    family_name: 'User',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payloadOverrides,
  };
}

/**
 * Set up the verifyIdToken mock to succeed and return the given payload.
 */
function mockGoogleSuccess(payload: Record<string, unknown>) {
  mockVerifyIdToken.mockResolvedValue({
    getPayload: () => payload,
  });
}

/**
 * Set up the verifyIdToken mock to reject (simulates signature, audience,
 * expiry, or issuer verification failure from google-auth-library).
 */
function mockGoogleFailure(message: string) {
  mockVerifyIdToken.mockRejectedValue(new Error(message));
}

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock crypto.randomUUID
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockDatabaseService: any;
  let mockJwtService: any;
  let mockRedisService: any;
  let mockMailService: any;
  let mockGeoService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    role: 'admin',
    isActive: true,
    organizationId: 'org-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Org',
    slug: 'test-org',
    subscriptionTier: 'free',
    screenQuota: 5,
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    subscriptionStatus: 'trial',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockDatabaseService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      // Mock $transaction to execute the callback with the same mock database
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockDatabaseService);
      }),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      decode: jest.fn().mockReturnValue({ jti: 'mock-jti', exp: Math.floor(Date.now() / 1000) + 604800 }),
    };

    mockRedisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
      exists: jest.fn().mockResolvedValue(false),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(true),
    };

    mockMailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    };

    mockGeoService = {
      detect: jest.fn().mockReturnValue({ country: 'US', currency: 'USD', provider: 'stripe' }),
    };

    const mockBillingService = {
      cancelSubscription: jest.fn().mockResolvedValue(undefined),
    };

    const mockStorageService = {
      uploadFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getPresignedUrl: jest.fn().mockResolvedValue('https://minio/avatar.jpg'),
      isMinioAvailable: jest.fn().mockReturnValue(true),
    };

    const mockEventEmitter = { emit: jest.fn() };

    // Directly instantiate the service with mocked dependencies
    service = new AuthService(
      mockDatabaseService as DatabaseService,
      mockJwtService as JwtService,
      mockRedisService as RedisService,
      mockMailService as MailService,
      mockGeoService as GeoService,
      mockBillingService as any,
      mockStorageService as any,
      mockEventEmitter as any,
    );
    
    // Reset bcrypt mocks
    (bcrypt.hash as jest.Mock).mockReset();
    (bcrypt.compare as jest.Mock).mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
      organizationName: 'New Organization',
    };

    it('should successfully register a new user', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('organization');
      expect(result).toHaveProperty('token', 'mock-jwt-token');
      expect(result).toHaveProperty('expiresIn', 604800);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      // Default bcrypt rounds is 12 (matches env validation default)
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if organization slug already exists', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should generate slug from organization name', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register({
        ...registerDto,
        organizationName: 'My Cool Company!',
      });

      expect(mockDatabaseService.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'my-cool-company' },
      });
    });

    it('should create audit log entry on registration', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register(registerDto);

      expect(mockDatabaseService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'user_registered',
          entityType: 'user',
        }),
      });
    });

    it('should set first user as admin', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register(registerDto);

      expect(mockDatabaseService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'admin',
          isActive: true,
        }),
      });
    });

    it('should set trial period to 30 days', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register(registerDto);

      expect(mockDatabaseService.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionStatus: 'trial',
          screenQuota: 5,
        }),
      });
    });

    // R4-MED11: onboarding pipeline consumes `organizationId` by convention.
    // If this contract ever drifts (e.g. renamed to `orgId`), every milestone
    // silently stops recording. Pin the shape in a test.
    it('emits user.welcomed with organizationId key', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const eventEmitter = (service as any).events;

      await service.register(registerDto);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.welcomed',
        expect.objectContaining({ organizationId: mockOrganization.id }),
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    it('should successfully login a user', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: mockOrganization,
      });
      mockDatabaseService.user.update.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token', 'mock-jwt-token');
      expect(result).toHaveProperty('expiresIn', 604800);
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should increment login attempts on invalid email', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await service.login(loginDto).catch(() => {});

      expect(mockRedisService.incr).toHaveBeenCalledWith(`login_attempts:${loginDto.email}`);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: mockOrganization,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should increment login attempts on invalid password', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: mockOrganization,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await service.login(loginDto).catch(() => {});

      expect(mockRedisService.incr).toHaveBeenCalledWith(`login_attempts:${loginDto.email}`);
    });

    it('should set TTL on first failed login attempt', async () => {
      mockRedisService.incr.mockResolvedValue(1);
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await service.login(loginDto).catch(() => {});

      expect(mockRedisService.expire).toHaveBeenCalledWith(`login_attempts:${loginDto.email}`, 900);
    });

    it('should not reset TTL on subsequent failed login attempts', async () => {
      mockRedisService.incr.mockResolvedValue(5);
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await service.login(loginDto).catch(() => {});

      expect(mockRedisService.expire).not.toHaveBeenCalled();
    });

    it('should throw HttpException 429 when account is locked', async () => {
      mockRedisService.get.mockResolvedValue('10');

      await expect(service.login(loginDto)).rejects.toThrow(HttpException);
      try {
        await service.login(loginDto);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect((error as HttpException).message).toBe(
          'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
        );
      }
    });

    it('should not check password when account is locked', async () => {
      mockRedisService.get.mockResolvedValue('10');

      await service.login(loginDto).catch(() => {});

      expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should clear lockout counter on successful login', async () => {
      mockRedisService.get.mockResolvedValue('3');
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: mockOrganization,
      });
      mockDatabaseService.user.update.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(loginDto);

      expect(mockRedisService.del).toHaveBeenCalledWith(`login_attempts:${loginDto.email}`);
    });

    it('should deny login when Redis is unreachable (fail-closed)', async () => {
      mockRedisService.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.login(loginDto)).rejects.toThrow(
        'Authentication service temporarily unavailable',
      );
    });

    it('should throw ForbiddenException for inactive user', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
        organization: mockOrganization,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('should update lastLoginAt on successful login', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: mockOrganization,
      });
      mockDatabaseService.user.update.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(loginDto);

      expect(mockDatabaseService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should create audit log entry on login', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: mockOrganization,
      });
      mockDatabaseService.user.update.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(loginDto);

      expect(mockDatabaseService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'user_login',
          entityType: 'user',
        }),
      });
    });
  });

  describe('refresh', () => {
    it('should successfully refresh token for active user', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: mockOrganization,
      });

      const result = await service.refresh(mockUser.id);

      expect(result).toHaveProperty('token', 'mock-jwt-token');
      expect(result).toHaveProperty('expiresIn', 604800);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('invalid-id')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
        organization: mockOrganization,
      });

      await expect(service.refresh(mockUser.id)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});

      const result = await service.logout(mockUser.id);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockDatabaseService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'user_logout',
        }),
      });
    });

    it('should handle logout for non-existent user gracefully', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      const result = await service.logout('invalid-id');

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockDatabaseService.auditLog.create).not.toHaveBeenCalled();
    });

    it('should revoke token on logout when token is provided', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});

      await service.logout(mockUser.id, 'mock-jwt-token');

      expect(mockJwtService.decode).toHaveBeenCalledWith('mock-jwt-token');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'revoked_token:mock-jti',
        '1',
        expect.any(Number),
      );
    });

    it('should not revoke token when no token is provided', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});

      await service.logout(mockUser.id);

      expect(mockJwtService.decode).not.toHaveBeenCalled();
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate token with correct payload', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Org',
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          organizationId: mockOrganization.id,
          role: mockUser.role,
          type: 'user',
          jti: 'mock-uuid-1234',
        }),
      );
    });
  });

  describe('Password Security', () => {
    it('should hash password with cost factor 12 (env validation default)', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Org',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12);
    });

    it('should not return password hash in response', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(mockUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Org',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('googleLogin', () => {
    const originalEnv = process.env;
    const FAKE_TOKEN = 'opaque-google-id-token-string';

    beforeEach(() => {
      process.env = { ...originalEnv, GOOGLE_CLIENT_ID: 'test-google-client-id' };
      mockVerifyIdToken.mockReset();
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return user and token for a valid Google token (existing OAuth user)', async () => {
      mockGoogleSuccess(buildGooglePayload());
      const oauthUser = {
        ...mockUser,
        passwordHash: '', // OAuth user has no password
        organization: mockOrganization,
      };
      mockDatabaseService.user.findUnique.mockResolvedValue(oauthUser);
      mockDatabaseService.user.update.mockResolvedValue(oauthUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});

      const result = await service.googleLogin(FAKE_TOKEN);

      expect(result).toHaveProperty('token', 'mock-jwt-token');
      expect(result).toHaveProperty('user');
      expect(result.isNewUser).toBe(false);
      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: FAKE_TOKEN,
        audience: 'test-google-client-id',
      });
    });

    it('should throw UnauthorizedException when google-auth-library rejects (expired/invalid signature)', async () => {
      // google-auth-library throws for signature failures, audience mismatch, expiry, issuer, etc.
      mockGoogleFailure('Token used too late, 1000000000 > 999999999');

      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow(UnauthorizedException);
      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow('Invalid Google token');
    });

    it('should throw UnauthorizedException when email is not verified', async () => {
      mockGoogleSuccess(buildGooglePayload({ email_verified: false }));

      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow(UnauthorizedException);
      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow('Email not verified by Google');
    });

    it('should throw UnauthorizedException for audience mismatch (library rejects)', async () => {
      mockGoogleFailure('Wrong recipient, payload audience != requiredAudience');

      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow(UnauthorizedException);
      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow('Invalid Google token');
    });

    it('should throw ServiceUnavailableException when GOOGLE_CLIENT_ID is not set', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow(ServiceUnavailableException);
      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow('Google OAuth is not configured');
    });

    it('should throw UnauthorizedException when existing user has a password (prevent account takeover)', async () => {
      mockGoogleSuccess(buildGooglePayload());
      const passwordUser = {
        ...mockUser,
        passwordHash: '$2a$14$somehash', // Has password
        organization: mockOrganization,
      };
      mockDatabaseService.user.findUnique.mockResolvedValue(passwordUser);

      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow(UnauthorizedException);
      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow(
        'This email is registered with a password',
      );
    });

    it('should create new org + user for first-time Google login', async () => {
      mockGoogleSuccess(buildGooglePayload());
      mockDatabaseService.user.findUnique.mockResolvedValue(null);
      const newUser = {
        ...mockUser,
        email: 'googleuser@gmail.com',
        passwordHash: '',
        firstName: 'Google',
        lastName: 'User',
        organization: mockOrganization,
      };
      mockDatabaseService.organization.create.mockResolvedValue(mockOrganization);
      mockDatabaseService.user.create.mockResolvedValue(newUser);
      mockDatabaseService.auditLog.create.mockResolvedValue({});
      mockDatabaseService.user.update.mockResolvedValue(newUser);

      const result = await service.googleLogin(FAKE_TOKEN);

      expect(result.isNewUser).toBe(true);
      expect(result).toHaveProperty('token');
      expect(mockDatabaseService.organization.create).toHaveBeenCalled();
      expect(mockDatabaseService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'googleuser@gmail.com',
            passwordHash: '',
          }),
          include: { organization: true },
        }),
      );
    });

    it('should throw UnauthorizedException when payload is missing (verifyIdToken returns empty)', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => undefined });

      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow(UnauthorizedException);
      await expect(service.googleLogin(FAKE_TOKEN)).rejects.toThrow('Invalid Google token payload');
    });

    it('should throw UnauthorizedException when library rejects invalid token format', async () => {
      mockGoogleFailure('Wrong number of segments in token: abc');

      await expect(service.googleLogin('malformed')).rejects.toThrow(UnauthorizedException);
      await expect(service.googleLogin('malformed')).rejects.toThrow('Invalid Google token');
    });
  });
});
