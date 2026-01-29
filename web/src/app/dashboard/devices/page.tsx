'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Display, Playlist } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import SearchFilter from '@/components/SearchFilter';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Icon } from '@/theme/icons';

export default function DevicesPage() {
  const router = useRouter();
  const toast = useToast();
  const [devices, setDevices] = useState<Display[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<Display | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [editForm, setEditForm] = useState({ nickname: '', location: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortField, setSortField] = useState<keyof Display | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    loadDevices();
    loadPlaylists();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDisplays();
      setDevices(response.data || response || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load devices');
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

  const getCurrentPlaylistName = (playlistId?: string) => {
    if (!playlistId) return null;
    const playlist = playlists.find(p => p.id === playlistId);
    return playlist?.name || null;
  };

  const handleEdit = (device: Display) => {
    setSelectedDevice(device);
    setEditForm({ nickname: device.nickname, location: device.location || '' });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDevice) return;
    
    try {
      setActionLoading(true);
      await apiClient.updateDisplay(selectedDevice.id, editForm);
      toast.success('Device updated successfully');
      setIsEditModalOpen(false);
      loadDevices();
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
      await apiClient.deleteDisplay(selectedDevice.id);
      toast.success('Device deleted successfully');
      loadDevices();
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-success-100 dark:bg-success-900 text-success-800 dark:text-success-200';
      case 'offline':
        return 'bg-error-100 dark:bg-error-900 text-error-800 dark:text-error-200';
      case 'idle':
        return 'bg-warning-100 dark:bg-warning-900 text-warning-800 dark:text-warning-200';
      default:
        return 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-success-500';
      case 'offline':
        return 'bg-error-500';
      case 'idle':
        return 'bg-warning-500';
      default:
        return 'bg-neutral-400';
    }
  };

  const handleSort = (field: keyof Display) => {
    if (sortField === field) {
      // Toggle direction or clear sort
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
      
      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Compare
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

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const getSortIcon = (field: keyof Display) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Devices</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your paired display devices ({devices.length} total)
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/devices/pair')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <Icon name="add" size="lg" className="text-white" />
          <span>Pair New Device</span>
        </button>
      </div>

      {/* Search Filter */}
      <SearchFilter
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search devices by name or location..."
      />

      {/* Device List */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12">
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
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('nickname')}
                  >
                    Device{getSortIcon('nickname')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('status')}
                  >
                    Status{getSortIcon('status')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('location')}
                  >
                    Location{getSortIcon('location')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Currently Playing
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('lastSeen')}
                  >
                    Last Seen{getSortIcon('lastSeen')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {displayDevices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Icon name="devices" size="xl" className="mr-3 text-gray-600 dark:text-gray-400" />
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                          {device.nickname}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {device.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusDot(device.status)}`} />
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          device.status
                        )}`}
                      >
                        {device.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {device.location || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getCurrentPlaylistName(device.currentPlaylistId) ? (
                      <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
                        <Icon name="playlists" size="sm" className="text-primary-800 dark:text-primary-200" />
                        <span>{getCurrentPlaylistName(device.currentPlaylistId)}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600 italic">No playlist</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {device.lastSeen
                      ? new Date(device.lastSeen).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(device)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded transition font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleGeneratePairingCode(device)}
                        className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-3 py-1 rounded transition font-medium"
                      >
                        Pair
                      </button>
                      <button
                        onClick={() => handleDelete(device)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-b-lg">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of{' '}
                    <span className="font-medium">{totalItems}</span> devices
                  </p>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="text-sm border-gray-300 rounded-md"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Device"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device Nickname
            </label>
            <input
              type="text"
              value={editForm.nickname}
              onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Store Front Display"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location (Optional)
            </label>
            <input
              type="text"
              value={editForm.location}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Main Entrance"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              disabled={actionLoading || !editForm.nickname.trim()}
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Pairing Modal */}
      <Modal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        title="Pairing Code"
      >
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            Enter this code on your display device to pair it:
          </p>
          <div className="bg-gray-100 rounded-lg p-6">
            <div className="text-4xl font-bold text-blue-600 tracking-widest">
              {pairingCode}
            </div>
          </div>
          <p className="text-sm text-gray-500">
            This code will expire in 5 minutes
          </p>
          <button
            onClick={() => setIsPairingModalOpen(false)}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Done
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Device"
        message={`Are you sure you want to delete "${selectedDevice?.nickname}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
