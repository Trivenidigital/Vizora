'use client';

import type { SupportRequest, SupportCategory, SupportPriority, SupportStatus } from '@/lib/types';
import { Eye } from 'lucide-react';

interface SupportRequestCardProps {
  request: SupportRequest;
  onSelect: (request: SupportRequest) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

const priorityDotColors: Record<SupportPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const categoryBadgeColors: Record<SupportCategory, { bg: string; text: string }> = {
  bug_report: { bg: 'bg-red-500/20', text: 'text-red-400' },
  feature_request: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  help_question: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  template_request: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  feedback: { bg: 'bg-green-500/20', text: 'text-green-400' },
  urgent_issue: { bg: 'bg-red-500/20', text: 'text-red-400' },
  account_issue: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
};

const categoryLabels: Record<SupportCategory, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  help_question: 'Help Question',
  template_request: 'Template Request',
  feedback: 'Feedback',
  urgent_issue: 'Urgent Issue',
  account_issue: 'Account Issue',
};

const statusBadgeColors: Record<SupportStatus, string> = {
  open: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  resolved: 'bg-green-500/20 text-green-400',
  closed: 'bg-gray-500/20 text-gray-400',
  wont_fix: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<SupportStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  wont_fix: "Won't Fix",
};

export function SupportRequestCard({ request, onSelect }: SupportRequestCardProps) {
  const displayTitle = request.title || (request.description?.slice(0, 80) + (request.description?.length > 80 ? '...' : ''));
  const catColors = categoryBadgeColors[request.category] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
  const userName = request.user
    ? `${request.user.firstName} ${request.user.lastName}`
    : 'Unknown User';

  return (
    <div
      onClick={() => onSelect(request)}
      className="bg-[#111827] rounded-lg p-4 border border-[var(--border)] hover:border-[#00E5A0]/30 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${priorityDotColors[request.priority]}`} />
            <h3 className="text-white font-medium truncate">{displayTitle}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${catColors.bg} ${catColors.text}`}>
              {categoryLabels[request.category] || request.category}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColors[request.status]}`}>
              {statusLabels[request.status] || request.status}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--foreground-tertiary)]">
            <span>{userName}</span>
            <span className="text-[var(--border)]">|</span>
            <span>{timeAgo(request.createdAt)}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(request);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--foreground-secondary)] hover:text-white bg-[#1F2937] rounded-lg hover:bg-[#374151] transition flex-shrink-0"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      </div>
    </div>
  );
}
