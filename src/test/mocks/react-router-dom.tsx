import React from 'react';
import { vi } from 'vitest';

export const Link = vi.fn(({ to, children, ...props }) => 
  React.createElement('a', { href: to, ...props }, children)
);

export const NavLink = vi.fn(({ to, children, ...props }) => 
  React.createElement('a', { href: to, ...props }, children)
);

export const BrowserRouter = vi.fn(({ children }) => 
  React.createElement('div', null, children)
);

export const Routes = vi.fn(({ children }) => 
  React.createElement('div', null, children)
);

export const Route = vi.fn(() => null);

export const Navigate = vi.fn(() => null);

export const Outlet = vi.fn(() => null);

export const useNavigate = vi.fn(() => vi.fn());

export const useLocation = vi.fn(() => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null
}));

export const useParams = vi.fn(() => ({}));

export const useSearchParams = vi.fn(() => [new URLSearchParams(), vi.fn()]);

export const useRouteError = vi.fn(() => null);

export const createBrowserRouter = vi.fn((routes) => ({ routes }));

export default {
  Link,
  NavLink,
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  useRouteError,
  createBrowserRouter
}; 