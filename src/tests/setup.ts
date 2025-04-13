import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Configure testing environment
beforeAll(() => {
  // Add any global test setup here
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// Configure global test environment
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useEffect: vi.fn((callback, deps) => {
      if (typeof callback === 'function') {
        const cleanup = callback();
        if (typeof cleanup === 'function') {
          return cleanup;
        }
      }
    }),
  };
});

// Mock FileReader
class MockFileReader {
  onload: (() => void) | null = null;
  result: string | null = null;
  readAsText(file: Blob) {
    setTimeout(() => {
      this.result = '{}';
      this.onload?.();
    }, 0);
  }
}

global.FileReader = MockFileReader as any;

// Mock fetch
global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  blob: () => Promise.resolve(new Blob()),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.sessionStorage = sessionStorageMock as any;

// Mock organization service
vi.mock('../services/organizationService', () => ({
  default: {
    getContentByOrganization: vi.fn(),
    getFolders: vi.fn(),
    getTags: vi.fn(),
    createFolder: vi.fn(),
    createTag: vi.fn(),
    deleteFolder: vi.fn(),
    deleteTag: vi.fn(),
  },
}));

// Mock content service
vi.mock('../services/contentService', () => ({
  default: {
    uploadContent: vi.fn(),
    getContentList: vi.fn(),
    getContentById: vi.fn(),
    updateContent: vi.fn(),
    deleteContent: vi.fn(),
    pushContentToDisplay: vi.fn(),
  },
}));

// Mock display service
vi.mock('../services/displayService', () => ({
  default: {
    getDisplays: vi.fn(),
    getDisplayById: vi.fn(),
    updateDisplay: vi.fn(),
    deleteDisplay: vi.fn(),
  },
}));

// Mock config service
vi.mock('../services/configService', () => ({
  default: {
    getConfiguration: vi.fn(),
    updateConfiguration: vi.fn(),
    resetConfiguration: vi.fn(),
    exportConfiguration: vi.fn(),
    importConfiguration: vi.fn(),
  },
})); 