'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import { Icon } from '@/theme/icons';

interface TemplateItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  orientation?: string;
  difficulty?: string;
  thumbnailUrl?: string;
  isFeatured?: boolean;
  createdAt?: string;
}

interface CategoryItem {
  name: string;
  count: number;
}

export default function TemplateLibraryPage() {
  // Data state
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [featuredTemplates, setFeaturedTemplates] = useState<TemplateItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
  const [selectedOrientation, setSelectedOrientation] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 12;

  // Featured carousel ref
  const carouselRef = useRef<HTMLDivElement>(null);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
    loadFeaturedTemplates();
  }, []);

  // Load templates when filters change
  useEffect(() => {
    loadTemplates();
  }, [debouncedSearch, selectedCategory, selectedDifficulty, selectedOrientation, page]);

  const loadCategories = async () => {
    try {
      const data = await apiClient.getTemplateCategories();
      setCategories(data || []);
    } catch (err: any) {
      console.error('[TemplateLibrary] Failed to load categories:', err);
    }
  };

  const loadFeaturedTemplates = async () => {
    try {
      setFeaturedLoading(true);
      const data = await apiClient.getFeaturedTemplates();
      setFeaturedTemplates(data || []);
    } catch (err: any) {
      console.error('[TemplateLibrary] Failed to load featured:', err);
    } finally {
      setFeaturedLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedDifficulty) params.difficulty = selectedDifficulty;
      if (selectedOrientation) params.orientation = selectedOrientation;

      const response = await apiClient.searchTemplates(params);
      setTemplates(response.data || response || []);
      setTotalCount(response.total || response.length || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const scrollAmount = 320;
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const totalPages = Math.ceil(totalCount / limit);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedDifficulty('');
    setSelectedOrientation('');
    setPage(1);
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedDifficulty || selectedOrientation;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-[var(--surface-hover)] text-[var(--foreground-secondary)]';
    }
  };

  const getOrientationLabel = (orientation: string) => {
    switch (orientation?.toLowerCase()) {
      case 'landscape':
        return 'Landscape';
      case 'portrait':
        return 'Portrait';
      case 'both':
        return 'Both';
      default:
        return orientation || 'Any';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-[var(--foreground)]">Template Library</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">
            Browse and clone professionally designed templates for your displays
          </p>
        </div>
      </div>

      {/* Featured Carousel */}
      {!featuredLoading && featuredTemplates.length > 0 && (
        <div className="bg-[var(--surface)] rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
              <Icon name="power" size="md" className="text-[#00E5A0]" />
              Featured Templates
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => scrollCarousel('left')}
                className="p-2 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border)] transition text-[var(--foreground-secondary)]"
                aria-label="Scroll left"
              >
                <Icon name="chevronLeft" size="md" />
              </button>
              <button
                onClick={() => scrollCarousel('right')}
                className="p-2 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--border)] transition text-[var(--foreground-secondary)]"
                aria-label="Scroll right"
              >
                <Icon name="chevronRight" size="md" />
              </button>
            </div>
          </div>

          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin"
            style={{ scrollbarWidth: 'thin' }}
          >
            {featuredTemplates.map((template) => (
              <Link
                key={template.id}
                href={`/dashboard/templates/${template.id}`}
                className="flex-shrink-0 w-72 bg-[var(--background)] rounded-lg overflow-hidden border border-[var(--border)] hover:border-[#00E5A0] hover:shadow-lg transition-all group"
              >
                <div className="h-40 bg-gradient-to-br from-[#00E5A0]/20 to-[#00B4D8]/20 flex items-center justify-center relative overflow-hidden">
                  {template.thumbnailUrl ? (
                    <img
                      src={template.thumbnailUrl}
                      alt={template.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Icon name="grid" size="4xl" className="text-[var(--foreground-tertiary)]" />
                  )}
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold bg-[#00E5A0] text-[#061A21] rounded-full">
                    Featured
                  </span>
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-[var(--foreground)] text-sm truncate">{template.name}</h4>
                  <p className="text-xs text-[var(--foreground-tertiary)] mt-1 line-clamp-2">
                    {template.description || 'No description'}
                  </p>
                  {template.category && (
                    <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-[var(--surface-hover)] text-[var(--foreground-secondary)] rounded">
                      {template.category}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-[var(--surface)] rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Icon
              name="search"
              size="md"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-tertiary)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by name or keyword..."
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)]"
              autoComplete="off"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)] min-w-[160px]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name} ({cat.count})
              </option>
            ))}
          </select>

          {/* Difficulty Dropdown */}
          <select
            value={selectedDifficulty}
            onChange={(e) => {
              setSelectedDifficulty(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)] min-w-[140px]"
          >
            <option value="">Any Difficulty</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {/* Orientation Dropdown */}
          <select
            value={selectedOrientation}
            onChange={(e) => {
              setSelectedOrientation(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)] min-w-[140px]"
          >
            <option value="">Any Orientation</option>
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
            <option value="both">Both</option>
          </select>
        </div>

        {/* Active filters indicator */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
            <span className="text-sm text-[var(--foreground-secondary)]">Active filters:</span>
            {searchQuery && (
              <span className="px-2 py-1 bg-[#00E5A0]/10 text-[#00E5A0] rounded text-xs">
                Search: &quot;{searchQuery}&quot;
              </span>
            )}
            {selectedCategory && (
              <span className="px-2 py-1 bg-[#00E5A0]/10 text-[#00E5A0] rounded text-xs">
                Category: {selectedCategory}
              </span>
            )}
            {selectedDifficulty && (
              <span className="px-2 py-1 bg-[#00E5A0]/10 text-[#00E5A0] rounded text-xs">
                Difficulty: {selectedDifficulty}
              </span>
            )}
            {selectedOrientation && (
              <span className="px-2 py-1 bg-[#00E5A0]/10 text-[#00E5A0] rounded text-xs">
                Orientation: {selectedOrientation}
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-[#00E5A0] hover:underline ml-auto"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Main Layout: Sidebar + Grid */}
      <div className="flex gap-6">
        {/* Category Sidebar (Desktop) */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <div className="bg-[var(--surface)] rounded-lg shadow p-4 sticky top-24">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3 uppercase tracking-wider">
              Categories
            </h3>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setSelectedCategory('');
                  setPage(1);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  !selectedCategory
                    ? 'bg-[#00E5A0]/10 text-[#00E5A0] font-medium'
                    : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                }`}
              >
                All Templates
                <span className="float-right text-xs text-[var(--foreground-tertiary)]">
                  {totalCount}
                </span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setPage(1);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    selectedCategory === cat.name
                      ? 'bg-[#00E5A0]/10 text-[#00E5A0] font-medium'
                      : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {cat.name}
                  <span className="float-right text-xs text-[var(--foreground-tertiary)]">
                    {cat.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Template Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="bg-[var(--surface)] rounded-lg shadow p-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="bg-[var(--surface)] rounded-lg shadow p-8 text-center">
              <Icon name="error" size="xl" className="text-red-500 mx-auto mb-3" />
              <p className="text-[var(--foreground-secondary)]">{error}</p>
              <button
                onClick={loadTemplates}
                className="mt-4 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon="grid"
              title="No templates found"
              description={
                hasActiveFilters
                  ? 'Try adjusting your search or filters'
                  : 'No templates are available yet'
              }
              action={
                hasActiveFilters
                  ? { label: 'Clear Filters', onClick: clearFilters }
                  : undefined
              }
            />
          ) : (
            <>
              {/* Results count */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[var(--foreground-secondary)]">
                  Showing {(page - 1) * limit + 1}
                  {' '}-{' '}
                  {Math.min(page * limit, totalCount)} of {totalCount} templates
                </p>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <Link
                    key={template.id}
                    href={`/dashboard/templates/${template.id}`}
                    className="bg-[var(--surface)] rounded-lg shadow overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1 group border border-transparent hover:border-[#00E5A0]/30"
                  >
                    {/* Thumbnail / Preview */}
                    <div className="h-48 bg-gradient-to-br from-[#00E5A0]/10 to-[#00B4D8]/10 flex items-center justify-center relative overflow-hidden">
                      {template.thumbnailUrl ? (
                        <img
                          src={template.thumbnailUrl}
                          alt={template.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Icon name="grid" size="6xl" className="text-[var(--foreground-tertiary)] opacity-40" />
                      )}
                      {template.isFeatured && (
                        <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-semibold bg-[#00E5A0] text-[#061A21] rounded-full">
                          Featured
                        </span>
                      )}
                      {template.orientation && (
                        <span className="absolute top-3 left-3 px-2 py-0.5 text-xs font-medium bg-[var(--surface)]/90 text-[var(--foreground-secondary)] rounded backdrop-blur-sm">
                          {getOrientationLabel(template.orientation)}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-[var(--foreground)] mb-1 truncate group-hover:text-[#00E5A0] transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-sm text-[var(--foreground-tertiary)] mb-3 line-clamp-2 min-h-[2.5rem]">
                        {template.description || 'No description available'}
                      </p>

                      {/* Tags row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {template.category && (
                          <span className="px-2 py-0.5 text-xs bg-[var(--surface-hover)] text-[var(--foreground-secondary)] rounded">
                            {template.category}
                          </span>
                        )}
                        {template.difficulty && (
                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${getDifficultyColor(template.difficulty)}`}>
                            {template.difficulty}
                          </span>
                        )}
                        {template.tags?.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-[var(--background)] text-[var(--foreground-tertiary)] rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {(template.tags?.length || 0) > 2 && (
                          <span className="text-xs text-[var(--foreground-tertiary)]">
                            +{(template.tags?.length || 0) - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 text-sm font-medium bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed text-[var(--foreground-secondary)]"
                  >
                    <Icon name="chevronLeft" size="sm" />
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      // Show first, last, current, and neighbors
                      return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                    })
                    .reduce((acc: (number | string)[], p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && p - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === '...' ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-2 py-2 text-sm text-[var(--foreground-tertiary)]"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item as number)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                            page === item
                              ? 'bg-[#00E5A0] text-[#061A21]'
                              : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-4 py-2 text-sm font-medium bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed text-[var(--foreground-secondary)]"
                  >
                    <Icon name="chevronRight" size="sm" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
