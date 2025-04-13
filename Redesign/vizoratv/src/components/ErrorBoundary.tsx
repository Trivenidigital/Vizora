import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  logger?: {
    error: (message: string, error: Error, errorInfo: ErrorInfo) => void;
  };
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    // Log the error using the provided logger if available
    this.props.logger?.error("ErrorBoundary caught an error", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-red-900 text-white p-8">
          <h1 className="text-2xl font-bold mb-4">Oops! Something went wrong.</h1>
          <p className="mb-4">We encountered an error processing your request. Please try refreshing the page.</p>
          {import.meta.env.DEV && this.state.error && (
            <details className="w-full max-w-2xl bg-red-800 p-4 rounded mt-4 text-left">
              <summary>Error Details (Dev Mode)</summary>
              <pre className="mt-2 text-sm whitespace-pre-wrap break-words">
                {this.state.error.toString()}
                \n\nStack Trace:\n
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-white text-red-900 font-semibold rounded hover:bg-gray-200"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 