import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { AUTH_CONSTANTS } from './constants/auth.constants';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let mockResponse: Partial<Response>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
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
      refresh: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      organizationName: 'Test Organization',
    };

    it('should register a new user and set auth cookie', async () => {
      authService.register.mockResolvedValue({
        user: mockUser,
        organization: mockOrganization,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      const result = await controller.register(registerDto, mockResponse as Response);

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

      const result = await controller.register(registerDto, mockResponse as Response);

      expect(result.data).not.toHaveProperty('token');
    });

    it('should propagate ConflictException when email exists', async () => {
      authService.register.mockRejectedValue(new ConflictException('Email already exists'));

      await expect(controller.register(registerDto, mockResponse as Response))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should login user and set auth cookie', async () => {
      authService.login.mockResolvedValue({
        user: mockUser,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      const result = await controller.login(loginDto, mockResponse as Response);

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

    it('should not include token in response body', async () => {
      authService.login.mockResolvedValue({
        user: mockUser,
        token: 'jwt-token',
        expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
      });

      const result = await controller.login(loginDto, mockResponse as Response);

      expect(result.data).not.toHaveProperty('token');
    });

    it('should propagate UnauthorizedException for invalid credentials', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException('Invalid email or password'));

      await expect(controller.login(loginDto, mockResponse as Response))
        .rejects.toThrow(UnauthorizedException);
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
  });

  describe('getMe', () => {
    it('should return current user data', async () => {
      const result = await controller.getMe(mockUser);

      expect(result.success).toBe(true);
      expect(result.data.user).toEqual(mockUser);
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

      await controller.register(registerDto, mockResponse as Response);

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
      await controller.register(registerDto, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          maxAge: AUTH_CONSTANTS.TOKEN_EXPIRY_MS,
        }),
      );
    });
  });
});
