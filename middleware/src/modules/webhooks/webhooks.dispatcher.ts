import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebhooksService } from './webhooks.service';
import { WebhookEvent, WEBHOOK_EVENTS } from './webhook.types';

/**
 * O5 — @OnEvent dispatcher. Subscribes to the allowlisted domain events
 * and fans out to webhook subscribers in the same org.
 *
 * Each handler wraps its body in a top-level try/catch per the
 * `app.module.ts:42-54` INVARIANT — uncaught rejection in an async
 * @OnEvent handler crashes PM2 because EventEmitter2 is configured with
 * `ignoreErrors:false`.
 *
 * Delivery is per-subscriber, sequential (no parallel fan-out in v1).
 * Each subscriber's delivery is wrapped in its own try/catch via
 * `webhooks.service.deliver()` which never throws — failures are recorded
 * on the row (lastError, failureCount).
 */
@Injectable()
export class WebhooksDispatcher {
  private readonly logger = new Logger(WebhooksDispatcher.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  // Subscribes to ALL allowlisted events via @OnEvent wildcard pattern.
  // The actual fan-out is per-event so we have correct typing of the
  // payload and a clean per-event audit trail in logs.

  @OnEvent('display.paired', { async: true })
  async onDisplayPaired(payload: { organizationId: string; displayId: string }) {
    await this.fanOut('display.paired', payload);
  }

  @OnEvent('display.tags.changed', { async: true })
  async onDisplayTagsChanged(payload: { organizationId: string; displayId: string }) {
    await this.fanOut('display.tags.changed', payload);
  }

  @OnEvent('display.playlist.assigned', { async: true })
  async onDisplayPlaylistAssigned(payload: { organizationId: string; displayId: string; playlistId: string; ruleId?: string; source?: string }) {
    await this.fanOut('display.playlist.assigned', payload);
  }

  @OnEvent('content.created', { async: true })
  async onContentCreated(payload: { organizationId?: string; entityId?: string } & Record<string, unknown>) {
    if (!payload.organizationId) return; // pre-O5 emit shape — skip
    await this.fanOut('content.created', payload);
  }

  @OnEvent('content.flagged', { async: true })
  async onContentFlagged(payload: { organizationId?: string; entityId?: string } & Record<string, unknown>) {
    if (!payload.organizationId) return;
    await this.fanOut('content.flagged', payload);
  }

  @OnEvent('content.approval.submitted', { async: true })
  async onApprovalSubmitted(payload: { organizationId: string; contentId: string; submittedBy: string }) {
    await this.fanOut('content.approval.submitted', payload);
  }

  @OnEvent('content.approval.approved', { async: true })
  async onApprovalApproved(payload: { organizationId: string; contentId: string; approvedBy: string }) {
    await this.fanOut('content.approval.approved', payload);
  }

  @OnEvent('content.approval.rejected', { async: true })
  async onApprovalRejected(payload: { organizationId: string; contentId: string; rejectedBy: string }) {
    await this.fanOut('content.approval.rejected', payload);
  }

  /**
   * Common fan-out path. Defensive: every step has a try/catch so one
   * misbehaving subscriber can't block the others, and a query failure
   * doesn't surface as an unhandled rejection at the EventEmitter.
   */
  private async fanOut(event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
    try {
      // Defensive: this shouldn't fire for an event not in the allowlist
      // (the @OnEvent decorators only subscribe to allowlisted names), but
      // belt-and-braces.
      if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) return;

      const organizationId = (payload.organizationId as string) || '';
      if (!organizationId) {
        this.logger.warn(`webhook fan-out skipped: event ${event} had no organizationId`);
        return;
      }

      const subscribers = await this.webhooksService.findActiveSubscribers(organizationId, event);
      if (subscribers.length === 0) return;

      for (const hook of subscribers) {
        try {
          await this.webhooksService.deliver(
            { id: hook.id, url: hook.url, secret: hook.secret },
            event,
            payload,
          );
        } catch (err) {
          // `deliver` already records failure on the row. If it threw
          // (programmer error), log + continue.
          this.logger.error(
            `webhook fan-out: deliver threw for ${hook.id}/${event}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    } catch (err) {
      // Top-level guard for the @OnEvent INVARIANT.
      this.logger.error(
        `webhook fan-out failed for event ${event}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
