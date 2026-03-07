'use client';

import { Reveal } from './shared';

export default function DemoVideoSection() {
  return (
    <section className="py-20 px-6 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(0,229,160,0.06) 0%, transparent 60%)',
        }}
      />
      <div className="max-w-4xl mx-auto relative z-10">
        <Reveal>
          <div className="text-center mb-10">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-5"
              style={{
                background: 'rgba(0,229,160,0.08)',
                color: '#00E5A0',
                border: '1px solid rgba(0,229,160,0.2)',
              }}
            >
              Product Demo
            </span>
            <h2
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ color: '#F0ECE8' }}
            >
              See Vizora In Action
            </h2>
            <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: 'rgba(240,236,232,0.55)' }}>
              From beautiful templates to real-time device management — watch how Vizora transforms your digital signage workflow in under two minutes.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div
            className="relative rounded-2xl overflow-hidden group"
            style={{
              border: '1px solid rgba(0,229,160,0.15)',
              boxShadow: '0 0 60px rgba(0,229,160,0.08), 0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <video
              className="w-full aspect-video bg-black"
              controls
              preload="metadata"
              poster="/videos/vizora-demo-poster.jpg"
              playsInline
            >
              <source src="/videos/vizora-demo.mp4" type="video/mp4" />
              Your browser does not support video playback.
            </video>
          </div>
          <p className="text-center mt-4 text-xs" style={{ color: 'rgba(240,236,232,0.3)' }}>
            1:45 · No sound required · See dashboard, templates & device pairing
          </p>
        </Reveal>
      </div>
    </section>
  );
}
