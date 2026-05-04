import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request } from 'express';
import { MCP_CONTEXT_KEY, type McpRequestContext } from './mcp-context';

const DEFAULT_PER_MIN = Number(process.env.MCP_RATE_LIMIT_PER_MIN ?? 60);
const DEFAULT_PER_DAY = Number(process.env.MCP_RATE_LIMIT_PER_DAY ?? 1000);

interface Bucket {
  minuteCount: number;
  minuteResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

/**
 * Per-token rate limit (in-memory). MUST run AFTER `McpAuthGuard` so
 * `req[MCP_CONTEXT_KEY]` is populated.
 *
 * **Cluster caveat:** the Vizora middleware runs PM2 cluster mode
 * (×2 in prod). Each instance has its own in-memory bucket, so the
 * effective per-token limit is ~2× the configured value. This is
 * documented and accepted for v1; if it bites, the bucket store
 * moves to Redis (Phase 2). Until then, set `MCP_RATE_LIMIT_PER_MIN`
 * to half of the desired global ceiling if you want a strict cap.
 *
 * The bucket Map grows with the number of distinct tokens. We sweep
 * stale buckets opportunistically on each call (cheap; runs once per
 * request anyway). At ~hundreds of tokens this is fine.
 */
@Injectable()
export class McpRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(McpRateLimitGuard.name);
  private readonly buckets = new Map<string, Bucket>();
  private lastSweepAt = 0;

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const mcp = (req as Request & Record<string, unknown>)[MCP_CONTEXT_KEY] as
      | McpRequestContext
      | undefined;
    if (!mcp) {
      // Defense-in-depth: this guard should never run before McpAuthGuard.
      // If it does, fail closed.
      throw new ThrottlerException(
        'rate-limit guard ran before auth — check guard ordering',
      );
    }

    this.maybeSweep();

    const now = Date.now();
    const bucket = this.buckets.get(mcp.tokenId) ?? this.fresh(now);

    if (now >= bucket.minuteResetAt) {
      bucket.minuteCount = 0;
      bucket.minuteResetAt = now + 60_000;
    }
    if (now >= bucket.dayResetAt) {
      bucket.dayCount = 0;
      bucket.dayResetAt = now + 24 * 60 * 60 * 1000;
    }

    if (bucket.minuteCount >= DEFAULT_PER_MIN) {
      this.logger.warn(
        `Rate limit (per-min) hit for token ${mcp.tokenId} agent=${mcp.agentName}`,
      );
      throw new ThrottlerException(
        `MCP rate limit exceeded: ${DEFAULT_PER_MIN}/min`,
      );
    }
    if (bucket.dayCount >= DEFAULT_PER_DAY) {
      this.logger.warn(
        `Rate limit (per-day) hit for token ${mcp.tokenId} agent=${mcp.agentName}`,
      );
      throw new ThrottlerException(
        `MCP rate limit exceeded: ${DEFAULT_PER_DAY}/day`,
      );
    }

    bucket.minuteCount++;
    bucket.dayCount++;
    this.buckets.set(mcp.tokenId, bucket);
    return true;
  }

  private fresh(now: number): Bucket {
    return {
      minuteCount: 0,
      minuteResetAt: now + 60_000,
      dayCount: 0,
      dayResetAt: now + 24 * 60 * 60 * 1000,
    };
  }

  /**
   * Drop buckets whose day window has long passed. O(n) sweep capped
   * to once per minute so it doesn't dominate hot paths.
   */
  private maybeSweep(): void {
    const now = Date.now();
    if (now - this.lastSweepAt < 60_000) return;
    this.lastSweepAt = now;
    const cutoff = now - 24 * 60 * 60 * 1000;
    for (const [tokenId, bucket] of this.buckets) {
      if (bucket.dayResetAt < cutoff) {
        this.buckets.delete(tokenId);
      }
    }
  }

  /** For tests: clear in-memory state. */
  reset(): void {
    this.buckets.clear();
    this.lastSweepAt = 0;
  }
}

export const MCP_RATE_LIMIT_DEFAULTS = {
  perMin: DEFAULT_PER_MIN,
  perDay: DEFAULT_PER_DAY,
};

// Re-export ThrottlerException so consumers don't need a second import
export { ThrottlerException };

/** Header set on rate-limit responses (Retry-After in seconds). */
export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

/**
 * Stub for HTTP code mapping; the controller layer translates
 * ThrottlerException → 429. Re-exported here for documentation.
 */
export const HTTP_RATE_LIMITED = HttpStatus.TOO_MANY_REQUESTS;
