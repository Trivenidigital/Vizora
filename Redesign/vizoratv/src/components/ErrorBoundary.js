import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
// Comment out entire class for now to avoid deeper issues
/*
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }
  
  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return this.props.fallback ? (
        <>{this.props.fallback}</>
      ) : (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h2 className="font-bold">Something went wrong.</h2>
          <p>Please try refreshing the page or contact support.</p>
          {this.state.error && (
            <details className="mt-2 text-sm">
              <summary>Error Details</summary>
              <pre className="mt-1 text-xs bg-red-50 p-2 rounded overflow-auto">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <button onClick={this.handleReset} className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
*/
// Provide a dummy export 
const ErrorBoundary = ({ children }) => _jsx(_Fragment, { children: children });
export default ErrorBoundary;
