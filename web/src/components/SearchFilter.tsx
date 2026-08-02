'use client';

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchFilter({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: SearchFilterProps) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        /* `!` is load-bearing. `.eh-input` sets the `padding` shorthand and is
           defined in globals.css AFTER `@tailwind utilities`; both are
           single-class selectors, so source order wins and plain `pl-10`
           loses to `.eh-input`'s `padding: 10px 16px`. Text then starts at
           16px while the search icon occupies 14–30px, so the glyph sits on
           top of the placeholder. */
        className="eh-input !pl-10 !pr-10"
        autoComplete="off"
      />
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--foreground-tertiary)] pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 eh-icon-btn p-1"
          aria-label="Clear search"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
