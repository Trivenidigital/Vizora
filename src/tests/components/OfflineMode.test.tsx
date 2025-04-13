import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createSuccessQueryResponse } from '../helpers/queryMockHelpers';
import reactQueryMock from '../../mocks/reactQuery';
import OfflineMode from '../../components/OfflineMode';
import { useOfflineMode } from '../../hooks/useOfflineMode';

// Define content item interface
interface ContentItem {
  id: string;
  title: string;
  type: string;
  url: string;
}

// Mock Cache Service
const cacheService = {
  getCachedContent: vi.fn(),
  cacheContent: vi.fn(),
  clearCache: vi.fn(),
  isCached: vi.fn()
};

vi.mock('../../services/cacheService', () => ({
  default: cacheService
}));

// Mock Network Service
const networkService = {
  isOnline: vi.fn(),
  onNetworkStatusChange: vi.fn()
};

vi.mock('../../services/networkService', () => ({
  default: networkService
}));

// Mock content service
vi.mock('../../services/contentService', () => ({
  contentService: {
    getContentList: vi.fn(),
    getContentById: vi.fn()
  },
  Content: undefined
}));

// Mock the useOfflineMode hook
jest.mock('../../hooks/useOfflineMode');

describe('OfflineMode Component', () => {
  const mockLoadCachedContent = jest.fn();
  const mockCacheContent = jest.fn();
  const mockIsOnline = jest.fn();
  const mockSetIsOnline = jest.fn();
  const mockIsFallbackMode = jest.fn();
  const mockSetIsFallbackMode = jest.fn();

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementations
    (useOfflineMode as jest.Mock).mockReturnValue({
      loadCachedContent: mockLoadCachedContent,
      cacheContent: mockCacheContent,
      isOnline: mockIsOnline(),
      setIsOnline: mockSetIsOnline,
      isFallbackMode: mockIsFallbackMode(),
      setIsFallbackMode: mockSetIsFallbackMode
    });
  });

  it('renders online mode by default', () => {
    render(<OfflineMode />);
    
    expect(screen.getByTestId('network-status')).toHaveTextContent('Online');
    expect(screen.queryByTestId('fallback-mode')).not.toBeInTheDocument();
  });

  it('switches to offline mode when network is disconnected', async () => {
    networkService.isOnline.mockReturnValue(false);
    cacheService.getCachedContent.mockResolvedValue([]);
    
    render(<OfflineMode />);
    
    // Check if offline mode is displayed
    expect(screen.getByTestId('network-status')).toHaveTextContent('Offline');
    
    // Wait for cached content to load
    await waitFor(() => {
      expect(screen.getByTestId('fallback-mode')).toBeInTheDocument();
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('content-item-2')).toBeInTheDocument();
    });
  });

  it('handles case when no cached content is available offline', async () => {
    networkService.isOnline.mockReturnValue(false);
    cacheService.getCachedContent.mockResolvedValue([]);
    
    render(<OfflineMode />);
    
    // Check if offline mode is displayed with no content
    expect(screen.getByTestId('network-status')).toHaveTextContent('Offline');
    
    await waitFor(() => {
      expect(screen.getByTestId('fallback-mode')).toBeInTheDocument();
      expect(screen.getByTestId('no-content')).toBeInTheDocument();
    });
  });

  it('switches from online to offline mode', async () => {
    // Start in online mode
    mockIsOnline.mockReturnValue(true);
    mockIsFallbackMode.mockReturnValue(false);

    render(<OfflineMode />);

    // Simulate going offline
    mockSetIsOnline(false);
    mockIsOnline.mockReturnValue(false);

    // Trigger a re-render to simulate the state change
    fireEvent.visibilityChange(document);

    await waitFor(() => {
      expect(mockLoadCachedContent).toHaveBeenCalled();
      expect(mockSetIsFallbackMode).toHaveBeenCalledWith(true);
    });
  });

  it('caches new content when online', async () => {
    // Start in online mode
    mockIsOnline.mockReturnValue(true);
    mockIsFallbackMode.mockReturnValue(false);

    render(<OfflineMode />);

    // Simulate new content being available
    const newContent = { id: '1', type: 'image', url: 'test.jpg' };
    fireEvent.message(window, { data: { type: 'NEW_CONTENT', content: newContent } });

    await waitFor(() => {
      expect(mockCacheContent).toHaveBeenCalledWith(newContent);
    });
  });
}); 