'use client';

const devices = [
  { name: 'Lobby Main', location: 'HQ-F1', content: 'Welcome Video', status: 'online' as const },
  { name: 'Cafeteria', location: 'HQ-F2', content: 'Daily Specials', status: 'online' as const },
  { name: 'Store Window', location: 'RETAIL', content: 'Summer Sale', status: 'offline' as const },
];

const statusColors = {
  online: { dot: 'bg-[#00E5A0]', text: 'text-[#00E5A0]' },
  offline: { dot: 'bg-[var(--error)]', text: 'text-[var(--error)]' },
};

export default function MiniDashboard() {
  return (
    <div className="rounded-xl border border-[#1B3D47] bg-[#0C2229]/80 overflow-hidden shadow-2xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1B3D47] bg-[#081E28]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/60" />
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
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-[#00E5A0]/10 text-[#00E5A0]">
              Live
            </span>
          </div>
        </div>

        {/* Metric row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Online', value: '2/3', color: '#00E5A0' },
            { label: 'Content', value: '148', color: '#00B4D8' },
            { label: 'Uptime', value: '99.9%', color: '#00E5A0' },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-[#1B3D47] bg-[#081E28]/60 px-2.5 py-2 text-center"
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
              className="flex items-center gap-3 rounded-lg border border-[#1B3D47] bg-[#081E28]/40 px-3 py-2"
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
