'use client';

import { Icon } from '@/theme/icons';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
  if (!isOpen) return null;

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
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="relative bg-[var(--surface)] rounded-lg shadow-xl max-w-md w-full transform transition-all">
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 ${iconColors[type]}`}>
                {type === 'danger' && <Icon name="error" size="2xl" />}
                {type === 'warning' && <Icon name="warning" size="2xl" />}
                {type === 'info' && <Icon name="info" size="2xl" />}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--foreground-secondary)]">{message}</p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--background)] px-6 py-4 flex justify-end gap-3 rounded-b-lg">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-md hover:bg-[var(--surface-hover)] transition"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition ${buttonColors[type]}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
