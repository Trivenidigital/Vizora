'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { fetchAllPaginated } from '@/lib/api/pagination';
import { Display, PlaylistSummary, DisplayGroup, DisplayStatus } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import SearchFilter from '@/components/SearchFilter';
import DeviceStatusIndicator from '@/components/DeviceStatusIndicator';
import { formatLastSeen } from '@/lib/format-last-seen';
import DeviceGroupSelector from '@/components/DeviceGroupSelector';
import DevicePreviewModal from '@/components/DevicePreviewModal';
import PlaylistQuickSelect from '@/components/PlaylistQuickSelect';
import DashboardSectionError from '@/components/DashboardSectionError';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useRealtimeEvents, useOptimisticState, useErrorRecovery } from '@/lib/hooks';
import { Icon } from '@/theme/icons';
import { FleetCommandDropdown, EmergencyOverrideModal, ActiveOverrideBanner } from '@/components/fleet';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDashboardPermissions } from '@/lib/permissions';

interface DevicesClientProps {
 initialDevices: Display[];
 initialPlaylists: PlaylistSummary[];
 initialDevicesComplete?: boolean;
 initialPlaylistsComplete?: boolean;
}

/**
 * The status buckets a fleet is scanned by, in the order an operator triages
 * them: the states that need attention first, then the healthy majority last.
 *
 * `unknown` is a real bucket, not a synonym for offline - it is what a device
 * with no reading falls into, and conflating the two sends someone to a screen
 * that is, as far as anyone knows, fine.
 */
const FLEET_STATUSES = ['offline', 'error', 'pairing', 'idle', 'unknown', 'online'] as const;
type FleetStatus = (typeof FLEET_STATUSES)[number];

const FLEET_STATUS_LABEL: Record<FleetStatus, string> = {
 offline: 'Offline',
 error: 'Error',
 pairing: 'Pairing',
 idle: 'Idle',
 unknown: 'Unknown',
 online: 'Online',
};

/** Anything the API sends that is not a state we present falls to `unknown`. */
const toFleetStatus = (status: unknown): FleetStatus =>
 (FLEET_STATUSES as readonly string[]).includes(String(status))
 ? (String(status) as FleetStatus)
 : 'unknown';

/**
 * The outcome of a bulk action, kept on screen instead of only in a toast.
 *
 * A toast that says "Deleted 1 device(s)" after the operator asked for ten is
 * technically true and reads as success. Partial outcomes are the ones worth
 * reading twice, so they persist until dismissed.
 */
type BulkOutcome = {
 kind: 'delete' | 'playlist' | 'group';
 requested: number;
 changed: number;
};

type SortState = { field: keyof Display | null; direction: 'asc' | 'desc' };

const ariaSortFor = (
 sort: SortState,
 field: keyof Display,
): 'ascending' | 'descending' | 'none' =>
 sort.field !== field ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending';

/**
 * A sortable column header.
 *
 * MUST stay at module scope. Declared inside the page component, its identity is
 * a new function on every render, so React treats each `<th>` as a different
 * element TYPE and unmounts/remounts the subtree instead of updating it. That
 * destroys the button the user just activated: `document.activeElement` falls
 * back to `<body>`, the next Tab restarts at the top of the page, and the screen
 * reader never hears the `aria-sort` it was waiting for. It is not limited to
 * sorting either — every realtime `device:status` event and every debounced
 * keystroke re-renders this component, so focus could be yanked with no user
 * action at all. `devices-page.test.tsx` pins `document.activeElement` across
 * both paths; moving this back inside the render body turns those red.
 *
 * The header itself was a bare `onClick` on the `<th>` before this redesign:
 * reachable by mouse only, announced as a plain cell, exposing no sort state.
 * `aria-sort` lives on the cell (where the spec puts it) and the control is a
 * real button, so the column is operable from the keyboard.
 */
function SortableHeader({
 field,
 label,
 sort,
 onSort,
}: {
 field: keyof Display;
 label: string;
 sort: SortState;
 onSort: (field: keyof Display) => void;
}) {
 const state = ariaSortFor(sort, field);
 return (
 <th scope="col" className="eh-th" aria-sort={state}>
 <button
 type="button"
 onClick={() => onSort(field)}
 className="eh-sort-btn"
 /* `aria-sort` belongs on the header CELL, not on the control inside it;
    this mirror is a styling hook only. */
 data-sort={state}
 >
 {label}
 <span aria-hidden>{state === 'none' ? null : state === 'ascending' ? ' ↑' : ' ↓'}</span>
 <span className="sr-only">
 {state === 'none'
 ? ', not sorted, activate to sort ascending'
 : state === 'ascending'
 ? ', sorted ascending, activate to sort descending'
 : ', sorted descending, activate to clear sorting'}
 </span>
 </button>
 </th>
 );
}

