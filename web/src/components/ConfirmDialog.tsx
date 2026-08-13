'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { Icon } from '@/theme/icons';
import { useDialog } from '@/lib/hooks/useDialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const titleId = useId();
  const messageId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * Ignore Escape while the action is in flight, matching the backdrop, which
   * already refuses to close mid-confirm. Dismissing then would leave the
   * caller's promise running with its dialog gone.
   */
  const handleDismiss = useCallback(() => {
    if (!isConfirming) onClose();
  }, [isConfirming, onClose]);

  /*
   * This dialog declared role="dialog" aria-modal="true" while providing none
   * of it — no Escape, no scroll lock, no focus management — so the page behind
   * it stayed scrollable and tabbable even though assistive tech had been told
   * it was inert. Initial focus goes to CANCEL, not the confirm button: this is
   * most often a destructive prompt, and the safe option should be the one
   * under Enter.
   */
  const containerRef = useDialog({
    isOpen,
    onClose: handleDismiss,
    initialFocusRef: cancelButtonRef,
  });

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isConfirming) return;

    setIsConfirming(true);
    try {
      await onConfirm();
      setIsConfirming(false);
      onClose();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Confirmation action failed:', error);
      }
      setIsConfirming(false);
    }
  };

  const buttonColors = {
    danger: 'bg-error-600 hover:bg-error-700',
    warning: 'bg-warning-600 hover:bg-warning-700',
    info: 'bg-info-600 hover:bg-info-700',
  };

  const iconColors = {
    danger: 'text-error-600',
    warning: 'text-warning-600',
    info: 'text-info-600',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={() => {
            if (!isConfirming) onClose();
          }}
        />

        {/* Dialog */}
        <div
          ref={containerRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          className="relative bg-[var(--surface)] rounded-lg shadow-xl max-w-md w-full transform transition-all"
        >
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 ${iconColors[type]}`}>
                {type === 'danger' && <Icon name="error" size="2xl" />}
                {type === 'warning' && <Icon name="warning" size="2xl" />}
                {type === 'info' && <Icon name="info" size="2xl" />}
              </div>
              <div className="flex-1">
                <h3 id={titleId} className="text-lg font-semibold text-[var(--foreground)] mb-2">{title}</h3>
                <p id={messageId} className="text-sm text-[var(--foreground-secondary)]">{message}</p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--background)] px-6 py-4 flex justify-end gap-3 rounded-b-lg">
            <button
              ref={cancelButtonRef}
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-md hover:bg-[var(--surface-hover)] transition"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              aria-busy={isConfirming}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonColors[type]}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
