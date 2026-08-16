/**
 * Route-level loading state.
 *
 * A centred spinner in a 400px-tall void discards the layout and then snaps to
 * it, so the page appears to jump on every navigation. This is the shape of what
 * arrives — header, summary chips, toolbar, then the card grid — so the
 * substitution is visually silent.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading playlists</span>

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

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="eh-skeleton h-11 flex-1 rounded-xl" />
        <div className="eh-skeleton h-11 rounded-xl sm:w-52" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="eh-dash-card space-y-4 p-6">
            <div className="flex gap-4">
              <div className="eh-skeleton h-20 w-20 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="eh-skeleton h-5 w-40" />
                <div className="eh-skeleton h-4 w-56" />
                <div className="eh-skeleton h-4 w-32" />
              </div>
            </div>
            <div className="eh-skeleton h-20 w-full rounded-xl" />
            <div className="eh-skeleton h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
