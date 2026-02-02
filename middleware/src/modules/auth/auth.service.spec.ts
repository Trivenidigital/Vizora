import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcryptjs';

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockDatabaseService: any;
  let mockJwtService: any;

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
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    };

    // Directly instantiate the service with mocked dependencies
    service = new AuthService(
      mockDatabaseService as DatabaseService,
      mockJwtService as JwtService,
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
      // Default bcrypt rounds is 14 (OWASP 2025+ recommendation)
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 14);
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

    it('should set trial period to 7 days', async () => {
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

    it('should throw UnauthorizedException for invalid password', async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        ...mockUser,
        organization: mockOrganization,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
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
        }),
      );
    });
  });

  describe('Password Security', () => {
    it('should hash password with cost factor 14 (OWASP recommended)', async () => {
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

      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 14);
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
});
