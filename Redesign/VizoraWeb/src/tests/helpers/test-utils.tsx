import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Create a new QueryClient for each test
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});

// Create a wrapper component with all necessary providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = React.useState(() => createTestQueryClient());
  
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// Custom render function with providers
const customRender = (ui: React.ReactElement, options = {}) => {
  const queryClient = createTestQueryClient();
  
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    ),
    ...options,
  });
};

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { customRender as render }; 