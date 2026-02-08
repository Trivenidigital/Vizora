'use client';

import { useState, useEffect } from 'react';
import { Content } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { Icon } from '@/theme/icons';
import LoadingSpinner from '@/components/LoadingSpinner';
import DraggableContentItem from './DraggableContentItem';

interface ContentLibraryPanelProps {
  organizationId: string;
}

export default function ContentLibraryPanel({ organizationId }: ContentLibraryPanelProps) {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadContent();
  }, [page, typeFilter]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20 };
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      const response = await apiClient.getContent(params);
      setContent(response.data || []);
      if (response.meta) {
        setTotalPages(response.meta.totalPages);
      }
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContent = content.filter((item) => {
    if (searchQuery) {
      return item.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[var(--background)] border-r border-[var(--border)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">Content Library</h3>

        {/* Search */}
        <div className="relative mb-3">
          <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search content..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
          />
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'image', 'video', 'url', 'pdf'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`
                px-3 py-1 text-xs font-medium rounded-full transition
                ${typeFilter === type
                  ? 'bg-[#00E5A0] text-[#061A21]'
                  : 'bg-[var(--background-tertiary)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
                }
              `}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[var(--foreground-tertiary)] mb-2">
              <Icon name="content" size="2xl" className="text-[var(--foreground-tertiary)] mx-auto" />
            </div>
            <p className="text-sm text-[var(--foreground-tertiary)]">
              {searchQuery ? 'No content found' : 'No content available'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#00E5A0] hover:text-[#00CC8E] mt-2"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {filteredContent.map((item) => (
              <DraggableContentItem key={item.id} content={item} />
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-[var(--foreground-secondary)] bg-[var(--background-secondary)] rounded hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-[var(--foreground-secondary)]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-[var(--foreground-secondary)] bg-[var(--background-secondary)] rounded hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
