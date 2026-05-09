import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Guards routes that should only be callable by other Vizora services
 * (the runner script, ops agents, the insights-poller sidecar).
 *
 * Auth chain (defense in depth — PR-review R2 C4):
 *   1. Loopback-only check by default (INTERNAL_API_LOOPBACK_ONLY=true).
 *      The host nginx must ALSO deny external traffic to /api/v1/internal/*
 *      — this is the primary network defense; the loopback check is a
 *      backstop in case nginx config drifts.
 *   2. x-internal-api-key header compared against INTERNAL_API_SECRET via
 *      `crypto.timingSafeEqual` (PR-review R1 C5: replaces hand-rolled
 *      XOR loop which was not provably constant-time across V8 JIT).
 *   3. x-internal-caller header (one of: runner | sidecar | ops) for
 *      caller attribution.
 *
 * Returns 401 (not 403) on mismatch — these endpoints should not
 * acknowledge their existence to anyone without the secret.
 *
 * See: docs/plans/2026-05-08-agent-platform-redesign-design.md §3.2
 */
const ALLOWED_CALLERS = ['runner', 'sidecar', 'ops'] as const;
type AllowedCaller = (typeof ALLOWED_CALLERS)[number];

const LOOPBACK_IPS = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1', // IPv4-mapped IPv6
]);

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

    // Defense layer 1: loopback-only by default (PR-review R2 C4).
    // Set INTERNAL_API_LOOPBACK_ONLY=false to disable for multi-host setups.
    const loopbackOnly = this.config.get<string>('INTERNAL_API_LOOPBACK_ONLY', 'true') !== 'false';
    if (loopbackOnly && req.ip && !LOOPBACK_IPS.has(req.ip)) {
      throw new UnauthorizedException();
    }

    const provided = req.headers['x-internal-api-key'];
    if (typeof provided !== 'string' || !this.constantTimeEquals(provided, expected)) {
      throw new UnauthorizedException();
    }
    const caller = req.headers['x-internal-caller'];
    if (typeof caller !== 'string' || !ALLOWED_CALLERS.includes(caller as AllowedCaller)) {
      throw new UnauthorizedException();
    }
    // Stamp the validated caller onto the request for downstream persistence
    // (controller reads this and passes to AgentRunsService.recordRun).
    (req as Request & { internalCaller?: AllowedCaller }).internalCaller = caller as AllowedCaller;
    return true;
  }

  /**
   * Constant-time string comparison via Node's crypto.timingSafeEqual.
   * Length mismatch returns false immediately (length itself is not secret
   * for a fixed-format env var, but timingSafeEqual throws on length
   * mismatch so we short-circuit explicitly).
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
