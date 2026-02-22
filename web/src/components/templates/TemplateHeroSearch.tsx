'use client';

import { useState, useRef, useEffect } from 'react';

const SUGGESTION_TAGS = [
  'Coffee Shop Menu',
  'Retail Sale',
  'Corporate Welcome',
  'Restaurant Specials',
  'Event Board',
  'KPI Dashboard',
  'Directory Board',
  'Safety Alert',
];

interface TemplateHeroSearchProps {
  onSearch: (query: string) => void;
  onTagClick: (tag: string) => void;
  onAIDesignerClick: () => void;
}

export default function TemplateHeroSearch({
  onSearch,
  onTagClick,
  onAIDesignerClick,
}: TemplateHeroSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#061A21] via-[#0A2A33] to-[#0C2229]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, #00E5A0 0%, transparent 50%),
                           radial-gradient(circle at 80% 20%, #00B4D8 0%, transparent 50%),
                           radial-gradient(circle at 50% 80%, #00E5A0 0%, transparent 40%)`,
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,229,160,0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(0,229,160,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative px-6 py-16 sm:px-10 sm:py-20 lg:py-24 flex flex-col items-center text-center">
        {/* Heading */}
        <h1
          className={`font-[var(--font-sora)] text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--foreground)] mb-3 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Design Your Perfect{' '}
          <span className="bg-gradient-to-r from-[#00E5A0] to-[#00B4D8] bg-clip-text text-transparent">
            Display
          </span>
        </h1>
        <p
          className={`text-[var(--foreground-secondary)] text-base sm:text-lg max-w-xl mb-8 transition-all duration-700 delay-100 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Browse professionally designed templates or let AI create one for you
        </p>

        {/* Search bar */}
        <form
          onSubmit={handleSubmit}
          className={`w-full max-w-2xl mb-6 transition-all duration-700 delay-200 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="relative flex items-center">
            <div className="absolute left-4 text-[var(--foreground-tertiary)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates... e.g. restaurant menu, sale banner, welcome screen"
              className="w-full pl-12 pr-32 py-4 rounded-xl bg-[var(--surface)]/80 backdrop-blur-sm border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--foreground-tertiary)] focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/40 focus:border-[#00E5A0]/40 text-base transition-all"
              autoComplete="off"
            />
            <button
              type="submit"
              className="absolute right-2 px-6 py-2.5 rounded-lg bg-[#00E5A0] text-[#061A21] font-semibold text-sm hover:bg-[#00CC8E] transition-all hover:shadow-[0_0_20px_rgba(0,229,160,0.3)]"
            >
              Search
            </button>
          </div>
        </form>

        {/* Suggestion tags */}
        <div
          className={`flex flex-wrap items-center justify-center gap-2 mb-8 transition-all duration-700 delay-300 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="text-xs text-[var(--foreground-tertiary)] mr-1">Popular:</span>
          {SUGGESTION_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setQuery(tag);
                onTagClick(tag);
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--surface-hover)]/60 text-[var(--foreground-secondary)] border border-[var(--border)]/50 hover:border-[#00E5A0]/30 hover:text-[#00E5A0] hover:bg-[#00E5A0]/5 transition-all"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* AI Designer CTA */}
        <button
          onClick={onAIDesignerClick}
          className={`group inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00E5A0]/10 to-[#00B4D8]/10 border border-[#00E5A0]/20 text-[#00E5A0] font-semibold text-sm hover:from-[#00E5A0]/20 hover:to-[#00B4D8]/20 hover:border-[#00E5A0]/40 hover:shadow-[0_0_30px_rgba(0,229,160,0.15)] transition-all duration-300 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          {/* Sparkle icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="group-hover:rotate-12 transition-transform duration-300">
            <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" opacity="0.9" />
            <path d="M19 2L19.5 3.5L21 4L19.5 4.5L19 6L18.5 4.5L17 4L18.5 3.5L19 2Z" fill="currentColor" opacity="0.6" />
            <path d="M5 18L5.5 19.5L7 20L5.5 20.5L5 22L4.5 20.5L3 20L4.5 19.5L5 18Z" fill="currentColor" opacity="0.6" />
          </svg>
          Try AI Designer
          <span className="text-[#00E5A0]/60 text-xs font-normal">New</span>
        </button>
      </div>
    </div>
  );
}
