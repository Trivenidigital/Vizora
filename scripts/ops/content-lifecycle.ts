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
 * THE ARCHIVE INVARIANT (K13). Archiving is a soft `status:'archived'` flip, but
 * it STOPS DELIVERY: `isDeliverable` in packages/database/src/lib/effective-content.ts
 * drops non-active content from both playlist items and layout zones. So:
 *
 *   content referenced by ANY valid reference must never become archive-eligible
 *   merely because the reference query was truncated, paginated, or because a
 *   reference TYPE was never considered at all.
 *
 * Three layers enforce it, and none of them is redundant:
 *
 *   1. COMPLETENESS GATES THE WRITE, not just incident resolution. `checkOrphanedContent`
 *      is called only from inside the `contentScanComplete` conditional in `main`.
 *      Before this, an incomplete scan logged, raised `scan-truncated`, and then
 *      archived anyway against the partial universe it had just declared unusable.
 *      `/playlists` is ordered `createdAt: 'desc'`, so truncation drops the OLDEST
 *      playlists — maximally correlated with the >30d archive-eligible population.
 *   2. PER-CANDIDATE CONFIRMATION. Every candidate is re-read with `GET /content/:id`
 *      immediately before its archive, and refused if it carries any `playlistItems`.
 *      This inverts the question from "reconstruct the universe, then diff" (which is
 *      truncatable by construction) to "is THIS item referenced" (which is not), and
 *      shrinks the concurrency window from the whole run to one request.
 *   3. REFERENCE TYPES BEYOND PLAYLISTS. Layout zones (`metadata.zones[].contentId`)
 *      pin content directly, and `replacementContentId` pins the expiry swap target.
 *      Neither is visible in `CONTENT_LIST_SELECT`, so neither could ever be seen from
 *      the list walk. Both are harvested from `GET /content/:id`, which uses `include`
 *      and therefore returns every scalar.
 *
 * RAISING THE PAGE-WALK CAP IS NOT THE FIX. It re-arms the identical defect at the
 * new number and leaves types 2 and 3 wide open at any scale.
 *
 * Incident clearing is PER-CHECK, not per-run. This agent degrades in parts —
 * the content checks and the storage probe fail independently — so it tracks
 * three coverage keys and resolves only the incident types whose check actually
 * completed. `storage_high` in particular could never clear before: the healthy
 * branch pushes no incident, so a warning raised at 91% survived every
 * subsequent run at 40%, pinning ops-state at CRITICAL forever.
 *
 * Exit codes:
 *   0 — no issues found
 *   1 — issues found (some may have been auto-fixed)
 *   2 — fatal error (agent could not complete)
 *
 * The exit code is computed from DETECTION only — resolving stale incidents can
 * never turn a run with an open finding green.
 */

import 'dotenv/config';
import type { Incident, AgentResult } from './lib/types.js';
import {
  readOpsState,
  writeOpsState,
  recordAgentRun,
  addRemediation,
  makeIncidentId,
  resolveNotReraisedForTypes,
} from './lib/state.js';
import { login, releaseSessions, OpsApiClient, MAX_ENTITIES } from './lib/api-client.js';
import { log, sendInlineAlert } from './lib/alerting.js';
import { classifyArchiveError } from './lib/archive-error.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT = 'content-lifecycle';

/** Content older than this (in days) with no playlist attachment is orphaned */
const ORPHAN_AGE_DAYS = 30;

/** Storage utilization thresholds */
const STORAGE_WARN_PCT = 80;
const STORAGE_CRITICAL_PCT = 90;

/**
 * Ceiling on how many orphan candidates one run will confirm-and-archive.
 *
 * The per-candidate confirmation costs one `GET /content/:id` per candidate and
 * `OpsApiClient` holds a 100ms rate-limit floor, so an unbounded candidate set
 * would let a single firing run for minutes and overlap the next one. The
 * remainder is DEFERRED to the next firing and logged by count — never dropped
 * silently, because "we archived 100 and forgot the rest" and "there were only
 * 100" must not look the same in the log.
 */
