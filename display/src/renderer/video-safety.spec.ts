import {
  computeVideoSafetyTimeoutMs,
  VIDEO_SAFETY_MARGIN_MS,
  VIDEO_SAFETY_MIN_MS,
  VIDEO_SAFETY_MAX_MS,
} from './video-safety';

describe('computeVideoSafetyTimeoutMs', () => {
  it('uses the item duration plus a margin when no probed duration is available', () => {
    // 60s clip → 60_000 + margin, comfortably above the floor.
    expect(computeVideoSafetyTimeoutMs(60)).toBe(60_000 + VIDEO_SAFETY_MARGIN_MS);
  });

  it('prefers the probed media duration over the configured item duration', () => {
    // Configured 10s but the real clip is 120s — trust the probe so a long clip
    // is never cut off by the safety timer.
    expect(computeVideoSafetyTimeoutMs(10, 120)).toBe(120_000 + VIDEO_SAFETY_MARGIN_MS);
  });

  it('falls back to the hard ceiling when neither duration is known (hung load)', () => {
    expect(computeVideoSafetyTimeoutMs(undefined, undefined)).toBe(VIDEO_SAFETY_MAX_MS);
    expect(computeVideoSafetyTimeoutMs(null)).toBe(VIDEO_SAFETY_MAX_MS);
    expect(computeVideoSafetyTimeoutMs(0, NaN)).toBe(VIDEO_SAFETY_MAX_MS);
  });

  it('clamps a tiny duration up to the floor so it cannot hot-advance', () => {
    expect(computeVideoSafetyTimeoutMs(1)).toBe(VIDEO_SAFETY_MIN_MS);
  });

  it('clamps a bogus huge duration down to the ceiling so it cannot wedge rotation', () => {
    expect(computeVideoSafetyTimeoutMs(999999)).toBe(VIDEO_SAFETY_MAX_MS);
  });

  it('ignores non-finite / negative values and uses the next valid source', () => {
    expect(computeVideoSafetyTimeoutMs(-5, 45)).toBe(45_000 + VIDEO_SAFETY_MARGIN_MS);
    expect(computeVideoSafetyTimeoutMs(45, Infinity)).toBe(45_000 + VIDEO_SAFETY_MARGIN_MS);
  });
});
