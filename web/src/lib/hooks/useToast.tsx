'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast, { ToastType } from '@/components/Toast';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type ShowToast = (message: string, type?: ToastType, duration?: number) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * The ONE toast stack for the app, mounted in the root layout.
 *
 * Toast state used to live inside `useToast()` itself, so every caller owned a
 * private stack and had to render the `ToastContainer` it was handed. Nine
 * callers never did — schedules, analytics, the template editor, the fleet
 * controls, the device preview — and every toast they raised, success and
 * error alike, was silently dropped. A parent's container could not help: it
 * rendered the parent's stack, not the child's. Owning the stack here makes
 * "forgot to render the container" impossible rather than merely discouraged.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback<ShowToast>((message, type = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* One stack, newest at the bottom. `pointer-events-none` on the column so
          the empty space beside short toasts does not swallow clicks on the page
          underneath; each toast re-enables events for itself. */}
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Kept so the existing `<toast.ToastContainer />` call sites need no edit. The
 * provider renders the stack; rendering it again here would show every toast
 * twice.
 */
function ToastContainer() {
  return null;
}

/**
 * Raise a toast on the app-wide stack.
 *
 * Throws outside a `ToastProvider` rather than falling back to a local stack:
 * a local fallback is exactly the shape of the bug the provider exists to fix
 * (toasts accepted, then rendered nowhere). The root layout wraps every route,
 * so this can only fire in a test that renders a component without the
 * provider — wrap it in `<ToastProvider>` or mock this module.
 *
 * The returned object is referentially stable, so callers that list `toast` in
 * effect / callback deps no longer re-run on every render.
 */
export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return useMemo(
    () => ({
      showToast,
      success: (message: string) => showToast(message, 'success'),
      error: (message: string) => showToast(message, 'error'),
      info: (message: string) => showToast(message, 'info'),
      warning: (message: string) => showToast(message, 'warning'),
      ToastContainer,
    }),
    [showToast]
  );
}
