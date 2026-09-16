'use client';

import { ArrowRight } from 'lucide-react';

export default function ContentToPlayback() {
  const steps = [
    {
      number: '01',
      title: 'Create',
      description: 'Add images, videos, text, and HTML content',
      icon: '🎨',
    },
    {
      number: '02',
      title: 'Organize',
      description: 'Group content into playlists for each location or screen',
      icon: '📋',
    },
    {
      number: '03',
      title: 'Schedule',
      description: 'Set when content plays, rotate between playlists, and automate updates',
      icon: '⏱️',
    },
    {
      number: '04',
      title: 'Display',
      description: 'Content plays live on your screens across all locations',
      icon: '📺',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="lw-wrap py-16 md:py-24"
      style={{ background: 'var(--lw-paper)' }}
    >
      <div className="mb-12">
        <div className="lw-kicker mb-6">Content to Playback</div>
        <h2 className="lw-h2 text-3xl md:text-4xl lg:text-5xl">
          From content to live screens in four steps
        </h2>
      </div>

      {/* Steps flow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
        {steps.map((step, idx) => (
          <div key={idx} className="relative">
            {/* Step card */}
            <div
              className="lw-card-surface p-8 h-full flex flex-col gap-4"
              style={{ background: 'var(--lw-card)' }}
            >
              <div className="text-4xl">{step.icon}</div>
              <div className="lw-mono">{step.number}</div>
              <h3 className="text-xl font-semibold text-[var(--lw-ink)]">
                {step.title}
              </h3>
              <p className="text-sm text-[var(--lw-ink-2)] leading-relaxed flex-grow">
                {step.description}
              </p>
            </div>

            {/* Arrow between steps */}
            {idx < steps.length - 1 && (
              <div className="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2 z-10">
                <div
                  className="flex-shrink-0"
                  style={{ color: 'var(--lw-forest)', opacity: 0.3 }}
                >
                  <ArrowRight size={24} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Live example / product preview */}
      <div
        className="lw-well p-12 rounded-2xl flex items-center justify-center min-h-[400px]"
        style={{
          background: 'linear-gradient(135deg, var(--lw-paper-2), var(--lw-stone))',
        }}
      >
        <div className="text-center">
          <div className="text-sm font-medium text-[var(--lw-muted)] mb-4">
            Product Preview
          </div>
          <div className="text-xs text-[var(--lw-muted)] max-w-md">
            Live Vizora dashboard mockup showing the create/organize/schedule/display workflow
          </div>
        </div>
      </div>
    </section>
  );
}
