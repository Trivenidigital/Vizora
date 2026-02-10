'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/lib/hooks/useToast';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Icon } from '@/theme/icons';

interface AuditLogEntry {
 id: string;
 action: string;
 entityType: string;
 entityId: string;
 changes: Record<string, any> | null;
 ipAddress: string | null;
 userAgent: string | null;
 createdAt: string;
 userId: string | null;
 user: {
 id: string;
 email: string;
 firstName: string;
 lastName: string;
 } | null;
}

interface FilterUser {
 id: string;
 email: string;
 firstName: string;
 lastName: string;
}

const ACTION_OPTIONS = [
 { value: '', label: 'All Actions' },
 { value: 'user_invited', label: 'User Invited' },
 { value: 'user_updated', label: 'User Updated' },
 { value: 'user_deactivated', label: 'User Deactivated' },
 { value: 'content_created', label: 'Content Created' },
 { value: 'content_updated', label: 'Content Updated' },
 { value: 'content_deleted', label: 'Content Deleted' },
 { value: 'display_created', label: 'Display Created' },
 { value: 'display_updated', label: 'Display Updated' },
 { value: 'display_deleted', label: 'Display Deleted' },
 { value: 'playlist_created', label: 'Playlist Created' },
 { value: 'playlist_updated', label: 'Playlist Updated' },
 { value: 'playlist_deleted', label: 'Playlist Deleted' },
 { value: 'login', label: 'Login' },
 { value: 'logout', label: 'Logout' },
];

const ENTITY_TYPE_OPTIONS = [
 { value: '', label: 'All Entity Types' },
 { value: 'user', label: 'User' },
 { value: 'content', label: 'Content' },
 { value: 'display', label: 'Display' },
 { value: 'playlist', label: 'Playlist' },
 { value: 'schedule', label: 'Schedule' },
 { value: 'organization', label: 'Organization' },
];

