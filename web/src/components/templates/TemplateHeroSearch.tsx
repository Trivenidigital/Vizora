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
      {/*
        * CHROME, so it goes light — this hero shows Vizora, not a customer's
        * media (notes.darkPanelDecision). It was a near-black Electric Horizon
        * slab, and the earlier sweep had already re-inked its heading to
        * `--foreground`, which measured 1.16:1 on that ground — the heading of
        * this page was effectively invisible. On `--background-secondary` the
        * same heading is 12.68:1.
        *
        * Recessed band, raised controls — the same relationship the auth
        * ValuePanel and the dashboard rail use, which is why the ground is
        * `--background-secondary` rather than `--surface`: the search field and
        * the suggestion chips sit ON it as `--surface`.
        *
        * The three neon/cyan radial glows and the neon grid that used to sit on
        * top are deleted rather than re-tinted. They gave a near-black slab
        * depth; on ivory they have nothing to do (same call as ValuePanel's two
        * glow blobs in B2).
        */}
      <div className="absolute inset-0 bg-[var(--background-secondary)]" />

      {/* Content */}
      <div className="relative px-6 py-16 sm:px-10 sm:py-20 lg:py-24 flex flex-col items-center text-center">
        {/* Heading */}
        <h1
          className={`font-sora text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--foreground)] mb-3 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Design Your Perfect{' '}
          <span className="text-[var(--primary-ink)]">
            Display
          </span>
        </h1>
        <p
          className={`text-[var(--foreground-secondary)] text-base sm:text-lg max-w-xl mb-8 transition-all duration-700 delay-100 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Browse professionally designed templates and clone one to customize for your screens
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
              className="w-full pl-12 pr-32 py-4 rounded-xl bg-surface/80 backdrop-blur-sm border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--foreground-tertiary)] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 text-base transition-all"
              autoComplete="off"
            />
            <button
              type="submit"
              className="absolute right-2 px-6 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--lw-on-forest)] font-semibold text-sm hover:bg-[var(--primary-light)] transition-all hover:shadow-md"
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
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--surface)] text-[var(--foreground-secondary)] border border-border/50 hover:border-brand/30 hover:text-[var(--primary-ink)] hover:bg-brand/5 transition-all"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* AI Designer CTA */}
        <button
          onClick={onAIDesignerClick}
          className={`group inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 text-[var(--primary-ink)] font-semibold text-sm hover:from-brand/20 hover:to-brand/10 hover:border-brand/40 hover:shadow-md transition-all duration-300 ${
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
          AI Designer coming soon
          <span className="text-[var(--foreground-secondary)] text-xs font-normal">Soon</span>
        </button>
      </div>
    </div>
  );
}
