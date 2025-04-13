import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext';

// Create a fresh query client for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Wrapper component that provides necessary context providers
interface AllTheProvidersProps {
  children: React.ReactNode;
  initialRoute?: string;
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({
  children,
  initialRoute = '/',
}) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// Custom render function that wraps component with providers
const customRender = (ui: React.ReactElement, options = {}) =>
  render(ui, {
    wrapper: (props) => <AllTheProviders {...props} {...options} />,
    ...options,
  });

// Mock functions
const mockNavigate = vi.fn();
const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render, mockNavigate, mockLocation }; 