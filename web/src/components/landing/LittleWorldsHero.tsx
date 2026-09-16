'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { anchorProps } from './shared';
import ProductTourDialog from './ProductTourDialog';

interface LittleWorldsHeroProps {
  heroRef?: React.RefObject<HTMLElement>;
}

export default function LittleWorldsHero({ heroRef }: LittleWorldsHeroProps) {
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <section
      ref={heroRef}
      className="lw-wrap py-16 md:py-28 lg:py-36 relative"
      id="hero"
      style={{ background: 'var(--lw-paper)' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Left: Copy & CTAs */}
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="lw-display text-5xl md:text-6xl lg:text-7xl mb-6 leading-tight">
              Your world.<br />
              <em>Perfectly in sync.</em>
            </h1>
            <p className="text-lg md:text-xl leading-relaxed text-[var(--lw-ink-2)] max-w-md">
              Manage your screens, organize your content, and reach customers across all your locations with a single platform.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="/register"
              className="lw-btn lw-btn-forest text-center"
            >
              Explore Vizora
            </a>
            <a
              {...anchorProps('how-it-works')}
              className="lw-btn lw-btn-ghost text-center"
            >
              See how it works
            </a>
          </div>

          {/* Product tour chip */}
          <button
            onClick={() => setTourOpen(true)}
            className="mkt-hero-chip inline-flex items-center gap-3 px-4 py-3 rounded-full border border-[var(--lw-hair)]"
            style={{
              background: 'rgba(255, 253, 244, 0.55)',
              width: 'fit-content',
            }}
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--lw-forest)] flex items-center justify-center">
              <Play size={14} className="text-[var(--lw-on-forest)]" />
            </span>
            <span className="text-sm font-medium text-[var(--lw-ink)]">
              1:45 product tour
            </span>
          </button>
        </div>

        {/* Right: 3D Scene Placeholder */}
        <div className="flex items-center justify-center">
          <div
            className="lw-well w-full aspect-square max-w-md rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--lw-paper-2), var(--lw-stone))',
              minHeight: '400px',
            }}
          >
            {/* 3D Diorama Render Placeholder */}
            <div className="w-full h-full flex items-center justify-center relative">
              {/* This will be replaced with the Blender-rendered 3D scene */}
              <div className="text-center px-6">
                <div className="text-sm font-medium text-[var(--lw-muted)] mb-4">
                  3D Scene: Miniature Café, Hotel & Retail
                </div>
                <div className="text-xs text-[var(--lw-muted)]">
                  Blender render showing embedded digital signage
                </div>
              </div>

              {/* Placeholder gradient */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: `linear-gradient(135deg,
                    rgba(31, 66, 48, 0.1),
                    rgba(176, 138, 62, 0.1),
                    rgba(217, 106, 76, 0.1))`,
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <ProductTourDialog open={tourOpen} onClose={() => setTourOpen(false)} />
    </section>
  );
}
