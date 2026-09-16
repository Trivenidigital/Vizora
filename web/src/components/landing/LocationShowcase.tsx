'use client';

export default function LocationShowcase() {
  const locations = [
    {
      id: 'cafe',
      name: 'Café',
      description: 'Change menus, show specials, and welcome customers in real time',
      examples: ['Digital menu boards', 'Daily specials display', 'Customer queue status'],
      screens: '2-5',
      color: 'var(--lw-brass)',
    },
    {
      id: 'hotel',
      name: 'Hotel',
      description: 'Greet guests with personalized information and wayfinding displays',
      examples: ['Lobby digital signage', 'Room service menus', 'Event schedules'],
      screens: '10-50',
      color: 'var(--lw-coral)',
    },
    {
      id: 'retail',
      name: 'Retail Shop',
      description: 'Showcase products, promotions, and seasonal campaigns instantly',
      examples: ['Product displays', 'Price tags', 'Promotional content'],
      screens: '5-20',
      color: 'var(--lw-forest)',
    },
  ];

  return (
    <section
      id="your-locations"
      className="lw-wrap py-16 md:py-24"
      style={{ background: 'var(--lw-paper)' }}
    >
      <div className="mb-12">
        <div className="lw-kicker mb-6">Your Locations</div>
        <h2 className="lw-h2 text-3xl md:text-4xl lg:text-5xl">
          Digital signage for every venue
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {locations.map((location) => (
          <div
            key={location.id}
            className="lw-card-surface p-8 flex flex-col gap-6 hover:shadow-lg transition-shadow duration-300"
          >
            {/* Header with accent */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: location.color }}
                />
                <h3 className="text-xl font-semibold text-[var(--lw-ink)]">
                  {location.name}
                </h3>
              </div>
              <p className="text-[var(--lw-ink-2)] leading-relaxed">
                {location.description}
              </p>
            </div>

            {/* 3D Scene Placeholder */}
            <div
              className="rounded-lg overflow-hidden flex-grow flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--lw-paper-2), var(--lw-stone))',
                minHeight: '200px',
                opacity: 0.6,
              }}
            >
              <div className="text-center text-xs text-[var(--lw-muted)]">
                {location.name} diorama render
              </div>
            </div>

            {/* Content examples */}
            <div className="space-y-3 border-t border-[var(--lw-hair)] pt-4">
              <div className="text-xs uppercase tracking-wider text-[var(--lw-muted)]">
                Content Examples
              </div>
              <ul className="space-y-2">
                {location.examples.map((example, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-[var(--lw-ink-2)] flex items-start gap-2"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
                      style={{ background: location.color, opacity: 0.6 }}
                    />
                    {example}
                  </li>
                ))}
              </ul>
            </div>

            {/* Screens count */}
            <div className="text-xs text-[var(--lw-muted)]">
              Typical: {location.screens} screens
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
