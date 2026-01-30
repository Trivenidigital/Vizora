import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for CSRF protection
 *
 * Usage:
 * 1. This middleware generates and validates CSRF tokens
 * 2. Tokens are stored in an httpOnly cookie
 * 3. Frontend must send token in X-CSRF-Token header for state-changing operations
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly TOKEN_HEADER = 'x-csrf-token';
  private readonly TOKEN_COOKIE = 'csrf-token';

  use(req: Request, res: Response, next: NextFunction) {
    // Generate CSRF token if not present
    if (!req.cookies[this.TOKEN_COOKIE]) {
      const token = this.generateToken();
      res.cookie(this.TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000, // 1 hour
      });
    }

    // Validate CSRF token for state-changing operations
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const tokenFromHeader = req.headers[this.TOKEN_HEADER] as string;
      const tokenFromCookie = req.cookies[this.TOKEN_COOKIE];

      if (!tokenFromHeader || tokenFromHeader !== tokenFromCookie) {
        return res.status(403).json({
          statusCode: 403,
          message: 'Invalid CSRF token',
        });
      }
    }

    next();
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
