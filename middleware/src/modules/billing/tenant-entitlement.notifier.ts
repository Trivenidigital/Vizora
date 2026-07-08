import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Emits tenant:suspended / tenant:resumed to the realtime gateway (Slice 0 item 3
 * plumbing: POST /api/internal/tenant-entitlement). Fire-and-forget with a bounded
 * timeout — a realtime outage must not fail the entitlement transition (the DB
 * state is the source of truth; auth/check reconciles devices on reconnect).
 */
@Injectable()
export class TenantEntitlementNotifier {
  private readonly logger = new Logger(TenantEntitlementNotifier.name);
  private readonly realtimeUrl = process.env.REALTIME_URL || 'http://localhost:3002';
  private static readonly TIMEOUT_MS = 10000;

  constructor(private readonly httpService: HttpService) {}

  async emit(
    organizationId: string,
    state: 'suspended' | 'resumed',
    reason?: string,
  ): Promise<void> {
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) {
      this.logger.warn('INTERNAL_API_SECRET not set — skipping tenant entitlement emit');
      return;
    }
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.realtimeUrl}/api/internal/tenant-entitlement`,
          { organizationId, state, reason },
          { headers: { 'x-internal-api-key': secret }, timeout: TenantEntitlementNotifier.TIMEOUT_MS },
        ),
      );
      this.logger.log(`tenant:${state} emitted for org ${organizationId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to emit tenant:${state} for org ${organizationId}: ${msg}`);
    }
  }
}
