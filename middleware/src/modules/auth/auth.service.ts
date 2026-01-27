import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.databaseService.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Generate slug if not provided
    const slug = dto.organizationSlug || this.generateSlug(dto.organizationName);

    // Check if organization slug already exists
    const existingOrg = await this.databaseService.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      throw new ConflictException('Organization slug already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Calculate trial end date (7 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // Create organization
    const organization = await this.databaseService.organization.create({
      data: {
        name: dto.organizationName,
        slug,
        subscriptionTier: 'free',
        screenQuota: 5,
        trialEndsAt,
        subscriptionStatus: 'trial',
      },
    });

    // Create user
    const user = await this.databaseService.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'admin', // First user is always admin
        organizationId: organization.id,
        isActive: true,
      },
    });

    // Generate JWT token
    const token = this.generateToken(user, organization);

    // Log audit event
    await this.databaseService.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        action: 'user_registered',
        entityType: 'user',
        entityId: user.id,
        details: {
          email: user.email,
          organizationName: organization.name,
        },
      },
    });

    return {
      user: this.sanitizeUser(user),
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscriptionTier: organization.subscriptionTier,
        screenQuota: organization.screenQuota,
        trialEndsAt: organization.trialEndsAt,
      },
      token,
      expiresIn: 604800, // 7 days in seconds
    };
  }

  async login(dto: LoginDto) {
    // Find user with organization
    const user = await this.databaseService.user.findUnique({
      where: { email: dto.email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive. Contact support.');
    }

    // Update last login timestamp
    await this.databaseService.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = this.generateToken(user, user.organization);

    // Log audit event
    await this.databaseService.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'user_login',
        entityType: 'user',
        entityId: user.id,
      },
    });

    return {
      user: {
        ...this.sanitizeUser(user),
        organization: {
          name: user.organization.name,
          subscriptionTier: user.organization.subscriptionTier,
        },
      },
      token,
      expiresIn: 604800, // 7 days in seconds
    };
  }

  async refresh(userId: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const token = this.generateToken(user, user.organization);

    return {
      token,
      expiresIn: 604800,
    };
  }

  async logout(userId: string) {
    // Log audit event
    await this.databaseService.auditLog.create({
      data: {
        userId,
        action: 'user_logout',
        entityType: 'user',
        entityId: userId,
      },
    });

    return { message: 'Logged out successfully' };
  }

  private generateToken(user: any, organization: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
      organizationId: organization.id,
      role: user.role,
      type: 'user',
    };

    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
