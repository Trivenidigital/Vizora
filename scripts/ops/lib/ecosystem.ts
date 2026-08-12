/**
 * Vizora Autonomous Operations — read the canonical PM2 memory policy
 *
 * `ecosystem.config.js` is the authoritative source for each app's memory
 * limit. Anything that makes a decision against that limit must READ it rather
 * than keep its own copy.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * `health-guardian` carried its own hardcoded `memoryLimitBytes` per service and
 * gracefully reloaded a process above 85% of it. Those constants were copied
 * from the ecosystem file and then diverged: middleware's ecosystem limit was
 * deliberately raised 512M → 640M with the comment
 *
 *     "640M (was 512M): the working set legitimately approached 512M under
 *      load, causing a graceful restart every ~10min (cluster-covered, but
 *      churny)."
 *
 * — a change made specifically to STOP that churn. health-guardian's stale 512M
 * copy meant 85% was still 435MB, and middleware idles at 398-410MB with spikes
 * to 447-455MB. So the churn never stopped; it only changed owner. Six reloads
 * were recorded on 2026-08-12 between 17:20 and 20:20, and they were initially
 * mistaken for unexplained operator activity.
 *
 * realtime (512M) and web (1G) still matched, which is what identified the
 * middleware value as stale drift rather than an independent policy.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Parse a PM2 `max_memory_restart` value into bytes.
 *
 * PM2 accepts a plain number (bytes) or a suffixed string: `K`, `M`, `G`,
 * case-insensitive. Returns null for anything unrecognised — callers must treat
 * that as "unknown", never as a default, because acting on a guessed threshold
 * is the exact defect this module exists to remove.
 */
export function parseMemoryLimit(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') return null;

  const match = /^\s*(\d+(?:\.\d+)?)\s*([KMG])?B?\s*$/i.exec(value);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = (match[2] || '').toUpperCase();
  const multiplier = unit === 'G' ? 1024 ** 3 : unit === 'M' ? 1024 ** 2 : unit === 'K' ? 1024 : 1;
  return Math.round(amount * multiplier);
}

export interface EcosystemMemoryPolicy {
  /** pm2 app name → `max_memory_restart` in bytes. */
  limits: Record<string, number>;
  error?: string;
}

/**
 * Read every app's `max_memory_restart` from the canonical ecosystem file.
 *
 * Requiring the file evaluates JavaScript, including web's `env_production`
 * block which reads `web/.env.local` inside a try/catch. That side effect is a
 * file read and is harmless here — unlike the drift detector, which isolates
 * evaluation in a child process precisely because it must not perturb what it
 * observes.
 *
 * Never throws. On failure the caller gets an empty map plus a reason, and must
 * skip decisions that depend on a limit rather than substitute one.
 */
export function readEcosystemMemoryPolicy(
  ecosystemPath = join(REPO_ROOT, 'ecosystem.config.js'),
): EcosystemMemoryPolicy {
  try {
    const require = createRequire(import.meta.url);
    // Bypass the module cache so a long-lived process cannot serve a stale copy.
    delete require.cache[require.resolve(ecosystemPath)];
    const config = require(ecosystemPath) as { apps?: { name?: string; max_memory_restart?: unknown }[] };

    const limits: Record<string, number> = {};
    for (const app of config.apps ?? []) {
      if (!app?.name) continue;
      const bytes = parseMemoryLimit(app.max_memory_restart);
      if (bytes !== null) limits[app.name] = bytes;
    }
    return { limits };
  } catch (err) {
    return { limits: {}, error: err instanceof Error ? err.message : String(err) };
  }
}
