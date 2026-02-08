import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Guard that protects internal API endpoints (push/command) with a shared secret.
 * Only the middleware service should be able to call these endpoints.
 *
 * Requires INTERNAL_API_SECRET env var to be set.
 * Callers must send the secret in the x-internal-api-key header.
 */
@Injectable()
export class InternalApiGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-internal-api-key'] as string;
    const secret = process.env.INTERNAL_API_SECRET;

    if (!secret) {
      this.logger.error(
        'INTERNAL_API_SECRET is not set — internal API endpoints are disabled for security',
      );
      throw new UnauthorizedException('Internal API not configured');
    }

    if (!apiKey) {
      throw new UnauthorizedException('Missing x-internal-api-key header');
    }

    // Constant-time comparison to prevent timing attacks
    try {
      const keyBuffer = Buffer.from(apiKey, 'utf-8');
      const secretBuffer = Buffer.from(secret, 'utf-8');

      if (keyBuffer.length !== secretBuffer.length) {
        throw new UnauthorizedException('Invalid API key');
      }

      if (!timingSafeEqual(keyBuffer, secretBuffer)) {
        throw new UnauthorizedException('Invalid API key');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
