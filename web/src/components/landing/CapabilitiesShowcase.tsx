'use client';

export default function CapabilitiesShowcase() {
  const capabilities = [
    {
      icon: '⚡',
      title: 'Real-Time Updates',
      description: 'Changes deploy instantly to all screens across your locations via WebSocket',
      details: ['Immediate content updates', 'Live device status', 'No polling required'],
    },
    {
      icon: '🎯',
      title: 'Multi-Platform Playback',
      description: 'Your content plays on web browsers, Electron desktops, and Android TV',
      details: ['Windows, macOS, Linux', 'Web-based players', 'Android TV support'],
    },
    {
      icon: '👥',
      title: 'Team Collaboration',
      description: 'Give teams the right permissions with admin, manager, and viewer roles',
      details: ['Role-based access', 'Content approval workflows', 'Audit trail of all changes'],
    },
    {
      icon: '🔒',
      title: 'Complete Audit Log',
      description: 'Every change is tracked and logged for compliance and accountability',
      details: ['Track all modifications', 'User activity history', 'Export for compliance'],
    },
  ];

  return (
    <section
      id="why-vizora"
      className="lw-wrap py-16 md:py-24"
      style={{ background: 'var(--lw-paper)' }}
    >
      <div className="mb-12">
        <div className="lw-kicker mb-6">Why Vizora</div>
        <h2 className="lw-h2 text-3xl md:text-4xl lg:text-5xl">
          Built for scale and simplicity
        </h2>
        <p className="text-lg text-[var(--lw-ink-2)] mt-4 max-w-2xl">
          Manage thousands of screens across your entire business with a platform that gets out of your way.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {capabilities.map((cap, idx) => (
          <div key={idx} className="lw-card-surface p-8">
            <div className="text-5xl mb-4">{cap.icon}</div>
            <h3 className="text-xl font-semibold text-[var(--lw-ink)] mb-2">
              {cap.title}
            </h3>
            <p className="text-[var(--lw-ink-2)] mb-4 leading-relaxed">
              {cap.description}
            </p>
            <ul className="space-y-2">
              {cap.details.map((detail, didx) => (
                <li key={didx} className="text-sm text-[var(--lw-muted)] flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[var(--lw-forest)]" />
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
