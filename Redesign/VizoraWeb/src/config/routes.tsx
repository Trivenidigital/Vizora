import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { ContentPage } from '@/pages/content/ContentPage';
import DisplaysPage from '@/pages/displays/DisplaysPage';
import { GroupManagement } from '@/pages/GroupManagement';
import { SignUpPage } from '@/pages/SignUpPage';
import { LoginPage } from '@/pages/LoginPage';
import { ContactPage } from '@/pages/marketing/ContactPage';
import { FeaturesPage } from '@/pages/marketing/FeaturesPage';
import { PricingPage } from '@/pages/marketing/PricingPage';
import { LandingPage } from '@/pages/marketing/LandingPage';
import { ErrorPage } from '@/pages/shared/ErrorPage';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

// Auth guard component
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth() as AuthContextType;
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Wrapper for Layout with Outlet
const LayoutWrapper = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LayoutWrapper />,
    errorElement: <ErrorPage />,
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
        path: 'groups',
        element: (
          <RequireAuth>
            <GroupManagement />
          </RequireAuth>
        ),
      },
    ],
  },
]); 