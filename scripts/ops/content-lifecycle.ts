#!/usr/bin/env npx tsx
/**
 * Vizora Autonomous Operations — Content Lifecycle Agent
 *
 * Runs every 15 minutes via PM2 cron. Manages content lifecycle by detecting
 * and auto-archiving expired content, identifying orphaned content, and
 * monitoring storage utilization.
 *
 * Checks:
 *   1. Expired content still active — archives content past its expiresAt date
 *   2. Orphaned content — archives content not in any playlist, older than 30 days
 *   3. Storage monitoring — warns at >80%, critical at >90% utilization
 *
 * Exit codes:
 *   0 — no issues found
 *   1 — issues found (some may have been auto-fixed)
 *   2 — fatal error (agent could not complete)
 */

import 'dotenv/config';
import type { Incident, AgentResult } from './lib/types.js';
import {
  readOpsState,
  writeOpsState,
  recordAgentRun,
  addRemediation,
  makeIncidentId,
} from './lib/state.js';
import { login, OpsApiClient } from './lib/api-client.js';
import { log } from './lib/alerting.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'content-lifecycle';

/** Content older than this (in days) with no playlist attachment is orphaned */
const ORPHAN_AGE_DAYS = 30;

/** Storage utilization thresholds */
const STORAGE_WARN_PCT = 80;
const STORAGE_CRITICAL_PCT = 90;

// ─── Content & Playlist Types ────────────────────────────────────────────────

interface ContentItem {
  id: string;
  name?: string;
  title?: string;
  type: string;
  status?: string;
  expiresAt?: string;
  fileSize?: number;
  createdAt?: string;
}

interface Playlist {
  id: string;
  name?: string;
  items?: { contentId: string }[];
}

// ─── Check: Expired Content ──────────────────────────────────────────────────

/**
 * Find active content with an expiresAt date in the past.
 * Auto-fix: archive each expired item via PATCH.
 */
