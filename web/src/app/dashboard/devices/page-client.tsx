'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Display, Playlist, DisplayGroup } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import SearchFilter from '@/components/SearchFilter';
import DeviceStatusIndicator from '@/components/DeviceStatusIndicator';
import DeviceGroupSelector from '@/components/DeviceGroupSelector';
import DevicePreviewModal from '@/components/DevicePreviewModal';
import PlaylistQuickSelect from '@/components/PlaylistQuickSelect';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useRealtimeEvents, useOptimisticState, useErrorRecovery } from '@/lib/hooks';
import { Icon } from '@/theme/icons';

interface DevicesClientProps {
 initialDevices: Display[];
 initialPlaylists: Playlist[];
}

export default function DevicesClient({ initialDevices, initialPlaylists }: DevicesClientProps) {
 const router = useRouter();
 const toast = useToast();
 const [devices, setDevices] = useState<Display[]>(initialDevices);
 const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
 const [deviceGroups, setDeviceGroups] = useState<any[]>([]);
 const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
 const [loading, setLoading] = useState(!initialDevices.length && initialDevices.length === 0 ? false : false);
 const [selectedDevice, setSelectedDevice] = useState<Display | null>(null);
 const [isEditModalOpen, setIsEditModalOpen] = useState(false);
 const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
 const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
 const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
 const [pairingCode, setPairingCode] = useState('');
 const [editForm, setEditForm] = useState({ nickname: '', location: '' });
 const [actionLoading, setActionLoading] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const debouncedSearch = useDebounce(searchQuery, 300);
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
 const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'offline' | 'error'>('offline');

 // Memoized callback for device status changes
 const handleDeviceStatusChange = useCallback((update: { deviceId: string; status: 'online' | 'offline'; lastSeen?: string; currentPlaylistId?: string }) => {
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
 const handleConnectionChange = useCallback((isConnected: boolean) => {
 setRealtimeStatus(isConnected ? 'connected' : 'offline');
 if (isConnected) {
 toast.info('Real-time connection established');
 }
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
 if (initialDevices.length === 0) {
 loadDevices();
 }
 if (initialPlaylists.length === 0) {
 loadPlaylists();
 }
 loadGroups();
 }, []);

 const loadDevices = async () => {
 try {
 setLoading(true);
 await retry(
 'loadDevices',
 async () => {
 const response = await apiClient.getDisplays();
 const devicesList = response.data || response || [];
 setDevices(devicesList);
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
 } finally {
 setLoading(false);
 }
 };

 const loadPlaylists = async () => {
 try {
 const response = await apiClient.getPlaylists();
 setPlaylists(response.data || response || []);
 } catch (error) {
 // Silent fail
 }
 };

 const loadGroups = async () => {
 try {
 const response = await apiClient.getDisplayGroups();
 const groups = response.data || [];
 setDeviceGroups(groups.map((g: any) => ({
 id: g.id,
 name: g.name,
 description: g.description || '',
 deviceIds: g.displays?.map((d: any) => d.displayId) || [],
 })));
 } catch (error) {
 // Silent fail
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
 commitOptimistic(updateId);
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
 commitOptimistic(deleteId);
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
 setPairingCode(response.pairingCode || 'N/A');
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

 const toggleSelectAll = () => {
 if (selectedDeviceIds.size === displayDevices.length) {
 setSelectedDeviceIds(new Set());
 } else {
 setSelectedDeviceIds(new Set(displayDevices.map(d => d.id)));
 }
 };

 const handleBulkDelete = async () => {
 if (selectedDeviceIds.size === 0) return;
 try {
 setActionLoading(true);
 await apiClient.bulkDeleteDisplays(Array.from(selectedDeviceIds));
 toast.success(`Deleted ${selectedDeviceIds.size} device(s)`);
 setSelectedDeviceIds(new Set());
 loadDevices();
 } catch (error: any) {
 toast.error(error.message || 'Bulk delete failed');
 } finally {
 setActionLoading(false);
 }
 };

 const handleBulkAssignPlaylist = async () => {
 if (!bulkPlaylistId || selectedDeviceIds.size === 0) return;
 try {
 setActionLoading(true);
 await apiClient.bulkAssignPlaylist(Array.from(selectedDeviceIds), bulkPlaylistId);
 toast.success(`Playlist assigned to ${selectedDeviceIds.size} device(s)`);
 setSelectedDeviceIds(new Set());
 setIsBulkPlaylistModalOpen(false);
 setBulkPlaylistId('');
 loadDevices();
 } catch (error: any) {
 toast.error(error.message || 'Bulk assign failed');
 } finally {
 setActionLoading(false);
 }
 };

 const handleBulkAssignGroup = async () => {
 if (!bulkGroupId || selectedDeviceIds.size === 0) return;
 try {
 setActionLoading(true);
 await apiClient.bulkAssignGroup(Array.from(selectedDeviceIds), bulkGroupId);
 toast.success(`Added ${selectedDeviceIds.size} device(s) to group`);
 setSelectedDeviceIds(new Set());
 setIsBulkGroupModalOpen(false);
 setBulkGroupId('');
 loadDevices();
 loadGroups();
 } catch (error: any) {
 toast.error(error.message || 'Bulk group assign failed');
 } finally {
 setActionLoading(false);
 }
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

 // Filter and sort devices
 const filteredAndSortedDevices = devices
 .filter(d =>
 !debouncedSearch ||
 d.nickname.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
 (d.location && d.location.toLowerCase().includes(debouncedSearch.toLowerCase()))
 )
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

 useEffect(() => {
 setCurrentPage(1);
 setSelectedDeviceIds(new Set());
 }, [debouncedSearch]);

 const getSortIcon = (field: keyof Display) => {
 if (sortField !== field) return null;
 return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
 };

 return (
 <div className="space-y-6">
 <toast.ToastContainer />

 <div className="flex justify-between items-center">
 <div>
 <div className="flex items-center gap-2">
 <h2 className="eh-heading font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Devices</h2>
 <div
 className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
 realtimeStatus === 'connected'
 ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200'
 : realtimeStatus === 'offline'
 ? 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200'
 : 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-200'
 }`}
 >
 <span className={`h-2 w-2 rounded-full ${
 realtimeStatus === 'connected'
 ? 'bg-success-500'
 : realtimeStatus === 'offline'
 ? 'bg-warning-500'
 : 'bg-error-500'
 }`} />
 {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'offline' ? 'Offline' : 'Error'}
 </div>
 </div>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Manage your paired display devices ({devices.length} total)
 {hasPendingUpdates() && ' \u2022 Syncing changes...'}
 </p>
 </div>
 <button
 onClick={() => router.push('/dashboard/devices/pair')}
 className="bg-[#00E5A0] text-[#061A21] px-6 py-3 rounded-lg hover:bg-[#00CC8E] transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
 >
 <Icon name="add" size="lg" className="text-white" />
 <span>Pair New Device</span>
 </button>
 </div>

 <SearchFilter
 value={searchQuery}
 onChange={setSearchQuery}
 placeholder="Search devices by name or location..."
 />

 <div className="bg-[var(--surface)] rounded-lg shadow">
 <button
 onClick={() => setShowGroupFilter(!showGroupFilter)}
 className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-[var(--surface-hover)] transition rounded-lg"
 >
 <span className="text-sm font-medium text-[var(--foreground-secondary)]">
 Device Groups ({deviceGroups.length})
 </span>
 <span className="text-[var(--foreground-tertiary)]">{showGroupFilter ? '\u25B2' : '\u25BC'}</span>
 </button>
 {showGroupFilter && (
 <div className="px-6 pb-4">
 <DeviceGroupSelector
 groups={deviceGroups}
 selectedGroupIds={selectedGroups}
 onChange={setSelectedGroups}
 showCreate={true}
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

 {loading ? (
 <div className="bg-[var(--surface)] rounded-lg shadow p-12">
 <LoadingSpinner size="lg" />
 </div>
 ) : devices.length === 0 ? (
 <EmptyState
 icon="devices"
 title="No devices yet"
 description="Get started by pairing your first display device"
 action={{
 label: 'Pair Device',
 onClick: () => router.push('/dashboard/devices/pair'),
 }}
 />
 ) : (
 <>
 {debouncedSearch && (
 <div className="bg-info-50 dark:bg-info-900 border border-info-200 dark:border-info-700 rounded-lg p-3 mb-4">
 <p className="text-sm text-info-800 dark:text-info-200">
 {displayDevices.length}{' '}
 {displayDevices.length === 1 ? 'result' : 'results'} found
 </p>
 </div>
 )}
 {selectedDeviceIds.size > 0 && (
 <div className="bg-[#00E5A0]/5 dark:bg-[#00E5A0]/10 border border-[#00E5A0]/30 dark:border-[#00E5A0] rounded-lg p-4 flex items-center justify-between">
 <span className="text-sm font-medium text-[#00E5A0] dark:text-[#00E5A0]">
 {selectedDeviceIds.size} device{selectedDeviceIds.size !== 1 ? 's' : ''} selected
 </span>
 <div className="flex gap-4 items-center">
 <button onClick={() => setIsBulkPlaylistModalOpen(true)} className="px-4 py-2 text-sm bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-medium">Assign Playlist</button>
 <button onClick={() => setIsBulkGroupModalOpen(true)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">Add to Group</button>
 <button onClick={handleBulkDelete} disabled={actionLoading} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50">Delete Selected</button>
 <button onClick={() => setSelectedDeviceIds(new Set())} className="px-4 py-2 text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition">Clear</button>
 </div>
 </div>
 )}
 <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
 <table className="min-w-full divide-y divide-[var(--border)]">
 <thead className="bg-[var(--background)]">
 <tr>
 <th className="px-4 py-3 text-left">
 <input type="checkbox" checked={selectedDeviceIds.size === displayDevices.length && displayDevices.length > 0} onChange={toggleSelectAll} className="rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]" />
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-hover)] select-none" onClick={() => handleSort('nickname')}>Device{getSortIcon('nickname')}</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-hover)] select-none" onClick={() => handleSort('status')}>Status{getSortIcon('status')}</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-hover)] select-none" onClick={() => handleSort('location')}>Location{getSortIcon('location')}</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">Currently Playing</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider cursor-pointer hover:bg-[var(--surface-hover)] select-none" onClick={() => handleSort('lastSeen')}>Last Seen{getSortIcon('lastSeen')}</th>
 <th className="px-6 py-3 text-right text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">Actions</th>
 </tr>
 </thead>
 <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
 {displayDevices.map((device) => (
 <tr key={device.id} className="hover:bg-[var(--surface-hover)] transition">
 <td className="px-4 py-4"><input type="checkbox" checked={selectedDeviceIds.has(device.id)} onChange={() => toggleDeviceSelection(device.id)} className="rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]" /></td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center">
 <Icon name="devices" size="xl" className="mr-3 text-[var(--foreground-secondary)]" />
 <div>
 <div className="text-sm font-semibold text-[var(--foreground)]">{device.nickname}</div>
 <div className="text-xs text-[var(--foreground-tertiary)]">ID: {device.id}</div>
 </div>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap"><DeviceStatusIndicator deviceId={device.id} showLabel showTime /></td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-secondary)]">{device.location || '\u2014'}</td>
 <td className="px-6 py-4 whitespace-nowrap text-sm">
 <PlaylistQuickSelect device={device} playlists={playlists} onSuccess={() => toast.success('Playlist updated')} onError={(err) => toast.error(err.message || 'Failed to update playlist')} onUpdate={() => { loadDevices(); }} />
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-tertiary)]">{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}</td>
 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
 <div className="flex justify-end gap-2">
 <button onClick={() => handlePreview(device)} className="text-green-600 hover:text-green-800 hover:bg-green-50 px-3 py-1 rounded transition font-medium" title="Preview device screen">Preview</button>
 <button onClick={() => handleEdit(device)} className="text-[#00E5A0] hover:text-[#00E5A0] hover:bg-[#00E5A0]/5 px-3 py-1 rounded transition font-medium">Edit</button>
 <button onClick={() => handleGeneratePairingCode(device)} className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-3 py-1 rounded transition font-medium">Pair</button>
 <button onClick={() => handleDelete(device)} className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition font-medium">Delete</button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {totalItems > 0 && (
 <div className="bg-[var(--surface)] px-4 py-3 flex items-center justify-between border-t border-[var(--border)] sm:px-6 rounded-b-lg">
 <div className="flex-1 flex justify-between sm:hidden">
 <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-[var(--border)] text-sm font-medium rounded-md text-[var(--foreground-secondary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
 <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-[var(--border)] text-sm font-medium rounded-md text-[var(--foreground-secondary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
 </div>
 <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
 <div className="flex items-center gap-4">
 <p className="text-sm text-[var(--foreground-secondary)]">Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of <span className="font-medium">{totalItems}</span> devices</p>
 <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="text-sm border-[var(--border)] rounded-md">
 <option value={10}>10 per page</option>
 <option value={25}>25 per page</option>
 <option value={50}>50 per page</option>
 <option value={100}>100 per page</option>
 </select>
 </div>
 <div>
 <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
 <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--foreground-tertiary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed">{'\u2190'} Previous</button>
 {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
 let pageNum;
 if (totalPages <= 5) { pageNum = i + 1; }
 else if (currentPage <= 3) { pageNum = i + 1; }
 else if (currentPage >= totalPages - 2) { pageNum = totalPages - 4 + i; }
 else { pageNum = currentPage - 2 + i; }
 return (
 <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === pageNum ? 'z-10 bg-[#00E5A0]/5 border-[#00E5A0] text-[#00E5A0]' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground-tertiary)] hover:bg-[var(--surface-hover)]'}`}>{pageNum}</button>
 );
 })}
 <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--foreground-tertiary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed">Next {'\u2192'}</button>
 </nav>
 </div>
 </div>
 </div>
 )}
 </>
 )}

 <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Device">
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">Device Nickname</label>
 <input type="text" value={editForm.nickname} onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })} className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent" placeholder="e.g., Store Front Display" />
 </div>
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">Location (Optional)</label>
 <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent" placeholder="e.g., Main Entrance" />
 </div>
 <div className="flex justify-end gap-3 pt-4">
 <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition" disabled={actionLoading}>Cancel</button>
 <button onClick={handleSaveEdit} className="px-4 py-2 text-sm font-medium text-white bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 flex items-center gap-2" disabled={actionLoading || !editForm.nickname.trim()}>{actionLoading && <LoadingSpinner size="sm" />}Save Changes</button>
 </div>
 </div>
 </Modal>

 <Modal isOpen={isPairingModalOpen} onClose={() => setIsPairingModalOpen(false)} title="Pairing Code">
 <div className="text-center space-y-4">
 <p className="text-[var(--foreground-secondary)]">Enter this code on your display device to pair it:</p>
 <div className="bg-[var(--background-secondary)] rounded-lg p-6">
 <div className="text-4xl font-bold text-[#00E5A0] tracking-widest">{pairingCode}</div>
 </div>
 <p className="text-sm text-[var(--foreground-tertiary)]">This code will expire in 5 minutes</p>
 <button onClick={() => setIsPairingModalOpen(false)} className="w-full px-4 py-2 text-sm font-medium text-white bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition">Done</button>
 </div>
 </Modal>

 <ConfirmDialog isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} title="Delete Device" message={`Are you sure you want to delete "${selectedDevice?.nickname}"? This action cannot be undone.`} confirmText="Delete" type="danger" />

 <Modal isOpen={isBulkPlaylistModalOpen} onClose={() => { setIsBulkPlaylistModalOpen(false); setBulkPlaylistId(''); }} title="Assign Playlist to Selected Devices">
 <div className="space-y-4">
 <p className="text-sm text-[var(--foreground-secondary)]">Assign a playlist to {selectedDeviceIds.size} selected device{selectedDeviceIds.size !== 1 ? 's' : ''}.</p>
 <select value={bulkPlaylistId} onChange={(e) => setBulkPlaylistId(e.target.value)} className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)]">
 <option value="">Select a playlist...</option>
 {playlists.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
 </select>
 <div className="flex justify-end gap-3">
 <button onClick={() => { setIsBulkPlaylistModalOpen(false); setBulkPlaylistId(''); }} className="px-4 py-2 text-[var(--foreground-secondary)] bg-[var(--background-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition">Cancel</button>
 <button onClick={handleBulkAssignPlaylist} disabled={!bulkPlaylistId || actionLoading} className="px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] disabled:opacity-50 transition">Assign</button>
 </div>
 </div>
 </Modal>

 <Modal isOpen={isBulkGroupModalOpen} onClose={() => { setIsBulkGroupModalOpen(false); setBulkGroupId(''); }} title="Add Selected Devices to Group">
 <div className="space-y-4">
 <p className="text-sm text-[var(--foreground-secondary)]">Add {selectedDeviceIds.size} selected device{selectedDeviceIds.size !== 1 ? 's' : ''} to a group.</p>
 <select value={bulkGroupId} onChange={(e) => setBulkGroupId(e.target.value)} className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)]">
 <option value="">Select a group...</option>
 {deviceGroups.map((g: any) => (<option key={g.id} value={g.id}>{g.name}</option>))}
 </select>
 <div className="flex justify-end gap-3">
 <button onClick={() => { setIsBulkGroupModalOpen(false); setBulkGroupId(''); }} className="px-4 py-2 text-[var(--foreground-secondary)] bg-[var(--background-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition">Cancel</button>
 <button onClick={handleBulkAssignGroup} disabled={!bulkGroupId || actionLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition">Add to Group</button>
 </div>
 </div>
 </Modal>

 {selectedDevice && (
 <DevicePreviewModal device={selectedDevice} isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} />
 )}
 </div>
 );
}
