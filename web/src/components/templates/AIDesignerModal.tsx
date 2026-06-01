'use client';

import { useEffect } from 'react';

interface AIDesignerModalProps {
  onClose: () => void;
}

export default function AIDesignerModal({ onClose }: AIDesignerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] w-full max-w-lg mx-4 shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className="h-1 bg-gradient-to-r from-[#00E5A0] via-[#00B4D8] to-[#00E5A0]" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all"
          aria-label="Close AI Designer status"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="p-8 sm:p-10 flex flex-col items-center justify-center min-h-[360px] text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00E5A0]/10 to-[#00B4D8]/10 border border-[#00E5A0]/15 flex items-center justify-center mb-6">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-[#00E5A0]">
              <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" opacity="0.85" />
              <path d="M19 2L19.5 3.5L21 4L19.5 4.5L19 6L18.5 4.5L17 4L18.5 3.5L19 2Z" fill="currentColor" opacity="0.5" />
            </svg>
          </div>

          <h3 className="font-[var(--font-sora)] text-xl font-bold text-[var(--foreground)] mb-3">
            AI Designer is Launching Soon
          </h3>
          <p className="text-[var(--foreground-secondary)] text-sm max-w-sm mb-8">
            AI template generation is not enabled yet. Use the template library today; we will enable AI Designer once production cost controls and rollout gates are in place.
          </p>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-[#00E5A0] text-[#061A21] font-semibold text-sm hover:bg-[#00CC8E] transition-all"
          >
            Browse Templates
          </button>
        </div>
      </div>
    </div>
  );
}
