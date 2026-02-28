import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';
import { DatabaseService } from '../database/database.service';

/**
 * Tier 2 — Event-Driven Validation Monitor
 *
 * Listens to CRUD events from content, display, playlist, and schedule
 * services. Runs targeted validation within 5 seconds of a change.
 * Stores latest validation state in Redis for fast reads via /health/validation.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'warning' | 'info';
export type Readiness = 'READY' | 'DEGRADED' | 'NOT READY';

export interface ValidationIssue {
  rule: string;
  severity: Severity;
  entity: string;
  entityId: string;
  entityName: string;
  message: string;
}

export interface ValidationState {
  readiness: Readiness;
  timestamp: string;
  durationMs: number;
  critical: number;
  warning: number;
  info: number;
  issues: ValidationIssue[];
  trigger: string;
}

export interface EntityEvent {
  action: 'created' | 'updated' | 'deleted';
  entityType: string;
  entityId: string;
  organizationId: string;
}

const REDIS_KEY = 'vizora:validation:latest';
const REDIS_TTL = 3600; // 1 hour
const DEBOUNCE_MS = 5_000; // 5 second debounce after events

@Injectable()
export class ValidationMonitorService {
  private readonly logger = new Logger(ValidationMonitorService.name);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingOrgIds = new Set<string>();

  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  // ─── Event Listeners ─────────────────────────────────────────────────────

  @OnEvent('content.**')
  handleContentEvent(event: EntityEvent) {
    this.scheduleValidation(event.organizationId, `content.${event.action}`);
  }

  @OnEvent('display.**')
  handleDisplayEvent(event: EntityEvent) {
    this.scheduleValidation(event.organizationId, `display.${event.action}`);
  }

  @OnEvent('playlist.**')
  handlePlaylistEvent(event: EntityEvent) {
    this.scheduleValidation(event.organizationId, `playlist.${event.action}`);
  }

  @OnEvent('schedule.**')
  handleScheduleEvent(event: EntityEvent) {
    this.scheduleValidation(event.organizationId, `schedule.${event.action}`);
  }

  // ─── Scheduled Full Scan (Fallback) ──────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyValidation() {
    this.logger.log('Running hourly full validation scan');
    try {
      // Get all orgs with active content
      const orgs = await this.db.organization.findMany({
        select: { id: true },
        where: { isActive: true },
        take: 50,
      });
      for (const org of orgs) {
        await this.runValidation(org.id, 'scheduled.hourly');
      }
    } catch (err) {
      this.logger.error(`Hourly validation failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─── Debounced Trigger ───────────────────────────────────────────────────

  private scheduleValidation(orgId: string, trigger: string) {
    this.pendingOrgIds.add(orgId);
    this.logger.debug(`Validation queued for org ${orgId} (trigger: ${trigger})`);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      const orgs = [...this.pendingOrgIds];
      this.pendingOrgIds.clear();
      for (const org of orgs) {
        await this.runValidation(org, trigger);
      }
    }, DEBOUNCE_MS);
  }

  // ─── Core Validation Logic ───────────────────────────────────────────────

  async runValidation(organizationId: string, trigger: string): Promise<ValidationState> {
    const start = Date.now();
    const issues: ValidationIssue[] = [];

    try {
      // Fetch all data for this org in parallel
      const [content, displays, playlists, schedules] = await Promise.all([
        this.db.content.findMany({ where: { organizationId }, take: 500 }),
        this.db.display.findMany({ where: { organizationId }, take: 500 }),
        this.db.playlist.findMany({
          where: { organizationId },
          include: { items: { include: { content: { select: { id: true, status: true, expiresAt: true } } } } },
          take: 500,
        }),
        this.db.schedule.findMany({ where: { organizationId, isActive: true }, take: 500 }),
      ]);

      // Build lookup sets
      const contentInPlaylists = new Set<string>();
      const playlistMap = new Map<string, typeof playlists[0]>();
      for (const pl of playlists) {
        playlistMap.set(pl.id, pl);
        for (const item of pl.items) contentInPlaylists.add(item.contentId);
      }
      const displaysWithSchedules = new Set(schedules.map(s => s.displayId).filter(Boolean));
      const displayIds = new Set(displays.map(d => d.id));
      const assignedPlaylistIds = new Set([
        ...displays.map(d => d.currentPlaylistId).filter(Boolean),
        ...schedules.map(s => s.playlistId).filter(Boolean),
      ]);

      // ── Content Rules ──────────────────────────────────────────────────
      for (const c of content) {
        const name = c.name || c.id;
        const url = (c as Record<string, unknown>).url as string || (c as Record<string, unknown>).fileUrl as string || '';

        // C-001: Invalid URL format
        if (url && !url.startsWith('minio://') && !url.startsWith('/uploads/') && !url.startsWith('http')) {
          issues.push({ rule: 'C-001', severity: 'critical', entity: 'content', entityId: c.id, entityName: name,
            message: `Invalid content URL format` });
        }
        // C-002: Expired but active
        if (c.expiresAt && c.status === 'active' && new Date(c.expiresAt) < new Date()) {
          issues.push({ rule: 'C-002', severity: 'warning', entity: 'content', entityId: c.id, entityName: name,
            message: `Content expired but still active` });
        }
        // C-003: Orphaned content
        if (!contentInPlaylists.has(c.id) && c.type !== 'layout') {
          issues.push({ rule: 'C-003', severity: 'info', entity: 'content', entityId: c.id, entityName: name,
            message: 'Content not in any playlist' });
        }
      }

      // ── Display Rules ──────────────────────────────────────────────────
      for (const d of displays) {
        const name = d.name || d.id;

        // D-001: No playlist and no schedules
        if (!d.currentPlaylistId && !displaysWithSchedules.has(d.id)) {
          issues.push({ rule: 'D-001', severity: 'critical', entity: 'display', entityId: d.id, entityName: name,
            message: 'Display has no playlist and no active schedules' });
        }
        // D-002: Offline > 24h
        const lastSeen = d.lastHeartbeat || (d as Record<string, unknown>).lastSeen as Date | null;
        if (lastSeen && d.status !== 'online') {
          const hours = (Date.now() - new Date(lastSeen).getTime()) / 3_600_000;
          if (hours > 24) {
            issues.push({ rule: 'D-002', severity: 'warning', entity: 'display', entityId: d.id, entityName: name,
              message: `Display offline for ${Math.round(hours)}h` });
          }
        }
        // D-005: Empty playlist assigned
        if (d.currentPlaylistId) {
          const pl = playlistMap.get(d.currentPlaylistId);
          if (pl && pl.items.length === 0) {
            issues.push({ rule: 'D-005', severity: 'critical', entity: 'display', entityId: d.id, entityName: name,
              message: `Assigned playlist "${pl.name || pl.id}" is empty` });
          }
        }
        // D-006: Error state
        if (d.status === 'error') {
          issues.push({ rule: 'D-006', severity: 'critical', entity: 'display', entityId: d.id, entityName: name,
            message: 'Display in error state' });
        }
      }

      // ── Playlist Rules ─────────────────────────────────────────────────
      for (const pl of playlists) {
        const name = pl.name || pl.id;
        if (pl.items.length === 0) {
          issues.push({ rule: 'P-001', severity: assignedPlaylistIds.has(pl.id) ? 'warning' : 'info',
            entity: 'playlist', entityId: pl.id, entityName: name,
            message: `Playlist is empty${assignedPlaylistIds.has(pl.id) ? ' and assigned to a display' : ''}` });
        }
        for (const item of pl.items) {
          if (item.content?.status === 'archived') {
            issues.push({ rule: 'P-002', severity: 'warning', entity: 'playlist-item', entityId: pl.id, entityName: name,
              message: `Contains archived content` });
          }
          if (item.content?.expiresAt && new Date(item.content.expiresAt) < new Date()) {
            issues.push({ rule: 'P-003', severity: 'warning', entity: 'playlist-item', entityId: pl.id, entityName: name,
              message: `Contains expired content` });
          }
        }
      }

      // ── Schedule Rules ─────────────────────────────────────────────────
      for (const s of schedules) {
        const name = s.name || s.id;
        // S-003: Past end date
        if (s.endDate && new Date(s.endDate) < new Date()) {
          issues.push({ rule: 'S-003', severity: 'warning', entity: 'schedule', entityId: s.id, entityName: name,
            message: `Schedule ended but still active` });
        }
        // S-004: Nonexistent display
        if (s.displayId && !displayIds.has(s.displayId)) {
          issues.push({ rule: 'S-004', severity: 'critical', entity: 'schedule', entityId: s.id, entityName: name,
            message: `Targets nonexistent display` });
        }
        // S-006: Empty playlist
        if (s.playlistId) {
          const pl = playlistMap.get(s.playlistId);
          if (pl && pl.items.length === 0) {
            issues.push({ rule: 'S-006', severity: 'warning', entity: 'schedule', entityId: s.id, entityName: name,
              message: `Uses empty playlist` });
          }
        }
      }

      // S-002: Displays with no schedules and no playlist
      for (const d of displays) {
        if (!d.currentPlaylistId && !displaysWithSchedules.has(d.id)) {
          issues.push({ rule: 'S-002', severity: 'warning', entity: 'display', entityId: d.id, entityName: d.name || d.id,
            message: 'No schedules and no direct playlist' });
        }
      }

    } catch (err) {
      this.logger.error(`Validation error for org ${organizationId}: ${err instanceof Error ? err.message : err}`);
    }

    // Determine readiness
    const critical = issues.filter(i => i.severity === 'critical').length;
    const warning = issues.filter(i => i.severity === 'warning').length;
    const info = issues.filter(i => i.severity === 'info').length;
    const readiness: Readiness = critical > 0 ? 'NOT READY' : warning > 0 ? 'DEGRADED' : 'READY';

    const state: ValidationState = {
      readiness, timestamp: new Date().toISOString(), durationMs: Date.now() - start,
      critical, warning, info, issues, trigger,
    };

    // Store in Redis (per-org key)
    if (this.redis) {
      try {
        await this.redis.set(`${REDIS_KEY}:${organizationId}`, JSON.stringify(state), REDIS_TTL);
      } catch (err) {
        this.logger.warn(`Failed to cache validation state: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.logger.log(`Validation [${trigger}] org=${organizationId}: ${readiness} (${critical}C/${warning}W/${info}I) in ${state.durationMs}ms`);
    return state;
  }

  // ─── Query API ───────────────────────────────────────────────────────────

  async getValidationState(organizationId: string): Promise<ValidationState | null> {
    // Try Redis first
    if (this.redis) {
      try {
        const cached = await this.redis.get(`${REDIS_KEY}:${organizationId}`);
        if (cached) return JSON.parse(cached);
      } catch {
        // Fall through to fresh validation
      }
    }

    // No cache — run fresh
    return this.runValidation(organizationId, 'api.request');
  }
}
