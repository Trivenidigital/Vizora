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

    // Skip CSRF for public auth endpoints (login, register)
    // These don't have cookies yet and use other protections (rate limiting)
    const publicPaths = ['/api/auth/login', '/api/auth/register'];
    if (publicPaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Validate CSRF token for state-changing operations
    const tokenFromHeader = req.headers[
      AUTH_CONSTANTS.CSRF_HEADER_NAME.toLowerCase()
    ] as string;
    const tokenFromCookie = req.cookies?.[AUTH_CONSTANTS.CSRF_COOKIE_NAME];

    // If no cookie token, allow the request (first request scenario)
    if (!tokenFromCookie) {
      return next();
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
