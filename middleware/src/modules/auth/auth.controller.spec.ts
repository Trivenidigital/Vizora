import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { Request, Response } from 'express';
import { AUTH_CONSTANTS } from './constants/auth.constants';
import { getAccessTokenTtlMs } from './jwt-expiry';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let mockResponse: Partial<Response>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    avatar: null,
    role: 'admin',
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
  };

  beforeEach(async () => {
    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      googleLogin: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      validateResetToken: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
      getAvatarStream: jest.fn().mockResolvedValue(null),
      uploadAvatar: jest.fn().mockResolvedValue(undefined),
      deleteAvatar: jest.fn(),
    };

    const mockRefreshTokenService = {
      issueForUser: jest.fn().mockResolvedValue({ rawToken: 'refresh-raw', expiresAt: new Date(Date.now() + 60_000) }),
      rotate: jest.fn().mockResolvedValue({ rawToken: 'refresh-rotated', expiresAt: new Date(Date.now() + 60_000) }),
      revokeByRawToken: jest.fn().mockResolvedValue(undefined),
      listSessions: jest.fn().mockResolvedValue([]),
      revokeOtherSessions: jest.fn().mockResolvedValue(0),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      getTtlSeconds: jest.fn().mockReturnValue(30 * 24 * 60 * 60),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    refreshTokenService = module.get(RefreshTokenService);
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      organizationName: 'Test Organization',
    };

    const mockRegisterRequest = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'Mozilla/5.0' },
    } as unknown as Request;

    it('should register a new user and set auth cookie', async () => {
      authService.register.mockResolvedValue({
        user: mockUser,
        organization: mockOrganization,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      const result = await controller.register(registerDto, mockRegisterRequest, mockResponse as Response);

      expect(result.success).toBe(true);
      expect(result.data.user).toEqual(mockUser);
      expect(result.data.organization).toEqual(mockOrganization);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.COOKIE_NAME,
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should not include token in response body', async () => {
      authService.register.mockResolvedValue({
        user: mockUser,
        organization: mockOrganization,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      const result = await controller.register(registerDto, mockRegisterRequest, mockResponse as Response);

      expect(result.data).not.toHaveProperty('token');
    });

    it('should pass client IP and user agent to auth service', async () => {
      authService.register.mockResolvedValue({
        user: mockUser,
        organization: mockOrganization,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      await controller.register(registerDto, mockRegisterRequest, mockResponse as Response);

      expect(authService.register).toHaveBeenCalledWith(registerDto, '127.0.0.1', 'Mozilla/5.0');
    });

    it('should propagate ConflictException when email exists', async () => {
      authService.register.mockRejectedValue(new ConflictException('Email already exists'));

      await expect(controller.register(registerDto, mockRegisterRequest, mockResponse as Response))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };
    const mockLoginRequest = {
      ip: '203.0.113.10',
      socket: { remoteAddress: '10.0.0.1' },
      headers: { 'user-agent': 'Mozilla/5.0' },
    } as unknown as Request;

    it('should login user and set auth cookie', async () => {
      authService.login.mockResolvedValue({
        user: mockUser,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      const result = await controller.login(loginDto, mockLoginRequest, mockResponse as Response);

      expect(result.success).toBe(true);
      expect(result.data.user).toEqual(mockUser);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.COOKIE_NAME,
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should pass login request metadata to auth service', async () => {
      authService.login.mockResolvedValue({
        user: mockUser,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      await controller.login(loginDto, mockLoginRequest, mockResponse as Response);

      expect(authService.login).toHaveBeenCalledWith(loginDto, {
        ipAddress: '203.0.113.10',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should not include token in response body', async () => {
      authService.login.mockResolvedValue({
        user: mockUser,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      const result = await controller.login(loginDto, mockLoginRequest, mockResponse as Response);

      expect(result.data).not.toHaveProperty('token');
    });

    it('should propagate UnauthorizedException for invalid credentials', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException('Invalid email or password'));

      await expect(controller.login(loginDto, mockLoginRequest, mockResponse as Response))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('googleLogin', () => {
    const googleDto = {
      credential: 'google-id-token',
    };
    const mockGoogleRequest = {
      ip: '203.0.113.20',
      socket: { remoteAddress: '10.0.0.2' },
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/126.0' },
    } as unknown as Request;

    it('should login with Google and set auth cookie', async () => {
      authService.googleLogin.mockResolvedValue({
        user: mockUser,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
        isNewUser: false,
      });

      const result = await controller.googleLogin(googleDto, mockGoogleRequest, mockResponse as Response);

      expect(result.success).toBe(true);
      expect(result.data.user).toEqual(mockUser);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.COOKIE_NAME,
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should pass Google login request metadata to auth service', async () => {
      authService.googleLogin.mockResolvedValue({
        user: mockUser,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
        isNewUser: false,
      });

      await controller.googleLogin(googleDto, mockGoogleRequest, mockResponse as Response);

      expect(authService.googleLogin).toHaveBeenCalledWith('google-id-token', {
        ipAddress: '203.0.113.20',
        userAgent: 'Mozilla/5.0 Chrome/126.0',
      });
    });
  });

  describe('refresh', () => {
    const mockRequest = {
      cookies: { [AUTH_CONSTANTS.COOKIE_NAME]: 'old-jwt-token' },
      headers: { authorization: 'Bearer old-jwt-token' },
    } as any;

    it('should refresh token and set new cookie', async () => {
      authService.refresh.mockResolvedValue({
        token: 'new-jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      const result = await controller.refresh('user-123', mockRequest, mockResponse as Response);

      expect(result.success).toBe(true);
      expect(result.data.expiresIn).toBe(AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.COOKIE_NAME,
        'new-jwt-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should pass current token to auth service for revocation', async () => {
      authService.refresh.mockResolvedValue({
        token: 'new-jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      await controller.refresh('user-123', mockRequest, mockResponse as Response);

      expect(authService.refresh).toHaveBeenCalledWith('user-123', 'old-jwt-token');
    });

    it('should propagate UnauthorizedException for invalid user', async () => {
      authService.refresh.mockRejectedValue(new UnauthorizedException('User not found'));

      await expect(controller.refresh('invalid-id', mockRequest, mockResponse as Response))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should issue a fresh refresh token when no refresh cookie is present (legacy session upgrade)', async () => {
      authService.refresh.mockResolvedValue({
        token: 'new-jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      await controller.refresh('user-123', mockRequest, mockResponse as Response);

      expect(refreshTokenService.issueForUser).toHaveBeenCalledWith('user-123', expect.any(Object));
      expect(refreshTokenService.rotate).not.toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.REFRESH_COOKIE_NAME,
        'refresh-raw',
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });

    it('should rotate the presented refresh token and set the rotated cookie', async () => {
      authService.refresh.mockResolvedValue({
        token: 'new-jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });
      const reqWithRefresh = {
        cookies: {
          [AUTH_CONSTANTS.COOKIE_NAME]: 'old-jwt-token',
          [AUTH_CONSTANTS.REFRESH_COOKIE_NAME]: 'presented-refresh',
        },
        headers: {},
      } as any;

      await controller.refresh('user-123', reqWithRefresh, mockResponse as Response);

      expect(refreshTokenService.rotate).toHaveBeenCalledWith('presented-refresh', 'user-123', expect.any(Object));
      expect(refreshTokenService.issueForUser).not.toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.REFRESH_COOKIE_NAME,
        'refresh-rotated',
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });

    it('should propagate reuse-detection 401 without minting a new access token', async () => {
      refreshTokenService.rotate.mockRejectedValueOnce(
        new UnauthorizedException('Refresh token reuse detected'),
      );
      const reqWithRefresh = {
        cookies: {
          [AUTH_CONSTANTS.COOKIE_NAME]: 'old-jwt-token',
          [AUTH_CONSTANTS.REFRESH_COOKIE_NAME]: 'stolen-refresh',
        },
        headers: {},
      } as any;

      await expect(controller.refresh('user-123', reqWithRefresh, mockResponse as Response))
        .rejects.toThrow(UnauthorizedException);
      expect(authService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout user and clear cookie', async () => {
      authService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      const mockRequest = {
        cookies: { [AUTH_CONSTANTS.COOKIE_NAME]: 'jwt-token' },
        headers: {},
      } as any;

      const result = await controller.logout('user-123', mockRequest, mockResponse as Response);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.COOKIE_NAME,
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should pass token from cookie to auth service for revocation', async () => {
      authService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      const mockRequest = {
        cookies: { [AUTH_CONSTANTS.COOKIE_NAME]: 'jwt-token-from-cookie' },
        headers: {},
      } as any;

      await controller.logout('user-123', mockRequest, mockResponse as Response);

      expect(authService.logout).toHaveBeenCalledWith('user-123', 'jwt-token-from-cookie');
    });

    it('should pass token from Authorization header when no cookie', async () => {
      authService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      const mockRequest = {
        cookies: {},
        headers: { authorization: 'Bearer jwt-token-from-header' },
      } as any;

      await controller.logout('user-123', mockRequest, mockResponse as Response);

      expect(authService.logout).toHaveBeenCalledWith('user-123', 'jwt-token-from-header');
    });

    it('should revoke the refresh token and clear the refresh cookie', async () => {
      authService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      const mockRequest = {
        cookies: {
          [AUTH_CONSTANTS.COOKIE_NAME]: 'jwt-token',
          [AUTH_CONSTANTS.REFRESH_COOKIE_NAME]: 'refresh-to-revoke',
        },
        headers: {},
      } as any;

      await controller.logout('user-123', mockRequest, mockResponse as Response);

      expect(refreshTokenService.revokeByRawToken).toHaveBeenCalledWith('refresh-to-revoke');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        AUTH_CONSTANTS.REFRESH_COOKIE_NAME,
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });
  });

  describe('sessions', () => {
    it('should list the caller own sessions and mark the current one', async () => {
      const sessions = [
        { id: 's1', userAgent: 'UA', ip: '1.2.3.4', createdAt: new Date(), lastUsedAt: new Date(), current: true },
      ];
      refreshTokenService.listSessions.mockResolvedValue(sessions);
      const req = { cookies: { [AUTH_CONSTANTS.REFRESH_COOKIE_NAME]: 'current-refresh' }, headers: {} } as any;

      const result = await controller.listSessions('user-123', req);

      expect(refreshTokenService.listSessions).toHaveBeenCalledWith('user-123', 'current-refresh');
      expect(result).toEqual({ success: true, data: { sessions } });
    });

    it('should not expose any token hash in the session list', async () => {
      refreshTokenService.listSessions.mockResolvedValue([
        { id: 's1', userAgent: 'UA', ip: '1.2.3.4', createdAt: new Date(), lastUsedAt: new Date(), current: true },
      ]);
      const req = { cookies: {}, headers: {} } as any;

      const result = await controller.listSessions('user-123', req);

      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/tokenHash/i);
      expect(serialized).not.toMatch(/replacedByTokenHash/i);
    });

    it('should revoke all other sessions and return the count', async () => {
      refreshTokenService.revokeOtherSessions.mockResolvedValue(3);
      const req = { cookies: { [AUTH_CONSTANTS.REFRESH_COOKIE_NAME]: 'current-refresh' }, headers: {} } as any;

      const result = await controller.revokeOtherSessions('user-123', req);

      expect(refreshTokenService.revokeOtherSessions).toHaveBeenCalledWith('user-123', 'current-refresh');
      expect(result).toEqual({ success: true, data: { revokedCount: 3 } });
    });

    it('should revoke a specific session by id', async () => {
      const result = await controller.revokeSession('user-123', 'session-9');

      expect(refreshTokenService.revokeSession).toHaveBeenCalledWith('user-123', 'session-9');
      expect(result.success).toBe(true);
    });

    it('returns the same idempotent success for a missing or cross-user id (no 404/403 oracle)', async () => {
      // S3: the service treats missing and cross-user ids identically (scoped
      // no-op), so the controller returns the same success either way — it no
      // longer surfaces a 404-vs-403 distinction that would leak existence.
      refreshTokenService.revokeSession.mockResolvedValue(undefined);

      const result = await controller.revokeSession('user-123', 'missing-or-foreign');

      expect(refreshTokenService.revokeSession).toHaveBeenCalledWith('user-123', 'missing-or-foreign');
      expect(result.success).toBe(true);
    });
  });

  describe('getMe', () => {
    it('should return current user data with null avatarUrl when no avatar is set', async () => {
      const result = await controller.getMe(mockUser);

      expect(result.success).toBe(true);
      expect(result.data.user).toEqual({ ...mockUser, avatarUrl: null });
    });

    it('should return the stable proxied avatar URL when an avatar is set', async () => {
      const result = await controller.getMe({
        ...mockUser,
        avatar: 'avatars/user-123.jpg',
      } as any);

      expect(result.data.user.avatarUrl).toBe('/api/v1/auth/me/avatar');
    });
  });

  describe('uploadAvatar', () => {
    it('should return a cache-busted proxied avatar URL', async () => {
      const file = {
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
      } as Express.Multer.File;

      const result = await controller.uploadAvatar('user-123', file);

      expect(authService.uploadAvatar).toHaveBeenCalledWith('user-123', {
        buffer: file.buffer,
        mimetype: 'image/png',
      });
      expect(result.success).toBe(true);
      expect(result.data.avatarUrl).toMatch(/^\/api\/v1\/auth\/me\/avatar\?v=\d+$/);
    });
  });

  describe('cookie security settings', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      organizationName: 'Test Organization',
    };

    const mockRegisterRequest = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'Mozilla/5.0' },
    } as unknown as Request;

    beforeEach(() => {
      authService.register.mockResolvedValue({
        user: mockUser,
        organization: mockOrganization,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });
    });

    it('should use lax sameSite in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await controller.register(registerDto, mockRegisterRequest, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          sameSite: 'lax',
          secure: false,
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should include maxAge based on token expiry constant', async () => {
      await controller.register(registerDto, mockRegisterRequest, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          maxAge: getAccessTokenTtlMs(),
        }),
      );
    });
  });
});
