import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@vizora/database';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

interface ExportedUserData {
  exportDate: string;
  user: { email: string; firstName: string | null; lastName: string | null; role: string; createdAt: Date; updatedAt: Date } | null;
  organization: { name: string; slug: string; subscriptionTier: string | null; createdAt: Date } | null;
  content: { count: number; items: Array<{ id: string; title: string; type: string; status: string; createdAt: Date }> };
  displays: { count: number; items: Array<{ id: string; nickname: string | null; location: string | null; status: string; createdAt: Date }> };
  playlists: { count: number; items: Array<{ id: string; name: string; createdAt: Date }> };
  schedules: { count: number; items: Array<{ id: string; name: string; createdAt: Date }> };
  auditLog: { count: number; entries: Array<{ action: string; entityType: string | null; createdAt: Date }> };
  notifications: { count: number; items: Array<{ type: string; title: string; message: string | null; createdAt: Date }> };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

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
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
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

    // Invalidate auth cache so JWT validation picks up changes
    await this.redisService.del(`user_auth:${id}`);

    // Log audit event
    await this.db.auditLog.create({
      data: {
        organizationId,
        userId: updatedByUserId,
        action: 'user_updated',
        entityType: 'user',
        entityId: id,
        changes: dto as unknown as Prisma.InputJsonValue,
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

    // Invalidate auth cache so deactivation takes effect immediately
    await this.redisService.del(`user_auth:${id}`);

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

  async exportUserData(userId: string, organizationId: string): Promise<ExportedUserData> {
    const [user, organization, content, displays, playlists, schedules, auditLogs, notifications] = await Promise.all([
      this.db.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true, role: true, createdAt: true, updatedAt: true },
      }),
      this.db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, slug: true, subscriptionTier: true, createdAt: true },
      }),
      this.db.content.findMany({
        where: { organizationId },
        select: { id: true, title: true, type: true, status: true, createdAt: true },
      }),
      this.db.display.findMany({
        where: { organizationId },
        select: { id: true, nickname: true, location: true, status: true, createdAt: true },
      }),
      this.db.playlist.findMany({
        where: { organizationId },
        select: { id: true, name: true, createdAt: true },
      }),
      this.db.schedule.findMany({
        where: { organizationId },
        select: { id: true, name: true, createdAt: true },
      }),
      this.db.auditLog.findMany({
        where: { userId },
        select: { action: true, entityType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.db.notification.findMany({
        where: { userId },
        select: { type: true, title: true, message: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    return {
      exportDate: new Date().toISOString(),
      user,
      organization,
      content: { count: content.length, items: content },
      displays: { count: displays.length, items: displays },
      playlists: { count: playlists.length, items: playlists },
      schedules: { count: schedules.length, items: schedules },
      auditLog: { count: auditLogs.length, entries: auditLogs },
      notifications: { count: notifications.length, items: notifications },
    };
  }

  private generateTempPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(crypto.randomInt(chars.length));
    }
    return password;
  }
}
