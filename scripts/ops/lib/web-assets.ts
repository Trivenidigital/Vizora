/**
 * Vizora Autonomous Operations — web asset reference extraction
 *
 * Pure helpers for probing that the web app serves the assets its own HTML
 * asks for. No I/O, so the parsing rules are testable without a running server.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * On 2026-08-12 an in-place `next build` on the prod VPS was OOM-killed
 * mid-compile and wiped `.next`. The already-running `next-server` kept serving
 * HTML from file handles it had opened before the wipe, while every read that
 * resolved a PATH failed:
 *
 *     /                          → 200   (HTML shell)
 *     /_next/static/chunks/*.js  → 500   (every referenced asset)
 *
 * `health-guardian` probed `webUrl + '/'` and saw 200, so it reported web
 * healthy for 5h45m while the application was unusable in a browser. Every
 * other check in the session agreed, because they all asked the same shallow
 * question.
 *
 * A shell that renders is not a working app. The probe has to follow at least
 * one reference the HTML itself emits — that is the cheapest assertion that
 * distinguishes "serving" from "serving something usable".
 */

/** Asset kinds worth probing. Both were 500 during the incident. */
const ASSET_PATTERN = /(?:src|href)=["'](\/_next\/static\/[^"']+\.(?:js|css))["']/g;

/**
 * Extract the `/_next/static/...` assets an HTML document references.
 *
 * Deliberately narrow: only Next's build-output paths, which are the ones that
 * disappear when a build is incomplete. Ignores external/CDN URLs, inline
 * data URIs, and same-origin non-build assets — a probe that followed those
 * would fail for reasons unrelated to artifact integrity.
 *
 * Returns de-duplicated paths in document order.
 */
export function extractReferencedAssets(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(ASSET_PATTERN)) {
    const path = match[1];
    if (path && !found.includes(path)) found.push(path);
  }
  return found;
}

export interface AssetProbePlan {
  /** Paths to fetch. Empty when the HTML references no build assets. */
  paths: string[];
  /** True when the HTML referenced assets but none could be selected. */
  unverifiable: boolean;
  reason: string;
}

/**
 * Choose which referenced assets to probe.
 *
 * Probes a small sample rather than every asset: the check runs every 5
 * minutes, and one broken chunk is enough to prove the artifact is incomplete —
 * during the incident EVERY asset 500'd, so a sample of two would have caught
 * it on the first cycle.
 *
 * HTML that references no build assets is reported as `unverifiable` rather
 * than passing silently. That distinction matters: "nothing to check" and
 * "everything checked out" are different states, and conflating them is how the
 * original blind spot survived.
 */
export function planAssetProbe(html: string, sampleSize = 2): AssetProbePlan {
  const assets = extractReferencedAssets(html);
  if (assets.length === 0) {
    return {
      paths: [],
      unverifiable: true,
      reason: 'served HTML references no /_next/static assets — asset health could not be verified',
    };
  }
  return {
    paths: assets.slice(0, Math.max(1, sampleSize)),
    unverifiable: false,
    reason: `${assets.length} asset(s) referenced, probing ${Math.min(assets.length, Math.max(1, sampleSize))}`,
  };
}

export interface AssetProbeOutcome {
  path: string;
  status?: number;
  ok: boolean;
  error?: string;
}

/**
 * Decide whether a set of probe results means the web app is serving usable
 * assets.
 *
 * Any non-2xx is a failure. The incident produced 500s; a 404 would mean the
 * HTML references a file that no longer exists, which is the same class of
 * artifact/serving mismatch and equally user-breaking.
 */
export function summarizeAssetProbe(outcomes: AssetProbeOutcome[]): {
  ok: boolean;
  detail: string;
} {
  if (outcomes.length === 0) {
    return { ok: true, detail: 'no assets probed' };
  }
  const failed = outcomes.filter(o => !o.ok);
  if (failed.length === 0) {
    return { ok: true, detail: `${outcomes.length}/${outcomes.length} referenced asset(s) served` };
  }
  const detail = failed
    .map(f => `${f.path} -> ${f.status ?? f.error ?? 'no response'}`)
    .join('; ');
  return {
    ok: false,
    detail: `${failed.length}/${outcomes.length} referenced asset(s) failed: ${detail}`,
  };
}
