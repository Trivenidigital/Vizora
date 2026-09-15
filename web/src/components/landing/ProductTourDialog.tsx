'use client';

import { useId } from 'react';
import { X } from 'lucide-react';
import { useDialog } from '@/lib/hooks/useDialog';

interface ProductTourDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The hero chip advertises a 1:45 product tour. The asset is real
 * (`/videos/vizora-demo.mp4`) but the demo SECTION that used to carry it was
 * trimmed from the page, so the chip had nothing behind it.
 *
 * Rendering `null` while closed is load-bearing, not tidiness: the file is
 * 48 MB, and a `<video>` in the tree would have the browser fetching metadata
 * (and, with a poster, the poster) on every homepage visit for a control most
 * visitors never press.
 *
 * Escape, Tab containment, body scroll lock and focus return all come from
 * `useDialog` — the same hook the app's two dialog shells use, because a focus
 * trap written twice is a focus trap maintained once.
 */
export default function ProductTourDialog({ open, onClose }: ProductTourDialogProps) {
  const titleId = useId();
  const containerRef = useDialog({ isOpen: open, onClose });

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(10,34,46,0.55)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: 'var(--mkt-surface)',
          borderRadius: '16px',
          border: '1px solid var(--mkt-hair)',
          boxShadow: '0 30px 70px rgba(10,34,46,0.3)',
          width: 'min(96vw, 960px)',
          overflow: 'hidden',
        }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <h2 id={titleId} className="eh-heading" style={{ fontSize: '1rem', fontWeight: 600 }}>
            Vizora product tour
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product tour"
            style={{ color: 'var(--mkt-ink-2)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* tabIndex: `useDialog`'s focus trap enumerates a[href]/button/input/
            select/textarea/[tabindex]. A <video> matches none of those, so
            without this the trap pinned Tab on the Close button and the native
            controls were unreachable by keyboard. */}
        <video
          tabIndex={0}
          controls
          autoPlay
          playsInline
          preload="metadata"
          poster="/videos/vizora-demo-poster.jpg"
          className="w-full aspect-video"
          style={{ background: 'var(--mkt-canvas-2)' }}
        >
          <source src="/videos/vizora-demo.mp4" type="video/mp4" />
          Your browser does not support video playback.
        </video>

        <p className="px-5 py-3 text-xs" style={{ color: 'var(--mkt-muted)' }}>
          1:45 · Dashboard, templates &amp; device pairing
        </p>
      </div>
    </div>
  );
}
