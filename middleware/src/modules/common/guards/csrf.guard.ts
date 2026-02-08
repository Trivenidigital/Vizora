import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as crypto from 'crypto';
import { AUTH_CONSTANTS } from '../../auth/constants/auth.constants';

// Decorator to skip CSRF protection for specific routes
export const SkipCsrf = () => Reflect.metadata('skipCsrf', true);

/**
 * CSRF Protection Guard
 *
 * Implements double-submit cookie pattern:
 * 1. Server sets a CSRF token in a readable cookie
 * 2. Client includes the token in a header with each state-changing request
 * 3. Server validates that cookie and header match
 *
 * This works because:
 * - Attacker can't read cookies from another domain (same-origin policy)
 * - Attacker can't set custom headers in cross-origin requests without CORS
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked to skip CSRF
    const skipCsrf = this.reflector.getAllAndOverride<boolean>('skipCsrf', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCsrf) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Only check CSRF for state-changing methods
    const safeMethodes = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethodes.includes(request.method)) {
      return true;
    }

    // Get CSRF token from cookie and header
    const cookieToken = request.cookies?.[AUTH_CONSTANTS.CSRF_COOKIE_NAME];
    const headerToken = request.headers[AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()] as string;

    // If no cookie token exists on a state-changing request, reject it.
    // The CSRF cookie should have been set on a prior GET request.
    // This prevents bypass by stripping the cookie.
    if (!cookieToken) {
      throw new ForbiddenException('CSRF cookie missing');
    }

    // Validate that header token matches cookie token
    if (!headerToken || !this.secureCompare(cookieToken, headerToken)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
