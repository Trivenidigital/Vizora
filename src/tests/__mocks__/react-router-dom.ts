import { vi } from 'vitest';
import React from 'react';

const mockNavigate = vi.fn();
const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
};

export const Link = vi.fn(({ to, children, ...props }) => 
  React.createElement('a', { href: to, ...props }, children)
);

export const NavLink = vi.fn(({ to, children, ...props }) => 
  React.createElement('a', { href: to, ...props }, children)
);

export const Navigate = vi.fn(({ to }) => null);

export const useNavigate = vi.fn(() => mockNavigate);

export const useLocation = vi.fn(() => mockLocation);

export const useParams = vi.fn(() => ({}));

export const Outlet = vi.fn(() => null);

export const Routes = vi.fn(({ children }) => children);

export const Route = vi.fn(({ children }) => children);

export const BrowserRouter = vi.fn(({ children }) => children);

// Reset all mocks
export const resetMocks = () => {
  mockNavigate.mockReset();
  useNavigate.mockImplementation(() => mockNavigate);
  useLocation.mockImplementation(() => mockLocation);
  useParams.mockImplementation(() => ({}));
};

// Default export
const router = {
  Link,
  NavLink,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  Outlet,
  Routes,
  Route,
  BrowserRouter,
};

export default router; 