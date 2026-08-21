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
 * Clearing is ALSO per-ITEM, not just per-run (K24). `scanComplete` answers
 * "did this run RETRIEVE every entity"; it cannot answer "did this run reach a
 * VERDICT on this schedule". Two skips inside the checks reach none: an
 * `endDate` that will not parse (check 1) and a playlist whose item count
 * cannot be determined (check 3). Both `continue` without raising, so the
 * schedule looked recovered to the sweep and its prior incident cleared — for
 * want of a re-raise, off a check that never ran on it. Those ids are now
 * folded into `currentIncidentIds`, which holds the prior incident open
 * without fabricating a new one, and are counted and logged per run.
 *
 * The distinction is exact and load-bearing in BOTH directions. A skip that
 * carries evidence must keep resolving: `isActive === false`, an absent
 * `endDate`/`playlistId`, a `displayId` present in the fetched set, a
 * `playlistId` naming a playlist that (under a complete scan) does not exist,
 * an operator-disabled display (#259), and any successful evaluation that
 * simply found nothing wrong. Each of those is a real answer about the item.
 * Over-correcting into "any skip blocks resolution" would turn these types into
 * ones that only accumulate — the defect the sweep exists to fix.
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

/**
 * A playlist as it comes back from `GET /playlists`.
 *
 * `PlaylistsService.findAll` (middleware/src/modules/playlists/playlists.service.ts:112)
 * hydrates `items` in full (:122-145) and derives `itemCount` from it (:170).
 * It also returns a `_count` — but that is `_count: { select: { schedules: true } }`
 * (:146-150), so **`_count.items` is never sent**. This type declared it anyway
 * and read it FIRST: the same shape as the dead `expiresAt` filter in
 * content-lifecycle (K22) — a field typed on the consumer that the projection
 * does not carry, so the read is a permanent `undefined`. It was harmless only
 * because the next element of the chain was real.
 *
 * It is replaced by `itemCount`, which this endpoint genuinely sends and which
 * is the element most likely to SURVIVE a future slimming of this list —
 * dropping the heavy hydrated `items` array while keeping the cheap count is
 * the obvious optimization, and it is exactly what would make the count
 * unknown. The `-1` sentinel below is the guard for that day.
 */
interface Playlist {
  id: string;
  name?: string;
  items?: { contentId: string }[];
  /** Server-derived `items.length` — see the note above. */
  itemCount?: number;
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
  //
  // K28 FIX: build displayIds BEFORE filtering, so that Check 2 (orphan
  // schedules) can distinguish between "display deleted" (truly orphaned) and
  // "display disabled by operator" (not an orphan, don't auto-deactivate).
  const displayIds = new Set(displays.map(d => d.id));

  const disabledDisplays = displays.filter(d => (d as { isDisabled?: boolean }).isDisabled === true);
  if (disabledDisplays.length > 0) {
    displays = displays.filter(d => (d as { isDisabled?: boolean }).isDisabled !== true);
    log(AGENT, `Skipping ${disabledDisplays.length} operator-disabled display(s)`);
  }
  log(AGENT, `Fetched ${schedules.length} schedules, ${displays.length} displays (${displayIds.size} total), ${playlists.length} playlists`);

  // State is read at the very END (after all detection I/O), so the file lock
  // is held only for the brief read→merge→write below — not across the
  // api.patch / sendInlineAlert calls in the checks. This agent does no
  // existing-incident dedup during detection, so no snapshot read is needed.
  const incidents: Incident[] = [];
  const remediations: RemediationAction[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;
  let issuesEscalated = 0;

  // ── Per-ITEM blind spots (K24) ─────────────────────────────────────────────
  //
  // Schedules the checks below RETRIEVED but reached no verdict on. Both feed
  // the same place — `currentIncidentIds` at the resolution sweep — so a prior
  // incident of the matching type stays open rather than clearing for want of a
  // re-raise. They are kept apart only so the end-of-run log can say WHICH kind
  // of blind spot it was.
  //
  // Only evidence-FREE skips belong here. See the header docblock: an inactive
  // schedule, an absent endDate/playlistId, a resolvable displayId and a
  // nonexistent playlist are all real answers and must keep resolving.

  /** Check 1 could not parse `endDate`, so no past-end verdict exists. */
  const unexaminedPastEndScheduleIds = new Set<string>();
  /** Check 3 could not determine the playlist's item count. */
  const unexaminedEmptyPlaylistScheduleIds = new Set<string>();
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
    if (isNaN(endDate.getTime())) {
      // K24: an unparseable endDate is NOT "this schedule is fine". The
      // comparison that would have decided past-end never produced an answer,
      // so this run knows nothing about it — and a bare `continue` made that
      // ignorance read as recovery to the sweep below, clearing any prior
      // `past_end_schedule` for this id.
      unexaminedPastEndScheduleIds.add(sched.id);
      log(
        AGENT,
        `Skipping schedule ${sched.id}: endDate "${sched.endDate}" will not parse — ` +
          'no past_end_schedule verdict this run',
      );
      continue;
    }

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

    // Evidence-bearing: under a complete scan the playlist genuinely is not
    // there, which is a real answer to "does this schedule point at an EMPTY
    // playlist" — no. A different (uncovered) problem, so a prior
    // `empty_playlist_schedule` here must still clear.
    const playlist = playlistMap.get(sched.playlistId);
    if (!playlist) continue; // playlist not found — separate concern

    // `itemCount` first, then the hydrated array; `-1` means neither was sent.
    const itemCount = playlist.itemCount ?? playlist.items?.length ?? -1;
    if (itemCount < 0) {
      // K24: unknown is not "populated". Falling through the old
      // `itemCount !== 0` guard treated an undeterminable count exactly like a
      // playlist full of content — no incident raised, and the sweep below then
      // cleared any prior `empty_playlist_schedule` for this schedule because
      // nothing re-raised it. An item that could not be evaluated must not
      // clear its own finding.
      unexaminedEmptyPlaylistScheduleIds.add(sched.id);
      log(
        AGENT,
        `Skipping schedule ${sched.id}: playlist ${sched.playlistId} carried neither ` +
          'itemCount nor items — no empty_playlist_schedule verdict this run',
      );
      continue;
    }
    if (itemCount !== 0) continue; // playlist has content

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

  // ── K24: schedules this run reached no verdict on count as re-raised ───────
  //
  // Adding the id is the whole fix. `currentIncidentIds` feeds exactly one
  // predicate in `resolveNotReraisedForTypes` (`!has(i.id)`), so an id with no
  // matching prior incident is inert — nothing is fabricated, no new incident
  // is raised, and the id simply withholds one resolution if one was pending.
  const unexaminedIncidentIds = new Set<string>();
  for (const id of unexaminedPastEndScheduleIds) {
    unexaminedIncidentIds.add(makeIncidentId(AGENT, 'past_end_schedule', id));
  }
  for (const id of unexaminedEmptyPlaylistScheduleIds) {
    unexaminedIncidentIds.add(makeIncidentId(AGENT, 'empty_playlist_schedule', id));
  }

  // §12a: a silent skip is a future silent failure. Counted and logged rather
  // than raised as an incident type of its own — the run is not unhealthy, it
  // is partially blind, and a per-run incident here would be the alert-fatigue
  // trap that made `scan-truncated` info-severity and excluded from
  // `issuesFound`. Same call K25 made for the orphan-candidate blind spots.
  if (unexaminedIncidentIds.size > 0) {
    log(
      AGENT,
      `${unexaminedIncidentIds.size} schedule verdict(s) skipped WITHOUT EVIDENCE ` +
        `(unparseable endDate: ${unexaminedPastEndScheduleIds.size}, unknown playlist item ` +
        `count: ${unexaminedEmptyPlaylistScheduleIds.size}) — their prior incidents stay open`,
    );
  }

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
      for (const id of unexaminedIncidentIds) currentIncidentIds.add(id);
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
