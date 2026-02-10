'use client';

import React, { ReactNode } from 'react';
import { logError } from '@/lib/error-handler';

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

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to centralized error handler (includes Sentry when configured)
    logError(error, `ErrorBoundary: ${errorInfo.componentStack?.slice(0, 200) || 'unknown'}`);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      return (
        fallback?.(error, this.handleReset) || (
          <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
            <div className="max-w-md w-full bg-[var(--surface)] rounded-lg shadow-md p-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">
                  Something went wrong
                </h1>
                <p className="text-[var(--foreground-secondary)] mb-4">
                  An unexpected error occurred. Please try again.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-4 text-left">
                    <summary className="text-sm font-mono text-red-600 cursor-pointer">
                      Error details (dev only)
                    </summary>
                    <pre className="mt-2 text-xs bg-[var(--background-secondary)] p-2 rounded overflow-auto">
                      {error.message}
                      {'\n\n'}
                      {error.stack}
                    </pre>
                  </details>
                )}
                <button
                  onClick={this.handleReset}
                  className="mt-6 w-full bg-[#00E5A0] hover:bg-[#00CC8E] text-[#061A21] font-semibold py-2 px-4 rounded transition"
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
