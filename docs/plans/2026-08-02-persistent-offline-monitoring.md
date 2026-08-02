# Persistent-offline monitoring — design, and the one decision it needs

**Status:** design only. Not implemented. Blocked on a product decision, not on engineering.

## The gap, precisely

Production has **transition** alerting. It does not have **persistent-outage** reconciliation. These are different properties and the distinction is the whole point of this document.

What exists today:

```
displays.service.ts  detectOfflineDevices()  @Cron(EVERY_MINUTE)
    → display.findMany({ status: 'online', lastHeartbeat < threshold })   ← cross-org, no orgId filter
    → status := 'offline'
    → emit 'device.offline' { deviceId, deviceName, organizationId }
alert-rule.evaluator.ts  @OnEvent('device.offline')
    → match org's AlertRule rows (scope all|tag|group|display, minOfflineSec floor)
    → AlertRuleFire dedup → per-recipient email
```

That path is correct and covers every organisation. Every org that has displays has a rule.

Its limitation is structural: it fires on the **edge** `online → offline`. It emits nothing when

- a display was already `offline` before the monitor started;
- the transition was missed (process restart, deploy, event-loop failure);
- the rule or its recipients were misconfigured *at the moment of transition*;
- the outage simply persists — an offline display generates one event, ever.

Production demonstrates this directly: **24 displays offline, 0 online, 2 alert-rule firings in total** (most recent 2026-07-24). No transitions, so no alerts. That is correct behaviour for an edge-triggered monitor and is *not* outage coverage.

`ops/fleet-manager` is **not** the answer and is **not** proven redundant. It only ever saw 5 of 24 displays because the ops account belongs to `E2E Test Org` and the displays REST API is org-scoped. Two tempting fixes were reviewed and **rejected**: granting it cross-tenant scope, and minting a cross-tenant MCP `list_displays_platform` tool. Both add tenant-crossing data exposure to duplicate something the product already does correctly per-tenant.

## Why this belongs in the backend

The authoritative cross-organisation query already exists **in-process**, where tenant isolation is not a concern because it is not an external API. Every primitive needed is already present:

| Requirement | Existing primitive |
|---|---|
| scheduler | `@Cron` in `DisplaysService` (NestJS schedule) |
| cross-org display query | `display.findMany` with no `organizationId` filter |
| offline threshold | `DEVICE_OFFLINE_THRESHOLD_MS` — reuse, do not duplicate |
| per-tenant rules + recipients | `AlertRule` (`triggerEvent` is a String, documented "extensible") |
| dedup | `AlertRuleFire` |
| per-rule sensitivity | `AlertRule.minOfflineSec` |

**No schema migration and no new authorization model are required.**

## Proposed implementation

`middleware/src/modules/displays/persistent-offline.reconciler.ts`

```ts
@Cron(CronExpression.EVERY_15_MINUTES)   // matches the ops-agent cadence already in use
async reconcilePersistentOffline(): Promise<void> {
  const threshold = new Date(Date.now() - DEVICE_OFFLINE_THRESHOLD_MS);  // reuse, don't duplicate
  // bounded batching — never load the whole fleet at once
  for await (const batch of this.pageDisplays({ where: {
        status: 'offline',
        isDisabled: false,              // operator-disabled displays never alert
        lastHeartbeat: { lt: threshold },
      }, take: 500 })) {
    for (const d of batch) {
      this.eventEmitter.emit('device.offline.persistent', {
        deviceId: d.id, deviceName: d.nickname ?? d.deviceIdentifier,
        organizationId: d.organizationId, offlineSince: d.lastHeartbeat,
      });
    }
  }
}
```

- `AlertRuleEvaluator` gains `@OnEvent('device.offline.persistent')`, reusing the existing scope-matching and `AlertRuleFire` dedup.
- Idempotency: one open incident per display, keyed on `(displayId, 'device.offline.persistent')`. Refresh on re-observation; **resolve when the display returns online or is disabled**.
- Cooldown: renotify at most once per `PERSISTENT_OFFLINE_NOTIFY_INTERVAL` (proposed 24h) per display, so a months-long outage is not a 15-minute alarm clock.
- Transition alerting is untouched — `device.offline` keeps firing immediately as it does now.
- Metrics: aggregate counters only (`persistent_offline_total`, `reconcile_duration_ms`, `reconcile_failures`). **No cross-tenant display detail is exposed through MCP.**
- Audit: one row per run — displays scanned, orgs touched, events emitted, duration.
- Failure logging + counter, per the rule established when the silent session-release swallowed a 401.

## Tests

Unit: disabled displays excluded; already-online excluded; threshold reuse (no duplicated constant); one event per display per run; idempotent across runs; resolution on return-to-online and on disable; cooldown suppresses the second notify inside the window; pagination covers >500; failures counted, never thrown.
Integration: a genuinely offline display produces an incident; a healthy display produces none; a disabled display produces none.

## Rollout

Ship behind `PERSISTENT_OFFLINE_RECONCILE_ENABLED` (default **off**). Enable with notifications suppressed first and compare emitted-event counts against `SELECT count(*) FROM devices WHERE status='offline' AND "isDisabled"=false` before any customer email is sent. Rollback is the flag.

## The decision this needs — and why it is not mine to make

Implementing detection is safe and within existing architecture. **Wiring it to customer notifications is not an engineering choice.**

Today prod would immediately notify real tenants (`Hisaku`, `Aldi`, `Nike`, `LAX Kitchen`, `Vizora LLC`, `Vizora QA`) about **24 displays that have been offline for up to five months**. That is a new recurring customer-notification policy, and the first send is unretractable.

Three open questions:

1. **Should customers be notified at all** about long-dormant displays, or is this an internal ops signal only?
2. **What is the backfill policy** on first enable — notify for existing outages, or only for outages detected after go-live? (Recommend: only after go-live, or every tenant gets a burst.)
3. **What cadence** is acceptable for an outage that persists — daily, weekly, or once then silent until state changes?

**Recommendation:** implement the reconciler emitting an **internal** aggregate signal only, default-off, with no customer notification path wired. Decide (1)–(3) separately, with the counts above in hand. That delivers the missing coverage without committing to a notification policy by accident.

Also open, and deliberately untouched: `Vizora QA` (3 displays) and `Vizora LLC` (3) have been fully offline for ~5 months. Whether they are real, retired, or test assets must be established before any alerting reaches them — a wrong answer here means either false alarms or a real outage dismissed as fixture noise.
