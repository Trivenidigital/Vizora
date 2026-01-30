'use client';

import { Icon } from '@/theme/icons';

interface FilterPanelProps {
  filterType: string;
  filterStatus: string;
  filterDateRange: 'all' | '7days' | '30days' | '90days';
  showAdvancedFilters: boolean;
  contentCounts: Record<string, number>;
  onFilterTypeChange: (type: string) => void;
  onFilterStatusChange: (status: string) => void;
  onFilterDateRangeChange: (range: 'all' | '7days' | '30days' | '90days') => void;
  onToggleAdvancedFilters: () => void;
  onClearAllFilters: () => void;
}

export function FilterPanel({
  filterType,
  filterStatus,
  filterDateRange,
  showAdvancedFilters,
  contentCounts,
  onFilterTypeChange,
  onFilterStatusChange,
  onFilterDateRangeChange,
  onToggleAdvancedFilters,
  onClearAllFilters,
}: FilterPanelProps) {
  const hasActiveFilters =
    filterType !== 'all' ||
    filterStatus !== 'all' ||
    filterDateRange !== 'all';

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['all', 'image', 'video', 'pdf', 'url'].map((type) => (
            <button
              key={type}
              onClick={() => onFilterTypeChange(type)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                filterType === type
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
              {type !== 'all' && ` (${contentCounts[type] || 0})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={onClearAllFilters}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onToggleAdvancedFilters}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <Icon name="settings" size="md" className="text-gray-600" />
            <span>Advanced</span>
            <svg
              className={`w-4 h-4 transition-transform ${
                showAdvancedFilters ? 'rotate-180' : ''
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Date
            </label>
            <select
              value={filterDateRange}
              onChange={(e) =>
                onFilterDateRangeChange(
                  e.target.value as 'all' | '7days' | '30days' | '90days'
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 90 days</option>
            </select>
          </div>
        </div>
      )}

      {/* Active Filters Indicator */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-gray-200 flex items-center gap-2 text-sm">
          <span className="text-gray-600">Active filters:</span>
          {filterType !== 'all' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              Type: {filterType}
            </span>
          )}
          {filterStatus !== 'all' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              Status: {filterStatus}
            </span>
          )}
          {filterDateRange !== 'all' && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              Date: {filterDateRange}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
