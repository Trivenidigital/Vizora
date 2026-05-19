/**
 * O5 — Webhook subscription constants + event allowlist.
 */

/**
 * Events that subscribers may listen to. Allowlist enforced at DTO level
 * so customers can't subscribe to events that don't exist (typo bugs) or
 * sensitive internal events (e.g. `user.welcomed` is fine; `pairing.code`
 * carries a secret and is intentionally NOT exposed).
 */
export const WEBHOOK_EVENTS = [
  'display.paired',
  'display.tags.changed',
  'display.playlist.assigned',
  'content.created',
  'content.flagged',
  'content.approval.submitted',
  'content.approval.approved',
  'content.approval.rejected',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Consecutive failures after which the dispatcher auto-disables the hook. */
export const AUTO_DISABLE_THRESHOLD = 10;

/** Outbound POST timeout. Defends against slow customer endpoints. */
export const DELIVERY_TIMEOUT_MS = 5000;

/** HMAC signature header name. Customers verify by computing HMAC-SHA256 of the raw body with the secret. */
export const SIGNATURE_HEADER = 'X-Vizora-Signature';

/** Event-name header so customers can route incoming hooks without parsing the body. */
export const EVENT_HEADER = 'X-Vizora-Event';
