import { FC } from 'react';
import { Link, useRouteError } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';

export const ErrorPage: FC = () => {
  const error = useRouteError();
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  const errorStatus = (error as any)?.status || 404;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white shadow-sm py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Logo className="h-8" />
        </div>
      </header>
      
      <div className="flex-grow flex items-center justify-center py-12">
        <div className="max-w-md w-full px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-9xl font-bold text-primary-600">{errorStatus}</h1>
          <h2 className="mt-4 text-3xl font-bold text-neutral-900">Page not found</h2>
          <p className="mt-6 text-base text-neutral-600">
            {errorMessage === 'Not Found' 
              ? "Sorry, we couldn't find the page you're looking for." 
              : errorMessage}
          </p>
          <div className="mt-10 flex justify-center space-x-4">
            <Link
              to="/"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Go back home
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center px-6 py-3 border border-neutral-300 bg-white text-base font-medium rounded-md text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Contact support
            </Link>
          </div>
        </div>
      </div>
      
      <footer className="py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <p className="text-neutral-500 text-sm">
            &copy; {new Date().getFullYear()} Vizora. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <Link to="/help" className="text-neutral-500 hover:text-neutral-900">
              Help Center
            </Link>
            <Link to="/legal/privacy" className="text-neutral-500 hover:text-neutral-900">
              Privacy
            </Link>
            <Link to="/legal/terms" className="text-neutral-500 hover:text-neutral-900">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}; 