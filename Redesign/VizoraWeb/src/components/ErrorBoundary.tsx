import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 px-6 py-4">
              <h2 className="text-lg font-medium text-red-800 flex items-center">
                <ExclamationCircleIcon className="h-6 w-6 mr-2 text-red-600" />
                Something went wrong
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-800 mb-4">We encountered an error while loading this page:</p>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 overflow-auto">
                <code className="text-sm text-red-600 font-mono">
                  {this.state.error?.message || 'Unknown error'}
                </code>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Reload Page
                </button>
                <button
                  onClick={this.resetError}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 