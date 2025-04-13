import '@testing-library/jest-dom';
import { vi } from 'vitest';
import * as RouterMock from './mocks/react-router-dom';
import React from 'react';

// Mock react-router-dom
vi.mock('react-router-dom', () => RouterMock);

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
    ...toast,
  } as const;
});

// Mock data
const mockContent = [
  { id: '1', name: 'Test Video', type: 'video', url: 'test.mp4' },
  { id: '2', name: 'Test Image', type: 'image', url: 'test.jpg' },
];

const mockDisplays = [
  { id: '1', name: 'Main Lobby Display', status: 'online' },
  { id: '2', name: 'Conference Room A', status: 'offline' },
  { id: '3', name: 'Cafeteria Display', status: 'online' },
];

// Mock services
const contentService = {
  getContentList: vi.fn().mockResolvedValue(mockContent),
  deleteContent: vi.fn().mockResolvedValue(undefined),
  uploadContent: vi.fn().mockResolvedValue({ id: 'new-content-id' }),
  getContent: vi.fn().mockResolvedValue(mockContent[0]),
  updateContent: vi.fn().mockResolvedValue(mockContent[0]),
  pushToDisplay: vi.fn().mockResolvedValue(undefined),
};

const displayService = {
  getDisplayList: vi.fn().mockResolvedValue(mockDisplays),
  unpairDisplay: vi.fn().mockResolvedValue(undefined),
  registerDisplay: vi.fn().mockResolvedValue({ id: 'new-display-id' }),
  getDisplay: vi.fn().mockResolvedValue(mockDisplays[0]),
  updateDisplay: vi.fn().mockResolvedValue(mockDisplays[0]),
};

vi.mock('@/services/content', () => ({
  __esModule: true,
  default: contentService,
}));

vi.mock('@/services/display', () => ({
  __esModule: true,
  default: displayService,
}));

// Export for use in tests
export { contentService, displayService };

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = vi.fn();

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn();
  
  constructor() {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    this.takeRecords = vi.fn();
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});