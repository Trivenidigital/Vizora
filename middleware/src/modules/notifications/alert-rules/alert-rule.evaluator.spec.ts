import { of } from 'rxjs';
import { AlertRuleEvaluator } from './alert-rule.evaluator';
import { AlertRulesService } from './alert-rules.service';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../../mail/mail.service';
import { NotificationsService } from '../notifications.service';
import { HttpService } from '@nestjs/axios';

describe('AlertRuleEvaluator', () => {
  let evaluator: AlertRuleEvaluator;
  let db: any;
  let alertRulesService: jest.Mocked<Pick<AlertRulesService, 'findActiveForEvent' | 'tryClaimDedupWindow'>>;
  let mail: jest.Mocked<Pick<MailService, 'sendDeviceOfflineAlertEmail'>>;
  let http: jest.Mocked<Pick<HttpService, 'post'>>;
  // in_app dispatch now routes through NotificationsService.create() (not a raw
  // db write) so the new notification is broadcast over the realtime gateway.
  // Tests assert against this mock as the "an in_app notification was created"
  // sentinel.
  let notifications: jest.Mocked<Pick<NotificationsService, 'create'>>;

  const orgId = 'org-123';
  const deviceId = 'device-1';
  const deviceName = 'Lobby Display';

  const payload = { deviceId, deviceName, organizationId: orgId };

  beforeEach(() => {
    db = {
      display: { findUnique: jest.fn() },
      notification: { create: jest.fn() },
      // Default: the recipient user exists in the rule's org. Override
      // per-test for cross-tenant guard checks.
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    };
    alertRulesService = {
      findActiveForEvent: jest.fn(),
      tryClaimDedupWindow: jest.fn(),
    } as any;
    mail = { sendDeviceOfflineAlertEmail: jest.fn() } as any;
    http = { post: jest.fn() } as any;
    notifications = { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) } as any;

    evaluator = new AlertRuleEvaluator(
      db as unknown as DatabaseService,
      alertRulesService as unknown as AlertRulesService,
      mail as unknown as MailService,
      http as unknown as HttpService,
      notifications as unknown as NotificationsService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  // Helper — produce a rule of given scope
  const makeRule = (overrides: Partial<any> = {}) => ({
    id: 'rule-1',
    organizationId: orgId,
    name: 'r',
    triggerEvent: 'device.offline',
    isActive: true,
    scope: 'all',
    scopeTagId: null,
    scopeGroupId: null,
    scopeDisplayId: null,
    minOfflineSec: 120,
    recipients: [{ id: 'rec-1', channel: 'in_app', target: 'user-1' }],
    ...overrides,
  });

  // 10 minutes ago, relative to real now. Guarantees offlineSec > minOfflineSec (120)
  // regardless of when the test suite runs.
  const makeDevice = (overrides: Partial<any> = {}) => ({
    id: deviceId,
    lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000),
    tags: [],
    groups: [],
    ...overrides,
  });

  // ---------------------------------------------------------------------------
  // Top-level
  // ---------------------------------------------------------------------------
  it('logs warn and returns when device does not exist (no rules evaluated)', async () => {
    db.display.findUnique.mockResolvedValue(null);

    await evaluator.handleDeviceOffline(payload);

    expect(alertRulesService.findActiveForEvent).not.toHaveBeenCalled();
  });

  it('no-op when org has zero active rules', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([]);

    await evaluator.handleDeviceOffline(payload);

    expect(alertRulesService.tryClaimDedupWindow).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('top-level try/catch swallows DB failures so EventEmitter does not crash', async () => {
    db.display.findUnique.mockRejectedValue(new Error('DB down'));

    await expect(evaluator.handleDeviceOffline(payload)).resolves.toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // lastHeartbeat=null edge case
  // ---------------------------------------------------------------------------
  it('fires rule when lastHeartbeat is null (treats as infinitely offline)', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice({ lastHeartbeat: null }));
    alertRulesService.findActiveForEvent.mockResolvedValue([makeRule({ minOfflineSec: 99999 })]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);

    await evaluator.handleDeviceOffline(payload);

    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Scope matching
  // ---------------------------------------------------------------------------
  describe('scope', () => {
    beforeEach(() => {
      alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);
    });

    it('scope=all matches every device', async () => {
      db.display.findUnique.mockResolvedValue(makeDevice());
      alertRulesService.findActiveForEvent.mockResolvedValue([makeRule({ scope: 'all' })]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('scope=tag matches when device has the tag', async () => {
      db.display.findUnique.mockResolvedValue(
        makeDevice({ tags: [{ tagId: 'tag-1' }, { tagId: 'tag-2' }] }),
      );
      alertRulesService.findActiveForEvent.mockResolvedValue([
        makeRule({ scope: 'tag', scopeTagId: 'tag-2' }),
      ]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('scope=tag skips when device lacks the tag', async () => {
      db.display.findUnique.mockResolvedValue(makeDevice({ tags: [{ tagId: 'tag-9' }] }));
      alertRulesService.findActiveForEvent.mockResolvedValue([
        makeRule({ scope: 'tag', scopeTagId: 'tag-2' }),
      ]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('scope=tag with scopeTagId=null (Tag was deleted) skips with WARN log', async () => {
      const warnSpy = jest.spyOn((evaluator as any).logger, 'warn');
      db.display.findUnique.mockResolvedValue(makeDevice({ tags: [{ tagId: 'tag-1' }] }));
      alertRulesService.findActiveForEvent.mockResolvedValue([
        makeRule({ scope: 'tag', scopeTagId: null }),
      ]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('scope=tag but scopeTagId=null'));
    });

    it('scope=group matches when device is in the group', async () => {
      db.display.findUnique.mockResolvedValue(
        makeDevice({ groups: [{ displayGroupId: 'group-3' }] }),
      );
      alertRulesService.findActiveForEvent.mockResolvedValue([
        makeRule({ scope: 'group', scopeGroupId: 'group-3' }),
      ]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('scope=group with scopeGroupId=null skips with WARN log', async () => {
      const warnSpy = jest.spyOn((evaluator as any).logger, 'warn');
      db.display.findUnique.mockResolvedValue(makeDevice());
      alertRulesService.findActiveForEvent.mockResolvedValue([
        makeRule({ scope: 'group', scopeGroupId: null }),
      ]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('scope=display matches when display id is exact', async () => {
      db.display.findUnique.mockResolvedValue(makeDevice());
      alertRulesService.findActiveForEvent.mockResolvedValue([
        makeRule({ scope: 'display', scopeDisplayId: deviceId }),
      ]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).toHaveBeenCalledTimes(1);
    });

    it('scope=display skips when scopeDisplayId is different', async () => {
      db.display.findUnique.mockResolvedValue(makeDevice());
      alertRulesService.findActiveForEvent.mockResolvedValue([
        makeRule({ scope: 'display', scopeDisplayId: 'other-display' }),
      ]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('unknown scope value skips with WARN log', async () => {
      const warnSpy = jest.spyOn((evaluator as any).logger, 'warn');
      db.display.findUnique.mockResolvedValue(makeDevice());
      alertRulesService.findActiveForEvent.mockResolvedValue([makeRule({ scope: 'mystery' })]);

      await evaluator.handleDeviceOffline(payload);

      expect(notifications.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown scope'));
    });
  });

  // ---------------------------------------------------------------------------
  // minOfflineSec debounce
  // ---------------------------------------------------------------------------
  it('skips dispatch when offlineSec < minOfflineSec', async () => {
    // lastHeartbeat 60s ago, minOfflineSec=300 → offlineSec=60 → skip
    const now = new Date('2026-05-19T10:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    db.display.findUnique.mockResolvedValue(
      makeDevice({ lastHeartbeat: new Date('2026-05-19T09:59:00Z') }),
    );
    alertRulesService.findActiveForEvent.mockResolvedValue([
      makeRule({ minOfflineSec: 300 }),
    ]);

    await evaluator.handleDeviceOffline(payload);

    expect(alertRulesService.tryClaimDedupWindow).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Atomic dedup — per (rule, device)
  // ---------------------------------------------------------------------------
  it('dispatches only when tryClaimDedupWindow returns true', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([makeRule()]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(false);

    await evaluator.handleDeviceOffline(payload);

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('passes both ruleId AND deviceId to tryClaimDedupWindow (per-device dedup)', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([makeRule({ id: 'rule-X' })]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);

    await evaluator.handleDeviceOffline(payload);

    expect(alertRulesService.tryClaimDedupWindow).toHaveBeenCalledWith(
      'rule-X',
      deviceId,
      expect.any(Date),
    );
  });

  it('same rule fires for device A and then device B independently (the PR-review fix)', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice({ id: 'device-A' }));
    alertRulesService.findActiveForEvent.mockResolvedValue([makeRule()]);
    // First call: claim succeeds for device-A
    alertRulesService.tryClaimDedupWindow.mockResolvedValueOnce(true);

    await evaluator.handleDeviceOffline({ deviceId: 'device-A', deviceName: 'A', organizationId: orgId });

    // Now device B goes offline — even though the rule fired 5 min ago for device-A,
    // it must fire independently for device-B (different per-device dedup state).
    db.display.findUnique.mockResolvedValue(makeDevice({ id: 'device-B' }));
    alertRulesService.tryClaimDedupWindow.mockResolvedValueOnce(true);

    await evaluator.handleDeviceOffline({ deviceId: 'device-B', deviceName: 'B', organizationId: orgId });

    // Both devices got their in_app notification
    expect(notifications.create).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // Per-recipient try/catch
  // ---------------------------------------------------------------------------
  it('one failing recipient does not block the others', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([
      makeRule({
        recipients: [
          { id: 'rec-1', channel: 'in_app', target: 'user-1' },
          { id: 'rec-2', channel: 'email', target: 'a@b.com' },
        ],
      }),
    ]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);
    // Make the in_app dispatch throw — emulating a failure inside create()
    notifications.create.mockRejectedValueOnce(new Error('create failed'));
    mail.sendDeviceOfflineAlertEmail.mockResolvedValue(undefined);

    await evaluator.handleDeviceOffline(payload);

    // Email recipient still received its alert
    expect(mail.sendDeviceOfflineAlertEmail).toHaveBeenCalledWith('a@b.com', deviceName);
  });

  // ---------------------------------------------------------------------------
  // Channels
  // ---------------------------------------------------------------------------
  it('dispatches in_app via NotificationsService.create with scoped userId (so it broadcasts)', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([makeRule()]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);

    await evaluator.handleDeviceOffline(payload);

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: orgId,
        userId: 'user-1',
        type: 'device_offline',
        severity: 'warning',
      }),
    );
    // The raw db write is no longer used by the in_app path — the broadcast
    // only fires when routed through NotificationsService.create().
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('in_app dispatch skips when recipient user no longer in the rule\'s org (cross-tenant guard)', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([makeRule()]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);
    // User was moved to another org since the recipient row was created.
    db.user.findFirst.mockResolvedValue(null);

    await evaluator.handleDeviceOffline(payload);

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('dispatches slack_webhook with maxRedirects:0 and 5s timeout', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([
      makeRule({
        recipients: [
          { id: 'rec-1', channel: 'slack_webhook', target: 'https://hooks.slack.com/services/T/B/x' },
        ],
      }),
    ]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);
    http.post.mockReturnValue(of({ data: 'ok' }) as any);

    await evaluator.handleDeviceOffline(payload);

    expect(http.post).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T/B/x',
      expect.objectContaining({ text: expect.any(String) }),
      expect.objectContaining({ maxRedirects: 0, timeout: 5000 }),
    );
  });

  it('SSRF guard at dispatch: rejects non-Slack URL even if it slipped past the DTO', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([
      makeRule({
        recipients: [
          { id: 'rec-1', channel: 'slack_webhook', target: 'http://internal/foo' },
        ],
      }),
    ]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);
    const errSpy = jest.spyOn((evaluator as any).logger, 'error');

    await evaluator.handleDeviceOffline(payload);

    expect(http.post).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('fails allowlist'));
  });

  it('escapes Slack markdown special characters in deviceName', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([
      makeRule({
        recipients: [
          { id: 'rec-1', channel: 'slack_webhook', target: 'https://hooks.slack.com/services/T/B/x' },
        ],
      }),
    ]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);
    http.post.mockReturnValue(of({ data: 'ok' }) as any);

    await evaluator.handleDeviceOffline({ ...payload, deviceName: '*pwn*' });

    const body = (http.post as jest.Mock).mock.calls[0][1];
    // The "*pwn*" should be escaped to "\\*pwn\\*" so Slack doesn't render as bold
    expect(body.text).toContain('\\*pwn\\*');
    expect(body.text).not.toMatch(/\*pwn\*/);
  });

  // ---------------------------------------------------------------------------
  // Zero recipients edge case
  // ---------------------------------------------------------------------------
  it('rule with zero recipients is a silent no-op (no error, no dispatch)', async () => {
    db.display.findUnique.mockResolvedValue(makeDevice());
    alertRulesService.findActiveForEvent.mockResolvedValue([makeRule({ recipients: [] })]);
    alertRulesService.tryClaimDedupWindow.mockResolvedValue(true);

    await evaluator.handleDeviceOffline(payload);

    expect(notifications.create).not.toHaveBeenCalled();
    expect(mail.sendDeviceOfflineAlertEmail).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });
});