async function checkExpiredContent(
  api: OpsApiClient,
  content: ContentItem[],
  incidents: Incident[],
  state: { issuesFound: number; issuesFixed: number },
): Promise<void> {
  const now = new Date();
  const expired = content.filter(c => {
    if (c.status !== 'active' || !c.expiresAt) return false;
    const expiresAt = new Date(c.expiresAt);
    return expiresAt < now;
  });

  if (expired.length === 0) {
    log(AGENT, 'No expired active content found');
    return;
  }

  log(AGENT, `Found ${expired.length} expired content item(s) still active`);

  for (const item of expired) {
    state.issuesFound++;
    const label = item.name || item.title || item.id;
    const incidentId = makeIncidentId(AGENT, 'expired_content', item.id);

    log(AGENT, `Archiving expired content: ${label} (expired ${item.expiresAt})`);

    try {
      await api.patch(`/content/${item.id}`, { status: 'archived' }, {
        target: 'content',
        targetId: item.id,
        action: `Archive expired content "${label}"`,
        before: { status: item.status, expiresAt: item.expiresAt },
      });

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'expired_content',
        severity: 'warning',
        target: 'content',
        targetId: item.id,
        detected: new Date().toISOString(),
        message: `Content "${label}" expired on ${item.expiresAt} — auto-archived`,
        remediation: `PATCH /content/${item.id} { status: "archived" }`,
        status: 'resolved',
        attempts: 1,
        resolvedAt: new Date().toISOString(),
      });

      state.issuesFixed++;
      log(AGENT, `Archived expired content: ${label}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log(AGENT, `Failed to archive expired content ${label}: ${errorMsg}`);

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'expired_content',
        severity: 'warning',
        target: 'content',
        targetId: item.id,
        detected: new Date().toISOString(),
        message: `Content "${label}" expired on ${item.expiresAt} — archive failed`,
        remediation: `PATCH /content/${item.id} { status: "archived" }`,
        status: 'open',
        attempts: 1,
        error: errorMsg,
      });
    }
  }
}

// ─── Check: Orphaned Content ─────────────────────────────────────────────────

/**
 * Find content that is not referenced by any playlist, is older than
 * ORPHAN_AGE_DAYS, and is not of type "layout" (layouts are structural).
 * Auto-fix: archive each orphaned item via PATCH.
 */
async function checkOrphanedContent(
  api: OpsApiClient,
  content: ContentItem[],
  playlists: Playlist[],
  incidents: Incident[],
  state: { issuesFound: number; issuesFixed: number },
): Promise<void> {
  // Build a set of all content IDs referenced by any playlist
  const referencedIds = new Set<string>();
  for (const playlist of playlists) {
    if (Array.isArray(playlist.items)) {
      for (const item of playlist.items) {
        if (item.contentId) {
          referencedIds.add(item.contentId);
        }
      }
    }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ORPHAN_AGE_DAYS);

  const orphans = content.filter(c => {
    // Skip non-active content, layout types, and recently created content
    if (c.status !== 'active') return false;
    if (c.type === 'layout') return false;
    if (referencedIds.has(c.id)) return false;

    // Must be older than the cutoff
    if (!c.createdAt) return false;
    const created = new Date(c.createdAt);
    return created < cutoff;
  });

  if (orphans.length === 0) {
    log(AGENT, 'No orphaned content found');
    return;
  }

  log(AGENT, `Found ${orphans.length} orphaned content item(s) (not in any playlist, older than ${ORPHAN_AGE_DAYS} days)`);

  for (const item of orphans) {
    state.issuesFound++;
    const label = item.name || item.title || item.id;
    const incidentId = makeIncidentId(AGENT, 'orphaned_content', item.id);

    log(AGENT, `Archiving orphaned content: ${label} (created ${item.createdAt})`);

    try {
      await api.patch(`/content/${item.id}`, { status: 'archived' }, {
        target: 'content',
        targetId: item.id,
        action: `Archive orphaned content "${label}"`,
        before: { status: item.status, createdAt: item.createdAt },
      });

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'orphaned_content',
        severity: 'info',
        target: 'content',
        targetId: item.id,
        detected: new Date().toISOString(),
        message: `Content "${label}" not in any playlist and older than ${ORPHAN_AGE_DAYS} days — auto-archived`,
        remediation: `PATCH /content/${item.id} { status: "archived" }`,
        status: 'resolved',
        attempts: 1,
        resolvedAt: new Date().toISOString(),
      });

      state.issuesFixed++;
      log(AGENT, `Archived orphaned content: ${label}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log(AGENT, `Failed to archive orphaned content ${label}: ${errorMsg}`);

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'orphaned_content',
        severity: 'info',
        target: 'content',
        targetId: item.id,
        detected: new Date().toISOString(),
        message: `Content "${label}" is orphaned — archive failed`,
        remediation: `PATCH /content/${item.id} { status: "archived" }`,
        status: 'open',
        attempts: 1,
        error: errorMsg,
      });
    }
  }
}

// ─── Check: Storage Monitoring ───────────────────────────────────────────────

/**
 * Query the health endpoint for storage utilization stats.
 * Gracefully handles the case where the health endpoint doesn't expose
 * storage information (some deployments may not have this).
 *
 * >90% = critical incident, >80% = warning log.
 */
