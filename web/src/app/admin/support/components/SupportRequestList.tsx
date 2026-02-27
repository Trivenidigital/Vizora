'use client';

import type { SupportRequest } from '@/lib/types';
import { SupportRequestCard } from './SupportRequestCard';
import { MessageSquare } from 'lucide-react';

interface SupportRequestListProps {
  requests: SupportRequest[];
  onSelect: (request: SupportRequest) => void;
}

export function SupportRequestList({ requests, onSelect }: SupportRequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
        <MessageSquare className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
          No support requests found
        </h3>
        <p className="text-[var(--foreground-secondary)]">
          Try adjusting your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <SupportRequestCard key={request.id} request={request} onSelect={onSelect} />
      ))}
    </div>
  );
}
