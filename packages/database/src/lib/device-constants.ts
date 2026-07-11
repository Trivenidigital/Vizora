/**
 * Shared device-fleet constants consumed by BOTH backend services so the two
 * offline-detection views cannot disagree.
 *
 * `DEVICE_OFFLINE_THRESHOLD_MS` is routed through by:
 *  - middleware `DisplaysService.detectOfflineDevices` (the offline-marking cron)
 *  - realtime  `HeartbeatService.getDeviceHealth`      (the live health read)
 *
 * Before unification these were 120s (cron) vs 60s (realtime): a device whose
 * last heartbeat was 60–120s old read as "offline" in one view and "online" in
 * the other (and it shifted O7 alert timing). One exported constant removes the
 * divergence.
 *
 * Deliberate value — 120_000 ms (2 min):
 *   Devices heartbeat every ~15s; the realtime gateway throttles the durable
 *   Postgres `lastHeartbeat` write to at most once per 60s
 *   (HEARTBEAT_DB_REFRESH_INTERVAL_MS in realtime's device.gateway). Setting the
 *   offline threshold to 2× that write interval guarantees a live device is
 *   never marked offline off a single missed DB-write cycle.
 *
 * The 60s DB write-throttle is deliberately kept SEPARATE (and half this value):
 * it governs how often we persist heartbeats, not when a device is considered
 * offline. Do not collapse the two — a write-throttle equal to the offline
 * threshold would let a live device flap offline between write cycles.
 */
export const DEVICE_OFFLINE_THRESHOLD_MS = 120_000;
