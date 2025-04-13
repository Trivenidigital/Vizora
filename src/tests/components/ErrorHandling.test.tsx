import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { createErrorQueryResponse } from '../helpers/queryMockHelpers';
import reactQueryMock from '../../mocks/reactQuery';

// Define interfaces
interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ContentItem {
  id: string;
  title: string;
  type: string;
  url: string;
}

// Mock logger service
const loggerService = {
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn()
};

vi.mock('../../services/loggerService', () => ({
  default: loggerService
}));

// Mock network service
const networkService = {
  isOnline: vi.fn(),
  reconnect: vi.fn()
};

vi.mock('../../services/networkService', () => ({
  default: networkService
}));

// Mock content service
const contentService = {
  getContentList: vi.fn(),
  getContentById: vi.fn(),
  retryFetch: vi.fn()
};

vi.mock('../../services/contentService', () => ({
  default: contentService
}));

// Mock ErrorBoundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    loggerService.logError('Component Error', { error, errorInfo });
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div data-testid="error-boundary">
          <h2 data-testid="error-title">Something went wrong.</h2>
          <details data-testid="error-details">
            <summary>Error Details</summary>
            <p data-testid="error-message">{this.state.error?.message}</p>
          </details>
          <button 
            data-testid="error-retry" 
            onClick={this.resetError}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Mock content loading component that may throw errors
const ContentLoader = ({ 
  contentId, 
  shouldFail = false 
}: {
  contentId: string;
  shouldFail?: boolean;
}) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [content, setContent] = React.useState<ContentItem | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const loadContent = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (shouldFail) {
          throw new Error('Failed to load content');
        }
        
        const data = await contentService.getContentById(contentId);
        setContent(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        loggerService.logError('Content loading failed', { contentId, error: err });
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [contentId, shouldFail]);

  const handleRetry = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await contentService.retryFetch(contentId);
      setContent(data);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Retry failed'));
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div data-testid="content-loading">Loading content...</div>;
  }

  if (error) {
    return (
      <div data-testid="content-error">
        <p data-testid="error-message">{error.message}</p>
        <button 
          data-testid="retry-button" 
          onClick={handleRetry}
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div data-testid="content-display">
      {content ? (
        <div data-testid="content-data">{content.title}</div>
      ) : (
        <div data-testid="no-content">No content available</div>
      )}
    </div>
  );
};

// Component that crashes intentionally
const CrashingComponent = ({ 
  shouldCrash = false 
}: {
  shouldCrash?: boolean;
}) => {
  if (shouldCrash) {
    throw new Error('Component crashed intentionally');
  }
  
  return <div data-testid="not-crashed">Component is working normally</div>;
};