export default function AuditLogClient() {
 const toast = useToast();
 const [logs, setLogs] = useState<AuditLogEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [page, setPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [total, setTotal] = useState(0);

 // Filter state
 const [actionFilter, setActionFilter] = useState('');
 const [entityTypeFilter, setEntityTypeFilter] = useState('');
 const [userIdFilter, setUserIdFilter] = useState('');
 const [startDate, setStartDate] = useState('');
 const [endDate, setEndDate] = useState('');

 // Users for filter dropdown
 const [filterUsers, setFilterUsers] = useState<FilterUser[]>([]);

 // Expanded rows for showing JSON changes
 const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

 const debouncedAction = useDebounce(actionFilter, 300);
 const debouncedEntityType = useDebounce(entityTypeFilter, 300);
 const debouncedUserId = useDebounce(userIdFilter, 300);
 const debouncedStartDate = useDebounce(startDate, 300);
 const debouncedEndDate = useDebounce(endDate, 300);

 useEffect(() => {
 loadFilterUsers();
 }, []);

 useEffect(() => {
 setPage(1);
 }, [debouncedAction, debouncedEntityType, debouncedUserId, debouncedStartDate, debouncedEndDate]);

 useEffect(() => {
 loadLogs();
 }, [page, debouncedAction, debouncedEntityType, debouncedUserId, debouncedStartDate, debouncedEndDate]);

 const loadFilterUsers = async () => {
 try {
 const response = await apiClient.getUsers({ limit: 100 });
 setFilterUsers(response.data || []);
 } catch (error: any) {
 console.error('Failed to load users for filter:', error);
 }
 };

 const loadLogs = useCallback(async () => {
 try {
 setLoading(true);
 const params: Record<string, any> = { page, limit: 20 };
 if (debouncedAction) params.action = debouncedAction;
 if (debouncedEntityType) params.entityType = debouncedEntityType;
 if (debouncedUserId) params.userId = debouncedUserId;
 if (debouncedStartDate) params.startDate = debouncedStartDate;
 if (debouncedEndDate) params.endDate = debouncedEndDate;

 const response = await apiClient.getAuditLogs(params);
 setLogs(response.data || []);
 setTotalPages(response.meta?.totalPages || 1);
 setTotal(response.meta?.total || 0);
 } catch (error: any) {
 toast.error(error.message || 'Failed to load audit logs');
 } finally {
 setLoading(false);
 }
 }, [page, debouncedAction, debouncedEntityType, debouncedUserId, debouncedStartDate, debouncedEndDate]);

 const toggleRow = (id: string) => {
 const newExpanded = new Set(expandedRows);
 if (newExpanded.has(id)) {
 newExpanded.delete(id);
 } else {
 newExpanded.add(id);
 }
 setExpandedRows(newExpanded);
 };

 const getActionBadgeColor = (action: string) => {
 if (action.includes('create') || action.includes('invited')) return 'bg-green-100 text-green-800';
 if (action.includes('update')) return 'bg-[#00E5A0]/10 text-[#00E5A0]';
 if (action.includes('delete') || action.includes('deactivat')) return 'bg-red-100 text-red-800';
 if (action.includes('login') || action.includes('logout')) return 'bg-purple-100 text-purple-800';
 return 'bg-[var(--background-secondary)] text-[var(--foreground)]';
 };

 const formatTimestamp = (dateStr: string) => {
 return new Date(dateStr).toLocaleString('en-US', {
 month: 'short',
 day: 'numeric',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 second: '2-digit',
 });
 };

 const formatActionLabel = (action: string) => {
 return action
 .split('_')
 .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
 .join(' ');
 };

 const handleExportCSV = () => {
 if (logs.length === 0) {
 toast.error('No data to export');
 return;
 }

 const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Changes', 'IP Address'];
 const rows = logs.map((log) => [
 formatTimestamp(log.createdAt),
 log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
 formatActionLabel(log.action),
 log.entityType,
 log.entityId,
 log.changes ? JSON.stringify(log.changes) : '',
 log.ipAddress || '',
 ]);

 const csvContent = [headers, ...rows]
 .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
 .join('\n');

 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
 link.click();
 URL.revokeObjectURL(link.href);
 toast.success('Audit log exported successfully');
 };

 const clearFilters = () => {
 setActionFilter('');
 setEntityTypeFilter('');
 setUserIdFilter('');
 setStartDate('');
 setEndDate('');
 };

 const hasActiveFilters = actionFilter || entityTypeFilter || userIdFilter || startDate || endDate;

 return (
 <div className="space-y-6">
 <toast.ToastContainer />

 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-3xl font-bold text-[var(--foreground)]">Audit Log</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Track all actions performed in your organization ({total} entries)
 </p>
 </div>
 <button
 onClick={handleExportCSV}
 disabled={logs.length === 0}
 className="bg-[var(--surface)] text-[var(--foreground-secondary)] px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition font-medium shadow-sm flex items-center gap-2 disabled:opacity-50"
 >
 <Icon name="download" size="md" />
 <span>Export CSV</span>
 </button>
 </div>

 {/* Filters */}
 <div className="bg-[var(--surface)] rounded-lg shadow p-4">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
 <div>
 <label className="block text-xs font-medium text-[var(--foreground-tertiary)] uppercase mb-1">
 Action
 </label>
 <select
 value={actionFilter}
 onChange={(e) => setActionFilter(e.target.value)}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-sm text-[var(--foreground)]"
 >
 {ACTION_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--foreground-tertiary)] uppercase mb-1">
 Entity Type
 </label>
 <select
 value={entityTypeFilter}
 onChange={(e) => setEntityTypeFilter(e.target.value)}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-sm text-[var(--foreground)]"
 >
 {ENTITY_TYPE_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--foreground-tertiary)] uppercase mb-1">
 User
 </label>
 <select
 value={userIdFilter}
 onChange={(e) => setUserIdFilter(e.target.value)}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-sm text-[var(--foreground)]"
 >
 <option value="">All Users</option>
 {filterUsers.map((user) => (
 <option key={user.id} value={user.id}>
 {user.firstName} {user.lastName}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--foreground-tertiary)] uppercase mb-1">
 Start Date
 </label>
 <input
 type="date"
 value={startDate}
 onChange={(e) => setStartDate(e.target.value)}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-sm text-[var(--foreground)]"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--foreground-tertiary)] uppercase mb-1">
 End Date
 </label>
 <input
 type="date"
 value={endDate}
 onChange={(e) => setEndDate(e.target.value)}
 className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-sm text-[var(--foreground)]"
 />
 </div>
 </div>
 {hasActiveFilters && (
 <div className="mt-3 flex items-center gap-2">
 <button
 onClick={clearFilters}
 className="text-sm text-[#00E5A0] hover:text-[#00E5A0] underline"
 >
 Clear all filters
 </button>
 </div>
 )}
 </div>

 {/* Audit Log Table */}
 {loading ? (
 <div className="bg-[var(--surface)] rounded-lg shadow p-12">
 <LoadingSpinner size="lg" />
 </div>
 ) : logs.length === 0 ? (
 <EmptyState
 icon="list"
 title="No audit log entries"
 description={hasActiveFilters ? 'No entries match the current filters' : 'Activity will be logged here as actions are performed'}
 />
 ) : (
 <>
 <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
 <table className="min-w-full divide-y divide-[var(--border)]">
 <thead className="bg-[var(--background)]">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Timestamp
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 User
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Action
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Entity Type
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Entity ID
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 Changes
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-tertiary)] uppercase tracking-wider">
 IP Address
 </th>
 </tr>
 </thead>
 <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
 {logs.map((log) => (
 <React.Fragment key={log.id}>
 <tr className="hover:bg-[var(--surface-hover)] transition">
 <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-tertiary)]">
 {formatTimestamp(log.createdAt)}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
 {log.user ? (
 <span>{log.user.firstName} {log.user.lastName}</span>
 ) : (
 <span className="text-[var(--foreground-tertiary)] italic">System</span>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(log.action)}`}>
 {formatActionLabel(log.action)}
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-secondary)] capitalize">
 {log.entityType}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-tertiary)] font-mono text-xs">
 {log.entityId.length > 12
 ? `${log.entityId.substring(0, 12)}...`
 : log.entityId}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm">
 {log.changes ? (
 <button
 onClick={() => toggleRow(log.id)}
 className="text-[#00E5A0] hover:text-[#00E5A0] text-xs flex items-center gap-1"
 >
 <Icon
 name={expandedRows.has(log.id) ? 'chevronUp' : 'chevronDown'}
 size="sm"
 />
 {expandedRows.has(log.id) ? 'Hide' : 'View'}
 </button>
 ) : (
 <span className="text-[var(--foreground-tertiary)] text-xs">--</span>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-tertiary)] font-mono text-xs">
 {log.ipAddress || '--'}
 </td>
 </tr>
 {expandedRows.has(log.id) && log.changes && (
 <tr>
 <td colSpan={7} className="px-6 py-3 bg-[var(--background)]">
 <div className="text-xs">
 <p className="font-medium text-[var(--foreground-secondary)] mb-1">Changes:</p>
 <pre className="bg-[var(--background-secondary)] p-3 rounded-lg overflow-x-auto text-[var(--foreground)] font-mono">
 {JSON.stringify(log.changes, null, 2)}
 </pre>
 </div>
 </td>
 </tr>
 )}
 </React.Fragment>
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
 className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Previous
 </button>
 <span className="px-4 py-2 text-sm text-[var(--foreground-secondary)]">
 Page {page} of {totalPages}
 </span>
 <button
 onClick={() => setPage(Math.min(totalPages, page + 1))}
 disabled={page === totalPages}
 className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Next
 </button>
 </div>
 )}
 </>
 )}
 </div>
 );
}
