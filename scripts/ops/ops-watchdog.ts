#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — Ops Watchdog
 *
 * The third leg of the dead-man triad (with health-guardian itself and
 * the external healthchecks.io heartbeat). Runs every 15 minutes via
 * PM2 cron. Reads `logs/ops-state.json` and verifies each watched
 * agent's `lastRun` timestamp is recent enough — i.e. the agent's PM2
 * cron is actually firing. If an agent has gone silent past its SLA,
 * the watchdog raises a Slack alert and exits non-zero.
 *
 * Why this exists:
 *   - health-guardian pings healthchecks.io on success → that's the
 *     external dead-man for the case where the entire VPS is down.
 *   - But if PM2 silently stops firing health-guardian (config drift,
 *     systemd-pm2 link broken, the script consistently crashes before
 *     it can ping), the external heartbeat ALSO stops, and on its own
 *     you can't tell the difference between "VPS dead" and "one agent
 *     stuck."
 *   - This watchdog runs on the SAME VPS, watches the SAME ops-state
 *     file, and yells in Slack when the answer is "one agent stuck."
 *     It catches what the external heartbeat conflates.
 *
 * Environment variables (all optional):
 *   SLACK_WEBHOOK_URL  — destination for the alert (no-op if unset)
 *   OPS_WATCHDOG_SLA_MINUTES  — override per-agent SLA (default below)
 *
 * Exit codes:
 *   0 — every watched agent is within SLA
 *   1 — at least one agent has gone silent (alert sent if Slack configured)
 *   2 — fatal error (couldn't read state, etc.)
 */

import 'dotenv/config';
import type { Incident } from './lib/types.js';
import { readOpsState } from './lib/state.js';
import { log, sendSlackAlert } from './lib/alerting.js';

const AGENT = 'ops-watchdog';

/**
 * Per-agent SLA: how long after its last successful run before we
 * consider it silent. Set ~3× the agent's cron interval so we tolerate
 * a single missed run before alerting (cron drift, transient lock
 * contention, etc.) without screaming on the first hiccup.
 *
 * health-guardian runs every 5 min → 15 min SLA = 3 missed cycles
 * fleet-manager   runs every 10 min → 30 min SLA
 * content-lifecycle runs every 15 min → 45 min SLA
 * schedule-doctor   runs every 15 min → 45 min SLA
 * ops-reporter      runs every 30 min → 90 min SLA
 */
const SLA_MINUTES_BY_AGENT: Record<string, number> = {
  'health-guardian':   15,
  'fleet-manager':     30,
  'content-lifecycle': 45,
  'schedule-doctor':   45,
  'ops-reporter':      90,
};

/**
 * Re-alert behaviour: this watchdog runs every 15 min and DOES NOT
 * persist a cooldown. If an agent stays stuck, you get a Slack alert
 * every 15 min. That's intentional — a stuck cron-managed ops agent is
 * a serious condition; missing it because of "we already alerted"
 * would be worse than being noisy. If alert fatigue becomes a real
 * problem, persist a cooldown marker via writeOpsState.
 */

async function main(): Promise<void> {
  const startTime = Date.now();
  const slaOverride = process.env.OPS_WATCHDOG_SLA_MINUTES
    ? Number(process.env.OPS_WATCHDOG_SLA_MINUTES)
    : null;
  if (slaOverride && (!Number.isFinite(slaOverride) || slaOverride <= 0)) {
    log(AGENT, `invalid OPS_WATCHDOG_SLA_MINUTES=${process.env.OPS_WATCHDOG_SLA_MINUTES}; ignoring`);
  }

  let state: ReturnType<typeof readOpsState>;
  try {
    state = readOpsState();
  } catch (err) {
    log(AGENT, `FATAL: cannot read ops state: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  const lastRun: Record<string, string> = state.lastRun ?? {};
  const now = Date.now();
  const stale: Array<{ agent: string; minsSinceRun: number; slaMinutes: number }> = [];

  for (const [agent, slaDefault] of Object.entries(SLA_MINUTES_BY_AGENT)) {
    const slaMinutes = (slaOverride && Number.isFinite(slaOverride) && slaOverride > 0)
      ? slaOverride
      : slaDefault;
    const ts = lastRun[agent];
    if (!ts) {
      // No record at all — agent has never run, or state was wiped.
      // Don't alert on first deploy; require the cron to have fired at
      // least once. We'll catch persistent silence next tick.
      log(AGENT, `${agent}: no lastRun record — skipping (first run after deploy?)`);
      continue;
    }
    const ranAt = Date.parse(ts);
    if (Number.isNaN(ranAt)) {
      log(AGENT, `${agent}: malformed lastRun timestamp '${ts}'; skipping`);
      continue;
    }
    const minsSinceRun = Math.floor((now - ranAt) / 60_000);
    if (minsSinceRun > slaMinutes) {
      stale.push({ agent, minsSinceRun, slaMinutes });
    }
  }

  const durationMs = Date.now() - startTime;

  if (stale.length === 0) {
    log(AGENT, `all watched agents within SLA (${Object.keys(SLA_MINUTES_BY_AGENT).length} checked) in ${durationMs}ms`);
    process.exitCode = 0;
    return;
  }

  const summary = stale
    .map((s) => `${s.agent} silent ${s.minsSinceRun}m (sla=${s.slaMinutes}m)`)
    .join(', ');
  log(AGENT, `STALE: ${summary}`);

  const incidents: Incident[] = stale.map((s) => ({
    id: `ops-watchdog:agent-silent:${s.agent}`,
    agent: AGENT,
    type: 'agent-silent',
    severity: 'critical' as const,
    target: 'agent',
    targetId: s.agent,
    detected: new Date(now).toISOString(),
    message: `${s.agent} has not run in ${s.minsSinceRun} min (sla=${s.slaMinutes}m)`,
    remediation: `pm2 restart ops-${s.agent}; check pm2 logs ops-${s.agent}`,
    status: 'open' as const,
    attempts: 0,
  }));

  await sendSlackAlert(
    'CRITICAL',
    state.systemStatus ?? 'unknown',
    incidents,
    0,
  );

  log(AGENT, `alert sent for ${stale.length} stale agent(s) in ${durationMs}ms`);
  process.exitCode = 1;
}

main().catch((err) => {
  log(AGENT, `FATAL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 2;
});
