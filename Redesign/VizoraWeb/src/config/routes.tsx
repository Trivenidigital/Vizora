import { createBrowserRouter, Navigate, Link, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import Register from '@/pages/auth/Register';
import Dashboard from '@/pages/Dashboard';
import DisplaysPage from '@/pages/displays/DisplaysPage';
import { Settings } from '@/pages/Settings';
import NotFound from '@/pages/NotFound';
import TestCors from '@/pages/TestCors';
import TestPolling from '@/pages/TestPolling';
import SimulateDisplayPairing from '@/pages/test/SimulateDisplayPairing';
import SimulateDisplayRetrieval from '@/pages/test/SimulateDisplayRetrieval';
import { LandingPage } from '@/pages/marketing/LandingPage';
import ContentLibrary from '@/pages/content/ContentLibrary';

// Layouts
import AppLayout from '@/layouts/AppLayout';
import AuthLayout from '@/layouts/AuthLayout';
import ContentLayout from '@/layouts/ContentLayout';

// Simple Error Component to avoid import issues
const SimpleErrorPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-center">
      <h1 className="text-6xl font-bold text-purple-600 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Page Not Found</h2>
      <p className="text-gray-600 mb-8 max-w-md">
        The page you are looking for might have been removed, had its name changed, 
        or is temporarily unavailable.
      </p>
      <Link 
        to="/login" 
        className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
      >
        Go to Login
      </Link>
    </div>
  );
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  // Auth routes
  {
    path: '/',
    element: (
      <AuthProvider>
        <AuthLayout>
          <Outlet />
        </AuthLayout>
      </AuthProvider>
    ),
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <Register />,
      },
    ],
  },
  // App routes - protected with AppLayout
  {
    path: '/',
    element: (
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    ),
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />
      },
      {
        path: 'displays',
        element: <DisplaysPage />
      },
      {
        path: 'content',
        element: <ContentLayout />,
        children: [
          {
            path: '',
            element: <ContentLibrary />
          },
          {
            path: 'library',
            element: <ContentLibrary />
          }
        ]
      },
      {
        path: 'schedules',
        element: <div>Schedule Management</div>
      },
      {
        path: 'analytics',
        element: <div>Analytics Dashboard</div>
      },
      {
        path: 'users',
        element: <div>User Management</div>
      },
      {
        path: 'settings',
        element: <Settings />
      },
    ],
  },
  // Test component routes - accessible without authentication
  {
    path: '/test-api',
    element: <TestCors />,
  },
  {
    path: '/test-polling',
    element: <TestPolling />,
  },
  {
    path: '/test-pairing',
    element: <SimulateDisplayPairing />,
  },
  {
    path: '/test-display',
    element: <SimulateDisplayRetrieval />,
  },
  // Error route
  {
    path: '*',
    element: <NotFound />,
  },
]); 