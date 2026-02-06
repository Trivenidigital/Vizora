'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type { AdminOrganization } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { StatusBadge } from '../components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Search, Building2, Users, Monitor, Calendar, MoreVertical, Ban, Play, Clock } from 'lucide-react';

export default function AdminOrganizationsPage() {
  const toast = useToast();
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [total, setTotal] = useState(0);
  const [actionOrg, setActionOrg] = useState<AdminOrganization | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'extend' | null>(null);
  const [extendDays, setExtendDays] = useState(7);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const params: { search?: string; status?: string } = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await apiClient.getAdminOrganizations(params);
      setOrganizations(data.data);
      setTotal(data.total);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => {
    const timeout = setTimeout(loadOrganizations, 300);
    return () => clearTimeout(timeout);
  }, [loadOrganizations]);

  const handleAction = async () => {
    if (!actionOrg || !actionType) return;
    try {
      switch (actionType) {
        case 'suspend':
          await apiClient.suspendOrganization(actionOrg.id);
          toast.success(`${actionOrg.name} has been suspended`);
          break;
        case 'unsuspend':
          await apiClient.unsuspendOrganization(actionOrg.id);
          toast.success(`${actionOrg.name} has been reactivated`);
          break;
        case 'extend':
          await apiClient.extendTrial(actionOrg.id, extendDays);
          toast.success(`Trial extended by ${extendDays} days`);
          break;
      }
      setActionOrg(null);
      setActionType(null);
      loadOrganizations();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Organizations</h1>
        <p className="mt-1 text-[var(--foreground-secondary)]">
          Manage customer organizations and subscriptions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations..."
            className="w-full pl-10 pr-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="suspended">Suspended</option>
          <option value="canceled">Canceled</option>
          <option value="past_due">Past Due</option>
        </select>
      </div>

      {/* Organizations Table */}
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
                    Organization
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Plan
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Users
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Screens
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Created
                  </th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-[var(--foreground)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-[#061A21]" />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{org.name}</p>
                          <p className="text-sm text-[var(--foreground-tertiary)]">{org.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-[var(--foreground)] capitalize">
                        {org.subscriptionTier}
                      </span>
                      <p className="text-sm text-[var(--foreground-tertiary)]">
                        {org.screenQuota} screens
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={org.subscriptionStatus} size="sm" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--foreground-tertiary)]" />
                        <span className="text-[var(--foreground)]">{org._count.users}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[var(--foreground-tertiary)]" />
                        <span className="text-[var(--foreground)]">
                          {org._count.displays}
                          <span className="text-[var(--foreground-tertiary)]">
                            {' '}
                            / {org.screenQuota}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-[var(--foreground-secondary)]">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(org.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative flex justify-end">
                        <button
                          onClick={() => setMenuOpen(menuOpen === org.id ? null : org.id)}
                          className="p-2 text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {menuOpen === org.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setMenuOpen(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-20">
                              {org.subscriptionStatus !== 'suspended' ? (
                                <button
                                  onClick={() => {
                                    setActionOrg(org);
                                    setActionType('suspend');
                                    setMenuOpen(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                  <Ban className="w-4 h-4" />
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setActionOrg(org);
                                    setActionType('unsuspend');
                                    setMenuOpen(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2"
                                >
                                  <Play className="w-4 h-4" />
                                  Reactivate
                                </button>
                              )}
                              {org.subscriptionStatus === 'trialing' && (
                                <button
                                  onClick={() => {
                                    setActionOrg(org);
                                    setActionType('extend');
                                    setMenuOpen(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-[#00E5A0] hover:bg-[#00E5A0]/5 flex items-center gap-2"
                                >
                                  <Clock className="w-4 h-4" />
                                  Extend Trial
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && organizations.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
              No organizations found
            </h3>
            <p className="text-[var(--foreground-secondary)]">
              {search || statusFilter
                ? 'Try adjusting your search or filters.'
                : 'Organizations will appear here when customers sign up.'}
            </p>
          </div>
        )}

        {/* Pagination Info */}
        {!loading && organizations.length > 0 && (
          <div className="px-6 py-3 bg-[var(--background)] border-t border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-secondary)]">
              Showing {organizations.length} of {total} organizations
            </p>
          </div>
        )}
      </div>

      {/* Suspend/Unsuspend Confirmation */}
      <ConfirmDialog
        isOpen={actionType === 'suspend' || actionType === 'unsuspend'}
        onClose={() => {
          setActionOrg(null);
          setActionType(null);
        }}
        onConfirm={handleAction}
        title={actionType === 'suspend' ? 'Suspend Organization' : 'Reactivate Organization'}
        message={
          actionType === 'suspend'
            ? `Are you sure you want to suspend "${actionOrg?.name}"? They will lose access to the platform immediately.`
            : `Are you sure you want to reactivate "${actionOrg?.name}"? They will regain access to the platform.`
        }
        confirmText={actionType === 'suspend' ? 'Suspend' : 'Reactivate'}
        type={actionType === 'suspend' ? 'danger' : 'info'}
      />

      {/* Extend Trial Modal */}
      {actionType === 'extend' && actionOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
              Extend Trial for {actionOrg.name}
            </h2>
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                Days to extend
              </label>
              <input
                type="number"
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                min={1}
                max={365}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setActionOrg(null);
                  setActionType(null);
                }}
                className="px-4 py-2 text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className="px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition"
              >
                Extend Trial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
