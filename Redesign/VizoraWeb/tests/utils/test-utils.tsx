import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { vi } from 'vitest';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
  useParams: () => ({}),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  ...vi.importActual('react-hot-toast'),
  Toaster: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function render(ui: React.ReactElement, { route = '/' } = {}) {
  window.history.pushState({}, 'Test page', route);

  return rtlRender(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          {ui}
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { render }; 