async function checkStorageUsage(
  api: OpsApiClient,
  incidents: Incident[],
  state: { issuesFound: number; issuesEscalated: number },
): Promise<void> {
  try {
    const health = await api.get<Record<string, unknown>>('/health');

    // Try to extract storage info from various response shapes
    const storage = (health.storage ?? health.disk ?? health.diskUsage) as
      | { usedPercent?: number; usedPct?: number; percentUsed?: number; used?: number; total?: number }
      | undefined;

    if (!storage) {
      log(AGENT, 'Health endpoint does not expose storage stats — skipping storage check');
      return;
    }

    // Determine usage percentage from whichever field is available
    let usagePct: number | null = null;

    if (typeof storage.usedPercent === 'number') {
      usagePct = storage.usedPercent;
    } else if (typeof storage.usedPct === 'number') {
      usagePct = storage.usedPct;
    } else if (typeof storage.percentUsed === 'number') {
      usagePct = storage.percentUsed;
    } else if (typeof storage.used === 'number' && typeof storage.total === 'number' && storage.total > 0) {
      usagePct = (storage.used / storage.total) * 100;
    }

    if (usagePct === null) {
      log(AGENT, 'Could not determine storage usage percentage from health response');
      return;
    }

    log(AGENT, `Storage usage: ${usagePct.toFixed(1)}%`);

    const incidentId = makeIncidentId(AGENT, 'storage_high', 'system');

    if (usagePct >= STORAGE_CRITICAL_PCT) {
      state.issuesFound++;
      state.issuesEscalated++;
      log(AGENT, `CRITICAL: Storage at ${usagePct.toFixed(1)}% (threshold: ${STORAGE_CRITICAL_PCT}%)`);

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'storage_high',
        severity: 'critical',
        target: 'storage',
        targetId: 'system',
        detected: new Date().toISOString(),
        message: `Storage usage at ${usagePct.toFixed(1)}% — exceeds critical threshold of ${STORAGE_CRITICAL_PCT}%`,
        remediation: 'Manual intervention required: expand storage or purge old content',
        status: 'open',
        attempts: 0,
      });
    } else if (usagePct >= STORAGE_WARN_PCT) {
      state.issuesFound++;
      log(AGENT, `WARNING: Storage at ${usagePct.toFixed(1)}% (threshold: ${STORAGE_WARN_PCT}%)`);

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'storage_high',
        severity: 'warning',
        target: 'storage',
        targetId: 'system',
        detected: new Date().toISOString(),
        message: `Storage usage at ${usagePct.toFixed(1)}% — approaching critical threshold of ${STORAGE_CRITICAL_PCT}%`,
        remediation: 'Review and archive unused content to free storage',
        status: 'open',
        attempts: 0,
      });
    } else {
      log(AGENT, `Storage usage healthy: ${usagePct.toFixed(1)}%`);
    }
  } catch (err) {
    // Gracefully handle — storage monitoring is best-effort
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(AGENT, `Storage check failed (non-fatal): ${errorMsg}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  log(AGENT, 'Starting content lifecycle cycle');

  // ─── 1. Auth ──────────────────────────────────────────────────────────────

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
    log(AGENT, `FATAL: Authentication failed — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  const api = new OpsApiClient(baseUrl, token, AGENT);

  // ─── 2. Fetch Data ────────────────────────────────────────────────────────

  let content: ContentItem[];
  let playlists: Playlist[];

  try {
    log(AGENT, 'Fetching content and playlists');
    [content, playlists] = await Promise.all([
      api.getAll<ContentItem>('/content'),
      api.getAll<Playlist>('/playlists'),
    ]);
    log(AGENT, `Fetched ${content.length} content item(s) and ${playlists.length} playlist(s)`);
  } catch (err) {
    log(AGENT, `FATAL: Failed to fetch data — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  // ─── 3. Run Checks ───────────────────────────────────────────────────────

  const opsState = readOpsState();
  const incidents: Incident[] = [];
  const counters = { issuesFound: 0, issuesFixed: 0, issuesEscalated: 0 };

  // 3a. Expired content
  await checkExpiredContent(api, content, incidents, counters);

  // 3b. Orphaned content
  await checkOrphanedContent(api, content, playlists, incidents, counters);

  // 3c. Storage monitoring
  await checkStorageUsage(api, incidents, counters);

  // ─── 4. Record Results & Write State ──────────────────────────────────────

  const durationMs = Date.now() - startTime;

  const result: AgentResult = {
    agent: AGENT,
    timestamp: new Date().toISOString(),
    durationMs,
    issuesFound: counters.issuesFound,
    issuesFixed: counters.issuesFixed,
    issuesEscalated: counters.issuesEscalated,
    incidents,
  };

  recordAgentRun(opsState, result);

  for (const r of api.auditLog) {
    addRemediation(opsState, r);
  }

  writeOpsState(opsState);

  // ─── 5. Summary ───────────────────────────────────────────────────────────

  log(AGENT, `Cycle complete in ${durationMs}ms — found: ${counters.issuesFound}, fixed: ${counters.issuesFixed}, escalated: ${counters.issuesEscalated}`);

  if (counters.issuesFound > 0 && counters.issuesFixed < counters.issuesFound) {
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
