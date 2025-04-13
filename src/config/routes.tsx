import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import Dashboard from '@/pages/app/Dashboard';
import { ContentPage } from '@/pages/content/ContentPage';
import DisplaysPage from '@/pages/displays/DisplaysPage';
import SchedulePage from '@/pages/schedules/SchedulePage';
import { GroupManagement } from '@/pages/GroupManagement';
import { SignUpPage } from '@/pages/SignUpPage';
import { LoginPage } from '@/pages/LoginPage';
import { ContactPage } from '@/pages/marketing/ContactPage';
import { FeaturesPage } from '@/pages/marketing/FeaturesPage';
import { PricingPage } from '@/pages/marketing/PricingPage';
import { LandingPage } from '@/pages/marketing/LandingPage';
import { ErrorPage } from '@/pages/shared/ErrorPage';
import TestCors from '@/pages/TestCors';

// ... existing code ...

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/',
        element: <LayoutWrapper />,
        children: [
          {
            index: true,
            element: <LandingPage />,
          },
          {
            path: 'login',
            element: <LoginPage />,
          },
          {
            path: 'signup',
            element: <SignUpPage />,
          },
          {
            path: 'features',
            element: <FeaturesPage />,
          },
          {
            path: 'pricing',
            element: <PricingPage />,
          },
          {
            path: 'contact',
            element: <ContactPage />,
          },
          {
            path: 'test-cors',
            element: <TestCors />,
          },
          {
            path: 'dashboard',
            element: (
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            ),
          },
          {
            path: 'content',
            element: (
              <RequireAuth>
                <ContentPage />
              </RequireAuth>
            ),
          },
          {
            path: 'displays',
            element: (
              <RequireAuth>
                <DisplaysPage />
              </RequireAuth>
            ),
          },
          {
            path: 'schedules',
            element: (
              <RequireAuth>
                <SchedulePage />
              </RequireAuth>
            ),
          },
          {
            path: 'groups',
            element: (
              <RequireAuth>
                <GroupManagement />
              </RequireAuth>
            ),
          },
        ],
      },
    ],
  },
]); 