import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { RegisterDto, LoginDto } from './dto';
import { AUTH_CONSTANTS } from './constants/auth.constants';

// Account lockout constants
const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private mailService: MailService,
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

    // Hash password using secure bcrypt rounds (OWASP 2025+ recommendation: 13-14 rounds)
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '14', 10);
    const passwordHash = await bcrypt.hash(dto.password, bcryptRounds);

    // Calculate trial end date (30 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // Wrap all operations in transaction to ensure data consistency
    const result = await this.databaseService.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
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
      const user = await tx.user.create({
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

      // Log audit event
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          action: 'user_registered',
          entityType: 'user',
          entityId: user.id,
          changes: {
            email: user.email,
            organizationName: organization.name,
          },
        },
      });

      return { organization, user };
    });

    const { organization, user } = result;

    // Generate JWT token
    const token = this.generateToken(user, organization);

    // Send welcome email (non-blocking)
    this.mailService.sendWelcomeEmail(
      user.email,
      user.firstName || user.email.split('@')[0],
      30,
    ).catch((err) => {
      this.logger.warn(`Failed to send welcome email to ${user.email}: ${err}`);
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
    // Check account lockout
    const lockoutKey = `login_attempts:${dto.email}`;
    const attemptsStr = await this.redisService.get(lockoutKey);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new HttpException(
        'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Find user with organization
    const user = await this.databaseService.user.findUnique({
      where: { email: dto.email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      // Increment failed login attempts even for non-existent users (prevent enumeration)
      await this.incrementLoginAttempts(lockoutKey);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.incrementLoginAttempts(lockoutKey);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive. Contact support.');
    }

    // Clear lockout counter on successful login
    await this.redisService.del(lockoutKey);

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
      expiresIn: AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS,
    };
  }

  async refresh(userId: string, currentToken?: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Revoke the current token before issuing a new one
    if (currentToken) {
      await this.revokeToken(currentToken);
    }

    const token = this.generateToken(user, user.organization);

    return {
      token,
      expiresIn: 604800,
    };
  }

  async logout(userId: string, token?: string) {
    // Revoke the JWT token if provided
    if (token) {
      await this.revokeToken(token);
    }

    // Get user to find organizationId
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      // Log audit event
      await this.databaseService.auditLog.create({
        data: {
          userId,
          organizationId: user.organizationId,
          action: 'user_logout',
          entityType: 'user',
          entityId: userId,
        },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string): Promise<void> {
    // Rate limit: 3 per hour per email
    const rateLimitKey = `password_reset:${email}`;
    const attempts = await this.redisService.get(rateLimitKey);
    if (attempts && parseInt(attempts, 10) >= 3) {
      // Don't throw — always return success to prevent enumeration
      return;
    }

    // Increment rate limit counter
    const count = await this.redisService.incr(rateLimitKey);
    if (count === 1) {
      await this.redisService.expire(rateLimitKey, 3600); // 1 hour TTL
    }

    // Find user
    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      // Don't reveal if email exists — always return silently
      return;
    }

    // Generate cryptographically random token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Hash token before storing (SHA-256)
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Store hashed token in database
    await this.databaseService.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Build reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    // Send email (uses raw token, not hashed)
    await this.mailService.sendPasswordResetEmail(user.email, user.firstName, resetUrl);
  }

  async validateResetToken(rawToken: string): Promise<{ valid: boolean; email?: string }> {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const tokenRecord = await this.databaseService.passwordResetToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      return { valid: false };
    }

    if (tokenRecord.usedAt) {
      return { valid: false };
    }

    if (new Date() > tokenRecord.expiresAt) {
      return { valid: false };
    }

    // Mask email for privacy
    const email = tokenRecord.user.email;
    const [local, domain] = email.split('@');
    const maskedLocal = local.charAt(0) + '***' + (local.length > 1 ? local.charAt(local.length - 1) : '');
    const maskedEmail = `${maskedLocal}@${domain}`;

    return { valid: true, email: maskedEmail };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const tokenRecord = await this.databaseService.passwordResetToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (tokenRecord.usedAt) {
      throw new UnauthorizedException('This reset link has already been used');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('This reset link has expired');
    }

    // Hash new password
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '14', 10);
    const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);

    // Update password and mark token as used in a transaction
    await this.databaseService.$transaction(async (tx) => {
      // Update user's password
      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      });

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });

      // Log audit event
      await tx.auditLog.create({
        data: {
          organizationId: tokenRecord.user.organizationId,
          userId: tokenRecord.userId,
          action: 'password_reset',
          entityType: 'user',
          entityId: tokenRecord.userId,
        },
      });
    });

    // Clear login attempt counter for this user
    await this.redisService.del(`login_attempts:${tokenRecord.user.email}`);
  }

  private generateToken(user: any, organization: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
      organizationId: organization.id,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin === true,
      type: 'user',
      jti: crypto.randomUUID(),
    };

    return this.jwtService.sign(payload);
  }

  private async incrementLoginAttempts(lockoutKey: string): Promise<void> {
    const count = await this.redisService.incr(lockoutKey);
    // Set TTL only on the first attempt (when count becomes 1)
    if (count === 1) {
      await this.redisService.expire(lockoutKey, LOCKOUT_TTL_SECONDS);
    }
  }

  private async revokeToken(token: string): Promise<void> {
    try {
      // Decode the token to extract jti and expiration
      const decoded = this.jwtService.decode(token) as Record<string, unknown> | null;
      if (!decoded) return;

      const jti = decoded.jti;
      if (!jti) {
        // Fallback: use token hash as identifier for tokens without jti
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const key = `revoked_token:${tokenHash}`;
        // Use the full token expiry as TTL since we can't determine remaining time without jti
        await this.redisService.set(key, '1', AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS);
        return;
      }

      const key = `revoked_token:${jti}`;

      // Calculate remaining TTL from the token's exp claim
      let ttl = AUTH_CONSTANTS.TOKEN_EXPIRY_SECONDS;
      if (decoded.exp) {
        const remainingSeconds = Number(decoded.exp) - Math.floor(Date.now() / 1000);
        if (remainingSeconds > 0) {
          ttl = remainingSeconds;
        }
      }

      await this.redisService.set(key, '1', ttl);
    } catch (error) {
      // Log warning — Redis failures mean the token won't be revoked
      this.logger.warn(`Failed to revoke token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
