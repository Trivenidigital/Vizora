import { vi } from 'vitest';
import React from 'react';

// Mock navigation function
const mockNavigate = vi.fn();

// Basic component mocks
const Link = ({ to, children, ...props }: any) => React.createElement(
  'a',
  { 
    href: to,
    onClick: (e: any) => {
      e.preventDefault();
      mockNavigate(to);
    },
    'data-testid': props['data-testid'] || `link-${to}`,
    ...props
  },
  children
);

const NavLink = ({ to, children, ...props }: any) => React.createElement(
  'a',
  { 
    href: to,
    onClick: (e: any) => {
      e.preventDefault();
      mockNavigate(to);
    },
    'data-testid': props['data-testid'] || `navlink-${to}`,
    ...props
  },
  children
);

const Navigate = ({ to }: any) => {
  React.useEffect(() => {
    mockNavigate(to);
  }, [to]);
  return null;
};

const Outlet = () => React.createElement('div', { 'data-testid': 'outlet' });

const Routes = ({ children }: any) => React.createElement('div', { 'data-testid': 'routes' }, children);

const Route = ({ path, element }: any) => React.createElement('div', { 'data-testid': `route-${path}` }, element);

const BrowserRouter = ({ children }: any) => React.createElement(
  'div',
  { 'data-testid': 'browser-router' },
  children
);

const MemoryRouter = ({ children, initialEntries = ['/'] }: any) => React.createElement(
  'div',
  { 'data-testid': 'memory-router', 'data-initial-entries': JSON.stringify(initialEntries) },
  children
);

// Hook mocks
const useNavigate = () => mockNavigate;

const useLocation = () => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default'
});

const useParams = () => ({});

// Additional exports
const useMatch = () => null;
const useResolvedPath = (to: string) => ({ pathname: to, search: '', hash: '' });
const useHref = (to: string) => typeof to === 'string' ? to : to.pathname;

export {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Routes,
  Route,
  BrowserRouter,
  MemoryRouter,
  useNavigate,
  useLocation,
  useParams,
  useMatch,
  useResolvedPath,
  useHref,
  mockNavigate
}; 