export default function DevicesClient({
 initialDevices,
 initialPlaylists,
 initialDevicesComplete,
 initialPlaylistsComplete,
}: DevicesClientProps) {
 const router = useRouter();
 const toast = useToast();
 const { user } = useAuth();
 const permissions = getDashboardPermissions(user);
 const canSelectDevices = permissions.canManageDevices || permissions.canDeleteDevices;
 const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
 const [devices, setDevices] = useState<Display[]>(initialDevices);
 const [playlists, setPlaylists] = useState<PlaylistSummary[]>(initialPlaylists);
 const [deviceGroups, setDeviceGroups] = useState<any[]>([]);
 const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
 const [loading, setLoading] = useState(false);
 const [devicesLoadError, setDevicesLoadError] = useState<Error | null>(null);
 const [selectedDevice, setSelectedDevice] = useState<Display | null>(null);
 const [isEditModalOpen, setIsEditModalOpen] = useState(false);
 const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
 const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
 const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
 const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
 const [pairingCode, setPairingCode] = useState('');
 const [pairingExpiresIn, setPairingExpiresIn] = useState('');
 const [editForm, setEditForm] = useState({ nickname: '', location: '' });
 const [actionLoading, setActionLoading] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const debouncedSearch = useDebounce(searchQuery, 300);
 const [statusFilter, setStatusFilter] = useState<FleetStatus | null>(null);
 const [sortField, setSortField] = useState<keyof Display | null>(null);
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
 const [currentPage, setCurrentPage] = useState(1);
 const [itemsPerPage, setItemsPerPage] = useState(10);
 const [showGroupFilter, setShowGroupFilter] = useState(false);
 const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
 const [isBulkPlaylistModalOpen, setIsBulkPlaylistModalOpen] = useState(false);
 const [isBulkGroupModalOpen, setIsBulkGroupModalOpen] = useState(false);
 const [bulkPlaylistId, setBulkPlaylistId] = useState('');
 const [bulkGroupId, setBulkGroupId] = useState('');
 const [bulkOutcome, setBulkOutcome] = useState<BulkOutcome | null>(null);
 const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline' | 'error'>('offline');
 const hasCompleteInitialDevices = initialDevicesComplete ?? initialDevices.length > 0;
 const hasCompleteInitialPlaylists = initialPlaylistsComplete ?? initialPlaylists.length > 0;

 // Memoized callback for device status changes
 const handleDeviceStatusChange = useCallback((update: { deviceId: string; status: DisplayStatus; lastSeen?: string; currentPlaylistId?: string }) => {
 setDevices((prev) =>
 prev.map((d) =>
 d.id === update.deviceId
 ? {
 ...d,
 status: update.status,
 lastSeen: update.lastSeen ?? d.lastSeen,
 currentPlaylistId: update.currentPlaylistId ?? d.currentPlaylistId,
 }
 : d
 )
 );
 setRealtimeStatus('connected');
 }, []);

 // Memoized callback for connection changes
 const handleConnectionChange = useCallback((isConnected: boolean | null) => {
 if (isConnected === true) {
 setRealtimeStatus('connected');
 } else if (isConnected === false) {
 setRealtimeStatus('offline');
 }
 // null = reconnecting, keep current status
 }, [toast]);

 // Real-time event handling
 // eslint-disable-next-line @typescript-eslint/no-unused-vars
 const { isConnected: _isConnected, isOffline: _isOffline, emitDeviceUpdate } = useRealtimeEvents({
 enabled: true,
 onDeviceStatusChange: handleDeviceStatusChange,
 onConnectionChange: handleConnectionChange,
 });

 // Optimistic state updates
 const {
 updateOptimistic,
 commitOptimistic,
 rollbackOptimistic,
 hasPendingUpdates,
 } = useOptimisticState<Display[]>(devices);

 // Error recovery
 const { retry, recordError, clearError } = useErrorRecovery({
 onError: (errorInfo) => {
 if (errorInfo.severity === 'critical') {
 toast.error(`Critical: ${errorInfo.error}`);
 }
 },
 retryConfig: {
 maxAttempts: 3,
 initialDelay: 1000,
 },
 });

 useEffect(() => {
 if (!hasCompleteInitialDevices) {
 loadDevices(true);
 }
 if (!hasCompleteInitialPlaylists) {
 loadPlaylists();
 }
 loadGroups();
 }, []);

 const loadDevices = async (showLoading = true) => {
 try {
 if (showLoading) setLoading(true);
 setDevicesLoadError(null);
 await retry(
 'loadDevices',
 async () => {
 const devicesList = await fetchAllPaginated((params) => apiClient.getDisplays(params));
 setDevices(devicesList);
 setDevicesLoadError(null);
 clearError('loadDevices');
 return devicesList;
 },
 undefined,
 (error) => {
 toast.error('Failed to load devices: ' + (error.message || 'Unknown error'));
 }
 );
 } catch (error: any) {
 recordError('loadDevices', error, 'warning');
 const message = error?.message || 'Failed to load devices';
 setDevicesLoadError(error instanceof Error ? error : new Error(message));
 } finally {
 if (showLoading) setLoading(false);
 }
 };

 const loadPlaylists = async () => {
 try {
 const playlistList = await fetchAllPaginated((params) => apiClient.getPlaylists(params));
 setPlaylists(playlistList);
 } catch (error) {
 toast.error('Failed to load playlists');
 }
 };

 const loadGroups = async () => {
 try {
 const groups = await fetchAllPaginated((params) => apiClient.getDisplayGroups(params));
 setDeviceGroups(groups.map((g: any) => ({
 id: g.id,
 name: g.name,
 description: g.description || '',
 deviceIds: g.deviceIds || g.displays?.map((d: any) => d.displayId || d.display?.id).filter(Boolean) || [],
 })));
 } catch (error) {
 toast.error('Failed to load device groups');
 }
 };

 const handleEdit = (device: Display) => {
 setSelectedDevice(device);
 setEditForm({ nickname: device.nickname, location: device.location || '' });
 setIsEditModalOpen(true);
 };

 const handlePreview = (device: Display) => {
 setSelectedDevice(device);
 setIsPreviewModalOpen(true);
 };

 const handleSaveEdit = async () => {
 if (!selectedDevice) return;

 try {
 setActionLoading(true);
 const updateId = `edit_${selectedDevice.id}_${Date.now()}`;

 updateOptimistic(updateId, (prev) =>
 prev.map((d) =>
 d.id === selectedDevice.id
 ? { ...d, nickname: editForm.nickname, location: editForm.location }
 : d
 )
 );

 await retry(
 updateId,
 async () => {
 await apiClient.updateDisplay(selectedDevice.id, editForm);
 return true;
 },
 () => {
 // Same reason as confirmDelete: the optimistic copy is not what the table
 // renders, so the renamed device kept its old name until a reload.
 commitOptimistic(updateId);
 setDevices((prev) =>
 prev.map((d) =>
 d.id === selectedDevice.id
 ? { ...d, nickname: editForm.nickname, location: editForm.location }
 : d
 )
 );
 toast.success('Device updated successfully');
 setIsEditModalOpen(false);
 emitDeviceUpdate({
 deviceId: selectedDevice.id,
 status: selectedDevice.status,
 lastSeen: new Date().toISOString(),
 });
 },
 (error) => {
 rollbackOptimistic(updateId);
 toast.error('Failed to update device: ' + (error.message || 'Unknown error'));
 recordError(updateId, error, 'warning');
 }
 );
 } catch (error: any) {
 toast.error(error.message || 'Failed to update device');
 } finally {
 setActionLoading(false);
 }
 };

 const handleDelete = (device: Display) => {
 setSelectedDevice(device);
 setIsDeleteModalOpen(true);
 };

 const confirmDelete = async () => {
 if (!selectedDevice) return;

 try {
 setActionLoading(true);
 const deleteId = `delete_${selectedDevice.id}_${Date.now()}`;
 const deletedDeviceId = selectedDevice.id;

 updateOptimistic(deleteId, (prev) =>
 prev.filter((d) => d.id !== deletedDeviceId)
 );

 await retry(
 deleteId,
 async () => {
 await apiClient.deleteDisplay(deletedDeviceId);
 return true;
 },
 () => {
 // Commit the optimistic update AND the rendered state. useOptimisticState
 // holds its own copy of the array; the table renders `devices`, so
 // commitOptimistic alone left the deleted row on screen until a reload.
 // Same pairing the content page uses (content/page-client.tsx).
 commitOptimistic(deleteId);
 setDevices((prev) => prev.filter((d) => d.id !== deletedDeviceId));
 toast.success('Device deleted successfully');
 setIsDeleteModalOpen(false);
 setSelectedDevice(null);
 },
 (error) => {
 rollbackOptimistic(deleteId);
 toast.error('Failed to delete device: ' + (error.message || 'Unknown error'));
 recordError(deleteId, error, 'warning');
 }
 );
 } catch (error: any) {
 toast.error(error.message || 'Failed to delete device');
 } finally {
 setActionLoading(false);
 }
 };

 const handleGeneratePairingCode = async (device: Display) => {
 try {
 setActionLoading(true);
 const response = await apiClient.generatePairingToken(device.id);
 setPairingCode(response.pairingToken);
 setPairingExpiresIn(response.expiresIn || '5 minutes');
 setSelectedDevice(device);
 setIsPairingModalOpen(true);
 } catch (error: any) {
 toast.error(error.message || 'Failed to generate pairing code');
 } finally {
 setActionLoading(false);
 }
 };

 const toggleDeviceSelection = (deviceId: string) => {
 setSelectedDeviceIds(prev => {
 const next = new Set(prev);
 if (next.has(deviceId)) {
 next.delete(deviceId);
 } else {
 next.add(deviceId);
 }
 return next;
 });
 };

 /**
  * Select-all is PAGE-scoped, matching the header checkbox and the content
  * page's precedent (content/page-client.tsx prunes selection to the visible
  * ids on every load). Selection previously survived pagination while the
  * checkbox and bulk bar described only the visible page, so "Delete 10
  * selected" could be armed against rows the operator could not see.
  */
 const toggleSelectAll = () => {
 const visibleIds = displayDevices.map(d => d.id);
 const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedDeviceIds.has(id));
 setSelectedDeviceIds(prev => {
 const next = new Set(prev);
 if (allVisibleSelected) {
 visibleIds.forEach(id => next.delete(id));
 } else {
 visibleIds.forEach(id => next.add(id));
 }
 return next;
 });
 };

 const handleBulkDelete = async () => {
 if (selectedDeviceIds.size === 0) return;
 const displayIds = Array.from(selectedDeviceIds);
 try {
 setActionLoading(true);
 const result = await apiClient.bulkDeleteDisplays(displayIds);
 // `deleted` is deleteMany's matched-row count, scoped to the org. Fewer
 // than were asked for means those rows were already gone - a partial
 // outcome that a bare "Deleted 1 device(s)" reads as complete success.
 reportBulkOutcome('delete', displayIds.length, result.deleted);
 setSelectedDeviceIds(new Set());
 setIsBulkDeleteModalOpen(false);
 await loadDevices(false);
 } catch (error: any) {
 toast.error(error.message || 'Bulk delete failed');
 } finally {
 setActionLoading(false);
 }
 };

 const handleBulkAssignPlaylist = async () => {
 if (!bulkPlaylistId || selectedDeviceIds.size === 0) return;
 const displayIds = Array.from(selectedDeviceIds);
 try {
 setActionLoading(true);
 const result = await apiClient.bulkAssignPlaylist(displayIds, bulkPlaylistId);
 // `updated` proves PERSISTENCE, not delivery: the assignment writes
 // currentPlaylistId and the realtime notify is fire-and-forget. A non-online
 // device keeps playing its cached playlist until it reconnects, which reads
 // as "the assignment didn't work" unless we say otherwise. Same copy as the
 // Publish flow on the playlists page.
 //
 // The promise is backed by the server: on reconnect the gateway delivers the
 // pending playlist, or falls back to the DB's currentPlaylistId — so a
 // deferred assignment is genuinely applied, not lost.
 const delayedCount = devices.filter(
 (device) => selectedDeviceIds.has(device.id) && device.status !== 'online',
 ).length;
 const delayedSuffix = delayedCount > 0
 ? '. Non-online devices will update when they come online.'
 : '';
 reportBulkOutcome('playlist', displayIds.length, result.updated, delayedSuffix);
 setSelectedDeviceIds(new Set());
 setIsBulkPlaylistModalOpen(false);
 setBulkPlaylistId('');
 await loadDevices(false);
 } catch (error: any) {
 toast.error(error.message || 'Bulk assign failed');
 } finally {
 setActionLoading(false);
 }
 };

 const handleBulkAssignGroup = async () => {
 if (!bulkGroupId || selectedDeviceIds.size === 0) return;
 const displayIds = Array.from(selectedDeviceIds);
 try {
 setActionLoading(true);
 const result = await apiClient.bulkAssignGroup(displayIds, bulkGroupId);
 // `added` comes from createMany({ skipDuplicates: true }), so a shortfall
 // here means ALREADY A MEMBER - not a failure. Reporting it as one would
 // send the operator chasing a problem that does not exist.
 reportBulkOutcome('group', displayIds.length, result.added);
 setSelectedDeviceIds(new Set());
 setIsBulkGroupModalOpen(false);
 setBulkGroupId('');
 await loadDevices(false);
 await loadGroups();
 } catch (error: any) {
 toast.error(error.message || 'Bulk group assign failed');
 } finally {
 setActionLoading(false);
 }
 };

 /**
  * One place decides how a bulk result is announced.
  *
  * A complete result stays a toast. An INCOMPLETE one also raises a banner that
  * survives the toast timeout, because "7 of 10" is the case an operator has to
  * act on and the case a transient success toast hides best.
  */
 const reportBulkOutcome = (
 kind: BulkOutcome['kind'],
 requested: number,
 changed: number,
 suffix = '',
 ) => {
 const complete = changed >= requested;
 setBulkOutcome(complete ? null : { kind, requested, changed });

 /*
  * Order matters. The scope clause qualifies the COUNT, so it has to sit
  * against the count and before any trailing sentence; appending it last
  * produced "...device(s). Non-online devices will update when they come
  * online. of 2 selected" - a fragment after a full stop, on exactly the path
  * this redesign exists to make clearer.
  */
 const scope = complete ? '' : ` of ${requested} selected`;

 if (kind === 'delete') {
 const message = `Deleted ${changed} device(s)${scope}${suffix}`;
 complete ? toast.success(message) : toast.warning(message);
 return;
 }
 if (kind === 'playlist') {
 const message = `Playlist assigned to ${changed} device(s)${scope}${suffix}`;
 complete ? toast.success(message) : toast.warning(message);
 return;
 }
 const message = `Added ${changed} device(s) to group${suffix}`;
 // A group shortfall is informational, so it stays a success toast.
 toast.success(message);
 };

 const handleSort = (field: keyof Display) => {
 if (sortField === field) {
 if (sortDirection === 'asc') {
 setSortDirection('desc');
 } else {
 setSortField(null);
 }
 } else {
 setSortField(field);
 setSortDirection('asc');
 }
 };

 /** Live counts for the summary strip; computed over the WHOLE fleet, not the page. */
 const statusCounts = devices.reduce<Record<FleetStatus, number>>((acc, d) => {
 const key = toFleetStatus(d.status);
 acc[key] = (acc[key] ?? 0) + 1;
 return acc;
 }, { offline: 0, error: 0, pairing: 0, idle: 0, unknown: 0, online: 0 });

 // Filter and sort devices
 const filteredAndSortedDevices = devices
 .filter(d => {
 const matchesSearch =
 !debouncedSearch ||
 (d.nickname || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
 (d.location && d.location.toLowerCase().includes(debouncedSearch.toLowerCase()));
 if (!matchesSearch) return false;
 if (statusFilter && toFleetStatus(d.status) !== statusFilter) return false;
 if (selectedGroups.length === 0) return true;
 return deviceGroups
 .filter(group => selectedGroups.includes(group.id))
 .some(group => group.deviceIds?.includes(d.id));
 })
 .sort((a, b) => {
 if (!sortField) return 0;
 const aVal = a[sortField];
 const bVal = b[sortField];
 if (aVal == null && bVal == null) return 0;
 if (aVal == null) return 1;
 if (bVal == null) return -1;
 if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
 if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
 return 0;
 });

 // Pagination
 const totalItems = filteredAndSortedDevices.length;
 const totalPages = Math.ceil(totalItems / itemsPerPage);
 const startIndex = (currentPage - 1) * itemsPerPage;
 const endIndex = startIndex + itemsPerPage;
 const displayDevices = filteredAndSortedDevices.slice(startIndex, endIndex);

 const hasActiveFilters = Boolean(debouncedSearch) || Boolean(statusFilter) || selectedGroups.length > 0;
 const clearAllFilters = () => {
 setSearchQuery('');
 setStatusFilter(null);
 setSelectedGroups([]);
 };

 /**
  * Selection may only ever contain rows the operator can currently see.
  *
  * Every destructive bulk action sends Array.from(selectedDeviceIds), so any id
  * that survives a change to the visible set becomes an invisible target. This
  * prunes on page change, search, filter, sort, page-size change and refetch -
  * every path that alters what is on screen - by keying off the visible ids
  * themselves rather than trying to enumerate the events.
  *
  * `displayDevices` is a fresh slice each render, so the effect keys off a
  * stable signature; returning `prev` unchanged when nothing was pruned keeps
  * it from looping.
  */
 const visibleIdsKey = displayDevices.map(d => d.id).join(',');
 useEffect(() => {
 setSelectedDeviceIds(prev => {
 if (prev.size === 0) return prev;
 const visible = new Set(visibleIdsKey ? visibleIdsKey.split(',') : []);
 const next = new Set(Array.from(prev).filter(id => visible.has(id)));
 return next.size === prev.size ? prev : next;
 });
 }, [visibleIdsKey]);

 /**
  * The current page may never point past the end of the list.
  *
  * Anything that shrinks the filtered set while the operator is on a later page
  * strands them on an empty slice under a footer reading "Showing 21 to 20 of
  * 20 devices": a single delete, a bulk delete of the whole last page, and a
  * search or group filter that narrows the results all reach it. Clamping here
  * rather than inside each handler covers every shrink path, including the
  * refetch ones, instead of only the one that happens to be under test.
  *
  * `totalPages === 0` (an empty or fully-filtered list) is deliberately left
  * alone - clamping to 0 would be an invalid page, and the empty case renders
  * EmptyState instead of the table anyway.
  */
 useEffect(() => {
 if (totalPages > 0 && currentPage > totalPages) {
 setCurrentPage(totalPages);
 }
 }, [totalPages, currentPage]);

 useEffect(() => {
 setCurrentPage(1);
 setSelectedDeviceIds(new Set());
 }, [debouncedSearch, selectedGroups, statusFilter]);

 const sortState: SortState = { field: sortField, direction: sortDirection };

 /**
  * A partly-selected page must not look like an unselected one.
  *
  * `indeterminate` is a DOM property with no HTML attribute and no React prop,
  * so it can only be set imperatively. Without this the header checkbox read
  * plain unchecked while three of ten rows were armed for "Delete Selected".
  */
 const visibleSelectedCount = displayDevices.filter(d => selectedDeviceIds.has(d.id)).length;
 const allVisibleSelected = displayDevices.length > 0 && visibleSelectedCount === displayDevices.length;
 const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;
 const selectAllRef = useRef<HTMLInputElement>(null);
 useEffect(() => {
 if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
 }, [someVisibleSelected]);

 return (
 <div className="space-y-6">
 <toast.ToastContainer />

 {/* Header. `flex-wrap` + a full-width action row below `sm` is what stopped
     the Fleet/Override/Pair cluster running 256px past a 390px viewport. */}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-3">
 <h2 className="eh-dash-title text-2xl sm:text-3xl">Devices</h2>
 {/* This badge is the LIVE-UPDATE CHANNEL, not a device state. It used to
     read "Offline", the same word the rows use for a screen that is down. */}
 <span
 className={`eh-badge ${
 realtimeStatus === 'connected'
 ? 'eh-badge-success'
 : realtimeStatus === 'offline'
 ? 'eh-badge-neutral'
 : 'eh-badge-error'
 }`}
 title={
 realtimeStatus === 'connected'
 ? 'Status changes are streaming into this page'
 : 'This page is not receiving live status changes; reload to refresh'
 }
 >
 <Icon name={realtimeStatus === 'connected' ? 'refresh' : 'close'} size="xs" aria-hidden />
 {realtimeStatus === 'connected'
 ? 'Live updates on'
 : realtimeStatus === 'offline'
 ? 'Live updates off'
 : 'Live updates failed'}
 </span>
 </div>
 <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
 Manage your paired display devices ({devices.length} total)
 {hasPendingUpdates() && ' • Syncing changes...'}
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-3">
 {permissions.canUseFleetCommands && user?.organizationId && (
 <FleetCommandDropdown organizationId={user.organizationId} />
 )}
 {permissions.canUseEmergencyOverride && (
 <button
 onClick={() => setIsOverrideModalOpen(true)}
 className="eh-btn-danger flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
 >
 <Icon name="warning" size="md" aria-hidden />
 <span>Emergency Override</span>
 </button>
 )}
 {permissions.canPairDevices && (
 <button
 onClick={() => router.push('/dashboard/devices/pair')}
 className="eh-btn-neon flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-3"
 >
 <Icon name="add" size="md" aria-hidden />
 <span>Pair New Device</span>
 </button>
 )}
 </div>
 </div>

 {permissions.canUseFleetCommands && (
 <ActiveOverrideBanner canClearOverride={permissions.canUseEmergencyOverride} />
 )}

 {/*
   Fleet summary — the answer to "how do I scan 500 devices".
   At that size nobody reads rows; they read totals and then narrow. Each chip
   is both the count and the filter for that bucket, computed over the whole
   fleet rather than the visible page, so the numbers do not change under
   pagination.
 */}
 {devices.length > 0 && (
 <div className="space-y-2">
 <div
 className="flex flex-wrap gap-2"
 role="group"
 /* The counts are fleet-wide while the table below also honours search and
    group filters, so "1 Offline" can legitimately sit above a table with no
    offline rows. That is deliberate — a triage total that shrank as you
    typed would be useless — but it has to be stated, not left to be
    discovered. */
 aria-label="Filter devices by status. Counts are across the whole fleet, not the filtered table below."
 >
 <button
 type="button"
 onClick={() => setStatusFilter(null)}
 aria-pressed={statusFilter === null}
 className="eh-fleet-chip"
 >
 <span className="eh-fleet-chip-count">{devices.length}</span>
 All devices
 </button>
 {FLEET_STATUSES.filter((s) => statusCounts[s] > 0).map((status) => (
 <button
 key={status}
 type="button"
 onClick={() => setStatusFilter(statusFilter === status ? null : status)}
 aria-pressed={statusFilter === status}
 className="eh-fleet-chip"
 >
 <span className="eh-fleet-chip-count">{statusCounts[status]}</span>
 {FLEET_STATUS_LABEL[status]}
 </button>
 ))}
 </div>
 <p className="text-xs text-[var(--foreground-tertiary)]">
 Counts are across the whole fleet; the table below also honours the search and group filters.
 </p>
 </div>
 )}

 <SearchFilter
 value={searchQuery}
 onChange={setSearchQuery}
 placeholder="Search devices by name or location..."
 />

 <div className="eh-dash-card">
 <button
 onClick={() => setShowGroupFilter(!showGroupFilter)}
 aria-expanded={showGroupFilter}
 aria-controls="device-group-filter"
 className="flex min-h-[44px] w-full items-center justify-between rounded-2xl p-4 text-left transition hover:bg-[var(--surface-hover)]"
 >
 <span className="text-sm font-medium text-[var(--foreground-secondary)]">
 Device Groups ({deviceGroups.length})
 </span>
 <Icon
 name={showGroupFilter ? 'chevronUp' : 'chevronDown'}
 size="sm"
 className="text-[var(--foreground-tertiary)]"
 aria-hidden
 />
 </button>
 {showGroupFilter && (
 <div id="device-group-filter" className="px-4 pb-4 sm:px-6">
 <DeviceGroupSelector
 groups={deviceGroups}
 selectedGroupIds={selectedGroups}
 onChange={setSelectedGroups}
 showCreate={permissions.canManageDevices}
 onCreateGroup={async (name, description) => {
 try {
 await apiClient.createDisplayGroup({ name, description });
 toast.success('Group created');
 loadGroups();
 } catch (error: any) {
 toast.error(error.message || 'Failed to create group');
 }
 }}
 />
 </div>
 )}
 </div>

 {/*
   A bulk action that only partly landed, stated in full and kept on screen.
   The toast that reported it has already gone by the time anyone reacts.

   The group case takes the INFO variant, not the warning one. Its shortfall
   means "already a member", which is not a problem — painting it in warning
   ink while the toast says success would produce exactly the chase-a-
   non-problem outcome the split reporting exists to avoid.
 */}
 {bulkOutcome && (
 <div
 className={`eh-partial-banner${bulkOutcome.kind === 'group' ? ' eh-partial-banner-info' : ''}`}
 role="status"
 >
 <Icon
 name={bulkOutcome.kind === 'group' ? 'info' : 'warning'}
 size="md"
 className="mt-0.5 shrink-0"
 aria-hidden
 />
 <div className="min-w-0 flex-1">
 <p className="font-semibold">
 {bulkOutcome.kind === 'delete'
 ? `Deleted ${bulkOutcome.changed} of ${bulkOutcome.requested} selected devices`
 : bulkOutcome.kind === 'playlist'
 ? `Assigned the playlist to ${bulkOutcome.changed} of ${bulkOutcome.requested} selected devices`
 : `Added ${bulkOutcome.changed} of ${bulkOutcome.requested} selected devices to the group`}
 </p>
 <p className="mt-1">
 {bulkOutcome.kind === 'group'
 ? `The other ${bulkOutcome.requested - bulkOutcome.changed} were already in this group.`
 : `${bulkOutcome.requested - bulkOutcome.changed} were not changed — the server matched fewer devices than were selected. The list below has been refreshed; re-select and try again.`}
 </p>
 </div>
 <button
 type="button"
 onClick={() => setBulkOutcome(null)}
 className="eh-row-action shrink-0"
 aria-label="Dismiss bulk action result"
 >
 Dismiss
 </button>
 </div>
 )}

 {loading ? (
 /* A skeleton in the shape of the table, not a spinner in an empty card:
    the layout does not jump when the rows arrive. */
 <div className="eh-dash-card overflow-hidden p-4" aria-busy="true" aria-live="polite">
 <span className="sr-only">Loading devices</span>
 <div className="eh-skeleton mb-4 h-9 w-full" />
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="flex items-center gap-4 py-3">
 <div className="eh-skeleton h-5 w-5 shrink-0 rounded-md" />
 <div className="eh-skeleton h-5 flex-1" />
 <div className="eh-skeleton hidden h-5 w-24 sm:block" />
 <div className="eh-skeleton hidden h-5 w-32 sm:block" />
 </div>
 ))}
 </div>
 ) : devicesLoadError ? (
 <DashboardSectionError
 section="Devices"
 error={devicesLoadError}
 reset={() => {
 void loadDevices(true);
 }}
 />
 ) : devices.length === 0 ? (
 <EmptyState
 icon="devices"
 title="No devices yet"
 description={permissions.canPairDevices
 ? 'Get started by pairing your first display device'
 : 'No displays are paired yet. A manager or admin can add the first screen.'}
 action={permissions.canPairDevices ? {
 label: 'Pair Device',
 onClick: () => router.push('/dashboard/devices/pair'),
 } : undefined}
 />
 ) : (
 <>
 {debouncedSearch && (
 <div
 className="rounded-xl border border-[var(--info-ink)] bg-[var(--status-pairing-bg)] p-3"
 role="status"
 >
 <p className="text-sm text-[var(--info-ink)]">
 {/* The filtered total, not the page slice - this sat directly above
     "Showing 1 to 10 of 25 devices" and disagreed with it. */}
 {totalItems}{' '}
 {totalItems === 1 ? 'result' : 'results'} found
 </p>
 </div>
 )}
 {selectedDeviceIds.size > 0 && canSelectDevices && (
 <div className="eh-bulk-bar flex-wrap">
 <span className="text-sm font-semibold text-[var(--primary-ink)]">
 {selectedDeviceIds.size} device{selectedDeviceIds.size !== 1 ? 's' : ''} selected
 </span>
 <div className="flex flex-wrap items-center gap-2">
 {permissions.canManageDevices && <button onClick={() => setIsBulkPlaylistModalOpen(true)} className="eh-btn-neon eh-btn-sm min-h-[44px] rounded-xl px-4">Assign Playlist</button>}
 {permissions.canManageDevices && <button onClick={() => setIsBulkGroupModalOpen(true)} className="eh-btn-ghost eh-btn-sm min-h-[44px] rounded-xl px-4">Add to Group</button>}
 {permissions.canDeleteDevices && <button onClick={() => setIsBulkDeleteModalOpen(true)} disabled={actionLoading} className="eh-btn-danger min-h-[44px] rounded-xl px-4 py-2 text-sm disabled:opacity-50">Delete Selected</button>}
 <button onClick={() => setSelectedDeviceIds(new Set())} className="eh-row-action min-h-[44px] px-4">Clear</button>
 </div>
 </div>
 )}
 {totalItems === 0 ? (
 /*
   FILTERED-EMPTY is a different screen from EMPTY.
   "No devices yet" next to an active search tells the operator the fleet
   is gone. This one names the filters and offers the way back.
 */
 <EmptyState
 icon="search"
 title="No devices match these filters"
 description={`${devices.length} device${devices.length !== 1 ? 's are' : ' is'} paired, but none match the current search, status or group filter.`}
 action={{ label: 'Clear filters', onClick: clearAllFilters }}
 />
 ) : (
 <div className="eh-dash-card overflow-hidden">
 {/* The card clips to keep its rounded corners, and <main> sets
     overflow-x-hidden - so without this scroller the widest columns
     (Last Seen, and the row-action buttons entirely) were cut off with
     no way to reach them, even at 1440px. Measured: 263px beyond the
     viewport with document scrollWidth === clientWidth. Below 768px the
     same rows restyle into cards and this scroller stands down. */}
 <div className="eh-datatable-scroll">
 <table className="eh-datatable min-w-full">
 <caption className="sr-only">
 Paired display devices. Status is the last observation reported to the
 server, not a live guarantee; the Assigned Playlist column is the
 operator&apos;s assignment, not what a screen is currently showing.
 </caption>
 <thead>
 <tr>
 {canSelectDevices && (
 <th scope="col" className="eh-th w-px">
 <input
 ref={selectAllRef}
 type="checkbox"
 aria-label="Select all devices on this page"
 className="eh-check"
 checked={allVisibleSelected}
 onChange={toggleSelectAll}
 />
 </th>
 )}
 <SortableHeader field="nickname" label="Device" sort={sortState} onSort={handleSort} />
 <SortableHeader field="status" label="Status" sort={sortState} onSort={handleSort} />
 <SortableHeader field="location" label="Location" sort={sortState} onSort={handleSort} />
 {/* "Assigned", not "Currently Playing". This cell renders
     device.currentPlaylistId - the operator's own assignment, written by
     updateMany before any device is contacted. Nothing in the schema records
     what a screen is actually showing: the delivery ack lives in Redis with a
     TTL and is never persisted or exposed. For an offline device the old header
     asserted a playlist was playing while the screen showed something else. */}
 <th scope="col" className="eh-th">Assigned Playlist</th>
 <SortableHeader field="lastSeen" label="Last Seen" sort={sortState} onSort={handleSort} />
 <th scope="col" className="eh-th text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {displayDevices.map((device) => (
 <tr key={device.id} className="eh-tr-hover">
 {canSelectDevices && (
 <td className="eh-td w-px" data-label="Select">
 <input
 type="checkbox"
 className="eh-check"
 aria-label={`Select ${device.nickname}`}
 checked={selectedDeviceIds.has(device.id)}
 onChange={() => toggleDeviceSelection(device.id)}
 />
 </td>
 )}
 <td className="eh-td" data-label="Device">
 <div className="flex items-center gap-3">
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-secondary)]">
 <Icon name="devices" size="md" aria-hidden />
 </span>
 <span className="min-w-0">
 <span className="block max-w-[240px] truncate text-sm font-semibold text-[var(--foreground)]" title={device.nickname}>{device.nickname}</span>
 {/* The id is provenance, not a scanning target: it must be available
     but must never compete with the name. A full 36-character UUID per
     row pushed the action buttons off the right of the table at 1440px
     and out of the card at 390px, so the prefix is shown, the whole
     value stays on hover, and assistive tech still reads all of it. */}
 <span className="block font-mono text-xs text-[var(--foreground-tertiary)]" title={device.id}>
 <span aria-hidden>ID: {device.id.slice(0, 8)}…</span>
 <span className="sr-only">Device ID {device.id}</span>
 </span>
 </span>
 </div>
 </td>
 {/* Below the breakpoint the table roles are gone, so these three cells
     become bare values in the reading order. `data-label` restores the
     label VISUALLY via generated content, which is not universally
     announced; `.eh-cell-label` restores it to assistive tech from real
     DOM. It is `display: none` at table widths, where the column header
     already does the job, so nothing is announced twice. */}
 <td className="eh-td" data-label="Status">
 <span className="eh-cell-label">Status: </span>
 <DeviceStatusIndicator deviceId={device.id} status={device.status ?? null} showLabel />
 </td>
 <td className="eh-td text-sm text-[var(--foreground-secondary)]" data-label="Location">
 <span className="eh-cell-label">Location: </span>
 {device.location || '—'}
 </td>
 <td className="eh-td text-sm" data-label="Assigned Playlist">
 <PlaylistQuickSelect
 device={device}
 playlists={playlists}
 disabled={!permissions.canManageDevices}
 onSuccess={() => toast.success('Playlist updated')}
 onError={(err) => toast.error(err.message || 'Failed to update playlist')}
 onUpdate={() => { loadDevices(); }}
 />
 </td>
 {/* Relative time carries freshness at a glance; the exact timestamp stays
     available on hover and to assistive tech via <time dateTime>. "Online" is
     a recent observation, not a live guarantee, so the operator needs to see
     HOW recent without the badge hedging itself into uselessness. */}
 <td className="eh-td text-sm tabular-nums text-[var(--foreground-secondary)]" data-label="Last Seen">
 <span className="eh-cell-label">Last seen: </span>
 {(device.lastSeen || device.lastHeartbeat) ? (
 <time
 dateTime={new Date(String(device.lastSeen || device.lastHeartbeat)).toISOString()}
 title={new Date(String(device.lastSeen || device.lastHeartbeat)).toLocaleString()}
 >
 {formatLastSeen(String(device.lastSeen || device.lastHeartbeat))}
 </time>
 ) : (
 'Never'
 )}
 </td>
 <td className="eh-td text-right" data-label="Actions">
 <div className="eh-row-actions">
 <button onClick={() => handlePreview(device)} className="eh-row-action" aria-label={`Preview ${device.nickname}`} title="Preview device screen">Preview</button>
 {permissions.canManageDevices && (
 <button onClick={() => handleEdit(device)} className="eh-row-action" aria-label={`Edit ${device.nickname}`}>Edit</button>
 )}
 {permissions.canPairDevices && (
 <button onClick={() => handleGeneratePairingCode(device)} className="eh-row-action" aria-label={`Generate a pairing token for ${device.nickname}`}>Pair</button>
 )}
 {permissions.canDeleteDevices && (
 <button onClick={() => handleDelete(device)} className="eh-row-action eh-row-action-danger" aria-label={`Delete ${device.nickname}`}>Delete</button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {totalItems > 0 && (
 <div className="eh-dash-card flex flex-col items-center justify-between gap-4 rounded-2xl px-4 py-3 sm:flex-row sm:px-6">
 <div className="flex w-full flex-1 justify-between gap-3 sm:hidden">
 <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="eh-btn-ghost eh-btn-sm min-h-[44px] flex-1 rounded-xl disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
 <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="eh-btn-ghost eh-btn-sm min-h-[44px] flex-1 rounded-xl disabled:cursor-not-allowed disabled:opacity-50">Next</button>
 </div>
 <div className="hidden w-full sm:flex sm:flex-1 sm:items-center sm:justify-between">
 <div className="flex items-center gap-4">
 <p className="text-sm text-[var(--foreground-secondary)]">Showing <span className="font-semibold text-[var(--foreground)]">{startIndex + 1}</span> to <span className="font-semibold text-[var(--foreground)]">{Math.min(endIndex, totalItems)}</span> of <span className="font-semibold text-[var(--foreground)]">{totalItems}</span> devices</p>
 <div className="relative">
 <select
 value={itemsPerPage}
 onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
 className="eh-select-inline pr-8"
 aria-label="Devices per page"
 >
 <option value={10}>10 per page</option>
 <option value={25}>25 per page</option>
 <option value={50}>50 per page</option>
 <option value={100}>100 per page</option>
 </select>
 <svg aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--foreground-tertiary)]" viewBox="0 0 16 16" fill="currentColor"><path d="M8 11L3 6h10l-5 5z" /></svg>
 </div>
 </div>
 <nav aria-label="Device list pages">
 <ul className="flex items-center gap-1">
 <li>
 <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="eh-row-action px-3 disabled:cursor-not-allowed disabled:opacity-50">{'←'} Previous</button>
 </li>
 {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
 let pageNum;
 if (totalPages <= 5) { pageNum = i + 1; }
 else if (currentPage <= 3) { pageNum = i + 1; }
 else if (currentPage >= totalPages - 2) { pageNum = totalPages - 4 + i; }
 else { pageNum = currentPage - 2 + i; }
 const isCurrent = currentPage === pageNum;
 return (
 <li key={pageNum}>
 <button
 onClick={() => setCurrentPage(pageNum)}
 aria-current={isCurrent ? 'page' : undefined}
 aria-label={`Page ${pageNum}`}
 className={`eh-row-action min-w-[40px] tabular-nums ${isCurrent ? 'border-[var(--primary-ink)] bg-[var(--badge-brand-bg)] text-[var(--primary-ink)]' : ''}`}
 >
 {pageNum}
 </button>
 </li>
 );
 })}
 <li>
 <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="eh-row-action px-3 disabled:cursor-not-allowed disabled:opacity-50">Next {'→'}</button>
 </li>
 </ul>
 </nav>
 </div>
 </div>
 )}
 </>
 )}

 <Modal isOpen={isEditModalOpen && permissions.canManageDevices} onClose={() => setIsEditModalOpen(false)} title="Edit Device">
 <div className="space-y-5">
 <div>
 <label htmlFor="device-nickname" className="mb-2 block text-sm font-medium text-[var(--foreground-secondary)]">Device Nickname</label>
 <input id="device-nickname" type="text" value={editForm.nickname} onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })} className="eh-input" placeholder="e.g., Store Front Display" />
 </div>
 <div>
 <label htmlFor="device-location" className="mb-2 block text-sm font-medium text-[var(--foreground-secondary)]">Location (Optional)</label>
 <input id="device-location" type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="eh-input" placeholder="e.g., Main Entrance" />
 </div>
 <div className="flex justify-end gap-3 pt-4">
 <button onClick={() => setIsEditModalOpen(false)} className="eh-btn-ghost eh-btn-sm min-h-[44px] rounded-xl px-4" disabled={actionLoading}>Cancel</button>
 <button onClick={handleSaveEdit} className="eh-btn-neon eh-btn-sm flex min-h-[44px] items-center gap-2 rounded-xl px-4 disabled:opacity-50" disabled={actionLoading || !editForm.nickname.trim()}>{actionLoading && <LoadingSpinner size="sm" />}Save Changes</button>
 </div>
 </div>
 </Modal>

 <Modal isOpen={isPairingModalOpen && permissions.canPairDevices} onClose={() => setIsPairingModalOpen(false)} title="Pairing Token">
 <div className="space-y-5 text-center">
 <p className="text-sm text-[var(--foreground-secondary)]">Use this token on your display device to pair it:</p>
 <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] p-6">
 {/* Ink, not the neon fill: this is a string that has to be transcribed. */}
 <div className="break-all font-mono text-lg font-bold tracking-wide text-[var(--primary-ink)]">{pairingCode}</div>
 </div>
 <p className="text-sm text-[var(--foreground-tertiary)]">This token expires in {pairingExpiresIn}</p>
 <button onClick={() => setIsPairingModalOpen(false)} className="eh-btn-neon min-h-[44px] w-full rounded-xl px-4 py-2 text-sm font-medium">Done</button>
 </div>
 </Modal>

 <ConfirmDialog isOpen={isDeleteModalOpen && permissions.canDeleteDevices} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} title="Delete Device" message={`Are you sure you want to delete "${selectedDevice?.nickname}"? This action cannot be undone.`} confirmText="Delete" type="danger" />

 <ConfirmDialog
 isOpen={isBulkDeleteModalOpen && permissions.canDeleteDevices}
 onClose={() => setIsBulkDeleteModalOpen(false)}
 onConfirm={handleBulkDelete}
 title="Delete Selected Devices"
 message={`Delete ${selectedDeviceIds.size} selected device${selectedDeviceIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
 confirmText="Delete Selected"
 type="danger"
 />

 <Modal isOpen={isBulkPlaylistModalOpen && permissions.canManageDevices} onClose={() => { setIsBulkPlaylistModalOpen(false); setBulkPlaylistId(''); }} title="Assign Playlist to Selected Devices">
 <div className="space-y-5">
 <p className="text-sm text-[var(--foreground-secondary)]">Assign a playlist to {selectedDeviceIds.size} selected device{selectedDeviceIds.size !== 1 ? 's' : ''}.</p>
 <select value={bulkPlaylistId} onChange={(e) => setBulkPlaylistId(e.target.value)} className="eh-select" aria-label="Playlist to assign">
 <option value="">Select a playlist...</option>
 {playlists.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
 </select>
 {/* Correct and server-backed: the gateway replays a deferred assignment on
     reconnect, so a non-online device is not a failed assignment. */}
 <p className="text-sm text-[var(--foreground-tertiary)]">
 This sets the assignment. Non-online devices will update when they come online.
 </p>
 <div className="flex justify-end gap-3">
 <button onClick={() => { setIsBulkPlaylistModalOpen(false); setBulkPlaylistId(''); }} className="eh-btn-ghost eh-btn-sm min-h-[44px] rounded-xl px-4">Cancel</button>
 <button onClick={handleBulkAssignPlaylist} disabled={!bulkPlaylistId || actionLoading} className="eh-btn-neon eh-btn-sm min-h-[44px] rounded-xl px-4 disabled:opacity-50">Assign</button>
 </div>
 </div>
 </Modal>

 <Modal isOpen={isBulkGroupModalOpen && permissions.canManageDevices} onClose={() => { setIsBulkGroupModalOpen(false); setBulkGroupId(''); }} title="Add Selected Devices to Group">
 <div className="space-y-5">
 <p className="text-sm text-[var(--foreground-secondary)]">Add {selectedDeviceIds.size} selected device{selectedDeviceIds.size !== 1 ? 's' : ''} to a group.</p>
 <select value={bulkGroupId} onChange={(e) => setBulkGroupId(e.target.value)} className="eh-select" aria-label="Group to add devices to">
 <option value="">Select a group...</option>
 {deviceGroups.map((g: any) => (<option key={g.id} value={g.id}>{g.name}</option>))}
 </select>
 <div className="flex justify-end gap-3">
 <button onClick={() => { setIsBulkGroupModalOpen(false); setBulkGroupId(''); }} className="eh-btn-ghost eh-btn-sm min-h-[44px] rounded-xl px-4">Cancel</button>
 <button onClick={handleBulkAssignGroup} disabled={!bulkGroupId || actionLoading} className="eh-btn-neon eh-btn-sm min-h-[44px] rounded-xl px-4 disabled:opacity-50">Add to Group</button>
 </div>
 </div>
 </Modal>

 {selectedDevice && (
 <DevicePreviewModal
 device={selectedDevice}
 isOpen={isPreviewModalOpen}
 onClose={() => setIsPreviewModalOpen(false)}
 canRequestScreenshot={permissions.canManageDevices}
 />
 )}

 {permissions.canUseEmergencyOverride && user?.organizationId && (
 <EmergencyOverrideModal
 isOpen={isOverrideModalOpen && permissions.canUseEmergencyOverride}
 onClose={() => setIsOverrideModalOpen(false)}
 organizationId={user.organizationId}
 />
 )}
 </div>
 );
}
