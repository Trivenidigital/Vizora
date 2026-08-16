#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — Fleet Manager Agent
 *
 * Runs every 10 minutes via PM2 cron. Monitors display fleet health: detects
 * offline displays, resets error states, identifies cluster-wide outages,
 * and flags displays with no content assigned.
 *
 * Checks:
 *   1. Offline displays — ping recently-offline (<1hr), escalate persistent (>1hr)
 *   2. Error state displays — auto-reset status to 'inactive'
 *   3. Cluster offline — all displays in an org (3+) are offline → critical
 *   4. No content — online displays with no playlist and no schedule
 *
 * Incident clearing is EARNED, never assumed. A run that saw the whole tenant
 * resolves any prior incident of this agent's it did not re-raise; a run that
 * did NOT resolves nothing and says so via `scan-truncated`. The agent used to
 * fetch through `api.getAll`, which is `getAllScan(...).items` with the
 * `complete` verdict discarded, and then sweep with the non-coverage-aware
 * `resolveNotReraised`. Past the 500-entity page-walk cap that meant the
 * displays the walk never retrieved were never examined — yet every prior
 * incident held against them was resolved on the strength of not being
 * re-raised, `display_offline_persistent` and `cluster_offline` included. A
 * screen dark for a week read as recovered because the list stopped short of it.
 *
 * Exit codes:
 *   0 — all displays healthy
 *   1 — issues found (some may have been auto-fixed)
 *   2 — fatal error (agent could not complete)
 */

import 'dotenv/config';
import type { Incident, AgentResult, RemediationAction } from './lib/types.js';
import { login, releaseSessions, OpsApiClient, MAX_ENTITIES } from './lib/api-client.js';
import {
  readOpsState,
  readOpsStateSnapshot,
  writeOpsState,
  recordAgentRun,
  addRemediation,
  makeIncidentId,
  resolveNotReraisedForTypes,
} from './lib/state.js';
import { log } from './lib/alerting.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'fleet-manager';

/**
 * Every incident type this agent can raise — i.e. what a COMPLETE sweep is
 * entitled to resolve.
 *
 * ONE set, not a per-type table, for the same reason schedule-doctor uses one:
 * the four checks are not independently degradable. They read two lists fetched
 * by a single all-or-nothing `Promise.all`, and every per-display predicate
 * below (`minutesSinceLastSeen`, `isErrorState`, `isOnline`, playlist/schedule
 * membership) reads fields already in hand. So there is exactly one
 * completeness question — did this run see the whole tenant — and per-check
 * keys would be ceremony over a single boolean.
 *
 * `scan-truncated` is in the set on purpose. It is raised when the sweep could
 * NOT see everything, so a later complete sweep must be able to clear it;
 * leaving it out would recreate the never-clearing incident this change fixes.
 */
const RESOLVABLE_TYPES: ReadonlySet<string> = new Set([
  'display_offline',
  'display_offline_persistent',
  'display_error',
  'cluster_offline',
  'no_content',
  'scan-truncated',
]);

/** Minutes of silence before a display is considered offline */
const OFFLINE_THRESHOLD_MIN = 15;

/** Hours of silence before offline is considered persistent */
const PERSISTENT_THRESHOLD_HR = 1;

// ─── Types ───────────────────────────────────────────────────────────────────

interface DisplayItem {
  id: string;
  name?: string;
  status?: string;
  currentPlaylistId?: string;
  organizationId?: string;
  lastHeartbeat?: string;
  lastSeen?: string;
  error?: string;
  errorState?: string;
  /** Operator-disabled. Returned by the list API (display-response.select.ts). */
  isDisabled?: boolean;
}

