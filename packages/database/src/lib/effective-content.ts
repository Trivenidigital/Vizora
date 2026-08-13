import type { PrismaClient } from '../generated/prisma/index.js';
import { isScheduleActiveAt, previousDay } from './schedule-active.js';

/**
 * The SINGLE definition of "what content should this display show right now?"
 * (T2 coherence ruling). Both delivery channels — the device pull
 * (`GET /devices/me/content`) and the realtime push (`sendInitialState`) — call
 * THIS function, so they can never disagree on priority. Neither channel is
 * authoritative by itself; the resolver output + version is authoritative.
 *
 * Two-layer coherence model:
 *  1. PRIORITY (here): an ACTIVE schedule (highest priority, its window per
 *     `isScheduleActiveAt`) overrides the directly-assigned `currentPlaylist`;
 *     else `currentPlaylist`; else nothing. This is priority, NOT edit-recency.
 *  2. IDEMPOTENCY (`shouldApplyContent`, on the device): the resolver's answer is
 *     applied only when it is a DIFFERENT playlist (boundary / reassignment) or a
 *     NEWER `version` of the same playlist — so a push and a pull feeding the same
 *     resolver output never race or double-apply, and a stale re-delivery is ignored.
 */

export type EffectiveContentSource = 'schedule' | 'currentPlaylist' | 'none';

export interface EffectivePlaylistItem {
  contentId: string;
  order: number;
  duration?: number | null;
  // NOTE: PlaylistItem has NO `updatedAt` column (schema.prisma model PlaylistItem).
  // A field was declared here once and read by contentVersion(), which made it look
  // like items carried their own version floor. They never did — it was always
  // undefined. Removed rather than left as a comment, because a phantom floor is
  // exactly what let the version-regression this file now guards survive review.
  content?: {
    id: string;
    updatedAt?: Date | string | null;
    status?: string | null;
    expiresAt?: Date | string | null;
    [k: string]: unknown;
  } | null;
  [k: string]: unknown;
}

export interface EffectivePlaylist {
  id: string;
  updatedAt?: Date | string | null;
  items?: EffectivePlaylistItem[];
  [k: string]: unknown;
}

export interface EffectiveContent {
  playlist: EffectivePlaylist | null;
  source: EffectiveContentSource;
  scheduleId: string | null;
  /** Max `updatedAt` across the effective content (ISO), '' when none. Monotonic:
   *  any content edit / structural change / reassignment raises it. */
  version: string;
}

// Fetch EVERY linked item, then decide deliverability in code (see splitDeliverable).
//
// This used to filter inside the Prisma include, which was correct for what gets
// DELIVERED and wrong for what gets VERSIONED: contentVersion() only ever saw the
// surviving rows, so dropping the item that carried the max `updatedAt` moved the
// version BACKWARDS. The client gates a same-playlist update on `incoming > current`
// (vizora-tv src/utils.ts), so it then refused the corrected payload and kept
// rendering archived/expired content indefinitely, while heartbeat reconcile —
// which compares with `!==` — signalled drift once a minute forever. (Vizora#325)
//
// The filter still exists; it just moved to where it cannot corrupt the version.
const allContentItemsInclude = {
  items: {
    include: { content: true },
    orderBy: { order: 'asc' as const },
  },
};

/**
 * S1-2: never SERVE expired/archived content. Deliverability only — not versioning.
 *
 * Fails OPEN on an absent field, deliberately. Production always has both values —
 * the include is `content: true`, which selects every scalar — so absence means a
 * caller projected fewer fields, not that the content is unservable. Excluding on a
 * field we were never given would blank a screen to protect against a state we cannot
 * actually observe, and blanking is the worse failure in this system.
 */
function isDeliverable(item: EffectivePlaylistItem, now: Date): boolean {
  const content = item.content;
  if (!content) return false;
  if (content.status != null && content.status !== 'active') return false;
  const expiresAt = content.expiresAt;
  if (expiresAt == null) return true;
  const t = new Date(expiresAt).getTime();
  return Number.isNaN(t) ? true : t > now.getTime();
}

/**
 * Narrow `playlist.items` to the deliverable set and hand back the COMPLETE set for
 * versioning. Returns the full list separately rather than stashing it on the playlist,
 * so it cannot leak into a serialized device payload.
 */
function splitDeliverable(playlist: EffectivePlaylist, now: Date): EffectivePlaylistItem[] {
  const all = playlist.items ?? [];
  playlist.items = all.filter((item) => isDeliverable(item, now));
  return all;
}

