import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';

// Extend Vitest's expect method with Testing Library's matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  
  observe() { return; }
  disconnect() { return; }
  unobserve() { return; }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock ResizeObserver
class MockResizeObserver implements ResizeObserver {
  observe() { return; }
  disconnect() { return; }
  unobserve() { return; }
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock window.matchMedia
window.matchMedia = vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Mock console.error to suppress noisy test output
console.error = vi.fn();

// Mock react-router-dom using importOriginal approach
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    useParams: () => ({}),
  };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => {
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
    custom: vi.fn(),
  };
  
  return {
    __esModule: true,
    default: toast,
    toast,
    Toaster: () => React.createElement(React.Fragment, null),
    ...toast,
  };
});

// Mock @/hooks/useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    verifyToken: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    resetPassword: vi.fn(),
    fetchUserData: vi.fn()
  }),
}));

// Mock @/services/auth
vi.mock('@/services/auth', () => ({
  authService: {
    login: vi.fn().mockResolvedValue({ token: 'fake-token', user: { id: '1', email: 'test@example.com', name: 'Test User', role: 'admin' } }),
    logout: vi.fn().mockResolvedValue({}),
    register: vi.fn().mockResolvedValue({ token: 'fake-token', user: { id: '1', email: 'test@example.com', name: 'Test User', role: 'user' } }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Test User', role: 'admin' }),
    updateProfile: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com', name: 'Updated User', role: 'admin' }),
    changePassword: vi.fn().mockResolvedValue({}),
    resetPassword: vi.fn().mockResolvedValue({}),
    setAuthToken: vi.fn(),
    removeAuthToken: vi.fn(),
  },
  User: class {
    id: string = '';
    email: string = '';
    name: string = '';
    role: string = '';
  }
})); 