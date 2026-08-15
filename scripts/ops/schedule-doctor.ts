#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — Schedule Doctor Agent
 *
 * Runs every 15 minutes via PM2 cron. Audits schedules for staleness,
 * orphaned references, empty playlists, and coverage gaps. Auto-remediates
 * past-end and orphan schedules by deactivating them.
 *
 * Checks:
 *   1. Past-end schedules — active schedules whose endDate has passed
 *   2. Orphan schedules — reference a displayId that no longer exists
 *   3. Empty playlist schedules — active schedule pointing to an empty playlist
 *   4. Coverage gaps — displays with no playlist and no active schedule
 *
 * Incident clearing: a run that saw the WHOLE tenant resolves any prior
 * incident of this agent's it did not re-raise. `empty_playlist_schedule` and
 * `coverage_gap` are raised with no auto-fix, so before this existed they could
 * never leave `open` — an operator who assigned the missing playlist watched
 * the incident sit there pinning ops-state at DEGRADED forever. A run that did
 * NOT see the whole tenant resolves nothing and says so via `scan-truncated`.
 *
 * Exit codes:
 *   0 — all schedules healthy
 *   1 — issues found (some may have been auto-fixed)
 *   2 — fatal error (agent could not complete)
 *
 * The exit code is computed from DETECTION only — resolving stale incidents can
 * never turn a run with an open finding green.
 */

import 'dotenv/config';
import type { Incident, AgentResult, RemediationAction } from './lib/types.js';
import { login, releaseSessions, OpsApiClient, MAX_ENTITIES } from './lib/api-client.js';
import {
  readOpsState,
  writeOpsState,
  recordAgentRun,
  addRemediation,
  makeIncidentId,
  resolveNotReraisedForTypes,
} from './lib/state.js';
import { log, sendInlineAlert } from './lib/alerting.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'schedule-doctor';

/**
 * Every incident type this agent can raise — i.e. what a COMPLETE sweep is
 * entitled to resolve.
 *
 * ONE set, not a per-type table, because the four checks are not independently
 * degradable. They read three lists fetched by a single all-or-nothing
 * `Promise.all`: either all three arrive and all four checks run over the full
 * data, or the fetch throws and the run early-returns having done nothing. So
 * there is exactly one completeness question — did this run see the whole
 * tenant — and per-type keys would be ceremony over a single boolean.
 *
 * `scan-truncated` is in the set on purpose. It is raised when the sweep could
 * NOT see everything, so a later complete sweep must be able to clear it;
 * leaving it out would recreate the never-clearing incident this change fixes.
 */
const RESOLVABLE_TYPES: ReadonlySet<string> = new Set([
  'past_end_schedule',
  'orphan_schedule',
  'empty_playlist_schedule',
  'coverage_gap',
  'scan-truncated',
]);

// ─── Domain Types ────────────────────────────────────────────────────────────

interface ScheduleItem {
  id: string;
  name?: string;
  displayId?: string;
  displayGroupId?: string;
  playlistId?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}

interface DisplayItem {
  id: string;
  name?: string;
  currentPlaylistId?: string;
}

interface Playlist {
  id: string;
  name?: string;
  items?: { contentId: string }[];
  _count?: { items: number };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log(AGENT, 'Starting schedule audit cycle');

  // ─── Auth ──────────────────────────────────────────────────────────────────

  const baseUrl = process.env.VALIDATOR_BASE_URL || 'http://localhost:3000';
  const email = process.env.OPS_EMAIL || process.env.VALIDATOR_EMAIL || '';
  const password = process.env.OPS_PASSWORD || process.env.VALIDATOR_PASSWORD || '';

  if (!email || !password) {
    log(AGENT, 'FATAL: OPS_EMAIL / OPS_PASSWORD not set');
    process.exitCode = 2;
    return;
  }

