'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { AdminAuditLog, IpBlocklistEntry } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { StatusBadge } from '../components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  Shield,
  Globe,
  Plus,
  Trash2,
  Clock,
  User,
  Activity,
  Ban,
  X,
} from 'lucide-react';

export default function AdminSecurityPage() {
  const toast = useToast();
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [blocklist, setBlocklist] = useState<IpBlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'blocklist'>('audit');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockIp, setBlockIp] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [auditData, blocklistData] = await Promise.all([
        apiClient.getAdminAuditLogs(),
        apiClient.getIpBlocklist(),
      ]);
      setAuditLogs(auditData);
      setBlocklist(blocklistData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIp = async () => {
    if (!blockIp.trim()) {
      toast.error('Please enter an IP address');
      return;
    }
    try {
      setBlockLoading(true);
      await apiClient.blockIp(blockIp.trim(), blockReason.trim());
      toast.success(`IP ${blockIp} has been blocked`);
      setShowBlockModal(false);
      setBlockIp('');
      setBlockReason('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to block IP');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblockIp = async () => {
    if (!unblockingId) return;
    try {
      await apiClient.unblockIp(unblockingId);
      toast.success('IP has been unblocked');
      setUnblockingId(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to unblock IP');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('suspend') || action.includes('block')) {
      return 'text-red-600 dark:text-red-400';
    }
    if (action.includes('create') || action.includes('enable') || action.includes('unblock')) {
      return 'text-green-600 dark:text-green-400';
    }
    return 'text-blue-600 dark:text-blue-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Security</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Audit logs and IP blocking management
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Audit Logs
              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
                {auditLogs.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('blocklist')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
              activeTab === 'blocklist'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4" />
              IP Blocklist
              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
                {blocklist.filter((b) => b.isActive).length}
              </span>
            </div>
          </button>
        </nav>
      </div>

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Time
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Admin
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Action
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Target
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        {formatDate(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white text-sm">
                          {log.adminUserId.slice(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.targetType && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {log.targetType}
                          {log.targetId && (
                            <span className="text-gray-400"> ({log.targetId.slice(0, 8)}...)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {log.ipAddress || 'N/A'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {auditLogs.length === 0 && (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No audit logs yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Admin actions will be logged here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* IP Blocklist Tab */}
      {activeTab === 'blocklist' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowBlockModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <Plus className="w-5 h-5" />
              Block IP
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      IP Address
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Reason
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Blocked At
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Expires
                    </th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {blocklist.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-gray-400" />
                          <code className="text-sm font-mono text-gray-900 dark:text-white">
                            {entry.ipAddress}
                          </code>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {entry.reason || 'No reason provided'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          status={entry.isActive ? 'error' : 'inactive'}
                          size="sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(entry.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {entry.expiresAt ? formatDate(entry.expiresAt) : 'Never'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setUnblockingId(entry.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                            Unblock
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {blocklist.length === 0 && (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No blocked IPs
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Block malicious IP addresses to protect the platform.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block IP Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Block IP Address</h2>
              <button
                onClick={() => setShowBlockModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  IP Address
                </label>
                <input
                  type="text"
                  value={blockIp}
                  onChange={(e) => setBlockIp(e.target.value)}
                  placeholder="192.168.1.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Why is this IP being blocked?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockIp}
                disabled={blockLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {blockLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Blocking...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Block IP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Confirmation */}
      <ConfirmDialog
        isOpen={!!unblockingId}
        onClose={() => setUnblockingId(null)}
        onConfirm={handleUnblockIp}
        title="Unblock IP"
        message="Are you sure you want to unblock this IP address? They will be able to access the platform again."
        confirmText="Unblock"
        type="primary"
      />
    </div>
  );
}
