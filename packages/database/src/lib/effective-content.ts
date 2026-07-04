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
  updatedAt?: Date | string | null;
  content?: { id: string; updatedAt?: Date | string | null; [k: string]: unknown } | null;
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

// S1-2 filter: never serve expired/archived content. `content` is a required
// relation, so filtering the `items` include drops stale items, never the playlist.
const activeContentItemsInclude = (now: Date) => ({
  items: {
    where: {
      content: {
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
    include: { content: true },
    orderBy: { order: 'asc' as const },
  },
});

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
    include: { playlist: { include: activeContentItemsInclude(now) } },
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
    await resolveLayoutZones(db, playlist, organizationId, now);
    return {
      playlist,
      source: 'schedule',
      scheduleId: active.id,
      version: contentVersion(playlist, active.updatedAt),
    };
  }

  // Layer 1b — fall back to the directly-assigned currentPlaylist.
  if (display.currentPlaylistId) {
    const found = await db.playlist.findFirst({
      where: { id: display.currentPlaylistId, organizationId },
      include: activeContentItemsInclude(now),
    });
    if (found) {
      const playlist = found as unknown as EffectivePlaylist;
      await resolveLayoutZones(db, playlist, organizationId, now);
      return {
        playlist,
        source: 'currentPlaylist',
        scheduleId: null,
        version: contentVersion(playlist, null),
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
          include: activeContentItemsInclude(now),
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

/** Max `updatedAt` (ISO) across the playlist, its items + their content, and the
 *  owning schedule. Any content edit, structural change, or reassignment raises it. */
export function contentVersion(
  playlist: EffectivePlaylist | null,
  scheduleUpdatedAt: Date | string | null,
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
  for (const item of playlist.items ?? []) {
    push(item.updatedAt);
    push(item.content?.updatedAt);
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
