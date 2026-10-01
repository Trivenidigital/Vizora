'use client';

const devices = [
  { name: 'Lobby Main', location: 'HQ-F1', content: 'Welcome Video', status: 'online' as const },
  { name: 'Cafeteria', location: 'HQ-F2', content: 'Daily Specials', status: 'online' as const },
  { name: 'Store Window', location: 'RETAIL', content: 'Summer Sale', status: 'offline' as const },
];

/*
 * A mock of the real dashboard, so it uses the REAL status tokens — the same
 * `--status-*` pairs `.eh-badge-*` renders. A preview that invents its own
 * green is a preview of a product that does not exist.
 */
const statusColors = {
  online: { dot: 'bg-[var(--success-ink)]', text: 'text-[var(--success-ink)]' },
  offline: { dot: 'bg-[var(--error-ink)]', text: 'text-[var(--error-ink)]' },
};

export default function MiniDashboard() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-lg">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--background-secondary)]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-error/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-[10px] text-[var(--foreground-tertiary)] font-mono">
            dashboard.vizora.cloud
          </span>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground)]">Fleet Overview</p>
            <p className="text-[10px] text-[var(--foreground-tertiary)]">
              3 devices &middot; 2 online
            </p>
          </div>
          <div className="flex gap-1.5">
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-[var(--badge-brand-bg)] text-[var(--primary-ink)]">
              Live
            </span>
          </div>
        </div>

        {/* Metric row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Online', value: '2/3', color: 'var(--success-ink)' },
            { label: 'Content', value: '148', color: 'var(--info-ink)' },
            { label: 'Playlists', value: '6', color: 'var(--primary-ink)' },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-[var(--border-light)] bg-[var(--background-secondary)] px-2.5 py-2 text-center"
            >
              <p className="text-sm font-bold font-mono" style={{ color: m.color }}>
                {m.value}
              </p>
              <p className="text-[9px] text-[var(--foreground-tertiary)]">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Device list */}
        <div className="space-y-1.5">
          {devices.map((d) => (
            <div
              key={d.name}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] bg-[var(--background-secondary)] px-3 py-2"
            >
              <span
                className={`w-2 h-2 rounded-full ${statusColors[d.status].dot} ${
                  d.status === 'online' ? 'animate-pulse' : ''
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-[var(--foreground)] truncate">
                  {d.name}
                </p>
                <p className="text-[9px] text-[var(--foreground-tertiary)]">{d.content}</p>
              </div>
              <span className="text-[9px] font-mono text-[var(--foreground-tertiary)]">
                {d.location}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
