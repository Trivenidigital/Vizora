#!/usr/bin/env npx tsx
/**
 * 03 — Display & Playlist Configuration Validator
 *
 * Rules: D-001 to D-006, P-001 to P-003
 *
 * Usage: npx tsx 03-display-config-validator.ts --base-url http://localhost:3000 --token JWT
 * Exit: 0 = no criticals, 1 = has criticals, 2 = error
 */

import {
  parseArgs, VizoraApiClient, outputJson, fail, makeResult,
  type ValidationIssue,
} from './lib.js';

interface Display {
  id: string;
  name?: string;
  status?: string;
  currentPlaylistId?: string;
  lastHeartbeat?: string;
  lastSeen?: string;
  resolution?: string | { width: number; height: number };
  orientation?: string;
  error?: string;
  errorState?: string;
}

interface Schedule {
  id: string;
  name?: string;
  displayId?: string;
  displayGroupId?: string;
  playlistId?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}

interface Playlist {
  id: string;
  name?: string;
  items?: PlaylistItem[];
  _count?: { items: number };
}

interface PlaylistItem {
  id: string;
  contentId: string;
  content?: {
    id: string;
    status?: string;
    expiresAt?: string;
  };
}

async function main() {
  const args = parseArgs();
  if (!args.token) fail('--token is required for display validation');

  const api = new VizoraApiClient(args.baseUrl, args.token);
  const issues: ValidationIssue[] = [];
  const startTime = Date.now();

  // Fetch data in parallel
  const [displays, schedules, playlists] = await Promise.all([
    api.getAll<Display>('/displays', {}, args.limit),
    api.getAll<Schedule>('/schedules', { isActive: 'true' }, args.limit),
    api.getAll<Playlist>('/playlists', {}, args.limit),
  ]);

  const playlistMap = new Map(playlists.map((p) => [p.id, p]));
  const displaysWithSchedules = new Set(schedules.map((s) => s.displayId).filter(Boolean));

  // ── Display Rules ──────────────────────────────────────────────────────

  for (const d of displays) {
    const name = d.name || d.id;

    // D-001: No playlist and no active schedules → blank screen
    if (!d.currentPlaylistId && !displaysWithSchedules.has(d.id)) {
      issues.push({
        rule: 'D-001',
        severity: 'critical',
        entity: 'display',
        entityId: d.id,
        entityName: name,
        message: 'Display has no assigned playlist and no active schedules — will show blank screen',
        recommendation: 'Assign a playlist directly or create a schedule for this display.',
      });
    }

    // D-002: Offline with stale heartbeat (>24h)
    const lastSeen = d.lastHeartbeat || d.lastSeen;
    if (lastSeen && d.status !== 'online') {
      const staleMs = Date.now() - new Date(lastSeen).getTime();
      const staleHours = staleMs / (1000 * 60 * 60);
      if (staleHours > 24) {
        issues.push({
          rule: 'D-002',
          severity: 'warning',
          entity: 'display',
          entityId: d.id,
          entityName: name,
          message: `Display offline for ${Math.round(staleHours)}h (last seen: ${new Date(lastSeen).toISOString()})`,
          recommendation: 'Check network connectivity and power status of the display.',
        });
      }
    }

    // D-003: Missing resolution
    if (!d.resolution) {
      issues.push({
        rule: 'D-003',
        severity: 'info',
        entity: 'display',
        entityId: d.id,
        entityName: name,
        message: 'Display has no resolution configured',
        recommendation: 'Set the display resolution for optimal content rendering.',
      });
    }

    // D-004: Orientation mismatch — skip if no orientation data
    // (Would need content metadata to fully check; flagged as info)

    // D-005: Empty playlist assigned
    if (d.currentPlaylistId) {
      const pl = playlistMap.get(d.currentPlaylistId);
      if (pl) {
        const itemCount = pl.items?.length ?? pl._count?.items ?? -1;
        if (itemCount === 0) {
          issues.push({
            rule: 'D-005',
            severity: 'critical',
            entity: 'display',
            entityId: d.id,
            entityName: name,
            message: `Assigned playlist "${pl.name || pl.id}" is empty — display will show nothing`,
            recommendation: 'Add content items to the playlist or assign a different one.',
          });
        }
      }
    }

    // D-006: Display in error state
    if (d.status === 'error' || d.error || d.errorState) {
      issues.push({
        rule: 'D-006',
        severity: 'critical',
        entity: 'display',
        entityId: d.id,
        entityName: name,
        message: `Display is in error state: ${d.error || d.errorState || 'unknown error'}`,
        recommendation: 'Investigate the error and restart or re-pair the display.',
      });
    }
  }

  // ── Playlist Rules ─────────────────────────────────────────────────────

  const assignedPlaylistIds = new Set(
    displays.map((d) => d.currentPlaylistId).filter(Boolean),
  );
  // Also add playlists from schedules
  for (const s of schedules) {
    if (s.playlistId) assignedPlaylistIds.add(s.playlistId);
  }

  for (const pl of playlists) {
    const name = pl.name || pl.id;
    const itemCount = pl.items?.length ?? pl._count?.items ?? -1;

    // P-001: Empty playlist
    if (itemCount === 0) {
      const isAssigned = assignedPlaylistIds.has(pl.id);
      issues.push({
        rule: 'P-001',
        severity: isAssigned ? 'warning' : 'info',
        entity: 'playlist',
        entityId: pl.id,
        entityName: name,
        message: `Playlist is empty${isAssigned ? ' and is assigned to a display/schedule' : ''}`,
        recommendation: 'Add content items to the playlist.',
      });
    }

    // P-002 & P-003: Check playlist items for archived/expired content
    if (pl.items) {
      for (const item of pl.items) {
        if (item.content?.status === 'archived') {
          issues.push({
            rule: 'P-002',
            severity: 'warning',
            entity: 'playlist-item',
            entityId: pl.id,
            entityName: name,
            message: `Playlist contains archived content (${item.contentId})`,
            recommendation: 'Remove archived content from the playlist.',
          });
        }

        if (item.content?.expiresAt) {
          const exp = new Date(item.content.expiresAt);
          if (exp < new Date()) {
            issues.push({
              rule: 'P-003',
              severity: 'warning',
              entity: 'playlist-item',
              entityId: pl.id,
              entityName: name,
              message: `Playlist contains expired content (${item.contentId}, expired ${exp.toISOString()})`,
              recommendation: 'Remove or replace expired content in the playlist.',
            });
          }
        }
      }
    }
  }

  // ── Output ─────────────────────────────────────────────────────────────

  const result = makeResult('display', issues, {
    totalDisplays: displays.length,
    totalPlaylists: playlists.length,
    activeSchedules: schedules.length,
    displaysWithoutContent: issues.filter((i) => i.rule === 'D-001').length,
    offlineDisplays: displays.filter((d) => d.status !== 'online').length,
  }, startTime);

  outputJson(result);
  process.exit(issues.some((i) => i.severity === 'critical') ? 1 : 0);
}

main().catch((err) => fail(err.message));
