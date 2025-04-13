import { vi } from 'vitest';
import { ReactNode } from 'react';

// Mock functions
export const success = vi.fn();
export const error = vi.fn();
export const loading = vi.fn();
export const dismiss = vi.fn();
export const promise = vi.fn();
export const custom = vi.fn();

// Toast object with position constants
const toast = Object.assign(
  (message: ReactNode) => custom(message),
  {
    success,
    error,
    loading,
    dismiss,
    promise,
    custom,
    // Position constants
    POSITION: {
      TOP_LEFT: 'top-left',
      TOP_CENTER: 'top-center',
      TOP_RIGHT: 'top-right',
      BOTTOM_LEFT: 'bottom-left',
      BOTTOM_CENTER: 'bottom-center',
      BOTTOM_RIGHT: 'bottom-right',
    },
  }
);

// Reset function
export const resetToastMocks = () => {
  success.mockClear();
  error.mockClear();
  loading.mockClear();
  dismiss.mockClear();
  promise.mockClear();
  custom.mockClear();
};

// Default export
export default toast;