const empty: EffectiveContent = { playlist: null, source: 'none', scheduleId: null, version: '' };

export async function resolveEffectiveContent(
  db: Pick<PrismaClient, 'display' | 'schedule' | 'playlist' | 'content'>,
  displayId: string,
  organizationId: string,
  now: Date,
): Promise<EffectiveContent> {
  const display = await db.display.findFirst({
    where: { id: displayId, organizationId },
    select: { timezone: true, isDisabled: true, currentPlaylistId: true },
  });
  if (!display || display.isDisabled) return empty;

  // Compute "now" in the display's local timezone for the schedule-active window.
  const timezone = display.timezone || 'UTC';
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const dayOfWeek = localNow.getDay();
  const currentTime = localNow.getHours() * 60 + localNow.getMinutes();

  // Layer 1a — active schedule wins (highest priority first).
  const candidates = await db.schedule.findMany({
    where: {
      organizationId,
      isActive: true,
      startDate: { lte: now },
      daysOfWeek: { hasSome: [dayOfWeek, previousDay(dayOfWeek)] },
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        { OR: [{ displayId }, { displayGroup: { displays: { some: { displayId } } } }] },
      ],
    },
    orderBy: { priority: 'desc' },
    include: { playlist: { include: allContentItemsInclude } },
  });

  const active = candidates.find((s) =>
    isScheduleActiveAt(
      { daysOfWeek: s.daysOfWeek, startTime: s.startTime, endTime: s.endTime },
      dayOfWeek,
      currentTime,
    ),
  );
  if (active?.playlist) {
    const playlist = active.playlist as unknown as EffectivePlaylist;
    // Split BEFORE zone resolution so zones resolve only for delivered items, and
    // version over the COMPLETE set so a filtered-out item cannot lower the version.
    const allItems = splitDeliverable(playlist, now);
    await resolveLayoutZones(db, playlist, organizationId, now);
    return {
      playlist,
      source: 'schedule',
      scheduleId: active.id,
      version: contentVersion(playlist, active.updatedAt, { versionItems: allItems, now }),
    };
  }

  // Layer 1b — fall back to the directly-assigned currentPlaylist.
  if (display.currentPlaylistId) {
    const found = await db.playlist.findFirst({
      where: { id: display.currentPlaylistId, organizationId },
      include: allContentItemsInclude,
    });
    if (found) {
      const playlist = found as unknown as EffectivePlaylist;
      const allItems = splitDeliverable(playlist, now);
      await resolveLayoutZones(db, playlist, organizationId, now);
      return {
        playlist,
        source: 'currentPlaylist',
        scheduleId: null,
        version: contentVersion(playlist, null, { versionItems: allItems, now }),
      };
    }
  }

  return empty;
}

/**
 * PD-9 — resolve layout ZONE content in the SHARED path (both channels call this via
 * the resolver), so push and pull are identical for layouts. For each item whose
 * content is a layout, each zone's `playlistId`/`contentId` is fetched ORG-SCOPED and
 * inlined as `resolvedPlaylist`/`resolvedContent` (raw — the serializer transforms urls
 * + redacts). Cross-org zone ids resolve to nothing (org filter). Mutates in place.
 */
export async function resolveLayoutZones(
  db: Pick<PrismaClient, 'playlist' | 'content'>,
  playlist: EffectivePlaylist | null,
  organizationId: string,
  now: Date,
): Promise<void> {
  for (const item of playlist?.items ?? []) {
    const content = item.content as Record<string, unknown> | null | undefined;
    if (!content || content.type !== 'layout') continue;
    const metadata = content.metadata as Record<string, unknown> | null | undefined;
    const zones = Array.isArray(metadata?.zones) ? (metadata!.zones as Record<string, unknown>[]) : [];
    for (const zone of zones) {
      if (typeof zone.playlistId === 'string') {
        zone.resolvedPlaylist = await db.playlist.findFirst({
          where: { id: zone.playlistId, organizationId },
          include: allContentItemsInclude,
        });
      }
      if (typeof zone.contentId === 'string') {
        zone.resolvedContent = await db.content.findFirst({
          where: { id: zone.contentId, organizationId },
        });
      }
    }
  }
}

