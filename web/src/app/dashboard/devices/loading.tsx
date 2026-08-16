/**
 * Route-level loading state.
 *
 * A centred spinner in a 400px-tall void discards the layout and then snaps to
 * it, so the page appears to jump on every navigation. This is the shape of
 * what arrives — header, filter strip, then rows — so the substitution is
 * visually silent.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading devices</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="w-full max-w-sm space-y-3">
          <div className="eh-skeleton h-8 w-40" />
          <div className="eh-skeleton h-4 w-64" />
        </div>
        <div className="eh-skeleton h-11 w-44" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="eh-skeleton h-11 w-32 rounded-xl" />
        ))}
      </div>

      <div className="eh-skeleton h-11 w-full rounded-xl" />

      <div className="eh-dash-card overflow-hidden p-4">
        <div className="eh-skeleton mb-4 h-9 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="eh-skeleton h-5 w-5 shrink-0 rounded-md" />
            <div className="eh-skeleton h-5 flex-1" />
            <div className="eh-skeleton hidden h-5 w-24 sm:block" />
            <div className="eh-skeleton hidden h-5 w-32 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
