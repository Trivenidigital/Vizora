'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/lib/hooks/useToast';
import { Icon } from '@/theme/icons';

interface TeamUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function TeamPage() {
  const toast = useToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'viewer',
  });

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);
  const [editRole, setEditRole] = useState('viewer');

  // Deactivate dialog state
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<TeamUser | null>(null);

  // Temp password display state
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, [page]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsers({ page, limit: 10 });
      setUsers(response.data || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setActionLoading(true);
      const result = await apiClient.inviteUser(inviteForm);
      toast.success(`${inviteForm.firstName} ${inviteForm.lastName} has been invited`);
      setIsInviteModalOpen(false);
      setTempPasswordInfo({ email: inviteForm.email, password: result.tempPassword });
      setInviteForm({ email: '', firstName: '', lastName: '', role: 'viewer' });
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to invite user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditRole = (user: TeamUser) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setIsEditModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      await apiClient.updateUser(selectedUser.id, { role: editRole });
      toast.success(`Role updated for ${selectedUser.firstName} ${selectedUser.lastName}`);
      setIsEditModalOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateClick = (user: TeamUser) => {
    setUserToDeactivate(user);
    setIsDeactivateDialogOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!userToDeactivate) return;

    try {
      setActionLoading(true);
      await apiClient.deactivateUser(userToDeactivate.id);
      toast.success(`${userToDeactivate.firstName} ${userToDeactivate.lastName} has been deactivated`);
      setIsDeactivateDialogOpen(false);
      setUserToDeactivate(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate user');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Team Management</h2>
          <p className="mt-2 text-gray-600">
            Manage team members and their roles
          </p>
        </div>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <Icon name="add" size="lg" className="text-white" />
          <span>Invite User</span>
        </button>
      </div>

      {/* Temp Password Alert */}
      {tempPasswordInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icon name="warning" size="lg" className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-800">Temporary Password Created</h4>
              <p className="text-sm text-yellow-700 mt-1">
                A temporary password has been generated for <strong>{tempPasswordInfo.email}</strong>.
                Share this password securely - it will not be shown again.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-yellow-100 px-3 py-1 rounded text-sm font-mono text-yellow-900">
                  {tempPasswordInfo.password}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tempPasswordInfo.password);
                    toast.success('Password copied to clipboard');
                  }}
                  className="text-sm text-yellow-700 hover:text-yellow-900 underline"
                >
                  Copy
                </button>
              </div>
              <button
                onClick={() => setTempPasswordInfo(null)}
                className="mt-2 text-sm text-yellow-600 hover:text-yellow-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon="settings"
          title="No team members"
          description="Invite your first team member to get started"
          action={{
            label: 'Invite User',
            onClick: () => setIsInviteModalOpen(true),
          }}
        />
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.isActive)}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditRole(user)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition"
                          title="Edit role"
                        >
                          <Icon name="edit" size="md" />
                        </button>
                        {user.isActive && (
                          <button
                            onClick={() => handleDeactivateClick(user)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition"
                            title="Deactivate"
                          >
                            <Icon name="delete" size="md" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Invite User Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Team Member"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="user@company.com"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={inviteForm.firstName}
                onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="John"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={inviteForm.lastName}
                onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Doe"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              <option value="viewer">Viewer - Can view content and displays</option>
              <option value="manager">Manager - Can manage content and displays</option>
              <option value="admin">Admin - Full access including team management</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsInviteModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleInvite}
              disabled={actionLoading || !inviteForm.email || !inviteForm.firstName || !inviteForm.lastName}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading && <LoadingSpinner size="sm" />}
              Send Invite
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        title="Edit User Role"
      >
        <div className="space-y-4">
          {selectedUser && (
            <>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  Editing role for <strong>{selectedUser.firstName} {selectedUser.lastName}</strong> ({selectedUser.email})
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="viewer">Viewer - Can view content and displays</option>
                  <option value="manager">Manager - Can manage content and displays</option>
                  <option value="admin">Admin - Full access including team management</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  disabled={actionLoading || editRole === selectedUser.role}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading && <LoadingSpinner size="sm" />}
                  Save Changes
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        isOpen={isDeactivateDialogOpen}
        onClose={() => {
          setIsDeactivateDialogOpen(false);
          setUserToDeactivate(null);
        }}
        onConfirm={confirmDeactivate}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${userToDeactivate?.firstName} ${userToDeactivate?.lastName}? They will no longer be able to access the platform.`}
        confirmText="Deactivate"
        type="danger"
      />
    </div>
  );
}
