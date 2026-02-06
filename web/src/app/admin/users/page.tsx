'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type { AdminUser } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { StatusBadge } from '../components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Search, Users, Building2, Calendar, Shield, UserX, UserCheck, Mail } from 'lucide-react';

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [actionType, setActionType] = useState<'disable' | 'enable' | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = search ? { search } : undefined;
      const data = await apiClient.getAdminUsers(params);
      setUsers(data.data);
      setTotal(data.total);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    const timeout = setTimeout(loadUsers, 300);
    return () => clearTimeout(timeout);
  }, [loadUsers]);

  const handleAction = async () => {
    if (!actionUser || !actionType) return;
    try {
      if (actionType === 'disable') {
        await apiClient.disableUser(actionUser.id);
        toast.success(`${actionUser.email} has been disabled`);
      } else {
        await apiClient.enableUser(actionUser.id);
        toast.success(`${actionUser.email} has been enabled`);
      }
      setActionUser(null);
      setActionType(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    }
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

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'owner':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Manage all users across organizations
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    User
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Organization
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Last Login
                  </th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {user.firstName[0]}
                            {user.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {user.firstName} {user.lastName}
                            </p>
                            {user.isSuperAdmin && (
                              <Shield className="w-4 h-4 text-yellow-500" title="Super Admin" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white">{user.organization.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={user.isActive ? 'active' : 'inactive'} size="sm" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(user.lastLoginAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {user.isActive ? (
                          <button
                            onClick={() => {
                              setActionUser(user);
                              setActionType('disable');
                            }}
                            disabled={user.isSuperAdmin}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title={user.isSuperAdmin ? 'Cannot disable super admin' : 'Disable user'}
                          >
                            <UserX className="w-4 h-4" />
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActionUser(user);
                              setActionType('enable');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                          >
                            <UserCheck className="w-4 h-4" />
                            Enable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {search ? 'Try adjusting your search.' : 'Users will appear here when they sign up.'}
            </p>
          </div>
        )}

        {/* Pagination Info */}
        {!loading && users.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {users.length} of {total} users
            </p>
          </div>
        )}
      </div>

      {/* Action Confirmation */}
      <ConfirmDialog
        isOpen={!!actionType}
        onClose={() => {
          setActionUser(null);
          setActionType(null);
        }}
        onConfirm={handleAction}
        title={actionType === 'disable' ? 'Disable User' : 'Enable User'}
        message={
          actionType === 'disable'
            ? `Are you sure you want to disable "${actionUser?.email}"? They will not be able to log in.`
            : `Are you sure you want to enable "${actionUser?.email}"? They will be able to log in again.`
        }
        confirmText={actionType === 'disable' ? 'Disable' : 'Enable'}
        type={actionType === 'disable' ? 'danger' : 'primary'}
      />
    </div>
  );
}
