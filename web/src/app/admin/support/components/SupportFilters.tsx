'use client';

import type { SupportQueryParams, SupportStatus, SupportPriority, SupportCategory } from '@/lib/types';
import { Search, X } from 'lucide-react';

interface SupportFiltersProps {
  filters: SupportQueryParams;
  onFiltersChange: (filters: SupportQueryParams) => void;
}

const statusOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'wont_fix', label: "Won't Fix" },
];

const priorityOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const categoryOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'help_question', label: 'Help Question' },
  { value: 'template_request', label: 'Template Request' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'urgent_issue', label: 'Urgent Issue' },
  { value: 'account_issue', label: 'Account Issue' },
];

export function SupportFilters({ filters, onFiltersChange }: SupportFiltersProps) {
  const hasActiveFilters = filters.status || filters.priority || filters.category || filters.search;

  const handleClear = () => {
    onFiltersChange({ page: 1, limit: filters.limit || 20 });
  };

  const selectClasses =
    'bg-[#1F2937] border border-[var(--border)] rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/50 appearance-none cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={filters.status || ''}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            status: (e.target.value || undefined) as SupportStatus | undefined,
            page: 1,
          })
        }
        className={selectClasses}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={filters.priority || ''}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            priority: (e.target.value || undefined) as SupportPriority | undefined,
            page: 1,
          })
        }
        className={selectClasses}
      >
        {priorityOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={filters.category || ''}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            category: (e.target.value || undefined) as SupportCategory | undefined,
            page: 1,
          })
        }
        className={selectClasses}
      >
        {categoryOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-tertiary)]" />
        <input
          type="text"
          placeholder="Search requests..."
          value={filters.search || ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value || undefined, page: 1 })
          }
          className="w-full bg-[#1F2937] border border-[var(--border)] rounded-lg text-white text-sm pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/50 placeholder-[var(--foreground-tertiary)]"
        />
      </div>

      {hasActiveFilters && (
        <button
          onClick={handleClear}
          className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--foreground-secondary)] hover:text-white bg-[#1F2937] border border-[var(--border)] rounded-lg hover:bg-[#374151] transition"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      )}
    </div>
  );
}
