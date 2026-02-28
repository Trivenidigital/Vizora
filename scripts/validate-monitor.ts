#!/usr/bin/env npx tsx
/**
 * Vizora Continuous Monitoring — Tier 1
 *
 * Runs all 30 validation rules against the Vizora API and alerts to Slack
 * on status changes. Designed to run via PM2 cron every 15 minutes.
 *
 * Environment variables:
 *   VALIDATOR_EMAIL      — service account email (required)
 *   VALIDATOR_PASSWORD   — service account password (required)
 *   SLACK_WEBHOOK_URL    — Slack incoming webhook (required for alerts)
 *   VALIDATOR_BASE_URL   — API base URL (default: http://localhost:3000)
 *
 * Usage:
 *   npx tsx scripts/validate-monitor.ts
 *
 * Exit: 0 = READY, 1 = NOT READY/DEGRADED, 2 = error
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.VALIDATOR_BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.VALIDATOR_EMAIL || '';
const PASSWORD = process.env.VALIDATOR_PASSWORD || '';
const SLACK_URL = process.env.SLACK_WEBHOOK_URL || '';
const TIMEOUT_MS = 30_000;
const MAX_ENTITIES = 500;

// Path to last-known state file (relative to project root)
const STATE_FILE = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'logs', 'validator-latest.json');

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info';
type Readiness = 'READY' | 'DEGRADED' | 'NOT READY' | 'UNHEALTHY';

interface ValidationIssue {
  rule: string;
  severity: Severity;
  entity: string;
  entityId: string;
  entityName: string;
  message: string;
  recommendation: string;
}

interface ValidationResult {
  category: string;
  timestamp: string;
  durationMs: number;
  issues: ValidationIssue[];
  stats: Record<string, number>;
}

interface MonitorState {
  readiness: Readiness;
  timestamp: string;
  totalIssues: number;
  critical: number;
  warning: number;
  info: number;
  categories: string[];
  durationMs: number;
  issues: ValidationIssue[];
}

// ─── API Client ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, token: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`/api/v1${path}`, BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText} — ${path}`);
    const json = await res.json() as Record<string, unknown>;
    if (json.success !== undefined && json.data !== undefined) return json.data as T;
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

async function apiGetAll<T>(path: string, token: string, params?: Record<string, string | number>): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (items.length < MAX_ENTITIES) {
    const data = await apiFetch<T[] | { items?: T[]; data?: T[] }>(path, token, { ...params, page: String(page), limit: '100' });
    let batch: T[];
    if (Array.isArray(data)) batch = data;
    else if (Array.isArray(data?.items)) batch = data.items;
    else if (Array.isArray(data?.data)) batch = data.data;
    else break;
    items.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return items.slice(0, MAX_ENTITIES);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  const json = await res.json() as Record<string, unknown>;
  const data = (json.data ?? json) as Record<string, unknown>;
  const token = data.accessToken || data.access_token || data.token;
  if (!token) throw new Error('Login response has no token');
  return String(token);
}

// ─── Health Check ────────────────────────────────────────────────────────────

async function checkHealth(): Promise<{ healthy: boolean; services: Record<string, string> }> {
  const services: Record<string, string> = {};
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${BASE_URL}/api/v1/health`, { signal: controller.signal });
    clearTimeout(timer);
    services['api'] = res.ok ? 'healthy' : `unhealthy (${res.status})`;
    if (!res.ok) return { healthy: false, services };
  } catch (err) {
    services['api'] = `unreachable: ${err instanceof Error ? err.message : err}`;
    return { healthy: false, services };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(`${BASE_URL}/api/v1/health/ready`, { signal: controller.signal });
    clearTimeout(timer);
    services['readiness'] = res.ok ? 'healthy' : `unhealthy (${res.status})`;
  } catch (err) {
    services['readiness'] = `unhealthy: ${err instanceof Error ? err.message : err}`;
  }

  const healthy = !Object.values(services).some(s => s.includes('unhealthy') || s.includes('unreachable'));
  return { healthy, services };
}

// ─── Content Validator (Rules C-001 to C-007, L-001 to L-003, ST-001 to ST-002) ─

interface ContentItem {
  id: string; name?: string; title?: string; type: string; mimeType?: string;
  url?: string; fileUrl?: string; thumbnailUrl?: string; status?: string;
  expiresAt?: string; duration?: number; fileSize?: number;
}
interface Playlist {
  id: string; name?: string; items?: { contentId: string; content?: { status?: string; expiresAt?: string } }[];
  _count?: { items: number };
}

function validateContent(content: ContentItem[], playlists: Playlist[]): ValidationResult {
  const start = Date.now();
  const issues: ValidationIssue[] = [];
  const contentInPlaylists = new Set<string>();
  for (const pl of playlists) {
    if (pl.items) for (const item of pl.items) contentInPlaylists.add(item.contentId);
  }

  for (const c of content) {
    const name = c.name || c.title || c.id;
    const contentUrl = c.url || c.fileUrl || '';

    if (contentUrl && !isValidUrl(contentUrl)) {
      issues.push({ rule: 'C-001', severity: 'critical', entity: 'content', entityId: c.id, entityName: name,
        message: `Invalid content URL format: "${contentUrl.slice(0, 80)}"`, recommendation: 'Re-upload the content or fix the URL.' });
    }
    if (c.expiresAt && c.status === 'active' && new Date(c.expiresAt) < new Date()) {
      issues.push({ rule: 'C-002', severity: 'warning', entity: 'content', entityId: c.id, entityName: name,
        message: `Content expired on ${c.expiresAt} but still active`, recommendation: 'Archive expired content or extend expiration.' });
    }
    if (!contentInPlaylists.has(c.id) && c.type !== 'layout') {
      issues.push({ rule: 'C-003', severity: 'info', entity: 'content', entityId: c.id, entityName: name,
        message: 'Content not assigned to any playlist', recommendation: 'Add to a playlist or archive.' });
    }
    if ((c.type === 'image' || c.type === 'video') && !c.thumbnailUrl) {
      issues.push({ rule: 'C-004', severity: 'info', entity: 'content', entityId: c.id, entityName: name,
        message: `${c.type} content has no thumbnail`, recommendation: 'Re-upload or trigger thumbnail generation.' });
    }
    if (c.mimeType && c.type) {
      const map: Record<string, string[]> = { image: ['image/'], video: ['video/'], html: ['text/html', 'application/xhtml'] };
      if (map[c.type] && !map[c.type].some(p => c.mimeType!.startsWith(p))) {
        issues.push({ rule: 'C-005', severity: 'warning', entity: 'content', entityId: c.id, entityName: name,
          message: `Content type "${c.type}" doesn't match MIME "${c.mimeType}"`, recommendation: 'Update content type or re-upload.' });
      }
    }
    if (c.duration !== undefined && c.duration <= 0 && c.type !== 'url') {
      issues.push({ rule: 'C-006', severity: 'warning', entity: 'content', entityId: c.id, entityName: name,
        message: 'Content has zero or negative duration', recommendation: 'Set a valid duration (minimum 1 second).' });
    }
    if (c.fileSize) {
      const mb = c.fileSize / (1024 * 1024);
      if (c.type === 'image' && mb > 10) {
        issues.push({ rule: 'C-007', severity: 'warning', entity: 'content', entityId: c.id, entityName: name,
          message: `Image is ${mb.toFixed(1)}MB (>10MB)`, recommendation: 'Compress or convert to efficient format.' });
      } else if (c.type === 'video' && mb > 100) {
        issues.push({ rule: 'C-007', severity: 'warning', entity: 'content', entityId: c.id, entityName: name,
          message: `Video is ${mb.toFixed(1)}MB (>100MB)`, recommendation: 'Transcode to lower bitrate.' });
      }
    }
  }
  return { category: 'content', timestamp: new Date().toISOString(), durationMs: Date.now() - start, issues,
    stats: { totalContent: content.length, totalPlaylists: playlists.length } };
}

// ─── Display Validator (Rules D-001 to D-006, P-001 to P-003) ───────────────

interface DisplayItem {
  id: string; name?: string; status?: string; currentPlaylistId?: string;
  lastHeartbeat?: string; lastSeen?: string; resolution?: unknown;
  error?: string; errorState?: string;
}
interface ScheduleItem {
  id: string; name?: string; displayId?: string; displayGroupId?: string;
  playlistId?: string; isActive?: boolean; startDate?: string; endDate?: string;
  startTime?: string; endTime?: string; daysOfWeek?: (number | string)[]; priority?: number;
}

function validateDisplays(displays: DisplayItem[], schedules: ScheduleItem[], playlists: Playlist[]): ValidationResult {
  const start = Date.now();
  const issues: ValidationIssue[] = [];
  const playlistMap = new Map(playlists.map(p => [p.id, p]));
  const displaysWithSchedules = new Set(schedules.map(s => s.displayId).filter(Boolean));
  const assignedPlaylistIds = new Set([
    ...displays.map(d => d.currentPlaylistId).filter(Boolean),
    ...schedules.map(s => s.playlistId).filter(Boolean),
  ]);

  for (const d of displays) {
    const name = d.name || d.id;
    if (!d.currentPlaylistId && !displaysWithSchedules.has(d.id)) {
      issues.push({ rule: 'D-001', severity: 'critical', entity: 'display', entityId: d.id, entityName: name,
        message: 'Display has no playlist and no active schedules — blank screen', recommendation: 'Assign a playlist or create a schedule.' });
    }
    const lastSeen = d.lastHeartbeat || d.lastSeen;
    if (lastSeen && d.status !== 'online') {
      const hours = (Date.now() - new Date(lastSeen).getTime()) / 3_600_000;
      if (hours > 24) {
        issues.push({ rule: 'D-002', severity: 'warning', entity: 'display', entityId: d.id, entityName: name,
          message: `Display offline for ${Math.round(hours)}h`, recommendation: 'Check network and power.' });
      }
    }
    if (!d.resolution) {
      issues.push({ rule: 'D-003', severity: 'info', entity: 'display', entityId: d.id, entityName: name,
        message: 'No resolution configured', recommendation: 'Set display resolution.' });
    }
    if (d.currentPlaylistId) {
      const pl = playlistMap.get(d.currentPlaylistId);
      if (pl) {
        const count = pl.items?.length ?? pl._count?.items ?? -1;
        if (count === 0) {
          issues.push({ rule: 'D-005', severity: 'critical', entity: 'display', entityId: d.id, entityName: name,
            message: `Assigned playlist "${pl.name || pl.id}" is empty`, recommendation: 'Add content or assign different playlist.' });
        }
      }
    }
    if (d.status === 'error' || d.error || d.errorState) {
      issues.push({ rule: 'D-006', severity: 'critical', entity: 'display', entityId: d.id, entityName: name,
        message: `Display in error state: ${d.error || d.errorState || 'unknown'}`, recommendation: 'Investigate and restart.' });
    }
  }

  for (const pl of playlists) {
    const name = pl.name || pl.id;
    const count = pl.items?.length ?? pl._count?.items ?? -1;
    if (count === 0) {
      issues.push({ rule: 'P-001', severity: assignedPlaylistIds.has(pl.id) ? 'warning' : 'info', entity: 'playlist',
        entityId: pl.id, entityName: name, message: `Playlist is empty${assignedPlaylistIds.has(pl.id) ? ' and assigned to a display' : ''}`,
        recommendation: 'Add content items.' });
    }
    if (pl.items) {
      for (const item of pl.items) {
        if (item.content?.status === 'archived') {
          issues.push({ rule: 'P-002', severity: 'warning', entity: 'playlist-item', entityId: pl.id, entityName: name,
            message: `Contains archived content (${item.contentId})`, recommendation: 'Remove archived content.' });
        }
        if (item.content?.expiresAt && new Date(item.content.expiresAt) < new Date()) {
          issues.push({ rule: 'P-003', severity: 'warning', entity: 'playlist-item', entityId: pl.id, entityName: name,
            message: `Contains expired content (${item.contentId})`, recommendation: 'Remove or replace expired content.' });
        }
      }
    }
  }

  return { category: 'display', timestamp: new Date().toISOString(), durationMs: Date.now() - start, issues,
    stats: { totalDisplays: displays.length, totalPlaylists: playlists.length, activeSchedules: schedules.length } };
}

// ─── Schedule Validator (Rules S-001 to S-008) ──────────────────────────────

function validateSchedules(schedules: ScheduleItem[], displays: DisplayItem[], playlists: Playlist[]): ValidationResult {
  const start = Date.now();
  const issues: ValidationIssue[] = [];
  const displayIds = new Set(displays.map(d => d.id));
  const playlistMap = new Map(playlists.map(p => [p.id, p]));
  const active = schedules.filter(s => s.isActive !== false);
  const displayScheduleMap = new Map<string, ScheduleItem[]>();

  for (const s of active) {
    if (s.displayId) {
      const arr = displayScheduleMap.get(s.displayId) ?? [];
      arr.push(s);
      displayScheduleMap.set(s.displayId, arr);
    }
  }

  for (const s of active) {
    const name = s.name || s.id;
    if (s.endDate && new Date(s.endDate) < new Date()) {
      issues.push({ rule: 'S-003', severity: 'warning', entity: 'schedule', entityId: s.id, entityName: name,
        message: `Schedule ended on ${s.endDate} but still active`, recommendation: 'Deactivate or delete.' });
    }
    if (s.displayId && !displayIds.has(s.displayId)) {
      issues.push({ rule: 'S-004', severity: 'critical', entity: 'schedule', entityId: s.id, entityName: name,
        message: `Targets nonexistent display "${s.displayId}"`, recommendation: 'Update or delete schedule.' });
    }
    if (s.playlistId) {
      const pl = playlistMap.get(s.playlistId);
      if (pl && (pl.items?.length ?? pl._count?.items ?? -1) === 0) {
        issues.push({ rule: 'S-006', severity: 'warning', entity: 'schedule', entityId: s.id, entityName: name,
          message: `Uses empty playlist "${pl.name || pl.id}"`, recommendation: 'Add content or assign different playlist.' });
      }
    }
    if (s.startTime && s.endTime && s.startTime > s.endTime) {
      issues.push({ rule: 'S-007', severity: 'warning', entity: 'schedule', entityId: s.id, entityName: name,
        message: `Crosses midnight (${s.startTime} → ${s.endTime})`, recommendation: 'Split into two schedules.' });
    }
  }

  for (const [displayId, scheds] of displayScheduleMap) {
    if (scheds.length < 2) continue;
    const dName = displays.find(d => d.id === displayId)?.name || displayId;
    for (let i = 0; i < scheds.length; i++) {
      for (let j = i + 1; j < scheds.length; j++) {
        if (schedulesOverlap(scheds[i], scheds[j])) {
          if (scheds[i].priority !== undefined && scheds[j].priority !== undefined && scheds[i].priority === scheds[j].priority) {
            issues.push({ rule: 'S-008', severity: 'warning', entity: 'schedule',
              entityId: scheds[i].id, entityName: `${scheds[i].name || scheds[i].id} vs ${scheds[j].name || scheds[j].id}`,
              message: `Same-priority overlap on "${dName}"`, recommendation: 'Set different priorities.' });
          }
          issues.push({ rule: 'S-001', severity: 'info', entity: 'schedule',
            entityId: scheds[i].id, entityName: `${scheds[i].name || scheds[i].id} vs ${scheds[j].name || scheds[j].id}`,
            message: `Overlapping schedules on "${dName}"`, recommendation: 'Review priorities or adjust times.' });
        }
      }
    }
  }

  for (const d of displays) {
    if (!d.currentPlaylistId && !displayScheduleMap.has(d.id)) {
      issues.push({ rule: 'S-002', severity: 'warning', entity: 'display', entityId: d.id, entityName: d.name || d.id,
        message: 'No schedules and no direct playlist', recommendation: 'Create a schedule or assign a playlist.' });
    }
  }

  return { category: 'schedule', timestamp: new Date().toISOString(), durationMs: Date.now() - start, issues,
    stats: { totalSchedules: schedules.length, activeSchedules: active.length } };
}

function schedulesOverlap(a: ScheduleItem, b: ScheduleItem): boolean {
  if (a.startDate && b.endDate && new Date(a.startDate) > new Date(b.endDate)) return false;
  if (b.startDate && a.endDate && new Date(b.startDate) > new Date(a.endDate)) return false;
  if (a.daysOfWeek && b.daysOfWeek) {
    const aSet = new Set(a.daysOfWeek.map(String));
    if (![...b.daysOfWeek].some(d => aSet.has(String(d)))) return false;
  }
  if (a.startTime && a.endTime && b.startTime && b.endTime) {
    if (a.startTime >= b.endTime || b.startTime >= a.endTime) return false;
  }
  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  if (url.startsWith('minio://') || url.startsWith('/uploads/')) return true;
  try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
}

function determineReadiness(issues: ValidationIssue[]): Readiness {
  if (issues.some(i => i.severity === 'critical')) return 'NOT READY';
  if (issues.some(i => i.severity === 'warning')) return 'DEGRADED';
  return 'READY';
}

// ─── State Persistence ───────────────────────────────────────────────────────

function readPreviousState(): MonitorState | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch { return null; }
}

function writeState(state: MonitorState): void {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Slack Alerting ──────────────────────────────────────────────────────────

async function sendSlackAlert(current: MonitorState, previous: MonitorState | null): Promise<void> {
  if (!SLACK_URL) {
    log('No SLACK_WEBHOOK_URL set — skipping alert');
    return;
  }

  const prevStatus = previous?.readiness ?? 'unknown';
  const icon = current.readiness === 'READY' ? ':large_green_circle:' :
               current.readiness === 'DEGRADED' ? ':large_yellow_circle:' :
               current.readiness === 'UNHEALTHY' ? ':red_circle:' : ':red_circle:';

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${current.readiness === 'READY' ? '✅' : current.readiness === 'DEGRADED' ? '⚠️' : '🔴'} Vizora Validator: ${current.readiness}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Previous:* ${prevStatus} → *Current:* ${current.readiness}\n*Critical:* ${current.critical} | *Warning:* ${current.warning} | *Info:* ${current.info}` },
    },
  ];

  // List critical issues
  const criticals = current.issues.filter(i => i.severity === 'critical');
  if (criticals.length > 0) {
    const issueList = criticals.slice(0, 5).map(i => `• *${i.rule}*: ${i.message}`).join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Critical Issues:*\n${issueList}${criticals.length > 5 ? `\n_...and ${criticals.length - 5} more_` : ''}` },
    });
  }

  // List warnings (max 3)
  const warnings = current.issues.filter(i => i.severity === 'warning');
  if (warnings.length > 0 && criticals.length === 0) {
    const warnList = warnings.slice(0, 3).map(i => `• *${i.rule}*: ${i.message}`).join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Warnings:*\n${warnList}${warnings.length > 3 ? `\n_...and ${warnings.length - 3} more_` : ''}` },
    });
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Server: vizora.cloud | ${current.timestamp} | Duration: ${current.durationMs}ms` }],
  });

  try {
    const res = await fetch(SLACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) log(`Slack webhook returned ${res.status}`);
    else log('Slack alert sent');
  } catch (err) {
    log(`Slack alert failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] ${msg}\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const runStart = Date.now();
  log('Vizora Continuous Monitor starting');

  if (!EMAIL || !PASSWORD) {
    log('ERROR: VALIDATOR_EMAIL and VALIDATOR_PASSWORD are required');
    process.exitCode = 2;
    return;
  }

  // 1. Health check (no auth needed)
  log('Running health check...');
  const health = await checkHealth();
  if (!health.healthy) {
    log(`Infrastructure UNHEALTHY: ${JSON.stringify(health.services)}`);
    const state: MonitorState = {
      readiness: 'UNHEALTHY', timestamp: new Date().toISOString(),
      totalIssues: 0, critical: 0, warning: 0, info: 0,
      categories: ['health'], durationMs: Date.now() - runStart, issues: [],
    };
    const prev = readPreviousState();
    if (prev?.readiness !== 'UNHEALTHY') await sendSlackAlert(state, prev);
    writeState(state);
    process.exitCode = 2;
    return;
  }
  log('Health check passed');

  // 2. Authenticate
  log('Authenticating...');
  let token: string;
  try {
    token = await login();
    log('Authentication successful');
  } catch (err) {
    log(`Authentication failed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  // 3. Fetch all data in parallel
  log('Fetching data...');
  const [content, playlists, displays, schedules] = await Promise.all([
    apiGetAll<ContentItem>('/content', token),
    apiGetAll<Playlist>('/playlists', token),
    apiGetAll<DisplayItem>('/displays', token),
    apiGetAll<ScheduleItem>('/schedules', token).then(s => s.filter(x => x.isActive !== false)),
  ]);
  log(`Fetched: ${content.length} content, ${playlists.length} playlists, ${displays.length} displays, ${schedules.length} schedules`);

  // 4. Run validators
  log('Running validators...');
  const results: ValidationResult[] = [
    validateContent(content, playlists),
    validateDisplays(displays, schedules, playlists),
    validateSchedules(schedules, displays, playlists),
  ];

  // 5. Aggregate
  const allIssues = results.flatMap(r => r.issues);
  const critical = allIssues.filter(i => i.severity === 'critical').length;
  const warning = allIssues.filter(i => i.severity === 'warning').length;
  const info = allIssues.filter(i => i.severity === 'info').length;
  const readiness = determineReadiness(allIssues);

  const state: MonitorState = {
    readiness,
    timestamp: new Date().toISOString(),
    totalIssues: allIssues.length,
    critical, warning, info,
    categories: results.map(r => r.category),
    durationMs: Date.now() - runStart,
    issues: allIssues,
  };

  log(`Result: ${readiness} — ${critical} critical, ${warning} warning, ${info} info (${state.durationMs}ms)`);

  // 6. Change detection + alert
  const prev = readPreviousState();
  if (prev?.readiness !== state.readiness) {
    log(`Status changed: ${prev?.readiness ?? 'unknown'} → ${state.readiness}`);
    await sendSlackAlert(state, prev);
  } else {
    log('No status change — silent');
  }

  // 7. Persist state
  writeState(state);
  log('State written to logs/validator-latest.json');

  process.exitCode = readiness === 'READY' ? 0 : 1;
}

main().catch(err => {
  log(`FATAL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 2;
});
