import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { AUTH_CONSTANTS } from '../../auth/constants/auth.constants';

/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for CSRF protection
 *
 * How it works:
 * 1. Server sets a CSRF token in a readable cookie (not httpOnly)
 * 2. Client reads the cookie and includes token in X-CSRF-Token header
 * 3. Server validates that cookie and header match
 *
 * Security:
 * - Attacker cannot read cookies from another domain (same-origin policy)
 * - Attacker cannot set custom headers without CORS preflight
 * - Token is cryptographically random (32 bytes)
 * - Constant-time comparison prevents timing attacks
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Generate CSRF token if not present
    let csrfToken = req.cookies?.[AUTH_CONSTANTS.CSRF_COOKIE_NAME];

    if (!csrfToken) {
      csrfToken = this.generateToken();
    }

    // Set/refresh the CSRF cookie (readable by JavaScript)
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(AUTH_CONSTANTS.CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false, // Must be readable by JavaScript to send in header
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: AUTH_CONSTANTS.TOKEN_EXPIRY_MS,
      path: '/',
    });

    // Also expose token in response header for initial page loads
    res.setHeader('X-CSRF-Token', csrfToken);

    // Skip validation for safe methods (GET, HEAD, OPTIONS)
    const method = req.method.toUpperCase();
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(method)) {
      return next();
    }

    // Skip CSRF for public endpoints that don't require cookies
    // These use other protections (rate limiting)
    // Use endsWith() for exact suffix matching to prevent path traversal bypasses
    const fullPath = req.originalUrl || req.url || req.path;
    const csrfExemptSuffixes = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/devices/pairing/request',
      '/devices/pairing/status',
      '/webhooks/stripe',
      '/webhooks/razorpay',
    ];

    const isExempt = csrfExemptSuffixes.some(suffix => fullPath.endsWith(suffix))
      || fullPath.match(/\/devices\/pairing\/status\/[A-Za-z0-9]+$/);

    if (isExempt) {
      return next();
    }

    // Validate CSRF token for state-changing operations
    const tokenFromHeader = req.headers[
      AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()
    ] as string;
    const tokenFromCookie = req.cookies?.[AUTH_CONSTANTS.CSRF_COOKIE_NAME];

    // If no cookie token exists on a state-changing request, reject it.
    // The CSRF cookie should have been set on a prior GET request.
    // This prevents bypass by stripping the cookie.
    if (!tokenFromCookie) {
      return res.status(403).json({
        statusCode: 403,
        message: 'CSRF cookie missing',
        error: 'Forbidden',
      });
    }

    // Validate header token matches cookie token
    if (!tokenFromHeader || !this.secureCompare(tokenFromHeader, tokenFromCookie)) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Invalid CSRF token',
        error: 'Forbidden',
      });
    }

    next();
  }

  /**
   * Generate cryptographically secure random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}
