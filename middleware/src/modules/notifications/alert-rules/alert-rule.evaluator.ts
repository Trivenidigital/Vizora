import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OnEvent } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@vizora/database';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../../mail/mail.service';
import { AlertRulesService } from './alert-rules.service';
import {
  Channel,
  SLACK_WEBHOOK_REGEX,
  TriggerEvent,
  escapeSlackText,
} from './alert-rule.types';

interface DeviceOfflinePayload {
  deviceId: string;
  deviceName: string;
  organizationId: string;
}

/**
 * O7 — Rule-driven evaluator for `device.offline` events.
 *
 * Replaces the hard-coded `handleDeviceOffline` handler that previously
 * lived in NotificationsService. Now, when a device transitions offline:
 *   1. Look up the device with its tags + groups.
 *   2. Load all active rules for the org with `triggerEvent='device.offline'`.
 *   3. For each rule:
 *      - Match scope against the device (all/tag/group/display).
 *      - Check minOfflineSec debounce against device.lastHeartbeat.
 *      - Atomically claim the 15-min dedup window (tryClaimDedupWindow).
 *      - Dispatch to each recipient, one channel at a time, with
 *        per-recipient try/catch so one failure doesn't kill others.
 *
 * Behavior change vs the old handler:
 *   - Old: every org user got an in-app notification on every offline event.
 *   - New: only orgs with explicit rules + recipients get alerts.
 *
 * The migration's seed script preserves 1:1 behavior for existing orgs by
 * seeding a default rule (scope=all, recipients=admins, channel=in_app).
 */
@Injectable()
export class AlertRuleEvaluator {
  private readonly logger = new Logger(AlertRuleEvaluator.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly alertRulesService: AlertRulesService,
    private readonly mail: MailService,
    private readonly http: HttpService,
  ) {}

