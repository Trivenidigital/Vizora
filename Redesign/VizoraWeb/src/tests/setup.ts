import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';
import type { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import axios from 'axios';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
  NavLink: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
  Outlet: () => React.createElement('div'),
  Routes: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  Route: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  BrowserRouter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

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

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
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
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
    })),
  },
  create: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  })),
}));

// Mock content service
const mockContent = {
  id: '1',
  title: 'Test Content',
  description: 'Test Description',
  type: 'text',
  content: 'Test content text',
  status: 'published',
  displayIds: ['1'],
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
};

vi.mock('@/services/contentService', () => {
  return {
    getContentList: vi.fn().mockResolvedValue([mockContent]),
    getContentById: vi.fn().mockResolvedValue(mockContent),
    createContent: vi.fn().mockResolvedValue({ 
      id: '2',
      title: 'New Content',
      description: 'New Description',
      type: 'image',
      content: 'New content text',
      status: 'draft',
      displayIds: ['1'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }),
    updateContent: vi.fn().mockResolvedValue({
      id: '1',
      title: 'Updated Content',
      status: 'published',
      updatedAt: '2023-01-01T00:00:00Z'
    }),
    deleteContent: vi.fn().mockResolvedValue(undefined),
    scheduleContent: vi.fn().mockResolvedValue({ success: true }),
    getContentAnalytics: vi.fn().mockResolvedValue({
      views: 100,
      averageViewDuration: 30,
      completionRate: 0.8,
      lastViewed: '2023-01-01T00:00:00Z'
    }),
    uploadContent: vi.fn().mockResolvedValue({ id: '3', url: 'https://example.com/upload.jpg' }),
    pushContentToDisplay: vi.fn().mockResolvedValue({ success: true }),
    validateContent: vi.fn().mockResolvedValue({ isValid: true }),
    getContentCategories: vi.fn().mockResolvedValue([{ id: '1', name: 'News' }]),
    createContentCategory: vi.fn().mockResolvedValue({ id: '2', name: 'Promotions' }),
    deleteContentCategory: vi.fn().mockResolvedValue(undefined),
    __setErrorMode: vi.fn(),
    default: {
      getContentList: vi.fn().mockResolvedValue([mockContent]),
      getContentById: vi.fn().mockResolvedValue(mockContent),
      createContent: vi.fn().mockResolvedValue({ 
        id: '2',
        title: 'New Content',
        description: 'New Description',
        type: 'image',
        content: 'New content text',
        status: 'draft',
        displayIds: ['1'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }),
      updateContent: vi.fn().mockResolvedValue({
        id: '1',
        title: 'Updated Content',
        status: 'published',
        updatedAt: '2023-01-01T00:00:00Z'
      }),
      deleteContent: vi.fn().mockResolvedValue(undefined),
      scheduleContent: vi.fn().mockResolvedValue({ success: true }),
      getContentAnalytics: vi.fn().mockResolvedValue({
        views: 100,
        averageViewDuration: 30,
        completionRate: 0.8,
        lastViewed: '2023-01-01T00:00:00Z'
      }),
      uploadContent: vi.fn().mockResolvedValue({ id: '3', url: 'https://example.com/upload.jpg' }),
      pushContentToDisplay: vi.fn().mockResolvedValue({ success: true }),
      validateContent: vi.fn().mockResolvedValue({ isValid: true }),
      getContentCategories: vi.fn().mockResolvedValue([{ id: '1', name: 'News' }]),
      createContentCategory: vi.fn().mockResolvedValue({ id: '2', name: 'Promotions' }),
      deleteContentCategory: vi.fn().mockResolvedValue(undefined),
    }
  };
});

// Mock display service
const mockDisplays = [
  {
    id: '1',
    name: 'Main Lobby Display',
    location: 'Lobby',
    status: 'online',
    lastPing: '2023-01-01T00:00:00Z',
    resolution: '1920x1080',
    currentContent: '1',
    paired: true
  },
  {
    id: '2',
    name: 'Conference Room A',
    location: 'Conference Room',
    status: 'offline',
    lastPing: '2023-01-01T00:00:00Z',
    resolution: '1920x1080',
    currentContent: null,
    paired: true
  },
  {
    id: '3',
    name: 'Cafeteria Display',
    location: 'Cafeteria',
    status: 'online',
    lastPing: '2023-01-01T00:00:00Z',
    resolution: '1920x1080',
    currentContent: '2',
    paired: true
  }
];

vi.mock('@/services/displayService', () => {
  return {
    getDisplays: vi.fn().mockResolvedValue(mockDisplays),
    pairDisplay: vi.fn().mockResolvedValue({
      id: '4',
      name: 'New Display',
      location: 'Reception',
      status: 'online',
      lastPing: '2023-01-01T00:00:00Z',
      resolution: '1920x1080',
      currentContent: null,
      paired: true
    }),
    getDisplay: vi.fn().mockResolvedValue(mockDisplays[0]),
    updateDisplay: vi.fn().mockResolvedValue({
      id: '1',
      name: 'Updated Display',
      location: 'Lobby',
      status: 'online',
      lastPing: '2023-01-01T00:00:00Z',
      resolution: '1920x1080',
      currentContent: '1',
      paired: true
    }),
    unpairDisplay: vi.fn().mockResolvedValue({ success: true }),
    pushContent: vi.fn().mockResolvedValue({ success: true }),
    __setErrorMode: vi.fn(),
    default: {
      getDisplays: vi.fn().mockResolvedValue(mockDisplays),
      pairDisplay: vi.fn().mockResolvedValue({
        id: '4',
        name: 'New Display',
        location: 'Reception',
        status: 'online',
        lastPing: '2023-01-01T00:00:00Z',
        resolution: '1920x1080',
        currentContent: null,
        paired: true
      }),
      getDisplay: vi.fn().mockResolvedValue(mockDisplays[0]),
      updateDisplay: vi.fn().mockResolvedValue({
        id: '1',
        name: 'Updated Display',
        location: 'Lobby',
        status: 'online',
        lastPing: '2023-01-01T00:00:00Z',
        resolution: '1920x1080',
        currentContent: '1',
        paired: true
      }),
      unpairDisplay: vi.fn().mockResolvedValue({ success: true }),
      pushContent: vi.fn().mockResolvedValue({ success: true }),
    }
  };
});

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
}); 