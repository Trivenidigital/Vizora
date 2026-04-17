import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '../database/database.service';

/**
 * Event-driven onboarding milestone tracker.
 *
 * Listens to domain events from auth, pairing, content, playlists, and
 * schedules services. Each handler:
 *   - Runs fire-and-forget (D3) — each handler has its own top-level
 *     try/catch, never throws to the publisher.
 *   - Is idempotent — `upsert` with an EMPTY update block means
 *     re-firing the event is a no-op on already-set timestamps
 *     (D-arch-R2-1, D-nestjs-R2-2). Separate `updateMany` fills null
 *     fields on existing rows only.
 *   - Reads `organizationId` from the event payload. This is the single
 *     convention across all publishers — never accept alternate keys.
 *     Publishers derive organizationId from JWT-derived `user.organizationId`,
 *     never from request body/params (D6).
 */
type MilestoneField =
  | 'welcomeEmailSentAt'
  | 'firstScreenPairedAt'
  | 'firstContentUploadedAt'
  | 'firstPlaylistCreatedAt'
  | 'firstScheduleCreatedAt';

type OnboardingEvent = {
  organizationId?: string;
  [k: string]: unknown;
};

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly db: DatabaseService) {}

  @OnEvent('user.welcomed', { async: true })
  async onUserWelcomed(evt: OnboardingEvent): Promise<void> {
    await this.handle(evt, 'welcomeEmailSentAt');
  }

  @OnEvent('display.paired', { async: true })
  async onDisplayPaired(evt: OnboardingEvent): Promise<void> {
    await this.handle(evt, 'firstScreenPairedAt');
  }

  @OnEvent('content.created', { async: true })
  async onContentCreated(evt: OnboardingEvent): Promise<void> {
    await this.handle(evt, 'firstContentUploadedAt');
  }

  @OnEvent('playlist.created', { async: true })
  async onPlaylistCreated(evt: OnboardingEvent): Promise<void> {
    await this.handle(evt, 'firstPlaylistCreatedAt');
  }

  @OnEvent('schedule.created', { async: true })
  async onScheduleCreated(evt: OnboardingEvent): Promise<void> {
    await this.handle(evt, 'firstScheduleCreatedAt');
  }

  private async handle(evt: OnboardingEvent, field: MilestoneField): Promise<void> {
    try {
      await this.markMilestone(evt.organizationId ?? '', field);
    } catch (err) {
      // Defense-in-depth: markMilestone already swallows, but belt-and-braces
      // in case a future change throws before the inner try.
      this.logger.warn(
        `onboarding handler failed (field=${field}): ${err instanceof Error ? err.message : err}`,
      );
    }
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