const MAX_ARCHIVE_CANDIDATES_PER_RUN = 100;

// ─── Content & Playlist Types ────────────────────────────────────────────────

/**
 * A content row as it comes back from the LIST endpoint.
 *
 * Deliberately narrow: `GET /content` projects through `CONTENT_LIST_SELECT`
 * (middleware/src/modules/content/content-list-select.ts), which selects
 * id/organizationId/name/type/thumbnail/duration/fileSize/status/folderId/
 * createdAt/updatedAt/tags and NOTHING else. `metadata`, `expiresAt`,
 * `replacementContentId` and `isGlobal` are all absent from the list — they are
 * only readable through `GET /content/:id` (`ContentService.findOne`, which uses
 * `include` and so returns every scalar). A field typed here but never sent reads
 * `undefined` at runtime and turns a filter into a silent no-op — which is exactly
 * what `expiresAt` below already is. It is left typed because `checkExpiredContent`
 * reads it, and REPOINTING that check is out of scope for this change; it is
 * recorded in backlog.md as a dead no-op rather than quietly repaired here.
 */
interface ContentItem {
  id: string;
  name?: string;
  title?: string;
  type: string;
  status?: string;
  /** NOT in `CONTENT_LIST_SELECT` — always `undefined` off the list walk. */
  expiresAt?: string;
  fileSize?: number;
  createdAt?: string;
}

/**
 * A content row as it comes back from `GET /content/:id`.
 *
 * This is the only shape that can answer "is this item referenced": it carries
 * `playlistItems` (the authoritative, untruncatable reverse lookup), `metadata`
 * (layout zone pins), `replacementContentId` (the expiry swap target) and
 * `isGlobal`.
 */
interface ContentDetail extends ContentItem {
  metadata?: unknown;
  replacementContentId?: string | null;
  isGlobal?: boolean;
  playlistItems?: unknown[];
}

interface Playlist {
  id: string;
  name?: string;
  items?: { contentId: string }[];
}

type ContentLifecycleCounters = {
  issuesFound: number;
  issuesFixed: number;
  issuesEscalated: number;
  fatalDetected: boolean;

  // ─── Coverage keys ────────────────────────────────────────────────────────
  //
  // Which of this agent's checks actually COMPLETED this run. They gate
  // incident resolution, because "not re-raised" only means "resolved" when
  // the run looked. Unlike schedule-doctor's single all-or-nothing fetch,
  // content-lifecycle degrades in parts: the content checks and the storage
  // probe fail independently, so a run where `/health` threw still completed
  // the content checks. A blanket sweep would report storage recovered on the
  // strength of a run that could not read storage.

  /** Content + playlists both fetched, neither at the page-walk cap. */
  contentScanComplete: boolean;
  /**
   * Every layout's detail was read, so `metadata.zones[].contentId` pins are
   * fully harvested. False means the reference universe is knowingly partial and
   * the archive loop must not run — same safety class as `contentScanComplete`.
   */
  referenceHarvestComplete: boolean;
  /** `/health` answered AND a numeric usage percentage was derived from it. */
  storageVerdictReached: boolean;
  /** The `/health` GET did not throw — whatever it then contained. */
  storageProbeReached: boolean;
};

/** Types covered by `contentScanComplete`. */
const CONTENT_SCAN_TYPES: ReadonlySet<string> = new Set([
  'expired_content',
  // Raised when the scan was NOT complete, so a complete scan must clear it.
  'scan-truncated',
]);

/**
 * Types covered by `contentScanComplete` AND `referenceHarvestComplete`.
 *
 * The orphan check is the only one that can now be SKIPPED while the run
 * otherwise succeeds — the completeness gate and the layout-harvest fail-closed
 * both return without it. A skipped check has looked at nothing, so it cannot
 * be evidence that an `orphaned_content` finding cleared. This is the same
 * distinction the storage keys draw, applied to the check this change gated:
 * splitting it out is not tidiness, it is the difference between "the orphan
 * check found nothing" and "the orphan check did not run".
 */