/**
 * Max `updatedAt` (ISO) across the playlist, its items + their content, and the owning
 * schedule. Any content edit, structural change, or reassignment raises it.
 *
 * MONOTONICITY IS THE CONTRACT (Vizora#325): for a given playlist, every semantic
 * change to what a device should show must yield a version STRICTLY GREATER than the
 * last one issued. The shipped client refuses a same-playlist payload whose version did
 * not advance (vizora-tv src/utils.ts), so a version that stalls or regresses does not
 * merely mis-label the payload — it makes the CORRECTED payload undeliverable.
 *
 * Two things are required to hold that, and neither covers the other's case:
 *
 *  - `opts.versionItems` — the COMPLETE linked item set, including items filtered out
 *    of delivery. Covers archive/status changes, which are WRITES: the write bumps
 *    `content.updatedAt`, so while the stamp is still visible the max rises.
 *
 *  - `opts.now` + the expiry-boundary stamp below. Covers time-based expiry, which is
 *    NOT a write: at `expiresAt` the item stops being deliverable with nothing running
 *    anywhere. Retaining its `updatedAt` is useless here — that stamp is identical on
 *    both sides of the boundary, so the payload would change while the version stood
 *    still. Stamping `expiresAt` itself, once crossed, is what advances it:
 *    `setExpiration` writes `updatedAt = now` alongside a future `expiresAt`, so the
 *    boundary is strictly later than the write that scheduled it.
 */
export function contentVersion(
  playlist: EffectivePlaylist | null,
  scheduleUpdatedAt: Date | string | null,
  opts?: { versionItems?: EffectivePlaylistItem[]; now?: Date },
): string {
  if (!playlist) return '';
  const stamps: number[] = [];
  const push = (v: Date | string | null | undefined) => {
    if (v == null) return;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) stamps.push(t);
  };
  push(playlist.updatedAt);
  push(scheduleUpdatedAt);
  // Default to the playlist's own items so existing callers that hand over a plain
  // playlist (e.g. the realtime push fallback) keep working unchanged.
  const versionItems = opts?.versionItems ?? playlist.items ?? [];
  const nowMs = opts?.now ? opts.now.getTime() : Date.now();
  for (const item of versionItems) {
    push(item.content?.updatedAt);
    // The write-free transition. Only ONCE CROSSED — stamping a future expiry would
    // push the version ahead of real time and then swallow every genuine edit made
    // before that date.
    const expiresAt = item.content?.expiresAt;
    if (expiresAt != null) {
      const expMs = new Date(expiresAt).getTime();
      if (!Number.isNaN(expMs) && expMs <= nowMs) stamps.push(expMs);
    }
    // PD-9 — descend into layout zones so a single-zone content edit (a DIFFERENT
    // content row that doesn't bump the layout's own updatedAt) still raises the
    // version, propagating the zone edit. Both channels compute this identically.
    const metadata = (item.content as Record<string, unknown> | null | undefined)?.metadata as
      | Record<string, unknown>
      | null
      | undefined;
    const zones = Array.isArray(metadata?.zones) ? (metadata!.zones as Record<string, unknown>[]) : [];
    for (const zone of zones) {
      const rc = zone.resolvedContent as { updatedAt?: Date | string | null } | null | undefined;
      push(rc?.updatedAt);
      const rp = zone.resolvedPlaylist as
        | { updatedAt?: Date | string | null; items?: Array<{ content?: { updatedAt?: Date | string | null } | null }> }
        | null
        | undefined;
      push(rp?.updatedAt);
      for (const zi of rp?.items ?? []) push(zi.content?.updatedAt);
    }
  }
  if (stamps.length === 0) return '';
  return new Date(Math.max(...stamps)).toISOString();
}

/**
 * Device-side version-wins decision (idempotency layer). Apply the resolver's
 * answer when it is a DIFFERENT playlist (schedule boundary / reassignment — always
 * apply, even if its version is older) OR a NEWER version of the SAME playlist;
 * ignore a same-or-older re-delivery of the same playlist (the push↔pull race, or an
 * exact re-send). ISO version strings compare chronologically as strings.
 */
export function shouldApplyContent(
  incoming: { playlistId: string | null; version: string },
  current: { playlistId: string | null; version: string } | null,
): boolean {
  if (incoming.playlistId == null) return false; // nothing to show
  if (!current || current.playlistId == null) return true; // first content
  if (incoming.playlistId !== current.playlistId) return true; // boundary / reassignment
  return incoming.version > current.version; // same playlist → newer wins, older ignored
}
