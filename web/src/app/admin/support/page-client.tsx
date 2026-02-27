'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type { SupportRequest, SupportStats, SupportQueryParams } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { SupportStatsCards } from './components/SupportStatsCards';
import { SupportFilters } from './components/SupportFilters';
import { SupportRequestList } from './components/SupportRequestList';
import { SupportRequestDetail } from './components/SupportRequestDetail';
import { MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';

export function SupportDashboardClient() {
  const toast = useToast();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [filters, setFilters] = useState<SupportQueryParams>({ page: 1, limit: 20 });
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiClient.getSupportStats();
      setStats(data);
    } catch (error: any) {
      // Stats are non-critical, don't show error toast
      console.error('Failed to load support stats:', error);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getSupportRequests(filters);
      setRequests(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load support requests');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadStats();
    loadRequests();
  }, [loadStats, loadRequests]);

  const handleSelectRequest = async (request: SupportRequest) => {
    try {
      // Fetch full request with messages
      const fullRequest = await apiClient.getSupportRequest(request.id);
      setSelectedRequest(fullRequest);
      setIsDetailOpen(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load request details');
    }
  };

  const handleReply = async (requestId: string, content: string) => {
    try {
      await apiClient.addSupportMessage(requestId, content);
      toast.success('Reply sent successfully');
      // Refresh the selected request to show new message
      const updated = await apiClient.getSupportRequest(requestId);
      setSelectedRequest(updated);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reply');
    }
  };

  const handleUpdate = async (requestId: string, data: { status?: string; priority?: string; resolutionNotes?: string }) => {
    try {
      const updated = await apiClient.updateSupportRequest(requestId, data);
      toast.success('Request updated successfully');
      setSelectedRequest(updated);
      // Refresh list and stats
      loadRequests();
      loadStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update request');
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedRequest(null);
  };

  const currentPage = filters.page || 1;

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <MessageSquare className="w-8 h-8 text-[#00E5A0]" />
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Support Dashboard</h1>
        </div>
        <p className="mt-1 text-[var(--foreground-secondary)]">
          View and manage support requests from all users
        </p>
      </div>

      {/* Stats */}
      <SupportStatsCards stats={stats} />

      {/* Filters */}
      <SupportFilters filters={filters} onFiltersChange={setFilters} />

      {/* Request List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <SupportRequestList requests={requests} onSelect={handleSelectRequest} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: currentPage - 1 }))}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--foreground-secondary)] bg-[#1F2937] border border-[var(--border)] rounded-lg hover:bg-[#374151] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="text-sm text-[var(--foreground-secondary)]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: currentPage + 1 }))}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--foreground-secondary)] bg-[#1F2937] border border-[var(--border)] rounded-lg hover:bg-[#374151] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <SupportRequestDetail
          request={selectedRequest}
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
          onReply={handleReply}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