const ORPHAN_SCAN_TYPES: ReadonlySet<string> = new Set([
  'orphaned_content',
  // Raised when a layout detail could not be read. Clearing it needs a run that
  // both saw the whole tenant and read every layout — exactly this key pair.
  'reference-scan-incomplete',
]);

/**
 * Types covered by `storageVerdictReached`.
 *
 * A verdict means a number was actually read. The three no-verdict exits —
 * `/health` has no storage field, the field is unparseable, the GET threw —
 * resolve NOTHING here (health-guardian's `no-verdict` precedent). Storage
 * sitting at 91% is exactly the state where the probe is most likely to be
 * unreadable, and clearing the incident on a run that read nothing is a false
 * all-clear on the loudest possible signal.
 */
const STORAGE_VERDICT_TYPES: ReadonlySet<string> = new Set(['storage_high']);

/**
 * Types covered by `storageProbeReached`.
 *
 * `storage_check_failed` says "the probe threw". Its subject is the request,
 * not the payload — so a `/health` that answers 200 with no storage fields
 * DISPROVES it and clears it, even though that same run reaches no storage
 * verdict and so cannot touch `storage_high`.
 */
const STORAGE_PROBE_TYPES: ReadonlySet<string> = new Set(['storage_check_failed']);

// ─── Check: Expired Content ──────────────────────────────────────────────────

/**
 * Find active content with an expiresAt date in the past.
 * Auto-fix: archive each expired item via POST /content/:id/archive.
 */
async function checkExpiredContent(
  api: OpsApiClient,
  content: ContentItem[],
  incidents: Incident[],
  state: ContentLifecycleCounters,
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
      await api.post(`/content/${item.id}/archive`, {}, {
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
        remediation: `POST /content/${item.id}/archive`,
        status: 'resolved',
        attempts: 1,
        resolvedAt: new Date().toISOString(),
      });

      state.issuesFixed++;
      log(AGENT, `Archived expired content: ${label}`);
      // §12b: write-site alert. The operator uploaded this content and
      // set an expiry; we just flipped its status to archived. Tell
      // them within seconds, not at the next ops-reporter cycle.
      await sendInlineAlert(
        AGENT,
        'warning',
        `Auto-archived expired content "${label}"`,
        `Content id ${item.id} reached its expiresAt (${item.expiresAt}) and was archived. If still needed, restore via the content library and update the expiry date.`,
      );
    } catch (err) {
      const classified = classifyArchiveError(err);

      if (classified.kind === 'already_archived' || classified.kind === 'not_found') {
        incidents.push({
          id: incidentId,
          agent: AGENT,
          type: 'expired_content',
          severity: 'warning',
          target: 'content',
          targetId: item.id,
          detected: new Date().toISOString(),
          message: `Content "${label}" expired - ${classified.kind === 'not_found' ? 'no longer found' : 'already archived'}`,
          remediation: `POST /content/${item.id}/archive`,
          status: 'resolved',
          attempts: 1,
          resolvedAt: new Date().toISOString(),
        });
        state.issuesFixed++;
        log(AGENT, `Expired content ${classified.kind === 'not_found' ? 'no longer found' : 'already archived'}: ${label}`);
        continue;
      }

      if (classified.kind === 'fatal') {
        state.fatalDetected = true;
        log(AGENT, `FATAL: archive endpoint returned ${classified.status} for ${label}: ${classified.message}`);
      } else {
        log(AGENT, `Failed to archive expired content ${label}: ${classified.message}`);
      }

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'expired_content',
        severity: classified.kind === 'fatal' ? 'critical' : 'warning',
        target: 'content',
        targetId: item.id,
        detected: new Date().toISOString(),
        message: `Content "${label}" expired on ${item.expiresAt} - archive failed (${classified.kind})`,
        remediation: `POST /content/${item.id}/archive`,
        status: 'open',
        attempts: 1,
        error: classified.message,
      });
    }
  }
}

