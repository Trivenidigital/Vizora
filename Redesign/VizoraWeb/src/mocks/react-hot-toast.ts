import { ReactNode } from 'react';
import { vi } from 'vitest';

export const toast = {
  success: (message: string): void => {
    console.log('Success:', message);
  },
  error: (message: string): void => {
    console.error('Error:', message);
  },
  loading: (message: string): void => {
    console.log('Loading:', message);
  },
  dismiss: (): void => {
    console.log('Dismiss toast');
  },
  custom: (message: ReactNode): void => {
    console.log('Custom:', message);
  },
  promise: async <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ): Promise<T> => {
    console.log('Promise loading:', messages.loading);
    try {
      const result = await promise;
      console.log('Promise success:', messages.success);
      return result;
    } catch (error) {
      console.error('Promise error:', messages.error);
      throw error;
    }
  },
  remove: vi.fn(),
  clear: vi.fn(),
  position: 'top-right',
  duration: 3000,
  id: 'toast-id',
  type: 'success',
  description: 'Test toast description',
  icon: '🚀',
  action: {
    label: 'Undo',
    onClick: vi.fn()
  }
};

export const Toaster = (): JSX.Element => <div data-testid="toaster" />;

export const useToast = () => ({
  toast,
  dismiss: vi.fn(),
  promise: vi.fn(),
  custom: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn()
});

export default toast; 