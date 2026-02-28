#!/usr/bin/env npx tsx
/**
 * 04 — Schedule Validator
 *
 * Rules: S-001 to S-008
 *
 * Usage: npx tsx 04-schedule-validator.ts --base-url http://localhost:3000 --token JWT
 * Exit: 0 = no criticals, 1 = has criticals, 2 = error
 */

import {
  parseArgs, VizoraApiClient, outputJson, fail, makeResult,
  type ValidationIssue,
} from './lib.js';

interface Schedule {
  id: string;
  name?: string;
  displayId?: string;
  displayGroupId?: string;
  playlistId?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[] | string[];
  priority?: number;
  recurrence?: string;
}

interface Display {
  id: string;
  name?: string;
  currentPlaylistId?: string;
}

interface DisplayGroup {
  id: string;
  name?: string;
}

interface Playlist {
  id: string;
  name?: string;
  _count?: { items: number };
  items?: unknown[];
}

async function main() {
  const args = parseArgs();
  if (!args.token) fail('--token is required for schedule validation');

  const api = new VizoraApiClient(args.baseUrl, args.token);
  const issues: ValidationIssue[] = [];
  const startTime = Date.now();

  // Fetch all data
  const [schedules, displays, playlists] = await Promise.all([
    api.getAll<Schedule>('/schedules', {}, args.limit),
    api.getAll<Display>('/displays', {}, args.limit),
    api.getAll<Playlist>('/playlists', {}, args.limit),
  ]);

  // Try to get display groups (may not exist)
  let displayGroups: DisplayGroup[] = [];
  try {
    displayGroups = await api.getAll<DisplayGroup>('/display-groups', {}, args.limit);
  } catch {
    // Endpoint may not exist
  }

  const displayIds = new Set(displays.map((d) => d.id));
  const groupIds = new Set(displayGroups.map((g) => g.id));
  const playlistMap = new Map(playlists.map((p) => [p.id, p]));
  const displayScheduleMap = new Map<string, Schedule[]>();

  const activeSchedules = schedules.filter((s) => s.isActive !== false);

  for (const s of activeSchedules) {
    if (s.displayId) {
      const existing = displayScheduleMap.get(s.displayId) ?? [];
      existing.push(s);
      displayScheduleMap.set(s.displayId, existing);
    }
  }

  // ── Schedule Rules ─────────────────────────────────────────────────────

  for (const s of activeSchedules) {
    const name = s.name || s.id;

    // S-003: Active schedule with past endDate
    if (s.endDate) {
      const end = new Date(s.endDate);
      if (end < new Date()) {
        issues.push({
          rule: 'S-003',
          severity: 'warning',
          entity: 'schedule',
          entityId: s.id,
          entityName: name,
          message: `Schedule ended on ${end.toISOString()} but is still active`,
          recommendation: 'Deactivate or delete the expired schedule.',
        });
      }
    }

    // S-004: Schedule targeting nonexistent display/group
    if (s.displayId && !displayIds.has(s.displayId)) {
      issues.push({
        rule: 'S-004',
        severity: 'critical',
        entity: 'schedule',
        entityId: s.id,
        entityName: name,
        message: `Schedule targets display "${s.displayId}" which does not exist`,
        recommendation: 'Update the schedule to target an existing display or delete it.',
      });
    }
    if (s.displayGroupId && !groupIds.has(s.displayGroupId) && displayGroups.length > 0) {
      issues.push({
        rule: 'S-004',
        severity: 'critical',
        entity: 'schedule',
        entityId: s.id,
        entityName: name,
        message: `Schedule targets display group "${s.displayGroupId}" which does not exist`,
        recommendation: 'Update the schedule to target an existing group or delete it.',
      });
    }

    // S-006: Schedule with empty playlist
    if (s.playlistId) {
      const pl = playlistMap.get(s.playlistId);
      if (pl) {
        const count = pl.items?.length ?? pl._count?.items ?? -1;
        if (count === 0) {
          issues.push({
            rule: 'S-006',
            severity: 'warning',
            entity: 'schedule',
            entityId: s.id,
            entityName: name,
            message: `Schedule uses empty playlist "${pl.name || pl.id}"`,
            recommendation: 'Add content to the playlist or assign a different one.',
          });
        }
      }
    }

    // S-007: Midnight-crossing schedule (startTime > endTime)
    if (s.startTime && s.endTime && s.startTime > s.endTime) {
      issues.push({
        rule: 'S-007',
        severity: 'warning',
        entity: 'schedule',
        entityId: s.id,
        entityName: name,
        message: `Schedule crosses midnight (${s.startTime} → ${s.endTime}) — may not match as expected`,
        recommendation: 'Split into two schedules: one before midnight and one after.',
      });
    }
  }

  // S-001: Overlapping schedules for the same display
  for (const [displayId, scheds] of displayScheduleMap) {
    if (scheds.length < 2) continue;
    const displayName = displays.find((d) => d.id === displayId)?.name || displayId;

    for (let i = 0; i < scheds.length; i++) {
      for (let j = i + 1; j < scheds.length; j++) {
        const a = scheds[i];
        const b = scheds[j];

        if (schedulesOverlap(a, b)) {
          // S-008: Same-priority collision
          if (a.priority !== undefined && b.priority !== undefined && a.priority === b.priority) {
            issues.push({
              rule: 'S-008',
              severity: 'warning',
              entity: 'schedule',
              entityId: a.id,
              entityName: `${a.name || a.id} vs ${b.name || b.id}`,
              message: `Same-priority (${a.priority}) schedules overlap on display "${displayName}" — non-deterministic resolution`,
              recommendation: 'Set different priorities or adjust time ranges to avoid overlap.',
            });
          }

          issues.push({
            rule: 'S-001',
            severity: 'info',
            entity: 'schedule',
            entityId: a.id,
            entityName: `${a.name || a.id} vs ${b.name || b.id}`,
            message: `Overlapping schedules on display "${displayName}"`,
            recommendation: 'Review schedule priorities or adjust time ranges.',
          });
        }
      }
    }
  }

  // S-002: Displays with no schedules and no direct playlist
  for (const d of displays) {
    if (!d.currentPlaylistId && !displayScheduleMap.has(d.id)) {
      issues.push({
        rule: 'S-002',
        severity: 'warning',
        entity: 'display',
        entityId: d.id,
        entityName: d.name || d.id,
        message: 'Display has no schedules and no direct playlist assignment',
        recommendation: 'Create a schedule or assign a default playlist.',
      });
    }
  }

  // ── Output ─────────────────────────────────────────────────────────────

  const result = makeResult('schedule', issues, {
    totalSchedules: schedules.length,
    activeSchedules: activeSchedules.length,
    totalDisplays: displays.length,
    conflicts: issues.filter((i) => i.rule === 'S-001').length,
    expiredSchedules: issues.filter((i) => i.rule === 'S-003').length,
  }, startTime);

  outputJson(result);
  process.exit(issues.some((i) => i.severity === 'critical') ? 1 : 0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function schedulesOverlap(a: Schedule, b: Schedule): boolean {
  // Check date range overlap
  if (a.startDate && b.endDate && new Date(a.startDate) > new Date(b.endDate)) return false;
  if (b.startDate && a.endDate && new Date(b.startDate) > new Date(a.endDate)) return false;

  // Check day-of-week overlap
  if (a.daysOfWeek && b.daysOfWeek) {
    const aDays = new Set(a.daysOfWeek.map(String));
    const bDays = new Set(b.daysOfWeek.map(String));
    const commonDays = [...aDays].filter((d) => bDays.has(d));
    if (commonDays.length === 0) return false;
  }

  // Check time range overlap
  if (a.startTime && a.endTime && b.startTime && b.endTime) {
    if (a.startTime >= b.endTime || b.startTime >= a.endTime) return false;
  }

  return true;
}

main().catch((err) => fail(err.message));