// ─── Check: Orphaned Content ─────────────────────────────────────────────────

/**
 * Collect the `contentId`s a layout pins directly into its zones.
 *
 * Shape: `metadata.zones[].contentId`, resolved by `resolveLayoutZones` in
 * packages/database/src/lib/effective-content.ts:250-257 and then filtered by
 * `isDeliverable` (:85-93) — so a zone-pinned content that goes `archived`
 * resolves to `null` and BLANKS THAT ZONE on live glass. Tolerant by design:
 * anything that is not a string `contentId` is ignored rather than thrown on,
 * because a metadata-shape surprise must not abort the harvest that keeps the
 * archive loop honest.
 */
function harvestZoneContentIds(metadata: unknown, into: Set<string>): void {
  if (!metadata || typeof metadata !== 'object') return;
  const zones = (metadata as { zones?: unknown }).zones;
  if (!Array.isArray(zones)) return;
  for (const zone of zones) {
    if (!zone || typeof zone !== 'object') continue;
    const contentId = (zone as { contentId?: unknown }).contentId;
    if (typeof contentId === 'string' && contentId) into.add(contentId);
  }
}

/**
 * Find content that is not referenced by any playlist, is older than
 * ORPHAN_AGE_DAYS, and is not of type "layout" (layouts are structural).
 * Auto-fix: archive each orphaned item via POST /content/:id/archive.
 *
 * DESTRUCTIVE. Call this ONLY from inside the `contentScanComplete` conditional
 * in `main` — a partial reference universe cannot prove anything is orphaned,
 * and a source-scan test (`content-lifecycle-archive-gate.test.ts`) pins that
 * call site so the gate cannot be dropped in a refactor.
 */