  /**
   * Top-level handler. The outer try/catch matches the INVARIANT in
   * `app.module.ts:42-54` — async @OnEvent handlers MUST swallow errors
   * because EventEmitter2's `ignoreErrors:false` config turns uncaught
   * rejections into process-level errors (= PM2 restart storm).
   */
  @OnEvent('device.offline', { async: true })
  async handleDeviceOffline(payload: DeviceOfflinePayload): Promise<void> {
    try {
      await this.evaluate(payload);
    } catch (err) {
      this.logger.error(
        `Alert rule evaluation failed for device ${payload.deviceId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async evaluate(payload: DeviceOfflinePayload): Promise<void> {
    const device = await this.db.display.findUnique({
      where: { id: payload.deviceId },
      include: {
        tags: { select: { tagId: true } },
        groups: { select: { displayGroupId: true } },
      },
    });
    if (!device) {
      this.logger.warn(
        `device.offline event for unknown device ${payload.deviceId} — skipping all rules`,
      );
      return;
    }

    const rules = await this.alertRulesService.findActiveForEvent(
      payload.organizationId,
      'device.offline',
    );
    if (rules.length === 0) return;

    const now = new Date();
    // If lastHeartbeat is null (device that never sent a heartbeat), treat as
    // infinitely offline — any minOfflineSec threshold trivially passes.
    const offlineSec = device.lastHeartbeat
      ? Math.floor((now.getTime() - device.lastHeartbeat.getTime()) / 1000)
      : Number.POSITIVE_INFINITY;

    for (const rule of rules) {
      if (!this.scopeMatches(rule, device)) continue;
      if (offlineSec < rule.minOfflineSec) continue;

      // Atomic CAS — only the instance whose upsert affects 1 row dispatches.
      // Per-(rule, device) dedup: a rule matching N devices alerts for EACH
      // device, not just the first to go offline in the window.
      const claimed = await this.alertRulesService.tryClaimDedupWindow(
        rule.id,
        device.id,
        now,
      );
      if (!claimed) continue;

      await this.dispatchAll(rule, payload);
    }
  }

  /**
   * Scope predicate. Logs a WARN when a scope FK is null (the referenced
   * Tag / DisplayGroup / Display was deleted, leaving the rule in a zombie
   * state). The rule still survives in the DB so the org can fix it; the
   * evaluator just won't fire it.
   */
  private scopeMatches(
    rule: { id: string; scope: string; scopeTagId: string | null; scopeGroupId: string | null; scopeDisplayId: string | null },
    device: { id: string; tags: { tagId: string }[]; groups: { displayGroupId: string }[] },
  ): boolean {
    switch (rule.scope) {
      case 'all':
        return true;
      case 'tag':
        if (rule.scopeTagId == null) {
          this.logger.warn(
            `Rule ${rule.id} has scope=tag but scopeTagId=null (referenced Tag was deleted). Rule will never fire — consider disabling or re-scoping.`,
          );
          return false;
        }
        return device.tags.some((t) => t.tagId === rule.scopeTagId);
      case 'group':
        if (rule.scopeGroupId == null) {
          this.logger.warn(
            `Rule ${rule.id} has scope=group but scopeGroupId=null (referenced DisplayGroup was deleted).`,
          );
          return false;
        }
        return device.groups.some((g) => g.displayGroupId === rule.scopeGroupId);
      case 'display':
        if (rule.scopeDisplayId == null) {
          this.logger.warn(
            `Rule ${rule.id} has scope=display but scopeDisplayId=null (referenced Display was deleted).`,
          );
          return false;
        }
        return rule.scopeDisplayId === device.id;
      default:
        this.logger.warn(`Unknown scope "${rule.scope}" on rule ${rule.id} — skipping`);
        return false;
    }
  }

  /**
   * Per-recipient dispatch. Each recipient is wrapped in its own try/catch
   * so a single failure (FK violation, SMTP timeout, Slack 503) doesn't
   * prevent other recipients from receiving the alert.
   */
  private async dispatchAll(
    rule: { id: string; recipients: { id: string; channel: string; target: string }[] },
    payload: DeviceOfflinePayload,
  ): Promise<void> {
    for (const recipient of rule.recipients) {
      try {
        switch (recipient.channel as Channel) {
          case 'in_app':
            await this.dispatchInApp(recipient, payload);
            break;
          case 'email':
            await this.dispatchEmail(recipient, payload);
            break;
          case 'slack_webhook':
            await this.dispatchSlack(recipient, payload);
            break;
          default:
            this.logger.warn(
              `Unknown channel "${recipient.channel}" on recipient ${recipient.id} — skipping`,
            );
        }
      } catch (err) {
        this.logger.error(
          `Recipient dispatch failed (rule=${rule.id}, recipient=${recipient.id}, channel=${recipient.channel})`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async dispatchInApp(
    recipient: { target: string },
    payload: DeviceOfflinePayload,
  ): Promise<void> {
    await this.db.notification.create({
      data: {
        organizationId: payload.organizationId,
        userId: recipient.target,
        type: 'device_offline',
        severity: 'warning',
        title: 'Device offline',
        message: `${payload.deviceName} is offline`,
        metadata: { deviceId: payload.deviceId } as Prisma.InputJsonValue,
      },
    });
  }

  private async dispatchEmail(
    recipient: { target: string },
    payload: DeviceOfflinePayload,
  ): Promise<void> {
    await this.mail.sendDeviceOfflineAlertEmail(recipient.target, payload.deviceName);
  }

  private async dispatchSlack(
    recipient: { id: string; target: string },
    payload: DeviceOfflinePayload,
  ): Promise<void> {
    // SSRF guard — DTO validates at create time, but a tampered record (direct
    // DB write) is rejected here too. Defense in depth.
    if (!SLACK_WEBHOOK_REGEX.test(recipient.target)) {
      this.logger.error(
        `Slack webhook recipient ${recipient.id} rejected at dispatch — URL fails allowlist`,
      );
      return;
    }

    // SSRF defense: maxRedirects=0 prevents Slack 302 -> attacker chain.
    // timeout=5000 prevents slow-loris hold-open from blocking other dispatches.
    await firstValueFrom(
      this.http.post(
        recipient.target,
        { text: `:rotating_light: *${escapeSlackText(payload.deviceName)}* is offline` },
        { maxRedirects: 0, timeout: 5000 },
      ),
    );
  }

}
