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

  const colors = {
    success: 'bg-success-500 text-white',
    error: 'bg-error-500 text-white',
    info: 'bg-info-500 text-white',
    warning: 'bg-warning-500 text-white',
  };

  const icons: Record<ToastType, IconName> = {
    success: 'success',
    error: 'delete',
    info: 'info',
    warning: 'warning',
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg text-white ${
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
