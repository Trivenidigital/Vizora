'use client';

interface CategoryItem {
  name: string;
  count?: number;
  label?: string;
}

type ViewMode = 'home' | 'your-templates';
type Orientation = '' | 'landscape' | 'portrait' | 'both';
type Difficulty = '' | 'beginner' | 'intermediate' | 'advanced';

interface TemplateSidebarProps {
  categories: CategoryItem[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedOrientation: Orientation;
  onOrientationChange: (orientation: Orientation) => void;
  selectedDifficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNewDesignClick: () => void;
  onAIDesignerClick: () => void;
  isAdmin: boolean;
  totalCount: number;
}

const ORIENTATIONS: { value: Orientation; label: string; icon: JSX.Element }[] = [
  {
    value: '',
    label: 'All',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>,
  },
  {
    value: 'landscape',
    label: 'Landscape',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /></svg>,
  },
  {
    value: 'portrait',
    label: 'Portrait',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" /></svg>,
  },
];

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: '', label: 'All', color: '' },
  { value: 'beginner', label: 'Beginner', color: 'text-green-400' },
  { value: 'intermediate', label: 'Intermediate', color: 'text-yellow-400' },
  { value: 'advanced', label: 'Advanced', color: 'text-red-400' },
];

export default function TemplateSidebar({
  categories,
  selectedCategory,
  onCategoryChange,
  selectedOrientation,
  onOrientationChange,
  selectedDifficulty,
  onDifficultyChange,
  viewMode,
  onViewModeChange,
  onNewDesignClick,
  onAIDesignerClick,
  isAdmin,
  totalCount,
}: TemplateSidebarProps) {
  return (
    <div className="w-60 flex-shrink-0 hidden lg:block">
      <div className="sticky top-24 space-y-4">
        {/* Navigation */}
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3">
          <nav className="space-y-0.5">
            <button
              onClick={() => onViewModeChange('home')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'home'
                  ? 'bg-[#00E5A0]/10 text-[#00E5A0]'
                  : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              Browse Library
            </button>
            <button
              onClick={() => onViewModeChange('your-templates')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'your-templates'
                  ? 'bg-[#00E5A0]/10 text-[#00E5A0]'
                  : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Your Templates
            </button>

            <div className="border-t border-[var(--border)] my-2" />

            {isAdmin && (
              <button
                onClick={onNewDesignClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Design
              </button>
            )}

            <button
              onClick={onAIDesignerClick}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#00E5A0]/80 hover:bg-[#00E5A0]/5 hover:text-[#00E5A0] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
              </svg>
              AI Designer
              <span className="ml-auto text-[10px] font-semibold bg-[#00E5A0]/15 text-[#00E5A0] px-1.5 py-0.5 rounded-full">NEW</span>
            </button>
          </nav>
        </div>

        {/* Filters (only in browse mode) */}
        {viewMode === 'home' && (
          <>
            {/* Categories */}
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-tertiary)] mb-2 px-2">
                Categories
              </h3>
              <nav className="space-y-0.5 max-h-[280px] overflow-y-auto scrollbar-thin">
                <button
                  onClick={() => onCategoryChange('')}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all ${
                    !selectedCategory
                      ? 'bg-[#00E5A0]/10 text-[#00E5A0] font-medium'
                      : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                  }`}
                >
                  All Templates
                  <span className="text-xs opacity-60">{totalCount}</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => onCategoryChange(cat.name)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all ${
                      selectedCategory === cat.name
                        ? 'bg-[#00E5A0]/10 text-[#00E5A0] font-medium'
                        : 'text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <span className="capitalize">{cat.label || cat.name}</span>
                    <span className="text-xs opacity-60">{cat.count || 0}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Orientation filter */}
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-tertiary)] mb-2 px-2">
                Orientation
              </h3>
              <div className="flex gap-1">
                {ORIENTATIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onOrientationChange(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedOrientation === opt.value
                        ? 'bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/20'
                        : 'text-[var(--foreground-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground-secondary)] border border-transparent'
                    }`}
                    title={opt.label}
                  >
                    {opt.icon}
                    <span className="hidden xl:inline">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty filter */}
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-tertiary)] mb-2 px-2">
                Difficulty
              </h3>
              <div className="space-y-0.5">
                {DIFFICULTIES.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onDifficultyChange(opt.value)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all ${
                      selectedDifficulty === opt.value
                        ? 'bg-[#00E5A0]/10 text-[#00E5A0] font-medium'
                        : `text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]`
                    }`}
                  >
                    {opt.value ? (
                      <span className="flex items-center gap-2">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                          opt.value === 'beginner' ? 'bg-green-400' :
                          opt.value === 'intermediate' ? 'bg-yellow-400' : 'bg-red-400'
                        }`} />
                        {opt.label}
                      </span>
                    ) : (
                      opt.label
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
