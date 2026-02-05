import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(organizationId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.user.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.db.user.count({ where: { organizationId } }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const user = await this.db.user.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async invite(organizationId: string, dto: InviteUserDto, invitedByUserId: string) {
    // Check if email already exists
    const existingUser = await this.db.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Generate temp password and hash it
    const tempPassword = this.generateTempPassword();
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '14', 10);
    const passwordHash = await bcrypt.hash(tempPassword, bcryptRounds);

    const user = await this.db.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        passwordHash,
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log audit event
    await this.db.auditLog.create({
      data: {
        organizationId,
        userId: invitedByUserId,
        action: 'user_invited',
        entityType: 'user',
        entityId: user.id,
        changes: {
          email: user.email,
          role: user.role,
        },
      },
    });

    return { user, tempPassword };
  }

  async update(organizationId: string, id: string, dto: UpdateUserDto, updatedByUserId: string) {
    const user = await this.findOne(organizationId, id);

    // Prevent self-demotion
    if (id === updatedByUserId && dto.role && dto.role !== 'admin') {
      throw new BadRequestException('Cannot change your own role');
    }

    // Prevent self-deactivation
    if (id === updatedByUserId && dto.isActive === false) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const updatedUser = await this.db.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log audit event
    await this.db.auditLog.create({
      data: {
        organizationId,
        userId: updatedByUserId,
        action: 'user_updated',
        entityType: 'user',
        entityId: id,
        changes: dto as any,
      },
    });

    return updatedUser;
  }

  async deactivate(organizationId: string, id: string, deactivatedByUserId: string) {
    // Prevent self-deactivation
    if (id === deactivatedByUserId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const user = await this.findOne(organizationId, id);

    const deactivatedUser = await this.db.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log audit event
    await this.db.auditLog.create({
      data: {
        organizationId,
        userId: deactivatedByUserId,
        action: 'user_deactivated',
        entityType: 'user',
        entityId: id,
        changes: { isActive: false },
      },
    });

    return deactivatedUser;
  }

  private generateTempPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
