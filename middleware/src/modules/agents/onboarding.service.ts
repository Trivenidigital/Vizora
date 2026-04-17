import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '../database/database.service';

/**
 * Event-driven onboarding milestone tracker.
 *
 * Listens to domain events from auth, pairing, content, playlists, and
 * schedules services. Each handler:
 *   - Runs fire-and-forget (D3) — inner try/catch, never throws.
 *     `suppressErrors` is NOT a real @OnEvent option; the try/catch
 *     IS the authoritative guard.
 *   - Is idempotent — `upsert` with an EMPTY update block means
 *     re-firing the event is a no-op on already-set timestamps
 *     (D-arch-R2-1, D-nestjs-R2-2). Separate `updateMany` fills null
 *     fields on existing rows only.
 *   - Derives orgId from the event payload, which originates from
 *     JWT-derived `user.organizationId` in the publisher (D6).
 *     Publishers MUST NOT accept orgId from request body/params.
 */
type MilestoneField =
  | 'welcomeEmailSentAt'
  | 'firstScreenPairedAt'
  | 'firstContentUploadedAt'
  | 'firstPlaylistCreatedAt'
  | 'firstScheduleCreatedAt';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly db: DatabaseService) {}

  @OnEvent('user.welcomed', { async: true })
  async onUserWelcomed(evt: { orgId: string; userId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'welcomeEmailSentAt');
  }

  @OnEvent('display.paired', { async: true })
  async onDisplayPaired(evt: { orgId: string; displayId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'firstScreenPairedAt');
  }

  @OnEvent('content.created', { async: true })
  async onContentCreated(evt: { orgId: string; contentId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'firstContentUploadedAt');
  }

  @OnEvent('playlist.created', { async: true })
  async onPlaylistCreated(evt: { orgId: string; playlistId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'firstPlaylistCreatedAt');
  }

  @OnEvent('schedule.created', { async: true })
  async onScheduleCreated(evt: { orgId: string; scheduleId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'firstScheduleCreatedAt');
  }

  async markMilestone(orgId: string, field: MilestoneField): Promise<void> {
    if (!orgId) {
      // Publisher bug — log but don't throw
      this.logger.warn(`markMilestone called without orgId (field=${field})`);
      return;
    }
    try {
      // Step 1: upsert with EMPTY update — on conflict, existing row is
      // untouched (no timestamp overwrite). Race-safe via ON CONFLICT.
      await this.db.organizationOnboarding.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          [field]: new Date(),
        },
        update: {},
      });
      // Step 2: fill-if-null for the target field only. If existing row
      // already has the timestamp, this is a no-op.
      await this.db.organizationOnboarding.updateMany({
        where: {
          organizationId: orgId,
          [field]: null,
        },
        data: { [field]: new Date() },
      });
    } catch (err) {
      // Fire-and-forget: never propagate failure to the publisher (D3)
      this.logger.warn(
        `markMilestone failed for org=${orgId} field=${field}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
