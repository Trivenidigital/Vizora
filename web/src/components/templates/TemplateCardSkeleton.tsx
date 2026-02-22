'use client';

export default function TemplateCardSkeleton() {
  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden animate-pulse">
      <div className="h-44 bg-[var(--surface-hover)]" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-[var(--surface-hover)] rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-3 bg-[var(--surface-hover)] rounded w-full" />
          <div className="h-3 bg-[var(--surface-hover)] rounded w-2/3" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 bg-[var(--surface-hover)] rounded w-16" />
          <div className="h-5 bg-[var(--surface-hover)] rounded w-16" />
        </div>
      </div>
    </div>
  );
}

export function TemplateGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <TemplateCardSkeleton key={i} />
      ))}
    </div>
  );
}
