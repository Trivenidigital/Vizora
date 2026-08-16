'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { fetchAllPaginated } from '@/lib/api/pagination';
import { PlaylistSummary, PlaylistItemSummary, Display } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import SearchFilter from '@/components/SearchFilter';
import DeviceStatusIndicator from '@/components/DeviceStatusIndicator';
import DashboardSectionError from '@/components/DashboardSectionError';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeEvents } from '@/lib/hooks';
import { getDashboardPermissions } from '@/lib/permissions';
import { Icon } from '@/theme/icons';
import PlaylistPreview from '@/components/PlaylistPreview';

/**
 * The shape buckets a playlist library is scanned by.
 *
 * These are not a partition: `empty` overlaps `unassigned` (and can overlap
 * `assigned` — an empty playlist assigned to a screen is a real and worth-seeing
 * state). The strip says so rather than leaving the arithmetic to be discovered.
 */
const SHAPE_FILTERS = ['assigned', 'unassigned', 'empty'] as const;
type ShapeFilter = (typeof SHAPE_FILTERS)[number];

const SHAPE_LABEL: Record<ShapeFilter, string> = {
  assigned: 'Assigned',
  unassigned: 'Unassigned',
  empty: 'Empty',
};

type SortKey = 'updated' | 'name' | 'items';

