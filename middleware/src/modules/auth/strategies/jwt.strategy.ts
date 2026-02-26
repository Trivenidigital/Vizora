import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../redis/redis.service';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  organizationId: string;
  role: string;
  isSuperAdmin?: boolean;
  type?: string; // 'user' or 'device'
  jti?: string; // JWT ID for token revocation
}

/**
 * Extract JWT from httpOnly cookie or Authorization header
 * Prioritizes cookie for security, falls back to header for API clients
 */
function extractJwtFromCookieOrHeader(req: Request): string | null {
  // First try to get from httpOnly cookie (most secure)
  if (req.cookies && req.cookies[AUTH_CONSTANTS.COOKIE_NAME]) {
    return req.cookies[AUTH_CONSTANTS.COOKIE_NAME];
  }

  // Fallback to Authorization header for API clients and devices
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private databaseService: DatabaseService,
    private redisService: RedisService,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${AUTH_CONSTANTS.MIN_JWT_SECRET_LENGTH} characters`,
      );
    }

    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  private static readonly USER_CACHE_TTL = 60; // seconds
  private static readonly USER_CACHE_PREFIX = 'user_auth:';

  async validate(payload: JwtPayload) {
    // Reject device tokens in user authentication — devices must use
    // their own auth path with DEVICE_JWT_SECRET, not the user JWT_SECRET
    if (payload.type === 'device') {
      throw new UnauthorizedException('Device tokens are not valid for user authentication');
    }

    // Check if token has been revoked
    if (payload.jti) {
      const isRevoked = await this.redisService.exists(`revoked_token:${payload.jti}`);
      if (isRevoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // Check Redis cache first to avoid DB hit on every request
    const cacheKey = `${JwtStrategy.USER_CACHE_PREFIX}${payload.sub}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const userData = JSON.parse(cached);
        if (!userData.isActive) {
          throw new UnauthorizedException('User not found or inactive');
        }
        return {
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          organizationId: userData.organizationId,
          role: userData.role,
          organization: userData.organization,
        };
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        // Cache parse error — fall through to DB
      }
    }

    // Cache miss — query database
    const user = await this.databaseService.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Convert BigInt fields to numbers before caching/returning
    // Use ?? 0 to guard against null/undefined → NaN from Number(null)
    const safeOrganization = user.organization ? {
      ...user.organization,
      storageUsedBytes: Number(user.organization.storageUsedBytes ?? 0),
      storageQuotaBytes: Number(user.organization.storageQuotaBytes ?? 0),
    } : null;

    // Cache the user data in Redis
    const userDataToCache = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: user.organizationId,
      role: user.role,
      isActive: user.isActive,
      organization: safeOrganization,
    };
    await this.redisService.set(cacheKey, JSON.stringify(userDataToCache), JwtStrategy.USER_CACHE_TTL);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: user.organizationId,
      role: user.role,
      organization: safeOrganization,
    };
  }
}
