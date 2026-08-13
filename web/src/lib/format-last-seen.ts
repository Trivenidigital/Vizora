/**
 * Relative "last seen" for device liveness.
 *
 * Why relative at all: `online` in Vizora means "recently observed online
 * according to the server's freshness model", not "live this millisecond". The
 * persisted status can lag real contact — the heartbeat DB write is throttled,
 * the offline threshold is 2 minutes, and the sweep runs on minute boundaries.
 * Rather than hedge the badge into "Possibly Online", the badge stays decisive
 * and the freshness sits next to it, so an operator can judge staleness.
 *
 * Buckets are deliberately coarse. Second-level precision on a value that can
 * legitimately be a minute stale would imply accuracy the number does not have;
 * the exact timestamp remains one hover (or one `<time dateTime>`) away.
 */
export function formatLastSeen(value: string | number | Date, now: Date = new Date()): string {
  const then = value instanceof Date ? value : new Date(value);
  const ms = then.getTime();
  if (!Number.isFinite(ms)) return 'Unknown';

  const seconds = Math.round((now.getTime() - ms) / 1000);

  // Small negative skew between the device clock, the server and the browser is
  // normal; reporting "in 4 seconds" would look broken.
  if (seconds < 0 && seconds > -120) return 'Just now';
  if (seconds < 0) return then.toLocaleDateString();

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m} min${m === 1 ? '' : 's'} ago`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (seconds < 604_800) {
    const d = Math.floor(seconds / 86_400);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }
  return then.toLocaleDateString();
}
