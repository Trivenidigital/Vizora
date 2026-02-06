import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma } from '@vizora/database';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface UserFiltersDto {
  search?: string;
  organizationId?: string;
  role?: string;
  isActive?: boolean;
  isSuperAdmin?: boolean;
  skip?: number;
  take?: number;
  sortBy?: 'createdAt' | 'email' | 'lastName' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateUserAdminDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

@Injectable()
export class UsersAdminService {
  private readonly logger = new Logger(UsersAdminService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * List all users across all organizations
   */
  async findAll(filters: UserFiltersDto): Promise<{
    data: any[];
    total: number;
    skip: number;
    take: number;
  }> {
    const where: Prisma.UserWhereInput = {};

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.isSuperAdmin !== undefined) {
      where.isSuperAdmin = filters.isSuperAdmin;
    }

    const skip = filters.skip ?? 0;
    const take = filters.take ?? 20;
    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';

    const [data, total] = await Promise.all([
      this.db.user.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isSuperAdmin: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      this.db.user.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  /**
   * Get user details by ID
   */
  async findOne(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        isActive: true,
        isSuperAdmin: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscriptionTier: true,
            subscriptionStatus: true,
          },
        },
        _count: {
          select: {
            auditLogs: true,
            apiKeys: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Update user details
   */
  async update(id: string, dto: UpdateUserAdminDto) {
    await this.findOne(id);

    // Check email uniqueness if changing
    if (dto.email) {
      const existing = await this.db.user.findFirst({
        where: {
          email: dto.email,
          NOT: { id },
        },
      });

      if (existing) {
        throw new BadRequestException('Email already in use');
      }
    }

    const updated = await this.db.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isSuperAdmin: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Admin updated user ${id}: ${JSON.stringify(dto)}`);
    return updated;
  }

  /**
   * Disable a user account
   */
  async disable(id: string) {
    const user = await this.findOne(id);

    if (!user.isActive) {
      throw new BadRequestException('User is already disabled');
    }

    const updated = await this.db.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    this.logger.log(`Disabled user ${id} (${user.email})`);
    return updated;
  }

  /**
   * Enable a user account
   */
  async enable(id: string) {
    const user = await this.findOne(id);

    if (user.isActive) {
      throw new BadRequestException('User is already active');
    }

    const updated = await this.db.user.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    this.logger.log(`Enabled user ${id} (${user.email})`);
    return updated;
  }

  /**
   * Reset user password and return the new temporary password
   */
  async resetPassword(id: string): Promise<{ temporaryPassword: string }> {
    const user = await this.findOne(id);

    // Generate secure random password
    const temporaryPassword = this.generateSecurePassword();
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '14', 10);
    const passwordHash = await bcrypt.hash(temporaryPassword, bcryptRounds);

    await this.db.user.update({
      where: { id },
      data: { passwordHash },
    });

    this.logger.log(`Reset password for user ${id} (${user.email})`);
    return { temporaryPassword };
  }

  /**
   * Grant super admin privileges to a user
   */
  async grantSuperAdmin(id: string) {
    const user = await this.findOne(id);

    if (user.isSuperAdmin) {
      throw new BadRequestException('User is already a super admin');
    }

    const updated = await this.db.user.update({
      where: { id },
      data: { isSuperAdmin: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isSuperAdmin: true,
      },
    });

    this.logger.warn(`Granted super admin to user ${id} (${user.email})`);
    return updated;
  }

  /**
   * Revoke super admin privileges from a user
   */
  async revokeSuperAdmin(id: string) {
    const user = await this.findOne(id);

    if (!user.isSuperAdmin) {
      throw new BadRequestException('User is not a super admin');
    }

    // Ensure at least one super admin remains
    const superAdminCount = await this.db.user.count({
      where: { isSuperAdmin: true },
    });

    if (superAdminCount <= 1) {
      throw new BadRequestException('Cannot revoke: at least one super admin must exist');
    }

    const updated = await this.db.user.update({
      where: { id },
      data: { isSuperAdmin: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isSuperAdmin: true,
      },
    });

    this.logger.warn(`Revoked super admin from user ${id} (${user.email})`);
    return updated;
  }

  /**
   * Get all super admin users
   */
  async getSuperAdmins() {
    return this.db.user.findMany({
      where: { isSuperAdmin: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Generate a secure temporary password
   */
  private generateSecurePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomBytes = crypto.randomBytes(length);
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }
}
