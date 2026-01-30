'use client';

import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error tracking service (Sentry, LogRocket, etc.)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      console.error('Error Boundary caught:', error, errorInfo);
      // TODO: Send to error tracking service
    } else {
      console.error('[DEV] Error Boundary:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      return (
        fallback?.(error, this.handleReset) || (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                  Something went wrong
                </h1>
                <p className="text-gray-600 mb-4">
                  An unexpected error occurred. Please try again.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-4 text-left">
                    <summary className="text-sm font-mono text-red-600 cursor-pointer">
                      Error details (dev only)
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {error.message}
                      {'\n\n'}
                      {error.stack}
                    </pre>
                  </details>
                )}
                <button
                  onClick={this.handleReset}
                  className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return children;
  }
}

export default ErrorBoundary;