const SORT_LABEL: Record<SortKey, string> = {
  updated: 'Recently updated',
  name: 'Name (A–Z)',
  items: 'Most items',
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * One pass through the playlist, not a runtime.
 *
 * `Playlist.loop` defaults true (schema.prisma), so the sum below is a cycle
 * length and the label has to say "per cycle" — a bare "4m 20s" reads as how
 * long the playlist runs, which for a looping playlist is unbounded.
 *
 * The fallback chain mirrors the server's (`playlists.service.ts:170`): item
 * override, then the content's NOMINAL duration, then 10. It used to be `|| 30`
 * here against `|| 10` there, so the number the client computed when
 * `totalDuration` was absent disagreed with the number the server sent when it
 * was present, for the same playlist.
 */
const cycleSeconds = (playlist: PlaylistSummary) => {
  if (typeof playlist.totalDuration === 'number') return playlist.totalDuration;
  return (playlist.items || []).reduce(
    (sum, item) => sum + (item.duration || item.content?.duration || 10),
    0,
  );
};

const formatCycle = (total: number) => {
  if (total === 0) return '0s';
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

/**
 * Items a screen will refuse to play.
 *
 * `isDeliverable` (packages/database/src/lib/effective-content.ts) drops any item
 * whose content is not `active`, so "12 items" on this page can be 9 items on the
 * screen. The list endpoint selects `content.status`, so the non-active half of
 * that filter is answerable here; its expiry half is NOT — `expiresAt` is outside
 * `CONTENT_LIST_SELECT` — which is why the copy says "at least" and never states
 * a deliverable total.
 */
const skippedItemCount = (items: PlaylistItemSummary[]) =>
  items.filter((item) => item.content && item.content.status !== 'active').length;

/** Content states a screen refuses, said in words rather than echoed as an API token. */
const CONTENT_STATUS_LABEL: Record<string, string> = {
  archived: 'Archived',
  expired: 'Expired',
  draft: 'Draft',
  processing: 'Processing',
  error: 'Failed',
};

/**
 * A date that may not be a date.
 *
 * `new Date('nonsense').toISOString()` throws `RangeError`, and a throw inside
 * render takes the whole route down. The previous card called
 * `toLocaleDateString()` alone, which degrades to the string "Invalid Date" — so
 * adding `<time dateTime>` for the machine-readable timestamp would have traded
 * graceful degradation for a page crash. Returning null lets the caller drop the
 * attribute and keep rendering.
 */
const parseDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * A playlist card.
 *
 * MUST stay at module scope. Declared inside the page component its identity is a
 * new function every render, so React remounts the subtree instead of updating
 * it — which destroys the button the operator just activated. This page
 * re-renders on every debounced keystroke and on every realtime `playlist:update`,
 * so focus could be yanked with no user action at all. `playlists-page.test.tsx`
 * pins `document.activeElement` against the SAME node reference across a
 * re-render; comparing a re-queried node would pass either way, because the
 * re-query finds the replacement.
 */
function PlaylistCard({
  playlist,
  assignedScreens,
  screensKnown,
  canManage,
  canDelete,
  onPreview,
  onEdit,
  onAssign,
  onDuplicate,
  onDelete,
}: {
  playlist: PlaylistSummary;
  assignedScreens: number;
  screensKnown: boolean;
  canManage: boolean;
  canDelete: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onAssign: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const items = playlist.items || [];
  const itemCount = playlist.itemCount ?? items.length;
  const skipped = skippedItemCount(items);
  const updatedAt = parseDate(playlist.updatedAt);
  const scheduleCount = playlist._count?.schedules ?? 0;
  const thumbs = items
    .slice(0, 4)
    .map((item) => item.content?.thumbnailUrl || '')
    .filter(Boolean);

  return (
    <article className="eh-dash-card flex h-full flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        {/* Identity mosaic. One thumbnail fills the tile rather than sitting in
            the top-left quarter of a 2x2 grid with three empty cells, which is
            what a single-item playlist used to render. */}
        {thumbs.length === 0 ? (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-tertiary)]">
            <Icon name="playlists" size="xl" aria-hidden />
          </span>
        ) : thumbs.length === 1 ? (
          <img
            src={thumbs[0]}
            alt=""
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.png';
            }}
          />
        ) : (
          <span className="grid h-20 w-20 shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-xl bg-[var(--border)]">
            {Array.from({ length: 4 }).map((_, i) =>
              thumbs[i] ? (
                <img
                  key={i}
                  src={thumbs[i]}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.png';
                  }}
                />
              ) : (
                <span key={i} className="h-full w-full bg-[var(--background-secondary)]" />
              ),
            )}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="eh-dash-subtitle text-lg" title={playlist.name}>
            {playlist.name}
          </h3>
          {playlist.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-[var(--foreground-secondary)]">
              {playlist.description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--foreground-tertiary)]">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Icon name="playlists" size="sm" aria-hidden />
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            <span
              className="inline-flex items-center gap-1.5 tabular-nums"
              title="Sum of the item durations for one pass. Items with no explicit duration fall back to the content's nominal duration. Playlists loop by default, so this is one cycle, not a runtime."
            >
              <Icon name="clock" size="sm" aria-hidden />
              {formatCycle(cycleSeconds(playlist))} per cycle
            </span>
            {playlist.totalSize && playlist.totalSize > 0 ? (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Icon name="content" size="sm" aria-hidden />
                {formatFileSize(playlist.totalSize)}
              </span>
            ) : null}
          </div>

          {updatedAt ? (
            <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
              Updated{' '}
              <time dateTime={updatedAt.toISOString()} title={updatedAt.toLocaleString()}>
                {updatedAt.toLocaleDateString()}
              </time>
            </p>
          ) : playlist.updatedAt ? (
            /* Unparseable rather than absent. Say so instead of throwing, and
               instead of printing the literal "Invalid Date". */
            <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
              Last update time unavailable
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/*
          "Assigned to N screens", never "playing on N screens". This counts
          displays whose `currentPlaylistId` is this playlist — the operator's own
          write, made before any device is contacted. There is no persisted
          delivery, acknowledgement or playback record anywhere in the schema, and
          an active schedule on a screen takes priority over its assigned playlist.
        */}
        {screensKnown ? (
          assignedScreens > 0 ? (
            <span
              className="eh-badge eh-badge-success"
              title="Screens whose assigned playlist is this one. That is the operator's assignment, not a record of delivery or playback — and an active schedule on a screen takes priority over its assigned playlist."
            >
              <Icon name="devices" size="xs" aria-hidden />
              Assigned to {assignedScreens} {assignedScreens === 1 ? 'screen' : 'screens'}
            </span>
          ) : (
            <span
              className="eh-badge eh-badge-neutral"
              title={
                scheduleCount > 0
                  ? 'No screen has this playlist as its assigned playlist, but schedules reference it — and a schedule takes priority over the assigned playlist, so this is not unused inventory.'
                  : 'No screen currently has this playlist as its assigned playlist.'
              }
            >
              <Icon name="devices" size="xs" aria-hidden />
              Not assigned
            </span>
          )
        ) : (
          <span
            className="eh-badge eh-badge-neutral"
            title="The device list could not be loaded, so this playlist's screen assignments are unknown. This is not the same as no screens."
          >
            <Icon name="help" size="xs" aria-hidden />
            Screens unknown
          </span>
        )}

        {/*
          A playlist can reach screens WITHOUT being anyone's assigned playlist:
          `resolveEffectiveContent` resolves schedules BEFORE `currentPlaylistId`
          (effective-content.ts:145-177), so a scheduled-only playlist has zero
          assigned rows, reads "Not assigned", and looks like dead inventory
          someone might delete.

          "Used by", never "scheduled onto screens right now": the count is
          `_count.schedules` from the list endpoint, which is NOT filtered by
          `isActive` — so it includes schedules that are switched off. Same
          discipline as "at least N items will be skipped".
        */}
        {scheduleCount > 0 ? (
          <span
            className="eh-badge eh-badge-info"
            title="Schedules referencing this playlist, active or not — the list endpoint does not filter by isActive. A schedule takes priority over a screen's assigned playlist while its window is open."
          >
            <Icon name="schedules" size="xs" aria-hidden />
            Also used by {scheduleCount} {scheduleCount === 1 ? 'schedule' : 'schedules'}
          </span>
        ) : null}

        {itemCount === 0 ? (
          <span className="eh-badge eh-badge-neutral">
            <Icon name="content" size="xs" aria-hidden />
            No content
          </span>
        ) : null}

        {skipped > 0 ? (
          <span
            className="eh-badge eh-badge-warning"
            title="Screens only play content in the active state, so these items are dropped on delivery. Expired content is dropped too and is not visible in this list, so the real number may be higher."
          >
            <Icon name="warning" size="xs" aria-hidden />
            At least {skipped} {skipped === 1 ? 'item' : 'items'} will be skipped
          </span>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="rounded-xl bg-[var(--background-secondary)] p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--foreground-tertiary)]">
            Content Preview
          </p>
          <ol className="space-y-1">
            {items.slice(0, 3).map((item, idx) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <span className="w-4 shrink-0 tabular-nums text-[var(--foreground-tertiary)]">
                  {idx + 1}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-[var(--foreground-secondary)]"
                  title={item.content?.title || `Content ${item.contentId}`}
                >
                  {item.content?.title || `Content ${item.contentId}`}
                </span>
                {/* A label, not the raw API token. This rendered a lowercase
                    `archived` three lines below the comment criticising exactly
                    that in the assign modal. An unmapped state falls back to the
                    token rather than to a guess. */}
                {item.content && item.content.status !== 'active' ? (
                  <span
                    className="eh-badge eh-badge-warning shrink-0 text-[11px]"
                    title="Screens play only content in the active state, so this item is dropped on delivery."
                  >
                    {CONTENT_STATUS_LABEL[item.content.status] ?? item.content.status}
                  </span>
                ) : null}
                <span className="shrink-0 tabular-nums text-xs text-[var(--foreground-tertiary)]">
                  {item.duration || item.content?.duration || 10}s
                </span>
              </li>
            ))}
          </ol>
          {items.length > 3 ? (
            <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
              +{items.length - 3} more {items.length - 3 === 1 ? 'item' : 'items'}
            </p>
          ) : null}
        </div>
      ) : (
        /* Assign already refuses an empty playlist with a toast. Saying so here
           puts the reason where the operator is looking rather than after they
           have pressed the button. */
        <p className="rounded-xl bg-[var(--background-secondary)] p-3 text-sm text-[var(--foreground-secondary)]">
          No content yet. Add content before assigning this playlist to a screen.
        </p>
      )}

      {/*
        One primary action, the rest at equal secondary weight.
        These five buttons used to be five different hues — grey, neon, green,
        purple and red — at identical `flex-1` width, so Delete carried the same
        visual pull as Edit and the row read as a colour chart rather than a
        hierarchy. Four of those hues were also raw Tailwind literals, which do
        not follow the theme.
      */}
      <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
        {canManage ? (
          <button
            onClick={onEdit}
            className="eh-btn-neon eh-btn-sm flex min-h-[44px] items-center gap-1.5 rounded-xl px-4"
            aria-label={`Edit ${playlist.name}`}
          >
            <Icon name="edit" size="sm" aria-hidden />
            Edit
          </button>
        ) : null}
        {canManage ? (
          <button
            onClick={onAssign}
            className="eh-row-action min-h-[44px] gap-1.5 px-4"
            aria-label={`Assign ${playlist.name} to devices`}
          >
            <Icon name="devices" size="sm" aria-hidden />
            Assign
          </button>
        ) : null}
        <button
          onClick={onPreview}
          className="eh-row-action min-h-[44px] gap-1.5 px-4"
          aria-label={`Preview ${playlist.name}`}
        >
          <Icon name="preview" size="sm" aria-hidden />
          Preview
        </button>
        {canManage ? (
          <button
            onClick={onDuplicate}
            className="eh-row-action min-h-[44px] gap-1.5 px-4"
            aria-label={`Duplicate ${playlist.name}`}
          >
            <Icon name="copy" size="sm" aria-hidden />
            Duplicate
          </button>
        ) : null}
        {canDelete ? (
          <button
            onClick={onDelete}
            className="eh-row-action eh-row-action-danger min-h-[44px] gap-1.5 px-4"
            aria-label={`Delete ${playlist.name}`}
          >
            <Icon name="delete" size="sm" aria-hidden />
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function PlaylistsClient() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const permissions = getDashboardPermissions(user);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [devices, setDevices] = useState<Display[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesLoadFailed, setDevicesLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playlistsLoadError, setPlaylistsLoadError] = useState<Error | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistSummary | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assignPlaylist, setAssignPlaylist] = useState<PlaylistSummary | null>(null);
  const [selectedAssignDeviceIds, setSelectedAssignDeviceIds] = useState<Set<string>>(new Set());
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [shapeFilter, setShapeFilter] = useState<ShapeFilter | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  /*
   * Two states, because only two are reachable. The Devices route carries a
   * third, `'error'`, that nothing ever sets — the same never-rendered branch
   * this PR removed the "Active" badge for. It is dropped here rather than
   * copied; flagged for Devices in `tasks/ui-wave-todo.md` rather than changed
   * from a Playlists PR.
   */
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline'>('offline');
  const [previewPlaylist, setPreviewPlaylist] = useState<PlaylistSummary | null>(null);

  /**
   * The connection signal is THREE-state, and collapsing it is a claim.
   *
   * `useRealtimeEvents` emits `navigator.onLine ? null : false` on disconnect —
   * `null` means "the socket dropped but the browser still has network", i.e.
   * reconnecting. `isConnected ? 'connected' : 'offline'` turns that `null` into
   * "Live updates off", so a two-second WiFi blip told the operator to reload a
   * page whose socket was already coming back, and it did not self-correct until
   * the next connect event.
   *
   * That is this PR's own thesis inverted: a known-lossy value must not be
   * promoted into a claim, and `offline` is not `unknown`. Devices handles it
   * correctly at `devices/page-client.tsx:200-207` and this mirrors it — Content
   * goes further with a distinct `'reconnecting'` decaying to offline after 15s,
   * which is the better treatment but a bigger surface than this route needs.
   */
  const handleConnectionChange = useCallback((isConnected: boolean | null) => {
    if (isConnected === true) {
      setRealtimeStatus('connected');
    } else if (isConnected === false) {
      setRealtimeStatus('offline');
    }
    // null = reconnecting: keep the current status rather than assert offline.
  }, []);

  // Real-time event handling
  const { emitPlaylistUpdate } = useRealtimeEvents({
    enabled: true,
    onPlaylistChange: (update) => {
      // Update playlist in real-time
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === update.playlistId
            ? {
                ...p,
                ...update.payload,
              }
            : p
        )
      );
      setRealtimeStatus('connected');

      // Show notification for specific actions
      switch (update.action) {
        case 'updated':
          toast.info('Playlist updated by another user');
          break;
        case 'deleted':
          toast.warning('Playlist deleted');
          break;
        case 'items_reordered':
          toast.info('Playlist items reordered');
          break;
      }
    },
    onConnectionChange: handleConnectionChange,
  });

  useEffect(() => {
    loadPlaylists();
    loadDevices();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setPlaylistsLoadError(null);
      const playlistList = await fetchAllPaginated((params) => apiClient.getPlaylists(params));
      setPlaylists(playlistList);
      setPlaylistsLoadError(null);
    } catch (error: any) {
      const message = error.message || 'Failed to load playlists';
      setPlaylistsLoadError(error instanceof Error ? error : new Error(message));
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      setDevicesLoading(true);
      setDevicesLoadFailed(false);
      const devicesList = await fetchAllPaginated((params) => apiClient.getDisplays(params));
      setDevices(devicesList);
    } catch (error) {
      setDevices([]);
      setDevicesLoadFailed(true);
      toast.error('Failed to load devices');
    } finally {
      setDevicesLoading(false);
    }
  };

  /**
   * Screen counts are only meaningful once the device list is in hand.
   *
   * `devices.filter(...).length` is 0 both when nothing is assigned and when the
   * device fetch failed, and the card would have rendered the same "Not assigned"
   * badge for both. One of those is a fact; the other is an absence of evidence.
   */
  const screensKnown = !devicesLoading && !devicesLoadFailed;
  const getDeviceCount = (playlistId: string) =>
    devices.filter((d) => d.currentPlaylistId === playlistId).length;

  const handleCreate = async () => {
    try {
      setActionLoading(true);
      const newPlaylist = await apiClient.createPlaylist({
        name: createForm.name,
        description: createForm.description,
        items: [],
      });
      toast.success('Playlist created successfully');
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', description: '' });

      // Emit real-time event
      emitPlaylistUpdate({
        playlistId: newPlaylist.id || '',
        action: 'created',
        payload: newPlaylist,
      });

      loadPlaylists();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create playlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (playlist: PlaylistSummary) => {
    router.push(`/dashboard/playlists/${playlist.id}`);
  };

  const handleDelete = (playlist: PlaylistSummary) => {
    setSelectedPlaylist(playlist);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPlaylist) return;

    try {
      setActionLoading(true);
      const deletedPlaylistId = selectedPlaylist.id;
      await apiClient.deletePlaylist(deletedPlaylistId);
      toast.success('Playlist deleted successfully');

      // Emit real-time event
      emitPlaylistUpdate({
        playlistId: deletedPlaylistId,
        action: 'deleted',
        payload: {
          id: selectedPlaylist.id,
          name: selectedPlaylist.name,
          description: selectedPlaylist.description,
          createdAt: selectedPlaylist.createdAt,
          updatedAt: selectedPlaylist.updatedAt,
        },
      });

      loadPlaylists();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete playlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = (playlist: PlaylistSummary) => {
    if (!playlist.items || playlist.items.length === 0) {
      toast.warning('Add content to this playlist before assigning it');
      return;
    }

    if (devicesLoading) {
      toast.info('Devices are still loading. Try again in a moment.');
      return;
    }

    if (devicesLoadFailed) {
      toast.error('Device list failed to load. Refresh the page before assigning playlists.');
      return;
    }

    if (devices.length === 0) {
      toast.warning('Pair a device before assigning playlists to screens');
      return;
    }

    setAssignPlaylist(playlist);
    setSelectedAssignDeviceIds(new Set());
  };

  const closeAssignModal = () => {
    setAssignPlaylist(null);
    setSelectedAssignDeviceIds(new Set());
  };

  const requestCloseAssignModal = () => {
    if (actionLoading) return;
    closeAssignModal();
  };

  const toggleAssignDevice = (deviceId: string) => {
    if (actionLoading) return;

    setSelectedAssignDeviceIds((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const confirmAssign = async () => {
    if (!assignPlaylist || selectedAssignDeviceIds.size === 0) return;

    try {
      setActionLoading(true);
      const selectedDeviceIds = Array.from(selectedAssignDeviceIds);
      const selectedDelayedCount = devices.filter(
        (device) => selectedAssignDeviceIds.has(device.id) && device.status !== 'online',
      ).length;
      const result = await apiClient.bulkAssignPlaylist(selectedDeviceIds, assignPlaylist.id);
      const delayedSuffix = selectedDelayedCount > 0
        ? '. Non-online devices will update when they come online.'
        : '';
      toast.success(`Playlist assigned to ${formatDeviceCount(result.updated)}${delayedSuffix}`);
      closeAssignModal();
      await loadDevices();
      await loadPlaylists();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign playlist to devices');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDeviceCount = (count: number) => `${count} ${count === 1 ? 'device' : 'devices'}`;

  const shapeCounts: Record<ShapeFilter, number> = {
    assigned: playlists.filter((p) => getDeviceCount(p.id) > 0).length,
    unassigned: playlists.filter((p) => getDeviceCount(p.id) === 0).length,
    empty: playlists.filter((p) => (p.items?.length ?? 0) === 0).length,
  };

  const matchesShape = (playlist: PlaylistSummary) => {
    if (!shapeFilter) return true;
    if (shapeFilter === 'empty') return (playlist.items?.length ?? 0) === 0;
    const count = getDeviceCount(playlist.id);
    return shapeFilter === 'assigned' ? count > 0 : count === 0;
  };

  const visiblePlaylists = playlists
    .filter((p) => !debouncedSearch || p.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    .filter(matchesShape)
    .slice()
    .sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'items') return (b.items?.length ?? 0) - (a.items?.length ?? 0);
      return new Date(String(b.updatedAt ?? 0)).getTime() - new Date(String(a.updatedAt ?? 0)).getTime();
    });

  const hasActiveFilters = Boolean(debouncedSearch) || shapeFilter !== null;
  const clearAllFilters = () => {
    setSearchQuery('');
    setShapeFilter(null);
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header. `flex-wrap` plus a full-width action row below `sm` is what keeps
          the title and Create button from colliding at 390px. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="eh-dash-title text-2xl sm:text-3xl">Playlists</h2>
            {/*
              The live-update channel, not a playlist state. This value was
              already being computed on this page and then thrown away — nothing
              rendered it — so an operator had no way to tell a quiet page from a
              dead socket.
            */}
            <span
              className={`eh-badge ${
                realtimeStatus === 'connected' ? 'eh-badge-success' : 'eh-badge-neutral'
              }`}
              title={
                realtimeStatus === 'connected'
                  ? 'Playlist changes made elsewhere are streaming into this page'
                  : 'This page is not receiving live playlist changes; reload to refresh'
              }
            >
              <Icon name={realtimeStatus === 'connected' ? 'refresh' : 'close'} size="xs" aria-hidden />
              {realtimeStatus === 'connected' ? 'Live updates on' : 'Live updates off'}
            </span>
          </div>
          <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
            Create and manage content playlists ({playlists.length} total)
          </p>
        </div>
        {permissions.canManagePlaylists && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="eh-btn-neon flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-3"
          >
            <Icon name="add" size="md" aria-hidden />
            <span>Create Playlist</span>
          </button>
        )}
      </div>

      {/*
        Library summary — the answer to "which of these are actually doing
        anything". Each chip is both the count and the filter for that bucket,
        computed over every playlist rather than the filtered list below.
      */}
      {playlists.length > 0 && (
        <div className="space-y-2">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter playlists. Counts are across every playlist, not the filtered list below, and the buckets overlap."
          >
            <button
              type="button"
              onClick={() => setShapeFilter(null)}
              aria-pressed={shapeFilter === null}
              className="eh-fleet-chip"
            >
              <span className="eh-fleet-chip-count">{playlists.length}</span>
              All playlists
            </button>
            {SHAPE_FILTERS.filter(
              // Assignment buckets are only truthful once the device list is in
              // hand; the Empty bucket is derived from the playlist itself.
              (shape) => (shape === 'empty' || screensKnown) && shapeCounts[shape] > 0,
            ).map((shape) => (
              <button
                key={shape}
                type="button"
                onClick={() => setShapeFilter(shapeFilter === shape ? null : shape)}
                aria-pressed={shapeFilter === shape}
                className="eh-fleet-chip"
              >
                <span className="eh-fleet-chip-count">{shapeCounts[shape]}</span>
                {SHAPE_LABEL[shape]}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--foreground-tertiary)]">
            {screensKnown
              ? 'Assigned means a screen has this playlist set as its assigned playlist — not that it is playing. Empty overlaps the other buckets.'
              : 'Screen assignment counts are unavailable until the device list loads.'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search playlists by name..."
          />
        </div>
        <div className="relative sm:w-52">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="eh-select-inline w-full pr-8"
            aria-label="Sort playlists"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>
          {/* A real <svg> in currentColor: `.eh-select`'s chevron is a data-URI
              with a baked-in hex that no token can reach. */}
          <svg
            aria-hidden
            className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--foreground-tertiary)]"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 11L3 6h10l-5 5z" />
          </svg>
        </div>
      </div>

      {loading ? (
        /* A skeleton in the shape of the card grid, not a spinner in an empty
           box: the layout does not jump when the cards arrive. */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading playlists</span>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="eh-dash-card space-y-4 p-6">
              <div className="flex gap-4">
                <div className="eh-skeleton h-20 w-20 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="eh-skeleton h-5 w-40" />
                  <div className="eh-skeleton h-4 w-56" />
                  <div className="eh-skeleton h-4 w-32" />
                </div>
              </div>
              <div className="eh-skeleton h-20 w-full rounded-xl" />
              <div className="eh-skeleton h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : playlistsLoadError ? (
        <DashboardSectionError
          section="Playlists"
          error={playlistsLoadError}
          reset={() => {
            void loadPlaylists();
          }}
        />
      ) : playlists.length === 0 ? (
        <EmptyState
          icon="playlists"
          title="No playlists yet"
          description="Create your first playlist to organize content"
          action={permissions.canManagePlaylists ? {
            label: 'Create Playlist',
            onClick: () => setIsCreateModalOpen(true),
          } : undefined}
        />
      ) : visiblePlaylists.length === 0 ? (
        /*
          FILTERED-EMPTY is a different screen from EMPTY.
          "No playlists yet" beside an active search tells the operator the
          library is gone. This one names the filters and offers the way back.
          Before this change a search with no matches rendered a "0 results
          found" banner above an empty grid and no way out but clearing by hand.
        */
        <EmptyState
          icon="search"
          title="No playlists match these filters"
          description={`${playlists.length} playlist${playlists.length !== 1 ? 's exist' : ' exists'}, but none match the current search or filter.`}
          action={{ label: 'Clear filters', onClick: clearAllFilters }}
        />
      ) : (
        <>
          {hasActiveFilters && (
            <div
              className="rounded-xl border border-[var(--info-ink)] bg-[var(--status-pairing-bg)] p-3"
              role="status"
            >
              <p className="text-sm text-[var(--info-ink)]">
                {visiblePlaylists.length}{' '}
                {visiblePlaylists.length === 1 ? 'result' : 'results'} found
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {visiblePlaylists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                assignedScreens={getDeviceCount(playlist.id)}
                screensKnown={screensKnown}
                canManage={permissions.canManagePlaylists}
                canDelete={permissions.canDeletePlaylists}
                onPreview={() => setPreviewPlaylist(playlist)}
                onEdit={() => handleEdit(playlist)}
                onAssign={() => handleAssign(playlist)}
                onDuplicate={async () => {
                  try {
                    await apiClient.duplicatePlaylist(playlist.id);
                    toast.success('Playlist duplicated');
                    loadPlaylists();
                  } catch (error: any) {
                    toast.error(error.message || 'Failed to duplicate playlist');
                  }
                }}
                onDelete={() => handleDelete(playlist)}
              />
            ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen && permissions.canManagePlaylists}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Playlist"
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="playlist-name" className="mb-2 block text-sm font-medium text-[var(--foreground-secondary)]">
              Playlist Name
            </label>
            <input
              id="playlist-name"
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="eh-input"
              placeholder="e.g., Morning Promotions"
            />
          </div>
          <div>
            <label htmlFor="playlist-description" className="mb-2 block text-sm font-medium text-[var(--foreground-secondary)]">
              Description (Optional)
            </label>
            <textarea
              id="playlist-description"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="eh-input"
              placeholder="Brief description of this playlist"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="eh-btn-ghost eh-btn-sm min-h-[44px] rounded-xl px-4"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="eh-btn-neon eh-btn-sm flex min-h-[44px] items-center gap-2 rounded-xl px-4 disabled:opacity-50"
              disabled={actionLoading || !createForm.name.trim()}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Create Playlist
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={!!assignPlaylist && permissions.canManagePlaylists}
        onClose={requestCloseAssignModal}
        title={`Assign ${assignPlaylist?.name || 'Playlist'} to Devices`}
        size="lg"
      >
        <div className="space-y-5" aria-busy={actionLoading}>
          <div>
            <p className="text-sm text-[var(--foreground-secondary)]">
              Select paired devices to assign this playlist to now.
            </p>
            <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
              {formatDeviceCount(selectedAssignDeviceIds.size)} selected
            </p>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {devices.map((device) => {
              const deviceLabel = device.nickname || device.deviceId || 'Unnamed device';
              const isCurrentlyAssigned = assignPlaylist?.id === device.currentPlaylistId;
              const isSelected = selectedAssignDeviceIds.has(device.id);
              const isChecked = isCurrentlyAssigned || isSelected;
              const isNonOnline = device.status !== 'online';

              const detail = (
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--foreground)]">{deviceLabel}</span>
                    {/* One status presentation across the app. This used to print
                        the raw API string — lowercase "online"/"pairing" — in a
                        hand-rolled pill with two hardcoded colours and no glyph. */}
                    <DeviceStatusIndicator
                      deviceId={device.id}
                      status={device.status ?? null}
                      showLabel
                    />
                    {isCurrentlyAssigned && (
                      <span className="eh-badge eh-badge-success">Already assigned</span>
                    )}
                    {isNonOnline && (
                      <span
                        className="eh-badge eh-badge-warning"
                        title="The assignment is written immediately; the gateway replays it when the device reconnects."
                      >
                        Updates when online
                      </span>
                    )}
                  </span>
                  {device.location && (
                    <span className="mt-1 block truncate text-xs text-[var(--foreground-tertiary)]">
                      {device.location}
                    </span>
                  )}
                </span>
              );

              if (isCurrentlyAssigned) {
                return (
                  <div
                    key={device.id}
                    className="flex items-start gap-3 rounded-xl border border-[var(--primary-ink)] bg-[var(--badge-brand-bg)] p-4"
                  >
                    <Icon name="check" size="sm" className="mt-1 shrink-0 text-[var(--primary-ink)]" aria-hidden />
                    {detail}
                  </div>
                );
              }

              return (
                <label
                  key={device.id}
                  className={`flex items-start gap-2 rounded-xl border p-3 transition ${
                    actionLoading ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    isChecked
                      ? 'border-[var(--primary-ink)] bg-[var(--badge-brand-bg)]'
                      : 'border-[var(--border)] bg-[var(--background-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {/* `.eh-check`, not a bare native checkbox: the native control
                      renders 13px here, which is a third of the 44px pointer
                      target floor, and its boundary is token-driven so it clears
                      SC 1.4.11 in both themes. */}
                  <input
                    type="checkbox"
                    aria-label={deviceLabel}
                    className="eh-check"
                    checked={isChecked}
                    disabled={actionLoading}
                    onChange={() => toggleAssignDevice(device.id)}
                  />
                  <span className="mt-2 min-w-0 flex-1">{detail}</span>
                </label>
              );
            })}
          </div>

          {/* Correct and server-backed: the gateway replays a deferred assignment
              on reconnect, so a non-online device is not a failed assignment. */}
          <p className="text-xs text-[var(--foreground-tertiary)]">
            This sets the assignment. Non-online devices will update when they come online.
          </p>

          <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
            <button
              onClick={requestCloseAssignModal}
              className="eh-btn-ghost eh-btn-sm min-h-[44px] rounded-xl px-4"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              onClick={confirmAssign}
              className="eh-btn-neon eh-btn-sm flex min-h-[44px] items-center gap-2 rounded-xl px-4 disabled:opacity-50"
              disabled={actionLoading || selectedAssignDeviceIds.size === 0}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Assign to {formatDeviceCount(selectedAssignDeviceIds.size)}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen && permissions.canDeletePlaylists}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Playlist"
        message={`Are you sure you want to delete "${selectedPlaylist?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewPlaylist}
        onClose={() => setPreviewPlaylist(null)}
        title={`Preview: ${previewPlaylist?.name}`}
        size="xl"
      >
        {previewPlaylist && (
          <PlaylistPreview
            items={previewPlaylist.items || []}
            onClose={() => setPreviewPlaylist(null)}
          />
        )}
      </Modal>
    </div>
  );
}
