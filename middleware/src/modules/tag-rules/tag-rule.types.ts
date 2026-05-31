/**
 * O4 — Tag-rule auto-assignment engine.
 *
 * Constants for DTO validation + service-internal sweep timeout. Centralized
 * so changing a bound (e.g. priority range) requires editing exactly one file.
 */

/** Lower number = higher priority. 1 = highest, 100 = default, 999 = lowest. */
export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 999;
export const PRIORITY_DEFAULT = 100;

/**
 * Synchronous re-evaluation sweep timeout for `TagRulesService.sweepDisplaysForTag`.
 *
 * If admin creates a rule that matches >> displays, the sequential
 * `evaluateForDisplay` loop could run long. Beyond this threshold the sweep
 * throws `GatewayTimeoutException` carrying `{ scanned, assigned, total }`
 * partial counts so operators see how far it got. Natural
 * `display.tags.changed` events converge over time.
 */
export const REEVAL_TIMEOUT_MS = 30 * 1000;
