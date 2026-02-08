import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  organizationId: string;
  role: string;
  type?: string; // 'user' or 'device'
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
  constructor(private databaseService: DatabaseService) {
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

  async validate(payload: JwtPayload) {
    // Reject device tokens in user authentication — devices must use
    // their own auth path with DEVICE_JWT_SECRET, not the user JWT_SECRET
    if (payload.type === 'device') {
      throw new UnauthorizedException('Device tokens are not valid for user authentication');
    }

    // Validate user exists and is active
    const user = await this.databaseService.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      organization: user.organization,
    };
  }
}
