/**
 * O7 — Configurable downtime alert rules.
 *
 * Source of truth for the enum-like string values + tuning constants used
 * across DTO validation, service logic, and the evaluator. Centralized so a
 * change in the allowed-channel list (or the dedup window) requires editing
 * exactly one file.
 */

export const TRIGGER_EVENTS = ['device.offline'] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

export const SCOPES = ['all', 'tag', 'group', 'display'] as const;
export type Scope = (typeof SCOPES)[number];

export const CHANNELS = ['in_app', 'email', 'slack_webhook'] as const;
export type Channel = (typeof CHANNELS)[number];

/** 15-minute dedup window per rule (atomic CAS via `tryClaimDedupWindow`). */
export const DEDUP_WINDOW_MS = 15 * 60 * 1000;

/**
 * Floor for `minOfflineSec`. The stale-heartbeat cron in
 * `displays.service.ts` only emits `device.offline` once a device's
 * `lastHeartbeat` is >2 min stale, so any `minOfflineSec` below 120s would
 * be silently equivalent to 120. DTO rejects values below this.
 */
export const MIN_OFFLINE_SEC_FLOOR = 120;

/** Hard upper bound on recipients per rule. Defends against fan-out abuse. */
export const MAX_RECIPIENTS_PER_RULE = 20;

/**
 * Allowlist regex for `slack_webhook` channel targets. Slack incoming webhook
 * URLs are of the form https://hooks.slack.com/services/T.../B.../xxx.
 * Validated at DTO time AND re-validated at dispatch time (defense in depth
 * in case a record was tampered with via direct DB write).
 *
 * Adding more webhook channels (PagerDuty, Discord, Teams) is deferred to a
 * follow-up PR — each needs its own allowlist + payload shape + integration
 * tests.
 */
export const SLACK_WEBHOOK_REGEX = /^https:\/\/hooks\.slack\.com\/services\//;

/**
 * Slack's `text` field renders Markdown. A device named e.g. `*pwn*` would
 * render as bold, mangling the alert. Escape backtick + the four format
 * delimiters before interpolation.
 */
export function escapeSlackText(s: string): string {
  return s.replace(/[`*_~|]/g, (c) => `\\${c}`);
}
