'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface NewDesignModalProps {
  onClose: () => void;
  onStartFromTemplate: () => void;
  onAIDesigner: () => void;
}

export default function NewDesignModal({ onClose, onStartFromTemplate, onAIDesigner }: NewDesignModalProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  // Escape key + scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleBlankCanvas = async () => {
    try {
      setCreating(true);
      const result = await apiClient.createBlankDesign('landscape');
      const id = (result as any).id;
      if (id) {
        router.push(`/dashboard/templates/${id}/edit`);
      }
    } catch (err) {
      console.error('Failed to create blank design:', err);
    } finally {
      setCreating(false);
    }
  };

  const cards = [
    {
      title: 'Start from Template',
      description: 'Pick a template from the library and customize it',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
      onClick: () => { onClose(); onStartFromTemplate(); },
    },
    {
      title: 'AI Designer',
      description: 'Describe what you want and AI will design it',
      badge: 'NEW',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[#00E5A0]">
          <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" />
        </svg>
      ),
      onClick: () => { onClose(); onAIDesigner(); },
    },
    {
      title: 'Blank Canvas',
      description: 'Start from scratch with an empty template',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
      onClick: handleBlankCanvas,
      loading: creating,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] w-full max-w-lg mx-4 shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-[#00E5A0] via-[#00B4D8] to-[#00E5A0]" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        <div className="p-6">
          {/* Header */}
          <h2 className="font-[var(--font-sora)] text-lg font-bold text-[var(--foreground)] mb-1">
            Create New Design
          </h2>
          <p className="text-sm text-[var(--foreground-tertiary)] mb-5">
            Choose how you&apos;d like to start
          </p>

          {/* Cards */}
          <div className="space-y-2.5">
            {cards.map((card) => (
              <button
                key={card.title}
                onClick={card.onClick}
                disabled={card.loading}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:border-[#00E5A0]/30 hover:bg-[#00E5A0]/5 transition-all text-left group disabled:opacity-60"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground-secondary)] group-hover:text-[#00E5A0] group-hover:border-[#00E5A0]/20 transition-all flex-shrink-0">
                  {card.loading ? (
                    <div className="w-5 h-5 border-2 border-[var(--foreground-tertiary)]/30 border-t-[#00E5A0] rounded-full animate-spin" />
                  ) : (
                    card.icon
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--foreground)] group-hover:text-[#00E5A0] transition-colors">
                      {card.title}
                    </span>
                    {card.badge && (
                      <span className="text-[9px] font-bold bg-[#00E5A0]/15 text-[#00E5A0] px-1.5 py-0.5 rounded-full">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--foreground-tertiary)] mt-0.5">
                    {card.description}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--foreground-tertiary)] group-hover:text-[#00E5A0] transition-colors flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