// Mock app with error handling
const ErrorHandlingApp = () => {
  const [shouldFail, setShouldFail] = React.useState(false);
  const [shouldCrash, setShouldCrash] = React.useState(false);
  const [networkError, setNetworkError] = React.useState(false);
  
  React.useEffect(() => {
    // Check network status
    const online = networkService.isOnline();
    setNetworkError(!online);
  }, []);
  
  const handleToggleFail = () => {
    setShouldFail(!shouldFail);
  };
  
  const handleToggleCrash = () => {
    setShouldCrash(!shouldCrash);
  };
  
  const handleReconnect = async () => {
    try {
      await networkService.reconnect();
      setNetworkError(false);
    } catch (err) {
      loggerService.logError('Reconnection failed', { error: err });
    }
  };
  
  // Show network error UI if offline
  if (networkError) {
    return (
      <div data-testid="network-error">
        <h2>Network Connection Lost</h2>
        <p>Unable to connect to the server</p>
        <button 
          data-testid="reconnect-button"
          onClick={handleReconnect}
        >
          Reconnect
        </button>
      </div>
    );
  }
  
  return (
    <div>
      <h1>VizoraTV Error Handling</h1>
      
      <div>
        <button 
          data-testid="toggle-fail-button"
          onClick={handleToggleFail}
        >
          {shouldFail ? 'Fix Content Loading' : 'Simulate Content Error'}
        </button>
        
        <button 
          data-testid="toggle-crash-button"
          onClick={handleToggleCrash}
        >
          {shouldCrash ? 'Fix Component' : 'Crash Component'}
        </button>
      </div>
      
      <div>
        <h2>Content Loader (API Error Handling)</h2>
        <ContentLoader contentId="content-1" shouldFail={shouldFail} />
      </div>
      
      <div>
        <h2>Error Boundary Test</h2>
        <ErrorBoundary>
          <CrashingComponent shouldCrash={shouldCrash} />
        </ErrorBoundary>
      </div>
    </div>
  );
};

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reactQueryMock.resetReactQueryMocks();
    
    // Default to online
    networkService.isOnline.mockReturnValue(true);
    
    // Mock content service default response
    contentService.getContentById.mockResolvedValue({
      id: 'content-1',
      title: 'Test Content',
      type: 'image',
      url: '/test.jpg'
    });
    
    contentService.retryFetch.mockResolvedValue({
      id: 'content-1',
      title: 'Retried Content',
      type: 'image',
      url: '/test.jpg'
    });
  });

  it('renders without errors by default', () => {
    render(<ErrorHandlingApp />);
    
    expect(screen.getByText('VizoraTV Error Handling')).toBeInTheDocument();
    expect(screen.queryByTestId('network-error')).not.toBeInTheDocument();
  });

  it('shows network error when offline', async () => {
    // Simulate offline
    networkService.isOnline.mockReturnValue(false);
    
    render(<ErrorHandlingApp />);
    
    expect(screen.getByTestId('network-error')).toBeInTheDocument();
    expect(screen.getByText('Network Connection Lost')).toBeInTheDocument();
    
    // Test reconnect button
    networkService.reconnect.mockResolvedValue(true);
    
    fireEvent.click(screen.getByTestId('reconnect-button'));
    
    // Wait for reconnection and UI update
    await waitFor(() => {
      expect(networkService.reconnect).toHaveBeenCalled();
      expect(screen.queryByTestId('network-error')).not.toBeInTheDocument();
    });
  });

  it('handles API errors in ContentLoader', async () => {
    render(<ErrorHandlingApp />);
    
    // Wait for content to load initially
    await waitFor(() => {
      expect(screen.getByTestId('content-display')).toBeInTheDocument();
      expect(screen.getByTestId('content-data')).toHaveTextContent('Test Content');
    });
    
    // Simulate content loading error
    fireEvent.click(screen.getByTestId('toggle-fail-button'));
    
    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('content-error')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to load content');
    });
    
    // Test retry functionality
    fireEvent.click(screen.getByTestId('retry-button'));
    
    // Wait for successful retry
    await waitFor(() => {
      expect(contentService.retryFetch).toHaveBeenCalledWith('content-1');
      expect(screen.getByTestId('content-data')).toHaveTextContent('Retried Content');
    });
  });

  it('catches rendering errors with ErrorBoundary', async () => {
    render(<ErrorHandlingApp />);
    
    // Initially component renders normally
    expect(screen.getByTestId('not-crashed')).toBeInTheDocument();
    
    // Trigger component crash
    fireEvent.click(screen.getByTestId('toggle-crash-button'));
    
    // ErrorBoundary should show error UI
    await waitFor(() => {
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByTestId('error-title')).toHaveTextContent('Something went wrong');
    });
    
    // Test error details
    expect(screen.getByTestId('error-message')).toHaveTextContent('Component crashed intentionally');
    
    // Check that error was logged
    expect(loggerService.logError).toHaveBeenCalledWith('Component Error', expect.any(Object));
    
    // Test recovery via retry button
    fireEvent.click(screen.getByTestId('error-retry'));
    
    // Component should be attempted to render again, but still fail
    await waitFor(() => {
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    });
    
    // Fix the component
    fireEvent.click(screen.getByTestId('toggle-crash-button'));
    
    // Retry again to recover
    fireEvent.click(screen.getByTestId('error-retry'));
    
    // Component should now render correctly
    await waitFor(() => {
      expect(screen.getByTestId('not-crashed')).toBeInTheDocument();
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
    });
  });

  it('handles non-existent content gracefully', async () => {
    // Mock null response for non-existent content
    contentService.getContentById.mockResolvedValue(null);
    
    render(<ErrorHandlingApp />);
    
    // Wait for content loader to render "no content" state
    await waitFor(() => {
      expect(screen.getByTestId('content-display')).toBeInTheDocument();
      expect(screen.getByTestId('no-content')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('no-content')).toHaveTextContent('No content available');
  });

  it('handles rejected promises with specific error response', async () => {
    // Setup content service to reject with specific error
    contentService.getContentById.mockRejectedValue(new Error('Content expired'));
    
    render(<ErrorHandlingApp />);
    
    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('content-error')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Content expired');
    });
    
    // Verify error was logged
    expect(loggerService.logError).toHaveBeenCalledWith(
      'Content loading failed', 
      expect.objectContaining({ contentId: 'content-1' })
    );
  });
}); 