async function checkOrphanedContent(
  api: OpsApiClient,
  content: ContentItem[],
  playlists: Playlist[],
  incidents: Incident[],
  state: ContentLifecycleCounters,
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

  // ── GAP-1: layout zone pins ────────────────────────────────────────────────
  // A `type:'layout'` content pins other content straight into its zones. The
  // agent has always skipped layouts THEMSELVES, but never what they point at —
  // and it structurally could not see them, because `CONTENT_LIST_SELECT` omits
  // `metadata`. This is live-reachable at ANY tenant size; no truncation needed.
  const layouts = content.filter(c => c.type === 'layout');
  if (layouts.length > 0) {
    log(AGENT, `Harvesting zone references from ${layouts.length} layout(s)`);
  }
  for (const layout of layouts) {
    let detail: ContentDetail;
    try {
      detail = await api.get<ContentDetail>(`/content/${layout.id}`);
    } catch (err) {
      // FAIL CLOSED. One unreadable layout means the reference universe is
      // partial in exactly the way that blanks a zone, so no archive may run.
      state.referenceHarvestComplete = false;
      const message = err instanceof Error ? err.message : String(err);
      log(AGENT, `Could not read layout ${layout.id} — ${message}`);
      incidents.push({
        id: makeIncidentId(AGENT, 'reference-scan-incomplete', 'layout-zones'),
        agent: AGENT,
        type: 'reference-scan-incomplete',
        severity: 'info',
        target: 'content',
        targetId: 'layout-zones',
        detected: new Date().toISOString(),
        message:
          `Layout ${layout.id} could not be read (${message}), so its zone-pinned content is ` +
          'unknown. No orphan archive will run this cycle — archiving a zone-pinned item blanks ' +
          'that zone on live screens.',
        remediation: 'Transient: the next cycle retries. Persistent: check GET /api/v1/content/:id.',
        status: 'open',
        attempts: 0,
      });
      break;
    }
    harvestZoneContentIds(detail.metadata, referencedIds);
    // Free while we are here: this layout's own expiry replacement target.
    if (typeof detail.replacementContentId === 'string' && detail.replacementContentId) {
      referencedIds.add(detail.replacementContentId);
    }
  }

  if (!state.referenceHarvestComplete) {
    log(AGENT, 'SKIP orphan archive: the layout zone-reference harvest did not complete');
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ORPHAN_AGE_DAYS);

  const candidates = content.filter(c => {
    // Skip non-active content, layout types, and recently created content
    if (c.status !== 'active') return false;
    if (c.type === 'layout') return false;
    if (referencedIds.has(c.id)) return false;

    // Must be older than the cutoff
    if (!c.createdAt) return false;
    const created = new Date(c.createdAt);
    return created < cutoff;
  });

  if (candidates.length === 0) {
    log(AGENT, 'No orphaned content found');
    return;
  }

  // Bound the work per firing. The remainder is deferred, not dropped.
  const batch = candidates.slice(0, MAX_ARCHIVE_CANDIDATES_PER_RUN);
  if (candidates.length > batch.length) {
    log(
      AGENT,
      `Deferring ${candidates.length - batch.length} orphan candidate(s) to the next cycle ` +
        `(per-run cap ${MAX_ARCHIVE_CANDIDATES_PER_RUN}); confirming ${batch.length} this cycle`,
    );
  }

  log(AGENT, `Found ${candidates.length} orphan candidate(s) (not in any playlist, older than ${ORPHAN_AGE_DAYS} days)`);

  // ── Pass 1: confirm each candidate INDIVIDUALLY ────────────────────────────
  // `GET /content/:id` (ContentService.findOne) includes `playlistItems`, which
  // is the reverse lookup the list walk can never be: it is a per-item question,
  // so it is untruncatable by construction and its answer is at most one request
  // old rather than one whole run old.
  const confirmed: ContentItem[] = [];
  for (const item of batch) {
    let detail: ContentDetail;
    try {
      detail = await api.get<ContentDetail>(`/content/${item.id}`);
    } catch (err) {
      // Unconfirmed is never archived. A 404 here is also not an invitation to
      // act — it just means this run cannot establish orphanhood.
      log(
        AGENT,
        `Skipping ${item.id}: could not confirm it is unreferenced — ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    if (Array.isArray(detail.playlistItems) && detail.playlistItems.length > 0) {
      log(
        AGENT,
        `Skipping ${item.id}: the per-item read found ${detail.playlistItems.length} playlist reference(s) the list walk did not show`,
      );
      continue;
    }

    if (detail.isGlobal === true) {
      // Template-library content is shared platform-wide; "in no playlist of the
      // org this agent can see" says nothing about its use elsewhere. `isGlobal`
      // is not in `CONTENT_LIST_SELECT`, so this could only ever be checked here.
      log(AGENT, `Skipping ${item.id}: isGlobal template-library content`);
      continue;
    }

    // ── GAP-2: this item's expiry replacement target ─────────────────────────
    // `Content.replacementContentId` (schema.prisma:290-291) is swapped in when
    // the referrer expires; archiving the target lands the swap on dead content.
    // Harvested here because it is absent from `CONTENT_LIST_SELECT`.
    //
    // KNOWN RESIDUAL, stated plainly rather than implied covered: this harvests
    // the replacement pointers of the LAYOUTS and the CONFIRMED CANDIDATES only,
    // because those are the only details this run reads. A referrer whose detail
    // is never read still hides its `replacementContentId` from us, and its
    // target can still be archived. Four ways to be that referrer:
    //
    //   - younger than the cutoff
    //   - already archived
    //   - held by a playlist
    //   - DEFERRED PAST `MAX_ARCHIVE_CANDIDATES_PER_RUN` — pass 1 reads details
    //     for the first 100 candidates only, so candidate #120 is an ORDINARY
    //     candidate whose pointer is simply not read this cycle. If it points at
    //     candidate #5, #5 is archived and #120's expiry swap lands on archived
    //     content. This one is introduced by the per-run cap added in this
    //     change, so it is named rather than left for the next reader to find.
    //
    // Closing all four needs the reverse edge server-side — `Content.replacedBy`
    // is already a Prisma relation — which is the `GET /content/orphan-candidates`
    // backlog row (K21), not something the page-walk can be talked into answering.
    if (typeof detail.replacementContentId === 'string' && detail.replacementContentId) {
      referencedIds.add(detail.replacementContentId);
    }

    confirmed.push(item);
  }

  // ── Pass 2: archive only what survived BOTH filters ────────────────────────
  // Two passes, not one, so the outcome does not depend on iteration order: a
  // candidate may be named as ANOTHER candidate's `replacementContentId` and
  // that is only known once every detail has been read.
  const orphans = confirmed.filter(item => {
    if (referencedIds.has(item.id)) {
      log(AGENT, `Skipping ${item.id}: named as another item's replacement content`);
      return false;
    }
    return true;
  });

  if (orphans.length === 0) {
    log(AGENT, 'No orphaned content confirmed after per-item reference checks');
    return;
  }

  log(AGENT, `Confirmed ${orphans.length} orphaned content item(s) for archive`);

  for (const item of orphans) {
    state.issuesFound++;
    const label = item.name || item.title || item.id;
    const incidentId = makeIncidentId(AGENT, 'orphaned_content', item.id);

    log(AGENT, `Archiving orphaned content: ${label} (created ${item.createdAt})`);

    try {
      await api.post(`/content/${item.id}/archive`, {}, {
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
        remediation: `POST /content/${item.id}/archive`,
        status: 'resolved',
        attempts: 1,
        resolvedAt: new Date().toISOString(),
      });

      state.issuesFixed++;
      log(AGENT, `Archived orphaned content: ${label}`);
      // §12b: write-site alert. Orphan archive is gentler than expiry —
      // the operator never picked an expiry, the cron is just garbage-
      // collecting unused content after ORPHAN_AGE_DAYS. Still surfaces
      // so an operator can restore if they were saving it for later.
      await sendInlineAlert(
        AGENT,
        'warning',
        `Auto-archived orphaned content "${label}"`,
        `Content id ${item.id} was not referenced by any playlist and was older than ${ORPHAN_AGE_DAYS} days. Archived automatically. Restore via the content library if you still need it.`,
      );
    } catch (err) {
      const classified = classifyArchiveError(err);

      if (classified.kind === 'already_archived' || classified.kind === 'not_found') {
        incidents.push({
          id: incidentId,
          agent: AGENT,
          type: 'orphaned_content',
          severity: 'info',
          target: 'content',
          targetId: item.id,
          detected: new Date().toISOString(),
          message: `Content "${label}" is orphaned - ${classified.kind === 'not_found' ? 'no longer found' : 'already archived'}`,
          remediation: `POST /content/${item.id}/archive`,
          status: 'resolved',
          attempts: 1,
          resolvedAt: new Date().toISOString(),
        });
        state.issuesFixed++;
        log(AGENT, `Orphaned content ${classified.kind === 'not_found' ? 'no longer found' : 'already archived'}: ${label}`);
        continue;
      }

      if (classified.kind === 'fatal') {
        state.fatalDetected = true;
        log(AGENT, `FATAL: archive endpoint returned ${classified.status} for ${label}: ${classified.message}`);
      } else {
        log(AGENT, `Failed to archive orphaned content ${label}: ${classified.message}`);
      }

      incidents.push({
        id: incidentId,
        agent: AGENT,
        type: 'orphaned_content',
        severity: classified.kind === 'fatal' ? 'critical' : 'info',
        target: 'content',
        targetId: item.id,
        detected: new Date().toISOString(),
        message: `Content "${label}" is orphaned - archive failed (${classified.kind})`,
        remediation: `POST /content/${item.id}/archive`,
        status: 'open',
        attempts: 1,
        error: classified.message,
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
  state: ContentLifecycleCounters,
): Promise<void> {
  try {
    const health = await api.get<Record<string, unknown>>('/health');

    // The request itself succeeded. That alone disproves `storage_check_failed`
    // — whose subject is "the probe threw" — regardless of what came back.
    state.storageProbeReached = true;

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

    // A real number was read, so this run is entitled to say storage recovered.
    state.storageVerdictReached = true;
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
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(AGENT, `Storage check failed: ${errorMsg}`);
    state.issuesFound++;
    incidents.push({
      id: makeIncidentId(AGENT, 'storage_check_failed', 'system'),
      agent: AGENT,
      type: 'storage_check_failed',
      severity: 'warning',
      target: 'storage',
      targetId: 'system',
      detected: new Date().toISOString(),
      message: `Storage monitoring could not run - ${errorMsg}`,
      remediation: 'Check /health endpoint and storage subsystem',
      status: 'open',
      attempts: 1,
      error: errorMsg,
    });
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
  let contentScanComplete: boolean;

  try {
    log(AGENT, 'Fetching content and playlists');
    // getAllScan, not getAll: the completeness verdict gates incident
    // resolution below and must come from the fetch layer that actually knows
    // (server-reported `meta.total` where present). An unrecognized response
    // shape now THROWS into this catch instead of yielding a silent empty list.
    const [contentScan, playlistScan] = await Promise.all([
      api.getAllScan<ContentItem>('/content'),
      api.getAllScan<Playlist>('/playlists'),
    ]);
    content = contentScan.items;
    playlists = playlistScan.items;
    contentScanComplete = contentScan.complete && playlistScan.complete;
    log(AGENT, `Fetched ${content.length} content item(s) and ${playlists.length} playlist(s)`);
  } catch (err) {
    log(AGENT, `FATAL: Failed to fetch data — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  // ─── 3. Run Checks ───────────────────────────────────────────────────────

  const incidents: Incident[] = [];
  const counters: ContentLifecycleCounters = {
    issuesFound: 0,
    issuesFixed: 0,
    issuesEscalated: 0,
    fatalDetected: false,
    contentScanComplete,
    referenceHarvestComplete: true,
    storageVerdictReached: false,
    storageProbeReached: false,
  };

  // Truncation is announced, never silent. Withholding resolution quietly would
  // drop a legitimately-large tenant into a permanent no-resolution regime with
  // no signal saying why.
  //
  // INFO, and deliberately NOT counted in `issuesFound`. Only a code change can
  // clear it, so counting it would pin a legitimately-large tenant at exit 1 /
  // DEGRADED on every run forever — the alert-fatigue pattern the
  // db-maintenance exit-code rule exists to prevent.
  if (!counters.contentScanComplete) {
    log(
      AGENT,
      `Content scan was incomplete (content=${content.length}, playlists=${playlists.length}, ` +
      `cap=${MAX_ENTITIES}) — the orphan archive is SKIPPED and no content incident ` +
      'will be resolved this run',
    );
    incidents.push({
      id: makeIncidentId(AGENT, 'scan-truncated', 'entity-lists'),
      agent: AGENT,
      type: 'scan-truncated',
      severity: 'info',
      target: 'content',
      targetId: 'entity-lists',
      detected: new Date().toISOString(),
      message:
        `Content lifecycle could not see the whole tenant (content=${content.length}, ` +
        `playlists=${playlists.length}, page-walk cap ${MAX_ENTITIES}). The orphan archive is ` +
        'SKIPPED this cycle, and no prior content incident can be cleared from a partial scan.',
      // Deliberately NOT "raise the page-walk cap". That is the fix this change
      // rejects: it re-arms the identical defect at the new number, and the
      // truncation drops the OLDEST playlists (`createdAt: 'desc'`) — precisely
      // the ones most likely to hold the >30d content the archive targets.
      remediation:
        'No action needed for correctness — the destructive path is already gated off. ' +
        'The durable fix is a server-side reference model (GET /content/orphan-candidates), ' +
        'which removes the pagination surface instead of moving it. Do NOT raise the page-walk cap.',
      status: 'open',
      attempts: 0,
    });
  }

  // 3a. Expired content.
  // NOT gated: its predicate reads only the item's own fields (status + expiresAt),
  // so a truncated list yields FEWER expiry findings, never a wrong one. Different
  // safety class from the orphan check, which asserts a negative about the whole
  // tenant ("nothing references this").
  await checkExpiredContent(api, content, incidents, counters);

  // 3b. Orphaned content — DESTRUCTIVE, and gated on a provably complete scan.
  //
  // The gate folds BOTH scans into one flag, and that is deliberate. Playlist
  // truncation is the sharp edge (`/playlists` is `createdAt: 'desc'`, so the
  // OLDEST playlists are dropped — maximally correlated with >30d candidates).
  // Content truncation used to be purely safe-direction, but no longer is: since
  // layouts are now a reference SOURCE, a dropped layout page silently removes
  // zone pins from the reference universe. Fewer candidates does not compensate
  // for fewer references.
  //
  // A source-scan test pins this call site inside this conditional. #353 gated
  // incident RESOLUTION on completeness but left the write unconditional; the
  // test exists so that cannot happen again.
  if (counters.contentScanComplete) {
    await checkOrphanedContent(api, content, playlists, incidents, counters);
  } else {
    log(
      AGENT,
      'SKIP orphan archive: the reference universe is knowingly partial, so nothing can be ' +
        'proven unreferenced. Archiving stops delivery to screens — it is never done on a guess.',
    );
  }

  // 3c. Storage monitoring
  await checkStorageUsage(api, incidents, counters);

  // ─── 4. Record Results & Write State ──────────────────────────────────────

  const durationMs = Date.now() - startTime;

  // Pin the exit code to DETECTION, before resolutions inflate `issuesFixed`.
  // A run that clears three stale incidents while storage is still at 91% is a
  // failing run; letting resolutions count toward the fixed tally greens it.
  const detectionExitCode = counters.fatalDetected
    ? 2
    : counters.issuesFound > 0 && counters.issuesFixed < counters.issuesFound
      ? 1
      : 0;

  const result: AgentResult = {
    agent: AGENT,
    timestamp: new Date().toISOString(),
    durationMs,
    issuesFound: counters.issuesFound,
    issuesFixed: counters.issuesFixed,
    issuesEscalated: counters.issuesEscalated,
    incidents,
  };

  // Only the checks that actually COMPLETED get to clear their own incidents.
  // Assembling the covered set from the three coverage keys is what keeps a
  // degraded run honest: with `/health` down, the content checks still clear
  // their findings while `storage_high` correctly stays open.
  const coveredTypes = new Set<string>([
    ...(counters.contentScanComplete ? CONTENT_SCAN_TYPES : []),
    ...(counters.contentScanComplete && counters.referenceHarvestComplete
      ? ORPHAN_SCAN_TYPES
      : []),
    ...(counters.storageVerdictReached ? STORAGE_VERDICT_TYPES : []),
    ...(counters.storageProbeReached ? STORAGE_PROBE_TYPES : []),
  ]);

  // Brief locked read→merge→write. The sweep is pure computation over
  // `opsState.incidents` — no network, no subprocess — and has to be here
  // because prior incidents are only readable under the lock.
  const opsState = readOpsState();
  try {
    const resolved = resolveNotReraisedForTypes(
      opsState.incidents,
      AGENT,
      new Set(incidents.map(i => i.id)),
      coveredTypes,
    );
    for (const r of resolved) {
      log(AGENT, `Resolving stale incident: ${r.id}`);
      incidents.push(r);
    }
    counters.issuesFixed += resolved.length;
    result.issuesFixed = counters.issuesFixed;

    recordAgentRun(opsState, result);

    for (const r of api.auditLog) {
      addRemediation(opsState, r);
    }
  } finally {
    writeOpsState(opsState);
  }

  // ─── 5. Summary ───────────────────────────────────────────────────────────

  log(AGENT, `Cycle complete in ${durationMs}ms — found: ${counters.issuesFound}, fixed: ${counters.issuesFixed}, escalated: ${counters.issuesEscalated}${counters.fatalDetected ? ', FATAL API drift detected' : ''}`);

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
