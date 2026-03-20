'use client';

interface SkeletonProps {
  className?: string;
}

/** Single skeleton line/block */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`eh-skeleton ${className}`} />;
}

/** Skeleton card for grid views */
export function SkeletonCard() {
  return (
    <div className="eh-dash-card p-0 overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none rounded-t-xl" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton row for table/list views */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)]">
      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** Grid of skeleton cards */
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** List of skeleton rows */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="eh-dash-card p-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Skeleton stats row (for overview page) */
export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="eh-dash-card p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}