  let token: string;
  try {
    token = await login(baseUrl, email, password);
    log(AGENT, 'Authenticated successfully');
  } catch (err) {
    log(AGENT, `FATAL: login failed — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  const api = new OpsApiClient(baseUrl, token, AGENT);

  // ─── Fetch Data (parallel) ─────────────────────────────────────────────────

  log(AGENT, 'Fetching schedules, displays, and playlists');

  let schedules: ScheduleItem[];
  let displays: DisplayItem[];
  let playlists: Playlist[];
  let scanComplete: boolean;

  try {
    // getAllScan, not getAll: the completeness verdict is what gates incident
    // resolution below, and it must come from the fetch layer that actually
    // knows (server-reported `meta.total` where present) rather than from a
    // length comparison here. An unrecognized response shape now THROWS into
    // this catch instead of yielding a silent empty list.
    const [scheduleScan, displayScan, playlistScan] = await Promise.all([
      api.getAllScan<ScheduleItem>('/schedules'),
      api.getAllScan<DisplayItem>('/displays'),
      api.getAllScan<Playlist>('/playlists'),
    ]);
    schedules = scheduleScan.items;
    displays = displayScan.items;
    playlists = playlistScan.items;
    // Measured on the RAW scans, before the disabled-display filter below,
    // which only ever shortens the list.
    scanComplete = scheduleScan.complete && displayScan.complete && playlistScan.complete;
  } catch (err) {
    log(AGENT, `FATAL: failed to fetch data — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  // Same rule as fleet-manager: an operator-disabled display must not raise
  // incidents. #259 filtered fleet-manager only, so schedule-doctor kept
  // re-raising coverage_gap for a disabled fixture — caught by the natural
  // cycle on 2026-08-02 22:30, which put the incident straight back.
  const disabledDisplays = displays.filter(d => (d as { isDisabled?: boolean }).isDisabled === true);
  if (disabledDisplays.length > 0) {
    displays = displays.filter(d => (d as { isDisabled?: boolean }).isDisabled !== true);
    log(AGENT, `Skipping ${disabledDisplays.length} operator-disabled display(s)`);
  }
  log(AGENT, `Fetched ${schedules.length} schedules, ${displays.length} displays, ${playlists.length} playlists`);

  // State is read at the very END (after all detection I/O), so the file lock
  // is held only for the brief read→merge→write below — not across the
  // api.patch / sendInlineAlert calls in the checks. This agent does no
  // existing-incident dedup during detection, so no snapshot read is needed.
  const incidents: Incident[] = [];
  const remediations: RemediationAction[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;
  let issuesEscalated = 0;

  // Build lookup sets
  const displayIds = new Set(displays.map(d => d.id));
  const playlistMap = new Map(playlists.map(p => [p.id, p]));
  const now = new Date();

  // ─── Check 0: Scan Completeness ────────────────────────────────────────────

  // Truncation is announced, never silent. Skipping resolution quietly would
  // put a legitimately-large tenant into a permanent no-resolution regime —
  // incidents accumulating forever with no signal saying why — which is the
  // same shape of invisible failure this whole change exists to remove.
  //
  // INFO, and deliberately NOT counted in `issuesFound`. Only a code change
  // (raising the cap, or scoping the queries) can clear this, so a tenant that
  // legitimately exceeds the cap would otherwise sit at exit 1 / DEGRADED and
  // alert on every single run, forever — precisely the alert-fatigue pattern
  // the db-maintenance exit-code rule exists to prevent. The finding is still
  // recorded and still visible; it just stops masquerading as a failed run.
  if (!scanComplete) {
    log(
      AGENT,
      `Entity scan was incomplete ` +
      `(schedules=${schedules.length}, displays=${displays.length}, playlists=${playlists.length}, ` +
      `cap=${MAX_ENTITIES}) — no incident will be resolved this run`,
    );
    incidents.push({
      id: makeIncidentId(AGENT, 'scan-truncated', 'entity-lists'),
      agent: AGENT,
      type: 'scan-truncated',
      severity: 'info',
      target: 'schedules',
      targetId: 'entity-lists',
      detected: new Date().toISOString(),
      message:
        `Schedule audit could not see the whole tenant (schedules=${schedules.length}, ` +
        `displays=${displays.length}, playlists=${playlists.length}, page-walk cap ${MAX_ENTITIES}). ` +
        'Findings are still valid, but no prior incident can be cleared from a partial scan.',
      remediation: `Raise the getAll page-walk cap in scripts/ops/lib/api-client.ts, or scope this agent's queries.`,
      status: 'open',
      attempts: 0,
    });
  }

  // ─── Check 1: Past-end Schedules ───────────────────────────────────────────

  for (const sched of schedules) {
    if (!sched.isActive || !sched.endDate) continue;

    const endDate = new Date(sched.endDate);
    if (isNaN(endDate.getTime())) continue; // malformed date, skip

    if (endDate >= now) continue; // still valid

    issuesFound++;
    const incidentId = makeIncidentId(AGENT, 'past_end_schedule', sched.id);
    const label = sched.name || sched.id;
    log(AGENT, `Past-end schedule: "${label}" ended ${sched.endDate}`);

    // Auto-fix: deactivate
    let fixed = false;
    try {
      await api.patch(`/schedules/${sched.id}`, { isActive: false }, {
        target: 'schedule',
        targetId: sched.id,
        action: `Deactivate past-end schedule "${label}"`,
        before: { isActive: true, endDate: sched.endDate },
      });
      fixed = true;
      issuesFixed++;
      log(AGENT, `  -> Deactivated "${label}"`);
      // §12b: write-site alert. The operator set isActive=true; we just
      // flipped it to false. Tell them immediately rather than waiting
      // for the next ops-reporter aggregate cycle.
      await sendInlineAlert(
        AGENT,
        'warning',
        `Auto-deactivated past-end schedule "${label}"`,
        `Schedule id ${sched.id} had endDate=${sched.endDate} (in the past) but isActive=true. Deactivated automatically. If the endDate was meant to be in the future, re-activate and correct the date.`,
      );
    } catch (err) {
      log(AGENT, `  -> Failed to deactivate "${label}": ${err instanceof Error ? err.message : err}`);
    }

    incidents.push({
      id: incidentId,
      agent: AGENT,
      type: 'past_end_schedule',
      severity: 'warning',
      target: 'schedule',
      targetId: sched.id,
      detected: new Date().toISOString(),
      message: `Schedule "${label}" is active but ended ${sched.endDate}`,
      remediation: `PATCH /schedules/${sched.id} { isActive: false }`,
      status: fixed ? 'resolved' : 'open',
      attempts: 1,
      ...(fixed ? { resolvedAt: new Date().toISOString() } : {}),
      ...(!fixed ? { error: 'PATCH failed' } : {}),
    });
  }

  // ─── Check 2: Orphan Schedules ─────────────────────────────────────────────

  for (const sched of schedules) {
    if (!sched.isActive) continue;
    if (!sched.displayId) continue; // group-level schedules don't reference a single display

    if (displayIds.has(sched.displayId)) continue; // display exists

    issuesFound++;
    const incidentId = makeIncidentId(AGENT, 'orphan_schedule', sched.id);
    const label = sched.name || sched.id;
    log(AGENT, `Orphan schedule: "${label}" references missing display ${sched.displayId}`);

    // Auto-fix: deactivate
    let fixed = false;
    try {
      await api.patch(`/schedules/${sched.id}`, { isActive: false }, {
        target: 'schedule',
        targetId: sched.id,
        action: `Deactivate orphan schedule "${label}" (display ${sched.displayId} missing)`,
        before: { isActive: true, displayId: sched.displayId },
      });
      fixed = true;
      issuesFixed++;
      log(AGENT, `  -> Deactivated "${label}"`);
      // §12b: write-site alert. Orphan deactivation is more severe than
      // past-end because it indicates the operator deleted a device but
      // left a schedule pointing at it — likely a config inconsistency
      // they should know about right now, not in 30 min.
      await sendInlineAlert(
        AGENT,
        'critical',
        `Auto-deactivated orphan schedule "${label}"`,
        `Schedule id ${sched.id} referenced display ${sched.displayId}, which no longer exists. Deactivated automatically. Investigate whether the schedule should be reassigned or deleted.`,
      );
    } catch (err) {
      log(AGENT, `  -> Failed to deactivate "${label}": ${err instanceof Error ? err.message : err}`);
    }

    incidents.push({
      id: incidentId,
      agent: AGENT,
      type: 'orphan_schedule',
      severity: 'critical',
      target: 'schedule',
      targetId: sched.id,
      detected: new Date().toISOString(),
      message: `Schedule "${label}" targets nonexistent display ${sched.displayId}`,
      remediation: `PATCH /schedules/${sched.id} { isActive: false }`,
      status: fixed ? 'resolved' : 'open',
      attempts: 1,
      ...(fixed ? { resolvedAt: new Date().toISOString() } : {}),
      ...(!fixed ? { error: 'PATCH failed' } : {}),
    });
  }

  // ─── Check 3: Empty Playlist Schedules ─────────────────────────────────────

  for (const sched of schedules) {
    if (!sched.isActive || !sched.playlistId) continue;

    const playlist = playlistMap.get(sched.playlistId);
    if (!playlist) continue; // playlist not found — separate concern

    // Determine item count from _count or items array
    const itemCount = playlist._count?.items ?? playlist.items?.length ?? -1;
    if (itemCount !== 0) continue; // has items or unknown count

    issuesFound++;
    const incidentId = makeIncidentId(AGENT, 'empty_playlist_schedule', sched.id);
    const schedLabel = sched.name || sched.id;
    const playlistLabel = playlist.name || playlist.id;
    log(AGENT, `Empty playlist schedule: "${schedLabel}" references empty playlist "${playlistLabel}"`);

    // No auto-fix — log as warning only
    incidents.push({
      id: incidentId,
      agent: AGENT,
      type: 'empty_playlist_schedule',
      severity: 'warning',
      target: 'schedule',
      targetId: sched.id,
      detected: new Date().toISOString(),
      message: `Active schedule "${schedLabel}" references playlist "${playlistLabel}" with 0 items`,
      remediation: 'Manual: add content to playlist or reassign schedule',
      status: 'open',
      attempts: 0,
    });
  }

  // ─── Check 4: Coverage Gaps ────────────────────────────────────────────────

  // Build set of display IDs that have at least one active schedule
  const scheduledDisplayIds = new Set<string>();
  for (const sched of schedules) {
    if (sched.isActive && sched.displayId) {
      scheduledDisplayIds.add(sched.displayId);
    }
  }

  for (const display of displays) {
    // Skip if display has a current playlist assigned
    if (display.currentPlaylistId) continue;
    // Skip if display has an active schedule
    if (scheduledDisplayIds.has(display.id)) continue;

    issuesFound++;
    const incidentId = makeIncidentId(AGENT, 'coverage_gap', display.id);
    const label = display.name || display.id;
    log(AGENT, `Coverage gap: display "${label}" has no playlist and no active schedule`);

    // No auto-fix — log as warning only
    incidents.push({
      id: incidentId,
      agent: AGENT,
      type: 'coverage_gap',
      severity: 'warning',
      target: 'display',
      targetId: display.id,
      detected: new Date().toISOString(),
      message: `Display "${label}" has no currentPlaylistId and no active schedule — screen may be blank`,
      remediation: 'Manual: assign a playlist or create a schedule for this display',
      status: 'open',
      attempts: 0,
    });
  }

  // ─── Record Results & Write State ──────────────────────────────────────────

  // Collect audit log from API client
  for (const r of api.auditLog) {
    remediations.push(r);
  }

  const durationMs = Date.now() - startTime;

  // Pin the exit code to what DETECTION found, before resolutions inflate
  // `issuesFixed`. A run that clears five stale incidents while still holding
  // one open coverage_gap is a failing run; letting resolutions count toward
  // the fixed tally would turn it green.
  const detectionExitCode = issuesFound > 0 && issuesFixed < issuesFound ? 1 : 0;

  const result: AgentResult = {
    agent: AGENT,
    timestamp: new Date().toISOString(),
    durationMs,
    issuesFound,
    issuesFixed,
    issuesEscalated,
    incidents,
  };

  // Brief locked read→merge→write with no I/O in between. The resolution sweep
  // below is pure computation over `state.incidents` — no network, no
  // subprocess — so it is safe to hold the lock across it, and it has to be
  // here because the prior incidents are only readable under the lock. This
  // agent consults no prior incidents during detection, so nothing else needs
  // a snapshot read.
  const state = readOpsState();
  try {
    // A partial scan resolves NOTHING: an entity the sweep never examined is
    // not evidence that its incident cleared. The complementary partial-run
    // case — a failed fetch — early-returns above without writing state or
    // stamping lastRun at all, so ops-watchdog's 45-minute SLA sees the gap.
    if (scanComplete) {
      const currentIncidentIds = new Set(incidents.map(i => i.id));
      const resolved = resolveNotReraisedForTypes(
        state.incidents,
        AGENT,
        currentIncidentIds,
        RESOLVABLE_TYPES,
      );
      for (const r of resolved) {
        log(AGENT, `Resolving stale incident: ${r.id}`);
        incidents.push(r);
      }
      issuesFixed += resolved.length;
      result.issuesFixed = issuesFixed;
    }

    recordAgentRun(state, result);

    for (const r of remediations) {
      addRemediation(state, r);
    }
  } finally {
    writeOpsState(state);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  log(AGENT, `Cycle complete in ${durationMs}ms — found: ${issuesFound}, fixed: ${issuesFixed}, escalated: ${issuesEscalated}`);

  process.exitCode = detectionExitCode;
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
