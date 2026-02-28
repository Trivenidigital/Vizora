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
 * Exit codes:
 *   0 — all schedules healthy
 *   1 — issues found (some may have been auto-fixed)
 *   2 — fatal error (agent could not complete)
 */

import 'dotenv/config';
import type { Incident, AgentResult, RemediationAction } from './lib/types.js';
import { login, OpsApiClient } from './lib/api-client.js';
import {
  readOpsState,
  writeOpsState,
  recordAgentRun,
  addRemediation,
  makeIncidentId,
} from './lib/state.js';
import { log } from './lib/alerting.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'schedule-doctor';

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

  try {
    [schedules, displays, playlists] = await Promise.all([
      api.getAll<ScheduleItem>('/schedules'),
      api.getAll<DisplayItem>('/displays'),
      api.getAll<Playlist>('/playlists'),
    ]);
  } catch (err) {
    log(AGENT, `FATAL: failed to fetch data — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  log(AGENT, `Fetched ${schedules.length} schedules, ${displays.length} displays, ${playlists.length} playlists`);

  const state = readOpsState();
  const incidents: Incident[] = [];
  const remediations: RemediationAction[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;
  let issuesEscalated = 0;

  // Build lookup sets
  const displayIds = new Set(displays.map(d => d.id));
  const playlistMap = new Map(playlists.map(p => [p.id, p]));
  const now = new Date();

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

  const result: AgentResult = {
    agent: AGENT,
    timestamp: new Date().toISOString(),
    durationMs,
    issuesFound,
    issuesFixed,
    issuesEscalated,
    incidents,
  };

  recordAgentRun(state, result);

  for (const r of remediations) {
    addRemediation(state, r);
  }

  writeOpsState(state);

  // ─── Summary ───────────────────────────────────────────────────────────────

  log(AGENT, `Cycle complete in ${durationMs}ms — found: ${issuesFound}, fixed: ${issuesFixed}, escalated: ${issuesEscalated}`);

  if (issuesFound > 0 && issuesFixed < issuesFound) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

main().catch(err => {
  log(AGENT, `FATAL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 2;
});
