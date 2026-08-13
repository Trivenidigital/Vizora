'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Icon } from '@/theme/icons';
import type { IconName } from '@/theme/icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startClose = useCallback(() => {
    setIsVisible(false);
    animationTimerRef.current = setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(startClose, duration);

    return () => {
      clearTimeout(timer);
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [duration, startClose]);

  /**
   * Shades chosen so the white label clears WCAG AA (4.5:1), computed against
   * #FFFFFF from the ramp in tailwind.theme.cjs rather than picked by eye:
   *
   *          -500    -600    -700
   *  success 2.28    3.30    5.02  <-
   *  error   3.76    4.83 <- 6.47
   *  warning 2.15    3.19    5.02  <-
   *  info    2.46    3.43    5.36  <-
   *
   * Every variant previously used -500, so all four failed — a toast is often
   * the only report a user gets that their action succeeded or failed, which
   * makes it a poor place to be unreadable. Each now takes the lightest shade
   * that passes, keeping as much of the colour as legibility allows.
   *
   * These are fixed shades, not theme tokens, deliberately: a toast is a
   * transient overlay that must stay legible in both themes, and the semantic
   * tokens resolve to different values per theme.
   */
  const colors = {
    success: 'bg-success-700 text-white',
    error: 'bg-error-600 text-white',
    info: 'bg-info-700 text-white',
    warning: 'bg-warning-700 text-white',
  };

  const icons: Record<ToastType, IconName> = {
    success: 'success',
    // Was 'delete' — a trash can, which reads as "removed", not "failed".
    error: 'error',
    info: 'info',
    warning: 'warning',
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      // Positioning belongs to ToastContainer. Every toast used to carry
      // `fixed top-4 right-4` itself, so a second toast landed exactly on top
      // of the first and the earlier message was simply lost.
      className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg text-white ${
        colors[type]
      } transform transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <Icon name={icons[type]} size="md" className="text-white" />
      <span className="font-medium">{message}</span>
      <button
        onClick={startClose}
        className="ml-4 hover:opacity-75 transition"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