interface ScheduleItem {
  id: string;
  displayId?: string;
  isActive?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate minutes since the most recent heartbeat/lastSeen timestamp.
 * Returns Infinity if no timestamp is available.
 */
function minutesSinceLastSeen(display: DisplayItem): number {
  const ts = display.lastHeartbeat || display.lastSeen;
  if (!ts) return Infinity;
  const parsed = new Date(ts).getTime();
  if (Number.isNaN(parsed)) return Infinity;
  return (Date.now() - parsed) / (1000 * 60);
}

/**
 * Check whether a display is in an error state.
 */
function isErrorState(display: DisplayItem): boolean {
  return (
    display.status === 'error' ||
    !!display.error ||
    !!display.errorState
  );
}

/**
 * Check whether a display is considered "online" (not offline, not error).
 */
function isOnline(display: DisplayItem): boolean {
  if (isErrorState(display)) return false;
  if (display.status === 'offline') return false;
  const mins = minutesSinceLastSeen(display);
  return mins < OFFLINE_THRESHOLD_MIN;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log(AGENT, 'Starting fleet check cycle');

  // ─── Auth ────────────────────────────────────────────────────────────────

  const baseUrl = process.env.VALIDATOR_BASE_URL || 'http://localhost:3000';
  const email = process.env.OPS_EMAIL || process.env.VALIDATOR_EMAIL || '';
  const password = process.env.OPS_PASSWORD || process.env.VALIDATOR_PASSWORD || '';

  if (!email || !password) {
    log(AGENT, 'FATAL: No credentials — set OPS_EMAIL/OPS_PASSWORD or VALIDATOR_EMAIL/VALIDATOR_PASSWORD');
    process.exitCode = 2;
    return;
  }

  let token: string;
  try {
    token = await login(baseUrl, email, password);
    log(AGENT, 'Authenticated successfully');
  } catch (err) {
    log(AGENT, `FATAL: Login failed — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  const api = new OpsApiClient(baseUrl, token, AGENT);

  // ─── Fetch data in parallel ──────────────────────────────────────────────

  let displays: DisplayItem[];
  let schedules: ScheduleItem[];
  let scanComplete: boolean;

  try {
    // getAllScan, not getAll: `getAll` is this same call with `.items` taken and
    // the `complete` verdict thrown away, and that verdict is exactly what gates
    // incident resolution below. It has to come from the fetch layer that
    // actually knows (server-reported `meta.total` where present) rather than
    // from a length comparison here.
    const [displayScan, scheduleScan] = await Promise.all([
      api.getAllScan<DisplayItem>('/displays'),
      api.getAllScan<ScheduleItem>('/schedules'),
    ]);
    displays = displayScan.items;
    schedules = scheduleScan.items;
    // Measured on the RAW scans, before the disabled-display filter below,
    // which only ever shortens the list.
    scanComplete = displayScan.complete && scheduleScan.complete;
    // Drop operator-disabled displays before ANY check runs.
    //
    // A disabled display is one an operator has deliberately taken out of
    // service; paging about it is noise by construction. Nothing here honoured
    // `isDisabled`, so every check below — offline, persistent-offline,
    // cluster-offline, no-content — fired on them forever. Measured on prod
    // 2026-08-02: five displays in an org named "E2E Test Org", last heartbeat
    // 149-157 days earlier, holding the whole system at CRITICAL, with the
    // cluster_offline incident alone re-attempted 10,373 times over 84 days.
    // Once ops alerts actually deliver, that is an hourly page about test
    // fixtures — which is how operators learn to ignore alerts.
    const disabled = displays.filter(d => d.isDisabled === true);
    if (disabled.length > 0) {
      displays = displays.filter(d => d.isDisabled !== true);
      log(AGENT, `Skipping ${disabled.length} operator-disabled display(s)`);
    }
    log(AGENT, `Fetched ${displays.length} displays, ${schedules.length} schedules`);
  } catch (err) {
    log(AGENT, `FATAL: Could not fetch data — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  // NOTE: there is deliberately no `if (displays.length === 0) return` here.
  //
  // There used to be, and it was a latent trap: returning early skipped
  // `recordAgentRun()` at the end of main(), so the agent never stamped its
  // `lastRun`. ops-watchdog reads exactly that timestamp, so a run that
  // legitimately had nothing to do was indistinguishable from an agent that had
  // died — it raised a CRITICAL `agent-silent` incident for fleet-manager on
  // 2026-08-02, minutes after the disabled-display filter first made the count
  // zero. The branch had been unreachable until then.
  //
  // Every check below iterates `displays`, so all of them no-op on an empty
  // array. Falling through costs nothing and keeps the run recorded. "Nothing
  // to do" must still report as a successful run.

  // Build lookup: displayId → has active schedule
  const displaysWithSchedule = new Set(
    schedules
      .filter(s => s.isActive !== false && s.displayId)
      .map(s => s.displayId!),
  );

  // Lock-free snapshot for dedup lookups (existing-incident attempt counts +
  // detected timestamps) during the detection phase below, which does network
  // I/O. The real locked read→merge→write happens at the very end, with no I/O
  // under the lock. See scripts/ops/lib/state.ts.
  const priorState = readOpsStateSnapshot();
  const incidents: Incident[] = [];
  const remediations: RemediationAction[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;
  let issuesEscalated = 0;

  // ─── Check 0: Scan Completeness ────────────────────────────────────────

  // Truncation is announced, never silent. Withholding resolution quietly would
  // drop a legitimately-large tenant into a permanent no-resolution regime with
  // no signal saying why — the same shape of invisible failure this change
  // exists to remove.
  //
  // INFO, and deliberately NOT counted in `issuesFound`. Only a code change can
  // clear it, so counting it would pin a large tenant at exit 1 / DEGRADED on
  // every run forever — the alert-fatigue pattern the db-maintenance exit-code
  // rule exists to prevent. The finding is still recorded and still visible; it
  // just stops masquerading as a failed run.
  if (!scanComplete) {
    log(
      AGENT,
      `Display scan was incomplete (displays=${displays.length}, ` +
      `schedules=${schedules.length}, cap=${MAX_ENTITIES}) — no incident will be ` +
      'resolved this run',
    );
    incidents.push({
      id: makeIncidentId(AGENT, 'scan-truncated', 'entity-lists'),
      agent: AGENT,
      type: 'scan-truncated',
      severity: 'info',
      target: 'display',
      targetId: 'entity-lists',
      detected: new Date().toISOString(),
      message:
        `Fleet check could not see the whole tenant (displays=${displays.length}, ` +
        `schedules=${schedules.length}, page-walk cap ${MAX_ENTITIES}). No prior incident ` +
        'can be cleared from a partial scan. Note that `cluster_offline` asserts a negative ' +
        'about a whole org, so a finding of that type from this run rests on a partial view.',
      // Deliberately NOT "raise the page-walk cap" — that fix re-arms the
      // identical defect at the new number and is the instruction the
      // content-lifecycle truncation work explicitly rejected.
      remediation:
        'No action needed for correctness — resolution is already withheld. The durable fix ' +
        'is a server-side fleet-health query that removes the pagination surface instead of ' +
        'moving it. Do NOT raise the page-walk cap.',
      status: 'open',
      attempts: 0,
    });
  }

  // ─── Check 1: Offline displays ─────────────────────────────────────────

  log(AGENT, 'Checking for offline displays');

  for (const display of displays) {
    const mins = minutesSinceLastSeen(display);
    const label = display.name || display.id;

    if (mins < OFFLINE_THRESHOLD_MIN) continue; // Online — skip

    const persistentThresholdMin = PERSISTENT_THRESHOLD_HR * 60;

    if (mins >= persistentThresholdMin) {
      // Persistent offline (>1hr) — escalate
      issuesFound++;
      const incidentId = makeIncidentId(AGENT, 'display_offline_persistent', display.id);
      const existing = priorState.incidents.find(i => i.id === incidentId);

      if (existing?.status === 'escalated') {
        incidents.push(existing);
        issuesEscalated++;
        continue;
      }

      log(AGENT, `${label}: offline for ${Math.round(mins)}min (persistent) — escalating`);
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'display_offline_persistent',
        severity: 'critical',
        target: 'display',
        targetId: display.id,
        detected: existing?.detected ?? new Date().toISOString(),
        message: `Display "${label}" has been offline for ${Math.round(mins)} minutes`,
        remediation: 'Manual investigation required — display unresponsive for over 1 hour',
        status: 'escalated',
        attempts: (existing?.attempts ?? 0) + 1,
      });
      issuesEscalated++;
    } else {
      // Recent offline (15min–1hr) — attempt ping/reconnect
      issuesFound++;
      const incidentId = makeIncidentId(AGENT, 'display_offline', display.id);
      const existing = priorState.incidents.find(i => i.id === incidentId);

      log(AGENT, `${label}: offline for ${Math.round(mins)}min — attempting ping`);

      let pingSuccess = false;
      try {
        await api.post('/displays/ping', { displayId: display.id }, {
          target: 'display',
          targetId: display.id,
          action: `Ping display "${label}" to trigger reconnect`,
          before: { lastSeen: display.lastHeartbeat || display.lastSeen, minutesOffline: Math.round(mins) },
        });
        pingSuccess = true;
        log(AGENT, `${label}: ping sent successfully`);
      } catch (err) {
        log(AGENT, `${label}: ping failed — ${err instanceof Error ? err.message : err}`);
      }

      if (pingSuccess) {
        incidents.push({
          id: incidentId,
          agent: AGENT,
          type: 'display_offline',
          severity: 'warning',
          target: 'display',
          targetId: display.id,
          detected: existing?.detected ?? new Date().toISOString(),
          message: `Display "${label}" offline for ${Math.round(mins)}min — ping sent, awaiting reconnect`,
          remediation: 'POST /displays/ping — reconnect attempt',
          status: 'open',
          attempts: (existing?.attempts ?? 0) + 1,
        });
        // Note: not counted as issuesFixed — ping was sent but display hasn't reconnected yet
      } else {
        incidents.push({
          id: incidentId,
          agent: AGENT,
          type: 'display_offline',
          severity: 'warning',
          target: 'display',
          targetId: display.id,
          detected: existing?.detected ?? new Date().toISOString(),
          message: `Display "${label}" offline for ${Math.round(mins)}min — ping failed`,
          remediation: 'POST /displays/ping failed — manual check required',
          status: 'open',
          attempts: (existing?.attempts ?? 0) + 1,
          error: 'Ping request failed',
        });
      }
    }
  }

  // ─── Check 2: Error state displays ─────────────────────────────────────

  log(AGENT, 'Checking for error-state displays');

  for (const display of displays) {
    if (!isErrorState(display)) continue;

    const label = display.name || display.id;
    const incidentId = makeIncidentId(AGENT, 'display_error', display.id);
    const existing = priorState.incidents.find(i => i.id === incidentId);

    issuesFound++;
    log(AGENT, `${label}: in error state (status=${display.status}, error=${display.error || display.errorState || 'none'}) — resetting to inactive`);

    let resetSuccess = false;
    try {
      await api.patch(`/displays/${display.id}`, { status: 'inactive' }, {
        target: 'display',
        targetId: display.id,
        action: `Reset error-state display "${label}" to inactive`,
        before: { status: display.status, error: display.error, errorState: display.errorState },
      });
      resetSuccess = true;
      log(AGENT, `${label}: reset to inactive successfully`);
    } catch (err) {
      log(AGENT, `${label}: reset failed — ${err instanceof Error ? err.message : err}`);
    }

    if (resetSuccess) {
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'display_error',
        severity: 'warning',
        target: 'display',
        targetId: display.id,
        detected: existing?.detected ?? new Date().toISOString(),
        message: `Display "${label}" was in error state — reset to inactive`,
        remediation: 'PATCH /displays/:id → { status: "inactive" }',
        status: 'resolved',
        attempts: (existing?.attempts ?? 0) + 1,
        resolvedAt: new Date().toISOString(),
      });
      issuesFixed++;
    } else {
      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'display_error',
        severity: 'warning',
        target: 'display',
        targetId: display.id,
        detected: existing?.detected ?? new Date().toISOString(),
        message: `Display "${label}" is in error state — reset attempt failed`,
        remediation: 'PATCH /displays/:id failed — manual reset required',
        status: 'open',
        attempts: (existing?.attempts ?? 0) + 1,
        error: 'PATCH reset failed',
      });
    }
  }

  // ─── Check 3: Cluster offline ──────────────────────────────────────────

  log(AGENT, 'Checking for cluster-wide outages');

  // Group displays by organizationId
  const orgDisplays = new Map<string, DisplayItem[]>();
  for (const display of displays) {
    const orgId = display.organizationId;
    if (!orgId) continue;
    const list = orgDisplays.get(orgId) ?? [];
    list.push(display);
    orgDisplays.set(orgId, list);
  }

  for (const [orgId, orgList] of orgDisplays) {
    // Only check orgs with 3+ displays
    if (orgList.length < 3) continue;

    const allOffline = orgList.every(d => minutesSinceLastSeen(d) >= OFFLINE_THRESHOLD_MIN);
    if (!allOffline) continue;

    const incidentId = makeIncidentId(AGENT, 'cluster_offline', orgId);
    const existing = priorState.incidents.find(i => i.id === incidentId);

    issuesFound++;
    issuesEscalated++;
    log(AGENT, `Cluster outage: ALL ${orgList.length} displays in org ${orgId} are offline — critical`);

    incidents.push({
      id: incidentId,
      agent: AGENT,
      type: 'cluster_offline',
      severity: 'critical',
      target: 'organization',
      targetId: orgId,
      detected: existing?.detected ?? new Date().toISOString(),
      message: `All ${orgList.length} displays in organization ${orgId} are offline — possible network/infrastructure issue`,
      remediation: 'Manual investigation required — entire org fleet is unreachable',
      status: existing?.status === 'escalated' ? 'escalated' : 'open',
      attempts: (existing?.attempts ?? 0) + 1,
    });
  }

  // ─── Check 4: No content ──────────────────────────────────────────────

  log(AGENT, 'Checking for online displays with no content');

  for (const display of displays) {
    if (!isOnline(display)) continue;

    const hasPlaylist = !!display.currentPlaylistId;
    const hasSchedule = displaysWithSchedule.has(display.id);

    if (hasPlaylist || hasSchedule) continue;

    const label = display.name || display.id;
    const incidentId = makeIncidentId(AGENT, 'no_content', display.id);
    const existing = priorState.incidents.find(i => i.id === incidentId);

    issuesFound++;
    log(AGENT, `${label}: online but has no playlist and no active schedule`);

    incidents.push({
      id: incidentId,
      agent: AGENT,
      type: 'no_content',
      severity: 'warning',
      target: 'display',
      targetId: display.id,
      detected: existing?.detected ?? new Date().toISOString(),
      message: `Display "${label}" is online but has no playlist assigned and no active schedule`,
      remediation: 'Assign a playlist or schedule to the display via the dashboard',
      status: 'open',
      attempts: 0,
    });
  }

  // ─── Resolve stale incidents ───────────────────────────────────────────

  // If a display was previously offline but is now back, resolve the incident.
  //
  // A partial scan resolves NOTHING: a display the walk never retrieved was
  // never examined, so it cannot be evidence that its own incident cleared.
  // The complementary partial-run case — a failed fetch — early-returns above
  // without writing state or stamping `lastRun` at all, so ops-watchdog's SLA
  // sees the gap. Truncation is the case that guard does not cover: the fetch
  // SUCCEEDS and simply stops short.
  //
  // There is deliberately no per-ITEM unexamined set here, unlike
  // content-lifecycle: every predicate this agent tests reads fields already
  // present on the fetched display, so no display can be skipped mid-run
  // without a verdict. A failed ping or a failed error-state PATCH is a failed
  // REMEDIATION — the incident is still raised, so the id is in
  // `currentIncidentIds` and nothing can clear it. The one display the run
  // drops on purpose, `isDisabled`, is an evidence-BEARING skip: the operator
  // took it out of service, and its incidents SHOULD clear (#259).
  if (scanComplete) {
    const currentIncidentIds = new Set(incidents.map(i => i.id));

    for (const resolved of resolveNotReraisedForTypes(
      priorState.incidents,
      AGENT,
      currentIncidentIds,
      RESOLVABLE_TYPES,
    )) {
      // Not re-raised this run — the issue is gone. This must sweep `escalated`
      // as well as `open`: display_offline_persistent is RAISED as escalated, so
      // an `open`-only guard could never clear the very incident this agent
      // escalates, and systemStatus stayed CRITICAL after the screen came back.
      log(AGENT, `Resolving stale incident: ${resolved.id}`);
      incidents.push(resolved);
      issuesFixed++;
    }
  }

  // ─── Record Results & Write State ──────────────────────────────────────

  const durationMs = Date.now() - startTime;

  const result: AgentResult = {
    agent: AGENT,
    timestamp: new Date().toISOString(),
    durationMs,
    issuesFound,
    issuesFixed,
    issuesEscalated,
    incidents,
  };

  // Brief locked read→merge→write with no I/O in between. recordAgentRun
  // upserts our incidents by id, so any concurrent updates from other agents
  // (their incident ids are namespaced by agent) are preserved.
  const state = readOpsState();
  try {
    recordAgentRun(state, result);

    // Add API client audit log entries as remediations
    for (const r of api.auditLog) {
      addRemediation(state, r);
    }
    for (const r of remediations) {
      addRemediation(state, r);
    }
  } finally {
    writeOpsState(state);
  }

  // ─── Summary ───────────────────────────────────────────────────────────

  log(AGENT, `Cycle complete in ${durationMs}ms — found: ${issuesFound}, fixed: ${issuesFixed}, escalated: ${issuesEscalated}`);

  if (issuesFound > 0 && issuesFixed < issuesFound) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

main()
  .catch(err => {
    log(AGENT, `FATAL: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
  })
  // Release the refresh-token session this run opened. Awaited from the chain
  // so it completes before the process exits; `beforeExit` was not reliable.
  .finally(() => releaseSessions());
