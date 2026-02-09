import LoadingSpinner from '@/components/LoadingSpinner';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-[var(--foreground-tertiary)]">Loading analytics...</p>
      </div>
    </div>
  );
}
