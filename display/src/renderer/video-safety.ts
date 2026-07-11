// Reliability helpers for video playback (backlog realtime #6).
//
// A stalled / hung <video> may never fire `ended` OR `error`. Without a
// fallback the playlist freezes on a single frame forever while the device
// still heartbeats "online". We arm a per-video safety timer that force-advances
// if the natural events never arrive. The timeout is the item's known / probed
// duration plus a margin, clamped between a floor (so a bogus 0s duration cannot
// hot-advance) and a ceiling (so a bogus huge / missing duration cannot wedge
// rotation forever).

export const VIDEO_SAFETY_MARGIN_MS = 5000;
export const VIDEO_SAFETY_MIN_MS = 15000;
export const VIDEO_SAFETY_MAX_MS = 15 * 60 * 1000; // 15 min hard ceiling

function firstFinitePositiveSeconds(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

/**
 * Compute the force-advance safety timeout (ms) for a video item.
 *
 * Prefers the probed media duration (from `loadedmetadata`) over the item's
 * configured duration, since the probed value is the real length of the clip.
 * When neither is known the video load itself may be hung, so we fall back to
 * the hard ceiling rather than advancing early.
 */
export function computeVideoSafetyTimeoutMs(
  itemDurationSec: unknown,
  probedDurationSec?: unknown,
): number {
  const known = firstFinitePositiveSeconds(probedDurationSec, itemDurationSec);
  if (known === null) {
    return VIDEO_SAFETY_MAX_MS;
  }
  const withMargin = known * 1000 + VIDEO_SAFETY_MARGIN_MS;
  return Math.min(VIDEO_SAFETY_MAX_MS, Math.max(VIDEO_SAFETY_MIN_MS, withMargin));
}
