import React from 'react';
import { vi } from 'vitest';

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/', search: '', hash: '', state: null };
const mockParams = {};
const mockSearchParams = [new URLSearchParams(), vi.fn()];

// Export individual components for direct import
export const Link = ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
  React.createElement('a', { href: to, ...props }, children)
);

export const BrowserRouter = ({ children }: { children: React.ReactNode }) => (
  React.createElement('div', null, children)
);

export const MemoryRouter = ({ children }: { children: React.ReactNode }) => (
  React.createElement('div', null, children)
);

export const Routes = ({ children }: { children: React.ReactNode }) => (
  React.createElement('div', null, children)
);

export const Route = () => null;
export const Navigate = () => null;
export const Outlet = () => null;
export const NavLink = ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
  React.createElement('a', { href: to, ...props }, children)
);
export const useNavigate = () => mockNavigate;
export const useLocation = () => mockLocation;
export const useParams = () => mockParams;
export const useSearchParams = () => mockSearchParams;
export const useRouteError = () => null;

// Export RouterMock object for use in the mock setup
export const RouterMock = {
  Link,
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  NavLink,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  useRouteError,
}; 