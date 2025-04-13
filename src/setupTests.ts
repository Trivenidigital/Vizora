import '@testing-library/jest-dom';
import { server } from './mocks/server';
import { vi } from 'vitest';
import React from 'react';
import { resetRouterMocks } from './mocks/react-router-dom';
import { resetContentServiceMocks } from './mocks/contentService';
import { resetDisplayServiceMocks } from './mocks/displayService';
import { resetToastMocks } from './mocks/react-hot-toast';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => {
    return React.createElement('a', { href: to }, children);
  },
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useOutletContext: () => ({}),
  Outlet: () => null,
  Navigate: ({ to }: { to: string }) => {
    return React.createElement('div', {}, `Navigated to ${to}`);
  },
}));

// Mock contentService
vi.mock('./services/contentService', async () => {
  const actual = await import('./mocks/contentService');
  return {
    ...actual,
    contentService: actual.contentService,
    getContentList: actual.contentService.getContentList,
    getContentById: actual.contentService.getContentById,
    createContent: actual.contentService.createContent,
    updateContent: actual.contentService.updateContent,
    deleteContent: actual.contentService.deleteContent,
    scheduleContent: actual.contentService.scheduleContent,
    getContentAnalytics: actual.contentService.getContentAnalytics,
    uploadContent: actual.contentService.uploadContent,
    pushContentToDisplay: actual.contentService.pushContentToDisplay,
    __esModule: true,
    default: actual.contentService
  };
});

// Mock displayService
vi.mock('./services/displayService', () => ({
  default: {
    getDisplays: vi.fn(),
    getDisplayById: vi.fn(),
    registerDisplay: vi.fn(),
    updateDisplay: vi.fn(),
    deleteDisplay: vi.fn(),
    getDisplayStatus: vi.fn(),
    generatePairingCode: vi.fn(),
    pairDisplay: vi.fn(),
    unpairDisplay: vi.fn(),
    sendCommand: vi.fn()
  }
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
    promise: vi.fn(),
    Toaster: () => null,
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
    promise: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn()
  })),
  __esModule: true
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    }))
  },
  __esModule: true
}));

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  resetRouterMocks();
  resetContentServiceMocks();
  resetDisplayServiceMocks();
  resetToastMocks();
});

// Start MSW server before all tests
beforeAll(() => {
  // MSW server setup code here
});

// Close MSW server after all tests
afterAll(() => {
  // MSW server cleanup code here
}); 