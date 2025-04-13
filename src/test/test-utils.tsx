import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Create a fresh QueryClient for each test
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Turn off retries during testing
      retry: false,
      // Don't refetch on window focus during tests
      refetchOnWindowFocus: false,
      // No caching between tests
      gcTime: 0,
      // Don't use stale data in tests
      staleTime: 0,
    },
    mutations: {
      // Turn off retries during testing
      retry: false,
    },
  },
});

// All providers wrapper for testing
interface AllTheProvidersProps {
  children: React.ReactNode;
  initialRoute?: string;
}

const AllTheProviders = ({ 
  children, 
  initialRoute = '/' 
}: AllTheProvidersProps) => {
  const queryClient = createTestQueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

const customRender = (
  ui: ReactElement,
  { initialRoute, ...options }: CustomRenderOptions = {}
) => {
  return render(ui, {
    wrapper: (props) => (
      <AllTheProviders initialRoute={initialRoute} {...props} />
    ),
    ...options,
  });
};

// Mock router hooks
export const mockNavigate = vi.fn();

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render }; 