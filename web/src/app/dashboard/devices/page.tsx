'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Display } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';

export default function DevicesPage() {
  const router = useRouter();
  const toast = useToast();
  const [devices, setDevices] = useState<Display[]>([]);
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

  useEffect(() => {
    loadDevices();
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
    return status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getStatusDot = (status: string) => {
    return status === 'online' ? 'bg-green-500' : 'bg-gray-400';
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Devices</h2>
          <p className="mt-2 text-gray-600">
            Manage your paired display devices ({devices.length} total)
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/devices/pair')}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          <span>Pair New Device</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search devices by name or location..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoComplete="off"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Device List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📺</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No devices yet</h3>
          <p className="text-gray-600 mb-6">Get started by pairing your first display device</p>
          <button
            onClick={() => router.push('/dashboard/devices/pair')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Pair Device
          </button>
        </div>
      ) : (
        <>
          {debouncedSearch && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                {devices.filter(d => 
                  d.nickname.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                  (d.location && d.location.toLowerCase().includes(debouncedSearch.toLowerCase()))
                ).length}{' '}
                {devices.filter(d => 
                  d.nickname.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                  (d.location && d.location.toLowerCase().includes(debouncedSearch.toLowerCase()))
                ).length === 1 ? 'result' : 'results'} found
              </p>
            </div>
          )}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {devices
                  .filter(d => 
                    !debouncedSearch || 
                    d.nickname.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                    (d.location && d.location.toLowerCase().includes(debouncedSearch.toLowerCase()))
                  )
                  .map((device) => (
                <tr key={device.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-3xl mr-3">📺</span>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {device.nickname}
                        </div>
                        <div className="text-xs text-gray-500">ID: {device.id}</div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {device.location || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
