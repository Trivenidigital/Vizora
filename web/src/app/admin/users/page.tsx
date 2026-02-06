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
        return 'bg-[#00E5A0]/10 text-[#00E5A0] dark:bg-[#00E5A0]/10 dark:text-[#00E5A0]';
      default:
        return 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Users</h1>
        <p className="mt-1 text-[var(--foreground-secondary)]">
          Manage all users across organizations
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-tertiary)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
        />
      </div>

      {/* Users Table */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--background)] border-b border-[var(--border)]">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    User
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Organization
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Last Login
                  </th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] flex items-center justify-center">
                          <span className="text-[#061A21] text-sm font-semibold">
                            {user.firstName[0]}
                            {user.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[var(--foreground)]">
                              {user.firstName} {user.lastName}
                            </p>
                            {user.isSuperAdmin && (
                              <span title="Super Admin">
                                <Shield className="w-4 h-4 text-yellow-500" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-[var(--foreground-tertiary)]">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[var(--foreground-tertiary)]" />
                        <span className="text-[var(--foreground)]">{user.organization.name}</span>
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
                      <div className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)]">
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
            <Users className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">No users found</h3>
            <p className="text-[var(--foreground-secondary)]">
              {search ? 'Try adjusting your search.' : 'Users will appear here when they sign up.'}
            </p>
          </div>
        )}

        {/* Pagination Info */}
        {!loading && users.length > 0 && (
          <div className="px-6 py-3 bg-[var(--background)] border-t border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-secondary)]">
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
        type={actionType === 'disable' ? 'danger' : 'info'}
      />
    </div>
  );
}
