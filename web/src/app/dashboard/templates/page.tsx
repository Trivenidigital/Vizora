'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import TemplateHeroSearch from '@/components/templates/TemplateHeroSearch';
import TemplateSidebar from '@/components/templates/TemplateSidebar';
import TemplateCard from '@/components/templates/TemplateCard';
import TemplateDetailModal from '@/components/templates/TemplateDetailModal';
import AIDesignerModal from '@/components/templates/AIDesignerModal';
import { TemplateGridSkeleton } from '@/components/templates/TemplateCardSkeleton';

interface TemplateItem {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  tags?: string[];
  libraryTags?: string[];
  orientation?: string;
  templateOrientation?: string | null;
  difficulty?: string;
  thumbnailUrl?: string | null;
  previewImageUrl?: string | null;
  isFeatured?: boolean;
  useCount?: number;
  metadata?: { templateHtml?: string; renderedHtml?: string; [key: string]: unknown } | null;
}

interface CategoryItem {
  name: string;
  count?: number;
  label?: string;
}

type ViewMode = 'home' | 'your-templates';

export default function TemplateLibraryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Data
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [featuredTemplates, setFeaturedTemplates] = useState<TemplateItem[]>([]);
  const [popularTemplates, setPopularTemplates] = useState<TemplateItem[]>([]);
  const [userTemplates, setUserTemplates] = useState<TemplateItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [userTotalCount, setUserTotalCount] = useState(0);

  // UI
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('home');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'' | 'beginner' | 'intermediate' | 'advanced'>('');
  const [selectedOrientation, setSelectedOrientation] = useState<'' | 'landscape' | 'portrait' | 'both'>('');
  const [page, setPage] = useState(1);
  const limit = 12;

  // Modals
  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [showAIDesigner, setShowAIDesigner] = useState(false);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cloneModalId, setCloneModalId] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  // Featured scroll
  const featuredRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load initial data
  useEffect(() => {
    Promise.all([
      loadCategories(),
      loadFeaturedTemplates(),
      loadPopularTemplates(),
    ]).then(() => setInitialLoad(false));
  }, []);

  // Load templates when filters change
  useEffect(() => {
    if (viewMode === 'home') {
      loadTemplates();
    }
  }, [debouncedSearch, selectedCategory, selectedDifficulty, selectedOrientation, page, viewMode]);

  // Load user templates when switching to that view
  useEffect(() => {
    if (viewMode === 'your-templates') {
      loadUserTemplates();
    }
  }, [viewMode, debouncedSearch, page]);

  // Listen for template detail events from similar templates
  useEffect(() => {
    const handler = (e: CustomEvent) => setDetailModalId(e.detail);
    window.addEventListener('openTemplateDetail', handler as EventListener);
    return () => window.removeEventListener('openTemplateDetail', handler as EventListener);
  }, []);

  const loadCategories = async () => {
    try {
      const data = await apiClient.getTemplateCategories();
      setCategories(data || []);
    } catch (err: any) {
      console.error('[Templates] Failed to load categories:', err);
    }
  };

  const loadFeaturedTemplates = async () => {
    try {
      const data = await apiClient.getFeaturedTemplates();
      setFeaturedTemplates(data || []);
    } catch (err: any) {
      console.error('[Templates] Failed to load featured:', err);
    }
  };

  const loadPopularTemplates = async () => {
    try {
      const data = await apiClient.getPopularTemplates();
      setPopularTemplates((data || []).slice(0, 8));
    } catch (err: any) {
      console.error('[Templates] Failed to load popular:', err);
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

      const response = await apiClient.searchTemplates(params) as any;
      const items = response.data || response || [];
      setTemplates(items);
      setTotalCount(response.meta?.total || items.length || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await apiClient.getUserTemplates(params) as any;
      const items = response.data || response || [];
      setUserTemplates(items);
      setUserTotalCount(response.meta?.total || items.length || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load your templates');
      setUserTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(tag);
    setSelectedCategory('');
    setPage(1);
  }, []);

  const handleUseTemplate = useCallback(async (id: string) => {
    setCloneModalId(id);
  }, []);

  const handleCloneConfirm = async () => {
    if (!cloneModalId) return;
    try {
      setCloning(true);
      await apiClient.cloneTemplate(cloneModalId);
      setCloneModalId(null);
      setDetailModalId(null);
      // Switch to user templates to show the clone
      setViewMode('your-templates');
      loadUserTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to clone template');
    } finally {
      setCloning(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalId) return;
    try {
      setDeleting(true);
      await apiClient.deleteTemplate(deleteModalId);
      setDeleteModalId(null);
      loadTemplates();
      loadFeaturedTemplates();
      loadPopularTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const scrollFeatured = (dir: 'left' | 'right') => {
    featuredRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  const totalPages = viewMode === 'home'
    ? Math.ceil(totalCount / limit)
    : Math.ceil(userTotalCount / limit);

  const hasActiveFilters = debouncedSearch || selectedCategory || selectedDifficulty || selectedOrientation;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedDifficulty('');
    setSelectedOrientation('');
    setPage(1);
  };

  const currentTemplates = viewMode === 'home' ? templates : userTemplates;
  const currentTotal = viewMode === 'home' ? totalCount : userTotalCount;

  // Map template fields for cards
  const mapForCard = (t: TemplateItem) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    difficulty: t.difficulty,
    orientation: t.templateOrientation || t.orientation,
    thumbnailUrl: t.thumbnailUrl || t.previewImageUrl,
    previewImageUrl: t.previewImageUrl,
    templateHtml: t.metadata?.templateHtml as string | undefined,
    renderedHtml: t.metadata?.renderedHtml as string | undefined,
    isFeatured: t.isFeatured,
    useCount: t.useCount,
    tags: t.libraryTags || t.tags,
  });

  return (
    <div className="space-y-6 -mx-2 sm:-mx-4 lg:-mx-6">
      {/* Hero Search */}
      <div className="px-2 sm:px-4 lg:px-6">
        <TemplateHeroSearch
          onSearch={handleSearch}
          onTagClick={handleTagClick}
          onAIDesignerClick={() => setShowAIDesigner(true)}
        />
      </div>

      {/* Main layout: Sidebar + Content */}
      <div className="flex gap-6 px-2 sm:px-4 lg:px-6">
        {/* Sidebar */}
        <TemplateSidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={(cat) => { setSelectedCategory(cat); setPage(1); }}
          selectedOrientation={selectedOrientation}
          onOrientationChange={(o) => { setSelectedOrientation(o); setPage(1); }}
          selectedDifficulty={selectedDifficulty}
          onDifficultyChange={(d) => { setSelectedDifficulty(d); setPage(1); }}
          viewMode={viewMode}
          onViewModeChange={(m) => { setViewMode(m); setPage(1); setSearchQuery(''); }}
          onNewDesignClick={() => router.push('/dashboard/templates/new')}
          onAIDesignerClick={() => setShowAIDesigner(true)}
          isAdmin={isAdmin}
          totalCount={totalCount}
        />

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile filters */}
          <div className="lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => { setViewMode('home'); setPage(1); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  viewMode === 'home' ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/20' : 'text-[var(--foreground-secondary)] border-[var(--border)]'
                }`}
              >
                Library
              </button>
              <button
                onClick={() => { setViewMode('your-templates'); setPage(1); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  viewMode === 'your-templates' ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/20' : 'text-[var(--foreground-secondary)] border-[var(--border)]'
                }`}
              >
                Your Templates
              </button>
              <button
                onClick={() => setShowAIDesigner(true)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-[#00E5A0] border border-[#00E5A0]/20 hover:bg-[#00E5A0]/5 transition-all"
              >
                AI Designer
              </button>
              {viewMode === 'home' && (
                <>
                  <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-secondary)]"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.name} value={cat.name}>{cat.label || cat.name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => { setSelectedDifficulty(e.target.value as any); setPage(1); }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-secondary)]"
                  >
                    <option value="">Any Difficulty</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Active filters bar */}
          {hasActiveFilters && viewMode === 'home' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--foreground-tertiary)]">Filters:</span>
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#00E5A0]/10 text-[#00E5A0] rounded-md text-xs">
                  &ldquo;{debouncedSearch}&rdquo;
                  <button onClick={() => setSearchQuery('')} className="hover:text-white ml-0.5">&times;</button>
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#00E5A0]/10 text-[#00E5A0] rounded-md text-xs capitalize">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory('')} className="hover:text-white ml-0.5">&times;</button>
                </span>
              )}
              {selectedDifficulty && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#00E5A0]/10 text-[#00E5A0] rounded-md text-xs capitalize">
                  {selectedDifficulty}
                  <button onClick={() => setSelectedDifficulty('')} className="hover:text-white ml-0.5">&times;</button>
                </span>
              )}
              {selectedOrientation && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#00E5A0]/10 text-[#00E5A0] rounded-md text-xs capitalize">
                  {selectedOrientation}
                  <button onClick={() => setSelectedOrientation('')} className="hover:text-white ml-0.5">&times;</button>
                </span>
              )}
              <button onClick={clearFilters} className="text-xs text-[var(--foreground-tertiary)] hover:text-[#00E5A0] transition-colors ml-auto">
                Clear all
              </button>
            </div>
          )}

          {/* Browse mode: Featured + Popular + All */}
          {viewMode === 'home' && !hasActiveFilters && !initialLoad && (
            <>
              {/* Featured section */}
              {featuredTemplates.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-[var(--font-sora)] text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                      <span className="w-1 h-4 rounded-full bg-[#00E5A0]" />
                      Featured
                    </h2>
                    <div className="flex gap-1.5">
                      <button onClick={() => scrollFeatured('left')} className="p-1.5 rounded-lg text-[var(--foreground-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                      </button>
                      <button onClick={() => scrollFeatured('right')} className="p-1.5 rounded-lg text-[var(--foreground-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    </div>
                  </div>
                  <div ref={featuredRef} className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
                    {featuredTemplates.map((t) => {
                      const mapped = mapForCard(t);
                      return (
                        <TemplateCard
                          key={t.id}
                          {...mapped}
                          variant="featured"
                          onClick={(id) => setDetailModalId(id)}
                          onUseTemplate={handleUseTemplate}
                          isAdmin={isAdmin}
                          onEdit={isAdmin ? (id) => router.push(`/dashboard/templates/${id}?edit=true`) : undefined}
                          onDelete={isAdmin ? (id) => setDeleteModalId(id) : undefined}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Popular section */}
              {popularTemplates.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-[var(--font-sora)] text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                      <span className="w-1 h-4 rounded-full bg-[#00B4D8]" />
                      Popular
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {popularTemplates.map((t) => {
                      const mapped = mapForCard(t);
                      return (
                        <TemplateCard
                          key={t.id}
                          {...mapped}
                          onClick={(id) => setDetailModalId(id)}
                          onUseTemplate={handleUseTemplate}
                          isAdmin={isAdmin}
                          onEdit={isAdmin ? (id) => router.push(`/dashboard/templates/${id}?edit=true`) : undefined}
                          onDelete={isAdmin ? (id) => setDeleteModalId(id) : undefined}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {/* All templates / filtered results section header */}
          <section>
            {viewMode === 'home' && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-[var(--font-sora)] text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-[var(--foreground-tertiary)]" />
                  {hasActiveFilters ? 'Search Results' : 'All Templates'}
                  {!loading && <span className="text-xs font-normal text-[var(--foreground-tertiary)] ml-1">({currentTotal})</span>}
                </h2>
              </div>
            )}
            {viewMode === 'your-templates' && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-[var(--font-sora)] text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-[#00E5A0]" />
                  Your Templates
                  {!loading && <span className="text-xs font-normal text-[var(--foreground-tertiary)] ml-1">({userTotalCount})</span>}
                </h2>
                {/* Search for user templates */}
                <div className="relative w-64 hidden sm:block">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-tertiary)]">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your templates..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--foreground-tertiary)] focus:outline-none focus:ring-1 focus:ring-[#00E5A0]/30"
                  />
                </div>
              </div>
            )}

            {/* Grid content */}
            {loading ? (
              <TemplateGridSkeleton count={8} />
            ) : error ? (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-12 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-red-400">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-sm text-[var(--foreground-secondary)] mb-4">{error}</p>
                <button
                  onClick={viewMode === 'home' ? loadTemplates : loadUserTemplates}
                  className="px-4 py-2 rounded-lg bg-[#00E5A0] text-[#061A21] font-semibold text-sm hover:bg-[#00CC8E] transition-all"
                >
                  Try Again
                </button>
              </div>
            ) : currentTemplates.length === 0 ? (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-12 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 text-[var(--foreground-tertiary)] opacity-40">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 15l4-4a3 5 0 0 1 3 0l5 5" />
                </svg>
                {viewMode === 'your-templates' ? (
                  <>
                    <h3 className="font-semibold text-[var(--foreground)] mb-1">No templates yet</h3>
                    <p className="text-sm text-[var(--foreground-secondary)] mb-4">
                      Browse the library and clone templates to get started, or try the AI Designer.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => { setViewMode('home'); setPage(1); }}
                        className="px-4 py-2 rounded-lg bg-[#00E5A0] text-[#061A21] font-semibold text-sm hover:bg-[#00CC8E] transition-all"
                      >
                        Browse Library
                      </button>
                      <button
                        onClick={() => setShowAIDesigner(true)}
                        className="px-4 py-2 rounded-lg border border-[#00E5A0]/20 text-[#00E5A0] font-medium text-sm hover:bg-[#00E5A0]/5 transition-all"
                      >
                        Try AI Designer
                      </button>
                    </div>
                  </>
                ) : hasActiveFilters ? (
                  <>
                    <h3 className="font-semibold text-[var(--foreground)] mb-1">No matching templates</h3>
                    <p className="text-sm text-[var(--foreground-secondary)] mb-4">Try adjusting your search or filters</p>
                    <button onClick={clearFilters} className="px-4 py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--foreground)] font-medium text-sm hover:bg-[var(--border)] transition-all">
                      Clear Filters
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-[var(--foreground)] mb-1">No templates available</h3>
                    <p className="text-sm text-[var(--foreground-secondary)]">Templates will appear here once they&apos;re added to the library.</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {currentTemplates.map((t) => {
                    const mapped = mapForCard(t);
                    return (
                      <TemplateCard
                        key={t.id}
                        {...mapped}
                        onClick={(id) => setDetailModalId(id)}
                        onUseTemplate={handleUseTemplate}
                        isAdmin={isAdmin}
                        onEdit={isAdmin ? (id) => router.push(`/dashboard/templates/${id}?edit=true`) : undefined}
                        onDelete={isAdmin ? (id) => setDeleteModalId(id) : undefined}
                      />
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-8">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="p-2 rounded-lg text-[var(--foreground-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce((acc: (number | string)[], p, idx, arr) => {
                        if (idx > 0 && typeof arr[idx - 1] === 'number' && p - (arr[idx - 1] as number) > 1) {
                          acc.push('...');
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === '...' ? (
                          <span key={`e-${idx}`} className="px-1 text-[var(--foreground-tertiary)]">...</span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setPage(item as number)}
                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                              page === item
                                ? 'bg-[#00E5A0] text-[#061A21]'
                                : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                            }`}
                          >
                            {item}
                          </button>
                        ),
                      )}
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="p-2 rounded-lg text-[var(--foreground-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Template Detail Modal */}
      {detailModalId && (
        <TemplateDetailModal
          templateId={detailModalId}
          onClose={() => setDetailModalId(null)}
          onUseTemplate={handleUseTemplate}
          onCustomize={(id) => {
            setDetailModalId(null);
            router.push(`/dashboard/templates/${id}?edit=true`);
          }}
        />
      )}

      {/* AI Designer Modal */}
      {showAIDesigner && (
        <AIDesignerModal
          onClose={() => setShowAIDesigner(false)}
          onTemplateGenerated={(id) => {
            setShowAIDesigner(false);
            setViewMode('your-templates');
            loadUserTemplates();
          }}
        />
      )}

      {/* Clone Confirmation Modal */}
      {cloneModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !cloning && setCloneModalId(null)} />
          <div className="relative bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-sm mx-4 p-6 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
            <h3 className="font-[var(--font-sora)] text-lg font-semibold text-[var(--foreground)] mb-2">Use This Template</h3>
            <p className="text-sm text-[var(--foreground-secondary)] mb-6">
              This will create a copy in your templates that you can customize and deploy to your displays.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCloneModalId(null)}
                disabled={cloning}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCloneConfirm}
                disabled={cloning}
                className="px-5 py-2 text-sm font-semibold bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {cloning ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#061A21]/30 border-t-[#061A21] rounded-full animate-spin" />
                    Cloning...
                  </>
                ) : (
                  'Clone & Customize'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setDeleteModalId(null)} />
          <div className="relative bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-sm mx-4 p-6 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
            <h3 className="font-[var(--font-sora)] text-lg font-semibold text-[var(--foreground)] mb-2">Delete Template</h3>
            <p className="text-sm text-[var(--foreground-secondary)] mb-6">
              Are you sure? This template will be archived and hidden from the library.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModalId(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
