import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guards routes that should only be callable by other Vizora services
 * (the runner script, ops agents, the insights-poller sidecar).
 *
 * Matches the existing OUTBOUND convention used by middleware → realtime:
 * header `x-internal-api-key`, value compared against
 * `INTERNAL_API_SECRET` env via constant-time compare.
 *
 * Returns 401 (not 403) on mismatch — these endpoints should not
 * acknowledge their existence to anyone without the secret.
 *
 * REQUIRES `x-internal-caller` header (one of: runner | sidecar | ops)
 * for caller attribution. A leaked secret in a runner log compromises
 * fewer surfaces if we know which caller leaked it.
 *
 * See: docs/plans/2026-05-08-agent-platform-redesign-design.md §3.2
 */
const ALLOWED_CALLERS = ['runner', 'sidecar', 'ops'] as const;
type AllowedCaller = (typeof ALLOWED_CALLERS)[number];

@Injectable()
export class InternalSecretGuard implements CanActivate {
  private readonly logger = new Logger(InternalSecretGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_API_SECRET');
    if (!expected) {
      // Fail closed and log loudly — this is a misconfiguration.
      this.logger.error('INTERNAL_API_SECRET not set — refusing all internal calls');
      throw new UnauthorizedException();
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-internal-api-key'];
    if (typeof provided !== 'string' || !this.constantTimeEquals(provided, expected)) {
      throw new UnauthorizedException();
    }
    const caller = req.headers['x-internal-caller'];
    if (typeof caller !== 'string' || !ALLOWED_CALLERS.includes(caller as AllowedCaller)) {
      throw new UnauthorizedException();
    }
    // Stamp the validated caller onto the request for downstream audit logs.
    (req as Request & { internalCaller?: AllowedCaller }).internalCaller = caller as AllowedCaller;
    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks on the secret.
   * Returns false on length mismatch (length itself is not secret).
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
