import React, { Component, ErrorInfo, ReactNode } from 'react';
import { crashReporter } from '../utils/CrashReporter';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo?: ErrorInfo;
}

/**
 * ErrorBoundary component to catch errors in child components
 * and display a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  /**
   * Update state when errors are caught
   */
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Handle component errors
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the CrashReporter
    crashReporter.reportError(error, {
      componentStack: errorInfo.componentStack,
      type: 'react',
      source: 'ErrorBoundary'
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      errorInfo
    });
  }

  /**
   * Reset the error state to allow recovery
   */
  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  /**
   * Render the error boundary
   */
  render(): React.ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props;
      const { error } = this.state;

      // Handle function-as-a-child pattern for fallback
      if (typeof fallback === 'function' && error) {
        try {
           // Execute the function and ensure it returns a valid ReactNode or null
           const fallbackElement = fallback(error, this.resetError);
           return React.isValidElement(fallbackElement) || fallbackElement === null ? fallbackElement : null;
        } catch (renderError) {
            console.error("Error rendering fallback function:", renderError);
            // Fall through to default error UI if function throws
        }
      }

      // Handle ReactNode fallback
      if (fallback && React.isValidElement(fallback)) {
          return fallback;
      }

      // Default fallback UI
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          borderRadius: '5px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb'
        }}>
          <h2>Something went wrong</h2>
          <p>An error occurred in the application.</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Error Details</summary>
            <p>{error?.toString()}</p>
            {this.state.errorInfo && (
              <p>{this.state.errorInfo.componentStack}</p>
            )}
          </details>
          <button
            onClick={this.resetError}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Default export for easier importing
export default ErrorBoundary; 